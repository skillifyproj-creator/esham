import { useEffect, useState } from 'react';
import Modal from '../Modal';
import { usePreferences } from '../../context/PreferencesContext';
import { loadAdminCategories, createCategoryAdministrator } from '../../services/adminIntegration';

export default function CreateAdministratorDialog({ onClose, onCreated }) {
  const { language } = usePreferences();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const [categories, setCategories] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setCategories(null);
    loadAdminCategories(controller.signal).then(setCategories).catch(() => { if (!controller.signal.aborted) setError(t('تعذّر تحميل التصنيفات.', 'Could not load categories.')); });
    return () => controller.abort();
  }, [revision, language]);
  async function submit(event) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    if (data.get('password') !== data.get('confirm')) { setError(t('كلمتا المرور غير متطابقتين.', 'Passwords do not match.')); return; }
    setBusy(true); setError('');
    try {
      const created = await createCategoryAdministrator({ name: data.get('name'), email: data.get('email'), password: data.get('password'), categoryIds: data.getAll('categoryIds') });
      form.reset(); onCreated(created);
    } catch (failure) { setError(failure.message || t('تعذّر إنشاء الحساب.', 'Could not create the account.')); }
    finally { setBusy(false); }
  }
  return <Modal title={t('إضافة مدير تصنيف', 'Add Category Administrator')} onClose={event => { if (busy) event?.preventDefault?.(); else onClose(); }}>
    <form className="sa-form" onSubmit={submit}>
      <p>{t('يُنشأ الحساب بدور مدير تصنيف فقط. شارك كلمة المرور الأولية عبر قناة آمنة.', 'This creates a CategoryAdmin only. Share the initial password through a secure channel.')}</p>
      <label>{t('الاسم', 'Name')}<input name="name" required maxLength={200} autoComplete="off" disabled={busy}/></label>
      <label>{t('البريد الإلكتروني', 'Email')}<input name="email" type="email" dir="ltr" required maxLength={256} autoComplete="off" disabled={busy}/></label>
      <label>{t('كلمة المرور الأولية', 'Initial password')}<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" disabled={busy}/></label>
      <label>{t('تأكيد كلمة المرور', 'Confirm password')}<input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" disabled={busy}/></label>
      <p>{t('٨ أحرف على الأقل وتحتوي على رقم؛ تُطبّق سياسة Identity على الخادم.', 'At least 8 characters including a digit; the server enforces the Identity password policy.')}</p>
      {categories === null ? <p role="status">{t('جارٍ تحميل التصنيفات…', 'Loading categories…')}</p> : <fieldset disabled={busy}><legend>{t('التصنيفات المعيّنة', 'Assigned categories')}</legend>{categories.filter(c => c.isActive).map(c => <label className="sa-check" key={c.id}><input type="checkbox" name="categoryIds" value={c.id}/>{language === 'ar' ? c.nameAr : c.nameEn}</label>)}<p>{t('يمكن الإسناد لاحقًا من صفحة التصنيفات. الحساب دون إسناد لا يستطيع مراجعة أي تصنيف.', 'Categories can also be assigned later. An unassigned account cannot moderate any category.')}</p></fieldset>}
      {error && <p role="alert">{error}</p>}{categories === null && error && <button type="button" className="sa-button" onClick={() => setRevision(v => v + 1)}>{t('إعادة المحاولة', 'Retry')}</button>}
      <div className="sa-form-actions"><button type="button" className="sa-button" disabled={busy} onClick={onClose}>{t('إلغاء', 'Cancel')}</button><button className="sa-button primary" disabled={busy || categories === null}>{busy ? t('جارٍ الإنشاء…', 'Creating…') : t('إنشاء مدير التصنيف', 'Create CategoryAdmin')}</button></div>
    </form>
  </Modal>;
}
