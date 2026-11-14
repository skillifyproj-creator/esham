import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Modal from '../Modal';
import { useAccountSession } from '../../context/AccountSessionContext';
import { useFinancial } from '../../context/FinancialContext';
import { loadPurchaseAvailability, enrollmentIntent, clearEnrollmentIntent } from '../../services/enrollments';
import { financialMessage } from '../../services/financialApi';

export default function EnrollmentAction({ course, language }) {
  const account = useAccountSession(), financial = useFinancial(), navigate = useNavigate();
  const id = account.status === 'authenticated' ? account.session.profile.id : null;
  const learner = account.session?.profile.roles?.includes('Learner');
  const [availability, setAvailability] = useState(null), [error, setError] = useState(null), [confirm, setConfirm] = useState(false);
  const [revision, retry] = useState(0);
  const lock = useRef(false), current = useRef(id); current.current = id;
  const t = (ar, en) => language === 'ar' ? ar : en;
  useEffect(() => {
    let active = true; setAvailability(null); setError(null); setConfirm(false);
    if (id && learner) loadPurchaseAvailability(id).then(data => { if (active) setAvailability({ ...data, accountId: id }); })
      .catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [id, learner, course.id, revision]);
  async function buy() {
    if (lock.current || !id || !availability?.enabled || availability.accountId !== id) return;
    lock.current = true; setError(null);
    try {
      const intent = enrollmentIntent(sessionStorage, id, course.id, course.publishedVersionId);
      const result = await financial.purchase(id, intent);
      if (current.current !== id) return;
      clearEnrollmentIntent(sessionStorage, id, course.id); setConfirm(false);
      navigate(`/learner/enrollments/${result.enrollment.id}`);
    } catch (e) { if (current.current === id) setError(e); }
    finally { lock.current = false; }
  }
  const existing = financial.enrollments.find(x => x.courseId === course.id);
  return <><h2>{t('التسجيل في الدورة', 'Course enrollment')}</h2><p>{t('تكلفة التسجيل: 20 نقطة.', 'Enrollment costs 20 points.')}</p>
    {id && financial.wallet && <p>{t('رصيدك المتاح:', 'Available balance:')} {financial.wallet.balance}</p>}
    {error && <p role="alert">{financialMessage(error, language)} <button className="button button-outline" onClick={() => retry(x => x + 1)}>{t('إعادة المحاولة', 'Retry')}</button></p>}
    {financial.error && <p role="alert">{financialMessage(financial.error, language)} <button className="button button-outline" onClick={financial.refresh}>{t('إعادة المحاولة', 'Retry')}</button></p>}
    {account.status === 'anonymous' ? <Link className="button enroll-button" to="/login">{t('سجّل الدخول للتسجيل', 'Sign in to enroll')}</Link>
      : !id ? <p role="status">{t('جارٍ التحقق من الحساب…', 'Checking your account…')}</p>
      : !learner ? <p>{t('يتطلب التسجيل تفعيل نوع حساب المتعلّم.', 'Enrollment requires Learner membership.')}</p>
      : existing ? <Link className="button" to={`/learner/enrollments/${existing.id}`}>{t('عرض تسجيلي', 'View my enrollment')}</Link>
      : course.instructorId === id ? <p>{t('لا يمكنك التسجيل في دورتك.', 'You cannot enroll in your own course.')}</p>
      : <><p>{availability?.accountId === id && availability.enabled ? t('أكد التسجيل لخصم 20 نقطة من محفظتك.', 'Confirm enrollment to deduct 20 points from your wallet.')
        : availability?.accountId === id ? t('التسجيل غير متاح حاليًا.', 'Enrollment is currently unavailable.') : t('جارٍ التحقق من إمكانية التسجيل…', 'Checking enrollment availability…')}</p>
        <button type="button" className="button enroll-button" disabled={availability?.accountId !== id || !availability?.enabled || financial.mutating || financial.loading || Boolean(financial.error)} onClick={() => setConfirm(true)}>{t('التسجيل مقابل 20 نقطة', 'Enroll for 20 points')}</button></>}
    {confirm && availability?.accountId === id && <Modal title={t('تأكيد التسجيل', 'Confirm enrollment')} onClose={() => { if (!financial.mutating) setConfirm(false); }}>
      <p>{t('سيتم خصم 20 نقطة مرة واحدة. هل تريد المتابعة؟', 'Your wallet will be charged 20 points once. Continue?')}</p>
      {error && <p role="alert">{financialMessage(error, language)}</p>}
      <button className="button" disabled={financial.mutating} aria-busy={financial.mutating} onClick={buy}>{t('تأكيد التسجيل', 'Confirm enrollment')}</button>
      <button className="button button-outline" disabled={financial.mutating} onClick={() => setConfirm(false)}>{t('إلغاء', 'Cancel')}</button>
    </Modal>}
  </>;
}
