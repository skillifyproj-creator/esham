import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { courses } from "../data/courses";
import { learnerDemo } from "../data/learnerDemo";

const LearnerContext = createContext(null);
const STORAGE_KEY = "esham-learner-progress-v1";

function loadEnrollments() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!Array.isArray(saved)) {
      return learnerDemo.enrollments;
    }

    // نقرأ سجلات الدورات التجريبية الحالية فقط،
    // ونستبعد معرفات الدروس القديمة أو غير الموجودة.
    return learnerDemo.enrollments.map((enrollment) => {
      const course = courses.find(
        (item) => item.id === enrollment.courseId,
      );

      const stored = saved.find(
        (item) => item.courseId === enrollment.courseId,
      );

      if (!course || !Array.isArray(stored?.completedLessonIds)) {
        return enrollment;
      }

      const validLessonIds = new Set(
        course.curriculum.flatMap((module) =>
          module.lessons.map((lesson) => lesson.id),
        ),
      );

      return {
        ...enrollment,
        completedLessonIds: [
          ...new Set(
            stored.completedLessonIds.filter((id) =>
              validLessonIds.has(id),
            ),
          ),
        ],
        lastOpenedAt:
          typeof stored.lastOpenedAt === "string" &&
          !Number.isNaN(Date.parse(stored.lastOpenedAt))
            ? stored.lastOpenedAt
            : enrollment.lastOpenedAt,
      };
    });
  } catch {
    return learnerDemo.enrollments;
  }
}

export function LearnerProvider({ children }) {
  const [enrollments, setEnrollments] = useState(loadEnrollments);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enrollments));
    } catch {
      // تبقى الصفحة تعمل حتى إذا تعذّر الحفظ المحلي.
    }
  }, [enrollments]);

  const markLessonComplete = useCallback((courseId, lessonId) => {
    const course = courses.find((item) => item.id === courseId);

    const exists = course?.curriculum.some((module) =>
      module.lessons.some((lesson) => lesson.id === lessonId),
    );

    if (!exists) return;

    setEnrollments((previous) =>
      previous.map((enrollment) => {
        if (
          enrollment.courseId !== courseId ||
          enrollment.completedLessonIds.includes(lessonId)
        ) {
          return enrollment;
        }

        return {
          ...enrollment,
          completedLessonIds: [
            ...enrollment.completedLessonIds,
            lessonId,
          ],
          lastOpenedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  return (
    <LearnerContext.Provider
      value={{ enrollments, markLessonComplete }}
    >
      {children}
    </LearnerContext.Provider>
  );
}

export function useLearner() {
  const context = useContext(LearnerContext);

  if (!context) {
    throw new Error("useLearner must be inside LearnerProvider");
  }

  return context;
}