export function passwordRequirements(value) {
  return { length: Array.from(value).length >= 8, letter: /\p{L}/u.test(value), number: /\p{N}/u.test(value) };
}
export function passwordStrength(value) {
  const rules = passwordRequirements(value);
  if (!rules.length || !rules.letter || !rules.number) return 1;
  return Array.from(value).length >= 12 && /[^\p{L}\p{N}\s]/u.test(value) ? 3 : 2;
}
