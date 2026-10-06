import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
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
  const { instructor } = instructorDemo;
  const isEditMode = Boolean(courseId);
  const editCourse = isEditMode
    ? instructorDemo.courses.find((course) => String(course.id) === String(courseId))
    : null;
  const coursePoints = editCourse?.coursePoints ?? 20;
  const categoryCopyKeys = {
    photography: "photographyCategory",
    "graphic-design": "graphicDesignCategory",
    "user-interface": "userInterfaceCategory",
    "digital-marketing": "digitalMarketingCategory",
    "video-editing": "videoEditingCategory",
    "digital-content": "digitalContentCategory",
  };
  const categoryLabels = {
    photography: c.photographyCategory,
    "graphic-design": c.graphicDesignCategory,
    "user-interface": c.userInterfaceCategory,
    "digital-marketing": c.digitalMarketingCategory,
    "video-editing": c.videoEditingCategory,
    "digital-content": c.digitalContentCategory,
  };
  const fileInputRef = useRef(null);
  const courseCategory = Object.entries(categoryCopyKeys).find(([, key]) =>
    ["ar", "en"].some((locale) => editCourse?.category?.[locale] === instructorCopy[locale][key]),
  )?.[0];

  const [courseImage, setCourseImage] = useState(editCourse?.image || null);

  const [form, setForm] = useState({
    title: editCourse?.title || { ar: "", en: "" },
    category: editCourse?.categoryKey || courseCategory || "",
    language: editCourse?.language || "ar",
    description: editCourse?.description || { ar: "", en: "" },
    level: editCourse?.level || "",
  });

  const [objectives, setObjectives] = useState(editCourse?.objectives || []);

  const [newObjective, setNewObjective] = useState("");

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

    const previewUrl = URL.createObjectURL(file);
    setCourseImage(previewUrl);
  };

  const saveCourseChanges = () => {
    if (!editCourse) return;

    const categoryKey = categoryCopyKeys[form.category];
    Object.assign(editCourse, {
      title: form.title,
      description: form.description,
      category: {
        ar: instructorCopy.ar[categoryKey],
        en: instructorCopy.en[categoryKey],
      },
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
    setSaveStatus(language === "ar" ? "البيانات موجودة في معاينة الصفحة فقط؛ حفظ المسودة الدائم يحتاج ربط خدمة الدورات." : "Data remains in this page preview only; persistent draft saving requires the course service.");
  };
  const continueToCurriculum = () => {
    if (isEditMode) {
      saveCourseChanges();
      return;
    }
    navigate("/instructor/courses/new/curriculum");
  };

  return (
    <section className="instructor-create-course-page">
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
                        <option value="photography">
                          {c.photographyCategory}
                        </option>
                        <option value="graphic-design">{c.graphicDesignCategory}</option>
                        <option value="user-interface">{c.userInterfaceCategory}</option>
                        <option value="digital-marketing">{c.digitalMarketingCategory}</option>
                        <option value="video-editing">{c.videoEditingCategory}</option>
                        <option value="digital-content">{c.digitalContentCategory}</option>
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
                  <span>{c.instructorLabel} {instructor.name[language]} ({c.you})</span>
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
