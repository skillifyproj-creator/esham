import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
import instructorCopy from "../../i18n/instructorCopy";
import { instructorCurriculumDemo } from "../../data/instructorCurriculumDemo";

import "../../styles/instructor.css";

const defaultTask = {
  title: "التقط صورتك الأولى",
  description:
    "استخدم ما تعلمته في هذا القسم لالتقاط صورة واضحة ومطبقة لأهم مبادئ التصوير الفوتوغرافي.",
  instructions:
    "1. اختر موضوعًا مناسبًا للتصوير.\n2. اضبط الإضاءة والتكوين بشكل واضح.\n3. التقط الصورة وراجع النتيجة.\n4. ارفع الصورة النهائية من هذه الصفحة.",
  submissionType: "image",
  requirements: [
    "تسليم صورة فوتوغرافية واحدة أصلية من تصويرك الخاص.",
    "تطبيق إحدى قواعد التكوين المشروحة في القسم.",
    "إبراز توزيع مناسب للإضاءة والظلال مع الحفاظ على وضوح الصورة.",
  ],
  resources: [
    {
      id: "resource-1",
      name: "دليل_تطبيق_قواعد_التكوين.pdf",
      size: "1.8 ميغابايت",
    },
  ],
};

export default function InstructorTaskPage() {
  const { language } = usePreferences();
  const c = instructorCopy[language];
  const navigate = useNavigate();

  const { courseId, sectionId, taskId } = useParams();

  const isEditMode = Boolean(taskId);

  const { course, sections } = instructorCurriculumDemo;

  const section = sections.find(
    (item) => item.id === sectionId
  );

  const existingTask = section?.task;

  const [task, setTask] = useState(() => {
    if (isEditMode && existingTask) {
      return {
        ...defaultTask,
        title:
          existingTask.title?.[language] ||
          defaultTask.title,
        description:
          existingTask.description?.[language] ||
          defaultTask.description,
      };
    }

    return defaultTask;
  });

  const [newRequirement, setNewRequirement] = useState("");
  const [saved, setSaved] = useState(true);

  const sectionTitle =
    section?.title?.[language] ||
    (language === "en"
      ? "Course Section"
      : "قسم الدورة");

  const courseTitle =
    course?.title?.[language] ||
    (language === "en"
      ? "Course"
      : "الدورة");

  const readinessItems = useMemo(
    () => [
      {
        id: 1,
        label:
          language === "en"
            ? "Task title is clear"
            : "عنوان المهمة واضح ومحدد",
        done: task.title.trim().length > 0,
      },
      {
        id: 2,
        label:
          language === "en"
            ? "Task description is complete"
            : "وصف المهمة مكتمل",
        done: task.description.trim().length > 20,
      },
      {
        id: 3,
        label:
          language === "en"
            ? "Instructions are available"
            : "تعليمات التنفيذ موجودة",
        done: task.instructions.trim().length > 20,
      },
      {
        id: 4,
        label:
          language === "en"
            ? "At least one requirement exists"
            : "تمت إضافة معيار تقييم واحد على الأقل",
        done: task.requirements.length > 0,
      },
    ],
    [task, language]
  );

  const completedItems = readinessItems.filter(
    (item) => item.done
  ).length;

  const readiness =
    readinessItems.length > 0
      ? Math.round(
          (completedItems / readinessItems.length) * 100
        )
      : 0;

  const updateTask = (field, value) => {
    setTask((current) => ({
      ...current,
      [field]: value,
    }));

    setSaved(false);
  };

  const addRequirement = () => {
    const value = newRequirement.trim();

    if (!value) return;

    setTask((current) => ({
      ...current,
      requirements: [
        ...current.requirements,
        value,
      ],
    }));

    setNewRequirement("");
    setSaved(false);
  };

  const removeRequirement = (index) => {
    setTask((current) => ({
      ...current,
      requirements: current.requirements.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));

    setSaved(false);
  };

  const saveTask = () => {
    setSaved(true);

    // الحفظ الفعلي للمهمة يُضاف عند الربط بالباك.
    navigate("/instructor/courses/new/curriculum");
  };

  const saveDraft = () => {
    setSaved(true);
  };

  const goBack = () => {
    navigate("/instructor/courses/new/curriculum");
  };

  return (
    <section
      className="instructor-task-page instructor-detail-page"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      <div className="container">

        {/* Header */}
        <header className="instructor-task-header">
          <div>
            <div className="instructor-task-breadcrumb">
              <Link to="/instructor/courses">
                {language === "en"
                  ? "Courses"
                  : "الدورات التدريبية"}
              </Link>

              <span>/</span>

              <Link
                to={`/instructor/courses/${courseId}`}
              >
                {courseTitle}
              </Link>

              <span>/</span>

              <span>{sectionTitle}</span>

              <span>/</span>

              <strong>
                {isEditMode
                  ? language === "en"
                    ? "Edit Task"
                    : "تعديل المهمة"
                  : language === "en"
                    ? "New Task"
                    : "إنشاء مهمة"}
              </strong>
            </div>

            <div className="instructor-task-title-row">
              <h1>
                {isEditMode
                  ? "تعديل المهمة التطبيقية"
                  : "إنشاء مهمة تطبيقية للقسم"}

              </h1>

              <span className="instructor-task-draft-badge">
                <span />
                {isEditMode
                  ? "مسودة"
                  : "مهمة جديدة"}
              </span>
            </div>

            <p>
              {isEditMode
                ? "عدّل تفاصيل المهمة ومعايير التقييم وتأكد من جاهزيتها للمتعلمين."
                : "أنشئ مهمة تطبيقية واحدة لهذا القسم تساعد المتعلمين على تطبيق المهارات المكتسبة عمليًا."}
            </p>
          </div>

          <div className="instructor-task-header-actions">
            <button
              type="button"
              className="instructor-button instructor-button-outline"
              onClick={goBack}
            >
              <Icon name="arrow-left" size={15} />
              العودة إلى المنهج
            </button>

            <button
              type="button"
              className="instructor-button instructor-button-outline"
            >
              <Icon name="eye" size={15} />
              معاينة الطالب
            </button>

            <button
              type="button"
              className="instructor-button"
              onClick={saveDraft}
            >
              <Icon name="save" size={15} />
              حفظ كمسودة
            </button>
          </div>
        </header>

        <div className="instructor-task-layout">

          {/* Main */}
          <main className="instructor-task-main">

            {/* Section context */}
            <section className="instructor-task-context-card">
              <div>
                <span>
                  {language === "en"
                    ? "Course section"
                    : "مرتبطة بالقسم التدريبي"}
                </span>

                <strong>
                  {courseTitle}
                </strong>

                <b>
                  {language === "en"
                    ? `Section: ${sectionTitle}`
                    : `القسم: ${sectionTitle}`}
                </b>
              </div>

              <span className="instructor-task-section-badge">
                <Icon name="lesson" size={14} />
                {language === "en"
                  ? "4 practical lessons"
                  : "4 دروس عملية"}
              </span>
            </section>

            {/* 1 */}
            <section className="instructor-task-card">

              <div className="instructor-task-card-heading">
                <div>
                  <span className="instructor-task-step">
                    1.
                  </span>

                  <h2>
                    البيانات الأساسية للمهمة
                  </h2>
                </div>

                <Icon name="edit" size={18} />
              </div>

              <div className="instructor-task-fields">

                <label>
                  <span>
                    عنوان المهمة <b>*</b>
                  </span>

                  <input
                    value={task.title}
                    onChange={(event) =>
                      updateTask(
                        "title",
                        event.target.value
                      )
                    }
                    placeholder="مثال: التقط صورتك الأولى"
                    maxLength={60}
                  />

                  <small>
                    {task.title.length} / 60
                  </small>
                </label>

                <label>
                  <span>
                    ملخص المهمة والهدف التدريبي <b>*</b>
                  </span>

                  <textarea
                    rows={4}
                    value={task.description}
                    onChange={(event) =>
                      updateTask(
                        "description",
                        event.target.value
                      )
                    }
                    maxLength={200}
                  />

                  <small>
                    {task.description.length} / 200
                  </small>
                </label>

              </div>
            </section>

            {/* 2 */}
            <section className="instructor-task-card">

              <div className="instructor-task-card-heading">
                <div>
                  <span className="instructor-task-step">
                    2.
                  </span>

                  <h2>
                    تعليمات التنفيذ خطوة بخطوة
                  </h2>
                </div>

                <Icon name="lesson" size={18} />
              </div>

              <p className="instructor-task-help">
                ضع تعليمات متسلسلة لتمكين الطالب من التحضير
                والتنفيذ والتسليم بكل وضوح.
              </p>

              <div className="instructor-task-editor-toolbar">
                <button type="button">
                  <b>B</b>
                </button>

                <button type="button">
                  <i>I</i>
                </button>

                <button type="button">
                  <Icon name="lesson" size={14} />
                </button>

                <button type="button">
                  <Icon name="arrow-left" size={14} />
                </button>
              </div>

              <textarea
                className="instructor-task-instructions"
                value={task.instructions}
                onChange={(event) =>
                  updateTask(
                    "instructions",
                    event.target.value
                  )
                }
              />
            </section>

            {/* 3 */}
            <section className="instructor-task-card">

              <div className="instructor-task-card-heading">
                <div>
                  <span className="instructor-task-step">
                    3.
                  </span>

                  <h2>
                    ماذا سيسلم المتعلم؟ (نوع التسليم)
                  </h2>
                </div>

                <Icon name="save" size={18} />
              </div>

              <p className="instructor-task-help">
                حدد صيغة التسليم الوحيدة المتوافقة مع طبيعة
                هذه المهمة التطبيقيّة.
              </p>

              <div className="instructor-submission-options">

                <button
                  type="button"
                  className={
                    task.submissionType === "file"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    updateTask(
                      "submissionType",
                      "file"
                    )
                  }
                >
                  <Icon name="save" size={20} />

                  <strong>
                    ملف مستند
                  </strong>

                  <span>
                    ملفات PDF، جداول، أو مستندات
                    توضيحية.
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    task.submissionType === "text"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    updateTask(
                      "submissionType",
                      "text"
                    )
                  }
                >
                  <Icon name="lesson" size={20} />

                  <strong>
                    نص كتابي
                  </strong>

                  <span>
                    إجابة مكتوبة أو تقرير قصير
                    أو تدوينة تأملية.
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    task.submissionType === "image"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    updateTask(
                      "submissionType",
                      "image"
                    )
                  }
                >
                  <Icon name="camera" size={20} />

                  <strong>
                    صورة فوتوغرافية
                  </strong>

                  <span>
                    صورة أصلية من التقاط الطالب
                    وإبداعه.
                  </span>
                </button>

              </div>

              <div className="instructor-task-format-note">
                <Icon name="check" size={14} />

                <span>
                  الصيغ المعتمدة تلقائيًا: JPG, PNG, HEIC
                  • حد أقصى 25 ميغابايت للصورة الواحدة.
                </span>

                <button type="button">
                  تعديل الإعدادات
                </button>
              </div>
            </section>

            {/* 4 */}
            <section className="instructor-task-card">

              <div className="instructor-task-card-heading">
                <div>
                  <span className="instructor-task-step">
                    4.
                  </span>

                  <h2>
                    معايير ومتطلبات المهمة
                  </h2>
                </div>

                <span className="instructor-task-counter">
                  {task.requirements.length} متطلبات
                </span>
              </div>

              <p className="instructor-task-help">
                نظم هذه البنود لتشكل قائمة مراجعة يتأكد من
                استيفائها قبل الضغط على زر التسليم.
              </p>

              <div className="instructor-task-requirements">

                {task.requirements.map(
                  (requirement, index) => (
                    <div
                      className="instructor-task-requirement"
                      key={`${requirement}-${index}`}
                    >
                      <span className="done">
                        <Icon
                          name="check"
                          size={12}
                        />
                      </span>

                      <p>{requirement}</p>

                      <button
                        type="button"
                        onClick={() =>
                          removeRequirement(index)
                        }
                        aria-label="حذف المتطلب"
                      >
                        <Icon
                          name="trash"
                          size={14}
                        />
                      </button>

                      <button
                        type="button"
                        aria-label="تعديل المتطلب"
                      >
                        <Icon
                          name="edit"
                          size={14}
                        />
                      </button>
                    </div>
                  )
                )}

              </div>

              <div className="instructor-task-add-requirement">
                <input
                  value={newRequirement}
                  onChange={(event) =>
                    setNewRequirement(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      addRequirement();
                    }
                  }}
                  placeholder="إضافة معيار أو متطلب جديد للمهمة"
                />

                <button
                  type="button"
                  onClick={addRequirement}
                >
                  <Icon name="plus" size={15} />
                  إضافة معيار
                </button>
              </div>
            </section>

            {/* 5 */}
            <section className="instructor-task-card">

              <div className="instructor-task-card-heading">
                <div>
                  <span className="instructor-task-step">
                    5.
                  </span>

                  <h2>
                    الموارد المساعدة والملفات الإرشادية
                    <small>(اختياري)</small>
                  </h2>
                </div>
              </div>

              <p className="instructor-task-help">
                أرفق ملفات PDF أو أوراق مساعدة يسترشد بها
                الطالب أثناء تنفيذ المهمة.
              </p>

              {task.resources.map((resource) => (
                <div
                  className="instructor-task-resource"
                  key={resource.id}
                >
                  <span>
                    <Icon name="save" size={16} />
                  </span>

                  <div>
                    <strong>
                      {resource.name}
                    </strong>

                    <small>
                      {resource.size} • مرفوع حديثًا
                    </small>
                  </div>

                  <button type="button">
                    معاينة
                  </button>

                  <button type="button">
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="instructor-task-resource-add"
              >
                <Icon name="plus" size={15} />
                إضافة ملف مساند (PDF، نموذج إرشادي)
              </button>
            </section>

            {/* Guidance */}
            <section className="instructor-task-guidance">
              <span>
                <Icon name="award" size={18} />
              </span>

              <div>
                <strong>
                  قاعدة إكمال المهمة ونقاط التقدير
                </strong>

                <p>
                  تظهر هذه المهمة للطلاب في نهاية القسم.
                  يستعرض المدرب أعمال الطلاب لاحقًا ويقدم
                  الملاحظات والتوجيه، بينما يحصل الطالب على
                  النقاط عند إكمال متطلبات المهمة.
                </p>
              </div>
            </section>

          </main>

          {/* Sidebar */}
          <aside className="instructor-task-sidebar">

            {/* Student preview */}
            <section className="instructor-task-side-card">

              <div className="instructor-task-side-heading">
                <strong>
                  معاينة كما يراها الطالب
                </strong>

                <Icon name="eye" size={16} />
              </div>

              <div className="instructor-task-student-preview">

                <span className="instructor-task-preview-label">
                  مهمة القسم
                </span>

                <h3>
                  {task.title ||
                    "عنوان المهمة"}
                </h3>

                <p>
                  {task.description ||
                    "سيظهر وصف المهمة للطالب هنا."}
                </p>

                <div className="instructor-task-preview-submission">
                  <Icon
                    name={
                      task.submissionType === "image"
                        ? "camera"
                        : "save"
                    }
                    size={17}
                  />

                  <div>
                    <strong>
                      {task.submissionType === "image"
                        ? "صورة فوتوغرافية"
                        : task.submissionType === "text"
                          ? "نص كتابي"
                          : "ملف مستند"}
                    </strong>

                    <small>
                      نوع التسليم المطلوب
                    </small>
                  </div>
                </div>

                <button type="button">
                  تسليم المهمة
                  <Icon
                    name="arrow-left"
                    size={14}
                  />
                </button>
              </div>

              <button
                type="button"
                className="instructor-task-preview-action"
              >
                <Icon name="upload" size={15} />
                معاينة المهمة كاملة
              </button>
            </section>

            {/* Readiness */}
            <section className="instructor-task-side-card">

              <div className="instructor-task-readiness-heading">
                <strong>
                  جاهزية المهمة للحفظ
                </strong>

                <span>
                  {readiness}%
                </span>
              </div>

              <div className="instructor-task-readiness-progress">
                <span
                  style={{
                    width: `${readiness}%`,
                  }}
                />
              </div>

              <div className="instructor-task-checklist">
                {readinessItems.map((item) => (
                  <div key={item.id}>
                    <span
                      className={
                        item.done
                          ? "complete"
                          : ""
                      }
                    >
                      <Icon
                        name={
                          item.done
                            ? "check"
                            : "clock"
                        }
                        size={11}
                      />
                    </span>

                    <p>{item.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Delete */}
            {isEditMode && (
              <section className="instructor-task-danger-card">
                <strong>
                  حذف هذه المهمة؟
                </strong>

                <p>
                  سيؤدي الحذف إلى إزالة هذه المهمة من
                  القسم. هذا الإجراء لا يمكن التراجع عنه.
                </p>

                <div>
                  <button type="button">
                    إلغاء
                  </button>

                  <button type="button">
                    <Icon
                      name="trash"
                      size={14}
                    />
                    حذف المهمة
                  </button>
                </div>
              </section>
            )}

          </aside>
        </div>

        {/* Bottom */}
        <footer className="instructor-task-bottom-bar">

          <div>
            <span className="instructor-task-save-dot" />

            <span>
              {saved
                ? "تم حفظ التغييرات تلقائيًا"
                : "توجد تغييرات غير محفوظة"}
            </span>
          </div>

          <div>
            <button
              type="button"
              className="instructor-button instructor-button-outline"
              onClick={saveDraft}
            >
              حفظ كمسودة
            </button>

            <button
              type="button"
              className="instructor-button"
              onClick={saveTask}
            >
              {isEditMode
                ? "حفظ تعديلات المهمة"
                : "حفظ المهمة وإكمال القسم"}

              <Icon
                name="arrow-left"
                size={15}
              />
            </button>
          </div>

        </footer>

      </div>
    </section>
  );
}