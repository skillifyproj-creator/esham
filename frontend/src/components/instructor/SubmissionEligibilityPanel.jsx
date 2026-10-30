import { useEffect, useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import { eligibilityLabels, loadSubmissionEligibility } from '../../services/submissionEligibility';
import Icon from '../Icon';

export default function SubmissionEligibilityPanel({ courseId, value, refreshKey }) {
  const { language } = usePreferences(); const ar = language === 'ar';
  const [state, setState] = useState({ value: null, error: '' });
  useEffect(() => {
    if (value) return;
    const controller = new AbortController(); setState({ value: null, error: '' });
    loadSubmissionEligibility(courseId, controller.signal).then(data => { if (!controller.signal.aborted) setState({ value: data, error: '' }); })
      .catch(error => { if (!controller.signal.aborted) setState({ value: null, error: error.message }); });
    return () => controller.abort();
  }, [courseId, value, refreshKey]);
  const data = value || state.value;
  if (!data) return <div className="submission-eligibility" role={state.error ? 'alert' : 'status'}>{state.error || (ar ? 'جارٍ التحقق من أهلية الإرسال…' : 'Checking submission eligibility…')}</div>;
  return <div className="submission-eligibility">
    <strong>{ar ? 'أهلية الإرسال للمراجعة' : 'Submission eligibility'}</strong>
    <div className="instructor-readiness-list">{data.checks.map(check => <div key={check.code} data-eligibility-check={check.code} data-met={String(check.isMet)}>
      <Icon name={check.isMet ? 'check' : 'info'} size={16} /><span>{eligibilityLabels[check.code]?.[ar ? 0 : 1] || check.code}</span>
    </div>)}</div>
    <p>{data.readyTaskCount}/{data.taskCount} {ar ? 'مهام جاهزة' : 'tasks ready'}</p>
    {!data.submissionImplemented && <p role="status" data-submission-unavailable>{ar ? 'الإرسال الفعلي للمراجعة غير متاح بعد؛ لم يُنفّذ مسار الإرسال والمراجعة في الخادم.' : 'Actual submission is not available yet; the backend submission/review workflow is not implemented.'}</p>}
  </div>;
}
