import { useState } from "react";
import { teachingSkillsCopy } from "../../i18n/teachingSkillsCopy";
import { usePreferences } from '../../context/PreferencesContext';
import { onboardingCopy } from '../../i18n/onboardingCopy';
import { interestAreas, interestsCopy } from '../../data/interestAreas';
import { courses } from '../../data/courses';
import Icon from '../../components/Icon';
import '../../styles/onboarding-interests.css';

export default function InterestsSetup({ draft, update, mode = "learning" }) {
  const { language } = usePreferences();
  const t = interestsCopy[language];
  const copy = onboardingCopy[language];
  const teaching = mode === "teaching";
  const s = teachingSkillsCopy[language];
  const selectedAreas = teaching ? draft.teachingAreas : draft.interests;
  const field = teaching ? "teachingAreas" : "interests";
  const [query, setQuery] = useState('');
  const searchCopy = language === 'ar'
    ? { label: teaching ? 'ابحث عن مجال خبرتك' : 'ابحث عن مجال تتعلّمه', placeholder: 'ابحث باسم المجال أو وصفه…', clear: 'مسح البحث', empty: 'لا توجد مجالات مطابقة. جرّب كلمة أخرى.', results: 'مجالات مطابقة' }
    : { label: teaching ? 'Search your expertise areas' : 'Search learning areas', placeholder: 'Search by area name or description…', clear: 'Clear search', empty: 'No matching areas. Try another search.', results: 'matching areas' };
  const normalizeSearch = value => value.normalize('NFKD').toLowerCase().replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').trim();
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const visibleAreas = interestAreas.map((area, index) => ({ area, index })).filter(({ area, index }) => {
    const text = normalizeSearch([copy.categories[index], index === 5 ? t.business : '', area.description[language], area.category].join(' '));
    return words.every(word => text.includes(word));
  });
  const [skill, setSkill] = useState("");
  const [skillError, setSkillError] = useState("");
  const selectedCount = selectedAreas.length + (teaching ? draft.customSkills.length : 0);
  function addSkill() {
    const value = skill.trim().replace(/\s+/g, ' ');
    const normalize = text => text.normalize('NFKC').toLocaleLowerCase();
    const existing = [...draft.customSkills, ...copy.categories];
    const invalid = Array.from(value).length < 2 || Array.from(value).length > 80 ? 'invalid' : existing.some(item => normalize(item) === normalize(value)) ? 'duplicate' : draft.customSkills.length >= 10 ? 'limit' : '';
    if (invalid) { setSkillError(invalid); return; }
    update({ customSkills: [...draft.customSkills, value] });
    setSkill(''); setSkillError('');
  }
  const role = copy.roles.find(item => item.id === draft.role);
  function toggle(index) { update({ [field]: selectedAreas.includes(index) ? selectedAreas.filter(id => id !== index) : [...selectedAreas, index] }); }
  return <div className="interests-setup">
    <h2 className="skills-section-heading">{teaching ? s.heading : s.learningHeading}</h2>
    <div className="interests-path"><Icon name={draft.role === 'instructor' ? 'user' : draft.role === 'both' ? 'swap' : 'book'} size={18} /><span>{t.path}: {role?.title}</span></div>
    <div className="interests-selection-bar"><p><Icon name="grid" size={20} />{teaching ? s.multiple : t.multiple}</p><div><span className="interests-count" role="status">{selectedCount} {teaching ? s.count : t.selected}</span>{selectedCount > 0 && <button type="button" onClick={() => update(teaching ? { teachingAreas: [], customSkills: [] } : { interests: [] })}>{t.clear}</button>}</div></div>
    <div className="interests-search">
      <label htmlFor={`areas-search-${mode}`}>{searchCopy.label}</label>
      <div className="interests-search-input"><Icon name="search" size={21} /><input id={`areas-search-${mode}`} type="search" value={query} placeholder={searchCopy.placeholder} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} />{query && <button type="button" aria-label={searchCopy.clear} onClick={() => setQuery('')}><Icon name="close" size={19} /></button>}</div>
      <p role="status">{visibleAreas.length} {searchCopy.results}</p>
    </div>
    {!visibleAreas.length && <p className="interests-search-empty">{searchCopy.empty}</p>}
    <fieldset className="interests-card-grid"><legend className="sr-only">{teaching ? s.heading : s.learningHeading}</legend>{visibleAreas.map(({ area, index }) => {
      const selected = selectedAreas.includes(index);
      const title = index === 5 ? t.business : copy.categories[index];
      const matching = courses.filter(course => course.category === area.category);
      return <label key={area.category} className={`interests-card${selected ? ' selected' : ''}`}>
        <input type="checkbox" checked={selected} onChange={() => toggle(index)} aria-label={title} aria-describedby={`${mode}-${area.category}-description`} />
        <div className="interests-card-top"><span className="interests-card-icon"><Icon name={area.icon} size={25} /></span><span className="interests-check" aria-hidden="true">{selected ? '✓' : ''}</span></div>
        <h2>{title}</h2><p id={`${mode}-${area.category}-description`}>{area.description[language]}</p>
        {!teaching && <div className="interests-catalog-info"><span>{matching.length ? `${matching.length} ${matching.length === 1 ? t.course : t.courses}` : t.empty}</span></div>}
        <div className="interests-card-bottom"><span>{teaching ? selected ? s.selected : s.select : selected ? t.chosen : t.choose}</span><span aria-hidden="true">{selected ? '✓' : '+'}</span></div>
      </label>;
    })}</fieldset>
    {teaching && <section className="custom-skills-panel" aria-labelledby="custom-skills-title">
      <h3 id="custom-skills-title">{s.customTitle}</h3><p>{s.customHint}</p>
      <label className="sr-only" htmlFor="custom-teaching-skill">{s.placeholder}</label>
      <div className="custom-skills-input"><input id="custom-teaching-skill" value={skill} maxLength={80} placeholder={s.placeholder} onChange={event => { setSkill(event.target.value); setSkillError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSkill(); } }} aria-invalid={Boolean(skillError)} aria-describedby={skillError ? 'custom-skill-error' : undefined} /><button type="button" onClick={addSkill}>{s.add} +</button></div>
      {skillError && <p className="custom-skills-error" id="custom-skill-error" role="alert">{s[skillError]}</p>}
      {draft.customSkills.length > 0 && <ul className="custom-skills-list" aria-label={s.customLabel}>{draft.customSkills.map(value => <li key={value}><span>{value}</span><button type="button" aria-label={`${s.remove}: ${value}`} onClick={() => update({ customSkills: draft.customSkills.filter(item => item !== value) })}>×</button></li>)}</ul>}
    </section>}
    <aside className="interests-policy-note"><Icon name="info" size={22} /><p>{teaching ? s.note : t.note}</p></aside>
  </div>;
}
