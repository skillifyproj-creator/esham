import useInstructorInsights from '../../hooks/useInstructorInsights';
import { localizedInstructorText } from '../../services/instructorInsights';

import { useState } from "react";
import { Link, useParams } from "react-router";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";

import instructorCopy from "../../i18n/instructorCopy";

const periodValues = ["7d", "30d", "3m", "all"];

export default function InstructorPerformancePage() {

  const [period, setPeriod] = useState("30d");
  const { courseId } = useParams();
  const { language } = usePreferences();
  const t = instructorCopy[language].performancePage;

  const { data, loading, error } = useInstructorInsights('performance', { courseId, period });
  const latest = useInstructorInsights('reviews', { courseId });
  const course = data?.course;
  const courseTitle = localizedInstructorText(course, language);
  const courseStatus = course?.status || '—';
  const learners = data?.learners || { enrolled: 0, started: 0, inProgress: 0, completed: 0 };
  const ratings = data?.ratings || { average: 0, total: 0, distribution: {} };
  const sections = data?.sections || [];
  const reviews = latest.data?.items?.slice(0, 2) || [];
  const earnedPoints = data?.earnedPoints || 0;

  const completionRate =
    learners.enrolled > 0
      ? Math.round((learners.completed / learners.enrolled) * 100)
      : 0;

  if (loading || error) return <main className="container instructor-detail-page"><h1>{courseId ? t.titleCourse : t.titleGeneral}</h1><p role={error ? 'alert' : 'status'}>{error || (language === 'ar' ? 'جارٍ التحميل…' : 'Loading…')}</p></main>;
  return (<div className="instructor-performance-page instructor-detail-page">
      <div className="container">
        {loading && <p role="status">{language === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</p>}
        {(error || latest.error) && <p role="alert">{error || latest.error}</p>}
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
              to={`/courses/${courseId}`}
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
            <small>{language === 'ar' ? 'نقاط التدريس المسجلة' : 'Recorded teaching points'}</small>
          </article>
        </section>

        {/* Main Analytics */}
        <section className="instructor-performance-grid">
          {/* Learner Progress */}
          <article className="instructor-performance-card">
            <div className="instructor-performance-card-header">
              <div>
                <h2>{t.learnerProgress}</h2>
                <p>{language === 'ar' ? 'بانتظار المراجعة' : 'Awaiting review'}: {data?.taskStats?.awaitingReview ?? 0} · {language === 'ar' ? 'محاولات معتمدة' : 'Approved attempts'}: {data?.taskStats?.approvedAttempts ?? 0}</p>
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
                    <strong>{localizedInstructorText(section, language)}</strong>
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
                <div className="instructor-stars" aria-label={`${ratings.average} / 5`}>{'★'.repeat(Math.round(ratings.average))}{'☆'.repeat(5 - Math.round(ratings.average))}</div>
                <span>{t.averageFrom.replace("{count}", ratings.total)}</span>
              </div>
            </div>

            <div className="instructor-rating-distribution">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratings.distribution[star] || 0;
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
                    <strong>{language === 'ar' ? review.learnerName || review.learnerNameEn : review.learnerNameEn || review.learnerName}</strong>
                    <span aria-label={`${review.rating} / 5`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                  </div>

                  <p>«{review.comment}»</p>
                  <small>{new Date(review.createdAt).toLocaleDateString(language)}</small>
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
                {language === 'ar' ? 'نقاط التدريس المسجلة على الخادم' : 'Teaching points recorded on the server'}
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
