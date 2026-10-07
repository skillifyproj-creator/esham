import CourseRecommendations from '../../components/learner/CourseRecommendations';
import { useState } from "react";
import { Link } from "react-router";

import { usePreferences } from "../../context/PreferencesContext";
import { useLearner } from "../../context/LearnerContext";
import { useLearnerTasks } from "../../context/LearnerTasksContext";
import { useLearnerReviews } from "../../hooks/useLearnerReviews";

import { getEnrollmentDetails } from "../../data/learnerHelpers";
import { reviewsCopy } from "../../i18n/reviewsCopy";
import "../../styles/learner-reviews.css";

function ReviewForm({
  course,
  existing,
  t,
  onSave,
  onCancel,
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? "");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();

    if (!onSave(course.id, rating, text)) {
      setError(t.invalid);
    }
  }

  return (
    <form
      className="learner-panel reviews-form"
      onSubmit={submit}
    >
      <h2>{t.form}</h2>

      <fieldset className="review-rating">
        <legend>{t.rating}</legend>

        <div className="review-stars">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                required
              />

              <span
                className={value <= rating ? "filled" : ""}
                aria-hidden="true"
              >
                ★
              </span>

              <span className="sr-only">
                {value} / 5 {t.star}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="review-text-label">
        {t.text}

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          placeholder={t.placeholder}
          aria-describedby="review-text-help"
          required
        />
      </label>

      <p id="review-text-help">
        {t.minimum} ({Array.from(text.trim()).length})
      </p>

      {error && <p role="alert">{error}</p>}

      <div className="review-actions">
        <button className="button" type="submit">
          {t.save}
        </button>

        <button
          className="button button-outline"
          type="button"
          onClick={onCancel}
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

export default function LearnerReviewsPage() {
  const { language } = usePreferences();
  const { enrollments } = useLearner();
  const { tasks } = useLearnerTasks();

  const {
    reviews,
    saveReview,
    deleteReview,
  } = useLearnerReviews();

  const t = reviewsCopy[language];

  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState("");

  const details = enrollments
    .map(getEnrollmentDetails)
    .filter(Boolean);

  const eligible = details.filter((item) => {
    const courseTasks = tasks.filter(
      (task) => task.courseId === item.courseId,
    );

    return (
      item.isComplete &&
      courseTasks.every(
        (task) => task.status === "completed",
      )
    );
  });

  const eligibleIds = new Set(
    eligible.map((item) => item.courseId),
  );

  const mine = reviews
    .filter((review) =>
      details.some(
        (item) => item.courseId === review.courseId,
      ),
    )
    .sort(
      (a, b) =>
        Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );

  const pending = eligible.filter(
    (item) =>
      !mine.some(
        (review) => review.courseId === item.courseId,
      ),
  );

  const selected = eligible.find(
    (item) => item.courseId === selectedId,
  );

  const existing = mine.find(
    (review) => review.courseId === selectedId,
  );

  function save(courseId, rating, text) {
    if (
      !eligibleIds.has(courseId) ||
      !saveReview(courseId, rating, text)
    ) {
      return false;
    }

    setSelectedId(null);
    setMessage(t.saved);
    return true;
  }

  function remove(courseId) {
    if (!window.confirm(t.confirm)) return;

    deleteReview(courseId);

    if (selectedId === courseId) {
      setSelectedId(null);
    }

    setMessage(t.deleted);
  }

  const formatDate = (value) =>
    new Intl.DateTimeFormat(
      language === "ar" ? "ar" : "en",
      { dateStyle: "medium" },
    ).format(new Date(value));

  const stats = [
    [t.eligible, eligible.length],
    [t.submitted, mine.length],
    [t.pending, pending.length],
  ];

  return (
    <main className="learner-dashboard">
      <div className="container">
        <header className="learner-welcome">
          <div>
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

        <section
          className="learner-summary"
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

        <p role="status">{message}</p>

        <section className="reviews-section">
          <h2>
            {t.waiting} ({pending.length})
          </h2>

          {pending.map((item) => (
            <article
              className="learner-panel review-course-row"
              key={item.courseId}
            >
              <div>
                <h3>{item.course.title[language]}</h3>
                <p>{item.course.instructor[language]}</p>
              </div>

              <button
                className="button"
                onClick={() => {
                  setSelectedId(item.courseId);
                  setMessage("");
                }}
              >
                {t.rate}
              </button>
            </article>
          ))}

          {pending.length === 0 && (
            <p className="learner-panel">
              {t.emptyPending}
            </p>
          )}
        </section>

        {selected && (
          <section className="reviews-section">
            <h3>{selected.course.title[language]}</h3>

            <ReviewForm
              key={selectedId}
              course={selected.course}
              existing={existing}
              t={t}
              onSave={save}
              onCancel={() => setSelectedId(null)}
            />
          </section>
        )}

        {selectedId !== null && !selected && (
          <p role="alert">{t.unavailable}</p>
        )}

        <section className="reviews-section">
          <h2>
            {t.mine} ({mine.length})
          </h2>

          {mine.map((review) => {
            const item = details.find(
              (item) => item.courseId === review.courseId,
            );

            return (
              <article
                className="learner-panel saved-review"
                key={review.courseId}
              >
                <div className="saved-review-heading">
                  <h3>{item.course.title[language]}</h3>

                  <span
                    className="saved-review-rating"
                    aria-label={`${review.rating} / 5 ${t.star}`}
                  >
                    <span aria-hidden="true">
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </span>
                    {" "}
                    {review.rating} / 5
                  </span>
                </div>

                <blockquote>{review.text}</blockquote>
                {eligibleIds.has(review.courseId) && <CourseRecommendations course={item.course} review={review} enrollments={enrollments}/>}

                <p>
                  {t.date}:{" "}
                  <time dateTime={review.updatedAt}>
                    {formatDate(review.updatedAt)}
                  </time>
                </p>

                <small>{t.local}</small>

                <div className="review-actions">
                  <button
                    className="button button-outline button-small"
                    disabled={!eligibleIds.has(review.courseId)}
                    onClick={() =>
                      setSelectedId(review.courseId)
                    }
                  >
                    {t.edit}
                  </button>

                  <button
                    className="button button-outline button-small"
                    onClick={() => remove(review.courseId)}
                  >
                    {t.remove}
                  </button>
                </div>
              </article>
            );
          })}

          {mine.length === 0 && (
            <p className="learner-panel">{t.emptyMine}</p>
          )}
        </section>

        <aside className="learner-panel reviews-policy">
          <h2>{t.policy}</h2>
          <p>{t.policyText}</p>
        </aside>
      </div>
    </main>
  );
}