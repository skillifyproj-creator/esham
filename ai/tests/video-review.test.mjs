import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewServer, MAX_BYTES } from '../src/server.mjs';
import { normalizeReview, reviewVideo } from '../src/gemini.mjs';
import { matchingScreening, courseHasFlaggedVideo } from '../../frontend/src/services/videoSafetyPolicy.js';

const metadata = { mediaId: 'original', duration: 4, mimeType: 'video/webm', model: 'test-model' };
const clean = { complete: true, verdict: 'no-flags', findings: [] };
const finding = { time: 2, category: 'fire-risk', reasonAr: 'يد قريبة من النار', reasonEn: 'Hand close to fire' };
const google = value => async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }));

test('incomplete, inconsistent and uncertain results never approve media', () => {
  for (const input of [{ ...clean, complete: false }, { ...clean, verdict: 'review' }, { ...clean, findings: [finding] }]) assert.equal(normalizeReview(input, metadata).status, 'review');
  for (const input of [{}, { ...clean, findings: [{ ...finding, time: -1 }] }, { ...clean, findings: [{ ...finding, time: 5 }] }, { ...clean, findings: [{ ...finding, category: 'invented' }] }, { ...clean, findings: [{ ...finding, reasonEn: '' }] }]) assert.throws(() => normalizeReview(input, metadata));
});
test('cloud results bind to media and duration, and block local course approval on review', () => {
  const video = { mediaId: 'original', durationSeconds: 4, screening: normalizeReview({ ...clean, findings: [finding] }, metadata) };
  assert.equal(matchingScreening(video).status, 'review');
  assert.equal(matchingScreening({ ...video, mediaId: 'edited' }), null);
  assert.equal(matchingScreening({ ...video, durationSeconds: 3 }), null);
  assert.equal(matchingScreening({ ...video, screening: { ...video.screening, status: 'no-flags' } }), null);
  assert.equal(courseHasFlaggedVideo({ curriculum: [{ lessons: [{ video }] }] }), true);
});
test('Google adapter sends binary video and schema without placing key in URL', async () => {
  const bytes = Buffer.from('test');
  const response = await reviewVideo(bytes, metadata, { apiKey: 'test-secret', model: 'test-model', fetcher: async (url, options) => {
    assert.ok(!url.includes('test-secret'));
    assert.equal(options.headers['x-goog-api-key'], 'test-secret');
    const body = JSON.parse(options.body);
    assert.equal(body.contents[0].parts[0].inlineData.data, bytes.toString('base64'));
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    return google(clean)();
  } });
  assert.equal(response.status, 'no-flags');
});
test('Google block becomes human review; truncation, invalid JSON and quota fail closed', async () => {
  const options = fetcher => ({ apiKey: 'test', model: 'test', fetcher });
  assert.equal((await reviewVideo(Buffer.alloc(0), metadata, options(async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }))))).status, 'review');
  for (const data of [{ candidates: [{ finishReason: 'MAX_TOKENS' }] }, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'bad' }] } }] }]) await assert.rejects(reviewVideo(Buffer.alloc(0), metadata, options(async () => new Response(JSON.stringify(data)))));
  await assert.rejects(reviewVideo(Buffer.alloc(0), metadata, options(async () => new Response('', { status: 429 }))), /rate-limit/);
  await assert.rejects(reviewVideo(Buffer.alloc(0), metadata, { apiKey: '' }), /key-missing/);
});

async function withServer(config, work) {
  const server = createReviewServer(config);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await work(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const headers = { Origin: 'http://127.0.0.1:5174', 'Content-Type': 'video/webm', 'X-Media-Id': 'original', 'X-Video-Duration': '4', 'X-Review-Consent': 'google-video-upload' };
const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0]);
test('HTTP endpoint rejects untrusted origins, missing consent and missing key without invoking Google', async () => {
  let called = 0;
  await withServer({ apiKey: '', review: () => called++ }, async base => {
    assert.equal((await fetch(`${base}/video/review`, { method: 'POST', headers, body: bytes })).status, 503);
    assert.equal((await fetch(`${base}/video/review`, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: bytes })).status, 403);
    assert.equal((await fetch(`${base}/video/review`, { method: 'POST', headers: { ...headers, 'X-Review-Consent': '' }, body: bytes })).status, 400);
    assert.equal(called, 0);
  });
});
test('HTTP bridge handles valid video, invalid signature, preflight, oversize and review failures', async () => {
  await withServer({ apiKey: 'test', review: async (_, m) => normalizeReview(clean, { ...m, model: 'test' }) }, async base => {
    assert.equal((await fetch(`${base}/video/review`, { method: 'OPTIONS', headers: { Origin: headers.Origin } })).status, 204);
    assert.equal((await fetch(`${base}/video/review`, { method: 'POST', headers, body: Buffer.from('wrong') })).status, 400);
    const result = await fetch(`${base}/video/review`, { method: 'POST', headers, body: bytes });
    assert.equal(result.status, 200); assert.equal((await result.json()).status, 'no-flags');
    assert.equal((await fetch(`${base}/video/review`, { method: 'POST', headers, body: Buffer.alloc(MAX_BYTES + 1) })).status, 413);
  });
  await withServer({ apiKey: 'test', review: async () => { throw new Error('upstream secret detail'); } }, async base => {
    const result = await fetch(`${base}/video/review`, { method: 'POST', headers, body: bytes });
    assert.equal(result.status, 502); assert.equal((await result.json()).error, 'screening-service');
  });
});
