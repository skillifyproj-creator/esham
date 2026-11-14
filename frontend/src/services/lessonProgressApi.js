import { financialRequest, bindAccount, isGuid, FinancialError } from './financialApi.js';
export async function saveLessonProgress(accountId, enrollmentId, lessonId, versionId, progressToken, kind, position = 0, signal, request = financialRequest) {
  if (![enrollmentId, lessonId, versionId].every(isGuid) || !['open', 'progress', 'completion'].includes(kind)
    || !Number.isFinite(position) || position < 0) throw new FinancialError('validation', 400);
  const result = bindAccount(await request(`/me/enrollments/${enrollmentId}/learning/lessons/${lessonId}/${kind}`, {
    method: kind === 'open' ? 'POST' : 'PUT', accountId, signal,
    body: kind === 'completion' ? { expectedCourseVersionId: versionId }
      : { expectedCourseVersionId: versionId, expectedProgressToken: progressToken, lastPositionSeconds: position },
  }), accountId);
  if (result.enrollmentId !== enrollmentId || result.lessonId !== lessonId || result.courseVersionId !== versionId || !result.progressToken)
    throw new FinancialError('response');
  return result;
}
