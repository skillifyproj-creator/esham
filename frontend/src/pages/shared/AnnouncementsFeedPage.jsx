import { useEffect,useState } from 'react';
import { Link,useParams } from 'react-router';
import { useAccountSession } from '../../context/AccountSessionContext';
import { usePreferences } from '../../context/PreferencesContext';
import { bindAccount,financialRequest } from '../../services/financialApi';
export default function AnnouncementsFeedPage(){
 const session=useAccountSession(),account=session.status==='authenticated'?session.session.profile.id:null,{id}=useParams(),{language}=usePreferences(),ar=language==='ar',t=(a,e)=>ar?a:e;
 const [page,setPage]=useState(1),[state,setState]=useState(null);
 useEffect(()=>{const c=new AbortController();setState(null);if(account)financialRequest(`/me/announcements${id?'/'+id:`?page=${page}&pageSize=20`}`,{signal:c.signal}).then(data=>{bindAccount(data,account);if(!c.signal.aborted)setState({...data,id});}).catch(()=>{if(!c.signal.aborted)setState({accountId:account,error:true,id});});return()=>c.abort();},[account,page,id]);
 const visible=state?.accountId===account&&state?.id===id?state:null;
 return <main className="container section" dir={ar?'rtl':'ltr'}><h1>{t('الإعلانات','Announcements')}</h1>{!account?<Link to="/login">{t('تسجيل الدخول','Sign in')}</Link>:!visible?<p role="status">{t('جارٍ التحميل…','Loading…')}</p>:visible.error?<p role="alert">{t('تعذّر تحميل الإعلانات.','Unable to load announcements.')}</p>:<>{visible.items.map(a=><article className="learner-panel" key={a.id}><h2><Link to={`/announcements/${a.id}`}>{ar?a.titleAr||a.titleEn:a.titleEn||a.titleAr}</Link></h2><p style={{whiteSpace:'pre-wrap'}}>{ar?a.contentAr||a.contentEn:a.contentEn||a.contentAr}</p></article>)}{!visible.items.length&&<p>{t('لا توجد إعلانات متاحة.','No announcements available.')}</p>}{!id&&<div className="account-actions"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>{t('السابق','Previous')}</button><span>{page}</span><button disabled={page*20>=visible.totalCount} onClick={()=>setPage(p=>p+1)}>{t('التالي','Next')}</button></div>}</>}</main>;
}
