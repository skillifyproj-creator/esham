import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import Icon from '../Icon';
import { usePreferences } from '../../context/PreferencesContext';
import { adminCopy, translateAdminText } from '../../i18n/adminCopy';
import logo from '../../assets/esham-logo.png';
import '../../styles/admin-workspace.css';

export default function AdminWorkspace({
  variant,
  links,
  profileName,
  profileRole,
  notificationTo,
  notificationCount = 0,
  scope,
}) {
  const { copy, language, theme, toggleLanguage, toggleTheme } = usePreferences();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const words = adminCopy[language];
  const active =
    [...links]
      .reverse()
      .find(
        (link) =>
          location.pathname === link.to ||
          (!link.end && location.pathname.startsWith(`${link.to}/`)),
      ) || links[0];
  const roleLabel = translateAdminText(profileRole, language);
  const themeLabel =
    theme === 'light' ? words.darkMode : words.lightMode;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const utilities = (
    <div className="admin-utilities">
      {notificationTo && (
        <Link
          className="admin-utility admin-notification-link"
          to={notificationTo}
          aria-label={`${words.notifications}${
            notificationCount ? `, ${notificationCount}` : ''
          }`}
          title={words.notifications}
        >
          <Icon name="bell" size={19} />
          {notificationCount > 0 && <i className="admin-unread-dot" />}
        </Link>
      )}
      <button
        type="button"
        className="admin-utility"
        onClick={toggleTheme}
        aria-label={themeLabel}
        title={themeLabel}
      >
        <Icon name={theme === 'light' ? 'moon' : 'sun'} size={19} />
        <span>{themeLabel}</span>
      </button>
      <button
        type="button"
        className="admin-utility admin-language-button"
        onClick={toggleLanguage}
        aria-label={
          language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'
        }
        title={words.language}
      >
        {language === 'ar' ? 'EN' : 'عربي'}
      </button>
    </div>
  );

  return (
    <div
      className={`admin-workspace ${variant}-shell${open ? ' drawer-open' : ''}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {open && (
        <button
          className="admin-drawer-backdrop"
          type="button"
          aria-label={copy.closeMenu}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`${variant}-sidebar admin-sidebar${open ? ' is-open' : ''}`}
        id={`${variant}-sidebar`}
        aria-label={copy.navigation}
      >
        <div className="admin-sidebar-top">
          <Link
            to={links[0].to}
            className="admin-brand"
            onClick={() => setOpen(false)}
          >
            <img src={logo} alt={words.appName} />
            <span>
              {words.appName}
              <small>
                {variant === 'sa' ? words.superAdmin : words.categoryAdmin}
              </small>
            </span>
          </Link>
          <button
            className="admin-drawer-close"
            type="button"
            onClick={() => setOpen(false)}
            aria-label={copy.closeMenu}
            title={copy.closeMenu}
          >
            <Icon name="close" size={21} />
          </button>
        </div>

        <nav className="admin-nav" aria-label={copy.navigation}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? ' active' : ''}`
              }
            >
              <Icon name={link.icon} size={19} />
              <span>{words[link.label] || link.label}</span>
              {link.label === 'notifications' && notificationCount > 0 && (
                <b className="admin-nav-count">{notificationCount}</b>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-identity">
            <span className="admin-identity-avatar">
              <Icon name="user" size={18} />
            </span>
            <span>
              <strong>{translateAdminText(profileName, language)}</strong>
              <small>{roleLabel}</small>
            </span>
          </div>
          <Link className="admin-logout" to="/login" onClick={() => setOpen(false)}>
            <Icon name="logout" size={18} />
            <span>{words.logout}</span>
          </Link>
        </div>
      </aside>

      <main className={`${variant}-main admin-main`}>
        <header className={`${variant}-topbar admin-topbar`}>
          <button
            className="admin-menu-button"
            type="button"
            aria-expanded={open}
            aria-controls={`${variant}-sidebar`}
            aria-label={open ? copy.closeMenu : copy.openMenu}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? 'close' : 'menu'} size={22} />
          </button>
          <Link to={links[0].to} className="admin-mobile-brand">
            <img src={logo} alt={words.appName} />
            <span>{words[active.label] || active.label}</span>
          </Link>
          <div className="admin-topbar-context">
            <span className="admin-live-dot" />
            {scope
              ? translateAdminText(scope, language)
              : words.systemOk}
          </div>
          <div className="admin-topbar-right">{utilities}</div>
        </header>
        <div className={`${variant}-content admin-content`}>
          <Outlet key={location.pathname} />
        </div>
      </main>
    </div>
  );
}
