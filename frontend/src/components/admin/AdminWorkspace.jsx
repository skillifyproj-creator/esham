import ThemeLogo from '../ThemeLogo';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { accountRequest, accountError } from '../../services/accountApi';
import { useAccountSession } from '../../context/AccountSessionContext';
import { useNotifications } from '../../context/NotificationsContext';
import { notificationMessage } from '../../services/notifications';
import Icon from '../Icon';
import { usePreferences } from '../../context/PreferencesContext';
import { adminCopy, translateAdminText } from '../../i18n/adminCopy';
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches);
  const sidebar = useRef(null), menu = useRef(null);
  const collapseLabel = language === 'ar' ? (collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية') : (collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const update = () => { setMobile(query.matches); setOpen(false); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
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
    if (!open || !mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector('button, a')?.focus();
    const keyboard = event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key !== 'Tab') return;
      const items = [...sidebar.current.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keyboard); menu.current?.focus(); };
  }, [open, mobile]);

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
      className={`admin-workspace ${variant}-shell${open ? ' drawer-open' : ''}${collapsed ? ' sidebar-collapsed' : ''}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <a className="admin-skip-link" href="#admin-content">{language === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
      {open && mobile && (
        <button
          className="admin-drawer-backdrop"
          type="button"
          aria-label={copy.closeMenu}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebar}
        inert={mobile && !open}
        role={mobile && open ? 'dialog' : undefined}
        aria-modal={mobile && open ? true : undefined}
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
            <ThemeLogo alt={words.appName} />
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
              aria-label={words[link.label] || link.label}
              title={collapsed && !mobile ? words[link.label] || link.label : undefined}
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
          <button className="admin-logout" aria-label={language === 'ar' ? 'تسجيل الخروج' : 'Sign out'} title={collapsed ? (language === 'ar' ? 'تسجيل الخروج' : 'Sign out') : undefined} type="button" disabled={signingOut} onClick={async () => {
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

      <div className={`${variant}-main admin-main`} inert={mobile && open}>
        <header className={`${variant}-topbar admin-topbar`}>
          <button
            ref={menu}
            className="admin-menu-button"
            type="button"
            aria-expanded={open}
            aria-controls={`${variant}-sidebar`}
            aria-label={open ? copy.closeMenu : copy.openMenu}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? 'close' : 'menu'} size={22} />
          </button>
          <button className="admin-collapse-button" type="button" onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed} aria-controls={`${variant}-sidebar`} aria-label={collapseLabel} title={collapseLabel}><Icon name="menu" size={20}/></button>
          <Link to={links[0].to} className="admin-mobile-brand">
            <ThemeLogo alt={words.appName} />
            <span>{words[active.label] || active.label}</span>
          </Link>
          <div className="admin-topbar-context">
            <span className="admin-live-dot" />
            {scope
              ? translateAdminText(scope, language)
              : language === 'ar' ? 'إدارة المنصة' : 'Platform administration'}
          </div>
          <div className="admin-topbar-right">{utilities}</div>
        </header>
        <main id="admin-content" tabIndex={-1} className={`${variant}-content admin-content`}>

          <Outlet key={location.pathname} />
        </main>
      </div>
    </div>
  );
}
