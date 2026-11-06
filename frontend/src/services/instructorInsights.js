import { courseRequest } from './curriculumApi.js';
export const instructorQuery = (path, values = {}) => `/instructor/${path}?${new URLSearchParams(Object.entries(values).filter(([,v]) => v !== undefined && v !== null && v !== ''))}`;
export const loadInstructorInsights = (path, values, signal) => courseRequest(instructorQuery(path, values), undefined, 'GET', signal);
export const reviewInstructorSubmission = (id, decision, feedback) => courseRequest(`/instructor/submissions/${encodeURIComponent(id)}/review`, { decision, feedback }, 'POST');
export const localizedInstructorText = (row, language, field = 'title') => row?.[`${field}${language === 'ar' ? 'Ar' : 'En'}`] || row?.[`${field}${language === 'ar' ? 'En' : 'Ar'}`] || '—';
