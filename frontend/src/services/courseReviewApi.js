import { courseRequest } from './curriculumApi.js';
export const loadCourseReview = (courseId, signal, versionId) => courseRequest(`/courses/${courseId}/review${versionId ? '/versions/' + versionId : ''}`, undefined, 'GET', signal);
export async function listCourseReviews(status = '', signal) {
 const rows = await courseRequest('/course-reviews' + (status ? '?status=' + encodeURIComponent(status) : ''), undefined, 'GET', signal);
 if (!Array.isArray(rows)) throw new Error('The server returned an invalid course review list. Retry the request.');
 return rows;
}
export const submitCourseReview = (courseId, expectedVersionId) => courseRequest(`/courses/${courseId}/review/submit`, { expectedVersionId }, 'POST');
export const createCourseRevision = (courseId, expectedVersionId) => courseRequest(`/courses/${courseId}/review/revision`, { expectedVersionId }, 'POST');
export async function decideCourseReview(courseId, versionId, decision, comment) {
 const result = await courseRequest(`/courses/${courseId}/review/versions/${versionId}/decision`, { decision, comment }, 'POST');
 if (decision === 'approved' && typeof window !== 'undefined') window.dispatchEvent(new Event('esham:catalog-updated'));
 return result;
}
export const reviewStatusLabel = (status, language) => ({
 draft: ['مسودة', 'Draft'], pending: ['بانتظار المراجعة', 'Pending review'], approved: ['معتمد', 'Approved'],
 rejected: ['مرفوض', 'Rejected'], changes_requested: ['مطلوب تعديلات', 'Changes requested']
}[status]?.[language === 'ar' ? 0 : 1] || status);
