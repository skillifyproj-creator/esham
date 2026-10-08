// Cookie sessions keep credentials out of browser storage. Endpoint contract: docs/backend-contract.md.
export const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export class AccountApiError extends Error {
  constructor(code, status = 0) { super(code); this.code = code; this.status = status; }
}
export async function accountRequest(path, body, { method = 'POST', base = apiBase, fetcher = fetch, timeout = 15000 } = {}) {
  if (!base) throw new AccountApiError('unconfigured');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher(`${base}${path}`, { method, credentials: 'include', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new AccountApiError(response.status === 401 ? 'unauthorized' : response.status === 429 ? 'rate-limit' : 'request', response.status);
    if (response.status === 204) return null;
    try { return await response.json(); } catch { throw new AccountApiError('response'); }
  } catch (error) {
    if (error instanceof AccountApiError) throw error;
    throw new AccountApiError(error.name === 'AbortError' ? 'timeout' : 'network');
  } finally { clearTimeout(timer); }
}
export function accountError(error, language) {
  const messages = {
    unconfigured: ['خدمة الحسابات غير متصلة حاليًا. يمكنك استخدام المعاينة التجريبية.', 'The account service is not connected yet. You can use the demo preview.'],
    unauthorized: ['تعذّر التحقق من الحساب أو انتهت الجلسة. راجع بياناتك وسجّل الدخول.', 'Account verification failed or your session expired. Check your details and sign in.'],
    'rate-limit': ['طلبات كثيرة. انتظر قليلًا ثم حاول مجددًا.', 'Too many requests. Please wait and try again.'],
    timeout: ['انتهت مهلة الاتصال. حاول مجددًا.', 'The request timed out. Try again.'],
    network: ['تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مجددًا.', 'Unable to reach the server. Check your connection and retry.'],
    response: ['استجابة الخادم غير مكتملة. حاول مجددًا.', 'The server returned an incomplete response. Try again.'],
    request: ['تعذّر تنفيذ الطلب. راجع البيانات وحاول مجددًا.', 'Unable to complete the request. Check your details and retry.'],
    token: ['رابط الاستعادة غير صالح. اطلب رابطًا جديدًا.', 'This recovery link is invalid. Request a new link.'],
  };
  return (messages[error?.code] || messages.request)[language === 'ar' ? 0 : 1];
}
export function acceptAccountSession(result) {
  const profile = result?.profile;
  if (!profile?.id || !['learner','instructor','both'].includes(profile.role)) throw new AccountApiError('response');
  localStorage.setItem('esham-account-profile-v1', JSON.stringify(profile));
  window.dispatchEvent(new Event('esham-profile-updated'));
  return profile;
}
