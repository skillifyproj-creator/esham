import UnchangedResubmissionDialog from '../../components/instructor/UnchangedResubmissionDialog';
import CourseSafetyPanel from '../../components/shared/CourseSafetyPanel';
import { mapCourse, mapSection } from '../../services/curriculumApi';
import { eligibilityLabels } from '../../services/submissionEligibility';
import SubmissionEligibilityPanel from '../../components/instructor/SubmissionEligibilityPanel';
import { useCategoryCatalog } from '../../context/CategoryCatalogContext';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import Icon from '../../components/Icon';
import { loadCourseReview, submitCourseReview, createCourseRevision, reviewStatusLabel } from '../../services/courseReviewApi';
import { apiBase } from '../../services/accountApi';
import '../../styles/course-review-workflow.css';
import InstructorCourseStepper from '../../components/instructor/InstructorCourseStepper';
import { usePreferences } from '../../context/PreferencesContext';
import useAccountProfile from '../../hooks/useAccountProfile';
import { localized } from '../../data/courseReadiness';
import { pointsPolicy } from '../../data/pointsPolicy';
import '../../styles/instructor.css';

export default function CourseReviewPage() {
  const { courseId } = useParams();
  const submitting = useRef(false), submitButton = useRef(null);
  const [unchangedWarning, setUnchangedWarning] = useState(false);
  function closeWarning() { setUnchangedWarning(false); requestAnimationFrame(() => submitButton.current?.focus()); }
  const navigate = useNavigate();
  const [revision, refresh] = useState(0), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [confirming, setConfirming] = useState(false), [failed, setFailed] = useState(false);
  const { language } = usePreferences();
  const profile = useAccountProfile();
  const ar = language === 'ar';
  const t = (a, e) => ar ? a : e;
  const { categories } = useCategoryCatalog();
  const [data, setData] = useState(null), [loadError, setLoadError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setData(null); setLoadError('');
    loadCourseReview(courseId, controller.signal).then(snapshot => {
      const v = snapshot.version;
      const cover = snapshot.media.find(x => !x.lessonId && !x.taskId && x.mediaType === 'image');
      if (!controller.signal.aborted) setData({ snapshot, course: { courseId, owner: { name: profile.name }, draft: v },
        curriculum: { sections: snapshot.sections }, tasks: snapshot.tasks, eligibility: snapshot.eligibility,
        coverUrl: cover ? apiBase + cover.contentUrl : '' });
    }).catch(error => { if (!controller.signal.aborted) setLoadError(error.message); });
    return () => controller.abort();
  }, [courseId, revision]);
  async function submit() {
    if (submitting.current || busy || unchangedWarning) return;
    submitting.current = true; setBusy(true); setMessage(''); setFailed(false);
    try {
      await submitCourseReview(courseId, data.snapshot.version.id);
      setMessage(t('تم إرسال الإصدار للمراجعة؛ لن يُنشر قبل الاعتماد.', 'Version submitted for review; publication requires approval.'));
      refresh(x => x + 1);
    } catch (error) {
      if (error.status === 400 && error.code === 'course_resubmission_unchanged') setUnchangedWarning(true);
      else { setFailed(true); setMessage(error.message); }
    } finally { submitting.current = false; setBusy(false); setConfirming(false); }
  }
  async function revise() {
    if (busy) return; setBusy(true); setMessage(''); setFailed(false);
    try { await createCourseRevision(courseId, data.snapshot.version.id); navigate('/instructor/courses/' + courseId + '/curriculum'); }
    catch (error) { setFailed(true); setMessage(error.message); refresh(x => x + 1); }
    finally { setBusy(false); }
  }
  if (!data) return <main className="container section"><p role={loadError ? 'alert' : 'status'}>{loadError || (ar ? '\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0645\u064a\u0644' : 'Loading course review...')}</p><Link to={`/instructor/courses/${courseId}/curriculum`}>{ar ? '\u0627\u0644\u0639\u0648\u062f\u0629' : 'Back'}</Link></main>;
  const category = categories.find(item => item.id === data.course.draft.categoryId);
  const workspace = { course: { ...mapCourse(data.course), image: data.coverUrl, objectives: data.course.draft.objectives, level: data.course.draft.level,
    category: { ar: category?.nameAr || '', en: category?.nameEn || '' } }, sections: data.curriculum.sections.map(mapSection) };
  const base = `/instructor/courses/${courseId || 'new'}`;
  const edit = courseId && courseId !== 'new' ? `${base}/edit` : base;
  if (!workspace) return <main className="container section empty-state"><h1>{t('لا توجد دورة للمراجعة', 'No course to review')}</h1><p>{t('أنشئ المسودة أولًا أو افتح دورة من قائمة دوراتك.', 'Create a draft first or open a course from your course list.')}</p><Link className="button" to="/instructor/courses">{t('العودة إلى دوراتي', 'Back to my courses')}</Link></main>;
  const { course, sections } = workspace;
  const lessons = sections.flatMap(section => section.lessons);
  const minutes = lessons.reduce((sum, lesson) => sum + (Number(lesson.minutes) || 0), 0);
  const objectives = course.objectives || [];
  const contentChecks = data.eligibility.checks.filter(x => x.code !== 'editable-draft');
  const readiness = Math.round(contentChecks.filter(x => x.isMet).length * 100 / contentChecks.length);
  const checks = data.eligibility.checks.map(check => [eligibilityLabels[check.code]?.[ar ? 0 : 1] || check.code, check.isMet]);
  const level = typeof course.level === 'string' ? ({beginner:t('مبتدئ','Beginner'),intermediate:t('متوسط','Intermediate'),advanced:t('متقدم','Advanced')}[course.level] || course.level) : localized(course.level, language);
  return <section className="instructor-review-page instructor-detail-page" dir={ar ? 'rtl' : 'ltr'}><div className="container">
    <header className="instructor-review-header"><div><h1>{t('مراجعة الدورة قبل الإرسال', 'Review your course before submission')}</h1><p>{t('راجع المعلومات والمنهج والمهام كما ستظهر للمتعلّم.', 'Review the information, curriculum and tasks as learners will see them.')}</p></div><div className="instructor-review-header-actions"><Link className="instructor-review-back-button" to={data.snapshot.version.reviewStatus === 'draft' ? `${base}/curriculum` : '/instructor/courses'}><Icon name="arrow-left" size={16}/>{data.snapshot.version.reviewStatus === 'draft' ? t('العودة للمنهج', 'Back to curriculum') : t('العودة إلى دوراتي', 'Back to my courses')}</Link></div></header>
    <InstructorCourseStepper currentStep={3}/>
    
    <div className="instructor-review-layout"><main className="instructor-review-content">
      <section className="instructor-review-preview-status"><strong>{t('معاينة محتوى الدورة', 'Course content preview')}</strong><span>{t('بيانات الدورة الحالية', 'Current course data')}</span></section>
      <section className="instructor-course-preview-card"><div className="instructor-course-preview-cover">{course.image ? <img src={course.image} alt={localized(course.title, language)}/> : <div className="instructor-course-image-empty"><Icon name="camera" size={32}/></div>}<span className="instructor-preview-course-badge">{localized(course.category, language) || t('مجال غير محدد','No category selected')}</span></div><div className="instructor-course-preview-body"><div className="instructor-preview-title-row"><div><h2>{localized(course.title, language) || t('عنوان الدورة','Course title')}</h2><p>{localized(course.description, language)}</p></div>{data.snapshot.version.reviewStatus === 'draft' && <Link className="instructor-preview-edit" to={edit}><Icon name="edit" size={16}/>{t('تعديل البيانات','Edit details')}</Link>}</div><div className="instructor-preview-stats"><div><span>{t('مستوى الدورة','Course level')}</span><strong>{level || '—'}</strong></div><div><span>{t('مدة الدروس','Lesson duration')}</span><strong>{minutes} {t('دقيقة','min')}</strong></div><div><span>{t('عدد الدروس','Lessons')}</span><strong>{lessons.length}</strong></div><div><span>{t('تكلفة التسجيل','Enrollment cost')}</span><strong>{pointsPolicy.instructorEnrollmentReward} {t('نقطة','points')}</strong></div></div></div></section>
      <section className="instructor-review-section"><div className="instructor-review-section-heading"><h2>{t('الأهداف التعليمية','Learning objectives')}</h2>{data.snapshot.version.reviewStatus === 'draft' && <Link to={edit}>{t('تعديل الأهداف','Edit objectives')}</Link>}</div>{objectives.length ? <ul>{objectives.map((objective, index) => <li key={objective.id || index}>{localized(objective, language)}</li>)}</ul> : <p>{t('لم تُضف أهداف تعليمية بعد.','No learning objectives have been added yet.')}</p>}</section>
      <section className="instructor-review-section instructor-curriculum-preview"><div className="instructor-review-section-heading"><h2>{t('منهج الدورة ومهامها','Curriculum and tasks')}</h2>{data.snapshot.version.reviewStatus === 'draft' && <Link to={`${base}/curriculum`}>{t('تعديل المنهج','Edit curriculum')}</Link>}</div><p>{sections.length} {t('أقسام','sections')} · {lessons.length} {t('دروس','lessons')}</p>{!sections.length && <p>{t('أضف قسمًا ودروسًا للمتابعة.','Add a section and lessons to continue.')}</p>}<div className="instructor-review-sections">{sections.map((section, index) => <article className="instructor-review-course-section" key={section.id}><div className="instructor-review-section-title"><strong>{index + 1}. {localized(section.title, language)}</strong><small>{section.lessons.length} {t('دروس','lessons')}</small></div><div className="instructor-review-lessons">{section.lessons.map((lesson, lessonIndex) => <div className="instructor-review-lesson" key={lesson.id}><div><span>{lessonIndex + 1}</span><strong>{localized(lesson.title,language)}</strong></div><div className="instructor-review-lesson-meta"><small>{['reading','article'].includes(lesson.contentType) ? t('قراءة','Reading') : t('فيديو','Video')}</small><span>{lesson.minutes || 0} {t('دقيقة','min')}</span></div></div>)}</div></article>)}</div></section>
      <section className="instructor-review-section"><h2>{ar ? "\u0645\u0647\u0627\u0645 \u0627\u0644\u062f\u0648\u0631\u0629" : "Course tasks"}</h2>{data.tasks.map(task => <p key={task.id}>{localized({ ar: task.titleAr, en: task.titleEn }, language)}</p>)}</section>
      <section className="instructor-review-instructor-card"><Icon name="user" size={22}/><div><span>{t('المدرّب','Instructor')}</span><h3>{profile.name || localized(course.instructor,language) || t('ملف المدرّب','Instructor profile')}</h3></div></section>
    <CourseSafetyPanel courseId={courseId}/></main><aside className="instructor-review-sidebar"><section className="instructor-readiness-card"><div className="instructor-readiness-heading"><h2>{t('جاهزية المحتوى','Content readiness')}</h2><strong>{readiness}%</strong></div><SubmissionEligibilityPanel courseId={courseId} value={data.eligibility} /><p className="instructor-readiness-note">{t('الجاهزية هنا لتجهيز المسودة، وليست اعتمادًا للمحتوى أو ضمانًا لعمل الفيديو.','Readiness helps prepare the draft; it does not approve content or verify video playback.')}</p></section><section className="instructor-review-points-card"><h2>{t('نقاط التدريس','Teaching points')}</h2><strong>{pointsPolicy.instructorEnrollmentReward} {t('نقطة','points')}</strong><p>{t('يكسب المدرّب 20 نقطة عن كل تسجيل، ويدفع المتعلّم 20 نقطة لأي دورة.','Instructors earn 20 points per enrollment. Learners pay 20 points for any course.')}</p></section><section className="instructor-final-submit-card"><h2>{t('الإرسال للمراجعة','Submit for review')}</h2><p>{data.snapshot.version.reviewStatus !== 'draft' ? t('راجع حالة الإصدار وملاحظات المراجعة أدناه. لإنشاء تعديلات، افتح مسودة جديدة بعد القرار.','See the version status and review feedback below. Create a revision draft after a decision to make changes.') : readiness === 100 ? t('المسودة جاهزة لمراجعة تفاصيل الإرسال.','The draft is ready to review submission details.') : t('أكمل البنود الناقصة قبل الإرسال.','Complete the missing requirements before submission.')}</p><p data-review-status={data.snapshot.version.reviewStatus}>{reviewStatusLabel(data.snapshot.version.reviewStatus, language)}{data.snapshot.publishedVersionId === data.snapshot.version.id ? ' · ' + t('منشور', 'Published') : ''}</p>
      {data.snapshot.publishedVersionId && data.snapshot.publishedVersionId !== data.snapshot.version.id && <p data-published-version={data.snapshot.publishedVersionId}>{t('الإصدار السابق ما زال منشورًا.','The previous approved version remains published.')} <Link to={`/courses/${courseId}`}>{t('عرض الدورة المنشورة','View published course')}</Link></p>}
      {unchangedWarning && <UnchangedResubmissionDialog onClose={closeWarning}/>}
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
      {data.snapshot.version.reviewStatus === 'draft' && !confirming && <button type="button" className="instructor-button" ref={submitButton} disabled={busy || unchangedWarning || !data.eligibility.canSubmit} onClick={() => setConfirming(true)}>{t('إرسال للمراجعة', 'Submit for review')}</button>}
      {confirming && <div className="review-feedback"><p>{t('سيُقفل هذا الإصدار أثناء المراجعة. تأكيد الإرسال؟', 'This version will be locked during review. Confirm submission?')}</p><button type="button" className="instructor-button" disabled={busy} onClick={submit}>{t('تأكيد الإرسال', 'Confirm submission')}</button><button type="button" disabled={busy} onClick={() => setConfirming(false)}>{t('إلغاء', 'Cancel')}</button></div>}
      {['rejected','changes_requested','approved'].includes(data.snapshot.version.reviewStatus) && <button type="button" className="instructor-button" disabled={busy} onClick={revise}>{t('إنشاء مسودة للتعديل', 'Create revision draft')}</button>}
      {data.snapshot.decisions.map(x => <div className="review-feedback" key={x.id}><strong>{reviewStatusLabel(x.decision, language)}</strong><p>{x.comment}</p></div>)}<Link to="/instructor/courses">{t('العودة إلى دوراتي','Back to my courses')}</Link></section></aside></div>

  </div></section>;
}
