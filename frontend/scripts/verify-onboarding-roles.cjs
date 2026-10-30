// UI verification against the configured API. Credentials are generated in memory, never logged.
// ESHAM_ROLE_MANIFEST is a temporary path for the three test account IDs/emails, for cleanup.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { writeFileSync, readFileSync, existsSync } = require('node:fs');
const origin = process.env.ESHAM_TEST_FRONTEND || 'http://localhost:5173';
const api = process.env.ESHAM_TEST_API || 'http://localhost:5206';
(async () => {
  assert(process.env.ESHAM_ROLE_MANIFEST, 'A temporary account cleanup manifest path is required.');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const created = existsSync(process.env.ESHAM_ROLE_MANIFEST) ? JSON.parse(readFileSync(process.env.ESHAM_ROLE_MANIFEST, 'utf8')) : [];
  const results = [];
  try {
    for (const persona of ['learner', 'instructor', 'both']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addInitScript(() => localStorage.setItem('esham-language', 'en'));
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      const stamp = Date.now().toString(36);
      const email = `codex_role_ui_${stamp}_${persona}@example.test`;
      const password = `Aa1!${randomBytes(20).toString('hex')}`;
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(`${origin}/signup`);
        await page.locator('input[name="name"]').fill(`Role UI verification ${persona}`);
        await page.locator('input[name="email"]').fill(email);
        await page.locator('input[name="password"]').fill(password);
        await page.locator('input[name="confirm"]').fill(password);
        const registered = page.waitForResponse(r => r.url().endsWith('/auth/register') && r.request().method() === 'POST');
        await page.locator('button[type="submit"]').click();
        const response = await registered; assert.equal(response.status(), 201);
        const id = (await response.json()).profile.id;
        created.push({ id, email, persona }); writeFileSync(process.env.ESHAM_ROLE_MANIFEST, JSON.stringify(created, null, 2));
        await page.waitForURL('**/onboarding/role');
        let session = await (await context.request.get(`${api}/auth/session`)).json();
        assert.equal(session.onboardingRequired, true); assert.deepEqual(session.profile.roles, []);
        assert.deepEqual(await page.locator('input[name="role"]').evaluateAll(nodes => nodes.map(x => x.value).sort()), ['both', 'instructor', 'learner']);
        // Changing the draft selection before completion must not leave a stale membership.
        await page.locator(`input[name="role"][value="${persona === 'learner' ? 'instructor' : 'learner'}"]`).check();
        await page.locator('.onboarding-next').click(); await page.waitForURL('**/onboarding/profile');
        await page.locator('#onboarding-username').fill(`ui_${persona}_${stamp}`);
        await page.locator('.onboarding-back').click(); await page.waitForURL('**/onboarding/role');
        await page.locator(`input[name="role"][value="${persona}"]`).check();
        await page.locator('.onboarding-next').click(); await page.waitForURL('**/onboarding/profile');
        await page.locator('.onboarding-next').click(); await page.waitForURL('**/onboarding/interests');
        const groups = page.locator('.interests-card-grid'); await groups.first().locator('input[type="checkbox"]').first().waitFor();
        assert.equal(await groups.count(), persona === 'both' ? 2 : 1);
        for (let i = 0; i < await groups.count(); i++) await groups.nth(i).locator('input[type="checkbox"]').first().check();
        await page.locator('.onboarding-next').click(); await page.waitForURL('**/onboarding/goals');
        await page.locator('input[name="goal"]').first().check();
        const finalized = page.waitForResponse(r => r.url().endsWith('/me') && r.request().method() === 'PATCH');
        await page.locator('.onboarding-next').click();
        const completion = await finalized; assert.equal(completion.status(), 204);
        const payload = completion.request().postDataJSON();
        await page.waitForURL('**/onboarding/complete');
        const expected = persona === 'both' ? ['Instructor', 'Learner'] : [persona === 'learner' ? 'Learner' : 'Instructor'];
        session = await (await context.request.get(`${api}/auth/session`)).json();
        assert.equal(session.onboardingRequired, false); assert.equal(session.profile.role, persona);
        assert.deepEqual([...session.profile.roles].sort(), expected);
        // The server profile reads these memberships through UserManager/AspNetUserRoles.
        for (let i = 0; i < 2; i++) assert.equal((await context.request.patch(`${api}/me`, { data: payload })).status(), 204);
        for (const role of ['GeneralAdmin', 'CategoryAdmin', 'Combined']) {
          assert.equal((await context.request.patch(`${api}/me`, { data: { ...payload, role } })).status(), 400);
          assert.equal((await context.request.patch(`${api}/me/role`, { data: { role } })).status(), 400);
        }
        const capability = await context.request.get(`${api}/api/courses/mine`);
        assert.equal(capability.status(), persona === 'learner' ? 403 : 200);
        assert.equal((await context.request.post(`${api}/auth/logout`)).status(), 204);
        await page.goto(`${origin}/login`);
        await page.locator('input[name="email"]').fill(email); await page.locator('input[name="password"]').fill(password);
        await page.locator('button[type="submit"]').click();
        await page.waitForURL(persona === 'instructor' ? '**/instructor' : '**/learner');
        session = await (await context.request.get(`${api}/auth/session`)).json();
        assert.equal(session.onboardingRequired, false); assert.deepEqual([...session.profile.roles].sort(), expected);
        await page.reload();
        await page.waitForURL(persona === 'instructor' ? '**/instructor' : '**/learner');
        assert.deepEqual(errors, []);
        results.push({ persona, roles: expected, registration: 'UI', onboarding: 'UI', repeatedFinalization: 'passed', adminRejection: 'passed', loginRedirect: new URL(page.url()).pathname });
      } catch (error) {
        console.error(JSON.stringify({ persona, error: error.message, url: page.url(), alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []), browserErrors: errors }, null, 2));
        throw error;
      } finally { await context.close(); }
    }
    console.log(JSON.stringify({ passed: true, results, cleanupManifest: process.env.ESHAM_ROLE_MANIFEST }, null, 2));
  } catch { process.exitCode = 1; }
  finally { await browser.close(); }
})();
