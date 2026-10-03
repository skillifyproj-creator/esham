/**الصفحة فيها بحث، فلترة حسب الدورة والحالة، تفاصيل المهمة، مسودة، وتسليم تجريبي. لملف مرفق حاليًا نستخدم رابط مشاركة؛ رفع الملف فعليًا يحتاج تخزينًا بالباك. */

import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { usePreferences } from "../../context/PreferencesContext";
import { useLearnerTasks } from "../../context/LearnerTasksContext";
import Modal from "../../components/Modal";

const copy = {
  ar: {
    title: "المهام التطبيقية",
    intro: "تابع مهام دوراتك وسلّم تطبيقك العملي.",
    all: "الكل",
    notStarted: "لم تبدأ",
    inProgress: "قيد التنفيذ",
    awaitingReview: "بانتظار المراجعة",
    completed: "مكتملة",
    search: "ابحث في المهام أو الدورات",
    courses: "كل الدورات",
    details: "عرض المهمة",
    answer: "الحل أو شرح التطبيق",
    link: "رابط العمل أو ملف مشترك",
    draft: "حفظ مسودة",
    submit: "حفظ كتسليم تجريبي",
    error: "أضيفي حلًا أو رابطًا صالحًا يبدأ بـ https:// أو http://.",
    saved: "تم الحفظ محليًا.",
    empty: "لا توجد مهام مطابقة.",
    demo:
      "تجربة فرونت: الحفظ على هذا المتصفح فقط، ولم يُرسل العمل إلى المدرّب. لملف مرفق، ضعي رابط مشاركة؛ رفع الملفات ومراجعتها يضافان مع الباك.",
    lesson: "الانتقال إلى الدورة",
    submitted:
      "تسليم تجريبي محفوظ، بانتظار ربط مراجعة المدرّب.",
  },

  en: {
    title: "Practical tasks",
    intro: "Track your course tasks and submit practical work.",
    all: "All",
    notStarted: "Not started",
    inProgress: "In progress",
    awaitingReview: "Awaiting review",
    completed: "Completed",
    search: "Search tasks or courses",
    courses: "All courses",
    details: "View task",
    answer: "Answer or explanation",
    link: "Work or shared file URL",
    draft: "Save draft",
    submit: "Save demo submission",
    error: "Add an answer or a valid http:// or https:// URL.",
    saved: "Saved locally.",
    empty: "No matching tasks.",
    demo:
      "Frontend demo: saved only in this browser, not sent to an instructor. Use a shared file URL; uploads and instructor review will be connected to the backend.",
    lesson: "Open course",
    submitted:
      "Demo submission saved; instructor review integration is pending.",
  },
};

function TaskEditor({ task, t, onClose }) {
  const { saveTask } = useLearnerTasks();

  const [answer, setAnswer] = useState(task.answer ?? "");
  const [link, setLink] = useState(task.link ?? "");
  const [message, setMessage] = useState("");

  const locked = [
    "awaitingReview",
    "completed",
  ].includes(task.status);

  function save(submit) {
    const success = saveTask(
      task.id,
      answer,
      link,
      submit,
    );

    if (!success) {
      setMessage(t.error);
      return;
    }

    if (submit) {
      onClose();
    } else {
      setMessage(t.saved);
    }
  }

  return (
    <form
      className="task-editor"
      onSubmit={(event) => {
        event.preventDefault();
        save(true);
      }}
    >
      <p>{t.demo}</p>

      <label>
        {t.answer}
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={locked}
          rows={6}
        />
      </label>

      <label>
        {t.link}
        <input
          type="url"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          disabled={locked}
          dir="ltr"
          placeholder="https://"
        />
      </label>

      {locked && <p>{t.submitted}</p>}

      <p role="status">{message}</p>

      {!locked && (
        <div className="task-editor-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={() => save(false)}
          >
            {t.draft}
          </button>

          <button className="button" type="submit">
            {t.submit}
          </button>
        </div>
      )}
    </form>
  );
}

export default function LearnerTasksPage() {
  const { language } = usePreferences();
  const { tasks } = useLearnerTasks();
  const t = copy[language];

  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [courseId, setCourseId] = useState(
    () => params.get("course") ?? "",
  );
  const [filter, setFilter] = useState("all");

  const statuses = [
    "all",
    "notStarted",
    "inProgress",
    "awaitingReview",
    "completed",
  ];

  const selected = tasks.find(
    (task) => task.id === params.get("task"),
  );

  const courseOptions = [
    ...new Map(
      tasks.map((task) => [
        task.course.id,
        task.course,
      ]),
    ).values(),
  ];

  const visible = tasks.filter((task) => {
    const searchable =
      `${task.title[language]} ${task.course.title[language]}`
        .toLocaleLowerCase();

    return (
      (filter === "all" || task.status === filter) &&
      (!courseId || String(task.courseId) === courseId) &&
      searchable.includes(
        query.trim().toLocaleLowerCase(),
      )
    );
  });

  function select(id) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);

      if (id) {
        next.set("task", id);
      } else {
        next.delete("task");
      }

      return next;
    });
  }

  return (
    <main className="learner-dashboard">
      <div className="container">
        <header className="learner-welcome">
          <div>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </div>
        </header>

        <p className="learner-demo-label">{t.demo}</p>

        <section
          className="learner-summary"
          aria-label={t.title}
        >
          {[
            "inProgress",
            "awaitingReview",
            "completed",
          ].map((status) => (
            <article
              className="learner-panel learner-stat"
              key={status}
            >
              <strong>
                {tasks.filter(
                  (task) => task.status === status,
                ).length}
              </strong>
              <span>{t[status]}</span>
            </article>
          ))}
        </section>

        <div className="learner-course-filters">
          {statuses.map((status) => (
            <button
              key={status}
              className={
                `learner-course-filter${
                  filter === status ? " active" : ""
                }`
              }
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
            >
              {t[status]}

              <span>
                {status === "all"
                  ? tasks.length
                  : tasks.filter(
                      (task) => task.status === status,
                    ).length}
              </span>
            </button>
          ))}
        </div>

        <div className="tasks-toolbar">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search}
            aria-label={t.search}
          />

          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            aria-label={t.courses}
          >
            <option value="">{t.courses}</option>

            {courseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title[language]}
              </option>
            ))}
          </select>
        </div>

        <section
          className="tasks-list"
          aria-live="polite"
        >
          {visible.map((task) => (
            <article
              className="learner-panel task-list-card"
              key={task.id}
            >
              <div>
                <span className={`task-state ${task.status}`}>
                  {t[task.status]}
                </span>

                <p>{task.course.title[language]}</p>
                <h2>{task.title[language]}</h2>
                <p>{task.description[language]}</p>

                <Link
                  to={`/learner/courses/${task.courseId}/learn`}
                >
                  {t.lesson}
                </Link>
              </div>

              <button
                className="button button-outline"
                onClick={() => select(task.id)}
              >
                {t.details}
              </button>
            </article>
          ))}

          {!visible.length && (
            <p className="learner-panel">{t.empty}</p>
          )}
        </section>
      </div>

      {selected && (
        <Modal
          title={selected.title[language]}
          onClose={() => select(null)}
        >
          <TaskEditor
            key={selected.id}
            task={selected}
            t={t}
            onClose={() => select(null)}
          />
        </Modal>
      )}
    </main>
  );
}