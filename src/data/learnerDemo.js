import { courses } from "./courses";

function createEnrollment(courseId, completedCount, lastOpenedAt) {
  const course = courses.find((item) => item.id === courseId);

  const lessons =
    course?.curriculum.flatMap((module) => module.lessons) ?? [];

  return {
    courseId,
    completedLessonIds: lessons
      .slice(0, completedCount)
      .map((lesson) => lesson.id),
    lastOpenedAt,
  };
}

const programmingCourse = courses.find((course) => course.id === 1);

export const learnerDemo = {
  name: {
    ar: "أحمد",
    en: "Ahmed",
  },

  // رصيد تجريبي؛ لاحقًا يأتي من الباك.
  points: 50,

  enrollments: [
    createEnrollment(6, 4, "2026-10-01T10:00:00Z"),
    createEnrollment(2, 3, "2026-09-30T15:00:00Z"),
    createEnrollment(
      1,
      programmingCourse?.lessons ?? 0,
      "2026-09-29T12:00:00Z",
    ),
  ],

  tasks: [
    {
      id: "photography-light",
      courseId: 6,
      status: "inProgress",
      title: {
        ar: "التقط ثلاث صور بإضاءة مختلفة",
        en: "Take three photos with different lighting",
      },
      description: {
        ar: "جرّب الضوء الطبيعي والإضاءة الجانبية والخلفية، ثم اشرح الفرق بين النتائج.",
        en: "Try natural, side and back lighting, then explain how the results differ.",
      },
    },
    {
      id: "design-interface",
      courseId: 2,
      status: "notStarted",
      title: {
        ar: "صمّم واجهة بسيطة باستخدام Figma",
        en: "Design a simple interface with Figma",
      },
      description: {
        ar: "أنشئ واجهة تحتوي عنوانًا وبطاقة وزرًا، مع مراعاة المسافات وتناسق الألوان.",
        en: "Create an interface with a heading, a card and a button, using consistent spacing and colors.",
      },
    },
  ],
};