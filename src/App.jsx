import { useLayoutEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router";
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
import LearnerDashboard from "./pages/learner/LearnerDashboard";
import LearnerCoursesPage from "./pages/learner/LearnerCoursesPage";
import { LearnerProvider } from "./context/LearnerContext";
import LearnerLessonPage from "./pages/learner/LearnerLessonPage";
function RouteShell() {
  const { pathname, hash } = useLocation();
  const { language } = usePreferences();
  const p = coursePagesCopy[language];
  useLayoutEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) el.scrollIntoView();
    } else window.scrollTo(0, 0);
  }, [pathname, hash]);
  // HomePage keeps its current Header/Footer so existing Home edits are preserved.
  const isHome = pathname === "/";
  return (
    <>
      {!isHome && <Header />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailsPage />} />
        <Route path="/learner" element={<LearnerDashboard />} />
        <Route path="/learner/courses" element={<LearnerCoursesPage />} />
        <Route
          path="/learner/courses/:courseId/learn"
          element={<LearnerLessonPage />}
        />
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
      {!isHome && <Footer />}
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
