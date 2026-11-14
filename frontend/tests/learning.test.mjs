import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLearning, loadLesson, protectedMediaUrl, learningMessage } from '../src/services/learningApi.js';
import { saveLessonProgress } from '../src/services/lessonProgressApi.js';
import { financialRequest } from '../src/services/financialApi.js';
const enrollment = '10000000-0000-4000-8000-000000000001', lesson = '20000000-0000-4000-8000-000000000001', version = '30000000-0000-4000-8000-000000000001';
const course = { accountId: 'a', enrollmentId: enrollment, availableCourseVersionId: version, versionState: { availableCourseVersionId: version }, sections: [{ id: lesson, lessons: [{ id: lesson }] }] };
test('curriculum binds account enrollment and version without preview fallback', async () => {
  assert.deepEqual(await loadLearning('a', enrollment, undefined, async () => course), course);
  await assert.rejects(loadLearning('b', enrollment, undefined, async () => course), /account_changed/);
  await assert.rejects(loadLearning('a', '1', undefined, async () => course), /validation/);
  await assert.rejects(loadLearning('a', enrollment, undefined, async () => ({ ...course, sections: [{ id: lesson, lessons: [{ id: 1 }] }] })), /response/);
});
test('lesson responses reject late account and publication identities', async () => {
  const data = { accountId: 'a', enrollmentId: enrollment, lessonId: lesson, courseVersionId: version, progress: { progressToken: 'token' } };
  assert.deepEqual(await loadLesson('a', enrollment, lesson, version, undefined, async () => data), data);
  await assert.rejects(loadLesson('b', enrollment, lesson, version, undefined, async () => data), /account_changed/);
  await assert.rejects(loadLesson('a', enrollment, lesson, enrollment, undefined, async () => data), /publication_changed/);
});
test('protected media links cannot select an unrelated enrollment lesson or external URL', () => {
  const path = `/me/enrollments/${enrollment}/learning/lessons/${lesson}/video`;
  assert.equal(protectedMediaUrl(path, enrollment, lesson, 'http://localhost:5216'), 'http://localhost:5216' + path);
  for (const bad of ['https://evil.test/file', '/api/courses/private', path + '/../secret', path + '?asset=other']) assert.throws(() => protectedMediaUrl(bad, enrollment, lesson), /response/);
});
test('progress sends version token account and credentials on PUT and preserves backward seeks', async () => {
  await saveLessonProgress('a', enrollment, lesson, version, 'token', 'progress', 5, undefined, async (path, options) => {
    assert.ok(path.endsWith('/progress')); assert.equal(options.method, 'PUT'); assert.equal(options.accountId, 'a'); assert.equal(options.body.lastPositionSeconds, 5); assert.equal(options.body.expectedProgressToken, 'token');
    return { accountId: 'a', enrollmentId: enrollment, lessonId: lesson, courseVersionId: version, progressToken: 'next' };
  });
  await financialRequest('/test', { base: 'http://localhost:5216', method: 'PUT', accountId: 'a', fetcher: async (_, options) => {
    assert.equal(options.credentials, 'include'); assert.equal(options.headers['X-Esham-Account-Id'], 'a'); assert.equal(options.headers['X-Requested-With'], 'XMLHttpRequest'); return Response.json({ ok: true });
  } });
});
test('completion requests cannot set status dates owners task approvals or playback', async () => {
  await saveLessonProgress('a', enrollment, lesson, version, 'token', 'completion', 0, undefined, async (_, options) => {
    assert.deepEqual(options.body, { expectedCourseVersionId: version }); return { accountId: 'a', enrollmentId: enrollment, lessonId: lesson, courseVersionId: version, progressToken: 'next' };
  });
});
test('invalid positions and disabled/conflict failures never become local success', async () => {
  for (const position of [-1, NaN, Infinity]) await assert.rejects(saveLessonProgress('a', enrollment, lesson, version, 'token', 'progress', position), /validation/);
  await assert.rejects(saveLessonProgress('a', enrollment, lesson, version, 'token', 'open', 0, undefined, async () => { throw new Error('progress_conflict'); }), /progress_conflict/);
  assert.match(learningMessage({ code: 'progress_disabled' }, 'en'), /disabled/);
});
