import { useState } from "react";

import { Link } from "react-router";

import { courses } from "../../data/courses";
import { learnerDemo } from "../../data/learnerDemo";
import { learnerCopy } from "../../i18n/learnerCopy";

import { usePreferences } from "../../context/PreferencesContext";

import CourseCard from "../../components/CourseCard";
import Modal from "../../components/Modal";

import "../../styles/learner.css";

// نربط بيانات تسجيل المتعلّم بالكورس الأصلي.
// لا ننسخ عنوان الكورس أو صورته إلى learnerDemo.
import { getEnrollmentDetails } from "../../data/learnerHelpers";

import { useLearner } from "../../context/LearnerContext";

function LearningProgress({ value, label }) {
  return (
    <div className="learner-progress">
      <div className="learner-progress-label">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>

      <progress value={value} max="100" aria-label={label}>
        {value}%
      </progress>
    </div>
  );
}

export default function LearnerDashboard() {
  const { language } = usePreferences();
  const t = learnerCopy[language];

  const [modal, setModal] = useState(null);

  const { enrollments: learnerEnrollments } = useLearner();

  const enrollments = learnerEnrollments
    .map(getEnrollmentDetails)
    .filter(Boolean);

  const activeCourses = enrollments
    .filter((enrollment) => !enrollment.isComplete)
    .sort(
      (a, b) =>
        new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt)
    );

  const completedCourses = enrollments.filter(
    (enrollment) => enrollment.isComplete
  );

  const completedLessons = enrollments.reduce(
    (total, enrollment) => total + enrollment.completedCount,
    0
  );

  const latestCourse = activeCourses[0];

  // الدورة الأخيرة تظهر في القسم الرئيسي فقط لتجنّب التكرار.
  const otherActiveCourses = activeCourses.slice(1);

  const enrolledIds = new Set(
    enrollments.map((enrollment) => enrollment.courseId)
  );

  const recommendations = courses
    .filter((course) => !enrolledIds.has(course.id))
    .slice(0, 2);

  const tasks = learnerDemo.tasks.filter((task) =>
    courses.some((course) => course.id === task.courseId)
  );

  const stats = [
    {
      label: t.active,
      value: activeCourses.length,
    },
    {
      label: t.completed,
      value: completedCourses.length,
    },
    {
      label: t.finishedLessons,
      value: completedLessons,
    },
  ];

  return (
    <main className="learner-dashboard">
      <div className="container">
        {/* Navbar موجود الآن في LearnerLayout، لذلك لا نضعه هنا */}

        <header className="learner-welcome">
          <div>
            <span className="section-kicker">{t.dashboard}</span>

            <h1>
              {t.greeting}، {learnerDemo.name[language]}
              <span aria-hidden="true"> 👋</span>
            </h1>

            <p>{t.intro}</p>
          </div>

          <Link className="button button-outline" to="/courses">
            {t.explore}
          </Link>
        </header>

        <p className="learner-demo-label">{t.demo}</p>

        <section className="learner-summary" aria-label={t.summary}>
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

        <div className="learner-dashboard-grid">
          <div className="learner-main-column">
            {latestCourse ? (
              <section className="learner-panel learner-resume">
                <div className="learner-section-heading">
                  <h2>{t.resume}</h2>
                  <span className="learner-badge">{t.active}</span>
                </div>

                <h3>{latestCourse.course.title[language]}</h3>

                {latestCourse.nextLesson && (
                  <p className="learner-next-lesson">
                    <strong>{t.nextLesson}: </strong>
                    {latestCourse.nextLesson.title[language]}
                  </p>
                )}

                <LearningProgress
                  value={latestCourse.progress}
                  label={t.progress}
                />

                <Link
                  className="button"
                  to={`/learner/courses/${latestCourse.course.id}/learn`}
                >
                  {t.continueLearning}
                </Link>
              </section>
            ) : (
              <section className="learner-panel">
                <h2>{t.keepLearning}</h2>
                <p>{t.noActive}</p>

                <Link className="button" to="/courses">
                  {t.explore}
                </Link>
              </section>
            )}

            {otherActiveCourses.length > 0 && (
              <section className="learner-section">
                <div className="learner-section-heading">
                  <h2>{t.keepLearning}</h2>
                </div>

                <div className="learner-course-list">
                  {otherActiveCourses.map((enrollment) => (
                    <article
                      className="learner-panel learner-course-row"
                      key={enrollment.courseId}
                    >
                      <Link
                        className="learner-course-thumbnail"
                        to={`/learner/courses/${enrollment.courseId}/learn`}
                        aria-label={enrollment.course.title[language]}
                      >
                        <img
                          src={enrollment.course.image}
                          alt={enrollment.course.title[language]}
                          loading="lazy"
                        />
                      </Link>

                      <div className="learner-course-row-content">
                        <h3>
                          <Link
                            to={`/learner/courses/${enrollment.courseId}/learn`}
                          >
                            {enrollment.course.title[language]}
                          </Link>
                        </h3>

                        <p>
                          {enrollment.course.instructor[language]}
                        </p>

                        <LearningProgress
                          value={enrollment.progress}
                          label={t.progress}
                        />

                        <Link
                          className="button button-outline button-small"
                          to={`/learner/courses/${enrollment.courseId}/learn`}
                        >
                          {t.continueLearning}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="learner-panel learner-section">
              <div className="learner-section-heading">
                <h2>{t.tasks}</h2>
                <span className="learner-count">{tasks.length}</span>
              </div>

              <p className="learner-section-description">
                {t.tasksIntro}
              </p>

              <div className="learner-task-list">
                {tasks.map((task) => {
                  const course = courses.find(
                    (item) => item.id === task.courseId
                  );

                  return (
                    <article
                      className="learner-task"
                      key={task.id}
                    >
                      <div>
                        <span
                          className={`learner-task-status ${task.status}`}
                        >
                          {t[task.status]}
                        </span>

                        <h3>{task.title[language]}</h3>

                        <p>{course.title[language]}</p>
                      </div>

                      <button
                        type="button"
                        className="button button-outline button-small"
                        onClick={() =>
                          setModal({
                            title: task.title[language],
                            description: task.description[language],
                            note: t.taskDemo,
                          })
                        }
                      >
                        {t.taskDetails}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            {recommendations.length > 0 && (
              <section className="learner-section">
                <div className="learner-section-heading">
                  <h2>{t.recommended}</h2>
                </div>

                <p className="learner-section-description">
                  {t.recommendedIntro}
                </p>

                <div className="learner-recommendations">
                  {recommendations.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="learner-side-column">
            <section className="learner-panel learner-points">
              <span className="section-kicker">
                {t.pointsTitle}
              </span>

              <div className="learner-points-value">
                <strong>{learnerDemo.points}</strong>
                <span>{t.points}</span>
              </div>

              <p>{t.pointsText}</p>

              <button
                className="button button-outline"
                onClick={() =>
                  setModal({
                    title: t.pointsTitle,
                    description: t.pointsDemo,
                  })
                }
              >
                {t.pointsDetails}
              </button>
            </section>
          </aside>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal.title}
          onClose={() => setModal(null)}
        >
          <p>{modal.description}</p>

          {modal.note && (
            <p className="demo-note">{modal.note}</p>
          )}

          <button
            className="button"
            onClick={() => setModal(null)}
          >
            {t.close}
          </button>
        </Modal>
      )}
    </main>
  );
}