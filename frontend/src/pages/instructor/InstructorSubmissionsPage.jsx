import { useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import useInstructorInsights from '../../hooks/useInstructorInsights';
import { localizedInstructorText, reviewInstructorSubmission } from '../../services/instructorInsights';
import { apiBase } from '../../services/accountApi';

export default function InstructorSubmissionsPage() {
  const { language } = usePreferences(), t = (ar, en) => language === 'ar' ? ar : en;
  const [selected, setSelected] = useState(''), [feedback, setFeedback] = useState(''), [error, setError] = useState(''), [status, setStatus] = useState('awaitingReview');
  const [page, setPage] = useState(1), [revision, refresh] = useState(0), [saving, setSaving] = useState(false);
  const list = useInstructorInsights('submissions', { status, page, revision });
  const detail = useInstructorInsights(selected ? `submissions/${selected}` : null, { revision });
  const current = selected ? detail.data?.items?.[0] : null;
  async function decide(decision) {
    if (!current || saving) return;
    setSaving(true); setError('');
    try { await reviewInstructorSubmission(current.id, decision, feedback); setSelected(''); setFeedback(''); refresh(n => n + 1); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  function filter(value) { setStatus(value); setPage(1); setSelected(''); }
  return <main className="container section"><h1>{t('مراجعة تسليمات المتعلّمين', 'Review learner submissions')}</h1><p>{t('تسليمات دوراتك المحفوظة على الخادم. المراجعة لا تمنح نقاطًا ولا تغيّر إكمال الدورة.', 'Saved submissions for your courses. Review does not award points or change course completion.')}</p>
    <label>{t('الحالة', 'Status')} <select value={status} disabled={saving} onChange={event => filter(event.target.value)}><option value="">{t('الكل', 'All')}</option><option value="awaitingReview">{t('بانتظار المراجعة', 'Awaiting review')}</option><option value="approved">{t('معتمدة', 'Approved')}</option><option value="rejected">{t('تحتاج تعديلًا', 'Revision requested')}</option></select></label>
    {list.loading && <p role="status">{t('جارٍ التحميل…', 'Loading…')}</p>}{(error || list.error || (selected && detail.error)) && <p role="alert">{error || list.error || detail.error}</p>}
    <div className="community-grid"><section className="learner-panel">{list.data?.items?.length ? list.data.items.map(item => <button key={item.id} className="report-list-button" disabled={saving} onClick={() => { setSelected(item.id); setFeedback(''); setError(''); }}><strong>{language === 'ar' ? item.learnerName || item.learnerNameEn : item.learnerNameEn || item.learnerName}</strong><span>{localizedInstructorText(item, language)} · {item.attemptNumber}</span></button>) : !list.loading && !list.error && <p>{t('لا توجد تسليمات بهذه الحالة.', 'No submissions match this status.')}</p>}
      <div className="account-actions"><button disabled={page === 1 || list.loading || saving} onClick={() => { setPage(p => p - 1); setSelected(''); }}>{t('السابق', 'Previous')}</button><span>{page}</span><button disabled={list.loading || saving || page * 50 >= (list.data?.total || 0)} onClick={() => { setPage(p => p + 1); setSelected(''); }}>{t('التالي', 'Next')}</button></div></section>
      {selected && detail.loading && <p role="status">{t('جارٍ التحميل…', 'Loading…')}</p>}
      {current && <section className="learner-panel"><h2>{localizedInstructorText(current, language)}</h2><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{current.answerText}</p>{/^https?:\/\//i.test(current.workUrl || '') && <a href={current.workUrl} target="_blank" rel="noopener noreferrer">{t('فتح العمل', 'Open work')}</a>}<ul>{current.files?.map(file => <li key={file.id}><a href={`${apiBase}/api/instructor/submissions/${current.id}/attachments/${file.id}`} target="_blank" rel="noopener noreferrer">{file.name}</a></li>)}</ul>
      {current.reviews?.map((r, i) => <p key={i}>{r.decision}: {r.feedback}</p>)}
      {current.status === 'awaitingReview' && <><label>{t('ملاحظات المراجعة', 'Review feedback')}<textarea rows={4} value={feedback} maxLength={2000} onChange={event => setFeedback(event.target.value)} disabled={saving}/></label><div className="account-actions"><button className="button" disabled={saving} onClick={() => decide('approved')}>{t('اعتماد المهمة', 'Approve task')}</button><button className="button button-outline" disabled={saving || !feedback.trim()} onClick={() => decide('rejected')}>{t('طلب تعديل', 'Request revision')}</button></div></>}
      </section>}
    </div></main>;
}
