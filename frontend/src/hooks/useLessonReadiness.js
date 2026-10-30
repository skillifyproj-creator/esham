import { useEffect, useState } from 'react';
import { previewLessonReadiness } from '../services/curriculumApi';

// The server evaluates both persisted metadata and unsaved previews with the same policy.
export default function useLessonReadiness(courseId, sectionId, lessonId, metadata, initialReadiness) {
  const key = JSON.stringify(metadata);
  const [result, setResult] = useState(() => ({ key, readiness: initialReadiness || null, error: '' }));
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      previewLessonReadiness(courseId, sectionId, lessonId === 'new' ? null : lessonId, JSON.parse(key), controller.signal)
        .then(readiness => { if (!controller.signal.aborted) setResult({ key, readiness, error: '' }); })
        .catch(error => { if (!controller.signal.aborted) setResult({ key, readiness: null, error: error.message }); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [courseId, sectionId, lessonId, key]);
  return result.key === key ? result : { readiness: null, error: '' };
}
