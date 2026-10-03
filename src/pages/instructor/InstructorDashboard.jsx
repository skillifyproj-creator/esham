import { Link } from "react-router";
import Icon from "../../components/Icon";
import { instructorDemo } from "../../data/instructorDemo";
import { usePreferences } from "../../context/PreferencesContext";
import instructorCopy from "../../i18n/instructorCopy";

export default function InstructorDashboard() {
  const { language } = usePreferences();
  const c = instructorCopy[language];
  const { instructor, stats, performance, courses, needsAttention, activities } =
    instructorDemo;

  const maxPerformance = Math.max(
    ...performance.flatMap((item) => [
      item.learners,
      item.completions,
    ])
  );

  return (
    <section className="instructor-dashboard">
      <div className="instructor-container">

        {/* Welcome */}
        <section className="instructor-welcome">
          <div>
            <h1>
              {c.welcome} {instructor.name[language]} <span>👋</span>
            </h1>

            <p>
              {c.dashboardIntro}
            </p>
          </div>

          <div className="instructor-welcome-actions">
            <Link
              to="/instructor/courses"
              className="instructor-button instructor-button-outline"
            >
              {c.myCourses}
            </Link>

            <Link
              to="/instructor/courses/new"
              className="instructor-button"
            >
              <span>+</span>
              {c.createCourse}
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className="instructor-stats">

          <article className="instructor-stat-card">
            <div className="instructor-stat-icon">
              <Icon name="book" size={19} />
            </div>

            <div className="instructor-stat-content">
              <span>{c.myCoursesStat}</span>
              <strong>{stats.courses}</strong>

              <small>
                <b>+{stats.coursesAddedThisMonth}</b> {c.thisMonth}
              </small>
            </div>
          </article>

          <article className="instructor-stat-card">
            <div className="instructor-stat-icon">
              <Icon name="users" size={19} />
            </div>

            <div className="instructor-stat-content">
              <span>{c.students}</span>
              <strong>
                {stats.learners.toLocaleString("en-US")}
              </strong>

              <small>
                <b>+{stats.learnerGrowthPercent}%</b> {c.growth}
              </small>
            </div>
          </article>

          <article className="instructor-stat-card">
            <div className="instructor-stat-icon green">
              <Icon name="star" size={19} />
            </div>

            <div className="instructor-stat-content">
              <span>{c.earnedPoints}</span>
              <strong>
                {stats.points.toLocaleString("en-US")}
              </strong>

              <small className="green-text">
                {c.fromTeachingAndSharing}
              </small>
            </div>
          </article>

          <article className="instructor-stat-card">
            <div className="instructor-stat-icon gold">
              <Icon name="star" size={19} />
            </div>

            <div className="instructor-stat-content">
              <span>{c.averageRating}</span>
              <strong>{stats.rating}</strong>

              <small>
                <span className="rating-stars">★★★★★</span>
                {stats.ratingCount} {c.learnerRatings}
              </small>
            </div>
          </article>

        </section>

        {/* Main dashboard grid */}
        <div className="instructor-dashboard-grid">

          {/* Main */}
          <div className="instructor-dashboard-main">

            {/* Performance */}
            <section className="instructor-panel instructor-performance">

              <div className="instructor-panel-heading">
                <div>
                  <h2>{c.coursePerformance}</h2>
                  <p>{c.performanceDescription}</p>
                </div>

                <div className="instructor-period-tabs">
                  <button>{c.thisMonth}</button>
                  <button>{c.thisWeek}</button>
                  <button>{c.lastSixMonths}</button>
                </div>
              </div>

              <div className="instructor-chart-legend">
                <span>
                  <i className="legend-dot dark" />
                  {c.newLearners}
                </span>

                <span>
                  <i className="legend-dot green" />
                  {c.completionRate}
                </span>

                <div className="chart-filters">
                  <button className="active">{c.students}</button>
                  <button>{c.enrollments}</button>
                  <button>{c.reviews}</button>
                </div>
              </div>

              <div className="instructor-chart">
                <div className="chart-grid-lines">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <div className="chart-bars">
                  {performance.map((item) => (
                    <div
                      className="chart-column"
                      key={item.id}
                    >
                      <div className="chart-bar-group">

                        <div
                          className="chart-bar dark"
                          style={{
                            height: `${
                              (item.learners / maxPerformance) * 78
                            }%`,
                          }}
                        >
                          <span>{item.learners}</span>
                        </div>

                        <div
                          className="chart-bar green"
                          style={{
                            height: `${
                              (item.completions / maxPerformance) * 78
                            }%`,
                          }}
                        >
                          <span>{item.completions}</span>
                        </div>

                      </div>

                      <small>{item.label[language]}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="instructor-performance-summary">
                <div>
                  <span>{c.weeklyJoinRate}</span>
                  <strong>+{stats.weeklyJoinRate} {c.learnersPerWeek}</strong>
                </div>

                <div>
                  <span>{c.averageWatchHours}</span>
                  <strong>{stats.averageWatchHours} {c.hoursPerLearner}</strong>
                </div>

                <div>
                  <span>{c.overallCompletionRate}</span>
                  <strong className="green-text">{stats.overallCompletionRate}%</strong>
                </div>
              </div>

            </section>

            {/* Courses */}
            <section className="instructor-panel">

              <div className="instructor-panel-heading">
                <div>
                  <h2>{c.coursesPerformance}</h2>
                  <p>{c.popularCoursesDescription}</p>
                </div>

                <Link
                  to="/instructor/courses"
                  className="instructor-text-link"
                >
                  {c.viewAllCourses} ←
                </Link>
              </div>

              <div className="instructor-course-list">
                {courses.map((course) => (
                  <article
                    className="instructor-course-row"
                    key={course.id}
                  >
                    <div className="instructor-course-image">
                      <Icon
                        name={course.icon}
                        size={27}
                      />
                    </div>

                    <div className="instructor-course-info">
                      <div className="instructor-course-top">
                        <span className="instructor-course-category">
                          {course.category[language]}
                        </span>

                        <span className="instructor-course-status">
                          {getCourseStatusLabel(course.courseStatus, c)}
                        </span>
                      </div>

                      <h3>{course.title[language]}</h3>

                      <div className="instructor-course-meta">
                        <span>
                          <Icon name="users" size={14} />
                          {course.learners}
                        </span>

                        <span>
                          <span className="rating-stars">
                            ★
                          </span>
                          {course.rating}
                        </span>

                        <span className="green-text">
                          {course.points} {c.pointsEarned}
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/instructor/courses/${course.id}`}
                      className="instructor-manage-button"
                    >
                      {c.manageCourse}
                    </Link>
                  </article>
                ))}
              </div>

            </section>

          </div>

          {/* Sidebar */}
          <aside className="instructor-dashboard-sidebar">

            {/* Attention */}
            <section className="instructor-panel attention-panel">
              <div className="instructor-panel-title">
                <h2>{c.needsAttention}</h2>
              </div>

              <div className="attention-list">
                {needsAttention.map((item) => (
                  <article
                    className="attention-item"
                    key={item.id}
                  >
                    <span className={`attention-dot ${item.type}`} />

                    <p>{item.text[language]}</p>

                    <Link to="/instructor/courses">
                      {c[item.actionKey] ?? item.action}
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            {/* Activities */}
            <section className="instructor-panel">
              <div className="instructor-panel-title">
                <h2>{c.latestActivities}</h2>

                <Icon name="history" size={18} />
              </div>

              <div className="activity-list">
                {activities.map((activity) => (
                  <article
                    className="activity-item"
                    key={activity.id}
                  >
                    <span
                      className={`activity-dot ${activity.type}`}
                    />

                    <div>
                      <p>{activity.text[language]}</p>
                      <small>{activity.time[language]}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Quick actions */}
            <section className="instructor-panel quick-actions-panel">
              <div className="instructor-panel-title">
                <div>
                  <h2>{c.quickActions}</h2>
                  <p>{c.dailyTeachingShortcuts}</p>
                </div>
              </div>

              <div className="quick-actions-grid">

                <Link to="/instructor/courses/new">
                  <Icon name="plus" size={19} />
                  <span>{c.createNewCourse}</span>
                </Link>

                <Link to="/instructor/courses/new/lesson">
                  <Icon name="lesson" size={19} />
                  <span>{c.addNewLesson}</span>
                </Link>

                <Link to="/instructor/certificates">
                  <Icon name="award" size={19} />
                  <span>{c.learnerCertificates}</span>
                </Link>

                <Link to="/instructor/feedback">
                  <Icon name="star" size={19} />
                  <span>{c.reviewRatings}</span>
                </Link>

              </div>
            </section>

          </aside>

        </div>
      </div>
    </section>
  );
}

function getCourseStatusLabel(status, copy) {
  switch (status) {
    case "published":
      return copy.activeNow;
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