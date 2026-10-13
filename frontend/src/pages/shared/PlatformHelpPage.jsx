import { Link, useParams } from 'react-router';import { usePreferences } from '../../context/PreferencesContext';import '../../styles/platform-help.css';
const content={support:{ar:['الدعم والمساعدة','بدء استخدام المنصة','استكشف الدورات ثم أنشئ حسابًا واختر متعلّمًا أو مدرّبًا أو كليهما.','الشهادات والبلاغات','تظهر معاينة الشهادة بعد إكمال الدروس واعتماد المهام. زر الإبلاغ موجود في تفاصيل الدورة والدروس؛ البلاغات المحلية تظهر للأدمن على الجهاز نفسه.','التواصل',''],en:['Support & help','Getting started','Explore courses, create an account and choose learner, instructor or both.','Certificates and reports','Certificate previews require completed lessons and approved tasks. Reports submitted from course details and lessons appear in the administrator queue on the same device.','Contact','']},guidelines:{ar:['إرشادات المدرّبين','تجهيز الدورة','حدد أهدافًا واضحة واستخدم محتوى أصليًا أو مرخصًا. أضف من مهمة إلى ثلاث مهام عملية للدورة كاملة، مع معايير تقييم واضحة.','سلامة المحتوى','يلزم فحص المحتوى قبل النشر ومراجعة الحالات المشتبهة بشريًا. التحذيرات تتطلب أدلة مؤكدة وتصحيحًا وموعدًا، مع إتاحة الاعتراض.'],en:['Instructor guidelines','Prepare your course','Define clear objectives, use original or licensed content, and include one to three assessed tasks with clear criteria.','Content safety','Content must be screened before publishing. Uncertain cases require human review. Warnings require verified evidence, correction and a deadline, with an appeal option.']},privacy:{ar:['الخصوصية','البيانات','التفضيلات والتقدم والبلاغات تُحفظ في المتصفح.','',''],en:['Privacy','Data','Preferences, progress and reports are stored in the browser.','','']},terms:{"ar": ["شروط المنصة", "استخدام منصة إسهام", "إسهام مجتمع للتعلّم ومشاركة المعرفة. استخدم المنصة باحترام، وقدّم معلومات صحيحة، والتزم بإرشادات الدورات والتواصل مع أعضاء المجتمع.", "الحسابات وأنواعها", "حافظ على بيانات دخولك ولا تشاركها مع الآخرين. يمكنك اختيار حساب متعلّم أو مدرّب أو الجمع بينهما، وتغيير نوع الحساب من الإعدادات مع الاحتفاظ ببياناتك وسجل تعلّمك وتعليمك.", "النقاط والتسجيل في الدورات", "يحصل المستخدم الجديد على 20 نقطة مرة واحدة لبدء رحلته. التسجيل في أي دورة يكلف 20 نقطة، ويحصل مدرّب الدورة على 20 نقطة عن كل متعلّم يسجّل فيها. لا تُمنح نقاط إضافية لمجرد إكمال درس أو تسليم مهمة أو كتابة تقييم، ولا يجوز التلاعب بالتسجيلات أو إنشاء حسابات بهدف جمع النقاط.", "التعلّم والمهام والشهادات", "تابع محتوى الدورة وأكمل دروسها ومهامها المطلوبة. تتضمن الدورة من مهمة إلى ثلاث مهام تطبيقية يراجعها المدرّب. تتاح الشهادة بعد إكمال الدروس واعتماد جميع المهام المطلوبة، ويجب أن يعكس التقييم تجربتك الفعلية في الدورة.", "حقوق المحتوى", "انشر محتوى تملكه أو لديك إذن باستخدامه، واذكر مصادر المواد المستخدمة عند الحاجة. لا تنسخ أعمال الآخرين أو تعيد نشر محتوى الدورات دون إذن صاحب الحقوق، واحترم خصوصية الأشخاص الظاهرين في الفيديوهات أو الصور.", "سلامة المحتوى والتواصل", "يُمنع نشر محتوى دموي أو جنسي أو مهين، أو محتوى يحرض على العنف أو الكراهية أو يعرض الأشخاص للخطر. استخدم لغة محترمة في الدروس والتقييمات والرسائل. يساعد فحص الفيديو في اكتشاف مشاهد قد تحتاج مراجعة، وتبقى مسؤولية مراجعة المحتوى قبل نشره على صاحبه.", "البلاغات والمراجعة", "يمكنك الإبلاغ عن محتوى غير مناسب من صفحة الدورة أو الدرس مع توضيح المشكلة وموقعها. تُراجع البلاغات قبل اتخاذ أي إجراء، وقد يُطلب تعديل المحتوى أو يُوقف التسجيل أو تُؤرشف الدورة بحسب الحالة. عدد البلاغات وحده لا يكفي لإصدار تحذير، ويمكن لصاحب المحتوى تقديم توضيح أو اعتراض."], "en": ["Platform terms", "Using Esham", "Esham is a community for learning and sharing knowledge. Use the platform respectfully, provide accurate information, and follow course and community guidelines.", "Accounts and roles", "Keep your sign-in details private. Choose a learner account, an instructor account, or both. You can change your account type in settings while retaining your profile and learning and teaching history.", "Points and course enrollment", "New users receive 20 points once to get started. Every course costs 20 points to enroll, and its instructor earns 20 points for each learner enrollment. Completing a lesson, submitting a task, or posting a review does not award extra points. Do not manipulate enrollments or create accounts to collect points.", "Learning, tasks and certificates", "Follow the course content and complete its required lessons and tasks. A course includes one to three practical tasks reviewed by its instructor. Certificates become available after all lessons are completed and all required tasks are approved. Reviews should reflect your actual course experience.", "Content rights", "Publish content you own or have permission to use, and credit sources where needed. Do not copy other people’s work or redistribute course content without the rights holder’s permission. Respect the privacy of people appearing in videos or images.", "Content safety and communication", "Do not publish graphic, sexual, abusive, or dangerous content, or material promoting violence or hatred. Communicate respectfully in lessons, reviews, and messages. Video screening helps identify scenes that may need review; content creators remain responsible for reviewing their material before publication.", "Reports and review", "Report inappropriate content from the course or lesson page, describing the issue and its location. Reports are reviewed before action is taken. Content changes, an enrollment pause, or course archiving may be required depending on the case. Report count alone does not justify a warning, and creators can provide an explanation or appeal."]}};

const topics = [
  { key: 'guidelines', ar: 'إرشادات التعليم', en: 'Teaching guidelines', introAr: 'جهّز محتوى واضحًا وآمنًا، وشارك خبرتك بطريقة تساعد الآخرين على التعلّم.', introEn: 'Prepare clear, safe content and share your expertise to help others learn.' },
  { key: 'support', ar: 'المساعدة', en: 'Help', introAr: 'تعرّف إلى خطوات استخدام إسهام، وتابع تعلّمك بسهولة.', introEn: 'Find your way around Esham and keep your learning on track.' },
  { key: 'privacy', ar: 'الخصوصية', en: 'Privacy', introAr: 'معلومات عن بياناتك وكيفية حفظها أثناء استخدام المنصة.', introEn: 'Information about your data and how it is stored while you use the platform.' },
  { key: 'terms', ar: 'الشروط', en: 'Terms', introAr: 'قواعد واضحة للتعلّم، ومشاركة المعرفة، والتواصل داخل مجتمع إسهام.', introEn: 'Clear guidelines for learning, sharing knowledge and communicating in the Esham community.' },
];

export default function PlatformHelpPage() {
  const { topic } = useParams();
  const { language } = usePreferences();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const page = content[topic]?.[language];
  const current = topics.find(item => item.key === topic);
  const sections = page ? page.slice(1).reduce((items, title, index, values) => {
    if (index % 2 === 0 && title && values[index + 1]) {
      items.push({ title, body: values[index + 1], id: `help-${topic}-${index / 2 + 1}` });
    }
    return items;
  }, []) : [];

  return <main className="platform-help" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="platform-help-container">
      <nav className="platform-help-breadcrumb" aria-label={t('مسار الصفحة', 'Breadcrumb')}>
        <Link to="/">{t('الرئيسية', 'Home')}</Link>
        <span aria-hidden="true">/</span>
        <span>{current?.[language] || t('المساعدة', 'Help')}</span>
      </nav>
      <header className="platform-help-header">
        <span className="platform-help-eyebrow">{t('دليلك في إسهام', 'Your Esham guide')}</span>
        <h1>{page?.[0] || t('صفحة غير موجودة', 'Page not found')}</h1>
        {current && <p>{language === 'ar' ? current.introAr : current.introEn}</p>}
      </header>
      <div className="platform-help-layout">
        <aside className="platform-help-sidebar">
          <nav aria-label={t('صفحات المساعدة والسياسات', 'Help and policy pages')}>
            <h2>{t('روابط مفيدة', 'Useful links')}</h2>
            {topics.map(item => <Link key={item.key} to={`/help/${item.key}`} aria-current={topic === item.key ? 'page' : undefined}>
              <span>{item[language]}</span><span aria-hidden="true">{language === 'ar' ? '←' : '→'}</span>
            </Link>)}
          </nav>
          {sections.length > 1 && <nav className="platform-help-contents" aria-label={t('محتويات الصفحة', 'On this page')}>
            <h2>{t('في هذه الصفحة', 'On this page')}</h2>
            {sections.map(section => <a href={`#${section.id}`} key={section.id}>{section.title}</a>)}
          </nav>}
        </aside>
        <div className="platform-help-articles">
          {sections.map((section, index) => <section className="platform-help-card" id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
            <span className="platform-help-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div><h2 id={`${section.id}-title`}>{section.title}</h2><p>{section.body}</p></div>
          </section>)}
          <Link className="platform-help-back" to="/">{t('العودة للرئيسية', 'Back home')} <span aria-hidden="true">{language === 'ar' ? '←' : '→'}</span></Link>
        </div>
      </div>
    </div>
  </main>;
}
