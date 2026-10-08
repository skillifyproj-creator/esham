import { saveMedia, validateAttachments, formatBytes } from '../../services/mediaStore';
import { StoredFileLink } from '../../components/shared/StoredMedia';
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
    error: "أضف حلًا أو ملفًا أو رابطًا صالحًا. إذا تعذّر الحفظ تحقق من تخزين المتصفح.",
    saved: "تم الحفظ محليًا.",
    empty: "لا توجد مهام مطابقة.",
    demo:
      "تجربة فرونت: الحفظ على هذا المتصفح فقط، ولم يُرسل العمل إلى المدرّب. يمكن إرفاق ملفات محفوظة على هذا الجهاز، أو إضافة رابط عمل.",
    lesson: "الانتقال إلى الدورة",
    submitted:
      "التسليم محفوظ وبانتظار مراجعة المدرّب في هذه المعاينة المحلية.",
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
    error: "Add an answer, file or valid http:// or https:// URL. If saving fails, check browser storage.",
    saved: "Saved locally.",
    empty: "No matching tasks.",
    demo:
      "Frontend demo: saved only in this browser, not sent to an instructor. You can attach files saved on this device or add a work URL.",
    lesson: "Open course",
    submitted:
      "Submission saved, awaiting instructor review in this local preview.",
  },
};

function TaskEditor({ task, t, onClose }) {
  const { saveTask } = useLearnerTasks();
  const { language } = usePreferences();

  const [answer, setAnswer] = useState(task.answer ?? "");
  const [link, setLink] = useState(task.link ?? "");
  const [message, setMessage] = useState('');
  const [files,setFiles]=useState(task.files||[]),[uploading,setUploading]=useState(false);

  const locked = [
    "awaitingReview",
    "completed",
  ].includes(task.status);

  function save(submit) {
    if(uploading)return;
    const success = saveTask(
      task.id,
      answer,
      link,
      submit,
      files,
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

      {task.instructions && <p style={{whiteSpace:'pre-wrap'}}>{task.instructions.ar || task.instructions.en || task.instructions}</p>}
      {task.requirements?.length>0 && <ul>{task.requirements.map((item,index)=><li key={index}>{typeof item==='string'?item:item.ar||item.en}</li>)}</ul>}
      {task.resources?.length>0 && <ul>{task.resources.map(file=><li key={file.id}><StoredFileLink file={file}/></li>)}</ul>}
      <label>{t.link} · PDF / images / TXT / DOCX<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx" disabled={locked||uploading} onChange={async event=>{const selected=[...event.target.files];event.target.value='';setUploading(true);try{validateAttachments(selected,files.length);const stored=await Promise.all(selected.map(file=>saveMedia(file,{name:file.name})));setFiles(previous=>[...previous,...stored.map(file=>({...file,mediaId:file.id,size:formatBytes(file.sizeBytes)}))]);setMessage(t.saved);}catch{setMessage(t.error+' (5 files / 10MB)');}finally{setUploading(false);}}}/></label>
      {files.map(file=><p key={file.id}><StoredFileLink file={file}/>{!locked&&<button type="button" disabled={uploading} onClick={()=>setFiles(previous=>previous.filter(item=>item.id!==file.id))}>×</button>}</p>)}
      {uploading&&<p role="status">{language === 'ar' ? 'جاري حفظ الملفات…' : 'Saving files…'}</p>}
      {task.feedback&&<p>{task.feedback}</p>}
      {locked && <p>{t.submitted}</p>}

      <p role="status">{message}</p>

      {!locked && (
        <div className="task-editor-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={uploading}
            onClick={() => save(false)}
          >
            {t.draft}
          </button>

          <button className="button" type="submit" disabled={uploading}>
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