import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { api } from '../api.js';

// Screen 5: Bullet Improvement Interface
export default function BulletImprove() {
  const { analysisId, bulletId } = useParams();
  const navigate = useNavigate();
  const [originalText, setOriginalText] = useState(null);
  const [options, setOptions] = useState(null); // [{ text, flagged }]
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedTexts, setEditedTexts] = useState({});
  const [manualText, setManualText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allowManual, setAllowManual] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { analysis } = await api.getAnalysis(analysisId);
        const { resume } = await api.getResume(analysis.resumeId);
        let found = null;
        for (const exp of resume.parsed?.experience || []) {
          const b = (exp.bullets || []).find((x) => x.id === bulletId);
          if (b) found = b;
        }
        setOriginalText(found?.text || '');

        const { suggestions } = await api.listBulletSuggestions(analysisId);
        const existing = suggestions.find((s) => s.bulletId === bulletId);
        if (existing?.options?.length) {
          setOptions(existing.options);
          setSelectedIndex(existing.selectedIndex);
          setLoading(false);
        } else {
          await generate();
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId, bulletId]);

  const generate = async () => {
    setLoading(true);
    setError('');
    setAllowManual(false);
    try {
      const { suggestion } = await api.generateBulletOptions(analysisId, bulletId);
      setOptions(suggestion.options);
    } catch (err) {
      setError(err.message); // NFR-4.3
      if (err.allowManualEdit) setAllowManual(true);
    } finally {
      setLoading(false);
    }
  };

  const save = async (payload) => {
    setSaving(true);
    try {
      await api.selectBulletOption(analysisId, bulletId, payload);
      navigate(`/results/${analysisId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 96px' }}>
        <a onClick={() => navigate(`/results/${analysisId}`)} style={{ fontSize: 13, color: 'var(--ink3)', cursor: 'pointer', textDecoration: 'none' }}>
          ← Back to results
        </a>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, margin: '14px 0 20px', color: 'var(--ink)' }}>
          Improve this bullet
        </h1>

        <div style={{ background: 'var(--pearl)', borderRadius: 14, padding: 16, marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: -0.12, color: 'var(--primary)', marginBottom: 6 }}>Original</div>
          <div style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.5 }}>{originalText}</div>
        </div>

        {error ? (
          <div style={{ background: 'rgba(224,82,82,.08)', color: 'var(--error)', fontSize: 14, padding: '10px 14px', borderRadius: 12, marginBottom: 20 }}>
            {error}
          </div>
        ) : null}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink3)', fontSize: 14 }}>
            <div style={{ width: 16, height: 16, borderRadius: 9999, border: '2px solid var(--hairline)', borderTopColor: 'var(--primary)', animation: 'formaSpin 1s linear infinite' }} />
            Generating 3 tailored rewrites…
          </div>
        ) : options ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {options.map((opt, i) => (
              <div
                key={i}
                className="lg-card"
                style={{
                  borderRadius: 16,
                  padding: 18,
                  outline: selectedIndex === i ? '2px solid var(--primary)' : 'none',
                  outlineOffset: 2,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink3)' }}>Option {i + 1}</span>
                  {opt.flagged ? (
                    <span title="This option mentions a skill not found elsewhere in your resume." style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>
                      ⚠ Double-check this
                    </span>
                  ) : null}
                </div>

                {editingIndex === i ? (
                  <textarea
                    value={editedTexts[i] ?? opt.text}
                    onChange={(e) => setEditedTexts((s) => ({ ...s, [i]: e.target.value }))}
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 15, padding: 10, borderRadius: 10, border: '1px solid var(--hairline)', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                ) : (
                  <p style={{ fontSize: 15.5, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.5 }}>{editedTexts[i] ?? opt.text}</p>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '6px 14px', fontSize: 13 }}
                    onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                  >
                    {editingIndex === i ? 'Done editing' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: 13 }}
                    onClick={() => save({ index: i, text: editedTexts[i] ?? opt.text })}
                  >
                    Select &amp; Save
                  </button>
                </div>
              </div>
            ))}

            <button type="button" onClick={generate} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start' }}>
              Regenerate options
            </button>
          </div>
        ) : null}

        {allowManual ? (
          <div style={{ marginTop: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>
              Edit this bullet manually instead
            </label>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={3}
              placeholder={originalText}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 15, padding: 10, borderRadius: 10, border: '1px solid var(--hairline)', fontFamily: 'inherit', resize: 'vertical', marginBottom: 10 }}
            />
            <button
              type="button"
              disabled={!manualText.trim() || saving}
              className="btn-primary"
              style={{ padding: '8px 18px' }}
              onClick={() => save({ text: manualText.trim() })}
            >
              Save Manual Edit
            </button>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
