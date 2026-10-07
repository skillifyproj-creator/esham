import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { getInstructorCourseWorkspace, saveWorkspaceSections, localized, lessonIsReady, taskIsReady } from "../../data/instructorCourseWorkspace";
import useAccountProfile from "../../hooks/useAccountProfile";
import Icon from "../../components/Icon";
import InstructorCourseStepper from "../../components/instructor/InstructorCourseStepper";
import { usePreferences } from "../../context/PreferencesContext";
import instructorCopy from "../../i18n/instructorCopy";
import "../../styles/instructor.css";

export default function CourseCurriculumPage() {
  const { language } = usePreferences();
  const c = instructorCopy[language];
  const profile = useAccountProfile();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const workspace = getInstructorCourseWorkspace(courseId || 'new');
  const course = workspace ? { ...workspace.course, instructor: { ar: profile.name || "أنت", en: profile.name || "You" } } : null;
  const initialSections = workspace?.sections || [];

  const [storedSections, setSections] = useState(initialSections);
  const sections = storedSections.map(section => { const lessonsReady = section.lessons.length > 0 && section.lessons.every(lesson => lessonIsReady(lesson, language)); const flags = [Boolean(localized(section.title, language)), section.lessons.length > 0, lessonsReady, !section.task || taskIsReady(section.task, language)]; return { ...section, progress: Math.round(flags.filter(Boolean).length / flags.length * 100) }; });
  const [expandedSections, setExpandedSections] = useState(
    initialSections.map((section) => section.id),
  );

  const [saved, setSaved] = useState(true);

  const updateSections = updater => {
    setSections(current => { const next = updater(current); return saveWorkspaceSections(courseId || 'new', next) ? next : current; });
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

  const completedSections = sections.filter(
    (section) => section.progress === 100,
  ).length;

  const readiness = sections.length
    ? Math.round(
        sections.reduce(
          (total, section) => total + (section.progress || 0),
          0,
        ) / sections.length,
      )
    : 0;

  const toggleSection = (sectionId) => {
    setExpandedSections((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  };

  const updateSectionTitle = (sectionId) => {
    const currentSection = sections.find(
      (section) => section.id === sectionId,
    );

    if (!currentSection) return;

    const currentTitle =
      currentSection.title?.[language] || "";

    const nextTitle = window.prompt(
      c.curriculum.enterSectionTitle,
      currentTitle,
    );

    if (!nextTitle?.trim()) return;

    updateSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              title: {
                ...section.title,
                [language]: nextTitle.trim(),
              },
            }
          : section,
      ),
    );

    setSaved(false);
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

    updateSections((current) => [...current, newSection]);
    setExpandedSections((current) => [
      ...current,
      newSection.id,
    ]);
    setSaved(false);
  };

  const addLesson = (sectionId) => {
    navigate(
      `/instructor/courses/${course.id}/sections/${sectionId}/lessons/new`,
    );
  };

  const saveDraft = () => {
    setSaved(true);
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

  if (!course) return <section className="container instructor-detail-page"><h1>{language === 'ar' ? 'الدورة غير موجودة' : 'Course not found'}</h1><Link to="/instructor/courses">{language === 'ar' ? 'العودة إلى دوراتي' : 'Back to my courses'}</Link></section>;
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

        <p className="instructor-media-demo-note">{language === 'ar' ? 'حفظ الدورة الجديدة في جلسة هذا التبويب فقط؛ تعديلات الدورات التجريبية الحالية مؤقتة. جاهزية المنهج منفصلة عن اكتمال معلومات الدورة في صفحة المراجعة.' : 'New courses are saved in this tab session; edits to existing demo courses are temporary. Curriculum readiness is separate from the course information checklist on the review page.'}</p><InstructorCourseStepper currentStep={2} />

        {/* Main layout */}
        <div className="curriculum-layout">

          {/* Main curriculum */}
          <main className="curriculum-main"><p className="instructor-media-demo-note">{language === "ar" ? "المهام المطلوبة: من مهمة إلى ثلاث مهام للدورة كاملة. لا يلزم إضافة مهمة لكل قسم." : "Required tasks: one to three per course, not one per section."} {sections.filter(item => item.task).length}/3</p>

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

                        <h3>
                          {localized(section.title, language)}
                        </h3>

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

                      {section.lessons.map(
                        (lesson, lessonIndex) => (
                          <article
                            className="curriculum-lesson-row"
                            key={lesson.id}
                          >
                            <span className="curriculum-drag-handle">
                              ⋮⋮
                            </span>

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

                            <span className="curriculum-ready-badge">{lessonIsReady(lesson, language) ? (language === 'ar' ? 'جاهز' : 'Ready') : (language === 'ar' ? 'يحتاج استكمال' : 'Needs completion')}</span>

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
                              section.task ? `/instructor/courses/${course.id}/sections/${section.id}/tasks/${section.task.id}/edit` : `/instructor/courses/${course.id}/sections/${section.id}/tasks/new`,
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
                      {sections.filter(section => section.task).length}</strong><span>{c.curriculum?.tasks ||
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
                      {course.coursePoints || 20}{" "}
                      {c.points || "نقطة"}
                    </strong>

                    <span>
                      {c.curriculum
                        ?.courseReward ||
                        (language === "en"
                          ? "Course completion reward"
                          : "مكافأة إتمام الدورة")}
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

              <div className="curriculum-review-note">
                <Icon
                  name="info"
                  size={16}
                />

                <span>
                  {c.curriculum
                    ?.readinessNote ||
                    (language === "en"
                      ? "Complete all lessons and practical tasks before submitting the course for review."
                      : "أكمل جميع الدروس والمهام التطبيقية قبل إرسال الدورة للمراجعة.")}
                </span>
              </div>
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
        </div>
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
