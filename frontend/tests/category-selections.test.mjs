import test from 'node:test';
import assert from 'node:assert/strict';
import { accountRequest } from '../src/services/accountApi.js';
import { reconcileCategoryProfile, loadCategoryCatalog, loadServerSession, profileRequest,
  replaceCategories, validateCategoryDraft, categoryLabel } from '../src/services/categorySelections.js';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const catalog = [
  { id: b, nameAr: 'تصميم', nameEn: 'Design', isActive: true, displayOrder: 0 },
  { id: a, nameAr: 'برمجة', nameEn: 'Programming', isActive: true, displayOrder: 99 },
];

test('legacy indexes require explicit reselection and retain unrelated profile fields', () => {
  const old = { id: 'account', name: 'Name', bio: 'Bio', avatar: 'photo', nameEn: 'English', goal: 2,
    customSkills: ['Skill'], interests: [0], teachingAreas: [1] };
  const result = reconcileCategoryProfile(old);
  assert.equal(result.categoryReselectionRequired, true);
  assert.deepEqual(result.learningCategoryIds, []);
  assert.deepEqual(result.teachingCategoryIds, []);
  for (const field of ['id', 'name', 'bio', 'avatar', 'nameEn', 'goal', 'customSkills']) assert.deepEqual(result[field], old[field]);
  assert.deepEqual(old.interests, [0]); // No mutation or silent mapping.
});

test('catalog IDs and labels survive reordering and duplicate names without positional mapping', async () => {
  const loaded = await loadCategoryCatalog(async path => { assert.equal(path, '/api/categories'); return catalog; });
  assert.equal(categoryLabel(loaded, a, 'en'), 'Programming');
  assert.equal(categoryLabel([...loaded].reverse(), a, 'ar'), 'برمجة');
  const selected = reconcileCategoryProfile({ learningCategoryIds: [a], interests: [1] });
  assert.deepEqual(selected.learningCategoryIds, [a]);
  assert.equal(selected.categoryReselectionRequired, false);
});

test('catalog failures, inactive entries, duplicate IDs and malformed IDs fail closed', async () => {
  for (const data of [null, [{ ...catalog[0], id: 'programming' }], [{ ...catalog[0], isActive: false }], [catalog[0], catalog[0]]])
    await assert.rejects(() => loadCategoryCatalog(async () => data));
  await assert.rejects(() => loadCategoryCatalog(async () => { throw new Error('offline'); }), /offline/);
});

test('server session and category API replace stale cache claims on login and refresh', async () => {
  const calls = [];
  const request = async (path, body, options) => {
    calls.push([path, options.method]);
    return path === '/auth/session'
      ? { onboardingRequired: false, profile: { id: 'account', role: 'both', roles: ['Learner', 'Instructor'], isInstructor: false,
        learningCategoryIds: [b], teachingCategoryIds: [], name: 'Name' } }
      : { learningCategoryIds: [a], teachingCategoryIds: [b] };
  };
  for (let refresh = 0; refresh < 2; refresh++) {
    const session = await loadServerSession(request);
    assert.deepEqual(session.profile.learningCategoryIds, [a]);
    assert.deepEqual(session.profile.teachingCategoryIds, [b]);
    assert.equal(session.profile.isInstructor, undefined);
    assert.deepEqual(session.profile.roles, ['Learner', 'Instructor']);
  }
  assert.deepEqual(calls, [['/auth/session', 'GET'], ['/me/categories', 'GET'], ['/auth/session', 'GET'], ['/me/categories', 'GET']]);
});

test('expired sessions do not fall back to cached category authority', async () => {
  let calls = 0;
  await assert.rejects(() => loadServerSession(async () => { calls++; throw Object.assign(new Error('expired'), { status: 401 }); }), /expired/);
  assert.equal(calls, 1);
});

test('completed legacy accounts retain category reselection advice without overriding server completion', async () => {
  for (const role of ['learner', 'instructor', 'both']) {
    const session = await loadServerSession(async path => path === '/auth/session'
      ? { onboardingRequired: false, profile: { id: 'legacy', role, interests: [3], teachingAreas: [1], bio: 'Preserved', roles: role === 'both' ? ['Learner', 'Instructor'] : [role === 'learner' ? 'Learner' : 'Instructor'] } }
      : { learningCategoryIds: [], teachingCategoryIds: [] });
    assert.equal(session.onboardingRequired, false);
    assert.equal(session.profile.categoryReselectionRequired, true);
    assert.equal(session.profile.bio, 'Preserved');
    assert.deepEqual(session.profile.learningCategoryIds, []);
    assert.deepEqual(session.profile.teachingCategoryIds, []);
    // Editing still requires explicit current catalog choices; no positional mapping.
    assert.ok(validateCategoryDraft(session.profile, catalog));
  }
});

test('incomplete server sessions cannot be bypassed by complete category data or stale completion flags', async () => {
  const session = await loadServerSession(async path => path === '/auth/session'
    ? { onboardingRequired: true, profile: { id: 'incomplete', role: 'both', categoryReselectionRequired: false, goal: null } }
    : { learningCategoryIds: [a], teachingCategoryIds: [b] });
  assert.equal(session.onboardingRequired, true);
  assert.equal(session.profile.goal, null);
});

test('retained legacy history for a disabled persona does not trap completed GUID onboarding in a loop', async () => {
  for (const role of ['learner', 'instructor']) {
    const session = await loadServerSession(async path => path === '/auth/session'
      ? { onboardingRequired: false, profile: { id: 'account', role, interests: [0], teachingAreas: [1] } }
      : { learningCategoryIds: role === 'learner' ? [a] : [], teachingCategoryIds: role === 'instructor' ? [b] : [] });
    assert.equal(session.onboardingRequired, false);
  }
});

test('onboarding request contains GUIDs, preserves metadata and omits immutable/client-only fields', () => {
  const value = { id: 'ignore', balance: 999, role: 'both', name: 'Name', username: 'name', goal: 1,
    interests: [0], teachingAreas: [1], learningCategoryIds: [a], teachingCategoryIds: [b], customSkills: [] };
  const body = profileRequest(value, { includeCategories: true });
  assert.deepEqual(body.learningCategoryIds, [a]); assert.deepEqual(body.teachingCategoryIds, [b]);
  for (const field of ['id', 'balance', 'interests', 'teachingAreas']) assert.equal(body[field], undefined);
  assert.equal(profileRequest({ ...value, role: 'learner' }, { includeCategories: true }).teachingCategoryIds, undefined);
  assert.equal(profileRequest({ ...value, role: 'instructor' }, { includeCategories: true }).learningCategoryIds, undefined);
});

test('profile replacements persist and reload via existing membership-protected routes', async () => {
  const saved = { learningCategoryIds: [], teachingCategoryIds: [] };
  const request = async (path, body, options) => {
    assert.equal(options.method, 'PUT'); assert.deepEqual(Object.keys(body), ['categoryIds']);
    saved[path.endsWith('learning') ? 'learningCategoryIds' : 'teachingCategoryIds'] = body.categoryIds;
    return saved;
  };
  await replaceCategories('learning', [a], request);
  await replaceCategories('teaching', [b], request);
  const restored = await loadServerSession(async path => path === '/auth/session'
    ? { profile: { id: 'account', role: 'both' }, onboardingRequired: false } : saved);
  assert.deepEqual(restored.profile.learningCategoryIds, [a]); assert.deepEqual(restored.profile.teachingCategoryIds, [b]);
});

test('invalid categories and role failures cannot announce a successful replacement', async () => {
  let calls = 0;
  for (const ids of [[a, a], [0], ['programming'], null]) await assert.rejects(() => replaceCategories('learning', ids, async () => { calls++; }));
  assert.equal(calls, 0);
  await assert.rejects(() => replaceCategories('teaching', [a], async () => { throw Object.assign(new Error('Forbidden'), { status: 403 }); }), /Forbidden/);
});

test('empty required selections and unavailable GUIDs need reselection; custom teaching skills remain valid', () => {
  assert.equal(validateCategoryDraft({ role: 'learner', learningCategoryIds: [] }, catalog), 'learning');
  assert.equal(validateCategoryDraft({ role: 'both', learningCategoryIds: [a], teachingCategoryIds: [], customSkills: [] }, catalog), 'teaching');
  assert.equal(validateCategoryDraft({ role: 'instructor', teachingCategoryIds: [], customSkills: ['Skill'] }, catalog), null);
  assert.equal(validateCategoryDraft({ role: 'learner', learningCategoryIds: [a] }, []), 'unavailable');
});

test('category traffic preserves cookie credentials, API root and request headers', async () => {
  await replaceCategories('learning', [a], (path, body, options) => accountRequest(path, body, { ...options,
    base: 'https://api.example.test', fetcher: async (url, init) => {
      assert.equal(url, 'https://api.example.test/me/categories/learning');
      assert.equal(init.credentials, 'include'); assert.equal(init.method, 'PUT');
      assert.equal(init.headers['Content-Type'], 'application/json');
      assert.equal(init.headers['X-Requested-With'], 'XMLHttpRequest');
      assert.deepEqual(JSON.parse(init.body), { categoryIds: [a] });
      return { ok: true, status: 200, json: async () => ({ learningCategoryIds: [a], teachingCategoryIds: [] }) };
    },
  }));
});

const vite = await createServer({ cacheDir: 'node_modules/.vite-category-tests', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
let selectors, categoryContext, preferences, sessionContext;
try {
  [selectors, categoryContext, preferences, sessionContext] = await Promise.all([
    '/src/pages/auth/InterestsSetup.jsx', '/src/context/CategoryCatalogContext.jsx', '/src/context/PreferencesContext.jsx', '/src/context/AccountSessionContext.jsx',
  ].map(path => vite.ssrLoadModule(path)));
} finally { await vite.close(); }

test('existing selection-card layout renders real server labels and checked GUIDs in both languages', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  globalThis.window = { localStorage };
  for (const language of ['ar', 'en']) {
    values.set('esham-language', language);
    const html = renderToString(h(preferences.PreferencesProvider, null,
      h(categoryContext.CategoryCatalogContext.Provider, { value: { categories: catalog, loading: false, error: null } },
        h(selectors.default, { draft: { role: 'learner', learningCategoryIds: [a], customSkills: [] }, update: () => {} }))));
    assert.match(html, /interests-card-grid/); assert.match(html, /interests-card selected/);
    assert.ok(html.includes(a)); assert.ok(html.includes(language === 'ar' ? 'برمجة' : 'Programming'));
    assert.match(html, /checked=""/);
  }
});

test('refreshing onboarding retains this account draft GUIDs but never leaks another account draft', () => {
  const server = { profile: { id: 'one', role: null, name: 'Server name', learningCategoryIds: [], teachingCategoryIds: [] }, onboardingRequired: true };
  const previous = { id: 'one', name: 'Name', username: 'draft_name', bio: 'Draft bio', learningCategoryIds: [a], goal: 2, customSkills: [] };
  const restored = sessionContext.onboardingDraft(server, previous);
  assert.deepEqual(restored.learningCategoryIds, [a]); assert.equal(restored.bio, 'Draft bio');
  assert.equal(restored.username, 'draft_name');
  const another = sessionContext.onboardingDraft({ ...server, profile: { ...server.profile, id: 'two' } }, previous);
  assert.deepEqual(another.learningCategoryIds, []); assert.equal(another.bio, '');
  assert.equal(another.goal, null);
  const registered = sessionContext.onboardingDraft({ ...server, profile: { ...server.profile, username: 'email@example.test' } }, previous);
  assert.equal(registered.username, 'draft_name'); // Do not replace an unsaved valid username with Identity's initial email.
  const expanded = sessionContext.onboardingDraft({ profile: { ...server.profile, role: 'learner', goal: 1 }, onboardingRequired: false },
    { ...previous, role: 'both', pendingPersona: 'both', goal: null });
  assert.equal(expanded.role, 'both'); assert.equal(expanded.goal, null);
});
