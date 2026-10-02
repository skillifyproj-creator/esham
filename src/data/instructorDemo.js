export const instructorDemo = {
  // =========================================================
  // INSTRUCTOR
  // =========================================================

  instructor: {
    name: "أحمد خالد",
    role: "مدرب معتمد",
    avatar: "",
    points: 4860,
  },

  // =========================================================
  // DASHBOARD STATS
  // =========================================================

  stats: {
    courses: 8,
    learners: 1248,
    points: 4860,
    rating: 4.8,
    ratingCount: 124,
  },

  // =========================================================
  // PERFORMANCE
  // =========================================================

  performance: [
    {
      label: "الأسبوع 1",
      learners: 248,
      completions: 188,
    },
    {
      label: "الأسبوع 2",
      learners: 312,
      completions: 226,
    },
    {
      label: "الأسبوع 3 (الحالي)",
      learners: 285,
      completions: 244,
    },
    {
      label: "الأسبوع 4",
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

      title: "التصوير الفوتوغرافي للمبتدئين",

      category: "التصوير",

      // الاسم الذي يظهر في Dashboard
      status: "نشطة الآن",

      // الحالة البرمجية لصفحة دوراتي
      courseStatus: "published",

      statusLabel: "منشورة",

      description:
        "تعلم أساسيات التصوير وتطوير مهاراتك من خلال دروس وتطبيقات عملية شاملة في التكوين والإضاءة.",

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

      title: "أساسيات التصميم الجرافيكي",

      category: "التصميم",

      status: "نشطة الآن",

      courseStatus: "published",

      statusLabel: "منشورة",

      description:
        "مدخلك إلى نظريات الألوان، التيبوغرافي، وبناء الهويات البصرية المميزة والتصميم الرقمي المتزن.",

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

      title: "صناعة المحتوى المرئي والبودكاست",

      category: "صناعة المحتوى",

      status: "نشطة الآن",

      courseStatus: "published",

      statusLabel: "منشورة",

      description:
        "كيف تبني سيناريو جذاب وتسجل وتنتج محتوى بودكاست احترافي من الفكرة حتى النشر.",

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

      title: "أساسيات تحرير الفيديو للمبتدئين",

      category: "صناعة المحتوى",

      status: "قيد المراجعة",

      courseStatus: "pending",

      statusLabel: "قيد المراجعة",

      description:
        "تقنيات المونتاج وتنسيق المشاهد والانتقالات وإخراج الفيديو النهائي بجودة عالية للتواصل الاجتماعي.",

      learners: 0,

      rating: 0,

      ratingCount: 0,

      points: 320,

      coursePoints: 20,

      icon: "video",

      image: "",

      reviewStatus: "بانتظار اعتماد الإدارة",
    },

    // -------------------------------------------------------
    // 5. DRAFT
    // -------------------------------------------------------

    {
      id: "ui-design",

      title: "مقدمة في تصميم واجهات المستخدم",

      category: "التصميم",

      status: "مسودة غير مكتملة",

      courseStatus: "draft",

      statusLabel: "مسودة",

      description:
        "تم إنجاز 3 من أصل 8 دروس، المسودة محفوظة وجاهزة للمتابعة وإضافة التمارين التفاعلية.",

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

      title: "التسويق الرقمي للمبتدئين",

      category: "التسويق",

      status: "تحتاج تعديل",

      courseStatus: "rejected",

      statusLabel: "تحتاج تعديل",

      description:
        "مقدمة عملية في أساسيات التسويق الرقمي وبناء الحملات وتحليل النتائج.",

      learners: 0,

      rating: 0,

      ratingCount: 0,

      points: 0,

      coursePoints: 20,

      icon: "marketing",

      image: "",

      reviewNote:
        "يرجى إضافة توصيف مفصل للوحدة في العملية الثانية وإعادة الإرسال.",
    },
  ],

  // =========================================================
  // NEEDS ATTENTION
  // =========================================================

  needsAttention: [
    {
      id: 1,

      type: "course",

      text: "لديك دورة محفوظة كمسودة: مقدمة في UI/UX",

      action: "متابعة الإنشاء",

      courseId: "ui-design",
    },

    {
      id: 2,

      type: "review",

      text: "لديك 3 تقييمات جديدة لم تتم مراجعتها",

      action: "عرض التقييمات",
    },

    {
      id: 3,

      type: "video",

      text: "دورة أساسيات تحرير الفيديو قيد المراجعة",

      action: "عرض الدورة",

      courseId: "video-editing",
    },
  ],

  // =========================================================
  // ACTIVITIES
  // =========================================================

  activities: [
    {
      id: 1,

      text:
        "انضم متعلم جديد إلى دورة التصوير الفوتوغرافي.",

      time: "منذ 15 دقيقة",

      type: "success",

      courseId: "photography",
    },

    {
      id: 2,

      text:
        "تمت إضافة تقييم 5 نجوم لدورة أساسيات التصميم.",

      time: "منذ ساعتين",

      type: "warning",

      courseId: "graphic-design",
    },

    {
      id: 3,

      text:
        "تمت إضافة 20 نقطة إلى رصيدك من نشاط تعليمي مميز.",

      time: "منذ 4 ساعات",

      type: "info",
    },

    {
      id: 4,

      text:
        "تم نشر دورة صناعة المحتوى بنجاح في المنصة.",

      time: "أمس",

      type: "dark",

      courseId: "digital-content",
    },
  ],
};