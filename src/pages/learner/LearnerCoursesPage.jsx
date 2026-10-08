import { useState } from "react";
import { Link } from "react-router";

import { getEnrollmentDetails } from "../../data/learnerHelpers";

import { learnerCopy } from "../../i18n/learnerCopy";
import { usePreferences } from "../../context/PreferencesContext";

import "../../styles/learner.css";
import { useLearner } from "../../context/LearnerContext";

function EnrolledCourseCard({ enrollment, language, t }) {
  const {
    course,
    progress,
    nextLesson,
    isComplete,
    completedCount,
  } = enrollment;

  return (
    <article className="enrolled-course-card">
      <Link
        className="enrolled-course-image"
        to={`/learner/courses/${course.id}/learn`}
        aria-label={course.title[language]}
      >
        <img
          src={course.image}
          alt={course.title[language]}
          loading="lazy"
        />
      </Link>

      <div className="enrolled-course-content">
        <span
          className={
            isComplete
              ? "enrolled-course-status completed"
              : "enrolled-course-status"
          }
        >
          {isComplete ? t.completedCourses : t.learningCourses}
        </span>

        <p className="enrolled-course-instructor">
          {course.instructor[language]}
        </p>

        <h2>
          <Link to={`/learner/courses/${course.id}/learn`}>
            {course.title[language]}
          </Link>
        </h2>

        <div className="enrolled-course-next">
          {isComplete ? (
            <p>{t.courseCompleted}</p>
          ) : nextLesson ? (
            <p>
              <strong>{t.nextLesson}: </strong>
              {nextLesson.title[language]}
            </p>
          ) : null}
        </div>

        <div className="learner-progress">
          <div className="learner-progress-label">
            <span>{t.progress}</span>
            <strong>{progress}%</strong>
          </div>

          <progress
            value={progress}
            max="100"
            aria-label={`${t.progress}: ${course.title[language]}`}
          >
            {progress}%
          </progress>
        </div>

        <p className="enrolled-course-lesson-count">
          {t.finishedLessons}: {completedCount} / {course.lessons}
        </p>

        <Link
          className={
            isComplete
              ? "button button-outline enrolled-course-button"
              : "button enrolled-course-button"
          }
          to={`/learner/courses/${course.id}/learn`}
        >
          {isComplete ? t.reviewCourse : t.continueLearning}
        </Link>
        <Link className="button button-outline button-small" to={`/learner/courses/certificates/${course.id}`}>{language === "ar" ? "الشهادة ومتطلباتها" : "Certificate requirements"}</Link>
      </div>
    </article>
  );
}

export default function LearnerCoursesPage() {
  const { language } = usePreferences();
  const t = learnerCopy[language];

  const [filter, setFilter] = useState("all");

const { enrollments: learnerEnrollments } = useLearner();

    const enrollments = learnerEnrollments
    .map(getEnrollmentDetails)
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt),
    );

  const active = enrollments.filter(
    (enrollment) => !enrollment.isComplete,
  );

  const completed = enrollments.filter(
    (enrollment) => enrollment.isComplete,
  );

  const visibleCourses =
    filter === "active"
      ? active
      : filter === "completed"
        ? completed
        : enrollments;

  const filters = [
    {
      key: "all",
      label: t.allCourses,
      count: enrollments.length,
    },
    {
      key: "active",
      label: t.learningCourses,
      count: active.length,
    },
    {
      key: "completed",
      label: t.completedCourses,
      count: completed.length,
    },
  ];

  const stats = [
    {
      label: t.enrolledCourses,
      value: enrollments.length,
    },
    {
      label: t.learningCourses,
      value: active.length,
    },
    {
      label: t.completedCourses,
      value: completed.length,
    },
  ];

  return (
    <main className="learner-dashboard">
      <div className="container">

        <header className="learner-welcome">
          <div>
            <span className="section-kicker">{t.dashboard}</span>
            <h1>{t.myCourses}</h1>
            <p>{t.myCoursesIntro}</p>
          </div>

          <div className="account-actions"><Link className="button button-outline" to="/learner/courses/certificates">{language === "ar" ? "شهاداتي" : "My certificates"}</Link><Link className="button button-outline" to="/courses">
            {t.explore}
          </Link></div>
        </header>

        <p className="learner-demo-label">{t.demo}</p>

        <section
          className="learner-summary"
          aria-label={t.summary}
        >
          {stats.map((stat) => (
            <article
              className="learner-panel learner-stat"
              key={stat.label}
            >
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </article>
          ))}
        </section>

        <div className="learner-course-filters" aria-label={t.myCourses}>
          {filters.map((item) => (
            <button
              key={item.key}
              className={
                filter === item.key
                  ? "learner-course-filter active"
                  : "learner-course-filter"
              }
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>

        <section
          className="learner-enrolled-grid"
          aria-label={t.myCourses}
          aria-live="polite"
        >
         {visibleCourses.map((enrollment) => (
  <EnrolledCourseCard
    key={enrollment.courseId}
    enrollment={enrollment}
    language={language}
    t={t}
  />
))}
        </section>

        {visibleCourses.length === 0 && (
          <section className="learner-panel learner-courses-empty">
            <h2>{t.emptyCourses}</h2>

            <Link className="button" to="/courses">
              {t.explore}
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}