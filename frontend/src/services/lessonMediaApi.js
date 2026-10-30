import { apiBase } from './accountApi.js';
import { courseRequest, curriculumPath } from './curriculumApi.js';
import { readMedia, saveMedia } from './mediaStore.js';

export const lessonMediaPath = (courseId, sectionId, lessonId) => `${curriculumPath(courseId)}/${sectionId}/lessons/${lessonId}/media`;
export const videoDraftKey = (ownerId, courseId, sectionId, lessonId) => `esham-video-draft:${ownerId}:${courseId}:${sectionId}:${lessonId}`;
export const loadLessonMedia = (courseId, sectionId, lessonId, signal) => courseRequest(lessonMediaPath(courseId, sectionId, lessonId), undefined, 'GET', signal);
export const detachLessonMedia = (courseId, sectionId, lessonId, attachmentId) => courseRequest(`${lessonMediaPath(courseId, sectionId, lessonId)}/${attachmentId}`, undefined, 'DELETE');
export const mediaContentUrl = value => value?.contentUrl?.startsWith('/api/courses/') ? `${apiBase}${value.contentUrl}` : '';

export async function hydrateLessonVideo(attachment, signal) {
  if (!attachment) return null;
  let stored = await readMedia(attachment.mediaAssetId);
  if (!stored) {
    const response = await fetch(mediaContentUrl(attachment), { credentials: 'include', signal });
    if (!response.ok) throw new Error(`Unable to load saved video (${response.status}).`);
    stored = await saveMedia(await response.blob(), { name: attachment.fileName, durationSeconds: attachment.durationSeconds }, { id: attachment.mediaAssetId });
  }
  return { ...stored, mediaId: attachment.mediaAssetId, backendAssetId: attachment.mediaAssetId,
    name: attachment.fileName, durationSeconds: attachment.durationSeconds, sizeBytes: attachment.sizeBytes,
    encoding: attachment.contentType, quality: '', attachmentId: attachment.attachmentId, sourceMediaAssetId: attachment.sourceMediaAssetId };
}

export async function uploadLessonVideo(courseId, sectionId, lessonId, blob, metadata, { sourceMediaAssetId, replaceAttachmentId, signal } = {}) {
  const response = await fetch(`${apiBase}/api${lessonMediaPath(courseId, sectionId, lessonId)}`, {
    method: 'POST', credentials: 'include', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30 * 60 * 1000)]) : AbortSignal.timeout(30 * 60 * 1000),
    headers: { 'Content-Type': blob.type.split(';')[0] || (/\.mp4$/i.test(metadata.name) ? 'video/mp4' : /\.mov$/i.test(metadata.name) ? 'video/quicktime' : 'video/webm'), 'X-Requested-With': 'XMLHttpRequest',
      'X-Upload-Id': metadata.mediaId, 'X-File-Name': encodeURIComponent(metadata.name), 'X-Video-Duration': String(metadata.durationSeconds),
      ...(sourceMediaAssetId ? { 'X-Source-Media-Id': sourceMediaAssetId } : {}),
      ...(replaceAttachmentId ? { 'X-Replace-Attachment-Id': replaceAttachmentId } : {}) }, body: blob,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(Object.values(result?.errors || {}).flat().join(' ') || result?.title || `Video save failed (${response.status}).`);
  return result;
}

export async function persistVideoSource(courseId, sectionId, lessonId, metadata, signal, replacement = {}, visited = new Set()) {
  if (metadata.backendAssetId) return metadata.backendAssetId;
  if (visited.has(metadata.mediaId) || visited.size >= 32) throw new Error('Invalid video source chain.');
  visited.add(metadata.mediaId);
  const sourceId = metadata.sourceVideo ? await persistVideoSource(courseId, sectionId, lessonId, metadata.sourceVideo, signal, replacement, visited) : metadata.sourceMediaAssetId;
  const stored = await readMedia(metadata.mediaId);
  if (!stored) throw new Error('missing-file');
  const saved = await uploadLessonVideo(courseId, sectionId, lessonId, stored.blob, metadata,
    { sourceMediaAssetId: sourceId, replaceAttachmentId: replacement.allowed ? replacement.attachmentId : undefined, signal });
  replacement.attachmentId = saved.attachmentId; replacement.allowed = true;
  return saved.mediaAssetId;
}
