import { Outlet } from "react-router";
import InstructorNavigation from "./InstructorNavigation";
import { usePreferences } from "../../context/PreferencesContext";
import instructorCopy from "../../i18n/instructorCopy";
import "../../styles/instructor.css";

export default function InstructorLayout() {
  const { language } = usePreferences();
  const c = instructorCopy[language];

  return (
    <div
      className="instructor-app"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      <InstructorNavigation />

      <div className="instructor-main">
        <Outlet />
      </div>

      <footer className="instructor-footer">
        <div className="instructor-footer-inner">
          <div className="instructor-footer-brand">
              <strong>{c.brandName}</strong>
            <span>{c.footerDescription}</span>
          </div>

          <div className="instructor-footer-links">
            <a href="#terms">{c.terms}</a>
            <a href="#privacy">{c.privacy}</a>
            <a href="#guides">{c.instructorGuidelines}</a>
            <a href="#support">{c.academicSupport}</a>
          </div>

          <p>
            {c.allRightsReserved} © {new Date().getFullYear()} {c.brandName}
          </p>
        </div>
      </footer>
    </div>
  );
}