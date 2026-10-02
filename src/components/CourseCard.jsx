import { Link } from "react-router";
import Icon from "./Icon";
import { usePreferences } from "../context/PreferencesContext";
import { categoryKeys } from "../data/courses";
import { coursePagesCopy } from "../i18n/coursePagesCopy";
import { getCourseText } from "../data/courseHelpers";
export default function CourseCard({ course, compact = false }) {
  const { copy: c, language } = usePreferences();
  const p = coursePagesCopy[language];
  const [title, description] = getCourseText(course, language);
  return (
    <article className={`course-card${compact ? " compact-course" : ""}`}>
      <Link
        to={`/courses/${course.id}`}
        className="course-image"
        aria-label={`${c.view}: ${title}`}
      >
        {course.image ? (
          <img src={course.image} alt={title} loading="lazy" />
        ) : (
          <Icon name={course.icon} size={44} />
        )}
      </Link>
      <div className="course-content">
        <div className="course-meta">
          <span className="tag">
            {c.categories[categoryKeys.indexOf(course.category)]}
          </span>
          <span
            className="rating"
            aria-label={`${c.rating} ${course.rating} ${c.outOf}`}
          >
            <span aria-hidden="true">★</span> {course.rating}
          </span>
        </div>
        <h3>
          <Link to={`/courses/${course.id}`}>{title}</Link>
        </h3>
        <p>{description}</p>
        {course.instructor && (
          <span className="catalog-instructor">
            {course.instructor[language]}
            <span> · {p[course.level]}</span>
          </span>
        )}
        <div className="course-bottom">
          <span>
            {course.points} {c.points}
            <small>
              {course.lessons} {c.lessons}
            </small>
          </span>
          <Link
            className="button button-muted button-small"
            to={`/courses/${course.id}`}
          >
            {c.view}
          </Link>
        </div>
      </div>
    </article>
  );
}
