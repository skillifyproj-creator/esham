import { readSavedInstructorCourse, persistInstructorCourse } from './instructorCourseStorage';
import { readSubmissions, asInstructorCourse, updateSubmittedCourse } from '../services/coursePublishing';

export const instructorDemo = {
  // =========================================================
  // INSTRUCTOR
  // =========================================================

  instructor: {
    name: {
      ar: "أحمد خالد",
      en: "Ahmed Khaled",
    },
    role: {
      ar: "مدرب معتمد",
      en: "Certified Instructor",
    },
    avatar: "",
    points: 4860,
  },

  courseDraft: {
    title: {
      ar: "أساسيات التصوير الفوتوغرافي وإعدادات الإضاءة الاحترافية",
      en: "Photography Fundamentals and Professional Lighting Setup",
    },
    category: "photography",
    language: "ar",
    description: {
      ar: "دورة تدريبية تطبيقية تأخذك من الصفر لفهم إعدادات الكاميرا اليدوية مثلث التعريض، سرعة الغالق، فتحة العدسة، مع أسرار توزيع الإضاءة الطبيعية والصناعية في الاستوديو للحصول على صور احترافية مميزة.",
      en: "A hands-on course covering manual camera settings, the exposure triangle, shutter speed, aperture, and techniques for shaping natural and studio lighting to create professional images.",
    },
    level: "beginner",
    objectives: [
      {
        id: "exposure",
        ar: "فهم مثلث التعريض للضوء والتحكم اليدوي الكامل بخصائص الكاميرا",
        en: "Understand the exposure triangle and take full manual control of camera settings",
      },
      {
        id: "composition",
        ar: "تطبيق قواعد التكوين الفوتوغرافي وقاعدة الأثلاث والخطوط الإرشادية",
        en: "Apply photographic composition principles, the rule of thirds, and leading lines",
      },
      {
        id: "lighting",
        ar: "إعداد وتوزيع مصادر الإضاءة الأساسية لتصوير البورتريه والمنتجات",
        en: "Set up and position key light sources for portrait and product photography",
      },
    ],
  },

  // =========================================================
  // DASHBOARD STATS
  // =========================================================

  stats: {
    courses: 6,
    coursesAddedThisMonth: 1,
    learners: 1248,
    learnerGrowthPercent: 14,
    points: 4860,
    rating: 4.8,
    ratingCount: 124,
    weeklyJoinRate: 312,
    averageWatchHours: 4.2,
    overallCompletionRate: 78.4,
  },

  // =========================================================
  // PERFORMANCE
  // =========================================================

  performance: [
    {
      id: "week-1",
      label: { ar: "الأسبوع 1", en: "Week 1" },
      learners: 248,
      completions: 188,
    },
    {
      id: "week-2",
      label: { ar: "الأسبوع 2", en: "Week 2" },
      learners: 312,
      completions: 226,
    },
    {
      id: "week-3",
      label: { ar: "الأسبوع 3 (الحالي)", en: "Week 3 (Current)" },
      learners: 285,
      completions: 244,
    },
    {
      id: "week-4",
      label: { ar: "الأسبوع 4", en: "Week 4" },
      learners: 312,
      completions: 268,
    },
  ],

  // =========================================================
  // COURSES
  // تستخدم في Dashboard + My Courses
  // =========================================================

  courses: [
    // -------------------------------------------------------
    // 1. PUBLISHED
    // -------------------------------------------------------

    {
      id: "photography",

      title: {
        ar: "التصوير الفوتوغرافي للمبتدئين",
        en: "Photography for Beginners",
      },

      category: { ar: "التصوير", en: "Photography" },

      // الاسم الذي يظهر في Dashboard
      status: { ar: "نشطة الآن", en: "Active now" },

      // الحالة البرمجية لصفحة دوراتي
      courseStatus: "published",

      statusLabel: { ar: "منشورة", en: "Published" },

      description: {
        ar: "تعلم أساسيات التصوير وتطوير مهاراتك من خلال دروس وتطبيقات عملية شاملة في التكوين والإضاءة.",
        en: "Learn photography fundamentals and build your skills through practical lessons on composition and lighting.",
      },

      learners: 248,

      rating: 4.8,

      ratingCount: 124,

      points: 920,

      // كل دورة في نظام المنصة قيمتها 20 نقطة
      coursePoints: 20,

      icon: "camera",

      // ضعي صورة الكورس هنا لاحقًا
      image: "",
    },

    // -------------------------------------------------------
    // 2. PUBLISHED
    // -------------------------------------------------------

    {
      id: "graphic-design",

      title: { ar: "أساسيات التصميم الجرافيكي", en: "Graphic Design Fundamentals" },

      category: { ar: "التصميم", en: "Design" },

      status: { ar: "نشطة الآن", en: "Active now" },

      courseStatus: "published",

      statusLabel: { ar: "منشورة", en: "Published" },

      description: {
        ar: "مدخلك إلى نظريات الألوان، التيبوغرافي، وبناء الهويات البصرية المميزة والتصميم الرقمي المتزن.",
        en: "An introduction to color theory, typography, distinctive visual identities, and balanced digital design.",
      },

      learners: 184,

      rating: 4.7,

      ratingCount: 88,

      points: 640,

      coursePoints: 20,

      icon: "design",

      image: "",
    },

    // -------------------------------------------------------
    // 3. PUBLISHED
    // -------------------------------------------------------

    {
      id: "digital-content",

      title: { ar: "صناعة المحتوى المرئي والبودكاست", en: "Visual Content and Podcast Production" },

      category: { ar: "صناعة المحتوى", en: "Content Creation" },

      status: { ar: "نشطة الآن", en: "Active now" },

      courseStatus: "published",

      statusLabel: { ar: "منشورة", en: "Published" },

      description: {
        ar: "كيف تبني سيناريو جذاب وتسجل وتنتج محتوى بودكاست احترافي من الفكرة حتى النشر.",
        en: "Plan an engaging script and record and produce a professional podcast, from the initial idea to publication.",
      },

      learners: 156,

      rating: 4.9,

      ratingCount: 72,

      points: 580,

      coursePoints: 20,

      icon: "video",

      image: "",
    },

    // -------------------------------------------------------
    // 4. PENDING
    // -------------------------------------------------------

    {
      id: "video-editing",

      title: { ar: "أساسيات تحرير الفيديو للمبتدئين", en: "Video Editing Basics for Beginners" },

      category: { ar: "صناعة المحتوى", en: "Content Creation" },

      status: { ar: "قيد المراجعة", en: "Pending review" },

      courseStatus: "pending",

      statusLabel: { ar: "قيد المراجعة", en: "Pending review" },

      description: {
        ar: "تقنيات المونتاج وتنسيق المشاهد والانتقالات وإخراج الفيديو النهائي بجودة عالية للتواصل الاجتماعي.",
        en: "Learn editing techniques, scene arrangement, transitions, and how to export high-quality videos for social media.",
      },

      learners: 0,

      rating: 0,

      ratingCount: 0,

      points: 320,

      coursePoints: 20,

      icon: "video",

      image: "",

      reviewStatus: { ar: "بانتظار اعتماد الإدارة", en: "Awaiting administrator approval" },
    },

    // -------------------------------------------------------
    // 5. DRAFT
    // -------------------------------------------------------

    {
      id: "ui-design",

      title: { ar: "مقدمة في تصميم واجهات المستخدم", en: "Introduction to User Interface Design" },

      category: { ar: "التصميم", en: "Design" },

      status: { ar: "مسودة غير مكتملة", en: "Incomplete draft" },

      courseStatus: "draft",

      statusLabel: { ar: "مسودة", en: "Draft" },

      description: {
        ar: "تم إنجاز 3 من أصل 8 دروس، المسودة محفوظة وجاهزة للمتابعة وإضافة التمارين التفاعلية.",
        en: "Three of eight lessons are complete. The saved draft is ready for you to continue and add interactive exercises.",
      },

      learners: 0,

      rating: 0,

      ratingCount: 0,

      points: 0,

      coursePoints: 20,

      icon: "design",

      image: "",

      progress: 38,

      completedLessons: 3,

      totalLessons: 8,
    },

    // -------------------------------------------------------
    // 6. REJECTED
    // -------------------------------------------------------

    {
      id: "digital-marketing",

      title: { ar: "التسويق الرقمي للمبتدئين", en: "Digital Marketing for Beginners" },

      category: { ar: "التسويق", en: "Marketing" },

      status: { ar: "تحتاج تعديل", en: "Needs edits" },

      courseStatus: "rejected",

      statusLabel: { ar: "تحتاج تعديل", en: "Needs edits" },

      description: {
        ar: "مقدمة عملية في أساسيات التسويق الرقمي وبناء الحملات وتحليل النتائج.",
        en: "A practical introduction to digital marketing fundamentals, campaign creation, and results analysis.",
      },

      learners: 0,

      rating: 0,

      ratingCount: 0,

      points: 0,

      coursePoints: 20,

      icon: "marketing",

      image: "",

      reviewNote: {
        ar: "يرجى إضافة توصيف مفصل للوحدة في العملية الثانية وإعادة الإرسال.",
        en: "Please add a detailed description of the second unit and resubmit the course.",
      },
    },
  ],

  // =========================================================
  // NEEDS ATTENTION
  // =========================================================

  needsAttention: [
    {
      id: 1,

      type: "course",

      text: {
        ar: "لديك دورة محفوظة كمسودة: مقدمة في UI/UX",
        en: "You have a course saved as a draft: Introduction to UI/UX",
      },
      actionKey: "continueCreation",

      courseId: "ui-design",
    },

    {
      id: 2,

      type: "review",

      text: {
        ar: "لديك 3 تقييمات جديدة لم تتم مراجعتها",
        en: "You have 3 new reviews to check",
      },
      actionKey: "reviewRatings",
    },

    {
      id: 3,

      type: "video",

      text: {
        ar: "دورة أساسيات تحرير الفيديو قيد المراجعة",
        en: "The Video Editing Basics course is under review",
      },
      actionKey: "viewCourse",

      courseId: "video-editing",
    },
  ],

  // =========================================================
  // ACTIVITIES
  // =========================================================

  activities: [
    {
      id: 1,

      text: {
        ar: "انضم متعلم جديد إلى دورة التصوير الفوتوغرافي.",
        en: "A new learner joined the Photography course.",
      },

      time: { ar: "منذ 15 دقيقة", en: "15 minutes ago" },

      type: "success",

      courseId: "photography",
    },

    {
      id: 2,

      text: {
        ar: "تمت إضافة تقييم 5 نجوم لدورة أساسيات التصميم.",
        en: "A 5-star review was added to Graphic Design Fundamentals.",
      },

      time: { ar: "منذ ساعتين", en: "2 hours ago" },

      type: "warning",

      courseId: "graphic-design",
    },

    {
      id: 3,

      text: {
        ar: "تمت إضافة 20 نقطة إلى رصيدك عن تسجيل متعلّم في دورتك.",
        en: "20 points were added to your balance for a learner enrollment in your course.",
      },

      time: { ar: "منذ 4 ساعات", en: "4 hours ago" },

      type: "info",
    },

    {
      id: 4,

      text: {
        ar: "تم نشر دورة صناعة المحتوى بنجاح في المنصة.",
        en: "The Content Creation course was successfully published.",
      },

      time: { ar: "أمس", en: "Yesterday" },

      type: "dark",

      courseId: "digital-content",
    },
  ],
};

for (const course of instructorDemo.courses) {
  const saved = readSavedInstructorCourse(course.id);
  if (saved) Object.assign(course, saved, { id: course.id });
}
export function refreshInstructorCourses() {
  for (const record of readSubmissions()) {
    const value = asInstructorCourse(record), index = instructorDemo.courses.findIndex(item=>item.id===record.id);
    if (index < 0) instructorDemo.courses.push(value); else Object.assign(instructorDemo.courses[index],value);
  }
}
refreshInstructorCourses();
export function saveInstructorCourse(id, patch) {
  const course = instructorDemo.courses.find(item => String(item.id) === String(id));
  if (!course) return false;
  try {
    if (!updateSubmittedCourse(id, patch) && !persistInstructorCourse(id, patch)) return false;
  } catch { return false; }
  Object.assign(course, patch, { id: course.id });
  return true;
}
