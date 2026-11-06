import { useEffect, useId, useRef } from 'react';
import Modal from '../Modal';
import { usePreferences } from '../../context/PreferencesContext';

export default function UnchangedResubmissionDialog({ onClose }) {
  const { language } = usePreferences();
  const descriptionId = useId(), description = useRef(null), acknowledge = useRef(null);
  useEffect(() => {
    const dialog = description.current.closest('dialog');
    dialog.setAttribute('aria-describedby', descriptionId);
    function trapFocus(event) {
      if (event.key !== 'Tab') return;
      const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    dialog.addEventListener('keydown', trapFocus);
    // Run after the shared Modal opens its native dialog.
    queueMicrotask(() => { if (acknowledge.current?.isConnected) acknowledge.current.focus(); });
    return () => dialog.removeEventListener('keydown', trapFocus);
  }, [descriptionId]);
  const ar = language === 'ar';
  return <Modal title={ar ? 'لم يتم إرسال الدورة للمراجعة' : 'Course Not Submitted'} onClose={onClose}>
    <p id={descriptionId} ref={description}>{ar
      ? 'لم يتم إجراء أي تعديل على الدورة منذ آخر مراجعة. يُرجى تعديل المحتوى وفقًا لملاحظات مسؤول التصنيف، ثم إعادة إرسال الدورة للمراجعة.'
      : "No changes have been made to this course since its last review. Please update the content according to the category administrator's feedback before resubmitting."}</p>
    <button ref={acknowledge} type="button" className="button" autoFocus onClick={onClose}>{ar ? 'فهمت' : 'Got it'}</button>
  </Modal>;
}
