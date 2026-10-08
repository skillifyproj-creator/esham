import { useEffect, useRef, useState } from 'react';

export default function VideoTimeline({ url, videoRef, duration, start, end, onRange, disabled, language, sizeBytes }) {
  const root=useRef(null), instance=useRef(null), region=useRef(null), latest=useRef({start,end,onRange,disabled});latest.current={start,end,onRange,disabled};
  const [status,setStatus]=useState('loading'),[position,setPosition]=useState(0);
  const t=(ar,en)=>language==='ar'?ar:en;
  useEffect(()=>{
    if(!url||!duration||!root.current||!videoRef.current)return;
    let closed=false,surfer;
    async function load(){try{
      const [{default:WaveSurfer},{default:Regions},{default:Timeline}]=await Promise.all([import('wavesurfer.js'),import('wavesurfer.js/dist/plugins/regions.esm.js'),import('wavesurfer.js/dist/plugins/timeline.esm.js')]);
      if(closed)return;
      const regions=Regions.create();
      surfer=WaveSurfer.create({container:root.current,media:videoRef.current,height:90,waveColor:'#9b8090',progressColor:'#472733',cursorColor:'#1d5367',normalize:true,plugins:[regions,Timeline.create({height:24})]});instance.current=surfer;
      surfer.on('timeupdate',time=>{if(!closed)setPosition(Number.isFinite(time)?time:0);});
      regions.on('region-updated',value=>{if(!closed&&!latest.current.disabled)latest.current.onRange(value.start,value.end);});
      // WaveSurfer schedules its initial media load on the next microtask.
      // Let it begin before our explicit load, so it cannot supersede this one.
      await Promise.resolve();if(closed)return;
      try { if(sizeBytes>50*1024**2)throw Error('large');await surfer.load(url,undefined,duration);if(!closed)setStatus('ready'); }
      catch (cause) {if(closed)return;if(import.meta.env.DEV)console.debug('Timeline waveform fallback:',cause);await surfer.load(url,[new Float32Array([0,0])],duration);setStatus('silent');}
      if(closed)return;
      region.current=regions.addRegion({id:'trim-selection',start:latest.current.start,end:latest.current.end,minLength:.1,color:'#39a5bf33',drag:!latest.current.disabled,resize:!latest.current.disabled});
    }catch{if(!closed)setStatus('error');}}
    setStatus('loading');load();
    return()=>{closed=true;region.current=null;instance.current=null;surfer?.destroy();};
  },[url,duration,videoRef,sizeBytes]);
  useEffect(()=>{const current=region.current;if(current&&(current.start!==start||current.end!==end||current.drag===disabled))current.setOptions({start,end,drag:!disabled,resize:!disabled});},[start,end,disabled,status]);
  const time=value=>`${Math.floor(value/60).toString().padStart(2,'0')}:${(value%60).toFixed(1).padStart(4,'0')}`;
  return <section className="video-timeline" aria-label={t('التايم لاين وقص الفيديو','Video timeline and trim')}>
    <h2>{t('التايم لاين','Timeline')}</h2><p>{t('اسحب حافتي التحديد لضبط القص، أو اختر موضع التشغيل واجعله بداية أو نهاية.','Drag selection edges to trim, or mark the current playback position as the start or end.')}</p>
    <div ref={root} dir="ltr" className={disabled?'timeline-disabled':''}/>
    {status==='loading'&&<p role="status">{t('تحميل التايم لاين…','Loading timeline…')}</p>}
    {status==='silent'&&<p>{t('التايم لاين متاح دون موجة صوتية لهذا الملف.','Timeline available without an audio waveform for this file.')}</p>}
    {status==='error'&&<p role="alert">{t('تعذّر تحميل التايم لاين؛ يمكنك استخدام خانات الوقت أدناه.','Timeline unavailable; use the time fields below.')}</p>}
    <p dir="ltr">{time(start)} — {time(end)} · {time(position)} / {time(duration)}</p>
    <div className="video-actions"><button type="button" disabled={disabled} onClick={()=>onRange(Math.min(Math.max(videoRef.current?.currentTime||0,0),end-.1),end)}>{t('قص البداية عند موضع التشغيل','Set start at playhead')}</button><button type="button" disabled={disabled} onClick={()=>onRange(start,Math.max(start+.1,Math.min(videoRef.current?.currentTime||0,duration)))}>{t('قص النهاية عند موضع التشغيل','Set end at playhead')}</button></div>
  </section>;
}
