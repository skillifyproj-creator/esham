import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAccountSession } from '../../context/AccountSessionContext';
import { usePreferences } from '../../context/PreferencesContext';
import { adminUserMessage, canManageUsers, getAdminUser, listAdminUsers, managedRoles, updateAdminLockout, updateAdminRoles } from '../../services/adminUsers';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';

export function AdminAccess({ children }) {
  const session = useAccountSession();
  const { language } = usePreferences();
  const t = (ar, en) => language === 'ar' ? ar : en;
  if (session.status === 'loading') return <section className="sa-panel" role="status">{t('جارٍ التحقق من الجلسة…', 'Verifying your session…')}</section>;
  if (session.status !== 'authenticated' || !canManageUsers(session.session)) return <section className="sa-panel"><h1>{t('إدارة المستخدمين', 'User management')}</h1><p role="alert">{session.status === 'authenticated' ? adminUserMessage({ status: 403 }, language) : session.status === 'unconfigured' ? adminUserMessage({ code: 'unconfigured' }, language) : adminUserMessage(session.error || { status: 401 }, language)}</p><Link className="sa-button" to="/login">{t('تسجيل الدخول', 'Sign in')}</Link><button className="sa-button" onClick={() => session.refresh().catch(() => {})}>{t('إعادة المحاولة', 'Retry')}</button></section>;
  return children;
}

export default function AdminUsersPage({ administratorsOnly = false }) {
  return <AdminAccess><Directory administratorsOnly={administratorsOnly}/></AdminAccess>;
}

function Directory({ administratorsOnly }) {
  const { language } = usePreferences();
  const session = useAccountSession();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [role, setRole] = useState(''), [status, setStatus] = useState('');
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(null), [revision, setRevision] = useState(0);
  const [target, setTarget] = useState(null), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const detailGeneration = useRef(0);
  useEffect(() => {
    let disposed = false;
    setLoading(true); setError(null);
    const timer = setTimeout(() => listAdminUsers({ page, search, role: administratorsOnly ? role || 'administrators' : role, status })
      .then(result => { if (!disposed) setData(result); }).catch(failure => { if (!disposed) { setData(null); setError(failure); } })
      .finally(() => { if (!disposed) setLoading(false); }), 180);
    return () => { disposed = true; clearTimeout(timer); };
  }, [page, search, role, status, revision, administratorsOnly]);
  useEffect(() => () => { detailGeneration.current++; }, []);
  async function details(id) {
    const generation = ++detailGeneration.current;
    setDetailId(id);
    setDetailLoading(true); setDetailError(null); setTarget(null);
    try { const result = await getAdminUser(id); if (generation === detailGeneration.current) setTarget(result); }
    catch (failure) { if (generation === detailGeneration.current) setDetailError(failure); }
    finally { if (generation === detailGeneration.current) setDetailLoading(false); }
  }
  const filter = setter => event => { setter(event.target.value); setPage(1); };
  return <>
    <div className="sa-page-head"><div><h1>{administratorsOnly ? t('المديرون', 'Administrators') : t('المستخدمون', 'Users')}</h1><p>{t('الحسابات والأدوار الفعلية وحالة قفل الدخول.', 'Account memberships and Identity sign-in lockout status.')}</p></div><button className="sa-button" disabled title={t('إضافة حسابات جديدة أو إسناد التصنيفات غير متاح هنا.', 'Account creation and category assignments are unavailable here.')}>{t('إضافة حساب', 'Add account')}</button></div>
    <div className="sa-filters"><Icon name="search" size={18}/><input type="search" maxLength={100} aria-label={t('بحث المستخدمين', 'Search users')} placeholder={t('الاسم أو البريد أو اسم المستخدم', 'Name, email or username')} value={search} onChange={filter(setSearch)}/><select aria-label={t('الدور', 'Role')} value={role} onChange={filter(setRole)}><option value="">{t('كل الأدوار', 'All roles')}</option>{(administratorsOnly ? ['GeneralAdmin', 'CategoryAdmin'] : managedRoles).map(value => <option key={value}>{value}</option>)}</select><select aria-label={t('قفل الدخول', 'Sign-in lockout')} value={status} onChange={filter(setStatus)}><option value="">{t('كل الحالات', 'All lockout states')}</option><option value="unlocked">{t('غير مقفل', 'Unlocked')}</option><option value="locked">{t('مقفل مؤقتًا', 'Locked out')}</option></select></div>
    {loading && <section className="sa-panel" role="status">{t('جارٍ تحميل الحسابات…', 'Loading accounts…')}</section>}
    {error && <section className="sa-panel"><p role="alert">{adminUserMessage(error, language)}</p><button className="sa-button" onClick={() => setRevision(value => value + 1)}>{t('إعادة المحاولة', 'Retry')}</button></section>}
    {!loading && !error && <section className="sa-panel"><div className="sa-table-wrap"><table><thead><tr>{[t('الاسم', 'Name'), t('البريد الإلكتروني', 'Email'), t('أدوار Identity', 'Identity roles'), t('قفل الدخول', 'Sign-in lockout'), t('الإجراءات', 'Actions')].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody><AdminUserRows users={data?.items || []} onDetails={details}/></tbody></table></div>{!data?.items.length && <p role="status">{t('لا توجد حسابات مطابقة.', 'No matching accounts.')}</p>}<div className="sa-form-actions"><button className="sa-button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{t('السابق', 'Previous')}</button><span>{page} · {data?.totalCount ?? 0} {t('حساب', 'accounts')}</span><button className="sa-button" disabled={!data || page * data.pageSize >= data.totalCount} onClick={() => setPage(value => value + 1)}>{t('التالي', 'Next')}</button></div></section>}
    {(detailLoading || detailError || target) && <Modal title={t('تفاصيل الحساب', 'Account details')} onClose={() => { detailGeneration.current++; setTarget(null); setDetailError(null); setDetailLoading(false); }}>
      {detailLoading && <p role="status">{t('جارٍ تحميل التفاصيل…', 'Loading details…')}</p>}{detailError && <><p role="alert">{adminUserMessage(detailError, language)}</p><button className="sa-button" onClick={() => details(detailId)}>{t('إعادة المحاولة', 'Retry')}</button></>}
      {target && <UserDetails key={target.id} user={target} actorId={session.session.profile.id} onReload={() => details(target.id)} onChanged={value => { setTarget(value); setRevision(previous => previous + 1); }}/>}</Modal>}
  </>;
}

export function AdminUserRows({ users, onDetails }) {
  const { language } = usePreferences();
  const t = (ar, en) => language === 'ar' ? ar : en;
  return users.map(user => <tr key={user.id}><td><b>{user.name || user.username || user.id}</b></td><td dir="ltr">{user.email || '—'}</td><td>{user.roles.join(', ') || t('إعداد غير مكتمل', 'Onboarding incomplete')}</td><td><span className={`sa-pill ${user.isLockedOut ? 'inactive' : 'active'}`}>{user.isLockedOut ? t('مقفل مؤقتًا', 'Locked out') : t('غير مقفل', 'Unlocked')}</span></td><td><button className="sa-text-button" onClick={() => onDetails(user.id)}>{t('عرض التفاصيل / إدارة', 'Details / manage')}</button></td></tr>);
}

export function UserDetails({ user, actorId, onReload, onChanged }) {
  const { language } = usePreferences();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const [roles, setRoles] = useState(user.roles), [until, setUntil] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(null), [success, setSuccess] = useState('');
  const self = user.id === actorId;
  const unsupportedRoles = user.roles.some(role => !managedRoles.includes(role));
  async function save(action) {
    if (busy || self) return;
    setBusy(true); setError(null); setSuccess('');
    try { const result = await action(); onChanged(result); setSuccess(t('تم حفظ التغيير في الخادم.', 'The server confirmed the change.')); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  return <div className="sa-form"><p><b>{user.name || user.username}</b> · {user.email || '—'}</p><p dir="ltr">{user.id}</p><p>{t('تأكيد البريد:', 'Email confirmed:')} {user.emailConfirmed ? t('نعم', 'Yes') : t('لا', 'No')}</p><p>{t('القفل:', 'Lockout:')} {user.isLockedOut ? new Date(user.lockoutEnd).toLocaleString(language) : t('غير مقفل', 'Unlocked')}</p>
    {self && <p role="status">{t('لا يمكنك تعديل صلاحيات حسابك أو قفله من هذه الشاشة.', 'You cannot change your own privileges or lockout here.')}</p>}
    <fieldset disabled={busy || self || unsupportedRoles}><legend>{t('الأدوار', 'Roles')}</legend>{managedRoles.map(role => <label className="sa-check" key={role}><input type="checkbox" checked={roles.includes(role)} disabled={role === 'CategoryAdmin'} onChange={event => setRoles(previous => event.target.checked ? [...previous, role] : previous.filter(value => value !== role))}/>{role}</label>)}</fieldset>
    {unsupportedRoles && <p role="status">{t('توجد أدوار قديمة غير مدعومة؛ يلزم تنسيق قبل تعديل العضويات.', 'Unsupported legacy roles require coordination before membership changes.')}</p>}
    <p className="sa-helper">{t('إسناد CategoryAdmin ونطاق التصنيفات يتطلب تنسيقًا منفصلًا. يُحفظ الدور الحالي.', 'CategoryAdmin membership and category scope require separate coordination. Existing membership is preserved.')}</p>
    <button className="sa-button primary" disabled={busy || self || unsupportedRoles} onClick={() => { if (window.confirm(t('تأكيد تغيير الأدوار؟ ستنتهي جلسات الحساب الحالية.', 'Change roles and invalidate the account’s current sessions?'))) save(() => updateAdminRoles(user, roles)); }}>{t('حفظ الأدوار', 'Save roles')}</button>
    <label>{t('قفل تسجيل الدخول حتى', 'Lock sign-in until')}<input type="datetime-local" value={until} disabled={busy || self || !user.lockoutEnabled} onChange={event => setUntil(event.target.value)}/></label><div className="sa-form-actions"><button className="sa-button" disabled={busy || self || !user.lockoutEnabled || !until} onClick={() => { if (window.confirm(t('تأكيد قفل الدخول مؤقتًا؟', 'Apply this timed sign-in lockout?'))) save(() => updateAdminLockout(user, new Date(until).toISOString())); }}>{t('تطبيق القفل المؤقت', 'Apply timed lockout')}</button><button className="sa-button" disabled={busy || self} onClick={() => save(() => updateAdminLockout(user, null))}>{t('إلغاء القفل / تصفير المحاولات', 'Unlock / reset failed attempts')}</button></div>
    <div className="sa-form-actions"><button className="sa-button" disabled title={t('لا يوجد حقل تفعيل أو تعليق حساب في النموذج الحالي.', 'The current model has no activation or suspension field.')}>{t('تفعيل / تعليق الحساب — غير متاح', 'Activate / suspend — unavailable')}</button><button className="sa-button" disabled>{t('حذف الحساب — غير متاح', 'Delete account — unavailable')}</button></div>
    {error && <p role="alert">{adminUserMessage(error, language)}</p>}{success && <p role="status">{success}</p>}<button className="sa-button" disabled={busy} onClick={onReload}>{t('إعادة تحميل التفاصيل', 'Reload details')}</button>
  </div>;
}

export function AdminUserCountCard({ administratorsOnly = false }) {
  const { language } = usePreferences();
  const session = useAccountSession();
  const [total, setTotal] = useState(null);
  useEffect(() => {
    let disposed = false;
    if (session.status === 'authenticated' && canManageUsers(session.session)) listAdminUsers({ pageSize: 1, role: administratorsOnly ? 'administrators' : '' })
      .then(result => { if (!disposed) setTotal(result.totalCount); }).catch(() => { if (!disposed) setTotal(null); });
    return () => { disposed = true; };
  }, [session.status, session.session, administratorsOnly]);
  const visibleTotal = session.status === 'authenticated' && canManageUsers(session.session) ? total : null;
  return <Link className="sa-stat-card" to={administratorsOnly ? '/admin/admins' : '/admin/users'}><span className="sa-card-icon"><Icon name="users" size={19}/></span><span className="sa-card-label">{administratorsOnly ? (language === 'ar' ? 'المديرون' : 'Administrators') : (language === 'ar' ? 'المستخدمون' : 'Users')}</span><strong>{visibleTotal ?? '—'}</strong><small>{language === 'ar' ? 'إحصاء حسابات الخادم' : 'Server account count'}</small></Link>;
}
