// Client-side copy of backend/src/lib/atsMatch.js scoring, used only to
// *estimate* the score after the user's saved bullet edits (Export screen).
// Keep the weights in sync with the backend.
function countOccurrences(haystack, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (haystack.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []).length;
}

function surfaceText(parsed, overrides) {
  const parts = [
    parsed?.summary || '',
    ...(parsed?.skills || []),
    ...(parsed?.experience || []).flatMap((exp) => [
      exp.title || '',
      exp.company || '',
      ...(exp.bullets || []).map((b) => overrides?.get(b.id) ?? b.text),
    ]),
  ];
  return parts.join(' \n ').toLowerCase();
}

export function estimateScore(parsed, requiredSkills, overrides) {
  const norm = (k) => (k || '').toLowerCase().trim();
  const critical = [...new Set((requiredSkills?.critical || []).map(norm))].filter(Boolean);
  const secondary = [...new Set((requiredSkills?.secondary || []).map(norm))].filter((k) => k && !critical.includes(k));
  const total = critical.length * 2 + secondary.length;
  if (!total) return 50;
  const surface = surfaceText(parsed, overrides);
  let earned = 0;
  for (const kw of critical) {
    const c = countOccurrences(surface, kw);
    earned += c >= 2 ? 2 : c === 1 ? 1 : 0;
  }
  for (const kw of secondary) {
    const c = countOccurrences(surface, kw);
    earned += c >= 2 ? 1 : c === 1 ? 0.5 : 0;
  }
  return Math.max(0, Math.min(100, Math.round((earned / total) * 100)));
}
