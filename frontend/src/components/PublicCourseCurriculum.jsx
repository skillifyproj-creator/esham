import { usePreferences } from '../context/PreferencesContext';
import Icon from './Icon';

export default function PublicCourseCurriculum({ course }) {
  const { language } = usePreferences();
  const t = (ar, en) => language === 'ar' ? ar : en;
  return (
    <section className="detail-section"><div className="detail-section-heading"><h2>{t('محتوى الدورة', 'Course curriculum')}</h2><span>{course.lessons ?? 0} {t('درس', 'lessons')}</span></div>
      {course.curriculum.length ? <div className="curriculum">{course.curriculum.map((section, index) => <details key={section.id} open={index === 0}><summary><span><small>{t('القسم', 'Section')} {index + 1}</small><strong>{section.title[language]}</strong></span><span>{section.lessons.length} {t('درس', 'lessons')} <b aria-hidden="true">⌄</b></span></summary><ul>{section.lessons.map(lesson => <li key={lesson.id}><div className="lesson-row"><span className="lesson-icon"><Icon name={lesson.contentType === 'video' ? 'play' : 'book'} size={18}/></span><span className="lesson-name">{lesson.title[language]}<small>{lesson.contentType === 'video' ? t('فيديو', 'Video') : lesson.contentType === 'article' ? t('مقال', 'Article') : t('محتوى تعليمي', 'Learning content')}</small></span><span className="locked-tag">{t('المحتوى للمسجّلين', 'Enrolled content')}</span></div></li>)}</ul></details>)}</div> : <p>{t('لا توجد أقسام منشورة.', 'No published sections.')}</p>}
      {course.taskCount > 0 && <p>{t('تتضمن الدورة مهام تعليمية. تفاصيل المهام متاحة للمسجّلين فقط.', 'This course includes learning tasks. Task details are restricted to enrolled learners.')}</p>}
    </section>
  );
}
