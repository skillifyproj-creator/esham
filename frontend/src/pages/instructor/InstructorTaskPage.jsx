import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { usePreferences } from '../../context/PreferencesContext';
import { localized } from '../../data/courseReadiness';
import { courseRequest, curriculumPath } from '../../services/curriculumApi';
import { loadTask, loadTasks, saveTask, deleteTask } from '../../services/courseTasksApi';
import '../../styles/instructor.css';

export default function InstructorTaskPage() {
  const { courseId, sectionId, taskId } = useParams();
  const [searchParams] = useSearchParams();
  const displaySectionId = sectionId || searchParams.get('displaySectionId') || '';
  const { language } = usePreferences();
  const [data, setData] = useState(null), [error, setError] = useState('');
  const back = `/instructor/courses/${courseId}/curriculum`;
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    Promise.all([
      courseRequest(`/courses/${courseId}`, undefined, 'GET', controller.signal),
      courseRequest(curriculumPath(courseId), undefined, 'GET', controller.signal),
      taskId ? loadTask(courseId, taskId, controller.signal) : Promise.resolve(null),
    ]).then(([course, sections, task]) => {
      if (!taskId && displaySectionId && !sections.some(x => x.id === displaySectionId)) throw new Error('Display section not found in this draft.');
      setData({ course, sections, task });
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [courseId, taskId, displaySectionId]);
  if (!data) return <main className="container section empty-state"><p role={error ? 'alert' : 'status'}>{error || (language === 'ar' ? 'جارٍ تحميل المهمة…' : 'Loading task…')}</p><Link to={back}>{language === 'ar' ? 'العودة إلى المنهج' : 'Back to curriculum'}</Link></main>;
  return <TaskEditor key={`${courseId}:${taskId || 'new'}:${displaySectionId}`} data={data} initialSectionId={displaySectionId} />;
}

function TaskEditor({ data, initialSectionId }) {
  const { language } = usePreferences(), { courseId, taskId } = useParams();
  const navigate = useNavigate(), lock = useRef(false);
  const t = (ar, en) => language === 'ar' ? ar : en;
  const existing = data.task;
  const [task, setTask] = useState(() => ({
    title: { ar: existing?.titleAr || '', en: existing?.titleEn || '' },
    description: { ar: existing?.descriptionAr || '', en: existing?.descriptionEn || '' },
    instructions: { ar: existing?.instructions?.ar || '', en: existing?.instructions?.en || '' },
    requirements: existing?.requirements || [],
    displaySectionId: existing?.displaySectionId || (existing ? '' : initialSectionId || ''),
    isReady: existing?.isReady || false,
  }));
  const [requirement, setRequirement] = useState(''), [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [preview, setPreview] = useState(false), [deleting, setDeleting] = useState(false);
  const back = `/instructor/courses/${courseId}/curriculum`;
  const text = field => task[field][language] || '';
  const readiness = [
    [t('عنوان المهمة واضح', 'A clear task title'), Boolean(localized(task.title, language).trim())],
    [t('وصف المهمة مكتمل', 'A complete task description'), Boolean(localized(task.description, language).trim())],
    [t('تعليمات التنفيذ موجودة', 'Step-by-step instructions'), Boolean(localized(task.instructions, language).trim())],
    [t('معيار تقييم واحد على الأقل', 'At least one assessment requirement'), task.requirements.length > 0],
  ];
  const percentage = Math.round(readiness.filter(([, done]) => done).length / 4 * 100);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function update(patch) { setTask(current => ({ ...current, ...patch })); setDirty(true); setError(''); }
  function updateText(field, value) { update({ [field]: { ...task[field], [language]: value } }); }
  async function save() {
    if (lock.current) return;
    if (!task.title.ar.trim() && !task.title.en.trim()) { setError(t('أدخل عنوان المهمة.', 'Enter a task title.')); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      // Append using the actual course-wide list; placement never determines task ownership/order.
      const tasks = taskId ? [] : await loadTasks(courseId);
      await saveTask(courseId, taskId, {
        titleAr: task.title.ar, titleEn: task.title.en,
        descriptionAr: task.description.ar, descriptionEn: task.description.en,
        instructions: task.instructions, requirements: task.requirements,
        displaySectionId: task.displaySectionId || null, isReady: task.isReady,
        sortOrder: existing?.sortOrder ?? tasks.reduce((max, x) => Math.max(max, x.sortOrder + 1), 0),
      });
      setDirty(false); navigate(back);
    } catch (cause) { setError(cause.message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await deleteTask(courseId, taskId); setDirty(false); navigate(back); }
    catch (cause) { setError(cause.message); setDeleting(false); }
    finally { lock.current = false; setBusy(false); }
  }
  function addRequirement() {
    const value = requirement.trim();
    if (!value || task.requirements.length >= 50) return;
    if (task.requirements.some(x => x[language]?.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setError(t('هذا المعيار موجود بالفعل.', 'This requirement is already included.')); return;
    }
    update({ requirements: [...task.requirements, { [language]: value }] }); setRequirement('');
  }
  return <section className="instructor-task-page instructor-detail-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <fieldset disabled={busy} className="container" style={{ border: 0, padding: 0 }}>
      <header className="instructor-task-header">
        <div><nav className="instructor-task-breadcrumb" aria-label={t('مسار التنقل', 'Breadcrumb')}><Link to="/instructor/courses">{t('دوراتي', 'My courses')}</Link><span>/</span><Link to={back}>{localized({ ar: data.course.draft?.titleAr, en: data.course.draft?.titleEn }, language)}</Link></nav>
          <h1>{existing ? t('تعديل المهمة التطبيقية', 'Edit practical task') : t('إنشاء مهمة للدورة', 'Create course task')}</h1>
          <p>{t('المهام تخص الدورة. يمكنك اختيار قسم لعرض المهمة فيه اختياريًا.', 'Tasks belong to the course. You can optionally choose a section for display.')}</p></div>
        <div className="instructor-task-header-actions"><Link className="instructor-button instructor-button-outline" to={back}>{t('العودة إلى المنهج', 'Back to curriculum')}</Link><button type="button" className="instructor-button instructor-button-outline" onClick={() => setPreview(true)}><Icon name="eye" size={16}/>{t('معاينة المهمة', 'Task preview')}</button><button type="button" className="instructor-button" onClick={save}>{t('حفظ المسودة', 'Save draft')}</button></div>
      </header>
      <p className="instructor-media-demo-note">{t('يمكن حفظ المسودة بأي عدد من المهام. يلزم من مهمة إلى ثلاث مهام تطبيقية مُقيّمة قبل طلب المراجعة.', 'Drafts may contain any number of tasks. One to three assessed practical tasks are required before review submission.')}</p>
      <div className="instructor-task-layout"><main className="instructor-task-main">
        <section className="instructor-task-context-card"><label><span>{t('القسم للعرض (اختياري)', 'Display section (optional)')}</span><select aria-label={t('القسم للعرض', 'Display section')} value={task.displaySectionId} onChange={event => update({ displaySectionId: event.target.value })}><option value="">{t('بدون قسم — مهمة للدورة', 'No section — course task')}</option>{data.sections.map(x => <option key={x.id} value={x.id}>{localized({ ar: x.titleAr, en: x.titleEn }, language)}</option>)}</select></label></section>
        <section className="instructor-task-card"><div className="instructor-task-card-heading"><h2>{t('البيانات الأساسية للمهمة', 'Task information')}</h2></div><div className="instructor-task-fields">
          <label><span>{t('عنوان المهمة', 'Task title')} *</span><input aria-label={t('عنوان المهمة', 'Task title')} value={text('title')} maxLength={200} onChange={event => updateText('title', event.target.value)}/></label>
          <label><span>{t('وصف المهمة والهدف التدريبي', 'Task description and learning outcome')}</span><textarea aria-label={t('وصف المهمة', 'Task description')} rows={4} value={text('description')} maxLength={10000} onChange={event => updateText('description', event.target.value)}/></label>
        </div></section>
        <section className="instructor-task-card"><h2>{t('تعليمات التنفيذ', 'Instructions')}</h2><p>{t('اشرح خطوات التنفيذ وصيغ التسليم المقبولة بوضوح.', 'Explain the steps and accepted submission formats clearly.')}</p><textarea aria-label={t('تعليمات المهمة', 'Task instructions')} className="instructor-task-instructions" value={text('instructions')} maxLength={10000} onChange={event => updateText('instructions', event.target.value)}/></section>
        <section className="instructor-task-card"><h2>{t('معايير التقييم', 'Assessment requirements')}</h2><div className="instructor-task-requirements">{task.requirements.map((item, index) => <div className="instructor-task-requirement" key={index}><span>{index + 1}</span><p>{localized(item, language)}</p><button type="button" aria-label={`${t('حذف المعيار', 'Remove requirement')}: ${localized(item, language)}`} onClick={() => update({ requirements: task.requirements.filter((_, i) => i !== index) })}><Icon name="trash" size={16}/></button></div>)}</div>
          <div className="instructor-task-add-requirement"><input value={requirement} maxLength={2000} aria-label={t('معيار جديد', 'New requirement')} onChange={event => setRequirement(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addRequirement(); } }}/><button type="button" onClick={addRequirement} disabled={!requirement.trim() || task.requirements.length >= 50}>{t('إضافة معيار', 'Add requirement')}</button></div>
        </section>
        <section className="instructor-task-card"><h2>{t('الموارد المساعدة', 'Supporting resources')}</h2><p>{t('إضافة المرفقات ستتوفر لاحقًا.', 'Attachment uploads will be available later.')}</p></section>
      </main><aside className="instructor-task-sidebar"><section className="instructor-task-card"><h2>{t('جاهزية المهمة', 'Task readiness')}</h2><strong>{percentage}%</strong>{readiness.map(([label, done]) => <p key={label}><Icon name={done ? 'check' : 'info'} size={15}/> {label}</p>)}<label><input type="checkbox" checked={task.isReady} onChange={event => update({ isReady: event.target.checked })}/>{t('المهمة جاهزة للتقييم', 'Task ready for assessment')}</label><button type="button" className="instructor-button" onClick={save}>{t('حفظ المهمة والعودة للمنهج', 'Save task and return to curriculum')}</button></section>
        {existing && <section className="instructor-task-card"><button type="button" className="instructor-button instructor-button-outline" onClick={() => setDeleting(true)}>{t('حذف المهمة', 'Delete task')}</button></section>}
      </aside></div>
      {error && <p className="account-error" role="alert">{error}</p>}{busy && <p role="status">{t('جارٍ الحفظ…', 'Saving…')}</p>}{dirty && <p role="status">{t('لديك تغييرات غير محفوظة.', 'You have unsaved changes.')}</p>}
    </fieldset>
    {preview && <Modal title={t('معاينة المهمة', 'Task preview')} onClose={() => setPreview(false)}><h3>{localized(task.title, language)}</h3><p>{localized(task.description, language)}</p><p style={{ whiteSpace: 'pre-wrap' }}>{localized(task.instructions, language)}</p><ul>{task.requirements.map((item, i) => <li key={i}>{localized(item, language)}</li>)}</ul></Modal>}
    {deleting && <Modal title={t('حذف المهمة', 'Delete task')} onClose={() => setDeleting(false)}><p>{t('ستحذف المهمة من مسودة الدورة. لن تتأثر الدروس.', 'Delete this task from the course draft? Lessons will remain unchanged.')}</p><div className="account-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setDeleting(false)}>{t('إلغاء', 'Cancel')}</button><button type="button" className="button" disabled={busy} onClick={remove}>{t('تأكيد الحذف', 'Confirm deletion')}</button></div></Modal>}
  </section>;
}
