const DB = 'esham-media-v1';
function database() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('storage-unavailable')); return; }
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
export async function saveMedia(blob, metadata = {}, { id } = {}) {
  if (!(blob instanceof Blob) || !blob.size) throw new Error('empty-file');
  const db = await database();
  const record = { ...metadata, id: id || crypto.randomUUID(), blob, sizeBytes: blob.size, type: blob.type, createdAt: new Date().toISOString() };
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    transaction.objectStore('files').put(record);
    transaction.oncomplete = () => { db.close(); const { blob: ignored, ...value } = record; resolve(value); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error || new Error('storage-failed')); };
  });
}
export async function readMedia(id) {
  if (!id) return null;
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readonly');
    const request = transaction.objectStore('files').get(id);
    let record;
    request.onsuccess = () => { record = request.result || null; };
    transaction.oncomplete = () => { db.close(); resolve(record); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}
export const formatBytes = bytes => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
export function validateVideo(file) {
  if (!file?.size || file.size > 2 * 1024 ** 3) throw new Error('video-size');
  if (!/\.(mp4|webm|mov)$/i.test(file.name) || !['video/mp4', 'video/webm', 'video/quicktime', ''].includes(file.type)) throw new Error('video-type');
}
export function validateAttachments(files, existing = 0) {
  if (files.length + existing > 5 || files.some(file => !file.size || file.size > 10 * 1024 ** 2 || !/\.(pdf|png|jpe?g|webp|txt|docx?)$/i.test(file.name))) throw new Error('attachment-limit');
}
