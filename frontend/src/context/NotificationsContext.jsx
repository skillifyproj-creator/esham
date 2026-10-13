import { createContext, useContext, useEffect, useState } from 'react';
import { learnerNotifications } from '../data/learnerNotifications';
import { instructorNotifications } from '../data/instructorNotifications';

const NotificationsContext = createContext(null);
const sources = { learner: learnerNotifications, instructor: instructorNotifications };
const keys = { learner: 'esham-notification-read-v1', instructor: 'esham-instructor-notification-read-v1' };
function load(role) {
  try {
    const saved = JSON.parse(localStorage.getItem(keys[role]));
    if (Array.isArray(saved)) return [...new Set(saved.filter(id => sources[role].some(item => item.id === id)))];
  } catch { /* Default read status remains available without storage. */ }
  return sources[role].filter(item => item.read).map(item => item.id);
}
export function NotificationsProvider({ children }) {
  const [readIds, setReadIds] = useState(() => ({ learner: load('learner'), instructor: load('instructor') }));
  useEffect(() => {
    for (const role of Object.keys(sources)) {
      try { localStorage.setItem(keys[role], JSON.stringify(readIds[role])); } catch { /* State remains available for this session. */ }
    }
  }, [readIds]);
  function markRead(role, id) {
    if (!sources[role]?.some(item => item.id === id)) return;
    setReadIds(current => current[role].includes(id) ? current : { ...current, [role]: [...current[role], id] });
  }
  function markAll(role) {
    if (!sources[role]) return;
    setReadIds(current => ({ ...current, [role]: sources[role].map(item => item.id) }));
  }
  return <NotificationsContext.Provider value={{ readIds, markRead, markAll }}>{children}</NotificationsContext.Provider>;
}
export function useNotifications(role = 'learner') {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications requires NotificationsProvider');
  if (!sources[role]) throw new Error('Unknown notification role');
  const read = new Set(context.readIds[role]);
  const notifications = sources[role].map(item => ({ ...item, read: read.has(item.id) }));
  return { notifications, unread: notifications.filter(item => !item.read).length, markRead: id => context.markRead(role, id), markAll: () => context.markAll(role) };
}
