import { instructorPublicCourseIds } from "../../data/instructorCourseLinks";
import { useState } from "react";
import { Link, useParams } from "react-router";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
import { instructorDemo } from "../../data/instructorDemo";
import instructorCopy from "../../i18n/instructorCopy";

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
    { id: "section-1", completionRate: 92 },
    { id: "section-2", completionRate: 78 },
    { id: "section-3", completionRate: 64 },
  ],

  pointsPerCompletion: 20,

  reviews: [
    {
      id: 1,
      rating: 5,
    },
    {
      id: 2,
      rating: 5,
    },
  ],
};

const periodValues = ["7d", "30d", "3m", "all"];

export default function InstructorPerformancePage() {
  const [period, setPeriod] = useState("30d");
  const { courseId } = useParams();
  const { language } = usePreferences();
  const t = instructorCopy[language].performancePage;

  const course = instructorDemo.courses.find(
    (item) => item.id === courseId,
  );
  const courseTitle = course?.title?.[language] || "—";
  const courseStatus = course?.status?.[language] || "—";
  const scopedData = courseId && course
    ? {
        learners: {
          enrolled: course.learners,
          started: course.learners,
          completed: Math.round(course.learners * performanceData.learners.completed / performanceData.learners.enrolled),
          inProgress: course.learners - Math.round(course.learners * performanceData.learners.completed / performanceData.learners.enrolled),
        },
        ratings: { ...performanceData.ratings, average: course.rating, total: course.ratingCount },
        sections: course.id === "photography" ? performanceData.sections : [],
        pointsPerCompletion: course.coursePoints || performanceData.pointsPerCompletion,
        reviews: course.id === "photography" ? performanceData.reviews : [],
      }
    : performanceData;
  const { learners, ratings, sections, pointsPerCompletion, reviews } = scopedData;

  const completionRate =
    learners.enrolled > 0
      ? Math.round((learners.completed / learners.enrolled) * 100)
      : 0;

  const earnedPoints = learners.completed * pointsPerCompletion;

  return (
    <div className="instructor-performance-page instructor-detail-page">
      <div className="container">
        {/* Header */}
        <header className="instructor-performance-header">
          <div>
            <div className="instructor-performance-title-row">
              <h1>{courseId ? t.titleCourse : t.titleGeneral}</h1>
              {courseId && <span className="instructor-performance-status">{courseStatus}</span>}
            </div>

            <p>{courseId ? t.coursePrefix.replace("{course}", courseTitle) : t.generalDescription}</p>
          </div>

          <div className="instructor-performance-actions">
            <label className="instructor-performance-period">
              <span>{t.period}</span>

              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                {periodValues.map((value) => (
                  <option key={value} value={value}>{t.periods[value]}</option>
                ))}
              </select>
            </label>

            {courseId && (<Link
              to={instructorPublicCourseIds[courseId] ? `/courses/${instructorPublicCourseIds[courseId]}` : "/instructor/courses"}
              className="instructor-performance-button"
            >
              <Icon name="eye" size={15} />
              {t.viewCourse}
            </Link>
            )}

            <Link
              to="/instructor/courses"
              className="instructor-performance-button primary"
            >
              <Icon name="settings" size={15} />
              {t.manageCourses}
            </Link>
          </div>
        </header>

        {/* Metrics */}
        <section className="instructor-performance-metrics">
          <article className="instructor-performance-metric">
            <Icon name="users" size={18} />
            <span>{t.learners}</span>
            <strong>{learners.enrolled.toLocaleString("en-US")}</strong>
            <small>{t.totalLearners}</small>
          </article>

          <article className="instructor-performance-metric">
            <Icon name="check" size={18} />
            <span>{t.completed}</span>
            <strong>{learners.completed.toLocaleString("en-US")}</strong>
            <small>{t.completionRate.replace("{percent}", completionRate)}</small>
          </article>

          <article className="instructor-performance-metric">
            <Icon name="star" size={18} />
            <span>{t.rating}</span>
            <strong>{ratings.average}</strong>
            <small>{t.ratingCount.replace("{count}", ratings.total)}</small>
          </article>

          <article className="instructor-performance-metric">
            <Icon name="award" size={18} />
            <span>{t.pointsAwarded}</span>
            <strong>{earnedPoints.toLocaleString("en-US")}</strong>
            <small>{t.pointsPerCompletion.replace("{count}", pointsPerCompletion)}</small>
          </article>
        </section>

        {/* Main Analytics */}
        <section className="instructor-performance-grid">
          {/* Learner Progress */}
          <article className="instructor-performance-card">
            <div className="instructor-performance-card-header">
              <div>
                <h2>{t.learnerProgress}</h2>
                <p>
                  {t.completionSummary.replace("{completed}", learners.completed).replace("{total}", learners.enrolled)}
                </p>
              </div>
            </div>

            <div className="instructor-progress-list">
              <ProgressRow
                label={t.started} t={t}
                value={learners.started}
                total={learners.enrolled}
              />

              <ProgressRow
                label={t.inProgress} t={t}
                value={learners.inProgress}
                total={learners.enrolled}
              />

              <ProgressRow
                label={t.completedLabel} t={t}
                value={learners.completed}
                total={learners.enrolled}
              />
            </div>
          </article>

          {/* Section Engagement */}
          <article className="instructor-performance-card">
            <div className="instructor-performance-card-header">
              <div>
                <h2>{t.sectionEngagement}</h2>
                <p>{t.sectionCompletion}</p>
              </div>
            </div>

            <div className="instructor-section-performance">
              {sections.map((section) => (
                <div
                  className="instructor-section-performance-row"
                  key={section.id}
                >
                  <div>
                    <strong>{t.sections[section.id]}</strong>
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
              {!sections.length && <p>{t.noSections}</p>}
            </div>
          </article>
        </section>

        {/* Reviews */}
        <section className="instructor-performance-grid">
          <article className="instructor-performance-card">
            <div className="instructor-performance-card-header">
              <div>
                <h2>{t.learnerRatings}</h2>
                <p>{t.ratingSummary}</p>
              </div>
            </div>

            <div className="instructor-rating-summary">
              <strong>{ratings.average}</strong>

              <div>
                <div className="instructor-stars">★★★★★</div>
                <span>{t.averageFrom.replace("{count}", ratings.total)}</span>
              </div>
            </div>

            <div className="instructor-rating-distribution">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratings.distribution[star];
                const width =
                  ratings.total > 0 ? (count / ratings.total) * 100 : 0;

                return (
                  <div key={star}>
                    <span>{t.stars.replace("{count}", star)}</span>

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
                <h2>{t.latestReviews}</h2>
                <p>{t.latestReviewsDescription}</p>
              </div>
            </div>

            <div className="instructor-latest-reviews">
              {reviews.map((review) => (
                <div
                  className="instructor-latest-review"
                  key={review.id}
                >
                  <div className="instructor-latest-review-top">
                    <strong>{t.reviewSamples[review.id].name}</strong>
                    <span>★★★★★</span>
                  </div>

                  <p>«{t.reviewSamples[review.id].comment}»</p>
                  <small>{t.reviewSamples[review.id].date}</small>
                </div>
              ))}
              {!reviews.length && <p>{t.noReviews}</p>}
            </div>

            <Link
              to="/instructor/feedback"
              className="instructor-all-reviews"
            >
              {t.allReviews}
              <Icon name="arrow-left" size={14} />
            </Link>
          </article>
        </section>

        {/* Points */}
        <section className="instructor-performance-points">
          <div>
            <Icon name="award" size={21} />

            <div>
              <span>{t.pointsSystem}</span>
              <p>
                {t.pointsDescription.replace("{points}", pointsPerCompletion)}
              </p>
            </div>
          </div>

          <strong>{earnedPoints.toLocaleString(language === "ar" ? "ar" : "en-US")} {t.pointUnit}</strong>
        </section>
      </div>
    </div>
  );
}

function ProgressRow({ label, value, total, t }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="instructor-progress-row">
      <div>
        <span>{label}</span>
        <strong>
          {t.learnerCount.replace("{count}", value).replace("{percent}", percentage)}
        </strong>
      </div>

      <div className="instructor-performance-bar">
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
