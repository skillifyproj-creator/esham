import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { accountRequest } from '../src/services/accountApi.js';
import { createNotificationStore, emptyNotificationState, visibleNotificationState, loadNotifications,
  markNotificationRead, markAllNotificationsRead, notificationText } from '../src/services/notifications.js';
const a = 'account-a', b = 'account-b';
const id = '11111111-1111-4111-8111-111111111111';
const item = { id, notificationType: 'account.welcome', titleAr: 'مرحبًا', titleEn: 'Welcome', messageAr: 'رسالة',
  messageEn: 'A real message', createdAt: '2026-10-29T12:00:00Z', isRead: false, readAt: null };
const page = (accountId = a, items = [item], args = {}) => ({ accountId, items, page: 1, pageSize: 20, totalCount: items.length, ...args });
const count = (accountId = a, unreadCount = 1) => ({ accountId, unreadCount });

test('real list/count queries carry pagination and read filtering; count is global, not guessed from one page', async () => {
  const calls = [];
  const result = await loadNotifications(a, { page: 2, pageSize: 10, isRead: false }, async (path, body, options) => {
    calls.push(path); assert.equal(options.method, 'GET'); assert.equal(body, undefined);
    return path.endsWith('unread-count') ? count(a, 31) : page(a, [item], { page: 2, pageSize: 10, totalCount: 31 });
  });
  assert.ok(calls.includes('/me/notifications?page=2&pageSize=10&isRead=false')); assert.equal(result.unread, 31);
  assert.equal(result.notifications[0].id, id); assert.equal(result.totalCount, 31);
});

test('empty server data remains empty with no mock/localStorage fallback', async () => {
  const store = createNotificationStore(async path => path.endsWith('unread-count') ? count(a, 0) : page(a, []));
  store.setAccount(a); await store.refresh();
  assert.deepEqual(store.getSnapshot().notifications, []); assert.equal(store.getSnapshot().unread, 0);
});

test('mismatched account bindings, invalid IDs and malformed server lists are rejected', async () => {
  await assert.rejects(() => loadNotifications(a, {}, async path => path.endsWith('unread-count') ? count(b) : page(b)), error => error.status === 401);
  await assert.rejects(() => loadNotifications(a, {}, async path => path.endsWith('unread-count') ? count(a) : page(a, [{ ...item, id: 'demo-notification' }])));
  await assert.rejects(() => markNotificationRead(a, 'fake-id'));
  await assert.rejects(() => loadNotifications(a, {}, async path => path.endsWith('unread-count') ? count(a, -1) : page(a)));
});

test('mark read and read-all bind the expected account, use PATCH/cookies and reload canonical server data', async () => {
  let read = false; const calls = [];
  const request = async (path, body, options) => {
    calls.push([path, options.method]);
    if (options.method === 'PATCH') { assert.equal(options.headers['X-Esham-Account-Id'], a); assert.equal(body, undefined); read = true; return { accountId: a, updatedCount: 1 }; }
    return path.endsWith('unread-count') ? count(a, read ? 0 : 1) : page(a, [{ ...item, isRead: read, readAt: read ? '2026-10-29T13:00:00Z' : null }]);
  };
  const store = createNotificationStore(request); store.setAccount(a); await store.refresh();
  await store.markRead(id); assert.equal(store.getSnapshot().unread, 0); assert.equal(store.getSnapshot().notifications[0].isRead, true);
  await store.markAll(); assert.ok(calls.some(([path, method]) => path === '/me/notifications/read-all' && method === 'PATCH'));
  assert.equal(calls.filter(([path]) => path.includes('unread-count')).length, 3);
  await markNotificationRead(a, id, (path, body, options) => accountRequest(path, body, { ...options, base: 'https://api.example.test', fetcher: async (url, init) => {
    assert.equal(url, `https://api.example.test/me/notifications/${id}/read`); assert.equal(init.credentials, 'include'); assert.equal(init.method, 'PATCH');
    assert.equal(init.headers['X-Esham-Account-Id'], a); assert.equal(init.headers['X-Requested-With'], 'XMLHttpRequest');
    return { ok: true, status: 200, json: async () => ({ accountId: a, updatedCount: 0 }) };
  } }));
});

test('rejected writes never set optimistic read state or announce fake success', async () => {
  const store = createNotificationStore(async (path, _body, options) => {
    if (options.method === 'PATCH') throw Object.assign(new Error('Failed'), { status: 503 });
    return path.endsWith('unread-count') ? count(a) : page(a);
  });
  store.setAccount(a); await store.refresh(); await assert.rejects(() => store.markRead(id));
  assert.equal(store.getSnapshot().notifications[0].isRead, false); assert.equal(store.getSnapshot().unread, 1);
  assert.ok(store.getSnapshot().error); assert.equal(store.getSnapshot().mutating, false);
});

test('expired sessions clear private notification data and expose the authentication failure', async () => {
  let expired = false;
  const store = createNotificationStore(async path => {
    if (expired) throw Object.assign(new Error('Expired'), { status: 401 });
    return path.endsWith('unread-count') ? count(a) : page(a);
  });
  store.setAccount(a); await store.refresh(); expired = true;
  await assert.rejects(() => store.refresh()); assert.deepEqual(store.getSnapshot().notifications, []);
  assert.equal(store.getSnapshot().error.status, 401); store.setAccount(null); assert.equal(store.getSnapshot().unread, 0);
});

test('account switching hides old data before effects and rejects late account-A responses', async () => {
  let releaseList, releaseCount, serverAccount = a;
  const store = createNotificationStore(async path => {
    if (serverAccount === a) return new Promise(resolve => { if (path.endsWith('unread-count')) releaseCount = resolve; else releaseList = resolve; });
    return path.endsWith('unread-count') ? count(b, 0) : page(b, []);
  });
  store.setAccount(a); const pending = store.refresh().catch(error => error);
  assert.deepEqual(visibleNotificationState({ ...emptyNotificationState(a), notifications: [item], unread: 1 }, b).notifications, []);
  store.setAccount(b); serverAccount = b; await store.refresh();
  releaseList(page(a)); releaseCount(count(a)); assert.equal((await pending).status, 401);
  assert.equal(store.getSnapshot().accountId, b); assert.deepEqual(store.getSnapshot().notifications, []); assert.equal(store.getSnapshot().unread, 0);
});

test('late mark-all responses cannot mutate or reload another account inbox', async () => {
  let release; let serverAccount = a;
  const store = createNotificationStore(async (path, _body, options) => {
    if (options.method === 'PATCH') return new Promise(resolve => { release = resolve; });
    return path.endsWith('unread-count') ? count(serverAccount, serverAccount === a ? 1 : 0) : page(serverAccount, serverAccount === a ? [item] : []);
  });
  store.setAccount(a); await store.refresh(); const pending = store.markAll().catch(error => error);
  store.setAccount(b); serverAccount = b; await store.refresh(); release({ accountId: a, updatedCount: 1 });
  assert.equal((await pending).status, 401); assert.deepEqual(store.getSnapshot().notifications, []); assert.equal(store.getSnapshot().accountId, b);
});

test('server rejection of a switched-account mutation remains a failure', async () => {
  await assert.rejects(() => markAllNotificationsRead(a, async (_path, _body, options) => {
    assert.equal(options.headers['X-Esham-Account-Id'], a); throw Object.assign(new Error('Account changed'), { status: 409 });
  }), error => error.status === 409);
});

test('a read that empties the final filtered page reloads a real previous page', async () => {
  const store = createNotificationStore(async path => {
    if (path.endsWith('unread-count')) return count(a, 1);
    const query = new URL(path, 'https://api.example.test').searchParams;
    return query.get('page') === '2' ? page(a, [], { page: 2, pageSize: 1, totalCount: 1 }) : page(a, [item], { pageSize: 1 });
  });
  store.setAccount(a); await store.refresh({ page: 2, pageSize: 1, isRead: false });
  assert.equal(store.getSnapshot().page, 1); assert.equal(store.getSnapshot().notifications[0].id, id);
});

test('message localization falls back safely without inventing course links', () => {
  assert.equal(notificationText({ titleEn: 'English', messageEn: 'Message' }, 'ar').title, 'English');
  assert.equal(notificationText({ titleAr: 'عنوان', messageAr: 'نص' }, 'en').body, 'نص');
});

const vite = await createServer({ cacheDir: 'node_modules/.vite-notification-tests', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
let pageModule, context, preferences, bell;
try {
  [pageModule, context, preferences, bell] = await Promise.all(['/src/pages/shared/NotificationsPage.jsx', '/src/context/NotificationsContext.jsx', '/src/context/PreferencesContext.jsx', '/src/components/shared/NotificationBell.jsx'].map(path => vite.ssrLoadModule(path)));
} finally { await vite.close(); }
const storage = new Map(); globalThis.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }; globalThis.window = { localStorage };
function render(component, inbox = {}, language = 'en') {
  storage.set('esham-language', language);
  const value = { ...emptyNotificationState(a), accountId: a, status: 'authenticated', loading: false, refresh: async () => {}, markRead: async () => {}, markAll: async () => {}, ...inbox };
  return renderToString(h(MemoryRouter, null, h(preferences.PreferencesProvider, null, h(context.NotificationsContext.Provider, { value }, component))));
}

test('bell badge uses the real unread count and shows loading/error states instead of mock counts', () => {
  const badge = render(h(bell.default, { role: 'learner' }), { unread: 104 });
  assert.match(badge, /99\+/); assert.match(badge, /104 unread/);
  assert.ok(!render(h(bell.default, { role: 'instructor' }), { unread: 4, loading: true }).includes('notification-bell-count'));
  assert.match(render(h(bell.default, { role: 'learner' }), { error: { status: 503 } }), /notification-bell-count/);
});

test('real messages retain card styling, escape content, and unknown types have no invented navigation', () => {
  for (const language of ['ar', 'en']) {
    const html = render(h(pageModule.NotificationGroups, { items: [{ ...item, notificationType: 'unknown.type', messageEn: '<script>bad()</script>' }], busy: false, onRead: () => {} }), {}, language);
    assert.match(html, /ln-card unread/); assert.match(html, /ln-read-button/); assert.ok(!html.includes('href=')); assert.ok(!html.includes('<script>'));
  }
});

test('empty, loading, failure and expired session pages do not show fake notification rows', () => {
  const empty = render(h(pageModule.default)); assert.match(empty, /No notifications yet/); assert.ok(!empty.includes('ln-card unread'));
  const loading = render(h(pageModule.default), { loading: true }); assert.match(loading, /Loading notifications/); assert.ok(!loading.includes('No notifications yet'));
  const failed = render(h(pageModule.default), { error: { status: 503 } }); assert.match(failed, /Retry/); assert.ok(!failed.includes('No notifications yet'));
  const expired = render(h(pageModule.default), { status: 'anonymous', error: { status: 401 } }); assert.match(expired, /Sign in/); assert.ok(!expired.includes('ln-card unread'));
});
