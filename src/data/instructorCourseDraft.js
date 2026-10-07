const key = 'esham-instructor-course-draft-v1';
export function readInstructorCourseDraft() {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const bilingual = text => typeof text === 'string' ? { ar: text, en: '' } : { ar: typeof text?.ar === 'string' ? text.ar : '', en: typeof text?.en === 'string' ? text.en : '' };
    return { ...value, title: bilingual(value.title), description: bilingual(value.description), objectives: Array.isArray(value.objectives) ? value.objectives : [], curriculum: Array.isArray(value.curriculum) ? value.curriculum.filter(section => section && typeof section === 'object' && Array.isArray(section.lessons)) : [] };
  } catch { return null; }
}
export function saveInstructorCourseDraft(patch) {
  try { sessionStorage.setItem(key, JSON.stringify({ ...readInstructorCourseDraft(), ...patch })); return true; } catch { return false; }
}
