import VideoSafetyStatus from '../../components/shared/VideoSafetyStatus';
import { instructorPublicCourseIds } from '../../data/instructorCourseLinks';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import CourseSafetyPanel from '../../components/shared/CourseSafetyPanel';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import InstructorCourseStepper from '../../components/instructor/InstructorCourseStepper';
import { usePreferences } from '../../context/PreferencesContext';
import useAccountProfile from '../../hooks/useAccountProfile';
import { getInstructorCourseWorkspace, localized, lessonIsReady, taskIsReady } from '../../data/instructorCourseWorkspace';
import { pointsPolicy } from '../../data/pointsPolicy';
import '../../styles/instructor.css';

export default function CourseReviewPage() {
  const { courseId } = useParams();
  const { language } = usePreferences();
  const profile = useAccountProfile();
  const [showSubmit, setShowSubmit] = useState(false);
  const ar = language === 'ar';
  const t = (a, e) => ar ? a : e;
  const workspace = getInstructorCourseWorkspace(courseId || 'new');
  const base = `/instructor/courses/${courseId || 'new'}`;
  const edit = courseId && courseId !== 'new' ? `${base}/edit` : base;
  if (!workspace) return <main className="container section empty-state"><h1>{t('لا توجد دورة للمراجعة', 'No course to review')}</h1><p>{t('أنشئ المسودة أولًا أو افتح دورة من قائمة دوراتك.', 'Create a draft first or open a course from your course list.')}</p><Link className="button" to="/instructor/courses">{t('العودة إلى دوراتي', 'Back to my courses')}</Link></main>;
  const { course, sections } = workspace;
  const lessons = sections.flatMap(section => section.lessons);
  const minutes = lessons.reduce((sum, lesson) => sum + (Number(lesson.minutes) || 0), 0);
  const objectives = course.objectives || [];
  const checks = [
    [t('عنوان الدورة ومجالها مكتملان', 'Course title and category are complete'), Boolean(localized(course.title, language) && localized(course.category, language))],
    [t('صورة الغلاف موجودة', 'Cover image is provided'), Boolean(course.image)],
    [t('الوصف واضح ومكتمل', 'Description is complete'), localized(course.description, language).trim().length >= 20],
    [t('الأهداف التعليمية محددة', 'Learning objectives are defined'), objectives.length > 0],
    [t('الأقسام والدروس مضافة', 'Sections and lessons are added'), sections.length > 0 && sections.every(section => section.lessons.length > 0)],
    [t('محتوى الدروس متوفر في المعاينة', 'Lesson content is available in the preview'), lessons.length > 0 && lessons.every(lesson => lessonIsReady(lesson, language))],
    [t('من مهمة إلى ثلاث مهام مكتملة للدورة', 'One to three complete tasks per course'), sections.filter(section => section.task).length >= 1 && sections.filter(section => section.task).length <= 3 && sections.filter(section => section.task).every(section => taskIsReady(section.task, language))],
    [t('مستوى الدورة محدد', 'Course level is selected'), Boolean(course.level)],
  ];
  const readiness = Math.round(checks.filter(([, done]) => done).length / checks.length * 100);
  const level = typeof course.level === 'string' ? ({beginner:t('مبتدئ','Beginner'),intermediate:t('متوسط','Intermediate'),advanced:t('متقدم','Advanced')}[course.level] || course.level) : localized(course.level, language);
  return <section className="instructor-review-page instructor-detail-page" dir={ar ? 'rtl' : 'ltr'}><div className="container">
    <header className="instructor-review-header"><div><h1>{t('مراجعة الدورة قبل الإرسال', 'Review your course before submission')}</h1><p>{t('راجع المعلومات والمنهج والمهام كما ستظهر للمتعلّم.', 'Review the information, curriculum and tasks as learners will see them.')}</p></div><div className="instructor-review-header-actions"><Link className="instructor-review-back-button" to={`${base}/curriculum`}><Icon name="arrow-left" size={16}/>{t('العودة للمنهج', 'Back to curriculum')}</Link></div></header>
    <InstructorCourseStepper currentStep={3}/>
    <p className="instructor-media-demo-note">{t('هذه مراجعة لمسودة محلية. نشر الدورة والإرسال إلى الأدمن يحتاجان ربط خدمة الدورات؛ الملفات والصور المحلية ليست مرفوعة إلى خادم.', 'This is a local draft review. Publishing and submitting to an administrator require the course service; local images and files are not uploaded to a server.')}</p>
    <div className="instructor-review-layout"><main className="instructor-review-content">
      <VideoSafetyStatus/><CourseSafetyPanel courseId={instructorPublicCourseIds[courseId] ? `catalog:${instructorPublicCourseIds[courseId]}` : `instructor:${courseId || 'new'}`} /><section className="instructor-review-preview-status"><strong>{t('معاينة محتوى الدورة', 'Course content preview')}</strong><span>{t('بيانات الدورة الحالية', 'Current course data')}</span></section>
      <section className="instructor-course-preview-card"><div className="instructor-course-preview-cover">{course.image ? <img src={course.image} alt={localized(course.title, language)}/> : <div className="instructor-course-image-empty"><Icon name="camera" size={32}/></div>}<span className="instructor-preview-course-badge">{localized(course.category, language) || t('مجال غير محدد','No category selected')}</span></div><div className="instructor-course-preview-body"><div className="instructor-preview-title-row"><div><h2>{localized(course.title, language) || t('عنوان الدورة','Course title')}</h2><p>{localized(course.description, language)}</p></div><Link className="instructor-preview-edit" to={edit}><Icon name="edit" size={16}/>{t('تعديل البيانات','Edit details')}</Link></div><div className="instructor-preview-stats"><div><span>{t('مستوى الدورة','Course level')}</span><strong>{level || '—'}</strong></div><div><span>{t('مدة الدروس','Lesson duration')}</span><strong>{minutes} {t('دقيقة','min')}</strong></div><div><span>{t('عدد الدروس','Lessons')}</span><strong>{lessons.length}</strong></div><div><span>{t('مكافأة الإكمال','Completion reward')}</span><strong>{pointsPolicy.courseReward} {t('نقطة','points')}</strong></div></div></div></section>
      <section className="instructor-review-section"><div className="instructor-review-section-heading"><h2>{t('الأهداف التعليمية','Learning objectives')}</h2><Link to={edit}>{t('تعديل الأهداف','Edit objectives')}</Link></div>{objectives.length ? <ul>{objectives.map((objective, index) => <li key={objective.id || index}>{localized(objective, language)}</li>)}</ul> : <p>{t('لم تُضف أهداف تعليمية بعد.','No learning objectives have been added yet.')}</p>}</section>
      <section className="instructor-review-section instructor-curriculum-preview"><div className="instructor-review-section-heading"><h2>{t('منهج الدورة ومهامها','Curriculum and tasks')}</h2><Link to={`${base}/curriculum`}>{t('تعديل المنهج','Edit curriculum')}</Link></div><p>{sections.length} {t('أقسام','sections')} · {lessons.length} {t('دروس','lessons')}</p>{!sections.length && <p>{t('أضف قسمًا ودروسًا للمتابعة.','Add a section and lessons to continue.')}</p>}<div className="instructor-review-sections">{sections.map((section, index) => <article className="instructor-review-course-section" key={section.id}><div className="instructor-review-section-title"><strong>{index + 1}. {localized(section.title, language)}</strong><small>{section.lessons.length} {t('دروس','lessons')}</small></div><div className="instructor-review-lessons">{section.lessons.map((lesson, lessonIndex) => <div className="instructor-review-lesson" key={lesson.id}><div><span>{lessonIndex + 1}</span><strong>{localized(lesson.title,language)}</strong></div><div className="instructor-review-lesson-meta"><small>{['reading','article'].includes(lesson.contentType) ? t('قراءة','Reading') : t('فيديو','Video')}</small><span>{lesson.minutes || 0} {t('دقيقة','min')}</span></div></div>)}</div>{section.task && <p><strong>{t('مهمة القسم','Section task')}:</strong> {localized(section.task.title,language)}</p>}</article>)}</div></section>
      <section className="instructor-review-instructor-card"><Icon name="user" size={22}/><div><span>{t('المدرّب','Instructor')}</span><h3>{profile.name || localized(course.instructor,language) || t('ملف المدرّب','Instructor profile')}</h3></div></section>
    </main><aside className="instructor-review-sidebar"><section className="instructor-readiness-card"><div className="instructor-readiness-heading"><h2>{t('جاهزية المسودة','Draft readiness')}</h2><strong>{readiness}%</strong></div><div className="instructor-readiness-list">{checks.map(([label,done]) => <div key={label}><Icon name={done ? 'check':'info'} size={16}/><span>{label}</span></div>)}</div><p className="instructor-readiness-note">{t('الجاهزية هنا لتجهيز المسودة، وليست اعتمادًا للمحتوى أو ضمانًا لعمل الفيديو.','Readiness helps prepare the draft; it does not approve content or verify video playback.')}</p></section><section className="instructor-review-points-card"><h2>{t('مكافأة إكمال الدورة','Course completion reward')}</h2><strong>{pointsPolicy.courseReward} {t('نقطة','points')}</strong><p>{t('تُمنح للمتعلّم بعد إكمال المتطلبات واعتمادها. تكلفة التسجيل منفصلة عنها.','Awarded to learners after completion requirements are approved. Enrollment cost is separate.')}</p></section><section className="instructor-final-submit-card"><h2>{t('الإرسال للمراجعة','Submit for review')}</h2><p>{readiness === 100 ? t('المسودة جاهزة لمراجعة تفاصيل الإرسال.','The draft is ready to review submission details.') : t('أكمل البنود الناقصة قبل الإرسال.','Complete the missing requirements before submission.')}</p><button type="button" className="instructor-button" disabled={readiness !== 100} onClick={() => setShowSubmit(true)}>{t('متابعة الإرسال','Continue to submission')}</button><Link to={`${base}/curriculum`}>{t('العودة للتعديل','Back to editing')}</Link></section></aside></div>
    {showSubmit && <Modal title={t('إرسال الدورة للمراجعة','Submit course for review')} onClose={() => setShowSubmit(false)}><p>{t('المسودة جاهزة في المعاينة. الإرسال للأدمن والنشر سيتاحان عند ربط خدمة الدورات. لم تُرسل أو تُنشر هذه الدورة.','The draft is ready in the preview. Administrator submission and publishing require the course service. This course has not been submitted or published.')}</p><button type="button" className="button" onClick={() => setShowSubmit(false)}>{t('العودة للمسودة','Back to draft')}</button></Modal>}
  </div></section>;
}
