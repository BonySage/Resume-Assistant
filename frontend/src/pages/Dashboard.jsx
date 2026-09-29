import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { Icon } from '../lib/icons.jsx';
import { Alert, LevelBadge, ScoreRing, useUI } from '../lib/ui.jsx';
import { fileKind, fmtDate, jobLabel, kb } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

const MAX = 10 * 1024 * 1024;

function DropArt() {
  return (
    <svg className="dropzone-art" viewBox="0 0 84 84" aria-hidden="true">
      <rect x="18" y="8" width="44" height="58" rx="4" fill="#fffefb" stroke="#16171d" strokeWidth="2.5" />
      <path d="M27 22h26M27 32h20M27 42h24" stroke="#ede7da" strokeWidth="5" strokeLinecap="round" />
      <path d="M27 32h20" stroke="#ffd23f" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="60" r="16" fill="#16171d" />
      <path d="M60 67V53m-6 6 6-6 6 6" stroke="#ffd23f" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Dashboard() {
  const { displayName } = useAuth();
  const { toast, confirm } = useUI();
  const location = useLocation();
  const [resumes, setResumes] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [jobs, setJobs] = useState({});
  const [loadError, setLoadError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [drag, setDrag] = useState(false);
  const [upload, setUpload] = useState(null); // {file, pct, phase: 'uploading'|'reading'|'done'|'error', ...}
  const abortRef = useRef(null);
  const analysesRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [r, a, j] = await Promise.all([api.listResumes(), api.listAnalyses(), api.listJobPostings()]);
      setResumes(r.resumes);
      setAnalyses(a.analyses);
      setJobs(Object.fromEntries(j.jobPostings.map((p) => [p.id, p])));
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
      setResumes((cur) => cur || []);
    }
  }, []);

  useEffect(() => {
    document.title = 'Dashboard · Forma';
    load();
  }, [load]);

  useEffect(() => {
    if (location.state?.welcome) toast('Account created. Let’s upload your first resume.');
  }, [location.state, toast]);

  useEffect(() => {
    if (location.hash === '#analyses') setTimeout(() => analysesRef.current?.focus(), 50);
  }, [location.hash]);

  const ready = (resumes || []).filter((r) => !r.parseError);
  const latest = analyses[0];
  const latestJob = latest && jobs[latest.jobPostingId];
  const best = analyses.length ? Math.max(...analyses.map((a) => a.score ?? 0)) : null;
  const first = displayName.split(' ')[0];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      setUpload({ phase: 'error', title: 'That file type isn’t supported', text: `“${file.name}” is a .${ext} file. Upload a PDF or DOCX instead.` });
      return;
    }
    if (file.size > MAX) {
      setUpload({ phase: 'error', title: 'File too large', text: `Resumes must be 10 MB or smaller. This one is ${(file.size / 1048576).toFixed(1)} MB.` });
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setUpload({ phase: 'uploading', file, ext, pct: 0 });
    try {
      const { resume } = await api.uploadResumeWithProgress(
        file,
        (pct) => setUpload((u) => (u && u.file === file ? { ...u, pct, phase: pct >= 100 ? 'reading' : 'uploading' } : u)),
        ctrl.signal
      );
      setUpload({ phase: 'done', resume });
      load();
    } catch (err) {
      if (err.name === 'AbortError') return;
      setUpload({ phase: 'error', title: 'We couldn’t upload that resume', text: err.message });
    }
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
    setUpload(null);
    toast('Upload cancelled', { icon: 'x-circle' });
  };

  const deleteResume = async (r, btn) => {
    const ok = await confirm({
      title: 'Delete this resume?',
      body: <><strong>{r.filename}</strong> and its analyses will be permanently deleted. This can’t be undone.</>,
      confirmLabel: 'Delete resume',
    });
    if (!ok) {
      btn?.focus();
      return;
    }
    try {
      await api.deleteResume(r.id);
      toast(`Deleted ${r.filename}`, { icon: 'trash' });
      load();
    } catch (err) {
      toast(err.message, { icon: 'x-circle' });
    }
  };

  const visibleAnalyses = showAll ? analyses : analyses.slice(0, 5);

  return (
    <AppShell active="dashboard" back="/">
      <main id="main" className="page">
        <div className="container">
          <section className="banner" aria-labelledby="welcome-title">
            <div className="blobs" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="banner-text">
              <p className="eyebrow">{today}</p>
              <h1 id="welcome-title">Welcome back, <em>{first}</em> <span aria-hidden="true" className="wave">✦</span></h1>
              <p>
                {ready.length
                  ? 'Your newest resume is ready. Compare it with a job posting to see your match score.'
                  : 'Upload your resume to get started. Then compare it with a job posting to see your match score.'}
              </p>
              <div className="row" style={{ marginTop: 20 }}>
                <Link className="btn btn-light btn-lg" to="/job"><Icon name="plus" />New analysis</Link>
                {latest && <Link className="btn btn-glass btn-lg" to={`/results/${latest.id}`}>Open last result</Link>}
              </div>
            </div>
            {latest && (
              <div className="banner-art" aria-hidden="true">
                <div className="glass-card">
                  <span className="eyebrow">Last match{latestJob?.company ? ` · ${latestJob.company}` : ''}</span>
                  <ScoreRing value={latest.score ?? 0} className="ring-sm" />
                </div>
              </div>
            )}
          </section>

          {loadError && <div style={{ marginBottom: 20 }}><Alert tone="error" role="alert" title="We couldn’t load your dashboard">{loadError}</Alert></div>}

          <div className="tiles" aria-label="Your activity">
            <div className="tile"><span className="tile-ico"><Icon name="file" /></span><div><div className="n">{ready.length}</div><div className="l">Resumes ready</div></div></div>
            <div className="tile coral"><span className="tile-ico"><Icon name="target" /></span><div><div className="n">{analyses.length}</div><div className="l">Jobs analyzed</div></div></div>
            <div className="tile mint"><span className="tile-ico"><Icon name="trend" /></span><div><div className="n">{best === null ? '—' : `${best}%`}</div><div className="l">Best match score</div></div></div>
          </div>

          <div className="grid-main">
            <div className="stack" style={{ '--gap': '28px' }}>
              {/* Upload */}
              <section className="card card-ink glow" aria-labelledby="upload-title">
                <div className="card-head">
                  <h2 id="upload-title"><Icon name="upload" />Upload a resume</h2>
                  <span className="caption">Step 1 of 5</span>
                </div>
                <div
                  className="dropzone"
                  data-drag={drag}
                  onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
                >
                  <DropArt />
                  <h3>Drag and drop your resume here</h3>
                  <p className="muted">or</p>
                  <label className="btn btn-secondary" htmlFor="file-input"><Icon name="file" />Browse files</label>
                  <input
                    type="file"
                    id="file-input"
                    className="visually-hidden"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    aria-describedby="file-rules"
                    onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }}
                  />
                  <p className="caption row" id="file-rules" style={{ gap: 6, justifyContent: 'center' }}><Icon name="info" className="icon-sm" />PDF or DOCX only · up to 10 MB</p>
                </div>
                <div aria-live="polite">
                  {upload && (upload.phase === 'uploading' || upload.phase === 'reading') && (
                    <div className="upload-status">
                      <div className="row-between">
                        <div className="file-cell">
                          <span className="file-ico" data-kind={upload.ext}>{upload.ext.toUpperCase()}</span>
                          <div>
                            <div>{upload.file.name}</div>
                            <div className="small muted">{kb((upload.file.size * upload.pct) / 100)} of {kb(upload.file.size)}</div>
                          </div>
                        </div>
                        <div className="row">
                          <strong className="mono">{upload.pct}%</strong>
                          <button className="btn btn-secondary btn-sm" type="button" onClick={cancelUpload}>Cancel</button>
                        </div>
                      </div>
                      <div className="progress" style={{ marginTop: 12 }} role="progressbar" aria-label={`Uploading ${upload.file.name}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={upload.pct}>
                        <span style={{ '--value': `${upload.pct}%` }} />
                      </div>
                      <p className="small muted" style={{ marginTop: 8 }}>
                        {upload.phase === 'reading'
                          ? <span className="row" style={{ gap: 8 }}><span className="spinner" />Reading sections and bullets… this can take up to 30 seconds</span>
                          : 'Uploading… next we’ll read your sections'}
                      </p>
                    </div>
                  )}
                  {upload?.phase === 'error' && (
                    <div style={{ marginTop: 16 }}><Alert tone="error" role="alert" title={upload.title}>{upload.text}</Alert></div>
                  )}
                  {upload?.phase === 'done' && (
                    <div style={{ marginTop: 16 }}>
                      {upload.resume.parseError ? (
                        <Alert tone="warn" title="Uploaded, but we couldn’t read its sections">
                          {upload.resume.parseError} You can still try re‑uploading, or upload a PDF exported from Word or Google Docs.
                        </Alert>
                      ) : (
                        <div className="alert alert-success">
                          <Icon name="check-circle" />
                          <div className="alert-body">
                            <strong>Resume uploaded</strong>
                            We found {upload.resume.sectionCount} sections and {upload.resume.bulletCount} bullets in {upload.resume.filename}.
                            <div className="alert-actions">
                              <Link className="btn btn-primary btn-sm" to={`/job?resume=${upload.resume.id}`}>Compare with a job <Icon name="arrow-right" /></Link>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Resumes */}
              <section className="card" aria-labelledby="resumes-title">
                <div className="card-head">
                  <h2 id="resumes-title">My resumes <span className="count">{resumes ? resumes.length : '…'}</span></h2>
                  <span className="caption">Sorted by newest</span>
                </div>
                <table className="table">
                  <caption className="visually-hidden">Your uploaded resumes</caption>
                  <thead><tr><th scope="col">File</th><th scope="col">Uploaded</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
                  <tbody>
                    {resumes === null && (
                      <tr><td colSpan="4"><div className="stack" style={{ '--gap': '8px' }}><div className="skeleton" /><div className="skeleton" style={{ width: '70%' }} /></div></td></tr>
                    )}
                    {resumes?.length === 0 && (
                      <tr><td colSpan="4"><div className="empty">No resumes yet. Upload one above to get started.</div></td></tr>
                    )}
                    {resumes?.map((r) => {
                      const kind = fileKind(r.filename);
                      return (
                        <tr key={r.id}>
                          <td>
                            <div className="file-cell">
                              <span className="file-ico" data-kind={kind}>{kind.toUpperCase()}</span>
                              <div>
                                {r.filename}
                                {r.parseError && (
                                  <div className="row-note"><Icon name="info" className="icon-sm" /><span>We couldn’t read its sections. Upload a PDF exported from Word or Google Docs so we can read the text.</span></div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="muted">{fmtDate(r.createdAt)}</td>
                          <td>
                            {r.parseError
                              ? <span className="badge badge-bad"><Icon name="x" />Couldn’t read text</span>
                              : <span className="badge badge-good"><Icon name="check" />Ready · {r.bulletCount} bullets</span>}
                          </td>
                          <td>
                            <div className="row" style={{ justifyContent: 'flex-end' }}>
                              {r.parseError
                                ? <label className="btn btn-secondary btn-sm" htmlFor="file-input"><Icon name="upload" />Re‑upload</label>
                                : <Link className="btn btn-secondary btn-sm" to={`/job?resume=${r.id}`}><Icon name="target" />Analyze</Link>}
                              <button className="btn btn-ghost btn-sm btn-icon" type="button" aria-label={`Delete ${r.filename}`} data-tip="Delete resume"
                                onClick={(e) => deleteResume(r, e.currentTarget)}>
                                <Icon name="trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </div>

            <aside className="stack sticky" style={{ '--gap': '20px' }}>
              <section className="card" id="analyses" aria-labelledby="analyses-title" tabIndex={-1} ref={analysesRef}>
                <div className="card-head">
                  <h2 id="analyses-title">Recent analyses</h2>
                  {analyses.length > 5 && (
                    <button className="link-btn small" type="button" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Show fewer' : 'View all'}</button>
                  )}
                </div>
                {analyses.length === 0 ? (
                  <p className="small muted">No analyses yet. Press <b>New analysis</b> to compare a resume with a job posting.</p>
                ) : (
                  <ul className="list">
                    {visibleAnalyses.map((a) => {
                      const j = jobs[a.jobPostingId];
                      return (
                        <li key={a.id}>
                          <Link className="analysis-item" to={`/results/${a.id}`}>
                            <span>
                              <strong>{jobLabel(j)}</strong>
                              <span className="small muted">{[j?.company, fmtDate(a.createdAt)].filter(Boolean).join(' · ')}</span>
                            </span>
                            <span className="mini-score">
                              <span className="n">{a.score}<span className="small">%</span></span>
                              <LevelBadge value={a.score} />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <div className="alert alert-tip">
                <Icon name="zap" />
                <div className="alert-body">
                  <strong>Next step</strong>
                  {ready.length
                    ? <>Your newest resume is ready. Press <b>New analysis</b> to compare it with a job posting.</>
                    : <>Upload a PDF or DOCX resume above. We’ll pull out your sections and bullets automatically.</>}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
