import { aiEndpoint } from './aiEndpoint.js';
import { validCloudReview } from './cloudReviewPolicy.js';

// Public address only. API keys belong to the independent service, never VITE_* variables.
export const cloudReviewUrl = aiEndpoint(import.meta.env?.VITE_VIDEO_REVIEW_API_URL, import.meta.env?.DEV, 8000);
export async function screenVideoWithGemini(blob, metadata, { signal, onProgress = () => {}, consent = false } = {}) {
  if (!consent) throw new Error('screening-consent');
  if (!cloudReviewUrl) throw new Error('screening-cloud-unavailable');
  if (!(blob instanceof Blob) || !blob.size || blob.size > 20 * 1024 * 1024) throw new Error('screening-cloud-size');
  const mimeType = blob.type.split(';')[0].toLowerCase();
  if (!['video/mp4', 'video/webm'].includes(mimeType) || !metadata.mediaId || !Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds <= 0 || metadata.durationSeconds > 600) throw new Error('screening-cloud-format');
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error('screening-timeout')), 125000);
  try {
    if (signal?.aborted) cancel();
    const health = await fetch(`${cloudReviewUrl}/health`, { signal: controller.signal, credentials: 'include' });
    if (!health.ok) throw new Error('screening-cloud-unavailable');
    if (!(await health.json()).configured) throw new Error('screening-key-missing');
    onProgress({ phase: 'cloud', percent: 0 });
    const response = await fetch(`${cloudReviewUrl}/video/review`, {
      method: 'POST', signal: controller.signal, credentials: 'include', body: blob,
      headers: { 'Content-Type': mimeType, 'X-Media-Id': encodeURIComponent(metadata.mediaId), 'X-Video-Duration': String(metadata.durationSeconds), 'X-Review-Consent': 'google-video-upload' },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(/^screening-[a-z-]+$/.test(result?.error) ? result.error : 'screening-service');
    if (!validCloudReview(result, metadata.mediaId, metadata.durationSeconds)) throw new Error('screening-result');
    onProgress({ phase: 'cloud', percent: 100 });
    return result;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (controller.signal.aborted) throw new Error('screening-timeout');
    if (error instanceof TypeError) throw new Error('screening-cloud-unavailable');
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
}
