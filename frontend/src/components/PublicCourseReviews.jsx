import { useEffect,useState } from 'react';
import { apiBase } from '../services/accountApi';
export default function PublicCourseReviews({courseId,language}){
 const [page,setPage]=useState(1),[state,setState]=useState(null),ar=language==='ar',t=(a,e)=>ar?a:e;
 useEffect(()=>{setPage(1);},[courseId]);
 useEffect(()=>{const c=new AbortController();setState(null);fetch(`${apiBase}/api/courses/public/${courseId}/reviews?page=${page}&pageSize=20`,{credentials:'omit',signal:c.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();if(!c.signal.aborted)setState(data);}).catch(()=>{if(!c.signal.aborted)setState({error:true});});return()=>c.abort();},[courseId,page]);
 return <section className="detail-section"><h2>{t('تقييمات المتعلّمين','Learner reviews')}</h2>{!state?<p role="status">{t('جارٍ التحميل…','Loading…')}</p>:state.error?<p role="alert">{t('تعذّر تحميل التقييمات.','Unable to load reviews.')}</p>:<>{state.items.map(r=><article className="detail-panel" key={r.id}><strong>{r.rating} / 5</strong><p style={{whiteSpace:'pre-wrap'}}>{r.comment}</p>{r.instructorReply&&<blockquote>{r.instructorReply}</blockquote>}</article>)}{state.items.length===0&&<p>{t('لا توجد تقييمات بعد.','No reviews yet.')}</p>}<div className="account-actions"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>{t('السابق','Previous')}</button><button disabled={page*20>=state.totalCount} onClick={()=>setPage(p=>p+1)}>{t('التالي','Next')}</button></div></>}</section>;
}
