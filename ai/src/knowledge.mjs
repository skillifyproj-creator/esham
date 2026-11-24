// Project-owned guidance. Backend persisted state and enabled capabilities remain authoritative.
export const platformKnowledge = [
  {
    "id": "platform:overview",
    "title": "عن إسهام وبدء الاستخدام | About Esham and getting started",
    "url": "/help/support",
    "source": "platform",
    "text": "إسهام منصة لتبادل المهارات والتعلم من خلال الدورات والنقاط. يمكنك التعلم أو تقديم الدورات أو الجمع بينهما في حساب واحد. للبدء أنشئ حسابا ثم اختر نوع الحساب وأكمل الملف والاهتمامات والأهداف. تصفح استكشف الدورات للبحث حسب المهارة والتصنيف والمستوى وترتيب النتائج. استكشاف الدورات أثناء الدخول يحافظ على الحساب ولا يسجل خروجا. Esham is a skills exchange and learning platform using courses and points. Create an account, choose learner, instructor or hybrid, then complete profile, interests and goals. Browse Explore courses by skill, category and level; browsing keeps your signed-in identity."
  },
  {
    "id": "platform:navigation",
    "title": "الوصول للدورات والرصيد وإعدادات الحساب | Find courses, wallet and settings",
    "url": "/help/support",
    "source": "platform",
    "text": "رصيد النقاط وسجل الحركات من محفظة النقاط في مساحة المستخدم. دوراتي تعرض الدورات المسجل بها للمتعلم ودورات التعليم للمدرب. إعدادات الحساب من قائمة الحساب وتسمح بتعديل الملف وتغيير نوع الحساب. للهايبرد يمكن التبديل بين واجهة المتعلم والمدرب. سجل الجلسات في المساعد يفتح المحادثات المحفوظة لهذا الحساب في التبويب الحالي، والمصادر والمراجع تجمع مراجع المحادثة المفتوحة. My courses shows enrolled courses in the learner area and authored courses in the instructor area. Find points balance and transactions in the points wallet. Open the account menu for profile and settings; change account type there, preserving records. Hybrid accounts can switch learner and instructor workspaces. Assistant Sessions restores this account chat history in this browser tab; Resources lists references in the open conversation. The assistant cannot read the actual private wallet or enrollment records."
  },
  {
    "id": "platform:learning",
    "title": "التسجيل والتقدم والمهام والتقييم | Enrollment, lessons and tasks",
    "url": "/help/terms",
    "source": "platform",
    "text": "للتسجيل افتح استكشف الدورات ثم تفاصيل الدورة وراجع المحتوى والمدرب ثم اضغط التسجيل إذا توفر 20 نقطة. إن لم يكف الرصيد يمكن كسب النقاط بتقديم دورات وتسجيل متعلمين فيها. افتح دوراتي ثم الدورة لمتابعة الدروس وحفظ التقدم وتسليم المهام المطلوبة للمراجعة. المهمة تعتمد من مدرب الدورة؛ كتابة التقييم لا تزيد النقاط. لا يمكن التسجيل في دورتك الخاصة. Open Explore courses, inspect course details and enroll from its page with 20 points. Earn more by teaching courses other learners enroll in. Continue from My courses, complete lessons and submit required practical tasks to the course instructor for review. Reviews give no points. Self-enrollment is not allowed."
  },
  {
    "id": "platform:points",
    "title": "النقاط والتسجيل | Points and enrollment",
    "url": "/help/terms",
    "source": "platform",
    "text": "يحصل الحساب الجديد على 20 نقطة مرة واحدة فقط. كل دورة داخل إسهام تكلف 20 نقطة، والمدرب يكسب 20 عن كل متعلم جديد يسجل بدورته. لا نقاط إضافية لإكمال الدرس أو المهمة أو التقييم. New Esham accounts receive 20 points once. All Esham course enrollments cost 20 points; instructors earn 20 per distinct learner enrollment. No lesson, task or review rewards. Do not invent a user balance: the assistant has no authenticated wallet API."
  },
  {
    "id": "platform:roles",
    "title": "الحساب والأدوار | Account roles",
    "url": "/help/terms",
    "source": "platform",
    "text": "يمكن اختيار متعلم أو مدرب أو هايبرد. تغيير نوع الحساب من إعدادات الحساب يحافظ على الهوية والسجل السابق. Learner, instructor or hybrid capabilities share one identity; change account type in account settings while retaining learning and teaching history."
  },
  {
    "id": "platform:certificates",
    "title": "الشهادات والمهام | Certificates and tasks",
    "url": "/help/guidelines",
    "source": "platform",
    "text": "الإكمال والشهادة يعتمدان على البيانات المحفوظة في الخادم: إكمال الدروس المطلوبة واعتماد المدرّب للمهام المطلوبة، مع وجود متطلب واحد على الأقل. الدروس والمهام الاختيارية لا تمنع الإكمال، والنسبة المقربة لا تثبت الاستحقاق. لا يعاد فتح تسجيل مكتمل ولا يتغير أول تاريخ إكمال. شهادة واحدة لكل تسجيل مؤهل، بهوية وبيانات وتاريخ إصدار ثابتة من الخادم. التنزيل العربي والإنجليزي يستخدم سجل الشهادة المصادق عليه فقط؛ التحقق العام محدود ويحترم الإلغاء. المصالحة والإصدار خاضعان لبوابة معطلة افتراضيا ولا يفعلان على قاعدة البيانات المشتركة. Completion requires persisted required lessons and instructor-approved required tasks, with at least one requirement. Optional lessons and tasks do not block completion; rounded percentages never determine eligibility. Completed enrollments retain their first completion timestamp. The backend issues one immutable certificate per eligible enrollment. Arabic/English browser PDF export uses authenticated certificate snapshots only; minimal public verification respects revocation. Completion/issuance remain default-disabled on the shared hosted environment."
  },
  {
    "id": "platform:authoring",
    "title": "إنشاء الدروس والفيديو | Course authoring",
    "url": "/help/guidelines",
    "source": "platform",
    "text": "من دوراتي ابدأ إنشاء دورة، ثم أضف معلوماتها وتصنيفها وأقسامها ودروسها وأهدافها والمهام التطبيقية ثم أرسلها للمراجعة. يمكن رفع فيديو أو تسجيل الكاميرا والشاشة والسبورة والكتابة عليها ومشاركة PDF وقص الفيديو. Create a course from My courses, add details, sections, lessons, objectives and tasks, then submit for review. Record camera, screen and whiteboard, annotate, present PDF or trim a video."
  },
  {
    "id": "platform:video",
    "title": "فحص الفيديو وسلامة المحتوى | Video screening",
    "url": "/help/terms",
    "source": "platform",
    "text": "يمكن للمدرّب رفع الفيديو أو تسجيل الكاميرا والشاشة والسبورة ثم معاينته وطلب الفحص بعد الموافقة على الإرسال إلى مزود الذكاء الاصطناعي. الفحص استشاري وقد يفوّت مشاهد ولا يمثل اعتماد أمان أو شرط نشر ولا يمنع حفظ المسودة بذاته. قرار النشر والمراجعة الرسمية يبقيان في الخادم. حدود الفحص الاستشاري MP4/WebM و20MiB و600 ثانية، وتختلف عن حدود تخزين الوسائط. Instructors can upload or record camera, screen and whiteboard, preview, and consent to provider video screening. Screening is advisory only, may miss scenes, is not safety certification, does not itself block draft saves and grants no publication authority. Existing server moderation/publication rules remain authoritative. Advisory screening limits are MP4/WebM,20MiB,600seconds; media storage has separate limits."
  },
  {
    "id": "platform:sources",
    "title": "دورات إسهام والمصادر الخارجية | Catalog sources",
    "url": "/courses",
    "source": "platform",
    "text": "دورات إسهام متاحة ضمن كتالوج المنصة فقط. بيانات Coursera مرجع خارجي مستقل ولا تعني أن تلك الدورات موجودة في إسهام أو يمكن التسجيل بها بالنقاط أو أن معلوماتها الحالية محدثة. Esham courses are only those in its supplied catalog. Coursera entries are external historical metadata, not Esham courses, not enrollable with Esham points; current price, availability, certificates and syllabus require checking Coursera. Dataset does not contain full lesson content or transcripts."
  },
  {
    "id": "platform:privacy",
    "title": "الخصوصية والمساعدة | Privacy and help",
    "url": "/help/privacy",
    "source": "platform",
    "text": "حافظ على خصوصية بيانات الدخول وحقوق المحتوى. استخدم المساعدة للإرشادات وبلغ عن المحتوى غير المناسب مع تفاصيل. المساعد لا يسجل المستخدم بدورات ولا يصرف نقاطا ولا يغير حسابات أو يصدر شهادات. Keep credentials private and respect content rights. The assistant guides but never enrolls, spends points, changes roles, publishes or issues certificates. It has no trusted access to private account balances, enrollment histories, course lesson bodies or other users."
  }
];
