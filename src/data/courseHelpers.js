// Helpers format the same course record; they do not contain a second course list.
export function getCourseText(course, language) {
  return [course.title[language] ?? course.title.ar, course.description[language] ?? course.description.ar];
}
export function getCurriculum(course, language) {
  return course.curriculum.map(module => ({
    ...module,
    title: module.title[language] ?? module.title.ar,
    lessons: module.lessons.map(lesson => ({ ...lesson, title: lesson.title[language] ?? lesson.title.ar })),
  }));
}
