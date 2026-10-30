import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { localized } from '../../data/courseReadiness';
import { loadTasks, deleteTask, reorderTasks, loadTaskReadiness } from '../../services/courseTasksApi';

export default function CourseTasksPanel({ courseId, sections, onChange }) {
  const { language } = usePreferences();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const [tasks, setTasks] = useState([]), [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  async function reload(signal) {
    const [items, result] = await Promise.all([loadTasks(courseId, signal), loadTaskReadiness(courseId, signal)]);
    if (signal?.aborted) return;
    setTasks(items); setReadiness(result); onChange(items);
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    reload(controller.signal).catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [courseId, onChange]);
  async function mutate(action) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); await reload(); } catch (cause) { setError(cause.message); }
    finally { lock.current = false; setBusy(false); }
  }
  function move(index, delta) {
    const ids = tasks.map(x => x.id), target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    mutate(() => reorderTasks(courseId, ids));
  }
  return <section className="curriculum-section-card course-tasks-panel" aria-label={t('مهام الدورة', 'Course tasks')}>
    <header className="curriculum-content-header"><div><h2>{t('مهام الدورة التطبيقية', 'Course practical tasks')}</h2><p>{t('المهام تخص الدورة؛ القسم اختياري للعرض فقط.', 'Tasks belong to the course; section placement is optional.')}</p></div><Link className="instructor-button" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }} to={`/instructor/courses/${courseId}/tasks/new`}>{t('إضافة مهمة للدورة', 'Add course task')}</Link></header>
    {loading && <p role="status">{t('جارٍ تحميل المهام…', 'Loading tasks…')}</p>}
    {error && <p role="alert">{error} <button type="button" disabled={busy} onClick={() => mutate(() => Promise.resolve())}>{t('إعادة المحاولة', 'Retry')}</button></p>}
    {!loading && !error && !tasks.length && <p>{t('لا توجد مهام بعد. يمكنك الاستمرار في تحرير المسودة.', 'No tasks yet. You can continue editing the draft.')}</p>}
    {!loading && readiness && <p role="status">{readiness.taskCount} {t('مهام — يلزم من 1 إلى 3 قبل طلب المراجعة.', 'tasks — 1 to 3 required before review submission.')} {readiness.meetsTaskCount ? t('عدد المهام مناسب.', 'Task count ready.') : t('راجع عدد المهام قبل طلب المراجعة.', 'Adjust the task count before review submission.')}</p>}
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
      {tasks.map((task, index) => <article className="curriculum-task-row" key={task.id} data-task-id={task.id}>
        <span>{index + 1}</span><div className="curriculum-lesson-info"><strong>{localized({ ar: task.titleAr, en: task.titleEn }, language)}</strong><small>{task.displaySectionId ? localized(sections.find(x => x.id === task.displaySectionId)?.title, language) : t('مهمة للدورة — بدون قسم', 'Course task — no section')}</small><span className="curriculum-task-status">{task.isReady ? t('جاهزة للتقييم', 'Ready for assessment') : t('مسودة', 'Draft')}</span></div>
        <button type="button" disabled={index === 0} aria-label={t('نقل المهمة لأعلى', 'Move task up')} onClick={() => move(index, -1)}>↑</button>
        <button type="button" disabled={index === tasks.length - 1} aria-label={t('نقل المهمة لأسفل', 'Move task down')} onClick={() => move(index, 1)}>↓</button>
        <Link className="curriculum-edit-button" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }} to={`/instructor/courses/${courseId}/tasks/${task.id}/edit`}>{t('تعديل المهمة', 'Edit task')}</Link>
        <button type="button" aria-label={t('حذف المهمة', 'Delete task')} onClick={() => { if (window.confirm(t('حذف المهمة من المسودة؟', 'Delete this draft task?'))) mutate(() => deleteTask(courseId, task.id)); }}>×</button>
      </article>)}
    </fieldset>
  </section>;
}
