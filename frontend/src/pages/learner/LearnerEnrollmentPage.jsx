import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAccountSession } from '../../context/AccountSessionContext';
import { usePreferences } from '../../context/PreferencesContext';
import { loadEnrollment } from '../../services/enrollments';
import { loadEnrollmentVersionState } from '../../services/learnerVersionApi';
import { financialMessage } from '../../services/financialApi';
import { useLearning } from '../../context/LearningContext';

export default function LearnerEnrollmentPage() {
  const { enrollmentId } = useParams(), account = useAccountSession(), { language } = usePreferences();
  const { summaries } = useLearning(), learning = summaries[enrollmentId];
  const id = account.session?.profile.id, [state, setState] = useState(null), [revision, reload] = useState(0);
  const t = (a, e) => language === 'ar' ? a : e;
  useEffect(() => {
    let active = true; setState(null);
    if (id) loadEnrollment(id, enrollmentId).then(async data => {
      let version = null, versionError = null;
      if (data.enrollment.isAvailable) {
        try { version = await loadEnrollmentVersionState(enrollmentId); } catch (error) { versionError = error; }
      }
      if (active) setState({ accountId: id, enrollment: data.enrollment, version, versionError });
    }).catch(error => { if (active) setState({ accountId: id, error }); });
    return () => { active = false; };
  }, [id, enrollmentId, revision]);
  if (!state || state.accountId !== id) return <main className="container section"><p role="status">{t('جارٍ تحميل التسجيل…', 'Loading enrollment…')}</p></main>;
  if (state.error) return <main className="container section"><p role="alert">{financialMessage(state.error, language)}</p><button className="button" onClick={() => reload(x => x + 1)}>{t('إعادة المحاولة', 'Retry')}</button></main>;
  const e = state.enrollment;
  return <main className="learner-dashboard"><div className="container"><header className="learner-page-header"><h1>{language === 'ar' ? e.titleAr || e.titleEn : e.titleEn || e.titleAr}</h1><Link to="/learner/courses">{t('دوراتي', 'My Courses')}</Link></header>
    <section className="learner-panel"><h2>{t('تفاصيل التسجيل', 'Enrollment details')}</h2><p>{t('المدرّب:', 'Instructor:')} {language === 'ar' ? e.instructorName : e.instructorNameEn || e.instructorName}</p>
      <p>{t('تاريخ التسجيل:', 'Enrolled:')} {new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(e.enrolledAt))}</p>
      <p>{t('الحالة:', 'Status:')} {e.status === 'active' ? t('نشط', 'Active') : e.status === 'completed' ? t('مكتمل', 'Completed') : e.status}</p>
      {state.version && <p>{t('التقدم المحفوظ:', 'Saved progress:')} {state.version.progressPercentage}%</p>}
      {learning && <><p>{t('تغطية الدروس:', 'Lesson coverage:')} {learning.lessonCoveragePercentage}%</p><Link className="button" to={`/learner/enrollments/${enrollmentId}/learn`}>{t('متابعة التعلم', 'Continue learning')}</Link></>}
      {state.versionError && <p role="status">{t('تعذّر تحديث حالة المحتوى. تسجيلك محفوظ.', 'Content availability could not be refreshed. Your enrollment is saved.')} <button className="button button-outline" onClick={() => reload(x => x + 1)}>{t('إعادة المحاولة', 'Retry')}</button></p>}
      {!learning && <p>{t('تسجيلك محفوظ؛ تعذّر تأكيد إتاحة المحتوى حاليًا.', 'Your enrollment is saved; learning availability could not be confirmed yet.')}</p>}
      <Link className="button button-outline" to="/learner/points">{t('عرض المحفظة', 'View wallet')}</Link>
      {learning?.versionState.tasks.map(task=><Link key={task.taskId} className="button button-outline" to={`/learner/enrollments/${enrollmentId}/tasks/${task.taskId}`}>{language==='ar'?task.titleAr||task.titleEn:task.titleEn||task.titleAr}</Link>)}
      {e.isAvailable && <Link className="button button-outline" to={`/courses/${e.courseId}`}>{t('عرض الدورة', 'View course')}</Link>}
    </section></div></main>;
}
