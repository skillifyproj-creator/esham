import VideoTimeline from '../../components/video/VideoTimeline';
import VideoWhiteboard from '../../components/video/VideoWhiteboard';
import VideoPresentation from '../../components/video/VideoPresentation';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { getInstructorCourseWorkspace, localized } from '../../data/instructorCourseWorkspace';
import { inspectVideo, recordingMimeType, trimVideo, validateTrim } from '../../services/videoProcessing';
import { formatBytes, readMedia, saveMedia, validateVideo } from '../../services/mediaStore';
import useStoredMedia from '../../hooks/useStoredMedia';
import '../../styles/lesson-video-workflow.css';

export default function LessonVideoWorkflow({ mode }) {
  const { courseId, sectionId, lessonId } = useParams();
  const { language } = usePreferences();
  const location = useLocation(), navigate = useNavigate();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const workspace = getInstructorCourseWorkspace(courseId);
  const section = workspace?.sections.find(item => String(item.id) === String(sectionId));
  const lesson = section?.lessons.find(item => String(item.id) === String(lessonId));
  const base = `/instructor/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/video`;
  const key = `esham-video-draft:${courseId}:${sectionId}:${lessonId}`;
  const [metadata, setMetadata] = useState(() => {
    try { return location.state?.video || JSON.parse(localStorage.getItem(key)) || lesson?.video || null; }
    catch { return lesson?.video || null; }
  });
  const media = useStoredMedia(metadata?.mediaId);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0);
  const [start, setStart] = useState(0), [end, setEnd] = useState(metadata?.durationSeconds || 0), [improveAudio, setImproveAudio] = useState(false);
  const [devices, setDevices] = useState([]), [cameraId, setCameraId] = useState(''), [micId, setMicId] = useState('');
  const [cameraOn, setCameraOn] = useState(true), [micOn, setMicOn] = useState(true);
  const [layout, setLayout] = useState(location.state?.selectedLayout || 'camera');
  const [recording, setRecording] = useState(false), [paused, setPaused] = useState(false), [seconds, setSeconds] = useState(0);
  const [screenActive,setScreenActive]=useState(false),[annotations,setAnnotations]=useState(true),[presentation,setPresentation]=useState(false),[audioLevel,setAudioLevel]=useState(0);
  const presentationFrame=useRef(null),meterTick=useRef(0);
  const camera = useRef(null), screen = useRef(null), canvas = useRef(null), board = useRef(null), player = useRef(null);
  const resources = useRef({ streams: [], frame: null, recorder: null, audio: null, destination:null,analyser:null });
  const settings = useRef({ layout, cameraOn, annotations }); settings.current = { layout, cameraOn, annotations };
  const abort = useRef(null), active = useRef(true);
  const flow = location.state || {};
  const duration = Number(metadata?.durationSeconds) || 0;
  const titles = { source: t('إضافة فيديو للدرس', 'Add lesson video'), setup: t('إعداد التسجيل', 'Recording setup'), record: t('تسجيل الفيديو', 'Record video'), preview: t('معاينة الفيديو', 'Video preview'), edit: t('تعديل الفيديو', 'Edit video') };

  function release() {
    const current = resources.current;
    if (current.recorder && current.recorder.state !== 'inactive') current.recorder.stop();
    cancelAnimationFrame(current.frame);
    current.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    current.audio?.close().catch(() => {});
    if (camera.current) camera.current.srcObject = null;
    if (screen.current) screen.current.srcObject = null;
    resources.current = { streams: [], frame: null, recorder: null, audio: null, destination:null,analyser:null };
    if(active.current){setScreenActive(false);setAudioLevel(0);}
  }
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; abort.current?.abort(); release(); };
  }, [mode]);
  useEffect(() => { setEnd(duration); }, [duration]);
  useEffect(() => {
    if (!recording && !busy) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [recording, busy]);
  useEffect(() => {
    if (!recording || paused) return;
    const timer = setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording, paused]);
  const message = cause => cause?.name === 'NotAllowedError' || cause?.name === 'PermissionDeniedError'
    ? t('لم يُسمح بالوصول إلى الجهاز أو أُلغيت مشاركة الشاشة. يمكنك المحاولة مجددًا أو اختيار ملف.', 'Device access was denied or screen sharing was cancelled. Retry or choose a file.')
    : cause?.name === 'NotFoundError' ? t('لم يتم العثور على الكاميرا أو الميكروفون المطلوب.', 'The selected camera or microphone was not found.')
    : cause?.message === 'video-size' ? t('اختر فيديو غير فارغ بحجم أقصى 2GB.', 'Choose a non-empty video up to 2GB.')
    : /video-(codec|type|metadata|duration)/.test(cause?.message || '') ? t('تعذّر تشغيل صيغة الفيديو. جرّب MP4 أو WebM بترميز يدعمه المتصفح.', 'This video cannot be played. Try MP4 or WebM with a codec supported by your browser.')
    : cause?.message === 'invalid-trim' ? t('اختر بداية ونهاية ضمن مدة الفيديو، بفاصل لا يقل عن 0.1 ثانية.', 'Choose start and end within the video duration, at least 0.1 seconds apart.')
    : cause?.message === 'device-selection' ? t('فعّل الكاميرا لهذا الشكل، أو اختر السبورة لتسجيل الصوت دون كاميرا.', 'Enable the camera for this layout, or choose whiteboard to record without a camera.')
    : t('تعذّرت العملية. تحقق من دعم المتصفح ومساحة التخزين، ثم حاول مجددًا.', 'The operation failed. Check browser support and available storage, then retry.');
  function keep(value) {
    localStorage.setItem(key, JSON.stringify(value));
    setMetadata(value);
  }
  function move(next, value = metadata) { navigate(`${base}/${next}`, { state: { ...flow, video: value, selectedLayout: layout, cameraId, micId, cameraOn, micOn } }); }
  async function upload(file) {
    if (!file || busy) return;
    setError(''); setBusy(true);
    try {
      validateVideo(file);
      const dimensions = await inspectVideo(file);
      const saved = await saveMedia(file, { name: file.name, ...dimensions });
      const value = { ...saved, mediaId: saved.id, size: formatBytes(saved.sizeBytes), encoding: file.type || file.name.split('.').pop(), quality: `${dimensions.width}×${dimensions.height}` };
      if (!active.current) return;
      keep(value); move('preview', value);
    } catch (cause) { if (active.current) setError(message(cause)); }
    finally { if (active.current) setBusy(false); }
  }
  function paint() {
    const target = canvas.current;
    if (!target) return;
    const ctx = target.getContext('2d'), w = target.width, h = target.height;
    ctx.fillStyle = '#172f3c'; ctx.fillRect(0, 0, w, h);
    const selected = settings.current.layout;
    const draw = (video, x, y, width, height) => { if (video?.readyState >= 2) ctx.drawImage(video, x, y, width, height); };
    if (selected === 'camera') draw(camera.current, 0, 0, w, h);
    else if (selected === 'board' || selected === 'file') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); const file=selected==='file'?presentationFrame.current:null;if(file){const ratio=Math.min(w/file.width,h/file.height);ctx.drawImage(file,(w-file.width*ratio)/2,(h-file.height*ratio)/2,file.width*ratio,file.height*ratio);}}
    else if (selected === 'side-by-side') { draw(screen.current, 0, 0, w * .65, h); if (settings.current.cameraOn) draw(camera.current, w * .65, 0, w * .35, h); }
    else draw(screen.current, 0, 0, w, h);
    if(settings.current.annotations && board.current)ctx.drawImage(board.current,0,0,w,h);
    if (settings.current.cameraOn && ['screen-camera', 'board','file'].includes(selected)) draw(camera.current, w * .73, h * .7, w * .25, h * .28);
    if(resources.current.analyser && performance.now()-meterTick.current>120){const values=new Uint8Array(resources.current.analyser.fftSize);resources.current.analyser.getByteTimeDomainData(values);const level=Math.sqrt(values.reduce((sum,value)=>sum+((value-128)/128)**2,0)/values.length);setAudioLevel(Math.min(1,level*4));meterTick.current=performance.now();}
    resources.current.frame = requestAnimationFrame(paint);
  }
  function connectAudio(stream){const current=resources.current;if(!current.audio||!stream.getAudioTracks().length)return;const source=current.audio.createMediaStreamSource(stream);source.connect(current.destination);source.connect(current.analyser);}
  async function shareScreen(){
    const shared=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
    if(!active.current){shared.getTracks().forEach(track=>track.stop());return;}
    const old=screen.current.srcObject;old?.getTracks().forEach(track=>track.stop());
    resources.current.streams.push(shared);screen.current.srcObject=shared;await screen.current.play();connectAudio(shared);setScreenActive(true);
    shared.getVideoTracks()[0].onended=()=>{if(!active.current||screen.current?.srcObject!==shared)return;shared.getTracks().forEach(track=>track.stop());screen.current.srcObject=null;setScreenActive(false);setLayout(value=>['screen','screen-camera','side-by-side'].includes(value)?'board':value);};
  }
  async function chooseLayout(value){setError('');try{if(['screen','screen-camera','side-by-side'].includes(value)&&!screenActive)await shareScreen();if(cameraOn&&value!=='screen')await toggleCamera(true);setLayout(value);}catch(cause){setError(message(cause));}}
  async function toggleCamera(enabled,strict=false){setError('');try{if(enabled&&!camera.current.srcObject?.getVideoTracks().length){const stream=await navigator.mediaDevices.getUserMedia({video:cameraId?{deviceId:{exact:cameraId}}:true,audio:false});if(!active.current){stream.getTracks().forEach(track=>track.stop());return;}resources.current.streams.push(stream);camera.current.srcObject=stream;await camera.current.play();}camera.current.srcObject?.getVideoTracks().forEach(track=>{track.enabled=enabled;});setCameraOn(enabled);}catch(cause){setError(message(cause));if(strict)throw cause;}}
  async function toggleMicrophone(enabled,strict=false){setError('');try{const microphones=resources.current.streams.flatMap(stream=>stream.getAudioTracks()).filter(track=>track.getSettings().deviceId);if(enabled&&!microphones.length){const stream=await navigator.mediaDevices.getUserMedia({video:false,audio:micId?{deviceId:{exact:micId}}:true});if(!active.current){stream.getTracks().forEach(track=>track.stop());return;}resources.current.streams.push(stream);connectAudio(stream);}else microphones.forEach(track=>{track.enabled=enabled;});setMicOn(enabled);}catch(cause){setError(message(cause));if(strict)throw cause;}}
  useEffect(()=>{if(mode==='record'||mode==='setup')paint();return()=>cancelAnimationFrame(resources.current.frame);},[mode]);
  async function startDevices(record = false) {
    setError(''); setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !canvas.current?.captureStream) throw new Error('recorder-unavailable');
      const needsCamera = cameraOn && layout !== 'screen';
      if (!needsCamera && layout === 'camera') throw new Error('device-selection');
      const existingCamera = camera.current.srcObject?.getVideoTracks().some(track=>track.readyState==='live');
      const existingMic = resources.current.streams.some(stream=>stream.getAudioTracks().some(track=>track.readyState==='live'&&track.getSettings().deviceId));
      if (needsCamera && !existingCamera) await toggleCamera(true,true);
      if (micOn && !existingMic) await toggleMicrophone(true,true);
      if (!active.current) { release(); return; }
      if (['screen', 'screen-camera', 'side-by-side'].includes(layout) && !screen.current.srcObject?.active) await shareScreen();
      if (!resources.current.audio) {
        const audio=new AudioContext();resources.current.audio=audio;resources.current.destination=audio.createMediaStreamDestination();resources.current.analyser=audio.createAnalyser();resources.current.analyser.fftSize=512;for(const stream of resources.current.streams)connectAudio(stream);
      }
      await resources.current.audio.resume();
      setDevices(await navigator.mediaDevices.enumerateDevices());
      cancelAnimationFrame(resources.current.frame);paint();
      if (record) {
        const output = canvas.current.captureStream(30);
        resources.current.streams.push(output);
        for(const track of resources.current.destination.stream.getAudioTracks())output.addTrack(track);
        const mimeType = recordingMimeType(), chunks = [];
        const recorder = new MediaRecorder(output, mimeType ? { mimeType } : {});
        resources.current.recorder = recorder;
        let started = performance.now(), pausedAt = null, pausedTotal = 0;
        recorder.onpause = () => { pausedAt = performance.now(); };
        recorder.onresume = () => { pausedTotal += performance.now() - pausedAt; pausedAt = null; };
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = event => { recorder.onstop=null;setError(message(event.error)); release(); setRecording(false); };
        recorder.onstop = async () => {
          const length = ((pausedAt || performance.now()) - started - pausedTotal) / 1000;
          const blob = new Blob(chunks, { type: recorder.mimeType });
          release(); if (!active.current) return;
          setRecording(false); setBusy(true);
          try {
            const file = await saveMedia(blob, { name: `recording-${Date.now()}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, durationSeconds: length, width: 1280, height: 720 });
            const value = { ...file, mediaId: file.id, size: formatBytes(file.sizeBytes), quality: '1280×720', encoding: blob.type };
            if (active.current) { keep(value); move('preview', value); }
          } catch (cause) { if (active.current) setError(message(cause)); }
          finally { if (active.current) setBusy(false); }
        };
        recorder.start(250); setSeconds(0); setPaused(false); setRecording(true);
      }
    } catch (cause) { release(); if (active.current) { setRecording(false); setError(message(cause)); } }
    finally { if (active.current) setBusy(false); }
  }
  function pauseRecording() {
    const recorder = resources.current.recorder;
    if (!recorder) return;
    if (recorder.state === 'recording') { recorder.pause(); setPaused(true); }
    else if (recorder.state === 'paused') { recorder.resume(); setPaused(false); }
  }
  async function exportVideo() {
    setError(''); setBusy(true); setProgress(0); abort.current = new AbortController();
    try {
      validateTrim(start, end, duration);
      const stored = await readMedia(metadata.mediaId);
      if (!stored) throw new Error('missing-file');
      const changed = start > .05 || end < duration - .05 || improveAudio;
      let value = metadata;
      if (changed) {
        const blob = await trimVideo(stored.blob, { start, end, duration, improveAudio, signal: abort.current.signal, onProgress: setProgress });
        const file = await saveMedia(blob, { name: `edited-${Date.now()}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, durationSeconds: end - start, width: metadata.width, height: metadata.height });
        value = { ...file, mediaId: file.id, durationSeconds: end - start, size: formatBytes(file.sizeBytes), quality: metadata.quality, encoding: blob.type };
      }
      if (!active.current) return;
      keep(value);
      const draft = flow.lessonDraft || lesson || {};
      navigate(`/instructor/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/edit`, { state: { lessonDraft: { ...draft, contentType: 'video', video: value, minutes: Math.max(1, Math.ceil(value.durationSeconds / 60)) } } });
    } catch (cause) { if (active.current && cause.name !== 'AbortError') setError(message(cause)); }
    finally { if (active.current) setBusy(false); }
  }
  if (!workspace || !section || (lessonId !== 'new' && !lesson)) return <main className="container section"><h1>{t('لم يتم العثور على الدرس أو القسم', 'Lesson or section not found')}</h1><Link to="/instructor/courses">{t('دوراتي', 'My courses')}</Link></main>;
  const capturing = mode === 'record' || mode === 'setup';
  return <main className="container video-workflow" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <nav aria-label={t('مسار الصفحة', 'Breadcrumb')}><Link to={`/instructor/courses/${courseId}/curriculum`}>{localized(workspace.course.title, language)}</Link><span> / {localized(section.title, language)}</span></nav>
    <h1>{titles[mode]}</h1>
    <p>{t('الفيديو محفوظ على هذا الجهاز. الرفع إلى الحساب والمزامنة يتطلبان خدمة التخزين.', 'Videos are saved on this device. Account uploads and synchronization require the storage service.')}</p>
    {error && <p className="video-error" role="alert">{error}</p>}
    {mode === 'source' && <div className="video-options"><section><h2>{t('رفع فيديو', 'Choose video')}</h2><label className="video-dropzone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); upload(event.dataTransfer.files[0]); }}>{t('اختر فيديو أو اسحبه هنا · MP4 / WebM / MOV · حتى 2GB', 'Choose or drop a video · MP4 / WebM / MOV · up to 2GB')}<input aria-label={t('اختيار فيديو', 'Choose video')} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" disabled={busy} onChange={event => { upload(event.target.files[0]); event.target.value = ''; }}/></label></section><section><h2>{t('تسجيل فيديو جديد', 'Record a new video')}</h2><p>{t('الكاميرا أو الشاشة أو السبورة، مع صوت الميكروفون.', 'Camera, screen or whiteboard with microphone audio.')}</p><button className="button" disabled={busy} onClick={() => move('record')}>{t('إعداد التسجيل', 'Recording setup')}</button></section></div>}
    {capturing && <>
      <div className="video-device-options"><label>{t('شكل الفيديو', 'Video layout')}<select value={layout} disabled={busy} onChange={event => chooseLayout(event.target.value)}>{[['camera',t('الكاميرا','Camera')],['screen',t('الشاشة','Screen')],['screen-camera',t('الشاشة مع الكاميرا','Screen and camera')],['side-by-side',t('جنبًا إلى جنب','Side by side')],['board',t('السبورة مع الكاميرا','Whiteboard and camera')],['file',t('ملف مع الكاميرا','File and camera')]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>{t('الكاميرا', 'Camera')}<select value={cameraId} disabled={recording || busy} onChange={event => {release();setCameraId(event.target.value);paint();}}><option value="">{t('الافتراضية', 'Default')}</option>{devices.filter(device => device.kind === 'videoinput').map(device => <option value={device.deviceId} key={device.deviceId}>{device.label || t('كاميرا', 'Camera')}</option>)}</select></label><label>{t('الميكروفون', 'Microphone')}<select value={micId} disabled={recording || busy} onChange={event => {release();setMicId(event.target.value);paint();}}><option value="">{t('الافتراضي', 'Default')}</option>{devices.filter(device => device.kind === 'audioinput').map(device => <option value={device.deviceId} key={device.deviceId}>{device.label || t('ميكروفون', 'Microphone')}</option>)}</select></label>
      <label><input type="checkbox" checked={cameraOn} disabled={busy} onChange={event=>toggleCamera(event.target.checked)}/>{t('تفعيل الكاميرا','Camera enabled')}</label><label><input type="checkbox" checked={micOn} disabled={busy} onChange={event=>toggleMicrophone(event.target.checked)}/>{t('تفعيل الميكروفون','Microphone enabled')}</label></div>
      <div className="video-actions"><button type="button" className="button button-outline" disabled={busy} onClick={async()=>{try{await shareScreen();setLayout('screen-camera');}catch(cause){setError(message(cause));}}}>{screenActive?t('تغيير الشاشة المشاركة','Change shared screen'):t('مشاركة الشاشة داخل الفيديو','Share screen inside video')}</button>{screenActive&&<button type="button" onClick={()=>{const shared=screen.current.srcObject;screen.current.srcObject=null;shared?.getTracks().forEach(track=>track.stop());setScreenActive(false);setLayout('board');}}>{t('إيقاف مشاركة الشاشة','Stop screen sharing')}</button>}<button type="button" onClick={()=>setLayout('board')}>{t('عرض الوايت بورد','Show whiteboard')}</button><label><input type="checkbox" checked={annotations} onChange={event=>setAnnotations(event.target.checked)}/>{t('إظهار الرسم والتعليقات في الفيديو','Include drawings and annotations in video')}</label></div>
      <label>{t('مستوى الصوت الفعلي','Live audio level')}<meter min="0" max="1" value={audioLevel} aria-label={t('مستوى الصوت الفعلي','Live audio level')}/></label>
      <video ref={camera} muted playsInline className="video-capture-source"/><video ref={screen} muted playsInline className="video-capture-source"/>
      <div className="video-stage"><canvas ref={canvas} width={1280} height={720} aria-label={t('معاينة التسجيل','Recording preview')}/></div>
      <VideoPresentation storageKey={`${key}:presentation`} language={language} onFrame={frame=>{presentationFrame.current=frame;setPresentation(Boolean(frame));if(frame)setLayout('file');}}/>
      <VideoWhiteboard sceneId={`${key}:whiteboard`} language={language} overlay={layout!=='board'||presentation} onFrame={frame=>{board.current=frame;}}/>
      <p role="status">{recording ? (paused ? t('متوقف مؤقتًا', 'Paused') : t('جاري التسجيل', 'Recording')) : t('ابدأ المعاينة أو التسجيل للسماح بالوصول للأجهزة.', 'Start preview or recording to allow device access.')} {recording && ` · ${seconds} ${t('ثانية','seconds')}`}</p>
      <div className="video-actions video-record-controls">{!recording ? <><button className="button button-outline" disabled={busy} onClick={() => startDevices(false)}>{t('معاينة الأجهزة', 'Preview devices')}</button><button className="button" disabled={busy} onClick={() => startDevices(true)}>{t('بدء التسجيل', 'Start recording')}</button></> : <><button className="button button-outline" onClick={pauseRecording}>{paused ? t('متابعة التسجيل', 'Resume recording') : t('إيقاف مؤقت', 'Pause')}</button><button className="button" onClick={() => {const recorder=resources.current.recorder;if(recorder&&recorder.state!=='inactive')recorder.stop();}}>{t('إنهاء التسجيل', 'Stop recording')}</button></>}</div>
    </>}
    {['preview','edit'].includes(mode) && <>
      {media.loading ? <p role="status">{t('تحميل الفيديو…','Loading video…')}</p> : media.url ? <video ref={player} src={media.url} controls playsInline className="video-player" onError={() => setError(t('تعذّر تشغيل الفيديو. اختر ملفًا بترميز مدعوم.','Unable to play this video. Choose a supported codec.'))} onTimeUpdate={event => { if (mode === 'edit' && event.currentTarget.currentTime > end) event.currentTarget.pause(); }}/> : <section className="video-empty"><p>{t('لم يُحفظ ملف فيديو لهذا الدرس بعد.','No video file is saved for this lesson yet.')}</p><Link className="button" to={base}>{t('اختيار فيديو','Choose video')}</Link></section>}
      {metadata?.mediaId && <p>{metadata.name} · {formatBytes(metadata.sizeBytes)} · {duration.toFixed(1)} {t('ثانية','seconds')} · {metadata.quality}</p>}
      {mode === 'preview' ? <div className="video-actions"><Link className="button button-outline" to={base}>{t('اختيار فيديو آخر','Choose another video')}</Link><button className="button" disabled={!media.url || busy} onClick={() => move('edit')}>{t('تعديل وحفظ الفيديو','Edit and save video')}</button><a className="button button-outline" href={media.url || undefined} download={metadata?.name} aria-disabled={!media.url}>{t('تنزيل نسخة','Download a copy')}</a></div> : <>
        <VideoTimeline url={media.url} videoRef={player} duration={duration} start={start} end={end} onRange={(from,to)=>{setStart(from);setEnd(to);}} disabled={busy} language={language} sizeBytes={metadata?.sizeBytes}/>
        <div className="video-device-options"><label>{t('البداية بالثواني','Start in seconds')}<input type="number" min={0} max={duration} step="0.1" value={start} disabled={busy} onChange={event => setStart(Number(event.target.value))}/></label><label>{t('النهاية بالثواني','End in seconds')}<input type="number" min={0} max={duration} step="0.1" value={end} disabled={busy} onChange={event => setEnd(Number(event.target.value))}/></label><label><input type="checkbox" checked={improveAudio} disabled={busy} onChange={event => setImproveAudio(event.target.checked)}/>{t('تسوية مستوى الصوت','Level audio')}</label></div>
        <p>{t('حفظ القص ينشئ ملفًا جديدًا، ويستغرق مدة الجزء المحدد تقريبًا. أبقِ الصفحة مفتوحة حتى يكتمل.','Saving a trim creates a new file. Keep this page open until the export finishes.')}</p>
        <div className="video-actions"><button type="button" className="button button-outline" disabled={busy} onClick={()=>move('preview')}>{t('العودة إلى المعاينة','Back to preview')}</button><button className="button button-outline" disabled={busy || !media.url} onClick={() => { try { validateTrim(start,end,duration); player.current.currentTime = start; player.current.play().catch(cause => setError(message(cause))); } catch (cause) { setError(message(cause)); } }}>{t('معاينة الجزء المحدد','Preview selected segment')}</button><button className="button" disabled={busy || !media.url} onClick={exportVideo}>{t('حفظ الفيديو للدرس','Save video to lesson')}</button>{busy && <button className="button button-outline" onClick={() => abort.current?.abort()}>{t('إلغاء التصدير','Cancel export')}</button>}</div>
      </>}
    </>}
    {busy && <p role="status">{t('جاري المعالجة والحفظ…','Processing and saving…')} {progress > 0 && `${Math.round(progress * 100)}%`}</p>}
    {busy && mode === 'edit' && <progress value={progress} max={1} aria-label={t('تقدّم تصدير الفيديو','Video export progress')}/>}
    {!recording && !busy && <Link to={`/instructor/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/edit`}>{t('العودة إلى الدرس','Back to lesson')}</Link>}
  </main>;
}
