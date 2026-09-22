import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import ScoreRing from '../components/ScoreRing.jsx';
import { api } from '../api.js';

function scoreColor(score) {
  if (score >= 75) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--error)';
}

// Screen 4: Analysis Results Dashboard
export default function Results() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [resume, setResume] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { analysis: a } = await api.getAnalysis(analysisId);
        setAnalysis(a);
        const [{ resume: r }, { suggestions: s }] = await Promise.all([
          api.getResume(a.resumeId),
          api.listBulletSuggestions(analysisId),
        ]);
        setResume(r);
        setSuggestions(s);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [analysisId]);

  if (error) {
    return (
      <AppShell>
        <main style={{ maxWidth: 620, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--error)' }}>{error}</p>
        </main>
      </AppShell>
    );
  }
  if (!analysis || !resume) return null;

  const selectedByBullet = new Map(suggestions.filter((s) => s.selectedText).map((s) => [s.bulletId, s.selectedText]));
  const color = scoreColor(analysis.score);

  return (
    <AppShell>
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '56px 24px 96px' }}>
        <div className="lg-card" style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', marginBottom: 40, borderRadius: 20, padding: 24 }}>
          <ScoreRing score={analysis.score} size={108} innerSize={86} gradient={`conic-gradient(${color} 0% ${analysis.score}%, var(--hairline) ${analysis.score}% 100%)`}>
            <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--ink)' }}>{analysis.score}%</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Match</div>
          </ScoreRing>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.224, color, marginBottom: 8 }}>ATS Match Score</div>
            <p style={{ fontSize: 16, color: 'var(--ink2)', margin: 0, maxWidth: 460 }}>
              {analysis.score >= 75
                ? 'Strong match — this resume already covers most of what this job asks for.'
                : analysis.score >= 50
                  ? 'Decent match, but there are gaps worth closing before you apply.'
                  : "This resume doesn't cover much of what this job is asking for yet."}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 24, marginBottom: 40 }}>
          <KeywordList title={`Matched (${analysis.matchedKeywords.length})`} items={analysis.matchedKeywords} color="var(--success)" />
          <KeywordList title={`Missing — Critical (${analysis.missingCritical.length})`} items={analysis.missingCritical} color="var(--error)" />
          <KeywordList title={`Missing — Secondary (${analysis.missingSecondary.length})`} items={analysis.missingSecondary} color="var(--ink3)" />
          <KeywordList title={`Weak (${analysis.weakKeywords.length})`} items={analysis.weakKeywords} color="var(--warning)" />
        </div>

        <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.224, color: 'var(--ink3)', margin: '0 0 14px' }}>Recommendations</h2>
        <ul style={{ margin: '0 0 40px', paddingLeft: 20 }}>
          {analysis.recommendations.map((r, i) => (
            <li key={i} style={{ fontSize: 15, color: 'var(--ink2)', marginBottom: 8, lineHeight: 1.5 }}>
              {r}
            </li>
          ))}
        </ul>

        <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.224, color: 'var(--ink3)', margin: '0 0 14px' }}>
          Resume bullets — select one to improve
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
          {(resume.parsed?.experience || []).flatMap((exp) =>
            (exp.bullets || []).map((b) => (
              <div
                key={b.id}
                onClick={() => navigate(`/results/${analysisId}/bullets/${b.id}`)}
                className="lg-card"
                style={{ borderRadius: 14, padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 3 }}>{[exp.title, exp.company].filter(Boolean).join(' — ')}</div>
                  <div style={{ fontSize: 14.5, color: 'var(--ink)' }}>{selectedByBullet.get(b.id) || b.text}</div>
                </div>
                {selectedByBullet.has(b.id) ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', flex: 'none' }}>Improved ✓</span>
                ) : (
                  <span style={{ fontSize: 20, color: 'var(--ink3)', flex: 'none' }}>›</span>
                )}
              </div>
            ))
          )}
          {!resume.parsed?.experience?.length ? (
            <p style={{ fontSize: 14, color: 'var(--ink3)' }}>No bullets were extracted from this resume.</p>
          ) : null}
        </div>

        <button className="btn-primary" style={{ padding: '12px 24px' }} onClick={() => navigate(`/results/${analysisId}/download`)}>
          Continue to Download
        </button>
      </main>
    </AppShell>
  );
}

function KeywordList({ title, items, color }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: -0.12, color, marginBottom: 8 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--ink3)' }}>—</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map((k) => (
            <span key={k} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 9999, background: 'var(--parchment)', color: 'var(--ink)' }}>
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
