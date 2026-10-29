import { useState } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { notificationGroup } from '../../data/learnerNotifications';
import { notificationsCopy } from '../../i18n/notificationsCopy';
import { notificationMessage, notificationText } from '../../services/notifications';
import Icon from '../../components/Icon';
import '../../styles/notifications.css';

export default function NotificationsPage({ role = 'learner' }) {
  const { language } = usePreferences();
  const inbox = useNotifications(role);
  const [notice, setNotice] = useState(null);
  const t = notificationsCopy[language], text = (ar, en) => language === 'ar' ? ar : en;
  const filter = inbox.isRead === null ? 'all' : inbox.isRead ? 'read' : 'unread';
  const busy = inbox.loading || inbox.mutating;
  const ignoreFailure = action => action().catch(() => {});
  async function markAll() {
    const accountId = inbox.accountId; setNotice(null);
    try { await inbox.markAll(); setNotice({ accountId, message: t.marked }); } catch { /* No fake success. */ }
  }
  return <main className="ln-page"><div className="container">
    <header className="ln-heading"><h1>{t.title}</h1><p>{text('إشعارات حسابك وتحديثاته في إسهام.', 'Notifications and updates for your Esham account.')}</p></header>
    <div className="ln-toolbar"><div className="ln-filters" role="group" aria-label={t.filters}>
      {['all', 'unread', 'read'].map(value => <button key={value} disabled={busy || inbox.status !== 'authenticated'} className={filter === value ? 'ln-filter active' : 'ln-filter'} aria-pressed={filter === value} onClick={() => { setNotice(null); ignoreFailure(() => inbox.setFilter(value)); }}>{value === 'read' ? text('المقروءة', 'Read') : t[value]}{value === 'unread' && <span>{inbox.unread}</span>}</button>)}
    </div><button className="button button-outline" disabled={busy || Boolean(inbox.error) || inbox.unread === 0 || inbox.status !== 'authenticated'} onClick={markAll}>{t.markAll}</button></div>
    <p role="status" className="ln-status">{notice && notice.accountId === inbox.accountId ? notice.message : ''}</p>
    <NotificationStatus inbox={inbox}/>
    {!inbox.loading && !inbox.error && inbox.status === 'authenticated' && <>
      <NotificationGroups items={inbox.notifications} busy={busy} onRead={id => { setNotice(null); ignoreFailure(() => inbox.markRead(id)); }}/>
      {inbox.notifications.length === 0 && <section className="ln-empty"><Icon name="info" size={36}/><h2>{filter === 'all' ? t.empty : t.emptyFilter}</h2><p>{t.emptyHint}</p>{filter !== 'all' && <button className="button button-outline" onClick={() => ignoreFailure(() => inbox.setFilter('all'))}>{t.clear}</button>}</section>}
      <div className="ln-toolbar"><button className="button button-outline" disabled={busy || inbox.page <= 1} onClick={() => ignoreFailure(() => inbox.setPage(inbox.page - 1))}>{text('السابق', 'Previous')}</button><span>{inbox.page} · {inbox.totalCount} {text('إشعار', 'notifications')}</span><button className="button button-outline" disabled={busy || inbox.page * inbox.pageSize >= inbox.totalCount} onClick={() => ignoreFailure(() => inbox.setPage(inbox.page + 1))}>{text('التالي', 'Next')}</button></div>
    </>}
    <button className="button button-outline" disabled={busy} onClick={() => { setNotice(null); ignoreFailure(() => inbox.refresh()); }}>{text('تحديث الإشعارات', 'Refresh notifications')}</button>
  </div></main>;
}

export function NotificationStatus({ inbox }) {
  const { language } = usePreferences();
  if (inbox.loading) return <p role="status" className="ln-status">{language === 'ar' ? 'جارٍ تحميل الإشعارات…' : 'Loading notifications…'}</p>;
  if (inbox.error) return <div role="alert" className="ln-empty"><p>{notificationMessage(inbox.error, language)}</p><button className="button button-outline" disabled={inbox.mutating} onClick={() => inbox.refresh().catch(() => {})}>{language === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button>{inbox.error.status === 401 && <Link to="/login">{language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}</Link>}</div>;
  if (inbox.status !== 'authenticated') return <p role="status"><Link to="/login">{language === 'ar' ? 'سجّل الدخول لعرض إشعارات حسابك.' : 'Sign in to view your account notifications.'}</Link></p>;
  return null;
}

export function NotificationGroups({ items, busy, onRead }) {
  const { language } = usePreferences(); const t = notificationsCopy[language]; const now = new Date();
  return ['today', 'yesterday', 'week', 'older'].map(group => {
    const grouped = items.filter(item => notificationGroup(item.createdAt, now) === group);
    return grouped.length ? <section className="ln-group" key={group}><h2>{t[group]}</h2><div className="ln-list">{grouped.map(item => {
      const content = notificationText(item, language);
      return <article key={item.id} className={`ln-card${item.isRead ? '' : ' unread'}`}><span className="ln-icon"><Icon name="info"/></span><div className="ln-content"><div className="ln-title"><h3>{content.title}</h3>{!item.isRead && <span className="ln-badge">{t.new}</span>}</div><p>{content.body}</p><div className="ln-actions">{!item.isRead && <button className="ln-read-button" disabled={busy} onClick={() => onRead(item.id)}>{t.markRead}</button>}</div></div><time dateTime={item.createdAt}>{new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></article>;
    })}</div></section> : null;
  });
}
