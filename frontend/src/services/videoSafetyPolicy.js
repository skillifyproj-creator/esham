import { validCloudReview } from './cloudReviewPolicy.js';
export const SCREENING_VERSION = 'clip-local-v2';
export const SCREENING_MODEL = 'Xenova/clip-vit-base-patch32';
// These are similarity prompts, not a trained or calibrated moderation taxonomy.
export const SCREENING_LABELS = [
  { id: 'lesson', text: 'an educational lesson, a teacher, a computer screen or a whiteboard' },
  { id: 'ordinary', text: 'an ordinary everyday scene, a landscape, art or people talking' },
  { id: 'safe-fire', text: 'a candle, fireplace, cooking fire or campfire with no person or body part close to the flames' },
  { id: 'medical', text: 'a non-graphic medical diagram or an educational anatomy illustration' },
  { id: 'blood', text: 'graphic bloody injuries, gore, a mutilated human body or a dead person', review: true },
  { id: 'burn', text: 'a person on fire, a burning human body or severe burn injuries', review: true },
  { id: 'fire-risk', text: 'a person\'s hand touching fire or placed dangerously close to open flames', review: true },
  { id: 'violence', text: 'a person being violently attacked, tortured or assaulted', review: true },
  { id: 'sexual', text: 'explicit sexual activity or exposed naked human genitals', review: true },
];

export function sampleVideoTimes(duration) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('screening-duration');
  const count = Math.min(60, Math.max(2, Math.ceil(duration / 2) + 1));
  return Array.from({ length: count }, (_, i) => (Math.max(0, duration - 0.05) * i) / (count - 1));
}

export function summarizeFrame(scores, time) {
  if (!Array.isArray(scores) || scores.length !== SCREENING_LABELS.length ||
      new Set(scores.map(item => item.label)).size !== SCREENING_LABELS.length ||
      scores.some(item => !SCREENING_LABELS.some(label => label.text === item.label) || !Number.isFinite(item.score) || item.score < 0 || item.score > 1)) throw new Error('screening-result');
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const top = sorted[0], category = SCREENING_LABELS.find(label => label.text === top.label);
  const harmful = sorted.find(item => SCREENING_LABELS.some(label => label.review && label.text === item.label));
  // A weak or near-tied result remains uncertain. Scores are relative similarity, not confidence.
  const uncertain = top.score < 0.3 || top.score - sorted[1].score < 0.04;
  const suspected = category.review || (harmful.score >= 0.25 && top.score - harmful.score < 0.08);
  return { time, category: suspected ? SCREENING_LABELS.find(label => label.text === harmful.label).id : category.id,
    similarity: suspected ? harmful.score : top.score, review: Boolean(suspected || uncertain), uncertain: Boolean(!suspected && uncertain) };
}

export function makeScreeningResult(frames, mediaId, duration) {
  if (!mediaId || !frames.length || frames.length !== sampleVideoTimes(duration).length) throw new Error('screening-incomplete');
  return { version: SCREENING_VERSION, model: SCREENING_MODEL, mediaId, duration, status: frames.some(frame => frame.review) ? 'review' : 'no-flags',
    sampledFrames: frames.length, intervalSeconds: duration / (frames.length - 1), findings: frames.filter(frame => frame.review), checkedAt: new Date().toISOString(), visualOnly: true };
}

export function matchingScreening(video) {
  const result = video?.screening;
  if (validCloudReview(result, video?.mediaId, video?.durationSeconds)) return result;
  return result?.version === SCREENING_VERSION && Number.isFinite(result.duration) && result.duration > 0 && result.mediaId === video.mediaId && result.duration === video.durationSeconds && Array.isArray(result.findings) &&
    ['no-flags', 'review'].includes(result.status) && result.sampledFrames === sampleVideoTimes(result.duration).length ? result : null;
}

export function courseHasFlaggedVideo(course) {
  return (course.curriculum || []).some(section => (section.lessons || []).some(lesson => matchingScreening(lesson.video)?.status === 'review'));
}
