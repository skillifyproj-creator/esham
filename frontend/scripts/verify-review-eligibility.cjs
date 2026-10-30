const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.addInitScript(() => localStorage.setItem('esham-language', 'ar'));
  const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  const course = 'd95a3d7a-7a6d-407a-8b29-d68684bb349e', section = 'd74b5714-3135-43f3-b5f0-401312fb4a2a', lesson = 'c5e34da0-71a2-41d1-a239-8766b5f0798a';
  const primaryId = '5d99a8ae-141b-4ad3-893c-3b31b28e725e';
  const root = `/api/courses/${course}`, media = `${root}/draft/sections/${section}/lessons/${lesson}/media`;
  async function api(url, method = 'GET') {
    const response = await context.request.fetch(`http://localhost:5206${url}`, { method, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    assert(response.ok(), `${response.status()}: ${await response.text()}`); return response.json();
  }
  try {
    await page.goto('http://localhost:5173/login'); await page.locator('[name=email]').fill(process.env.ESHAM_TEST_EMAIL);
    await page.locator('[name=password]').fill(process.env.ESHAM_TEST_PASSWORD); await page.locator('button[type=submit]').click();
    await page.waitForURL(url => ['/learner', '/instructor'].includes(url.pathname));
    const before = await api(media); assert.equal(before.find(x => x.isPrimary)?.mediaAssetId, primaryId);
    if (before.length > 1) {
      assert.equal(before.length, 3, 'Unexpected legacy state: do not guess which relationships to normalize');
      assert.deepEqual(before.map(x => x.mediaAssetId).sort(), [primaryId, '2602ef5c-6e36-4bfb-aaf0-010ce3027462', '271bbddd-d078-46bc-b72e-d019b85251aa'].sort());
      fs.writeFileSync(path.join(os.tmpdir(), 'esham-legacy-video-before.json'), JSON.stringify(before, null, 2));
      const normalized = await api(`${media}/normalize`, 'POST'); assert.equal(normalized.length, 1); assert.equal(normalized[0].mediaAssetId, primaryId);
    }
    const after = await api(media); assert.equal(after.length, 1); assert.equal(after[0].mediaAssetId, primaryId);
    const eligibility = await api(`${root}/draft/submission-eligibility`);
    assert.equal(eligibility.taskCount, 1); assert.equal(eligibility.readyTaskCount, 1);
    assert.deepEqual(eligibility.checks.filter(x => !x.isMet).map(x => x.code), ['cover', 'objectives']);
    assert.equal(eligibility.reviewStatus, 'draft'); assert.equal(eligibility.submissionImplemented, false); assert.equal(eligibility.canSubmit, false);
    const content = await api(`${root}/draft/sections/readiness`); assert.equal(content.percentage, 100);
    await page.goto(`http://localhost:5173/instructor/courses/${course}/curriculum`);
    await page.locator('[data-eligibility-check=cover][data-met=false]').waitFor();
    assert.equal(await page.locator('[data-eligibility-check=task-readiness][data-met=true]').count(), 1);
    await page.reload(); await page.locator('[data-eligibility-check=objectives][data-met=false]').waitFor();
    await page.goto(`http://localhost:5173/instructor/courses/${course}/review`);
    await page.locator('[data-submission-unavailable]').waitFor();
    assert(await page.getByRole('button', { name: 'متابعة الإرسال', exact: true }).isDisabled());
    assert.equal(await page.getByText('رفع صورة لتنفيذ العمل', { exact: true }).count(), 1);
    await page.screenshot({ path: path.join(os.tmpdir(), 'esham-review-eligibility.png'), fullPage: true });
    await page.reload(); await page.locator('[data-eligibility-check=cover][data-met=false]').waitFor();
    await page.goto(`http://localhost:5173/instructor/courses/${course}/sections/${section}/lessons/${lesson}/edit`);
    await page.getByRole('button', { name: 'استبدال الفيديو', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'إضافة فيديو', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'إزالة الفيديو', exact: true }).count(), 1);
    await page.reload(); await page.getByRole('button', { name: 'استبدال الفيديو', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', legacyBefore: before.length, attachedAfter: after.length, primaryUnchanged: true,
      curriculum: content.percentage, readyTasks: eligibility.readyTaskCount, blockers: ['cover', 'objectives'],
      submissionImplemented: false, refreshConsistent: true }));
  } catch (error) { console.error('Browser route:', page.url()); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
