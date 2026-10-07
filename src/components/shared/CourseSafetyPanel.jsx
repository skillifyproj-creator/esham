import { useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import { issueCourseWarning, emptyCourseSafety, readCourseSafety } from '../../services/courseSafety';

export default function CourseSafetyPanel({ courseId, administrator = false }) {
  const { language } = usePreferences();
  const t = (ar,en) => language === 'ar' ? ar : en;
  const key = 'esham-safety-demo:' + courseId;
  const [state,setState] = useState(() => { try { const value=JSON.parse(localStorage.getItem(key)); return readCourseSafety(value); } catch { return emptyCourseSafety(); } });
  const [reason,setReason]=useState(''),[correction,setCorrection]=useState(''),[incident,setIncident]=useState(''),[deadline,setDeadline]=useState(''),[verified,setVerified]=useState(false),[appeal,setAppeal]=useState(''),[message,setMessage]=useState('');
  function save(next) { try { localStorage.setItem(key,JSON.stringify(next)); setState(next); setMessage(t('تم حفظ الإجراء في المعاينة المحلية.','Saved in the local preview.')); } catch { setMessage(t('تعذّر حفظ الإجراء.','Unable to save this action.')); } }
  function warn(event) { event.preventDefault(); try { save(issueCourseWarning(state,{id:incident.trim(),reason:reason.trim(),correction:correction.trim(),deadline,verified})); } catch { setMessage(t('تحقق من البيانات؛ لا يُكرر التحذير لنفس الواقعة ولا يتجاوز ثلاثة.','Check all fields; duplicate incidents and more than three warnings are not allowed.')); } }
  return <section className="instructor-task-card" style={{padding:24,marginBlock:24,border:'1px solid var(--border-color, #ddd)',borderRadius:16}}>
    <h2>{t('سلامة المحتوى وتحذيرات الدورة','Content safety and course warnings')}</h2>
    <p>{t('معاينة للسياسة محفوظة على هذا الجهاز؛ الدورات المرتبطة تستخدم السجل المحلي نفسه. الحسابات الفعلية وفحص AI والإزالة من الخادم غير مربوطين بعد.','Policy preview saved on this device; linked courses share the local record. Real accounts, AI scanning and server removal are not connected yet.')}</p>
    <p>{t('قبل النشر: فحص الصورة والصوت والنص، ثم مراجعة بشرية للحالات المشتبهة. مستوى الخطورة مستقل عن ثقة نموذج AI. التقييمات السيئة والبلاغات تستدعي التحقيق ولا تمنح تحذيرًا تلقائيًا.','Before publication: scan video, audio and transcript, then human review for uncertain cases. Risk is separate from AI confidence. Poor ratings and reports trigger investigation, not automatic warnings.')}</p>
    <strong>{t('التحذيرات المؤكدة: ','Verified warnings: ')}{state.warnings.length}/3</strong>
    <p role="status">{state.status==='archived' ? t('مؤرشف بعد التحذير الثالث؛ تُحفظ أعمال المتعلمين وسجلهم.','Archived after three warnings; learner work and history are preserved.') : state.status==='suspended' ? t('موقوف احترازيًا للمراجعة العاجلة.','Suspended pending urgent review.') : state.enrollmentPaused ? t('تحذير نهائي؛ إيقاف التسجيل الجديد في المعاينة.','Final warning; new enrollment paused in the preview.') : t('لا يوجد إيقاف للدورة في المعاينة.','No course suspension in the preview.')}</p>
    <ol>{state.warnings.map(item=><li key={item.id}><strong>{item.reason}</strong><p>{item.correction} · {item.deadline}</p></li>)}</ol>
    {administrator ? <form onSubmit={warn} style={{display:'grid',gap:12}}>
      <label>{t('معرّف الواقعة (لمنع التكرار)','Incident ID (prevents duplicates)')}<input required maxLength={100} value={incident} onChange={e=>setIncident(e.target.value)}/></label>
      <label>{t('سبب التحذير','Warning reason')}<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
      <label>{t('التصحيح المطلوب','Required correction')}<textarea required maxLength={2000} value={correction} onChange={e=>setCorrection(e.target.value)}/></label>
      <label>{t('موعد التصحيح','Correction deadline')}<input required type="date" min={new Date().toISOString().slice(0,10)} value={deadline} onChange={e=>setDeadline(e.target.value)}/></label>
      <label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>{t('راجعت الأدلة وتأكدت من المخالفة','I reviewed the evidence and verified this violation')}</label>
      <button className="button" disabled={!verified || state.warnings.length>=3}>{t('إصدار تحذير في المعاينة','Issue preview warning')}</button>
      <button className="button secondary" type="button" disabled={state.status==='archived' || !reason.trim() || !verified} onClick={()=>save({...state,status:'suspended',enrollmentPaused:true,suspensionReason:reason})}>{t('إيقاف عاجل لمحتوى خطير مؤكد','Urgent suspension for verified dangerous content')}</button>
    </form> : state.warnings.length>0 && <form onSubmit={e=>{e.preventDefault(); if(appeal.trim()) save({...state,appeal:appeal.trim(),appealStatus:'pending'});}}><label>{t('اعتراض المدرّب','Instructor appeal')}<textarea required maxLength={2000} value={appeal} onChange={e=>setAppeal(e.target.value)}/></label><button className="button">{t('حفظ الاعتراض للمراجعة','Save appeal for review')}</button></form>}
    {state.appeal && <p>{t('اعتراض قيد المراجعة: ','Appeal pending review: ')}{state.appeal}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
