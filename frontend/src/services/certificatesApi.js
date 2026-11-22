import { financialRequest, bindAccount, isGuid, FinancialError } from './financialApi.js';
export function certificateStatusLabel(status, language) {
  const values={issued:['صادرة','Issued'],revoked:['ملغاة','Revoked']};
  return (Object.hasOwn(values,status)?values[status]:['حالة غير معروفة','Unknown status'])[language==='ar'?0:1];
}
export const formatCertificateDate=(issuedAt,language)=>new Date(issuedAt).toLocaleDateString(language==='ar'?'ar':'en',{timeZone:'UTC'});
export function validateCertificate(data, accountId) {
  bindAccount(data, accountId);
  if (!isGuid(data.id) || !isGuid(data.enrollmentId) || typeof data.verificationCode !== 'string' || !data.verificationCode || data.verificationCode.length > 100
    || typeof data.status !== 'string' || typeof data.learnerNameSnapshot !== 'string'
    || typeof data.instructorNameSnapshot !== 'string' || !Number.isFinite(Date.parse(data.issuedAt))) throw new FinancialError('response');
  return data;
}
export async function loadCertificates(accountId, page = 1, signal, request = financialRequest) {
  const data = bindAccount(await request(`/me/certificates?page=${page}&pageSize=20`, { accountId, signal }), accountId);
  if (!Array.isArray(data.items) || !Number.isInteger(data.total)) throw new FinancialError('response');
  data.items.forEach(c => validateCertificate(c, accountId)); return data;
}
export async function loadCertificate(accountId, id, signal, request = financialRequest) {
  if (!isGuid(id)) throw new FinancialError('validation', 400);
  return validateCertificate(await request(`/me/certificates/${id}`, { accountId, signal }), accountId);
}
export async function loadCompletion(accountId, id, signal, request = financialRequest) {
  if (!isGuid(id)) throw new FinancialError('validation', 400);
  const data = bindAccount(await request(`/me/enrollments/${id}/completion`, { accountId, signal }), accountId);
  if (data.enrollmentId !== id) throw new FinancialError('response'); return data;
}
export async function reconcileCompletion(accountId, id, versionId, signal, request = financialRequest) {
  if (!isGuid(id) || !isGuid(versionId)) throw new FinancialError('validation', 400);
  return bindAccount(await request(`/me/enrollments/${id}/completion/reconcile`, {
    accountId, signal, method: 'POST', body: { expectedCourseVersionId: versionId }
  }), accountId);
}
export function certificatePdfData(c, language, logo) {
  validateCertificate(c, c.accountId);
  if (c.status !== 'issued') throw new FinancialError('certificate_revoked', 403);
  return { name: c.learnerNameSnapshot, instructor: c.instructorNameSnapshot,
    course: language === 'ar' ? c.courseTitleSnapshotAr || c.courseTitleSnapshotEn : c.courseTitleSnapshotEn || c.courseTitleSnapshotAr,
    language, logo, verificationId: c.verificationCode, issuedAt: formatCertificateDate(c.issuedAt,language) };
}
