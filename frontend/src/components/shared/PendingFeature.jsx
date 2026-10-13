import { useState } from 'react';
import Modal from '../Modal';
import { usePreferences } from '../../context/PreferencesContext';
export default function PendingFeature({ children, className, reason, ...props }) {
  const { language } = usePreferences();
  const [open, setOpen] = useState(false);
  const ar = language === 'ar';
  return <><button type="button" className={className} {...props} onClick={() => setOpen(true)}>{children}</button>{open && <Modal title={ar ? 'هذه الميزة قيد الاستكمال' : 'This feature is being completed'} onClose={() => setOpen(false)}><p>{reason || (ar ? 'هذه الميزة غير متاحة في النسخة الحالية. سيتم تفعيلها بعد استكمال صفحتها وربطها بالخدمة المناسبة.' : 'This feature is unavailable in the current version. It will be enabled once its page and service are ready.')}</p><button className="button" type="button" onClick={() => setOpen(false)}>{ar ? 'حسنًا' : 'Got it'}</button></Modal>}</>;
}
