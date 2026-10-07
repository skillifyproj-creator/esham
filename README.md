# إسهام | Esham

مشروع تخرّج لمنصة تعلّم ومشاركة المهارات، تدعم دور المتعلّم والمعلّم.

نطوّر واجهات الفرونت أولًا باستخدام React وVite، ثم نربطها بالباك.

## التقنيات والهوية

- React وVite.
- React Router للتنقل.
- العربية والإنجليزية.
- الوضع الفاتح والداكن.
- خط Tajawal وخط Noto Naskh Arabic.
- تصميم متجاوب وألوان مشتركة بين الصفحات.

## تشغيل المشروع

افتحي في VS Code مجلد المشروع الذي يحتوي على `package.json`.

نفّذي داخل التيرمنال:

```bash
npm install
npm run dev
```

افتحي رابط Local الظاهر في التيرمنال.

قد يكون البورت `5173` أو `5174`؛ استخدمي البورت الذي يظهر عند التشغيل.

لبناء نسخة الإنتاج:

```bash
npm run build
```

لمعاينة نسخة الإنتاج:

```bash
npm run preview
```

## الصفحات والمسارات

الزائر يبدأ من الرئيسية، ويمكنه استكشاف الدورات وتفاصيلها قبل اختيار تسجيل الدخول أو إنشاء الحساب.

| الصفحة | المسار |
|---|---|
| الرئيسية | `/` |
| كاتالوج الدورات والفلترة بالمجال | `/courses` |
| تفاصيل الدورة العامة | `/courses/:courseId` |
| إنشاء الحساب / تسجيل الدخول | `/signup` / `/login` |
| استعادة / إعادة تعيين كلمة المرور | `/forgot-password` / `/reset-password` |
| بدء إعداد التجربة | `/onboarding` → `/onboarding/role` |
| اختيار الدور | `/onboarding/role` |
| معلومات الملف الشخصي | `/onboarding/profile` |
| اهتمامات التعلّم وخبرة التعليم حسب الدور | `/onboarding/interests` |
| أهداف المستخدم | `/onboarding/goals` |
| ملخص إكمال الإعداد | `/onboarding/complete` |
| لوحة المتعلّم | `/learner` |
| دوراتي | `/learner/courses` |
| تعلّم الدورة | `/learner/courses/:courseId/learn` |
| المهام التطبيقية وتفاصيلها | `/learner/tasks`، مع `?task=...` أو `?course=...` |
| تقدّم التعلّم | `/learner/progress` |
| محفظة النقاط | `/learner/points` |
| التقييمات | `/learner/reviews` |
| لوحة المعلّم | `/instructor` |
| دورات المعلّم | `/instructor/courses` |
| إنشاء دورة | `/instructor/courses/new` |
| منهج الدورة التجريبية | `/instructor/courses/new/curriculum` |
| المراجعة النهائية التجريبية | `/instructor/courses/new/review` |
| أداء دورة | `/instructor/courses/:courseId/performance` |
| تقييمات المتعلّمين للمعلّم | `/instructor/feedback` |
| تحرير درس | `/instructor/courses/:courseId/sections/:sectionId/lessons/:lessonId/edit` |
| إضافة درس | `/instructor/courses/:courseId/sections/:sectionId/lessons/new` |
| إضافة / تحرير مهمة | `/instructor/courses/:courseId/sections/:sectionId/tasks/new` / `tasks/:taskId/edit` |
| الإشعارات المشتركة | `/learner/notifications` / `/instructor/notifications` |
| تحرير الملف المشترك | `/learner/profile` / `/instructor/profile` |
| الإعدادات المشتركة | `/learner/settings` / `/instructor/settings` |
| نموذج تغيير كلمة المرور | `/learner/settings/security` / `/instructor/settings/security` |
| المساعد | `/assistant` / `/learner/assistant` / `/instructor/assistant` |

مثال دورة التصوير في واجهة التعلّم: `http://localhost:5173/learner/courses/6/learn`. استخدمي البورت الظاهر عند تشغيل Vite.

## تعديلات 2026-10-05

### رحلة الزائر والمصادقة

- ربط أزرار الرئيسية والهيدر والكاتالوج بإنشاء الحساب وتسجيل الدخول.
- تفاصيل الدورة العامة توجه الزائر إلى تسجيل الدخول للالتحاق؛ أزيل خصم النقاط الوهمي داخل الصفحة.
- ربط «نسيت كلمة المرور» بصفحة الاستعادة وإضافة نموذج إعادة التعيين مع تأكيد الكلمة وإظهارها وإخفائها والتحقق منها.
- كلمة المرور الجديدة تتطلب 8 محارف على الأقل، وحرفًا ورقمًا؛ النموذج لا يرسل البريد ولا يغير كلمة مرور فعلية.
- إنشاء الحساب بعد اجتياز تحقق الحقول يبدأ إعداد التجربة؛ لا ينشئ حسابًا على الخادم.
- تسجيل الدخول يعرض نتيجة تحقق النموذج، مع رابط واضح لمعاينة واجهة المتعلّم التجريبية دون ادعاء تسجيل دخول فعلي.

### إعداد التجربة

- اختيار المتعلّم أو المعلّم أو الجمع بين الدورين، ثم الملف والمجالات والأهداف وملخص الإكمال.
- منع تجاوز الخطوات المطلوبة قبل إكمالها، وإتاحة الرجوع لتعديل الاختيارات.
- ملف شخصي مع الاسم ومعرّف المستخدم والنبذة، وصورة اختيارية JPG/PNG حتى 5 MB ومعاينة فورية وأحرف أولى بديلة.
- ستة مجالات مشتركة مع بيانات الدورات؛ عدد الدورات المعروض يأتي من الكاتالوج الحالي.
- اهتمامات التعلّم مستقلة عن مجالات التعليم، مع إضافة مهارات تعليم مخصصة ومنع تكرارها.
- اختيار المجال يحدد الاهتمام فقط؛ لا يسجّل في دورة ولا يخصم أو يمنح نقاطًا.
- ملخص نهائي مرتبط باستكشاف الدورات وإعداد دورة وواجهتي المتعلّم والمعلّم حسب الدور.
- أزيلت ادعاءات الاعتماد ومكافآت الترحيب غير المرتبطة ببيانات فعلية.

### الإشعارات والملف والإعدادات

- صفحة إشعارات واحدة بمحتوى منفصل حسب الدور، وأيقونة جرس وعدّاد غير المقروء في الناف.
- مشاركة حالة القراءة بين الجرس والصفحة، مع تحديد إشعار أو جميع الإشعارات كمقروءة وحفظها محليًا لكل دور.
- صفحة تحرير ملف مشتركة، مع اهتمامات التعلّم ومجالات التعليم وحفظ محلي وإلغاء التعديلات.
- الاسم المحفوظ يظهر في الناف ولوحة التحكم. الصورة تبقى معاينة مؤقتة ولا تُرفع.
- إعدادات مشتركة للغة والمظهر تُطبق وتُحفظ تلقائيًا، وروابط لمركز الإشعارات والأمان.
- نموذج تغيير كلمة المرور الحالية والجديدة والتأكيد مع تحقق الحقول، دون إرسال أو تخزين كلمات المرور.
- حذف الحساب نافذة تأكيد داخل الإعدادات؛ التنفيذ معطل إلى حين ربط خدمة الحسابات.
- تغيير البريد وضوابط الخصوصية الخارجية ينتظران الخدمة؛ لا توجد مفاتيح توحي بتطبيق صلاحيات غير منفذة.

### مراجعة الروابط والواجهات الحالية

- إصلاح زر متابعة المحتوى السفلي في إنشاء الدورة واختصار إضافة درس ليصلا إلى المنهج الحالي.
- ربط خطوات إنشاء الدورة والرجوع للمعلومات الأساسية ومعاينة المنهج بالصفحات الحالية.
- ربط أزرار تعديل الوصف والمخرجات والغلاف والمنهج في المراجعة بالواجهات الموجودة.
- ربط إدارة مهمة القسم في محرر الدرس بنموذج المهمة الموجود، وإصلاح رابط الرجوع من المهمة.
- إصلاح روابط المعاينة العامة باستخدام جدول صريح بين معرّفات بيانات المعلّم والكاتالوج؛ لا يظهر رابط عام للدورات التي ليس لها سجل مقابل.
- استبدال الروابط المكسورة إلى إدارة/تحرير/استكمال الدورات وتقاريرها وشهاداتها بإجراء يشرح أن الميزة قيد الاستكمال، دون إنشاء صفحات إضافية للمعلّم.
- إزالة روابط الهاش التي لا تملك أقسامًا مقابلة في فوتر المعلّم، وإظهار حالة عدم الإتاحة للسياسات والدعم حتى اكتمال محتواها.
- توضيح الأدوات الشكلية غير المنفذة للموارد والفيديو ومعاينة المهام وإرسال المراجعة؛ لا تُنفّذ إرسالًا أو حذفًا فعليًا.
- تعطيل مرشحات إحصاءات لوحة المعلّم غير المنفذة، وتوضيح أن نموذج الأداء ثابت.
- توحيد وصف مكافأة الإكمال في محرر الدرس مع سياسة النقاط: مكافأة الدورة بعد الاعتماد، وليست مكافأة تلقائية لكل قسم.
- استبدال غلاف المراجعة المفقود بصورة التصوير الموجودة، وتوضيح حدود حفظ مسودة إنشاء الدورة.
- صفحات الأدمن وبقية صفحات المعلّم غير الموجودة خارج نطاق هذه الدفعة وتُستكمل مع الزميلة.

### التحقق

- فحص فتح الصفحات الحالية وروابطها المرئية والصور، ومطابقة الروابط الداخلية مع مسارات React Router ومعرّفات الكاتالوج.
- تجربة خطوات الإعداد للدور المدمج، والتنقل بين الملف والمجالات والأهداف والإكمال.
- فحص تحقق حقول الملف والأمان وفتح وإغلاق نافذة الحذف، ومراجعة أحجام الهاتف في الإعدادات.
- `npm run build` ناجح. تحذير `use client` من React Router وتحذير حجم الحزمة أكبر من 500 kB ما زالا قائمين؛ تقسيم الحزمة عمل تحسين لاحق.
- هذه مراجعة للفرونت الحالي؛ ليست اختبارًا لخدمات المصادقة أو الأدوار أو الإدارة أو الإرسال، لأنها غير مرتبطة بعد.

## التخزين المحلي وحدوده

| المفتاح | الاستخدام |
|---|---|
| `esham-onboarding-draft-v1` في sessionStorage | اختيارات الإعداد خلال جلسة التبويب |
| `esham-account-profile-v1` في localStorage | بيانات الملف التجريبي المشتركة على الجهاز |
| `esham-notification-read-v1` | إشعارات المتعلّم المقروءة |
| `esham-instructor-notification-read-v1` | إشعارات المعلّم المقروءة |
| `esham-language` / `esham-theme` | اللغة والمظهر |

هذه البيانات ليست حسابات منفصلة لكل مستخدم، ولا صلاحيات أمنية. كلمات المرور لا تُحفظ، والصور المؤقتة لا تستمر بعد مغادرة الصفحة. إعداد التجربة يمكن أن يعمل دون التخزين، لكن استمراره بعد إعادة التحميل يحتاج توفر التخزين. يجب استبدال مصادر البيانات المحلية بخدمات الباك عند الربط.

## آخر تعديلات واجهة المتعلّم

- تنظيم صفحات المتعلّم داخل `LearnerLayout`.
- مشاركة الناف والفوتر بين صفحات المتعلّم.
- إضافة تبديل اللغة والوضع الفاتح والداكن في ناف المتعلّم.
- إزالة رابط استكشاف الدورات من ناف المتعلّم.
- إصلاح عرض بطاقات «دوراتي» وصورها.
- ربط أزرار متابعة التعلّم بصفحة الدرس.
- إضافة صفحة المهام مع البحث والفلترة والمسودات والتسليم التجريبي.
- ربط مهام اللوحة وصفحة الدرس بنفس صفحة تفاصيل المهمة.
- إضافة صفحة تقدّم التعلّم وتفاصيل تقدّم الوحدات.
- حساب التقدّم العام من مجموع الدروس المكتملة.
- إضافة محفظة النقاط وسجل مكافآت الدورات.
- توحيد مصدر الرصيد بين الناف واللوحة وصفحة التقدّم والمحفظة.

## تنظيم الملفات

| المسار | الاستخدام |
|---|---|
| `src/pages/auth` | المصادقة وإعداد التجربة |
| `src/pages/shared` | الإشعارات والملف والإعدادات المشتركة |
| `src/context/NotificationsContext.jsx` | قراءة الإشعارات حسب الدور |
| `src/data/interestAreas.js` | المجالات المشتركة |
| `src/data/instructorCourseLinks.js` | مقابلة معرّفات الدورات التجريبية |
| `src/components/shared/PendingFeature.jsx` | توضيح الميزات غير المتاحة |
| `src/pages/learner` | صفحات المتعلّم |
| `src/components/learner` | ناف وتخطيط المتعلّم |
| `src/pages/instructor` | صفحات المعلّم |
| `src/components/instructor` | مكوّنات واجهة المعلّم |
| `src/context/PreferencesContext.jsx` | اللغة والثيم |
| `src/context/LearnerContext.jsx` | الدورات المسجّلة وإنجاز الدروس |
| `src/context/LearnerTasksContext.jsx` | مسودات المهام والتسليم التجريبي |
| `src/hooks/useLearnerWallet.js` | قراءة بيانات المحفظة المشتركة |
| `src/data/courses.js` | المصدر الموحد لبيانات الدورات |
| `src/data/learnerDemo.js` | بيانات حساب المتعلّم التجريبي |
| `src/data/learnerHelpers.js` | حساب تقدّم الدورات |
| `src/data/pointsPolicy.js` | إعداد مكافأة الدورة وسجلات المكافآت |
| `src/data/walletHelpers.js` | حساب الرصيد والمكافآت |
| `src/styles/learner.css` | تنسيق واجهات المتعلّم |
| `src/i18n` | ملفات ترجمة الواجهات |

بعض الصفحات الجديدة تحتوي نصوص ترجمتها داخل ملف الصفحة حاليًا.

## بيانات الدورات والصور

المصدر الموحد للدورات هو:

```text
src/data/courses.js
```

الرئيسية والكاتالوج والتفاصيل وصفحات المتعلّم تستخدم نفس سجل الدورة.

كل دورة تحتوي على:

- معرّف فريد.
- عنوان ووصف بالعربية والإنجليزية.
- صورة وفئة ومدرّب ومستوى.
- تكلفة التسجيل بالنقاط.
- كلمات مفتاحية.
- وحدات ودروس ونتائج تعليمية.

عدد الدروس يُحسب من `curriculum`.

لإضافة دورة، أضيفي سجلًا داخل `courseRecords` بمعرّف فريد وفئة موجودة في `categoryKeys`.

ضعي الصور داخل:

```text
public/images
```

واستخدمي مسارًا مثل:

```js
image: "/images/course-cover.png"
```

لا تنسخي بيانات الدورة إلى كل صفحة، ولا تضيفي `public` إلى رابط الصورة.

## إضافة فيديو إلى درس

ضعي الفيديو داخل:

```text
public/videos
```

ثم أضيفي الرابط إلى الدرس الصحيح داخل `courses.js`:

```js
videoUrl: "/videos/photography-intro.mp4"
```

الفيديو يرتبط بالدرس، وليس بالدورة كلها.

عندما لا يحتوي الدرس على `videoUrl`، تعرض صفحة التعلّم صورة الدورة ورسالة توضيحية.

## التقدّم والمهام والنقاط

### الدروس

نحفظ معرّفات الدروس المكتملة، ونحسب منها تقدّم الدورة والوحدات.

التقدّم العام:

```text
الدروس المكتملة في جميع الدورات ÷ مجموع دروس الدورات × 100
```

### المهام

المسودات والتسليمات الحالية محفوظة محليًا في المتصفح.

التسليم التجريبي ينقل المهمة إلى «بانتظار المراجعة»، لكنه لا يرسلها فعليًا إلى المدرّب.

رفع الملفات ومراجعة المدرّب يحتاجان ربطًا بالباك. حاليًا يمكن إدخال شرح ورابط مشاركة للعمل.

### النقاط

- `course.points` تمثّل تكلفة التسجيل.
- `pointsPolicy.courseReward` تمثّل مكافأة إكمال الدورة المعتمدة.
- المكافأة المضبوطة حاليًا حسب التصميم هي 20 نقطة.
- الرصيد الافتتاحي التجريبي موجود في `learnerDemo.points`.
- سجلات المكافآت المعتمدة موجودة في `approvedCourseAwards`.
- لا تُمنح المكافأة تلقائيًا عند إكمال الدروس.
- يمنع حساب مكافأة الدورة نفسها أكثر من مرة.

الالتحاق من تفاصيل الدورة العامة يوجه الزائر إلى تسجيل الدخول. التسجيل الفعلي وخصم المحفظة يحتاجان ربط الباك.

## تنزيل المشروع من GitHub إلى VS Code لأول مرة

هذه الخطوات لمن لا تملك نسخة محلية من الريبو.

افتحي تيرمنال في المكان الذي تريدين حفظ المشروع فيه:

```bash
git clone https://github.com/skillifyproj-creator/esham.git
cd esham
code .
```

إذا لم يعمل `code .`، افتحي VS Code واختاري:

```text
File → Open Folder → esham
```

ثم من تيرمنال VS Code:

```bash
npm install
npm run dev
```

استخدمي نسخة `git clone` للعمل الجماعي بدل تنزيل ZIP ثم تشغيل `git init`.

## سحب آخر التعديلات من GitHub إلى VS Code

عندما ترفع إحدى الزميلتين تعديلات، تنفّذ الأخرى الخطوات التالية داخل مجلد المشروع.

أولًا:

```bash
git status
```

إذا ظهر:

```text
nothing to commit, working tree clean
```

اسحبي آخر نسخة:

```bash
git pull --ff-only origin main
npm install
npm run dev
```

الملفات تتحدّث تلقائيًا داخل المجلد المفتوح في VS Code.

### إذا كانت لديك تعديلات محلية

احفظيها في commit أولًا:

```bash
git add README.md src public
git commit -m "Save local changes"
```

ثم اسحبي تحديثات زميلتك مع إعادة تطبيق تعديلاتك فوقها:

```bash
git pull --rebase origin main
```

إذا نجح الأمر:

```bash
npm install
npm run build
git push origin HEAD:main
```

إذا كان هناك merge أو rebase سابق غير مكتمل، عالجيه أولًا؛ لا تبدئي عملية سحب جديدة.

## رفع التعديلات إلى GitHub

راجعي `git status` قبل التجهيز. توجد حاليًا ملفات غير متتبعة بأسماء تشبه أوامر Git وليست ملفات مشروع؛ لا تضيفيها إلى commit. الأوامر أدناه تجهّز ملفات المشروع فقط. هذه الدفعة لم تُرفع تلقائيًا.

من داخل مجلد المشروع:

```bash
git status
git add README.md src public
git commit -m "Describe your changes"
git pull --rebase origin main
npm run build
git push origin HEAD:main
```

استبدلي رسالة الـ commit بوصف واضح للتعديل.

إذا فشل السحب أو البناء، عالجي الخطأ قبل الرفع.

## التعامل مع التعارضات أثناء السحب

إذا ظهر `CONFLICT`:

1. افتحي الملفات المتعارضة في VS Code.
2. استخدمي Merge Editor لمراجعة التعديل المحلي والقادم من GitHub.
3. ادمجي الكود المطلوب من الطرفين، ولا تختاري نسخة واحدة عشوائيًا.
4. احفظي الملفات وتأكدي من إزالة علامات التعارض.

علامات التعارض تكون بهذا الشكل:

```text
<<<<<<<
=======
>>>>>>>
```

إذا حدث التعارض أثناء `git pull --rebase`، بعد إصلاحه:

```bash
git add README.md src public
git rebase --continue
```

كرّري الإصلاح إذا ظهر تعارض آخر. وبعد انتهاء العملية:

```bash
npm run build
git push origin HEAD:main
```

للعودة إلى الحالة السابقة قبل محاولة الـ rebase:

```bash
git rebase --abort
```

هذا يلغي محاولة الدمج، ولا يحذف الـ commits المحفوظة قبلها.

## قواعد العمل المشترك

- اسحبي تحديثات GitHub قبل بدء العمل عندما تكون نسختك المحلية نظيفة.
- اتفقي مع زميلتك على الملفات التي تعدّلها كل واحدة.
- ارفعي التعديلات على دفعات برسائل commit واضحة.
- لا تنشئي ريبو داخل مجلد المشروع.
- لا تستخدمي `--force` أو `--allow-unrelated-histories` لحل أخطاء الرفع المعتادة.
- لا تحذفي تعديلات زميلتك لمعالجة تعارض.
- لا ترفعي `node_modules` أو ملفات البيئة التي تحتوي أسرارًا.

## الحالة الحالية

المشروع واجهات فرونت مع بيانات ومحاكاة تجريبية.

ما زال يحتاج إلى:

- تسجيل دخول فعلي وحسابات وصلاحيات الأدوار.
- ربط التسجيل بالدورات والمحفظة.
- حفظ البيانات لكل مستخدم في الباك.
- رفع ملفات المهام ومراجعتها.
- اعتماد الدورات ومنح المكافآت والشهادات.
- استكمال الملاحظات والموارد والتقييمات.

عند النشر باستخدام `BrowserRouter`، يجب إعداد الاستضافة لدعم فتح مسارات الصفحات مباشرة.

## مساعد إسهام

- المسارات:
  - `/assistant`
  - `/learner/assistant`
  - `/instructor/assistant`
- زر روبوت دائري يفتح المساعد داخل منطقة المستخدم الحالية.
- لغة المساعد مشتركة مع لغة الموقع.
- يستخدم تصميمه الأصلي الأخضر وخط IBM Plex Sans Arabic.
- تنسيقاته معزولة داخل `.esham-chatbot`، وتصميمه الحالي فاتح.
- الردود والرصيد وبطاقات الدورات أمثلة تجريبية.
- يدعم عرض الصور وPDF وTXT محلياً حتى 10 MB؛ لا يرفعها أو يحللها.
- المحادثة لا تُحفظ عند مغادرة الصفحة أو إعادة تحميلها.
- الربط بخدمة الذكاء الاصطناعي يتم لاحقاً عبر الباك.

## حدود النسخة الحالية

- تفاصيل الدورة توجه الزائر إلى تسجيل الدخول؛ التسجيل الفعلي بالدورات غير مربوط بعد.
- بيانات الليرنر والانستركتر ليست مرتبطة بباك مشترك بعد.
- صفحة منهج الانستركتر الحالية معاينة لدورة التصوير.
- حفظ مهمة الانستركتر لا يخزن المهمة فعلياً بعد.
- إدارة وتحرير الدورات العامة والشهادات وتقارير المراجعة وبعض أدوات المعلّم قيد الاستكمال؛ الأزرار توضّح عدم الإتاحة بدل الانتقال لمسارات مفقودة.
- تسجيل الدخول والصلاحيات ومراجعة المهام والمكافآت تحتاج الربط بالباك.

## نشر معاينة التصميم على Vercel

ملف `vercel.json` يحدد Vite، وأمر البناء `npm run build`، ومجلد الناتج `dist`. تحويل المسارات إلى `index.html` يدعم فتح صفحات React Router مباشرة وتحديثها.

استوردي ريبو `skillifyproj-creator/esham` في Vercel مع اختيار الفرع `main` وجذر الريبو. لا تحتاج معاينة الفرونت الحالية متغيرات بيئة أو باك. بعد النشر افحصي الرئيسية و`/courses` و`/learner` و`/instructor` ثم حدّثي صفحة داخلية للتأكد من عدم ظهور 404.

رابط النشر يعرض تصميمًا وبيانات تجريبية؛ لا يفعّل المصادقة أو الإرسال أو إدارة الحسابات الفعلية. مجلد `.vercel/` محلي ولا يرفع إلى GitHub.

## تحديث تجربة الأدوار والتفضيلات
- التبديل بين واجهتي المتعلّم والمعلّم يظهر للحساب المدمج فقط، مع إعادة توجيه الروابط المخالفة للدور المختار في المعاينة. هذا تنظيم للواجهة وليس مصادقة أو صلاحيات خادم.
- إكمال الإعداد يحفظ الملف والمجالات والأهداف على الجهاز، ويوجّه المستخدم إلى لوحة دوره؛ تُستخدم مجالات التعلّم لترتيب اقتراحات الدورات.
- أهداف مستقلة للمتعلّم والمعلّم والحساب المدمج بالعربية والإنجليزية.
- أدوات اللغة والمظهر والإعدادات والتبديل تظهر داخل القائمة الموسعة على الموبايل لتقليل ارتفاع الهيدر.
- رصيد المتعلّم الافتتاحي التجريبي 50 نقطة، ومكافأة الإكمال 20 نقطة بعد الاعتماد؛ رصيد الهيدر موحد بين المسارين للحساب المدمج، وأرباح التدريس في لوحة المعلّم بيانات تجريبية منفصلة عن المحفظة.

- بحث مباشر في مجالات اختيار الحساب والتعديل على الملف، في مساري التعلّم والتعليم؛ يطابق الاسم والوصف، ويحافظ على الاختيارات عند تصفية النتائج، مع حالة عدم وجود نتائج.

- بحث المجالات يدعم كلمات مفتاحية عربية وإنجليزية مثل كود/code للبرمجة وكاميرا للتصوير، في اختيار مجالات التعلّم والتعليم.

### مراجع الكلمات المفتاحية للمجالات
قائمة عربية وإنجليزية منتقاة من مصطلحات المجالات والأدوات، وليست ترتيبًا إحصائيًا عالميًا لحجم البحث. تشمل المرادفات وطرق الكتابة الشائعة، وتسمح للكلمة بالظهور في أكثر من مجال عند ارتباطها به.
- https://www.coursera.org/browse
- https://www.coursera.org/articles/how-to-improve-graphic-design-skills
- https://www.coursera.org/articles/digital-marketing
- https://www.adobe.com/creativecloud/photography/hub/guides/camera-exposure-camera-settings.html
- https://www.craftsy.com/all-classes


## مراجعة النسخة المدمجة — 7 أكتوبر 2026

تمت مقارنة ce3e7f4 بإضافتي cb4fc33 و4bf5c80. احتُفظ بإعداد الحساب والأدوار والبحث السابق، وبإضافات المعلّم والأدمن، مع إصلاح الأخطاء التالية:

- صور المصادقة والاستعادة على اليمين بالعربية واليسار بالإنجليزية.
- مصدر موحد للتصنيفات في `src/data/categories.js` يستخدمه إعداد الحساب والكتالوج وإنشاء الدورة وبيانات الأدمن؛ ترتيب اهتمامات الملفات السابقة محفوظ. علوم البيانات تصنيف فرعي للبرمجة، مع دعم أسماء التصنيفات القديمة.
- تطبيع الدور المنفرد والهايبرد من الأعلام وقوائم الأدوار، ومعالجة التخزين غير المتاح. إعدادات الحساب لا تحوّل الدور إلى هايبرد تلقائيًا؛ تظهر اهتمامات التعلّم والتعليم حسب دور الحساب.
- إصلاح إنشاء المدير والتصنيف والإعلان، والتحقق من البريد واسم التصنيف المكرر والحقول الفارغة، وربط الإسناد بين المدير والتصنيف.
- ترجمة حالات الأدمن وتصنيفاته وتواريخه، وإصلاح البحث والنتائج الفارغة وسجل النشاط، واستخدام نافذة dialog المشتركة.
- قبول الدورة يتطلب استكمال قائمة المراجعة. خدمة المراجعة تمنع القرارات خارج نطاق التصنيفات أو إعادة القرار على دورة ليست قيد المراجعة.
- فصل تكلفة التسجيل عن مكافأة الإكمال، وإزالة وصف المدرّب بأنه معتمد تلقائيًا ورسائل النجاح التي توحي بتنفيذ خدمة غير متصلة.
- مسودة الدورة الجديدة تحفظ في sessionStorage، وتستعاد عند الرجوع أو التحديث، وتنتقل ببياناتها إلى المنهج والمراجعة. صورة الغلاف تحفظ كبيانات معاينة محلية، مع التحقق من الصيغة وحد 2MB.
- الدروس والمهمات تحفظ في الدورة والقسم الصحيحين؛ القسم الجديد لا يحتوي مهمة تصوير جاهزة. المسار غير الصحيح يعرض حالة عدم العثور بدل التعطل أو عرض دورة أخرى.
- ترجمة واجهات تعديل الدرس والمهمة والمراجعة إلى العربية والإنجليزية. درس القراءة لا يتطلب فيديو؛ مدة الدرس بين 1 و600 دقيقة، وحتى ثلاثة أهداف دون تكرار.
- المهمة تبدأ فارغة، وتدعم الوصف والتعليمات ونوع التسليم ومعايير التقييم ومعاينة الطالب والحفظ والإزالة. الموارد تدعم أسماء ملفات معاينة وإزالتها مع حدود عدد الملفات والحجم.
- جاهزية الدرس والمهمة والمنهج والمراجعة محسوبة من المحتوى، ولا تعتمد على 100% ثابتة أو حالة ready قديمة وحدها. جاهزية المنهج منفصلة عن اكتمال معلومات الدورة.
- أدوات الفيديو ترجع للدورة الحالية، مع توضيح أن التسجيل والتشغيل والقص محاكاة؛ لا يُنشأ أو يُرفع فيديو فعليًا. إصلاح سياق محرر الفيديو.
- توضيح مؤشرات الأداء التجريبية والردود المؤقتة، وترجمة رؤوس CSV ومنع تفسير النصوص المصدّرة كصيغ جداول.
- تحميل صفحات المعلّم والمتعلّم والأدمن عند الحاجة؛ JavaScript الرئيسي نحو 438 kB بعد أن كان نحو 779 kB. اختفى تحذير تجاوز 500 kB، وبقي تحذير use client من React Router دون فشل البناء.

### التحقق

`npm test` يشغّل 11 اختبار تراجع تشمل التصنيفات والأدوار والتخزين ومسودة الدورة ونطاق المراجعة والإشعارات والجاهزية. تتضمن الاختبارات عرض صفحات المتعلّم الثماني وصفحات المعلّم الأربع عشرة باللغتين داخل السياقات المشتركة.

`npm run build` ناجح. جرى فحص 30 مسارًا في نسخة الإنتاج، ثم مسارات تعديل الدرس والفيديو والحالات غير الموجودة، مع فحص الموبايل بعرض 390px. جُرّب إنشاء مهمة ودرس قراءة وحفظهما داخل القسم الصحيح، وإضافة مدير مع منع البريد المكرر، وقراءة الإشعارات وتصفية النتائج الفارغة. هذه سيناريوهات محددة، وليست إثباتًا لكل حالة محتملة.

### حدود النسخة الحالية

هذه واجهة عرض تجريبية: المصادقة وصلاحيات الخادم والنشر وإرسال الدورة للأدمن والتسجيل الحقيقي للفيديو ورفع الملفات تحتاج خدمات فعلية. بيانات المعلّم والمتعلّم والأدمن التجريبية لا تتزامن كقاعدة بيانات واحدة. إضافة تصنيف من الأدمن مؤقتة داخل معاينته؛ ظهور التصنيف الجديد في جميع الحسابات يحتاج الربط المشترك بالخادم. مسودة الدورة الجديدة خاصة بجلسة التبويب، وتعديلات الدورات التجريبية الأخرى مؤقتة. الغلاف بيانات محلية وليس ملفًا مرفوعًا، والمرفقات أسماء وبيانات معاينة فقط.


### Course workload and safety policy (2026-10-07)
- Courses require 1–3 assessed tasks overall; sections do not each require a task. Workspace mutations reject a fourth task.
- Instructor review and category administrator review show the safety policy. Administrator preview warnings require verified evidence, incident ID, reason, correction and deadline. Duplicate incident IDs are rejected. Warning 2 pauses enrollment in the local policy state; warning 3 archives while preserving warning history. Urgent suspension and instructor appeal preview controls are available.
- These are local browser previews. Admin and instructor demo course IDs remain separate; notifications, real AI video/audio/transcript scanning, shared server authorization, enrollment enforcement and catalog archiving need backend integration. Ratings/reports must trigger investigation, not automatic warnings. Risk and AI confidence must be separate.

### Post-completion recommendations
- Completed lessons and approved/completed tasks unlock the review invitation. Saved eligible reviews show up to three same-category suggestions, excluding enrolled courses. Feedback keywords influence topic and level; low ratings favor alternative instructors.
- This is an explicitly labeled deterministic local fallback, not an AI response. A future authenticated backend must obtain consent as appropriate, send the relevant rating/feedback to the AI service, validate returned catalog IDs and filter availability/access before display. No feedback is sent externally by this preview.

### Frontend re-audit (2026-10-07)
- Production browser smoke check: 46 desktop visits (including redirects for incomplete onboarding), 17 mobile pages and 7 English mobile pages. No horizontal overflow, broken images or browser errors observed in checked pages.
- Fixed bilingual task-policy wording, added course task count and disabled add buttons at three tasks. Curriculum state now retains the previous value if saving fails.
- Hardened safety local storage and deadline validation; made its device-only, non-synchronized nature explicit. Added a route-resetting error boundary with reload/home recovery.
- 16 tests pass, including administrator rendering in both languages. Production build passes; React Router use-client bundling warning remains.
- NOT feature-complete for production: administrative authentication/authorization, actual enrollment, upload/playback/recording, publication, notifications and persistence need services. AI safety and recommendations remain previews. Admin warnings and instructor courses use distinct demo IDs and are not linked end-to-end.
- Remaining frontend/product work: learner report submission and an admin moderation queue; certificate views/issuance workflow; instructor review-report details; help, instructor guidelines and approved privacy/terms copy. Existing buttons explain unavailability instead of pretending these workflows are finished.

### Certificates, reports and remaining frontend pages (2026-10-07)
- Learner certificates: /learner/certificates and /learner/certificates/:courseId. Platform-branded bilingual certificate previews include learner/course names and instructor name in Aref Ruqaa/Marck Script signature-style fonts, with a clearly visible preview watermark. Completed lessons and approved tasks are required. Print/save PDF uses browser printing. Dates, verified identifiers and actual issuance require server responses; no fake dates or verification IDs are generated.
- Reports: course details and lesson pages open a validated reason/description/timestamp form. Reports are saved locally and available at /admin/moderation and /category-admin/moderation, filtered by assigned category in the latter. Duplicate open reports are blocked. Administrators can investigate, record outcomes, resolve or dismiss; reports do not automatically issue warnings.
- Local warning records from the report queue use catalog IDs; photography/design/marketing instructor courses with known public mappings read the same record. Legacy independent admin course fixtures remain separate.
- New pages: /instructor/certificates, /instructor/courses/:courseId/review-report, and /help/support|guidelines|privacy|terms. Instructor shortcuts and footer links now open these pages. Privacy/terms are preliminary project content requiring owner approval, not final legal policies.
- Video screening status UI distinguishes risk/confidence and explicitly says no analysis has occurred before a service is connected.
- 19 automated tests pass; local browser report submit-to-admin-and-dismiss flow verified on isolated preview origin. Eleven new mobile page visits show no horizontal overflow. Backend must still supply authentication, permissions, persistence, actual certificates/verification, uploads/scans, notifications and publication/enrollment enforcement.

- Certificate print correction: remove surrounding application content from pagination, use a fixed A4 landscape certificate (277 × 188 mm within 10 mm margins), and compact print-only typography/signature spacing so the footer stays on the same sheet.
