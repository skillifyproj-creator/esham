export const CLOUD_REVIEW_VERSION = 'gemini-review-v1';
const categories = ['blood', 'burn', 'fire-risk', 'violence', 'sexual', 'uncertain'];
export function validCloudReview(result, mediaId, duration) {
  return Boolean(result?.version === CLOUD_REVIEW_VERSION && result.provider === 'gemini' &&
    typeof result.model === 'string' && result.model.length > 0 && result.model.length < 100 && result.mediaId === mediaId &&
    Number.isFinite(duration) && duration > 0 && result.duration === duration && result.advisoryOnly === true &&
    result.analysis === 'video-and-audio' && Number.isFinite(Date.parse(result.checkedAt)) &&
    ['no-flags', 'review'].includes(result.status) && Array.isArray(result.findings) && result.findings.length <= 50 &&
    (result.status === 'review' ? result.findings.length > 0 : result.findings.length === 0) && result.findings.every(f =>
      Number.isFinite(f.time) && f.time >= 0 && f.time <= duration && categories.includes(f.category) && f.review === true &&
      typeof f.uncertain === 'boolean' && ['reasonAr', 'reasonEn'].every(k => typeof f[k] === 'string' && f[k].trim().length > 0 && f[k].length <= 600)));
}
