import { useEffect, useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import useAccountProfile from '../../hooks/useAccountProfile';
import { accountId } from '../../data/pointsLedger';
import { courses } from '../../data/courses';
import { courseTasks, readTaskSubmissions, reviewTaskSubmission, TASK_EVENT } from '../../services/taskSubmissions';
import { StoredFileLink } from '../../components/shared/StoredMedia';

export default function InstructorSubmissionsPage() {
  const {language}=usePreferences(),profile=useAccountProfile(),t=(ar,en)=>language==='ar'?ar:en;
  const [,refresh]=useState(0),[selected,setSelected]=useState(''),[feedback,setFeedback]=useState(''),[error,setError]=useState(''),[status,setStatus]=useState('awaitingReview');
  useEffect(()=>{const update=()=>refresh(value=>value+1);window.addEventListener(TASK_EVENT,update);window.addEventListener('storage',update);return()=>{window.removeEventListener(TASK_EVENT,update);window.removeEventListener('storage',update);};},[]);
  const owned=courses.filter(course=>course.instructorId===accountId(profile));
  const list=readTaskSubmissions().filter(item=>owned.some(course=>course.id===item.courseId)&&(!status||item.status===status));
  const current=list.find(item=>item.id===selected),task=courseTasks().find(item=>item.id===current?.taskId);
  function decide(approved){try{reviewTaskSubmission(profile,current.id,approved,feedback);setSelected('');setFeedback('');setError('');refresh(value=>value+1);}catch{setError(t('تعذّر الاعتماد. تحقق من صلاحية الدورة وحالة التسليم وأضف ملاحظة عند طلب تعديل.','Review failed. Check course ownership and submission status; add feedback when requesting revisions.'));}}
  return <main className="container section"><h1>{t('مراجعة تسليمات المتعلّمين','Review learner submissions')}</h1><p>{t('تسليمات الدورات التي تملكها على هذا الجهاز. الاعتماد لا يمنح نقاطًا؛ نقاط التدريس تأتي من التسجيل.','Submissions for courses you own on this device. Approval does not award points; teaching points come from enrollments.')}</p>
    <label>{t('الحالة','Status')} <select value={status} onChange={event=>{setStatus(event.target.value);setSelected('');}}><option value="">{t('الكل','All')}</option><option value="awaitingReview">{t('بانتظار المراجعة','Awaiting review')}</option><option value="completed">{t('معتمدة','Approved')}</option><option value="inProgress">{t('مسودة أو تحتاج تعديلًا','Draft or revision requested')}</option></select></label>
    <div className="community-grid"><section className="learner-panel">{list.length?list.map(item=><button key={item.id} className="report-list-button" onClick={()=>{setSelected(item.id);setFeedback(item.feedback||'');setError('');}}><strong>{item.learnerName}</strong><span>{courses.find(course=>course.id===item.courseId)?.title[language]}</span></button>):<p>{t('لا توجد تسليمات بهذه الحالة.','No submissions match this status.')}</p>}</section>
      {current&&<section className="learner-panel"><h2>{task?.title?.[language]||t('التسليم','Submission')}</h2><p style={{whiteSpace:'pre-wrap'}}>{current.answer}</p>{current.link&&<a href={current.link} target="_blank" rel="noopener noreferrer">{t('فتح العمل','Open work')}</a>}<ul>{current.files?.map(file=><li key={file.id}><StoredFileLink file={file}/></li>)}</ul><label>{t('ملاحظات المراجعة','Review feedback')}<textarea rows={4} value={feedback} maxLength={2000} onChange={event=>setFeedback(event.target.value)} disabled={current.status!=='awaitingReview'}/></label>{current.status==='awaitingReview'&&<div className="account-actions"><button className="button" onClick={()=>decide(true)}>{t('اعتماد المهمة','Approve task')}</button><button className="button button-outline" onClick={()=>decide(false)}>{t('طلب تعديل','Request revision')}</button></div>}{error&&<p role="alert">{error}</p>}</section>}
    </div></main>;
}
