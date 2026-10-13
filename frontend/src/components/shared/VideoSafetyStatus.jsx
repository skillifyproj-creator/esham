import { usePreferences } from '../../context/PreferencesContext';
import { matchingScreening } from '../../services/videoSafetyPolicy';
export default function VideoSafetyStatus({ lessons = [] }) {
  const { language } = usePreferences(), t = (a, e) => language === 'ar' ? a : e;
  const videos = lessons.filter(lesson => lesson.video?.mediaId || lesson.videoUrl);
  const screened = videos.filter(lesson => matchingScreening(lesson.video));
  const flagged = screened.filter(lesson => matchingScreening(lesson.video).status === 'review');
  return <section className="learner-panel"><h2>{t('فحص الفيديو قبل النشر', 'Video screening before publication')}</h2><p>{t(`الفحص المحلي: ${screened.length} من ${videos.length} فيديو. فيديوهات تحتاج مراجعة: ${flagged.length}.`, `Local screening: ${screened.length} of ${videos.length} videos. Videos needing review: ${flagged.length}.`)}</p><p>{t('الفيديوهات القديمة والروابط الخارجية غير المفحوصة ليست معتمدة آليًا. فرض الفحص على جميع مسارات النشر والمراجعة البشرية يتطلب خدمة الخادم.', 'Older videos and unscanned external URLs are not automatically approved. Enforcing screening across all publishing paths and human review requires the server service.')}</p></section>;
}
