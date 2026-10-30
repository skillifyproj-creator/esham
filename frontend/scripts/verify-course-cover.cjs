const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.addInitScript(() => localStorage.setItem('esham-language', 'ar'));
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const courseId = process.env.ESHAM_TEST_COURSE_ID; assert(courseId && process.env.ESHAM_TEST_EMAIL && process.env.ESHAM_TEST_PASSWORD);
  const root = `/api/courses/${courseId}`, base = `http://localhost:5173/instructor/courses/${courseId}`;
  const manifestPath = path.join(os.tmpdir(), 'esham-cover-verification.json');
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const get = async suffix => {
    const response = await context.request.get(`http://localhost:5206${root}${suffix}`);
    assert(response.ok(), `${response.status()}: ${await response.text()}`); const body = await response.text(); return body ? JSON.parse(body) : null;
  };
  const metadata = detail => {
    const { coverMediaAssetId, updatedAt, ...draft } = detail.draft;
    return { draft, draftVersionId: detail.draftVersionId, publishedVersionId: detail.publishedVersionId,
      safetyStatus: detail.safetyStatus, enrollmentPaused: detail.enrollmentPaused, owner: detail.owner };
  };
  try {
    await page.goto('http://localhost:5173/login'); await page.locator('[name=email]').fill(process.env.ESHAM_TEST_EMAIL);
    await page.locator('[name=password]').fill(process.env.ESHAM_TEST_PASSWORD); await page.locator('button[type=submit]').click();
    await page.waitForURL(url => ['/learner', '/instructor'].includes(url.pathname));
    const before = await get('');
    const beforeEligibility = await get('/draft/submission-eligibility');
    assert.equal(before.draft.reviewStatus, 'draft');
    let savedCover = await get('/draft/cover');
    if (savedCover) assert.equal(savedCover.fileName, 'cpp-verification-cover.png', 'Do not overwrite an unexpected real cover');
    await page.goto(`${base}/edit`); await page.locator('.create-cover-layout').waitFor();
    if (!savedCover) {
      const encoded = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#4b3038'; ctx.fillRect(0, 0, 1280, 720);
        ctx.fillStyle = '#d7b7a2'; ctx.fillRect(80, 100, 10, 500); ctx.fillStyle = '#fff9f3';
        ctx.font = 'bold 108px sans-serif'; ctx.fillText('C++ Basics', 140, 300);
        ctx.font = 'bold 36px sans-serif'; ctx.fillText('VERIFICATION COVER', 145, 420);
        ctx.font = '28px sans-serif'; ctx.fillText('Esham - replace this test cover anytime', 145, 480);
        return canvas.toDataURL('image/png').split(',')[1];
      });
      const bytes = Buffer.from(encoded, 'base64');
      fs.writeFileSync(path.join(os.tmpdir(), 'cpp-verification-cover.png'), bytes);
      await page.locator('.create-upload-box input[type=file]').setInputFiles({ name: 'cpp-verification-cover.png', mimeType: 'image/png', buffer: bytes });
      await page.waitForFunction(() => document.querySelector('.create-cover-preview img')?.src.startsWith('blob:'));
      const uploadResponse = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`${root}/draft/cover`));
      const patchResponse = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`${root}/draft`));
      await page.locator('.instructor-create-primary-button').first().click();
      const upload = await uploadResponse; assert(upload.ok(), `${upload.status()}: ${await upload.text()}`); savedCover = await upload.json();
      const patch = await patchResponse; assert(patch.ok(), `${patch.status()}: ${await patch.text()}`);
      assert.deepEqual(patch.request().postDataJSON(), { coverMediaAssetId: savedCover.mediaAssetId }, 'Cover-only save must not rewrite metadata');
      fs.writeFileSync(manifestPath, JSON.stringify({ courseId, beforeMetadata: metadata(before), cover: savedCover, hash: crypto.createHash('sha256').update(bytes).digest('hex') }, null, 2));
      await page.waitForURL('**/curriculum');
    }
    const after = await get(''); assert.equal(after.draft.coverMediaAssetId, savedCover.mediaAssetId);
    assert.deepEqual(metadata(after), metadata(before), 'Unrelated real course metadata must remain unchanged');
    const eligibility = await get('/draft/submission-eligibility'); assert.equal(eligibility.checks.find(check => check.code === 'cover').isMet, true);
    assert.deepEqual(eligibility.checks.filter(check => check.code !== 'cover'), beforeEligibility.checks.filter(check => check.code !== 'cover'), 'Other eligibility checks must retain their live baseline state');
    const bytesResponse = await context.request.get(`http://localhost:5206${savedCover.contentUrl}`);
    assert(bytesResponse.ok()); assert(bytesResponse.headers()['content-type'].startsWith('image/png'));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.deepEqual(metadata(after), manifest.beforeMetadata, 'Metadata must also match the original pre-upload snapshot');
    assert.equal(crypto.createHash('sha256').update(await bytesResponse.body()).digest('hex'), manifest.hash);
    // Stable retry must not create another asset.
    const retry = await context.request.put(`http://localhost:5206${root}/draft/cover`, { data: await bytesResponse.body(), headers: {
      'Content-Type': 'image/png', 'X-Requested-With': 'XMLHttpRequest', 'X-Upload-Id': savedCover.mediaAssetId, 'X-File-Name': 'cpp-verification-cover.png' } });
    assert(retry.ok(), await retry.text()); assert.equal((await retry.json()).mediaAssetId, savedCover.mediaAssetId);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('esham-language', 'ar'); });
    await page.goto(`${base}/edit`); await page.locator('.create-cover-preview img').waitFor();
    await page.waitForFunction(() => { const image = document.querySelector('.create-cover-preview img'); return image?.complete && image.naturalWidth === 1280; });
    assert((await page.locator('.create-cover-preview img').getAttribute('src')).includes(`/draft/cover/${savedCover.mediaAssetId}/content`));
    await page.reload(); await page.waitForFunction(() => document.querySelector('.create-cover-preview img')?.naturalWidth === 1280);
    await page.screenshot({ path: path.join(os.tmpdir(), 'esham-cover-persisted.png'), fullPage: true });
    await page.goto(`${base}/review`); await page.locator('[data-eligibility-check=cover][data-met=true]').waitFor();
    await page.waitForFunction(() => document.querySelector('.instructor-course-preview-cover img')?.naturalWidth === 1280);
    await page.reload(); await page.locator('[data-eligibility-check=cover][data-met=true]').waitFor();
    assert.deepEqual(metadata(await get('')), metadata(before));
    const anonymous = await browser.newContext(); assert.equal((await anonymous.request.get(`http://localhost:5206${savedCover.contentUrl}`)).status(), 401); await anonymous.close();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', courseId, courseVersionId: savedCover.courseVersionId, coverMediaAssetId: savedCover.mediaAssetId,
      upload: 'real PNG bytes', patch: 'cover only', refresh: 'persistent', reopen: 'persistent', eligibilityCover: true, unrelatedMetadata: 'unchanged', retry: 'same asset' }));
  } catch (error) { console.error('Browser route:', page.url()); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
