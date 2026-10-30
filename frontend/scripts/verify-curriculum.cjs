// Run with ESHAM_TEST_EMAIL, ESHAM_TEST_PASSWORD, ESHAM_TEST_COURSE_ID and
// PLAYWRIGHT_MODULE set. Uses an installed Edge browser; no credentials are saved.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.ESHAM_TEST_FRONTEND || 'http://localhost:5173';
const api = process.env.ESHAM_TEST_API || 'http://localhost:5206';
const courseId = process.env.ESHAM_TEST_COURSE_ID;
const path = `/api/courses/${courseId}/draft/sections`;
(async () => {
  assert(courseId && process.env.ESHAM_TEST_EMAIL && process.env.ESHAM_TEST_PASSWORD, 'Test credentials and course ID are required');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('esham-language', 'en'));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') console.error(message.text().slice(0, 1800)); });
  const report = [];
  const created = [];
  async function apiRequest(suffix = '', method = 'GET', data) {
    const response = await context.request.fetch(`${api}${path}${suffix}`, { method, data });
    assert(response.ok(), `${method} ${suffix}: ${response.status()} ${await response.text()}`);
    return response.json();
  }
  async function responseFor(action, method, suffix) {
    const response = page.waitForResponse(r => r.url().endsWith(`${path}${suffix}`) && r.request().method() === method);
    response.catch(() => {});
    await action();
    const result = await response;
    assert(result.ok(), `${method} ${suffix}: ${result.status()} ${await result.text()}`);
    return result.json();
  }
  try {
    await page.goto(`${base}/login`);
    await page.locator('input[name="email"]').fill(process.env.ESHAM_TEST_EMAIL);
    await page.locator('input[name="password"]').fill(process.env.ESHAM_TEST_PASSWORD);
    const login = page.waitForResponse(r => r.url().endsWith('/auth/login'));
    await page.locator('button[type="submit"]').click();
    assert((await login).ok(), 'Instructor login failed');
    await page.waitForURL(url => url.pathname === '/instructor' || url.pathname.startsWith('/onboarding/'));
    assert(!page.url().includes('/onboarding/'), 'Instructor account requires onboarding under the current server session rules');
    report.push('Instructor login');
    await page.goto(`${base}/instructor/courses`);
    await page.locator(`a[href="/instructor/courses/${courseId}/edit"]`).first().click();
    await page.locator('.instructor-create-primary-button').first().waitFor();
    // Navigate from the actual course ID without changing its basic information.
    await page.goto(`${base}/instructor/courses/${courseId}/curriculum`);
    await page.getByRole('button', { name: 'Add Section', exact: true }).waitFor();
    const before = await apiRequest();
    report.push('Own course listed and basic editor/curriculum loaded');
    for (let i = 0; i < 2; i++) {
      const section = await responseFor(() => page.getByRole('button', { name: 'Add Section', exact: true }).click(), 'POST', '');
      created.push(section.id);
      await page.locator('.curriculum-section-card').filter({ has: page.locator('h3', { hasText: 'New Section' }) }).last().waitFor();
    }
    const firstId = created[0];
    let card = page.locator('.curriculum-section-card').filter({ has: page.locator(`button[aria-label="Delete section"]`) });
    // Locate by database order; newly created sections append after the existing curriculum.
    card = page.locator('.curriculum-section-card').nth(before.length);
    const sectionTitle = `Curriculum browser check ${Date.now()}`;
    page.once('dialog', dialog => dialog.accept(sectionTitle));
    await responseFor(() => card.getByRole('button', { name: 'Edit', exact: true }).first().click(), 'PUT', `/${firstId}`);
    card = page.locator('.curriculum-section-card').filter({ has: page.getByRole('heading', { name: sectionTitle, exact: true }) });
    await card.getByRole('heading', { name: sectionTitle, exact: true }).waitFor();
    for (let i = 0; i < 2; i++) {
      await card.getByRole('button', { name: 'Add Lesson', exact: true }).click();
      await page.locator('.instructor-edit-lesson-field input[type="text"]').fill(`Browser lesson ${i + 1}`);
      await page.locator('input[value="article"]').check();
      await page.locator('.instructor-edit-lesson-field textarea').fill('Article content saved through the real draft API.');
      await responseFor(() => page.getByRole('button', { name: 'Save lesson', exact: true }).first().click(), 'POST', `/${firstId}/lessons`);
      await page.waitForURL('**/curriculum');
      await card.getByRole('heading', { name: sectionTitle, exact: true }).waitFor();
    }
    const lessons = await apiRequest(`/${firstId}/lessons`);
    const lessonId = lessons[0].id;
    await card.locator('.curriculum-lesson-row').first().getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator('.instructor-edit-lesson-field input[type="text"]').fill('Browser lesson edited');
    await responseFor(() => page.getByRole('button', { name: 'Save changes and continue', exact: true }).first().click(), 'PUT', `/${firstId}/lessons/${lessonId}`);
    await page.waitForURL('**/curriculum');
    await card.getByText('Browser lesson edited', { exact: true }).waitFor();
    await responseFor(() => card.getByRole('button', { name: 'Move lesson down', exact: true }).first().click(), 'PUT', `/${firstId}/lessons/reorder`);
    await responseFor(() => card.getByRole('button', { name: 'Move section down', exact: true }).click(), 'PUT', '/reorder');
    report.push('Created two sections/two lessons, edited titles/content and reordered both');
    await page.reload();
    await card.getByRole('heading', { name: sectionTitle, exact: true }).waitFor();
    const saved = await apiRequest();
    assert.equal(saved.findIndex(x => x.id === firstId), before.length + 1);
    const savedLessons = saved.find(x => x.id === firstId).lessons;
    assert.equal(savedLessons[1].id, lessonId);
    assert.equal(savedLessons[1].titleEn, 'Browser lesson edited');
    assert.equal(savedLessons[1].descriptionEn, 'Article content saved through the real draft API.');
    await card.getByText('Browser lesson edited', { exact: true }).waitFor();
    report.push('Page refresh and fresh server read confirm persisted data and order');
    // Verify the server blocks deleting a nonempty section.
    assert.equal((await context.request.delete(`${api}${path}/${firstId}`)).status(), 409);
    report.push('Nonempty section delete returns 409');
    // Exercise UI deletion and remove only records created by this run.
    for (let i = 0; i < 2; i++) {
      const current = await apiRequest(`/${firstId}/lessons`);
      page.once('dialog', dialog => dialog.accept());
      await responseFor(() => card.getByRole('button', { name: 'Delete lesson', exact: true }).first().click(), 'DELETE', `/${firstId}/lessons/${current[0].id}`);
      await page.waitForFunction(n => document.querySelectorAll('.curriculum-lesson-row').length === n, before.reduce((n, x) => n + x.lessons.length, 0) + 1 - i);
    }
    page.once('dialog', dialog => dialog.accept());
    await responseFor(() => card.getByRole('button', { name: 'Delete section', exact: true }).click(), 'DELETE', `/${firstId}`);
    created.splice(created.indexOf(firstId), 1);
    report.push('Lesson and empty section UI deletion');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: report }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ passed: false, checks: report, error: error.message, browserErrors: errors, url: page.url(), alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []) }, null, 2));
    process.exitCode = 1;
  } finally {
    for (const id of created) {
      try {
        for (const lesson of await apiRequest(`/${id}/lessons`)) await apiRequest(`/${id}/lessons/${lesson.id}`, 'DELETE');
        await apiRequest(`/${id}`, 'DELETE');
      } catch (error) { console.error(`Cleanup required for test section ${id}: ${error.message}`); }
    }
    await browser.close();
  }
})();
