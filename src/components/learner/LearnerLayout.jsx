import { Outlet } from "react-router";
import LearnerNavigation from "./LearnerNavigation";
import "../../styles/learner.css";

export default function LearnerLayout() {
  return (
    <div className="learner-app" dir="rtl">
      <LearnerNavigation />

      <main className="learner-main">
        <Outlet />
      </main>
    </div>
  );
}