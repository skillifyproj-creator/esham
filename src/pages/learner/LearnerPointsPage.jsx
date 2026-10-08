import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { useLearnerWallet } from '../../hooks/useLearnerWallet';
import { courses } from '../../data/courses';
import { pointsPolicy } from '../../data/pointsPolicy';

export default function LearnerPointsPage() {
  const { language } = usePreferences();
  const { balance, earned, spent, transactions, error } = useLearnerWallet();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const labels = { opening: t('رصيد البداية', 'Welcome credit'), enrollment: t('تسجيل في دورة', 'Course enrollment'), teaching: t('تسجيل متعلّم في دورتك', 'Learner enrollment in your course') };
  return <main className="learner-dashboard"><div className="container">
    <header className="learner-welcome"><div><h1>{t('محفظة النقاط', 'Points wallet')}</h1><p>{t('رصيد واحد للتعلّم والتدريس، محفوظ عند تغيير نوع الحساب.', 'One balance for learning and teaching, preserved when changing account type.')}</p></div><Link className="button button-outline" to="/courses">{t('استكشف الدورات', 'Explore courses')}</Link></header>
    <p className="learner-demo-label">{t('المحفظة والتسجيل محفوظان في هذا المتصفح للتجربة. المزامنة بين المستخدمين والأجهزة تحتاج خدمة الحسابات.', 'Wallet and enrollments are saved in this browser for preview. Synchronization across users and devices requires the account service.')}</p>
    {error && <p role="alert">{t('تعذّر قراءة المحفظة. تحقق من تخزين المتصفح قبل التسجيل.', 'Unable to read the wallet. Check browser storage before enrolling.')}</p>}
    <div className="wallet-hero"><section className="learner-panel wallet-balance"><h2>{t('الرصيد المتاح', 'Available balance')}</h2><p className="wallet-number"><strong>{balance}</strong><span>{t('نقطة', 'points')}</span></p></section><section className="learner-panel wallet-policy"><h2>{t('كيف تعمل النقاط؟', 'How do points work?')}</h2><p>{t(`يحصل الحساب على ${pointsPolicy.openingBalance} نقطة مرة واحدة كبداية. التسجيل في أي دورة يكلف ${pointsPolicy.enrollmentCost} نقطة.`, `Each account receives ${pointsPolicy.openingBalance} welcome points once. Every course enrollment costs ${pointsPolicy.enrollmentCost} points.`)}</p><p>{t(`يكسب صاحب الدورة ${pointsPolicy.instructorEnrollmentReward} نقطة عن كل متعلّم يسجّل فيها. إكمال الدروس لا يضيف نقاطًا.`, `The instructor earns ${pointsPolicy.instructorEnrollmentReward} points for each learner who enrolls. Completing lessons does not add points.`)}</p></section></div>
    <section className="learner-summary wallet-summary">{[[t('مكتسبة من التدريس', 'Earned from teaching'), earned], [t('مستخدمة للتسجيل', 'Spent on enrollment'), spent], [t('تكلفة كل دورة', 'Cost of every course'), pointsPolicy.enrollmentCost]].map(([label, amount]) => <article className="learner-panel learner-stat" key={label}><strong>{amount}</strong><span>{label}</span></article>)}</section>
    <section className="learner-panel"><h2>{t('سجل الحركات', 'Transaction history')}</h2><ol className="wallet-history">{transactions.map(item => <li key={item.id}><strong>{item.points > 0 ? '+' : ''}{item.points} {t('نقطة', 'points')}</strong><span>{labels[item.type]}{item.courseId && ` · ${courses.find(course => course.id === item.courseId)?.title[language] || item.courseId}`}</span><time dateTime={item.createdAt}>{new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(item.createdAt))}</time></li>)}</ol></section>
  </div></main>;
}
