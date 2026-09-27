import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { Icon } from '../lib/icons.jsx';
import { Alert, PageLoading, ScoreRing, Steps } from '../lib/ui.jsx';
import { containsKeyword, resumeBullets, scoreLevel } from '../lib/format.js';
import { loadAnalysisBundle } from '../api.js';

const chip = (cls, icon) => (k) => <span key={k} className={`chip ${cls}`}><Icon name={icon} />{k}</span>;

function bulletHint(text, a) {
  const weak = (a.weakKeywords || []).filter((k) => containsKeyword(text, k));
  if (weak.length) return `Mentions ${weak.slice(0, 2).join(', ')}, which could be strengthened`;
  const missing = (a.missingCritical?.length || 0) + (a.missingSecondary?.length || 0);
  return missing ? 'Could show some of the missing keywords' : 'Could be sharper with a number or result';
}

export default function Results() {
  const { analysisId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');

  useEffect(() => {
    document.title = 'Match results · Forma';
    loadAnalysisBundle(analysisId)
      .then((d) => {
        setData(d);
        setSelected(resumeBullets(d.resume.parsed)[0]?.id || '');
      })
      .catch((err) => setError(err.message));
  }, [analysisId]);

  if (error || !data) {
    return (
      <AppShell active="analyses" back="/dashboard">
        <main id="main" className="page"><div className="container">
          <Steps current={3} analysisId={analysisId} />
          {error ? <Alert tone="error" role="alert" title="We couldn’t load this analysis">{error} <Link to="/dashboard">Back to dashboard</Link></Alert> : <PageLoading label="Loading your match…" />}
        </div></main>
      </AppShell>
    );
  }

  const { analysis: a, job, resume, suggestions } = data;
  const lvl = scoreLevel(a.score);
  const missing = [...(a.missingCritical || []), ...(a.missingSecondary || [])];
  const total = (a.matchedKeywords?.length || 0) + missing.length + (a.weakKeywords?.length || 0);
  const saved = Object.fromEntries(suggestions.filter((s) => s.selectedText).map((s) => [s.bulletId, s.selectedText]));
  const bullets = resumeBullets(resume.parsed);
  const improveHref = `/results/${a.id}/improve${selected ? `?bullet=${encodeURIComponent(selected)}` : ''}`;
  const toStrong = Math.min(3, missing.length);

  return (
    <AppShell active="analyses" back="/job">
      <main id="main" className="page">
        <div className="container">
          <Steps current={3} analysisId={a.id} />

          <div className="page-head">
            <div>
              <p className="eyebrow">Main feature 2 · Match results</p>
              <h1 style={{ marginTop: 6 }}>{job.title || 'Job posting'} {job.company && <em>· {job.company}</em>}</h1>
              <p className="muted">Compared with <strong>{resume.filename}</strong> · <Link to={`/job?resume=${resume.id}`}>Change job</Link></p>
            </div>
            {bullets.length > 0 && <Link className="btn btn-primary btn-lg" to={improveHref}><Icon name="sparkles" />Improve bullets</Link>}
          </div>

          <div className="grid-main-wide">
            <div className="stack" style={{ '--gap': '24px' }}>
              {/* Score */}
              <section className="card card-ink glow" aria-labelledby="score-title">
                <h2 id="score-title" className="visually-hidden">Match score</h2>
                <div className="score">
                  <ScoreRing value={a.score} />
                  <div>
                    <span className={`badge badge-${lvl.key}`} style={{ fontSize: '1rem', padding: '5px 14px' }}><Icon name={lvl.icon} />{lvl.word} match</span>
                    <p style={{ marginTop: 12, fontSize: '1.125rem' }}>
                      {lvl.key === 'good'
                        ? <>You’re a <span className="hl"><strong>strong match</strong></span>. Polish a bullet or two to stand out.</>
                        : toStrong > 0
                          ? <>Adding <span className="hl"><strong>{toStrong === 1 ? '1 missing skill' : `${toStrong} missing skills`}</strong></span> could move you toward <strong>Strong</strong>.</>
                          : <>Mention your <span className="hl"><strong>weak keywords</strong></span> again in context to move toward <strong>Strong</strong>.</>}
                    </p>
                    <div className="scale" role="list" aria-label="Score ranges">
                      <div className="s-bad" role="listitem" aria-current={lvl.key === 'bad' ? 'true' : undefined}><Icon name="x" />Low 0–49</div>
                      <div className="s-fair" role="listitem" aria-current={lvl.key === 'fair' ? 'true' : undefined}><Icon name="bang" />Fair 50–74</div>
                      <div className="s-good" role="listitem" aria-current={lvl.key === 'good' ? 'true' : undefined}><Icon name="check" />Strong 75+</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Keywords */}
              <section className="card" aria-labelledby="kw-title">
                <div className="card-head"><h2 id="kw-title">Keywords from the job</h2><span className="caption">{total} found in the posting</span></div>

                <h3 className="row" style={{ gap: 8 }}><span className="badge badge-good"><Icon name="check" />Matched</span><span className="count">{a.matchedKeywords.length}</span><span className="small muted" style={{ fontWeight: 500 }}>in your resume</span></h3>
                <div className="chips" style={{ marginTop: 10 }}>{a.matchedKeywords.length ? a.matchedKeywords.map(chip('chip-match', 'check')) : <span className="small muted">None yet.</span>}</div>

                <hr className="divider-line" />
                <h3 className="row" style={{ gap: 8 }}><span className="badge badge-bad"><Icon name="x" />Missing</span><span className="count">{missing.length}</span><span className="small muted" style={{ fontWeight: 500 }}>not found in your resume</span></h3>
                <p className="eyebrow" style={{ marginTop: 12 }}>Critical</p>
                <div className="chips" style={{ marginTop: 8 }}>{a.missingCritical.length ? a.missingCritical.map(chip('chip-miss', 'x')) : <span className="small muted">None — nice.</span>}</div>
                <p className="eyebrow" style={{ marginTop: 12 }}>Nice to have</p>
                <div className="chips" style={{ marginTop: 8 }}>{a.missingSecondary.length ? a.missingSecondary.map(chip('chip-miss', 'x')) : <span className="small muted">None — nice.</span>}</div>

                <hr className="divider-line" />
                <h3 className="row" style={{ gap: 8 }}><span className="badge badge-fair"><Icon name="bang" />Weak</span><span className="count">{a.weakKeywords.length}</span><span className="small muted" style={{ fontWeight: 500 }}>mentioned only once</span></h3>
                <div className="chips" style={{ marginTop: 10 }}>{a.weakKeywords.length ? a.weakKeywords.map(chip('chip-weak', 'bang')) : <span className="small muted">None.</span>}</div>
              </section>
            </div>

            <div className="stack" style={{ '--gap': '24px' }}>
              <section className="card panel-violet" aria-labelledby="rec-title">
                <h2 id="rec-title" className="row" style={{ gap: 10 }}><Icon name="zap" />Recommendations</h2>
                <ol style={{ margin: '14px 0 0', paddingLeft: 22, display: 'grid', gap: 10 }}>
                  {a.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ol>
              </section>

              <section className="card" aria-labelledby="bul-title">
                <div className="card-head">
                  <h2 id="bul-title">Your bullets</h2>
                  <span className="caption">Select one to improve</span>
                </div>
                {bullets.length === 0 ? (
                  <p className="small muted">We didn’t find any experience bullets on this resume, so there’s nothing to rewrite yet.</p>
                ) : (
                  <>
                    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                      <legend className="visually-hidden">Choose a bullet to improve</legend>
                      <div className="bullet-pick">
                        {bullets.map((b) => (
                          <label className="bullet-opt check" key={b.id}>
                            <input type="radio" name="bullet" value={b.id} checked={selected === b.id} onChange={() => setSelected(b.id)} />
                            <span>
                              <span className="bullet-text">{saved[b.id] || b.text}</span>
                              <span className="bullet-meta" style={{ display: 'block' }}>{b.where} · {bulletHint(b.text, a)}</span>
                            </span>
                            {saved[b.id] && <span className="badge badge-good"><Icon name="check" />Improved</span>}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <Link className="btn btn-primary btn-block" to={improveHref} style={{ marginTop: 16 }}><Icon name="sparkles" />Improve selected bullet</Link>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
