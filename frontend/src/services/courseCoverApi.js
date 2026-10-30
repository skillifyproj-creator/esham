import { apiBase } from './accountApi.js';
import { courseRequest } from './curriculumApi.js';
export const loadCourseCover = (courseId, signal) => courseRequest(`/courses/${courseId}/draft/cover`, undefined, 'GET', signal);
export async function uploadCourseCover(courseId, file, uploadId, signal) {
  const response = await fetch(`${apiBase}/api/courses/${courseId}/draft/cover`, {
    method: 'PUT', credentials: 'include', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
    headers: { 'Content-Type': file.type, 'X-Requested-With': 'XMLHttpRequest', 'X-Upload-Id': uploadId, 'X-File-Name': encodeURIComponent(file.name) }, body: file,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(Object.values(data?.errors || {}).flat().join(' ') || data?.title || `Cover upload failed (${response.status}).`);
  return data;
}
// PATCH only changed metadata. Selecting a cover must not rewrite unrelated fields or localization.
export function changedCourseDraftFields(payload, stored) {
  if (!stored) return payload;
  const normalize = (key, value) => key === 'objectives' ? (value || []).map(x => ({ ar: x.ar || '', en: x.en || '' })) : value ?? '';
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) => JSON.stringify(normalize(key, value)) !== JSON.stringify(normalize(key, stored[key]))));
}
