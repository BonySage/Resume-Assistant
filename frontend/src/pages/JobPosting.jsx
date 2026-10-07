import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { Icon } from '../lib/icons.jsx';
import { Alert, Steps } from '../lib/ui.jsx';
import { fileKind } from '../lib/format.js';
import { api } from '../api.js';

const MIN_TEXT = 80;

function keywordCount(job) {
  return (job?.requiredSkills?.critical?.length || 0) + (job?.requiredSkills?.secondary?.length || 0);
}

export default function JobPosting() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [resumes, setResumes] = useState(null);
  const [resumeId, setResumeId] = useState(params.get('resume') || '');
  const [tab, setTab] = useState(0); // 0 = URL, 1 = paste
  const [url, setUrl] = useState('');
  const [urlMsg, setUrlMsg] = useState('');
  const [status, setStatus] = useState(null); // {kind: 'reading'|'found'|'blocked'|'error', ...}
  const [readPct, setReadPct] = useState(0);
  const [text, setText] = useState('');
  const [job, setJob] = useState(null); // job posting extracted from a URL
  const [busy, setBusy] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const abortRef = useRef(null);
  const tabRefs = [useRef(null), useRef(null)];
  const textRef = useRef(null);
  const analyzeRef = useRef(null);

  useEffect(() => {
    document.title = 'Add a job posting · Forma';
    api.listResumes().then(({ resumes: list }) => {
      setResumes(list);
      const usable = list.filter((r) => !r.parseError);
      setResumeId((cur) => (usable.some((r) => String(r.id) === String(cur)) ? cur : String(usable[0]?.id || '')));
    }).catch(() => setResumes([]));
  }, []);

  // Fake-but-honest progress while the server reads the page (NFR-1.2 target: under 10 s).
  useEffect(() => {
    if (status?.kind !== 'reading') return undefined;
    setReadPct(5);
    const t = setInterval(() => setReadPct((p) => Math.min(92, p + 4)), 400);
    return () => clearInterval(t);
  }, [status?.kind]);

  const resume = resumes?.find((r) => String(r.id) === String(resumeId));
  const jobReady = tab === 0 ? !!job : text.trim().length >= MIN_TEXT;

  const select = (i, focus) => {
    setTab(i);
    setAnalyzeError('');
    if (focus) tabRefs[i].current?.focus();
  };

  const extract = async (e) => {
    e.preventDefault();
    let parsed;
    try {
      parsed = new URL(url.trim());
    } catch {
      parsed = null;
    }
    if (!parsed || !/^https?:$/.test(parsed.protocol)) {
      setUrlMsg('That doesn’t look like a web link. It should start with https://');
      document.getElementById('job-url').focus();
      return;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('169.254.')) {
      setUrlMsg('Internal network links are blocked for security reasons.');
      document.getElementById('job-url').focus();
      return;
    }
    setUrlMsg('');
    setJob(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus({ kind: 'reading' });
    try {
      const { jobPosting } = await api.createJobPostingFromUrl(parsed.href, ctrl.signal);
      setJob(jobPosting);
      setStatus({ kind: 'found' });
      setTimeout(() => analyzeRef.current?.focus(), 0);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setStatus(err.fallbackToPaste ? { kind: 'blocked', message: err.message } : { kind: 'error', message: err.message });
    }
  };

  const analyze = async () => {
    if (!jobReady || !resume) return;
    setBusy(true);
    setAnalyzeError('');
    try {
      let posting = job;
      if (tab === 1 && (!posting || posting._fromText !== text)) {
        posting = (await api.createJobPostingFromText(text)).jobPosting;
        posting._fromText = text;
        setJob(posting);
      }
      const { analysis } = await api.createAnalysis(resume.id, posting.id);
      navigate(`/results/${analysis.id}`);
    } catch (err) {
      setAnalyzeError(err.message);
      setBusy(false);
    }
  };

  const noResumes = resumes && !resumes.some((r) => !r.parseError);

  return (
    <AppShell active="new" back="/dashboard">
      <main id="main" className="page">
        <div className="container">
          <Steps current={2} />

          <div className="grid-main">
            <section className="card card-ink glow" aria-labelledby="job-title">
              <p className="eyebrow">Main feature 1</p>
              <h1 id="job-title" style={{ marginTop: 6 }}>Add the job you’re <em>applying for</em></h1>
              <p className="muted" style={{ marginTop: 8 }}>Paste a link to the posting, or paste the job description text.</p>

              <div
                className="segmented"
                role="tablist"
                aria-label="How do you want to add the job?"
                style={{ marginTop: 24 }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') select(tab === 0 ? 1 : 0, true);
                }}
              >
                <button ref={tabRefs[0]} role="tab" id="tab-url" aria-controls="panel-url" aria-selected={tab === 0} tabIndex={tab === 0 ? 0 : -1} type="button" onClick={() => select(0)}>
                  <Icon name="link" />Paste URL
                </button>
                <button ref={tabRefs[1]} role="tab" id="tab-text" aria-controls="panel-text" aria-selected={tab === 1} tabIndex={tab === 1 ? 0 : -1} type="button" onClick={() => select(1)}>
                  <Icon name="clipboard" />Paste description
                </button>
              </div>

              {/* URL */}
              <div id="panel-url" role="tabpanel" aria-labelledby="tab-url" style={{ marginTop: 24 }} hidden={tab !== 0}>
                <form noValidate onSubmit={extract}>
                  <div className="field">
                    <label className="label" htmlFor="job-url">Job posting link</label>
                    <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
                      <input className="input" id="job-url" type="url" inputMode="url" placeholder="https://careers.example.com/jobs/123"
                        aria-describedby="url-hint url-msg" aria-invalid={urlMsg ? 'true' : 'false'} value={url} onChange={(e) => setUrl(e.target.value)} />
                      <button className="btn btn-secondary" type="submit" disabled={status?.kind === 'reading'}><Icon name="scan" />Extract job</button>
                    </div>
                    <span className="hint" id="url-hint">Works with most company career pages. Some sites (like LinkedIn) block automatic reading.</span>
                    <span className="msg msg-error" id="url-msg" aria-live="polite">{urlMsg && <><Icon name="x-circle" />{urlMsg}</>}</span>
                  </div>
                </form>
                <div aria-live="polite" style={{ marginTop: 16 }}>
                  {status?.kind === 'reading' && (
                    <div className="alert alert-info">
                      <span className="spinner" aria-hidden="true" />
                      <div className="alert-body">
                        <strong>Reading job posting…</strong>Usually under 10 seconds.
                        <div className="progress" style={{ marginTop: 10 }}><span style={{ '--value': `${readPct}%` }} /></div>
                      </div>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => { abortRef.current?.abort(); setStatus(null); document.getElementById('job-url').focus(); }}>
                        Cancel
                      </button>
                    </div>
                  )}
                  {status?.kind === 'blocked' && (
                    <div className="alert alert-warn" role="alert">
                      <Icon name="alert" />
                      <div className="alert-body">
                        <strong>We couldn’t read that page</strong>
                        {status.message} Nothing is lost: paste the job description instead and we’ll continue from there.
                        <div className="alert-actions">
                          <button className="btn btn-primary btn-sm" type="button" onClick={() => { select(1); setTimeout(() => textRef.current?.focus(), 0); }}>
                            <Icon name="clipboard" />Paste description instead
                          </button>
                          <button className="btn btn-secondary btn-sm" type="button" onClick={extract}><Icon name="refresh" />Try again</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {status?.kind === 'error' && <Alert tone="error" role="alert" title="Something went wrong reading that job">{status.message}</Alert>}
                  {status?.kind === 'found' && job && (
                    <Alert tone="success" title={`Job found: ${[job.title, job.company].filter(Boolean).join(' · ') || 'Job posting'}`}>
                      We pulled {keywordCount(job)} keywords from the posting. Press Analyze match to continue.
                    </Alert>
                  )}
                </div>
              </div>

              {/* Paste text */}
              <div id="panel-text" role="tabpanel" aria-labelledby="tab-text" style={{ marginTop: 24 }} hidden={tab !== 1}>
                <div className="field">
                  <label className="label" htmlFor="job-text">Job description <span className="caption mono">{text.length.toLocaleString()} / 10,000</span></label>
                  <textarea ref={textRef} className="textarea" id="job-text" maxLength={10000} placeholder="Paste the full posting, including Requirements and Responsibilities…"
                    aria-describedby="text-hint" value={text} onChange={(e) => setText(e.target.value)} />
                  <span className="hint" id="text-hint">Include at least a few sentences so we can find the keywords.</span>
                </div>
              </div>

              {analyzeError && <div style={{ marginTop: 20 }}><Alert tone="error" role="alert" title="We couldn’t analyze this match">{analyzeError}</Alert></div>}

              <div className="row-between" style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                <Link className="btn btn-secondary" to="/dashboard"><Icon name="arrow-left" />Back</Link>
                <button ref={analyzeRef} className="btn btn-primary btn-lg" type="button" disabled={!jobReady || !resume || busy} aria-busy={busy} onClick={analyze}>
                  {busy
                    ? <><Icon name="refresh" />{tab === 1 ? 'Reading job & analyzing…' : 'Analyzing your match…'}</>
                    : <>Analyze match <Icon name="arrow-right" /></>}
                </button>
              </div>
            </section>

            <aside className="stack sticky" style={{ '--gap': '20px' }}>
              <section className="card" aria-labelledby="matched-title">
                <p className="eyebrow" id="matched-title">Resume being matched</p>
                {resumes === null && <div className="skeleton" style={{ marginTop: 12 }} />}
                {noResumes && (
                  <p className="small muted" style={{ marginTop: 12 }}>You don’t have a readable resume yet. <Link to="/dashboard">Upload one first</Link>.</p>
                )}
                {resume && (
                  <>
                    <div className="file-cell" style={{ marginTop: 12 }}>
                      <span className="file-ico" data-kind={fileKind(resume.filename)}>{fileKind(resume.filename).toUpperCase()}</span>
                      <div>
                        <div>{resume.filename}</div>
                        <div className="small muted">{resume.bulletCount} bullets · {resume.sectionCount} sections</div>
                      </div>
                    </div>
                    {resumes.filter((r) => !r.parseError).length > 1 && (
                      <div className="field" style={{ marginTop: 14 }}>
                        <label className="label small" htmlFor="resume-pick">Change resume</label>
                        <select className="select" id="resume-pick" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                          {resumes.filter((r) => !r.parseError).map((r) => <option key={r.id} value={r.id}>{r.filename}</option>)}
                        </select>
                      </div>
                    )}
                    <Link className="small" to="/dashboard" style={{ display: 'inline-block', marginTop: 12 }}>Upload a different resume</Link>
                  </>
                )}
              </section>

              <section className="card card-flat" aria-labelledby="tips-title">
                <h2 className="h3" id="tips-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="info" />Tips for best results</h2>
                <ul className="small muted" style={{ margin: '12px 0 0', paddingLeft: 18, display: 'grid', gap: 8 }}>
                  <li>Include the full “Requirements” and “Responsibilities” sections.</li>
                  <li>One job per analysis. You can run as many as you like.</li>
                  <li>We never apply to jobs or contact employers for you.</li>
                </ul>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
