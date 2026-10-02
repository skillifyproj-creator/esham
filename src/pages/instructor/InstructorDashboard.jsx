import { Link } from "react-router";
import Icon from "../../components/Icon";
import { instructorDemo } from "../../data/instructorDemo";

export default function InstructorDashboard() {
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
              مرحباً أحمد <span>👋</span>
            </h1>

            <p>
              إليك نظرة سريعة على أداء دوراتك ونشاط المتعلمين
              في منصة إسهام.
            </p>
          </div>

          <div className="instructor-welcome-actions">
            <Link
              to="/instructor/courses"
              className="instructor-button instructor-button-outline"
            >
              عرض دوراتي
            </Link>

            <Link
              to="/instructor/courses/new"
              className="instructor-button"
            >
              <span>+</span>
              إنشاء دورة
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
              <span>دوراتي</span>
              <strong>{stats.courses}</strong>

              <small>
                <b>+1</b> هذا الشهر
              </small>
            </div>
          </article>

          <article className="instructor-stat-card">
            <div className="instructor-stat-icon">
              <Icon name="users" size={19} />
            </div>

            <div className="instructor-stat-content">
              <span>المتعلمون</span>
              <strong>
                {stats.learners.toLocaleString("en-US")}
              </strong>

              <small>
                <b>+14%</b> نمو
              </small>
            </div>
          </article>

          <article className="instructor-stat-card">
            <div className="instructor-stat-icon green">
              <Icon name="star" size={19} />
            </div>

            <div className="instructor-stat-content">
              <span>النقاط المكتسبة</span>
              <strong>
                {stats.points.toLocaleString("en-US")}
              </strong>

              <small className="green-text">
                من التعليم ومشاركة المهارات
              </small>
            </div>
          </article>

          <article className="instructor-stat-card">
            <div className="instructor-stat-icon gold">
              <Icon name="star" size={19} />
            </div>

            <div className="instructor-stat-content">
              <span>متوسط التقييم</span>
              <strong>{stats.rating}</strong>

              <small>
                <span className="rating-stars">★★★★★</span>
                من {stats.ratingCount} تقييم للمتعلمين
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
                  <h2>أداء دوراتك</h2>
                  <p>
                    تحليل تفاعل المتعلمين والالتحاقات عبر الفترات الزمنية
                  </p>
                </div>

                <div className="instructor-period-tabs">
                  <button>هذا الشهر</button>
                  <button>هذا الأسبوع</button>
                  <button>آخر 6 أشهر</button>
                </div>
              </div>

              <div className="instructor-chart-legend">
                <span>
                  <i className="legend-dot dark" />
                  المتعلمون الجدد
                </span>

                <span>
                  <i className="legend-dot green" />
                  معدل الإكمال
                </span>

                <div className="chart-filters">
                  <button className="active">المتعلمون</button>
                  <button>الالتحاقات</button>
                  <button>التقييمات</button>
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
                      key={item.label}
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

                      <small>{item.label}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="instructor-performance-summary">
                <div>
                  <span>معدل الانضمام الأسبوعي</span>
                  <strong>+312 متعلم</strong>
                </div>

                <div>
                  <span>متوسط ساعات المشاهدة</span>
                  <strong>4.2 س/متعلم</strong>
                </div>

                <div>
                  <span>نسبة الإكمال العامة</span>
                  <strong className="green-text">78.4%</strong>
                </div>
              </div>

            </section>

            {/* Courses */}
            <section className="instructor-panel">

              <div className="instructor-panel-heading">
                <div>
                  <h2>أداء الدورات</h2>
                  <p>
                    الدورات الأعلى إقبالاً وتفاعلاً من قبل المتعلمين
                  </p>
                </div>

                <Link
                  to="/instructor/courses"
                  className="instructor-text-link"
                >
                  عرض جميع الدورات ←
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
                          {course.category}
                        </span>

                        <span className="instructor-course-status">
                          {course.status}
                        </span>
                      </div>

                      <h3>{course.title}</h3>

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
                          {course.points} نقطة مكتسبة
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/instructor/courses/${course.id}`}
                      className="instructor-manage-button"
                    >
                      إدارة الدورة
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
                <h2>يحتاج إلى اهتمامك!</h2>
              </div>

              <div className="attention-list">
                {needsAttention.map((item) => (
                  <article
                    className="attention-item"
                    key={item.id}
                  >
                    <span className={`attention-dot ${item.type}`} />

                    <p>{item.text}</p>

                    <Link to="/instructor/courses">
                      {item.action}
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            {/* Activities */}
            <section className="instructor-panel">
              <div className="instructor-panel-title">
                <h2>آخر النشاطات</h2>

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
                      <p>{activity.text}</p>
                      <small>{activity.time}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Quick actions */}
            <section className="instructor-panel quick-actions-panel">
              <div className="instructor-panel-title">
                <div>
                  <h2>إجراءات سريعة</h2>
                  <p>
                    اختصارات لأهم مهام التدريس اليومية
                  </p>
                </div>
              </div>

              <div className="quick-actions-grid">

                <Link to="/instructor/courses/new">
                  <Icon name="plus" size={19} />
                  <span>إنشاء دورة جديدة</span>
                </Link>

                <Link to="/instructor/courses/new/lesson">
                  <Icon name="lesson" size={19} />
                  <span>إضافة درس جديد</span>
                </Link>

                <Link to="/instructor/certificates">
                  <Icon name="award" size={19} />
                  <span>شهادات المتعلمين</span>
                </Link>

                <Link to="/instructor/feedback">
                  <Icon name="star" size={19} />
                  <span>استعراض التقييمات</span>
                </Link>

              </div>
            </section>

          </aside>

        </div>
      </div>
    </section>
  );
}