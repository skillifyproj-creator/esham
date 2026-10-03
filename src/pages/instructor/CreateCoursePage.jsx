import { useRef, useState } from "react";
import { Link } from "react-router";
import Icon from "../../components/Icon";

export default function CreateCoursePage() {
  const fileInputRef = useRef(null);

  const [courseImage, setCourseImage] = useState(null);

  const [form, setForm] = useState({
    title: "أساسيات التصوير الفوتوغرافي وإعدادات الإضاءة الاحترافية",
    category: "التصوير الفوتوغرافي وصناعة الصورة",
    language: "العربية (Arabic)",
    description:
      "دورة تدريبية تطبيقية تأخذك من الصفر لفهم إعدادات الكاميرا اليدوية مثلث التعريض، سرعة الغالق، فتحة العدسة، مع أسرار توزيع الإضاءة الطبيعية والصناعية في الاستوديو للحصول على صور احترافية مميزة.",
    level: "مبتدئ (افتراضي)",
  });

  const [objectives, setObjectives] = useState([
    "فهم مثلث التعريض للضوء والتحكم اليدوي الكامل بخصائص الكاميرا",
    "تطبيق قواعد التكوين الفوتوغرافي وقاعدة الأثلاث والخطوط الإرشادية",
    "إعداد وتوزيع مصادر الإضاءة الأساسية لتصوير البورتريه والمنتجات",
  ]);

  const [newObjective, setNewObjective] = useState("");

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const addObjective = () => {
    const value = newObjective.trim();

    if (!value) return;

    setObjectives((current) => [...current, value]);
    setNewObjective("");
  };

  const removeObjective = (index) => {
    setObjectives((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setCourseImage(previewUrl);
  };

  const saveDraft = () => {
    console.log("تم حفظ المسودة", {
      form,
      objectives,
      courseImage,
    });
  };

  const continueToCurriculum = () => {
    console.log("الانتقال إلى الخطوة الثانية", {
      form,
      objectives,
      courseImage,
    });
  };

  return (
    <section className="instructor-create-course-page">
      <div className="container">
        {/* PAGE HEADER */}
        <header className="instructor-create-course-heading">
          <div>
            <h1>إنشاء دورة جديدة</h1>
            <p>
              أنشئ دورة جديدة وشارك مهاراتك وخبرتك مع المتعلمين على منصة
              إسهام.
            </p>
          </div>

          <div className="instructor-create-course-heading-actions">
            <button
              type="button"
              className="instructor-create-secondary-button"
              onClick={saveDraft}
            >
              <Icon name="save" size={16} />
              حفظ كمسودة
            </button>

            <Link
              to="/instructor/courses"
              className="instructor-create-primary-button"
            >
              متابعة إلى المحتوى
              <Icon name="arrow-left" size={16} />
            </Link>
          </div>
        </header>

        {/* STEPPER */}
        <section className="instructor-create-stepper">
          <div className="instructor-create-step active">
            <span className="step-number">1</span>

            <div>
              <strong>الخطوة 01: المعلومات الأساسية</strong>
              <small>عنوان الدورة ووصفها</small>
            </div>
          </div>

          <span className="step-line" />

          <div className="instructor-create-step">
            <span className="step-number">2</span>

            <div>
              <strong>الخطوة 02: منهاج ومحتوى الدورة</strong>
              <small>الدروس والأقسام</small>
            </div>
          </div>

          <span className="step-line" />

          <div className="instructor-create-step">
            <span className="step-number">3</span>

            <div>
              <strong>الخطوة 03: المراجعة والنشر</strong>
              <small>راجع الدورة قبل نشرها</small>
            </div>
          </div>

          <div className="instructor-create-save-state">
            <Icon name="cloud" size={15} />
            <span>مسودة محفوظة تلقائياً منذ دقيقتين</span>
          </div>
        </section>

        {/* MAIN CONTENT */}
        <div className="instructor-create-layout">
          {/* MAIN FORM */}
          <main className="instructor-create-main">
            {/* BASIC INFORMATION */}
            <section className="instructor-create-panel">
              <div className="instructor-create-panel-heading">
                <div className="create-section-number">1</div>

                <div>
                  <h2>معلومات الدورة</h2>
                  <p>أدخل المعلومات الأساسية التي ستظهر للمتعلمين.</p>
                </div>
              </div>

              <div className="instructor-create-divider" />

              <div className="instructor-create-form">
                {/* TITLE */}
                <div className="create-field">
                  <label htmlFor="course-title">
                    عنوان الدورة <span>*</span>
                  </label>

                  <input
                    id="course-title"
                    type="text"
                    value={form.title}
                    onChange={(event) =>
                      updateField("title", event.target.value)
                    }
                    placeholder="أدخل عنوان الدورة"
                  />

                  <small>
                    اختر عنواناً واضحاً يساعد المتعلمين على فهم محتوى الدورة.
                  </small>
                </div>

                {/* CATEGORY + LANGUAGE */}
                <div className="create-field-grid">
                  <div className="create-field">
                    <label htmlFor="course-category">
                      التصنيف <span>*</span>
                    </label>

                    <div className="create-select-wrapper">
                      <select
                        id="course-category"
                        value={form.category}
                        onChange={(event) =>
                          updateField("category", event.target.value)
                        }
                      >
                        <option>
                          التصوير الفوتوغرافي وصناعة الصورة
                        </option>
                        <option>التصميم الجرافيكي</option>
                        <option>تصميم واجهات المستخدم</option>
                        <option>التسويق الرقمي</option>
                        <option>تحرير الفيديو</option>
                        <option>صناعة المحتوى الرقمي</option>
                      </select>

                      <Icon name="chevron-down" size={16} />
                    </div>
                  </div>

                  <div className="create-field">
                    <label htmlFor="course-language">
                      لغة الدورة <span>*</span>
                    </label>

                    <div className="create-select-wrapper">
                      <select
                        id="course-language"
                        value={form.language}
                        onChange={(event) =>
                          updateField("language", event.target.value)
                        }
                      >
                        <option>العربية (Arabic)</option>
                        <option>English</option>
                      </select>

                      <Icon name="chevron-down" size={16} />
                    </div>
                  </div>
                </div>

                {/* DESCRIPTION */}
                <div className="create-field">
                  <label htmlFor="course-description">
                    وصف الدورة <span>*</span>
                  </label>

                  <textarea
                    id="course-description"
                    rows={5}
                    maxLength={500}
                    value={form.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    placeholder="اكتب وصفاً مختصراً وواضحاً للدورة..."
                  />

                  <div className="create-field-footer">
                    <small>
                      اكتب وصفاً تعليمياً واضحاً عن محتوى الدورة وما سيكتسبه
                      المتعلم.
                    </small>

                    <span>{form.description.length} / 500 حرف</span>
                  </div>
                </div>

                {/* OBJECTIVES */}
                <div className="create-field create-objectives-field">
                  <div className="create-objectives-heading">
                    <div>
                      <label>
                        ماذا سيتعلم المتعلم؟ <span>*</span>
                      </label>

                      <small>
                        أضف أهدافاً تعليمية واضحة لما سيكتسبه المتعلم.
                      </small>
                    </div>

                    <span>{objectives.length} أهداف</span>
                  </div>

                  <div className="create-objectives-list">
                    {objectives.map((objective, index) => (
                      <div className="create-objective-item" key={objective}>
                        <span className="objective-check">
                          <Icon name="check" size={13} />
                        </span>

                        <span>{objective}</span>

                        <button
                          type="button"
                          onClick={() => removeObjective(index)}
                          aria-label="حذف الهدف"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="create-add-objective">
                    <input
                      type="text"
                      value={newObjective}
                      onChange={(event) =>
                        setNewObjective(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addObjective();
                        }
                      }}
                      placeholder="أضف هدفاً تعليمياً آخر..."
                    />

                    <button
                      type="button"
                      onClick={addObjective}
                      disabled={!newObjective.trim()}
                    >
                      + إضافة هدف تعليمي آخر
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* LEVEL */}
            <section className="instructor-create-panel">
              <div className="instructor-create-panel-heading">
                <div className="create-section-number">2</div>

                <div>
                  <h2>مستوى الدورة التدريبية</h2>
                  <p>حدد الفئة المستهدفة والمستوى المناسب للمتعلم.</p>
                </div>
              </div>

              <div className="instructor-create-divider" />

              <div className="create-level-grid">
                {[
                  {
                    value: "مبتدئ (افتراضي)",
                    title: "مبتدئ",
                    description: "لا يتطلب أي خبرة مسبقة. يبدأ من المفاهيم الأساسية.",
                  },
                  {
                    value: "متوسط",
                    title: "متوسط",
                    description:
                      "يتطلب معرفة سابقة بالمبادئ والتطبيقات الأساسية.",
                  },
                  {
                    value: "متقدم",
                    title: "متقدم",
                    description:
                      "يركز على تقنيات متقدمة ومهارات احترافية متخصصة.",
                  },
                ].map((level) => (
                  <label
                    className={
                      form.level === level.value
                        ? "create-level-card active"
                        : "create-level-card"
                    }
                    key={level.value}
                  >
                    <input
                      type="radio"
                      name="course-level"
                      value={level.value}
                      checked={form.level === level.value}
                      onChange={(event) =>
                        updateField("level", event.target.value)
                      }
                    />

                    <span className="create-radio" />

                    <span className="create-level-copy">
                      <strong>{level.title}</strong>
                      <small>{level.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* COVER IMAGE */}
            <section className="instructor-create-panel">
              <div className="instructor-create-panel-heading">
                <div className="create-section-number">3</div>

                <div>
                  <h2>صورة غلاف الدورة</h2>
                  <p>
                    الصورة الرئيسية التي ستظهر في بطاقة الدورة وصفحتها.
                  </p>
                </div>

                <span className="create-image-ratio">
                  نسبة 16:9 موصى بها
                </span>
              </div>

              <div className="instructor-create-divider" />

              <div className="create-cover-layout">
                <div className="create-upload-box">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageChange}
                    hidden
                  />

                  <div className="create-upload-icon">
                    <Icon name="image" size={23} />
                  </div>

                  <strong>اسحب الصورة هنا أو اختر ملفاً من جهازك</strong>

                  <small>
                    الحجم الموصى به: 1280×720 — JPG أو PNG أو WebP
                  </small>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    رفع صورة جديدة
                  </button>
                </div>

                <div className="create-cover-preview">
                  {courseImage ? (
                    <img src={courseImage} alt="معاينة غلاف الدورة" />
                  ) : (
                    <div className="create-cover-placeholder">
                      <Icon name="image" size={28} />
                      <span>معاينة صورة الغلاف</span>
                    </div>
                  )}

                  <span>معاينة صورة الغلاف</span>
                </div>
              </div>
            </section>

            {/* POINT SYSTEM */}
            <section className="instructor-create-panel">
              <div className="instructor-create-panel-heading">
                <div className="create-section-number green">
                  <Icon name="check" size={15} />
                </div>

                <div>
                  <h2>نظام نقاط الدورة المعتمد</h2>
                  <p>
                    قيمة النقاط التي يحصل عليها المتعلم عند إكمال الدورة.
                  </p>
                </div>
              </div>

              <div className="instructor-create-divider" />

              <div className="create-points-box">
                <div className="create-points-number">20</div>

                <div className="create-points-copy">
                  <span>20 نقطة معتمدة لكل دورة</span>
                  <p>
                    يحصل المتعلم على 20 نقطة عند إكمال متطلبات الدورة بنجاح.
                    قيمة النقاط ثابتة لجميع الدورات في المنصة.
                  </p>
                </div>

                <span className="create-points-badge">
                  <Icon name="check" size={13} />
                  ثابت وفق النظام
                </span>
              </div>

              <p className="create-points-note">
                * لا تستطيع تغيير قيمة النقاط في هذه المرحلة حتى تبقى منظومة
                النقاط متسقة بين جميع الدورات.
              </p>
            </section>

            {/* BOTTOM ACTIONS */}
            <div className="instructor-create-bottom-actions">
              <button
                type="button"
                className="instructor-create-secondary-button"
                onClick={saveDraft}
              >
                <Icon name="save" size={16} />
                حفظ كمسودة
              </button>

              <button
                type="button"
                className="instructor-create-primary-button"
                onClick={continueToCurriculum}
              >
                متابعة إلى المحتوى
                <Icon name="arrow-left" size={16} />
              </button>
            </div>
          </main>

          {/* SIDEBAR */}
          <aside className="instructor-create-sidebar">
            {/* PREVIEW */}
            <section className="create-preview-card">
              <div className="create-preview-heading">
                <span className="create-live-dot" />
                <strong>معاينة بطاقة الدورة (مبدئياً)</strong>
                <small>كما ستظهر للمتعلمين</small>
              </div>

              <div className="create-preview-image">
                {courseImage ? (
                  <img src={courseImage} alt="" />
                ) : (
                  <div className="create-preview-image-placeholder">
                    <Icon name="camera" size={30} />
                  </div>
                )}

                <span className="create-preview-points">20 نقطة</span>

                <span className="create-preview-category">
                  {form.category}
                </span>
              </div>

              <div className="create-preview-body">
                <div className="create-preview-meta">
                  <span>المدرب: أحمد خالد (أنت)</span>
                  <span>مستوى مبتدئ</span>
                </div>

                <h3>{form.title || "عنوان الدورة"}</h3>

                <p>
                  {form.description ||
                    "سيظهر هنا وصف الدورة الذي أدخلته في النموذج."}
                </p>

                <div className="create-preview-rating">
                  <span>★ جديد</span>
                  <span>(0 تقييم)</span>
                </div>

                <div className="create-preview-footer">
                  <span>اللغة: {form.language}</span>
                  <span>20 نقطة</span>
                </div>
              </div>
            </section>

            {/* TIP */}
            <section className="create-tip-card">
              <div className="create-tip-icon">
                <Icon name="info" size={15} />
              </div>

              <div>
                <strong>نصيحة لإعداد دورة مميزة</strong>

                <p>
                  كلما كان عنوان الدورة ووصفها أكثر وضوحاً، كانت فرصة جذب
                  المتعلمين وفهمهم لقيمة الدورة أفضل.
                </p>

                <ul>
                  <li>ركز على النتائج التي سيحققها المتعلم.</li>
                  <li>استخدم وصفاً مختصراً ومباشراً.</li>
                  <li>أضف أهدافاً تعليمية قابلة للفهم والقياس.</li>
                </ul>
              </div>
            </section>

            {/* SAVE NOTE */}
            <section className="create-sidebar-note">
              <Icon name="shield-check" size={17} />

              <p>
                سيتم حفظ جميع تغييراتك بشكل آمن ومستمر. يمكنك الرجوع والتعديل
                في أي وقت قبل النشر النهائي.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}