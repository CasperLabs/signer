import { FieldState } from 'formstate';
import owasp from 'owasp-password-strength-test';

owasp.tests.required.push((password: string) => {
  const passwordString = password.toString() as String;
  if (passwordString.match(/correct\s*horse\s*battery\s*staple/i) !== null) {
    return 'Use your imagination not the example!';
  }
});

export const valueRequired = (val: string) => !val && 'Value required';

export const valuesMatch = (val1: string, val2: string) =>
  !(val1 === val2) && 'Passwords must match';

export const isAlgorithm = (val: string) =>
  !(val === 'ed25519' || val === 'secp256k1') && 'Invalid Algorithm';

export const fieldSubmittable = (val: FieldState<string>) => {
  return val.hasBeenValidated && !val.hasError;
};

export const minNameLength = (val: string) => {
  return !(val.length > 2) && 'Invalid name - too short';
};

export const humanReadable = (val: string) => {
  // Accept any alphanumeric (also underscores)
  const humanReadableRegex = /^[A-Za-zÀ-ÖØ-öø-ÿœ0-9_]+$/;
  return (
    !val.match(humanReadableRegex) &&
    'Invalid name - only use A-Z, a-z, 0-9 and _'
  );
};

export const strongPassword = (val: string) => {
  const result = owasp.test(val);
  return !result.strong && result.errors[0];
};
