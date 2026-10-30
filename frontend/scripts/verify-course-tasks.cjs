// Same credential/environment contract as verify-curriculum.cjs. No credentials are stored.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const origin = process.env.ESHAM_TEST_FRONTEND || 'http://localhost:5173';
const api = process.env.ESHAM_TEST_API || 'http://localhost:5206';
const courseId = process.env.ESHAM_TEST_COURSE_ID;
const root = `/api/courses/${courseId}/draft/tasks`;
const sectionsPath = `/api/courses/${courseId}/draft/sections`;
(async () => {
  assert(courseId && process.env.ESHAM_TEST_EMAIL && process.env.ESHAM_TEST_PASSWORD, 'Test account and course environment variables are required.');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('esham-language', 'en'));
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  const errors = [], checks = [], created = [];
  let sectionId, originalTasks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /TypeError|ReferenceError/.test(message.text())) errors.push(message.text()); });
  async function call(path, method = 'GET', data, status = 200) {
    const response = await context.request.fetch(`${api}${path}`, { method, data });
    assert.equal(response.status(), status, `${method} ${path}: ${await response.text()}`);
    return response.json();
  }
  async function act(action, method, suffix = '') {
    const pending = page.waitForResponse(r => r.url().endsWith(`${root}${suffix}`) && r.request().method() === method);
    pending.catch(() => {});
    await action(); const response = await pending;
    assert(response.ok(), `${method} ${suffix}: ${await response.text()}`);
    return response.json();
  }
  const row = id => page.locator(`[data-task-id="${id}"]`);
  try {
    const swagger = await (await context.request.get(`${api}/swagger/v1/swagger.json`)).json();
    assert.equal(Object.entries(swagger.paths).filter(([path]) => path.includes('/draft/tasks'))
      .reduce((n, [, value]) => n + Object.keys(value).filter(x => ['get', 'post', 'put', 'delete'].includes(x)).length, 0), 7);
    const anon = await browser.newContext();
    assert.equal((await anon.request.get(`${api}${root}`)).status(), 401); await anon.close();
    checks.push('Swagger exposes seven operations; anonymous access returns 401');
    await page.goto(`${origin}/login`);
    await page.locator('input[name="email"]').fill(process.env.ESHAM_TEST_EMAIL);
    await page.locator('input[name="password"]').fill(process.env.ESHAM_TEST_PASSWORD);
    await page.locator('button[type="submit"]').click(); await page.waitForURL('**/instructor');
    originalTasks = await call(root);
    const beforeSections = await call(sectionsPath);
    const section = await call(sectionsPath, 'POST', { titleEn: `Task placement verification ${Date.now()}`, sortOrder: beforeSections.reduce((m, x) => Math.max(m, x.sortOrder + 1), 0) }, 201);
    sectionId = section.id;
    const initialReadiness = await call(`${root}/readiness`);
    assert.equal(initialReadiness.taskCount, originalTasks.length);
    assert.equal(initialReadiness.meetsTaskCount, originalTasks.length >= 1 && originalTasks.length <= 3);
    await page.goto(`${origin}/instructor/courses/${courseId}/curriculum`);
    await page.getByRole('link', { name: 'Add course task', exact: true }).waitFor();
    checks.push('Instructor login and existing owned draft opened; initial readiness verified');
    for (let i = 0; i < 2; i++) {
      await page.getByRole('link', { name: 'Add course task', exact: true }).click();
      await page.getByRole('textbox', { name: 'Task title', exact: true }).fill(`Browser practical task ${i + 1}`);
      await page.getByRole('textbox', { name: 'Task description', exact: true }).fill('Build and explain a practical example.');
      await page.getByRole('textbox', { name: 'Task instructions', exact: true }).fill('Complete the example and explain your decisions.');
      await page.getByRole('textbox', { name: 'New requirement', exact: true }).fill('The result meets the stated objective.');
      await page.getByRole('button', { name: 'Add requirement', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Task ready for assessment', exact: true }).check();
      const saved = await act(() => page.getByRole('button', { name: 'Save draft', exact: true }).click(), 'POST');
      created.push(saved.id);
      assert.equal(saved.courseVersionId, section.courseVersionId); assert.equal(saved.displaySectionId, null);
      await page.waitForURL('**/curriculum'); await row(saved.id).waitFor();
    }
    const first = created[0], second = created[1];
    await row(first).getByRole('link', { name: 'Edit task', exact: true }).click();
    await page.getByRole('textbox', { name: 'Task title', exact: true }).fill('Browser practical task edited');
    await page.getByRole('combobox', { name: 'Display section', exact: true }).selectOption(sectionId);
    await act(() => page.getByRole('button', { name: 'Save draft', exact: true }).click(), 'PUT', `/${first}`);
    await page.waitForURL('**/curriculum'); await row(first).getByText(section.titleEn, { exact: true }).waitFor();
    let saved = await call(`${root}/${first}`); assert.equal(saved.displaySectionId, sectionId);
    await row(first).getByRole('link', { name: 'Edit task', exact: true }).click();
    await page.getByRole('combobox', { name: 'Display section', exact: true }).selectOption('');
    await act(() => page.getByRole('button', { name: 'Save draft', exact: true }).click(), 'PUT', `/${first}`);
    await page.waitForURL('**/curriculum'); await row(first).getByText('Course task — no section', { exact: true }).waitFor();
    assert.equal((await call(`${root}/${first}`)).displaySectionId, null);
    await act(() => row(first).getByRole('button', { name: 'Move task down', exact: true }).click(), 'PUT', '/reorder');
    await page.reload(); await row(first).getByText('Browser practical task edited', { exact: true }).waitFor();
    const all = await call(root);
    assert(all.findIndex(x => x.id === second) < all.findIndex(x => x.id === first));
    saved = await call(`${root}/${first}`);
    assert.equal(saved.titleEn, 'Browser practical task edited'); assert.equal(saved.displaySectionId, null);
    assert.equal(saved.instructions.en, 'Complete the example and explain your decisions.'); assert.equal(saved.requirements.length, 1); assert(saved.isReady);
    checks.push('Created, edited, assigned/unassigned display section, reordered and confirmed persistence after refresh');
    await call(root, 'POST', { titleEn: 'Invalid placement', sortOrder: 0, displaySectionId: '11111111-1111-1111-1111-111111111111' }, 400);
    await call(`${root}/reorder`, 'PUT', { ids: all.map(() => first) }, 400);
    await call(`${root}/11111111-1111-1111-1111-111111111111`, 'GET', undefined, 404);
    while ((await call(root)).length <= 3) {
      const task = await call(root, 'POST', { titleEn: 'Readiness-only draft task', sortOrder: 100 }, 201); created.push(task.id);
    }
    const over = await call(`${root}/readiness`); assert(over.taskCount > 3); assert.equal(over.meetsTaskCount, false);
    checks.push('Draft editing permits more than three tasks; count readiness fails; invalid placement/reorder rejected');
    // Test both editor-confirmation deletion and curriculum-list deletion.
    await row(first).getByRole('link', { name: 'Edit task', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit practical task', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Delete task', exact: true }).click();
    await act(() => page.getByRole('button', { name: 'Confirm deletion', exact: true }).click(), 'DELETE', `/${first}`);
    await page.waitForURL('**/curriculum'); await row(second).waitFor();
    page.once('dialog', dialog => dialog.accept());
    await act(() => row(second).getByRole('button', { name: 'Delete task', exact: true }).click(), 'DELETE', `/${second}`);
    checks.push('Both editor and curriculum deletion persist');
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error(JSON.stringify({ passed: false, error: error.message, checks, browserErrors: errors, url: page.url(), alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []) }, null, 2));
    process.exitCode = 1;
  } finally {
    try {
      for (const id of created) {
        const response = await context.request.delete(`${api}${root}/${id}`);
        assert([200, 404].includes(response.status()), `Task cleanup failed: ${await response.text()}`);
      }
      for (const task of originalTasks) await call(`${root}/${task.id}`, 'PUT', { ...task, id: undefined, courseVersionId: undefined });
      if (sectionId) await call(`${sectionsPath}/${sectionId}`, 'DELETE');
      if (created.length) assert.deepEqual((await call(root)).map(x => x.id), originalTasks.map(x => x.id));
      checks.push('Removed test tasks/section and confirmed original database task list restored');
    } catch (error) { console.error(`Cleanup failed: ${error.message}`); process.exitCode = 1; }
    if (!process.exitCode) console.log(JSON.stringify({ passed: true, checks }, null, 2));
    await browser.close();
  }
})();
