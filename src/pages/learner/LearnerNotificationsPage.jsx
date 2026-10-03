import { useState } from "react";
import { Link } from "react-router";

import { usePreferences } from "../../context/PreferencesContext";
import { useLearner } from "../../context/LearnerContext";
import { useLearnerNotifications } from "../../hooks/useLearnerNotifications";

import { notificationGroup } from "../../data/learnerNotifications";
import { notificationsCopy } from "../../i18n/notificationsCopy";
import { courses } from "../../data/courses";

import Icon from "../../components/Icon";
import "../../styles/learner-notifications.css";

export default function LearnerNotificationsPage() {
  const { language } = usePreferences();
  const { enrollments } = useLearner();

  const {
    notifications,
    markRead,
    markAll,
  } = useLearnerNotifications();

  const t = notificationsCopy[language];

  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");

  const unread = notifications.filter(
    (item) => !item.read,
  ).length;

  const filters = [
    "all",
    "unread",
    "learning",
    "skills",
    "interaction",
  ];

  const visible = notifications
    .filter((item) => {
      if (filter === "all") return true;
      if (filter === "unread") return !item.read;

      return item.category === filter;
    })
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );

  const now = new Date();
  const groups = ["today", "yesterday", "week", "older"];

  function getAction(item) {
    if (item.action === "tasks") {
      return {
        to: `/learner/tasks${
          item.courseId ? `?course=${item.courseId}` : ""
        }`,
        label: t.tasks,
      };
    }

    if (item.action === "courses") {
      return {
        to: "/learner/courses",
        label: t.courses,
      };
    }

    if (item.category === "interaction") {
      return {
        to: "/learner/reviews",
        label: t.reviews,
      };
    }

    const enrolled = enrollments.some(
      (record) => record.courseId === item.courseId,
    );

    if (item.courseId && enrolled) {
      return {
        to: `/learner/courses/${item.courseId}/learn`,
        label: t.learn,
      };
    }

    return {
      to: "/learner/progress",
      label: t.progress,
    };
  }

  const formatDate = (value) =>
    new Intl.DateTimeFormat(
      language === "ar" ? "ar" : "en",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    ).format(new Date(value));

  return (
    <main className="ln-page">
      <div className="container">
        <header className="ln-heading">
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </header>

        <p className="ln-demo">{t.demo}</p>

        <div className="ln-toolbar">
          <div
            className="ln-filters"
            role="group"
            aria-label={t.filters}
          >
            {filters.map((key) => (
              <button
                key={key}
                className={
                  filter === key
                    ? "ln-filter active"
                    : "ln-filter"
                }
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {t[key]}

                {key === "unread" && (
                  <span>{unread}</span>
                )}
              </button>
            ))}
          </div>

          <button
            className="button button-outline"
            disabled={unread === 0}
            onClick={() => {
              markAll();
              setMessage(t.marked);
            }}
          >
            {t.markAll}
          </button>
        </div>

        <p role="status" className="ln-status">
          {message}
        </p>

        {groups.map((group) => {
          const items = visible.filter(
            (item) =>
              notificationGroup(item.createdAt, now) === group,
          );

          if (items.length === 0) return null;

          return (
            <section className="ln-group" key={group}>
              <h2>{t[group]}</h2>

              <div className="ln-list">
                {items.map((item) => {
                  const target = getAction(item);

                  const course = courses.find(
                    (course) => course.id === item.courseId,
                  );

                  const icon =
                    item.category === "learning"
                      ? "book"
                      : item.category === "skills"
                        ? "award"
                        : "user";

                  return (
                    <article
                      key={item.id}
                      className={`ln-card${
                        item.read ? "" : " unread"
                      }`}
                    >
                      <span className="ln-icon">
                        <Icon name={icon} />
                      </span>

                      <div className="ln-content">
                        <div className="ln-title">
                          <h3>{item.title[language]}</h3>

                          {!item.read && (
                            <span className="ln-badge">
                              {t.new}
                            </span>
                          )}
                        </div>

                        {course && (
                          <p className="ln-course">
                            {course.title[language]}
                          </p>
                        )}

                        <p>{item.body[language]}</p>

                        <div className="ln-actions">
                          <Link
                            className="button button-outline button-small"
                            to={target.to}
                            onClick={() => markRead(item.id)}
                          >
                            {target.label}
                          </Link>

                          {!item.read && (
                            <button
                              className="ln-read-button"
                              onClick={() => markRead(item.id)}
                            >
                              {t.markRead}
                            </button>
                          )}
                        </div>
                      </div>

                      <time dateTime={item.createdAt}>
                        {formatDate(item.createdAt)}
                      </time>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {visible.length === 0 && (
          <section className="ln-empty">
            <Icon name="info" size={36} />

            <h2>
              {notifications.length > 0
                ? t.emptyFilter
                : t.empty}
            </h2>

            <p>{t.emptyHint}</p>

            {filter !== "all" && (
              <button
                className="button button-outline"
                onClick={() => setFilter("all")}
              >
                {t.clear}
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
