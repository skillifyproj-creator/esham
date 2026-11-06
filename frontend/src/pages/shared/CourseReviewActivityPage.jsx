import { useEffect, useState } from 'react';
import { listAdminActivity } from '../../services/platformModerationApi';
import { usePreferences } from '../../context/PreferencesContext';
export default function CourseReviewActivityPage(){
 const {language}=usePreferences(),ar=language==='ar';const [state,setState]=useState({rows:null,error:''});
 useEffect(()=>{const c=new AbortController();listAdminActivity(c.signal).then(rows=>{if(!c.signal.aborted){if(!Array.isArray(rows))throw new Error('The server returned an invalid activity list. Reload the page.');setState({rows,error:''})}}).catch(e=>{if(!c.signal.aborted)setState({rows:null,error:e.message})});return()=>c.abort()},[]);
 return <section className="course-review-workflow"><h1>{ar?'سجل النشاط الإداري':'Admin activity'}</h1>{state.error&&<p role="alert">{state.error}</p>}{!state.rows&&!state.error&&<p role="status">{ar?'جارٍ التحميل…':'Loading…'}</p>}{state.rows?.map(x=><article className="review-panel" key={x.id}><strong>{x.actorName} · {x.targetName||x.targetType}</strong><p>{x.action} · {x.previousState} → {x.newState}</p><p>{x.details}</p><time>{new Date(x.createdAt).toLocaleString(ar?'ar':'en')}</time></article>)}</section>;
}
