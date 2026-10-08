import { saveMedia, validateAttachments, formatBytes } from '../../services/mediaStore';
import { StoredFileLink } from '../../components/shared/StoredMedia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { usePreferences } from '../../context/PreferencesContext';
import { getInstructorCourseWorkspace, localized, saveWorkspaceTask } from '../../data/instructorCourseWorkspace';
import '../../styles/instructor.css';

export default function InstructorTaskPage() {
  const { language } = usePreferences();
  const { courseId, sectionId, taskId } = useParams();
  const navigate = useNavigate();
  const ar = language === 'ar';
  const t = (arabic, english) => ar ? arabic : english;
  const workspace = getInstructorCourseWorkspace(courseId);
  const section = workspace?.sections.find(item => item.id === sectionId);
  const existing = taskId && section?.task?.id === taskId ? section.task : null;
  const initial = {
    title: localized(existing?.title, language),
    description: localized(existing?.description, language),
    instructions: localized(existing?.instructions, language),
    submissionType: existing?.submissionType || 'file',
    requirements: (existing?.requirements || []).map(value => localized(value, language)),
    resources: existing?.resources || [],
  };
  const [task, setTask] = useState(initial);
  const [requirement, setRequirement] = useState('');
  const [uploading,setUploading]=useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef(null);
  const back = `/instructor/courses/${courseId}/curriculum`;
  const readiness = useMemo(() => [
    [t('عنوان المهمة واضح', 'A clear task title'), task.title.trim().length >= 2],
    [t('وصف المهمة مكتمل', 'A complete task description'), task.description.trim().length >= 20],
    [t('تعليمات التنفيذ موجودة', 'Step-by-step instructions'), task.instructions.trim().length >= 20],
    [t('معيار تقييم واحد على الأقل', 'At least one assessment requirement'), task.requirements.length > 0],
  ], [task, language]);
  const percentage = Math.round(readiness.filter(([, done]) => done).length / readiness.length * 100);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function update(change) { setTask(value => ({ ...value, ...change })); setDirty(true); setStatus(''); setError(''); }
  function save(complete = false) {
    if(uploading)return;
    if (task.title.trim().length < 2) { setError(t('أدخل عنوانًا من حرفين على الأقل.', 'Enter a title of at least two characters.')); return; }
    if (complete && percentage < 100) { setError(t('أكمل الوصف والتعليمات ومعايير التقييم أولًا.', 'Complete the description, instructions and assessment requirements first.')); return; }
    const result = {
      ...existing, ...task, id: existing?.id || `task-${crypto.randomUUID()}`,
      title: { ...(typeof existing?.title === 'object' ? existing.title : {}), [language]: task.title.trim() },
      description: { ...(typeof existing?.description === 'object' ? existing.description : {}), [language]: task.description.trim() },
      instructions: { ...(typeof existing?.instructions === 'object' ? existing.instructions : {}), [language]: task.instructions.trim() },
      status: complete ? 'ready' : 'needs-review',
    };
    if (!saveWorkspaceTask(courseId, sectionId, result)) { setError(t('تعذّر الحفظ. تحقق من تخزين المتصفح والحد الأقصى ثلاث مهام للدورة.', 'Unable to save. Check browser storage and the three-task limit.')); return; }
    setDirty(false);
    setStatus(t('حُفظت المهمة في معاينة الدورة الحالية.', 'Task saved in the current course preview.'));
    if (complete) navigate(back);
  }
  function addRequirement() {
    const value = requirement.trim();
    if (!value) return;
    if (task.requirements.some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) { setError(t('هذا المعيار موجود بالفعل.', 'This requirement is already included.')); return; }
    update({ requirements: [...task.requirements, value] }); setRequirement('');
  }
  async function addFiles(event) {
    const files=[...event.target.files];event.target.value='';
    if(uploading)return;setUploading(true);
    try{validateAttachments(files,task.resources.length);const stored=await Promise.all(files.map(file=>saveMedia(file,{name:file.name})));update({resources:[...task.resources,...stored.map(file=>({...file,mediaId:file.id,size:formatBytes(file.sizeBytes)}))]});}
    catch{setError(t('تعذّر حفظ الملفات. حتى 5 ملفات و10MB لكل ملف؛ تحقق من تخزين المتصفح.','Unable to save files. Up to 5 files, 10MB each; check browser storage.'));}finally{setUploading(false);}
  }

  if (!workspace || !section || (taskId && !existing)) return <main className="container section empty-state"><h1>{t('لم يتم العثور على المهمة أو القسم', 'Task or section not found')}</h1><Link className="button" to={back}>{t('العودة إلى المنهج', 'Back to curriculum')}</Link></main>;
  const typeLabels = { file: t('ملف مستند', 'Document file'), text: t('نص كتابي', 'Written response'), image: t('صورة', 'Image') };
  return <section className="instructor-task-page instructor-detail-page" dir={ar ? 'rtl' : 'ltr'}><div className="container">
    <header className="instructor-task-header"><div><nav className="instructor-task-breadcrumb" aria-label={t('مسار التنقل', 'Breadcrumb')}><Link to="/instructor/courses">{t('دوراتي', 'My courses')}</Link><span>/</span><Link to={back}>{localized(workspace.course.title, language)}</Link><span>/</span><span>{localized(section.title, language)}</span></nav><h1>{existing ? t('تعديل المهمة التطبيقية', 'Edit practical task') : t('إنشاء مهمة للقسم', 'Create a section task')}</h1><p>{t('حدّد ما سيطبّقه المتعلّم، وكيف سيقدّمه، ومعايير تقييمه.', 'Define what learners will practice, how to submit it, and how it will be assessed.')}</p></div><div className="instructor-task-header-actions"><Link className="instructor-button instructor-button-outline" to={back}>{t('العودة إلى المنهج', 'Back to curriculum')}</Link><button type="button" className="instructor-button instructor-button-outline" onClick={() => setPreview(true)}><Icon name="eye" size={16}/>{t('معاينة الطالب', 'Learner preview')}</button><button type="button" className="instructor-button" onClick={() => save()}>{t('حفظ المسودة', 'Save draft')}</button></div></header>
    <p className="instructor-media-demo-note">{t('تُحفظ الدورات ومهامها في هذا المتصفح حتى بعد إغلاقه. الملفات محفوظة على هذا الجهاز، ولم تُرفع إلى خادم.', 'Courses and tasks are saved in this browser, including after closing it. Attachments are saved on this device, not uploaded to a server.')}</p>
    <p className="instructor-media-demo-note">{t('من مهمة إلى ثلاث مهام للدورة كاملة؛ التمارين الاختيارية لا تتطلب مراجعة المدرّب.', 'One to three assessed tasks per course; optional exercises do not require instructor review.')} {workspace.sections.filter(item => item.task).length}/3</p><div className="instructor-task-layout"><main className="instructor-task-main">
      <section className="instructor-task-context-card"><div><span>{t('القسم المرتبط بالمهمة', 'Task section')}</span><strong>{localized(section.title, language)}</strong></div><span>{section.lessons.length} {t('دروس', 'lessons')}</span></section>
      <section className="instructor-task-card"><div className="instructor-task-card-heading"><h2>{t('البيانات الأساسية للمهمة', 'Task information')}</h2></div><div className="instructor-task-fields"><label><span>{t('عنوان المهمة', 'Task title')} *</span><input value={task.title} maxLength={100} onChange={event => update({ title: event.target.value })}/></label><label><span>{t('وصف المهمة والهدف التدريبي', 'Task description and learning outcome')} *</span><textarea rows={4} value={task.description} maxLength={1000} onChange={event => update({ description: event.target.value })}/></label></div></section>
      <section className="instructor-task-card"><h2>{t('تعليمات التنفيذ', 'Instructions')}</h2><p>{t('اشرح خطوات التحضير والتنفيذ والتسليم بوضوح.', 'Explain preparation, execution and submission clearly.')}</p><label><span className="sr-only">{t('تعليمات المهمة', 'Task instructions')}</span><textarea className="instructor-task-instructions" value={task.instructions} maxLength={5000} onChange={event => update({ instructions: event.target.value })}/></label></section>
      <section className="instructor-task-card"><h2>{t('نوع التسليم', 'Submission type')}</h2><div className="instructor-submission-options">{Object.entries(typeLabels).map(([type, label]) => <button type="button" key={type} aria-pressed={task.submissionType === type} className={task.submissionType === type ? 'selected' : ''} onClick={() => update({ submissionType: type })}><Icon name={type === 'image' ? 'camera' : type === 'text' ? 'lesson' : 'save'} size={22}/><strong>{label}</strong></button>)}</div><p>{task.submissionType === 'image' ? t('الصور المقترحة: JPG، PNG، WEBP.', 'Suggested images: JPG, PNG, WEBP.') : task.submissionType === 'text' ? t('يقدّم المتعلّم إجابة مكتوبة وفق التعليمات.', 'Learners provide a written response following the instructions.') : t('حدّد الصيغ المقبولة في تعليمات المهمة، مثل PDF أو DOCX.', 'Specify accepted formats in the instructions, such as PDF or DOCX.')}</p></section>
      <section className="instructor-task-card"><h2>{t('معايير التقييم', 'Assessment requirements')}</h2><div className="instructor-task-requirements">{task.requirements.map((item, index) => <div className="instructor-task-requirement" key={`${index}-${item}`}><span>{index + 1}</span><p>{item}</p><button type="button" aria-label={`${t('حذف المعيار', 'Remove requirement')}: ${item}`} onClick={() => update({ requirements: task.requirements.filter((_, i) => i !== index) })}><Icon name="trash" size={16}/></button></div>)}</div><div className="instructor-task-add-requirement"><input value={requirement} maxLength={300} aria-label={t('معيار جديد', 'New requirement')} placeholder={t('أضف معيارًا واضحًا للتقييم', 'Add a clear assessment requirement')} onChange={event => setRequirement(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addRequirement(); } }}/><button type="button" onClick={addRequirement} disabled={!requirement.trim()}>{t('إضافة معيار', 'Add requirement')}</button></div></section>
      <section className="instructor-task-card"><h2>{t('الموارد المساعدة', 'Supporting resources')}</h2>{task.resources.map(resource => <div className="instructor-task-resource" key={resource.id}><Icon name="save" size={18}/><div><StoredFileLink file={resource}/><small>{resource.size}</small></div><button type="button" aria-label={`${t('إزالة المورد', 'Remove resource')}: ${resource.name}`} onClick={() => update({ resources: task.resources.filter(item => item.id !== resource.id) })}><Icon name="trash" size={16}/></button></div>)}<input type="file" hidden ref={fileInput} multiple disabled={uploading} accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx" onChange={addFiles}/><button type="button" className="instructor-button instructor-button-outline" onClick={() => fileInput.current.click()}>{t('إضافة ملفات للمعاينة', 'Add preview attachments')}</button></section>
    </main><aside className="instructor-task-sidebar"><section className="instructor-task-card"><h2>{t('جاهزية المهمة', 'Task readiness')}</h2><strong>{percentage}%</strong>{readiness.map(([label, done]) => <p key={label}><Icon name={done ? 'check' : 'info'} size={15}/> {label}</p>)}<button type="button" className="instructor-button" disabled={percentage !== 100} onClick={() => save(true)}>{t('حفظ المهمة والعودة للمنهج', 'Save task and return to curriculum')}</button></section>{existing && <section className="instructor-task-card"><button type="button" className="instructor-button instructor-button-outline" onClick={() => setDeleting(true)}>{t('حذف المهمة', 'Delete task')}</button></section>}</aside></div>
    {error && <p className="account-error" role="alert">{error}</p>}{status && <p className="account-status" role="status">{status}</p>}{dirty && <p role="status">{t('لديك تغييرات غير محفوظة.', 'You have unsaved changes.')}</p>}
    {preview && <Modal title={t('معاينة المهمة للمتعلّم', 'Learner task preview')} onClose={() => setPreview(false)}><h3>{task.title || t('عنوان المهمة', 'Task title')}</h3><p>{task.description}</p><p style={{whiteSpace:'pre-wrap'}}>{task.instructions}</p><ul>{task.requirements.map((item, i) => <li key={i}>{item}</li>)}</ul><p>{t('نوع التسليم', 'Submission type')}: {typeLabels[task.submissionType]}</p></Modal>}
    {deleting && <Modal title={t('حذف المهمة', 'Delete task')} onClose={() => setDeleting(false)}><p>{t('ستُزال المهمة من معاينة هذا القسم. الدروس ستبقى محفوظة.', 'The task will be removed from this section preview. Lessons will remain.')}</p><div className="account-actions"><button type="button" className="button secondary" onClick={() => setDeleting(false)}>{t('إلغاء', 'Cancel')}</button><button type="button" className="button" onClick={() => { if (saveWorkspaceTask(courseId, sectionId, null)) navigate(back); }}>{t('تأكيد الحذف', 'Confirm deletion')}</button></div></Modal>}
  </div></section>;
}
