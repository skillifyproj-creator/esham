import { useEffect, useRef, useState } from 'react';
import { readMedia,saveMedia } from '../../services/mediaStore';

export default function VideoWhiteboard({ sceneId,language,onFrame,overlay=false }) {
  const [loaded,setLoaded]=useState(null),[error,setError]=useState(''),[revision,retry]=useState(0),scene=useRef(null),api=useRef(null),latest=useRef(onFrame);latest.current=onFrame;
  const t=(ar,en)=>language==='ar'?ar:en;
  useEffect(()=>{
    let stopped=false,timer,saveTimer,rendering=false,queued=false,module;
    async function render(){if(stopped||!module||!scene.current)return;if(rendering){queued=true;return;}rendering=true;
      try{const value=scene.current;const bounds=module.convertToExcalidrawElements([{type:'rectangle',x:0,y:0,width:1280,height:720,opacity:0,strokeColor:'transparent',backgroundColor:'transparent',fillStyle:'solid',locked:true}]);
        const frame=await module.exportToCanvas({elements:[...bounds,...value.elements],files:value.files,appState:{...value.appState,exportBackground:!overlay,viewBackgroundColor:'#ffffff',exportWithDarkMode:false},exportPadding:0,maxWidthOrHeight:1280});
        if(!stopped)latest.current(frame);
      }catch(cause){if(import.meta.env.DEV)console.error('Whiteboard load:',cause);if(!stopped)setError(t('تعذّر تجهيز السبورة للتسجيل.','Unable to prepare whiteboard recording.'));}finally{rendering=false;if(queued){queued=false;render();}}
    }
    async function save(){if(stopped||!scene.current)return;try{await saveMedia(new Blob([JSON.stringify(scene.current)],{type:'application/json'}),{name:'whiteboard.excalidraw'},{id:sceneId});}catch{if(!stopped)setError(t('تعذّر حفظ السبورة على الجهاز.','Unable to save the whiteboard on this device.'));}}
    function change(elements,appState,files){scene.current={elements,files,appState:{viewBackgroundColor:appState.viewBackgroundColor,scrollX:appState.scrollX,scrollY:appState.scrollY,zoom:appState.zoom,currentItemFontFamily:appState.currentItemFontFamily}};if(!timer)timer=setTimeout(()=>{timer=null;render();},120);clearTimeout(saveTimer);saveTimer=setTimeout(save,1000);}
    async function load(){try{
      window.EXCALIDRAW_ASSET_PATH=`${import.meta.env.BASE_URL}excalidraw/`;
      module=await import('@excalidraw/excalidraw');await import('@excalidraw/excalidraw/index.css');
      let initial;try{const saved=await readMedia(sceneId);if(saved)initial=JSON.parse(await saved.blob.text());}catch{/* An empty board remains usable. */}
      if(!stopped){scene.current=initial||{elements:[],files:{},appState:{viewBackgroundColor:'#ffffff'}};setLoaded({Component:module.Excalidraw,MainMenu:module.MainMenu,initial:scene.current,change});render();}
    }catch(cause){if(import.meta.env.DEV)console.error('Whiteboard load:',cause);if(!stopped)setError(t('تعذّر تحميل أدوات السبورة.','Unable to load whiteboard tools.'));}}
    setLoaded(null);setError('');load();return()=>{stopped=true;clearTimeout(timer);clearTimeout(saveTimer);if(scene.current)saveMedia(new Blob([JSON.stringify(scene.current)],{type:'application/json'}),{name:'whiteboard.excalidraw'},{id:sceneId}).catch(()=>{});};
  },[sceneId,overlay,revision]);
  if(!loaded)return <section className="video-whiteboard"><p role="status">{error||t('تحميل أدوات الرسم…','Loading drawing tools…')}</p>{error&&<button type="button" onClick={()=>retry(value=>value+1)}>{t('إعادة المحاولة','Retry')}</button>}</section>;
  const {Component,MainMenu}=loaded;
  return <section className="video-whiteboard" aria-label={t('الوايت بورد وأدوات التعليق','Whiteboard and annotation tools')}>
    <div className="video-actions"><button type="button" onClick={()=>{api.current?.updateScene({appState:{currentItemStrokeColor:'#ffd43b',currentItemStrokeWidth:8,currentItemOpacity:35}});api.current?.setActiveTool({type:'freedraw'});}}>{t('قلم التظليل','Highlighter')}</button><button type="button" onClick={()=>{api.current?.updateScene({appState:{currentItemStrokeColor:'#1b1b1f',currentItemStrokeWidth:2,currentItemOpacity:100}});api.current?.setActiveTool({type:'freedraw'});}}>{t('قلم عادي','Regular pen')}</button></div>
    {error&&<p role="alert">{error}</p>}<div className="video-whiteboard-editor"><Component excalidrawAPI={value=>{api.current=value;}} langCode={language==='ar'?'ar-SA':'en'} theme="light" initialData={loaded.initial} onChange={loaded.change} UIOptions={{canvasActions:{export:{saveFileToDisk:true},loadScene:true,saveToActiveFile:false,toggleTheme:false}}}><MainMenu><MainMenu.DefaultItems.LoadScene/><MainMenu.DefaultItems.SaveAsImage/><MainMenu.DefaultItems.ClearCanvas/><MainMenu.DefaultItems.ChangeCanvasBackground/></MainMenu></Component></div>
    <p>{t('قلم، نص، سهم، أشكال، صور، ممحاة، تراجع وإعادة. التعليقات تدخل في الفيديو المسجّل وتُحفظ على هذا الجهاز.','Pen, text, arrows, shapes, images, eraser, undo and redo. Annotations appear in the recording and are saved on this device.')}</p>
  </section>;
}
