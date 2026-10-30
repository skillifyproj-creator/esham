import { courseRequest } from './curriculumApi.js';
export const loadSubmissionEligibility = (courseId, signal) => courseRequest(`/courses/${courseId}/draft/submission-eligibility`, undefined, 'GET', signal);
export const eligibilityLabels = {
  'course-title': ['عنوان الدورة مكتمل', 'Course title is complete'], category: ['التصنيف فعّال', 'Category is active'],
  cover: ['صورة غلاف محفوظة للدورة', 'Saved course cover image'], description: ['وصف الدورة مكتمل', 'Course description is complete'],
  objectives: ['أهداف الدورة التعليمية محفوظة', 'Course learning objectives are saved'],
  'language-level': ['اللغة والمستوى محددان', 'Language and level are selected'], curriculum: ['الأقسام والدروس جاهزة', 'Sections and lessons are ready'],
  'task-count': ['من مهمة إلى ثلاث مهام للدورة', 'One to three course tasks'], 'task-readiness': ['جميع مهام الدورة مكتملة وجاهزة', 'All course tasks are complete and ready'],
  'editable-draft': ['المسودة الحالية قابلة للتحرير', 'Current draft is editable'],
};
