import { NavLink } from 'react-router';
import { useNotifications } from '../../context/NotificationsContext';
import { usePreferences } from '../../context/PreferencesContext';
import { notificationMessage } from '../../services/notifications';
import '../../styles/notifications.css';

export default function NotificationBell({ role, onClick }) {
  const { unread, loading, error } = useNotifications(role);
  const { language } = usePreferences();
  const title = language === 'ar' ? 'الإشعارات' : 'Notifications';
  const label = error ? notificationMessage(error, language) : loading ? (language === 'ar' ? 'جارٍ تحميل الإشعارات…' : 'Loading notifications…') : unread ? `${title}، ${unread} ${language === 'ar' ? 'غير مقروءة' : 'unread'}` : title;
  return <NavLink to={`/${role}/notifications`} onClick={onClick} className={({ isActive }) => `notification-bell${isActive ? ' active' : ''}`} aria-busy={loading} aria-label={label} title={label}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1" /></svg>
    {!loading && !error && unread > 0 && <span className="notification-bell-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    {error && <span className="notification-bell-count" aria-hidden="true">!</span>}
  </NavLink>;
}
