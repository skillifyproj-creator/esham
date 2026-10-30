import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPublicCatalog, loadPublicCourse, mapPublicCourse } from '../src/services/publicCatalog.js';
const row = { courseId: 'real-course-guid', publishedVersionId: 'approved-version', categoryId: 'category-guid',
  titleAr: 'دورة حقيقية', titleEn: 'Real course', descriptionEn: 'Published metadata', categoryNameAr: 'تصميم', categoryNameEn: 'Design',
  language: 'ar', level: 'beginner', createdAt: '2026-10-30T00:00:00Z', instructor: { id: 'owner', name: 'مدرّب', nameEn: 'Instructor' } };
test('public cards retain real IDs/category labels without fabricating ratings, media URLs or counts', () => {
  const course = mapPublicCourse(row);
  assert.equal(course.id, row.courseId); assert.equal(course.category, row.categoryId); assert.equal(course.source, 'backend');
  assert.equal(course.categoryTitle.en, 'Design'); assert.equal(course.instructorId, 'owner');
  assert.equal(course.rating, null); assert.equal(course.lessons, null); assert.equal(course.image, null);
});
test('public list/detail requests use the real API and never fall back to static courses on empty/error responses', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(options.credentials, 'include'); assert.equal(options.method, 'GET');
      assert.equal(url, '/api/courses/public'); return new Response(JSON.stringify([row]), { status: 200 });
    };
    assert.deepEqual((await loadPublicCatalog()).map(x => x.id), ['real-course-guid']);
    globalThis.fetch = async () => new Response('[]', { status: 200 }); assert.deepEqual(await loadPublicCatalog(), []);
    globalThis.fetch = async () => new Response(JSON.stringify({ title: 'Catalog unavailable' }), { status: 503 });
    await assert.rejects(loadPublicCatalog(), /Catalog unavailable/);
    globalThis.fetch = async url => { assert.equal(url, '/api/courses/public/real-course-guid'); return new Response(JSON.stringify({ ...row, objectives: [{ en: 'Published goal' }] }), { status: 200 }); };
    assert.equal((await loadPublicCourse('real-course-guid')).objectives[0].en, 'Published goal');
  } finally { globalThis.fetch = original; }
});
