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

test('published details map actual cover and a safe outline without protected files or task bodies', () => {
 const course=mapPublicCourse({...row,coverMedia:{id:'cover'},taskCount:2,ratingCount:3,averageRating:4.5,sections:[{id:'section',titleEn:'Published section',lessons:[{id:'lesson',titleEn:'Published lesson',contentType:'video',durationSeconds:120,storageKey:'PRIVATE',videoUrl:'PRIVATE',descriptionEn:'PRIVATE'}]}]});
 assert.equal(course.image,'/api/courses/public/'+row.courseId+'/cover?version='+row.publishedVersionId);
 assert.equal(course.curriculum[0].lessons[0].title.en,'Published lesson');assert.equal(course.lessons,1);assert.equal(course.rating,4.5);assert.equal(course.taskCount,2);
 assert.ok(!JSON.stringify(course).includes('PRIVATE'));
});

test('browser test guard rejects shared targets before making requests', async () => {
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const guard=require('../scripts/require-isolated-test-target.cjs');const old=process.env.ESHAM_TEST_API;
 try{process.env.ESHAM_TEST_API='http://localhost:5206';assert.throws(()=>guard(),/Shared targets are forbidden/)}
 finally{if(old===undefined)delete process.env.ESHAM_TEST_API;else process.env.ESHAM_TEST_API=old}
});
