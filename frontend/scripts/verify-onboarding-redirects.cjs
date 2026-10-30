// Compare real account sessions and verify redirect guards. Passwords are environment-only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const origin = process.env.ESHAM_TEST_FRONTEND || 'http://localhost:5173';
const api = process.env.ESHAM_TEST_API || 'http://localhost:5206';
const diagnose = process.argv.includes('--diagnose');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  const manifestPath = process.env.ESHAM_REDIRECT_MANIFEST;
  const created = manifestPath && existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
  async function check(account, expected, incomplete = false) {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem('esham-language', 'en');
      localStorage.setItem('esham-account-profile-v1', JSON.stringify({ id: 'obsolete', role: 'instructor', roles: ['Instructor'], goal: 0, categoryReselectionRequired: true }));
      sessionStorage.setItem('esham-onboarding-draft-v1', JSON.stringify({ id: 'obsolete', role: 'learner', goal: null, categoryReselectionRequired: true }));
    });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${origin}/login`);
      await page.locator('input[name="email"]').fill(account.email);
      await page.locator('input[name="password"]').fill(account.password);
      const pending = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
      await page.locator('button[type="submit"]').click();
      const login = await pending;
      assert.equal(login.status(), 200, `Login failed for ${account.email}; password was not retried.`);
      const loginData = await login.json();
      await page.waitForURL(url => ['/instructor', '/learner', '/onboarding/role'].includes(url.pathname));
      const sessionResponse = await context.request.get(`${api}/auth/session`); assert(sessionResponse.ok());
      const session = await sessionResponse.json();
      const selected = await (await context.request.get(`${api}/me/categories`)).json();
      const p = session.profile;
      const result = { account: account.email, loginOnboardingRequired: loginData.onboardingRequired,
        sessionOnboardingRequired: session.onboardingRequired, redirect: new URL(page.url()).pathname,
        profile: { id: p.id, persona: p.role, roles: p.roles, name: p.name, nameEn: p.nameEn,
          hasAvatar: Boolean(p.avatar), bio: p.bio, interests: p.interests, teachingAreas: p.teachingAreas,
          customSkills: p.customSkills, goal: p.goal, ...selected } };
      results.push(result);
      if (!diagnose) {
        assert.equal(loginData.onboardingRequired, incomplete);
        assert.equal(session.onboardingRequired, incomplete);
        assert.equal(result.redirect, expected);
        // A stale complete/incomplete cache, including one for the current account, must not overrule the server.
        await page.evaluate(id => {
          sessionStorage.setItem('esham-onboarding-draft-v1', JSON.stringify({ id, role: 'both', goal: null, categoryReselectionRequired: true }));
          localStorage.setItem('esham-account-profile-v1', JSON.stringify({ id, role: 'both', goal: null, categoryReselectionRequired: true }));
        }, p.id);
        await page.reload();
        await page.waitForFunction(path => window.location.pathname === path && document.querySelector('[role="status"]')?.textContent !== 'Loading account…', expected);
        assert.equal(new URL(page.url()).pathname, expected);
        const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('esham-account-profile-v1') || '{}'));
        assert.equal(cached.id, p.id); assert.equal(cached.role, p.role);
        if (!incomplete && p.role === 'both') {
          await page.goto(`${origin}/instructor/courses`);
          await page.getByRole('heading', { level: 1 }).first().waitFor();
          assert.equal(new URL(page.url()).pathname, '/instructor/courses');
          assert.deepEqual([...p.roles].sort(), ['Instructor', 'Learner']);
        }
        if (!incomplete && p.role !== 'both') {
          await page.goto(`${origin}/${p.role}/profile`);
          await page.getByRole('heading', { level: 1 }).first().waitFor();
          assert.equal(new URL(page.url()).pathname, `/${p.role}/profile`);
          const legacy = p.role === 'instructor' ? p.teachingAreas?.length : p.interests?.length;
          if (legacy) await page.getByText('Your earlier category choices are saved. Select current categories below when updating your profile.', { exact: true }).waitFor();
        }
        assert.deepEqual(errors, []);
      }
    } finally { await context.close(); }
  }
  try {
    const existing = [
      { email: 'fatima.instructor@test.com', password: process.env.ESHAM_FATIMA_PASSWORD, path: '/instructor' },
      { email: 'rahaf@instructer.com', password: process.env.ESHAM_RAHAF_PASSWORD, path: '/instructor' },
      { email: 'Dana@learner.com', password: process.env.ESHAM_DANA_PASSWORD, path: '/learner' },
    ];
    for (const account of existing.filter(x => !process.env.ESHAM_REDIRECT_ACCOUNT || x.email === process.env.ESHAM_REDIRECT_ACCOUNT))
      await check(account, account.path);
    if (!diagnose) {
      assert(manifestPath, 'A temporary test-account cleanup manifest is required.');
      const setup = await browser.newContext();
      for (const persona of ['both', 'incomplete']) {
        const email = `codex_redirect_ui_${Date.now().toString(36)}_${persona}@example.test`;
        const password = `Aa1!${randomBytes(20).toString('hex')}`;
        const registration = await setup.request.post(`${api}/auth/register`, { data: { name: `Redirect UI verification ${persona}`, email, password } });
        assert.equal(registration.status(), 201);
        const id = (await registration.json()).profile.id;
        created.push({ id, email, persona }); writeFileSync(manifestPath, JSON.stringify(created, null, 2));
        if (persona === 'both') {
          const response = await setup.request.patch(`${api}/me`, { data: { name: 'Redirect UI verification Both', username: `redirect_${Date.now().toString(36)}`,
            role: 'both', interests: [0], teachingAreas: [1], customSkills: [], goal: 0 } });
          assert.equal(response.status(), 204);
        }
        await check({ email, password }, persona === 'both' ? '/learner' : '/onboarding/role', persona === 'incomplete');
      }
      await setup.close();
      const invalid = await browser.newContext();
      assert.equal((await invalid.request.post(`${api}/auth/login`, { data: { email: `nonexistent_${Date.now()}@example.test`, password: 'NoAccount123!' } })).status(), 401);
      await invalid.close();
    }
    console.log(JSON.stringify({ passed: true, diagnose, results }, null, 2));
  } catch (error) { console.error(JSON.stringify({ passed: false, error: error.message, results }, null, 2)); process.exitCode = 1; }
  finally { await browser.close(); }
})();
