# إسهام | Esham Platform

Esham combines learner, instructor/hybrid, GeneralAdmin and CategoryAdmin workspaces. The implementation is React/Vite in `frontend/`, ASP.NET Core 9 / EF Core / Identity / SQL Server in `backend/`, and independent Node.js AI services in `ai/`.

**Implementation and handoff status: November 6, 2026.** Server-backed course management, moderation/publication, administration and instructor reporting are implemented and tested. The complete learner enrollment/completion/reward workflow is **not finished**. Existing learner browser previews must not be treated as authoritative business records.

The 20/20/20 points policy remains the intended rule. Existing server account finalization already grants the one-time welcome credit; enrollment debit and instructor enrollment reward still require Mais's atomic learner-side implementation. Do not grant points for lesson completion, submissions or reviews.

## Current implementation and ownership

| Area | Implemented / tested | Remaining or limited |
| --- | --- | --- |
| Identity / account setup | Real cookie sessions, server roles, profile/category setup, account finalization, welcome wallet credit and idempotency tests | Forgot/reset-password frontend lacks backend recovery endpoints; unsupported account actions must not report success |
| Database | SQL Server domain model and three EF migrations; course update migration tested on restored test DB and applied/verified on shared DB with approval | No automatic migration/reseed on startup; new shared changes require coordinator approval |
| Courses and media | Owned course drafts, curriculum, lessons, tasks, cover/media persistence, readiness and protected media reads | AI execution is a separate service; AI output is not publication authority |
| Moderation/publication | Real submit, pending review, assigned CategoryAdmin approval/rejection/changes, content-based resubmission validation, approved-version publication and retained snapshots | GeneralAdmin has oversight; assigned CategoryAdmin decides publication under current policy |
| Course-version updates | Stable logical lesson/task IDs, append-only enrollment/version access, publication integration and deduplicated notifications, read-only learner version state | Mais must integrate enrollment staging and learner writes; original Enrollment.CourseVersionId remains historical |
| Admin / CategoryAdmin | Existing 17 routes, real distinct-course statistics/reports/activity, categories, existing-member scope assignments, CategoryAdmin provisioning, users, announcements, reports/warnings/appeals; bilingual responsive UI and collapsible sidebars; no Footer | Category metadata and assignment saves are separate operations with explicit partial-success feedback; GeneralAdmin-only CategoryAdmin creation with atomic initial assignments; no existing-account promotion |
| Instructor reporting | Real dashboard/performance, read-only persisted course ratings, own-course submissions/details/attachments and immutable review decisions | Populated data depends on learner writes; watch duration is unavailable, not inferred from resume position |
| Public discovery/details | Persisted published catalog, trusted educational categories, cover images, safe published sections/lesson outline and aggregate ratings; freshness on navigation/focus | No protected video, attachment or task-instruction exposure; enrollment is explicitly unavailable until learner services exist |
| Themes / layout | Existing Admin/CategoryAdmin refinement, RTL/LTR, responsive navigation, burgundy Dark Mode, original logo/logo2 switching | Chatbot appearance is excluded; theme preferences are UI storage, not business persistence |
| Learner journeys | Existing UI, real public catalog, account/session and notification integration; version-state adapter and shared entities | Enrollment/payment, progress, learner attempt/rating writes, reconciliation and certificate issuance remain unfinished; several screens still use local/demo data |
| AI, chatbot and video | Existing implementation and detailed documentation below are retained | Provider/network/hosting dependencies and the existing documented limits still apply |

### Fatima — completed backend and integration work

- SQL Server schema/migrations, relationships, constraints and reviewed recovery/migration evidence. Migrations: `20261017130121_InitialIdentity`, `20261023195532_AddEshamDomainModel`, `20261105182722_AddCourseVersionUpdates`.
- Instructor-owned course/curriculum/task/media management, readiness and submission eligibility.
- Transactional course moderation, revision/publication, historical snapshot preservation, review decisions, audit activity and publication notifications.
- Version availability receipts and logical identity/achievement projection; existing enrollments and earned evidence are preserved.
- GeneralAdmin/CategoryAdmin backend integration, category CRUD and GeneralAdmin-only assignments to existing CategoryAdmin members; no automatic Identity role grants.
- Announcements, content reports, warnings, appeals (GeneralAdmin final appeal decisions), activity, authorization/scope checks and existing admin UI refinement.
- Existing Instructor Dashboard, Performance, Ratings & Reviews and Student Submissions API integration.

Details: [moderation/publishing](docs/course-moderation-publishing.md), [version handoff](docs/course-version-updates-handoff.md), [platform moderation](docs/platform-moderation-backend.md), [admin integration](docs/admin-backend-integration.md), [instructor integration](docs/instructor-backend-integration.md), [admin UI](docs/admin-ui-refinement.md).

### Latest integrated behavior

- **Submit → review → revision → publish:** only the owning Instructor submits a ready draft. An independently assigned CategoryAdmin decides; GeneralAdmin has oversight and makes final appeal decisions. Decisions, feedback and activity remain persisted. Publication selects the approved snapshot transactionally and preserves earlier versions.
- **Meaningful resubmission:** after Request Changes, compare normalized course details, ordered curriculum, tasks and immutable media against the preserved reviewed snapshot. Cloning, unchanged Save, timestamps/version numbers and edit-then-revert do not qualify. Backend code `course_resubmission_unchanged` triggers the existing accessible bilingual warning dialog. Other errors remain distinct; no rejected request produces a success state.
- **Persisted owner notices:** Request Changes includes feedback and a review link; successful approval/publication produces one owner notice and a public-course link in the same transaction. Recipients and targets are resolved server-side; concurrent/repeated decisions cannot duplicate the event. Learner course-update notices remain independent. Historical missing notices are not backfilled automatically.
- **Trusted categories:** public educational endpoints, onboarding/preferences, course category validation and published discovery share an active-category policy excluding four specifically audited fixture IDs. It does not guess from names or language, delete records, or change administrative assignments. GeneralAdmin management still sees all records; CategoryAdmin remains assigned-category scoped.
- **Real public details:** `/courses/:courseId` uses persisted published title/description, cover, instructor, category, objectives, ordered sections and lesson titles/types. Rating summaries use existing persisted reviews. Tasks expose a count only because no public-task visibility contract exists. Video files, lesson bodies, private attachments and task instructions remain protected. Later drafts never replace the selected public version.
- **Instructor View Course:** public published details are separate from editing and owner-only draft preview. Dashboard/Performance/Ratings/Submissions use real Instructor APIs. Some older My Courses summary/card metrics still use placeholder counts or local wallet previews; do not treat those as completed learner accounting.
- **Existing design:** Admin/CategoryAdmin retain their existing routes, warm light surfaces, collapsible RTL/LTR sidebar and no footer. Dark Mode uses the existing `frontend/src/styles/global.css` palette, including `--primary-00: #2C151A`, cream text and established green/purple accents. `frontend/src/components/ThemeLogo.jsx` switches `frontend/src/assets/esham-logo.png` / `frontend/src/assets/logo2.png`; original proportions are preserved. Chatbot styling/logo is excluded, and print/PDF behavior retains its existing asset policy.

### Architecture and persisted models

`frontend/` talks to the .NET API through the public `VITE_API_BASE_URL`; cookie sessions remain server-owned. `backend/esham.PL` contains HTTP endpoints/configuration, `esham.BLL` services/contracts, and `esham.DAL` EF entities/configuration/migrations. `esham.Tests` is a separate test project. Node services in `ai/` are independent from SQL-backed account/course APIs; Vite proxies local AI requests.

Identity uses Guest access plus Learner, Instructor/Hybrid, GeneralAdmin and CategoryAdmin permissions. Hybrid is the learner/instructor persona combination, not permission to administer categories. Public registration cannot grant administrative roles. GeneralAdmin provisions new CategoryAdmin accounts and their initial assignments using Identity and the existing assignment model. Ordinary users cannot promote themselves or acquire moderation responsibility by selecting interests.

The current EF model includes Identity/ApplicationUser; Category/UserCategory/CategoryAdminAssignment; Course/CourseVersion/CourseSection/Lesson/CourseTask and immutable media/attachments/screening records; Enrollment/EnrollmentVersionAccess/LessonProgress; TaskSubmission/TaskSubmissionReview/CourseReview/Certificate; Wallet/PointTransaction; Notification/Announcement/CourseReviewDecision/AdminActivityLog and course reports/warnings/appeals. An entity or frontend page existing does **not** mean its learner write service is finished.

The three migrations listed above are the existing source history; the approved course-update migration has already been applied to the coordinated shared installation. Hosted SQL connection settings belong in the PL project's existing User Secrets or deployment environment. Backup files, database exports and coordinator recovery/account reports are private operational material, not GitHub application source. Do not replay applied SQL or run migrations as a startup step.

### Mais — remaining learner responsibilities

1. Implement learner-owned Enrollment service/endpoints, eligibility and access; call `ICourseVersionUpdates.StageEnrollmentAsync` inside the enrollment transaction.
2. Atomically debit the learner wallet and credit the instructor enrollment reward using the immutable PointTransaction ledger, stable operation keys, idempotency and concurrency/rollback protection. Reuse existing welcome-credit finalization rather than granting it again.
3. Persist LessonProgress with enrollment/course/version ownership, completion evidence and safe resume-position validation.
4. Implement learner TaskSubmission draft/upload/submit/revision-attempt APIs, submitted-work locking and IsOptionalAtCreation. Coordinate with existing immutable TaskSubmissionReview evidence; never overwrite an earlier approval.
5. Implement eligible CourseReview writes and explicit version attribution. Instructor ratings remain read-only views of persisted reviews.
6. Reconcile mandatory lesson/task completion using logical identity and version access. Preserve already completed courses, dates and historical achievements; new content is optional for completed learners.
7. Issue certificates from server-verified completion with immutable attribution, unique verification IDs and idempotency; replace browser preview authority.
8. Connect existing learner pages to these real APIs and replace their local/demo business records only after server behavior works.

Do not redesign shared entities, repin original enrollments, reset achievements, charge for course updates or duplicate Fatima's services. Follow the **course-first lock order** and detailed contracts in [the version handoff](docs/course-version-updates-handoff.md) and [instructor handoff](docs/instructor-backend-integration.md).

## تشغيل المشروع بنفسك من VS Code — PowerShell

هذا الدليل هو المرجع الحالي للتشغيل المتكامل على **5173 للفرونت** و**5206 للباك**. الأقسام التاريخية الخاصة بالـAI على 5174 محفوظة أدناه؛ لا تخلط عناوين `localhost` و`127.0.0.1` أو منافذ الواجهة داخل الجلسة نفسها.

### 1. افتح المجلد الصحيح

من VS Code اختر **File → Open Folder** ثم مجلد `esham` الذي يحتوي `README.md` و`frontend` و`backend` و`ai`. لا تفتح `backend` وحده إذا أردت تشغيل المشروع كاملًا. افتح الطرفية من **Terminal → New Terminal** واختر **PowerShell**.

```powershell
Get-Location
git rev-parse --show-toplevel
```

الأمر الثاني يعرض جذر المستودع فقط، ولا يسحب أو يرفع ملفات. من أي مجلد داخل هذا المستودع يمكنك العودة للجذر:

```powershell
Set-Location (git rev-parse --show-toplevel)
```

إذا ظهر `not a git repository`، افتح مجلد `esham` الصحيح أولًا. المسارات التي تحتوي فراغات تحتاج علامات اقتباس عند كتابتها يدويًا.

### 2. المتطلبات والإعداد مرة واحدة

يلزم .NET SDK **9**، وNode.js **22.12+** مع npm، وGit للطريقة أعلاه، وإعداد اتصال SQL Server المعتمد. ملف `.nvmrc` يحدد Node 22؛ بيئة التحقق الحالية استخدمت .NET 9.0.305 وNode 24.14.0 وnpm 11.9.0.

```powershell
dotnet --list-sdks
node --version
npm --version
```

عند تنزيل نسخة جديدة أو غياب الاعتمادات، نفّذ من الجذر:

```powershell
npm ci
dotnet restore .\backend\esham.sln
```

`npm ci` في الجذر يشغّل تثبيت اعتماديات `frontend/` من ملف القفل تلقائيًا. لا تحتاج تكراره عند كل تشغيل. اختبارات الباك في مشروع مستقل خارج قائمة مشاريع الـsolution؛ أمر اختبارها موضح أدناه.

باك .NET يقرأ `ConnectionStrings:DefaultConnection` من **User Secrets الخاصة بـbackend/esham.PL** أو `ConnectionStrings__DefaultConnection`. الإعداد الموجود على جهازك يُعاد استخدامه؛ لا تستبدل كلمة المرور أو تضع الاتصال في ملف متعقّب. عند إعداد جهاز جديد اطلب من منسق قاعدة البيانات تهيئة الاتصال الآمن. لا تستخدم `dotnet user-secrets list` لنسخ النتائج أو إرسالها، لأنه قد يعرض أسرارًا. `backend/.env.example` مخطط تاريخي، وليس مصدر إعداد ASP.NET Core تلقائيًا.

تحقق أن `frontend/.env.local` الموجود محليًا يحتوي العنوان العام التالي. **لا تستبدل الملف كاملًا** إذا كان فيه إعدادات أخرى:

```dotenv
VITE_API_BASE_URL=http://localhost:5206
VITE_GOOGLE_AUTH_ENABLED=false
```

عند عدم وجود الملف فقط، يمكن نسخ `.env.example` من داخل `frontend/`. لا تضع مفاتيح AI أو كلمات مرور SQL في `VITE_*`؛ هذه القيم تصبح متاحة للمتصفح. لا ترفع `.env.local` أو `ai/.env` إلى Git.

### 3. Terminal 1 — تشغيل الباك

افتح Terminal جديدًا ونفّذ:

```powershell
Set-Location (git rev-parse --show-toplevel)
Set-Location .\backend\esham.PL
Test-Path .\esham.PL.csproj
$env:SeedData__Enabled='false'
$env:SeedData__DemoCourses='false'
dotnet run --launch-profile http
```

يجب أن تكون نتيجة `Test-Path` هي `True`. ملف `Properties/launchSettings.json` يضبط بيئة **Development** والعنوان **http://localhost:5206**. متغيرا SeedData أعلاه مطلوبان في كل Terminal جديد عند استخدام القاعدة المشتركة: الإعداد البرمجي الافتراضي يسمح بالـseeding إذا غابا. لا تنفّذ `dotnet ef database update` أو SQL ترحيل أو إعادة ضبط/تهيئة قاعدة البيانات ضمن التشغيل العادي.

رسائل النجاح المتوقعة:

```text
Now listening on: http://localhost:5206
Application started. Press Ctrl+C to shut down.
Hosting environment: Development
```

اترك Terminal 1 يعمل. نجاح الاستماع وحده لا يثبت اتصال SQL؛ اختبار GET في الخطوة التالية يقرأ بيانات حقيقية ويؤكد ذلك. الملفات المرفوعة تحتاج أيضًا التخزين المحلي المعتمد أو مزود الوسائط؛ وجودها في قاعدة SQL لا يعيد ملفات الصور/الفيديو إلى جهاز جديد. `backend/storage/` ليس مادة للرفع إلى Git.

### 4. Swagger والتحقق الآمن من SQL/API

افتح **http://localhost:5206/swagger**. اختر `GET /api/categories` ثم **Try it out → Execute**؛ النتيجة المتوقعة **200** وتصنيفات تعليمية من قاعدة البيانات. يمكن أيضًا استخدام `GET /api/courses/public` دون تغيير بيانات. لا تختبر أزرار POST/PUT/PATCH/DELETE على بيانات حقيقية لمجرد التأكد من التشغيل.

في Terminal تحقق منفصل يمكنك تنفيذ:

```powershell
Invoke-RestMethod 'http://localhost:5206/api/categories' | ForEach-Object { $_ } | Select-Object id,nameAr,nameEn
Invoke-RestMethod 'http://localhost:5206/api/courses/public' | ForEach-Object { $_ } | Select-Object courseId,publishedVersionId,titleAr,titleEn
```

هذان الطلبان قراءة فقط. إذا فشلا بخطأ اتصال SQL، راجع الاتصال الآمن/صلاحيات الاستضافة مع المنسق، وليس بإنشاء قاعدة جديدة أو تشغيل migrations.

المصادقة الحالية **كوكي Identity باسم Esham.Identity** وليست JWT/Bearer. لا تحتاج دخولًا للـGET العام. للـendpoints المحمية تستخدم جلسة الحساب المصرح به في المتصفح نفسه وعلى `localhost`، وتبقى صلاحيات الباك نافذة؛ Swagger لا يتجاوزها. بعض إجراءات الإدارة تحتاج ترويسات التطبيق/Origin؛ استخدم الواجهة القائمة لتلك الإجراءات، ولا تتجاوز حمايتها في Swagger. لا يوجد دخول تلقائي بحساب تطوير.

### 5. Terminal 2 — تشغيل الفرونت

اترك الباك مفتوحًا، ثم **Terminal → New Terminal**:

```powershell
Set-Location (git rev-parse --show-toplevel)
Set-Location .\frontend
Test-Path .\package.json
npm run dev -- --host localhost --port 5173
```

انتظر الرسالة:

```text
Local: http://localhost:5173/
```

افتح **http://localhost:5173/**. نافذة خاصة جديدة تعرض الزائر دون حذف كوكيز متصفحك الحالي. ظهور حساب سابق في نافذة عادية يعني استعادة جلسة موجودة، وليس دخولًا تلقائيًا. استخدم الواجهة لتسجيل الخروج إذا أردت، ولا تحذف جلسات/بيانات الآخرين.

الأمر الصريح يحدد **5173**. أما `npm run dev` وحده فإعداد Vite الحالي يختار **5174** مع `strictPort` ولا ينتقل تلقائيًا عند انشغال المنفذ. لا تستخدم منفذي الاختبار **5175/5216** مع القاعدة المشتركة.

### 6. كيف تتأكد أن الفرونت متصل بالباك الحقيقي؟

افتح أدوات المتصفح **F12 → Network → Fetch/XHR** ثم صفحة الدورات. ابحث عن:

- `http://localhost:5206/api/categories`
- `http://localhost:5206/api/courses/public`
- `http://localhost:5206/api/courses/public/{courseId}` عند فتح دورة منشورة.
- `GET /auth/session` للتحقق من الجلسة؛ **401 طبيعي للزائر**.

المعرّفات والعناوين في الاستجابة تأتي من SQL. لا تخلط بين ذلك وبين بيانات التسجيل/التقدم المحلية القديمة التي لم تُستبدل بعد بخدمات Mais. الاختيار الإداري للتصنيفات مستقل عن اهتمامات المتعلّم.

الفرونت يرسل طلبات API مباشرة إلى `VITE_API_BASE_URL` مع كوكيز الجلسة. إعداد Development CORS في `backend/esham.PL/appsettings.Development.json` يسمح بـ`http://localhost:5173` و5174. لا يوجد proxy لباك الحسابات على 5206؛ الـproxy الموجود في `frontend/vite.config.js` خاص بالـAI فقط. أعد تشغيل Vite بعد تغيير `.env.local`؛ لا تتوقع أن يتغير عنوان API في عملية Vite مفتوحة سابقًا.

### 7. خدمات AI الاختيارية — Terminal 3 وTerminal 4

الحسابات والكتالوج والتصنيفات وتفاصيل الدورات وإدارة المقررات والمراجعة والإدارة تعمل بخدمتي الباك والفرونت فقط. ميزات المحادثة/التوصيات الخارجية وفحص الفيديو تحتاج خدمات AI المستقلة وإعداد مزود صالح. لا تحتاج خدمة AI لمجرد فتح الموقع أو Swagger.

من **جذر المشروع** في Terminal 3:

```powershell
Set-Location (git rev-parse --show-toplevel)
npm --prefix ai run assistant
```

الخدمة: **http://127.0.0.1:8001** للمساعد/المستندات/التوصيات. وفي Terminal 4:

```powershell
Set-Location (git rev-parse --show-toplevel)
npm --prefix ai start
```

الخدمة: **http://127.0.0.1:8000** لفحص الفيديو. `ai/.env.example` يشرح الإعداد؛ إنشاء `ai/.env` وتهيئة مفاتيح المزود إجراء محلي سري. لا تستبدل ملفًا موجودًا ولا تضع المفتاح في الفرونت. الخدمات تستعمل `--env-file-if-exists=.env` من مجلد `ai` تلقائيًا. بدون `.env` يمكن أن تبدأ الخدمتان، لكن `configured:false` يعني أن الاستدلال الحي غير جاهز؛ نجاح health لا يثبت صلاحية نموذج أو مفتاح خارجي.

بعد تشغيل Vite، طلبا الصحة الآتيان لا يستدعيان نموذجًا مدفوعًا:

```powershell
Invoke-RestMethod 'http://localhost:5173/ai/assistant/health'
Invoke-RestMethod 'http://localhost:5173/ai/health'
```

Vite يمرر `/ai/assistant` إلى 8001 و`/ai` إلى 8000. البروكسي يضبط Origin التطوير التاريخي `http://127.0.0.1:5174`؛ لذلك فتح `/health` مباشرة على منفذ AI دون Origin مسموح قد يعيد **403** رغم أن الخدمة تعمل. لا تغيّر أمان الخدمة لحل ذلك؛ استخدم البروكسي أعلاه. إعداد بوابة الإنتاج مختلف وموثق في [دليل AI](ai/DEPLOYMENT.md).

### 8. الإيقاف وإعادة التشغيل

لإيقاف خدمة، انتقل إلى Terminal الذي يشغّلها واضغط **Ctrl+C**. أوقف كل Terminal على حدة؛ لا تحذف ملفات قاعدة البيانات أو الوسائط. إغلاق VS Code أو إعادة تشغيل Windows يعني أنك تحتاج تكرار خطوات Terminal 1 و2، ومعهما 3 و4 فقط إذا احتجت AI. لا تحتاج إعادة تثبيت المكتبات كل مرة. متغيرا تعطيل SeedData غير دائمين؛ اكتبهما مجددًا قبل الباك.

### 9. حل المشكلات الشائعة

| المشكلة | التحقق والإجراء |
|---|---|
| المنفذ مشغول / EADDRINUSE / address already in use | لا تشغّل نسخة ثانية. استخدم `Get-NetTCPConnection -LocalPort 5206 -State Listen` أو استبدل المنفذ بـ5173 لمعرفة OwningProcess، ثم `Get-Process -Id <PID>`. أوقف خدمتك المعروفة من Terminal عبر Ctrl+C. لا توقف كل عمليات dotnet/node أو عملية مجهولة. |
| الفرونت يعرض تعذّر الاتصال بالخادم | تأكد أن Terminal الباك يعمل وأن Swagger/GET categories ينجحان. راجع العنوان 5206 في `.env.local` ثم أعد تشغيل Vite. |
| Swagger لا يفتح | راجع أول خطأ في Terminal الباك؛ استخدم launch-profile http وبيئة Development وعنوان 5206، وليس عنوان الفرونت أو منفذ HTTPS المختلف. |
| خطأ SQL / login / firewall / timeout | راجع User Secrets الحالية، الاتصال بالشبكة وقيود الاستضافة مع المنسق. لا تنشر الاتصال ولا تغيّر كلمة المرور أو مخطط القاعدة لتجربة الحل. |
| npm أو الحزم مفقودة | افحص Node/npm والإصدار، ثم شغّل `npm ci` من الجذر أو `npm ci` داخل frontend عند الحاجة. لا تحذف ملفات القفل تلقائيًا. |
| API يعمل مباشرة والواجهة تفشل | افحص Network وCORS؛ استخدم localhost في الطرفين، وتحقق من VITE_API_BASE_URL وأعد تشغيل Vite بعد أي تغيير. |
| محتوى قديم أو حساب سابق | ارجع للصفحة أو ركّز التبويب لتحديث الكتالوج، ثم حدّث الصفحة إذا لزم. استخدم نافذة خاصة لاختبار الزائر. لا تمسح localStorage/الكوكيز تلقائيًا؛ قد تحتوي عملًا أو جلسة محفوظة. |
| صور/فيديو مفقودة رغم اتصال SQL | تحقق من التخزين المعتمد وملفات الوسائط على الجهاز/الخادم؛ لا تعالج ذلك بحقن صور أو محتوى وهمي في الكتالوج. |
| AI يعيد 502 أو configured:false | شغّل Terminal الخدمة المطلوبة، تحقق من health عبر Vite ومن تهيئة المفتاح محليًا. الموقع الأساسي يعمل دونها؛ لم تُختبر صلاحية المزود باستدعاء مدفوع ضمن هذا التسليم. |

## Regression checks and handoff gate

From the repository root, preferably after stopping your normal backend before rebuilding its output:

```powershell
dotnet build .\backend\esham.sln --no-restore
dotnet test .\backend\esham.Tests\esham.Tests.csproj
npm test
npm run build
npm --prefix ai test
git diff --check
```

The solution currently contains PL/BLL/DAL only; testing the solution is not a substitute for explicitly running `esham.Tests`. The explicit `dotnet test` command restores missing test-project assets automatically; use `--no-restore` only after that project has been restored. No command above applies EF migrations.

Latest full handoff verification (November 6, 2026): **backend build passed with zero warnings/errors; 337 backend tests passed / 33 SQL opt-in tests skipped; 125 frontend tests passed; production build passed; 23 AI tests passed; 2 Python data-preparation tests passed.** Existing third-party frontend bundler warnings do not fail the build. Recent targeted isolated SQL/category/onboarding/translation verification passed 28 tests. Optional AI startup/proxy health also passed; this local checkout has no AI keys configured and no prepared external course index (`configured:false`, `courseCount:0`), so live provider inference was not verified. Prior feature checks covered Arabic/English, Light/Dark and desktop/mobile, including published outlines, protected media, notification persistence and moderation scope; this handoff additionally verifies fresh Guest startup/read-only API connectivity.

SQL mutation tests are opt-in and require an explicitly provisioned disposable `Esham_AccountTests_*` database, never shared User Secrets as a fallback. Browser verification now refuses shared ports, checks the API's actual LocalDB isolation and confirms the frontend API target before actions. Legacy cleanup scripts require explicit isolated SQL configuration. Test manifests, browser sessions, screenshots and credential files belong in OS temp or ignored local output, never Git.

Public publishing metadata and test fixture code are not database backups. Account membership audits, provider recovery evidence and row-level operational exports must be reviewed separately and must not be uploaded merely because they are under docs/. No staging, commit or push is authorized by these checks.

## تشغيل خدمات AI بعد إعادة فتح المشروع

التشغيل الأساسي المتكامل موضح أعلاه على5173 مع باك5206. إذا استخدمت إعداد AI التاريخي على `http://127.0.0.1:5174/` فشغّل الفرونت صراحةً بهذا الأصل وحافظ على إعداد CORS الموافق؛ لا تخلط جلسات وأصول5173 و5174 أو تستخدم منفذ الاختبار5175 للمشروع المشترك.

خدمة المساعد على8001 وفحص الفيديو على8000 مستقلتان عن باك الحسابات والمحتوى. أبقِ تيرمنالات الخدمات المطلوبة مفتوحة، ولا تشغّل نسخًا مكررة على المنافذ نفسها. عند `EADDRINUSE` استخدم العملية الحالية أو أوقف خدمتك من تيرمنالها فقط. تحديث ملفات البيئة يحتاج إعادة تشغيل الخدمة المتأثرة.

### الإعداد مرة واحدة أو بعد تنزيل نسخة جديدة

```powershell
# Use a clean checkout; do not pull over this unreviewed working tree.
npm install
npm --prefix ai run data:prepare
```

الأمر الأخير يحتاج Python ويجهز بيانات التوصيات؛ لا يلزم تكراره كل مرة بعد وجود `ai/data/processed/courses.json`. ملف `ai/.env` محلي ومستثنى من Git؛ حافظ عليه ولا تستبدله بالمثال عند التحديث. على جهاز جديد فقط انسخ `ai/.env.example` إلى `ai/.env` وأدخل مفتاح الخدمة هناك، مع `CHAT_PROVIDER=google` إذا أردت الإعداد الحالي. جميع المفاتيح في ملفات `.env.example` يجب أن تبقى فارغة.

للتحقق من التشغيل، افتح `/ai/assistant/health` و`/ai/health` على نفس عنوان الموقع؛ الأول يعرض جاهزية مفتاح المساعد وعدد الدورات والثاني جاهزية فحص الفيديو. هذه الجاهزية لا تثبت توفر حصة المزود؛ جرّب سؤالًا للتأكد من الاتصال الكامل. استضافة الفرونت العامة تحتاج بوابة AI منشورة كما في [دليل النشر](ai/DEPLOYMENT.md).

### آخر إصلاحات العرض والاتصال

- الاتصال المحلي للشات والفيديو عبر نفس أصل الموقع لمعالجة أخطاء Chrome واختلاف منافذ التشغيل.
- الشعار في الدارك مود بدون مستطيل أبيض: الرسمة تبقى بألوانها، والكلمة تظهر بلون فاتح هادئ `#d8c9cc`. الوضع الفاتح يبقي الأصل. يستخدم SVG filter على منطقة الكلمة فقط، دون تعديل ملف الصورة أو إضافة مكتبات.

### إضافة مراجعة الفيديو عبر Google — 24 أكتوبر 2026

أُضيفت خدمة AI محلية مستقلة داخل `ai/` وربط اختياري في واجهة معاينة الفيديو، دون تعديل ملفات `backend/` الموجودة. الفحص عبر خدمة Google وحدها، ويُعرض زر الفحص والنتيجة دون اسم النموذج أو قائمة مزودين. يوضح الهوفر إرسال الفيديو إلى Google، ويُضبط المفتاح في `ai/.env`. لا توجد مفاتيح في الفرونت. الخدمة محدودة بالتطوير المحلي، 20MiB و10 دقائق؛ نشرها وربط قرارات المراجعة بالحسابات يتطلب لاحقًا تكاملًا مع الباك. الاختبارات المحاكية لا تغني عن اختبار اتصال Google بمفتاح صالح وتقييم دقة الفحص. تعليمات التشغيل والحدود في [دليل خدمة AI](ai/README.md). توثيق CLIP أدناه يشرح النموذج الأولي السابق؛ فحص الواجهة الحالي يستخدم خدمة الفيديو المستقلة.

## دليل القراءة والمناقشة

### تحديث الشات والبيانات والتوصيات — 24 أكتوبر 2026

تبويبات المساعد تتيح المحادثة، وفتح الجلسات السابقة وحذفها، وعرض مراجع المحادثة الحالية. سجل آخر 20 محادثة محفوظ في جلسة التبويب حسب الحساب، دون المرفقات، وليس تخزينًا دائمًا على الخادم. معرفة الموقع تشمل خطوات الاستخدام والأدوار والنقاط والدورات والشهادات، مع إبقاء بيانات الحساب الخاصة خارج النموذج.

الشات يدعم المحادثة العامة والشرح والكتابة والبرمجة من معرفة النموذج؛ كتالوج الدورات ليس قيدًا على إجاباته العامة. يحتفظ بمراجع إسهام والدورات للأسئلة المتعلقة بها. الواجهة تعرض «مساعد إسهام» دون اسم المزوّد. دعم DeepSeek اختياري بإعداد مفتاح مستقل داخل خدمة AI؛ يحتاج مفتاحًا مستقلًا ورصيد API؛ طبقة الربط مختبرة بمحاكاة الاستجابات، والتشغيل الفعلي يتطلب نجاح اتصال الحساب المهيأ. لا تحفظ المفاتيح في المستودع. لا يوجد بحث ويب حي حاليًا.

تم تنظيف كتالوج Coursera إلى 6,403 دورة مميزة، وتجهيز نسخة خصائص مكتملة مع وسم القيم التقديرية وفصلها عن الحقائق الأصلية. المساعد المحلي على المنفذ 8001 يبحث في بيانات الدورات ومعرفة إسهام ويولّد إجابة مع مصادر وروابط معروفة، بدل الردود الثابتة. توصيات ما بعد الدورة تستخدم اهتمامات الحساب المحلية وملاحظاته وتفصل المراجع الخارجية عن دورات إسهام. لا تُستخدم الدورات الخارجية للتسجيل بالنقاط.

التشغيل: `npm --prefix ai run data:prepare` ثم `npm --prefix ai run assistant` مع مفتاح خدمة AI مضبوط محليًا. راجع [دليل البيانات](ai/data/README.md) و[دليل خدمات AI](ai/README.md). الربط ما زال للتطوير المحلي، دون الوصول الموثوق لأرصدة المستخدمين أو تعديل أي ملف في الباك القائم؛ نشر الخدمة وتوثيق الحسابات يحتاجان تكاملًا لاحقًا. تحليل مرفقات الشات متاح للنصوص وPDF ذي النص القابل للاستخراج والصور المصغّرة؛ حفظ المحادثات الدائم على الخادم غير منفذ.

- [ملخص المشروع والأدوار](#ملخص-المشروع-والأدوار)
- [الميزات وحالة تنفيذها](#الميزات-وحالة-تنفيذها)
- [المكتبات المستخدمة](#المكتبات-المستخدمة)
- [كيف تعمل بيئة إنشاء الفيديو](#كيف-تعمل-بيئة-إنشاء-الفيديو)
- [كيف يعمل الذكاء الاصطناعي](#كيف-يعمل-الذكاء-الاصطناعي)
- [دليل المناقشة: نص تقديم، سيناريو عرض، وأسئلة وأجوبة](docs/project-discussion.md)
- [تحميل دليل المناقشة بصيغة Word](docs/esham-discussion-guide.docx)
- [توثيق الفرونت والتعديلات بالتفصيل](frontend/README.md)
- [تنظيم المشروع والربط المستقبلي](docs/architecture.md)

## ملخص المشروع والأدوار

المشكلة التي يعالجها إسهام هي أن الشخص قد يرغب بتعلّم مهارة ومشاركة خبرته في الوقت نفسه، دون إنشاء حساب جديد أو فقدان سجله. تجمع المنصة اكتشاف الدورات، إعداد المحتوى، التعلّم العملي، والمتابعة الإدارية في رحلة واحدة.

| الدور | ما يفعله |
|---|---|
| الزائر | استكشاف الدورات والبحث والفلترة وقراءة تفاصيلها وإرشادات المنصة |
| المتعلّم | التسجيل بالنقاط، متابعة الدروس والتقدم، تسليم المهام، التقييم، ومشاهدة الشهادات والمحفظة |
| المدرّب | إنشاء الدورات والأقسام والدروس والمهام، تسجيل الفيديو وتحريره، مراجعة التسليمات، ومتابعة متطلبات شهادات المتعلّمين |
| الحساب الذي يجمع الدورين | التبديل بين واجهتي التعلّم والتعليم من الحساب نفسه؛ تفعيل الدورين من الإعدادات يحافظ على البيانات والسجل |
| أدمن التصنيف | مراجعة الدورات الواقعة ضمن التصنيفات المسندة إليه وطلبات التعديل والبلاغات المرتبطة بها |
| الأدمن العام | إدارة المستخدمين والمديرين والتصنيفات والإعلانات، وعرض التقارير وسجل النشاط والبلاغات |

التميّز في المشروع هو الجمع بين تبادل المعرفة بالنقاط، وبيئة إنشاء فيديو داخل الموقع، ومراجعة المحتوى قبل النشر. فحص AI عامل مساعد، والقرار الإداري والصلاحيات الموثوقة مفروضان في خدمات الباك الحالية، وليس في نتائج AI.

## الميزات وحالة تنفيذها

جدول الحالة وتقسيم Fatima/Mais في بداية الملف هو المرجع الحالي. واجهات المتعلّم ومعاينات الشهادات وسجل النقاط المحلي لا تعني اكتمال خدمات التسجيل أو الإكمال. الحسابات والكتالوج والإشعارات وإدارة المحتوى والإدارة وتقارير المدرّب تستخدم خدمات خادم فعلية وفق حدود كل تقرير تسليم. لا يوجد Footer في مساحات الإدارة، ولا روابط Admin Preview عامة.

## المكتبات المستخدمة

الإصدارات المثبتة التالية مأخوذة من `frontend/package-lock.json`، والتراخيص من بيانات الحزم. نطاقات التحديث المعلنة موجودة في `frontend/package.json`.

| المكتبة | الإصدار المثبت | لماذا نستخدمها؟ | الترخيص |
|---|---|---|---|
| `react` و`react-dom` | 19.3.0 | بناء المكونات، إدارة الحالة والسياقات وعرض الصفحات | MIT |
| `react-router` | 8.4.0 | مسارات الموقع والأدوار والتنقّل دون إعادة تحميل كاملة | MIT |
| `vite` | 8.3.1 | تشغيل التطوير وبناء نسخة الإنتاج وتحميل الوحدات | MIT |
| `@excalidraw/excalidraw` | 0.18.1 | الوايت بورد: قلم ونصوص وأشكال وصور وممحاة وتراجع وإعادة | MIT |
| `wavesurfer.js` | 8.0.2 | عرض الموجة الصوتية والخط الزمني وتحديد نطاق القص بالسحب | BSD-3-Clause |
| `mediabunny` | 1.61.3 | قراءة الوسائط والتحويل وقص الفيديو وإنتاج ملف فعلي باستخدام WebCodecs | MPL-2.0 |
| `pdfjs-dist` | 6.4.299 | قراءة صفحات PDF ورسمها على Canvas لعرضها داخل التسجيل | Apache-2.0 |
| `@huggingface/transformers` | 4.3.1 | تشغيل pipeline لتصنيف الصور بالـCLIP داخل Web Worker | Apache-2.0 |
| `onnxruntime-web` — اعتماد غير مباشر | 1.31.0-dev.20260914-8d85527a0 | محرك تشغيل النموذج في المتصفح، عبر Transformers.js، باستخدام WebAssembly | MIT |

المكتبات المذكورة مفتوحة المصدر والميزات المستخدمة لا تحتاج اشتراكًا مدفوعًا أو مفتاح API. لا نستخدم Excalidraw Plus أو إضافات ترميز مدفوعة. مجانيّة المكتبات لا تعني أن الاستضافة والتخزين وخدمات AI المستقبلية ستكون بلا تكلفة. يجب الحفاظ على إشعارات التراخيص؛ راجع [توثيق الأدوات](docs/video-tools.md).

### واجهات المتصفح الأصلية — ليست مكتبات إضافية

| التقنية | دورها |
|---|---|
| `getUserMedia` | الحصول على الكاميرا والميكروفون بعد موافقة المستخدم |
| `getDisplayMedia` | مشاركة شاشة أو نافذة أو تبويب وفق خيارات المتصفح |
| Canvas 2D | دمج مصادر الفيديو والعرض والسبورة في إطار واحد |
| `captureStream` و`MediaRecorder` | تحويل Canvas إلى تدفق وتسجيله كملف فيديو |
| Web Audio و`AnalyserNode` | دمج الصوت وعرض مستوى الإشارة الصوتية الفعلي |
| `DynamicsCompressorNode` | تسوية مستوى الصوت عند تفعيل تحسين الصوت؛ ليس إزالة ضوضاء بالـAI |
| WebCodecs | ترميز وفك ترميز الوسائط بحسب دعم الجهاز والمتصفح |
| IndexedDB | حفظ الفيديوهات والمرفقات ومشاهد السبورة كملفات كبيرة محليًا |
| localStorage / sessionStorage | التفضيلات وبيانات الأعمال وبيانات الفيديو الوصفية ووضع الحساب في الجلسة |
| Web Worker / WebAssembly | تشغيل استدلال النموذج خارج مسار الواجهة الرئيسي |

تصدير الشهادة يستخدم كودًا داخل `frontend/src/services/certificatePdf.js`؛ يرسم الشهادة على Canvas ويولّد PDF أحادي الصفحة. لا يستخدم المشروع مكتبة jsPDF أو html2canvas لهذه الوظيفة.

## كيف تعمل بيئة إنشاء الفيديو

### رحلة المدرّب

1. ينشئ دورة ثم قسمًا ودرس فيديو، ويختار رفع ملف جاهز أو التسجيل من داخل الموقع.
2. يختار شكل التسجيل: الكاميرا، الشاشة، الشاشة مع الكاميرا، أو الوايت بورد؛ ويضبط أجهزة الكاميرا والميكروفون.
3. يمنح أذونات الأجهزة، ثم يعاين أو يبدأ التسجيل. يمكن مشاركة الشاشة والكتابة على السبورة في الوقت نفسه.
4. توضع السبورة بجانب شاشة العرض لمتابعة مكان الرسم. عند المشاركة تُصدّر الرسومات بخلفية شفافة وتظهر فوق الشاشة داخل الفيديو.
5. يمكن إضافة صورة أو صفحات PDF والتنقّل بين الصفحات أثناء العرض.
6. يوقف التسجيل، فيُحفظ Blob فعلي في IndexedDB وتظهر معاينته، ثم يحدد بداية ونهاية القص عبر التايم لاين أو خانات الوقت.
7. يمكن تحسين مستوى الصوت وقص الفيديو وفحصه بالـAI، ثم حفظه للدرس بعد اجتياز متطلبات المسار.

### الدمج والتسجيل

```text
الكاميرا + الشاشة + الصورة/PDF + رسومات Excalidraw
                         ↓
                 Canvas 1280 × 720
                         ↓ captureStream
صوت الميكروفون/الشاشة → Web Audio → MediaRecorder
                         ↓
                  ملف فيديو فعلي
                         ↓
             IndexedDB → معاينة → قص → فحص → درس
```

الصورة النهائية ليست مجموعة نوافذ منفصلة: تُرسم المصادر في Canvas واحد، ثم يُسجّل تدفقه. ترميز التسجيل يُختار بواسطة `MediaRecorder.isTypeSupported`؛ يحاول الكود WebM بترميز VP8/Opus ثم VP9/Opus ثم WebM ثم MP4 بحسب المتصفح، ولا يضمن صيغة واحدة لكل الأجهزة.

- `requestFrame()` يطلب إطارًا من تدفق Canvas عند الرسم، بما في ذلك الإطار الأول، لتجنّب تسجيل فارغ عندما تكون الشاشة ثابتة.
- العناصر المحذوفة في Excalidraw تُستثنى من التصدير باستخدام `isDeleted`، وتحديث الرسم يعيد رسم المعاينة حتى لا تبقى آثار الممحاة.
- مشهد السبورة يُحفظ لكل درس في IndexedDB، مع تأخير قصير للحفظ بدل الكتابة إلى التخزين مع كل حركة قلم.
- مستوى الصوت مؤشر لقوة إشارة الإدخال، وليس زرًا لرفع صوت المستخدم.
- لا يُنشأ مسار الصوت إلا عند وجود مصادر صوت أثناء التسجيل. توفر صوت النظام يعتمد على ما يتيحه المتصفح عند مشاركة الشاشة.

### القص والصوت والعروض

Mediabunny ينفذ التحويل والقص إلى ملف جديد مع إعادة ترميز الفيديو عند توفر WebCodecs. عند غياب `VideoEncoder` أو عدم صلاحية التحويل أو فقدان مسارات مطلوبة، يستخدم مسار Canvas وMediaRecorder. عند تفعيل تحسين الصوت يُستخدم هذا المسار أيضًا لتطبيق DynamicsCompressor. ليس كل خطأ في Mediabunny يتحول تلقائيًا إلى المسار البديل؛ تظهر الأخطاء التي لا يعالجها الكود للمستخدم.

WaveSurfer يوفر Regions لتحديد البداية والنهاية وTimeline للتوقيت. الملفات الأكبر من 50MB أو التي يتعذر فك صوتها تحصل على خط زمني دون موجة صوتية، وتبقى خانات الوقت متاحة عند تعذّر التايم لاين.

PDF.js يعرض PDF والصور تدخل التسجيل. ملفات PowerPoint وWord يمكن حفظها كمرفقات، لكن العرض المباشر وتحويلها لصفحات غير منفذين؛ يمكن مشاركة نافذة البرنامج أو تصدير الملف إلى PDF.

### ملفات التنفيذ الرئيسية

| الملف | المسؤولية |
|---|---|
| `frontend/src/pages/instructor/LessonVideoWorkflow.jsx` | رحلة الفيديو، الأجهزة، الدمج والتسجيل والقص والفحص والحفظ |
| `frontend/src/components/video/VideoWhiteboard.jsx` | دمج Excalidraw وتصدير الرسم وحفظ المشهد |
| `frontend/src/components/video/VideoTimeline.jsx` | WaveSurfer والنطاق الزمني |
| `frontend/src/components/video/VideoPresentation.jsx` | صفحات PDF والصور |
| `frontend/src/services/videoProcessing.js` | فحص بيانات الفيديو واختيار الصيغة والقص والتحويل وتحسين الصوت |
| `frontend/src/services/mediaStore.js` | تخزين ملفات الفيديو والمرفقات والسبورة |
| `frontend/scripts/video-assets.mjs` | تجهيز خطوط Excalidraw محليًا قبل التطوير والبناء |

## كيف يعمل الذكاء الاصطناعي

### التنفيذ الحالي

المحادثة العامة ومعرفة إسهام والتوصيات وتحليل المرفقات تعمل عبر خدمات `ai/`. فحص الفيديو الحالي يرسل الفيديو والصوت لخدمة الرؤية من الخادم، ويعيد نتيجة إرشادية بتوقيت المشاهد. راجع [دليل AI](ai/README.md) و[حدود النشر](ai/DEPLOYMENT.md).

### النموذج الأولي السابق باستخدام CLIP

الوصف التالي يشرح تنفيذًا سابقًا بقي كوده للمقارنة والاختبارات، وليس طريقة الفحص المستخدمة في واجهة الفيديو الحالية. كان فحص صور الفيديو باستخدام **CLIP** منفذًا محليًا. تستخدم الواجهة Transformers.js ونموذج `Xenova/clip-vit-base-patch32`، وهو نسخة ONNX من CLIP. النموذج من عائلة OpenAI CLIP، لكن تشغيله هنا لا يستخدم OpenAI API ولا ChatGPT ولا مفتاح خدمة مدفوعًا.

المسار هو `zero-shot-image-classification`: يقارن النموذج الصورة بوصف نصي لفئات محددة في الكود. **Zero-shot** يعني استخدام نموذج مدرّب مسبقًا مع أوصاف جديدة دون تدريب نموذج خاص بالمشروع؛ لا ندّعي أننا درّبنا CLIP أو جمعنا مجموعة تدريب خاصة.

### تدفق نموذج CLIP السابق

```text
الفيديو المحلي → اختيار توقيتات موزعة → صور 224 × 224
                                          ↓
                        Web Worker + Transformers.js
                        CLIP / ONNX / WASM / q8
                                          ↓
                          درجات تشابه مع أوصاف الفئات
                                          ↓
                       سياسة حدود ونتائج غير مؤكدة
                                          ↓
                 review أو no-flags + التوقيتات
```

1. يختار المستخدم زر الفحص في المعاينة. حفظ الفيديو للدرس يشغّل الفحص إذا لم توجد نتيجة مطابقة للملف.
2. عدد الصور = `min(60, max(2, ceil(duration / 2) + 1))`. تُوزّع من البداية حتى قرب النهاية؛ الفيديوهات الطويلة لا تُفحص كل ثانيتين لأن العدد محدود بـ60.
3. يُرسم كل إطار داخل صورة 224×224 مع الحفاظ على نسبة الأبعاد، ثم تُمرّر بيانات البكسلات إلى Worker محلي.
4. يُشغّل النموذج باستخدام `device: 'wasm'` و`dtype: 'q8'` وخيط WASM واحد. q8 يقلل حجم الأوزان مقارنة بالنسخ غير المكمّمة، ولا يضمن ملاءمة كل هاتف.
5. يقارن الصور بفئات تعليمية وعادية ونار دون جسم قريب ورسوم طبية غير دموية، مقابل الدم والإصابات والحروق وخطر قرب اليد من اللهب والعنف والمحتوى الجنسي الصريح.
6. يجمع النتائج ويعرض المقاطع التي تحتاج مراجعة بتوقيتاتها. الضغط على التوقيت يساعد على مشاهدة الموضع في المعاينة.

### سياسة القرار الحالية

| الحالة في `videoSafetyPolicy.js` | المعالجة |
|---|---|
| أعلى فئة من فئات الاشتباه | تحتاج مراجعة |
| درجة فئة مؤذية ≥0.25 والفارق بينها وبين أعلى فئة <0.08 | تحتاج مراجعة |
| أعلى درجة <0.30 أو الفارق بين أعلى درجتين <0.04 | نتيجة ضعيفة/ملتبسة تحتاج مراجعة |
| كل الصور مكتملة ولا تحقق شرط المراجعة | `no-flags`: لم تُرصد إشارات في الصور المفحوصة |
| فشل النموذج أو فك الفيديو أو إلغاء الفحص | لا تُنشأ نتيجة اعتماد؛ تبقى المسودة |

هذه الحدود قواعد أولية في الكود وليست حدودًا معايرة بدراسة دقة. الأرقام **تشابه نسبي** وليست احتمالًا أن الفيديو مخالفًا أو نسبة ثقة موثوقة.

النتيجة مرتبطة بمعرّف ملف الفيديو ومدته وإصدار السياسة `clip-local-v2`. القص أو الاستبدال ينتج ملفًا بمعرّف جديد ويحتاج فحصًا جديدًا. نتيجة `review` تمنع إتمام حفظ الفيديو للدرس وجاهزيته والموافقة المحلية على الدورة. **لا يُحذف الفيديو تلقائيًا**؛ يستطيع المدرّب تعديله وإعادة الفحص.

### الخصوصية والحدود

- الاستدلال محلي؛ صور الفيديو لا تُرسل إلى خادم AI في هذا المسار. أول تشغيل ينزّل النموذج وملفات التشغيل عبر الشبكة، لذلك ليس فحصًا يعمل دون إنترنت منذ أول مرة.
- الفحص بصري لعَيّنات فقط؛ لا يحلل الصوت والكلام، ولا يضمن اكتشاف كل مشهد قصير أو خطر أو سياق غير مناسب للأطفال.
- `no-flags` لا يعني أن الفيديو آمن للأطفال أو معتمد للنشر؛ يعني فقط عدم ظهور إشارة ضمن ما فُحص.
- CLIP نموذج عام لمقارنة الصور والنصوص، وليس نموذج سلامة متخصصًا تم التحقق من دقته للمشروع. يمكنه الخطأ في الاتجاهين.
- الملفات القديمة والروابط الخارجية ومسارات التحرير الأخرى ليست كلها خاضعة لفحص إلزامي حاليًا، ويمكن تعديل تخزين المتصفح. الحماية الفعلية تحتاج فرض الفحص على الخادم ومراجعة بشرية وآلية اعتراض.
- لا تختبر قرب النار من اليد أو أي موقف مؤذٍ. العرض الآمن يستخدم ملف الفحص التعليمي ورسومًا اصطناعية موثقة.

الاختبارات السابقة شملت فيديو سبورة مولدًا، ورسم شمعة دون شخص، ورسم يد قرب شمعة. أعاد الرسم الأخير نتيجة مراجعة تحت السياسة v2، بينما لم ترصد إشارات في المثالين الآخرين. هذا يثبت تشغيل المسار في حالات محددة، **ولا يثبت دقة النموذج على فيديوهات واقعية**. تفاصيل النتائج في [توثيق الفحص](docs/local-video-screening.md).

### أين الشات والتوصيات وخدمة AI المستقلة؟

الشات مربوط بنموذج عام مع معرفة الموقع ومراجع الكتالوج. يدعم النصوص وPDF القابل للاستخراج والصور المصغرة. التوصيات تعتمد استرجاع TF–IDF من البيانات المنظفة واهتمامات المستخدم، دون تدريب نموذج توصية جديد.

مجلد `ai/` يحتوي خدمات Node منفذة واختبارات وبوابة نشر. التكامل المتبقي مع باك الأعمال هو حفظ الفيديو ونتيجة الفحص وفرض قرار المراجعة قبل النشر على الخادم.

## التصميم والتنظيم والاختبارات

- ناف بار بقوائم منظمة، والحساب يبقى ظاهرًا عند استكشاف الدورات والعودة للرئيسية.
- فوتر مشترك في الواجهات العامة ومساحات المتعلّم/المدرّب؛ مستبعد من جميع صفحات Admin/CategoryAdmin.
- صفحات إرشادات التعليم والمساعدة والخصوصية والشروط بتصميم موحّد وخط مقروء وبطاقات وفهرس وتنقّل بين الصفحات.
- صفحة شهادات المتعلّمين تعرض متطلبات الاستحقاق وبطاقات الدورات، وتتكيف مع الهاتف.
- سجل نشاط الأدمن يعرض أسماء العناصر بدل الرموز، ويحفظ الاسم في الإجراءات الجديدة حتى بعد حذف العنصر.
- ملاحظات المشروع الجامعي وبيانات العرض موثقة هنا بدل إظهار شاراتها داخل الواجهة؛ ذلك لا يغيّر حدود التنفيذ.
- نتائج اختبارات التسليم الحالية موثقة في جدول الحالة وتقرير التدقيق النهائي؛ اختبارات المعاينة لا تثبت اكتمال خدمات المتعلّم.
- فُحص التصميم الأخير في المتصفح وعلى عرض هاتف 390px، ولم يُرصد تجاوز أفقي في الصفحات التي فُحصت. هذه ليست شهادة بأن جميع الأجهزة والمسارات خالية من الأخطاء.

## تقسيم المشروع

```text
esham/
├── frontend/                 # الموقع الحالي بكامل كوده وملفاته
│   ├── src/
│   ├── public/
│   ├── scripts/
│   ├── tests/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   └── .env.production
├── backend/                  # الباك الفعلي ASP.NET Core / EF Core
│   ├── esham.PL/             # تشغيل HTTP وSwagger والإعدادات
│   ├── esham.BLL/            # الخدمات والعقود وقواعد الصلاحيات
│   ├── esham.DAL/            # الكيانات وData/Migrations
│   ├── esham.Tests/          # مشروع الاختبارات المستقل
│   ├── esham.sln             # مشاريع PL/BLL/DAL
│   ├── src/                  # هيكل تاريخي؛ ليس أمر تشغيل الباك الحالي
│   └── tests/                # هيكل تاريخي
├── ai/                       # خدمات AI منفذة واختبارات وتجهيز نشر
│   ├── src/
│   ├── models/
│   └── tests/
├── docs/                     # التصميم المعماري وعقود الربط والتوثيق المشترك
├── package.json              # أوامر تشغيل الفرونت من جذر المستودع
├── netlify.toml
└── vercel.json
```

كود CLIP السابق بقي في الفرونت للاختبارات والمقارنة، ومجلد `ai/` يشغّل خدمات الفحص والمحادثة والتوصيات الحالية. تنظيم المستودع لا ينقل أو يحذف بيانات المتصفح.

## التشغيل من جذر المشروع

استخدم Node.js 22.12 أو أحدث؛ ملف `.nvmrc` يحدد سلسلة Node 22. من مجلد المشروع الرئيسي:

```bash
npm ci
npm run dev -- --host localhost --port 5173
```

تثبيت الجذر يشغّل `npm ci` داخل `frontend/` تلقائيًا حسب ملف القفل الخاص به. الأوامر التالية توجّه العمل إلى الفرونت:

```bash
npm test
npm run build
npm run preview
```

نسخة الإنتاج تُنشأ في **`frontend/dist`**. لتحديد نفس المنفذ الذي كنت تستخدمه حتى تبقى بيانات المتصفح على نفس أصل الموقع:

```bash
npm run dev -- --host localhost --port 5173
```

يبقى التشغيل مباشرةً من `frontend/` ممكنًا بأوامر npm المعتادة. لإعادة تثبيت اعتماداته من الجذر استخدم `npm run setup`. عند إضافة مكتبة للفرونت:

```bash
npm --prefix frontend install library-name
```

## الإعدادات والربط

- إعدادات الفرونت في `frontend/.env.local`؛ أنشئه من `frontend/.env.example` فقط إن لم يكن موجودًا واضبط `VITE_API_BASE_URL=http://localhost:5206` للباك الحالي.
- أُزيلت قائمة الأدمن المؤقتة ومتغير `VITE_ADMIN_PREVIEW`؛ الوصول الإداري يتطلب الجلسة والدور الموثّقين.
- إعدادات AI في `ai/.env`. باك .NET يستخدم إعداداته وUser Secrets أو متغيرات الاستضافة لاتصال قاعدة البيانات. راجع ملفات إعداد الباك الحالية دون افتراض أن ملف `.env` وحده يضبطه. لا تضع الأسرار في متغيرات `VITE_` أو في Git.
- الباك الحالي .NET، وخدمات AI مستقلة بـNode.js، وتجهيز البيانات بـPython. لم تغيّر تعديلات AI ملفات الباك الحالية.

راجع [توثيق الفرونت والمكتبات](frontend/README.md)، و[خطة الباك](backend/README.md)، و[خطة AI](ai/README.md)، و[تنظيم المشروع](docs/architecture.md)، و[عقود الباك](docs/backend-contract.md).

## النشر

**Netlify:** إعداداته في `netlify.toml` بالجذر. أمر البناء `npm run build` ومجلد النشر `frontend/dist`. ملف إعادة التوجيه بقي في `frontend/public/_redirects` ويُنسخ إلى الإنتاج لفتح مسارات الموقع مباشرةً. قاعدة المشروع هي جذر المستودع.

**Vercel:** إعداداته في `vercel.json` بالجذر؛ تم تعديل مجلد الناتج إلى `frontend/dist`. اترك Root Directory على جذر المستودع وأعد النشر بعد رفع التنظيم.

إذا تنشر يدويًا على Netlify، ارفع **`frontend/dist`** بعد البناء. استضافة الفرونت لا تشغّل الباك أو خدمات AI؛ لهما إعداد نشر مستقل موثق في دليل النشر.

## Git والعمل مع الفريق

لا تلتزم أو ترفع الشجرة كاملةً دون مراجعة. التغييرات الحالية تشمل عدة ميزات وملفات SQL تشغيلية وبيانات تدقيق داخلية. افصل تغييرات الباك المتكاملة عن الفرونت المتكامل والتوثيق العام، وراجع المسارات الجديدة والمحذوفة وملفات المايغريشن المعتمدة قبل أي staging.

```bash
git status --short
git diff --check
git diff --stat
```

لا تحفظ User Secrets أو `.env.local` أو `ai/.env` أو نسخ BAK أو manifests للجلسات/كلمات مرور الاختبار في Git. أمثلة البيئة وإعدادات الفرونت العامة ليست مكانًا للأسرار. لا يُعاد تشغيل SQL المطبق كجزء من checkout أو startup.

## ملاحظات النسخة الحالية وبيانات العرض

أُزيلت من واجهات الموقع الملاحظات التي تصف المشروع بأنه تجريبي أو جامعي، ونُقلت إلى هذا القسم. إزالة هذه العبارات تغيير في العرض فقط، ولا تعني اكتمال خدمات الخادم أو اعتماد البيانات والسياسات.

- بدأت الواجهات ببيانات عرض. المسارات الحالية للإدارة وتقارير المدرّب والكتالوج والإشعارات تستند إلى API حقيقي؛ بعض صفحات المتعلّم ومعاينات الشهادات ما زالت محلية وتحتاج عمل Mais.
- التفضيلات ومسودات الفيديو المحلية تستخدم تخزين المتصفح. التقدم والتسجيلات وتسليمات المتعلّم والتقييمات والنقاط في واجهات المعاينة ما زالت تحتاج خدمات Mais؛ المحتوى والوسائط المعتمدة والبلاغات والتحذيرات وسجل الإدارة ليست سجلات متصفح. يوجد رفع وتخزين وسائط حقيقي إلى جانب مسودات IndexedDB.
- تغيير كلمة المرور وحذف الحساب يحتاجان خدمة الحسابات. تبقى الإجراءات غير المتاحة ورسائل فشلها واضحة، ولا تعرض الواجهة نجاحًا وهميًا.
- أُزيل مدخل Admin Preview العام. جميع مسارات الإدارة محمية بالجلسة والدور؛ الباك يفرض العضوية ونطاق التصنيف والملكية، مع سجل نشاط محفوظ.
- شهادات الواجهة معاينات؛ اعتمادها وتاريخ الإصدار ورقم التحقق وإصدار شهادات موثقة يحتاج خدمة شهادات تتحقق من الإكمال.
- الشات العام وتحليل المرفقات يحتاجان تشغيل خدمة المساعد ومفتاحًا وحصة متاحة. بوابة النشر تتيح معرفة الموقع للزائر وتتحقق من الجلسة للمحادثة العامة والمرفقات.
- فحص الفيديو الحالي يراجع الفيديو والصوت عبر خدمة الخادم، وقد يخطئ ولا يمنح اعتماد سلامة للأطفال. فرض المراجعة على جميع مسارات النشر يحتاج تكامل الباك ومراجعة بشرية. وصف CLIP في هذا الملف تاريخي.
- الشروط والخصوصية ليست سياسات قانونية معتمدة. تحتوي صفحة الشروط على نصوص مقترحة للعرض عن الحسابات والنقاط والتعلّم وحقوق المحتوى والسلامة والبلاغات، دون وصفها بالتجريبية داخل الواجهة. يجب مراجعتها واعتماد قواعد الحسابات والتسجيل والنقاط وحقوق المحتوى والشكاوى والإلغاء، وتحديد أغراض جمع البيانات والخدمات المستقبلة وفترات الاحتفاظ وحقوق المستخدم ووسيلة التواصل قبل الإطلاق.
- الدعم المباشر وإرسال البريد والتنبيهات للمستخدمين والتحويل المباشر لملفات Office خدمات تحتاج الربط لاحقًا.

هذه الملاحظات للتطوير والتسليم، ولا تظهر كشارات أو تنبيهات عن بيانات تجريبية داخل واجهات الموقع بالعربية أو الإنجليزية.


## آخر تجهيزات AI والنشر

يدعم الشات PDF/TXT حتى20 صفحة و16000 حرف، وتحليل صور مصغرة، مع إشعار قبل إرسال المحتوى. يستخدم استخراج PDF مكتبة `pdfjs-dist` الموجودة، ويستخدم تجهيز الصور `createImageBitmap` وCanvas في المتصفح دون مكتبات جديدة. مفاتيح DeepSeek وخدمة الرؤية والفيديو تبقى على الخادم. الزوار يستطيعون السؤال عن إسهام دون حساب؛ بوابة النشر تعطيهم إجابات معرفة الموقع وتطلب جلسة موثقة للمحادثة العامة وتحليل الملفات. فحص الفيديو محصور بالمدرب/الهايبرد في البوابة.

تم تجهيز بوابة Node تتحقق من `/auth/session` الحالي، ومتغيرات عناوين الفرونت، وDocker ومثال reverse proxy، دون تعديل ملفات الباك القائمة. لم ينشر خادم AI عام بعد، ولم يبن Docker فعليًا لأن محركه غير مشغّل؛ يلزم إعداد الاستضافة وHTTPS والمفاتيح ومسار جلسة الحساب. التفاصيل والأوامر في [دليل النشر والتسليم](ai/DEPLOYMENT.md). فحص الدقة الموسع للفيديو يحتاج مقاطع مصرحًا بها وتقييمًا بشريًا مستقلًا؛ الأدوات تدعم إدخالها، ولا تمثل الاختبارات البرمجية ضمان سلامة أو قياس دقة شاملًا.

### المتبقي لقاعدة البيانات وتكاملها

تقسيم العمل الحالي موضح في قسم Mais أعلاه: خدمات التسجيل والمعاملات الذرية للنقاط، التقدم، محاولات التسليم والتقييمات، تسوية الإكمال والشهادات وربط واجهات المتعلّم. قاعدة البيانات وإدارة المحتوى والنشر وتحديثات الإصدارات والإدارة والإشعارات موجودة، فلا تُبنَ بدائل مكررة لها.

يبقى توصيل الكتالوج الرسمي بالتوصيات، ومزامنة المحادثات عند الحاجة، وإعداد بوابة AI المنشورة وHTTPS والمفاتيح والتقييم المستقل للفيديو وفق [توثيق AI](ai/DEPLOYMENT.md). لا تضف مايغريشن أو تعدّل البيانات المشتركة دون موافقة المنسق.
