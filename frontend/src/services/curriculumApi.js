import { apiBase } from './accountApi.js';

export async function courseRequest(path, body, method = 'GET', signal) {
  const response = await fetch(`${apiBase}/api${path}`, {
    method, credentials: 'include', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(Object.values(data?.errors || {}).flat().join(' ') || data?.title || `Request failed (${response.status})`);
  return data;
}
export const curriculumPath = courseId => `/courses/${courseId}/draft/sections`;
export const courseCoverUrl = (courseId, assetId) => assetId ? `${apiBase}/api/courses/${courseId}/draft/cover/${assetId}/content` : '';
export const loadCurriculumReadiness = (courseId, signal) => courseRequest(`${curriculumPath(courseId)}/readiness`, undefined, 'GET', signal);
export const previewLessonReadiness = (courseId, sectionId, lessonId, lesson, signal) => courseRequest(
  `${curriculumPath(courseId)}/${sectionId}/lessons/readiness`, { lessonId, lesson }, 'POST', signal);
export function mapLesson(x) {
  return { ...x, title: { ar: x.titleAr || '', en: x.titleEn || '' },
    description: { ar: x.descriptionAr || '', en: x.descriptionEn || '' },
    minutes: (x.durationSeconds || 0) / 60, duration: (x.durationSeconds || 0) / 60,
    objectives: x.objectives || [], resources: [], video: {}, videoUrl: '' };
}
export function mapSection(x) {
  return { ...x, title: { ar: x.titleAr || '', en: x.titleEn || '' }, lessons: x.lessons.map(mapLesson), task: null };
}
export function mapCourse(x) {
  return { id: x.courseId, image: courseCoverUrl(x.courseId, x.draft?.coverMediaAssetId), instructor: { ar: x.owner?.name || '', en: x.owner?.nameEn || x.owner?.name || '' }, title: { ar: x.draft?.titleAr || '', en: x.draft?.titleEn || '' },
    description: { ar: x.draft?.descriptionAr || '', en: x.draft?.descriptionEn || '' } };
}
