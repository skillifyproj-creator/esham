require('./require-isolated-test-target.cjs')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const api = 'http://localhost:5216', frontend = 'http://localhost:5175';
const root = process.env.ESHAM_PHASE2_ARTIFACTS ? path.resolve(process.env.ESHAM_PHASE2_ARTIFACTS) : path.resolve(__dirname, '../../artifacts/phase2-isolated');
const f = JSON.parse(fs.readFileSync(fs.readFileSync(path.join(root, 'current-fixture-path.txt'), 'utf8'), 'utf8'));
const headers = { Origin: frontend, 'X-Requested-With': 'XMLHttpRequest', 'X-Esham-Account-Id': f.learner.id };
const checks = []; let browser, current = 'setup';
async function check(name, action) { current = name; await action(); checks.push({ name, passed: true }); console.log('PASS: ' + name); }
async function login(context, user) {
  const response = await context.request.post(api + '/auth/login', { headers, data: { email: user.email, password: user.password } });
  assert.equal(response.status(), 200); assert.equal((await response.json()).profile.id, user.id);
}
async function read(context, url) { const response = await context.request.get(api + url); assert.equal(response.status(), 200); return response.json(); }
(async () => {
  const probe = await (await fetch(api + '/development/test-isolation')).json();
  assert.ok(probe.isolated && probe.progressWritesEnabled && probe.mediaIsolated, 'Verified isolated progress and media target required.');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const learner = await browser.newContext(), instructor = await browser.newContext(), anonymous = await browser.newContext();
  for (const context of [learner, instructor, anonymous]) await context.route('**/*', route => {
    const r = route.request(); return !['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && !r.url().startsWith(api + '/') ? route.abort() : route.continue();
  });
  await login(learner, f.learner); await login(instructor, f.instructor);
  const page = await learner.newPage(); page.setDefaultTimeout(20000);
  await page.addInitScript(() => { if (!localStorage.getItem('esham-language')) localStorage.setItem('esham-language', 'en'); });
  const enrollment = `/me/enrollments/${f.enrollmentId}`, lesson = id => `${enrollment}/learning/lessons/${id}`;
  const learningUrl = frontend + `/learner/enrollments/${f.enrollmentId}/learn`;
  await check('anonymous and Instructor-only direct lesson media denial', async () => {
    for (const context of [anonymous, instructor]) for (const suffix of ['', '/video', `/attachments/${f.attachmentId}/content`]) {
      const response = await context.request.get(api + lesson(f.videoLessonId) + suffix); assert.equal(response.status(), context === anonymous ? 401 : 403);
    }
  });
  await check('Both-role owned curriculum article text and draft denial', async () => {
    const course = await read(learner, enrollment + '/learning'); assert.equal(course.accountId, f.learner.id); assert.equal(course.availableCourseVersionId, f.versionId);
    assert.equal((await learner.request.get(api + lesson(f.draftLessonId))).status(), 404);
    await page.goto(learningUrl + '?lesson=' + f.articleLessonId);
    await page.getByRole('heading', { name: 'Protected reading', exact: true }).waitFor();
    assert.match(await page.locator('.lesson-reading').textContent(), /<script>/); assert.equal(await page.evaluate(() => window.privateScriptExecuted), undefined);
  });
  await check('persisted lesson completion reload and independent authenticated session', async () => {
    await page.getByRole('button', { name: 'Mark lesson complete', exact: true }).click();
    await page.getByRole('button', { name: 'Lesson completed', exact: true }).waitFor(); await page.reload();
    await page.getByRole('button', { name: 'Lesson completed', exact: true }).waitFor();
    const second = await browser.newContext(); await login(second, f.learner);
    const state = await read(second, lesson(f.articleLessonId)); assert.equal(state.progress.isCompleted, true); await second.close();
  });
  await check('authenticated real video playback range HEAD and protected attachment', async () => {
    const range = await learner.request.get(api + lesson(f.videoLessonId) + '/video', { headers: { Range: 'bytes=0-9' } });
    assert.equal(range.status(), 206); assert.equal((await range.body()).length, 10); assert.match(range.headers()['cache-control'], /no-store/);
    const head = await learner.request.head(api + lesson(f.videoLessonId) + '/video'); assert.equal(head.status(), 200); assert.equal((await head.body()).length, 0);
    const attachment = await learner.request.get(api + lesson(f.videoLessonId) + `/attachments/${f.attachmentId}/content`);
    assert.equal(attachment.status(), 200); assert.match(attachment.headers()['content-disposition'], /^attachment/);
    await page.goto(learningUrl + '?lesson=' + f.videoLessonId); await page.locator('video').waitFor();
    await page.locator('video').evaluate(async video => { await video.play(); });
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.2);
    await page.locator('video').evaluate(video => video.pause());
  });
  await check('saved position backward seek stale conflict and canonical state', async () => {
    await page.waitForTimeout(600);
    let state = (await read(learner, lesson(f.videoLessonId))).progress;
    const payload = { expectedCourseVersionId: f.versionId, expectedProgressToken: state.progressToken, lastPositionSeconds: 1 };
    const first = await learner.request.put(api + lesson(f.videoLessonId) + '/progress', { headers, data: payload }); assert.equal(first.status(), 200); state = await first.json();
    const stale = await learner.request.put(api + lesson(f.videoLessonId) + '/progress', { headers, data: payload }); assert.equal(stale.status(), 409); const conflict = await stale.json(); assert.equal(conflict.code, 'progress_conflict'); assert.equal(conflict.canonicalState.lastPositionSeconds, 1);
    const back = await learner.request.put(api + lesson(f.videoLessonId) + '/progress', { headers, data: { ...payload, expectedProgressToken: state.progressToken, lastPositionSeconds: 0.25 } }); assert.equal(back.status(), 200);
    await page.reload(); await page.locator('video').waitFor(); await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 0.2);
  });
  await check('video completion and lesson-only 100 percent do not finalize required tasks', async () => {
    await page.getByRole('button', { name: 'Mark lesson complete', exact: true }).click(); await page.getByRole('button', { name: 'Lesson completed', exact: true }).waitFor();
    const state = await read(learner, enrollment + '/learning'); assert.equal(state.lessonCoveragePercentage, 100); assert.equal(state.versionState.isCourseCompleted, false); assert.equal(state.versionState.meetsCurrentRequirements, false); assert.equal(state.versionState.tasks[0].isApproved, false);
    const replay = await learner.request.put(api + lesson(f.videoLessonId) + '/completion', { headers, data: { expectedCourseVersionId: f.versionId } }); assert.equal(replay.status(), 200);
  });
  await check('My Courses enrollment detail dashboard progress and persisted resume', async () => {
    for (const url of ['/learner/courses', `/learner/enrollments/${f.enrollmentId}`, '/learner', '/learner/progress']) {
      await page.goto(frontend + url); await page.locator(`a[href="/learner/enrollments/${f.enrollmentId}/learn"]`).first().waitFor();
    }
    await page.goto(learningUrl); await page.getByRole('button', { name: 'Lesson completed', exact: true }).waitFor(); assert.ok(page.url().includes('/learn'));
  });
  await check('delayed previous-account response cannot restore private lesson or video', async () => {
    let release, captured; const hold = new Promise(r => { release = r; }), received = new Promise(r => { captured = r; });
    await page.route(api + lesson(f.articleLessonId), async route => {
      const response = await route.fetch(); captured(); await hold;
      const safeHeaders = { ...response.headers() }; delete safeHeaders['set-cookie']; await route.fulfill({ response, headers: safeHeaders });
    });
    await page.goto(learningUrl + '?lesson=' + f.articleLessonId); await received;
    await login(learner, f.otherLearner); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.waitForTimeout(500); release();
    await page.waitForTimeout(400); assert.equal(await page.locator('.lesson-reading').count(), 0); assert.equal(await page.locator('video').count(), 0);
    assert.equal((await learner.request.get(api + lesson(f.videoLessonId) + '/video')).status(), 404);
    await page.unroute(api + lesson(f.articleLessonId));
  });
  await check('expired session removes private content and blocks progress', async () => {
    await login(learner, f.learner); await page.goto(learningUrl); await page.getByRole('button', { name: 'Lesson completed', exact: true }).waitFor();
    await learner.clearCookies(); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => !document.querySelector('.lesson-reading') && !document.querySelector('video'));
    assert.equal(await page.locator('.lesson-reading').count(), 0); assert.equal(await page.locator('video').count(), 0);
    assert.equal((await learner.request.put(api + lesson(f.videoLessonId) + '/completion', { headers, data: { expectedCourseVersionId: f.versionId } })).status(), 401);
  });
  await login(learner, f.learner);
  for (const language of ['ar', 'en']) for (const width of [390, 1440]) await check(`learning layout ${language} ${width} persisted content`, async () => {
    await page.setViewportSize({ width, height: 900 }); await page.goto(frontend); await page.evaluate(lang => localStorage.setItem('esham-language', lang), language);
    await page.goto(learningUrl + '?lesson=' + f.articleLessonId); await page.locator('.lesson-reading').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dir), language === 'ar' ? 'rtl' : 'ltr');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.screenshot({ path: path.join(root, `learning-${language}-${width}.png`) });
  });
})().catch(error => { checks.push({ name: current, passed: false, error: error.message }); console.error('FAIL: ' + current + ': ' + error.message); process.exitCode = 1; })
.finally(async () => { fs.writeFileSync(path.join(root, 'browser-results.json'), JSON.stringify(checks, null, 2)); if (browser) await browser.close(); });
