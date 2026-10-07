export function issueCourseWarning(state, incident) {
  if (!incident.verified || !incident.id?.trim() || !incident.reason?.trim() || !incident.correction?.trim() || !incident.deadline) throw new Error('A verified incident, reason, correction and deadline are required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incident.deadline) || !Number.isFinite(Date.parse(incident.deadline)) || new Date(incident.deadline).toISOString().slice(0,10) !== incident.deadline || incident.deadline < new Date().toISOString().slice(0,10)) throw new Error('A valid future correction deadline is required.');
  const warnings = state.warnings || [];
  if (warnings.some(item => item.id === incident.id)) throw new Error('This incident already has a warning.');
  if (warnings.length >= 3) throw new Error('The course is already archived.');
  const next = [...warnings, { ...incident, createdAt: new Date().toISOString() }];
  return { ...state, warnings: next, status: next.length === 3 ? 'archived' : state.status || 'active', enrollmentPaused: next.length >= 2 || state.enrollmentPaused };
}
export function readCourseSafety(value) {
  if (!value || !Array.isArray(value.warnings) || value.warnings.length > 3 || !value.warnings.every(item => item && typeof item.id === 'string' && typeof item.reason === 'string' && typeof item.correction === 'string' && typeof item.deadline === 'string') || new Set(value.warnings.map(item=>item.id)).size !== value.warnings.length) return emptyCourseSafety();
  const count=value.warnings.length;
  return {...emptyCourseSafety(),...value,status:count===3 ? 'archived' : ['active','suspended'].includes(value.status) ? value.status : 'active',enrollmentPaused:count>=2 || value.status==='suspended',appeal:typeof value.appeal==='string'?value.appeal:''};
}
export const emptyCourseSafety = () => ({ warnings: [], status: 'active', enrollmentPaused: false, appeal: '' });
