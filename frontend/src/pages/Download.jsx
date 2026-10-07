import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { Icon } from '../lib/icons.jsx';
import { Alert, LevelBadge, PageLoading, Steps } from '../lib/ui.jsx';
import { resumeBullets, safeFileName } from '../lib/format.js';
import { estimateScore } from '../lib/match.js';
import { api, loadAnalysisBundle } from '../api.js';

export function useExportSummary(data) {
  return useMemo(() => {
    if (!data) return null;
    const overrides = new Map(data.suggestions.filter((s) => s.selectedText).map((s) => [s.bulletId, s.selectedText]));
    const total = resumeBullets(data.resume.parsed).length;
    const improved = [...overrides.keys()].filter((id) => resumeBullets(data.resume.parsed).some((b) => b.id === id)).length;
    const after = estimateScore(data.resume.parsed, data.job.requiredSkills, overrides);
    return { overrides, total, improved, before: data.analysis.score, after: Math.max(after, data.analysis.score) };
  }, [data]);
}

function ResumeSheet({ parsed, overrides }) {
  const c = parsed.contactInfo || {};
  const contact = [c.email, c.phone, c.location].filter(Boolean).join(' · ');
  return (
    <article className="sheet" aria-label="Resume preview">
      <h3>{c.name || 'Your name'}</h3>
      {contact && <p style={{ color: '#45464f' }}>{contact}</p>}

      {parsed.summary && (
        <>
          <h4>Summary</h4>
          <p>{parsed.summary}</p>
        </>
      )}

      {parsed.experience?.length > 0 && <h4>Experience</h4>}
      {parsed.experience?.map((exp, i) => (
        <div key={i}>
          <div className="job"><span>{[exp.title, exp.company].filter(Boolean).join(' · ')}</span><span>{exp.dates}</span></div>
          <ul>
            {exp.bullets?.map((b) => {
              const next = overrides.get(b.id);
              return <li key={b.id} className={next ? 'updated' : undefined}>{next || b.text}</li>;
            })}
          </ul>
        </div>
      ))}

      {parsed.education?.length > 0 && <h4>Education</h4>}
      {parsed.education?.map((ed, i) => (
        <div className="job" key={i}><span>{[ed.degree, ed.school].filter(Boolean).join(' · ')}</span><span>{ed.dates}</span></div>
      ))}

      {parsed.skills?.length > 0 && (
        <>
          <h4>Skills</h4>
          <p>{parsed.skills.join(', ')}</p>
        </>
      )}
    </article>
  );
}

export default function Download() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [highlight, setHighlight] = useState(true);
  const [fname, setFname] = useState('');
  const [fnameErr, setFnameErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [dlError, setDlError] = useState('');
  const summary = useExportSummary(data);

  useEffect(() => {
    document.title = 'Export your resume · Forma';
    loadAnalysisBundle(analysisId)
      .then((d) => {
        setData(d);
        const who = d.resume.parsed?.contactInfo?.name || d.resume.filename.replace(/\.(pdf|docx)$/i, '');
        setFname(safeFileName(`${who} ${d.job.title || 'tailored'}`));
      })
      .catch((err) => setError(err.message));
  }, [analysisId]);

  const submit = async (e) => {
    e.preventDefault();
    const name = fname.trim();
    if (!/^[\w\- ]{1,60}$/.test(name)) {
      setFnameErr('Use letters, numbers, dashes or underscores only.');
      document.getElementById('fname').focus();
      return;
    }
    setFnameErr('');
    setDlError('');
    setBusy(true);
    try {
      const file = `${name}.pdf`;
      const size = await api.downloadExport(analysisId, file);
      navigate(`/results/${analysisId}/done`, { state: { file, size } });
    } catch (err) {
      setDlError(err.message);
      setBusy(false);
    }
  };

  if (error || !data) {
    return (
      <AppShell active="analyses" back={`/results/${analysisId}/improve`}>
        <main id="main" className="page"><div className="container">
          <Steps current={5} analysisId={analysisId} />
          {error ? <Alert tone="error" role="alert" title="We couldn’t load your resume">{error} <Link to="/dashboard">Back to dashboard</Link></Alert> : <PageLoading label="Building your preview…" />}
        </div></main>
      </AppShell>
    );
  }

  const parsed = data.resume.parsed;

  return (
    <AppShell active="analyses" back={`/results/${analysisId}/improve`}>
      <main id="main" className={`page${highlight ? ' show-changes' : ''}`}>
        <div className="container">
          <Steps current={5} analysisId={analysisId} />

          <div className="grid-main">
            <section aria-labelledby="preview-title">
              <div className="row-between" style={{ marginBottom: 16 }}>
                <div>
                  <p className="eyebrow">Main feature 4 · Export</p>
                  <h1 id="preview-title" style={{ marginTop: 6 }}>Preview your <em>tailored</em> resume</h1>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> <span>Highlight changes</span>
                  <span className="switch-state caption">{highlight ? 'On' : 'Off'}</span>
                </label>
              </div>

              {parsed ? <ResumeSheet parsed={parsed} overrides={summary.overrides} /> : <Alert tone="warn" title="No preview available">This resume has no structured data to preview.</Alert>}
              <p className="caption" style={{ textAlign: 'center', marginTop: 12 }}>Highlights appear only in this preview, not in your file</p>
            </section>

            <aside className="stack sticky" style={{ '--gap': '20px' }}>
              <section className="card card-ink glow" aria-labelledby="dl-title">
                <h2 id="dl-title">Ready to download</h2>
                <div className="row" style={{ marginTop: 12 }}>
                  <span className="badge badge-good"><Icon name="check" />{summary.improved} {summary.improved === 1 ? 'bullet' : 'bullets'} improved</span>
                  <span className="badge badge-neutral">{Math.max(0, summary.total - summary.improved)} unchanged</span>
                </div>
                <div className="row" style={{ marginTop: 16, gap: 14, alignItems: 'center' }}>
                  <div><div className="caption">Before</div><div className="mini-score"><span className="n">{summary.before}%</span></div></div>
                  <Icon name="arrow-right" />
                  <div>
                    <div className="caption">Estimated after</div>
                    <div className="mini-score"><span className="n">{summary.after}%</span><LevelBadge value={summary.after} /></div>
                  </div>
                </div>

                <hr className="divider-line" />
                <form onSubmit={submit}>
                  <div className="field">
                    <label className="label" htmlFor="fname">File name</label>
                    <div className="input-wrap">
                      <input className="input" id="fname" value={fname} onChange={(e) => setFname(e.target.value)} aria-describedby="fname-ext fname-msg"
                        aria-invalid={fnameErr ? 'true' : 'false'} style={{ paddingRight: 64 }} />
                      <span className="input-action mono" id="fname-ext" style={{ color: 'var(--ink-2)', pointerEvents: 'none' }}>.pdf</span>
                    </div>
                    <span className="msg msg-error" id="fname-msg" aria-live="polite">{fnameErr && <><Icon name="x-circle" />{fnameErr}</>}</span>
                  </div>

                  <fieldset style={{ border: 0, padding: 0, margin: '18px 0 0' }}>
                    <legend className="label" style={{ marginBottom: 8 }}>Format</legend>
                    <div className="stack" style={{ '--gap': '10px' }}>
                      <label className="format-opt check">
                        <input type="radio" name="fmt" value="pdf" defaultChecked />
                        <span><strong>PDF</strong> <span className="badge badge-marker" style={{ marginLeft: 6 }}>Recommended</span><span className="small muted" style={{ display: 'block' }}>Looks the same on every computer</span></span>
                      </label>
                      <label className="format-opt check" style={{ cursor: 'not-allowed', opacity: 0.6 }}>
                        <input type="radio" name="fmt" value="docx" disabled />
                        <span><strong>Word (DOCX)</strong> <span className="badge badge-neutral" style={{ marginLeft: 6 }}>Coming soon</span><span className="small muted" style={{ display: 'block' }}>Edit it later in Word or Google Docs</span></span>
                      </label>
                    </div>
                  </fieldset>

                  {dlError && <div style={{ marginTop: 16 }}><Alert tone="error" role="alert" title="Download failed">{dlError}</Alert></div>}

                  <button className="btn btn-primary btn-lg btn-block" type="submit" style={{ marginTop: 22 }} disabled={busy || !parsed} aria-busy={busy}>
                    {busy ? <><Icon name="refresh" />Preparing your file…</> : <><Icon name="download" />Download updated resume</>}
                  </button>
                  <p className="caption" style={{ textAlign: 'center', marginTop: 10 }}>Your original file stays unchanged.</p>
                </form>
              </section>
              <Link className="btn btn-secondary" to={`/results/${analysisId}/improve`}><Icon name="arrow-left" />Back to improve bullets</Link>
            </aside>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
