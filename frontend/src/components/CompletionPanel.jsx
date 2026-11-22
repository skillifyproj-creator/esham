import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAccountSession } from '../context/AccountSessionContext';
import { usePreferences } from '../context/PreferencesContext';
import { loadCompletion, reconcileCompletion } from '../services/certificatesApi';
export default function CompletionPanel({ enrollmentId }) {
  const account = useAccountSession(), { language } = usePreferences(), id = account.status === 'authenticated' ? account.session.profile.id : null;
  const [state,setState] = useState(null), [revision,reload] = useState(0), busy = useRef(false), generation=useRef(0);
  const t=(a,e)=>language==='ar'?a:e;
  useEffect(()=>{ const controller=new AbortController(), g=++generation.current;setState(null);busy.current=false;
    if(id)loadCompletion(id,enrollmentId,controller.signal).then(data=>{if(g===generation.current)setState({id,enrollmentId,data});})
      .catch(error=>{if(!controller.signal.aborted&&g===generation.current)setState({id,enrollmentId,error});});
    const refresh=()=>reload(x=>x+1);window.addEventListener('focus',refresh);window.addEventListener('esham-learning-updated',refresh);
    return()=>{controller.abort();generation.current++;window.removeEventListener('focus',refresh);window.removeEventListener('esham-learning-updated',refresh);};
  },[id,enrollmentId,revision]);
  if(!state||state.id!==id||state.enrollmentId!==enrollmentId)return <p role="status">{t('جارٍ التحقق من الإكمال…','Checking completion…')}</p>;
  if(state.error)return <p role="alert">{t('تعذر التحقق من الإكمال.','Unable to check completion.')} <button onClick={()=>reload(x=>x+1)}>{t('إعادة المحاولة','Retry')}</button></p>;
  const c=state.data;
  async function reconcile(){if(busy.current)return;busy.current=true;const g=generation.current;setState(s=>({...s,busy:true}));
    try {await reconcileCompletion(id,enrollmentId,c.evaluatedCourseVersionId);if(g===generation.current){window.dispatchEvent(new Event('esham-financial-updated'));window.dispatchEvent(new Event('esham-learning-updated'));reload(x=>x+1);}}
    catch{if(g===generation.current)setState(s=>({...s,mutationError:true,busy:false}));}finally{if(g===generation.current)busy.current=false;}}
  return <section className="learner-panel"><h2>{t('الإكمال والشهادة','Completion and certificate')}</h2>
    <p>{c.completedAt||c.status==='completed'?t('سجل الإكمال محفوظ ولا يُعاد فتح الدورة.','Completion is retained and the enrollment will not be reopened.'):c.eligible?t('اكتملت المتطلبات؛ بانتظار الاعتماد.','Requirements met; awaiting reconciliation.'):t('أكمل الدروس والمهام المطلوبة.','Complete the required lessons and tasks.')}</p>
    <p>{t('الدروس','Lessons')}: {c.earnedRequiredLessonCount}/{c.requiredLessonCount} · {t('المهام المعتمدة','Approved tasks')}: {c.approvedRequiredTaskCount}/{c.requiredTaskCount}</p>
    {c.reasonCode==='no_requirements'&&<p>{t('لا تحتوي الدورة على متطلبات قابلة للاعتماد.','This course has no completion requirements.')}</p>}
    {c.reasonCode==='course_unavailable'&&<p>{t('المحتوى غير متاح حاليًا؛ اعتماد إكمال جديد مؤجل.','Content is currently unavailable; new completion is deferred.')}</p>}
    {c.reasonCode==='historical_completion_ambiguous'&&<p role="alert">{t('يتطلب سجل الإكمال التاريخي مراجعة الإدارة.','The historical completion record requires administrator review.')}</p>}
    {c.eligible&&<button className="button" disabled={!c.reconciliationEnabled||state.busy} onClick={reconcile}>{t('اعتماد الإكمال','Finalize completion')}</button>}
    {!c.reconciliationEnabled&&<p>{t('اعتماد الإكمال غير مفعّل في هذه البيئة.','Completion mutations are disabled in this environment.')}</p>}
    {state.mutationError&&<p role="alert">{t('تعذر الاعتماد. حدّث الصفحة وحاول مجددًا.','Unable to finalize. Refresh and retry.')}</p>}
    {c.certificate&&<Link className="button button-outline" to={`/learner/certificates/record/${c.certificate.id}`}>{c.certificate.status==='revoked'?t('الشهادة ملغاة','Certificate revoked'):t('عرض الشهادة','View certificate')}</Link>}
  </section>;
}
