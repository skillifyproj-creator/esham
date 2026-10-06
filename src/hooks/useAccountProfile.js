import { useEffect, useState } from 'react';

const validRoles = ['learner', 'instructor', 'both'];

function normalizeAccountProfile(value) {
  if (!value || typeof value !== 'object') return null;

  const declaredRoles = Array.isArray(value.roles) ? value.roles : [];
  const hasLearner =
    value.role === 'learner' ||
    value.role === 'both' ||
    declaredRoles.includes('learner') ||
    value.isLearner === true ||
    value.learner === true;
  const hasInstructor =
    value.role === 'instructor' ||
    value.role === 'both' ||
    declaredRoles.includes('instructor') ||
    value.isInstructor === true ||
    value.instructor === true;

  if (hasLearner && hasInstructor) return { ...value, role: 'both' };
  if (value.role === 'learner' || value.role === 'instructor') return value;
  if (declaredRoles.includes('learner')) return { ...value, role: 'learner' };
  if (declaredRoles.includes('instructor')) return { ...value, role: 'instructor' };
  return null;
}

export function readAccountProfile() {
  for (const [storage, key] of [
    [localStorage, 'esham-account-profile-v1'],
    [sessionStorage, 'esham-onboarding-draft-v1'],
  ]) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      const profile = normalizeAccountProfile(value);
      if (profile && validRoles.includes(profile.role)) return profile;
    } catch {
      /* Use the next available source. */
    }
  }
  return { role: '', interests: [] };
}

export default function useAccountProfile() {
  const [profile, setProfile] = useState(readAccountProfile);

  useEffect(() => {
    const refresh = () => setProfile(readAccountProfile());
    window.addEventListener('esham-profile-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('esham-profile-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return profile;
}
