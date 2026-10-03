import { Outlet } from "react-router";
import InstructorNavigation from "./InstructorNavigation";
import "../../styles/instructor.css";


export default function InstructorLayout() {
  return (
    <div
      className="instructor-app"
      dir="rtl"
    >

      {/* =========================
          Navigation
      ========================= */}

      <InstructorNavigation />


      {/* =========================
          Page Content
      ========================= */}

      <main className="instructor-main">
        <Outlet />
      </main>


      {/* =========================
          Footer
      ========================= */}

      <footer className="instructor-footer">

        <div className="instructor-footer-inner">

          <div className="instructor-footer-brand">

            <strong>
              إسهام
            </strong>

            <span>
              منصة إسهام للتعليم التعاوني وتطوير المهارات.
            </span>

          </div>


          <div className="instructor-footer-links">

            <a href="#terms">
              شروط الخدمة
            </a>

            <a href="#privacy">
              سياسة الخصوصية
            </a>

            <a href="#guides">
              إرشادات المدربين
            </a>

            <a href="#support">
              الدعم الأكاديمي
            </a>

          </div>


          <p>
            جميع الحقوق محفوظة © 2025 منصة إسهام
          </p>

        </div>

      </footer>

    </div>
  );
}