import { Outlet } from "react-router";
import LearnerNavigation from "./LearnerNavigation";
import Footer from "../Footer";
import { LearnerTasksProvider } from "../../context/LearnerTasksContext";
import "../../styles/learner.css";

export default function LearnerLayout() {
  return (
    <LearnerTasksProvider>
      <div className="learner-app">
        <LearnerNavigation />

        <div className="learner-main">
          <Outlet />
        </div>

        <Footer />
      </div>
    </LearnerTasksProvider>
  );
}