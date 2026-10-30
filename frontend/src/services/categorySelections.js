import { accountRequest, AccountApiError } from './accountApi.js';

export const isCategoryId = value => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);
export const categoryIds = values => [...new Set((Array.isArray(values) ? values : []).filter(isCategoryId).map(id => id.toLowerCase()))];

// Never interpret legacy positions, names, or display order as database IDs.
export function reconcileCategoryProfile(value = {}) {
  const learningCategoryIds = categoryIds(value.learningCategoryIds);
  const teachingCategoryIds = categoryIds(value.teachingCategoryIds);
  const legacyLearning = value.role !== 'instructor' && Array.isArray(value.interests) && value.interests.length > 0 && learningCategoryIds.length === 0;
  const legacyTeaching = value.role !== 'learner' && Array.isArray(value.teachingAreas) && value.teachingAreas.length > 0 && teachingCategoryIds.length === 0;
  return { ...value, learningCategoryIds, teachingCategoryIds, interests: [], teachingAreas: [],
    categoryReselectionRequired: Boolean(legacyLearning || legacyTeaching || value.categoryReselectionRequired) };
}

function selectionsResponse(value) {
  for (const field of ['learningCategoryIds', 'teachingCategoryIds']) {
    if (!Array.isArray(value?.[field]) || value[field].some(id => !isCategoryId(id))
      || categoryIds(value[field]).length !== value[field].length) throw new AccountApiError('response');
  }
  return { learningCategoryIds: categoryIds(value.learningCategoryIds), teachingCategoryIds: categoryIds(value.teachingCategoryIds) };
}

export async function loadCategoryCatalog(request = accountRequest) {
  const result = await request('/api/categories', undefined, { method: 'GET' });
  if (!Array.isArray(result) || result.some(item => !isCategoryId(item?.id) || typeof item.nameAr !== 'string'
    || typeof item.nameEn !== 'string' || item.isActive !== true)
    || new Set(result.map(item => item.id.toLowerCase())).size !== result.length) throw new AccountApiError('response');
  return result.map(item => ({ ...item, id: item.id.toLowerCase() }));
}

export async function loadServerSession(request = accountRequest) {
  const session = await request('/auth/session', undefined, { method: 'GET' });
  if (!session?.profile?.id || typeof session.onboardingRequired !== 'boolean') throw new AccountApiError('response');
  const selected = selectionsResponse(await request('/me/categories', undefined, { method: 'GET' }));
  const profile = reconcileCategoryProfile({ ...session.profile, ...selected });
  // Actual Identity memberships are supplied by the server. Legacy client flags
  // cannot re-enable a capability after it was removed.
  delete profile.isLearner; delete profile.learner; delete profile.isInstructor; delete profile.instructor;
  profile.roles = Array.isArray(session.profile.roles) ? session.profile.roles : [];
  // The server owns onboarding completeness, including compatibility with saved legacy
  // selections. Catalog reselection is a profile-edit concern, not a second login gate.
  return { profile, onboardingRequired: session.onboardingRequired };
}

export function profileRequest(profile, { includeCategories = false } = {}) {
  const fields = ['name', 'nameEn', 'username', 'role', 'avatar', 'bio', 'customSkills', 'goal'];
  const body = Object.fromEntries(fields.filter(field => profile[field] !== undefined).map(field => [field, profile[field]]));
  if (includeCategories) {
    if (profile.role !== 'instructor') body.learningCategoryIds = categoryIds(profile.learningCategoryIds);
    if (profile.role !== 'learner') body.teachingCategoryIds = categoryIds(profile.teachingCategoryIds);
  }
  return body;
}

export async function replaceCategories(kind, ids, request = accountRequest) {
  if (!['learning', 'teaching'].includes(kind) || !Array.isArray(ids) || ids.some(id => !isCategoryId(id))
    || categoryIds(ids).length !== ids.length) throw new AccountApiError('request');
  return selectionsResponse(await request(`/me/categories/${kind}`, { categoryIds: categoryIds(ids) }, { method: 'PUT' }));
}

export const categoryLabel = (catalog, id, language) => {
  const item = catalog.find(category => category.id === id);
  return item ? (language === 'ar' ? item.nameAr || item.nameEn : item.nameEn || item.nameAr)
    : (language === 'ar' ? 'مجال غير متاح — أعد الاختيار' : 'Unavailable category — select again');
};

export function validateCategoryDraft(profile, catalog) {
  const active = new Set(catalog.map(item => item.id));
  const learning = categoryIds(profile.learningCategoryIds), teaching = categoryIds(profile.teachingCategoryIds);
  if ([...(profile.role !== 'instructor' ? learning : []), ...(profile.role !== 'learner' ? teaching : [])].some(id => !active.has(id))) return 'unavailable';
  if (profile.role !== 'instructor' && !learning.length) return 'learning';
  if (profile.role !== 'learner' && !teaching.length && !profile.customSkills?.length) return 'teaching';
  return null;
}
