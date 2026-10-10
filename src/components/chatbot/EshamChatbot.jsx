import React, { useEffect, useRef, useState } from "react";
import "../../styles/esham-chatbot.css";
import { usePreferences } from "../../context/PreferencesContext";
import { pointsPolicy } from "../../data/pointsPolicy";
import { useLearnerWallet } from "../../hooks/useLearnerWallet";
const copy = {
  ar: {
    title: "إسهام للمهارات والتعلّم",
    assistant: "مساعد إسهام الذكي",
    online: "جاهز للمساعدة",
    chat: "المحادثة التعليمية",
    history: "سجل الجلسات",
    sources: "المصادر والمراجع",
    newChat: "محادثة جديدة",
    preview: "معاينة الحالات",
    intro: "مرحبًا بك! كيف أستطيع توجيهك اليوم؟",
    description: "اسأل عن دورات إسهام، درسك الحالي، أو أي موضوع تريد تعلّمه.",
    tag: "مساعدك في التعلم والاستكشاف",
    topics: [
      "النقاط والمكافآت",
      "دوراتي والتعلم",
      "إنشاء ونشر الدورات",
      "إدارة الحساب",
    ],
    suggestions: [
      ["كيف أعرف رصيد نقاطي؟", "عرض رصيد حسابك وخطوات الوصول للمحفظة"],
      ["كيف أستخدم نقاطي للتسجيل في دورة؟", "خطوات التسجيل من صفحة الدورة"],
      ["كيف أنشئ دورة؟", "دليل إنشاء محتوى تعليمي"],
      ["اشرح لي هذا الجزء من الدرس", "تبسيط المفاهيم خطوة بخطوة"],
    ],
    placeholder: "اسأل مساعد إسهام الذكي...",
    attach: "إرفاق صورة أو ملف",
    remove: "إزالة المرفق",
    send: "إرسال",
    disclaimer:
      "قد يخطئ المساعد أحيانًا؛ تحقّق من المعلومات المهمة. التسجيل وصرف النقاط يتمان داخل إسهام.",
    demo: "بيانات توضيحية للمعاينة",
    wallet: "محفظة نقاط التعلم",
    points: "نقطة",
    balance: "رصيد تجريبي",
    walletNote: "الرصيد المحلي لحسابك؛ المزامنة بين الأجهزة تحتاج ربط الخدمة.",
    rules: "ضوابط استبدال النقاط",
    rulesBody:
      "التسجيل في أي دورة يكلف 20 نقطة، ويكسب صاحبها 20 نقطة عن كل متعلّم يسجّل فيها. المساعد يرشدك ولا يخصم النقاط نيابة عنك.",
    context: "المساعد العام • اسأل عن أي مجال",
    contextLesson: "مساعدة في التعلّم • الدرس الحالي",
    contextAttachment: "تحليل مرفق • نسخة تجريبية",
    thinking: "مساعد إسهام الذكي يجهّز الإجابة...",
    error: "تعذّر تجهيز الإجابة",
    errorBody: "لم أتمكّن من تجهيز الإجابة الآن. جرّب مرة أخرى أو عدّل سؤالك.",
    retry: "حاول مرة أخرى",
    edit: "إعادة صياغة السؤال",
    pointsAnswer:
      "يمكنك معرفة رصيدك من حسابك في إسهام ثم «محفظة النقاط». عند الربط الآمن مع حسابك، سيظهر الرصيد الحقيقي هنا.",
    spendAnswer:
      "للتسجيل بالنقاط، افتح صفحة الدورة وراجع التكلفة والشروط، ثم أكمل العملية بنفسك من صفحة الدورة. لا يستطيع المساعد خصم النقاط أو تسجيلك.",
    courseAnswer:
      "لإنشاء دورة، ابدأ من استوديو الدورات: أضف وصف الدورة وأقسامها ودروسها، ثم أرسلها للمراجعة إذا كان ذلك مطلوبًا في المنصة. أستطيع شرح كل خطوة، لكنني لا أنشر الدورة بدلًا منك.",
    lessonAnswer:
      "أستطيع تبسيط أي مفهوم في درسك. حدّد اسم الدورة والدرس أو اذكر الجزء المقصود، وسأشرحه خطوة بخطوة. عند دمج الشات بالمنصة يمكن تمرير سياق الدرس المفتوح تلقائيًا.",
    attachmentAnswer:
      "وصلني المرفق. هذه المعاينة لا تحلل محتواه بعد؛ عندما تُربط الواجهة بخدمة تدعم هذا النوع سأشرح العناصر الموجودة فيه بدل تخمينها.",
    generalAnswer:
      "وصلني سؤالك. هذه نسخة فرونت إند تجريبية، لذلك لا أقدّم جوابًا معرفيًا مختلقًا. بعد ربط نموذج عام ستظهر الإجابة المناسبة هنا، سواء تعلق السؤال بدورة أو بأي موضوع آخر.",
    courseCard: "دورة توضيحية",
    courseName: "تصميم الواجهات وتجربة المستخدم",
    cost: `${pointsPolicy.enrollmentCost} نقطة • تكلفة التسجيل الموحدة`,
    enrollmentCost: "تكلفة التسجيل",
    cardAction: "كيف أسجّل باستخدام النقاط؟",
    stepTitle: "خطوات استخدام النقاط",
    stepItems: [
      "افتح صفحة الدورة المطلوبة",
      "راجع التكلفة ورصيدك الحقيقي",
      "أكمل التسجيل من صفحة الدورة",
    ],
    attachmentNote: "المرفق محفوظ للعرض في المحادثة؛ لم يُرسل إلى خادم.",
    invalid: "الملف غير مدعوم. اختر صورة أو PDF أو TXT.",
    large: "الحد الأقصى للملف 10 ميغابايت.",
    previewNames: [
      "شاشة البداية",
      "النقاط والدورات",
      "مساعدة المنصة",
      "مساعدة التعلّم",
      "مرفق",
      "التحميل",
      "الخطأ",
    ],
    noVoice: "الصوت غير مطلوب في هذه النسخة.",
  },
  en: {
    title: "Es’ham Learning & Skills",
    assistant: "Es’ham Assistant",
    online: "Ready to help",
    chat: "Learning chat",
    history: "Sessions",
    sources: "Resources",
    newChat: "New chat",
    preview: "Preview states",
    intro: "Welcome! How can I help you today?",
    description:
      "Ask about Es’ham courses, your current lesson, or anything you want to learn.",
    tag: "Your learning companion",
    topics: ["Points and rewards", "My learning", "Create courses", "Account"],
    suggestions: [
      ["How do I check my points?", "Find your wallet and account balance"],
      ["How do I use points for a course?", "Enroll from the course page"],
      ["How do I create a course?", "Guide to preparing course content"],
      ["Explain this lesson concept", "Learn step by step"],
    ],
    placeholder: "Ask Es’ham Assistant...",
    attach: "Attach an image or file",
    remove: "Remove attachment",
    send: "Send",
    disclaimer:
      "The assistant may make mistakes. Verify important information. Enrollment and point redemption happen within Es’ham.",
    demo: "Sample data for preview",
    wallet: "Learning points wallet",
    points: "points",
    balance: "Sample balance",
    walletNote: "Your local account balance; cross-device synchronization requires the account service.",
    rules: "Point redemption rules",
    rulesBody:
      "Every course costs 20 points to enroll; its instructor earns 20 points per learner enrollment. The assistant guides you but cannot redeem points for you.",
    context: "General assistant • ask about anything",
    contextLesson: "Learning support • current lesson",
    contextAttachment: "Attachment analysis • demo",
    thinking: "Es’ham Assistant is preparing an answer...",
    error: "Unable to prepare an answer",
    errorBody:
      "I could not prepare an answer now. Please retry or edit your question.",
    retry: "Try again",
    edit: "Edit question",
    pointsAnswer:
      "Open your Es’ham account and Points Wallet to see your balance. After secure integration, your actual balance can appear here.",
    spendAnswer:
      "To enroll with points, open the course page, review its cost and conditions, then complete enrollment yourself there. The assistant cannot deduct points or enroll you.",
    courseAnswer:
      "Start in Course Studio: add a description, sections and lessons, then submit for review if required. I can explain each step but cannot publish on your behalf.",
    lessonAnswer:
      "I can explain a concept from any lesson. Tell me the course and lesson or point to the part you mean. The current lesson context can be passed automatically after integration.",
    attachmentAnswer:
      "I received your attachment. This demo does not analyze it yet. Once a compatible service is connected, I can explain its actual content rather than guess.",
    generalAnswer:
      "I received your question. This frontend demo does not invent factual answers. A general AI model can respond here after integration, whether your question relates to a course or any other subject.",
    courseCard: "Sample course",
    courseName: "Interface and UX Design",
    cost: `${pointsPolicy.enrollmentCost} points • fixed enrollment cost`,
    enrollmentCost: "Enrollment cost",
    cardAction: "How do I enroll with points?",
    stepTitle: "Using points",
    stepItems: [
      "Open the course page",
      "Review the actual cost and balance",
      "Complete enrollment on the course page",
    ],
    attachmentNote:
      "The attachment is only shown locally; it was not sent to a server.",
    invalid: "Unsupported file. Choose an image, PDF or TXT.",
    large: "Files must be under 10 MB.",
    previewNames: [
      "Welcome",
      "Points and courses",
      "Platform help",
      "Learning",
      "Attachment",
      "Loading",
      "Error",
    ],
    noVoice: "Voice is not included in this version.",
  },
};
const accepted = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
];
const time = (lang) =>
  new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
function classify(message) {
  const q = message.text.toLowerCase();
  if (message.file) return "attachment";
  if (
    /رصيد|نقاط|balance|my points/.test(q) &&
    !/تسجيل|استخدم|صرف|enroll|use/.test(q)
  )
    return "points";
  if (/صرف|تسجيل|استخدم|enroll|redeem|use points/.test(q)) return "spend";
  if (/أنشئ|إنشاء|انشئ|نشر دورة|create a course/.test(q)) return "course";
  if (/درس|اشرح|مفهوم|lesson|explain/.test(q)) return "lesson";
  return "general";
}
const iconPaths = {
  person: <><circle cx="12" cy="8" r="3" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6H5Z" /></>,
  smart_toy: <><rect x="4" y="6" width="16" height="14" rx="3" /><path d="M12 3v3M8 12h.01M16 12h.01M9 16h6" /></>,
  auto_awesome: <path d="m12 2 1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2Z" />,
  account_balance_wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M15 14h4" /></>,
  school: <><path d="m2 8 10-5 10 5-10 5L2 8ZM6 11v6c3 3 9 3 12 0v-6M22 8v8" /></>,
  edit_note: <><path d="M4 6h11M4 11h9M4 16h7M14 18l5-5 2 2-5 5-3 1 1-3Z" /></>,
  menu_book: <path d="M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1Zm0 0v14" />,
  description: <path d="M6 2h9l4 4v16H6V2ZM15 2v5h4M9 12h7M9 16h7" />,
  attach_file: <path d="m19 12-7 7a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7" />,
  send: <path d="m3 11 18-8-8 18-2-8-8-2Zm8 2 10-10" />,
};

function Icon({ children }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[children] || iconPaths.auto_awesome}
    </svg>
  );
}
export default function EshamChatbot() {
  const { language: lang, toggleLanguage } = usePreferences();
  const { balance: walletBalance } = useLearnerWallet();

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const timer = useRef(null),
    fileInput = useRef(null),
    end = useRef(null),
    textArea = useRef(null),
    urls = useRef(new Set());
  const w = copy[lang];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const hasPoints = messages.some(
      (m) => m.kind === "points" || m.kind === "spend",
    ),
    hasCourse = messages.some((m) => m.kind === "course"),
    hasLesson = messages.some(
      (m) => m.kind === "lesson" || m.kind === "attachment",
    );
  function answer(sent, kind) {
    setBusy(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          kind,
          text: w[kind + "Answer"] || w.generalAnswer,
          time: time(lang),
        },
      ]);
    }, 900);
  }
  function send(value = draft, selected = file) {
    if (busy) return;
    const text = value.trim();
    if (!text && !selected) return;
    const sent = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      file: selected && {
        name: selected.name,
        type: selected.type,
        url: selected.url,
      },
      time: time(lang),
    };
    setMessages((prev) => [...prev, sent]);
    setDraft("");
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    answer(sent, classify(sent));
  }
  function reset() {
    clearTimeout(timer.current);
    setBusy(false);
    setMessages([]);
    setDraft("");
    setFile(null);
    setPreview("");
    if (fileInput.current) fileInput.current.value = "";
  }
  function selectFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!accepted.includes(f.type)) {
      alert(w.invalid);
      e.target.value = "";
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert(w.large);
      e.target.value = "";
      return;
    }
    const url = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    if (url) urls.current.add(url);
    setFile({ name: f.name, type: f.type, raw: f, url });
  }
  function showPreview(index) {
    reset();
    setPreview(String(index));
    if (index === 0) return;
    const kinds = [
      "",
      "points",
      "course",
      "lesson",
      "attachment",
      "loading",
      "error",
    ];
    const kind = kinds[index];
    const example = w.suggestions[index === 1 ? 0 : index === 2 ? 2 : 3][0];
    const sent = {
      id: crypto.randomUUID(),
      role: "user",
      text: kind === "attachment" ? "اشرح محتوى الصورة" : example,
      time: time(lang),
      file:
        kind === "attachment"
          ? { name: "lesson-diagram.png", type: "image/png", url: null }
          : null,
    };
    setMessages([sent]);
    if (kind === "loading") {
      setBusy(true);
      return;
    }
    if (kind === "error") {
      setMessages([
        sent,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          kind: "error",
          source: sent,
          time: time(lang),
        },
      ]);
      return;
    }
    setMessages([
      sent,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        kind,
        text: w[kind + "Answer"] || w.generalAnswer,
        time: time(lang),
      },
    ]);
  }
  return (
    <div className="esham-chatbot">
      <header className="topbar">
        <div className="brand">
<span className="brand-icon" aria-hidden="true">
  <Icon>smart_toy</Icon>
</span>          <div>
            <strong>{w.title}</strong>
            <small>
              {w.assistant} · {w.online}
            </small>
          </div>
        </div>
        <nav className="desktop-nav" aria-label={w.chat}>
          <span className="active">{w.chat}</span>
          <span>{w.history}</span>
          <span>{w.sources}</span>
        </nav>
        <div className="header-actions">
          <div className="language-switch">
            <button
              className={lang === "ar" ? "selected" : ""}
              onClick={() => {
                if (lang !== "ar") toggleLanguage();
              }}
            >
              العربية
            </button>
            <button
              className={lang === "en" ? "selected" : ""}
              onClick={() => {
                if (lang !== "en") toggleLanguage();
              }}
            >
              English
            </button>
          </div>
          <select
            aria-label={w.preview}
            value={preview}
            onChange={(e) => showPreview(Number(e.target.value))}
          >
            <option value="">{w.preview}</option>
            {w.previewNames.map((name, i) => (
              <option value={i} key={i}>
                {name}
              </option>
            ))}
          </select>
          <button className="subtle-button" onClick={reset}>
            {w.newChat}
          </button>
        </div>
      </header>
      <div className="workspace">
        <div className="context-strip">
          <span className="status-dot" />
          {hasLesson
            ? w.contextLesson
            : hasCourse
              ? w.context
              : hasPoints
                ? w.context
                : w.context}
        </div>
        <div
          className={"chat-grid " + (hasPoints || hasCourse ? "with-side" : "")}
        >
          {(hasPoints || hasCourse) && (
            <aside className="side-panel">
              <div className="side-card">
                <div className="side-heading">
                  <span className="icon-tile">
                    <Icon>account_balance_wallet</Icon>
                  </span>
                  <div>
                    <strong>{hasCourse ? w.courseName : w.wallet}</strong>
                    <small>{w.demo}</small>
                  </div>
                </div>
                <div className="balance-panel">
                  <span>{hasCourse ? w.enrollmentCost : w.balance}</span>
                  <strong>
                    {hasCourse ? pointsPolicy.enrollmentCost : walletBalance}{" "}
                    <small>{w.points}</small>
                  </strong>
                  <p>{w.walletNote}</p>
                </div>
              </div>
              <div className="side-card">
                <strong>{w.rules}</strong>
                <p>{w.rulesBody}</p>
              </div>
            </aside>
          )}
          <main className="chat-layout">
            <div
              className="conversation"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.length === 0 && !busy && (
                <section className="welcome">
                  <div className="welcome-icon">
                    <Icon>auto_awesome</Icon>
                  </div>
                  <span className="eyebrow">● {w.tag}</span>
                  <h1>{w.intro}</h1>
                  <p>{w.description}</p>
                  <div className="topics">
                    {w.topics.map((x) => (
                      <span className="topic" key={x}>
                        {x}
                      </span>
                    ))}
                  </div>
                  <div className="suggestion-heading">
                    {lang === "ar" ? "جرّب أن تسأل:" : "Try asking:"}
                  </div>
                  <div className="suggestions">
                    {w.suggestions.map(([title, subtitle], i) => (
                      <button
                        className="suggestion"
                        key={title}
                        onClick={() => send(title, null)}
                      >
                        <span className="suggestion-icon">
                          <Icon>
                            {
                              [
                                "account_balance_wallet",
                                "school",
                                "edit_note",
                                "menu_book",
                              ][i]
                            }
                          </Icon>
                        </span>
                        <span>
                          <strong>{title}</strong>
                          <small>{subtitle}</small>
                        </span>
                        <span className="arrow">←</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {messages.map((m) => (
                <article key={m.id} className={"message " + m.role}>
                  <div className="message-avatar">
                    <Icon>{m.role === "user" ? "person" : "smart_toy"}</Icon>
                  </div>
                  <div className="message-content">
                    {m.role === "assistant" && (
                      <div className="assistant-label">{w.assistant}</div>
                    )}
                    <div className="bubble">
                      {m.file && (
                        <div className="file-chip">
                          {m.file.url ? (
                            <img src={m.file.url} alt={m.file.name} />
                          ) : (
                            <Icon>description</Icon>
                          )}
                          <span>{m.file.name}</span>
                        </div>
                      )}
                      {m.kind === "error" ? (
                        <>
                          <strong>{w.error}</strong>
                          <p>{w.errorBody}</p>
                          <div className="followups">
                            <button
                              onClick={() => {
                                setMessages((prev) =>
                                  prev.filter((x) => x.id !== m.id),
                                );
                                answer(m.source, classify(m.source));
                              }}
                            >
                              {w.retry}
                            </button>
                            <button
                              onClick={() => {
                                setDraft(m.source.text);
                                textArea.current?.focus();
                              }}
                            >
                              {w.edit}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {m.text}
                          {m.kind === "points" && (
                            <div className="result-card">
                              <small>{w.demo}</small>
                              <strong>{w.wallet}</strong>
                              <div className="balance-line">
                                {walletBalance} {w.points}
                              </div>
                              <p>{w.walletNote}</p>
                            </div>
                          )}
                          {m.kind === "spend" && (
                            <div className="result-card">
                              <small>{w.demo}</small>
                              <strong>
                                {w.courseCard}: {w.courseName}
                              </strong>
                              <p>{w.cost}</p>
                              <button
                                className="inline-button"
                                onClick={() => send(w.cardAction, null)}
                              >
                                {w.cardAction}
                              </button>
                            </div>
                          )}
                          {m.kind === "course" && (
                            <div className="result-card">
                              <strong>{w.stepTitle}</strong>
                              <ol>
                                {w.stepItems.map((step) => (
                                  <li key={step}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                          {m.kind === "attachment" && (
                            <div className="result-card">
                              <small>{w.attachmentNote}</small>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <span className="meta">{m.time}</span>
                  </div>
                </article>
              ))}
              {busy && (
                <article className="message assistant">
                  <div className="message-avatar">
                    <Icon>smart_toy</Icon>
                  </div>
                  <div className="message-content">
                    <div className="assistant-label">{w.assistant}</div>
                    <div className="bubble loading" role="status">
                      {w.thinking}
                      <span className="dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                  </div>
                </article>
              )}
              <div ref={end} />
            </div>
            <div className="composer-wrap">
              {file && (
                <div className="attachment-preview">
                  {file.url ? (
                    <img src={file.url} alt="" />
                  ) : (
                    <Icon>description</Icon>
                  )}
                  <span>{file.name}</span>
                  <button
                    aria-label={w.remove}
                    onClick={() => {
                      setFile(null);
                      fileInput.current.value = "";
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <label
                  className="attach-button"
                  title={w.attach}
                  aria-label={w.attach}
                >
                  <Icon>attach_file</Icon>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
                    disabled={busy}
                    onChange={selectFile}
                    hidden
                  />
                </label>
                <textarea
                  ref={textArea}
                  rows="1"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={w.placeholder}
                  aria-label={w.placeholder}
                />
                <button
                  className="send-button"
                  disabled={busy || (!draft.trim() && !file)}
                  aria-label={w.send}
                >
                  <Icon>send</Icon>
                </button>
              </form>
              <p className="disclaimer">{w.disclaimer}</p>
            </div>
          </main>
        </div>
      </div>

    </div>
  );
}
