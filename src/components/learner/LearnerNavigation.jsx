import { NavLink } from "react-router";

import { usePreferences } from "../../context/PreferencesContext";
import { learnerCopy } from "../../i18n/learnerCopy";

export default function LearnerNavigation() {
  const { language } = usePreferences();
  const t = learnerCopy[language];

  const links = [
    {
      to: "/learner",
      label: t.dashboard,
    },
    {
      to: "/learner/courses",
      label: t.myCourses,
    },
  ];

  return (
    <nav className="learner-navigation" aria-label={t.dashboard}>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end
          className={({ isActive }) =>
            isActive
              ? "learner-navigation-link active"
              : "learner-navigation-link"
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}