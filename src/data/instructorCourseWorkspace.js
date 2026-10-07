import { instructorDemo } from './instructorDemo';
import { instructorCurriculumDemo, saveInstructorCurriculumSections } from './instructorCurriculumDemo';
import { instructorPublicCourseIds } from './instructorCourseLinks';
import { readInstructorCourseDraft, saveInstructorCourseDraft } from './instructorCourseDraft';

export function getInstructorCourseWorkspace(id) {
  if (id === 'new') {
    const draft = readInstructorCourseDraft();
    return draft ? { course: { ...draft, id: 'new' }, sections: draft.curriculum || [] } : null;
  }
  const selected = instructorDemo.courses.find(course => String(course.id) === String(id));
  if (selected) return {
    course: selected,
    sections: Number(instructorPublicCourseIds[id]) === Number(instructorCurriculumDemo.course.id)
      ? instructorCurriculumDemo.sections : selected.curriculum || [],
  };
  if (String(id) === String(instructorCurriculumDemo.course.id)) return instructorCurriculumDemo;
  return null;
}

export const MAX_COURSE_TASKS = 3;
export const countCourseTasks = sections => sections.filter(section => section.task).length;

export function saveWorkspaceSections(id, sections) {
  if (countCourseTasks(sections) > MAX_COURSE_TASKS) return false;
  const workspace = getInstructorCourseWorkspace(id);
  if (!workspace) return false;
  if (id === 'new') return saveInstructorCourseDraft({ curriculum: sections });
  if (Number(instructorPublicCourseIds[id]) === Number(instructorCurriculumDemo.course.id)
    || String(id) === String(instructorCurriculumDemo.course.id)) saveInstructorCurriculumSections(sections);
  workspace.course.curriculum = sections;
  return true;
}

export function saveWorkspaceLesson(id, sectionId, lesson) {
  const workspace = getInstructorCourseWorkspace(id);
  const section = workspace?.sections.find(item => item.id === sectionId);
  if (!section) return false;
  const lessons = section.lessons.some(item => item.id === lesson.id)
    ? section.lessons.map(item => item.id === lesson.id ? lesson : item) : [...section.lessons, lesson];
  return saveWorkspaceSections(id, workspace.sections.map(item => item.id === sectionId ? { ...item, lessons } : item));
}

export function saveWorkspaceTask(id, sectionId, task) {
  const workspace = getInstructorCourseWorkspace(id);
  if (!workspace?.sections.some(item => item.id === sectionId)) return false;
  return saveWorkspaceSections(id, workspace.sections.map(item => item.id === sectionId ? { ...item, task } : item));
}

export function localized(value, language) {
  return typeof value === 'string' ? value : value?.[language] || value?.ar || value?.en || '';
}

export function lessonIsReady(lesson, language) {
  const reading = ['article', 'reading'].includes(lesson.contentType);
  return lesson.status !== 'draft' && localized(lesson.title, language).trim().length >= 2
    && (reading ? localized(lesson.description, language).trim().length >= 20 : Boolean(lesson.videoUrl || lesson.video?.name))
    && Array.isArray(lesson.objectives) && lesson.objectives.length > 0
    && Number(lesson.minutes) >= 1 && Number(lesson.minutes) <= 600;
}
export function taskIsReady(task, language) {
  return task?.status === 'ready' && localized(task.title, language).trim().length >= 2
    && localized(task.description, language).trim().length >= 20
    && localized(task.instructions, language).trim().length >= 20
    && Array.isArray(task.requirements) && task.requirements.length > 0;
}
