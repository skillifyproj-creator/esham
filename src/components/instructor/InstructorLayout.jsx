import { Outlet } from "react-router";
import InstructorNavigation from "./InstructorNavigation";
import { usePreferences } from "../../context/PreferencesContext";
import Footer from "../Footer";
import "../../styles/instructor.css";

export default function InstructorLayout() {
  const { language } = usePreferences();

  return (
    <div
      className="instructor-app"
      dir={language === "en" ? "ltr" : "rtl"}
    >
      <InstructorNavigation />

      <div className="instructor-main">
        <Outlet />
      </div>

      <Footer />
    </div>
  );
}
