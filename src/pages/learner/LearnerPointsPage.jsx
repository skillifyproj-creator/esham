import { useState } from "react";
import { Link } from "react-router";

import { usePreferences } from "../../context/PreferencesContext";
import { useLearner } from "../../context/LearnerContext";
import { useLearnerWallet } from "../../hooks/useLearnerWallet";

import { getEnrollmentDetails } from "../../data/learnerHelpers";
import { pointsPolicy } from "../../data/pointsPolicy";

const copy = {
  ar: {
    title: "محفظة النقاط",
    intro: "تابع رصيدك والمكافآت المسجّلة للدورات المعتمدة.",
    available: "الرصيد المتاح",
    earned: "نقاط مكتسبة من الدورات",
    approved: "دورات مُنحت مكافأتها",
    unit: "نقطة",
    policy: "كيف تُكتسب النقاط؟",
    policyText:
      "مكافأة الدورة تُضاف مرة واحدة بعد إكمال متطلباتها واعتمادها من المدرّب.",
    reward: "المكافأة المحددة لكل دورة",
    cost: "تكلفة التسجيل بالدورة منفصلة عن مكافأة إكمالها.",
    demo:
      "محفظة تجريبية: الرصيد الافتتاحي 50 نقطة. لا توجد مكافآت معتمدة أو حركات خصم مسجّلة حاليًا؛ التسجيل التجريبي في صفحة تفاصيل الدورة لم يُربط بالمحفظة بعد.",
    awarded: "الدورات التي منحتك نقاطًا",
    history: "سجل مكافآت النقاط",
    emptyAwards: "لا توجد مكافآت دورات معتمدة بعد.",
    emptyHistory: "ستظهر المكافآت هنا بعد اعتمادها وتسجيلها.",
    review: "مراجعة الدورة",
    date: "تاريخ الاعتماد",
    previous: "السابق",
    next: "التالي",
    page: "الصفحة",
    of: "من",
    more: "عرض المزيد",
    candidates: "دورات أنهيت دروسها",
    unawarded: "دروس مكتملة؛ مكافأة الدورة لم تُعتمد بعد.",
    none: "لم تُكمل دروس دورة بعد.",
    tasks: "متابعة المهام",
    progress: "عرض تقدّم التعلّم",
  },

  en: {
    title: "Points wallet",
    intro: "Track your balance and recorded rewards for approved courses.",
    available: "Available balance",
    earned: "Points earned from courses",
    approved: "Courses with awarded rewards",
    unit: "points",
    policy: "How are points earned?",
    policyText:
      "A course reward is awarded once after completing its requirements and instructor approval.",
    reward: "Configured reward per course",
    cost: "Enrollment cost is separate from the completion reward.",
    demo:
      "Demo wallet: 50 opening points. No approved rewards or deductions are recorded yet; demo enrollment on the course details page is not connected to this wallet.",
    awarded: "Courses that earned you points",
    history: "Points reward history",
    emptyAwards: "No approved course rewards yet.",
    emptyHistory: "Rewards will appear here after approval and recording.",
    review: "Review course",
    date: "Approval date",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    more: "Show more",
    candidates: "Courses with completed lessons",
    unawarded: "Lessons complete; course reward has not been approved yet.",
    none: "No course has all lessons complete yet.",
    tasks: "View tasks",
    progress: "View learning progress",
  },
};

const PAGE_SIZE = 3;

export default function LearnerPointsPage() {
  const { language } = usePreferences();
  const { enrollments } = useLearner();

  const {
    balance,
    earned,
    awards,
    approvedCount,
  } = useLearnerWallet();

  const t = copy[language];

  const [requestedPage, setPage] = useState(1);
  const [historyCount, setHistoryCount] = useState(4);

  const pages = Math.max(
    1,
    Math.ceil(awards.length / PAGE_SIZE),
  );

  const page = Math.min(requestedPage, pages);

  const shown = awards.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const awardedIds = new Set(
    awards.map((award) => award.courseId),
  );

  const candidates = enrollments
    .map(getEnrollmentDetails)
    .filter(
      (item) =>
        item?.isComplete &&
        !awardedIds.has(item.courseId),
    );

  const formatDate = (value) =>
    new Intl.DateTimeFormat(
      language === "ar" ? "ar" : "en",
      { dateStyle: "medium" },
    ).format(new Date(value));

  const courseLink = (id) =>
    enrollments.some((item) => item.courseId === id)
      ? `/learner/courses/${id}/learn`
      : `/courses/${id}`;

  const stats = [
    [t.earned, earned],
    [t.approved, approvedCount],
    [t.reward, pointsPolicy.courseReward],
  ];

  return (
    <main className="learner-dashboard">
      <div className="container">
        <header className="learner-welcome">
          <div>
            <span className="section-kicker">
              {t.available}
            </span>

            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </div>

          <Link
            className="button button-outline"
            to="/learner/progress"
          >
            {t.progress}
          </Link>
        </header>

        <p className="learner-demo-label">{t.demo}</p>

        <div className="wallet-hero">
          <section className="learner-panel wallet-balance">
            <h2>{t.available}</h2>

            <p className="wallet-number">
              <strong>{balance}</strong>
              <span>{t.unit}</span>
            </p>

            <p>
              {t.earned}: {earned} {t.unit}
            </p>
          </section>

          <section className="learner-panel wallet-policy">
            <h2>{t.policy}</h2>
            <p>{t.policyText}</p>

            <p>
              <strong>
                {t.reward}: {pointsPolicy.courseReward} {t.unit}
              </strong>
            </p>

            <p>{t.cost}</p>
          </section>
        </div>

        <section
          className="learner-summary wallet-summary"
          aria-label={t.title}
        >
          {stats.map(([label, value]) => (
            <article
              className="learner-panel learner-stat"
              key={label}
            >
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>

        <div className="wallet-layout">
          <section className="learner-panel">
            <h2>{t.awarded}</h2>

            <div className="wallet-awards">
              {shown.map((award) => (
                <article
                  className="wallet-award"
                  key={award.id}
                >
                  <img
                    src={award.course.image}
                    alt={award.course.title[language]}
                    loading="lazy"
                  />

                  <div>
                    <h3>{award.course.title[language]}</h3>

                    <p>
                      +{award.points} {t.unit}
                    </p>

                    <p>
                      {t.date}:{" "}
                      <time dateTime={award.approvedAt}>
                        {formatDate(award.approvedAt)}
                      </time>
                    </p>

                    <Link
                      className="button button-outline button-small"
                      to={courseLink(award.courseId)}
                    >
                      {t.review}
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {awards.length === 0 && (
              <p className="wallet-empty">
                {t.emptyAwards}
              </p>
            )}

            {pages > 1 && (
              <nav
                className="wallet-pagination"
                aria-label={t.page}
              >
                <button
                  className="button button-outline button-small"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  {t.previous}
                </button>

                <span>
                  {t.page} {page} {t.of} {pages}
                </span>

                <button
                  className="button button-outline button-small"
                  disabled={page === pages}
                  onClick={() => setPage(page + 1)}
                >
                  {t.next}
                </button>
              </nav>
            )}
          </section>

          <section className="learner-panel">
            <h2>{t.history}</h2>

            <ol className="wallet-history">
              {awards.slice(0, historyCount).map((award) => (
                <li key={award.id}>
                  <strong>
                    +{award.points} {t.unit}
                  </strong>

                  <Link to={courseLink(award.courseId)}>
                    {award.course.title[language]}
                  </Link>

                  <time dateTime={award.approvedAt}>
                    {formatDate(award.approvedAt)}
                  </time>
                </li>
              ))}
            </ol>

            {awards.length === 0 && (
              <p className="wallet-empty">
                {t.emptyHistory}
              </p>
            )}

            {awards.length > historyCount && (
              <button
                className="button button-outline"
                onClick={() =>
                  setHistoryCount((value) => value + 4)
                }
              >
                {t.more}
              </button>
            )}
          </section>
        </div>

        <section className="learner-panel wallet-candidates">
          <h2>{t.candidates}</h2>

          {candidates.map((item) => (
            <article key={item.courseId}>
              <h3>{item.course.title[language]}</h3>
              <p>{t.unawarded}</p>

              <Link
                className="button button-outline button-small"
                to={`/learner/tasks?course=${item.courseId}`}
              >
                {t.tasks}
              </Link>
            </article>
          ))}

          {candidates.length === 0 && (
            <p>{t.none}</p>
          )}
        </section>
      </div>
    </main>
  );
}