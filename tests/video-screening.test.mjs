import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENING_LABELS, sampleVideoTimes, summarizeFrame, makeScreeningResult, matchingScreening, courseHasFlaggedVideo } from '../src/services/videoSafetyPolicy.js';
function scores(top, second = 'ordinary', value = 0.7) {
  return SCREENING_LABELS.map(label => ({ label: label.text, score: label.id === top ? value : label.id === second ? 0.15 : 0.025 }));
}
function result(category, mediaId = 'original') {
  return makeScreeningResult(sampleVideoTimes(4).map(time => summarizeFrame(scores(category), time)), mediaId, 4);
}
test('sampling covers the beginning and end and reports sparse coverage for long videos', () => {
  const short = sampleVideoTimes(4); assert.equal(short[0], 0); assert.equal(short.at(-1), 3.95);
  assert.equal(sampleVideoTimes(3600).length, 60);
  assert.throws(() => sampleVideoTimes(Infinity)); assert.throws(() => sampleVideoTimes(0));
});
test('injuries and burning bodies require review, ordinary fire does not automatically imply violence', () => {
  for (const category of ['blood', 'burn', 'fire-risk', 'violence', 'sexual']) assert.equal(result(category).status, 'review');
  for (const category of ['lesson', 'safe-fire']) assert.equal(result(category).status, 'no-flags');
});
test('weak, tied or malformed model results cannot silently approve a frame', () => {
  const tied = SCREENING_LABELS.map(label => ({ label: label.text, score: 0.125 }));
  assert.equal(summarizeFrame(tied, 0).review, true);
  assert.throws(() => summarizeFrame([], 0));
  assert.throws(() => summarizeFrame(scores('lesson').map(item => ({ ...item, score: NaN })), 0));
  assert.throws(() => summarizeFrame(Array(8).fill(scores('lesson')[0]), 0));
  assert.throws(() => makeScreeningResult([summarizeFrame(scores('lesson'), 0)], 'original', 4));
});
test('editing or replacing media invalidates previous screening and flagged videos block local approval', () => {
  const video = { mediaId: 'original', durationSeconds: 4, screening: result('blood') };
  assert.equal(matchingScreening(video).status, 'review');
  assert.equal(matchingScreening({ ...video, mediaId: 'edited' }), null);
  assert.equal(matchingScreening({ ...video, durationSeconds: 2 }), null);
  assert.equal(matchingScreening({ ...video, screening: { ...video.screening, duration: NaN } }), null);
  assert.equal(courseHasFlaggedVideo({ curriculum: [{ lessons: [{ video }] }] }), true);
  assert.equal(courseHasFlaggedVideo({ curriculum: [{ lessons: [{ video: { ...video, screening: result('lesson') } }] }] }), false);
});
