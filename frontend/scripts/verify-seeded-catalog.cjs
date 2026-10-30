const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const origin = process.env.ESHAM_TEST_FRONTEND || 'http://localhost:5173';
const api = process.env.ESHAM_TEST_API || 'http://localhost:5206';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const checks = [];
  try {
    const request = (await browser.newContext()).request;
    const categories = await (await request.get(`${api}/api/categories`)).json();
    const publicCourses = await (await request.get(`${api}/api/courses/public`)).json();
    assert.deepEqual(categories.map(x => x.nameEn), ['Programming', 'Design', 'Photography', 'Marketing', 'Crafts & Arts', 'Business & Personal Development']);
    assert.equal(new Set(categories.map(x => x.id)).size, 6); assert(categories.every((x, i) => x.isActive && x.displayOrder === i + 1));
    assert.equal(categories[0].id, 'f27472b2-acb5-4d4e-bcdf-90a547aa36af');
    const demo = publicCourses.filter(x => x.instructor.id === 'e5a00002-0000-4000-8000-000000000001');
    assert.equal(demo.length, 12);
    for (const category of categories) assert.equal(demo.filter(x => x.categoryId === category.id).length, 2);
    const realIds = new Set(publicCourses.map(x => x.courseId));
    checks.push('Six active default categories with stable order, original Programming ID and 12 published demo courses');
    for (const language of ['en', 'ar']) {
      const context = await browser.newContext();
      await context.addInitScript(lang => localStorage.setItem('esham-language', lang), language);
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/`); await page.locator('#courses .course-card').first().waitFor();
      assert.equal(await page.locator('#courses .course-card').count(), publicCourses.length);
      for (const category of categories) assert.equal(await page.locator('#courses .filters button').filter({ hasText: language === 'ar' ? category.nameAr : category.nameEn }).count(), 1);
      await page.goto(`${origin}/courses`); await page.locator('.catalog-grid .course-card').first().waitFor();
      assert.equal(await page.locator('.catalog-categories button').count(), 7);
      const seen = new Set();
      for (let number = 1; number <= Math.ceil(publicCourses.length / 8); number++) {
        if (number === 2) {
          await page.locator('.pagination button').filter({ hasText: /^2$/ }).click();
          await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === '2');
        }
        await page.waitForFunction(count => document.querySelectorAll('.catalog-grid .course-card').length === count,
          Math.min(8, publicCourses.length - (number - 1) * 8));
        for (const href of await page.locator('.catalog-grid .course-card h3 a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))) {
          const id = href.split('/').at(-1); assert(realIds.has(id), `Static/fake course leaked: ${id}`); seen.add(id);
        }
      }
      assert.equal(seen.size, publicCourses.length);
      for (const category of categories) {
        await page.locator('.catalog-categories button').filter({ hasText: language === 'ar' ? category.nameAr : category.nameEn }).click();
        await page.waitForFunction(id => new URL(location.href).searchParams.get('category') === id, category.id);
        await page.waitForFunction(ids => {
          const links = [...document.querySelectorAll('.catalog-grid .course-card h3 a')];
          return links.length === ids.length && links.every(x => ids.includes(x.getAttribute('href').split('/').at(-1)));
        }, demo.filter(x => x.categoryId === category.id).map(x => x.courseId));
        assert.equal(await page.locator('.catalog-grid .course-card').count(), 2);
        const titles = await page.locator('.catalog-grid .course-card h3').allTextContents();
        assert(titles.every(title => demo.filter(x => x.categoryId === category.id).some(x => title.trim() === (language === 'ar' ? x.titleAr : x.titleEn))), JSON.stringify({ titles, category, language }));
      }
      await page.locator('.catalog-grid .course-card h3 a').first().click();
      await page.locator('.detail-hero h1').waitFor(); assert((await page.locator('.detail-hero h1').textContent()).includes(language === 'ar' ? '[تجريبي]' : '[Demo]'));
      assert.deepEqual(errors, []); await context.close();
      checks.push(`${language}: home and paginated catalog show only API course IDs; all category filters and real course detail work`);
      for (const persona of ['learner', 'instructor', 'both']) {
        const onboarding = await browser.newContext();
        await onboarding.addInitScript(lang => localStorage.setItem('esham-language', lang), language);
        await onboarding.route(`${api}/auth/session`, route => route.fulfill({ json: { onboardingRequired: true, profile: {
          id: 'catalog-layout-test', role: persona, roles: [], name: 'Catalog selection test', username: 'catalog_test', bio: '', goal: null, customSkills: [] } }, headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } }));
        await onboarding.route(`${api}/me/categories`, route => route.fulfill({ json: { learningCategoryIds: [], teachingCategoryIds: [] }, headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } }));
        const form = await onboarding.newPage(); form.setDefaultTimeout(20000);
        await form.goto(`${origin}/onboarding/role`);
        await form.locator(`input[name="role"][value="${persona}"]`).check();
        await form.locator('.onboarding-next').click(); await form.locator('#onboarding-name').waitFor();
        await form.locator('.onboarding-next').click(); await form.locator('.interests-card-grid').first().waitFor();
        const groups = form.locator('.interests-card-grid'); assert.equal(await groups.count(), persona === 'both' ? 2 : 1);
        for (let i = 0; i < await groups.count(); i++) {
          assert.equal(await groups.nth(i).locator('input[type="checkbox"]').count(), 6);
          const labels = await groups.nth(i).locator('input[type="checkbox"]').evaluateAll(nodes => nodes.map(n => ({ title: n.getAttribute('aria-label'), ref: n.getAttribute('aria-describedby') })));
          assert.deepEqual(labels.map(x => x.title), categories.map(x => language === 'ar' ? x.nameAr : x.nameEn));
          assert(labels.every((x, index) => x.ref.includes(categories[index].id)));
        }
        await onboarding.close(); checks.push(`${language}: ${persona} onboarding selectors contain all six real API category IDs/labels`);
      }
    }
    const failure = await browser.newContext();
    await failure.addInitScript(() => localStorage.setItem('esham-language', 'en'));
    await failure.route(`${api}/api/courses/public`, route => route.fulfill({ status: 503, json: { title: 'Unavailable' }, headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } }));
    const page = await failure.newPage(); await page.goto(`${origin}/courses`);
    await page.getByRole('alert').filter({ hasText: 'Unable to load the catalog' }).waitFor();
    assert.equal(await page.locator('.course-card').count(), 0); await failure.close();
    checks.push('Unavailable backend shows an error and zero static fallback cards');
    for (const actor of [
      { email: 'fatima.instructor@test.com', password: process.env.ESHAM_FATIMA_PASSWORD, role: 'instructor' },
      { email: 'Dana@learner.com', password: process.env.ESHAM_DANA_PASSWORD, role: 'learner' },
    ].filter(x => x.password)) {
      const context = await browser.newContext();
      await context.addInitScript(() => localStorage.setItem('esham-language', 'en'));
      const page = await context.newPage();
      await page.goto(`${origin}/login`); await page.locator('input[name="email"]').fill(actor.email); await page.locator('input[name="password"]').fill(actor.password);
      await page.locator('button[type="submit"]').click(); await page.waitForURL(`**/${actor.role}`);
      if (actor.role === 'instructor') {
        await page.goto(`${origin}/instructor/courses`); await page.locator('.instructor-course-card').first().waitFor();
        assert.equal(await page.locator('.instructor-course-card').count(), 1);
        assert.equal(await page.locator('a[href*="e5a00003"]').count(), 0, 'Demo courses must never appear as this real instructor\'s courses');
        await page.goto(`${origin}/instructor/certificates`); await page.locator('.instructor-certificate-course').first().waitFor();
        assert.equal(await page.locator('.instructor-certificate-course').count(), 1);
      } else {
        await page.locator('.learner-recommendations .course-card').first().waitFor();
        for (const href of await page.locator('.learner-recommendations .course-card h3 a').evaluateAll(nodes => nodes.map(x => x.getAttribute('href'))))
          assert(realIds.has(href.split('/').at(-1)));
      }
      await context.close(); checks.push(`${actor.role}: real-account dashboard/list uses backend course IDs with no demo-source cards`);
    }
    console.log(JSON.stringify({ passed: true, checks, categories: categories.map(x => ({ id: x.id, name: x.nameEn, order: x.displayOrder })), demoCount: demo.length }, null, 2));
  } catch (error) { console.error(JSON.stringify({ passed: false, error: error.message, checks }, null, 2)); process.exitCode = 1; }
  finally { await browser.close(); }
})();
