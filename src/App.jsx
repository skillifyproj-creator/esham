import { useLayoutEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Link, Navigate } from "react-router";

import {
  PreferencesProvider,
  usePreferences,
} from "./context/PreferencesContext";

import HomePage from "./pages/HomePage";
import CoursesPage from "./pages/CoursesPage";
import CourseDetailsPage from "./pages/CourseDetailsPage";

import Header from "./components/Header";
import Footer from "./components/Footer";

import { coursePagesCopy } from "./i18n/coursePagesCopy";
import "./styles/course-pages.css";

import { LearnerProvider } from "./context/LearnerContext";
import LearnerLayout from "./components/learner/LearnerLayout";
import LearnerDashboard from "./pages/learner/LearnerDashboard";
import LearnerCoursesPage from "./pages/learner/LearnerCoursesPage";
import LearnerLessonPage from "./pages/learner/LearnerLessonPage";

import InstructorLayout from "./components/instructor/InstructorLayout";
import InstructorDashboard from "./pages/instructor/InstructorDashboard";
import InstructorCoursesPage from "./pages/instructor/InstructorCoursesPage";
import CreateCoursePage from "./pages/instructor/CreateCoursePage";
import CourseCurriculumPage from "./pages/instructor/CourseCurriculumPage";
import CourseReviewPage from "./pages/instructor/CourseReviewPage";
import InstructorPerformancePage from "./pages/instructor/InstructorPerformancePage";
import InstructorFeedbackPage from "./pages/instructor/InstructorFeedbackPage";
import EditLessonPage from "./pages/instructor/EditLessonPage";
import InstructorTaskPage from "./pages/instructor/InstructorTaskPage";

import LearnerTasksPage from "./pages/learner/LearnerTasksPage";
import LearnerProgressPage from "./pages/learner/LearnerProgressPage";
import LearnerPointsPage from "./pages/learner/LearnerPointsPage";
import LearnerReviewsPage from "./pages/learner/LearnerReviewsPage";
import LearnerNotificationsPage from "./pages/learner/LearnerNotificationsPage";
import EshamChatbot from "./components/chatbot/EshamChatbot";
import "./styles/role-navigation.css";
import "./styles/instructor-details.css";

function RouteShell() {
  const { pathname, hash } = useLocation();
  const { language } = usePreferences();

  const p = coursePagesCopy[language];

  useLayoutEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));

      if (el) {
        el.scrollIntoView();
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  /*
   * Each user area has its own Layout:
   *
   * Public     → Header + Footer
   * Learner    → LearnerNavigation + LearnerFooter
   * Instructor → InstructorNavigation + InstructorFooter
   */

  const isHome = pathname === "/";
  const isInstructor = pathname.startsWith("/instructor");
  const isLearner = pathname.startsWith("/learner");
  const assistantPath = isLearner
    ? "/learner/assistant"
    : isInstructor
      ? "/instructor/assistant"
      : "/assistant";
  const isAssistantPage = pathname === assistantPath;

  return (
    <>
      {/* Public Header only */}
      {!isHome && !isInstructor && !isLearner && <Header />}

      <Routes>
        {/* =================================
            Public Pages
        ================================= */}

        <Route path="/" element={<HomePage />} />

        <Route path="/courses" element={<CoursesPage />} />

        <Route path="/courses/:courseId" element={<CourseDetailsPage />} />

        <Route path="/assistant" element={<EshamChatbot />} />

        {/* =================================
            Learner Pages
        ================================= */}
        <Route path="/learner" element={<LearnerLayout />}>
          <Route index element={<LearnerDashboard />} />

          <Route path="courses" element={<LearnerCoursesPage />} />

          <Route
            path="courses/:courseId/learn"
            element={<LearnerLessonPage />}
          />

          <Route path="tasks" element={<LearnerTasksPage />} />

          <Route path="progress" element={<LearnerProgressPage />} />
          <Route path="points" element={<LearnerPointsPage />} />
          <Route path="reviews" element={<LearnerReviewsPage />} />
          <Route
            path="notifications"
            element={<LearnerNotificationsPage />}
          />

          <Route path="assistant" element={<EshamChatbot />} />
        </Route>

        {/* =================================
            Instructor Pages
        ================================= */}

        <Route path="/instructor" element={<InstructorLayout />}>
          <Route index element={<InstructorDashboard />} />

          <Route path="courses" element={<InstructorCoursesPage />} />

          <Route path="courses/new" element={<CreateCoursePage />} />

          <Route
            path="courses/new/curriculum"
            element={<CourseCurriculumPage />}
          />

          <Route
            path="courses/new/review"
            element={<CourseReviewPage />}
          />

          <Route
            path="performance"
            element={<Navigate to="/instructor/courses" replace />}
          />

          <Route
            path="courses/:courseId/performance"
            element={<InstructorPerformancePage />}
          />

          <Route
            path="feedback"
            element={<InstructorFeedbackPage />}
          />

          <Route
            path="courses/:courseId/lessons/:lessonId/edit"
            element={<EditLessonPage />}
          />

          <Route
            path="courses/:courseId/sections/:sectionId/lessons/:lessonId"
            element={<EditLessonPage />}
          />

          <Route
            path="courses/:courseId/sections/:sectionId/lessons/:lessonId/edit"
            element={<EditLessonPage />}
          />

          <Route
            path="courses/:courseId/sections/:sectionId/tasks/new"
            element={<InstructorTaskPage />}
          />

          <Route
            path="courses/:courseId/sections/:sectionId/tasks/:taskId/edit"
            element={<InstructorTaskPage />}
          />

          <Route path="assistant" element={<EshamChatbot />} />
        </Route>

        {/* =================================
            404
        ================================= */}

        <Route
          path="*"
          element={
            <main className="section container empty-state">
              <h1>{p.missing}</h1>

              <Link className="button" to="/">
                {p.backHome}
              </Link>
            </main>
          }
        />
      </Routes>

      {!isAssistantPage && (
        <Link
          className="esham-assistant-launcher"
          to={assistantPath}
          aria-label={
            language === "ar"
              ? "فتح مساعد إسهام"
              : "Open Esham Assistant"
          }
          title={
            language === "ar"
              ? "مساعد إسهام"
              : "Esham Assistant"
          }
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v3" />
            <circle cx="12" cy="2.5" r="0.5" fill="currentColor" />
            <rect x="4" y="6" width="16" height="14" rx="4" />
            <path d="M2 11v4M22 11v4" />
            <circle
              cx="8.5"
              cy="12"
              r="1"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="15.5"
              cy="12"
              r="1"
              fill="currentColor"
              stroke="none"
            />
            <path d="M9 16h6" />
          </svg>
        </Link>
      )}

      {/* Public Footer only */}
      {!isHome && !isInstructor && !isLearner && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <BrowserRouter>
        <LearnerProvider>
          <RouteShell />
        </LearnerProvider>
      </BrowserRouter>
    </PreferencesProvider>
  );
}
