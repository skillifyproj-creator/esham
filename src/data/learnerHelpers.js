import { courses } from "./courses";

export function getEnrollmentDetails(enrollment) {
  const course = courses.find(
    (item) => item.id === enrollment.courseId,
  );

  if (!course) return null;

  const lessons = course.curriculum.flatMap(
    (module) => module.lessons,
  );

  const completedIds = new Set(enrollment.completedLessonIds);

  const completedCount = lessons.filter(
    (lesson) => completedIds.has(lesson.id),
  ).length;

  const progress =
    lessons.length > 0
      ? Math.round((completedCount / lessons.length) * 100)
      : 0;

  const nextLesson = lessons.find(
    (lesson) => !completedIds.has(lesson.id),
  );

  return {
    ...enrollment,
    course,
    completedCount,
    progress,
    nextLesson,
    isComplete:
      lessons.length > 0 && completedCount === lessons.length,
  };
}