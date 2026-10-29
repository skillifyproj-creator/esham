import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { accountRequest, accountError } from '../../services/accountApi';
import { useAccountSession } from '../../context/AccountSessionContext';
import { useNotifications } from '../../context/NotificationsContext';
import { notificationMessage } from '../../services/notifications';
import Icon from '../Icon';
import Footer from '../Footer';
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
  notificationCount: _legacyNotificationCount = 0,
  scope,
}) {
  const { copy, language, theme, toggleLanguage, toggleTheme } = usePreferences();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const session = useAccountSession();
  const inbox = useNotifications();
  const notificationCount = !inbox.loading && !inbox.error ? inbox.unread : 0;
  const [signingOut, setSigningOut] = useState(false), [signOutError, setSignOutError] = useState(null);
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
          aria-label={inbox.error ? notificationMessage(inbox.error, language) : `${words.notifications}${
            notificationCount ? `, ${notificationCount}` : ''
          }`}
          title={inbox.error ? notificationMessage(inbox.error, language) : words.notifications}
          aria-busy={inbox.loading}
        >
          <Icon name="bell" size={19} />
          {notificationCount > 0 && <i className="admin-unread-dot" />}
          {inbox.error && <span title={notificationMessage(inbox.error, language)}>!</span>}
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
          <button className="admin-logout" type="button" disabled={signingOut} onClick={async () => {
            if (signingOut) return;
            setSigningOut(true); setSignOutError(null);
            try {
              await accountRequest('/auth/logout'); session.invalidate?.();
              try { localStorage.removeItem('esham-account-profile-v1'); sessionStorage.removeItem('esham-onboarding-draft-v1'); } catch { /* The server cookie is already cleared. */ }
              window.dispatchEvent(new Event('esham-profile-updated')); setOpen(false); navigate('/login');
            } catch (error) { setSignOutError(error); } finally { setSigningOut(false); }
          }}>
            <Icon name="logout" size={18} />
            <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
          </button>
          {signOutError && <p role="alert">{accountError(signOutError, language)}</p>}
        </div>
      </aside>

      <div className={`${variant}-main admin-main`}>
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
              : language === 'ar' ? 'معاينة إدارة المنصة' : 'Platform administration preview'}
          </div>
          <div className="admin-topbar-right">{utilities}</div>
        </header>
        <main className={`${variant}-content admin-content`}>
          
          <Outlet key={location.pathname} />
        </main>
        <Footer />
      </div>
    </div>
  );
}
