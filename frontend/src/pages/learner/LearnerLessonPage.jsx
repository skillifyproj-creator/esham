import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { useAccountSession } from '../../context/AccountSessionContext';
import { useLearner } from '../../context/LearnerContext';
import { usePreferences } from '../../context/PreferencesContext';
import { loadLearning, loadLesson, protectedMediaUrl, learningMessage } from '../../services/learningApi';
import { saveLessonProgress } from '../../services/lessonProgressApi';
import ReportCourseButton from '../../components/learner/ReportCourseButton';
import '../../styles/community.css';
import '../../styles/learner.css';

export default function LearnerLessonPage() {
  const { enrollmentId, courseId } = useParams(), [params, setParams] = useSearchParams();
  const session = useAccountSession(), financial = useLearner(), { language } = usePreferences();
  const accountId = session.status === 'authenticated' ? session.session.profile.id : null;
  const legacy = courseId ? financial.enrollments.find(e => e.courseId === courseId)?.id : null;
  const id = enrollmentId || legacy, identity = `${accountId}:${id}`;
  const [state, setState] = useState(null), [lesson, setLesson] = useState(null), [error, setError] = useState(null), [revision, reload] = useState(0), [saving, setSaving] = useState(false);
  const generation = useRef(0), live = useRef(null), video = useRef(null), pending = useRef(null), queue = useRef(Promise.resolve()), timer = useRef(null), blocked = useRef(false), writeController = useRef(null);
  const t = (ar, en) => language === 'ar' ? ar : en;
  // Mask private state during render, before effect cleanup on account switches.
  const visible = state?.identity === identity ? state.course : null;
  const selected = params.get('lesson') || visible?.resumeLessonId;
  const current = lesson?.identity === identity && lesson.data.lessonId === selected
    && lesson.data.courseVersionId === visible?.availableCourseVersionId ? lesson.data : null;
  live.current = { accountId, id, selected, version: visible?.availableCourseVersionId, current };
  const fail = e => { blocked.current = true; setError(e); if (e.status === 401) session.refresh().catch(() => {}); };
  useEffect(() => {
    const controller = new AbortController(), g = ++generation.current;
    setState(null); setLesson(null); setError(null); blocked.current = false; pending.current = null; queue.current = Promise.resolve(); setSaving(false);
    if (accountId && id) loadLearning(accountId, id, controller.signal).then(course => {
      if (g === generation.current) setState({ identity, course });
    }).catch(e => { if (g === generation.current) fail(e); });
    return () => { generation.current++; controller.abort(); clearTimeout(timer.current); pending.current = null; };
  }, [accountId, id, revision]);
  useEffect(() => {
    if (!visible || !selected) return;
    const controller = new AbortController(), g = ++generation.current;
    setLesson(null); setError(null); blocked.current = false; clearTimeout(timer.current); pending.current = null; queue.current = Promise.resolve(); setSaving(false); writeController.current = controller;
    loadLesson(accountId, id, selected, visible.availableCourseVersionId, controller.signal).then(async data => {
      if (g !== generation.current) return;
      if (visible.progressWritesEnabled) data = { ...data, progress: await saveLessonProgress(accountId, id, selected,
        visible.availableCourseVersionId, data.progress.progressToken, 'open', 0, controller.signal) };
      if (g === generation.current) setLesson({ identity, data });
    }).catch(e => { if (g === generation.current) fail(e); });
    return () => { generation.current++; controller.abort(); clearTimeout(timer.current); pending.current = null; };
  }, [identity, selected, visible?.availableCourseVersionId, visible?.progressWritesEnabled]);
  function enqueue(kind, position = 0) {
    if (!current || !visible?.progressWritesEnabled || error || blocked.current) return Promise.resolve();
    const captured = live.current, g = generation.current;
    queue.current = queue.current.then(async () => {
      if (g !== generation.current || live.current.accountId !== captured.accountId || blocked.current) return;
      const latest = live.current.current; if (!latest) return;
      setSaving(true);
      const progress = await saveLessonProgress(captured.accountId, captured.id, captured.selected, captured.version, latest.progress.progressToken, kind, position, writeController.current?.signal);
      if (g !== generation.current || live.current.accountId !== captured.accountId) return;
      live.current.current = { ...latest, progress }; setLesson({ identity, data: live.current.current });
      if (kind === 'completion') {
        setState(previous => ({ ...previous, course: { ...previous.course, sections: previous.course.sections.map(s => ({ ...s,
          lessons: s.lessons.map(l => l.id === captured.selected ? { ...l, isCompleted: true } : l) })) } }));
        window.dispatchEvent(new Event('esham-learning-updated'));
      }
    }).catch(e => { if (g === generation.current) fail(e); }).finally(() => { if (g === generation.current) setSaving(false); });
    return queue.current;
  }
  function flushPosition() {
    clearTimeout(timer.current); timer.current = null;
    const position = pending.current; pending.current = null;
    return position == null ? Promise.resolve() : enqueue('progress', position);
  }
  function timeUpdate(event) {
    if (!current || current.contentType !== 'video' || !Number.isFinite(current.videoDurationSeconds) || current.videoDurationSeconds <= 0) return;
    pending.current = Math.min(event.currentTarget.currentTime, current.videoDurationSeconds);
    if (!timer.current) timer.current = setTimeout(flushPosition, 5000);
  }
  async function select(lessonId) { await flushPosition(); setParams({ lesson: lessonId }); }
  useEffect(() => {
    const element = video.current;
    return () => { if (element) { element.pause(); element.removeAttribute('src'); element.load(); } };
  }, [identity, current?.lessonId]);
  if (courseId && legacy) return <Navigate replace to={`/learner/enrollments/${legacy}/learn${params.size ? '?' + params.toString() : ''}`} />;
  if (!accountId) return <main className="container section"><h1>{t('محتوى التعلم', 'Learning content')}</h1><p>{t('سجّل الدخول للتعلّم.', 'Sign in to learn.')}</p></main>;
  if (!id || !visible) return <main className="container section">{error ? <p role="alert">{learningMessage(error, language)}</p> : <p role="status">{t('جارٍ تحميل المحتوى…', 'Loading learning content…')}</p>}<button className="button" onClick={() => reload(x => x + 1)}>{t('إعادة المحاولة', 'Retry')}</button></main>;
  const lessons = visible.sections.flatMap(s => s.lessons), index = lessons.findIndex(l => l.id === selected);
  const title = x => language === 'ar' ? x.titleAr || x.titleEn : x.titleEn || x.titleAr;
  return <main className="learner-dashboard"><div className="container">
    <header className="lesson-page-heading"><div><span className="section-kicker">{t('محتوى الدورة', 'Course content')}</span><h1>{title(visible)}</h1></div><Link className="button button-outline button-small" to={`/learner/enrollments/${id}`}>{t('تفاصيل التسجيل', 'Enrollment details')}</Link></header>
    <ReportCourseButton key={identity} course={{ id: visible.courseId, publishedVersionId: visible.availableCourseVersionId, title: { ar: visible.titleAr || visible.titleEn, en: visible.titleEn || visible.titleAr } }} />
    {!visible.progressWritesEnabled && <p role="status">{t('المحتوى متاح للقراءة؛ حفظ التقدم معطّل في هذه البيئة.', 'Content is available; progress saving is disabled in this environment.')}</p>}
    {error && <section className="learner-panel"><p role="alert">{learningMessage(error, language)}</p><button className="button" onClick={() => reload(x => x + 1)}>{t('تحديث المحتوى', 'Reload learning')}</button></section>}
    <div className="lesson-page-grid"><aside className="learner-panel lesson-curriculum"><h2>{t('دروس الدورة', 'Course lessons')}</h2><div className="lesson-module-list">{visible.sections.map(s => <section className="lesson-module" key={s.id}><h3>{title(s)}</h3><ul>{s.lessons.map(l => <li key={l.id}><button className={'lesson-select-button' + (l.id === selected ? ' selected' : '')} aria-current={l.id === selected ? 'step' : undefined} onClick={() => select(l.id)}><span className="lesson-status-icon">{l.isCompleted || current?.lessonId === l.id && current.progress.isCompleted ? '✓' : '○'}</span><span className="lesson-select-title">{title(l)}{l.isOptional && <small>{t('اختياري', 'Optional')}</small>}</span></button></li>)}</ul></section>)}</div></aside>
    <div className="lesson-main-content">{!current ? <p role="status">{t('جارٍ تحميل الدرس…', 'Loading lesson…')}</p> : <>
      {current.contentType === 'video' && <section className="lesson-media">{current.videoUrl ? <video key={`${identity}:${current.courseVersionId}:${current.lessonId}`} ref={video} controls crossOrigin="use-credentials" preload="metadata" src={protectedMediaUrl(current.videoUrl, id, current.lessonId)} onLoadedMetadata={e => { const p = current.progress.resumePositionSeconds; if (p != null && Number.isFinite(e.currentTarget.duration)) e.currentTarget.currentTime = Math.min(p, e.currentTarget.duration); }} onTimeUpdate={timeUpdate} onPause={flushPosition} onSeeked={e => { timeUpdate(e); flushPosition(); }} onEnded={flushPosition} onError={() => setError({ code: 'media_missing' })} /> : <div className="lesson-video-placeholder">{t('الفيديو غير متاح.', 'Video unavailable.')}</div>}</section>}
      <section className="learner-panel lesson-description"><div className="lesson-meta"><span>{t('الدرس', 'Lesson')} {index + 1} / {lessons.length}</span><span>{current.progress.isCompleted ? t('مكتمل', 'Completed') : t('قيد التعلم', 'In progress')}</span></div><h2>{title(current)}</h2><div className="lesson-reading" style={{ whiteSpace: 'pre-wrap' }}>{language === 'ar' ? current.descriptionAr || current.descriptionEn : current.descriptionEn || current.descriptionAr}</div>
      {!!current.attachments.length && <section><h3>{t('موارد الدرس', 'Lesson resources')}</h3><ul>{current.attachments.map(a => <li key={a.id}><a href={protectedMediaUrl(a.contentUrl, id, current.lessonId)}>{a.displayName}</a></li>)}</ul></section>}
      <p role="status">{saving ? t('جارٍ الحفظ…', 'Saving…') : t('إكمال الدرس تأكيد منك، ولا يُكمل الدورة تلقائيًا.', 'Marking a lesson complete is your acknowledgement and does not automatically complete the course.')}</p>
      {visible.versionState.tasks.map(task=><p key={task.taskId}><Link to={`/learner/enrollments/${id}/tasks/${task.taskId}`}>{language==='ar'?task.titleAr||task.titleEn:task.titleEn||task.titleAr}</Link> · {task.isApproved?t('معتمدة','Approved'):t('مهمة تطبيقية','Practical task')}</p>)}
      <button className="button" disabled={saving || !!error || !visible.progressWritesEnabled || current.progress.isCompleted} onClick={async () => { await flushPosition(); enqueue('completion'); }}>{current.progress.isCompleted ? t('الدرس مكتمل', 'Lesson completed') : t('تحديد الدرس كمكتمل', 'Mark lesson complete')}</button>
      <nav className="account-actions"><button className="button button-outline" disabled={index <= 0} onClick={() => select(lessons[index - 1].id)}>{t('السابق', 'Previous')}</button><button className="button button-outline" disabled={index < 0 || index >= lessons.length - 1} onClick={() => select(lessons[index + 1].id)}>{t('التالي', 'Next')}</button></nav></section>
    </>}</div></div></div></main>;
}
