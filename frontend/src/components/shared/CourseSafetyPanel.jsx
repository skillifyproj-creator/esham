import { useEffect, useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import { loadCourseSafety, issueWarning, suspendCourse, submitAppeal, decideAppeal } from '../../services/platformModerationApi';
export default function CourseSafetyPanel({courseId,courseVersionId,reportId,administrator=false}){
 const {language}=usePreferences(),t=(a,e)=>language==='ar'?a:e;
 const [state,setState]=useState(null),[error,setError]=useState(''),[revision,refresh]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [reason,setReason]=useState(''),[correction,setCorrection]=useState(''),[incident,setIncident]=useState(''),[deadline,setDeadline]=useState(''),[verified,setVerified]=useState(false),[appeal,setAppeal]=useState(''),[warningId,setWarningId]=useState(''),[comments,setComments]=useState({});
 useEffect(()=>{const c=new AbortController();setState(null);setError('');loadCourseSafety(courseId,courseVersionId,c.signal).then(setState).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[courseId,courseVersionId,revision]);
 async function act(run){if(busy)return;setBusy(true);setMessage('');try{await run();setMessage(t('تم حفظ الإجراء في الخادم.','Action saved on the server.'));refresh(x=>x+1)}catch(e){setMessage(e.message);refresh(x=>x+1)}finally{setBusy(false)}}
 if(error)return <p role="alert">{error}</p>;
 if(!state)return <p role="status">{t('جارٍ تحميل سجل السلامة…','Loading safety history…')}</p>;
 const version=courseVersionId||state.publishedVersionId;
 return <section className="instructor-task-card" style={{padding:24,marginBlock:24,border:'1px solid var(--border-color, #ddd)',borderRadius:16}}>
 <h2>{t('سلامة المحتوى وتحذيرات الدورة','Content safety and course warnings')}</h2>
 <p>{t('البلاغات تستدعي التحقيق، ولا تمنح تحذيرًا تلقائيًا.','Reports trigger investigation, never automatic warnings.')}</p>
 <strong>{t('التحذيرات المسجلة: ','Recorded warnings: ')}{state.warnings.length}/3</strong>
 <p>{state.safetyStatus} · {state.enrollmentPaused?t('التسجيل الجديد متوقف','New enrollment paused'):t('التسجيل غير متوقف','Enrollment not paused')}</p>
 <ol>{state.warnings.map(w=><li key={w.id}><strong>{w.reason}</strong><p>{w.requiredCorrection} · {w.deadline&&new Date(w.deadline).toLocaleDateString(language)}</p></li>)}</ol>
 {administrator&&state.canModerate&&<form onSubmit={e=>{e.preventDefault();act(()=>issueWarning(courseId,{courseVersionId:version,incidentKey:incident.trim(),reason:reason.trim(),requiredCorrection:correction.trim(),deadline:new Date(deadline+'T23:59:59').toISOString(),verified,courseReportId:reportId||null}))}} style={{display:'grid',gap:12}}>
 <label>{t('معرّف الواقعة','Incident ID')}<input required maxLength={200} value={incident} onChange={e=>setIncident(e.target.value)}/></label>
 <label>{t('سبب التحذير','Warning reason')}<textarea required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <label>{t('التصحيح المطلوب','Required correction')}<textarea required maxLength={4000} value={correction} onChange={e=>setCorrection(e.target.value)}/></label>
 <label>{t('موعد التصحيح','Correction deadline')}<input required type="date" min={new Date().toISOString().slice(0,10)} value={deadline} onChange={e=>setDeadline(e.target.value)}/></label>
 <label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>{t('راجعت الأدلة وتأكدت من المخالفة','I reviewed the evidence and verified this violation')}</label>
 <button className="button" disabled={busy||!verified||!version||state.warnings.length>=3}>{t('إصدار تحذير','Issue warning')}</button>
 <button type="button" className="button secondary" disabled={busy||!verified||reason.trim().length<10||state.safetyStatus!=='active'||!version} onClick={()=>act(()=>suspendCourse(courseId,{courseVersionId:version,reason:reason.trim(),verified}))}>{t('إيقاف عاجل','Urgent suspension')}</button></form>}
 {!administrator&&state.canAppeal&&state.warnings.length>0&&<form onSubmit={e=>{e.preventDefault();act(()=>submitAppeal(courseId,warningId,appeal.trim()))}}>
 <label>{t('التحذير','Warning')}<select aria-label={t('التحذير','Warning')} required value={warningId} onChange={e=>setWarningId(e.target.value)}><option value="">—</option>{state.warnings.filter(w=>!state.appeals.some(a=>a.courseWarningId===w.id)).map(w=><option key={w.id} value={w.id}>{w.warningNumber} · {w.reason}</option>)}</select></label>
 <label>{t('اعتراض المدرّب','Instructor appeal')}<textarea required minLength={10} maxLength={4000} value={appeal} onChange={e=>setAppeal(e.target.value)}/></label><button className="button" disabled={busy||!warningId}>{t('إرسال الاعتراض','Submit appeal')}</button></form>}
 {state.appeals.map(a=><article className="review-feedback" key={a.id}><strong>{a.status}</strong><p>{a.explanation}</p><p>{a.decisionComment}</p>{administrator&&state.canDecideAppeals&&a.status==='pending'&&<><label>{t('سبب القرار النهائي','Final decision reasoning')}<textarea maxLength={4000} value={comments[a.id]||''} onChange={e=>setComments(v=>({...v,[a.id]:e.target.value}))}/></label>{['accepted','rejected'].map(decision=><button key={decision} type="button" className="button button-outline" disabled={busy||(comments[a.id]||'').trim().length<10} onClick={()=>act(()=>decideAppeal(courseId,a.id,decision,comments[a.id]))}>{decision==='accepted'?t('قبول الاعتراض','Accept appeal'):t('رفض الاعتراض','Reject appeal')}</button>)}<p>{t('القرار يحفظ السجل ولا يعيد تفعيل الدورة تلقائيًا.','The decision retains history and does not automatically reinstate the course.')}</p></>}</article>)}
 {message&&<p role="status">{message}</p>}
 </section>;
}
