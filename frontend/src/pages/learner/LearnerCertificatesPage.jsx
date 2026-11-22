import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import ThemeLogo from '../../components/ThemeLogo';
import { useAccountSession } from '../../context/AccountSessionContext';
import { usePreferences } from '../../context/PreferencesContext';
import { loadCertificates, loadCertificate, certificatePdfData, certificateStatusLabel, formatCertificateDate } from '../../services/certificatesApi';
import { createCertificatePdf, downloadBlob } from '../../services/certificatePdf';
import logo from '../../assets/esham-logo.png';
import '../../styles/certificates.css';
export default function LearnerCertificatesPage(){
 const account=useAccountSession(),{language}=usePreferences(),{certificateId,courseId}=useParams();
 const id=account.status==='authenticated'?account.session.profile.id:null;
 const [state,setState]=useState(null),[page,setPage]=useState(1),[revision,reload]=useState(0),[pdfLanguage,setPdfLanguage]=useState(language);
 const current=useRef(null),busy=useRef(false),epoch=useRef(0);current.current=`${id}:${certificateId||courseId||''}:${page}`;
 const t=(a,e)=>language==='ar'?a:e,ct=(a,e)=>pdfLanguage==='ar'?a:e;
 useEffect(()=>{const controller=new AbortController(),key=current.current;setState(null);busy.current=false;
  if(id)(certificateId?loadCertificate(id,certificateId,controller.signal):loadCertificates(id,page,controller.signal))
   .then(data=>{if(!controller.signal.aborted&&current.current===key)setState({key,data});})
   .catch(error=>{if(!controller.signal.aborted&&current.current===key)setState({key,error});});
  return()=>{controller.abort();epoch.current++;};
 },[id,certificateId,courseId,page,revision]);
 const visible=state?.key===current.current?state:null,c=certificateId?visible?.data:null;
 async function download(){if(busy.current||!c||c.status!=='issued')return;busy.current=true;const key=current.current, token=epoch.current;setState(s=>({...s,busy:true,pdfError:false}));
  try {const fresh=await loadCertificate(id,c.id);if(current.current!==key||epoch.current!==token)return;
   if(fresh.status!=='issued'){setState(s=>({...s,data:fresh}));return;}
   const blob=await createCertificatePdf(certificatePdfData(fresh,pdfLanguage,logo));
   const confirmed=await loadCertificate(id,c.id);if(current.current!==key||epoch.current!==token)return;
   if(confirmed.status!=='issued'){setState(s=>({...s,data:confirmed}));return;}
   downloadBlob(blob,`esham-certificate-${c.id}-${pdfLanguage}.pdf`);
  }catch{if(current.current===key&&epoch.current===token)setState(s=>({...s,pdfError:true}));}finally{if(current.current===key&&epoch.current===token){busy.current=false;setState(s=>({...s,busy:false}));}}
 }
 if(!id && account.status!=="loading")return <main className="container section"><h1>{t('شهاداتي','My certificates')}</h1><p>{t('سجل الدخول لعرض شهاداتك.','Sign in to view your certificates.')}</p><Link to="/login">{t('تسجيل الدخول','Sign in')}</Link></main>;
 return <main className="learner-dashboard certificate-page"><div className="container"><div className="certificate-tools"><h1>{t('شهاداتي','My certificates')}</h1><p>{t('شهادات الإكمال الصادرة والمسجلة في المنصة.','Completion certificates issued and recorded by the platform.')}</p><Link to="/learner/courses">{t('العودة إلى دوراتي','Back to My Courses')}</Link></div>
 {!visible?<p role="status">{t('جارٍ تحميل الشهادات…','Loading certificates…')}</p>:visible.error?<p role="alert">{t('تعذر تحميل الشهادات.','Unable to load certificates.')} <button onClick={()=>reload(x=>x+1)}>{t('إعادة المحاولة','Retry')}</button></p>:c?<>
 <div className="certificate-tools account-actions"><label>{t('لغة الشهادة','Certificate language')}<select aria-label="Certificate language" value={pdfLanguage} disabled={visible.busy} onChange={e=>setPdfLanguage(e.target.value)}><option value="ar">العربية</option><option value="en">English</option></select></label>
 <button className="button" disabled={c.status!=='issued'||visible.busy} onClick={download}>{visible.busy?t('جارٍ تجهيز PDF…','Generating PDF…'):t('تحميل الشهادة PDF','Download certificate PDF')}</button><Link to="/learner/certificates">{t('كل الشهادات','All certificates')}</Link>{visible.pdfError&&<p role="alert">{t('تعذر تجهيز الشهادة. حاول مجددًا.','Unable to prepare the certificate. Retry.')}</p>}</div>
 <article className="esham-certificate" dir={pdfLanguage==='ar'?'rtl':'ltr'}><ThemeLogo alt="Esham"/><p className="certificate-eyebrow">ESHAM</p><h2>{ct('شهادة إكمال دورة','Certificate of completion')}</h2><p>{ct('تُقدم إلى','Presented to')}</p><h3>{c.learnerNameSnapshot}</h3><p>{ct('لإتمام متطلبات الدورة','For completing the requirements of')}</p><h4>{pdfLanguage==='ar'?c.courseTitleSnapshotAr||c.courseTitleSnapshotEn:c.courseTitleSnapshotEn||c.courseTitleSnapshotAr}</h4><p>{c.instructorNameSnapshot}</p><p>{formatCertificateDate(c.issuedAt,pdfLanguage)}</p><p dir="ltr">{c.verificationCode}</p><strong>{certificateStatusLabel(c.status,pdfLanguage)}</strong><Link to={`/certificates/verify/${c.verificationCode}`}>{ct('التحقق من الشهادة','Verify certificate')}</Link></article></>:
 <><div className="certificate-list">{visible.data.items.map(item=><article className="learner-panel" key={item.id}><h2>{language==='ar'?item.courseTitleSnapshotAr||item.courseTitleSnapshotEn:item.courseTitleSnapshotEn||item.courseTitleSnapshotAr}</h2><p>{certificateStatusLabel(item.status,language)}</p><Link className="button" to={`/learner/certificates/record/${item.id}`}>{t('عرض الشهادة','View certificate')}</Link></article>)}</div>{!visible.data.items.length&&<p>{t('لا توجد شهادات صادرة بعد.','No certificates have been issued yet.')}</p>}
 <button disabled={page===1} onClick={()=>setPage(x=>x-1)}>{t('السابق','Previous')}</button><span> {page} </span><button disabled={page*20>=visible.data.total} onClick={()=>setPage(x=>x+1)}>{t('التالي','Next')}</button></>}
 </div></main>;
}
