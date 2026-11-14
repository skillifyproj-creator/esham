import { apiBase } from './accountApi.js';

export class FinancialError extends Error {
  constructor(code, status = 0) { super(code); this.code = code; this.status = status; }
}
export const isGuid = x => typeof x === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(x);
export async function financialRequest(path, { method = 'GET', body, accountId, signal, base = apiBase, fetcher = fetch } = {}) {
  if (!base) throw new FinancialError('unconfigured');
  try {
    const response = await fetcher(base + path, { method, credentials: 'include',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? { 'X-Esham-Account-Id': accountId } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new FinancialError(response.status === 401 ? 'unauthorized' : data?.code || 'request', response.status);
    if (!data || typeof data !== 'object') throw new FinancialError('response');
    return data;
  } catch (error) {
    if (error instanceof FinancialError) throw error;
    throw new FinancialError('network');
  }
}
export function bindAccount(data, accountId) {
  if (!accountId || data?.accountId !== accountId) throw new FinancialError('account_changed', 409);
  return data;
}
export function validatePage(data) {
  if (!Array.isArray(data.items) || !Number.isInteger(data.totalCount) || data.totalCount < 0 || !Number.isInteger(data.page) || data.page < 1
    || !Number.isInteger(data.pageSize) || data.pageSize < 1 || data.pageSize > 100 || data.items.length > data.pageSize) throw new FinancialError('response');
  return data;
}
export function financialMessage(error, language) {
  const messages = {
    purchase_disabled: ['التسجيل غير متاح في هذه البيئة حاليًا.', 'Enrollment purchases are currently unavailable in this environment.'],
    insufficient_balance: ['تحتاج إلى 20 نقطة للتسجيل.', 'You need 20 points to enroll.'],
    already_enrolled: ['أنت مسجل في هذه الدورة بالفعل. حدّث قائمة دوراتك.', 'You are already enrolled. Refresh My Courses.'],
    publication_changed: ['تم تحديث الدورة. حدّث الصفحة وراجعها قبل تأكيد التسجيل.', 'The course was updated. Refresh and review it before confirming enrollment.'],
    course_unavailable: ['الدورة غير متاحة للتسجيل حاليًا.', 'This course is not currently available for enrollment.'],
    self_enrollment: ['لا يمكنك التسجيل في دورتك.', 'You cannot enroll in your own course.'],
    wallet_unavailable: ['المحفظة غير جاهزة. تواصل مع إدارة المنصة.', 'The wallet is not ready. Contact platform support.'],
    account_changed: ['تغيّر الحساب. حدّث الصفحة قبل المتابعة.', 'The account changed. Refresh before continuing.'],
    unauthorized: ['انتهت الجلسة. سجّل الدخول مجددًا.', 'Your session expired. Sign in again.'],
    onboarding_required: ['أكمل إعداد حسابك أولًا.', 'Complete account setup first.'],
    network: ['تعذّر تأكيد النتيجة. أعد المحاولة بنفس طلب التسجيل؛ لن يُخصم المبلغ مرتين.', 'The outcome could not be confirmed. Retry the same enrollment request; it will not charge twice.'],
  };
  return (messages[error?.code] || ['تعذّر تحميل أو حفظ البيانات. أعد المحاولة.', 'Unable to load or save data. Please retry.'])[language === 'ar' ? 0 : 1];
}
