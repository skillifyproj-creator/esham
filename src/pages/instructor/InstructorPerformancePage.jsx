import { useState } from "react";
import { Link, useParams } from "react-router";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
import { instructorDemo } from "../../data/instructorDemo";

const performanceData = {
  learners: {
    enrolled: 248,
    started: 248,
    inProgress: 80,
    completed: 168,
  },

  ratings: {
    average: 4.7,
    total: 42,
    distribution: {
      5: 28,
      4: 10,
      3: 3,
      2: 1,
      1: 0,
    },
  },

  sections: [
    { id: "section-1", title: "أساسيات التصوير", completionRate: 92 },
    { id: "section-2", title: "الإضاءة والتكوين", completionRate: 78 },
    { id: "section-3", title: "التطبيق العملي", completionRate: 64 },
  ],

  pointsPerCompletion: 20,

  reviews: [
    {
      id: 1,
      name: "سارة",
      rating: 5,
      comment: "الدروس واضحة والمهام ساعدتني كثيرًا في التطبيق.",
      date: "منذ يومين",
    },
    {
      id: 2,
      name: "محمد",
      rating: 5,
      comment: "المحتوى ممتاز وأحببت الجانب العملي.",
      date: "منذ 5 أيام",
    },
  ],
};

const periods = [
  { value: "7d", label: "آخر 7 أيام" },
  { value: "30d", label: "آخر 30 يومًا" },
  { value: "3m", label: "آخر 3 أشهر" },
  { value: "all", label: "كل الوقت" },
];

export default function InstructorPerformancePage() {
  const [period, setPeriod] = useState("30d");
  const { courseId } = useParams();
  const { language } = usePreferences();

  const course = instructorDemo.courses.find(
    (item) => item.id === courseId,
  );
  const courseTitle = course?.title?.[language] || courseId || "—";
  const courseStatus = course?.status?.[language] || "—";
  const { learners, ratings, sections, pointsPerCompletion, reviews } =
    performanceData;

  const completionRate =
    learners.enrolled > 0
      ? Math.round((learners.completed / learners.enrolled) * 100)
      : 0;

  const earnedPoints = learners.completed * pointsPerCompletion;

  return (
    <div className="instructor-performance-page">
      <div className="container">
        {/* Header */}
        <header className="instructor-performance-header">
          <div>
            <div className="instructor-performance-title-row">
              <h1>أداء الدورة</h1>
              <span className="instructor-performance-status">
                {courseStatus}
              </span>
            </div>

            <p>دورة: {courseTitle}</p>
          </div>

          <div className="instructor-performance-actions">
            <label className="instructor-performance-period">
              <span>الفترة:</span>

              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                {periods.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <Link
              to={courseId ? `/courses/${courseId}` : "/instructor/courses"}
              className="instructor-performance-button"
            >
              <Icon name="eye" size={15} />
              عرض الدورة
            </Link>

            <Link
              to="/instructor/courses"
              className="instructor-performance-button primary"
            >
              <Icon name="settings" size={15} />
              إدارة الدورة
            </Link>
          </div>
        </header>

        {/* Metrics */}
        <section className="instructor-performance-metrics">
          <article className="instructor-performance-metric">
            <Icon name="users" size={18} />
            <span>المتعلمون</span>
            <strong>{learners.enrolled.toLocaleString("en-US")}</strong>
            <small>إجمالي المتعلمين</small>
          </article>

          <article className="instructor-performance-metric">
            <Icon name="check" size={18} />
            <span>أكملوا الدورة</span>
            <strong>{learners.completed.toLocaleString("en-US")}</strong>
            <small>{completionRate}% من المتعلمين</small>
          </article>

          <article className="instructor-performance-metric">
            <Icon name="star" size={18} />
            <span>التقييم</span>
            <strong>{ratings.average}</strong>
            <small>{ratings.total} تقييمًا</small>
          </article>

          <article className="instructor-performance-metric">
            <Icon name="award" size={18} />
            <span>النقاط الممنوحة</span>
            <strong>{earnedPoints.toLocaleString("en-US")}</strong>
            <small>{pointsPerCompletion} نقطة لكل إكمال</small>
          </article>
        </section>

        {/* Main Analytics */}
        <section className="instructor-performance-grid">
          {/* Learner Progress */}
          <article className="instructor-performance-card">
            <div className="instructor-performance-card-header">
              <div>
                <h2>تقدم المتعلمين</h2>
                <p>
                  {learners.completed} من أصل {learners.enrolled} متعلمًا
                  أكملوا الدورة
                </p>
              </div>
            </div>

            <div className="instructor-progress-list">
              <ProgressRow
                label="بدأوا الدورة"
                value={learners.started}
                total={learners.enrolled}
              />

              <ProgressRow
                label="في طور التعلم"
                value={learners.inProgress}
                total={learners.enrolled}
              />

              <ProgressRow
                label="أكملوا الدورة"
                value={learners.completed}
                total={learners.enrolled}
              />
            </div>
          </article>

          {/* Section Engagement */}
          <article className="instructor-performance-card">
            <div className="instructor-performance-card-header">
              <div>
                <h2>تفاعل المتعلمين مع المحتوى</h2>
                <p>نسبة إكمال كل قسم من أقسام الدورة</p>
              </div>
            </div>

            <div className="instructor-section-performance">
              {sections.map((section) => (
                <div
                  className="instructor-section-performance-row"
                  key={section.id}
                >
                  <div>
                    <strong>{section.title}</strong>
                    <span>{section.completionRate}%</span>
                  </div>

                  <div className="instructor-performance-bar">
                    <span
                      style={{
                        width: `${section.completionRate}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* Reviews */}
        <section className="instructor-performance-grid">
          <article className="instructor-performance-card">
            <div className="instructor-performance-card-header">
              <div>
                <h2>تقييمات المتعلمين</h2>
                <p>متوسط تقييم الدورة وتوزيع التقييمات</p>
              </div>
            </div>

            <div className="instructor-rating-summary">
              <strong>{ratings.average}</strong>

              <div>
                <div className="instructor-stars">★★★★★</div>
                <span>متوسط من {ratings.total} تقييمًا</span>
              </div>
            </div>

            <div className="instructor-rating-distribution">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratings.distribution[star];
                const width =
                  ratings.total > 0 ? (count / ratings.total) * 100 : 0;

                return (
                  <div key={star}>
                    <span>{star} نجوم</span>

                    <div className="instructor-performance-bar">
                      <span style={{ width: `${width}%` }} />
                    </div>

                    <strong>{count}</strong>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="instructor-performance-card">
            <div className="instructor-performance-card-header">
              <div>
                <h2>آخر التقييمات</h2>
                <p>أحدث ملاحظات المتعلمين</p>
              </div>
            </div>

            <div className="instructor-latest-reviews">
              {reviews.map((review) => (
                <div
                  className="instructor-latest-review"
                  key={review.id}
                >
                  <div className="instructor-latest-review-top">
                    <strong>{review.name}</strong>
                    <span>★★★★★</span>
                  </div>

                  <p>«{review.comment}»</p>
                  <small>{review.date}</small>
                </div>
              ))}
            </div>

            <Link
              to="/instructor/feedback"
              className="instructor-all-reviews"
            >
              عرض جميع التقييمات
              <Icon name="arrow-left" size={14} />
            </Link>
          </article>
        </section>

        {/* Points */}
        <section className="instructor-performance-points">
          <div>
            <Icon name="award" size={21} />

            <div>
              <span>نظام النقاط المعتمدة في الدورة</span>
              <p>
                يحصل المتعلم على {pointsPerCompletion} نقطة عند إكمال الدورة
                واستيفاء المهام العملية.
              </p>
            </div>
          </div>

          <strong>{earnedPoints.toLocaleString("en-US")} نقطة</strong>
        </section>
      </div>
    </div>
  );
}

function ProgressRow({ label, value, total }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="instructor-progress-row">
      <div>
        <span>{label}</span>
        <strong>
          {value} متعلمًا ({percentage}%)
        </strong>
      </div>

      <div className="instructor-performance-bar">
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}