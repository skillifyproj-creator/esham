import useAccountProfile from '../../hooks/useAccountProfile';
import useAccountName from "../../hooks/useAccountName";
import NotificationBell from "../shared/NotificationBell";
import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router";

import { usePreferences } from "../../context/PreferencesContext";
import { learnerCopy } from "../../i18n/learnerCopy";
import { learnerDemo } from "../../data/learnerDemo";

import Icon from "../Icon";
import PointsBadge from "../shared/PointsBadge";
import logo from "../../assets/esham-logo.png";
import { useLearnerWallet } from "../../hooks/useLearnerWallet";
export default function LearnerNavigation() {
  const navigate = useNavigate();
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

  const links = [["/learner/certificates",language === "ar" ? "شهاداتي" : "Certificates"],
    ["/learner", t.dashboard],
    ["/learner/courses", t.myCourses],
    ["/learner/tasks", t.tasks],
    [
      "/learner/progress",
      language === "ar" ? "تقدّم التعلّم" : "Learning progress",
    ],
    [
      "/learner/reviews",
      language === "ar" ? "التقييمات" : "Reviews",
    ],
];

  const switchLabel = language === "ar" ? "\u0627\u0644\u062a\u0628\u062f\u064a\u0644 \u0625\u0644\u0649 \u0648\u0636\u0639 \u0627\u0644\u0645\u0639\u0644\u0645" : "Switch to instructor";
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

        <Link to="/learner/profile" className="role-mobile-profile" aria-label={language === "ar" ? "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a" : "Edit profile"} onClick={() => setOpen(false)}><span className="learner-profile-avatar"><Icon name="user" size={18} /></span></Link>
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
          <div className="role-mobile-menu-extras">
            <div className="role-mobile-account">
              <span className="learner-profile-avatar"><Icon name="user" size={18} /></span>
              <span className="learner-profile-copy">
                <strong>{accountName || learnerDemo.name[language]}</strong>
                <small>{language === "ar" ? "\u0645\u062a\u0639\u0644\u0651\u0645 \u062a\u062c\u0631\u064a\u0628\u064a" : "Demo learner"}</small>
              </span>
            </div>
            <Link to="/learner/profile" className="role-mobile-edit-profile" onClick={() => setOpen(false)}>
              {language === "ar" ? "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a" : "Edit profile"}
            </Link>
            {profile.role === "both" && (
              <button type="button" className="role-mobile-switch" aria-label={switchLabel} title={switchLabel} onClick={() => { setOpen(false); navigate("/instructor"); }}>
                <span aria-hidden="true">⇄</span>{switchLabel}
              </button>
            )}
            <div className="role-mobile-utilities">
              <NotificationBell role="learner" onClick={() => setOpen(false)} />
              <Link className="preference-button" to="/learner/settings" aria-label={language === "ar" ? "\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628" : "Account settings"} onClick={() => setOpen(false)}>
                <Icon name="settings" size={18} />
              </Link>
              <button className="preference-button" type="button" onClick={toggleLanguage} aria-label={language === "ar" ? "Switch to English" : "\u0627\u0644\u062a\u0628\u062f\u064a\u0644 \u0625\u0644\u0649 \u0627\u0644\u0639\u0631\u0628\u064a\u0629"}>
                {language === "ar" ? "EN" : "\u0639\u0631\u0628\u064a"}
              </button>
              <button className="preference-button" type="button" onClick={toggleTheme} aria-label={theme === "light" ? c.theme : c.light}>
                <Icon name={theme === "light" ? "moon" : "sun"} size={19} />
              </button>
            </div>
          </div>
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
          {profile.role === "both" && <button type="button" className="learner-switch-role desktop-role-switch" aria-label={switchLabel} title={switchLabel} onClick={() => navigate("/instructor")}>
            <span aria-hidden="true">⇄</span><span>{switchLabel}</span>
          </button>}
          {profile.role === "both" && <button type="button" className="learner-switch-role responsive-role-switch" aria-label={switchLabel} title={switchLabel} onClick={() => navigate("/instructor")}>
            <span aria-hidden="true">⇄</span><span>{switchLabel}</span>
          </button>}

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
