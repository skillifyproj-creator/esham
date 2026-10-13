import { useEffect, useState } from 'react';
import useStoredMedia from '../../hooks/useStoredMedia';
import { usePreferences } from '../../context/PreferencesContext';

export function StoredVideo({ mediaId, url, ...props }) {
  const media = useStoredMedia(mediaId, url);
  const { language } = usePreferences();
  const [playbackError, setPlaybackError] = useState(false);
  useEffect(() => setPlaybackError(false), [media.url]);
  if (media.loading) return <p role="status">{language === 'ar' ? 'جاري تحميل الفيديو…' : 'Loading video…'}</p>;
  if (media.error || !media.url) return <p role="status">{language === 'ar' ? 'ملف الفيديو غير متاح على هذا الجهاز.' : 'The video file is unavailable on this device.'}</p>;
  return <><video {...props} src={media.url} controls playsInline preload="metadata" onError={() => setPlaybackError(true)} />{playbackError && <p role="alert">{language === 'ar' ? 'تعذّر تشغيل هذا الملف.' : 'Unable to play this file.'}</p>}</>;
}
export function StoredFileLink({ file, children }) {
  const media = useStoredMedia(file.mediaId || file.id, file.url);
  const { language } = usePreferences();
  return media.url ? <a href={media.url} download={file.name}>{children || file.name}</a> : <span>{children || file.name} · {media.loading ? (language === 'ar' ? 'تحميل…' : 'Loading…') : (language === 'ar' ? 'الملف غير متاح' : 'File unavailable')}</span>;
}
