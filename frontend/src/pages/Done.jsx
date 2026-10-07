import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { Icon } from '../lib/icons.jsx';
import { Alert, LevelBadge, PageLoading, useUI } from '../lib/ui.jsx';
import { kb, safeFileName } from '../lib/format.js';
import { api, loadAnalysisBundle } from '../api.js';
import { useExportSummary } from './Download.jsx';

const COLORS = ['#ffd23f', '#16171d', '#fffefb', '#f06a4a', '#2a35b0'];

function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      background: COLORS[i % COLORS.length],
      animationDuration: `${2.2 + Math.random() * 2}s`,
      animationDelay: `${Math.random() * 0.6}s`,
    }))
  );
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return <div className="confetti" aria-hidden="true">{pieces.map((s, i) => <i key={i} style={s} />)}</div>;
}

export default function Done() {
  const { analysisId } = useParams();
  const location = useLocation();
  const { toast } = useUI();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const titleRef = useRef(null);
  const summary = useExportSummary(data);

  useEffect(() => {
    document.title = 'Your resume is ready · Forma';
    loadAnalysisBundle(analysisId).then(setData).catch((err) => setError(err.message));
  }, [analysisId]);

  useEffect(() => {
    if (data) titleRef.current?.focus();
  }, [data]);

  const reduce =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';

  if (error || !data) {
    return (
      <AppShell active="analyses" back="/dashboard">
        <main id="main" className="page"><div className="container">
          {error ? <Alert tone="error" role="alert" title="We couldn’t load this analysis">{error}</Alert> : <PageLoading />}
        </div></main>
      </AppShell>
    );
  }

  const file = location.state?.file || `${safeFileName(`${data.job.title || 'tailored'} resume`)}.pdf`;
  const size = location.state?.size;
  const again = async () => {
    try {
      await api.downloadExport(analysisId, file);
      toast('Download started again');
    } catch (err) {
      toast(err.message, { icon: 'x-circle' });
    }
  };

  return (
    <AppShell active="analyses" back="/dashboard">
      {!reduce && location.state?.file && <Confetti />}
      <main id="main" className="page">
        <div className="container">
          <div className="done-wrap">
            <div className="done-badge"><Icon name="check" /></div>
            <p className="eyebrow">Confirmation</p>
            <h1 ref={titleRef} className="display" style={{ fontSize: 'clamp(2.25rem,1.6rem + 2.6vw,3.5rem)', marginTop: 8 }} tabIndex={-1}>
              Your resume is <span className="hl">ready!</span>
            </h1>
            <p className="lead" style={{ margin: '14px auto 0' }}>
              <strong className="mono" style={{ fontSize: '1rem' }}>{file}</strong> {location.state?.file ? 'was downloaded to your device.' : 'is ready to download.'}
            </p>

            <section className="card summary" aria-labelledby="sum-title">
              <h2 id="sum-title" className="eyebrow" style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem', marginBottom: 8 }}>Summary</h2>
              <dl>
                <dt>Job</dt><dd>{[data.job.title, data.job.company].filter(Boolean).join(' · ') || 'Job posting'}</dd>
                <dt>Bullets improved</dt><dd>{summary.improved}</dd>
                <dt>Match score</dt>
                <dd>
                  <span className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    {summary.before}% <Icon name="arrow-right" className="icon-sm" /> {summary.after}% <LevelBadge value={summary.after} />
                  </span>
                </dd>
                <dt>File</dt><dd>PDF{size ? ` · ${kb(size)}` : ''}</dd>
              </dl>
            </section>

            <p className="small muted">{location.state?.file ? 'Didn’t download?' : 'Need the file?'} <button className="link-btn" type="button" onClick={again}>{location.state?.file ? 'Try again' : 'Download it'}</button></p>

            <div className="row" style={{ justifyContent: 'center', marginTop: 28, gap: 14 }}>
              <Link className="btn btn-primary btn-lg" to={`/job?resume=${data.resume.id}`}><Icon name="target" />Match with another job</Link>
              <Link className="btn btn-secondary btn-lg" to="/dashboard"><Icon name="home" />Back to dashboard</Link>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
