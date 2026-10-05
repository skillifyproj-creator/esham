import { useState } from "react";
import { Link, useLocation } from "react-router";
import Icon from "./Icon";
import logo from "../assets/esham-logo.png";

import { usePreferences } from "../context/PreferencesContext";
export default function Header() {
  const [open, setOpen] = useState(false);

  const {
    copy: c,
    language,
    theme,
    toggleLanguage,
    toggleTheme,
  } = usePreferences();
  const location = useLocation();
  const links = [
    [c.home, "/"],
    [c.courses, "/courses"],
    [c.how, "/#how"],
    [c.why, "/#why"],
  ];

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link
            className="brand"
            to="/"
            aria-label={`${c.brand} — ${c.home}`}
            onClick={() => setOpen(false)}
          >
            <img
  src={logo}
  alt={c.brand}
  className="site-logo"
/>
          </Link>
          <button
            className="menu-toggle"
            aria-label={open ? c.closeMenu : c.openMenu}
            aria-expanded={open}
            aria-controls="main-navigation"
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
          <nav
            id="main-navigation"
            className={open ? "navigation open" : "navigation"}
            aria-label={c.navigation}
          >
            {links.map(([label, to]) => (
              <Link
                key={to}
                to={to}
                aria-current={
                  to === "/courses" && location.pathname.startsWith("/courses")
                    ? "page"
                    : to === "/" && location.pathname === "/" && !location.hash
                      ? "page"
                      : undefined
                }
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="preferences">
            <button
              className="preference-button language-button"
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
          <div className="header-actions">
            <Link className="button button-outline button-small" to="/signup" onClick={() => setOpen(false)}>{c.signup}</Link>
            <Link className="button button-small" to="/login" onClick={() => setOpen(false)}>{c.login}</Link>
          </div>
        </div>
      </header>

    </>
  );
}
