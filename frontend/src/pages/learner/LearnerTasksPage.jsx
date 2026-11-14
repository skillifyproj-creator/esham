import { useEffect,useRef,useState } from 'react';
import { Link,useParams } from 'react-router';
import { useAccountSession } from '../../context/AccountSessionContext';
import { useLearnerTasks } from '../../context/LearnerTasksContext';
import { usePreferences } from '../../context/PreferencesContext';
import { taskList,attemptHistory,attemptDetail,createAttempt,mutateAttempt,uploadAttemptFile,submissionFileUrl,submissionMessage } from '../../services/learnerSubmissionsApi';
import '../../styles/learner.css';
export default function LearnerTasksPage(){
  const {enrollmentId,taskId,submissionId}=useParams(),account=useAccountSession(),{language}=usePreferences(),list=useLearnerTasks();
  const accountId=account.status==='authenticated'?account.session.profile.id:null,key=`${accountId}:${enrollmentId}:${taskId}:${submissionId}`;
  const [state,setState]=useState(null),[error,setError]=useState(null),[busy,setBusy]=useState(false),[revision,reload]=useState(0),[page,setPage]=useState(1),[answer,setAnswer]=useState(''),[url,setUrl]=useState('');
  const generation=useRef(0),currentKey=useRef(key),controller=useRef(null),intent=useRef(null),uploadIntent=useRef(null),busyRef=useRef(false);currentKey.current=key;
  const visible=state?.key===key?state:null,attempt=visible?.attempt,t=(ar,en)=>language==='ar'?ar:en;
  const title=x=>language==='ar'?x?.titleAr||x?.titleEn:x?.titleEn||x?.titleAr;
  useEffect(()=>{const g=++generation.current,c=new AbortController();controller.current=c;setState(null);setError(null);setBusy(false);busyRef.current=false;setAnswer('');setUrl('');intent.current=null;uploadIntent.current=null;
    if(accountId&&enrollmentId)(async()=>{let selected=submissionId?await attemptDetail(accountId,enrollmentId,submissionId,c.signal):null;
      const tasks=await taskList(accountId,enrollmentId,c.signal),history=await attemptHistory(accountId,enrollmentId,taskId||selected?.courseTaskId,page,c.signal);
      if(!selected)selected=history.items.find(s=>s.status==='inProgress')||history.items[0]||null;
      const task=selected?.task||tasks.items.find(x=>x.id===taskId);
      if(g===generation.current){setState({key,attempt:selected,task,history,tasks});setAnswer(selected?.answerText||'');setUrl(selected?.workUrl||'');}
    })().catch(e=>{if(g===generation.current)setError(e);});
    return()=>{generation.current++;c.abort();};
  },[key,revision,page]);
  async function run(action,operation=''){if(busyRef.current||!visible)return;const g=generation.current,captured=key;busyRef.current=true;setBusy(true);setError(null);
    try{const next=await action();if(g!==generation.current||captured!==currentKey.current)return;
      if(next.id!==visible.attempt?.id)intent.current=null;if(operation==='upload')uploadIntent.current=null;
      setState(s=>({...s,attempt:next,task:next.task,history:{...s.history,items:[next,...s.history.items.filter(x=>x.id!==next.id)]}}));setAnswer(next.answerText||'');setUrl(next.workUrl||'');
      window.dispatchEvent(new Event('esham-tasks-updated'));window.dispatchEvent(new Event('esham-learning-updated'));
    }catch(e){if(g===generation.current){setError(e);if(e.status===401)account.refresh().catch(()=>{});}}
    finally{if(g===generation.current){busyRef.current=false;setBusy(false);}}}
  const saved=()=>!attempt||answer===(attempt.answerText||'')&&url===(attempt.workUrl||'');
  if(!enrollmentId)return <main className="learner-dashboard"><div className="container"><header className="learner-welcome"><h1>{t('المهام التطبيقية','Practical tasks')}</h1><p>{t('مهام دوراتك المحفوظة في الخادم.','Tasks from your persisted enrollments.')}</p></header>
    {list.loading&&<p role="status">{t('جارٍ التحميل…','Loading…')}</p>}{Object.values(list.errors).map((e,i)=><p role="alert" key={i}>{submissionMessage(e,language)}</p>)}
    <section className="learner-task-list">{list.tasks.map(task=><article className="learner-panel learner-task" key={`${task.enrollmentId}:${task.id}`}><h2>{title(task)}</h2><p>{task.isApproved?t('معتمدة','Approved'):task.isOptional?t('اختيارية','Optional'):t('لم تُعتمد بعد','Not yet approved')}</p><Link className="button" to={`/learner/enrollments/${task.enrollmentId}/tasks/${task.id}`}>{t('عرض المهمة','View task')}</Link></article>)}</section>
    {!list.loading&&!list.tasks.length&&<p>{t('لا توجد مهام متاحة في صفحة دوراتي الحالية.','No available tasks on the current My Courses page.')}</p>}</div></main>;
  if(!visible)return <main className="container section"><h1>{t('المهمة والتسليم','Task and submission')}</h1>{error?<p role="alert">{submissionMessage(error,language)}</p>:<p role="status">{t('جارٍ التحميل…','Loading…')}</p>}<button className="button" onClick={()=>reload(n=>n+1)}>{t('تحديث','Reload')}</button></main>;
  const task=visible.task,enabled=visible.tasks.mutationsEnabled,editable=enabled&&attempt?.canEdit&&attempt.courseVersionId===visible.tasks.availableCourseVersionId;
  const status={inProgress:t('قيد التنفيذ','In progress'),awaitingReview:t('بانتظار المراجعة','Awaiting review'),approved:t('معتمدة','Approved'),rejected:t('مرفوضة؛ أنشئ محاولة جديدة','Rejected; create a new attempt')};
  return <main className="learner-dashboard"><div className="container"><header className="learner-welcome"><h1>{title(task)||t('المهام التطبيقية','Practical tasks')}</h1><Link to="/learner/tasks">{t('كل المهام','All tasks')}</Link></header>
    {error&&<p role="alert">{submissionMessage(error,language)}</p>}
    {!enabled&&<p role="status">{t('تغييرات التسليم معطّلة في هذه البيئة.','Submission changes are disabled in this environment.')}</p>}
    {task&&<section className="learner-panel"><h2>{t('تعليمات المهمة الأصلية','Original task instructions')}</h2><p style={{whiteSpace:'pre-wrap'}}>{language==='ar'?task.descriptionAr||task.descriptionEn:task.descriptionEn||task.descriptionAr}</p><p style={{whiteSpace:'pre-wrap'}}>{language==='ar'?task.instructions?.ar||task.instructions?.en:task.instructions?.en||task.instructions?.ar}</p><ul>{task.requirements.map((r,i)=><li key={i}>{language==='ar'?r.ar||r.en:r.en||r.ar}</li>)}</ul>{task.courseVersionId===visible.tasks.availableCourseVersionId&&task.attachments.map(f=><p key={f.id}><a href={submissionFileUrl(f.contentUrl,enrollmentId)}>{f.name}</a></p>)}</section>}
    {attempt&&<section className="learner-panel task-editor" key={attempt.id}><h2>{t('المحاولة','Attempt')} {attempt.attemptNumber} · {status[attempt.status]}</h2>{attempt.isOptionalAtCreation&&<p>{t('محاولة اختيارية؛ لا تلغي إنجازًا سابقًا.','Optional attempt; it cannot revoke an earlier achievement.')}</p>}
      <label>{t('الحل أو شرح التطبيق','Answer or explanation')}<textarea aria-label={t('الحل أو شرح التطبيق','Answer or explanation')} rows={6} maxLength={5000} value={answer} disabled={!editable||busy} onChange={e=>setAnswer(e.target.value)}/></label>
      <label>{t('رابط العمل HTTP/HTTPS','HTTP/HTTPS work URL')}<input aria-label={t('رابط العمل HTTP/HTTPS','HTTP/HTTPS work URL')} type="url" dir="ltr" maxLength={2000} value={url} disabled={!editable||busy} onChange={e=>setUrl(e.target.value)}/></label>
      <p>{t('خمسة ملفات كحد أقصى، 10 MiB للملف: PDF، PNG، JPEG، WebP، TXT، DOCX. DOC غير مدعوم.','Maximum five files, 10 MiB each: PDF, PNG, JPEG, WebP, TXT, DOCX. DOC is unsupported.')}</p>
      <input aria-label={t('رفع ملف','Upload file')} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx" disabled={!editable||busy||!saved()} onChange={e=>{const file=e.target.files[0];e.target.value='';if(!file)return;uploadIntent.current={file,id:crypto.randomUUID(),attemptId:attempt.id};run(()=>uploadAttemptFile(accountId,enrollmentId,attempt,file,uploadIntent.current.id,controller.current.signal),'upload');}}/>
      {attempt.attachments.map(f=><p key={f.id}><a href={submissionFileUrl(f.contentUrl,enrollmentId)}>{f.name}</a> {editable&&<button disabled={busy||!saved()} onClick={()=>run(()=>mutateAttempt(accountId,enrollmentId,attempt,'remove',{attachmentId:f.id},controller.current.signal))}>{t('إزالة','Remove')}</button>}</p>)}
      {editable&&error&&uploadIntent.current?.attemptId===attempt.id&&<button className="button button-outline" disabled={busy} onClick={()=>run(()=>uploadAttemptFile(accountId,enrollmentId,attempt,uploadIntent.current.file,uploadIntent.current.id,controller.current.signal),'upload')}>{t('إعادة محاولة نفس الرفع','Retry same upload')}</button>}
      {editable&&<div className="task-editor-actions"><button className="button button-outline" disabled={busy} onClick={()=>run(()=>mutateAttempt(accountId,enrollmentId,attempt,'draft',{answerText:answer,workUrl:url},controller.current.signal))}>{t('حفظ المسودة','Save draft')}</button><button className="button" disabled={busy||!saved()} onClick={()=>run(()=>mutateAttempt(accountId,enrollmentId,attempt,'submit',{},controller.current.signal))}>{t('تسليم المهمة','Submit task')}</button></div>}
      {!saved()&&<p>{t('احفظ المسودة قبل الرفع أو التسليم.','Save the draft before uploading or submitting.')}</p>}
      {attempt.reviews.map(r=><section key={r.id}><h3>{status[r.decision]}</h3><p style={{whiteSpace:'pre-wrap'}}>{r.feedback}</p><time>{new Intl.DateTimeFormat(language,{dateStyle:'medium'}).format(new Date(r.reviewedAt))}</time></section>)}
    </section>}
    {task&&enabled&&(!attempt||['approved','rejected'].includes(attempt.status)||!attempt.canEdit&&attempt.status==='inProgress')&&<button className="button" disabled={busy||!visible.tasks.items.some(t=>t.id===task.id)} onClick={()=>{intent.current??=crypto.randomUUID();run(()=>createAttempt(accountId,enrollmentId,task.id,visible.tasks.availableCourseVersionId,intent.current,controller.current.signal));}}>{t('إنشاء محاولة جديدة','Create new attempt')}</button>}
    <section className="learner-panel"><h2>{t('سجل المحاولات','Attempt history')}</h2>{visible.history.items.map(s=><p key={s.id}><Link to={`/learner/enrollments/${enrollmentId}/submissions/${s.id}`}>{t('المحاولة','Attempt')} {s.attemptNumber} · {status[s.status]}</Link></p>)}<div className="account-actions"><button disabled={page<=1||busy} onClick={()=>setPage(p=>p-1)}>{t('السابق','Previous')}</button><span>{page}</span><button disabled={page*20>=visible.history.totalCount||busy} onClick={()=>setPage(p=>p+1)}>{t('التالي','Next')}</button><button disabled={busy} onClick={()=>reload(n=>n+1)}>{t('تحديث الحالة','Reload state')}</button></div></section>
    <Link to={`/learner/enrollments/${enrollmentId}/learn`}>{t('العودة إلى التعلم','Back to learning')}</Link>
  </div></main>;
}
