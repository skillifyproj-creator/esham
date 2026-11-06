import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import CourseSafetyPanel from '../../components/shared/CourseSafetyPanel';
import { listCourseReports, listSafetyCases, resolveCourseReport } from '../../services/platformModerationApi';
import '../../styles/community.css';
export default function ModerationQueuePage(){
 const {language}=usePreferences(),t=(a,e)=>language==='ar'?a:e;
 const [data,setData]=useState(null),[error,setError]=useState(''),[status,setStatus]=useState('all'),[selected,setSelected]=useState(''),[resolution,setResolution]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[revision,refresh]=useState(0);
 useEffect(()=>{const c=new AbortController();setError('');Promise.all([listCourseReports(false,c.signal),listSafetyCases(c.signal)]).then(([reports,cases])=>{if(!c.signal.aborted){if(!Array.isArray(reports)||!Array.isArray(cases))throw new Error('The server returned an invalid moderation list. Retry the request.');setData({reports,cases})}}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[revision]);
 const labels={pending:t('جديد','New'),reviewing:t('قيد التحقيق','Investigating'),resolved:t('تمت المعالجة','Resolved'),dismissed:t('أُغلق دون مخالفة','Dismissed')};
 const current=data?.reports.find(r=>'r:'+r.id===selected),safety=data?.cases.find(c=>'c:'+c.courseId===selected),item=current||safety;
 const title=row=>language==='ar'?row.titleAr||row.titleEn:row.titleEn||row.titleAr;
 const select=(id,feedback='')=>{setSelected(id);setResolution(feedback||'');setMessage('')};
 async function decide(next){if(!current||busy)return;setBusy(true);setMessage('');try{await resolveCourseReport(current.courseId,current.id,next,resolution.trim(),current.status);setMessage(t('حُفظت النتيجة في الخادم.','Outcome saved on the server.'));refresh(x=>x+1)}catch(e){setMessage(e.message);refresh(x=>x+1)}finally{setBusy(false)}}
 return <section className="community-page"><h1>{t('بلاغات المحتوى وسلامة الدورات','Content reports and course safety')}</h1>
 {error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">{t('جارٍ التحميل…','Loading…')}</p>}
 <label>{t('حالة البلاغ','Report status')}<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">{t('كل الحالات','All statuses')}</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <div className="community-grid"><section className="learner-panel"><h2>{t('طابور المراجعة','Review queue')}</h2>
 {data?.reports.filter(r=>status==='all'||r.status===status).map(r=><button className="report-list-button" key={r.id} onClick={()=>select('r:'+r.id,r.resolution)}><strong>{title(r)}</strong><span>{labels[r.status]} · {new Date(r.createdAt).toLocaleDateString(language)}</span></button>)}
 {data&&!data.reports.some(r=>status==='all'||r.status===status)&&<p>{t('لا توجد بلاغات مطابقة ضمن صلاحياتك.','No matching reports within your permissions.')}</p>}
 <h2>{t('التحذيرات والاعتراضات','Warnings and appeals')}</h2>{data?.cases.map(c=><button key={c.courseId} className="report-list-button" onClick={()=>select('c:'+c.courseId)}><strong>{title(c)}</strong><span>{c.safetyStatus} · {t('اعتراضات معلقة: ','Pending appeals: ')}{c.pendingAppeals}</span></button>)}
 </section>{item&&<section className="learner-panel"><h2>{title(item)}</h2>{current&&<><p>{current.reason}</p><p>{current.description}</p><p>{current.contentLocation}</p><Link to={`/courses/${current.courseId}`}>{t('عرض الدورة','View course')}</Link><label>{t('نتيجة التحقيق','Investigation outcome')}<textarea rows={4} maxLength={4000} value={resolution} onChange={e=>setResolution(e.target.value)}/></label><div className="account-actions">{['reviewing','resolved','dismissed'].map(next=><button className="button button-outline" key={next} disabled={busy||['resolved','dismissed'].includes(current.status)||next===current.status||next!=='reviewing'&&resolution.trim().length<10} onClick={()=>decide(next)}>{labels[next]}</button>)}</div></>}
 {message&&<p role="status">{message}</p>}
 <CourseSafetyPanel key={item.courseId+':'+item.courseVersionId+':'+revision} courseId={item.courseId} courseVersionId={item.courseVersionId} reportId={current?.id} administrator/>
 </section>}</div></section>;
}
