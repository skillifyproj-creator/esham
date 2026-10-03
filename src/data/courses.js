// المصدر الوحيد لبيانات الدورات في الرئيسية والاستكشاف والتفاصيل.
export const categoryKeys = [
  "all",
  "programming",
  "design",
  "crafts",
  "marketing",
  "photography",
  "business"
];

const courseRecords = [
  {
    "id": 1,
    "category": "programming",
    "rating": "4.8",
    "points": 40,
    "image": "/images/دليلك-الكامل-لتعلم-لغات-تطوير-الويب.webp",
    "icon": "code",
    "title": {
      "ar": "أساسيات البرمجة وتطوير الويب",
      "en": "Programming & web development basics"
    },
    "description": {
      "ar": "ابدأ رحلتك مع HTML وCSS وJavaScript، وابنِ أول موقع لك.",
      "en": "Start with HTML, CSS and JavaScript and build your first website."
    },
    "level": "beginner",
    "instructor": {
      "ar": "سامر خالد",
      "en": "Samer Khaled"
    },
    "reviews": 210,
    "tags": [
      "javascript",
      "html",
      "css",
      "react",
      "برمجة",
      "ويب"
    ],
    "createdAt": "2026-09-10",
    "outcomes": {
      "ar": [
        "فهم أساسيات البرمجة",
        "تجهيز بيئة العمل",
        "تنظيم الكود والبيانات",
        "بناء أجزاء تفاعلية",
        "تجربة الحل وتصحيح الأخطاء",
        "إنجاز مشروع بسيط"
      ],
      "en": [
        "Understand programming basics",
        "Set up your workspace",
        "Organize code & data",
        "Build interactive elements",
        "Test and debug your work",
        "Complete a simple project"
      ]
    },
    "curriculum": [
      {
        "id": "1-module-1",
        "title": {
          "ar": "أساسيات البرمجة",
          "en": "Programming fundamentals"
        },
        "lessons": [
          {
            "id": "1-0-0",
            "title": {
              "ar": "مقدمة إلى تطوير الويب",
              "en": "Introduction to web development"
            },
            "minutes": 10,
            "preview": true
          },
          {
            "id": "1-0-1",
            "title": {
              "ar": "تجهيز بيئة العمل",
              "en": "Setting up your workspace"
            },
            "minutes": 13,
            "preview": false
          },
          {
            "id": "1-0-2",
            "title": {
              "ar": "المتغيرات والبيانات",
              "en": "Variables & data"
            },
            "minutes": 16,
            "preview": false
          },
          {
            "id": "1-0-3",
            "title": {
              "ar": "التطبيق خطوة بخطوة",
              "en": "Step-by-step practice"
            },
            "minutes": 19,
            "preview": false
          },
          {
            "id": "1-0-4",
            "title": {
              "ar": "تمرين عملي",
              "en": "Practical exercise"
            },
            "minutes": 22,
            "preview": false
          }
        ]
      },
      {
        "id": "1-module-2",
        "title": {
          "ar": "بناء تطبيقك",
          "en": "Building your application"
        },
        "lessons": [
          {
            "id": "1-1-0",
            "title": {
              "ar": "مقدمة إلى تطوير الويب",
              "en": "Introduction to web development"
            },
            "minutes": 12,
            "preview": false
          },
          {
            "id": "1-1-1",
            "title": {
              "ar": "تجهيز بيئة العمل",
              "en": "Setting up your workspace"
            },
            "minutes": 15,
            "preview": false
          },
          {
            "id": "1-1-2",
            "title": {
              "ar": "المتغيرات والبيانات",
              "en": "Variables & data"
            },
            "minutes": 18,
            "preview": false
          },
          {
            "id": "1-1-3",
            "title": {
              "ar": "التطبيق خطوة بخطوة",
              "en": "Step-by-step practice"
            },
            "minutes": 21,
            "preview": false
          },
          {
            "id": "1-1-4",
            "title": {
              "ar": "تمرين عملي",
              "en": "Practical exercise"
            },
            "minutes": 24,
            "preview": false
          }
        ]
      },
      {
        "id": "1-module-3",
        "title": {
          "ar": "المشروع العملي",
          "en": "Practical project"
        },
        "lessons": [
          {
            "id": "1-2-0",
            "title": {
              "ar": "مقدمة إلى تطوير الويب",
              "en": "Introduction to web development"
            },
            "minutes": 14,
            "preview": false
          },
          {
            "id": "1-2-1",
            "title": {
              "ar": "تجهيز بيئة العمل",
              "en": "Setting up your workspace"
            },
            "minutes": 17,
            "preview": false
          },
          {
            "id": "1-2-2",
            "title": {
              "ar": "المتغيرات والبيانات",
              "en": "Variables & data"
            },
            "minutes": 20,
            "preview": false
          },
          {
            "id": "1-2-3",
            "title": {
              "ar": "التطبيق خطوة بخطوة",
              "en": "Step-by-step practice"
            },
            "minutes": 23,
            "preview": false
          }
        ]
      }
    ]
  },
  {
    "id": 2,
    "category": "design",
    "rating": "4.9",
    "points": 60,
    "image": "/images/UX course cover.png",
    "icon": "design",
    "title": {
      "ar": "التصميم باستخدام Figma",
      "en": "Design with Figma"
    },
    "description": {
      "ar": "حوّل أفكارك إلى واجهات جميلة وتجارب استخدام واضحة.",
      "en": "Turn your ideas into beautiful interfaces and clear user experiences."
    },
    "level": "intermediate",
    "instructor": {
      "ar": "ليان أحمد",
      "en": "Layan Ahmad"
    },
    "reviews": 88,
    "tags": [
      "figma",
      "ui",
      "ux",
      "تصميم",
      "واجهات"
    ],
    "createdAt": "2026-09-11",
    "outcomes": {
      "ar": [
        "فهم مبادئ التصميم",
        "استخدام أدوات التصميم",
        "اختيار الألوان والخطوط",
        "تنظيم عناصر الواجهة",
        "تحسين تجربة المستخدم",
        "إنجاز نموذج عملي"
      ],
      "en": [
        "Understand design principles",
        "Use design tools",
        "Choose colors & typography",
        "Organize interface elements",
        "Improve the user experience",
        "Build a working prototype"
      ]
    },
    "curriculum": [
      {
        "id": "2-module-1",
        "title": {
          "ar": "أساسيات التصميم",
          "en": "Design fundamentals"
        },
        "lessons": [
          {
            "id": "2-0-0",
            "title": {
              "ar": "مقدمة إلى التصميم",
              "en": "Introduction to design"
            },
            "minutes": 10,
            "preview": true
          },
          {
            "id": "2-0-1",
            "title": {
              "ar": "التعرّف إلى الأدوات",
              "en": "Getting to know the tools"
            },
            "minutes": 13,
            "preview": false
          },
          {
            "id": "2-0-2",
            "title": {
              "ar": "التخطيط والتكوين",
              "en": "Layout & composition"
            },
            "minutes": 16,
            "preview": false
          },
          {
            "id": "2-0-3",
            "title": {
              "ar": "بناء واجهة بسيطة",
              "en": "Building a simple interface"
            },
            "minutes": 19,
            "preview": false
          }
        ]
      },
      {
        "id": "2-module-2",
        "title": {
          "ar": "الأدوات وتجربة المستخدم",
          "en": "Tools & user experience"
        },
        "lessons": [
          {
            "id": "2-1-0",
            "title": {
              "ar": "مقدمة إلى التصميم",
              "en": "Introduction to design"
            },
            "minutes": 12,
            "preview": false
          },
          {
            "id": "2-1-1",
            "title": {
              "ar": "التعرّف إلى الأدوات",
              "en": "Getting to know the tools"
            },
            "minutes": 15,
            "preview": false
          },
          {
            "id": "2-1-2",
            "title": {
              "ar": "التخطيط والتكوين",
              "en": "Layout & composition"
            },
            "minutes": 18,
            "preview": false
          }
        ]
      },
      {
        "id": "2-module-3",
        "title": {
          "ar": "التطبيق العملي",
          "en": "Practical project"
        },
        "lessons": [
          {
            "id": "2-2-0",
            "title": {
              "ar": "مقدمة إلى التصميم",
              "en": "Introduction to design"
            },
            "minutes": 14,
            "preview": false
          },
          {
            "id": "2-2-1",
            "title": {
              "ar": "التعرّف إلى الأدوات",
              "en": "Getting to know the tools"
            },
            "minutes": 17,
            "preview": false
          },
          {
            "id": "2-2-2",
            "title": {
              "ar": "التخطيط والتكوين",
              "en": "Layout & composition"
            },
            "minutes": 20,
            "preview": false
          }
        ]
      }
    ]
  },
  {
    "id": 3,
    "category": "crafts",
    "rating": "5.0",
    "points": 45,
    "image": "/images/Palestinian Tatreez course cover.png",
    "icon": "leaf",
    "title": {
      "ar": "أساسيات التطريز الفلسطيني",
      "en": "Palestinian embroidery basics"
    },
    "description": {
      "ar": "تعلّم الغرز التقليدية واصنع قطعة تحكي حكايتك.",
      "en": "Learn traditional stitches and create a piece that tells your story."
    },
    "level": "beginner",
    "instructor": {
      "ar": "مريم النجار",
      "en": "Mariam Najjar"
    },
    "reviews": 142,
    "tags": [
      "تطريز",
      "فلسطيني",
      "embroidery",
      "crafts"
    ],
    "createdAt": "2026-09-12",
    "outcomes": {
      "ar": [
        "اختيار الأدوات المناسبة",
        "التعامل مع الخامات",
        "تعلّم التقنيات الأساسية",
        "التطبيق بطريقة آمنة",
        "تطوير لمستك الخاصة",
        "إنجاز قطعة بسيطة"
      ],
      "en": [
        "Choose appropriate tools",
        "Work with materials",
        "Learn core techniques",
        "Practise safely",
        "Develop your personal style",
        "Create a simple piece"
      ]
    },
    "curriculum": [
      {
        "id": "3-module-1",
        "title": {
          "ar": "الأدوات والخامات",
          "en": "Tools & materials"
        },
        "lessons": [
          {
            "id": "3-0-0",
            "title": {
              "ar": "مقدمة إلى الحرفة",
              "en": "Introduction to the craft"
            },
            "minutes": 10,
            "preview": true
          },
          {
            "id": "3-0-1",
            "title": {
              "ar": "اختيار الأدوات والخامات",
              "en": "Choosing tools & materials"
            },
            "minutes": 13,
            "preview": false
          },
          {
            "id": "3-0-2",
            "title": {
              "ar": "تعلّم التقنية الأساسية",
              "en": "Learning a core technique"
            },
            "minutes": 16,
            "preview": false
          }
        ]
      },
      {
        "id": "3-module-2",
        "title": {
          "ar": "التقنيات الأساسية",
          "en": "Core techniques"
        },
        "lessons": [
          {
            "id": "3-1-0",
            "title": {
              "ar": "مقدمة إلى الحرفة",
              "en": "Introduction to the craft"
            },
            "minutes": 12,
            "preview": false
          },
          {
            "id": "3-1-1",
            "title": {
              "ar": "اختيار الأدوات والخامات",
              "en": "Choosing tools & materials"
            },
            "minutes": 15,
            "preview": false
          },
          {
            "id": "3-1-2",
            "title": {
              "ar": "تعلّم التقنية الأساسية",
              "en": "Learning a core technique"
            },
            "minutes": 18,
            "preview": false
          }
        ]
      },
      {
        "id": "3-module-3",
        "title": {
          "ar": "مشروعك الأول",
          "en": "Your first project"
        },
        "lessons": [
          {
            "id": "3-2-0",
            "title": {
              "ar": "مقدمة إلى الحرفة",
              "en": "Introduction to the craft"
            },
            "minutes": 14,
            "preview": false
          },
          {
            "id": "3-2-1",
            "title": {
              "ar": "اختيار الأدوات والخامات",
              "en": "Choosing tools & materials"
            },
            "minutes": 17,
            "preview": false
          }
        ]
      }
    ]
  },
  {
    "id": 4,
    "category": "business",
    "rating": "4.7",
    "points": 55,
    "image": "/images/Mastering-Time-with-Effective-Management-5-Unbeatable-Techniques-1.png",
    "icon": "grid",
    "title": {
      "ar": "إدارة المشاريع الصغيرة الناشئة",
      "en": "Managing small businesses"
    },
    "description": {
      "ar": "خطّط لمشروعك وحدّد أهدافك وخطواتك الأولى بثقة.",
      "en": "Plan your project and define your goals and first steps with confidence."
    },
    "level": "beginner",
    "instructor": {
      "ar": "حسام أمين",
      "en": "Hussam Amin"
    },
    "reviews": 53,
    "tags": [
      "إدارة",
      "ريادة",
      "مشروع",
      "business"
    ],
    "createdAt": "2026-09-13",
    "outcomes": {
      "ar": [
        "تحديد فكرة المشروع",
        "صياغة أهداف واضحة",
        "تخطيط الموارد",
        "تنظيم فريق العمل",
        "متابعة التنفيذ",
        "عرض خطة مشروعك"
      ],
      "en": [
        "Define a project idea",
        "Set clear goals",
        "Plan your resources",
        "Organize teamwork",
        "Track execution",
        "Present your project plan"
      ]
    },
    "curriculum": [
      {
        "id": "4-module-1",
        "title": {
          "ar": "الفكرة والتخطيط",
          "en": "Ideas & planning"
        },
        "lessons": [
          {
            "id": "4-0-0",
            "title": {
              "ar": "مقدمة إلى إدارة المشروع",
              "en": "Introduction to project management"
            },
            "minutes": 10,
            "preview": true
          },
          {
            "id": "4-0-1",
            "title": {
              "ar": "تحديد الفكرة والأهداف",
              "en": "Defining ideas & goals"
            },
            "minutes": 13,
            "preview": false
          },
          {
            "id": "4-0-2",
            "title": {
              "ar": "تنظيم الموارد",
              "en": "Organizing resources"
            },
            "minutes": 16,
            "preview": false
          },
          {
            "id": "4-0-3",
            "title": {
              "ar": "تخطيط التنفيذ",
              "en": "Planning execution"
            },
            "minutes": 19,
            "preview": false
          }
        ]
      },
      {
        "id": "4-module-2",
        "title": {
          "ar": "التنفيذ وإدارة الموارد",
          "en": "Execution & resources"
        },
        "lessons": [
          {
            "id": "4-1-0",
            "title": {
              "ar": "مقدمة إلى إدارة المشروع",
              "en": "Introduction to project management"
            },
            "minutes": 12,
            "preview": false
          },
          {
            "id": "4-1-1",
            "title": {
              "ar": "تحديد الفكرة والأهداف",
              "en": "Defining ideas & goals"
            },
            "minutes": 15,
            "preview": false
          },
          {
            "id": "4-1-2",
            "title": {
              "ar": "تنظيم الموارد",
              "en": "Organizing resources"
            },
            "minutes": 18,
            "preview": false
          },
          {
            "id": "4-1-3",
            "title": {
              "ar": "تخطيط التنفيذ",
              "en": "Planning execution"
            },
            "minutes": 21,
            "preview": false
          }
        ]
      },
      {
        "id": "4-module-3",
        "title": {
          "ar": "المشروع العملي",
          "en": "Practical project"
        },
        "lessons": [
          {
            "id": "4-2-0",
            "title": {
              "ar": "مقدمة إلى إدارة المشروع",
              "en": "Introduction to project management"
            },
            "minutes": 14,
            "preview": false
          },
          {
            "id": "4-2-1",
            "title": {
              "ar": "تحديد الفكرة والأهداف",
              "en": "Defining ideas & goals"
            },
            "minutes": 17,
            "preview": false
          },
          {
            "id": "4-2-2",
            "title": {
              "ar": "تنظيم الموارد",
              "en": "Organizing resources"
            },
            "minutes": 20,
            "preview": false
          },
          {
            "id": "4-2-3",
            "title": {
              "ar": "تخطيط التنفيذ",
              "en": "Planning execution"
            },
            "minutes": 23,
            "preview": false
          }
        ]
      }
    ]
  },
  {
    "id": 5,
    "category": "marketing",
    "rating": "4.8",
    "points": 50,
    "image": "/images/digital markiting.jpg",
    "icon": "chart",
    "title": {
      "ar": "التسويق الرقمي وبناء الهوية",
      "en": "Digital marketing & branding"
    },
    "description": {
      "ar": "اصنع حضورًا مؤثرًا وتواصل مع جمهورك بالطريقة المناسبة.",
      "en": "Build a meaningful presence and connect with your audience."
    },
    "level": "intermediate",
    "instructor": {
      "ar": "ليلى ناصر",
      "en": "Layla Nasser"
    },
    "reviews": 95,
    "tags": [
      "تسويق",
      "رقمي",
      "marketing",
      "branding"
    ],
    "createdAt": "2026-09-14",
    "outcomes": {
      "ar": [
        "تحديد الجمهور المناسب",
        "بناء هوية واضحة",
        "صياغة محتوى مؤثر",
        "اختيار قنوات التسويق",
        "قراءة النتائج",
        "تجهيز حملة بسيطة"
      ],
      "en": [
        "Identify your audience",
        "Build a clear identity",
        "Create effective content",
        "Choose marketing channels",
        "Read the results",
        "Prepare a simple campaign"
      ]
    },
    "curriculum": [
      {
        "id": "5-module-1",
        "title": {
          "ar": "أساسيات التسويق",
          "en": "Marketing fundamentals"
        },
        "lessons": [
          {
            "id": "5-0-0",
            "title": {
              "ar": "مقدمة إلى التسويق",
              "en": "Introduction to marketing"
            },
            "minutes": 10,
            "preview": true
          },
          {
            "id": "5-0-1",
            "title": {
              "ar": "التعرّف إلى الجمهور",
              "en": "Understanding your audience"
            },
            "minutes": 13,
            "preview": false
          },
          {
            "id": "5-0-2",
            "title": {
              "ar": "بناء هوية واضحة",
              "en": "Building a clear identity"
            },
            "minutes": 16,
            "preview": false
          }
        ]
      },
      {
        "id": "5-module-2",
        "title": {
          "ar": "بناء المحتوى والهوية",
          "en": "Content & identity"
        },
        "lessons": [
          {
            "id": "5-1-0",
            "title": {
              "ar": "مقدمة إلى التسويق",
              "en": "Introduction to marketing"
            },
            "minutes": 12,
            "preview": false
          },
          {
            "id": "5-1-1",
            "title": {
              "ar": "التعرّف إلى الجمهور",
              "en": "Understanding your audience"
            },
            "minutes": 15,
            "preview": false
          },
          {
            "id": "5-1-2",
            "title": {
              "ar": "بناء هوية واضحة",
              "en": "Building a clear identity"
            },
            "minutes": 18,
            "preview": false
          }
        ]
      },
      {
        "id": "5-module-3",
        "title": {
          "ar": "إطلاق حملتك",
          "en": "Launching your campaign"
        },
        "lessons": [
          {
            "id": "5-2-0",
            "title": {
              "ar": "مقدمة إلى التسويق",
              "en": "Introduction to marketing"
            },
            "minutes": 14,
            "preview": false
          },
          {
            "id": "5-2-1",
            "title": {
              "ar": "التعرّف إلى الجمهور",
              "en": "Understanding your audience"
            },
            "minutes": 17,
            "preview": false
          },
          {
            "id": "5-2-2",
            "title": {
              "ar": "بناء هوية واضحة",
              "en": "Building a clear identity"
            },
            "minutes": 20,
            "preview": false
          }
        ]
      }
    ]
  },
  {
    "id": 6,
    "category": "photography",
    "rating": "4.6",
    "points": 35,
    "image": "/images/التصوير-الفوتوغرافي-1024x575.jpeg",
    "icon": "camera",
    "title": {
      "ar": "التصوير الفوتوغرافي وصناعة المحتوى",
      "en": "Photography & content creation"
    },
    "description": {
      "ar": "تعلّم التكوين والإضاءة لتحكي قصتك من خلال الصورة.",
      "en": "Learn composition and lighting to tell your story through images."
    },
    "level": "beginner",
    "instructor": {
      "ar": "أحمد خالد",
      "en": "Ahmed Khaled"
    },
    "reviews": 124,
    "tags": [
      "تصوير",
      "كاميرا",
      "photography",
      "camera"
    ],
    "createdAt": "2026-09-15",
    "outcomes": {
      "ar": [
        "فهم إعدادات الكاميرا الأساسية",
        "التحكّم في الإضاءة والتعريض",
        "اختيار زوايا التصوير المناسبة",
        "تحسين تكوين الصورة",
        "التقاط صور أفضل في ظروف مختلفة",
        "تطبيق أساسيات التصوير عمليًا"
      ],
      "en": [
        "Understand basic camera settings",
        "Control lighting & exposure",
        "Choose effective camera angles",
        "Improve image composition",
        "Take better photos in different conditions",
        "Apply photography basics in practice"
      ]
    },
    "curriculum": [
      {
        "id": "6-module-1",
        "title": {
          "ar": "أساسيات التصوير",
          "en": "Photography fundamentals"
        },
        "lessons": [
          {
            "id": "6-0-0",
            "title": {
              "ar": "مقدمة إلى التصوير الفوتوغرافي",
              "en": "Introduction to photography"
            },
            "minutes": 10,
            "preview": true,
            videoUrl: "/videos/photography-intro.mp4",
          },
          {
            "id": "6-0-1",
            "title": {
              "ar": "التعرّف إلى الكاميرا",
              "en": "Getting to know your camera"
            },
            "minutes": 13,
            "preview": false
          },
          {
            "id": "6-0-2",
            "title": {
              "ar": "إعدادات التصوير الأساسية",
              "en": "Basic camera settings"
            },
            "minutes": 16,
            "preview": false
          }
        ]
      },
      {
        "id": "6-module-2",
        "title": {
          "ar": "الإضاءة والتكوين",
          "en": "Lighting & composition"
        },
        "lessons": [
          {
            "id": "6-1-0",
            "title": {
              "ar": "مقدمة إلى التصوير الفوتوغرافي",
              "en": "Introduction to photography"
            },
            "minutes": 12,
            "preview": false
          },
          {
            "id": "6-1-1",
            "title": {
              "ar": "التعرّف إلى الكاميرا",
              "en": "Getting to know your camera"
            },
            "minutes": 15,
            "preview": false
          }
        ]
      },
      {
        "id": "6-module-3",
        "title": {
          "ar": "التطبيق العملي",
          "en": "Practical project"
        },
        "lessons": [
          {
            "id": "6-2-0",
            "title": {
              "ar": "مقدمة إلى التصوير الفوتوغرافي",
              "en": "Introduction to photography"
            },
            "minutes": 14,
            "preview": false
          },
          {
            "id": "6-2-1",
            "title": {
              "ar": "التعرّف إلى الكاميرا",
              "en": "Getting to know your camera"
            },
            "minutes": 17,
            "preview": false
          }
        ]
      }
    ]
  }
];

// عدد الدروس مشتق من المنهج، فلا يُكتب في مكان آخر.
export const courses = courseRecords.map(course => ({
  ...course,
  get lessons() { return this.curriculum.reduce((count, module) => count + module.lessons.length, 0); },
}));
