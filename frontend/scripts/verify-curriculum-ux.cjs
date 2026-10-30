const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.addInitScript(() => localStorage.setItem('esham-language', 'ar'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const request = async (url, method = 'GET', data) => {
    const response = await context.request.fetch(`http://localhost:5206${url}`, { method, data });
    assert(response.ok(), `${method} ${url}: ${response.status()} ${await response.text()}`);
    return response.json();
  };
  try {
    await page.goto('http://localhost:5173/login');
    await page.locator('[name=email]').fill(process.env.ESHAM_TEST_EMAIL);
    await page.locator('[name=password]').fill(process.env.ESHAM_TEST_PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/instructor');
    const categories = await request('/api/categories');
    const course = await request('/api/courses', 'POST', { categoryId: categories[0].id,
      titleAr: 'اختبار مؤقت لتجربة المنهج', titleEn: 'Temporary curriculum UX verification',
      descriptionAr: 'دورة تحقق مؤقتة', descriptionEn: 'Temporary verification course', objectives: [], language: 'ar', level: 'beginner' });
    fs.writeFileSync(path.join(os.tmpdir(), 'esham-curriculum-ux-cleanup.json'), JSON.stringify({ courseId: course.courseId, ownerId: course.owner.id, titleEn: course.draft.titleEn }));
    const root = `/api/courses/${course.courseId}/draft/sections`;
    const curriculum = `http://localhost:5173/instructor/courses/${course.courseId}/curriculum`;
    assert.equal((await request(root)).length, 0);
    // Concurrent initializers must serialize at the course lock.
    const initialized = await Promise.all(Array.from({ length: 4 }, () => request(`${root}/ensure-default`, 'POST')));
    assert(initialized.every(items => items.length === 1 && items[0].id === initialized[0][0].id));
    await page.goto(curriculum);
    await page.locator('.curriculum-title-button').waitFor();
    assert.equal(await page.locator('.curriculum-section-card:not(.course-tasks-panel)').count(), 1);
    let dialogs = 0;
    page.on('dialog', async dialog => { dialogs++; await dialog.accept(); });
    await page.locator('.curriculum-title-button').click();
    await page.getByRole('textbox', { name: 'عنوان القسم' }).fill('قسم محفوظ من المتصفح');
    await page.locator('.curriculum-inline-title').getByRole('button', { name: 'حفظ', exact: true }).click();
    await page.getByRole('button', { name: 'قسم محفوظ من المتصفح', exact: true }).waitFor();
    assert.equal(dialogs, 0, 'Section rename must never open a dialog');
    await page.reload();
    await page.getByRole('button', { name: 'قسم محفوظ من المتصفح', exact: true }).waitFor();
    assert.equal((await request(root)).length, 1);
    const section = (await request(root))[0];
    await page.locator('.curriculum-section-footer button').first().click();
    await page.locator('.instructor-edit-lesson-field input[type=text]').fill('درس محفوظ من المتصفح');
    await page.locator('.instructor-edit-lesson-field textarea').first().fill('وصف ومحتوى مقال محفوظان في قاعدة البيانات للاختبار.');
    await page.locator('.instructor-add-objective input').fill('هدف تعليمي محفوظ');
    await page.locator('.instructor-add-objective button').click();
    await page.locator('input[value=video]').check();
    await page.locator('.lesson-video-editor').waitFor();
    assert.equal(await page.locator('.lesson-article-editor').count(), 0);
    await page.locator('input[value=article]').check();
    await page.locator('.lesson-article-editor').waitFor();
    assert.equal(await page.locator('.lesson-video-editor').count(), 0);
    assert.equal(dialogs, 1, 'Switching populated content requires confirmation');
    await page.locator('.lesson-article-editor textarea').fill('نص المقال النهائي محفوظ دون تغيير نموذج قاعدة البيانات.');
    await page.screenshot({ path: path.join(os.tmpdir(), 'esham-lesson-ux-rtl.png'), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Laptop editor overflow');
    await page.locator('.instructor-edit-lesson-header-actions button').last().click();
    await page.waitForURL('**/curriculum');
    const lessons = await request(`${root}/${section.id}/lessons`);
    const lesson = lessons[0];
    assert.equal(lesson.contentType, 'article');
    assert.equal(lesson.titleAr, 'درس محفوظ من المتصفح');
    assert.equal(lesson.descriptionAr, 'نص المقال النهائي محفوظ دون تغيير نموذج قاعدة البيانات.');
    assert.equal(lesson.objectives[0].ar, 'هدف تعليمي محفوظ');
    await page.reload();
    await page.getByText('درس محفوظ من المتصفح', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(os.tmpdir(), 'esham-curriculum-ux-rtl.png'), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Laptop curriculum overflow');
    await page.goto(`http://localhost:5173/instructor/courses/${course.courseId}/sections/${section.id}/lessons/${lesson.id}/edit`);
    await page.locator('.lesson-article-editor textarea').waitFor();
    assert.equal(await page.locator('.lesson-article-editor textarea').inputValue(), lesson.descriptionAr);
    assert(await page.locator('input[value=article]').isChecked());
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 800 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Editor overflow at ${width}`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: real login; new draft; concurrent default initialization; inline rename without popup; refresh; lesson metadata/objectives; explicit Video/Article; safe switching; article persistence; Arabic laptop/mobile overflow checks.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
