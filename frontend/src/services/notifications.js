import { accountRequest, AccountApiError } from './accountApi.js';

const validId = value => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);
export const emptyNotificationState = accountId => ({ accountId, notifications: [], unread: 0, totalCount: 0,
  page: 1, pageSize: 20, isRead: null, loading: Boolean(accountId), mutating: false, error: null });
export const visibleNotificationState = (snapshot, accountId) => accountId && snapshot.accountId === accountId ? snapshot : emptyNotificationState(accountId);
function accountResponse(response, accountId) {
  if (!accountId || response?.accountId !== accountId) throw new AccountApiError('session-changed', 401);
}
function validateItem(item) {
  if (!validId(item?.id) || typeof item.notificationType !== 'string' || typeof item.isRead !== 'boolean'
    || !Number.isFinite(Date.parse(item.createdAt)) || (item.readAt !== null && !Number.isFinite(Date.parse(item.readAt)))) throw new AccountApiError('response');
  for (const key of ['titleAr', 'titleEn', 'messageAr', 'messageEn'])
    if (item[key] != null && typeof item[key] !== 'string') throw new AccountApiError('response');
}
export async function loadNotifications(accountId, { page = 1, pageSize = 20, isRead = null } = {}, request = accountRequest) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (isRead !== null) query.set('isRead', String(isRead));
  const [result, count] = await Promise.all([
    request(`/me/notifications?${query}`, undefined, { method: 'GET' }),
    request('/me/notifications/unread-count', undefined, { method: 'GET' }),
  ]);
  accountResponse(result, accountId); accountResponse(count, accountId);
  if (!Array.isArray(result.items) || result.page !== page || result.pageSize !== pageSize
    || !Number.isInteger(result.totalCount) || result.totalCount < 0 || !Number.isInteger(count.unreadCount) || count.unreadCount < 0)
    throw new AccountApiError('response');
  result.items.forEach(validateItem);
  if (new Set(result.items.map(item => item.id)).size !== result.items.length) throw new AccountApiError('response');
  return { notifications: result.items, unread: count.unreadCount, totalCount: result.totalCount, page, pageSize, isRead };
}
export async function markNotificationRead(accountId, id, request = accountRequest) {
  if (!validId(id)) throw new AccountApiError('request', 400);
  return mark(accountId, `/${id}/read`, request);
}
export async function markAllNotificationsRead(accountId, request = accountRequest) { return mark(accountId, '/read-all', request); }
async function mark(accountId, path, request) {
  if (!accountId) throw new AccountApiError('unauthorized', 401);
  const response = await request(`/me/notifications${path}`, undefined, { method: 'PATCH', headers: { 'X-Esham-Account-Id': accountId } });
  accountResponse(response, accountId);
  if (!Number.isInteger(response.updatedCount) || response.updatedCount < 0) throw new AccountApiError('response');
  return response;
}

// One in-memory inbox, explicitly bound to a verified session identity. No storage
// or demo fallback. Generation guards also reject late replies from account A.
export function createNotificationStore(request = accountRequest) {
  let state = emptyNotificationState(null), generation = 0, requestNumber = 0;
  const listeners = new Set();
  const publish = next => { state = next; listeners.forEach(listener => listener()); };
  const current = (id, version) => state.accountId === id && generation === version;
  async function refresh(query = {}) {
    const id = state.accountId, version = generation, call = ++requestNumber;
    if (!id) throw new AccountApiError('unauthorized', 401);
    const selected = { page: query.page ?? state.page, pageSize: query.pageSize ?? state.pageSize,
      isRead: Object.hasOwn(query, 'isRead') ? query.isRead : state.isRead };
    publish({ ...state, ...selected, loading: true, error: null });
    try {
      const result = await loadNotifications(id, selected, request);
      if (!current(id, version) || call !== requestNumber) throw new AccountApiError('session-changed', 401);
      // A read can empty the final filtered page; reload a real previous page.
      if (!result.notifications.length && selected.page > 1 && result.totalCount <= (selected.page - 1) * selected.pageSize)
        return refresh({ ...selected, page: Math.max(1, Math.ceil(result.totalCount / selected.pageSize)) });
      publish({ ...state, ...result, loading: false, error: null });
      return result;
    } catch (error) {
      if (current(id, version) && call === requestNumber) publish({ ...state, notifications: [], unread: 0, totalCount: 0, loading: false, error });
      throw error;
    }
  }
  async function mutate(id) {
    const accountId = state.accountId, version = generation;
    if (!accountId) throw new AccountApiError('unauthorized', 401);
    if (state.mutating) throw new AccountApiError('request', 409);
    publish({ ...state, mutating: true, error: null });
    try {
      if (id) await markNotificationRead(accountId, id, request); else await markAllNotificationsRead(accountId, request);
      if (!current(accountId, version)) throw new AccountApiError('session-changed', 401);
      await refresh(); // No optimistic success or guessed badge counts.
    } catch (error) {
      if (current(accountId, version)) publish({ ...state, error });
      throw error;
    } finally { if (current(accountId, version)) publish({ ...state, mutating: false }); }
  }
  return {
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => state,
    setAccount(accountId) {
      if (state.accountId === accountId) return;
      generation++; requestNumber++; publish(emptyNotificationState(accountId));
    },
    refresh, markRead: id => mutate(id), markAll: () => mutate(null),
  };
}

export function notificationMessage(error, language) {
  if (error?.status === 401) return language === 'ar' ? 'انتهت الجلسة أو تغيّر الحساب. سجّل الدخول وحدّث الإشعارات.' : 'Your session expired or the account changed. Sign in and refresh notifications.';
  if (error?.status === 404) return language === 'ar' ? 'الإشعار غير متاح. حدّث القائمة.' : 'This notification is unavailable. Refresh the list.';
  if (error?.status === 409) return language === 'ar' ? 'تغيّرت الجلسة أو البيانات. حدّث القائمة قبل المحاولة.' : 'The session or data changed. Refresh before retrying.';
  if (error?.code === 'unconfigured') return language === 'ar' ? 'خدمة الإشعارات غير مهيأة.' : 'The notifications API is not configured.';
  return language === 'ar' ? 'تعذّر تحميل الإشعارات أو حفظ القراءة. أعد المحاولة.' : 'Notifications could not be loaded or marked read. Please retry.';
}
export function notificationText(item, language) {
  return { title: (language === 'ar' ? item.titleAr || item.titleEn : item.titleEn || item.titleAr) || (language === 'ar' ? 'إشعار' : 'Notification'),
    body: (language === 'ar' ? item.messageAr || item.messageEn : item.messageEn || item.messageAr) || '' };
}
