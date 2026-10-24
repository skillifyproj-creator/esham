import {normalize} from './retrieval.mjs';
import {platformKnowledge} from './knowledge.mjs';

// Public, project-owned answers only: guests cannot invoke paid general models or submit files.
const topics=[
 ['roles',/هايبرد|مدرب.*متعلم|متعلم.*مدرب|نوع الحساب|تحويل|اصير|صير|hybrid|switch.*role|change.*account/i,
  'من قائمة الحساب افتح إعدادات الحساب، ثم غيّر نوعه إلى متعلّم أو مدرّب أو هايبرد. الهايبرد يجمع التعلّم والتدريس في الحساب نفسه، مع الاحتفاظ بالسجل السابق.',
  'Open the account menu, then account settings, and choose learner, instructor or hybrid. Hybrid combines learning and teaching in the same account while retaining existing history.'],
 ['certificates',/شهاد|certificate|المهام|tasks/i,
  'تتاح الشهادة من داخل الدورات بعد إكمال جميع الدروس واعتماد المدرّب لجميع المهام المطلوبة. تتضمن الدورة من مهمة إلى ثلاث مهام، ويمكن حفظ الشهادة بالعربية أو الإنجليزية.',
  'Find certificates inside courses after completing all lessons and receiving instructor approval for all required tasks. A course has one to three tasks; certificates support Arabic and English export.'],
 ['video',/فيديو|تسجيل الشاش|سبور|وايت|video|screen.?shar|whiteboard/i,
  'يمكن للمدرّب رفع فيديو أو تسجيل الكاميرا والشاشة والسبورة. بعد التسجيل أو الرفع افتح المعاينة ثم زر فحص الفيديو. الفحص إرشادي، والحالات المشتبهة تحتاج مراجعة. الحد الحالي MP4 أو WebM حتى 20 ميغابايت و10 دقائق.',
  'Instructors can upload video or record camera, screen and whiteboard. After recording or uploading, open the preview and screen the video. Screening is advisory and flagged content needs review. Current limits: MP4/WebM, 20 MiB and 10 minutes.'],
 ['authoring',/انش|اعطي|تدريس|انشر|نشر|create|teach|publish/i,
  'لإنشاء دورة، فعّل دور المدرّب من إعدادات الحساب، ثم افتح دوراتي واختر إنشاء دورة. أضف المعلومات والأهداف والأقسام والدروس ومن مهمة إلى ثلاث مهام، ثم أرسل الدورة للمراجعة.',
  'Enable the instructor role in account settings, open My courses and create a course. Add details, objectives, sections, lessons and one to three practical tasks, then submit for review.'],
 ['points',/نقط|رصيد|تكلف|سعر|points|balance|cost|price/i,
  'الحساب الجديد يحصل على 20 نقطة مرة واحدة. التسجيل في أي دورة داخل إسهام يكلف 20 نقطة، والمدرّب يكسب 20 نقطة عن كل متعلّم جديد يسجّل بدورته. الرصيد وسجل الحركات في محفظة النقاط؛ لا يستطيع المساعد قراءة رصيدك الخاص أو صرفه.',
  'A new account receives 20 points once. Every Esham course costs 20 points; instructors earn 20 per new learner enrollment. Check your points wallet for balance and transactions; the assistant cannot read or spend your private balance.'],
 ['privacy',/خصوص|بلاغ|مساعده|دعم|privacy|report|support/i,
  'صفحات المساعدة والخصوصية والشروط متاحة من أسفل الموقع. للإبلاغ عن محتوى استخدم زر الإبلاغ في تفاصيل الدورة أو الدرس مع توضيح السبب، ولا تشارك بيانات دخولك مع الآخرين.',
  'Help, privacy and terms pages are available in the footer. Use Report on course or lesson pages to flag content with a reason. Keep account credentials private.'],
 ['learning',/سجل|دور|تعلم|course|enroll|learn/i,
  'افتح استكشف الدورات، واختر الدورة وراجع تفاصيلها، ثم سجّل من صفحتها إذا توفر لديك 20 نقطة. بعد التسجيل تابع الدروس وسلّم المهام من دوراتي. تصفح الدورات أثناء تسجيل الدخول يحافظ على حسابك.',
  'Open Explore courses, choose a course, review its details and enroll from its page with 20 points. Continue lessons and submit tasks from My courses. Browsing courses keeps you signed in.'],
 ['overview',/اسهام|المنصه|الموقع|حساب|ابدا|مرحبا|اهلا|esham|platform|website|account|start|hello|hi\b/i,
  'إسهام منصة لتعلّم ومشاركة المهارات بنظام الدورات والنقاط. يمكنك التعلّم أو التدريس أو الجمع بينهما في حساب واحد. ابدأ بإنشاء حساب واختيار نوعه وإكمال الملف والاهتمامات والأهداف. يمكنك سؤالي عن الموقع دون تسجيل دخول.',
  'Esham is a platform for learning and sharing skills through courses and points. Learn, teach or combine both in one account. Create an account, choose a role, then complete your profile, interests and goals. You can ask about the website without signing in.'],
];
export function guestHelp(message,language='ar') {
  const match=topics.find(([,pattern])=>pattern.test(normalize(message)));
  if(!match)return {answer:language==='ar'?'أقدر أساعدك بأسئلة إسهام: الحسابات، الدورات، النقاط، الشهادات وطريقة الاستخدام. للمحادثة العامة أو تحليل المرفقات، سجّل الدخول أولًا.':'I can help with Esham accounts, courses, points, certificates and using the website. Sign in for general conversation or attachment analysis.',sources:[],answerType:'general'};
  const doc=platformKnowledge.find(d=>d.id===`platform:${match[0]}`);
  return {answer:match[language==='ar'?2:3],sources:doc?[{id:doc.id,title:doc.title,url:doc.url,source:doc.source}]:[],answerType:'grounded'};
}
