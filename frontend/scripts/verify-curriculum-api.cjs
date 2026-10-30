// Same environment variables as verify-curriculum.cjs. Leaves existing content intact.
const { request } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const api = await request.newContext({ baseURL: process.env.ESHAM_TEST_API || 'http://localhost:5206' });
  const course = process.env.ESHAM_TEST_COURSE_ID;
  const root = `/api/courses/${course}/draft/sections`;
  const created = [];
  async function call(path, method = 'GET', data, status = 200) {
    const response = await api.fetch(path, { method, data });
    assert.equal(response.status(), status, `${method} ${path}: ${await response.text()}`);
    return response.json();
  }
  try {
    await call('/auth/login', 'POST', { email: process.env.ESHAM_TEST_EMAIL, password: process.env.ESHAM_TEST_PASSWORD });
    const before = await call(root);
    for (let i = 0; i < 2; i++) created.push(await call(root, 'POST', { titleEn: `API verification ${i}`, sortOrder: before.length + i }, 201));
    const section = created[0].id;
    const lessons = [];
    for (let i = 0; i < 2; i++) lessons.push(await call(`${root}/${section}/lessons`, 'POST', { titleEn: `Lesson ${i}`, sortOrder: i, contentType: 'article' }, 201));
    await call(`${root}/${section}`, 'PUT', { titleAr: 'قسم', titleEn: 'Edited section', sortOrder: before.length });
    await Promise.all(created.map((item, index) => call(`${root}/${item.id}`, 'PUT', {
      titleAr: index === 0 ? 'قسم' : null, titleEn: index === 0 ? 'Edited section' : 'Concurrent edit', sortOrder: before.length + index,
    })));
    await call(`${root}/${section}/lessons/${lessons[0].id}`, 'PUT', { titleEn: 'Edited lesson', sortOrder: 0, contentType: 'article', descriptionEn: 'Persisted API article', objectives: [{ en: 'Learn' }] });
    await call(`${root}/${section}/lessons/reorder`, 'PUT', { ids: [lessons[1].id, lessons[0].id] });
    await call(`${root}/reorder`, 'PUT', { ids: [...before.map(x => x.id), created[1].id, section] });
    const fresh = await call(root);
    assert.equal(fresh.at(-1).id, section);
    assert.equal(fresh.at(-1).lessons[1].titleEn, 'Edited lesson');
    assert.equal(fresh.at(-1).lessons[1].descriptionEn, 'Persisted API article');
    await call(`${root}/${section}`, 'DELETE', undefined, 409);
    await call(`${root}/${created[1].id}/lessons/${lessons[0].id}`, 'DELETE', undefined, 404);
    await call(`${root}/${section}/lessons/reorder`, 'PUT', { ids: [lessons[0].id, lessons[0].id] }, 400);
    await call(root, 'POST', { titleEn: ' ', sortOrder: -1 }, 400);
    const anonymous = await request.newContext();
    assert.equal((await anonymous.get(`${process.env.ESHAM_TEST_API || 'http://localhost:5206'}${root}`)).status(), 401);
    await anonymous.dispose();
    console.log('PASS: real SQL Server API create, read, edit, reorder, fresh read, validation, section/lesson boundary and safe-delete behavior; anonymous access rejected.');
    // Restore original order values, including any gaps.
    for (const item of before) await call(`${root}/${item.id}`, 'PUT', { titleAr: item.titleAr, titleEn: item.titleEn, sortOrder: item.sortOrder });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally {
    for (const section of created) {
      try {
        for (const lesson of await call(`${root}/${section.id}/lessons`)) await call(`${root}/${section.id}/lessons/${lesson.id}`, 'DELETE');
        await call(`${root}/${section.id}`, 'DELETE');
      } catch (error) { console.error(`Test cleanup failed: ${error.message}`); process.exitCode = 1; }
    }
    await api.dispose();
  }
})();
