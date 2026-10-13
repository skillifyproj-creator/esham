import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { PreferencesProvider } from '../src/context/PreferencesContext';
import { screenVideo } from '../src/services/videoScreening';
import { inspectVideo } from '../src/services/videoProcessing';
import VideoScreeningPanel from '../src/components/video/VideoScreeningPanel';
import '../src/styles/global.css';
import '../src/styles/lesson-video-workflow.css';
function Fixture() {
  const [blob, setBlob] = useState(null), [metadata, setMetadata] = useState(null), [progress, setProgress] = useState(null), [running, setRunning] = useState(false), [error, setError] = useState('');
  const abort = useRef(null);
  const [scenario, setScenario] = useState('lesson'), [url, setUrl] = useState('');
  useEffect(() => { if (!blob) return; const value=URL.createObjectURL(blob); setUrl(value); return () => URL.revokeObjectURL(value); }, [blob]);
  useEffect(() => () => abort.current?.abort(), []);
  async function generate() {
    setRunning(true); setError('');
    try {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(10), track = stream.getVideoTracks()[0];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const finished = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start(100);
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = scenario === 'lesson' ? '#ffffff' : '#202735'; ctx.fillRect(0, 0, 640, 360);
        if (scenario === 'lesson') {
          ctx.fillStyle = '#243746'; ctx.font = '32px Arial'; ctx.fillText('Educational whiteboard', 60, 80); ctx.fillText(`2 + 2 = 4     Frame ${i}`, 60, 160);
          ctx.strokeStyle = '#40634a'; ctx.strokeRect(60, 200, 200 + i, 80);
        } else {
          // A synthetic diagram, not footage of a person attempting a dangerous action.
          ctx.fillStyle = '#c9bda0'; ctx.fillRect(280, 235, 64, 100);
          ctx.fillStyle = '#fff5b8'; ctx.fillRect(310, 224, 5, 20);
          const flame = (x,y,size,color) => {ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x-size,y+size,x-size,y+size*2,x,y+size*2);ctx.bezierCurveTo(x+size,y+size*2,x+size,y+size,x,y);ctx.fill();};
          flame(313+i%3,105,62,'#ff6b19'); flame(313,153,35,'#ffdc39');
          if (scenario === 'hand-fire') {
            ctx.strokeStyle = '#e8b795'; ctx.lineWidth = 42; ctx.lineCap = 'round'; ctx.beginPath();ctx.moveTo(620,176);ctx.lineTo(421,176);ctx.stroke();
            ctx.fillStyle = '#e8b795';ctx.beginPath();ctx.ellipse(402,174,54,36,0,0,Math.PI*2);ctx.fill();
            ctx.lineWidth=12; for(let finger=0;finger<4;finger++){ctx.beginPath();ctx.moveTo(390,150+finger*14);ctx.lineTo(335,143+finger*15);ctx.stroke();}
            ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(418,194);ctx.lineTo(382,223);ctx.stroke();
          }
        }
        track.requestFrame?.(); await new Promise(resolve => setTimeout(resolve, 100));
      }
      recorder.stop(); await finished; stream.getTracks().forEach(item => item.stop());
      const file = new Blob(chunks, { type: 'video/webm' }); setBlob(file);
      setMetadata({ ...(await inspectVideo(file)), mediaId: crypto.randomUUID(), name: `Generated ${scenario} simulation` });
    } catch (cause) { setError(cause.message); } finally { setRunning(false); }
  }
  async function scan() {
    setRunning(true); setError(''); abort.current = new AbortController();
    try { const screening = await screenVideo(blob, metadata, { signal: abort.current.signal, onProgress: setProgress }); setMetadata({ ...metadata, screening }); }
    catch (cause) { setError(cause.name === 'AbortError' ? 'Cancelled' : cause.message); }
    finally { setRunning(false); }
  }
  return <main className="container section"><h1>Real local video AI test</h1><p>This development fixture generates a real WebM and runs the production worker/model. No fake inference.</p><label>Safe simulation <select aria-label="Safe simulation" value={scenario} disabled={running} onChange={event=>setScenario(event.target.value)}><option value="lesson">Educational whiteboard</option><option value="candle">Candle without a person</option><option value="hand-fire">Illustrated hand near a candle flame</option></select></label><button className="button" disabled={running} onClick={generate}>Generate safe simulation clip</button>{url&&<video src={url} controls playsInline style={{width:"100%",maxWidth:640}}/>}{error && <p role="alert">{error}</p>}<VideoScreeningPanel video={metadata} running={running && Boolean(metadata)} progress={progress} disabled={running} onScan={scan} onCancel={() => abort.current?.abort()} onSeek={() => {}}/><output data-testid="scan-result">{JSON.stringify(metadata?.screening || null)}</output></main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')).render(<PreferencesProvider><Fixture/></PreferencesProvider>);
