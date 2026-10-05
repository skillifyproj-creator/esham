import useAccountProfile from '../../hooks/useAccountProfile';
import useAccountName from "../../hooks/useAccountName";
import NotificationBell from "../shared/NotificationBell";
import { useState } from "react";
import { NavLink, Link } from "react-router";

import { usePreferences } from "../../context/PreferencesContext";
import { learnerCopy } from "../../i18n/learnerCopy";
import { learnerDemo } from "../../data/learnerDemo";

import Icon from "../Icon";
import PointsBadge from "../shared/PointsBadge";
import logo from "../../assets/esham-logo.png";
import { useLearnerWallet } from "../../hooks/useLearnerWallet";
export default function LearnerNavigation() {
  const accountName = useAccountName();
  const profile = useAccountProfile();
  const {
    language,
    theme,
    copy: c,
    toggleLanguage,
    toggleTheme,
  } = usePreferences();

  const t = learnerCopy[language];
  const [open, setOpen] = useState(false);

  const links = [
    ["/learner", t.dashboard],
    ["/learner/courses", t.myCourses],
    ["/learner/tasks", t.tasks],
    [
      "/learner/progress",
      language === "ar" ? "تقدّم التعلّم" : "Learning progress",
    ],
    ["/learner/points", language === "ar" ? "النقاط" : "Points"],
    [
      "/learner/reviews",
      language === "ar" ? "التقييمات" : "Reviews",
    ],
];

  const { balance } = useLearnerWallet();

  return (
    <header className="learner-header role-header">
      <div className="container learner-header-inner">
        <Link
          to="/learner"
          className="learner-brand"
          onClick={() => setOpen(false)}
        >
          <img src={logo} alt={c.brand} className="learner-logo" />
        </Link>

        <button
          type="button"
          className="learner-menu-button"
          aria-controls="learner-nav"
          aria-expanded={open}
          aria-label={open ? c.closeMenu : c.openMenu}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>

        <nav
          id="learner-nav"
          className={`learner-top-navigation${open ? " open" : ""}`}
          aria-label={c.navigation}
        >
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/learner"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `learner-top-nav-link${isActive ? " active" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={`preferences mobile-secondary${open ? " tools-open" : ""}`}>
          <button
            className="preference-button"
            onClick={toggleLanguage}
            aria-label={
              language === "ar" ? "Switch to English" : "التبديل إلى العربية"
            }
          >
            {language === "ar" ? "EN" : "عربي"}
          </button>

          <button
            className="preference-button"
            onClick={toggleTheme}
            aria-label={theme === "light" ? c.theme : c.light}
          >
            <Icon name={theme === "light" ? "moon" : "sun"} size={19} />
          </button>
        </div>

        <div className={`learner-header-actions${open ? ' tools-open' : ''}`}>
<NotificationBell role="learner" onClick={() => setOpen(false)} />
<Link className="preference-button mobile-secondary" to="/learner/settings" aria-label={language === "ar" ? "إعدادات الحساب" : "Account settings"} onClick={() => setOpen(false)}><Icon name="settings" size={18} /></Link>
          {profile.role === "both" && <Link className="learner-switch-role" to="/instructor">
            {language === "ar"
              ? "التبديل إلى المعلّم"
              : "Switch to instructor"}
            <Icon name="swap" size={16} />
          </Link>}

          <PointsBadge
            amount={balance}
            to="/learner/points"
            onClick={() => setOpen(false)}
          />

          <Link to="/learner/profile" className="learner-profile" aria-label={language === "ar" ? "تعديل الملف الشخصي" : "Edit profile"} onClick={() => setOpen(false)}>
            <span className="learner-profile-avatar">
              <Icon name="user" size={18} />
            </span>

            <span className="learner-profile-copy">
              <strong>{accountName || learnerDemo.name[language]}</strong>
              <small>
                {language === "ar" ? "متعلّم تجريبي" : "Demo learner"}
              </small>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
