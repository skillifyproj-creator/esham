import { Link } from 'react-router';
import { useLearner } from '../../context/LearnerContext';
import { useLearning } from '../../context/LearningContext';
import { usePreferences } from '../../context/PreferencesContext';
import { learningMessage } from '../../services/learningApi';
import { useLearnerWallet } from '../../hooks/useLearnerWallet';
export default function LearnerProgressPage() {
  const { enrollments, loading, enrollmentTotal } = useLearner(), { summaries, errors, refresh } = useLearning(), { language } = usePreferences();
  const { balance } = useLearnerWallet();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const available = enrollments.map(e => summaries[e.id]).filter(Boolean);
  const lessons = available.flatMap(e => e.sections.flatMap(s => s.lessons));
  const percentage = lessons.length ? Math.round(100 * lessons.filter(l => l.isCompleted).length / lessons.length) : 0;
  return <main className="learner-dashboard"><div className="container"><header className="learner-welcome"><div><span className="section-kicker">{t('التعلّم', 'Learning')}</span><h1>{t('تقدم التعلم', 'Learning progress')}</h1><p>{t('الدروس والإنجازات المحفوظة في الخادم.', 'Lessons and achievements saved on the server.')}</p></div></header>
    <section className="learner-summary"><article className="learner-panel learner-stat"><strong>{percentage}%</strong><span>{t('تغطية الدروس المتاحة في صفحة دوراتي الحالية', 'Lesson coverage for available courses on the current My Courses page')}</span></article><article className="learner-panel learner-stat"><strong>{enrollments.filter(e => e.status === 'completed' || e.completedAt).length}</strong><span>{t('دورات مكتملة في الصفحة الحالية', 'Persisted completed courses on this page')}</span></article></section>
    <section className="learner-summary"><article className="learner-panel learner-stat"><strong>{available.reduce((n, e) => n + e.versionState.tasks.filter(task => task.isApproved).length, 0)}</strong><span>{t('مهام معتمدة في الصفحة الحالية', 'Approved tasks on this page')}</span></article><article className="learner-panel learner-stat"><strong>{balance ?? '—'}</strong><span>{t('رصيد النقاط الحالي', 'Current points balance')}</span></article></section>
    <p>{t('تقدم الدورة يشمل الدروس والمهام المعتمدة؛ إكمال الدروس وحده لا يُكمل الدورة.', 'Course progress includes lessons and approved tasks; completing lessons alone does not complete the course.')}</p>
    {loading && <p role="status">{t('جارٍ التحميل…', 'Loading…')}</p>}
    <section className="learner-enrolled-grid">{enrollments.map(e => {
      const item = summaries[e.id], title = language === 'ar' ? e.titleAr || e.titleEn : e.titleEn || e.titleAr;
      return <article className="learner-panel" key={e.id}><h2>{title}</h2>{item ? <><div className="learner-progress"><div className="learner-progress-label"><span>{t('تقدم الدورة', 'Course progress')}</span><strong>{item.versionState.progressPercentage}%</strong></div><progress max="100" value={item.versionState.progressPercentage} aria-label={t('تقدم الدورة', 'Course progress')} /></div><p>{t('تغطية الدروس:', 'Lesson coverage:')} {item.lessonCoveragePercentage}%</p><p>{t('المهام المعتمدة:', 'Approved tasks:')} {item.versionState.tasks.filter(x => x.isApproved).length} / {item.versionState.tasks.length}</p><Link className="button" to={`/learner/enrollments/${e.id}/learn`}>{t('متابعة التعلم', 'Continue learning')}</Link></> : errors[e.id] ? <p role="alert">{learningMessage(errors[e.id], language)}</p> : <p role="status">{t('جارٍ تحميل التقدم…', 'Loading progress…')}</p>}<Link className="button button-outline" to={`/learner/enrollments/${e.id}`}>{t('تفاصيل التسجيل', 'Enrollment details')}</Link></article>;
    })}</section>
    {!loading && !enrollmentTotal && <p>{t('لا توجد تسجيلات محفوظة.', 'No saved enrollments.')}</p>}
    <div className="account-actions"><button className="button button-outline" onClick={refresh}>{t('تحديث', 'Refresh')}</button><Link to="/learner/courses">{t('دوراتي', 'My Courses')}</Link></div>
  </div></main>;
}
