import { useState } from "react";
import Icon from "./Icon";
import { usePreferences } from "../context/PreferencesContext";
export default function Header({ onAccount }) {
  const [open, setOpen] = useState(false);
  const {
    copy: c,
    language,
    theme,
    toggleLanguage,
    toggleTheme,
  } = usePreferences();
  const links = [
    [c.home, "#home"],
    [c.courses, "#courses"],
    [c.how, "#how"],
    [c.why, "#why"],
  ];
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" href="#home" aria-label={`${c.brand} — ${c.home}`}>
          <span className="brand-symbol">
            <Icon name="leaf" />
          </span>
          <span>
            {c.brand}
            <small>{c.tagline}</small>
          </span>
        </a>
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
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
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
          <button
            className="button button-outline button-small"
            onClick={() => onAccount("signup")}
          >
            {c.signup}
          </button>
          <button
            className="button button-small"
            onClick={() => onAccount("login")}
          >
            {c.login}
          </button>
        </div>
      </div>
    </header>
  );
}
