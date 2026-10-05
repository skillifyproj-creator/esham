import { useLearnerWallet } from '../../hooks/useLearnerWallet';
import useAccountProfile from '../../hooks/useAccountProfile';
import useAccountName from "../../hooks/useAccountName";
import NotificationBell from "../shared/NotificationBell";
import { useState } from "react";
import { Link, NavLink } from "react-router";
import Icon from "../../components/Icon";
import PointsBadge from "../shared/PointsBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { instructorDemo } from "../../data/instructorDemo";
import instructorCopy from "../../i18n/instructorCopy";
import logo from "../../assets/esham-logo.png";

const instructorLinks = [
  { key: "dashboard", to: "/instructor", end: true },
  { key: "courses", to: "/instructor/courses", end: true },
  { key: "createCourse", to: "/instructor/courses/new" },
  { key: "performance", to: "/instructor/performance" },
  { key: "feedback", to: "/instructor/feedback" },
];

export default function InstructorNavigation() {
  const accountName = useAccountName();
  const { balance } = useLearnerWallet();
  const profile = useAccountProfile();
  const [open, setOpen] = useState(false);

  const {
    language,
    theme,
    toggleLanguage,
    toggleTheme,
  } = usePreferences();

  const c = instructorCopy[language];
  const { instructor } = instructorDemo;
  const isEnglish = language === "en";
  const navigationCopy = {
    dashboard: c.dashboard,
    courses: c.myCourses,
    createCourse: c.createCourse,
    performance: c.performance,
    feedback: c.feedback,
  };

  return (
    <header className="instructor-header role-header">
      <div className="container learner-header-inner">

        {/* Logo */}
        <Link
          to="/instructor"
          className="instructor-brand"
          onClick={() => setOpen(false)}
          aria-label={c.brandName}
        >
          <img
            src={logo}
            alt={c.brandName}
            className="instructor-logo"
          />
        </Link>

        {/* Mobile menu */}
        <button
          type="button"
          className="instructor-menu-button"
          aria-controls="instructor-nav"
          onClick={() => setOpen((value) => !value)}
          aria-label={
            open
              ? c.closeMenu
              : c.openMenu
          }
          aria-expanded={open}
        >
          <Icon
            name={open ? "close" : "menu"}
            size={23}
          />
        </button>

        {/* Navigation */}
        <nav
          id="instructor-nav"
          aria-label={
            language === "ar" ? "تنقل المعلّم" : "Instructor navigation"
          }
          className={
            open
              ? "instructor-navigation open"
              : "instructor-navigation"
          }
        >
          {instructorLinks.map((link) => (
            <NavLink
              key={link.key}
              to={link.to}
              end={link.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                isActive
                  ? "instructor-nav-link active"
                  : "instructor-nav-link"
              }
            >
              {navigationCopy[link.key]}
            </NavLink>
          ))}
        </nav>

        {/* Right actions */}
        <div className={`instructor-header-actions${open ? ' tools-open' : ''}`}>
<NotificationBell role="instructor" onClick={() => setOpen(false)} />
<Link className="preference-button mobile-secondary" to="/instructor/settings" aria-label={language === "ar" ? "إعدادات الحساب" : "Account settings"} onClick={() => setOpen(false)}><Icon name="settings" size={18} /></Link>

          {/* Language */}
          <button
            type="button"
            className="instructor-preference-button mobile-secondary"
            onClick={toggleLanguage}
            aria-label={
              isEnglish
                ? c.switchToArabic
                : c.switchToEnglish
            }
          >
            {c.languageSwitchLabel}
          </button>

          {/* Theme */}
          <button
            type="button"
            className="instructor-preference-button mobile-secondary"
            onClick={toggleTheme}
            aria-label={
              theme === "light"
                ? isEnglish
                  ? c.switchToDarkMode
                  : c.switchToDarkMode
                : isEnglish
                  ? c.switchToLightMode
                  : c.switchToLightMode
            }
          >
            <Icon
              name={theme === "light" ? "moon" : "sun"}
              size={18}
            />
          </button>

          {/* Switch role */}
          {profile.role === "both" && <Link
            to="/learner"
            className="instructor-switch-role"
            onClick={() => setOpen(false)}
          >
            <Icon name="swap" size={17} />
            <span>{language === "ar" ? "التبديل إلى المتعلّم" : "Switch to learner"}</span>
          </Link>}

          {/* Points */}
          <PointsBadge amount={balance} />

          {/* Profile */}
          <Link
            to="/instructor/profile"
            className="instructor-profile"
            onClick={() => setOpen(false)}
          >
            <span className="instructor-profile-avatar">
              <Icon name="user" size={18} />
            </span>

            <span className="instructor-profile-copy">
              <strong>
                {accountName || instructor.name[language]}
              </strong>

              <small>
                {instructor.role[language]}
              </small>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
