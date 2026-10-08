import ReportCourseButton from '../components/learner/ReportCourseButton';
import '../styles/community.css';
import { useState } from "react";
import { Link, useParams } from "react-router";
import { usePreferences } from "../context/PreferencesContext";
import { coursePagesCopy } from "../i18n/coursePagesCopy";
import { courses, categoryKeys } from "../data/courses";
import { getCourseText, getCurriculum } from "../data/courseHelpers";
import CourseCard from "../components/CourseCard";
import Modal from "../components/Modal";
import useAccountProfile from '../hooks/useAccountProfile';
import { useLearnerWallet } from '../hooks/useLearnerWallet';
import { useLearner } from '../context/LearnerContext';
import { accountId, enrollWithPoints } from '../data/pointsLedger';
import { pointsPolicy } from '../data/pointsPolicy';
export default function CourseDetailsPage() {
  const { courseId } = useParams();
  const course = courses.find((item) => String(item.id) === courseId);
  const { copy: c, language } = usePreferences();
  const p = coursePagesCopy[language];
  if (!course)
    return (
      <main className="section container empty-state">
        <h1>{p.notFound}</h1>
        <p>{p.notFoundText}</p>
        <Link className="button" to="/courses">
          {p.back}
        </Link>
      </main>
    );
  return (
    <CourseDetail
      key={course.id}
      course={course}
      c={c}
      p={p}
      language={language}
    />
  );
}
function CourseDetail({ course, c, p, language }) {
  const profile = useAccountProfile();
  const { balance, error: walletError } = useLearnerWallet();
  const { enrollments } = useLearner();
  const [enrollmentError, setEnrollmentError] = useState('');
  const registered = enrollments.some(item => item.courseId === course.id);
  const t = (ar, en) => language === 'ar' ? ar : en;
  const ownCourse = course.instructorId === accountId(profile);
  function enroll() {
    try { enrollWithPoints(profile, course.id); setEnrollmentError(''); }
    catch (error) { setEnrollmentError(error.message === 'balance' ? t('رصيدك غير كافٍ. اكسب نقاطًا من تسجيل المتعلّمين في دوراتك.', 'Insufficient balance. Earn points when learners enroll in your courses.') : t('تعذّر التسجيل. تحقق من صلاحية الحساب وتخزين المتصفح ثم حاول مجددًا.', 'Enrollment failed. Check your account role and browser storage, then try again.')); }
  }
  const [dialog, setDialog] = useState(null);
  const [previewLesson, setPreviewLesson] = useState(null);


  const [title, description] = getCourseText(course, language);
  const modules = getCurriculum(course, language);
  const duration = modules
    .flatMap((module) => module.lessons)
    .reduce((sum, lesson) => sum + lesson.minutes, 0);
  const teacher = course.instructor[language];
  const related = courses
    .filter((item) => item.id !== course.id)
    .sort(
      (a, b) =>
        Number(b.category === course.category) -
        Number(a.category === course.category),
    )
    .slice(0, 3);
  return (
    <main className="course-detail-page">
      <div className="container">
        <nav
          className="breadcrumbs"
          aria-label={language === "ar" ? "مسار الصفحة" : "Breadcrumb"}
        >
          <Link to="/">{c.home}</Link>
          <span aria-hidden="true">/</span>
          <Link to="/courses">{c.courses}</Link>
          <span aria-hidden="true">/</span>
          <span>{p.details}</span>
        </nav>
        <section className="detail-hero">
          <div className="detail-hero-copy">
            <span className="detail-category">
              <span /> {c.categories[categoryKeys.indexOf(course.category)]}
            </span>
            <h1>{title}</h1><ReportCourseButton course={course}/>
            <p>{description}</p>
            <div className="detail-rating">
              <span className="stars" aria-hidden="true">
                ★★★★★
              </span>
              <strong>{course.rating}</strong>
              <span>
                ({course.reviews} {p.reviews})
              </span>
            </div>
            <dl className="detail-metrics">
              <div>
                <dt>{p.level}</dt>
                <dd>{p[course.level]}</dd>
              </div>
              <div>
                <dt>{p.time}</dt>
                <dd>
                  {duration} {p.minutes}
                </dd>
              </div>
              <div>
                <dt>{p.content}</dt>
                <dd>
                  {course.lessons} {c.lessons}
                </dd>
              </div>
              <div>
                <dt>{p.language}</dt>
                <dd>{p.courseLanguage}</dd>
              </div>
            </dl>
            <div className="instructor-line">
              <span className="avatar" aria-hidden="true">
                {teacher.charAt(0)}
              </span>
              <div>
                <strong>{teacher}</strong>
                <small>{p.instructor}</small>
              </div>
            </div>
          </div>
          <div className="detail-hero-art">
            <img
              src={course.image}
              alt={title}
              fetchPriority="high"
            />
          </div>
        </section>
        <p className="demo-notice">{p.demo}</p>
        <div className="detail-layout">
          <div className="detail-main">
            <section className="detail-section">
              <h2>{p.about}</h2>
              <div className="detail-panel">
                <p>{description}</p>
                <p>
                  {language === "ar"
                    ? `هذه الدورة تساعدك على تطوير مهارتك في ${c.categories[categoryKeys.indexOf(course.category)]} من خلال وحدات قصيرة، أمثلة توضيحية وتطبيق عملي. ابدأ بالأساسيات، ثم تقدّم خطوة بخطوة لبناء تجربة تستطيع تطبيقها بنفسك.`
                    : `Develop your ${c.categories[categoryKeys.indexOf(course.category)].toLowerCase()} skills through short modules, clear examples and practical exercises. Start with the fundamentals and build your confidence step by step.`}
                </p>
              </div>
            </section>
            <section className="detail-section">
              <h2>{p.learn}</h2>
              <ul className="learning-grid">
                {course.outcomes[language].map((text) => (
                  <li key={text}>
                    <span aria-hidden="true">✓</span>
                    {text}
                  </li>
                ))}
              </ul>
            </section>
            <section className="detail-section">
              <div className="detail-section-heading">
                <h2>{p.content}</h2>
                <span>
                  {modules.length} {p.modules} · {course.lessons} {c.lessons}
                </span>
              </div>
              <div className="curriculum">
                {modules.map((module, i) => (
                  <details key={i} open={i === 0}>
                    <summary>
                      <span>
                        <small>
                          {language === "ar"
                            ? `الوحدة ${i + 1}`
                            : `Module ${i + 1}`}
                        </small>
                        <strong>{module.title}</strong>
                      </span>
                      <span>
                        {module.lessons.length} {c.lessons}
                        <b aria-hidden="true">⌄</b>
                      </span>
                    </summary>
                    <ul>
                      {module.lessons.map((lesson, j) => (
                        <li key={lesson.id}>
                          <button
                            className="lesson-row"
                            disabled={!lesson.preview}
                            onClick={() => {
                              setPreviewLesson(lesson);
                              setDialog("preview");
                            }}
                          >
                            <span className="lesson-icon" aria-hidden="true">
                              {lesson.preview ? "▷" : "▣"}
                            </span>
                            <span className="lesson-name">
                              {String(j + 1).padStart(2, "0")} — {lesson.title}
                              <small>
                                {lesson.minutes} {p.minutes}
                              </small>
                            </span>
                            <span
                              className={
                                lesson.preview ? "preview-tag" : "locked-tag"
                              }
                            >
                              {lesson.preview ? p.free : p.locked}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
            <div className="trainer-requirements">
              <section className="detail-section">
                <h2>{p.trainer}</h2>
                <div className="detail-panel">
                  <div className="instructor-line">
                    <span className="avatar" aria-hidden="true">
                      {teacher.charAt(0)}
                    </span>
                    <div>
                      <strong>{teacher}</strong>
                      <small>{p.trainerStats}</small>
                    </div>
                  </div>
                  <p>{p.trainerNote}</p>
                </div>
              </section>
              <section className="detail-section">
                <h2>{p.requirements}</h2>
                <ul className="detail-panel requirements-list">
                  {p.requirementsList.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </section>
            </div>
            <section className="detail-section">
              <div className="detail-section-heading">
                <h2>{p.reviews}</h2>
                <span>★ {course.rating}</span>
              </div>
              <div className="reviews-grid">
                {p.reviewNames.map((name, i) => (
                  <article className="review-card" key={i}>
                    <div>
                      <strong>{name}</strong>
                      <span
                        className="stars"
                        aria-label={`${c.rating} 5 ${c.outOf}`}
                      >
                        ★★★★★
                      </span>
                    </div>
                    <p>{p.reviewTexts[i]}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
          <aside className="enrollment-card" aria-label={p.enroll}>
            <span className="section-kicker">
              {c.brand} · {p.details}
            </span>
            <h2>{title}</h2>
            <div className="enrollment-cost">
              <span>{p.cost}</span>
              <strong>
                {course.points}
                <small> {c.points}</small>
              </strong>
            </div>

{profile.role === 'instructor' ? <Link className="button enroll-button" to="/instructor/settings#account-type">{t('أضف دور المتعلّم من إعدادات الحساب', 'Add learner access in account settings')}</Link>
  : registered ? <Link className="button enroll-button" to={`/learner/courses/${course.id}/learn`}>{t('متابعة التعلّم', 'Continue learning')}</Link>
  : !profile.role ? <Link className="button enroll-button" to="/login">{t('سجّل الدخول للالتحاق', 'Log in to enroll')}</Link>
  : <button className="button enroll-button" onClick={enroll} disabled={walletError || ownCourse || balance < pointsPolicy.enrollmentCost}>{ownCourse ? t('هذه دورتك', 'This is your course') : t('التحق مقابل 20 نقطة', 'Enroll for 20 points')}</button>}
<p className="enrollment-hint">{profile.role ? t(`رصيدك: ${balance} نقطة. يُخصم 20 نقطة مرة واحدة عند التسجيل.`, `Your balance: ${balance} points. Enrollment costs 20 points once.`) : t('أنشئ حسابًا لتحصل على 20 نقطة لتجربة أول دورة.', 'Create an account to receive 20 points for your first course.')}</p>
{!registered && profile.role && balance < pointsPolicy.enrollmentCost && <p role="status">{t('رصيدك غير كافٍ. اكسب نقاطًا من تسجيل المتعلّمين في دوراتك.', 'Insufficient balance. Earn points when learners enroll in your courses.')}</p>}
{enrollmentError && <p role="alert">{enrollmentError}</p>}
            <ul className="enrollment-perks">
              {p.perks.map((text) => (
                <li key={text}>
                  <span aria-hidden="true">✓</span>
                  {text}
                </li>
              ))}
            </ul>

          </aside>
        </div>
        <section className="detail-related">
          <div className="section-heading">
            <span className="section-kicker">{p.related}</span>
            <h2>{p.relatedText}</h2>
          </div>
          <div className="courses-grid">
            {related.map((item) => (
              <CourseCard key={item.id} course={item} />
            ))}
          </div>
          <Link className="button button-outline" to="/courses">
            {p.back}
          </Link>
        </section>
      </div>

      {dialog === "preview" && (
        <Modal title={previewLesson.title} onClose={() => setDialog(null)}>
          <div className="video-placeholder">
            <span aria-hidden="true">▷</span>
            <p>{p.noVideo}</p>
          </div>
          <p>{p.previewBody}</p>
          <p className="demo-note">{p.previewNote}</p>
        </Modal>
      )}
    </main>
  );
}
