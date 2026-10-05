import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import ProfileSetup, { validUsername } from '../auth/ProfileSetup';
import InterestsSetup from '../auth/InterestsSetup';
import { passwordRequirements } from '../auth/passwordValidation';
import Modal from '../../components/Modal';
import '../../styles/account.css';
const key = 'esham-account-profile-v1';
function readProfile() {
  const empty = { role: 'both', name: '', username: '', bio: '', interests: [], teachingAreas: [], customSkills: [], goal: null };
  try {
    const value = JSON.parse(localStorage.getItem(key) || sessionStorage.getItem('esham-onboarding-draft-v1') || '{}');
    if (['learner', 'instructor', 'both'].includes(value.role)) empty.role = value.role;
    for (const field of ['name', 'username', 'bio']) if (typeof value[field] === 'string') empty[field] = value[field].slice(0, field === 'bio' ? 500 : 80);
    for (const field of ['interests', 'teachingAreas']) if (Array.isArray(value[field])) empty[field] = [...new Set(value[field].filter(id => Number.isInteger(id) && id >= 0 && id < 6))];
    if (Array.isArray(value.customSkills)) empty.customSkills = value.customSkills.filter(item => typeof item === 'string').slice(0, 10).map(item => item.slice(0, 80));
    return empty;
  } catch { return empty; }
}
export default function AccountPage({ role, section }) {
  const { language, theme, setLanguage, setTheme } = usePreferences();
  const ar = language === 'ar';
  const text = (a, e) => ar ? a : e;
  const [saved, setSaved] = useState(readProfile);
  const [draft, setDraft] = useState(saved);
  const [photo, setPhoto] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [visible, setVisible] = useState({});
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => { setStatus(''); setError(''); setPasswords({ current: '', next: '', confirm: '' }); setVisible({}); }, [section]);
  const update = change => { setDraft(value => ({ ...value, ...change })); setStatus(''); setError(''); };
  function save(event) {
    event.preventDefault();
    if (draft.name.trim().length < 2) { setError('nameError'); return; }
    if (!validUsername(draft.username)) { setError('usernameError'); return; }
    const value = { ...draft, name: draft.name.trim(), bio: draft.bio.trim() };
    try { localStorage.setItem(key, JSON.stringify(value)); setSaved(value); window.dispatchEvent(new Event('esham-profile-updated')); setStatus(text('تم حفظ بيانات الملف على هذا الجهاز. الصورة معاينة مؤقتة.', 'Profile saved on this device. The photo is a temporary preview.')); }
    catch { setStatus(text('تعذّر الحفظ على الجهاز. احتفظنا بالتعديلات في الصفحة.', 'Device storage is unavailable. Your edits remain on this page.')); }
  }
  function checkPassword(event) {
    event.preventDefault();
    const rules = passwordRequirements(passwords.next);
    if (!passwords.current) { setError(text('أدخل كلمة المرور الحالية.', 'Enter your current password.')); return; }
    if (!Object.values(rules).every(Boolean)) { setError(text('استخدم 8 أحرف على الأقل مع حرف ورقم.', 'Use at least 8 characters, including a letter and number.')); return; }
    if (passwords.current === passwords.next) { setError(text('اختر كلمة مرور مختلفة عن الحالية.', 'Choose a password different from the current one.')); return; }
    if (passwords.next !== passwords.confirm) { setError(text('كلمتا المرور غير متطابقتين.', 'The new passwords do not match.')); return; }
    setError(''); setPasswords({ current: '', next: '', confirm: '' });
    setStatus(text('البيانات تستوفي متطلبات النموذج. لم تتغير كلمة المرور؛ التحقق من الحالية والتحديث يحتاجان خدمة الحسابات.', 'The form requirements are met. Your password has not changed; verification and updates require the account service.'));
  }
  return <main className="account-page container">
    <header className="account-heading"><p>{text('حساب واحد · تعلّم وشارك', 'One account · Learn and share')}</p><h1>{section === 'profile' ? text('تعديل الملف الشخصي', 'Edit profile') : section === 'security' ? text('تغيير كلمة المرور', 'Change password') : text('إعدادات الحساب', 'Account settings')}</h1><p>{text('إدارة معلوماتك وتفضيلاتك من مكان واحد.', 'Manage your information and preferences in one place.')}</p></header>
    <div className="account-layout"><nav className="account-tabs" aria-label={text('إدارة الحساب', 'Account navigation')}>
      <NavLink to={`/${role}/profile`}>{text('الملف الشخصي', 'Profile')}</NavLink><NavLink end to={`/${role}/settings`}>{text('الإعدادات', 'Settings')}</NavLink><NavLink to={`/${role}/settings/security`}>{text('الأمان', 'Security')}</NavLink><Link to={`/${role}/notifications`}>{text('الإشعارات', 'Notifications')}</Link>
    </nav><div className="account-content">
    {section === 'profile' ? <form onSubmit={save} noValidate><ProfileSetup draft={draft} update={update} error={error} photo={photo} setPhoto={setPhoto} /><details className="account-panel"><summary>{text('اهتمامات التعلّم ومجالات التعليم', 'Learning interests and teaching areas')}</summary><InterestsSetup draft={draft} update={update} /><InterestsSetup draft={draft} update={update} mode="teaching" /></details><div className="account-actions"><button className="button" type="submit">{text('حفظ التغييرات', 'Save changes')}</button><button type="button" className="button secondary" onClick={() => { setDraft(saved); setPhoto(''); setError(''); setStatus(''); }}>{text('إلغاء التعديلات', 'Discard edits')}</button></div></form> : section === 'security' ? <form className="account-panel account-password" onSubmit={checkPassword} noValidate>
      <p className="account-note">{text('هذه واجهة تجريبية. لا يتم تخزين كلمات المرور أو إرسالها، والتغيير الفعلي يحتاج ربط خدمة الحسابات.', 'This is a demo form. Passwords are neither stored nor sent; actual changes require the account service.')}</p>
      {['current', 'next', 'confirm'].map((field, index) => <div className="account-field" key={field}><label htmlFor={`password-${field}`}>{[text('كلمة المرور الحالية', 'Current password'), text('كلمة المرور الجديدة', 'New password'), text('تأكيد كلمة المرور الجديدة', 'Confirm new password')][index]}</label><div className="account-password-input"><input id={`password-${field}`} type={visible[field] ? 'text' : 'password'} autoComplete={field === 'current' ? 'current-password' : 'new-password'} value={passwords[field]} required onChange={event => { setPasswords(value => ({ ...value, [field]: event.target.value })); setError(''); setStatus(''); }} /><button type="button" aria-pressed={!!visible[field]} aria-label={text('إظهار أو إخفاء', 'Show or hide') + ' ' + [text('كلمة المرور الحالية', 'current password'), text('كلمة المرور الجديدة', 'new password'), text('تأكيد كلمة المرور', 'password confirmation')][index]} onClick={() => setVisible(value => ({ ...value, [field]: !value[field] }))}>{visible[field] ? text('إخفاء', 'Hide') : text('إظهار', 'Show')}</button></div></div>)}<p>{text('8 أحرف على الأقل، تتضمن حرفًا ورقمًا.', 'At least 8 characters, including a letter and number.')}</p>{error && <p role="alert" className="account-error">{error}</p>}<button className="button">{text('التحقق من النموذج', 'Validate form')}</button>
    </form> : <div className="account-panel">
      <section><h2>{text('معلومات الحساب', 'Account information')}</h2><p>{text('تغيير البريد الإلكتروني وإعدادات الخصوصية سيُتاحان عند ربط خدمة الحسابات.', 'Email changes and privacy controls will be available when the account service is connected.')}</p><Link to={`/${role}/profile`}>{text('تعديل معلومات الملف الشخصي ←', 'Edit profile information →')}</Link></section>
      <section><h2>{text('اللغة', 'Language')}</h2><label className="account-field">{text('لغة الواجهة', 'Interface language')}<select value={language} onChange={event => setLanguage(event.target.value)}><option value="ar">العربية</option><option value="en">English</option></select></label></section>
      <section><h2>{text('المظهر', 'Appearance')}</h2><div className="account-actions">{['light', 'dark'].map(value => <button type="button" key={value} aria-pressed={theme === value} className={`account-choice ${theme === value ? 'selected' : ''}`} onClick={() => setTheme(value)}>{value === 'light' ? text('فاتح', 'Light') : text('داكن', 'Dark')}</button>)}</div><p>{text('تُحفظ اللغة والمظهر تلقائيًا على هذا الجهاز.', 'Language and appearance are saved automatically on this device.')}</p></section>
      <section><h2>{text('الإشعارات', 'Notifications')}</h2><p>{text('تابع تنبيهاتك وحدّد ما قرأته من مركز الإشعارات.', 'View alerts and mark them as read in the notification center.')}</p><Link to={`/${role}/notifications`}>{text('فتح مركز الإشعارات ←', 'Open notification center →')}</Link></section>
      <section><h2>{text('إدارة الحساب', 'Account management')}</h2><div className="account-management"><div><strong>{text('كلمة المرور', 'Password')}</strong><p>{text('واجهة لتحديث كلمة مرور حسابك.', 'A form for updating your account password.')}</p></div><Link className="button secondary" to={`/${role}/settings/security`}>{text('تغيير كلمة المرور', 'Change password')}</Link></div><div className="account-management"><div><strong>{text('حذف الحساب', 'Delete account')}</strong><p>{text('راجع تفاصيل الحذف قبل المتابعة.', 'Review deletion details before continuing.')}</p></div><button type="button" className="button secondary" onClick={() => setDeleting(true)}>{text('حذف الحساب', 'Delete account')}</button></div></section>
    </div>}
    {status && <p className="account-status" role="status">{status}</p>}
    {section === 'profile' && <p className="account-note">{text('تعديلات تجريبية محفوظة على هذا الجهاز، مشتركة بين واجهتي المتعلّم والمعلّم. لا يتم تعديل حساب على الخادم.', 'Demo edits are stored on this device and shared between learner and instructor views. No server account is changed.')}</p>}
    </div></div>
    {deleting && <Modal title={text('حذف الحساب', 'Delete account')} onClose={() => setDeleting(false)}><p>{text('حذف الحساب يحذف معلوماته المرتبطة ولا يمكن التراجع عنه بعد التنفيذ.', 'Account deletion removes its associated information and cannot be undone once completed.')}</p><p className="account-note">{text('الحذف غير متاح في النسخة التجريبية؛ لا توجد خدمة حسابات متصلة حاليًا.', 'Deletion is unavailable in this demo; no account service is connected.')}</p><div className="account-actions"><button className="button" disabled>{text('حذف الحساب', 'Delete account')}</button><button className="button secondary" onClick={() => setDeleting(false)}>{text('إلغاء', 'Cancel')}</button></div></Modal>}
  </main>;
}
