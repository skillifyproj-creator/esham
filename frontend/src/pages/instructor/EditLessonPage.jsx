import { pointsPolicy } from "../../data/pointsPolicy";
import { useEffect, useMemo, useState } from "react";
import useLessonReadiness from '../../hooks/useLessonReadiness';
import { Link, useNavigate, useParams } from "react-router";
import { localized } from "../../data/instructorCourseWorkspace";
import { courseRequest, curriculumPath, mapCourse, mapSection } from '../../services/curriculumApi';
import { loadLessonMedia, detachLessonMedia, mediaContentUrl, videoDraftKey } from '../../services/lessonMediaApi';
import { instructorLessonText } from "../../i18n/instructorLessonCopy";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
import "../../styles/curriculum-editor.css";
export default function EditLessonPage() {
  const { courseId, sectionId, lessonId } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setWorkspace(null); setError('');
    Promise.all([courseRequest(`/courses/${courseId}`, undefined, 'GET', controller.signal),
      courseRequest(curriculumPath(courseId), undefined, 'GET', controller.signal),
      lessonId === 'new' ? Promise.resolve([]) : loadLessonMedia(courseId, sectionId, lessonId, controller.signal)])
      .then(([detail, sections, attachments]) => setWorkspace({ course: mapCourse(detail), ownerId: detail.owner.id, attachments, sections: sections.map(mapSection) }))
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [courseId, sectionId, lessonId]);
  if (!workspace) return <div className="container instructor-detail-page"><p role={error ? 'alert' : 'status'}>{error || 'Loading lesson…'}</p><Link to={`/instructor/courses/${courseId}/curriculum`}>Back to curriculum</Link></div>;
  return <LessonEditor key={`${courseId}:${sectionId}:${lessonId}`} workspace={workspace} />;
}
function LessonEditor({ workspace }) {
  const { courseId, sectionId: routeSectionId, lessonId } = useParams();
  const navigate = useNavigate();
  const { language } = usePreferences();
  const text = value => instructorLessonText(value, language);
  const course = workspace?.course;
  const isNewLesson = lessonId === "new";
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

  const [lesson, setLesson] = useState(() => {
    const source = isNewLesson ? null : originalLesson;
    const sourceTitle = source?.title;

    return {
      id: source?.id ?? "",
      courseId: course?.id,
      sectionId: section?.id ?? routeSectionId ?? "",
      courseTitle: localized(course?.title, language),
      sectionTitle: localized(section?.title, language),
      title: { ar: sourceTitle?.ar || '', en: sourceTitle?.en || '' },
      description: { ar: source?.description?.ar || '', en: source?.description?.en || '' },
      contentType: source?.contentType ?? "",
      duration: source?.duration ?? source?.minutes ?? 10,
      video: {
        ...source?.video,
        name: source?.video?.name ?? source?.videoUrl ?? "",
        duration: source?.video?.duration ?? "",
        size: source?.video?.size ?? "",
        quality: source?.video?.quality ?? "",
        encoding: source?.video?.encoding ?? "",
      },
      objectives: (source?.objectives ?? []).map(value => ({ ...value })),
      resources: [...(source?.resources ?? [])],
    };
  });
  const [videoAssetId, setVideoAssetId] = useState(originalLesson?.primaryVideoMediaAssetId || '');
  const [attachments, setAttachments] = useState(workspace.attachments || []);
  const [saving, setSaving] = useState(false);
  const { readiness: serverReadiness, error: readinessError } = useLessonReadiness(courseId, routeSectionId, lessonId, {
    titleAr: lesson.title.ar, titleEn: lesson.title.en, descriptionAr: lesson.description.ar, descriptionEn: lesson.description.en,
    contentType: lesson.contentType, durationSeconds: Number(lesson.duration) * 60,
    sortOrder: originalLesson?.sortOrder ?? 0, objectives: lesson.objectives, primaryVideoMediaAssetId: videoAssetId || null,
  }, originalLesson?.readiness);
  const [newObjective, setNewObjective] = useState("");
  const [savedMessage, setSavedMessage] = useState(
    isNewLesson
      ? text("مسودة جديدة غير محفوظة.")
      : (language === 'ar' ? 'تم تحميل الدرس المحفوظ.' : 'Saved lesson loaded.'),
  );

  const readinessItems = useMemo(
    () => [
      {
        id: 1,
        label: text("عنوان الدرس واضح ومحدد"),
        done: serverReadiness?.titleComplete ?? false,
      },
      {
        id: 2,
        label: language === "ar" ? "محتوى الدرس جاهز للمعاينة" : "Lesson content is ready to preview", done: serverReadiness?.contentReady ?? false,
      },
      {
        id: 3,
        label: text("أهداف الدرس التعليمية محددة"),
        done: serverReadiness?.objectivesComplete ?? false,
      },
      {
        id: 4,
        label: text("تم ضبط مدة الدرس"),
        done: serverReadiness?.durationSet ?? false,
      },
    ],
    [serverReadiness, language]
  );

  const readiness = serverReadiness?.percentage ?? 0;

  const updateLesson = (field, value) => {
    if (field === 'contentType' && lesson.contentType && value !== lesson.contentType && (videoAssetId || lesson.description.ar || lesson.description.en)) {
      if (!window.confirm(language === 'ar' ? 'تغيير نوع المحتوى؟ سيبقى النص وارتباط الفيديو محفوظين دون حذف.' : 'Change content type? Text and the video association will be retained without deletion.')) return;
    }
    setLesson((current) => ({
      ...current,
      [field]: field === 'title' || field === 'description' ? { ...current[field], [language]: value } : value,
    }));
  };

  const addObjective = () => {
    const value = newObjective.trim();

    if (!value || lesson.objectives.length >= 50 || lesson.objectives.some(x => x[language] === value)) return;

    setLesson((current) => ({
      ...current,
      objectives: [...current.objectives, { [language]: value }],
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

  const handleSave = async (message, openVideo = false) => {
    if (saving) return;
    if (!course || !section || (!lesson.title.ar.trim() && !lesson.title.en.trim())) {
      setSavedMessage(text("أدخل عنوان الدرس أولًا."));
      return;
    }

    if (!Number.isFinite(Number(lesson.duration)) || Number(lesson.duration) < 1 || Number(lesson.duration) > 600) { setSavedMessage(language === 'ar' ? 'أدخل مدة بين دقيقة و600 دقيقة.' : 'Enter a duration between 1 and 600 minutes.'); return; }
    if (!['video', 'article'].includes(lesson.contentType)) { setSavedMessage(language === 'ar' ? 'اختر نوع محتوى الدرس.' : 'Choose a lesson content type.'); return; }
    const nextId = isNewLesson ? null : originalLesson.id;
    const title =
      originalLesson?.title && typeof originalLesson.title === "object"
        ? { ...originalLesson.title }
        : { ar: "", en: "" };
    Object.assign(title, { ar: lesson.title.ar.trim(), en: lesson.title.en.trim() });

    const savedLesson = {
      ...originalLesson,
      id: nextId,
      courseId: course.id,
      sectionId: section.id,
      title,
      description: lesson.description,
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

    setSaving(true);
    try {
      const persisted = await courseRequest(`${curriculumPath(courseId)}/${section.id}/lessons${isNewLesson ? '' : `/${originalLesson.id}`}`, {
        titleAr: title.ar, titleEn: title.en,
        descriptionAr: savedLesson.description.ar, descriptionEn: savedLesson.description.en,
        sortOrder: originalLesson?.sortOrder ?? section.lessons.reduce((max, x) => Math.max(max, x.sortOrder + 1), 0),
        contentType: lesson.contentType, durationSeconds: Number(lesson.duration) * 60,
        isPreview: originalLesson?.isPreview || false,
        primaryVideoMediaAssetId: videoAssetId || null,
        objectives: lesson.objectives,
      }, isNewLesson ? 'POST' : 'PUT');
      if (openVideo) navigate(`/instructor/courses/${courseId}/sections/${section.id}/lessons/${persisted.id}/video`, {
        state: { returnTo: `/instructor/courses/${courseId}/sections/${section.id}/lessons/${persisted.id}/edit`,
          replaceVideo: attachments.length > 0, replaceAttachmentId: attachments.find(x => x.mediaAssetId === videoAssetId)?.attachmentId },
      });
      else navigate(`/instructor/courses/${courseId}/curriculum`, { state: { focusSectionId: section.id } });
    } catch (error) { setSavedMessage(error.message); }
    finally { setSaving(false); }
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
      <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: "0 auto", minWidth: 0 }} className="container" >
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
                    maxLength={200}
                    value={lesson.title[language]}
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
                    maxLength={10000}
                    value={lesson.description[language]}
                    onChange={(event) =>
                      updateLesson("description", event.target.value)
                    }
                  />

                  <small>
                    {lesson.description[language].length} / 10000</small>
                </label>

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
            </section>
            {/* Objectives */}
            <section className="instructor-edit-lesson-card">
              <div className="instructor-edit-lesson-card-header">
                <div>
                  <h2>{text("أهداف الدرس التعليمية")}</h2>
                  <p>{text("حدد ما سيتمكن المتعلم من فهمه واكتسابه بنهاية هذا الدرس.")}</p>
                </div>

                <span className="instructor-section-counter">
                  {lesson.objectives.length} / 50</span>
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

                    <span>{localized(objective, language)}</span>

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

<section className="instructor-edit-lesson-card lesson-content-selector"><h2>{language === "ar" ? "نوع محتوى الدرس" : "Lesson content type"}</h2>                <div className="instructor-edit-lesson-form-row">
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
                </div>
</section>
            {lesson.contentType === 'video' && <section className="instructor-edit-lesson-card lesson-video-editor">
              <h2>{language === 'ar' ? 'فيديو الدرس' : 'Lesson video'}</h2>
              {!attachments.length && <button type="button" className="instructor-course-button instructor-course-button-outline" onClick={() => handleSave('', true)}>{language === 'ar' ? 'إضافة فيديو' : 'Add Video'}</button>}
              {attachments.find(item => item.mediaAssetId === videoAssetId) && <>
                <video controls playsInline crossOrigin="use-credentials" style={{ width: '100%', maxHeight: 360 }} src={mediaContentUrl(attachments.find(item => item.mediaAssetId === videoAssetId))} />
                <button type="button" className="instructor-course-button instructor-course-button-outline" onClick={() => handleSave('', true)}>{language === 'ar' ? 'استبدال الفيديو' : 'Replace Video'}</button>
              </>}
              {attachments.map(item => <div key={item.attachmentId} className="instructor-resource-item">
                <span>{item.fileName} {item.mediaAssetId === videoAssetId ? (language === 'ar' ? '— الفيديو الأساسي' : '— Primary video') : ''}</span>
                <button type="button" onClick={async () => {
                  if (!window.confirm(language === 'ar' ? 'إزالة هذا الارتباط؟ سيبقى الملف الأصلي محفوظًا.' : 'Detach this video? The original file will be retained.')) return;
                  setSaving(true);
                  try {
                    await detachLessonMedia(courseId, section.id, lessonId, item.attachmentId);
                    setAttachments(current => current.filter(value => value.attachmentId !== item.attachmentId));
                    if (videoAssetId === item.mediaAssetId) setVideoAssetId('');
                    localStorage.removeItem(videoDraftKey(workspace.ownerId, courseId, section.id, lessonId));
                  } catch (error) { setSavedMessage(error.message); }
                  finally { setSaving(false); }
                }}>{language === 'ar' ? 'إزالة الفيديو' : 'Remove Video'}</button>
              </div>)}
              <p>{language === 'ar' ? 'يُحفظ الفيديو كمسودة. فحص الأمان والاعتماد منفصلان عن الحفظ.' : 'Video is saved as a draft. Safety screening and approval are separate from saving.'}</p>
            </section>}
            {lesson.contentType === 'article' && <section className="instructor-edit-lesson-card lesson-article-editor">
              <h2>{language === 'ar' ? 'محتوى المقال / النص' : 'Article / text content'}</h2>
              <p>{language === 'ar' ? 'يستخدم المقال حقل الوصف نفسه في النموذج الحالي؛ تعديل أحدهما يحدّث الآخر.' : 'The current model shares this text with the lesson description; editing either updates both.'}</p>
              <label className="instructor-edit-lesson-field"><span>{language === 'ar' ? 'نص المقال' : 'Article text'}</span>
                <textarea rows={10} maxLength={10000} value={lesson.description[language]} onChange={event => updateLesson('description', event.target.value)} />
              </label>
            </section>}

            <section className="instructor-edit-lesson-note"><p>{language === 'ar' ? 'رفع المرفقات غير متاح بعد.' : 'Attachment uploads are not available yet.'}</p></section>
          </main>

          {/* Sidebar */}
          <aside className="instructor-edit-lesson-sidebar">
            {/* Readiness */}
            <section className="instructor-edit-lesson-side-card">
              {readinessError && <p role="alert">{readinessError}</p>}
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
                <Icon name="check" size={15} />{language === 'ar' ? 'حفظ الدرس في المنهج' : 'Save lesson to curriculum'}</button>
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
                <strong>{language === 'ar' ? 'مهام الدورة التطبيقية' : 'Course practical tasks'}</strong>
                <Icon name="lesson" size={17} />
              </div>

              <p className="instructor-task-description">{text("تتضمن الدورة من مهمة إلى ثلاث مهام تطبيقية يراجعها المدرّب؛ لا يلزم إضافة مهمة لكل قسم.")}</p>

              <Link to={`/instructor/courses/${courseId}/tasks/new`}

                className="instructor-task-button"
              >{language === 'ar' ? 'إضافة مهمة للدورة' : 'Add course task'}<Icon name="arrow-left" size={14} />
              </Link>
            </section>
          </aside>
        </div>

        {/* Bottom action */}
        <section className="instructor-edit-lesson-bottom-bar">
          <span role="status" aria-live="polite">
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
      </fieldset>
    </div>
  );
}
