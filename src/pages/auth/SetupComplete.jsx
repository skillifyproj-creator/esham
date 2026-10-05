import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { onboardingCopy } from '../../i18n/onboardingCopy';
import Icon from '../../components/Icon';
import '../../styles/onboarding-complete.css';
const copy = {
 ar: { title: 'خطوتك الأولى اكتملت', intro: 'جمعت ملامح رحلتك في إسهام. راجع اختياراتك، ثم اكتشف ما يمكنك تعلّمه ومشاركته.', profile: 'ملخص إعداد ملفك', learning: 'مجالات ترغب بتعلّمها', teaching: 'خبرات ترغب بمشاركتها', goal: 'هدفك الأساسي', start: 'استكشف الدورات', teach: 'ابدأ إعداد دورة', dashboard: 'واجهة المتعلّم', instructor: 'واجهة المدرّب', edit: 'تعديل اختياراتي', note: 'تفضيلاتك محفوظة لهذه الجلسة. إنشاء الحساب واعتماده وتفعيل رصيد النقاط يتطلب ربط خدمة الحسابات.', both: 'رحلة تجمع التعلّم والتعليم', bothText: 'اختر الواجهة التي ترغب بتجربتها. واجهات المتعلّم والمدرّب الحالية تعرض بيانات تجريبية، ولا تُنشئ حسابات منفصلة.', empty: 'لم تُضف بعد', preview: 'ملف قيد الإعداد', fallback: 'عضو إسهام' },
 en: { title: 'Your first step is complete', intro: 'Your Esham journey is taking shape. Review your choices, then explore what you can learn and share.', profile: 'Your setup summary', learning: 'Areas you want to learn', teaching: 'Expertise you want to share', goal: 'Your main goal', start: 'Explore courses', teach: 'Start preparing a course', dashboard: 'Learner interface', instructor: 'Instructor interface', edit: 'Edit my choices', note: 'Your preferences are saved for this session. Account creation, approval, and points activation require the account service connection.', both: 'A journey of learning and teaching', bothText: 'Choose the interface you would like to explore. Current learner and instructor interfaces use demo data and do not create separate accounts.', empty: 'Not added yet', preview: 'Profile setup preview', fallback: 'Esham member' },
};
export default function SetupComplete({ draft, photo, onEdit }) {
 const { language } = usePreferences();
 const t = copy[language], c = onboardingCopy[language];
 const role = c.roles.find(item => item.id === draft.role);
 const initials = draft.name.trim().split(/\s+/).slice(0,2).map(word => Array.from(word)[0]).join('');
 const learning = draft.interests.map(id => c.categories[id]);
 const teaching = [...draft.teachingAreas.map(id => c.categories[id]), ...draft.customSkills];
 const primary = draft.role === 'instructor' ? { to: '/instructor/courses/new', label: t.teach } : { to: '/courses', label: t.start };
 function skills(title, items, type) { return <section className={`setup-summary-section ${type}`}><h3><Icon name={type === 'learning' ? 'book' : 'user'} size={20} />{title}</h3><div className="setup-summary-tags">{items.length ? items.map(value => <span key={value}>{value}</span>) : <p>{t.empty}</p>}</div></section>; }
 return <section className="setup-complete" aria-labelledby="setup-complete-title">
  <div className="setup-celebration" aria-hidden="true"><Icon name="leaf" size={38} /><span>✓</span></div>
  <header className="setup-complete-heading"><h1 id="setup-complete-title">{t.title}</h1><p>{t.intro}</p></header>
  <article className="setup-summary" aria-label={t.profile}>
   <div className="setup-summary-person"><span className="setup-summary-avatar">{photo ? <img src={photo} alt={draft.name} /> : <span aria-hidden="true">{initials}</span>}</span><div><span className="setup-summary-eyebrow">{t.preview}</span><h2>{draft.name.trim() || t.fallback}</h2><p className="setup-summary-username" dir="ltr">@{draft.username}</p></div><span className="setup-summary-role">{role?.title}</span></div>
   <div className={`setup-summary-grid ${draft.role === 'both' ? '' : 'single'}`}>{draft.role !== 'instructor' && skills(t.learning, learning, 'learning')}{draft.role !== 'learner' && skills(t.teaching, teaching, 'teaching')}</div>
   <div className="setup-summary-goal"><Icon name="award" size={23} /><div><strong>{t.goal}</strong><p>{c.goals[draft.goal]}</p></div></div>
   {draft.role === 'both' && <aside className="setup-summary-both"><Icon name="swap" size={23} /><div><strong>{t.both}</strong><p>{t.bothText}</p></div></aside>}
  </article>
  <p className="setup-complete-note"><Icon name="info" size={18} />{t.note}</p>
  <div className="setup-complete-actions"><Link className="setup-start" to={primary.to}>{primary.label}<span aria-hidden="true">{language === 'ar' ? '←' : '→'}</span></Link><div className="setup-dashboard-links">{draft.role !== 'instructor' && <Link to="/learner">{t.dashboard}</Link>}{draft.role !== 'learner' && <Link to="/instructor">{t.instructor}</Link>}</div><button type="button" className="onboarding-text-button" onClick={onEdit}>{t.edit}</button></div>
 </section>;
}
