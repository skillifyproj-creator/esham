import { useEffect, useRef, useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import { onboardingCopy } from '../../i18n/onboardingCopy';
import { profileSetupCopy } from '../../i18n/profileSetupCopy';
import Icon from '../../components/Icon';
import '../../styles/onboarding-profile.css';

export function validUsername(value) { return /^[a-zA-Z0-9_]{3,24}$/.test(value); }
export default function ProfileSetup({ draft, update, error, photo, setPhoto }) {
  const { language } = usePreferences();
  const t = profileSetupCopy[language];
  const copy = onboardingCopy[language];
  const fileInput = useRef(null);
  const selection = useRef(0);
  const [photoError, setPhotoError] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => () => { selection.current++; }, []);
  const initials = draft.name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('') || (language === 'ar' ? 'إ' : 'E');
  const role = copy.roles.find(item => item.id === draft.role);
  async function choosePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const request = ++selection.current;
    setPhotoError(false);
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) { setLoading(false); setPhotoError(true); return; }
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (selection.current !== request) { URL.revokeObjectURL(url); return; }
      setPhoto(url);
    } catch { URL.revokeObjectURL(url); if (selection.current === request) setPhotoError(true); }
    finally { if (selection.current === request) setLoading(false); }
  }
  function resetPhoto() { selection.current++; setLoading(false); setPhoto(''); setPhotoError(false); }
  const avatar = (className) => <span className={`profile-setup-avatar ${className || ''}`}>{photo ? <img src={photo} alt={t.photo} /> : <span aria-hidden="true">{initials}</span>}</span>;
  return <div className="profile-setup-grid">
    <section className="profile-setup-form" aria-label={copy.steps[1]}>
      <div className="profile-setup-photo"><div>{avatar()}<strong>{t.photo} <small>({t.optional})</small></strong></div><div className="profile-setup-photo-controls"><div className="profile-setup-buttons"><button type="button" className="profile-setup-upload" disabled={loading} onClick={() => fileInput.current?.click()}><Icon name="camera" size={18} />{loading ? t.uploading : t.addPhoto}</button><button type="button" className="profile-setup-default" onClick={resetPhoto}>{t.defaultPhoto}</button></div><input ref={fileInput} type="file" accept="image/jpeg,image/png" onChange={choosePhoto} hidden aria-label={t.addPhoto} /><p>{t.photoHint}</p>{photoError && <p className="profile-setup-error" role="alert">{t.photoError}</p>}{photo && <p className="profile-setup-photo-status" role="status">{t.selected}</p>}</div></div>
      <div className="profile-setup-field"><label htmlFor="onboarding-name">{t.name} <span aria-hidden="true">*</span></label><input id="onboarding-name" autoComplete="name" maxLength={80} placeholder={copy.namePlaceholder} value={draft.name} onChange={event => update({ name: event.target.value })} required aria-invalid={error === 'nameError'} aria-describedby={error === 'nameError' ? 'profile-name-error' : undefined} />{error === 'nameError' && <p id="profile-name-error" className="profile-setup-error">{copy.nameError}</p>}</div>
      <div className="profile-setup-field"><label htmlFor="onboarding-username">{t.username} <span aria-hidden="true">*</span></label><div className="profile-setup-username"><span aria-hidden="true">@</span><input id="onboarding-username" dir="ltr" autoComplete="username" spellCheck={false} maxLength={24} placeholder={t.usernamePlaceholder} value={draft.username} onChange={event => update({ username: event.target.value })} required aria-invalid={error === 'usernameError'} aria-describedby={`profile-username-hint${error === 'usernameError' ? ' profile-username-error' : ''}`} /></div><small id="profile-username-hint">{t.usernameHint}</small>{error === 'usernameError' && <p id="profile-username-error" className="profile-setup-error">{t.usernameError}</p>}</div>
      <div className="profile-setup-field"><label htmlFor="onboarding-bio">{t.about} <small>({t.optional})</small></label><textarea id="onboarding-bio" rows={3} maxLength={500} placeholder={copy.bioPlaceholder} value={draft.bio} onChange={event => update({ bio: event.target.value })} /></div>
      <aside className="profile-setup-note"><Icon name="leaf" size={23} /><div><strong>{t.unified}</strong><p>{t.unifiedText}</p></div></aside>
    </section>
    <aside className="profile-setup-preview" aria-label={t.preview}>
      <div className="profile-setup-preview-heading"><h2>{t.preview}</h2><span><i />{t.live}</span></div>
      <article className="profile-setup-card"><div className="profile-setup-cover"><span>{t.draft}</span><Icon name="leaf" size={28} /></div><div className="profile-setup-card-content">{avatar('preview-avatar')}<span className="profile-setup-role-tag">{role?.title}</span><h3>{draft.name.trim() || t.emptyName}</h3><p className="profile-setup-handle" dir="ltr">@{draft.username || t.emptyUsername}</p><p className="profile-setup-bio">{draft.bio.trim() || t.aboutEmpty}</p><div className="profile-setup-card-row"><strong>{t.role}</strong><span>{role?.title}</span></div><div className="profile-setup-preview-interests"><strong>{t.interests}</strong><div>{draft.interests.length ? draft.interests.map(id => <span key={id}>{copy.categories[id]}</span>) : <small>{t.nextStep}</small>}</div></div></div></article>
      <p className="profile-setup-preview-hint">{t.previewHint}</p>
    </aside>
  </div>;
}
