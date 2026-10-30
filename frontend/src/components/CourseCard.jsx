import { Link } from "react-router";
import Icon from "./Icon";
import { usePreferences } from "../context/PreferencesContext";
import { useCategoryCatalog } from '../context/CategoryCatalogContext';
import { coursePagesCopy } from "../i18n/coursePagesCopy";
import { getCourseText } from "../data/courseHelpers";
export default function CourseCard({ course, compact = false }) {
  const { copy: c, language } = usePreferences();
  const p = coursePagesCopy[language];
  const { categories } = useCategoryCatalog();
  const category = categories.find(x => x.id === course.categoryId || x.id === course.category);
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
            {course.categoryTitle?.[language] || (language === 'ar' ? category?.nameAr : category?.nameEn) || ''}
          </span>
          {course.rating != null && <span
            className="rating"
            aria-label={`${c.rating} ${course.rating} ${c.outOf}`}
          >
            <span aria-hidden="true">★</span> {course.rating}
          </span>}
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
            {course.points != null ? <>{course.points} {c.points}</> : p[course.level]}
            {course.lessons != null && <small>
              {course.lessons} {c.lessons}
            </small>}
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
