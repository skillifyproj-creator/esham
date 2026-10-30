import test from 'node:test';
import assert from 'node:assert/strict';
import { courseRequest, curriculumPath, mapCourse, mapSection, loadCurriculumReadiness, previewLessonReadiness } from '../src/services/curriculumApi.js';
import { loadSubmissionEligibility } from '../src/services/submissionEligibility.js';
import { uploadCourseCover, changedCourseDraftFields } from '../src/services/courseCoverApi.js';

test('curriculum adapter retains database IDs, localization, order and lesson metadata', () => {
  const section = mapSection({ id: 'section', courseVersionId: 'draft', sortOrder: 2, titleAr: 'قسم', titleEn: 'Section',
    lessons: [{ id: 'lesson', courseSectionId: 'section', titleEn: 'Lesson', descriptionAr: 'وصف', sortOrder: 3,
      durationSeconds: 90, contentType: 'article', objectives: [{ ar: 'هدف', en: 'Goal' }], isPreview: true }] });
  assert.equal(section.id, 'section'); assert.equal(section.courseVersionId, 'draft');
  assert.equal(section.lessons[0].minutes, 1.5); assert.equal(section.lessons[0].sortOrder, 3);
  assert.equal(section.lessons[0].description.ar, 'وصف'); assert.equal(section.lessons[0].objectives[0].en, 'Goal');
  assert.equal(section.lessons[0].isPreview, true);
  assert.equal(mapCourse({ courseId: 'course', owner: { name: 'Teacher' }, draft: { titleEn: 'Draft' } }).instructor.en, 'Teacher');
});
test('curriculum requests send cookies, exact course ID and reorder payload; propagate validation/conflict details', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/courses/real-course/draft/sections/reorder');
      assert.equal(options.credentials, 'include'); assert.equal(options.method, 'PUT');
      assert.deepEqual(JSON.parse(options.body), { ids: ['second', 'first'] });
      return new Response('true', { status: 200 });
    };
    assert.equal(await courseRequest(`${curriculumPath('real-course')}/reorder`, { ids: ['second', 'first'] }, 'PUT'), true);
    globalThis.fetch = async () => new Response(JSON.stringify({ errors: { request: ['Provide a title.'] } }), { status: 400 });
    await assert.rejects(courseRequest('/courses/id/draft/sections'), /Provide a title/);
    globalThis.fetch = async () => new Response(JSON.stringify({ title: 'Lesson has dependent records.' }), { status: 409 });
    await assert.rejects(courseRequest('/courses/id/draft/sections'), /dependent records/);
  } finally { globalThis.fetch = original; }
});

test('default-section initialization uses a credentialed POST and retains the existing section identity', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/courses/owned-course/draft/sections/ensure-default');
      assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'include');
      return Response.json([{ id: 'existing-section', titleEn: 'Renamed', lessons: [] }]);
    };
    const sections = await courseRequest(`${curriculumPath('owned-course')}/ensure-default`, undefined, 'POST');
    assert.equal(mapSection(sections[0]).id, 'existing-section');
    assert.equal(mapSection(sections[0]).title.en, 'Renamed');
  } finally { globalThis.fetch = original; }
});

test('persisted readiness and unsaved preview use the same backend contract without browser-local media or status flags', async () => {
  const original = globalThis.fetch;
  const ready = { titleComplete: true, contentReady: true, objectivesComplete: true, durationSet: true, percentage: 100, isReady: true };
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(options.credentials, 'include');
      if (options.method === 'POST') {
        assert.equal(url, '/api/courses/course/draft/sections/section/lessons/readiness');
        const body = JSON.parse(options.body); assert.equal(body.lessonId, 'lesson');
        assert.equal(body.lesson.primaryVideoMediaAssetId, 'persisted-asset');
        return Response.json(ready);
      }
      assert.equal(url, '/api/courses/course/draft/sections/readiness');
      return Response.json({ courseVersionId: 'current-draft', percentage: 100, isReady: true, completedSections: 1,
        sections: [{ id: 'section', courseVersionId: 'current-draft', lessons: [{ id: 'lesson', contentType: 'video', primaryVideoMediaAssetId: 'persisted-asset', readiness: ready }], readiness: { percentage: 100, isReady: true } }] });
    };
    const response = await loadCurriculumReadiness('course');
    const section = mapSection(response.sections[0]);
    assert.equal(section.readiness.percentage, 100); assert.deepEqual(section.lessons[0].readiness, ready);
    assert.equal(section.lessons[0].video.mediaId, undefined); // Local video metadata is not an authority.
    assert.deepEqual(await previewLessonReadiness('course', 'section', 'lesson', { primaryVideoMediaAssetId: 'persisted-asset' }), ready);
    globalThis.fetch = async () => Response.json({ title: 'Readiness unavailable' }, { status: 503 });
    await assert.rejects(loadCurriculumReadiness('course'), /Readiness unavailable/);
  } finally { globalThis.fetch = original; }
});

test('submission eligibility reports real metadata blockers and unavailable workflow rather than local fake submission', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/courses/owned/draft/submission-eligibility'); assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'include');
      return Response.json({ taskCount: 1, readyTaskCount: 1, contentEligible: false, canSubmit: false, submissionImplemented: false,
        checks: [{ code: 'cover', isMet: false }, { code: 'objectives', isMet: false }] });
    };
    const result = await loadSubmissionEligibility('owned'); assert.equal(result.readyTaskCount, 1); assert.equal(result.canSubmit, false);
    assert.deepEqual(result.checks.filter(x => !x.isMet).map(x => x.code), ['cover', 'objectives']);
  } finally { globalThis.fetch = original; }
});

test('course cover uploads actual image bytes with credentials and stable identity; rejected uploads are not success', async () => {
  const original = globalThis.fetch;
  try {
    const image = Object.assign(new Blob(['image bytes'], { type: 'image/png' }), { name: 'غلاف.png' });
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/courses/owned/draft/cover'); assert.equal(options.method, 'PUT'); assert.equal(options.credentials, 'include');
      assert.equal(options.body, image); assert.equal(options.headers['Content-Type'], 'image/png');
      assert.equal(options.headers['X-Upload-Id'], 'stable-id'); assert.equal(decodeURIComponent(options.headers['X-File-Name']), 'غلاف.png');
      return Response.json({ mediaAssetId: 'saved-cover' });
    };
    assert.equal((await uploadCourseCover('owned', image, 'stable-id')).mediaAssetId, 'saved-cover');
    globalThis.fetch = async () => Response.json({ title: 'An editable current draft is required.' }, { status: 409 });
    await assert.rejects(uploadCourseCover('owned', image, 'stable-id'), /editable current draft/);
  } finally { globalThis.fetch = original; }
});

test('cover-only course saves preserve unrelated metadata and localized objectives', () => {
  const stored = { titleAr: 'Title', titleEn: null, descriptionAr: 'Description', objectives: [{ ar: null, en: 'Goal' }], coverMediaAssetId: null };
  const payload = { titleAr: 'Title', titleEn: '', descriptionAr: 'Description', objectives: [{ id: 'client-only', ar: '', en: 'Goal' }] };
  assert.deepEqual(changedCourseDraftFields(payload, stored), {});
  assert.deepEqual(changedCourseDraftFields({ ...payload, coverMediaAssetId: 'real-cover' }, stored), { coverMediaAssetId: 'real-cover' });
  assert.deepEqual(changedCourseDraftFields({ ...payload, titleAr: 'Edited title' }, stored), { titleAr: 'Edited title' });
});
