const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.addInitScript(() => localStorage.setItem('esham-language', 'en'));
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const errors = []; const mediaIds = new Set(); let manifest;
  const manifestPath = path.join(os.tmpdir(), 'esham-video-verification.json');
  const saveManifest = () => fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, mediaIds: [...mediaIds] }));
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', async response => {
    if (response.request().method() === 'POST' && /\/lessons\/[^/]+\/media$/.test(response.url()) && response.ok()) {
      const result = await response.json(); mediaIds.add(result.mediaAssetId); saveManifest();
    }
  });
  const api = async (url, method = 'GET', data) => {
    const response = await context.request.fetch(`http://localhost:5206${url}`, { method, data, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    assert(response.ok(), `${method} ${url}: ${response.status()} ${await response.text()}`); return response.json();
  };
  try {
    await page.goto('http://localhost:5173/login');
    await page.locator('[name=email]').fill(process.env.ESHAM_TEST_EMAIL);
    await page.locator('[name=password]').fill(process.env.ESHAM_TEST_PASSWORD);
    await page.locator('button[type=submit]').click(); await page.waitForURL('**/instructor');
    const categories = await api('/api/categories');
    const course = await api('/api/courses', 'POST', { categoryId: categories[0].id, titleEn: 'Temporary video integration verification',
      titleAr: 'اختبار فيديو مؤقت', descriptionEn: 'Temporary verification only', descriptionAr: 'اختبار مؤقت', objectives: [], language: 'en', level: 'beginner' });
    manifest = { courseId: course.courseId, ownerId: course.owner.id, titleEn: course.draft.titleEn }; saveManifest();
    const root = `/api/courses/${course.courseId}/draft/sections`;
    const section = (await api(`${root}/ensure-default`, 'POST'))[0];
    // Create the new lesson through the real editor: Add Video must first persist its form.
    await page.goto(`http://localhost:5173/instructor/courses/${course.courseId}/sections/${section.id}/lessons/new`);
    await page.locator('.instructor-edit-lesson-field input[type=text]').fill('Browser video persistence lesson');
    await page.locator('.instructor-edit-lesson-field textarea').first().fill('Video persisted using the existing creation environment.');
    await page.locator('input[value=video]').check();
    assert.equal(await page.locator('.lesson-video-editor input').count(), 0, 'No manual GUID field');
    const createdLesson = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/sections/${section.id}/lessons`));
    await page.getByRole('button', { name: 'Add Video', exact: true }).click();
    const lesson = await (await createdLesson).json(); manifest.lessonId = lesson.id; saveManifest();
    const videoRoute = `/instructor/courses/${course.courseId}/sections/${section.id}/lessons/${lesson.id}/video`;
    await page.waitForURL(`**${videoRoute}`); await page.locator('.video-options').waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Choose video', exact: true }).count(), 1);
    assert.equal(await page.getByRole('heading', { name: 'Record a new video', exact: true }).count(), 1);
    await page.screenshot({ path: path.join(os.tmpdir(), 'esham-video-source-unchanged.png'), fullPage: true });
    // Generate actual playable WebM bytes with the browser's MediaRecorder.
    const video = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d'); const stream = canvas.captureStream(15);
      const chunks = []; const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      const done = new Promise(resolve => { recorder.ondataavailable = event => chunks.push(event.data); recorder.onstop = resolve; });
      const tick = setInterval(() => { ctx.fillStyle = '#4b3038'; ctx.fillRect(0, 0, 320, 180); ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif'; ctx.fillText('Esham video test', 30, 90); }, 60);
      recorder.start(100); await new Promise(resolve => setTimeout(resolve, 2200)); recorder.stop(); await done;
      clearInterval(tick); stream.getTracks().forEach(track => track.stop());
      const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
      return Array.from(bytes);
    });
    await page.getByLabel('Choose video', { exact: true }).setInputFiles({ name: 'integration-video.webm', mimeType: 'video/webm', buffer: Buffer.from(video) });
    await page.waitForURL(`**${videoRoute}/preview`); await page.locator('video.video-player').waitFor();
    await page.getByRole('button', { name: 'Edit and save video', exact: true }).click();
    await page.waitForURL(`**${videoRoute}/edit`);
    // Exercise real trimming as well as source preservation.
    await page.getByLabel('End in seconds', { exact: true }).fill('1.2');
    const savedMedia = page.waitForResponse(response => response.request().method() === 'POST' && /\/media$/.test(response.url()));
    await page.getByRole('button', { name: 'Save video to lesson', exact: true }).click();
    const firstSave = await savedMedia; assert(firstSave.ok(), `${firstSave.status()} ${await firstSave.text()}`);
    await page.waitForURL(`**/lessons/${lesson.id}/edit`, { timeout: 90000 });
    await page.locator('.lesson-video-editor video').waitFor();
    const mediaPath = `${root}/${section.id}/lessons/${lesson.id}/media`;
    const attachments = await api(mediaPath);
    attachments.forEach(item => mediaIds.add(item.mediaAssetId)); saveManifest();
    assert.equal(attachments.length, 1, 'Only the derived video relationship remains; original MediaAsset is preserved');
    let primary = attachments.find(item => item.isPrimary);
    assert(primary.sourceMediaAssetId); assert.equal(primary.screeningStatus, 'pending');
    // Retried identical bytes cannot duplicate assets or relationships.
    const uploaded = await context.request.get(`http://localhost:5206${primary.contentUrl}`);
    const retry = await context.request.post(`http://localhost:5206${mediaPath}`, { data: await uploaded.body(), headers: {
      'Content-Type': primary.contentType, 'X-Requested-With': 'XMLHttpRequest', 'X-Upload-Id': primary.mediaAssetId,
      'X-File-Name': encodeURIComponent(primary.fileName), 'X-Video-Duration': String(primary.durationSeconds), 'X-Source-Media-Id': primary.sourceMediaAssetId,
    } });
    assert(retry.ok(), await retry.text()); assert.equal((await retry.json()).attachmentId, primary.attachmentId);
    assert.equal((await api(mediaPath)).length, 1);
    const second = await context.request.post(`http://localhost:5206${mediaPath}`, { data: Buffer.from(video), headers: {
      'Content-Type': 'video/webm', 'X-Requested-With': 'XMLHttpRequest', 'X-Upload-Id': require('node:crypto').randomUUID(),
      'X-File-Name': 'second-video.webm', 'X-Video-Duration': '2.2',
    } });
    assert.equal(second.status(), 409, 'A second parallel video must be rejected');
    const range = await context.request.get(`http://localhost:5206${primary.contentUrl}`, { headers: { Range: 'bytes=0-15' } });
    assert.equal(range.status(), 206); assert.equal((await range.body()).length, 16);
    const anonymous = await browser.newContext();
    assert.equal((await anonymous.request.get(`http://localhost:5206${primary.contentUrl}`)).status(), 401); await anonymous.close();
    await page.evaluate(async () => {
      localStorage.clear(); localStorage.setItem('esham-language', 'en');
      await new Promise((resolve, reject) => { const deletion = indexedDB.deleteDatabase('esham-media-v1'); deletion.onsuccess = resolve; deletion.onerror = reject; });
    });
    await page.reload(); await page.locator('.lesson-video-editor video').waitFor();
    await page.waitForFunction(() => document.querySelector('.lesson-video-editor video')?.readyState >= 1);
    assert.equal(await page.getByRole('button', { name: 'Add Video', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Replace Video', exact: true }).click();
    await page.waitForURL(`**${videoRoute}`); await page.locator('.video-options').waitFor();
    await page.goto(`http://localhost:5173${videoRoute}/preview`);
    await page.locator('video.video-player').waitFor();
    await page.waitForFunction(() => document.querySelector('video.video-player')?.readyState >= 1);
    await page.reload(); await page.locator('video.video-player').waitFor();
    await page.waitForFunction(() => document.querySelector('video.video-player')?.readyState >= 1);
    await page.goto(`http://localhost:5173/instructor/courses/${course.courseId}/sections/${section.id}/lessons/${lesson.id}/edit`);
    await page.getByRole('button', { name: 'Replace Video', exact: true }).click();
    await page.waitForURL(`**${videoRoute}`); await page.locator('.video-options').waitFor();
    await page.getByLabel('Choose video', { exact: true }).setInputFiles({ name: 'replacement-video.webm', mimeType: 'video/webm', buffer: Buffer.from(video) });
    await page.waitForURL(`**${videoRoute}/preview`); await page.getByRole('button', { name: 'Edit and save video', exact: true }).click();
    await page.getByRole('button', { name: 'Save video to lesson', exact: true }).click();
    await page.waitForURL(`**/lessons/${lesson.id}/edit`, { timeout: 90000 });
    await page.getByRole('button', { name: 'Replace Video', exact: true }).waitFor();
    const replacement = await api(mediaPath); assert.equal(replacement.length, 1); assert.notEqual(replacement[0].mediaAssetId, primary.mediaAssetId);
    primary = replacement[0]; mediaIds.add(primary.mediaAssetId); saveManifest();
    // Detach only the relationship. Its original source must remain available.
    await page.goto(`http://localhost:5173/instructor/courses/${course.courseId}/sections/${section.id}/lessons/${lesson.id}/edit`);
    await page.locator('.lesson-video-editor video').waitFor();
    page.once('dialog', dialog => dialog.accept());
    const removed = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().endsWith(`/media/${primary.attachmentId}`));
    await page.locator('.instructor-resource-item').filter({ hasText: primary.fileName }).getByRole('button', { name: 'Remove Video', exact: true }).click();
    assert((await removed).ok());
    await page.reload(); await page.locator('.lesson-video-editor').waitFor();
    assert.equal(await page.locator('.lesson-video-editor video').count(), 0);
    const remaining = await api(mediaPath); assert.equal(remaining.length, 0);
    assert.equal((await context.request.get(`http://localhost:5206${primary.contentUrl}`)).status(), 404);
    await page.getByRole('button', { name: 'Add Video', exact: true }).click();
    await page.waitForURL(`**${videoRoute}`); await page.locator('.video-options').waitFor();
    await page.getByLabel('Choose video', { exact: true }).setInputFiles({ name: 'after-remove.webm', mimeType: 'video/webm', buffer: Buffer.from(video) });
    await page.waitForURL(`**${videoRoute}/preview`); await page.getByRole('button', { name: 'Edit and save video', exact: true }).click();
    await page.getByRole('button', { name: 'Save video to lesson', exact: true }).click();
    await page.waitForURL(`**/lessons/${lesson.id}/edit`, { timeout: 90000 }); await page.getByRole('button', { name: 'Replace Video', exact: true }).waitFor();
    await page.reload(); await page.getByRole('button', { name: 'Replace Video', exact: true }).waitFor();
    assert.equal((await api(mediaPath)).length, 1);
    assert.deepEqual(errors, []);
    console.log('PASS: first Add Video, second video rejected, source-preserving trim, explicit Replace Video, Remove Video, Remove then Add, one relationship after refresh, idempotent retry, protected playback, cleared-cache persistence and unchanged video tools.');
  } catch (error) {
    await page.screenshot({ path: path.join(os.tmpdir(), 'esham-video-verification-failure.png'), fullPage: true }).catch(() => {});
    console.error('Browser route:', page.url()); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
