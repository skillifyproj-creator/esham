import { useMemo, useState } from "react";
import { Link } from "react-router";

import Icon from "../../components/Icon";
import { instructorDemo } from "../../data/instructorDemo";

import "../../styles/instructor.css";

export default function InstructorCoursesPage() {
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
          ${course.title}
          ${course.category}
          ${course.description}
        `.toLowerCase();

        return searchableText.includes(searchValue);
      });
    }

    // Sort
    if (sortBy === "title") {
      result.sort((a, b) =>
        a.title.localeCompare(b.title, "ar")
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
    (total, course) =>
      total + (course.learners || 0),
    0
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
                لوحة التحكم
              </Link>

              <span>/</span>

              <span>إدارة الدورات</span>
            </div>

            <h1>دوراتي</h1>

            <p>
              إدارة دوراتك ومتابعة حالتها وأدائها
              وتحديث محتواها الأكاديمي والتطبيقي.
            </p>
          </div>

          <div className="instructor-courses-heading-actions">

            <Link
              to="/instructor/courses/new"
              className="instructor-create-course-button"
            >
              <Icon name="plus" size={17} />
              إنشاء دورة جديدة
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
              تبديل العرض الفارغ
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
              الكل
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
              منشورة
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
              قيد المراجعة
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
              مسودة
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
              تحتاج تعديل
              <span>({counts.rejected})</span>
            </FilterButton>

          </div>

          {/* Search */}

          <label className="instructor-course-search">

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
              placeholder="ابحث عن دورة بالاسم أو التصنيف..."
              aria-label="البحث عن دورة"
            />

          </label>

          {/* Sort */}

          <label className="instructor-course-sort">

            <span>الترتيب حسب:</span>

            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value)
              }
            >
              <option value="latest">
                الأحدث
              </option>

              <option value="title">
                الاسم
              </option>

              <option value="learners">
                عدد المتعلمين
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
              لا توجد دورات مطابقة
            </h2>

            <p>
              جرّب تغيير الفلتر أو كلمة البحث.
            </p>

            <button
              type="button"
              className="instructor-course-button instructor-course-button-primary"
              onClick={() => {
                setActiveFilter("all");
                setSearch("");
              }}
            >
              عرض جميع الدورات
            </button>

          </div>

        )}

        {/* ===================================================
            SUMMARY
        =================================================== */}

        <section className="instructor-course-summary">

          <h2>
            ملخص مؤشرات المدرب
          </h2>

          <div className="instructor-course-summary-grid">

            <article>
              <span>
                إجمالي الطلاب المتعلمين
              </span>

              <strong>
                {totalLearners.toLocaleString(
                  "en-US"
                )}
              </strong>

              <small>
                من الدورات المنشورة
              </small>
            </article>

            <article>
              <span>
                متوسط تقييم الدورات
              </span>

              <strong>
                {averageRating}
              </strong>

              <small>
                من 5.0 ★
              </small>
            </article>

            <article>
              <span>
                نقاط التدريب المكتسبة
              </span>

              <strong>
                {totalPoints.toLocaleString(
                  "en-US"
                )}
              </strong>

              <small>
                نقطة
              </small>
            </article>

            <article>
              <span>
                عدد الدورات
              </span>

              <strong>
                {courses.length}
              </strong>

              <small>
                جميع الحالات
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
      onClick={onClick}
    >
      {children}
    </button>
  );
}


// =========================================================
// COURSE CARD
// =========================================================

function CourseCard({ course }) {
  const statusClass =
    getStatusClass(course.courseStatus);

  // ---------------------------------------------------------
  // REVIEW / NEEDS EDIT CARD
  // ---------------------------------------------------------

  if (course.courseStatus === "rejected") {
    return (
      <article className="instructor-course-card instructor-course-card-review">

        <div className="instructor-review-alert">

          <span className="instructor-review-alert-badge">
            تحتاج تعديل
          </span>

          <div className="instructor-review-alert-icon">
            !
          </div>

          <strong>
            ملاحظات بحاجة إلى استجابة
          </strong>

          <Link
            to={`/instructor/courses/${course.id}`}
            className="instructor-review-link"
          >
            التسويق
          </Link>

        </div>

        <div className="instructor-course-card-body">

          <h3>
            {course.title}
          </h3>

          <div className="instructor-review-note">

            <strong>
              ملاحظة المراجع:
            </strong>

            <p>
              {course.reviewNote}
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

            تعديل الدورة وإعادة الإرسال
          </Link>

          <Link
            to={`/instructor/courses/${course.id}/review`}
            className="instructor-review-details"
          >
            عرض تفاصيل تقرير المراجعة
          </Link>

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
            alt={course.title}
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
          {course.statusLabel}
        </span>

        <span className="instructor-course-category">
          {course.category}
        </span>

      </div>

      {/* Body */}

      <div className="instructor-course-card-body">

        <h3>
          {course.title}
        </h3>

        <p>
          {course.description}
        </p>

        {/* Meta */}

        {course.courseStatus === "published" && (
          <div className="instructor-course-meta">

            <span>
              <strong>
                {course.learners}
              </strong>

              <small>
                متعلم
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
                نقطة
              </small>
            </span>

          </div>
        )}

        {/* Draft */}

        {course.courseStatus === "draft" && (
          <div className="instructor-draft-progress">

            <div className="instructor-draft-progress-heading">

              <span>
                نسبة الإنجاز
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
              {course.reviewStatus}
            </span>
          </div>
        )}

        {/* Actions */}

        <div className="instructor-course-actions">

          {course.courseStatus === "published" && (
            <>
              <Link
                to={`/instructor/courses/${course.id}`}
                className="instructor-course-button instructor-course-button-primary"
              >
                إدارة الدورة
                <Icon
                  name="settings"
                  size={14}
                />
              </Link>

              <Link
                to={`/courses/${course.id}`}
                className="instructor-course-button instructor-course-button-outline"
              >
                عرض الدورة
                <Icon
                  name="eye"
                  size={14}
                />
              </Link>
            </>
          )}

          {course.courseStatus === "draft" && (
            <>
              <Link
                to={`/instructor/courses/${course.id}/edit`}
                className="instructor-course-button green"
              >
                تعديل
                <Icon
                  name="edit"
                  size={14}
                />
              </Link>

              <Link
                to={`/instructor/courses/${course.id}/continue`}
                className="instructor-course-button instructor-course-button-primary green"
              >
                متابعة الإنشاء
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
                to={`/instructor/courses/${course.id}`}
                className="instructor-course-button purple-soft"
              >
                معاينة المسودة
                <Icon
                  name="eye"
                  size={14}
                />
              </Link>

              <button
                type="button"
                className="instructor-course-button instructor-course-button-primary purple-soft"
              >
                عرض التفاصيل
                <Icon
                  name="arrow-left"
                  size={14}
                />
              </button>
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