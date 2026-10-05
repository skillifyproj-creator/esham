import { NavLink } from 'react-router';
import { useNotifications } from '../../context/NotificationsContext';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/notifications.css';

export default function NotificationBell({ role, onClick }) {
  const { unread } = useNotifications(role);
  const { language } = usePreferences();
  const title = language === 'ar' ? 'الإشعارات' : 'Notifications';
  const label = unread ? `${title}، ${unread} ${language === 'ar' ? 'غير مقروءة' : 'unread'}` : title;
  return <NavLink to={`/${role}/notifications`} onClick={onClick} className={({ isActive }) => `notification-bell${isActive ? ' active' : ''}`} aria-label={label} title={label}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1" /></svg>
    {unread > 0 && <span className="notification-bell-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
  </NavLink>;
}
