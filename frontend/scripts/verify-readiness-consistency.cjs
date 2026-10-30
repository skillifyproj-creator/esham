const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.addInitScript(() => localStorage.setItem('esham-language', 'ar'));
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const courseId = process.env.ESHAM_TEST_COURSE_ID, lessonId = process.env.ESHAM_TEST_LESSON_ID;
  assert(courseId && lessonId && process.env.ESHAM_TEST_EMAIL && process.env.ESHAM_TEST_PASSWORD);
  const errors = [], writes = [], reads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (!request.url().includes(`/api/courses/${courseId}`)) return;
    if (request.method() === 'GET') reads.push(request.url());
    else if (!request.url().endsWith('/lessons/readiness')) writes.push(request.url());
  });
  const get = async suffix => {
    const response = await context.request.get(`http://localhost:5206/api/courses/${courseId}${suffix}`);
    assert(response.ok(), `${response.status()}: ${await response.text()}`); return response.json();
  };
  try {
    await page.goto('http://localhost:5173/login');
    await page.locator('[name=email]').fill(process.env.ESHAM_TEST_EMAIL);
    await page.locator('[name=password]').fill(process.env.ESHAM_TEST_PASSWORD);
    await page.locator('button[type=submit]').click(); await page.waitForURL(url => ['/instructor', '/learner'].includes(url.pathname));
    const before = await get('');
    const initial = await get('/draft/sections/readiness');
    const section = initial.sections.find(item => item.lessons.some(lesson => lesson.id === lessonId)); assert(section);
    const lesson = section.lessons.find(item => item.id === lessonId);
    assert.equal(initial.courseVersionId, before.draftVersionId); assert.equal(section.courseVersionId, before.draftVersionId);
    assert.equal(lesson.readiness.percentage, 100); assert.equal(section.readiness.percentage, 100); assert.equal(initial.percentage, 100);
    const media = await get(`/draft/sections/${section.id}/lessons/${lessonId}/media`);
    const primary = media.find(item => item.mediaAssetId === lesson.primaryVideoMediaAssetId && item.isPrimary); assert(primary);
    const content = await context.request.get(`http://localhost:5206${primary.contentUrl}`, { headers: { Range: 'bytes=0-15' } });
    assert.equal(content.status(), 206); assert.equal((await content.body()).length, 16);
    const editor = `http://localhost:5173/instructor/courses/${courseId}/sections/${section.id}/lessons/${lessonId}/edit`;
    await page.goto(editor);
    await page.waitForFunction(() => document.querySelector('.instructor-readiness-score strong')?.textContent === '100%');
    assert.equal(await page.locator('.instructor-readiness-list .done').count(), 4);
    await page.screenshot({ path: path.join(os.tmpdir(), 'esham-readiness-lesson.png'), fullPage: true });
    await page.locator('.instructor-edit-lesson-header-actions a').first().click();
    await page.waitForURL('**/curriculum');
    const card = page.locator('.curriculum-section-card:not(.course-tasks-panel)').filter({ hasText: section.titleAr });
    await card.locator('.curriculum-progress', { hasText: '100%' }).waitFor();
    assert.equal(await card.locator('.curriculum-status.ready').count(), 1);
    const row = card.locator('.curriculum-lesson-row').filter({ hasText: lesson.titleAr });
    assert.equal((await row.locator('.curriculum-ready-badge').innerText()).trim(), 'جاهز');
    assert.equal((await page.locator('.curriculum-readiness-heading strong').innerText()).trim(), '100%');
    await page.reload(); await card.locator('.curriculum-progress', { hasText: '100%' }).waitFor();
    assert.equal((await row.locator('.curriculum-ready-badge').innerText()).trim(), 'جاهز');
    await page.waitForFunction(() => !document.querySelector('.course-tasks-panel')?.textContent.includes('جارٍ تحميل المهام'));
    await page.screenshot({ path: path.join(os.tmpdir(), 'esham-readiness-curriculum.png'), fullPage: true });
    await row.locator('.curriculum-edit-button').click(); await page.waitForURL(`**/lessons/${lessonId}/edit`);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.instructor-readiness-score strong')?.textContent === '100%');
    // Preview an incomplete unsaved duration, then discard it: no artificial completion or data repair.
    await page.locator('.instructor-lesson-duration-input input').fill('0.1');
    await page.waitForFunction(() => document.querySelector('.instructor-readiness-score strong')?.textContent === '75%');
    await page.reload(); await page.waitForFunction(() => document.querySelector('.instructor-readiness-score strong')?.textContent === '100%');
    await page.evaluate(() => localStorage.setItem('esham-language', 'en')); await page.reload();
    await page.waitForFunction(() => document.querySelector('.instructor-readiness-score strong')?.textContent === '100%');
    assert.deepEqual(await get(''), before, 'Course/draft fields and row version must remain unchanged');
    assert.deepEqual(await get('/draft/sections/readiness'), initial, 'Persisted lesson and readiness data must remain unchanged');
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    assert(reads.some(url => url.endsWith('/draft/sections/readiness')));
    console.log(JSON.stringify({ result: 'PASS', courseId, courseVersionId: initial.courseVersionId, lessonId,
      editor: 100, section: 100, curriculum: 100, refresh: 'consistent', unsavedIncompletePreview: 75,
      bilingual: 'consistent', persistedData: 'unchanged', unexpectedWrites: writes.length }));
  } catch (error) {
    console.error('Browser route:', page.url());
    await page.screenshot({ path: path.join(os.tmpdir(), 'esham-readiness-failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
