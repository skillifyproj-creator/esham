// أمثلة تجريبية؛ لاحقًا تأتي الإشعارات من الباك.
export const learnerNotifications = [
  {
    id: "demo-learning-1",
    category: "learning",
    courseId: 6,
    createdAt: "2026-10-03T15:00:00Z",
    read: false,
    title: {
      ar: "تابع دروس دورتك",
      en: "Continue your course lessons",
    },
    body: {
      ar: "ارجع إلى صفحة التعلّم لمتابعة تقدّمك.",
      en: "Return to the learning page to continue your progress.",
    },
  },
  {
    id: "demo-skills-1",
    category: "skills",
    createdAt: "2026-10-03T12:00:00Z",
    read: false,
    title: {
      ar: "راجع مسار تعلّمك",
      en: "Review your learning journey",
    },
    body: {
      ar: "اطّلع على الوحدات التي أنجزتها والمهارات التي تعمل عليها.",
      en: "Check completed modules and the skills you are working on.",
    },
  },
  {
    id: "demo-interaction-1",
    category: "interaction",
    createdAt: "2026-10-02T12:00:00Z",
    read: false,
    title: {
      ar: "شارك تجربتك في التعلّم",
      en: "Share your learning experience",
    },
    body: {
      ar: "يمكنك مراجعة الدورات المؤهلة للتقييم من صفحة المراجعات.",
      en: "Visit reviews to see courses eligible for rating.",
    },
  },
  {
    id: "demo-learning-2",
    category: "learning",
    courseId: 2,
    createdAt: "2026-10-01T12:00:00Z",
    read: true,
    action: "tasks",
    title: {
      ar: "تعرّف على مهام دورتك",
      en: "Explore your course tasks",
    },
    body: {
      ar: "راجع تفاصيل التطبيق العملي من صفحة المهام.",
      en: "Review practical assignment details on the tasks page.",
    },
  },
  {
    id: "demo-skills-2",
    category: "skills",
    createdAt: "2026-09-30T12:00:00Z",
    read: true,
    action: "courses",
    title: {
      ar: "خطوة جديدة في رحلتك",
      en: "Your next learning step",
    },
    body: {
      ar: "تابع دوراتك المسجّلة من مكان واحد.",
      en: "Keep track of enrolled courses in one place.",
    },
  },
];

export function notificationGroup(date, now = new Date()) {
  const target = new Date(date);

  if (!Number.isFinite(target.getTime())) {
    return "older";
  }

  // مقارنة أيام التقويم حسب توقيت المتصفح.
  const dayKey = (value) =>
    Date.UTC(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
    );

  const days = Math.round(
    (dayKey(now) - dayKey(target)) / 86400000,
  );

  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days >= 2 && days < 7) return "week";

  return "older";
}
