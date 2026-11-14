import { apiBase } from './accountApi.js';
import { financialRequest, bindAccount, isGuid, FinancialError } from './financialApi.js';
const root = enrollmentId => {
  if (!isGuid(enrollmentId)) throw new FinancialError('validation', 400);
  return `/me/enrollments/${enrollmentId}`;
};
export function validateLearning(data, accountId, enrollmentId) {
  bindAccount(data, accountId);
  if (data.enrollmentId !== enrollmentId || !isGuid(data.availableCourseVersionId) || !Array.isArray(data.sections)
    || !data.versionState || data.versionState.availableCourseVersionId !== data.availableCourseVersionId
    || !data.sections.every(s => isGuid(s.id) && Array.isArray(s.lessons) && s.lessons.every(l => isGuid(l.id)))) throw new FinancialError('response');
  return data;
}
export async function loadLearning(accountId, enrollmentId, signal, request = financialRequest) {
  return validateLearning(await request(root(enrollmentId) + '/learning', { accountId, signal }), accountId, enrollmentId);
}
export async function loadLesson(accountId, enrollmentId, lessonId, versionId, signal, request = financialRequest) {
  if (!isGuid(lessonId)) throw new FinancialError('validation', 400);
  const data = bindAccount(await request(root(enrollmentId) + `/learning/lessons/${lessonId}`, { accountId, signal }), accountId);
  if (data.enrollmentId !== enrollmentId || data.lessonId !== lessonId || data.courseVersionId !== versionId || !data.progress?.progressToken)
    throw new FinancialError('publication_changed', 409);
  return data;
}
export function protectedMediaUrl(path, enrollmentId, lessonId, base = apiBase) {
  const prefix = root(enrollmentId) + `/learning/lessons/${lessonId}/`;
  if (!isGuid(lessonId) || typeof path !== 'string' || !path.startsWith(prefix)
    || !(path === prefix + 'video' || /^attachments\/[0-9a-f-]{36}\/content$/i.test(path.slice(prefix.length)))) throw new FinancialError('response');
  return base + path;
}
export function learningMessage(error, language) {
  const messages = {
    progress_disabled: ['حفظ التقدم غير مفعّل في هذه البيئة.', 'Saving progress is disabled in this environment.'],
    progress_conflict: ['تغيّر التقدم في جلسة أخرى. حدّث الدرس قبل الحفظ.', 'Progress changed in another session. Reload the lesson before saving.'],
    publication_changed: ['تم تحديث الدورة. حدّث المحتوى للمتابعة.', 'The course was updated. Refresh learning to continue.'],
    unauthorized: ['انتهت الجلسة. سجّل الدخول مجددًا.', 'Your session expired. Sign in again.'],
    invalid_position: ['تعذّر حفظ موضع الفيديو.', 'The video position could not be saved.'],
    media_missing: ['ملف الدرس غير متاح حاليًا.', 'The lesson file is currently unavailable.'],
  };
  return (messages[error?.code] || ['تعذّر تحميل أو حفظ محتوى التعلم. أعد المحاولة.', 'Unable to load or save learning content. Please retry.'])[language === 'ar' ? 0 : 1];
}
