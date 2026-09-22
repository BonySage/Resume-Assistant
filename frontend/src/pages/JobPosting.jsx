import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { api } from '../api.js';

// Screen 3: Job Posting Input
export default function JobPosting() {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offerFallback, setOfferFallback] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setOfferFallback(false);
    setLoading(true);
    try {
      const { jobPosting } =
        tab === 'url' ? await api.createJobPostingFromUrl(url) : await api.createJobPostingFromText(text);
      const { analysis } = await api.createAnalysis(Number(resumeId), jobPosting.id);
      navigate(`/results/${analysis.id}`);
    } catch (err) {
      setError(err.message);
      if (err.fallbackToPaste) {
        setOfferFallback(true); // NFR-4.2
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <main style={{ maxWidth: 620, margin: '0 auto', padding: '56px 24px 96px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, margin: '0 0 10px', color: 'var(--ink)' }}>
          Add the job posting
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink2)', margin: '0 0 28px' }}>
          Paste a link to the listing, or paste the description text directly.
        </p>

        <div style={{ display: 'flex', gap: 4, background: 'var(--parchment)', padding: 4, borderRadius: 9999, width: 'fit-content', marginBottom: 20 }}>
          <TabButton active={tab === 'url'} onClick={() => setTab('url')}>
            Paste URL
          </TabButton>
          <TabButton active={tab === 'paste'} onClick={() => setTab('paste')}>
            Paste Description
          </TabButton>
        </div>

        {error ? (
          <div style={{ background: 'rgba(224,82,82,.08)', color: 'var(--error)', fontSize: 14, padding: '10px 14px', borderRadius: 12, marginBottom: 16 }}>
            {error}
            {offerFallback ? (
              <div style={{ marginTop: 8 }}>
                <a
                  onClick={() => {
                    setTab('paste');
                    setError('');
                    setOfferFallback(false);
                  }}
                  style={{ color: 'var(--error)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Switch to pasting the description instead →
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={submit}>
          {tab === 'url' ? (
            <>
              <label style={labelStyle}>Job posting URL</label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.linkedin.com/jobs/view/…"
                style={inputStyle}
              />
            </>
          ) : (
            <>
              <label style={labelStyle}>Job description</label>
              <textarea
                required
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the full job description here…"
                rows={10}
                style={{ ...inputStyle, borderRadius: 18, padding: 14, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </>
          )}

          <button type="submit" disabled={loading} className="lg-cta" style={{ marginTop: 20, width: '100%', fontSize: 17, color: '#fff', background: 'var(--primary)', border: 'none', padding: 13, borderRadius: 9999, cursor: 'pointer' }}>
            {loading ? (tab === 'url' ? 'Extracting…' : 'Analyzing…') : 'Match Resume to This Job'}
            <span className="lg-shimmer" />
          </button>
        </form>
      </main>
    </AppShell>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 18px',
        borderRadius: 9999,
        border: 'none',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        background: active ? 'var(--canvas)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink3)',
        boxShadow: active ? '0 1px 4px rgba(17,19,24,.12)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

const labelStyle = { display: 'block', fontSize: 14, fontWeight: 600, letterSpacing: -0.224, marginBottom: 6, color: 'var(--ink)' };
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  height: 44,
  padding: '0 18px',
  fontSize: 16,
  border: '1px solid rgba(0,0,0,.08)',
  borderRadius: 9999,
  outline: 'none',
};
