import { accountRequest, AccountApiError } from './accountApi.js';

export const managedRoles = ['Learner', 'Instructor', 'GeneralAdmin', 'CategoryAdmin'];
const guid = value => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);
export const canManageUsers = session => Boolean(session?.profile?.roles?.includes('GeneralAdmin'));
export function accountDestination(session) {
  if (session?.profile?.roles?.includes('GeneralAdmin')) return '/admin';
  if (session?.profile?.roles?.includes('CategoryAdmin')) return '/category-admin';
  return session?.onboardingRequired ? '/onboarding/role' : session?.profile?.role === 'instructor' ? '/instructor' : '/learner';
}
export function adminUserMessage(error, language) {
  const ar = language === 'ar';
  if (error?.status === 401) return ar ? 'انتهت الجلسة. سجّل الدخول من جديد.' : 'Your session expired. Sign in again.';
  if (error?.status === 403) return ar ? 'إدارة المستخدمين متاحة لمدير النظام فقط.' : 'User management requires GeneralAdmin membership.';
  if (error?.status === 409) return ar ? 'تعارض التغيير مع حالة الحساب أو قواعد الحماية. أعد تحميل التفاصيل.' : 'The change conflicts with the current account state or protection rules. Reload the details.';
  if (error?.status === 404) return ar ? 'الحساب غير موجود.' : 'The account was not found.';
  if (error?.status === 400) return ar ? 'راجع الأدوار وموعد انتهاء القفل قبل المحاولة.' : 'Check the roles and lockout end before retrying.';
  if (error?.code === 'unconfigured') return ar ? 'خدمة إدارة المستخدمين غير مهيأة.' : 'The user management API is not configured.';
  return ar ? 'تعذّر إكمال الطلب. أعد المحاولة؛ لم نعرض نجاحًا محليًا.' : 'The request could not be completed. Retry; no local success has been assumed.';
}
export function validateAdminUser(value) {
  if (!guid(value?.id) || !Array.isArray(value.roles) || value.roles.some(role => typeof role !== 'string')
    || typeof value.isLockedOut !== 'boolean' || typeof value.lockoutEnabled !== 'boolean'
    || !/^[\da-f]{64}$/i.test(value.version || '')) throw new AccountApiError('response');
  return value;
}
export async function listAdminUsers({ page = 1, pageSize = 20, search = '', role = '', status = '' } = {}, request = accountRequest) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) params.set('search', search.trim());
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  const result = await request(`/api/admin/users?${params}`, undefined, { method: 'GET' });
  if (!Array.isArray(result?.items) || !Number.isInteger(result.totalCount) || result.totalCount < 0
    || result.page !== page || result.pageSize !== pageSize) throw new AccountApiError('response');
  result.items.forEach(validateAdminUser);
  return result;
}
export async function getAdminUser(id, request = accountRequest) {
  if (!guid(id)) throw new AccountApiError('request', 400);
  return validateAdminUser(await request(`/api/admin/users/${encodeURIComponent(id)}`, undefined, { method: 'GET' }));
}
export async function updateAdminRoles(user, roles, request = accountRequest) {
  validateAdminUser(user);
  if (!Array.isArray(roles) || roles.some(role => !managedRoles.includes(role)) || new Set(roles).size !== roles.length
    || roles.includes('CategoryAdmin') !== user.roles.includes('CategoryAdmin')) throw new AccountApiError('request', 400);
  return validateAdminUser(await request(`/api/admin/users/${encodeURIComponent(user.id)}/roles`, { roles, version: user.version }, { method: 'PUT' }));
}
export async function updateAdminLockout(user, lockoutEnd, request = accountRequest) {
  validateAdminUser(user);
  if (lockoutEnd !== null && (!user.lockoutEnabled || !Number.isFinite(Date.parse(lockoutEnd)) || Date.parse(lockoutEnd) <= Date.now()))
    throw new AccountApiError('request', 400);
  return validateAdminUser(await request(`/api/admin/users/${encodeURIComponent(user.id)}/lockout`, { lockoutEnd, version: user.version }, { method: 'PUT' }));
}
