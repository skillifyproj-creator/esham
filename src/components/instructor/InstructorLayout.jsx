import { Link, Outlet } from "react-router";
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
            <Link to="/help/terms">{c.terms}</Link>
            <Link to="/help/privacy">{c.privacy}</Link>
            <Link to="/help/guidelines">{c.instructorGuidelines}</Link>
            <Link to="/help/support">{c.academicSupport}</Link>
          </div>

          <p>
            {c.allRightsReserved} © {new Date().getFullYear()} {c.brandName}
          </p>
        </div>
      </footer>
    </div>
  );
}
