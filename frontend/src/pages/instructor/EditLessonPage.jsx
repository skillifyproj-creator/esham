import { pointsPolicy } from "../../data/pointsPolicy";
import { StoredVideo, StoredFileLink } from '../../components/shared/StoredMedia';
import { saveMedia, validateAttachments, formatBytes } from '../../services/mediaStore';
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { getInstructorCourseWorkspace, saveWorkspaceLesson, localized } from "../../data/instructorCourseWorkspace";
import { instructorLessonText } from "../../i18n/instructorLessonCopy";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
export default function EditLessonPage() {
  const { courseId, sectionId: routeSectionId, lessonId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = usePreferences();
  const text = value => instructorLessonText(value, language);
  const workspace = getInstructorCourseWorkspace(courseId);
  const course = workspace?.course;
  const isNewLesson = lessonId === "new";
  const canOpenVideoTools = Boolean(lessonId && routeSectionId);
  const videoBasePath = `/instructor/courses/${courseId}/sections/${routeSectionId}/lessons/${lessonId}/video`;
  const section = workspace
    ? workspace.sections.find((item) =>
        routeSectionId
          ? item.id === routeSectionId
          : item.lessons.some((currentLesson) => currentLesson.id === lessonId),
      )
    : undefined;
  const originalLesson = section?.lessons.find(
    (item) => item.id === lessonId,
  );

  const draftKey = `esham-lesson-form:${courseId}:${routeSectionId}:${lessonId}`;
  const [lesson, setLesson] = useState(() => {
    let restored; try { restored = JSON.parse(sessionStorage.getItem(draftKey)); } catch { /* Use saved lesson. */ }
    const source = location.state?.lessonDraft || restored || (isNewLesson ? null : originalLesson);
    const sourceTitle = source?.title;

    return {
      id: source?.id ?? "",
      courseId: course?.id,
      sectionId: section?.id ?? routeSectionId ?? "",
      courseTitle: localized(course?.title, language),
      sectionTitle: localized(section?.title, language),
      title:
        typeof sourceTitle === "object"
          ? sourceTitle?.[language] ?? ""
          : sourceTitle ?? "",
      description: localized(source?.description, language),
      contentType: source?.contentType ?? "video",
      duration: source?.duration ?? source?.minutes ?? 10,
      video: {
        ...source?.video,
        name: source?.video?.name ?? source?.videoUrl ?? "",
        duration: source?.video?.duration ?? "",
        size: source?.video?.size ?? "",
        quality: source?.video?.quality ?? "",
        encoding: source?.video?.encoding ?? "",
      },
      objectives: (source?.objectives ?? []).map(value => localized(value, language)),
      resources: [...(source?.resources ?? [])],
    };
  });
  useEffect(() => { try { sessionStorage.setItem(draftKey,JSON.stringify(lesson)); } catch { window.dispatchEvent(new Event('esham-storage-error')); } }, [draftKey, lesson]);
  const [uploading, setUploading] = useState(false);
  const [newObjective, setNewObjective] = useState("");
  const [savedMessage, setSavedMessage] = useState(
    isNewLesson
      ? text("مسودة جديدة غير محفوظة.")
      : text("بيانات الدرس محفوظة على هذا الجهاز."),
  );

  const readinessItems = useMemo(
    () => [
      {
        id: 1,
        label: text("عنوان الدرس واضح ومحدد"),
        done: Boolean(lesson.title.trim()),
      },
      {
        id: 2,
        label: language === "ar" ? "محتوى الدرس جاهز للمعاينة" : "Lesson content is ready to preview", done: lesson.contentType !== "video" ? lesson.description.trim().length >= 20 : Boolean(lesson.video?.mediaId || /^https?:\/\//i.test(originalLesson?.videoUrl || "")),
      },
      {
        id: 3,
        label: text("أهداف الدرس التعليمية محددة"),
        done: lesson.objectives.length > 0,
      },
      {
        id: 4,
        label: text("تم ضبط مدة الدرس"),
        done: Number(lesson.duration) >= 1 && Number(lesson.duration) <= 600,
      },
    ],
    [lesson, language]
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

    if (!value || lesson.objectives.length >= 3 || lesson.objectives.includes(value)) return;

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
    if (uploading) return;
    if (!course || !section || !lesson.title.trim()) {
      setSavedMessage(text("أدخل عنوان الدرس أولًا."));
      return;
    }

    if (!Number.isFinite(Number(lesson.duration)) || Number(lesson.duration) < 1 || Number(lesson.duration) > 600) { setSavedMessage(language === 'ar' ? 'أدخل مدة بين دقيقة و600 دقيقة.' : 'Enter a duration between 1 and 600 minutes.'); return; }
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
      description: { ...(typeof originalLesson?.description === "object" ? originalLesson.description : {}), [language]: lesson.description },
      status: readiness === 100 ? "ready" : "draft",
      minutes: Number(lesson.duration) || 1,
      contentType: lesson.contentType,
      objectives: [...lesson.objectives],
      resources: [...lesson.resources],
      video: { ...lesson.video },
      videoUrl:
        lesson.contentType === "video"
          ? (/^https?:\/\//i.test(originalLesson?.videoUrl || "") ? originalLesson.videoUrl : "")
          : "",
    };

    const saved = saveWorkspaceLesson(courseId, section.id, savedLesson);

    if (!saved) {
      setSavedMessage(text("تعذر حفظ الدرس في هذا القسم."));
      return;
    }

    setSavedMessage(message);
    try { sessionStorage.removeItem(draftKey); } catch { /* Course data has been saved. */ }
    navigate(`/instructor/courses/${courseId}/curriculum`, { state: { focusSectionId: section.id } });
  };

  if (!course || !section || (!isNewLesson && !originalLesson)) {
    return (
      <div className="instructor-edit-lesson-page instructor-detail-page">
        <div className="container">
          <section className="instructor-edit-lesson-side-card">
            <h1>{text("لم يتم العثور على الدرس")}</h1>
            <Link
              className="instructor-course-button instructor-course-button-outline"
              to={`/instructor/courses/${courseId}/curriculum`}
            >{text("العودة إلى المنهج")}</Link>
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
          <Link to="/instructor/courses">{text("الدورات التدريبية")}</Link>
          <span>/</span>

          <Link to={`/instructor/courses/${courseId}/curriculum`}>
            {lesson.courseTitle}
          </Link>

          <span>/</span>
          <span>{lesson.sectionTitle}</span>

          <span>/</span>
          <strong>{isNewLesson ? text("إنشاء درس جديد") : text("تحرير الدرس")}</strong>
        </div>

        {/* Header */}
        <section className="instructor-edit-lesson-header">
          <div>
            <div className="instructor-edit-lesson-title-row">
              <h1>{isNewLesson ? text("إنشاء درس جديد") : text("تحرير الدرس")}</h1>
              <span className="instructor-lesson-status draft">
                {isNewLesson ? text("مسودة جديدة") : text("مسودة")}
              </span>
            </div>

            <p>{text("أضف محتوى الدرس وتأكد من جاهزيته ومطابقته للمعايير التعليمية قبل الاعتماد.")}</p>
          </div>

          <div className="instructor-edit-lesson-header-actions">
            <Link
              to={`/instructor/courses/${courseId}/curriculum`}
              className="instructor-course-button instructor-course-button-outline"
            >
              <Icon name="arrow-left" size={15} />{text("العودة إلى المنهج")}</Link>

            <Link
                to={`/instructor/courses/${courseId}/sections/${section?.id}/lessons/${lessonId}/video`}
                state={{ lessonDraft: lesson }}
                className="instructor-course-button instructor-course-button-outline"
            >
              <Icon name="video" size={15} />
              {language === "ar" ? text("إضافة فيديو") : "Add video"}
            </Link>

            <button
              type="button"
              className="instructor-course-button instructor-course-button-outline"
              onClick={() => handleSave(text("تم حفظ الدرس كمسودة."))}
            >
              <Icon name="save" size={15} />{text("حفظ كمسودة")}</button>

            <button
              type="button"
              className="instructor-course-button instructor-course-button-primary"
              onClick={() => handleSave(text("تم حفظ التعديلات بنجاح."))}
            >
              <Icon name="check" size={15} />
              {isNewLesson ? text("حفظ الدرس") : text("حفظ التعديلات")}
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
                  <h2>{text("معلومات الدرس الأساسية")}</h2>
                  <p>{text("البيانات الأساسية التي ستظهر للمتعلمين.")}</p>
                </div>
                <Icon name="lesson" size={20} />
              </div>

              <div className="instructor-edit-lesson-form">
                <label className="instructor-edit-lesson-field">
                  <span>{text("عنوان الدرس")}<b>*</b>
                  </span>

                  <input
                    type="text"
                    value={lesson.title}
                    onChange={(event) =>
                      updateLesson("title", event.target.value)
                    }
                  />

                  <small>{text("سيظهر هذا العنوان في قائمة دروس الكورس.")}</small>
                </label>

                <label className="instructor-edit-lesson-field">
                  <span>{text("وصف الدرس ومخرجاته")}<b>*</b>
                  </span>

                  <textarea
                    rows="4"
                    value={lesson.description}
                    onChange={(event) =>
                      updateLesson("description", event.target.value)
                    }
                  />

                  <small>
                    {lesson.description.length}{text("/ 300 حرف")}</small>
                </label>

                <div className="instructor-edit-lesson-form-row">
                  <div className="instructor-edit-lesson-field">
                    <span>{text("نوع محتوى الدرس")}</span>

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

                        <span className="instructor-lesson-type-copy"><strong>{language === "ar" ? text("فيديو تدريبي") : "Training video"}</strong><small>{language === "ar" ? text("شرح مرئي ومحتوى فيديو للدرس.") : "A video lesson with visual explanations."}</small></span>
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

                        <span className="instructor-lesson-type-copy"><strong>{language === "ar" ? text("قراءة ومقال") : "Reading and article"}</strong><small>{language === "ar" ? text("محتوى نصي ومواد للقراءة.") : "Text content and reading materials."}</small></span>
                      </label>
                    </div>
                  </div>

                  <label className="instructor-edit-lesson-field">
                    <span>{text("مدة الدرس التقديرية")}</span>

                    <div className="instructor-lesson-duration-input">
                      <input
                        type="number"
                        min="1" max="600"
                        value={lesson.duration}
                        onChange={(event) =>
                          updateLesson(
                            "duration",
                            event.target.value
                          )
                        }
                      />
                      <span>{text("دقيقة")}</span>
                    </div>

                    <small>{text("حدد مدة تقريبية لمحتوى الدرس.")}</small>
                  </label>
                </div>
              </div>
            </section>

            {/* Video */}
            {lesson.contentType === "video" && lesson.video?.name && <section className="instructor-edit-lesson-card">
              <div className="instructor-edit-lesson-card-header">
                <div>
                  <h2>{text("فيديو الدرس")}</h2>
                  <p>{text("الفيديو المرتبط بهذا الدرس.")}</p>
                </div>

                <span className="instructor-ready-badge">
                  <span />{text("جاهز للمعاينة")}</span>
              </div>

              <div className="instructor-lesson-video-box">
                <StoredVideo mediaId={lesson.video.mediaId} url={originalLesson?.videoUrl} style={{width:'100%', maxHeight:360}}/>

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

                  <span className="instructor-video-quality">{text("معدل الترميز:")}{lesson.video.encoding}
                  </span>
                </div>

                <div className="instructor-lesson-video-actions">
                  {canOpenVideoTools ? (
                    <>
                      <Link to={`${videoBasePath}/preview`} state={{ lessonDraft: lesson }} className="instructor-course-button instructor-course-button-outline">
                        <Icon name="video" size={15} />
                        {language === "ar" ? text("معاينة الفيديو") : "Preview video"}
                      </Link>
                      <Link to={`${videoBasePath}/edit`} state={{ lessonDraft: lesson }} className="instructor-course-button instructor-course-button-outline">
                        <Icon name="edit" size={15} />
                        {language === "ar" ? text("تحرير الفيديو") : "Edit video"}
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to={videoBasePath} state={{lessonDraft: lesson}} className="instructor-course-button instructor-course-button-outline">{language === 'ar' ? 'إضافة فيديو' : 'Add video'}</Link>
                    </>
                  )}
                </div>
              </div>

              <div className="instructor-edit-lesson-note">
                <Icon name="info" size={15} />
                <span>{text("يمكنك استبدال الفيديو أو معاينته مباشرة قبل اعتماد الدرس في المنهج الدراسي.")}</span>
              </div>
            </section>}

            {/* Objectives */}
            <section className="instructor-edit-lesson-card">
              <div className="instructor-edit-lesson-card-header">
                <div>
                  <h2>{text("أهداف الدرس التعليمية")}</h2>
                  <p>{text("حدد ما سيتمكن المتعلم من فهمه واكتسابه بنهاية هذا الدرس.")}</p>
                </div>

                <span className="instructor-section-counter">
                  {lesson.objectives.length}{text("من 3")}</span>
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
                      aria-label={text("حذف الهدف")}
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
                  placeholder={text("اكتب هدفًا تعليميًا جديدًا...")}
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
                  <Icon name="plus" size={15} />{text("إضافة هدف")}</button>
              </div>
            </section>

            {/* Resources */}
            <section className="instructor-edit-lesson-card">
              <div className="instructor-edit-lesson-card-header">
                <div>
                  <h2>{text("موارد إضافية وملحقات")}</h2>
                  <p>{text("أرفق ملفات مساعدة لتعزيز التجربة التعليمية للمتعلمين.")}</p>
                </div>

                <span className="instructor-resource-label">{text("اختياري")}</span>
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
                      <StoredFileLink file={resource}>{language === 'ar' ? 'تنزيل الملف' : 'Download file'}</StoredFileLink>

                      <button type="button" onClick={() => updateLesson("resources", lesson.resources.filter(item => item.id !== resource.id))} aria-label={language === "ar" ? text("حذف المورد") : "Delete resource"}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <label className="instructor-resource-add">{text("إضافة مورد أو ملف مرفق")}<input type="file" multiple disabled={uploading} accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx" onChange={async event => { const files = Array.from(event.target.files || []); event.target.value = ''; if(uploading) return; setUploading(true); try { validateAttachments(files, lesson.resources.length); const stored = await Promise.all(files.map(file => saveMedia(file, { name: file.name }))); updateLesson('resources', [...lesson.resources, ...stored.map(file => ({ id: file.id, mediaId: file.id, name: file.name, size: formatBytes(file.sizeBytes), type: file.name.split('.').pop().toUpperCase() }))]); } catch { setSavedMessage(language === 'ar' ? 'تعذّر حفظ الملفات. الحد الأقصى 5 ملفات و10MB لكل ملف؛ تحقق من تخزين المتصفح.' : 'Unable to save files. Up to 5 files, 10MB each; check browser storage.'); } finally { setUploading(false); } }} /></label><small>{language === 'ar' ? 'تُحفظ الملفات على هذا الجهاز وتبقى بعد تحديث الصفحة.' : 'Files are saved on this device and remain available after reload.'}</small>
            </section>
          </main>

          {/* Sidebar */}
          <aside className="instructor-edit-lesson-sidebar">
            {/* Readiness */}
            <section className="instructor-edit-lesson-side-card">
              <div className="instructor-side-card-title">
                <strong>{text("جاهزية الدرس للاعتماد")}</strong>

                <span className="instructor-ready-badge">
                  {readiness === 100 ? text("مكتمل وجاهز") : text("يحتاج استكمال")}
                </span>
              </div>

              <div className="instructor-readiness-score">
                <strong>{readiness}%</strong>
                <span>{text("نسبة اكتمال متطلبات الدرس")}</span>
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
                      ? text("تم حفظ الدرس وإضافته إلى المنهج.")
                      : text("تم اعتماد الدرس وإضافته إلى المنهج.")
                  )
                }
              >
                <Icon name="check" size={15} />{text("اعتماد الدرس وإضافته للمنهج")}</button>
            </section>

            {/* Academic context */}
            <section className="instructor-edit-lesson-side-card">
              <div className="instructor-side-card-heading">
                <strong>{text("السياق الأكاديمي للدرس")}</strong>
                <Icon name="book" size={17} />
              </div>

              <div className="instructor-academic-context">
                <span>{text("الدورة")}</span>
                <strong>{lesson.courseTitle}</strong>

                <span>{text("القسم")}</span>
                <strong>{lesson.sectionTitle}</strong>

                <p>
                  {lesson.duration}{text("دقيقة للدرس الحالي.")}</p>
              </div>

              <div className="instructor-points-info">
                <div>
                  <Icon name="star" size={15} />
                  <strong>{language === "ar" ? text("نقاط إسهام") : "Esham Points"}</strong>
                </div>

                <p>
                  {language === "ar" ? `تكلفة التسجيل ${pointsPolicy.enrollmentCost} نقطة. تكسب ${pointsPolicy.instructorEnrollmentReward} نقطة عن كل متعلّم يسجّل في الدورة.` : `Enrollment costs ${pointsPolicy.enrollmentCost} points. You earn ${pointsPolicy.instructorEnrollmentReward} points for each learner who enrolls.`}
                </p>
              </div>
            </section>

            {/* Task */}
            <section className="instructor-edit-lesson-side-card">
              <div className="instructor-side-card-heading">
                <strong>{text("مهمة القسم التطبيقية")}</strong>
                <Icon name="lesson" size={17} />
              </div>

              <p className="instructor-task-description">{text("تتضمن الدورة من مهمة إلى ثلاث مهام تطبيقية يراجعها المدرّب؛ لا يلزم إضافة مهمة لكل قسم.")}</p>

              <Link to={section?.task?.id ? `/instructor/courses/${courseId}/sections/${lesson.sectionId}/tasks/${section.task.id}/edit` : `/instructor/courses/${courseId}/sections/${lesson.sectionId}/tasks/new`}

                className="instructor-task-button"
              >{text("إدارة مهمة هذا القسم")}<Icon name="arrow-left" size={14} />
              </Link>
            </section>
          </aside>
        </div>

        {/* Bottom action */}
        <section className="instructor-edit-lesson-bottom-bar">
          <span>
            <i />
            {text(savedMessage)}
          </span>

          <div>
            <button
              type="button"
              className="instructor-course-button instructor-course-button-outline"
              onClick={() => handleSave(text("تم حفظ الدرس كمسودة."))}
            >{text("حفظ كمسودة")}</button>

            <button
              type="button"
              className="instructor-course-button instructor-course-button-primary"
              onClick={() =>
                handleSave(
                  isNewLesson
                    ? text("تم حفظ الدرس وإضافته إلى المنهج.")
                    : text("تم حفظ التعديلات والمتابعة."),
                )
              }
            >
              {isNewLesson ? text("حفظ الدرس") : text("حفظ التعديلات والمتابعة")}
              <Icon name="check" size={15} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
