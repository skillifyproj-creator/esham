import { createContext, useContext } from 'react';
import { useFinancial } from './FinancialContext';
import { usePublicCatalog } from './PublicCatalogContext';
import { useLearning } from './LearningContext';
const LearnerContext = createContext(null);
export function LearnerProvider({ children }) {
  const data = useFinancial();
  const { summaries } = useLearning();
  const { courses } = usePublicCatalog();
  const enrollments = data.enrollments.map(e => ({ ...e, learning: summaries[e.id] || null, source: 'backend', completedLessonIds: [],
    lastOpenedAt: e.lastOpenedAt || e.enrolledAt,
    course: { id: e.courseId, title: { ar: e.titleAr || e.titleEn || '', en: e.titleEn || e.titleAr || '' },
      instructor: { ar: e.instructorName || '', en: e.instructorNameEn || e.instructorName || '' },
      image: courses.find(c => c.id === e.courseId)?.image || null, curriculum: [] } }));
  return <LearnerContext.Provider value={{ ...data, enrollments,
    // Progress writes belong to a later phase. Browser clicks cannot create earned evidence.
    markLessonComplete: () => false }}>{children}</LearnerContext.Provider>;
}
export function useLearner() { const value = useContext(LearnerContext); if (!value) throw new Error('useLearner requires LearnerProvider'); return value; }
