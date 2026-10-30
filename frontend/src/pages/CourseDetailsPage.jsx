import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { usePreferences } from '../context/PreferencesContext';
import { usePublicCatalog } from '../context/PublicCatalogContext';
import { loadPublicCourse } from '../services/publicCatalog';
import CourseCard from '../components/CourseCard';
import Icon from '../components/Icon';
import '../styles/community.css';
export default function CourseDetailsPage() {
  const { courseId } = useParams(), { language, copy: c } = usePreferences();
  const { courses } = usePublicCatalog();
  const [course, setCourse] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const t = (ar, en) => language === 'ar' ? ar : en;
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setCourse(null); setError('');
    loadPublicCourse(courseId, controller.signal).then(setCourse).catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
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
    </div><aside className="detail-enroll-card"><div className="course-image"><Icon name="book" size={64} /></div><h2>{t('نبذة عن الدورة', 'Course overview')}</h2><p>{t('هذه صفحة المعلومات المنشورة للدورة. التسجيل والمحتوى التعليمي الكامل سيتوفران مع خدماتهما.', 'Published course information. Enrollment and full learning content will become available with their services.')}</p><Link className="button button-outline" to="/courses">{t('استكشف الدورات', 'Explore courses')}</Link></aside></section>
    <section className="section"><h2>{t('ما الذي ستتعلمه؟', 'What you will learn')}</h2><ul>{course.objectives.map((x, i) => <li key={i}>{x[language] || x.ar || x.en}</li>)}</ul></section>
    <section className="section"><h2>{t('دورات أخرى', 'More courses')}</h2><div className="catalog-grid">{related.map(x => <CourseCard key={x.id} course={x} compact />)}</div></section>
  </div></main>;
}
