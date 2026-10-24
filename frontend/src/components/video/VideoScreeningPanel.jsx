import { useId } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import { matchingScreening } from '../../services/videoSafetyPolicy';
export default function VideoScreeningPanel({ video, running, progress, onScan, onCancel, onSeek, disabled }) {
  const { language } = usePreferences(), ar = language === 'ar', t = (a, e) => ar ? a : e;
  const checked = matchingScreening(video);
  const result = checked?.provider === 'gemini' ? checked : null;
  const hintId = useId();
  const hint = t('إذا عندك شك إن الفيديو غير ملائم، يمكنك فحصه بالذكاء الاصطناعي. يُرسل الفيديو والصوت المتاح إلى خدمة Google للتحليل؛ النتيجة إرشادية وقد تخطئ.', 'If you suspect your video is inappropriate, screen it with AI. Video and available audio are sent to Google for analysis; results are advisory and may be wrong.');
  const categories = {
    blood: t('إصابات أو مشاهد دموية محتملة', 'Possible bloody injuries or gore'),
    burn: t('حرق جسد أو إصابات حروق محتملة', 'Possible burning body or burn injuries'),
    'fire-risk': t('يد أو جسم قريب بشكل خطر من اللهب', 'Hand or body dangerously close to flames'),
    violence: t('عنف أو اعتداء محتمل', 'Possible violence or assault'),
    sexual: t('محتوى جنسي صريح محتمل', 'Possible explicit sexual content'),
  };
  return <section className="video-screening-panel" aria-label={t('فحص محتوى الفيديو', 'Video content screening')}>
    <div className="video-actions"><span className="video-screening-action">{running ? <button type="button" className="button button-outline" onClick={onCancel}>{t('إلغاء الفحص', 'Cancel scan')}</button> : <button type="button" className="button button-outline" disabled={disabled || !video?.mediaId} aria-describedby={hintId} onClick={onScan}>{result ? t('إعادة فحص الفيديو', 'Rescan video') : t('فحص الفيديو الآن', 'Screen video now')}</button>}<span id={hintId} role="tooltip" className="video-screening-hint">{hint}</span></span></div>
    <div role="status" aria-live="polite">
      {running ? <><p>{t('جارٍ فحص الفيديو بالذكاء الاصطناعي…', 'Reviewing video with AI…')}</p><progress max="100" value={progress?.percent ? progress.percent : undefined} aria-label={t('تقدم الفحص', 'Screening progress')}/></> : result ? <strong>{result.status === 'review' ? t('ظهرت إشارات تحتاج مراجعة؛ حفظ الفيديو للدرس متوقف.', 'Signals need review; saving to the lesson is paused.') : t('لم تُرصد إشارات في المراجعة؛ هذه ليست شهادة سلامة.', 'No signals reported in the review; this is not a safety certification.')}</strong> : null}
    </div>
    {result?.findings?.length > 0 && <><ul>{result.findings.map((finding, index) => <li key={index}><button type="button" className="text-button" onClick={() => onSeek(finding.time)}>{finding.time.toFixed(1)} {t('ثانية', 'seconds')}</button> · {finding.uncertain ? t('نتيجة غير واضحة', 'Uncertain result') : categories[finding.category] || t('يحتاج مراجعة', 'Needs review')} · {ar ? finding.reasonAr : finding.reasonEn}</li>)}</ul></>}
  </section>;
}
