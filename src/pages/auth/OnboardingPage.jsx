import { accountRequest, accountError, apiBase } from '../../services/accountApi';
import SetupComplete from "./SetupComplete";
import { teachingSkillsCopy } from "../../i18n/teachingSkillsCopy";
import InterestsSetup from "./InterestsSetup";
import { interestsCopy } from "../../data/interestAreas";
import ProfileSetup, { validUsername } from "./ProfileSetup";
import { profileSetupCopy } from "../../i18n/profileSetupCopy";
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { onboardingCopy, getOnboardingGoals } from '../../i18n/onboardingCopy';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import logo from '../../assets/esham-logo.png';
import '../../styles/onboarding.css';

const steps = ['role', 'profile', 'interests', 'goals'];
const storageKey = 'esham-onboarding-draft-v1';
const emptyDraft = { role: '', name: '', username: '', bio: '', interests: [], teachingAreas: [], customSkills: [], goal: null };
function loadDraft() {
  try {
    const data = JSON.parse(sessionStorage.getItem(storageKey));
    if (!data || typeof data !== 'object') return emptyDraft;
    return {
      id: typeof data.id === 'string' ? data.id : undefined,
      avatar: typeof data.avatar === 'string' && data.avatar.startsWith('data:image/jpeg;base64,') ? data.avatar : '',
      role: ['learner', 'instructor', 'both'].includes(data.role) ? data.role : '',
      name: typeof data.name === 'string' ? data.name.slice(0, 80) : '',
      username: typeof data.username === 'string' ? data.username.slice(0, 24) : '',
      bio: typeof data.bio === 'string' ? data.bio.slice(0, 500) : '',
      interests: Array.isArray(data.interests) ? [...new Set(data.interests.filter(n => Number.isInteger(n) && n >= 0 && n < 6))] : [],
      teachingAreas: Array.isArray(data.teachingAreas) ? [...new Set(data.teachingAreas.filter(n => Number.isInteger(n) && n >= 0 && n < 6))] : [],
      customSkills: Array.isArray(data.customSkills) ? [...new Set(data.customSkills.filter(value => typeof value === "string" && value.trim().length >= 2 && Array.from(value).length <= 80).map(value => value.trim()))].slice(0,10) : [],
      goal: Number.isInteger(data.goal) && data.goal >= 0 && data.goal < 4 ? data.goal : null,
    };
  } catch { return emptyDraft; }
}
function RoleIcon({ role }) {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {role === 'learner' ? <><path d="m2 9 10-5 10 5-10 5-10-5ZM6 11v6c4 3 8 3 12 0v-6M22 9v7" /></> : role === 'instructor' ? <><circle cx="9" cy="7" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2H3ZM16 5c3 2 3 5 0 7M19 2c5 4 5 9 0 13" /></> : <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 21v-2a6 6 0 0 1 12 0v2H2ZM15 15a5 5 0 0 1 7 4v2h-5M7 2l3-1" /></>}
  </svg>;
}
export default function OnboardingPage() {
  const { language, theme, toggleLanguage, toggleTheme } = usePreferences();
  const t = onboardingCopy[language];
  const { step = 'role' } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(loadDraft);
  const [error, setError] = useState('');
  const [busy,setBusy]=useState(false);
  const [help, setHelp] = useState(false);
  const errorRef = useRef(null);
  const [photo, setPhoto] = useState("");
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  const current = steps.indexOf(step);
  const complete = step === 'complete';
  function update(patch) {
    const next = { ...draft, ...patch, ...(patch.role && patch.role !== draft.role ? { goal: null } : {}) };
    setDraft(next); setError('');
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* The flow also works without storage. */ }
  }
  function move(target) { setError(''); navigate(`/onboarding/${target}`); }
  const skillRequirement = draft.role !== "instructor" && !draft.interests.length ? "interestError" : draft.role !== "learner" && !draft.teachingAreas.length && !draft.customSkills.length ? "teachingError" : "";
  async function submit(event) {
    event.preventDefault();
    const invalid = current === 0 && !draft.role ? 'roleError' : current === 1 && draft.name.trim().length < 2 ? 'nameError' : current === 1 && !validUsername(draft.username) ? 'usernameError' : current === 2 && skillRequirement ? skillRequirement : current === 3 && draft.goal === null ? 'goalError' : '';
    if (invalid) { setError(invalid); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    if (current === 3) {
      const completedProfile = { ...draft, id: draft.id || `user:${draft.username.toLowerCase()}` };
      try {
        if(busy)return;setBusy(true);
        if(apiBase)await accountRequest('/me',completedProfile,{method:'PATCH'});
        localStorage.setItem('esham-account-profile-v1', JSON.stringify(completedProfile));
        sessionStorage.setItem(storageKey, JSON.stringify(completedProfile));
        setDraft(completedProfile);
      } catch (cause) { setError(apiBase ? accountError(cause,language) : language === 'ar' ? 'تعذّر حفظ الحساب. فعّل تخزين المتصفح ثم حاول مجددًا.' : 'Unable to save your account. Enable browser storage and retry.'); return; } finally {setBusy(false);}
      window.dispatchEvent(new Event('esham-profile-updated'));
    }
    move(steps[current + 1] || 'complete');
  }
  if (current < 0 && !complete) return <main className="section container empty-state"><h1>{t.title}</h1><Link className="button" to="/onboarding/role">{t.label}</Link></main>;
  const firstIncomplete = !draft.role ? 0 : draft.name.trim().length < 2 || !validUsername(draft.username) ? 1 : skillRequirement ? 2 : draft.goal === null ? 3 : 4;
  if ((complete ? 4 : current) > firstIncomplete) return <Navigate to={`/onboarding/${steps[firstIncomplete]}`} replace />;
  const goalCopy = getOnboardingGoals(language, draft.role);
  const title = [t.title, profileSetupCopy[language].title, draft.role === "instructor" ? teachingSkillsCopy[language].title : interestsCopy[language].titles[draft.role], goalCopy.title][current];
  const intro = [t.intro, profileSetupCopy[language].intro, draft.role === "instructor" ? teachingSkillsCopy[language].intro : interestsCopy[language].intro, goalCopy.intro][current];
  return <div className="onboarding-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <header className="onboarding-header"><div className="container onboarding-header-inner"><Link to="/" aria-label={t.exit}><img src={logo} alt={language === 'ar' ? 'إسهام' : 'Esham'} /></Link><div className="onboarding-tools"><button type="button" onClick={toggleLanguage}>{language === 'ar' ? 'English' : 'العربية'}</button><button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? t.light : t.dark}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} /></button><button type="button" onClick={() => setHelp(true)} aria-label={t.help} title={t.help}><Icon name="info" size={22} /></button><Link to="/" aria-label={t.exit}><Icon name="close" size={21} /></Link></div></div></header>
    <main className="container onboarding-main">
      <nav aria-label={t.progress}><ol className="onboarding-stepper">{steps.map((id, index) => <li key={id} className={complete || index < current ? 'done' : index === current ? 'active' : ''} aria-current={index === current ? 'step' : undefined}><span className="onboarding-step-line" /><button type="button" disabled={!complete && index > current} onClick={() => move(id)}><span className="onboarding-step-number">{complete || index < current ? '✓' : index + 1}</span>{index === 2 && draft.role !== "learner" ? language === "ar" ? draft.role === "instructor" ? "مهاراتك" : "اهتماماتك وخبرتك" : draft.role === "instructor" ? "Your expertise" : "Interests & expertise" : t.steps[index]}</button></li>)}</ol></nav>
      {complete ? <SetupComplete draft={draft} photo={photo} onEdit={() => move("role")} /> : <form onSubmit={submit} noValidate>
        <div className="onboarding-heading"><span className="onboarding-kicker">{t.label}</span><h1>{title}</h1><p>{intro}</p></div>
        {current === 0 && <fieldset className="onboarding-role-grid"><legend className="sr-only">{t.title}</legend>{t.roles.map(role => <label key={role.id} className={`onboarding-role-card ${draft.role === role.id ? 'selected' : ''} ${role.id === 'both' ? 'combined' : ''}`}>
          <input type="radio" name="role" value={role.id} checked={draft.role === role.id} onChange={() => update({ role: role.id })} aria-label={role.title} aria-describedby={`role-${role.id}-description`} />
          {role.id === 'both' && <span className="onboarding-recommended">✧ {t.recommended}</span>}
          <div className="onboarding-card-top"><span className="onboarding-role-icon"><RoleIcon role={role.id} /></span><span className="onboarding-card-tag">{role.tag}</span></div>
          <h2>{role.title}</h2><p id={`role-${role.id}-description`}>{role.description}</p><span className="onboarding-benefit">{role.benefit}</span>
          <div className="onboarding-card-bottom"><span>{draft.role === role.id ? t.selected : t.select}</span><span className="onboarding-radio-mark" aria-hidden="true">{draft.role === role.id ? '✓' : ''}</span></div>
        </label>)}</fieldset>}
        {current === 0 && <aside className="onboarding-note"><span aria-hidden="true">ⓘ</span><p>{t.note}</p></aside>}
        {current === 1 && <ProfileSetup draft={draft} update={update} error={error} photo={photo} setPhoto={setPhoto} />}
        {current === 2 && <>{draft.role !== "instructor" && <InterestsSetup key="learning" mode="learning" draft={draft} update={update} />}{draft.role !== "learner" && <InterestsSetup key="teaching" mode="teaching" draft={draft} update={update} />}</>}
        {current === 3 && <fieldset className="onboarding-choice-grid goals"><legend className="sr-only">{title}</legend>{goalCopy.goals.map((goal, index) => <label key={index} className={draft.goal === index ? 'selected' : ''}><input type="radio" name="goal" checked={draft.goal === index} onChange={() => update({ goal: index })} /><span>{goal}</span></label>)}</fieldset>}
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="onboarding-error">{error === "teachingError" ? teachingSkillsCopy[language].required : t[error] || profileSetupCopy[language][error] || error}</p>}
        <div className="onboarding-actions">{current > 0 && <button type="button" className="onboarding-back" onClick={() => move(steps[current - 1])}>{t.back}</button>}<button className="onboarding-next" type="submit" disabled={busy} aria-busy={busy}>{current === 3 ? t.finish : t.next}<span aria-hidden="true">{language === 'ar' ? '←' : '→'}</span></button></div>
      </form>}
      <p className="onboarding-demo">{t.demo}</p>
    </main>

    {help && <Modal title={t.helpTitle} onClose={() => setHelp(false)}><p>{t.helpText}</p><button className="button" onClick={() => setHelp(false)}>{t.close}</button></Modal>}
  </div>;
}
