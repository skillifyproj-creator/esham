/**التقدّم العام = الدروس المكتملة ÷ جميع دروس الدورات المسجّلة. اعتماد المهام ورصيد النقاط يظهران بشكل منفصل */
import { Link } from "react-router";

import { useLearner } from "../../context/LearnerContext";
import { useLearnerTasks } from "../../context/LearnerTasksContext";
import { usePreferences } from "../../context/PreferencesContext";

import { getEnrollmentDetails } from "../../data/learnerHelpers";
import { learnerDemo } from "../../data/learnerDemo";
import { useLearnerWallet } from "../../hooks/useLearnerWallet";

const copy = {
  ar: {
    title: "تقدّم التعلّم",
    intro: "تابع الدروس التي أنجزتها وتقدّمك في كل وحدة.",
    overall: "تقدّمك العام في الدروس",
    basis:
      "النسبة محسوبة من الدروس المكتملة في جميع دوراتك المسجّلة.",
    active: "دورات قيد التعلّم",
    completed: "دورات مكتملة",
    approved: "مهام معتمدة",
    balance: "رصيد النقاط الحالي",
    pending: "بانتظار مراجعة المدرّب",
    activeTitle: "تفاصيل الدورات الجارية",
    completedTitle: "دورات مكتملة",
    continue: "متابعة التعلّم",
    review: "مراجعة الدورة",
    next: "الدرس التالي",
    modules: "تقدّم الوحدات",
    lessons: "دروس مكتملة",
    tasks: "مهام الدورة",
    none: "لا توجد دورات جارية.",
    noCompleted: "لم تُكمل دروس دورة بعد.",
    explore: "استكشف الدورات",
    updates: "آخر تحديثات التعلّم",
    courseUpdate: "تحديث تقدّم الدورة",
    taskUpdate: "تسليم تجريبي للمراجعة",
    noUpdates: "لا توجد تحديثات مسجّلة.",
    demo:
      "البيانات تخص الحساب التجريبي الحالي. إكمال الدروس منفصل عن اعتماد المهام ومنح الشهادات والنقاط.",
    notStarted: "لم تبدأ",
    inProgress: "قيد التنفيذ",
    awaitingReview: "بانتظار المراجعة",
    taskCompleted: "معتمدة",
    noTasks: "لا توجد مهام مضافة لهذه الدورة.",
  },

  en: {
    title: "Learning progress",
    intro: "Track completed lessons and progress in every module.",
    overall: "Overall lesson progress",
    basis:
      "Calculated from completed lessons across all enrolled courses.",
    active: "Courses in progress",
    completed: "Completed courses",
    approved: "Approved tasks",
    balance: "Current points balance",
    pending: "Awaiting instructor review",
    activeTitle: "Current course progress",
    completedTitle: "Completed courses",
    continue: "Continue learning",
    review: "Review course",
    next: "Next lesson",
    modules: "Module progress",
    lessons: "Completed lessons",
    tasks: "Course tasks",
    none: "No courses in progress.",
    noCompleted: "No course has all lessons complete yet.",
    explore: "Explore courses",
    updates: "Latest learning updates",
    courseUpdate: "Course progress update",
    taskUpdate: "Demo submission for review",
    noUpdates: "No recorded updates.",
    demo:
      "Current demo account data. Lesson completion is separate from task approval, certificates and points awards.",
    notStarted: "Not started",
    inProgress: "In progress",
    awaitingReview: "Awaiting review",
    taskCompleted: "Approved",
    noTasks: "No tasks have been added to this course.",
  },
};

function ProgressBar({ value, label }) {
  return (
    <div className="learner-progress">
      <div className="learner-progress-label">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>

      <progress
        value={value}
        max="100"
        aria-label={label}
      >
        {value}%
      </progress>
    </div>
  );
}

export default function LearnerProgressPage() {
  const { language } = usePreferences();
  const { enrollments } = useLearner();
  const { tasks } = useLearnerTasks();
  const { balance } = useLearnerWallet();
  const t = copy[language];

  const details = enrollments
    .map(getEnrollmentDetails)
    .filter(Boolean);

  const active = details.filter(
    (item) => !item.isComplete,
  );

  const complete = details.filter(
    (item) => item.isComplete,
  );

  const totalLessons = details.reduce(
    (sum, item) => sum + item.course.lessons,
    0,
  );

  const completedLessons = details.reduce(
    (sum, item) => sum + item.completedCount,
    0,
  );

  const overall = totalLessons
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  const stats = [
    [t.active, active.length],
    [t.completed, complete.length],
    [
      t.approved,
      tasks.filter((task) => task.status === "completed").length,
    ],
    [t.balance, balance],
  ];

  // نعرض آخر تحديث لكل دورة والتسليمات المسجّلة，
  // دون اختراع نشاط أو تقييم من المدرّب.
  const updates = [
    ...details.map((item) => ({
      id: `course-${item.courseId}`,
      label: t.courseUpdate,
      title: item.course.title[language],
      at: item.lastOpenedAt,
      to: `/learner/courses/${item.courseId}/learn`,
    })),

    ...tasks
      .filter((task) => task.submittedAt)
      .map((task) => ({
        id: `task-${task.id}`,
        label: t.taskUpdate,
        title: task.title[language],
        at: task.submittedAt,
        to: `/learner/tasks?task=${task.id}`,
      })),
  ]
    .filter((item) => Number.isFinite(Date.parse(item.at)))
    .sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at),
    )
    .slice(0, 5);

  const formatDate = (value) =>
    new Intl.DateTimeFormat(
      language === "ar" ? "ar" : "en",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    ).format(new Date(value));

  return (
    <main className="learner-dashboard">
      <div className="container">
        <header className="learner-welcome">
          <div>
            <span className="section-kicker">
              {t.title}
            </span>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </div>
        </header>

        <p className="learner-demo-label">{t.demo}</p>

        <section className="learner-panel progress-overview">
          <h2>{t.overall}</h2>
          <p>{t.basis}</p>

          <ProgressBar
            value={overall}
            label={`${t.lessons}: ${completedLessons} / ${totalLessons}`}
          />

          <div className="progress-stats">
            {stats.map(([label, value]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <p>
            {t.pending}:{" "}
            {
              tasks.filter(
                (task) => task.status === "awaitingReview",
              ).length
            }
          </p>
        </section>

        <div className="progress-layout">
          <section className="progress-course-list">
            <h2>{t.activeTitle}</h2>

            {active.map((item) => {
              const completedIds = new Set(
                item.completedLessonIds,
              );

              const courseTasks = tasks.filter(
                (task) => task.courseId === item.courseId,
              );

              return (
                <article
                  className="learner-panel progress-course"
                  key={item.courseId}
                >
                  <h3>{item.course.title[language]}</h3>

                  <p>
                    {t.lessons}: {item.completedCount} /{" "}
                    {item.course.lessons}
                  </p>

                  <ProgressBar
                    value={item.progress}
                    label={item.course.title[language]}
                  />

                  {item.nextLesson && (
                    <p>
                      <strong>{t.next}: </strong>
                      {item.nextLesson.title[language]}
                    </p>
                  )}

                  <details className="progress-modules">
                    <summary>{t.modules}</summary>

                    {item.course.curriculum.map((module) => {
                      const count = module.lessons.filter(
                        (lesson) => completedIds.has(lesson.id),
                      ).length;

                      const value = module.lessons.length
                        ? Math.round(
                            (count / module.lessons.length) * 100,
                          )
                        : 0;

                      return (
                        <div
                          className="progress-module"
                          key={module.id}
                        >
                          <ProgressBar
                            value={value}
                            label={module.title[language]}
                          />

                          <small>
                            {count} / {module.lessons.length}
                          </small>
                        </div>
                      );
                    })}
                  </details>

                  <div className="progress-course-tasks">
                    <h4>{t.tasks}</h4>

                    {courseTasks.length > 0 ? (
                      <ul>
                        {courseTasks.map((task) => (
                          <li key={task.id}>
                            <Link
                              to={`/learner/tasks?task=${task.id}`}
                            >
                              {task.title[language]}
                            </Link>

                            <span>
                              {task.status === "completed"
                                ? t.taskCompleted
                                : t[task.status]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>{t.noTasks}</p>
                    )}
                  </div>

                  <Link
                    className="button"
                    to={`/learner/courses/${item.courseId}/learn`}
                  >
                    {t.continue}
                  </Link>
                </article>
              );
            })}

            {active.length === 0 && (
              <div className="learner-panel">
                <p>{t.none}</p>

                <Link
                  className="button button-outline"
                  to="/courses"
                >
                  {t.explore}
                </Link>
              </div>
            )}
          </section>

          <aside className="progress-side">
            <section className="learner-panel">
              <h2>{t.completedTitle}</h2>

              {complete.map((item) => (
                <article
                  className="progress-completed"
                  key={item.courseId}
                >
                  <span className="learner-badge">100%</span>

                  <h3>{item.course.title[language]}</h3>

                  <p>
                    {item.completedCount} / {item.course.lessons}
                  </p>

                  <Link
                    className="button button-outline button-small"
                    to={`/learner/courses/${item.courseId}/learn`}
                  >
                    {t.review}
                  </Link><Link className="button button-outline button-small" to={"/learner/certificates/"+item.courseId}>{language === "ar" ? "الشهادة ومتطلباتها" : "Certificate requirements"}</Link>
                </article>
              ))}

              {complete.length === 0 && (
                <p>{t.noCompleted}</p>
              )}
            </section>

            <section className="learner-panel">
              <h2>{t.updates}</h2>

              <ul className="progress-updates">
                {updates.map((item) => (
                  <li key={item.id}>
                    <small>{item.label}</small>

                    <Link to={item.to}>
                      {item.title}
                    </Link>

                    <time dateTime={item.at}>
                      {formatDate(item.at)}
                    </time>
                  </li>
                ))}
              </ul>

              {updates.length === 0 && (
                <p>{t.noUpdates}</p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}