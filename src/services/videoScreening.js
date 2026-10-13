import { sampleVideoTimes, summarizeFrame, makeScreeningResult } from './videoSafetyPolicy';

export async function screenVideo(blob, metadata, { signal, onProgress = () => {} } = {}) {
  if (!(blob instanceof Blob) || !blob.size || typeof Worker === 'undefined') throw new Error('screening-unavailable');
  const times = sampleVideoTimes(metadata.durationSeconds);
  const worker = new Worker(new URL('./videoSafety.worker.js', import.meta.url), { type: 'module' });
  const video = document.createElement('video'), url = URL.createObjectURL(blob);
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  const aborted = () => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };
  function waitEvent(name, action) {
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); video.removeEventListener(name, done); video.removeEventListener('error', fail); signal?.removeEventListener('abort', cancel); };
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('screening-decode')); };
      const cancel = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(fail, 30000);
      video.addEventListener(name, done, { once: true }); video.addEventListener('error', fail, { once: true }); signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) cancel(); else action();
    });
  }
  function request(data, transfer = []) {
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); worker.onmessage = null; worker.onerror = null; signal?.removeEventListener('abort', cancel); };
      const fail = () => { cleanup(); reject(new Error('screening-model')); };
      const cancel = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(fail, 300000);
      worker.onmessage = ({ data: response }) => {
        if (response.type === 'loading') { onProgress({ phase: 'loading', percent: Number(response.progress) || 0 }); return; }
        if (response.type === 'error') { fail(); return; }
        cleanup(); resolve(response);
      };
      worker.onerror = fail; signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) cancel(); else worker.postMessage(data, transfer);
    });
  }
  try {
    aborted(); onProgress({ phase: 'loading', percent: 0 });
    await request({ type: 'load' });
    await waitEvent('loadeddata', () => { video.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = 224; canvas.height = 224;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !video.videoWidth || !video.videoHeight) throw new Error('screening-decode');
    const frames = [];
    for (const time of times) {
      aborted();
      if (Math.abs(video.currentTime - time) > 0.001) await waitEvent('seeked', () => { video.currentTime = time; });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 224, 224);
      const ratio = Math.min(224 / video.videoWidth, 224 / video.videoHeight);
      ctx.drawImage(video, (224 - video.videoWidth * ratio) / 2, (224 - video.videoHeight * ratio) / 2, video.videoWidth * ratio, video.videoHeight * ratio);
      const pixels = ctx.getImageData(0, 0, 224, 224).data.buffer;
      const result = await request({ type: 'frame', pixels, width: 224, height: 224 }, [pixels]);
      frames.push(summarizeFrame(result.scores, time));
      onProgress({ phase: 'frames', percent: (frames.length / times.length) * 100, completed: frames.length, total: times.length });
    }
    aborted(); return makeScreeningResult(frames, metadata.mediaId, metadata.durationSeconds);
  } finally { worker.terminate(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}
