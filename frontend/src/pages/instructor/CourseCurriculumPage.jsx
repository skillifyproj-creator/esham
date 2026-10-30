import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";

import { localized, taskIsReady } from "../../data/instructorCourseWorkspace";
import { courseRequest, curriculumPath, mapCourse, mapSection, loadCurriculumReadiness } from '../../services/curriculumApi';
import { pointsPolicy } from '../../data/pointsPolicy';
import Icon from "../../components/Icon";
import InstructorCourseStepper from "../../components/instructor/InstructorCourseStepper";
import CourseTasksPanel from '../../components/instructor/CourseTasksPanel';
import SubmissionEligibilityPanel from '../../components/instructor/SubmissionEligibilityPanel';
import { usePreferences } from "../../context/PreferencesContext";
import instructorCopy from "../../i18n/instructorCopy";
import "../../styles/instructor.css";
import "../../styles/curriculum-editor.css";

export default function CourseCurriculumPage() {
  const { language } = usePreferences();
  const c = instructorCopy[language];
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const initialSections = [];

  const [storedSections, setSections] = useState(initialSections);
  const [contentReadiness, setContentReadiness] = useState(null);
  const sections = storedSections.map(section => ({ ...section, progress: section.readiness?.percentage ?? 0 }));
  const [expandedSections, setExpandedSections] = useState(
    initialSections.map((section) => section.id),
  );

  const [editingSection, setEditingSection] = useState(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [saved, setSaved] = useState(true);
  const [saveError, setSaveError] = useState('');

  const reload = async () => {
    const data = await loadCurriculumReadiness(courseId);
    setSections(data.sections.map(mapSection)); setContentReadiness(data);
  };
  useEffect(() => {
    if (!courseId) return;
    const controller = new AbortController();
    setLoading(true); setCourse(null); setSaveError('');
    Promise.all([courseRequest(`/courses/${courseId}`, undefined, 'GET', controller.signal),
      loadCurriculumReadiness(courseId, controller.signal)])
      .then(async ([detail, existing]) => {
        let data = existing;
        if (!existing.sections.length) {
          await courseRequest(`${curriculumPath(courseId)}/ensure-default`, undefined, 'POST', controller.signal);
          data = await loadCurriculumReadiness(courseId, controller.signal);
        }
        if (!controller.signal.aborted) { setCourse(mapCourse(detail)); setSections(data.sections.map(mapSection)); setExpandedSections(data.sections.map(x => x.id)); setContentReadiness(data); }
      })
      .catch(error => { if (!controller.signal.aborted) setSaveError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [courseId]);
  const mutate = async action => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setSaved(false); setSaveError('');
    try { await action(); await reload(); setSaved(true); }
    catch (error) { setSaveError(error.message); }
    finally { operation.current = false; setBusy(false); }
  };
  const move = (items, index, direction, sectionId) => {
    const ids = items.map(x => x.id), target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    mutate(() => courseRequest(`${curriculumPath(courseId)}${sectionId ? `/${sectionId}/lessons` : ''}/reorder`, { ids }, 'PUT'));
  };
  const remove = (sectionId, lessonId) => {
    if (!window.confirm(language === 'ar' ? 'حذف هذا العنصر؟' : 'Delete this item?')) return;
    mutate(() => courseRequest(`${curriculumPath(courseId)}/${sectionId}${lessonId ? `/lessons/${lessonId}` : ''}`, undefined, 'DELETE'));
  };

  const totalLessons = useMemo(
    () =>
      sections.reduce(
        (total, section) => total + section.lessons.length,
        0,
      ),
    [sections],
  );

  const totalMinutes = useMemo(
    () =>
      sections.reduce(
        (total, section) =>
          total +
          section.lessons.reduce(
            (sectionTotal, lesson) =>
              sectionTotal + lesson.minutes,
            0,
          ),
        0,
      ),
    [sections],
  );

  const completedSections = contentReadiness?.completedSections ?? 0;
  const readiness = contentReadiness?.percentage ?? 0;

  const toggleSection = (sectionId) => {
    setExpandedSections((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  };

  const updateSectionTitle = sectionId => {
    const section = sections.find(item => item.id === sectionId);
    setEditingSection(sectionId); setSectionTitle(localized(section.title, language)); setTitleError('');
  };
  const saveSectionTitle = async section => {
    const value = sectionTitle.trim();
    if (!value || value.length > 200) { setTitleError(language === 'ar' ? 'أدخل عنوانًا من 1 إلى 200 حرف.' : 'Enter a title between 1 and 200 characters.'); return; }
    if (operation.current) return;
    operation.current = true; setBusy(true); setTitleError('');
    try {
      const updated = await courseRequest(`${curriculumPath(courseId)}/${section.id}`, {
        titleAr: language === 'ar' ? value : section.title.ar,
        titleEn: language === 'en' ? value : section.title.en, sortOrder: section.sortOrder,
      }, 'PUT');
      setSections(current => current.map(item => item.id === updated.id ? mapSection(updated) : item));
      await reload();
      setEditingSection(null); setSaved(true);
    } catch (error) { setTitleError(error.message); }
    finally { operation.current = false; setBusy(false); }
  };

  const addSection = () => {
    const newSection = {
      id: `section-${Date.now()}`,
      title: {
        ar: "قسم جديد",
        en: "New Section",
      },
      lessons: [],
      progress: 0,
      task: null,
    };

    mutate(async () => {
      const created = await courseRequest(curriculumPath(courseId), { titleAr: newSection.title.ar, titleEn: newSection.title.en,
        sortOrder: storedSections.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0) }, 'POST');
      setExpandedSections(current => [...current, created.id]);
    });
  };

  const addLesson = (sectionId) => {
    navigate(
      `/instructor/courses/${course.id}/sections/${sectionId}/lessons/new`,
    );
  };

  const saveDraft = () => {
    mutate(() => Promise.resolve());
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes} ${c.curriculum.minuteShort}`;
    }

    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    const hourLabel = `${hours}${language === "en" ? "" : " "}${c.curriculum.hourShort}`;
    const minuteLabel = `${remaining}${language === "en" ? "" : " "}${c.curriculum.minuteUnit}`;

    return remaining ? `${hourLabel} ${minuteLabel}` : hourLabel;
  };

  if (!courseId) return <Navigate to="/instructor/courses/new" replace />;
  if (loading) return <section className="container instructor-detail-page" role="status">{language === 'ar' ? 'جارٍ التحميل…' : 'Loading curriculum…'}</section>;
  if (!course) return <section className="container instructor-detail-page"><p role="alert">{saveError || 'Course not found'}</p><Link to="/instructor/courses">{language === 'ar' ? 'العودة إلى دوراتي' : 'Back to my courses'}</Link></section>;
  return (<section className="instructor-curriculum-page instructor-detail-page">
      <div className="container">

        {/* Header */}
        <header className="curriculum-page-header">
          <div>
            <h1>
              {c.curriculum?.title ||
                (language === "en"
                  ? "Course Curriculum"
                  : "منهاج الدورة")}
              : {(course.title?.[language] || course.title?.ar || course.title?.en || "")}
            </h1>

            <p>
              {(course.description?.[language] || course.description?.ar || course.description?.en || "")}
            </p>
          </div>

          <div className="curriculum-header-status">
            <span className="curriculum-save-status">
              <Icon name="cloud" size={15} />

              {saved
                ? c.curriculum?.saved ||
                  (language === "en"
                    ? "Saved automatically"
                    : "محفوظ تلقائيًا")
                : c.curriculum?.unsaved ||
                  (language === "en"
                    ? "Unsaved changes"
                    : "تغييرات غير محفوظة")}
            </span>
          </div>
        </header>

        {saveError && <p role="alert">{saveError}</p>}<InstructorCourseStepper currentStep={2} />

        {/* Main layout */}
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><div className="curriculum-layout">

          {/* Main curriculum */}
          <main className="curriculum-main"><p className="instructor-media-demo-note">{language === "ar" ? "المهام المطلوبة: من مهمة إلى ثلاث مهام للدورة كاملة. لا يلزم إضافة مهمة لكل قسم." : "Required tasks: one to three per course, not one per section."} {tasks.length}/3</p>

            <section className="curriculum-content-header">
              <div>
                <h2>
                  {c.curriculum?.courseContent ||
                    (language === "en"
                      ? "Course Content"
                      : "محتوى الدورة")}
                </h2>

                <p>
                  {sections.length}{" "}
                  {c.curriculum?.sections ||
                    (language === "en"
                      ? "sections"
                      : "أقسام")}{" "}
                  · {totalLessons}{" "}
                  {c.curriculum?.lessons ||
                    (language === "en"
                      ? "lessons"
                      : "دروس")}{" "}
                  · {formatDuration(totalMinutes)}
                </p>
              </div>

              <div className="curriculum-content-actions">
                <button
                  type="button"
                  className="instructor-button instructor-button-outline"
                  onClick={() =>
                    setExpandedSections(
                      sections.map(
                        (section) => section.id,
                      ),
                    )
                  }
                >
                  {c.curriculum?.expandAll ||
                    (language === "en"
                      ? "Expand all"
                      : "فتح الكل")}
                </button>

                <button
                  type="button"
                  className="instructor-button"
                  onClick={addSection}
                >
                  <Icon name="plus" size={16} />
                  {c.curriculum?.addSection ||
                    (language === "en"
                      ? "Add Section"
                      : "إضافة قسم")}
                </button>
              </div>
            </section>

            <CourseTasksPanel courseId={courseId} sections={storedSections} onChange={setTasks} />
            {!sections.length && <p role="status">{language === 'ar' ? 'أضف قسمًا لبدء بناء المنهج.' : 'Add a section to start building your curriculum.'}</p>}
            {sections.map((section, index) => {
              const isExpanded =
                expandedSections.includes(
                  section.id,
                );

              const sectionMinutes =
                section.lessons.reduce(
                  (total, lesson) =>
                    total + lesson.minutes,
                  0,
                );

              return (
                <section
                  className="curriculum-section-card"
                  key={section.id}
                >
                  <div className="curriculum-section-header">

                    <div className="curriculum-section-title">
                      <button
                        type="button"
                        className="curriculum-collapse-button"
                        onClick={() =>
                          toggleSection(
                            section.id,
                          )
                        }
                        aria-label={
                          isExpanded
                            ? c.curriculum
                                ?.collapse ||
                              "Collapse"
                            : c.curriculum
                                ?.expand ||
                              "Expand"
                        }
                      >
                        <Icon
                          name="chevron-down"
                          size={17}
                        />
                      </button>

                      <div>
                        <div className="curriculum-section-kicker">
                          {c.curriculum.section} {index + 1}

                          <span
                            className={
                              section.progress ===
                              100
                                ? "curriculum-status ready"
                                : "curriculum-status warning"
                            }
                          >
                            {section.progress ===
                            100
                              ? c.curriculum
                                  ?.complete ||
                                (language ===
                                "en"
                                  ? "Complete"
                                  : "مكتمل")
                              : c.curriculum
                                  ?.needsWork ||
                                (language ===
                                "en"
                                  ? "Needs work"
                                  : "يحتاج استكمال")}
                          </span>
                        </div>

                        {editingSection === section.id ? <div className="curriculum-inline-title">
                          <input autoFocus aria-label={language === 'ar' ? 'عنوان القسم' : 'Section title'} maxLength={200} value={sectionTitle}
                            onChange={event => setSectionTitle(event.target.value)}
                            onKeyDown={event => { if (event.key === 'Enter') saveSectionTitle(section); if (event.key === 'Escape') setEditingSection(null); }} />
                          <button type="button" onClick={() => saveSectionTitle(section)}>{language === 'ar' ? 'حفظ' : 'Save'}</button>
                          <button type="button" onClick={() => setEditingSection(null)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                          {titleError && <small role="alert">{titleError}</small>}
                        </div> : <h3><button className="curriculum-title-button" type="button" onClick={() => updateSectionTitle(section.id)}>{localized(section.title, language)}</button></h3>}

                        <p>
                          {section.lessons.length}{" "}
                          {c.curriculum
                            ?.lessons ||
                            (language ===
                            "en"
                              ? "lessons"
                              : "دروس")}{" "}
                          ·{" "}
                          {formatDuration(
                            sectionMinutes,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="curriculum-section-actions">
                      <button type="button" disabled={index === 0} aria-label="Move section up" onClick={() => move(sections, index, -1)}>↑</button>
                      <button type="button" disabled={index === sections.length - 1} aria-label="Move section down" onClick={() => move(sections, index, 1)}>↓</button>
                      <button type="button" aria-label="Delete section" onClick={() => remove(section.id)}>×</button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSectionTitle(
                            section.id,
                          )
                        }
                        aria-label={
                          c.curriculum?.edit ||
                          "Edit"
                        }
                      >
                        <Icon
                          name="edit"
                          size={16}
                        />
                      </button>

                      <span className="curriculum-progress">
                        {section.progress}%
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="curriculum-section-body">
                      {!section.lessons.length && <p>{language === 'ar' ? 'لا توجد دروس بعد.' : 'No lessons yet.'}</p>}

                      {section.lessons.map(
                        (lesson, lessonIndex) => (
                          <article
                            className="curriculum-lesson-row"
                            key={lesson.id}
                          >
                            <span className="curriculum-drag-handle">
                              ⋮⋮
                            </span>
                            <button type="button" disabled={lessonIndex === 0} aria-label="Move lesson up" onClick={() => move(section.lessons, lessonIndex, -1, section.id)}>↑</button>
                            <button type="button" disabled={lessonIndex === section.lessons.length - 1} aria-label="Move lesson down" onClick={() => move(section.lessons, lessonIndex, 1, section.id)}>↓</button>
                            <button type="button" aria-label="Delete lesson" onClick={() => remove(section.id, lesson.id)}>×</button>

                            <span className="curriculum-lesson-number">
                              {lessonIndex + 1}
                            </span>

                            <span className="curriculum-lesson-icon">
                              <Icon
                                name={
                                  lesson.videoUrl
                                    ? "video"
                                    : "lesson"
                                }
                                size={16}
                              />
                            </span>

                            <div className="curriculum-lesson-info">
                              <strong>
                                {localized(lesson.title, language)}
                              </strong>

                              <small>
                                {lesson.videoUrl
                                  ? c.curriculum
                                      ?.videoLesson ||
                                    (language ===
                                    "en"
                                      ? "Video lesson"
                                      : "درس فيديو")
                                  : c.curriculum
                                      ?.lesson ||
                                    (language ===
                                    "en"
                                      ? "Lesson"
                                      : "درس")}{" "}
                                ·{" "}
                                {formatDuration(
                                  lesson.minutes,
                                )}
                              </small>
                            </div>

                            <span className="curriculum-ready-badge">{lesson.readiness?.isReady ? (language === 'ar' ? 'جاهز' : 'Ready') : (language === 'ar' ? 'يحتاج استكمال' : 'Needs completion')}</span>

                            <button
                              type="button"
                              className="curriculum-edit-button"
                              onClick={() =>
                                navigate(
                                  `/instructor/courses/${course.id}/sections/${section.id}/lessons/${lesson.id}/edit`,
                                )
                              }
                            >
                              <Icon
                                name="edit"
                                size={14}
                              />

                              {c.curriculum
                                ?.edit ||
                                (language ===
                                "en"
                                  ? "Edit"
                                  : "تعديل")}
                            </button>
                          </article>
                        ),
                      )}

                      {/* Task */}
                      {section.task && <article
                        className={`curriculum-task-row ${
                          !taskIsReady(section.task, language)
                            ? "needs-review"
                            : ""
                        }`}
                      >
                        <span className="curriculum-task-icon">
                          <Icon
                            name="award"
                            size={17}
                          />
                        </span>

                        <div>
                          <strong>
                            {localized(section.task.title, language)}
                          </strong>

                          <small>
                            {
                              localized(section.task.description, language)
                            }
                          </small>
                        </div>

                        <span
                          className={
                            !taskIsReady(section.task, language)
                              ? "curriculum-task-status warning"
                              : "curriculum-task-status"
                          }
                        >
                          {!taskIsReady(section.task, language)
                            ? c.curriculum
                                ?.needsReview ||
                              (language ===
                              "en"
                                ? "Needs review"
                                : "يحتاج مراجعة")
                            : c.curriculum
                                ?.ready ||
                              (language ===
                              "en"
                                ? "Ready"
                                : "جاهز")}
                        </span>

                        <button
                          type="button"
                          className="curriculum-edit-button"
                          onClick={() =>
                            navigate(
                              `/instructor/courses/${course.id}/sections/${section.id}/tasks/${section.task.id}/edit`,
                            )
                          }
                        >
                          <Icon
                            name="edit"
                            size={14}
                          />

                          {c.curriculum?.edit ||
                            (language ===
                            "en"
                              ? "Edit"
                              : "تعديل")}
                        </button>
                      </article>}
                      <div className="curriculum-section-footer">
                        <button
                          type="button"
                          onClick={() =>
                            addLesson(
                              section.id,
                            )
                          }
                        >
                          <Icon
                            name="plus"
                            size={15}
                          />

                          {c.curriculum
                            ?.addLesson ||
                            (language ===
                            "en"
                              ? "Add Lesson"
                              : "إضافة درس")}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/instructor/courses/${course.id}/tasks/new?displaySectionId=${section.id}`,
                            )
                          }
                        >
                          <Icon
                            name="award"
                            size={15}
                          />

                          {section.task ? (language === 'ar' ? 'تعديل مهمة القسم' : 'Edit section task') : c.curriculum
                            ?.addTask ||
                            (language ===
                            "en"
                              ? "Add Practical Task"
                              : "إضافة مهمة تطبيقية")}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}

            <button
              type="button"
              className="curriculum-add-section-card"
              onClick={addSection}
            >
              <span>
                <Icon name="plus" size={20} />
              </span>

              <strong>
                {c.curriculum?.addNewSection ||
                  (language === "en"
                    ? "Add a new section"
                    : "إضافة قسم جديد")}
              </strong>

              <small>
                {c.curriculum?.sectionHint ||
                  (language === "en"
                    ? "Organize your course into clear learning units."
                    : "نظّم دورتك إلى وحدات تعليمية واضحة.")}
              </small>
            </button>
          </main>

          {/* Sidebar */}
          <aside className="curriculum-sidebar">

            <section className="curriculum-course-card">
              <div className="curriculum-course-image">
                {course.image ? (
                  <img src={course.image} alt={(course.title?.[language] || course.title?.ar || course.title?.en || "")} />
                ) : (
                  <Icon name={course.icon || "book"} size={28} />
                )}

                <span>
                  {course.instructor[language]}
                </span>
              </div>

              <div className="curriculum-course-body">
                <h2>
                  {(course.title?.[language] || course.title?.ar || course.title?.en || "")}
                </h2>

                <p>
                  {(course.description?.[language] || course.description?.ar || course.description?.en || "")}
                </p>

                <div className="curriculum-course-stats">
                  <div>
                    <strong>
                      {totalLessons}
                    </strong>
                    <span>
                      {c.curriculum?.lessons ||
                        (language === "en"
                          ? "Lessons"
                          : "درس")}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {formatDuration(totalMinutes)}
                    </strong>
                    <span>
                      {c.curriculum?.duration ||
                        (language === "en"
                          ? "Duration"
                          : "المدة")}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {sections.length}
                    </strong>
                    <span>
                      {c.curriculum?.sections ||
                        (language === "en"
                          ? "Sections"
                          : "أقسام")}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {tasks.length}</strong><span>{c.curriculum?.tasks ||
                        (language === "en"
                          ? "Tasks"
                          : "مهام")}
                    </span>
                  </div>
                </div>

                <div className="curriculum-points-card">
                  <Icon name="star" size={17} />

                  <div>
                    <strong>
                      {pointsPolicy.enrollmentCost}{" "}
                      {c.points || "نقطة"}
                    </strong>

                    <span>
                      {c.curriculum
                        ?.courseReward ||
                        (language === "en"
                          ? "Enrollment cost"
                          : "تكلفة التسجيل")}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="curriculum-readiness-card">
              <div className="curriculum-readiness-heading">
                <div>
                  <h3>
                    {c.curriculum?.readiness ||
                      (language === "en"
                        ? "Publishing readiness"
                        : "جاهزية النشر")}
                  </h3>

                  <strong>
                    {readiness}%
                  </strong>
                </div>

                <div className="curriculum-readiness-progress">
                  <span
                    style={{
                      width: `${readiness}%`,
                    }}
                  />
                </div>
              </div>

              <p>
                {completedSections}{" "}
                {c.curriculum
                  ?.sectionsComplete ||
                  (language === "en"
                    ? "sections are complete"
                    : "أقسام مكتملة")}
              </p>

              <SubmissionEligibilityPanel courseId={courseId} refreshKey={JSON.stringify([contentReadiness, tasks])} />
            </section>

            <section className="curriculum-guidance-card">
              <div>
                <Icon name="lightbulb" size={18} />
                <strong>
                  {c.curriculum?.tipTitle ||
                    (language === "en"
                      ? "Instructor tip"
                      : "نصيحة للمدرب")}
                </strong>
              </div>

              <p>
                {c.curriculum?.tipText ||
                  (language === "en"
                    ? "Keep each section focused on one learning outcome and follow it with a practical task."
                    : "اجعل كل قسم يركز على نتيجة تعليمية واضحة، ووزّع من مهمة إلى ثلاث مهام على الدورة كاملة.")}
              </p>
            </section>
          </aside>
        </div></fieldset>
      </div>

      {/* Bottom action bar */}
      <div className="curriculum-bottom-bar">
        <div className="container">
          <div className="curriculum-bottom-info">
            <Link to={courseId ? `/instructor/courses/${courseId}/edit` : "/instructor/courses/new"}>{c.curriculum?.backToBasics ||
                (language === "en"
                  ? "Back to Basic Information"
                  : "العودة للمعلومات الأساسية")}
            </Link>

            <span className="curriculum-bottom-dot">
              •
            </span>

            <span>
              {saved
                ? c.curriculum?.savedShort ||
                  (language === "en"
                    ? "All changes saved"
                    : "تم حفظ التغييرات")
                : c.curriculum?.unsavedShort ||
                  (language === "en"
                    ? "Unsaved changes"
                    : "تغييرات غير محفوظة")}
            </span>
          </div>

          <div className="curriculum-bottom-actions">
            <button
              type="button"
              className="instructor-button instructor-button-outline"
              onClick={saveDraft}
            >
              <Icon name="save" size={16} />
              {c.curriculum?.saveDraft ||
                (language === "en"
                  ? "Save Draft"
                  : "حفظ كمسودة")}
            </button>

            <button
              type="button"
              className="instructor-button instructor-button-outline"
              onClick={() =>
                navigate(
                  courseId ? `/instructor/courses/${courseId}/review` : "/instructor/courses/new/review",
                )
              }
            >
              <Icon name="eye" size={16} />
              {c.curriculum?.preview ||
                (language === "en"
                  ? "Preview Course"
                  : "معاينة الدورة")}
            </button>

            <button
              type="button"
              className="instructor-button"
              onClick={() =>
                navigate(courseId ? `/instructor/courses/${courseId}/review` : "/instructor/courses/new/review")
              }
            >
              {c.curriculum?.continueReview ||
                (language === "en"
                  ? "Continue to Review & Publish"
                  : "متابعة إلى المراجعة والنشر")}
              <Icon
                name="arrow-left"
                size={16}
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
