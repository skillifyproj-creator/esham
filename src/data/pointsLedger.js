import { pointsPolicy } from './pointsPolicy';
import { courses } from './courses';

const KEY = 'esham-points-ledger-v1';
export const POINTS_EVENT = 'esham-points-updated';
export function accountId(profile = {}) {
  return String(profile.id || (profile.username ? `user:${profile.username.toLowerCase()}` : 'demo-learner'));
}
function readLedger() {
  const value = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (!value) return { accounts: {}, enrollments: [] };
  if (!value.accounts || !Array.isArray(value.enrollments)) throw new Error('storage');
  return value;
}
function ensureAccount(ledger, id) {
  if (!Object.hasOwn(ledger.accounts, id)) ledger.accounts[id] = { transactions: [
    { id: `opening:${id}`, type: 'opening', points: pointsPolicy.openingBalance, createdAt: new Date().toISOString() },
  ] };
  return ledger.accounts[id];
}
const total = account => account.transactions.reduce((sum, item) => sum + item.points, 0);
function save(ledger) {
  localStorage.setItem(KEY, JSON.stringify(ledger));
  if (typeof window?.dispatchEvent === 'function') window.dispatchEvent(new Event(POINTS_EVENT));
}
// This local ledger is a preview adapter. Production transactions must run on the server.
export function initializeWallet(profile) {
  const ledger = readLedger(), id = accountId(profile);
  if (!Object.hasOwn(ledger.accounts, id)) { ensureAccount(ledger, id); save(ledger); }
  return getAccountWallet(profile);
}
export function getAccountWallet(profile) {
  const ledger = readLedger(), id = accountId(profile);
  const account = ensureAccount(ledger, id);
  const transactions = [...account.transactions].reverse();
  return {
    balance: total(account),
    earned: transactions.filter(t => t.type === 'teaching').reduce((sum, t) => sum + t.points, 0),
    spent: -transactions.filter(t => t.type === 'enrollment').reduce((sum, t) => sum + t.points, 0),
    transactions,
    enrollments: ledger.enrollments.filter(item => item.learnerId === id),
  };
}
export function enrollWithPoints(profile, courseId) {
  if (!['learner', 'both'].includes(profile?.role)) throw new Error('learner-role');
  const course = courses.find(item => String(item.id) === String(courseId));
  if (!course) throw new Error('course');
  const id = accountId(profile);
  if (course.instructorId === id) throw new Error('own-course');
  const ledger = readLedger();
  const existing = ledger.enrollments.find(item => item.learnerId === id && item.courseId === course.id);
  if (existing) return existing;
  const learner = ensureAccount(ledger, id);
  if (total(learner) < pointsPolicy.enrollmentCost) throw new Error('balance');
  const instructor = ensureAccount(ledger, course.instructorId);
  const enrollment = { id: `${id}:${course.id}`, learnerId: id, instructorId: course.instructorId, courseId: course.id, enrolledAt: new Date().toISOString() };
  learner.transactions.push({ id: `enrollment:${enrollment.id}`, type: 'enrollment', points: -pointsPolicy.enrollmentCost, courseId: course.id, createdAt: enrollment.enrolledAt });
  instructor.transactions.push({ id: `teaching:${enrollment.id}`, type: 'teaching', points: pointsPolicy.instructorEnrollmentReward, courseId: course.id, learnerId: id, createdAt: enrollment.enrolledAt });
  ledger.enrollments.push(enrollment);
  // One write commits registration, debit and instructor credit together.
  save(ledger);
  return enrollment;
}
