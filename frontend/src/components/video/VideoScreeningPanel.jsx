import { useId } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import { matchingScreening } from '../../services/videoSafetyPolicy';
export default function VideoScreeningPanel({ video, running, progress, onScan, onCancel, onSeek, disabled }) {
  const { language } = usePreferences(), ar = language === 'ar', t = (a, e) => ar ? a : e;
  const result = matchingScreening(video);
  const hintId = useId();
  const hint = t('إذا عندك شك إن الفيديو الخاص فيك غير ملائم، يمكنك فحصه هنا. الفحص للصور فقط وقد يخطئ.', 'If you suspect your video may be inappropriate, you can screen it here. This visual-only check may be wrong.');
  const categories = {
    blood: t('إصابات أو مشاهد دموية محتملة', 'Possible bloody injuries or gore'),
    burn: t('حرق جسد أو إصابات حروق محتملة', 'Possible burning body or burn injuries'),
    'fire-risk': t('يد أو جسم قريب بشكل خطر من اللهب', 'Hand or body dangerously close to flames'),
    violence: t('عنف أو اعتداء محتمل', 'Possible violence or assault'),
    sexual: t('محتوى جنسي صريح محتمل', 'Possible explicit sexual content'),
  };
  return <section className="video-screening-panel" aria-label={t('فحص المحتوى المحلي', 'Local content screening')}>
    <div className="video-actions"><span className="video-screening-action">{running ? <button type="button" className="button button-outline" onClick={onCancel}>{t('إلغاء الفحص', 'Cancel scan')}</button> : <button type="button" className="button button-outline" disabled={disabled || !video?.mediaId} aria-describedby={hintId} onClick={onScan}>{result ? t('إعادة فحص الفيديو', 'Rescan video') : t('فحص الفيديو الآن', 'Screen video now')}</button>}<span id={hintId} role="tooltip" className="video-screening-hint">{hint}</span></span></div>
    <div role="status" aria-live="polite">
      {running ? <><p>{progress?.phase === 'loading' ? t('جارٍ تحميل وتجهيز النموذج…', 'Loading and preparing model…') : t(`جارٍ فحص اللقطات ${progress?.completed || 0} / ${progress?.total || 0}`, `Screening frames ${progress?.completed || 0} / ${progress?.total || 0}`)}</p><progress max="100" value={progress?.percent || 0} aria-label={t('تقدم الفحص', 'Screening progress')}/></> : result ? <>
        <strong>{result.status === 'review' ? t('ظهرت إشارات تحتاج مراجعة؛ حفظ الفيديو للدرس متوقف.', 'Signals need review; saving to the lesson is paused.') : t('لم تظهر إشارات في اللقطات المفحوصة؛ هذه ليست شهادة سلامة.', 'No signals in sampled frames; this is not a safety certification.')}</strong>
        <p>{t(`فُحصت ${result.sampledFrames} لقطة، بفاصل يقارب ${result.intervalSeconds.toFixed(1)} ثانية.`, `${result.sampledFrames} frames sampled, about ${result.intervalSeconds.toFixed(1)} seconds apart.`)}</p>
      </> : null}
    </div>
    {result?.findings?.length > 0 && <><ul>{result.findings.map((finding, index) => <li key={index}><button type="button" className="text-button" onClick={() => onSeek(finding.time)}>{finding.time.toFixed(1)} {t('ثانية', 'seconds')}</button> · {finding.uncertain ? t('نتيجة غير واضحة', 'Uncertain result') : categories[finding.category] || t('يحتاج مراجعة', 'Needs review')} · {t('درجة تشابه نسبية', 'Relative similarity')} {Math.round(finding.similarity * 100)}% {t('(ليست احتمال مخالفة)', '(not a violation probability)')}</li>)}</ul></>}
  </section>;
}
