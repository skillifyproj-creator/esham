import { courses } from "./courses";

const photographyCourse = courses.find((course) => course.id === 6);

const taskTemplates = [
  {
    id: "task-6-1",
    title: {
      ar: "اختبار شامل: قياس مهارات التحكم اليدوي بالكاميرا",
      en: "Practical Task: Manual Camera Control",
    },
    description: {
      ar: "طبّق إعدادات الكاميرا اليدوية على مشهد تصوير بسيط.",
      en: "Apply manual camera settings to a simple photography scene.",
    },
    status: "ready",
  },
  {
    id: "task-6-2",
    title: {
      ar: "مهمة تطبيقية: التقاط 3 صور بتكوينات مختلفة",
      en: "Practical Task: Capture Three Different Compositions",
    },
    description: {
      ar: "التقط ثلاث صور باستخدام قواعد التكوين التي تم شرحها في القسم.",
      en: "Capture three photos using the composition principles covered in this section.",
    },
    status: "ready",
  },
  {
    id: "task-6-3",
    title: {
      ar: "مهمة تطبيقية: مشروع تصوير نهائي",
      en: "Practical Task: Final Photography Project",
    },
    description: {
      ar: "أنجز مجموعة صور متكاملة توضح استخدام الإضاءة والتكوين.",
      en: "Create a small photography set demonstrating lighting and composition.",
    },
    status: "needs-review",
  },
];

export const instructorCurriculumDemo = {
  course: photographyCourse,

  sections: photographyCourse.curriculum.map((section, index) => ({
    ...section,
    progress: index === 2 ? 75 : 100,
    task: taskTemplates[index],
  })),
};

export function saveInstructorCurriculumSections(sections) {
  instructorCurriculumDemo.sections = sections;
}

export function saveInstructorLesson(courseId, sectionId, lesson) {
  if (String(instructorCurriculumDemo.course.id) !== String(courseId)) {
    return false;
  }

  const section = instructorCurriculumDemo.sections.find(
    (item) => item.id === sectionId,
  );

  if (!section) return false;

  const lessonIndex = section.lessons.findIndex(
    (item) => item.id === lesson.id,
  );
  const lessons = [...section.lessons];

  if (lessonIndex === -1) {
    lessons.push(lesson);
  } else {
    lessons[lessonIndex] = lesson;
  }

  instructorCurriculumDemo.sections = instructorCurriculumDemo.sections.map(
    (item) => item.id === sectionId ? { ...item, lessons } : item,
  );

  return true;
}