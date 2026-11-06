import PublicCourseCurriculum from '../components/PublicCourseCurriculum';
import ReportCourseButton from '../components/learner/ReportCourseButton';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { usePreferences } from '../context/PreferencesContext';
import { usePublicCatalog } from '../context/PublicCatalogContext';
import { loadPublicCourse } from '../services/publicCatalog';
import CourseCard from '../components/CourseCard';
import Icon from '../components/Icon';
import '../styles/community.css';
import '../styles/course-pages.css';
export default function CourseDetailsPage() {
  const { courseId } = useParams(), { language, copy: c } = usePreferences();
  const { courses } = usePublicCatalog();
  const [course, setCourse] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const t = (ar, en) => language === 'ar' ? ar : en;
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setCourse(null); setError('');
    loadPublicCourse(courseId, controller.signal).then(value => { if (!controller.signal.aborted) setCourse(value); }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [courseId]);
  if (loading || error || !course) return <main className="section container empty-state"><h1>{loading ? t('جارٍ تحميل الدورة…', 'Loading course…') : t('الدورة غير متاحة', 'Course unavailable')}</h1>{error && <p role="alert">{error}</p>}<Link className="button" to="/courses">{t('العودة إلى الدورات', 'Back to courses')}</Link></main>;
  const related = courses.filter(x => x.id !== course.id).sort((a, b) => Number(b.categoryId === course.categoryId) - Number(a.categoryId === course.categoryId)).slice(0, 3);
  return <main className="course-detail-page"><div className="container">
    <nav className="breadcrumbs" aria-label={t('مسار التنقل', 'Breadcrumb')}><Link to="/">{c.home}</Link><span>/</span><Link to="/courses">{c.courses}</Link><span>/</span><span>{course.title[language]}</span></nav>
    <section className="detail-hero"><div className="detail-hero-copy">
      <Link className="detail-category" to={`/courses?category=${course.categoryId}`}>{course.categoryTitle[language]}</Link>
      <h1>{course.title[language]}</h1><p>{course.description[language]}</p>
      <p className="catalog-instructor">{course.instructor[language]} · {course.level === 'beginner' ? t('مبتدئ', 'Beginner') : course.level} · {course.language === 'ar' ? t('العربية', 'Arabic') : t('الإنجليزية', 'English')}</p>
      <div className="instructor-line"><span className="avatar" aria-hidden="true">{course.instructor[language]?.slice(0, 1)}</span><div><strong>{course.instructor[language]}</strong><small>{t('مدرّب الدورة', 'Course instructor')}</small></div></div>
      <p className="detail-rating">{course.ratingCount ? `${course.rating?.toFixed(1)} / 5 · ${course.ratingCount} ${t('تقييم', 'ratings')}` : t('لا توجد تقييمات بعد.', 'No ratings yet.')}</p>
      <dl className="detail-metrics"><div><dt>{t('الأقسام', 'Sections')}</dt><dd>{course.curriculum.length}</dd></div><div><dt>{t('الدروس', 'Lessons')}</dt><dd>{course.lessons ?? 0}</dd></div><div><dt>{t('المهام', 'Tasks')}</dt><dd>{course.taskCount}</dd></div><div><dt>{t('المستوى', 'Level')}</dt><dd>{course.level === 'beginner' ? t('مبتدئ', 'Beginner') : course.level}</dd></div></dl>
    </div><div className="detail-hero-art">{course.image ? <img src={course.image} alt={course.title[language]}/> : <Icon name="book" size={64}/>}</div></section>
    <ReportCourseButton course={course}/>
    <div className="detail-layout"><div className="detail-main">
    <section className="detail-section"><h2>{t('عن الدورة', 'About this course')}</h2><div className="detail-panel"><p style={{whiteSpace:'pre-wrap'}}>{course.description[language]}</p></div></section>
    <PublicCourseCurriculum course={course}/>
    </div><aside className="enrollment-card"><h2>{t('التسجيل في الدورة', 'Course enrollment')}</h2><p id="enrollment-unavailable">{t('التسجيل غير متاح حاليًا. لا يمكن خصم نقاط أو بدء التعلّم حتى تتوفر خدمة التسجيل.', 'Enrollment is currently unavailable. Points cannot be charged and learning cannot start until the enrollment service is available.')}</p><button type="button" className="button enroll-button" disabled aria-describedby="enrollment-unavailable">{t('التسجيل غير متاح حاليًا', 'Enrollment unavailable')}</button></aside></div>
    <section className="section"><h2>{t('ما الذي ستتعلمه؟', 'What you will learn')}</h2><ul>{course.objectives.map((x, i) => <li key={i}>{x[language] || x.ar || x.en}</li>)}</ul></section>
    <section className="section"><h2>{t('دورات أخرى', 'More courses')}</h2><div className="catalog-grid">{related.map(x => <CourseCard key={x.id} course={x} compact />)}</div></section>
  </div></main>;
}
