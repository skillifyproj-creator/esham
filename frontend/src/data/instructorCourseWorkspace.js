import { instructorDemo, saveInstructorCourse, refreshInstructorCourses } from './instructorDemo';
import { readSavedInstructorCourse } from './instructorCourseStorage';
import { instructorCurriculumDemo, saveInstructorCurriculumSections } from './instructorCurriculumDemo';
import { instructorPublicCourseIds } from './instructorCourseLinks';
import { readInstructorCourseDraft, saveInstructorCourseDraft } from './instructorCourseDraft';

export function getInstructorCourseWorkspace(id) {
  refreshInstructorCourses();
  if (id === 'new') {
    const draft = readInstructorCourseDraft();
    return draft ? { course: { ...draft, id: 'new' }, sections: draft.curriculum || [] } : null;
  }
  const selected = instructorDemo.courses.find(course => String(course.id) === String(id));
  const saved = readSavedInstructorCourse(id);
  if (selected && saved) Object.assign(selected, saved, { id: selected.id });
  if (selected) return {
    course: selected,
    sections: selected.curriculum || (Number(instructorPublicCourseIds[id]) === Number(instructorCurriculumDemo.course.id)
      ? instructorCurriculumDemo.sections : []),
  };
  if (String(id) === String(instructorCurriculumDemo.course.id)) return getInstructorCourseWorkspace('photography');
  return null;
}

export const MAX_COURSE_TASKS = 3;
export const countCourseTasks = sections => sections.filter(section => section.task).length;

export function saveWorkspaceSections(id, sections) {
  if (countCourseTasks(sections) > MAX_COURSE_TASKS) return false;
  const workspace = getInstructorCourseWorkspace(id);
  if (!workspace) return false;
  if (id === 'new') return saveInstructorCourseDraft({ curriculum: sections });
  const storageId = String(id) === String(instructorCurriculumDemo.course.id) ? 'photography' : id;
  if (!saveInstructorCourse(storageId, { curriculum: sections })) return false;
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

export { localized, lessonIsReady, taskIsReady } from './courseReadiness';
