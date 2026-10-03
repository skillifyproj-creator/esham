import { useMemo, useState } from "react";
import Icon from "../../components/Icon";
import { instructorFeedback } from "../../data/instructorFeedback";
import { usePreferences } from "../../context/PreferencesContext";
import instructorCopy from "../../i18n/instructorCopy";

export default function InstructorFeedbackPage() {
  const { language } = usePreferences();
  const c = instructorCopy[language].feedbackPage;
  const [courseFilter, setCourseFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [responseFilter, setResponseFilter] = useState("all");
  const [replies, setReplies] = useState(() =>
    Object.fromEntries(
      instructorFeedback.map((review) => [review.id, review.instructorReply || ""]),
    ),
  );
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");

  const courses = useMemo(
    () =>
      Array.from(
        new Map(
          instructorFeedback.map((review) => [
            review.courseId,
            review.courseLabel || review.courseName,
          ]),
        ),
      ),
    [],
  );

  const filteredReviews = instructorFeedback.filter((review) => {
    const hasReply = Boolean(replies[review.id]?.trim());

    return (
      (courseFilter === "all" || review.courseId === courseFilter) &&
      (ratingFilter === "all" || review.rating === Number(ratingFilter)) &&
      (responseFilter === "all" ||
        (responseFilter === "replied" && hasReply) ||
        (responseFilter === "unanswered" && !hasReply))
    );
  });

  const averageRating = instructorFeedback.length
    ? (
        instructorFeedback.reduce((total, review) => total + review.rating, 0) /
        instructorFeedback.length
      ).toFixed(1)
    : "0.0";
  const repliedCount = instructorFeedback.filter((review) =>
    replies[review.id]?.trim(),
  ).length;

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = instructorFeedback.filter(
      (review) => review.rating === rating,
    ).length;

    return {
      rating,
      count,
      width: instructorFeedback.length
        ? (count / instructorFeedback.length) * 100
        : 0,
    };
  });

  const formatDate = (date) =>
    new Intl.DateTimeFormat(c.dateFormat, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(`${date}T00:00:00`));

  const exportReviews = () => {
    const rows = [
      ["Learner", "Course", "Rating", "Comment", "Date", "Reply"],
      ...filteredReviews.map((review) => [
        review.learner.name,
        review.courseLabel || review.courseName,
        review.rating,
        review.comment,
        review.date,
        replies[review.id] || "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "instructor-reviews.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const beginReply = (review) => {
    setReplyDraft(replies[review.id] || "");
    setEditingReviewId(review.id);
  };

  const saveReply = (reviewId) => {
    const value = replyDraft.trim();
    if (!value) return;

    setReplies((current) => ({ ...current, [reviewId]: value }));
    setEditingReviewId(null);
    setReplyDraft("");
  };

  const cancelReply = () => {
    setEditingReviewId(null);
    setReplyDraft("");
  };

  return (
    <main className="instructor-feedback-page">
      <div className="container">
        <header className="instructor-feedback-heading">
          <div>
            <h1>{c.title}</h1>
            <p>{c.intro}</p>
          </div>
          <button
            type="button"
            className="instructor-feedback-export"
            onClick={exportReviews}
          >
            <Icon name="save" size={15} />
            {c.export}
          </button>
        </header>

        <section className="instructor-feedback-stats">
          <article className="instructor-feedback-stat">
            <span className="instructor-feedback-stat-icon">#</span>
            <div>
              <span>{c.totalReviews}</span>
              <strong>{instructorFeedback.length}</strong>
            </div>
          </article>
          <article className="instructor-feedback-stat">
            <span className="instructor-feedback-stat-icon gold">★</span>
            <div>
              <span>{c.averageRating}</span>
              <strong>{averageRating}</strong>
              <small>{c.ratingBasis.replace("{count}", instructorFeedback.length)}</small>
            </div>
          </article>
          <article className="instructor-feedback-stat">
            <span className="instructor-feedback-stat-icon green">
              {Math.round((repliedCount / (instructorFeedback.length || 1)) * 100)}%
            </span>
            <div>
              <span>{c.repliedReviews}</span>
              <strong>{repliedCount}</strong>
              <small>{instructorFeedback.length}</small>
            </div>
          </article>
        </section>

        <section className="instructor-feedback-rating-summary">
          <div className="instructor-feedback-rating-score">
            <strong>{averageRating}</strong>
            <FeedbackStars rating={Number(averageRating)} />
            <span>{c.averageRating}</span>
          </div>
          <div className="instructor-feedback-distribution">
            {ratingDistribution.map(({ rating, count, width }) => (
              <div className="instructor-feedback-distribution-row" key={rating}>
                <span className="instructor-feedback-distribution-label">
                  {rating} {c.stars}
                </span>
                <div className="instructor-feedback-distribution-track">
                  <span style={{ width: `${width}%` }} />
                </div>
                <strong className="instructor-feedback-distribution-rating">
                  <span>★</span> {count}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <div className="instructor-feedback-toolbar">
          <label>
            <span>{c.allCourses}</span>
            <select
              value={courseFilter}
              onChange={(event) => setCourseFilter(event.target.value)}
            >
              <option value="all">{c.allCourses}</option>
              {courses.map(([courseId, courseLabel]) => (
                <option key={courseId} value={courseId}>
                  {courseLabel}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{c.allRatings}</span>
            <select
              value={ratingFilter}
              onChange={(event) => setRatingFilter(event.target.value)}
            >
              <option value="all">{c.allRatings}</option>
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} {c.stars}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{c.allResponses}</span>
            <select
              value={responseFilter}
              onChange={(event) => setResponseFilter(event.target.value)}
            >
              <option value="all">{c.allResponses}</option>
              <option value="replied">{c.repliedFilter}</option>
              <option value="unanswered">{c.unansweredFilter}</option>
            </select>
          </label>

          <span className="instructor-feedback-count">
            {filteredReviews.length} {c.reviewCount}
          </span>
        </div>

        <section>
          <div className="instructor-feedback-section-heading">
            <h2>{c.reviewsHeading}</h2>
            <span>{filteredReviews.length}</span>
          </div>

          {filteredReviews.length ? (
            filteredReviews.map((review) => {
              const reply = replies[review.id] || "";
              const isEditing = editingReviewId === review.id;

              return (
                <article className="instructor-feedback-card" key={review.id}>
                  <div className="instructor-feedback-card-header">
                    <div className="instructor-feedback-user">
                      <span className="instructor-feedback-avatar">
                        {review.learner.initials}
                      </span>
                      <div>
                        <strong>{review.learner.name}</strong>
                        <span className="instructor-feedback-user-meta">
                          <FeedbackStars rating={review.rating} />
                          <span>·</span>
                          <time dateTime={review.date}>{formatDate(review.date)}</time>
                        </span>
                      </div>
                    </div>
                    <span className="instructor-feedback-course">
                      <Icon name="book" size={13} />
                      {review.courseLabel || review.courseName}
                    </span>
                  </div>

                  <p className="instructor-feedback-comment">{review.comment}</p>

                  {isEditing ? (
                    <div className="instructor-feedback-reply-area">
                      <div className="instructor-feedback-reply-heading">
                        <strong>{c.yourReply}</strong>
                      </div>
                      <textarea
                        rows={3}
                        value={replyDraft}
                        onChange={(event) => setReplyDraft(event.target.value)}
                        placeholder={c.replyPlaceholder}
                      />
                      <div className="instructor-feedback-reply-actions">
                        <button
                          type="button"
                          className="instructor-feedback-send"
                          disabled={!replyDraft.trim()}
                          onClick={() => saveReply(review.id)}
                        >
                          {c.sendReply}
                        </button>
                        <button
                          type="button"
                          className="instructor-feedback-cancel"
                          onClick={cancelReply}
                        >
                          {c.cancel}
                        </button>
                      </div>
                    </div>
                  ) : reply ? (
                    <div className="instructor-feedback-existing-reply">
                      <div className="instructor-feedback-reply-heading">
                        <strong>{c.replyStatus}</strong>
                        <button type="button" onClick={() => beginReply(review)}>
                          {c.editReply}
                        </button>
                      </div>
                      <p>{reply}</p>
                    </div>
                  ) : (
                    <div className="instructor-feedback-reply-area">
                      <button
                        type="button"
                        className="instructor-feedback-add-reply"
                        onClick={() => beginReply(review)}
                      >
                        {c.replyAction}
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="instructor-feedback-empty">
              <h3>{c.emptyTitle}</h3>
              <p>{c.emptyDescription}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FeedbackStars({ rating }) {
  return (
    <span
      className="instructor-feedback-stars"
      aria-label={`${rating} / 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          className={`instructor-feedback-star${index < rating ? " filled" : ""}`}
          key={index}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}
