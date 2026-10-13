import { useNotifications } from '../context/NotificationsContext';
// Preserve the existing learner hook interface and saved read status.
export function useLearnerNotifications() { return useNotifications('learner'); }
