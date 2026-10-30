import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadLessonVideo, loadLessonMedia, detachLessonMedia, lessonMediaPath, mediaContentUrl, videoDraftKey } from '../src/services/lessonMediaApi.js';

test('video upload sends the actual blob with cookies, scoped lesson IDs, stable identity and source metadata', async () => {
  const original = globalThis.fetch;
  try {
    const blob = new Blob(['video bytes'], { type: 'video/webm;codecs=vp8' });
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/courses/course/draft/sections/section/lessons/lesson/media');
      assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'include');
      assert.equal(options.body, blob); assert.equal(options.headers['Content-Type'], 'video/webm');
      assert.equal(options.headers['X-Upload-Id'], 'stable-upload-id');
      assert.equal(options.headers['X-Source-Media-Id'], 'original-asset');
      assert.equal(options.headers['X-Replace-Attachment-Id'], 'current-attachment');
      assert.equal(decodeURIComponent(options.headers['X-File-Name']), 'فيديو.webm');
      return Response.json({ attachmentId: 'attachment', mediaAssetId: 'stable-upload-id' });
    };
    const result = await uploadLessonVideo('course', 'section', 'lesson', blob, { mediaId: 'stable-upload-id', name: 'فيديو.webm', durationSeconds: 3 }, { sourceMediaAssetId: 'original-asset', replaceAttachmentId: 'current-attachment' });
    assert.equal(result.attachmentId, 'attachment');
    globalThis.fetch = async () => Response.json({ title: 'An editable current draft is required.' }, { status: 409 });
    await assert.rejects(uploadLessonVideo('course', 'section', 'lesson', blob, { mediaId: 'id', name: 'video.webm', durationSeconds: 3 }), /editable current draft/);
  } finally { globalThis.fetch = original; }
});

test('saved attachments and detach use the backend; cache keys bind owner and full lesson context', async () => {
  const original = globalThis.fetch; const calls = [];
  try {
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json(options.method === 'DELETE' ? true : []); };
    assert.deepEqual(await loadLessonMedia('course', 'section', 'lesson'), []);
    await detachLessonMedia('course', 'section', 'lesson', 'attachment');
    assert.equal(calls[1].url, `/api${lessonMediaPath('course', 'section', 'lesson')}/attachment`);
    assert.equal(calls[1].options.method, 'DELETE'); assert.equal(calls[1].options.credentials, 'include');
    assert.notEqual(videoDraftKey('a', 'c', 's', 'l'), videoDraftKey('b', 'c', 's', 'l'));
    assert.equal(mediaContentUrl({ contentUrl: 'https://untrusted.test/video' }), '');
    assert.equal(mediaContentUrl({ contentUrl: '/api/courses/c/draft/sections/s/lessons/l/media/a/content' }), '/api/courses/c/draft/sections/s/lessons/l/media/a/content');
  } finally { globalThis.fetch = original; }
});
