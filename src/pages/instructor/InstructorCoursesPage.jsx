import { instructorPublicCourseIds } from "../../data/instructorCourseLinks";
import PendingFeature from "../../components/shared/PendingFeature";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import Icon from "../../components/Icon";
import { instructorDemo } from "../../data/instructorDemo";
import { usePreferences } from "../../context/PreferencesContext";
import instructorCopy from "../../i18n/instructorCopy";

import "../../styles/instructor.css";
import "../../styles/instructor-courses.css";

export default function InstructorCoursesPage() {
  const { language } = usePreferences();
  const c = instructorCopy[language];
  const { courses } = instructorDemo;

  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("latest");

  // =========================================================
  // COUNTS
  // =========================================================

  const counts = useMemo(
    () => ({
      all: courses.length,

      published: courses.filter(
        (course) => course.courseStatus === "published"
      ).length,

      pending: courses.filter(
        (course) => course.courseStatus === "pending"
      ).length,

      draft: courses.filter(
        (course) => course.courseStatus === "draft"
      ).length,

      rejected: courses.filter(
        (course) => course.courseStatus === "rejected"
      ).length,
    }),
    [courses]
  );

  // =========================================================
  // FILTER + SEARCH + SORT
  // =========================================================

  const filteredCourses = useMemo(() => {
    let result = [...courses];

    // Filter
    if (activeFilter !== "all") {
      result = result.filter(
        (course) => course.courseStatus === activeFilter
      );
    }

    // Search
    const searchValue = search.trim().toLowerCase();

    if (searchValue) {
      result = result.filter((course) => {
        const searchableText = `
          ${course.title[language]}
          ${course.category[language]}
          ${course.description[language]}
        `.toLowerCase();

        return searchableText.includes(searchValue);
      });
    }

    // Sort
    if (sortBy === "title") {
      result.sort((a, b) =>
        a.title[language].localeCompare(
          b.title[language],
          language === "en" ? "en" : "ar"
        )
      );
    }

    if (sortBy === "learners") {
      result.sort(
        (a, b) =>
          (b.learners || 0) -
          (a.learners || 0)
      );
    }

    return result;
  }, [
    courses,
    language,
    activeFilter,
    search,
    sortBy,
  ]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const publishedCourses = courses.filter(
    (course) => course.courseStatus === "published"
  );

  const totalLearners = publishedCourses.reduce(
    (total, course) => total + (course.learners || 0),
    0,
  );

  const totalPoints = publishedCourses.reduce(
    (total, course) =>
      total + (course.points || 0),
    0
  );

  const averageRating =
    publishedCourses.length > 0
      ? (
          publishedCourses.reduce(
            (total, course) =>
              total + (course.rating || 0),
            0
          ) / publishedCourses.length
        ).toFixed(1)
      : "0.0";

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <section className="instructor-courses-page">
      <div className="container">

        {/* ===================================================
            PAGE HEADER
        =================================================== */}

        <div className="instructor-courses-heading">

          <div>
            <div className="instructor-breadcrumb">
              <Link to="/instructor">
                {c.dashboard}
              </Link>

              <span>/</span>

              <span>{c.manageCourses}</span>
            </div>

            <h1>{c.myCourses}</h1>

            <p>
              {c.courseManagementDescription}
            </p>
          </div>

          <div className="instructor-courses-heading-actions">

            <Link
              to="/instructor/courses/new"
              className="instructor-create-course-button"
            >
              <Icon name="plus" size={17} />
              {c.createNewCourse}
            </Link>

            <button
              type="button"
              className="instructor-preview-button"
              onClick={() => {
                setActiveFilter("all");
                setSearch("");
              }}
            >
              <Icon name="eye" size={17} />
              {c.emptyPreview}
            </button>

          </div>
        </div>

        {/* ===================================================
            FILTERS
        =================================================== */}

        <div className="instructor-course-filters">

          <div className="instructor-filter-tabs">

            <FilterButton
              active={activeFilter === "all"}
              onClick={() =>
                setActiveFilter("all")
              }
            >
              {c.all}
              <span>({counts.all})</span>
            </FilterButton>

            <FilterButton
              active={
                activeFilter === "published"
              }
              onClick={() =>
                setActiveFilter("published")
              }
            >
              {c.published}
              <span>({counts.published})</span>
            </FilterButton>

            <FilterButton
              active={
                activeFilter === "pending"
              }
              onClick={() =>
                setActiveFilter("pending")
              }
            >
              {c.pendingReview}
              <span>({counts.pending})</span>
            </FilterButton>

            <FilterButton
              active={
                activeFilter === "draft"
              }
              onClick={() =>
                setActiveFilter("draft")
              }
            >
              {c.draft}
              <span>({counts.draft})</span>
            </FilterButton>

            <FilterButton
              active={
                activeFilter === "rejected"
              }
              onClick={() =>
                setActiveFilter("rejected")
              }
            >
              {c.needsEdits}
              <span>({counts.rejected})</span>
            </FilterButton>

          </div>

          {/* Search */}

          <label className="instructor-course-search" dir={language === "ar" ? "rtl" : "ltr"}>

            <Icon
              name="search"
              size={19}
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder={c.searchCoursePlaceholder}
              aria-label={c.searchCourse}
            />

          </label>

          {/* Sort */}

          <label className="instructor-course-sort" dir={language === "ar" ? "rtl" : "ltr"}>

            <span>{c.sortBy}</span>

            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value)
              }
            >
              <option value="latest">
                {c.newest}
              </option>

              <option value="title">
                {c.name}
              </option>

              <option value="learners">
                {c.learnerCount}
              </option>
            </select>

          </label>

        </div>

        {/* ===================================================
            COURSES
        =================================================== */}

        {filteredCourses.length > 0 ? (

          <div className="instructor-courses-grid">

            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                copy={c}
                language={language}
              />
            ))}

          </div>

        ) : (

          <div className="instructor-courses-empty">

            <div className="instructor-courses-empty-icon">
              <Icon
                name="search"
                size={28}
              />
            </div>

            <h2>
              {c.noMatchingCourses}
            </h2>

            <p>
              {c.changeFilterOrSearch}
            </p>

            <button
              type="button"
              className="instructor-course-button instructor-course-button-primary"
              onClick={() => {
                setActiveFilter("all");
                setSearch("");
              }}
            >
              {c.viewAllCoursesAction}
            </button>

          </div>

        )}

        {/* ===================================================
            SUMMARY
        =================================================== */}

        <section className="instructor-course-summary">

          <h2>
            {c.instructorMetricsSummary}
          </h2>

          <div className="instructor-course-summary-grid">

            <article>
              <span>
                {c.totalLearners}
              </span>

              <strong>
                {totalLearners.toLocaleString("en-US")}
              </strong>

              <small>
                {c.fromPublishedCourses}
              </small>
            </article>

            <article>
              <span>
                {c.averageCourseRating}
              </span>

              <strong>
                {averageRating}
              </strong>

              <small>
                {c.outOf} 5.0 ★
              </small>
            </article>

            <article>
              <span>
                {c.pointsEarnedFromTeaching}
              </span>

              <strong>
                {totalPoints.toLocaleString("en-US")}
              </strong>

              <small>
                {c.points}
              </small>
            </article>

            <article>
              <span>
                {c.totalCourses}
              </span>

              <strong>
                {courses.length}
              </strong>

              <small>
                {c.allStatuses}
              </small>
            </article>

          </div>

        </section>

      </div>
    </section>
  );
}


// =========================================================
// FILTER BUTTON
// =========================================================

function FilterButton({
  active,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      className={active ? "active" : ""}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}


// =========================================================
// COURSE CARD
// =========================================================

function CourseCard({ course, copy: c, language }) {
  const statusClass = getStatusClass(course.courseStatus);

  // ---------------------------------------------------------
  // REVIEW / NEEDS EDIT CARD
  // ---------------------------------------------------------

  if (course.courseStatus === "rejected") {
    return (
      <article className="instructor-course-card instructor-course-card-review">

        <div className="instructor-review-alert">

          <span className="instructor-review-alert-badge">
            {c.needsEdits}
          </span>

          <div className="instructor-review-alert-icon">
            !
          </div>

          <strong>
            {c.reviewNeedsResponse}
          </strong>

          <PendingFeature
            className="instructor-review-link"
          >
            {course.category[language]}
          </PendingFeature>

        </div>

        <div className="instructor-course-card-body">

          <h3>
            {course.title[language]}
          </h3>

          <div className="instructor-review-note">

            <strong>
              {c.reviewerNote}
            </strong>

            <p>
              {course.reviewNote[language]}
            </p>

          </div>

          <Link
            to={`/instructor/courses/${course.id}/edit`}
            className="instructor-review-submit"
          >
            <Icon
              name="edit"
              size={14}
            />

            {c.editAndResubmit}
          </Link>

          <PendingFeature
            className="instructor-review-details"
          >
            {c.reviewReportDetails}
          </PendingFeature>

        </div>

      </article>
    );
  }

  // ---------------------------------------------------------
  // NORMAL / DRAFT / PENDING
  // ---------------------------------------------------------

  return (
    <article
      className={`instructor-course-card ${
        course.courseStatus === "draft"
          ? "instructor-course-card-draft"
          : ""
      } ${
        course.courseStatus === "pending"
          ? "instructor-course-card-waiting"
          : ""
      }`}
    >

      {/* Image */}

      <div className="instructor-course-image">

        {course.image ? (
          <img
            src={course.image}
            alt={course.title[language]}
          />
        ) : (
          <div className="instructor-course-image-empty">
            <Icon
              name={course.icon || "book"}
              size={42}
            />
          </div>
        )}

        <span
          className={`instructor-course-status ${statusClass}`}
        >
          {getCourseStatusLabel(course.courseStatus, c)}
        </span>

        <span className="instructor-course-category">
          {course.category[language]}
        </span>

      </div>

      {/* Body */}

      <div className="instructor-course-card-body">

        <h3>
          {course.title[language]}
        </h3>

        <p>
          {course.description[language]}
        </p>

        {/* Meta */}

        {course.courseStatus === "published" && (
          <div className="instructor-course-meta">

            <span>
              <strong>
                {course.learners}
              </strong>

              <small>
                {c.learner}
              </small>
            </span>

            <span>
              <strong className="instructor-course-stars">
                {course.rating} ★
              </strong>

              <small>
                ({course.ratingCount})
              </small>
            </span>

            <span>
              <strong>
                {course.points}
              </strong>

              <small>
                {c.points}
              </small>
            </span>

          </div>
        )}

        {/* Draft */}

        {course.courseStatus === "draft" && (
          <div className="instructor-draft-progress">

            <div className="instructor-draft-progress-heading">

              <span>
                {c.completionProgress}
              </span>

              <strong>
                {course.progress}%
              </strong>

            </div>

            <div className="instructor-draft-progress-bar">

              <span
                style={{
                  width: `${course.progress}%`,
                }}
              />

            </div>

          </div>
        )}

        {/* Pending */}

        {course.courseStatus === "pending" && (
          <div className="instructor-waiting-points">
            <Icon
              name="clock"
              size={14}
            />

            <span>
              {course.reviewStatus[language]}
            </span>
          </div>
        )}

        {/* Actions */}

        <div className="instructor-course-actions">

          {course.courseStatus === "published" && (
            <>
              <Link to={"/courses/" + (instructorPublicCourseIds[course.id] ?? course.id)} className="instructor-course-button instructor-course-button-outline">
                {c.viewCourse}<Icon name="eye" size={14} />
              </Link>
              <Link to={`/instructor/courses/${course.id}/edit`} className="instructor-course-button instructor-course-button-outline">
                {c.edit}<Icon name="edit" size={14} />
              </Link>
              <Link to={"/instructor/courses/" + course.id + "/performance"} className="instructor-course-button instructor-course-button-outline">
                {c.performance}
              </Link>
              <Link to={"/instructor/courses/" + course.id + "/feedback"} className="instructor-course-button instructor-course-button-outline">
                {c.feedback}
              </Link>
            </>
          )}

          {course.courseStatus === "draft" && (
            <>
              <Link
                to={`/instructor/courses/${course.id}/edit`}
                className="instructor-course-button green"
              >
                {c.edit}
                <Icon
                  name="edit"
                  size={14}
                />
              </Link>

              <Link
                to={`/instructor/courses/${course.id}/curriculum`}
                className="instructor-course-button instructor-course-button-primary green"
              >
                {c.continueCreation}
                <Icon
                  name="arrow-left"
                  size={14}
                />
              </Link>
            </>
          )}

          {course.courseStatus === "pending" && (
            <>
              <Link
                to={`/instructor/courses/${course.id}/review`}
                className="instructor-course-button purple-soft"
              >
                {c.previewDraft}
                <Icon
                  name="eye"
                  size={14}
                />
              </Link>

              <Link
                to={`/instructor/courses/${course.id}/review`}
                className="instructor-course-button instructor-course-button-primary purple-soft"
              >
                {c.viewDetails}
                <Icon
                  name="arrow-left"
                  size={14}
                />
              </Link>
            </>
          )}

        </div>

      </div>

    </article>
  );
}


// =========================================================
// STATUS CLASS
// =========================================================

function getStatusClass(status) {
  switch (status) {
    case "published":
      return "";

    case "pending":
      return "review";

    case "draft":
      return "draft";

    case "rejected":
      return "needs-edit";

    default:
      return "";
  }
}

function getCourseStatusLabel(status, copy) {
  switch (status) {
    case "published":
      return copy.published;
    case "pending":
      return copy.pendingReview;
    case "draft":
      return copy.draft;
    case "rejected":
      return copy.needsEdits;
    default:
      return status;
  }
}
