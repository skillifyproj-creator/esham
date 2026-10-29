import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { accountRequest } from '../src/services/accountApi.js';
import { listAdminUsers, getAdminUser, updateAdminRoles, updateAdminLockout, canManageUsers, accountDestination, adminUserMessage } from '../src/services/adminUsers.js';

const id = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const user = { id, name: 'Real User', username: 'real_user', email: 'real@example.test', roles: ['Learner'], emailConfirmed: true,
  lockoutEnabled: true, lockoutEnd: null, isLockedOut: false, version: 'A'.repeat(64) };

test('admin list sends pagination, exact filters and safely encoded literal search to the real route', async () => {
  const result = await listAdminUsers({ page: 2, pageSize: 10, search: 'a+b & user', role: 'Learner', status: 'unlocked' }, async (path, body, options) => {
    const url = new URL(path, 'https://api.example.test');
    assert.equal(url.pathname, '/api/admin/users'); assert.equal(url.searchParams.get('search'), 'a+b & user');
    assert.equal(url.searchParams.get('role'), 'Learner'); assert.equal(url.searchParams.get('status'), 'unlocked');
    assert.equal(url.searchParams.get('page'), '2'); assert.equal(options.method, 'GET'); assert.equal(body, undefined);
    return { items: [user], totalCount: 12, page: 2, pageSize: 10 };
  });
  assert.equal(result.items[0].id, id);
  const empty = await listAdminUsers({}, async () => ({ items: [], totalCount: 0, page: 1, pageSize: 20 }));
  assert.deepEqual(empty.items, []);
});

test('details use stable GUID IDs and reject demo IDs or malformed server contracts', async () => {
  assert.equal((await getAdminUser(id, async (path, body, options) => { assert.equal(path, `/api/admin/users/${id}`); assert.equal(options.method, 'GET'); return user; })).name, 'Real User');
  await assert.rejects(() => getAdminUser('u1'));
  await assert.rejects(() => getAdminUser(id, async () => ({ id, roles: ['Learner'] })));
});

test('role writes include the optimistic version and never claim success for a rejection', async () => {
  const changed = { ...user, roles: ['Learner', 'Instructor'], version: 'B'.repeat(64) };
  const result = await updateAdminRoles(user, changed.roles, async (path, body, options) => {
    assert.equal(path, `/api/admin/users/${id}/roles`); assert.equal(options.method, 'PUT');
    assert.deepEqual(body, { roles: ['Learner', 'Instructor'], version: user.version }); return changed;
  });
  assert.deepEqual(result.roles, ['Learner', 'Instructor']); assert.deepEqual(user.roles, ['Learner']);
  await assert.rejects(() => updateAdminRoles(user, ['Combined']));
  await assert.rejects(() => updateAdminRoles(user, ['Learner', 'Learner']));
  await assert.rejects(() => updateAdminRoles(user, ['Learner', 'CategoryAdmin']));
  for (const status of [401, 403, 409, 500]) await assert.rejects(() => updateAdminRoles(user, ['Instructor'], async () => { throw Object.assign(new Error('Rejected'), { status }); }), /Rejected/);
  assert.deepEqual(user.roles, ['Learner']);
});

test('timed lockout and unlock send only existing supported Identity fields', async () => {
  const until = new Date(Date.now() + 3600000).toISOString();
  let saved = null;
  const request = async (path, body, options) => { assert.equal(path, `/api/admin/users/${id}/lockout`); assert.equal(options.method, 'PUT'); saved = body; return { ...user, isLockedOut: Boolean(body.lockoutEnd), lockoutEnd: body.lockoutEnd }; };
  assert.equal((await updateAdminLockout(user, until, request)).isLockedOut, true);
  assert.deepEqual(saved, { lockoutEnd: until, version: user.version });
  assert.equal((await updateAdminLockout(user, null, request)).isLockedOut, false);
  assert.deepEqual(saved, { lockoutEnd: null, version: user.version });
  await assert.rejects(() => updateAdminLockout(user, '2020-01-01'));
  await assert.rejects(() => updateAdminLockout({ ...user, lockoutEnabled: false }, until));
});

test('credentials, application header and content type are preserved for admin mutation requests', async () => {
  await updateAdminRoles(user, ['Instructor'], (path, body, options) => accountRequest(path, body, { ...options, base: 'https://api.example.test', fetcher: async (url, init) => {
    assert.equal(url, `https://api.example.test/api/admin/users/${id}/roles`); assert.equal(init.credentials, 'include');
    assert.equal(init.headers['X-Requested-With'], 'XMLHttpRequest'); assert.equal(init.headers['Content-Type'], 'application/json');
    assert.equal(JSON.parse(init.body).version, user.version); return { ok: true, status: 200, json: async () => ({ ...user, roles: ['Instructor'] }) };
  } }));
});

test('server admin memberships determine routing and visibility; client persona flags never grant access', () => {
  for (const profile of [{ role: 'super_admin' }, { role: 'GeneralAdmin' }, { isAdmin: true }, { roles: ['CategoryAdmin'] }]) assert.equal(canManageUsers({ profile }), false);
  assert.equal(canManageUsers({ profile: { roles: ['GeneralAdmin'] } }), true);
  assert.equal(accountDestination({ profile: { roles: ['GeneralAdmin'], role: null }, onboardingRequired: true }), '/admin');
  assert.equal(accountDestination({ profile: { roles: ['CategoryAdmin'] } }), '/category-admin');
  assert.equal(accountDestination({ profile: { role: 'both' }, onboardingRequired: true }), '/onboarding/role');
});

test('401, 403, conflicts, unavailable API and missing users have actionable bilingual messages', () => {
  for (const language of ['ar', 'en']) for (const status of [401, 403, 404, 409, 400, 503]) assert.ok(adminUserMessage({ status }, language).length > 10);
  assert.match(adminUserMessage({ status: 403 }, 'en'), /GeneralAdmin/);
  assert.match(adminUserMessage({ status: 409 }, 'en'), /Reload/);
});

const vite = await createServer({ cacheDir: 'node_modules/.vite-admin-tests', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
let pages, preferences, sessionContext;
try {
  [pages, preferences, sessionContext] = await Promise.all(['/src/pages/admin/AdminUsersPage.jsx', '/src/context/PreferencesContext.jsx', '/src/context/AccountSessionContext.jsx'].map(path => vite.ssrLoadModule(path)));
} finally { await vite.close(); }
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
globalThis.window = { localStorage };
function render(component, session = {}) {
  return renderToString(h(MemoryRouter, null, h(preferences.PreferencesProvider, null,
    h(sessionContext.AccountSessionContext.Provider, { value: { refresh: async () => {}, ...session } }, component))));
}

test('loading, anonymous, forbidden and API error states do not render private rows or action forms', () => {
  values.set('esham-language', 'en');
  const protectedChild = h('span', null, 'PRIVATE USER CONTENT');
  for (const state of [
    { status: 'loading' }, { status: 'anonymous' }, { status: 'error', error: { status: 503 } },
    { status: 'authenticated', session: { profile: { roles: ['Learner'] } } },
  ]) {
    const html = render(h(pages.AdminAccess, null, protectedChild), state);
    assert.ok(!html.includes('PRIVATE USER CONTENT'));
    assert.match(html, /status|alert/);
  }
  assert.match(render(h(pages.AdminAccess, null, protectedChild), { status: 'authenticated', session: { profile: { roles: ['GeneralAdmin'] } } }), /PRIVATE USER CONTENT/);
});

test('real directory rows and details render in the existing table/form styles with unsupported actions disabled', () => {
  for (const language of ['ar', 'en']) {
    values.set('esham-language', language);
    const html = render(h('table', null, h('tbody', null, h(pages.AdminUserRows, { users: [user], onDetails: () => {} }))));
    assert.match(html, /Real User/); assert.match(html, /real@example.test/); assert.match(html, /Learner/); assert.match(html, /sa-text-button/);
    const detail = render(h(pages.UserDetails, { user, actorId, onReload: () => {}, onChanged: () => {} }));
    assert.match(detail, /sa-form/); assert.match(detail, /disabled/); assert.match(detail, /datetime-local/);
    assert.ok(!detail.includes('PasswordHash')); assert.ok(!detail.includes('SecurityStamp'));
    const self = render(h(pages.UserDetails, { user, actorId: id, onReload: () => {}, onChanged: () => {} }));
    assert.match(self, /fieldset disabled/);
  }
});

test('old local user-list mutations and fake activation/admin creation are removed from routed screens', async () => {
  const source = await readFile(new URL('../src/pages/admin/SuperAdminModule.jsx', import.meta.url), 'utf8');
  assert.ok(!source.includes('esham-admin-users-v1')); assert.ok(!source.includes('d.setUsers('));
  assert.match(source, /function AdminsPage\(\)\{return <AdminUsersPage administratorsOnly/);
  assert.match(source, /function UsersPage\(\)\{return <AdminUsersPage/);
});
