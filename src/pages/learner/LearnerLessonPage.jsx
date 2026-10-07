import ReportCourseButton from '../../components/learner/ReportCourseButton';
import '../../styles/community.css';
import { Link, useParams, useSearchParams } from "react-router";
import { courses } from "../../data/courses";
import { getEnrollmentDetails } from "../../data/learnerHelpers";
import { useLearner } from "../../context/LearnerContext";
import { usePreferences } from "../../context/PreferencesContext";
import { lessonCopy } from "../../i18n/lessonCopy";

import "../../styles/learner.css";
import { useLearnerTasks } from "../../context/LearnerTasksContext";
export default function LearnerLessonPage() {
  const { courseId } = useParams();
  const [params, setParams] = useSearchParams();

  const { language } = usePreferences();
  const { enrollments, markLessonComplete } = useLearner();

  const { tasks: allTasks } = useLearnerTasks();

  const t = lessonCopy[language];

  const course = courses.find((item) => String(item.id) === courseId);

  const enrollment = enrollments.find(
    (item) => String(item.courseId) === courseId,
  );

  if (!course || !enrollment) {
    return (
      <main className="learner-dashboard">
        <div className="container">
          <section className="learner-panel learner-courses-empty">
            <h1>{t.unavailable}</h1>

            <Link className="button" to="/learner/courses">
              {t.back}
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const details = getEnrollmentDetails(enrollment);

  const lessons = course.curriculum.flatMap((module) =>
    module.lessons.map((lesson) => ({
      ...lesson,
      moduleTitle: module.title,
    })),
  );

  if (lessons.length === 0) {
    return (
      <main className="learner-dashboard">
        <div className="container">
          <section className="learner-panel learner-courses-empty">
            <h1>{t.empty}</h1>

            <Link className="button" to="/learner/courses">
              {t.back}
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const requestedLessonId = params.get("lesson");

  const currentLesson =
    lessons.find((lesson) => lesson.id === requestedLessonId) ??
    details.nextLesson ??
    lessons[0];

  const currentIndex = lessons.findIndex(
    (lesson) => lesson.id === currentLesson.id,
  );

  const previousLesson = lessons[currentIndex - 1];
  const nextLesson = lessons[currentIndex + 1];

  const completedIds = new Set(enrollment.completedLessonIds);
  const isCompleted = completedIds.has(currentLesson.id);

  const tasks = allTasks.filter((task) => task.courseId === course.id);

  function selectLesson(lesson) {
    if (!lesson) return;

    setParams({ lesson: lesson.id });
  }

  function completeCurrentLesson() {
    // نثبّت الدرس الحالي في الرابط حتى لا يتغير تلقائيًا
    // بعد تحديث قائمة الدروس المكتملة.
    setParams({ lesson: currentLesson.id }, { replace: true });
    markLessonComplete(course.id, currentLesson.id);
  }

  return (
    <main className="learner-dashboard">
      <div className="container">
        <header className="lesson-page-heading">
          <div>
            <span className="section-kicker">{t.content}</span>
            <h1>{course.title[language]}</h1>
          </div>

          <Link
            className="button button-outline button-small"
            to="/learner/courses"
          >
            {t.back}
          </Link>
        </header>

        <p className="learner-demo-label">{t.demo}</p><ReportCourseButton course={course}/>
        {details.isComplete && tasks.every(task => task.status === "completed") && <section className="learner-panel"><h2>{language === "ar" ? "أكملت الدورة؛ ما الخطوة التالية؟" : "Course completed — what comes next?"}</h2><p>{language === "ar" ? "قيّم تجربتك واكتب ملاحظاتك لعرض اقتراحات لدورات مشابهة." : "Rate your experience and share feedback to see similar course suggestions."}</p><Link className="button" to="/learner/reviews">{language === "ar" ? "التقييم والاقتراحات" : "Review and suggestions"}</Link></section>}

        <div className="lesson-page-grid">
          <aside className="learner-panel lesson-curriculum">
            <h2>{t.content}</h2>

            <div className="learner-progress">
              <div className="learner-progress-label">
                <span>{t.progress}</span>
                <strong>{details.progress}%</strong>
              </div>

              <progress
                value={details.progress}
                max="100"
                aria-label={t.progress}
              >
                {details.progress}%
              </progress>
            </div>

            <p className="lesson-completed-count">
              {details.completedCount} / {lessons.length}
            </p>

            <div className="lesson-module-list">
              {course.curriculum.map((module) => (
                <section className="lesson-module" key={module.id}>
                  <h3>{module.title[language]}</h3>

                  <ul>
                    {module.lessons.map((lesson) => {
                      const selected = lesson.id === currentLesson.id;

                      const finished = completedIds.has(lesson.id);

                      return (
                        <li key={lesson.id}>
                          <button
                            className={
                              selected
                                ? "lesson-select-button selected"
                                : "lesson-select-button"
                            }
                            aria-current={selected ? "step" : undefined}
                            onClick={() => selectLesson(lesson)}
                          >
                            <span
                              className="lesson-status-icon"
                              aria-hidden="true"
                            >
                              {finished ? "✓" : "○"}
                            </span>

                            <span className="lesson-select-title">
                              {lesson.title[language]}

                              <small>
                                {lesson.minutes} {t.minutes}
                                {finished ? ` · ${t.completed}` : ""}
                              </small>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </aside>

          <div className="lesson-main-content">
            <section
              className="lesson-media"
              aria-label={currentLesson.title[language]}
            >
              {currentLesson.videoUrl ? (
                <video
                  key={currentLesson.id}
                  src={currentLesson.videoUrl}
                  poster={course.image}
                  controls
                  playsInline
                  preload="metadata"
                >
                  <a href={currentLesson.videoUrl}>
                    {currentLesson.title[language]}
                  </a>
                </video>
              ) : (
                <div className="lesson-video-placeholder">
                  <img src={course.image} alt="" />

                  <div>
                    <strong>{t.noVideo}</strong>
                    <p>{t.videoHint}</p>
                  </div>
                </div>
              )}
            </section>

            <section className="learner-panel lesson-description">
              <div className="lesson-meta">
                <span>
                  {t.lesson} {currentIndex + 1}
                </span>
                <span>
                  {currentLesson.minutes} {t.minutes}
                </span>
              </div>

              <h2>{currentLesson.title[language]}</h2>

              <h3>{t.about}</h3>

              <p>
                {currentLesson.description?.[language] ??
                  course.description[language]}
              </p>

              <div className="lesson-outcomes">
                <h3>{t.outcomes}</h3>

                <ul>
                  {course.outcomes[language].map((outcome) => (
                    <li key={outcome}>{outcome}</li>
                  ))}
                </ul>
              </div>

              <div className="lesson-actions">
                <button
                  className="button"
                  disabled={isCompleted}
                  onClick={completeCurrentLesson}
                >
                  {isCompleted ? `✓ ${t.completed}` : t.markComplete}
                </button>

                <div className="lesson-step-buttons">
                  <button
                    className="button button-outline button-small"
                    disabled={!previousLesson}
                    onClick={() => selectLesson(previousLesson)}
                  >
                    {t.previous}
                  </button>

                  <button
                    className="button button-outline button-small"
                    disabled={!nextLesson}
                    onClick={() => selectLesson(nextLesson)}
                  >
                    {t.next}
                  </button>
                </div>
              </div>
            </section>

            {tasks.length > 0 && (
              <section className="learner-panel">
                <div className="learner-section-heading">
                  <h2>{t.tasks}</h2>
                </div>

                <div className="learner-task-list">
                  {tasks.map((task) => (
                    <article className="learner-task" key={task.id}>
                      <div>
                        <h3>{task.title[language]}</h3>
                        <p>{task.description[language]}</p>
                      </div>

                      <Link
                        className="button button-outline button-small"
                        to={`/learner/tasks?task=${task.id}`}
                      >
                        {t.taskDetails}
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
