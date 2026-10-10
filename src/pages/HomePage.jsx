import { useState } from "react";
import { Link } from "react-router";
import Header from "../components/Header";
import Icon from "../components/Icon";
import CourseCard from "../components/CourseCard";
import Modal from "../components/Modal";
import { categoryKeys, courses } from "../data/courses";
import { usePreferences } from "../context/PreferencesContext";
const featureStyle = [
  ["leaf", "green"],
  ["coins", "cream"],
  ["swap", "purple"],
  ["grid", "cream"],
];
export default function HomePage() {
  const { copy: c } = usePreferences();
  const [category, setCategory] = useState("all");
  const [modal, setModal] = useState(null);
  const [interest, setInterest] = useState("");
  const [result, setResult] = useState(false);
  const filtered =
    category === "all"
      ? courses
      : courses.filter((course) => course.category === category);
  const categoryName = (key) => c.categories[categoryKeys.indexOf(key)];

  const startQuiz = () => {
    setInterest("");
    setResult(false);
    setModal({ type: "quiz" });
  };
  const title = c.quizTitle;
  return (
    <>
      <Header />
      <main id="home">
        <section className="hero container">
          <div className="hero-copy">
            <span className="eyebrow">
              <span />
              {c.eyebrow}
            </span>
            <h1>{c.heroTitle}</h1>
            <p>{c.heroText}</p>
            <div className="button-row">
              <Link className="button" to="/signup">
                {c.start}
                <span className="direction-arrow" aria-hidden="true">
                  ←
                </span>
              </Link>
              <Link className="button button-outline" to="/courses">
                {c.discover}
              </Link>
            </div>
            <span className="hero-note">
              <Icon name="leaf" size={16} />
              {c.heroNote}
            </span>
          </div>
          <div className="hero-visual">
            <img src="/images/Background+Border.png" alt={c.heroAlt} fetchPriority="high" />
            <span className="image-caption">{c.caption}</span>
          </div>
        </section>
        <section className="container stats" aria-label={c.statsLabel}>
          {["500+", "100+", "50+", "1000+"].map((value, i) => (
            <div key={value}>
              <strong dir="ltr">{value}</strong>
              <span>{c.stats[i]}</span>
            </div>
          ))}
        </section>
        <section id="why" className="section container">
          <div className="section-heading">
            <span className="section-kicker">{c.whyKicker}</span>
            <h2>{c.why}</h2>
            <p>{c.whyText}</p>
          </div>
          <div className="features-grid">
            {c.features.map(([heading, text], i) => (
              <article className="feature" key={i}>
                <span className={`icon-box ${featureStyle[i][1]}`}>
                  <Icon name={featureStyle[i][0]} />
                </span>
                <h3>{heading}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="how" className="section tinted">
          <div className="container">
            <div className="section-heading">
              <span className="section-kicker">{c.howKicker}</span>
              <h2>{c.howTitle}</h2>
              <p>{c.howText}</p>
            </div>
            <div className="steps-grid">
              {c.steps.map(([heading, text], i) => (
                <article className="step" key={i}>
                  <span className="step-number">0{i + 1}</span>
                  <h3>{heading}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="courses" className="section container">
          <div className="section-heading">
            <span className="section-kicker">{c.coursesKicker}</span>
            <h2>{c.courses}</h2>
            <p>{c.coursesText}</p>
          </div>
          <div className="filters" aria-label={c.categoryLabel}>
            {categoryKeys.map((key, i) => (
              <button
                key={key}
                aria-pressed={category === key}
                className={category === key ? "filter active" : "filter"}
                onClick={() => setCategory(key)}
              >
                {c.categories[i]}
              </button>
            ))}
          </div>
          <div className="courses-grid" aria-live="polite">
            {filtered.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
              />
            ))}
          </div>
          <p className="results-count">
            {category === "all" ? c.allCourses : categoryName(category)} —{" "}
            {filtered.length} {c.available}
          </p>
        </section>
        <section id="path" className="section tinted">
          <div className="container path-section">
            <div className="section-heading">
              <span className="section-kicker">{c.pathKicker}</span>
              <h2>{c.pathTitle}</h2>
              <p>{c.pathText}</p>
            </div>
            <div className="path-steps">
              {c.pathSteps.map(([heading, text], i) => (
                <div key={i}>
                  <span>{i + 1}</span>
                  <strong>{heading}</strong>
                  <small>{text}</small>
                </div>
              ))}
            </div>
            <p className="path-tip">
              <Icon name="leaf" size={20} />
              {c.pathTip}
            </p>
            <button className="button button-outline" onClick={startQuiz}>
              {c.findPath}
              <span className="direction-arrow" aria-hidden="true">
                ←
              </span>
            </button>
          </div>
        </section>
        <section className="section container cta">
          <div className="ornament" aria-hidden="true">
            ✿ ─ ◇ ─ ✿
          </div>
          <h2>{c.ctaTitle}</h2>
          <p>{c.ctaText}</p>
          <div className="button-row">
            <Link className="button" to="/signup">
              {c.join}
            </Link>
            <Link className="button button-outline" to="/signup">
              {c.contribute}
            </Link>
          </div>
        </section>
      </main>

      {modal && (
        <Modal title={title} onClose={() => setModal(null)}>

          {modal.type === "quiz" &&
            (result ? (
              <>
                <p>
                  {c.resultPrefix} <strong>{categoryName(interest)}</strong>.
                </p>
                <p>{c.resultNote}</p>
                <button
                  className="button"
                  onClick={() => {
                    setCategory(interest);
                    setModal(null);
                    document
                      .getElementById("courses")
                      .scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {c.suitable}
                </button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (interest) setResult(true);
                }}
              >
                <p>{c.quizQuestion}</p>
                <fieldset className="quiz-options">
                  <legend className="sr-only">{c.interest}</legend>
                  {categoryKeys.slice(1).map((key) => (
                    <label key={key}>
                      <input
                        type="radio"
                        name="interest"
                        value={key}
                        required
                        checked={interest === key}
                        onChange={(e) => setInterest(e.target.value)}
                      />
                      {categoryName(key)}
                    </label>
                  ))}
                </fieldset>
                <button className="button" type="submit">
                  {c.suggestion}
                </button>
              </form>
            ))}
        </Modal>
      )}
    </>
  );
}
