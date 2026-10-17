import { useEffect, useRef, useState } from 'react';

// The overlay and recording share the same 1280 × 720 coordinate space.
export default function ScreenAnnotations({ language, enabled, onEnabled, onFrame, children }) {
  const t = (ar, en) => language === 'ar' ? ar : en;
  const canvas = useRef(null), actions = useRef([]), undone = useRef([]), drawing = useRef(null);
  const latest = useRef(onFrame); latest.current = onFrame;
  const [tool, setTool] = useState('pen'), [color, setColor] = useState('#e03131'), [text, setText] = useState('');
  const [revision, setRevision] = useState(0);
  function render() {
    const target = canvas.current;
    if (!target) return;
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, target.width, target.height);
    for (const action of [...actions.current, ...(drawing.current ? [drawing.current] : [])]) {
      ctx.save();
      ctx.globalCompositeOperation = action.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.globalAlpha = action.tool === 'highlight' ? .3 : 1;
      ctx.strokeStyle = ctx.fillStyle = action.color;
      ctx.lineWidth = action.tool === 'highlight' ? 24 : action.tool === 'eraser' ? 32 : 4;
      ctx.lineCap = ctx.lineJoin = 'round';
      const [first, ...rest] = action.points;
      if (action.tool === 'text') {
        ctx.font = '28px sans-serif'; ctx.textBaseline = 'top';
        ctx.direction = language === 'ar' ? 'rtl' : 'ltr';
        ctx.textAlign = language === 'ar' ? 'right' : 'left';
        ctx.fillText(action.text, first.x, first.y);
      } else {
        ctx.beginPath(); ctx.moveTo(first.x, first.y);
        for (const point of rest) ctx.lineTo(point.x, point.y);
        if (!rest.length) ctx.lineTo(first.x + .1, first.y);
        ctx.stroke();
      }
      ctx.restore();
    }
    latest.current(target);
  }
  useEffect(() => { render(); return () => latest.current(null); }, []);
  function point(event) {
    const rect = canvas.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1280, (event.clientX - rect.left) * 1280 / rect.width)), y: Math.max(0, Math.min(720, (event.clientY - rect.top) * 720 / rect.height)) };
  }
  function finish(event, cancel = false) {
    if (!drawing.current || drawing.current.pointerId !== event.pointerId) return;
    if (!cancel) { actions.current.push(drawing.current); undone.current = []; }
    drawing.current = null; render(); setRevision(value => value + 1);
  }
  return <>
    <div className="video-annotation-tools" aria-label={t('أدوات التعليق على شاشة العرض', 'Preview annotation tools')}>
      <label><input type="checkbox" checked={enabled} onChange={event => onEnabled(event.target.checked)}/>{t('الكتابة والرسم على شاشة العرض', 'Write and draw on the preview')}</label>
      {enabled && <>
        <div className="video-annotation-buttons">{[['pen', t('قلم', 'Pen')], ['highlight', t('تظليل', 'Highlighter')], ['text', t('نص', 'Text')], ['eraser', t('ممحاة', 'Eraser')]].map(([value, label]) => <button type="button" key={value} aria-pressed={tool === value} onClick={() => setTool(value)}>{label}</button>)}</div>
        <label>{t('لون الرسم', 'Drawing color')}<input type="color" value={color} onChange={event => setColor(event.target.value)}/></label>
        {tool === 'text' && <label>{t('اكتب النص ثم اضغط مكانه على العرض', 'Enter text, then click its position on the preview')}<input value={text} maxLength={160} onChange={event => setText(event.target.value)}/></label>}
        <div className="video-annotation-buttons" data-revision={revision}>
          <button type="button" disabled={!actions.current.length} onClick={() => { undone.current.push(actions.current.pop()); render(); setRevision(value => value + 1); }}>{t('تراجع', 'Undo')}</button>
          <button type="button" disabled={!undone.current.length} onClick={() => { actions.current.push(undone.current.pop()); render(); setRevision(value => value + 1); }}>{t('إعادة', 'Redo')}</button>
          <button type="button" disabled={!actions.current.length} onClick={() => { actions.current = []; undone.current = []; render(); setRevision(value => value + 1); }}>{t('مسح التعليقات', 'Clear annotations')}</button>
        </div>
      </>}
    </div>
    <div className="video-stage">
      {children}
      <canvas ref={canvas} width={1280} height={720} className="video-preview-annotations" style={{ pointerEvents: enabled ? 'auto' : 'none' }} aria-label={t('مساحة الرسم فوق العرض', 'Draw over the preview')}
        onPointerDown={event => {
          if (!enabled || drawing.current || (event.pointerType === 'mouse' && event.button !== 0) || (tool === 'text' && !text.trim())) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = { tool, color, text: text.trim(), points: [point(event)], pointerId: event.pointerId };
          render();
        }}
        onPointerMove={event => { if (drawing.current?.pointerId === event.pointerId && drawing.current.tool !== 'text') { drawing.current.points.push(point(event)); render(); } }}
        onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}/>
    </div>
  </>;
}
