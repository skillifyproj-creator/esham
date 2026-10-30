import { useEffect, useState } from 'react';
import useAccountProfile from './useAccountProfile';
import { courseRequest } from '../services/curriculumApi';
export default function useInstructorCourses() {
  const profile = useAccountProfile();
  const [state, setState] = useState({ courses: [], loading: true, error: null });
  useEffect(() => {
    const controller = new AbortController();
    setState({ courses: [], loading: true, error: null });
    if (!profile.id) return () => controller.abort();
    courseRequest('/courses/mine', undefined, 'GET', controller.signal)
      .then(items => { if (!controller.signal.aborted) setState({ courses: items.map(x => ({ ...x, id: x.courseId,
        title: { ar: x.titleAr || x.titleEn || '', en: x.titleEn || x.titleAr || '' } })), loading: false, error: null }); })
      .catch(error => { if (!controller.signal.aborted) setState({ courses: [], loading: false, error }); });
    return () => controller.abort();
  }, [profile.id]);
  return state;
}
