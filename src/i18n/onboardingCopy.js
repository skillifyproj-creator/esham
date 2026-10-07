import { categories as platformCategories } from '../data/categories';
export const onboardingCopy = {
 ar: {
  steps: ['تحديد الدور', 'الملف الشخصي', 'اهتماماتك', 'أهدافك'], label: 'لنبدأ رحلتك', title: 'كيف تريد أن تُسهم؟', intro: 'تعلّم مهارة جديدة، شارك خبرتك، أو اجمع بين الاثنين. اختر المسار الأقرب لك، ويمكنك تغييره لاحقًا.',
  roles: [
   { id: 'learner', title: 'أتعلّم', description: 'اكتشف دورات عملية، وطوّر مهاراتك خطوة بخطوة، وطبّق ما تتعلّمه في مهام تترك أثرًا.', benefit: 'دورات ومهام ومسار تعلّم خاص بك', tag: 'مسارك لاكتشاف مهارات جديدة' },
   { id: 'instructor', title: 'أعلّم', description: 'شارك معرفتك وخبرتك، أنشئ دورات تفاعلية، وساعد الآخرين على تحويل ما يعرفونه إلى مهارات.', benefit: 'أدوات لإنشاء الدورات ومتابعة المتعلّمين', tag: 'خبرتك تستحق المشاركة' },
   { id: 'both', title: 'أتعلّم وأعلّم', description: 'تعلّم من خبرات الآخرين، وشارك ما تتقنه. اجمع بين اكتساب المعرفة وإثراء مجتمع إسهام.', benefit: 'تجربة تجمع التعلّم ومشاركة الخبرة', tag: 'مساحة أكبر للتعلّم والإسهام' },
  ], recommended: 'الخيار الأكثر مرونة', selected: 'تم اختيار هذا المسار', select: 'اختيار هذا المسار', note: 'اختيارك يساعدنا على تخصيص تجربتك. يمكنك الجمع بين التعلّم والتعليم دون فقدان تقدّمك.', next: 'التالي', back: 'السابق', exit: 'العودة للرئيسية', help: 'مساعدة في اختيار المسار', helpTitle: 'أي مسار يناسبك؟', helpText: 'اختر «أتعلّم» لاستكشاف الدورات، أو «أعلّم» لمشاركة خبرتك. إذا كنت ترغب بالأمرين فاختر «أتعلّم وأعلّم». هذا الاختيار يخصّص الواجهة ولا يمنح صلاحيات مدرّب فعلية.', close: 'إغلاق', roleError: 'اختر المسار الذي يناسبك للمتابعة.',
  profileTitle: 'لنتعرّف عليك أكثر', profileIntro: 'أضف اسمك ونبذة بسيطة تعكس خبرتك واهتماماتك.', name: 'الاسم الذي سيظهر في ملفك', bio: 'نبذة عنك', optional: 'اختياري', nameError: 'أدخل اسمًا من حرفين على الأقل.', namePlaceholder: 'كيف تحب أن نناديك؟', bioPlaceholder: 'ما الذي تحب تعلّمه أو مشاركته؟',
  interestsTitle: 'ما الذي يثير اهتمامك؟', interestsIntro: 'اختر مجالًا أو أكثر لتكون بداية رحلتك أقرب إلى اهتماماتك.', categories: platformCategories.map(category => category.title.ar), interestError: 'اختر مجالًا واحدًا على الأقل.',
  goalsTitle: 'ما الذي تتطلع إليه؟', goalsIntro: 'اختر هدفك الأساسي. كل خطوة صغيرة تقرّبك من الأثر الذي تريد صنعه.', goals: ['تعلّم مهارة جديدة', 'تطوير مساري المهني', 'مشاركة خبرتي مع الآخرين', 'التعلّم والمساهمة في المجتمع'], goalError: 'اختر هدفًا للمتابعة.', finish: 'إكمال الإعداد', completeTitle: 'أصبحت ملامح رحلتك جاهزة', completeText: 'تم حفظ تفضيلات هذه التجربة في الجلسة الحالية. إنشاء الحساب وتفعيل صلاحياته يُستكملان عند ربط خدمة الحسابات.', learner: 'استكشاف واجهة المتعلّم', instructor: 'استكشاف واجهة المدرّب', change: 'تعديل اختياراتي', demo: 'إعداد التجربة · لا يُنشئ حسابًا فعليًا', footer: 'إسهام · معرفة نشاركها، وأثر نصنعه.', progress: 'خطوات إعداد التجربة', light: 'الوضع الفاتح', dark: 'الوضع الداكن',
 },
 en: {
  steps: ['Your role', 'Your profile', 'Interests', 'Goals'], label: 'Start your journey', title: 'How would you like to contribute?', intro: 'Learn a new skill, share your experience, or do both. Choose the path that feels right for you; you can change it later.',
  roles: [
   { id: 'learner', title: 'I want to learn', description: 'Discover practical courses, build your skills step by step, and put your knowledge into practice through meaningful tasks.', benefit: 'Courses, tasks, and your own learning path', tag: 'Discover your next skill' },
   { id: 'instructor', title: 'I want to teach', description: 'Share your knowledge and experience, create interactive courses, and help others turn understanding into practical skills.', benefit: 'Tools to create courses and support learners', tag: 'Your experience is worth sharing' },
   { id: 'both', title: 'Learn and teach', description: 'Learn from others and share what you know. Combine gaining knowledge with contributing to the Esham community.', benefit: 'A journey of learning and sharing expertise', tag: 'More room to learn and contribute' },
  ], recommended: 'The most flexible choice', selected: 'This path is selected', select: 'Choose this path', note: 'Your choice helps personalize your experience. Combine learning and teaching while keeping your progress.', next: 'Next', back: 'Back', exit: 'Back to home', help: 'Help choosing a path', helpTitle: 'Which path is right for you?', helpText: 'Choose learning to discover courses, teaching to share expertise, or both to combine them. This personalizes the interface and does not grant actual instructor permissions.', close: 'Close', roleError: 'Choose a path to continue.',
  profileTitle: 'Tell us a little about yourself', profileIntro: 'Add your name and a short introduction that reflects your interests and experience.', name: 'Your display name', bio: 'About you', optional: 'Optional', nameError: 'Enter a name with at least two characters.', namePlaceholder: 'What should we call you?', bioPlaceholder: 'What would you like to learn or share?',
  interestsTitle: 'What interests you?', interestsIntro: 'Choose one or more areas to make your journey feel more personal.', categories: platformCategories.map(category => category.title.en), interestError: 'Choose at least one interest.',
  goalsTitle: 'What are you aiming for?', goalsIntro: 'Choose your main goal. Every small step brings you closer to the difference you want to make.', goals: ['Learn a new skill', 'Develop my career', 'Share my experience', 'Learn and contribute to the community'], goalError: 'Choose a goal to continue.', finish: 'Complete setup', completeTitle: 'Your journey is taking shape', completeText: 'Your preferences are saved for this browser session. Account creation and permission activation require the account service connection.', learner: 'Explore the learner interface', instructor: 'Explore the instructor interface', change: 'Edit my choices', demo: 'Experience setup · does not create an account', footer: 'Esham · Knowledge we share. A difference we make.', progress: 'Experience setup steps', light: 'Light mode', dark: 'Dark mode',
 },
};

export function getOnboardingGoals(language, role) {
 const copy = {
  ar: {
   learner: { title: 'ما الذي ترغب بتحقيقه من التعلّم؟', intro: 'اختر هدفك الأساسي لنساعدك على بناء رحلة تعلّم مناسبة لك.', goals: ['تعلّم مهارة جديدة', 'تطوير مهاراتي للعمل', 'تطبيق ما أتعلّمه في مشروع', 'استكشاف مجالات جديدة'] },
   instructor: { title: 'ما الذي ترغب بتحقيقه كمعلّم؟', intro: 'اختر هدفك الأساسي من التدريس ومشاركة خبرتك مع مجتمع إسهام.', goals: ['مشاركة خبرتي ومساعدة الآخرين', 'إنشاء أول دورة أو ورشة عمل', 'تطوير مهاراتي في الشرح والتدريس', 'بناء حضور مهني كمعلّم'] },
   both: { title: 'ما هدفك من التعلّم والتعليم؟', intro: 'اختر الهدف الأقرب لك في رحلة تجمع اكتساب المهارات ومشاركة الخبرة.', goals: ['تعلّم مهارات جديدة ومشاركة خبرتي', 'تطوير مساري المهني من خلال التعلّم والتدريس', 'تطبيق ما أتعلّمه وتقديم ورش عملية', 'تبادل المعرفة والمساهمة في المجتمع'] },
  },
  en: {
   learner: { title: 'What would you like to achieve through learning?', intro: 'Choose your main goal to shape a learning journey that suits you.', goals: ['Learn a new skill', 'Develop skills for work', 'Apply my learning to a project', 'Explore new fields'] },
   instructor: { title: 'What would you like to achieve as an instructor?', intro: 'Choose your main goal for teaching and sharing your expertise with Esham.', goals: ['Share my expertise and help others', 'Create my first course or workshop', 'Improve my teaching and explanation skills', 'Build my professional presence as an instructor'] },
   both: { title: 'What is your goal for learning and teaching?', intro: 'Choose a goal for a journey that combines building skills and sharing expertise.', goals: ['Learn new skills and share my expertise', 'Develop my career through learning and teaching', 'Apply my learning and run practical workshops', 'Exchange knowledge and contribute to the community'] },
  },
 };
 return copy[language][role] || copy[language].learner;
}
