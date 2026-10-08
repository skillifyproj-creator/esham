export function recordingMimeType() {
  if (typeof MediaRecorder === 'undefined') throw new Error('recorder-unavailable');
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type)) || '';
}
export function validateTrim(start, end, duration) {
  if (![start, end, duration].every(Number.isFinite) || start < 0 || end > duration + 0.05 || end - start < 0.1) throw new Error('invalid-trim');
}
export function inspectVideo(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video'), url = URL.createObjectURL(file);
    const cleanup = () => { clearTimeout(timeout); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('video-metadata')); }, 15000);
    video.preload = 'metadata';
    video.onerror = () => { cleanup(); reject(new Error('video-codec')); };
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        const value = { durationSeconds: video.duration, width: video.videoWidth, height: video.videoHeight };
        cleanup(); resolve(value);
      } else {
        video.onseeked = () => {
          const duration = video.duration;
          const value = { durationSeconds: duration, width: video.videoWidth, height: video.videoHeight };
          cleanup(); Number.isFinite(duration) && duration > 0 ? resolve(value) : reject(new Error('video-duration'));
        };
        video.currentTime = 1e8;
      }
    };
    video.src = url;
  });
}
// Re-encode the selected segment into a real file. No filename-only trim settings.
export async function trimVideo(blob, { start, end, duration, improveAudio = false, signal, onProgress = () => {} }) {
  validateTrim(start, end, duration);
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  // The browser fallback also supplies a dynamics compressor for audio leveling.
  if (improveAudio || typeof VideoEncoder === 'undefined') return trimVideoWithRecorder(blob, {start,end,duration,improveAudio,signal,onProgress});
  const {Input,BlobSource,ALL_FORMATS,Output,WebMOutputFormat,BufferTarget,Conversion}=await import('mediabunny');
  const input=new Input({source:new BlobSource(blob),formats:ALL_FORMATS});
  let conversion, cancel;
  try {
    const output=new Output({format:new WebMOutputFormat(),target:new BufferTarget()});
    conversion=await Conversion.init({input,output,tracks:'primary',trim:{start,end},video:{forceTranscode:true},showWarnings:false});
    if (!conversion.isValid || conversion.discardedTracks.length) return await trimVideoWithRecorder(blob,{start,end,duration,improveAudio,signal,onProgress});
    cancel=()=>{conversion.cancel().catch(()=>{});};
    signal?.addEventListener('abort',cancel,{once:true});
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    conversion.onProgress=onProgress;
    await conversion.execute();
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    return new Blob([output.target.buffer],{type:'video/webm'});
  } catch(error) {
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    throw error;
  } finally { signal?.removeEventListener('abort',cancel);input.dispose(); }
}
async function trimVideoWithRecorder(blob, { start, end, duration, improveAudio = false, signal, onProgress = () => {} }) {
  validateTrim(start, end, duration);
  const mimeType = recordingMimeType();
  const video = document.createElement('video'), url = URL.createObjectURL(blob);
  let audioContext;
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  let frame, stream, recorder, source;
  try {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    audioContext = new AudioContext();
    video.src = url; video.playsInline = true; video.preload = 'auto';
    await new Promise((resolve, reject) => {
      const cancel = () => finish(new DOMException('Cancelled', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('video-metadata')), 15000);
      function finish(error) { clearTimeout(timer); signal?.removeEventListener('abort', cancel); error ? reject(error) : resolve(); }
      signal?.addEventListener('abort', cancel, { once: true });
      video.onloadeddata = () => finish(); video.onerror = () => finish(new Error('video-codec'));
    });
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    if (start > 0) await new Promise(resolve => { video.onseeked = resolve; video.currentTime = start; });
    source = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    if (improveAudio) { const compressor = audioContext.createDynamicsCompressor(); source.connect(compressor); compressor.connect(destination); }
    else source.connect(destination);
    stream = canvas.captureStream(30);
    for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
    await audioContext.resume();
    const chunks = [];
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const result = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = event => reject(event.error || new Error('recording-failed'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    });
    const cancel = () => { if (recorder.state !== 'inactive') recorder.stop(); };
    signal?.addEventListener('abort', cancel, { once: true });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    recorder.start(250);
    await video.play();
    const draw = () => {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress(Math.min(1, (video.currentTime - start) / (end - start)));
      if (video.currentTime >= end || video.ended || signal?.aborted) { cancel(); return; }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const output = await result;
    signal?.removeEventListener('abort', cancel);
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    return output;
  } finally {
    cancelAnimationFrame(frame); video.pause();
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    source?.disconnect(); if (audioContext) await audioContext.close();
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}
