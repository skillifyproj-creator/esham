import { useEffect,useState } from 'react';
import { useParams } from 'react-router';
import { apiBase } from '../services/accountApi';
import { usePreferences } from '../context/PreferencesContext';
import { certificateStatusLabel,formatCertificateDate } from '../services/certificatesApi';
export default function CertificateVerificationPage(){
 const {code}=useParams(),{language}=usePreferences(),[state,setState]=useState(null),t=(a,e)=>language==='ar'?a:e;
 useEffect(()=>{const previous=document.head.querySelector('meta[name="robots"]'),old=previous?.getAttribute('content'),meta=previous||document.createElement('meta');
  meta.name='robots';meta.content='noindex, nofollow';if(!previous)document.head.appendChild(meta);
  return()=>{if(!previous)meta.remove();else if(old===null)meta.removeAttribute('content');else meta.content=old;};
 },[]);
 useEffect(()=>{const controller=new AbortController();setState(null);
  if(!/^[0-9A-F]{48}$/.test(code||'')){setState({code,error:true});return;}
  fetch(`${apiBase}/certificates/verify/${code}`,{credentials:'omit',signal:controller.signal,referrerPolicy:'no-referrer'})
   .then(async r=>{if(!r.ok)throw new Error();const data=await r.json();if(!controller.signal.aborted)setState({code,data});})
   .catch(()=>{if(!controller.signal.aborted)setState({code,error:true});});return()=>controller.abort();
 },[code]);
 return <main className="container section" dir={language==='ar'?'rtl':'ltr'}><h1>{t('التحقق من الشهادة','Certificate verification')}</h1>
 {!state||state.code!==code?<p role="status">{t('جارٍ التحقق…','Verifying…')}</p>:state.error?<p role="alert">{t('تعذر التحقق. تحقق من الرمز أو حاول لاحقًا.','Unable to verify. Check the code or retry later.')}</p>:<article className="learner-panel"><h2>{state.data.status==='issued'?t('شهادة سارية','Valid certificate'):state.data.status==='revoked'?t('شهادة ملغاة','Revoked certificate'):certificateStatusLabel(state.data.status,language)}</h2><p>{state.data.learnerName}</p><p>{language==='ar'?state.data.courseTitleAr||state.data.courseTitleEn:state.data.courseTitleEn||state.data.courseTitleAr}</p><p>{state.data.issuer}</p><time>{formatCertificateDate(state.data.issuedAt,language)}</time></article>}</main>;
}
