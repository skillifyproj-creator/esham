import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { readInstructorCourseDraft, saveInstructorCourseDraft } from "../../data/instructorCourseDraft";
import { categories, getCategory, resolveCategoryId } from "../../data/categories";
import useAccountProfile from "../../hooks/useAccountProfile";
import Icon from "../../components/Icon";
import InstructorCourseStepper from "../../components/instructor/InstructorCourseStepper";
import { usePreferences } from "../../context/PreferencesContext";
import { instructorDemo } from "../../data/instructorDemo";
import instructorCopy from "../../i18n/instructorCopy";
import "../../styles/instructor-create-course.css";

export default function CreateCoursePage() {
  const { language } = usePreferences();
  const c = instructorCopy[language];
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [saveStatus, setSaveStatus] = useState("");
  const profile = useAccountProfile();
  const isEditMode = Boolean(courseId);
  const editCourse = isEditMode
    ? instructorDemo.courses.find((course) => String(course.id) === String(courseId))
    : null;
  const storedDraft = !isEditMode ? readInstructorCourseDraft() : null;
  const initialCourse = editCourse || storedDraft;
  const coursePoints = 20;
  const categoryLabels = Object.fromEntries(categories.map(category => [category.id, category.title[language]]));
  const fileInputRef = useRef(null);
  const courseCategory = resolveCategoryId(initialCourse?.categoryKey) || resolveCategoryId(initialCourse?.category);

  const [courseImage, setCourseImage] = useState(initialCourse?.image || null);

  const [form, setForm] = useState({
    title: initialCourse?.title || { ar: "", en: "" },
    category: courseCategory || "",
    language: initialCourse?.language || "ar",
    description: initialCourse?.description || { ar: "", en: "" },
    level: typeof initialCourse?.level === "string" ? initialCourse.level : ({"مبتدئ":"beginner","متوسط":"intermediate","متقدم":"advanced","Beginner":"beginner","Intermediate":"intermediate","Advanced":"advanced"}[initialCourse?.level?.[language]] || ""),
  });

  const [objectives, setObjectives] = useState(initialCourse?.objectives || []);

  const [newObjective, setNewObjective] = useState("");

  useEffect(() => {
    if (!isEditMode) saveInstructorCourseDraft({ ...form, objectives, image: courseImage, categoryKey: form.category, category: getCategory(form.category)?.title || { ar: "", en: "" }, coursePoints: 20 });
  }, [form, objectives, courseImage, isEditMode]);

  const updateField = (field, value) => {
    setForm((current) => {
      const currentValue = current[field];
      return {
        ...current,
        [field]:
          currentValue && typeof currentValue === "object"
            ? { ...currentValue, [language]: value }
            : value,
      };
    });
  };

  const addObjective = () => {
    const value = newObjective.trim();

    if (!value) return;

    setObjectives((current) => [
      ...current,
      {
        id: `objective-${Date.now()}`,
        ar: language === "ar" ? value : "",
        en: language === "en" ? value : "",
      },
    ]);
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

    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setSaveStatus(language === 'ar' ? 'اختر صورة JPG أو PNG أو WEBP بحجم أقصى 2MB.' : 'Choose a JPG, PNG or WEBP cover up to 2MB.'); event.target.value = ''; return; }
    const reader = new FileReader(); reader.onload = () => { setCourseImage(String(reader.result)); setSaveStatus(''); }; reader.readAsDataURL(file);
  };

  const saveCourseChanges = () => {
    if (!editCourse) return;


    Object.assign(editCourse, {
      title: form.title,
      description: form.description,
      category: getCategory(form.category)?.title || { ar: "", en: "" },
      categoryKey: form.category,
      language: form.language,
      level: form.level,
      objectives,
      image: courseImage || editCourse.image,
    });

    navigate(`/instructor/courses/${courseId}/curriculum`);
  };

  const saveDraft = () => {
    if (isEditMode) {
      saveCourseChanges();
      return;
    }
    const stored = saveInstructorCourseDraft({ ...form, objectives, image: courseImage, categoryKey: form.category, category: getCategory(form.category)?.title || { ar: '', en: '' }, coursePoints: 20 });
    if (!stored) { setSaveStatus(language === 'ar' ? 'تعذّر حفظ المسودة. جرّب صورة أصغر أو فعّل تخزين المتصفح.' : 'Unable to save the draft. Try a smaller cover or enable browser storage.'); return; }
    setSaveStatus(language === "ar" ? "المسودة محفوظة في جلسة هذا المتصفح. النشر والحفظ على الحساب يحتاجان ربط خدمة الدورات." : "Draft saved in this browser session. Account storage and publishing require the course service.");
  };
  const continueToCurriculum = () => {
    if (isEditMode) {
      saveCourseChanges();
      return;
    }
    navigate("/instructor/courses/new/curriculum");
  };

  if (isEditMode && !editCourse) return <section className="container instructor-detail-page"><h1>{language === 'ar' ? 'الدورة غير موجودة' : 'Course not found'}</h1><Link to="/instructor/courses">{language === 'ar' ? 'العودة إلى دوراتي' : 'Back to my courses'}</Link></section>;
  return (<section className="instructor-create-course-page">
      <div className="container">
        {/* PAGE HEADER */}
        <header className="instructor-create-course-heading">
          <div>
            <h1>{isEditMode ? c.editCourseTitle : c.createNewCourse}</h1>
            <p>{isEditMode ? c.editCourseDescription : c.createCourseDescription}</p>
          </div>

          <div className="instructor-create-course-heading-actions">
            <button
              type="button"
              className="instructor-create-secondary-button"
              onClick={saveDraft}
            >
              <Icon name="save" size={16} />
              {isEditMode ? c.saveChanges : c.saveAsDraft}
            </button>

            {isEditMode ? (
              <button type="button" className="instructor-create-primary-button" onClick={saveCourseChanges}>
                {c.saveChanges}
                <Icon name="arrow-left" size={16} />
              </button>
            ) : (
              <Link to="/instructor/courses/new/curriculum" className="instructor-create-primary-button">
                {c.continueToContent}
                <Icon name="arrow-left" size={16} />
              </Link>
            )}
          </div>
        </header>

        {saveStatus && <p className="account-note" role="status">{saveStatus}</p>}
        <div className="instructor-create-stepper-row">
          <InstructorCourseStepper currentStep={1} />
        </div>

        {/* MAIN CONTENT */}
        <div className="instructor-create-layout">
          {/* MAIN FORM */}
          <main className="instructor-create-main">
            <div className="create-information-preview-grid">
            {/* BASIC INFORMATION */}
            <section className="instructor-create-panel">
              <div className="instructor-create-panel-heading">
                <div className="create-section-number">1</div>

                <div>
                  <h2>{c.courseInformation}</h2>
                  <p>{c.basicInfoForLearners}</p>
                </div>
              </div>

              <div className="instructor-create-divider" />

              <div className="instructor-create-form">
                {/* TITLE */}
                <div className="create-field">
                  <label htmlFor="course-title">
                    {c.courseTitle} <span>*</span>
                  </label>

                  <input
                    id="course-title"
                    type="text"
                    value={form.title[language]}
                    onChange={(event) =>
                      updateField("title", event.target.value)
                    }
                    placeholder={c.enterCourseTitle}
                  />

                  <small>
                    {c.clearTitleHelp}
                  </small>
                </div>

                {/* CATEGORY + LANGUAGE */}
                <div className="create-field-grid">
                  <div className="create-field">
                    <label htmlFor="course-category">
                      {c.category} <span>*</span>
                    </label>

                    <div className="create-select-wrapper">
                      <select
                        id="course-category"
                        value={form.category}
                        onChange={(event) =>
                          updateField("category", event.target.value)
                        }
                      >
                        <option value="" disabled>{c.category}</option>
                        {categories.map(category => <option key={category.id} value={category.id}>{category.title[language]}</option>)}
                      </select>

                      <Icon name="chevron-down" size={16} />
                    </div>
                  </div>

                  <div className="create-field">
                    <label htmlFor="course-language">
                      {c.courseLanguage} <span>*</span>
                    </label>

                    <div className="create-select-wrapper">
                      <select
                        id="course-language"
                        value={form.language}
                        onChange={(event) =>
                          updateField("language", event.target.value)
                        }
                      >
                        <option value="ar">{c.arabicLanguage}</option>
                        <option value="en">{c.englishLanguage}</option>
                      </select>

                      <Icon name="chevron-down" size={16} />
                    </div>
                  </div>
                </div>

                {/* DESCRIPTION */}
                <div className="create-field">
                  <label htmlFor="course-description">
                    {c.courseDescription} <span>*</span>
                  </label>

                  <textarea
                    id="course-description"
                    rows={5}
                    maxLength={500}
                    value={form.description[language]}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    placeholder={c.courseDescriptionPlaceholder}
                  />

                  <div className="create-field-footer">
                    <small>
                      {c.courseDescriptionHelp}
                    </small>

                    <span>{form.description[language].length} / 500 {c.characters}</span>
                  </div>
                </div>

                {/* OBJECTIVES */}
                <div className="create-field create-objectives-field">
                  <div className="create-objectives-heading">
                    <div>
                      <label>
                        {c.learningObjectives} <span>*</span>
                      </label>

                      <small>
                        {c.learningObjectivesHelp}
                      </small>
                    </div>

                    <span>{objectives.length} {c.objectives}</span>
                  </div>

                  <div className="create-objectives-list">
                    {objectives.map((objective, index) => (
                      <div className="create-objective-item" key={objective.id || index}>
                        <span className="objective-check">
                          <Icon name="check" size={13} />
                        </span>

                        <span>{objective[language]}</span>

                        <button
                          type="button"
                          onClick={() => removeObjective(index)}
                          aria-label={c.deleteObjective}
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
                      placeholder={c.addAnotherObjectivePlaceholder}
                    />

                    <button
                      type="button"
                      onClick={addObjective}
                      disabled={!newObjective.trim()}
                    >
                      + {c.addLearningObjective}
                    </button>
                  </div>
                </div>
              </div>
            </section>

<aside className="instructor-create-sidebar">
            {/* PREVIEW */}
            <section className="create-preview-card">
              <div className="create-preview-heading">
                <span className="create-live-dot" />
                <strong>{c.previewCourseCard}</strong>
                <small>{c.previewForLearners}</small>
              </div>

              <div className="create-preview-image">
                {courseImage ? (
                  <img src={courseImage} alt="" />
                ) : (
                  <div className="create-preview-image-placeholder">
                    <Icon name="camera" size={30} />
                  </div>
                )}

                <span className="create-preview-points">{coursePoints} {c.points}</span>

                <span className="create-preview-category">
                  {categoryLabels[form.category]}
                </span>
              </div>

              <div className="create-preview-body">
                <div className="create-preview-meta">
                  <span>{c.instructorLabel} {profile.name || (language === 'ar' ? 'أنت' : 'You')} ({c.you})</span>
                  <span>{c.beginnerLevel}</span>
                </div>

                <h3>{form.title[language] || c.courseTitleFallback}</h3>

                <p>
                  {form.description[language] ||
                    c.courseDescriptionFallback}
                </p>

                <div className="create-preview-rating">
                  <span>★ {c.new}</span>
                  <span>(0 {c.ratingCount})</span>
                </div>

                <div className="create-preview-footer">
                  <span>{c.languageLabel} {form.language === "ar" ? c.arabicLanguage : c.englishLanguage}</span>
                  <span>{coursePoints} {c.points}</span>
                </div>
              </div>
            </section>

            {/* TIP */}
            <section className="create-tip-card">
              <div className="create-tip-icon">
                <Icon name="info" size={15} />
              </div>

              <div>
                <strong>{c.courseTipTitle}</strong>

                <p>
                  {c.courseTipDescription}
                </p>

                <ul>
                  <li>{c.focusOnOutcomes}</li>
                  <li>{c.useConciseDescription}</li>
                  <li>{c.measurableObjectives}</li>
                </ul>
              </div>
            </section>
          </aside>
            </div>

            {/* LEVEL */}
            <section className="instructor-create-panel">
              <div className="instructor-create-panel-heading">
                <div className="create-section-number">2</div>

                <div>
                  <h2>{c.courseLevel}</h2>
                  <p>{c.selectTargetLevel}</p>
                </div>
              </div>

              <div className="instructor-create-divider" />

              <div className="create-level-grid">
                {[
                  {
                    value: "beginner",
                    title: c.beginner,
                    description: c.beginnerDescription,
                  },
                  {
                    value: "intermediate",
                    title: c.intermediate,
                    description: c.intermediateDescription,
                  },
                  {
                    value: "advanced",
                    title: c.advanced,
                    description: c.advancedDescription,
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

            <div className="create-cover-points-grid">
            {/* COVER IMAGE */}
            <section className="instructor-create-panel">
              <div className="instructor-create-panel-heading">
                <div className="create-section-number">3</div>
                <div>
                  <h2>{c.courseCoverImage}</h2>
                  <p>{c.courseCoverDescription}</p>
                </div>
                <span className="create-image-ratio">{c.recommendedRatio}</span>
              </div>

              <div className="instructor-create-divider" />

              <div className="create-cover-layout">
                <div className="create-cover-preview">
                  {courseImage ? (
                    <img src={courseImage} alt={c.courseCoverPreview} />
                  ) : (
                    <div className="create-cover-placeholder">
                      <Icon name="image" size={28} />
                      <span>{c.courseCoverPreview}</span>
                    </div>
                  )}
                  <span>{c.courseCoverPreview}</span>
                </div>

                <div className="create-upload-box">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageChange}
                    hidden
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {c.uploadNewImage}
                  </button>
                  <small>{c.recommendedImageSize}</small>
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
                  <h2>{c.approvedPointsSystem}</h2>
                  <p>{c.pointsOnCompletion}</p>
                </div>
              </div>

              <div className="instructor-create-divider" />

              <div className="create-points-box">
                <div className="create-points-number">{coursePoints}</div>

                <div className="create-points-copy">
                  <span>{coursePoints} {c.points} {c.approvedPointsLabel}</span>
                  <p>
                    {c.pointsCompletionDescription.replace("{points}", coursePoints)}
                  </p>
                </div>

                <span className="create-points-badge">
                  <Icon name="check" size={13} />
                  {c.fixedBySystem}
                </span>
              </div>

              <p className="create-points-note">
                {c.pointsCannotChange}
              </p>
            </section>

            </div>

            {/* BOTTOM ACTIONS */}
            <div className="instructor-create-bottom-actions">
              <button
                type="button"
                className="instructor-create-secondary-button"
                onClick={saveDraft}
              >
                <Icon name="save" size={16} />
                {isEditMode ? c.saveChanges : c.saveAsDraft}
              </button>

              <button
                type="button"
                className="instructor-create-primary-button"
                onClick={continueToCurriculum}
              >
                {isEditMode ? c.saveChanges : c.continueToContent}
                <Icon name="arrow-left" size={16} />
              </button>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
