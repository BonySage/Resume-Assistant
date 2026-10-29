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

// A browser-supplied file name, made safe to store and show: no control
// characters or line breaks, at most 255 characters.
export function cleanFilename(name) {
  // The cut can land inside an emoji's surrogate pair; drop the dangling half.
  return cleanText(name).replace(/[\t\n\r]+/g, ' ').trim().slice(0, 255).replace(/[\uD800-\uDBFF]$/, '') || 'resume';
}

// Table ids are SERIAL: positive integers up to Postgres's INTEGER max.
const MAX_DB_ID = 2_147_483_647;
export function isValidId(value) {
  return typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= MAX_DB_ID;
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
  // bcrypt only uses the first 72 bytes; anything longer would be silently cut off.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return 'Password is too long. Use at most 72 characters (fewer if it has accents or emoji).';
  }
  return null;
}
