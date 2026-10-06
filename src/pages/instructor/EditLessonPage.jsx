import { pointsPolicy } from "../../data/pointsPolicy";
import PendingFeature from "../../components/shared/PendingFeature";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
import {
  instructorCurriculumDemo,
  saveInstructorLesson,
} from "../../data/instructorCurriculumDemo";

export default function EditLessonPage() {
  const { courseId, sectionId: routeSectionId, lessonId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = usePreferences();
  const course = instructorCurriculumDemo.course;
  const isNewLesson = lessonId === "new";
  const canOpenVideoTools = Boolean(lessonId && !isNewLesson && routeSectionId);
  const videoBasePath = `/instructor/courses/${courseId}/sections/${routeSectionId}/lessons/${lessonId}/video`;
  const section = String(course.id) === String(courseId)
    ? instructorCurriculumDemo.sections.find((item) =>
        routeSectionId
          ? item.id === routeSectionId
          : item.lessons.some((currentLesson) => currentLesson.id === lessonId),
      )
    : undefined;
  const originalLesson = section?.lessons.find(
    (item) => item.id === lessonId,
  );

  const [lesson, setLesson] = useState(() => {
    const source = location.state?.lessonDraft || (isNewLesson ? null : originalLesson);
    const sourceTitle = source?.title;

    return {
      id: source?.id ?? "",
      courseId: course.id,
      sectionId: section?.id ?? routeSectionId ?? "",
      courseTitle: course.title.ar,
      sectionTitle: section?.title.ar ?? "",
      title:
        typeof sourceTitle === "object"
          ? sourceTitle?.[language] ?? ""
          : sourceTitle ?? "",
      description: source?.description ?? "",
      contentType: source?.contentType ?? "video",
      duration: source?.minutes ?? 10,
      video: {
        name: source?.video?.name ?? source?.videoUrl ?? "",
        duration: source?.video?.duration ?? "",
        size: source?.video?.size ?? "",
        quality: source?.video?.quality ?? "",
        encoding: source?.video?.encoding ?? "",
      },
      objectives: [...(source?.objectives ?? [])],
      resources: [...(source?.resources ?? [])],
    };
  });
  const [newObjective, setNewObjective] = useState("");
  const [savedMessage, setSavedMessage] = useState(
    isNewLesson
      ? "مسودة جديدة غير محفوظة."
      : "معاينة الدرس التجريبية؛ الحفظ محلي داخل جلسة التطبيق.",
  );

  const readinessItems = useMemo(
    () => [
      {
        id: 1,
        label: "عنوان الدرس واضح ومحدد",
        done: Boolean(lesson.title.trim()),
      },
      {
        id: 2,
        label: "فيديو الدرس مرفوع ومجهز",
        done: Boolean(lesson.video?.name),
      },
      {
        id: 3,
        label: "أهداف الدرس التعليمية محددة",
        done: lesson.objectives.length > 0,
      },
      {
        id: 4,
        label: "تم ضبط مدة الدرس",
        done: Number(lesson.duration) > 0,
      },
    ],
    [lesson]
  );

  const completedItems = readinessItems.filter((item) => item.done).length;

  const readiness =
    readinessItems.length > 0
      ? Math.round((completedItems / readinessItems.length) * 100)
      : 0;

  const updateLesson = (field, value) => {
    setLesson((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const addObjective = () => {
    const value = newObjective.trim();

    if (!value) return;

    setLesson((current) => ({
      ...current,
      objectives: [...current.objectives, value],
    }));

    setNewObjective("");
  };

  const removeObjective = (index) => {
    setLesson((current) => ({
      ...current,
      objectives: current.objectives.filter(
        (_, objectiveIndex) => objectiveIndex !== index
      ),
    }));
  };

  const handleSave = (message) => {
    if (!course || !section || !lesson.title.trim()) {
      setSavedMessage("أدخل عنوان الدرس أولًا.");
      return;
    }

    const nextId = isNewLesson ? `lesson-${Date.now()}` : originalLesson.id;
    const title =
      originalLesson?.title && typeof originalLesson.title === "object"
        ? { ...originalLesson.title }
        : { ar: "", en: "" };
    title[language] = lesson.title.trim();

    const savedLesson = {
      ...originalLesson,
      id: nextId,
      courseId: course.id,
      sectionId: section.id,
      title,
      description: lesson.description,
      minutes: Number(lesson.duration) || 1,
      contentType: lesson.contentType,
      objectives: [...lesson.objectives],
      resources: [...lesson.resources],
      video: { ...lesson.video },
      videoUrl:
        lesson.contentType === "video"
          ? lesson.video.name || originalLesson?.videoUrl || ""
          : "",
    };

    const saved = saveInstructorLesson(courseId, section.id, savedLesson);

    if (!saved) {
      setSavedMessage("تعذر حفظ الدرس في هذا القسم.");
      return;
    }

    setSavedMessage(message);
    navigate(`/instructor/courses/${courseId}/curriculum`, { state: { focusSectionId: section.id } });
  };

  if (!course || !section || (!isNewLesson && !originalLesson)) {
    return (
      <div className="instructor-edit-lesson-page instructor-detail-page">
        <div className="container">
          <section className="instructor-edit-lesson-side-card">
            <h1>لم يتم العثور على الدرس</h1>
            <Link
              className="instructor-course-button instructor-course-button-outline"
              to="/instructor/courses/new/curriculum"
            >
              العودة إلى المنهج
            </Link>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="instructor-edit-lesson-page instructor-detail-page">
      <div className="container">
        {/* Breadcrumb */}
        <div className="instructor-edit-lesson-breadcrumb">
          <Link to="/instructor/courses">الدورات التدريبية</Link>
          <span>/</span>

          <Link to="/instructor/courses/new/curriculum">
            {lesson.courseTitle}
          </Link>

          <span>/</span>
          <span>{lesson.sectionTitle}</span>

          <span>/</span>
          <strong>{isNewLesson ? "إنشاء درس جديد" : "تحرير الدرس"}</strong>
        </div>

        {/* Header */}
        <section className="instructor-edit-lesson-header">
          <div>
            <div className="instructor-edit-lesson-title-row">
              <h1>{isNewLesson ? "إنشاء درس جديد" : "تحرير الدرس"}</h1>
              <span className="instructor-lesson-status draft">
                {isNewLesson ? "مسودة جديدة" : "مسودة"}
              </span>
            </div>

            <p>
              أضف محتوى الدرس وتأكد من جاهزيته ومطابقته للمعايير
              التعليمية قبل الاعتماد.
            </p>
          </div>

          <div className="instructor-edit-lesson-header-actions">
            <Link
              to="/instructor/courses/new/curriculum"
              className="instructor-course-button instructor-course-button-outline"
            >
              <Icon name="arrow-left" size={15} />
              العودة إلى المنهج
            </Link>

            <Link
                to={`/instructor/courses/${courseId}/sections/${section?.id}/lessons/${lessonId}/video`}
                state={{ lessonDraft: lesson }}
                className="instructor-course-button instructor-course-button-outline"
            >
              <Icon name="video" size={15} />
              {language === "ar" ? "إضافة فيديو" : "Add video"}
            </Link>

            <button
              type="button"
              className="instructor-course-button instructor-course-button-outline"
              onClick={() => handleSave("تم حفظ الدرس كمسودة.")}
            >
              <Icon name="save" size={15} />
              حفظ كمسودة
            </button>

            <button
              type="button"
              className="instructor-course-button instructor-course-button-primary"
              onClick={() => handleSave("تم حفظ التعديلات بنجاح.")}
            >
              <Icon name="check" size={15} />
              {isNewLesson ? "حفظ الدرس" : "حفظ التعديلات"}
            </button>
          </div>
        </section>

        {/* Main layout */}
        <div className="instructor-edit-lesson-layout">
          {/* Main column */}
          <main className="instructor-edit-lesson-content">
            {/* Basic information */}
            <section className="instructor-edit-lesson-card">
              <div className="instructor-edit-lesson-card-header">
                <div>
                  <h2>معلومات الدرس الأساسية</h2>
                  <p>البيانات الأساسية التي ستظهر للمتعلمين.</p>
                </div>
                <Icon name="lesson" size={20} />
              </div>

              <div className="instructor-edit-lesson-form">
                <label className="instructor-edit-lesson-field">
                  <span>
                    عنوان الدرس <b>*</b>
                  </span>

                  <input
                    type="text"
                    value={lesson.title}
                    onChange={(event) =>
                      updateLesson("title", event.target.value)
                    }
                  />

                  <small>
                    سيظهر هذا العنوان في قائمة دروس الكورس.
                  </small>
                </label>

                <label className="instructor-edit-lesson-field">
                  <span>
                    وصف الدرس ومخرجاته <b>*</b>
                  </span>

                  <textarea
                    rows="4"
                    value={lesson.description}
                    onChange={(event) =>
                      updateLesson("description", event.target.value)
                    }
                  />

                  <small>
                    {lesson.description.length} / 300 حرف
                  </small>
                </label>

                <div className="instructor-edit-lesson-form-row">
                  <div className="instructor-edit-lesson-field">
                    <span>نوع محتوى الدرس</span>

                    <div className="instructor-lesson-type-options">
                      <label
                        className={
                          lesson.contentType === "video"
                            ? "selected"
                            : ""
                        }
                      >
                        <input
                          type="radio"
                          name="lesson-content-type"
                          value="video"
                          checked={lesson.contentType === "video"}
                          onChange={() =>
                            updateLesson("contentType", "video")
                          }
                        />

                        <span className="instructor-lesson-type-copy"><strong>{language === "ar" ? "فيديو تدريبي" : "Training video"}</strong><small>{language === "ar" ? "شرح مرئي ومحتوى فيديو للدرس." : "A video lesson with visual explanations."}</small></span>
                      </label>

                      <label
                        className={
                          lesson.contentType === "article"
                            ? "selected"
                            : ""
                        }
                      >
                        <input
                          type="radio"
                          name="lesson-content-type"
                          value="article"
                          checked={lesson.contentType === "article"}
                          onChange={() =>
                            updateLesson("contentType", "article")
                          }
                        />

                        <span className="instructor-lesson-type-copy"><strong>{language === "ar" ? "قراءة ومقال" : "Reading and article"}</strong><small>{language === "ar" ? "محتوى نصي ومواد للقراءة." : "Text content and reading materials."}</small></span>
                      </label>
                    </div>
                  </div>

                  <label className="instructor-edit-lesson-field">
                    <span>مدة الدرس التقديرية</span>

                    <div className="instructor-lesson-duration-input">
                      <input
                        type="number"
                        min="1"
                        value={lesson.duration}
                        onChange={(event) =>
                          updateLesson(
                            "duration",
                            event.target.value
                          )
                        }
                      />
                      <span>دقيقة</span>
                    </div>

                    <small>
                      حدد مدة تقريبية لمحتوى الدرس.
                    </small>
                  </label>
                </div>
              </div>
            </section>

            {/* Video */}
            <section className="instructor-edit-lesson-card">
              <div className="instructor-edit-lesson-card-header">
                <div>
                  <h2>فيديو الدرس</h2>
                  <p>الفيديو المرتبط بهذا الدرس.</p>
                </div>

                <span className="instructor-ready-badge">
                  <span />
                  جاهز للمعاينة
                </span>
              </div>

              <div className="instructor-lesson-video-box">
                <div className="instructor-lesson-video-preview">
                  <PendingFeature  aria-label="تشغيل الفيديو">
                    <Icon name="video" size={24} />
                  </PendingFeature>

                  <span>معاينة الفيديو</span>

                  <small>{lesson.video.duration}</small>
                </div>

                <div className="instructor-lesson-video-details">
                  <div>
                    <strong>{lesson.video.name}</strong>

                    <div className="instructor-lesson-video-meta">
                      <span>{lesson.video.duration}</span>
                      <span>•</span>
                      <span>{lesson.video.size}</span>
                      <span>•</span>
                      <span>{lesson.video.quality}</span>
                    </div>
                  </div>

                  <span className="instructor-video-quality">
                    معدل الترميز: {lesson.video.encoding}
                  </span>
                </div>

                <div className="instructor-lesson-video-actions">
                  {canOpenVideoTools ? (
                    <>
                      <Link to={`${videoBasePath}/preview`} state={{ lessonDraft: lesson }} className="instructor-course-button instructor-course-button-outline">
                        <Icon name="video" size={15} />
                        {language === "ar" ? "معاينة الفيديو" : "Preview video"}
                      </Link>
                      <Link to={`${videoBasePath}/edit`} state={{ lessonDraft: lesson }} className="instructor-course-button instructor-course-button-outline">
                        <Icon name="edit" size={15} />
                        {language === "ar" ? "تحرير الفيديو" : "Edit video"}
                      </Link>
                    </>
                  ) : (
                    <>
                      <PendingFeature className="instructor-course-button instructor-course-button-outline">
                        <Icon name="video" size={15} />
                        {language === "ar" ? "معاينة الفيديو" : "Preview video"}
                      </PendingFeature>
                      <PendingFeature className="instructor-course-button instructor-course-button-outline">
                        <Icon name="edit" size={15} />
                        {language === "ar" ? "تحرير الفيديو" : "Edit video"}
                      </PendingFeature>
                    </>
                  )}
                </div>
              </div>

              <div className="instructor-edit-lesson-note">
                <Icon name="info" size={15} />
                <span>
                  يمكنك استبدال الفيديو أو معاينته مباشرة قبل اعتماد
                  الدرس في المنهج الدراسي.
                </span>
              </div>
            </section>

            {/* Objectives */}
            <section className="instructor-edit-lesson-card">
              <div className="instructor-edit-lesson-card-header">
                <div>
                  <h2>أهداف الدرس التعليمية</h2>
                  <p>
                    حدد ما سيتمكن المتعلم من فهمه واكتسابه بنهاية
                    هذا الدرس.
                  </p>
                </div>

                <span className="instructor-section-counter">
                  {lesson.objectives.length} من 3
                </span>
              </div>

              <div className="instructor-objectives-list">
                {lesson.objectives.map((objective, index) => (
                  <div
                    className="instructor-objective-item"
                    key={`${objective}-${index}`}
                  >
                    <span className="instructor-objective-check">
                      <Icon name="check" size={13} />
                    </span>

                    <span>{objective}</span>

                    <button
                      type="button"
                      aria-label="حذف الهدف"
                      onClick={() => removeObjective(index)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="instructor-add-objective">
                <input
                  type="text"
                  value={newObjective}
                  placeholder="اكتب هدفًا تعليميًا جديدًا..."
                  onChange={(event) =>
                    setNewObjective(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      addObjective();
                    }
                  }}
                />

                <button
                  type="button"
                  className="instructor-course-button instructor-course-button-outline"
                  onClick={addObjective}
                >
                  <Icon name="plus" size={15} />
                  إضافة هدف
                </button>
              </div>
            </section>

            {/* Resources */}
            <section className="instructor-edit-lesson-card">
              <div className="instructor-edit-lesson-card-header">
                <div>
                  <h2>موارد إضافية وملحقات</h2>
                  <p>
                    أرفق ملفات مساعدة لتعزيز التجربة التعليمية
                    للمتعلمين.
                  </p>
                </div>

                <span className="instructor-resource-label">
                  اختياري
                </span>
              </div>

              <div className="instructor-resource-list">
                {lesson.resources.map((resource) => (
                  <div
                    className="instructor-resource-item"
                    key={resource.id}
                  >
                    <span className="instructor-resource-icon">
                      <Icon name="save" size={17} />
                    </span>

                    <div>
                      <strong>{resource.name}</strong>
                      <small>
                        {resource.size} • {resource.type}
                      </small>
                    </div>

                    <div className="instructor-resource-actions">
                      <PendingFeature  aria-label={language === "ar" ? "معاينة المورد" : "Preview resource"}>
                        <Icon name="arrow-left" size={14} />
                      </PendingFeature>

                      <PendingFeature  aria-label={language === "ar" ? "حذف المورد" : "Delete resource"}>
                        <Icon name="trash" size={14} />
                      </PendingFeature>
                    </div>
                  </div>
                ))}
              </div>

              <PendingFeature

                className="instructor-resource-add"
              >
                <Icon name="plus" size={15} />
                إضافة مورد أو ملف مرفق
              </PendingFeature>
            </section>
          </main>

          {/* Sidebar */}
          <aside className="instructor-edit-lesson-sidebar">
            {/* Readiness */}
            <section className="instructor-edit-lesson-side-card">
              <div className="instructor-side-card-title">
                <strong>جاهزية الدرس للاعتماد</strong>

                <span className="instructor-ready-badge">
                  {readiness === 100 ? "مكتمل وجاهز" : "يحتاج استكمال"}
                </span>
              </div>

              <div className="instructor-readiness-score">
                <strong>{readiness}%</strong>
                <span>نسبة اكتمال متطلبات الدرس</span>
              </div>

              <div className="instructor-readiness-progress">
                <span style={{ width: `${readiness}%` }} />
              </div>

              <div className="instructor-readiness-list">
                {readinessItems.map((item) => (
                  <div key={item.id}>
                    <span
                      className={item.done ? "done" : ""}
                    >
                      <Icon
                        name={item.done ? "check" : "clock"}
                        size={12}
                      />
                    </span>

                    <p>{item.label}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="instructor-approve-lesson"
                disabled={readiness < 100}
                onClick={() =>
                  handleSave(
                    isNewLesson
                      ? "تم حفظ الدرس وإضافته إلى المنهج."
                      : "تم اعتماد الدرس وإضافته إلى المنهج."
                  )
                }
              >
                <Icon name="check" size={15} />
                اعتماد الدرس وإضافته للمنهج
              </button>
            </section>

            {/* Academic context */}
            <section className="instructor-edit-lesson-side-card">
              <div className="instructor-side-card-heading">
                <strong>السياق الأكاديمي للدرس</strong>
                <Icon name="book" size={17} />
              </div>

              <div className="instructor-academic-context">
                <span>الدورة</span>
                <strong>{lesson.courseTitle}</strong>

                <span>القسم</span>
                <strong>{lesson.sectionTitle}</strong>

                <p>
                  {lesson.duration} دقيقة للدرس الحالي.
                </p>
              </div>

              <div className="instructor-points-info">
                <div>
                  <Icon name="star" size={15} />
                  <strong>{language === "ar" ? "نقاط إسهام" : "Esham Points"}</strong>
                </div>

                <p>
                  {language === "ar" ? `مكافأة إكمال الدورة ${pointsPolicy.courseReward} نقطة بعد اعتماد الإكمال؛ لا تُمنح تلقائيًا عند إنهاء القسم.` : `The course completion reward is ${pointsPolicy.courseReward} points after approval; completing a section does not award it automatically.`}
                </p>
              </div>
            </section>

            {/* Task */}
            <section className="instructor-edit-lesson-side-card">
              <div className="instructor-side-card-heading">
                <strong>مهمة القسم التطبيقية</strong>
                <Icon name="lesson" size={17} />
              </div>

              <p className="instructor-task-description">
                في إسهام، يختم كل قسم تعليمي بمهمة تطبيقية عملية
                ينفذها المتعلم ويقدمها للمدرب.
              </p>

              <Link to={section?.task?.id ? `/instructor/courses/${courseId}/sections/${lesson.sectionId}/tasks/${section.task.id}/edit` : `/instructor/courses/${courseId}/sections/${lesson.sectionId}/tasks/new`}

                className="instructor-task-button"
              >
                إدارة مهمة هذا القسم
                <Icon name="arrow-left" size={14} />
              </Link>
            </section>
          </aside>
        </div>

        {/* Bottom action */}
        <section className="instructor-edit-lesson-bottom-bar">
          <span>
            <i />
            {savedMessage}
          </span>

          <div>
            <button
              type="button"
              className="instructor-course-button instructor-course-button-outline"
              onClick={() => handleSave("تم حفظ الدرس كمسودة.")}
            >
              حفظ كمسودة
            </button>

            <button
              type="button"
              className="instructor-course-button instructor-course-button-primary"
              onClick={() =>
                handleSave(
                  isNewLesson
                    ? "تم حفظ الدرس وإضافته إلى المنهج."
                    : "تم حفظ التعديلات والمتابعة.",
                )
              }
            >
              {isNewLesson ? "حفظ الدرس" : "حفظ التعديلات والمتابعة"}
              <Icon name="check" size={15} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
