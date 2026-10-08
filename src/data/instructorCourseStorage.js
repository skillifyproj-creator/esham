const KEY = 'esham-instructor-courses-v1';
export function readSavedInstructorCourse(id) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    const course = saved[String(id)];
    return course && typeof course === 'object' && !Array.isArray(course) ? course : null;
  } catch { return null; }
}
export function persistInstructorCourse(id, patch) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    saved[String(id)] = { ...saved[String(id)], ...patch };
    localStorage.setItem(KEY, JSON.stringify(saved));
    return true;
  } catch { return false; }
}
