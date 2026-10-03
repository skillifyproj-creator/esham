/**لمهام الأصلية تبقى في learnerDemo. هذا السياق يحفظ المسودة وحالة التسليم، ويشاركها بين لوحة المتعلّم وصفحة الدرس وصفحة المهام.
الحفظ محلي وتجريبي. ما رح نحسب نقاطًا أو نعتبر المهمة ناجحة بمجرد تسليمها؛ النجاح يحتاج مراجعة المدرّب.
*/

import { createContext, useContext, useEffect, useState } from "react";

import { learnerDemo } from "../data/learnerDemo";
import { courses } from "../data/courses";
import { useLearner } from "./LearnerContext";

const Context = createContext(null);
const KEY = "esham-task-submissions-v1";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));

    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return {};
    }

    return Object.fromEntries(
      learnerDemo.tasks
        .filter((task) => {
          const item = saved[task.id];

          return (
            item &&
            ["inProgress", "awaitingReview"].includes(item.status) &&
            typeof item.answer === "string" &&
            typeof item.link === "string"
          );
        })
        .map((task) => [task.id, saved[task.id]]),
    );
  } catch {
    return {};
  }
}

export function LearnerTasksProvider({ children }) {
  const { enrollments } = useLearner();
  const [records, setRecords] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(records));
    } catch {
      // تعمل الواجهة حتى لو تعذّر الحفظ.
    }
  }, [records]);

  const tasks = learnerDemo.tasks
    .filter((task) =>
      enrollments.some((item) => item.courseId === task.courseId),
    )
    .map((task) => ({
      ...task,
      ...records[task.id],
      course: courses.find((course) => course.id === task.courseId),
    }))
    .filter((task) => task.course);

  function saveTask(id, answer, link, submit = false) {
    const task = tasks.find((task) => task.id === id);

    if (!task || task.status === "awaitingReview") {
      return false;
    }

    answer = answer.trim();
    link = link.trim();

    if (link) {
      try {
        const protocol = new URL(link).protocol;

        if (!["http:", "https:"].includes(protocol)) {
          return false;
        }
      } catch {
        return false;
      }
    }

    if (submit && !answer && !link) {
      return false;
    }

    setRecords((previous) => ({
      ...previous,
      [id]: {
        answer,
        link,
        status: submit ? "awaitingReview" : "inProgress",
        submittedAt: submit ? new Date().toISOString() : null,
      },
    }));

    return true;
  }

  return (
    <Context.Provider value={{ tasks, saveTask }}>{children}</Context.Provider>
  );
}

export function useLearnerTasks() {
  const value = useContext(Context);

  if (!value) {
    throw new Error("useLearnerTasks requires LearnerTasksProvider");
  }

  return value;
}
