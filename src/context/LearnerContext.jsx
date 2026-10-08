import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { courses } from "../data/courses";
import { learnerDemo } from "../data/learnerDemo";
import useAccountProfile from '../hooks/useAccountProfile';
import { accountId, getAccountWallet, POINTS_EVENT } from '../data/pointsLedger';

const LearnerContext = createContext(null);
const STORAGE_KEY = "esham-learner-progress-v1";

function loadEnrollments(profile, key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    const base = profile.id ? [] : learnerDemo.enrollments;
    const paid = getAccountWallet(profile).enrollments.map(item => ({ courseId: item.courseId, completedLessonIds: [], lastOpenedAt: item.enrolledAt }));
    const all = [...base, ...paid.filter(item => !base.some(other => other.courseId === item.courseId))];

    // Combine legacy preview enrollments and paid registrations, preserving valid progress.
    return all.map((enrollment) => {
      const course = courses.find(
        (item) => item.id === enrollment.courseId,
      );

      const stored = (Array.isArray(saved) ? saved : []).find(
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
    return profile.id ? [] : learnerDemo.enrollments;
  }
}

export function LearnerProvider({ children }) {
  const profile = useAccountProfile();
  const key = profile.id ? `${STORAGE_KEY}:${accountId(profile)}` : STORAGE_KEY;
  const [state, setState] = useState(() => ({ key, enrollments: loadEnrollments(profile, key) }));
  const enrollments = state.key === key ? state.enrollments : loadEnrollments(profile, key);
  const setEnrollments = callback => setState(previous => ({ key, enrollments: callback(previous.key === key ? previous.enrollments : loadEnrollments(profile, key)) }));

  useEffect(() => {
    const refresh = () => setState({ key, enrollments: loadEnrollments(profile, key) });
    refresh();
    window.addEventListener(POINTS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(POINTS_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, [key, profile.role]);

  useEffect(() => {
    try {
      if (state.key === key) localStorage.setItem(key, JSON.stringify(enrollments));
    } catch {
      window.dispatchEvent(new Event('esham-storage-error'));
    }
  }, [state, key]);

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
  }, [key]);

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
