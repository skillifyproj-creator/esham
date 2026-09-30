import { useState } from "react";
import { Link, useLocation } from "react-router";
import Icon from "./Icon";
import Modal from "./Modal";
import { usePreferences } from "../context/PreferencesContext";
export default function Header({ onAccount }) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(null);
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
  const showAccount = (mode) => {
    setOpen(false);
    if (onAccount) onAccount(mode);
    else setAccount(mode);
  };
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
            <span className="brand-symbol">
              <Icon name="leaf" />
            </span>
            <span>
              {c.brand}
              <small>{c.tagline}</small>
            </span>
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
            <button
              className="button button-outline button-small"
              onClick={() => showAccount("signup")}
            >
              {c.signup}
            </button>
            <button
              className="button button-small"
              onClick={() => showAccount("login")}
            >
              {c.login}
            </button>
          </div>
        </div>
      </header>
      {account && (
        <Modal title={c[account]} onClose={() => setAccount(null)}>
          <p>{c.accountNote}</p>
          <button className="button" onClick={() => setAccount(null)}>
            {c.okay}
          </button>
        </Modal>
      )}
    </>
  );
}
