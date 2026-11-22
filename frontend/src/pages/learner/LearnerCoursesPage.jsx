import { useState } from 'react';
import { Link } from 'react-router';
import { useLearner } from '../../context/LearnerContext';
import { usePreferences } from '../../context/PreferencesContext';
import { usePublicCatalog } from '../../context/PublicCatalogContext';
import { financialMessage } from '../../services/financialApi';
import Icon from '../../components/Icon';
import '../../styles/learner.css';
export default function LearnerCoursesPage() {
  const data = useLearner(), { language } = usePreferences(), { courses } = usePublicCatalog();
  const [filter, setFilter] = useState('all'), t = (a,e) => language === 'ar' ? a : e;
  const complete = e => e.status === 'completed' || Boolean(e.completedAt);
  const shown = data.enrollments.filter(e => filter === 'all' || (filter === 'completed' ? complete(e) : !complete(e)));
  const pages = Math.max(1, Math.ceil(data.enrollmentTotal / 20));
  return <main className="learner-dashboard"><div className="container">
    <header className="learner-welcome"><div><span className="section-kicker">{t('التعلّم','Learning')}</span><h1>{t('دوراتي','My Courses')}</h1><p>{t('تسجيلاتك المحفوظة في حسابك.','Enrollments saved to your account.')}</p></div>
      <div className="account-actions"><Link className="button button-outline" to="/courses">{t('استكشف الدورات','Explore courses')}</Link><Link className="button button-outline" to="/learner/points">{t('المحفظة','Wallet')}</Link></div></header>
    {data.error && <section className="learner-panel"><p role="alert">{financialMessage(data.error, language)}</p><button className="button" onClick={data.refresh}>{t('إعادة المحاولة','Retry')}</button></section>}
    {data.loading ? <p role="status">{t('جارٍ تحميل دوراتك…','Loading your courses…')}</p> : !data.error && <>
      <section className="learner-summary">{[[t('الدورات المسجّلة','Enrolled courses'),data.enrollmentTotal],
        [t('قيد التعلّم في هذه الصفحة','Active on this page'),data.enrollments.filter(e=>!complete(e)).length],
        [t('مكتملة في هذه الصفحة','Completed on this page'),data.enrollments.filter(complete).length]].map(([label,value])=><article className="learner-panel learner-stat" key={label}><strong>{value}</strong><span>{label}</span></article>)}</section>
      <div className="learner-course-filters">{[['all',t('الكل','All')],['active',t('قيد التعلّم','Active')],['completed',t('مكتملة','Completed')]].map(([key,label]) => <button key={key} className={'learner-course-filter'+(filter===key?' active':'')} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>
      {pages>1 && <p>{t('الفلتر يطبّق على الصفحة الحالية.','Filters apply to the current page.')}</p>}
      <section className="learner-enrolled-grid" aria-live="polite">{shown.map(e => {
        const course = courses.find(c=>c.id===e.courseId), url = '/learner/enrollments/'+e.id;
        return <article className="enrolled-course-card" key={e.id}>
          <Link className="enrolled-course-image" to={url}>{course?.image ? <img src={course.image} alt="" loading="lazy"/> : <Icon name="book" size={48}/>}</Link>
          <div className="enrolled-course-content">{complete(e)&&<Link className="button button-outline" to="/learner/certificates">{t('الشهادات','Certificates')}</Link>}<span className={'enrolled-course-status'+(complete(e)?' completed':'')}>{complete(e)?t('مكتملة','Completed'):t('مسجّل','Enrolled')}</span>
            <p className="enrolled-course-instructor">{language==='ar'?e.instructorName:e.instructorNameEn||e.instructorName}</p>
            <h2><Link to={url}>{language==='ar'?e.titleAr||e.titleEn:e.titleEn||e.titleAr}</Link></h2>
            <p>{t('تاريخ التسجيل:','Enrolled:')} {new Intl.DateTimeFormat(language,{dateStyle:'medium'}).format(new Date(e.enrolledAt))}</p>
            {!e.isAvailable && !e.learning && <p>{t('الدورة غير متاحة حاليًا؛ تسجيلك محفوظ.','The course is currently unavailable; your enrollment is retained.')}</p>}
            {e.learning && <><p>{t('تقدم الدورة:','Course progress:')} {e.learning.versionState.progressPercentage}% · {t('الدروس:','Lessons:')} {e.learning.lessonCoveragePercentage}%</p><Link className="button enrolled-course-button" to={`${url}/learn`}>{t('متابعة التعلم','Continue learning')}</Link></>}
            <Link className="button enrolled-course-button" to={url}>{t('تفاصيل التسجيل','Enrollment details')}</Link></div></article>;
      })}</section>
      {!shown.length && <section className="learner-panel learner-courses-empty"><h2>{t('لا توجد تسجيلات في هذا العرض.','No enrollments in this view.')}</h2><Link className="button" to="/courses">{t('استكشف الدورات','Explore courses')}</Link></section>}
      {pages>1 && <nav className="account-actions" aria-label={t('صفحات دوراتي','My Courses pages')}><button className="button button-outline" disabled={data.enrollmentPage<=1} onClick={()=>data.setEnrollmentPage(data.enrollmentPage-1)}>{t('السابق','Previous')}</button><span>{data.enrollmentPage} / {pages}</span><button className="button button-outline" disabled={data.enrollmentPage>=pages} onClick={()=>data.setEnrollmentPage(data.enrollmentPage+1)}>{t('التالي','Next')}</button></nav>}
    </>}
  </div></main>;
}
