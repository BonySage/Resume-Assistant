const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Control characters other than tab (\x09), newline (\x0A) and carriage return (\x0D).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// NFR-2.4: normalize free-text input (e.g. a pasted job description) before it
// is stored or sent to the AI. Text is kept verbatim otherwise: "R&D" and
// "C++ < 5 yrs" must survive intact. XSS is prevented where text is rendered
// (React escapes it) and SQL injection by parameterized queries.
export function cleanText(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/\r\n?/g, '\n').replace(CONTROL_CHARS_RE, '').trim();
}

export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email);
}

// FR-1.1: minimum 8 characters, mixed case, numbers.
export function passwordStrengthError(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return 'Password must include both uppercase and lowercase letters.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  return null;
}
