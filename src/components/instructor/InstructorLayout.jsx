import PendingFeature from "../shared/PendingFeature";
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
            <PendingFeature>{c.terms}</PendingFeature>
            <PendingFeature>{c.privacy}</PendingFeature>
            <PendingFeature>{c.instructorGuidelines}</PendingFeature>
            <PendingFeature>{c.academicSupport}</PendingFeature>
          </div>

          <p>
            {c.allRightsReserved} © {new Date().getFullYear()} {c.brandName}
          </p>
        </div>
      </footer>
    </div>
  );
}
