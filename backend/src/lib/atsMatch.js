// FR-4.1 / FR-4.2: deterministic keyword matching (not an AI call, so this
// comfortably meets the <3s budget in NFR-1.3 and is explainable/reproducible).

function normalizeKeyword(k) {
  return (k || '').toLowerCase().trim();
}

function countOccurrences(haystack, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'gi');
  return (haystack.match(re) || []).length;
}

function resumeSurfaceText(resume) {
  const parts = [
    resume.summary || '',
    ...(resume.skills || []),
    ...(resume.experience || []).flatMap((exp) => [
      exp.title || '',
      exp.company || '',
      ...(exp.bullets || []).map((b) => b.text),
    ]),
  ];
  return parts.join(' \n ').toLowerCase();
}

// Returns { score, matchedKeywords, missingCritical, missingSecondary, weakKeywords, recommendations }
export function computeMatch(resume, job) {
  const surface = resumeSurfaceText(resume);
  const critical = [...new Set((job.requiredSkills?.critical || []).map(normalizeKeyword))].filter(Boolean);
  const secondary = [...new Set((job.requiredSkills?.secondary || []).map(normalizeKeyword))].filter(
    (k) => Boolean(k) && !critical.includes(k)
  );

  const matched = [];
  const weak = [];
  const missingCritical = [];
  const missingSecondary = [];

  let earned = 0;
  const totalWeight = critical.length * 2 + secondary.length * 1;

  for (const kw of critical) {
    const count = countOccurrences(surface, kw);
    if (count >= 2) {
      matched.push(kw);
      earned += 2;
    } else if (count === 1) {
      weak.push(kw);
      earned += 1;
    } else {
      missingCritical.push(kw);
    }
  }
  for (const kw of secondary) {
    const count = countOccurrences(surface, kw);
    if (count >= 2) {
      matched.push(kw);
      earned += 1;
    } else if (count === 1) {
      weak.push(kw);
      earned += 0.5;
    } else {
      missingSecondary.push(kw);
    }
  }

  const score = totalWeight === 0 ? null : Math.round((earned / totalWeight) * 100);

  const recommendations = [];
  for (const kw of missingCritical.slice(0, 5)) {
    recommendations.push(`Add "${kw}" somewhere in your resume if it reflects real experience — it's a required keyword for this role.`);
  }
  if (weak.length) {
    recommendations.push(`These keywords appear only once — mention them again in context to strengthen the match: ${weak.slice(0, 5).join(', ')}.`);
  }
  if (score !== null && score < 60) {
    recommendations.push('Your overall match is low. Consider whether this role is a strong fit, or tailor your bullets toward the missing critical keywords above.');
  }
  if (!recommendations.length) {
    recommendations.push('Strong match — no major keyword gaps found.');
  }

  return {
    score: score === null ? 50 : Math.max(0, Math.min(100, score)),
    matchedKeywords: matched,
    missingCritical,
    missingSecondary,
    weakKeywords: weak,
    recommendations,
  };
}
