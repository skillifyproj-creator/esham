import { getOnboardingGoals } from '../i18n/onboardingCopy';

const suggestions = [
  { to: '/instructor/courses/new', ar: ['حوّل خبرتك إلى درس عملي', 'ابدأ بدورة تشرح مهارة محددة، وأضف مهمة تساعد المتعلّم على تطبيقها.', 'ابدأ إعداد دورة'], en: ['Turn your expertise into a practical lesson', 'Create a course around a specific skill and add a task learners can use to practise it.', 'Start a course'] },
  { to: '/instructor/courses/new', ar: ['ابدأ دورتك الأولى خطوة بخطوة', 'حدّد عنوان الدورة ومخرجات التعلّم، ثم رتّب أقسامها ودروسها.', 'أنشئ مسودة دورة'], en: ['Build your first course step by step', 'Define a course title and learning outcomes, then arrange its sections and lessons.', 'Create a course draft'] },
  { to: '/instructor/feedback', ar: ['طوّر شرحك من ملاحظات المتعلّمين', 'راجع التقييمات والملاحظات بعد نشر دورتك لتحديد ما يحتاج توضيحًا في الدروس.', 'راجع ملاحظات المتعلّمين'], en: ['Improve your teaching with learner feedback', 'After publishing, review ratings and comments to find lessons that need clearer explanations.', 'Review learner feedback'] },
  { to: '/instructor/profile', ar: ['عرّف المتعلّمين بخبرتك', 'أكمل نبذتك ومجالات خبرتك حتى يعرف المتعلّمون ما يمكنك مساعدتهم على إتقانه.', 'أكمل ملفك المهني'], en: ['Introduce learners to your expertise', 'Complete your bio and expertise areas so learners know what you can help them master.', 'Complete your profile'] },
];

export function getInstructorGoalGuidance(profile, language) {
  if (!['instructor', 'both'].includes(profile?.role) || !Number.isInteger(profile.goal) || profile.goal < 0 || profile.goal > 3) return null;
  // Combined-role goals keep their own meaning; do not interpret them as instructor-only indices.
  const index = profile.role === 'both' ? [0, 3, 1, 0][profile.goal] : profile.goal;
  const suggestion = suggestions[index];
  const [title, description, action] = suggestion[language === 'ar' ? 'ar' : 'en'];
  return { goal: getOnboardingGoals(language, profile.role).goals[profile.goal], title, description, action, to: suggestion.to };
}
