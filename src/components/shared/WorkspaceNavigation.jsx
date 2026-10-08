import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { accountRequest, accountError, apiBase } from '../../services/accountApi';
import { usePreferences } from '../../context/PreferencesContext';
import useAccountProfile from '../../hooks/useAccountProfile';
import useAccountName from '../../hooks/useAccountName';
import { useLearnerWallet } from '../../hooks/useLearnerWallet';
import NotificationBell from './NotificationBell';
import PointsBadge from './PointsBadge';
import Icon from '../Icon';
import logo from '../../assets/esham-logo.png';
import '../../styles/workspace-navigation.css';

export default function WorkspaceNavigation({ role, name, links, activityLabel }) {
  const { language, theme, toggleLanguage, toggleTheme } = usePreferences();
  const profile = useAccountProfile();
  const accountName = useAccountName();
  const { balance } = useLearnerWallet();
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut,setSigningOut] = useState(false), [sessionError,setSessionError] = useState('');
  const [open, setOpen] = useState(null);
  const header = useRef(null);
  const trigger = useRef(null);
  const id = useId();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const base = `/${role}`;
  const learner = role === 'learner';
  const displayName = accountName || name;
  const roleLabel = learner ? t('متعلّم', 'Learner') : t('مدرّب', 'Instructor');
  const switchLabel = learner ? t('التبديل إلى وضع المعلّم', 'Switch to instructor') : t('التبديل إلى وضع المتعلّم', 'Switch to learner mode');
  const close = () => setOpen(null);
  function toggle(menu, event) {
    trigger.current = event.currentTarget;
    setOpen(value => value === menu ? null : menu);
  }
  useEffect(close, [location.pathname, location.hash]);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!header.current?.contains(event.target)) close(); };
    const escape = event => { if (event.key === 'Escape') { close(); trigger.current?.focus(); } };
    const focusOutside = event => { if (!header.current?.contains(event.target)) close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    document.addEventListener('focusin', focusOutside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('focusin', focusOutside);
    };
  }, [open]);
  const renderLink = link => <NavLink key={link.to} to={link.to} end={link.end} onClick={close} className={({ isActive }) => `workspace-nav-link${isActive ? ' active' : ''}`}><Icon name={link.icon} size={18}/><span>{link.label}</span></NavLink>;
  const activityActive = links.slice(2).some(link => location.pathname.startsWith(link.to));

  return <header className="workspace-header" ref={header} dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="workspace-header-inner container">
      <Link className="workspace-brand" to={base} onClick={close}><img src={logo} alt={t('إسهام', 'Esham')}/></Link>
      <nav className="workspace-primary" aria-label={t('التنقل الرئيسي', 'Main navigation')}>
        {links.slice(0, 2).map(renderLink)}
        <div className="workspace-menu-anchor">
          <button type="button" className={`workspace-menu-trigger${activityActive ? ' active' : ''}`} aria-expanded={open === 'activity'} aria-controls={`${id}-activity`} onClick={event => toggle('activity', event)}>{activityLabel}<Icon name="chevron-down" size={16}/></button>
          <div className="workspace-dropdown" id={`${id}-activity`} hidden={open !== 'activity'}>{links.slice(2).map(renderLink)}</div>
        </div>
      </nav>
      <div className="workspace-tools">
        <NotificationBell role={role} onClick={close}/>
        <div className="workspace-menu-anchor workspace-account-anchor">
          <button type="button" className="workspace-account-trigger" aria-label={t('قائمة الحساب', 'Account menu')} aria-expanded={open === 'account'} aria-controls={`${id}-account`} onClick={event => toggle('account', event)}>
            <span className="workspace-avatar">{profile.avatar?.startsWith('data:image/jpeg;base64,') ? <img src={profile.avatar} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}}/> : <Icon name="user" size={20}/>}</span><span className="workspace-trigger-name">{displayName}</span><Icon name="chevron-down" size={15}/>
          </button>
          <div className="workspace-dropdown workspace-account-dropdown" id={`${id}-account`} hidden={open !== 'account'}>
            <div className="workspace-account-heading"><strong>{displayName}</strong><small>{profile.role === 'both' ? t('هايبرد', 'Hybrid') + ' · ' + roleLabel : roleLabel}</small></div>
            <div className="workspace-account-balance"><span>{t('رصيد النقاط', 'Points balance')}</span><PointsBadge amount={balance} to={`${base}/points`} onClick={close}/></div>
            <Link className="workspace-nav-link" to={`${base}/profile`} onClick={close}><Icon name="user" size={18}/>{t('الملف الشخصي', 'Profile')}</Link>
            <Link className="workspace-nav-link" to={`${base}/settings`} onClick={close}><Icon name="settings" size={18}/>{t('إعدادات الحساب', 'Account settings')}</Link>
            <Link className="workspace-nav-link" to={`${base}/settings#account-type`} onClick={close}><Icon name="users" size={18}/>{t('نوع الحساب', 'Account type')}</Link>
            {profile.role === 'both' && <Link className="workspace-nav-link workspace-switch" to={learner ? '/instructor' : '/learner'} onClick={close}><Icon name="swap" size={18}/>{switchLabel}</Link>}
            <div className="workspace-preferences">
              <button type="button" onClick={toggleLanguage}><span aria-hidden="true">ع / EN</span>{t('English', 'العربية')}</button>
              <button type="button" onClick={toggleTheme}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={18}/>{theme === 'light' ? t('الوضع الداكن', 'Dark mode') : t('الوضع الفاتح', 'Light mode')}</button>
            </div>
            <button className="workspace-nav-link" type="button" disabled={signingOut} onClick={async()=>{if(signingOut)return;setSigningOut(true);setSessionError('');try{if(apiBase)await accountRequest('/auth/logout');localStorage.removeItem('esham-account-profile-v1');sessionStorage.removeItem('esham-onboarding-draft-v1');window.dispatchEvent(new Event('esham-profile-updated'));close();navigate('/login');}catch(error){setSessionError(accountError(error,language));}finally{setSigningOut(false);}}}>{t('تسجيل الخروج','Sign out')}</button>
            {sessionError&&<p role="alert">{sessionError}</p>}
          </div>
        </div>
        <button type="button" className="workspace-mobile-toggle" aria-label={open === 'navigation' ? t('إغلاق القائمة', 'Close navigation') : t('فتح القائمة', 'Open navigation')} aria-expanded={open === 'navigation'} aria-controls={`${id}-navigation`} onClick={event => toggle('navigation', event)}><Icon name={open === 'navigation' ? 'close' : 'menu'} size={22}/></button>
      </div>
      <nav id={`${id}-navigation`} className="workspace-dropdown workspace-mobile-navigation" hidden={open !== 'navigation'} aria-label={t('قائمة التنقل', 'Navigation menu')}>
        {links.slice(0, 2).map(renderLink)}<p className="workspace-group-label">{activityLabel}</p>{links.slice(2).map(renderLink)}
      </nav>
    </div>
  </header>;
}
