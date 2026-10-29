import { useNotifications } from '../context/NotificationsContext';
// Preserve the learner hook interface over the authenticated account inbox.
export function useLearnerNotifications() { return useNotifications('learner'); }
