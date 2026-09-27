export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fileKind(filename = '') {
  return /\.docx$/i.test(filename) ? 'docx' : 'pdf';
}

export function kb(bytes) {
  return `${Math.max(1, Math.round((bytes || 0) / 1024))} KB`;
}

export function scoreLevel(n) {
  if (n >= 75) return { key: 'good', word: 'Strong', icon: 'check' };
  if (n >= 50) return { key: 'fair', word: 'Fair', icon: 'bang' };
  return { key: 'bad', word: 'Low', icon: 'x' };
}

export function jobLabel(job) {
  if (!job) return 'Job posting';
  return job.title || 'Untitled role';
}

// Every bullet on the parsed resume, in order, with where it came from.
export function resumeBullets(parsed) {
  const out = [];
  for (const exp of parsed?.experience || []) {
    const where = [exp.title, exp.company].filter(Boolean).join(' · ') || 'Experience';
    for (const b of exp.bullets || []) out.push({ ...b, where });
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function containsKeyword(text, kw) {
  if (!kw) return false;
  return new RegExp(`\\b${escapeRe(kw.trim())}\\b`, 'i').test(text || '');
}

// Split text into [{text, mark}] segments so job keywords can be highlighted without innerHTML.
export function highlightKeywords(text, keywords) {
  const kws = [...new Set((keywords || []).map((k) => k.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!kws.length) return [{ text, mark: false }];
  const re = new RegExp(`\\b(${kws.map(escapeRe).join('|')})\\b`, 'gi');
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), mark: false });
    parts.push({ text: m[0], mark: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mark: false });
  return parts;
}

export function safeFileName(s) {
  return (s || 'resume').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 60) || 'resume';
}
