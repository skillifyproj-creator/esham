import { Link, useParams } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { localized } from '../../data/instructorCourseWorkspace';
import { useEffect, useState } from 'react';
import { loadCourseReview } from '../../services/courseReviewApi';
import { courseRequest, mapCourse, mapSection } from '../../services/curriculumApi';
import { pointsPolicy } from '../../data/pointsPolicy';

export default function InstructorCoursePreviewPage() {
  const { courseId } = useParams();
  const { language } = usePreferences();
  const [workspace, setWorkspace] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setWorkspace(null); setError('');
    courseRequest(`/courses/${courseId}/draft`, undefined, 'GET', controller.signal)
      .then(draft => loadCourseReview(courseId, controller.signal, draft.id)).then(snapshot => {
      if (!controller.signal.aborted) setWorkspace({ course: mapCourse({courseId, draft:snapshot.version}), sections:snapshot.sections.map(mapSection) });
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [courseId]);
  const t = (ar, en) => language === 'ar' ? ar : en;
  if (!workspace && !error) return <main className="container section"><p role="status">{t('جارٍ تحميل الدورة…', 'Loading course…')}</p></main>;
  if (!workspace) return <main className="container section"><h1>{t('الدورة غير موجودة', 'Course not found')}</h1><Link to="/instructor/courses">{t('دوراتي', 'My courses')}</Link></main>;
  const { course, sections } = workspace;
  return <main className="container section instructor-detail-page"><Link to="/instructor/courses">{t('العودة إلى دوراتي', 'Back to my courses')}</Link><h1>{localized(course.title, language)}</h1><p>{localized(course.description, language)}</p><p>{t(`تكلفة التسجيل: ${pointsPolicy.enrollmentCost} نقطة · تكسب ${pointsPolicy.instructorEnrollmentReward} نقطة عن كل تسجيل.`, `Enrollment: ${pointsPolicy.enrollmentCost} points · Earn ${pointsPolicy.instructorEnrollmentReward} points per enrollment.`)}</p>
    {course.image && <img src={course.image} alt={localized(course.title, language)} style={{ width: '100%', maxWidth: 600, borderRadius: 16 }}/>}
    <h2>{t('محتوى الدورة', 'Course content')}</h2>{sections.length ? sections.map(section => <section className="learner-panel" key={section.id}><h3>{localized(section.title, language)}</h3><ul>{section.lessons.map(lesson => <li key={lesson.id}>{localized(lesson.title, language)} · {lesson.minutes || 0} {t('دقيقة', 'min')}</li>)}</ul>{section.task && <p>{t('مهمة', 'Task')}: {localized(section.task.title, language)}</p>}</section>) : <p>{t('لا يوجد منهج محفوظ لهذه الدورة بعد.', 'No curriculum is saved for this course yet.')}</p>}
    <Link className="button button-outline" to={`/instructor/courses/${courseId}/edit`}>{t('تعديل الدورة', 'Edit course')}</Link>
  </main>;
}
