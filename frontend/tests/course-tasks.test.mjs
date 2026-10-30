import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTasks, loadTask, saveTask, deleteTask, reorderTasks, loadTaskReadiness } from '../src/services/courseTasksApi.js';

test('task requests use the course version route, cookies and explicit optional placement', async () => {
  const original = globalThis.fetch, calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, ...options });
      assert.equal(options.credentials, 'include');
      return new Response(JSON.stringify({ id: 'task', courseVersionId: 'draft' }), { status: options.method === 'POST' ? 201 : 200 });
    };
    const payload = { titleAr: 'مهمة', titleEn: 'Task', sortOrder: 0, displaySectionId: null,
      instructions: { ar: 'تعليمات', en: 'Instructions' }, requirements: [{ en: 'Assessment' }] };
    await loadTasks('course'); await loadTask('course', 'task');
    await saveTask('course', null, payload); await saveTask('course', 'task', { ...payload, displaySectionId: 'section' });
    await saveTask('course', 'task', payload); await reorderTasks('course', ['task']);
    await loadTaskReadiness('course'); await deleteTask('course', 'task');
    assert.deepEqual(calls.map(x => [x.method, x.url]), [
      ['GET', '/api/courses/course/draft/tasks'], ['GET', '/api/courses/course/draft/tasks/task'],
      ['POST', '/api/courses/course/draft/tasks'], ['PUT', '/api/courses/course/draft/tasks/task'],
      ['PUT', '/api/courses/course/draft/tasks/task'], ['PUT', '/api/courses/course/draft/tasks/reorder'],
      ['GET', '/api/courses/course/draft/tasks/readiness'], ['DELETE', '/api/courses/course/draft/tasks/task'],
    ]);
    assert.equal(JSON.parse(calls[4].body).displaySectionId, null);
    assert.deepEqual(JSON.parse(calls[2].body).instructions, payload.instructions);
    assert.deepEqual(JSON.parse(calls[5].body), { ids: ['task'] });
  } finally { globalThis.fetch = original; }
});
test('invalid placement and protected deletes remain visible failures', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ errors: { request: ['DisplaySectionId must belong to this draft.'] } }), { status: 400 });
    await assert.rejects(saveTask('course', 'task', { displaySectionId: 'foreign' }), /DisplaySectionId/);
    globalThis.fetch = async () => new Response(JSON.stringify({ title: 'Task has submissions.' }), { status: 409 });
    await assert.rejects(deleteTask('course', 'task'), /submissions/);
  } finally { globalThis.fetch = original; }
});
