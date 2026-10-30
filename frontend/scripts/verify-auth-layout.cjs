// Layout-only checks: all auth API responses are intercepted; no account/database writes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const origin = process.env.ESHAM_TEST_FRONTEND || 'http://localhost:5173';
const api = process.env.ESHAM_TEST_API || 'http://localhost:5206';
const artifacts = process.env.ESHAM_LAYOUT_ARTIFACTS;
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [], failures = [];
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  const viewports = [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 375, height: 667 }];
  async function contextFor(viewport, language, onboarding = false, roleStep = false, theme = 'light') {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(({ language, theme }) => { localStorage.setItem('esham-language', language); localStorage.setItem('esham-theme', theme); }, { language, theme });
    await context.route(`${api}/**`, route => {
      const path = new URL(route.request().url()).pathname;
      const category = '11111111-1111-4111-8111-111111111111';
      let status = 200, json;
      if (path === '/api/categories') json = [{ id: category, nameAr: 'البرمجة', nameEn: 'Programming', isActive: true }];
      else if (path === '/auth/session' && onboarding) json = { onboardingRequired: true, profile: { id: 'layout-test', name: 'Layout test', username: 'layout_test', role: roleStep ? null : 'both', roles: [], bio: '', customSkills: [], goal: null, learningCategoryIds: [category], teachingCategoryIds: [category] } };
      else if (path === '/me/categories') json = { learningCategoryIds: [category], teachingCategoryIds: [category] };
      else { status = path === '/auth/register' ? 409 : path === '/auth/forgot-password' || path === '/auth/reset-password' || path === '/me' ? 500 : 401; json = { title: 'Layout verification error', status }; }
      return route.fulfill({ status, json, headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } });
    });
    return context;
  }
  async function metrics(page, selector) {
    return page.locator(selector).first().evaluate(node => {
      const box = node.getBoundingClientRect();
      return { top: Math.round(box.top), bottom: Math.round(box.bottom), height: Math.round(box.height), visible: box.top >= -1 && box.bottom <= innerHeight + 1, scrollY, pageHeight: document.documentElement.scrollHeight, viewport: innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
    });
  }
  try {
    for (const viewport of viewports) for (const language of ['en', 'ar']) {
      const context = await contextFor(viewport, language);
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      for (const path of ['/login', '/signup', '/forgot-password', '/reset-password']) {
        await page.goto(`${origin}${path}`); await page.locator('.auth-submit').waitFor(); await page.evaluate(() => document.fonts.ready);
        const before = await metrics(page, '.auth-submit');
        const footer = await metrics(page, '.auth-existing');
        const controls = await page.locator('.auth-input-wrap input, .auth-submit, .auth-password-toggle').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44));
        assert(controls, 'Controls must retain at least 44px height');
        assert(!before.overflowX, 'No horizontal overflow');
        const desktop = viewport.width > 900;
        if (desktop && path === '/login' && !(before.visible && footer.visible && before.pageHeight <= viewport.height + 2)) {
          console.log(JSON.stringify({ initial: { viewport, language, before, footer }, boxes: await page.locator('.auth-page,.auth-form-panel,.auth-form-content,.auth-topbar,.auth-google,.auth-field,.auth-forgot').evaluateAll(nodes => nodes.map(n => ({ class: n.className, height: n.getBoundingClientRect().height, top: n.getBoundingClientRect().top, padding: getComputedStyle(n).padding, margin: getComputedStyle(n).margin, display: getComputedStyle(n).display }))) }));
          if (artifacts) await page.screenshot({ path: join(artifacts, 'initial-overflow.png'), fullPage: true });
          assert.fail('Login and account action must fit a laptop viewport');
        }
        if (viewport.width === 1366 && (path === '/login' || path === '/signup')) {
          await page.locator('.auth-submit').click();
          await page.locator('.auth-error').first().waitFor();
          assert((await metrics(page, '.auth-error')).visible, 'Field validation is visible beside the first invalid control');
          assert.equal(await page.locator('input[aria-invalid="true"]').first().evaluate(node => node === document.activeElement), true);
        }
        if (path === '/login' || path === '/signup' || path === '/forgot-password') {
          if (path === '/signup') { await page.locator('input[name="name"]').fill('Layout Test'); await page.locator('input[name="confirm"]').fill('LayoutTest123!'); }
          await page.locator('input[name="email"]').fill('layout-only@example.test');
          if (path !== '/forgot-password') await page.locator('input[name="password"]').fill('LayoutTest123!');
        } else {
          await page.locator('input[name="password"]').fill('LayoutTest123!'); await page.locator('input[name="confirm"]').fill('LayoutTest123!');
        }
        await page.locator('.auth-submit').click(); await page.locator('.auth-alert').waitFor();
        // Wait for the alert's presentation-only scroll on compact mobile viewports.
        await page.waitForFunction(() => { const r = document.querySelector('.auth-alert').getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1; });
        const alert = await metrics(page, '.auth-alert');
        assert(alert.visible && !alert.overflowX, 'Error must be immediately visible');
        if (desktop && path === '/login') assert.equal(alert.scrollY, 0, 'Laptop login errors should require no scrolling');
        assert.equal(await page.locator('.auth-visual').evaluate(node => getComputedStyle(node).display === 'none'), !desktop);
        assert.equal(await page.locator('.auth-page').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
        results.push({ path, language, viewport: `${viewport.width}x${viewport.height}`, submit: before, footerVisible: footer.visible, error: alert });
        if (artifacts && viewport.width === 1366) await page.screenshot({ path: join(artifacts, `${path.slice(1)}-${language}.png`), fullPage: true });
      }
      assert.deepEqual(errors, []); await context.close();
    }
    for (const language of ['en', 'ar']) for (const step of ['role', 'profile', 'interests', 'goals']) {
      const context = await contextFor({ width: 1366, height: 768 }, language, true, step === 'role');
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      await page.goto(`${origin}/onboarding/role`); await page.locator('.onboarding-next').waitFor();
      if (step !== 'role') {
        await page.locator('input[name="role"][value="both"]').check();
        await page.locator('.onboarding-next').click(); await page.locator('#onboarding-name').waitFor();
        if (step === 'interests' || step === 'goals') {
          await page.locator('.onboarding-next').click(); await page.locator('.interests-card-grid').first().waitFor();
          if (step === 'goals') { await page.locator('.onboarding-next').click(); await page.locator('input[name="goal"]').first().waitFor(); }
        }
      }
      assert((await metrics(page, '.onboarding-next')).visible, 'Step action remains visible');
      if (step === 'profile') await page.locator('#onboarding-name').fill('');
      if (step !== 'interests') { await page.locator('.onboarding-next').click(); await page.locator('.onboarding-error').waitFor(); assert((await metrics(page, '.onboarding-error')).visible, 'Step validation error remains visible'); }
      results.push({ path: `/onboarding/${step}`, language, viewport: '1366x768', actionVisible: true });
      if (artifacts) await page.screenshot({ path: join(artifacts, `onboarding-${step}-${language}.png`), fullPage: true });
      await context.close();
    }
    // Verify the compact alert also retains readable dark-theme colors and layout.
    const dark = await contextFor({ width: 1366, height: 768 }, 'ar', false, false, 'dark');
    const darkPage = await dark.newPage(); await darkPage.goto(`${origin}/login`);
    await darkPage.locator('input[name="email"]').fill('layout-only@example.test'); await darkPage.locator('input[name="password"]').fill('LayoutTest123!');
    await darkPage.locator('.auth-submit').click(); await darkPage.locator('.auth-alert').waitFor(); assert((await metrics(darkPage, '.auth-alert')).visible);
    if (artifacts) await darkPage.screenshot({ path: join(artifacts, 'login-ar-dark.png') }); await dark.close();
    console.log(JSON.stringify({ passed: true, checkedLayouts: results.length + 1, desktopSignup: results.filter(x => x.path === '/signup' && x.submit && !x.viewport.startsWith('3')), artifacts }, null, 2));
  } catch (error) { failures.push(error.message); console.error(JSON.stringify({ passed: false, failures, checkedLayouts: results.length, last: results.slice(-2) }, null, 2)); process.exitCode = 1; }
  finally { if (artifacts) writeFileSync(join(artifacts, 'measurements.json'), JSON.stringify(results, null, 2)); await browser.close(); }
})();
