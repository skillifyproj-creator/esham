import Icon from "./Icon";
import { usePreferences } from "../context/PreferencesContext";
import { categoryKeys } from "../data/courses";
export default function CourseCard({ course, onSelect }) {
  const { copy: c } = usePreferences();
  const [title, description] = c.courseCopy[course.id - 1];
  return (
    <article className="course-card">
      <div className="course-image">
        {course.image ? (
          <img src={course.image} alt={title} loading="lazy" />
        ) : (
          <Icon name={course.icon} size={44} />
        )}
      </div>
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
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="course-bottom">
          <span>
            {course.points} {c.points}
            <small>
              {course.lessons} {c.lessons}
            </small>
          </span>
          <button
            className="button button-muted button-small"
            onClick={() => onSelect(course)}
          >
            {c.view}
          </button>
        </div>
      </div>
    </article>
  );
}
