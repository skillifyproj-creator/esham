const PlatformHelpPage = lazy(() => import('./pages/shared/PlatformHelpPage'));
const InstructorReviewReportPage = lazy(() => import('./pages/instructor/InstructorReviewReportPage'));
const InstructorCertificatesPage = lazy(() => import('./pages/instructor/InstructorCertificatesPage'));
const ModerationQueuePage = lazy(() => import('./pages/shared/ModerationQueuePage'));
const LearnerCertificatesPage = lazy(() => import('./pages/learner/LearnerCertificatesPage'));
import PageErrorBoundary from './components/shared/PageErrorBoundary';
import DevelopmentAdminAccess from './components/shared/DevelopmentAdminAccess';
import StorageNotice from './components/shared/StorageNotice';
import { refreshPublishedCourses } from './data/courses';
import { refreshInstructorCourses } from './data/instructorDemo';
import { COURSE_EVENT } from './services/coursePublishing';
﻿import RoleArea from './components/shared/RoleArea';
import AccountPage from "./pages/shared/AccountPage";
import { NotificationsProvider } from "./context/NotificationsContext";
import NotificationsPage from "./pages/shared/NotificationsPage";
import { lazy, Suspense, useLayoutEffect, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, Link, Navigate } from "react-router";

import {
  PreferencesProvider,
  usePreferences,
} from "./context/PreferencesContext";

import HomePage from "./pages/HomePage";
import CoursesPage from "./pages/CoursesPage";
import CourseDetailsPage from "./pages/CourseDetailsPage";
import SignupPage from "./pages/auth/SignupPage";
import LoginPage from "./pages/auth/LoginPage";
import OnboardingPage from "./pages/auth/OnboardingPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";

import Header from "./components/Header";
import Footer from "./components/Footer";

import { coursePagesCopy } from "./i18n/coursePagesCopy";
import "./styles/course-pages.css";

import { LearnerProvider } from "./context/LearnerContext";
import LearnerLayout from "./components/learner/LearnerLayout";




import InstructorLayout from "./components/instructor/InstructorLayout";




















import EshamChatbot from "./components/chatbot/EshamChatbot";
import "./styles/role-navigation.css";
import "./styles/instructor-details.css";

const LearnerDashboard = lazy(() => import("./pages/learner/LearnerDashboard"));
const LearnerCoursesPage = lazy(() => import("./pages/learner/LearnerCoursesPage"));
const LearnerLessonPage = lazy(() => import("./pages/learner/LearnerLessonPage"));
const InstructorDashboard = lazy(() => import("./pages/instructor/InstructorDashboard"));
const InstructorCoursesPage = lazy(() => import("./pages/instructor/InstructorCoursesPage"));
const CreateCoursePage = lazy(() => import("./pages/instructor/CreateCoursePage"));
const CourseCurriculumPage = lazy(() => import("./pages/instructor/CourseCurriculumPage"));
const CourseReviewPage = lazy(() => import("./pages/instructor/CourseReviewPage"));
const InstructorPerformancePage = lazy(() => import("./pages/instructor/InstructorPerformancePage"));
const InstructorFeedbackPage = lazy(() => import("./pages/instructor/InstructorFeedbackPage"));
const EditLessonPage = lazy(() => import("./pages/instructor/EditLessonPage"));
const InstructorVideoSourcePage = lazy(() => import("./pages/instructor/InstructorVideoSourcePage"));
const InstructorVideoRecordingSetupPage = lazy(() => import("./pages/instructor/InstructorVideoRecordingSetupPage"));
const InstructorVideoRecordingPage = lazy(() => import("./pages/instructor/InstructorVideoRecordingPage"));
const InstructorVideoPreviewPage = lazy(() => import("./pages/instructor/InstructorVideoPreviewPage"));
const InstructorVideoEditorPage = lazy(() => import("./pages/instructor/InstructorVideoEditorPage"));
const InstructorTaskPage = lazy(() => import("./pages/instructor/InstructorTaskPage"));
const LearnerTasksPage = lazy(() => import("./pages/learner/LearnerTasksPage"));
const LearnerProgressPage = lazy(() => import("./pages/learner/LearnerProgressPage"));
const LearnerPointsPage = lazy(() => import("./pages/learner/LearnerPointsPage"));
const InstructorCoursePreviewPage = lazy(() => import('./pages/instructor/InstructorCoursePreviewPage'));
const InstructorSubmissionsPage = lazy(() => import('./pages/instructor/InstructorSubmissionsPage'));
const LearnerReviewsPage = lazy(() => import("./pages/learner/LearnerReviewsPage"));
const LearnerNotificationsPage = lazy(() => import("./pages/learner/LearnerNotificationsPage"));

const lazyNamed = (load, name) => lazy(() => load().then(module => ({ default: module[name] })));
const SuperAdminLayout = lazyNamed(() => import("./pages/admin/SuperAdminModule"), "SuperAdminLayout");
const SuperAdminRoutes = lazyNamed(() => import("./pages/admin/SuperAdminModule"), "SuperAdminRoutes");
const Dashboard = lazyNamed(() => import("./pages/admin/SuperAdminModule"), "Dashboard");
const AdminsPage = lazyNamed(() => import("./pages/admin/SuperAdminModule"), "AdminsPage");
const UsersPage = lazyNamed(() => import("./pages/admin/SuperAdminModule"), "UsersPage");
const AdminCoursesPage = lazyNamed(() => import("./pages/admin/SuperAdminModule"), "CoursesPage");
const CategoriesPage = lazyNamed(() => import("./pages/admin/SuperAdminModule"), "CategoriesPage");
const ReportsPage = lazyNamed(() => import("./pages/admin/SuperAdminModule"), "ReportsPage");
const AnnouncementsPage = lazyNamed(() => import("./pages/admin/SuperAdminModule"), "AnnouncementsPage");
const ActivityPage = lazyNamed(() => import("./pages/admin/SuperAdminModule"), "ActivityPage");
const CategoryAdminProvider = lazyNamed(() => import("./pages/category-admin/CategoryAdminModule"), "CategoryAdminProvider");
const CategoryAdminLayout = lazyNamed(() => import("./pages/category-admin/CategoryAdminModule"), "CategoryAdminLayout");
const CategoryAdminDashboard = lazyNamed(() => import("./pages/category-admin/CategoryAdminModule"), "Dashboard");
const CategoryAdminCourses = lazyNamed(() => import("./pages/category-admin/CategoryAdminModule"), "CoursesPage");
const CategoryAdminReview = lazyNamed(() => import("./pages/category-admin/CategoryAdminModule"), "ReviewPage");
const CategoryAdminActivity = lazyNamed(() => import("./pages/category-admin/CategoryAdminModule"), "ActivityPage");
const CategoryAdminNotifications = lazyNamed(() => import("./pages/category-admin/CategoryAdminModule"), "NotificationsPage");

function RouteShell() {
  const [,setCourseRevision] = useState(0);
  useEffect(()=>{const refresh=()=>{refreshPublishedCourses();refreshInstructorCourses();setCourseRevision(value=>value+1);};window.addEventListener(COURSE_EVENT,refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener(COURSE_EVENT,refresh);window.removeEventListener('storage',refresh);};},[]);
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
  const isAdmin = pathname.startsWith("/admin");
  const isCategoryAdmin = pathname.startsWith("/category-admin");
  const isAuth = ["/signup", "/login", "/forgot-password", "/reset-password"].includes(pathname) || pathname.startsWith("/onboarding");
  const assistantPath = isLearner
    ? "/learner/assistant"
    : isInstructor
      ? "/instructor/assistant"
      : "/assistant";
  const isAssistantPage = pathname === assistantPath;

  return (
    <>
      <DevelopmentAdminAccess />
      <StorageNotice />
      {/* Public Header only */}
      {!isHome && !isInstructor && !isLearner && !isAdmin && !isCategoryAdmin && !isAuth && !isAssistantPage && <Header />}

      <PageErrorBoundary><Suspense fallback={<main className="section container" role="status">{language === "ar" ? "جاري تحميل الصفحة…" : "Loading page…"}</main>}>
      <Routes>
        <Route path="/admin" element={<SuperAdminRoutes />}>
          <Route element={<SuperAdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="admins" element={<AdminsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="courses" element={<AdminCoursesPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="reports" element={<ReportsPage />} /><Route path="moderation" element={<ModerationQueuePage/>}/>
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="activity" element={<ActivityPage />} />
          </Route>
        </Route>
        <Route path="/category-admin" element={<CategoryAdminProvider />}>
          <Route element={<CategoryAdminLayout />}>
            <Route index element={<CategoryAdminDashboard />} />
            <Route path="courses" element={<CategoryAdminCourses />} />
            <Route path="courses/:courseId/review" element={<CategoryAdminReview />} />
            <Route path="activity" element={<CategoryAdminActivity />} />
            <Route path="notifications" element={<CategoryAdminNotifications />} /><Route path="moderation" element={<ModerationQueuePage scoped/>}/>
          </Route>
        </Route>
        {/* =================================
            Public Pages
        ================================= */}

        <Route path="/" element={<HomePage />} />

        <Route path="/courses" element={<CoursesPage />} />

        <Route path="/courses/:courseId" element={<CourseDetailsPage />} />

        <Route path="/assistant" element={<EshamChatbot />} />

        <Route path="/help/:topic" element={<PlatformHelpPage/>}/><Route path="/signup" element={<SignupPage />} />
        <Route path="/onboarding" element={<Navigate to="/onboarding/role" replace />} />
        <Route path="/onboarding/:step" element={<OnboardingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* =================================
            Learner Pages
        ================================= */}
        <Route path="/learner" element={<RoleArea role="learner"><LearnerLayout /></RoleArea>}>
<Route path="profile" element={<AccountPage role="learner" section="profile" />} />
<Route path="settings" element={<AccountPage role="learner" section="settings" />} />
<Route path="settings/security" element={<AccountPage role="learner" section="security" />} />
          <Route index element={<LearnerDashboard />} />

          <Route path="courses" element={<LearnerCoursesPage />} />

          <Route
            path="courses/:courseId/learn"
            element={<LearnerLessonPage />}
          />

          <Route path="tasks" element={<LearnerTasksPage />} />

          <Route path="courses/certificates" element={<LearnerCertificatesPage/>}/><Route path="courses/certificates/:courseId" element={<LearnerCertificatesPage/>}/><Route path="certificates" element={<LearnerCertificatesPage/>}/><Route path="certificates/:courseId" element={<LearnerCertificatesPage/>}/><Route path="progress" element={<LearnerProgressPage />} />
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

        <Route path="/instructor" element={<RoleArea role="instructor"><InstructorLayout /></RoleArea>}>
<Route path="profile" element={<AccountPage role="instructor" section="profile" />} />
<Route path="settings" element={<AccountPage role="instructor" section="settings" />} />
<Route path="settings/security" element={<AccountPage role="instructor" section="security" />} />
          <Route path="notifications" element={<NotificationsPage role="instructor" />} /><Route path="courses/certificates" element={<InstructorCertificatesPage/>}/><Route path="certificates" element={<InstructorCertificatesPage/>}/><Route path="courses/:courseId/review-report" element={<InstructorReviewReportPage/>}/>
          <Route index element={<InstructorDashboard />} />
          <Route path="submissions" element={<InstructorSubmissionsPage />} />
          <Route path="points" element={<LearnerPointsPage />} />
          <Route path="courses/:courseId/preview" element={<InstructorCoursePreviewPage />} />

          <Route path="courses" element={<InstructorCoursesPage />} />

          <Route path="courses/new" element={<CreateCoursePage />} />
          <Route path="courses/:courseId/edit" element={<CreateCoursePage />} />

          <Route
            path="courses/new/curriculum"
            element={<CourseCurriculumPage />}
          />
          <Route path="courses/:courseId/curriculum" element={<CourseCurriculumPage />} />

          <Route
            path="courses/new/review"
            element={<CourseReviewPage />}
          />
          <Route path="courses/:courseId/review" element={<CourseReviewPage />} />

          <Route
            path="performance"
            element={<InstructorPerformancePage />}
          />

          <Route
            path="courses/:courseId/performance"
            element={<InstructorPerformancePage />}
          />
          <Route
            path="courses/:courseId/feedback"
            element={<InstructorFeedbackPage />}
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
            path="courses/:courseId/sections/:sectionId/lessons/:lessonId/video"
            element={<InstructorVideoSourcePage />}
          />
          <Route
            path="courses/:courseId/sections/:sectionId/lessons/:lessonId/video/record"
            element={<InstructorVideoRecordingSetupPage />}
          />
          <Route
            path="courses/:courseId/sections/:sectionId/lessons/:lessonId/video/recording"
            element={<InstructorVideoRecordingPage />}
          />
          <Route
            path="courses/:courseId/sections/:sectionId/lessons/:lessonId/video/preview"
            element={<InstructorVideoPreviewPage />}
          />
          <Route
            path="courses/:courseId/sections/:sectionId/lessons/:lessonId/video/edit"
            element={<InstructorVideoEditorPage />}
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
      </Suspense></PageErrorBoundary>

      {!isAssistantPage && !isAdmin && !isCategoryAdmin && !isAuth && (
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
      {!isHome && !isInstructor && !isLearner && !isAdmin && !isCategoryAdmin && !isAuth && !isAssistantPage && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <BrowserRouter>
        <LearnerProvider>
          <NotificationsProvider><RouteShell /></NotificationsProvider>
        </LearnerProvider>
      </BrowserRouter>
    </PreferencesProvider>
  );
}
