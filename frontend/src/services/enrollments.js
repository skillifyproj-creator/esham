import { bindAccount, financialRequest, isGuid, validatePage, FinancialError } from './financialApi.js';
export function validateEnrollment(x) {
  if (!x || !isGuid(x.id) || !isGuid(x.courseId) || !isGuid(x.courseVersionId) || (x.availableCourseVersionId != null && !isGuid(x.availableCourseVersionId))
    || typeof x.status !== 'string' || !Number.isFinite(Date.parse(x.enrolledAt)) || typeof x.isAvailable !== 'boolean') throw new FinancialError('response');
  return x;
}
export async function loadEnrollments(accountId, page = 1, request = financialRequest) {
  const data = validatePage(bindAccount(await request(`/me/enrollments?page=${page}&pageSize=20`), accountId));
  data.items.forEach(validateEnrollment); return data;
}
export async function loadEnrollment(accountId, id, request = financialRequest) {
  if (!isGuid(id)) throw new FinancialError('validation', 400);
  const data = bindAccount(await request(`/me/enrollments/${id}`), accountId);
  validateEnrollment(data.enrollment); if (data.enrollment.id.toLowerCase() !== id.toLowerCase()) throw new FinancialError('response');
  return data;
}
export async function loadPurchaseAvailability(accountId, request = financialRequest) {
  const data = bindAccount(await request('/me/enrollments/purchase-availability'), accountId);
  if (typeof data.enabled !== 'boolean' || data.cost !== 20) throw new FinancialError('response'); return data;
}
export async function purchaseEnrollment(accountId, body, request = financialRequest) {
  if (![body.courseId, body.requestId, body.expectedPublishedVersionId].every(isGuid)) throw new FinancialError('validation', 400);
  const data = bindAccount(await request('/me/enrollments', { method: 'POST', body, accountId }), accountId);
  validateEnrollment(data.enrollment);
  if (data.requestId !== body.requestId || data.enrollment.courseId !== body.courseId || data.enrollment.courseVersionId !== body.expectedPublishedVersionId
    || data.charge !== 20 || typeof data.replayed !== 'boolean') throw new FinancialError('response');
  return data;
}
// Unsaved intent only: never a source of balance, enrollment or payment success.
export function enrollmentIntent(storage, accountId, courseId, versionId, uuid = () => crypto.randomUUID()) {
  const key = `esham-purchase-intent-v1:${accountId}:${courseId}`;
  let prior; try { prior = JSON.parse(storage.getItem(key)); } catch { /* Ignore corrupt UI cache. */ }
  if (prior?.courseId === courseId && prior?.expectedPublishedVersionId === versionId && isGuid(prior.requestId)) return prior;
  const next = { courseId, expectedPublishedVersionId: versionId, requestId: uuid() };
  storage.setItem(key, JSON.stringify(next)); return next;
}
export function clearEnrollmentIntent(storage, accountId, courseId) { storage.removeItem(`esham-purchase-intent-v1:${accountId}:${courseId}`); }
