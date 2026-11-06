import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { apiBase } from '../../services/accountApi';
import { listCourseReviews, loadCourseReview, decideCourseReview, reviewStatusLabel } from '../../services/courseReviewApi';
import '../../styles/course-review-workflow.css';
const text = (value, language) => value?.[language] || value?.en || value?.ar || '';
export function CourseReviewQueue({ pendingOnly = false }) {
 const { language } = usePreferences(), ar = language === 'ar', t = (a,e) => ar ? a : e;
 const location = useLocation(), prefix = location.pathname.startsWith('/admin') ? '/admin' : '/category-admin';
 const [status,setStatus] = useState(pendingOnly ? 'pending' : new URLSearchParams(location.search).get('status') || '');
 const [state,setState] = useState({ rows: [], loading: true, error: '' }), [revision,refresh] = useState(0);
 useEffect(() => { const controller = new AbortController(); setState({rows:[],loading:true,error:''});
  listCourseReviews(status,controller.signal).then(rows=>{if(!controller.signal.aborted)setState({rows,loading:false,error:''})}).catch(error=>{if(!controller.signal.aborted)setState({rows:[],loading:false,error:error.message})});
  return ()=>controller.abort();
 },[status,revision]);
 return <section className="course-review-workflow" dir={ar?'rtl':'ltr'}><h1>{t('مراجعة الدورات','Course reviews')}</h1>
 <p>{t('الإصدارات المرسلة ضمن صلاحيات حسابك فقط.','Submitted versions within your account permissions only.')}</p>
 <div className="review-toolbar"><label>{t('الحالة','Status')} <select value={status} onChange={e=>setStatus(e.target.value)}>
 <option value="">{t('كل الحالات','All statuses')}</option>{['pending','approved','rejected','changes_requested'].map(x=><option key={x} value={x}>{reviewStatusLabel(x,language)}</option>)}</select></label>
 <button className="button button-outline" onClick={()=>refresh(x=>x+1)}>{t('تحديث','Refresh')}</button></div>
 {state.loading && <p role="status">{t('جارٍ التحميل…','Loading…')}</p>}{state.error && <p role="alert">{state.error}</p>}
 {!state.loading&&!state.error&&!state.rows.length&&<p>{t('لا توجد إصدارات مطابقة.','No matching submissions.')}</p>}
 <div className="review-queue">{state.rows.map(row=><article className="review-panel" key={row.courseVersionId}>
 <h2>{ar?row.titleAr||row.titleEn:row.titleEn||row.titleAr}</h2><p>{row.ownerName} · {ar?row.categoryNameAr:row.categoryNameEn} · {t('الإصدار','Version')} {row.versionNumber}</p>
 <p>{reviewStatusLabel(row.reviewStatus,language)}{row.publishedVersionId===row.courseVersionId?' · '+t('منشور','Published'):''}</p>
 <Link className="button button-outline" to={`${prefix}/courses/${row.courseId}/review?version=${row.courseVersionId}`}>{t('عرض الإرسال','View submission')}</Link></article>)}</div></section>;
}
export function CourseReviewAdminDetail() {
 const {courseId}=useParams(), location=useLocation(), versionId=new URLSearchParams(location.search).get('version');
 const {language}=usePreferences(), ar=language==='ar', t=(a,e)=>ar?a:e;
 const [state,setState]=useState({data:null,error:''}),[revision,refresh]=useState(0),[comment,setComment]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{const c=new AbortController();setState({data:null,error:''});loadCourseReview(courseId,c.signal,versionId).then(data=>setState({data,error:''})).catch(e=>{if(!c.signal.aborted)setState({data:null,error:e.message})});return()=>c.abort()},[courseId,versionId,revision]);
 async function decide(decision){if(busy)return;setBusy(true);setMessage('');try{await decideCourseReview(courseId,state.data.version.id,decision,comment);setComment('');setMessage(t('تم حفظ قرار المراجعة.','Review decision saved.'));refresh(x=>x+1)}catch(e){setMessage(e.message);refresh(x=>x+1)}finally{setBusy(false)}}
 if(!state.data)return <p role={state.error?'alert':'status'}>{state.error||t('جارٍ تحميل الإرسال…','Loading submission…')}</p>;
 const d=state.data,v=d.version,url=item=>apiBase+item.contentUrl,cover=d.media.find(x=>!x.lessonId&&!x.taskId&&x.mediaType==='image');
 return <section className="course-review-workflow" dir={ar?'rtl':'ltr'}>
 <Link to={location.pathname.startsWith('/admin')?'/admin/courses':'/category-admin/courses'}>{t('العودة للدورات','Back to courses')}</Link>
 <h1>{ar?v.titleAr||v.titleEn:v.titleEn||v.titleAr}</h1><p data-review-status={v.reviewStatus}>{reviewStatusLabel(v.reviewStatus,language)} · {t('الإصدار','Version')} {v.versionNumber}{d.publishedVersionId===v.id?' · '+t('منشور','Published'):''}</p>
 {cover&&<img className="review-cover" src={url(cover)} alt={t('غلاف الدورة','Course cover')}/>}
 <div className="review-panel"><h2>{t('معلومات الدورة','Course information')}</h2><p>{ar?v.descriptionAr||v.descriptionEn:v.descriptionEn||v.descriptionAr}</p><p>{v.language} · {v.level}</p><ul>{v.objectives.map((x,i)=><li key={i}>{text(x,language)}</li>)}</ul></div>
 {d.sections.map(section=><section className="review-panel" key={section.id}><h2>{ar?section.titleAr||section.titleEn:section.titleEn||section.titleAr}</h2>
 {section.lessons.map(lesson=><article className="review-lesson" key={lesson.id}><h3>{ar?lesson.titleAr||lesson.titleEn:lesson.titleEn||lesson.titleAr}</h3><p>{ar?lesson.descriptionAr||lesson.descriptionEn:lesson.descriptionEn||lesson.descriptionAr}</p><p>{lesson.durationSeconds/60} {t('دقيقة','minutes')}</p>
 <ul>{lesson.objectives.map((x,i)=><li key={i}>{text(x,language)}</li>)}</ul>
 {d.media.filter(x=>x.lessonId===lesson.id).map(m=>m.mediaType==='video'?<video key={m.id} controls preload="metadata" src={url(m)}/>:<a key={m.id} href={url(m)} target="_blank" rel="noreferrer">{m.displayName}</a>)}</article>)}</section>)}
 <section className="review-panel"><h2>{t('المهام العملية','Practical tasks')}</h2>{d.tasks.map(task=><article className="review-lesson" key={task.id}><h3>{ar?task.titleAr||task.titleEn:task.titleEn||task.titleAr}</h3><p>{ar?task.descriptionAr||task.descriptionEn:task.descriptionEn||task.descriptionAr}</p><p>{text(task.instructions,language)}</p><ul>{task.requirements.map((x,i)=><li key={i}>{text(x,language)}</li>)}</ul>{d.media.filter(x=>x.taskId===task.id).map(m=><a key={m.id} href={url(m)} target="_blank" rel="noreferrer">{m.displayName}</a>)}</article>)}</section>
 <section className="review-panel"><h2>{t('قرارات المراجعة والملاحظات','Review decisions and feedback')}</h2>{d.decisions.map(x=><article key={x.id}><strong>{reviewStatusLabel(x.decision,language)}</strong><p>{x.comment}</p><time>{new Date(x.reviewedAt).toLocaleString(ar?'ar':'en')}</time></article>)}{!d.decisions.length&&<p>{t('لا توجد قرارات بعد.','No decisions yet.')}</p>}</section>
 {location.pathname.startsWith('/admin')&&!d.canReview&&<p className="review-panel" role="note">{t('الإدارة العامة تتابع جميع الإرسالات. قرارات الاعتماد والنشر والرفض متاحة لمدير التصنيف المعيّن فقط.','GeneralAdmin can inspect all submissions. Approval, publication and rejection decisions require the assigned CategoryAdmin.')}</p>}
 {message&&<p role="status">{message}</p>}
 {d.canReview&&<form className="review-panel" onSubmit={e=>e.preventDefault()}><label>{t('ملاحظات المراجعة (مطلوبة للرفض أو طلب التعديل)','Review feedback (required for rejection or changes)')}<textarea value={comment} maxLength={4000} disabled={busy} onChange={e=>setComment(e.target.value)}/></label>
 <div className="review-toolbar"><button className="button" type="button" disabled={busy} onClick={()=>decide('approved')}>{t('اعتماد ونشر الإصدار','Approve and publish version')}</button>
 <button className="button button-outline" type="button" disabled={busy||!comment.trim()} onClick={()=>decide('changes_requested')}>{t('طلب تعديلات','Request changes')}</button>
 <button className="button button-outline" type="button" disabled={busy||!comment.trim()} onClick={()=>decide('rejected')}>{t('رفض','Reject')}</button></div></form>}
 </section>;
}
