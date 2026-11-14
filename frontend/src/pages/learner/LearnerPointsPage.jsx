import { Link } from 'react-router';
import { useLearnerWallet } from '../../hooks/useLearnerWallet';
import { usePreferences } from '../../context/PreferencesContext';
import { pointsPolicy } from '../../data/pointsPolicy';
import { financialMessage } from '../../services/financialApi';
import '../../styles/learner.css';
export default function LearnerPointsPage() {
  const { language } = usePreferences(), data = useLearnerWallet(), t=(a,e)=>language==='ar'?a:e;
  const labels={welcome:t('رصيد البداية','Welcome credit'),enrollment:t('التسجيل في دورة','Course enrollment'),teaching:t('مكافأة التدريس','Teaching reward')};
  const pages=Math.max(1,Math.ceil(data.historyTotal/20));
  return <main className="learner-dashboard learner-wallet"><div className="container">
    <header className="learner-welcome"><div><h1>{t('محفظة النقاط','Points wallet')}</h1><p>{t('رصيدك وحركاتك محفوظة في حسابك عند تغيير نوع الحساب.','Your balance and transactions remain on your account when your account type changes.')}</p></div><Link className="button button-outline" to="/courses">{t('استكشف الدورات','Explore courses')}</Link></header>
    {data.loading && <p role="status">{t('جارٍ تحميل المحفظة…','Loading wallet…')}</p>}
    {data.error && <section className="learner-panel"><p role="alert">{financialMessage(data.error,language)}</p><button className="button" onClick={data.refresh}>{t('إعادة المحاولة','Retry')}</button></section>}
    <div className="wallet-hero"><section className="learner-panel wallet-balance"><h2>{t('الرصيد المتاح','Available balance')}</h2><p className="wallet-number"><strong>{data.balance ?? '—'}</strong><span>{t('نقطة','points')}</span></p></section>
      <section className="learner-panel wallet-policy"><h2>{t('كيف تعمل النقاط؟','How do points work?')}</h2><p>{t('يحصل الحساب على 20 نقطة ترحيبية مرة واحدة. التسجيل يكلف 20 نقطة، ويحصل المدرّب على 20 نقطة لكل تسجيل. إكمال الدروس لا يمنح نقاطًا.','Each account receives 20 welcome points once. Enrollment costs 20 points and awards the instructor 20 points. Completing lessons does not award points.')}</p></section></div>
    {!data.loading && !data.error && data.wallet && <><section className="learner-summary wallet-summary">{[[t('مكتسبة من التدريس','Earned from teaching'),data.earned],[t('مستخدمة للتسجيل','Spent on enrollment'),data.spent],[t('تكلفة التسجيل','Enrollment cost'),pointsPolicy.enrollmentCost]].map(([label,amount])=><article className="learner-panel learner-stat" key={label}><strong>{amount}</strong><span>{label}</span></article>)}</section>
      <section className="learner-panel"><h2>{t('سجل الحركات','Transaction history')}</h2>{!data.transactions.length?<p>{t('لا توجد حركات في هذه الصفحة.','No transactions on this page.')}</p>:<ol className="wallet-history">{data.transactions.map(item=><li key={item.id}><strong>{item.amount>0?'+':''}{item.amount} {t('نقطة','points')}</strong><span>{labels[item.transactionType]||item.transactionType}{item.courseId && ' · '+(language==='ar'?item.courseTitleAr||item.courseTitleEn:item.courseTitleEn||item.courseTitleAr)}</span><time dateTime={item.createdAt}>{new Intl.DateTimeFormat(language,{dateStyle:'medium'}).format(new Date(item.createdAt))}</time></li>)}</ol>}</section>
      {pages>1 && <nav className="account-actions" aria-label={t('صفحات الحركات','Transaction pages')}><button className="button button-outline" disabled={data.historyPage<=1} onClick={()=>data.setHistoryPage(data.historyPage-1)}>{t('السابق','Previous')}</button><span>{data.historyPage} / {pages}</span><button className="button button-outline" disabled={data.historyPage>=pages} onClick={()=>data.setHistoryPage(data.historyPage+1)}>{t('التالي','Next')}</button></nav>}</>}
  </div></main>;
}
