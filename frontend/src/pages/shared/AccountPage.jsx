import { accountRequest, accountError, apiBase } from '../../services/accountApi';
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import ProfileSetup, { validUsername } from '../auth/ProfileSetup';
import InterestsSetup from '../auth/InterestsSetup';
import { passwordRequirements } from '../auth/passwordValidation';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import '../../styles/account.css';
import { readAccountProfile } from '../../hooks/useAccountProfile';
import { useAccountSession, onboardingDraft } from '../../context/AccountSessionContext';
import { useCategoryCatalog } from '../../context/CategoryCatalogContext';
import { profileRequest, replaceCategories, validateCategoryDraft } from '../../services/categorySelections';
const key = 'esham-account-profile-v1';
function readProfile() {
  const empty = { role: '', name: '', username: '', bio: '', interests: [], teachingAreas: [], customSkills: [], goal: null };
  try {
    const value = readAccountProfile();
    if (['learner', 'instructor', 'both'].includes(value.role)) empty.role = value.role;
    for (const field of ['name', 'username', 'bio']) if (typeof value[field] === 'string') empty[field] = value[field].slice(0, field === 'bio' ? 500 : 80);
    for (const field of ['learningCategoryIds', 'teachingCategoryIds']) empty[field] = value[field] || [];
    empty.categoryReselectionRequired = value.categoryReselectionRequired;
    if (typeof value.avatar === 'string' && value.avatar.startsWith('data:image/jpeg;base64,')) empty.avatar = value.avatar;
    if (Number.isInteger(value.goal) && value.goal >= 0 && value.goal < 4) empty.goal = value.goal;
    if (Array.isArray(value.customSkills)) empty.customSkills = value.customSkills.filter(item => typeof item === 'string').slice(0, 10).map(item => item.slice(0, 80));
    return empty;
  } catch { return empty; }
}
export default function AccountPage({ role, section }) {
  const navigate = useNavigate();
  const sessionState = useAccountSession();
  const catalog = useCategoryCatalog();
  const { language, theme, setLanguage, setTheme } = usePreferences();
  const ar = language === 'ar';
  const text = (a, e) => ar ? a : e;
  const [saved, setSaved] = useState(readProfile);
  const [draft, setDraft] = useState(saved);
  const [selectedRole, setSelectedRole] = useState(saved.role || role);
  const [photo, setPhoto] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [visible, setVisible] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (sessionState.status === 'authenticated') {
      const next = onboardingDraft(sessionState.session);
      setSaved(next); setDraft(next); setSelectedRole(next.role || role);
    }
  }, [sessionState.status, sessionState.session?.profile?.id]);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => { setStatus(''); setError(''); setPasswords({ current: '', next: '', confirm: '' }); setVisible({}); }, [section]);
  const update = change => { setDraft(value => ({ ...value, ...change })); setStatus(''); setError(''); };
  async function save(event) {
    event.preventDefault();
    if (draft.name.trim().length < 2) { setError('nameError'); return; }
    if (!validUsername(draft.username)) { setError('usernameError'); return; }
    const invalid = validateCategoryDraft(draft, catalog.categories);
    if (invalid) { setStatus(text('اختر المجالات المطلوبة والمتاحة قبل الحفظ.', 'Select the required available categories before saving.')); return; }
    const value = { ...readAccountProfile(), ...draft, name: draft.name.trim(), bio: draft.bio.trim() };
    try {
      if (busy || sessionState.status !== 'authenticated' || catalog.loading || catalog.error) return;
      setBusy(true);
      // Each replacement is atomic and membership-checked by the server. Do not
      // send the other persona's retained history when it is currently disabled.
      if (value.role !== 'instructor') await replaceCategories('learning', value.learningCategoryIds);
      if (value.role !== 'learner') await replaceCategories('teaching', value.teachingCategoryIds);
      await accountRequest('/me', profileRequest(value), { method: 'PATCH' });
      const verified = await sessionState.refresh();
      const next = onboardingDraft(verified);
      setSaved(next); setDraft(next);
      setStatus(text('تم حفظ ملفك ومجالاتك في حسابك.', 'Your profile and categories are saved to your account.'));
    }
    catch (error) {
      // Earlier requests may have committed. Refresh the canonical saved snapshot,
      // keep the editable draft, and never report the composite save as successful.
      try { const verified = await sessionState.refresh(); setSaved(onboardingDraft(verified)); } catch { /* Show the original failure. */ }
      setStatus(accountError(error, language) + ' ' + text('قد تكون بعض التغييرات قد حُفظت. راجع الاختيارات أو أعد المحاولة.', 'Some changes may have been saved. Review the selections or retry.'));
    } finally { setBusy(false); }
  }
  async function changeAccountType(event) {
    event.preventDefault();
    try {
      if (busy) return; setBusy(true);
      // A newly enabled persona may need new selections before finalization.
      // Collect them in the existing onboarding flow instead of granting a UI-only role.
      if ((selectedRole !== 'instructor' && !saved.learningCategoryIds?.length)
        || (selectedRole !== 'learner' && !saved.teachingCategoryIds?.length && !saved.customSkills?.length)) {
        const nextDraft = { ...saved, role: selectedRole, pendingPersona: selectedRole, goal: null };
        try { sessionStorage.setItem('esham-onboarding-draft-v1', JSON.stringify(nextDraft)); } catch { /* Onboarding can still be entered. */ }
        navigate('/onboarding/role'); return;
      }
      await accountRequest('/me/role', { role: selectedRole }, { method: 'PATCH' });
      const next = onboardingDraft(await sessionState.refresh());
      setSaved(value => ({ ...value, ...next }));
      setDraft(value => ({ ...value, ...next }));
      setStatus(text('تم تغيير نوع الحساب مع الحفاظ على كل بياناتك وسجلك السابق.', 'Account type changed with all your existing data and history preserved.'));
      if (next.role !== 'both' && next.role !== role) navigate(`/${next.role}/settings`, { replace: true });
    } catch (error) {
      setStatus(apiBase ? accountError(error, language) : text('تعذّر حفظ نوع الحساب على الجهاز. حاول مجددًا.', 'Account type could not be saved on this device. Try again.'));
    } finally { setBusy(false); }
  }
  async function checkPassword(event) {
    event.preventDefault();
    const rules = passwordRequirements(passwords.next);
    if (!passwords.current) { setError(text('أدخل كلمة المرور الحالية.', 'Enter your current password.')); return; }
    if (!Object.values(rules).every(Boolean)) { setError(text('استخدم 8 أحرف على الأقل مع حرف ورقم.', 'Use at least 8 characters, including a letter and number.')); return; }
    if (passwords.current === passwords.next) { setError(text('اختر كلمة مرور مختلفة عن الحالية.', 'Choose a password different from the current one.')); return; }
    if (passwords.next !== passwords.confirm) { setError(text('كلمتا المرور غير متطابقتين.', 'The new passwords do not match.')); return; }
    if (busy) return; setBusy(true); setError(''); setStatus('');
    try { await accountRequest('/me/password', { currentPassword: passwords.current, password: passwords.next }); setPasswords({ current: '', next: '', confirm: '' }); setStatus(text('تم تغيير كلمة المرور.', 'Password updated.')); }
    catch (error) { setError(accountError(error, language)); } finally { setBusy(false); }
  }
  if (sessionState.status !== 'authenticated') return <main className="container section"><p role="status">{sessionState.status === 'loading' ? text('جارٍ تحميل الحساب…', 'Loading account…') : text('تعذّر تحميل الحساب.', 'Unable to load the account.')}</p>{sessionState.error && <p role="alert">{accountError(sessionState.error, language)}</p>}<button type="button" onClick={() => sessionState.refresh().catch(() => {})}>{text('إعادة المحاولة', 'Retry')}</button><Link to="/login">{text('تسجيل الدخول', 'Sign in')}</Link></main>;
  return <main className="account-page container">
    {section === 'profile' && saved.categoryReselectionRequired && <p className="account-note" role="status">{text('اختيارات مجالاتك السابقة محفوظة. اختر المجالات الحالية أدناه عند تحديث ملفك الشخصي.', 'Your earlier category choices are saved. Select current categories below when updating your profile.')}</p>}
    <header className="account-heading"><p>{text('حساب واحد · تعلّم وشارك', 'One account · Learn and share')}</p><h1>{section === 'profile' ? text('تعديل الملف الشخصي', 'Edit profile') : section === 'security' ? text('تغيير كلمة المرور', 'Change password') : text('إعدادات الحساب', 'Account settings')}</h1><p>{text('إدارة معلوماتك وتفضيلاتك من مكان واحد.', 'Manage your information and preferences in one place.')}</p></header>
    <div className="account-layout"><nav className="account-tabs" aria-label={text('إدارة الحساب', 'Account navigation')}>
      <NavLink to={`/${role}/profile`}>{text('الملف الشخصي', 'Profile')}</NavLink><NavLink end to={`/${role}/settings`}>{text('الإعدادات', 'Settings')}</NavLink><NavLink to={`/${role}/settings/security`}>{text('الأمان', 'Security')}</NavLink><Link to={`/${role}/notifications`}>{text('الإشعارات', 'Notifications')}</Link>
    </nav><div className="account-content">
    {section === 'profile' ? <form onSubmit={save} noValidate><ProfileSetup draft={draft} update={update} error={error} photo={photo} setPhoto={setPhoto} /><details className="account-panel"><summary>{text('اهتمامات التعلّم ومجالات التعليم', 'Learning interests and teaching areas')}</summary>{draft.role !== 'instructor' && <InterestsSetup draft={draft} update={update} />}{draft.role !== 'learner' && <InterestsSetup draft={draft} update={update} mode="teaching" />}</details><div className="account-actions"><button className="button" type="submit" disabled={busy || catalog.loading || Boolean(catalog.error)} aria-busy={busy}>{text('حفظ التغييرات', 'Save changes')}</button><button type="button" className="button secondary" onClick={() => { setDraft(saved); setPhoto(''); setError(''); setStatus(''); }}>{text('إلغاء التعديلات', 'Discard edits')}</button></div></form> : section === 'security' ? <form className="account-panel account-password" onSubmit={checkPassword} noValidate>
      <p className="account-note">{apiBase ? text('أدخل بياناتك لتحديث كلمة المرور.', 'Enter your details to update your password.') : text('تغيير كلمة المرور غير متاح حاليًا.', 'Password changes are currently unavailable.')}</p>
      {['current', 'next', 'confirm'].map((field, index) => <div className="account-field" key={field}><label htmlFor={`password-${field}`}>{[text('كلمة المرور الحالية', 'Current password'), text('كلمة المرور الجديدة', 'New password'), text('تأكيد كلمة المرور الجديدة', 'Confirm new password')][index]}</label><div className="account-password-input"><input id={`password-${field}`} type={visible[field] ? 'text' : 'password'} autoComplete={field === 'current' ? 'current-password' : 'new-password'} value={passwords[field]} required onChange={event => { setPasswords(value => ({ ...value, [field]: event.target.value })); setError(''); setStatus(''); }} /><button type="button" aria-pressed={!!visible[field]} aria-label={text('إظهار أو إخفاء', 'Show or hide') + ' ' + [text('كلمة المرور الحالية', 'current password'), text('كلمة المرور الجديدة', 'new password'), text('تأكيد كلمة المرور', 'password confirmation')][index]} onClick={() => setVisible(value => ({ ...value, [field]: !value[field] }))}><Icon name={visible[field] ? "eye-off" : "eye"} size={21} /></button></div></div>)}<p>{text('8 أحرف على الأقل، تتضمن حرفًا ورقمًا.', 'At least 8 characters, including a letter and number.')}</p>{error && <p role="alert" className="account-error">{error}</p>}<button className="button" disabled={busy} aria-busy={busy}>{text('تغيير كلمة المرور', 'Change password')}</button>
    </form> : <div className="account-panel">
      <section id="account-type">
        <h2>{text('نوع الحساب', 'Account type')}</h2>
        <p>{text('اختر الدور المناسب لك دون إنشاء حساب جديد. إذا أردت التعلّم وتقديم الدورات معًا، اختر هايبرد.', 'Choose your role without creating another account. Choose hybrid to both take and teach courses.')}</p>
        <form onSubmit={changeAccountType}>
          <label className="account-field">{text('دور الحساب', 'Account role')}
            <select value={selectedRole} onChange={event => { setSelectedRole(event.target.value); setStatus(''); }}>
              <option value="learner">{text('متعلّم', 'Learner')}</option>
              <option value="instructor">{text('مدرّب', 'Instructor')}</option>
              <option value="both">{text('هايبرد · متعلّم ومدرّب', 'Hybrid · Learner and instructor')}</option>
            </select>
          </label>
          <p>{text('تبقى بياناتك ودوراتك وتقدّمك ومهامك وشهاداتك ونقاطك محفوظة عند أي تغيير. عند اختيار هايبرد يظهر سجلك السابق في وضعه المناسب، ويمكنك التبديل بين التعلّم والتعليم.', 'Your profile, courses, progress, tasks, certificates and points remain saved through every change. In hybrid mode, your existing records remain available in the relevant area, and you can switch between learning and teaching.')}</p>
          <div className="account-actions">
            <button type="submit" className="button" disabled={busy || selectedRole === (saved.role || role)}>{text('حفظ نوع الحساب', 'Save account type')}</button>
            {saved.role === 'both' && <Link className="button button-outline" to={role === 'learner' ? '/instructor' : '/learner'}>{role === 'learner' ? text('الانتقال إلى التعليم', 'Go to teaching') : text('الانتقال إلى التعلّم', 'Go to learning')}</Link>}
          </div>
        </form>
      </section>
      <section><h2>{text('معلومات الحساب', 'Account information')}</h2><p>{text('تغيير البريد الإلكتروني وإعدادات الخصوصية سيُتاحان عند ربط خدمة الحسابات.', 'Email changes and privacy controls will be available when the account service is connected.')}</p><Link to={`/${role}/profile`}>{text('تعديل معلومات الملف الشخصي ←', 'Edit profile information →')}</Link></section>
      <section><h2>{text('اللغة', 'Language')}</h2><label className="account-field">{text('لغة الواجهة', 'Interface language')}<select value={language} onChange={event => setLanguage(event.target.value)}><option value="ar">العربية</option><option value="en">English</option></select></label></section>
      <section><h2>{text('المظهر', 'Appearance')}</h2><div className="account-actions">{['light', 'dark'].map(value => <button type="button" key={value} aria-pressed={theme === value} className={`account-choice ${theme === value ? 'selected' : ''}`} onClick={() => setTheme(value)}>{value === 'light' ? text('فاتح', 'Light') : text('داكن', 'Dark')}</button>)}</div><p>{text('تُحفظ اللغة والمظهر تلقائيًا على هذا الجهاز.', 'Language and appearance are saved automatically on this device.')}</p></section>
      <section><h2>{text('الإشعارات', 'Notifications')}</h2><p>{text('تابع تنبيهاتك وحدّد ما قرأته من مركز الإشعارات.', 'View alerts and mark them as read in the notification center.')}</p><Link to={`/${role}/notifications`}>{text('فتح مركز الإشعارات ←', 'Open notification center →')}</Link></section>
      <section><h2>{text('إدارة الحساب', 'Account management')}</h2><div className="account-management"><div><strong>{text('كلمة المرور', 'Password')}</strong><p>{text('واجهة لتحديث كلمة مرور حسابك.', 'A form for updating your account password.')}</p></div><Link className="button secondary" to={`/${role}/settings/security`}>{text('تغيير كلمة المرور', 'Change password')}</Link></div><div className="account-management"><div><strong>{text('حذف الحساب', 'Delete account')}</strong><p>{text('راجع تفاصيل الحذف قبل المتابعة.', 'Review deletion details before continuing.')}</p></div><button type="button" className="button secondary" onClick={() => setDeleting(true)}>{text('حذف الحساب', 'Delete account')}</button></div></section>
    </div>}
    {status && <p className="account-status" role="status">{status}</p>}
    
    </div></div>
    {deleting && <Modal title={text('حذف الحساب', 'Delete account')} onClose={() => setDeleting(false)}><p>{text('حذف الحساب يحذف معلوماته المرتبطة ولا يمكن التراجع عنه بعد التنفيذ.', 'Account deletion removes its associated information and cannot be undone once completed.')}</p><p className="account-note">{apiBase ? text('أكد الحذف النهائي للحساب.', 'Confirm permanent account deletion.') : text('حذف الحساب غير متاح حاليًا.', 'Account deletion is currently unavailable.')}</p><div className="account-actions"><button className="button" disabled={!apiBase || busy} onClick={async () => { setBusy(true); try { await accountRequest('/me', undefined, { method: 'DELETE' }); localStorage.removeItem(key); sessionStorage.removeItem('esham-onboarding-draft-v1'); window.dispatchEvent(new Event('esham-profile-updated')); navigate('/'); } catch(error) { setStatus(accountError(error, language)); } finally { setBusy(false); } }}>{text('حذف الحساب', 'Delete account')}</button><button className="button secondary" onClick={() => setDeleting(false)}>{text('إلغاء', 'Cancel')}</button></div></Modal>}
  </main>;
}
