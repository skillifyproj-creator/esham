// All HTTP/SQL mutations below require an actual approved LocalDB handshake.
require('./require-isolated-test-target.cjs')();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const api = process.env.ESHAM_TEST_API || 'http://localhost:5216';
const frontend = process.env.ESHAM_TEST_FRONTEND || 'http://localhost:5175';
const root = path.resolve(__dirname, '../..');
const artifacts = process.env.ESHAM_PHASE1_ARTIFACTS;
const checks = [];
let current = 'setup', browser, fixtures;
async function check(name, action) {
  current = name; const start = Date.now(); await action();
  checks.push({ name, status: 'passed', durationMs: Date.now() - start });
  console.log('PASS: ' + name);
}
async function run() {
  assert.ok(artifacts && process.env.ESHAM_PHASE1_FIXTURE_FILE, 'Private isolated fixture configuration is required.');
  const probe = await fetch(api + '/development/test-isolation');
  const safety = await probe.json(); assert.ok(probe.ok && safety.isolated === true && safety.purchasesEnabled === true);
  fixtures = JSON.parse(fs.readFileSync(process.env.ESHAM_PHASE1_FIXTURE_FILE, 'utf8'));
  const f = fixtures, headers = { Origin: frontend, 'X-Requested-With': 'XMLHttpRequest' };
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const learner = await browser.newContext(), owner = await browser.newContext();
  for (const context of [learner, owner]) {
    await context.route('**/*', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) && !route.request().url().startsWith(api + '/')) return route.abort();
      return route.continue();
    });
  }
  const login = async (context, user) => {
    const r = await context.request.post(api + '/auth/login', { headers, data: { email: user.email, password: user.password } });
    assert.equal(r.status(), 200, 'Synthetic fixture login failed.');
    const session = await r.json(); assert.equal(session.profile.id, user.id); assert.equal(session.onboardingRequired, false);
  };
  const read = async (context, endpoint) => {
    const r = await context.request.get(api + endpoint); assert.equal(r.status(), 200); return r.json();
  };
  await login(learner, f.learner); await login(owner, f.instructor);
  const payer = await read(learner, '/me/wallet'), recipient = await read(owner, '/me/wallet');
  assert.equal(payer.balance, 20, 'A fresh unspent synthetic learner is required.');
  assert.equal(recipient.balance, 20, 'A fresh synthetic instructor is required.');
  const page = await learner.newPage(), ownerPage = await owner.newPage();
  page.setDefaultTimeout(30000); ownerPage.setDefaultTimeout(30000);
  await page.addInitScript(() => { if (!localStorage.getItem('esham-language')) localStorage.setItem('esham-language', 'en'); });
  await ownerPage.addInitScript(() => { if (!localStorage.getItem('esham-language')) localStorage.setItem('esham-language', 'en'); });
  let intent, enrollmentId, posts = 0;
  await check('real learner purchase, confirmation and double-click prevention', async () => {
    let release; const hold = new Promise(resolve => { release = resolve; });
    await page.route(api + '/me/enrollments', async route => {
      if (route.request().method() === 'POST') { posts++; intent = route.request().postDataJSON(); await hold; }
      return route.continue();
    });
    await page.goto(frontend + '/courses/' + f.courseId);
    await page.getByRole('button', { name: 'Enroll for 20 points', exact: true }).click();
    const confirm = page.getByRole('button', { name: 'Confirm enrollment', exact: true });
    const requested = page.waitForRequest(r => r.url() === api + '/me/enrollments' && r.method() === 'POST');
    const response = page.waitForResponse(r => r.url() === api + '/me/enrollments' && r.request().method() === 'POST');
    await confirm.evaluate(button => { button.click(); button.click(); }); await requested;
    assert.equal(await confirm.isDisabled(), true); release();
    const result = await response; assert.equal(result.status(), 201);
    const body = await result.json(); enrollmentId = body.enrollment.id;
    await page.waitForURL('**/learner/enrollments/*'); assert.equal(posts, 1);
    assert.equal(body.accountId, f.learner.id); assert.equal(body.enrollment.courseVersionId, intent.expectedPublishedVersionId);
    assert.equal(body.enrollment.availableCourseVersionId, intent.expectedPublishedVersionId);
    await page.unroute(api + '/me/enrollments');
  });
  await check('wallet balances, server history and no internal ledger-key exposure', async () => {
    const after = await read(learner, '/me/wallet'), reward = await read(owner, '/me/wallet');
    assert.equal(after.balance, 0); assert.equal(after.spent, 20); assert.equal(reward.balance, 40); assert.equal(reward.earned, 20);
    const history = await read(learner, '/me/wallet/transactions'); assert.equal(history.totalCount, 2);
    assert.equal(history.items.filter(x => x.transactionType === 'welcome').length, 1);
    assert.equal(history.items.filter(x => x.transactionType === 'enrollment' && x.amount === -20).length, 1);
    assert.ok(!JSON.stringify(history).includes('operationKey'));
    await page.goto(frontend + '/learner/points');
    await page.waitForFunction(() => document.querySelector('.wallet-balance strong')?.textContent === '0');
    await page.locator('.wallet-history').getByText(f.courseTitle, { exact: false }).waitFor();
  });
  await check('persisted request replay does not charge or reward twice', async () => {
    const r = await learner.request.post(api + '/me/enrollments', { headers: { ...headers, 'X-Esham-Account-Id': f.learner.id }, data: intent });
    assert.equal(r.status(), 200); const body = await r.json(); assert.equal(body.replayed, true); assert.equal(body.enrollment.id, enrollmentId);
    assert.equal((await read(learner, '/me/wallet')).balance, 0); assert.equal((await read(owner, '/me/wallet')).balance, 40);
  });
  await check('My Courses shows the persisted GUID enrollment', async () => {
    await page.goto(frontend + '/learner/courses');
    await page.locator('a[href="/learner/enrollments/' + enrollmentId + '"]').first().waitFor();
    await page.getByRole('heading', { name: f.courseTitle, exact: true }).waitFor();
  });
  await check('instructor teaching points use the persisted reward', async () => {
    const summary = await read(owner, '/me/wallet/teaching-summary');
    assert.equal(summary.totalEarned, 20); assert.equal(summary.items.find(x => x.courseId === f.courseId).points, 20);
    await ownerPage.goto(frontend + '/instructor/courses');
    const card = ownerPage.locator('article.instructor-course-card').filter({ has: ownerPage.getByRole('heading', { name: f.courseTitle, exact: true }) });
    await card.waitFor();
    await card.locator('.instructor-course-meta > span').nth(2).getByText('20', { exact: true }).waitFor();
  });
  await check('insufficient funds rejects a second course without a transfer', async () => {
    await page.goto(frontend + '/courses/' + f.otherCourseId);
    await page.getByRole('button', { name: 'Enroll for 20 points', exact: true }).click();
    const response = page.waitForResponse(r => r.url() === api + '/me/enrollments' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirm enrollment', exact: true }).click();
    const r = await response; assert.equal(r.status(), 409); assert.equal((await r.json()).code, 'insufficient_balance');
    await page.getByText('You need 20 points to enroll.', { exact: false }).first().waitFor();
    assert.equal((await read(learner, '/me/wallet')).balance, 0); assert.equal((await read(owner, '/me/wallet')).balance, 40);
  });
  await check('account switch discards a delayed previous-account wallet response', async () => {
    await page.goto(frontend + '/learner/points');
    await page.waitForFunction(() => document.querySelector('.wallet-balance strong')?.textContent === '0');
    let ready, release, finished; const captured = new Promise(r => { ready = r; }), hold = new Promise(r => { release = r; }), fulfilled = new Promise(r => { finished = r; });
    let trapped = false;
    await page.route(api + '/me/wallet', async route => {
      if (trapped) return route.continue();
      trapped = true; const response = await route.fetch(); const data = await response.json();
      assert.ok(!response.headers()['set-cookie'], 'Passive wallet reads must not renew cookies');
      assert.equal(data.accountId, f.learner.id); ready(); await hold;
      try {await route.fulfill({ response });} finally {finished();}
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await captured;
    assert.equal((await learner.request.post(api + '/auth/logout', { headers })).status(), 204);
    await login(learner, f.otherLearner); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('esham-account-profile-v1') || '{}').id === id, f.otherLearner.id);
    // A real logout can correctly navigate to Login during the gap. The API login helper
    // does not perform the UI's post-login navigation; preserve the mounted financial store.
    if (new URL(page.url()).pathname === '/login') await page.evaluate(() => {
      history.pushState({}, '', '/learner/points'); window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForFunction(() => document.querySelector('.wallet-balance strong')?.textContent === '20');
    release(); await fulfilled;
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await page.locator('.wallet-balance strong').textContent(), '20');
    assert.ok(!(await page.locator('.wallet-history').textContent()).includes(f.courseTitle));
    await page.unroute(api + '/me/wallet');
  });
  await check('owner isolation and stale-account mutation precondition', async () => {
    assert.equal((await learner.request.get(api + '/me/enrollments/' + enrollmentId)).status(), 404);
    const r = await learner.request.post(api + '/me/enrollments', { headers: { ...headers, 'X-Esham-Account-Id': f.learner.id }, data: intent });
    assert.equal(r.status(), 409); assert.equal((await r.json()).code, 'account_changed');
    assert.equal((await read(learner, '/me/wallet')).balance, 20);
    await page.goto(frontend + '/courses/' + f.selfCourseId);
    await page.getByText('You cannot enroll in your own course.', { exact: true }).waitFor();
  });
  await check('stale publication confirmation rejects without charging', async () => {
    await page.goto(frontend + '/courses/' + f.staleCourseId);
    await page.getByRole('button', { name: 'Enroll for 20 points', exact: true }).waitFor({ state: 'visible' });
    const log = execFileSync('dotnet', ['test', path.join(root, 'backend/esham.Tests/esham.Tests.csproj'), '--no-build',
      ...(process.env.ESHAM_TEST_OUTPUT_PATH?['-p:OutputPath='+process.env.ESHAM_TEST_OUTPUT_PATH]:[]), '--filter', 'FullyQualifiedName~Advance_only_the_synthetic_browser_publication', '--logger', 'console;verbosity=normal'],
      { cwd: root, env: { ...process.env, ESHAM_PHASE1_SETUP: 'publish' }, timeout: 60000, stdio: 'pipe' });
    fs.writeFileSync(path.join(artifacts, 'browser-publication.log'), log);
    await page.getByRole('button', { name: 'Enroll for 20 points', exact: true }).click();
    const response = page.waitForResponse(r => r.url() === api + '/me/enrollments' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirm enrollment', exact: true }).click();
    const r = await response; assert.equal(r.status(), 409); assert.equal((await r.json()).code, 'publication_changed');
    await page.getByText('The course was updated.', { exact: false }).first().waitFor();
    assert.equal((await read(learner, '/me/wallet')).balance, 20); assert.equal((await read(owner, '/me/wallet')).balance, 40);
  });
  await check('expired isolated session clears financial UI and requires sign-in', async () => {
    await page.goto(frontend + '/learner/points');
    await page.waitForFunction(() => document.querySelector('.wallet-balance strong')?.textContent === '20');
    await learner.clearCookies(); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForURL('**/login'); assert.equal(await page.locator('.wallet-balance').count(), 0);
    assert.equal((await learner.request.get(api + '/me/wallet')).status(), 401);
  });
  await login(learner, f.learner);
  for (const language of ['ar', 'en']) for (const width of [390, 1440]) {
    await check('My Courses layout ' + language + ' ' + width, async () => {
      await page.evaluate(lang => localStorage.setItem('esham-language', lang), language);
      await page.setViewportSize({ width, height: 900 }); await page.goto(frontend + '/learner/courses');
      await page.locator('a[href="/learner/enrollments/' + enrollmentId + '"]').first().waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
      await page.screenshot({ path: path.join(artifacts, 'my-courses-' + language + '-' + width + '.png'), fullPage: true });
    });
  }
}
run().then(() => {
  fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify({ passed: checks.length, failed: 0, skipped: 0, checks }, null, 2));
  console.log('Browser verification: ' + checks.length + ' passed, 0 failed, 0 skipped.');
}).catch(error => {
  checks.push({ name: current, status: 'failed' });
  if (artifacts) {
    fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify({ passed: checks.filter(x => x.status === 'passed').length, failed: 1, checks }, null, 2));
    let detail = String(error.stack || error);
    if (fixtures) for (const user of [fixtures.learner, fixtures.otherLearner, fixtures.instructor]) detail = detail.split(user.password).join('[REDACTED]');
    fs.writeFileSync(path.join(artifacts, 'browser-error.log'), detail);
  }
  console.error('FAIL: ' + current + '. See private redacted verification artifacts.'); process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });
