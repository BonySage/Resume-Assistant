import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { api } from '../api.js';

// Screen 6: Export/Download Page
export default function Download() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [overrides, setOverrides] = useState(new Map());
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { analysis } = await api.getAnalysis(analysisId);
        const [{ resume: r }, { suggestions }] = await Promise.all([
          api.getResume(analysis.resumeId),
          api.listBulletSuggestions(analysisId),
        ]);
        setResume(r);
        setOverrides(new Map(suggestions.filter((s) => s.selectedText).map((s) => [s.bulletId, s.selectedText])));
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [analysisId]);

  if (error) {
    return (
      <AppShell>
        <main style={{ maxWidth: 440, margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--error)' }}>{error}</p>
        </main>
      </AppShell>
    );
  }
  if (!resume) return null;

  const improvedCount = overrides.size;

  return (
    <AppShell>
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '80px 24px 96px', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, margin: '0 auto 22px', borderRadius: 9999, background: 'var(--chip)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 16, height: 9, borderLeft: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)', transform: 'rotate(-45deg)', marginBottom: 4 }} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, margin: '0 0 10px', color: 'var(--ink)' }}>
          Your resume is ready.
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink2)', margin: '0 0 30px' }}>
          {improvedCount > 0
            ? `${improvedCount} bullet${improvedCount === 1 ? '' : 's'} improved and applied. Download the updated resume below.`
            : "No bullets have been improved yet — you'll still get a clean PDF of the parsed resume."}
        </p>

        <div style={{ textAlign: 'left', border: '1px solid var(--hairline)', borderRadius: 18, padding: 18, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink3)', marginBottom: 12 }}>Format</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--ink)', marginBottom: 8 }}>
            <input type="radio" checked readOnly /> PDF (required)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--ink3)' }} title="DOCX export isn't implemented in this MVP.">
            <input type="radio" disabled /> DOCX (optional — not available yet)
          </label>
        </div>

        <a
          href={api.exportUrl(analysisId)}
          className="lg-cta"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: 17, color: '#fff', background: 'var(--primary)', border: 'none', padding: 13, borderRadius: 9999, cursor: 'pointer', marginBottom: 12, textDecoration: 'none' }}
        >
          Download Updated Resume
          <span className="lg-shimmer" />
        </a>
        <button className="btn-outline" style={{ width: '100%', padding: 12, marginBottom: 12 }} onClick={() => setShowPreview((s) => !s)}>
          {showPreview ? 'Hide preview' : 'Preview before downloading'}
        </button>
        <button className="btn-outline" style={{ width: '100%', padding: 12 }} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>

        {showPreview ? (
          <div style={{ textAlign: 'left', marginTop: 24, border: '1px solid var(--hairline)', borderRadius: 18, padding: 24, background: 'var(--canvas)' }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4, color: 'var(--ink)' }}>{resume.parsed?.contactInfo?.name || resume.filename}</div>
            {resume.parsed?.summary ? <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: '8px 0' }}>{resume.parsed.summary}</p> : null}
            {(resume.parsed?.experience || []).map((exp, i) => (
              <div key={i} style={{ marginTop: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{[exp.title, exp.company].filter(Boolean).join(' — ')}</div>
                {(exp.bullets || []).map((b) => (
                  <div key={b.id} style={{ fontSize: 13, color: 'var(--ink2)', margin: '4px 0 4px 14px' }}>
                    • {overrides.get(b.id) || b.text}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
