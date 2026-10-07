import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { Icon } from '../lib/icons.jsx';
import { Alert, PageLoading, Steps, useUI } from '../lib/ui.jsx';
import { containsKeyword, highlightKeywords, resumeBullets } from '../lib/format.js';
import { api, loadAnalysisBundle } from '../api.js';

const MAX = 300;

const toOptions = (opts) => (opts || []).map((o) => ({ text: o.text, flagged: !!o.flagged, draft: o.text, editing: false }));

export default function BulletImprove() {
  const { analysisId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useUI();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | ready | down
  const [downMsg, setDownMsg] = useState('');
  const [manual, setManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    document.title = 'Improve bullets · Forma';
    loadAnalysisBundle(analysisId)
      .then((d) => {
        setData(d);
        setSavedIds(new Set(d.suggestions.filter((s) => s.selectedText).map((s) => s.bulletId)));
      })
      .catch((err) => setError(err.message));
  }, [analysisId]);

  const bullets = data ? resumeBullets(data.resume.parsed) : [];
  const bullet = bullets.find((b) => b.id === params.get('bullet')) || bullets[0];
  const bulletId = bullet?.id;

  const generate = useCallback(async () => {
    setSelected(null);
    setManual(false);
    setPhase('loading');
    try {
      const { suggestion } = await api.generateBulletOptions(analysisId, bulletId);
      setOptions(toOptions(suggestion.options));
      setPhase('ready');
      return true;
    } catch (err) {
      setDownMsg(err.message);
      setPhase('down');
      return false;
    }
  }, [analysisId, bulletId]);

  // When the bullet changes: reuse options generated earlier, otherwise ask the AI.
  useEffect(() => {
    if (!data || !bulletId) return;
    setJustSaved(false);
    const existing = data.suggestions.find((s) => s.bulletId === bulletId && s.options?.length);
    if (existing) {
      setOptions(toOptions(existing.options));
      setSelected(Number.isInteger(existing.selectedIndex) ? existing.selectedIndex : null);
      setManual(false);
      setPhase('ready');
    } else {
      generate();
    }
  }, [data, bulletId, generate]);

  if (error || !data) {
    return (
      <AppShell active="analyses" back={`/results/${analysisId}`}>
        <main id="main" className="page"><div className="container" style={{ maxWidth: 920 }}>
          <Steps current={4} analysisId={analysisId} />
          {error ? <Alert tone="error" role="alert" title="We couldn’t load this bullet">{error} <Link to="/dashboard">Back to dashboard</Link></Alert> : <PageLoading />}
        </div></main>
      </AppShell>
    );
  }

  const { analysis: a, job } = data;
  if (!bullet) {
    return (
      <AppShell active="analyses" back={`/results/${analysisId}`}>
        <main id="main" className="page"><div className="container" style={{ maxWidth: 920 }}>
          <Steps current={4} analysisId={analysisId} />
          <Alert tone="info" title="No bullets to improve">This resume has no experience bullets we could read. <Link to={`/results/${analysisId}/export`}>Continue to export</Link></Alert>
        </div></main>
      </AppShell>
    );
  }

  const jobKeywords = [...(job.requiredSkills?.critical || []), ...(job.requiredSkills?.secondary || [])];
  const missing = [...(a.missingCritical || []), ...(a.missingSecondary || [])];
  const fits = [...missing, ...(a.weakKeywords || [])].slice(0, 3);
  const flagKeyword = (text) => missing.find((k) => containsKeyword(text, k));

  const nextTarget = (ids) => {
    const nextB = bullets.find((b) => !ids.has(b.id) && b.id !== bullet.id);
    return nextB ? `/results/${analysisId}/improve?bullet=${encodeURIComponent(nextB.id)}` : `/results/${analysisId}/export`;
  };

  const update = (i, patch) => setOptions((opts) => opts.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  const save = async () => {
    if (selected === null) return;
    const o = options[selected];
    const edited = manual || o.draft.trim() !== o.text;
    if (!o.draft.trim()) {
      toast('The bullet can’t be empty.', { icon: 'x-circle' });
      return;
    }
    setSaving(true);
    try {
      await api.selectBulletOption(analysisId, bullet.id, edited ? { text: o.draft.trim() } : { index: selected });
      const ids = new Set(savedIds).add(bullet.id);
      setSavedIds(ids);
      setJustSaved(true);
      toast('Bullet saved to your resume');
      setTimeout(() => document.getElementById('continue')?.focus(), 0);
    } catch (err) {
      toast(err.message, { icon: 'x-circle' });
    } finally {
      setSaving(false);
    }
  };

  const startManual = () => {
    setOptions([{ text: bullet.text, flagged: false, draft: bullet.text, editing: true }]);
    setSelected(0);
    setManual(true);
    setPhase('ready');
    setTimeout(() => document.getElementById('edit-0')?.focus(), 0);
  };

  const target = nextTarget(savedIds);

  return (
    <AppShell active="analyses" back={`/results/${analysisId}`}>
      <main id="main" className="page">
        <div className="container" style={{ maxWidth: 920 }}>
          <Steps current={4} analysisId={analysisId} />

          <div className="page-head" style={{ marginBottom: 20 }}>
            <div>
              <p className="eyebrow">Main feature 3 · Improve with AI</p>
              <h1 style={{ marginTop: 6 }}>Make this bullet <em>work harder</em></h1>
            </div>
            <div className="pill-tip">
              <span className="badge badge-good"><Icon name="check" />{savedIds.size}</span> of {bullets.length} bullets improved
            </div>
          </div>

          <section className="original" aria-labelledby="orig-label">
            <p className="eyebrow" id="orig-label">Original bullet · <span>{bullet.where}</span></p>
            <blockquote>“{bullet.text}”</blockquote>
            {fits.length > 0 && (
              <div className="row" style={{ gap: 8 }}>
                <span className="small" style={{ color: '#d6d2c8' }}>Job keywords this could show:</span>
                <span className="chips">{fits.map((k) => <span key={k} className="chip chip-kw">{k}</span>)}</span>
              </div>
            )}
          </section>

          <div className="row-between" style={{ margin: '28px 0 14px' }}>
            <h2 className="row" style={{ gap: 10 }}><Icon name="sparkles" />{manual ? 'Edit it yourself' : '3 AI suggestions'}</h2>
            <div className="row">
              <span className="small muted">Pick one, edit it if you like</span>
              <button className="btn btn-secondary btn-sm" type="button" disabled={phase === 'loading'}
                onClick={async () => { if (await generate()) toast('Here are 3 new options'); }}>
                <Icon name="refresh" />Regenerate
              </button>
            </div>
          </div>

          <div className="stack" style={{ '--gap': '16px' }} aria-live="polite">
            {phase === 'loading' && (
              <>
                <div className="card row" style={{ gap: 14 }}>
                  <span className="spinner" />
                  <div><strong>Writing 3 options…</strong><div className="small muted">About 10 seconds</div></div>
                </div>
                {[0, 1, 2].map((i) => (
                  <div className="option" key={i}><div className="skeleton" style={{ width: '30%' }} /><div className="skeleton" /><div className="skeleton" style={{ width: '80%' }} /></div>
                ))}
              </>
            )}

            {phase === 'down' && (
              <div className="alert alert-warn" role="alert">
                <Icon name="alert" />
                <div className="alert-body">
                  <strong>AI suggestions are down right now</strong>
                  {downMsg} You can still edit the bullet yourself, and we’ll save it the same way.
                  <div className="alert-actions">
                    <button className="btn btn-primary btn-sm" type="button" onClick={startManual}><Icon name="pencil" />Edit manually</button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={generate}><Icon name="refresh" />Try again</button>
                  </div>
                </div>
              </div>
            )}

            {phase === 'ready' && options.map((o, i) => {
              const sel = selected === i;
              const edited = o.draft !== o.text;
              const kw = o.flagged ? flagKeyword(o.text) : null;
              return (
                <article className="option" data-selected={sel} aria-labelledby={`opt-${i}`} key={i}>
                  <div className="option-head">
                    <span className="eyebrow" id={`opt-${i}`}>
                      {manual ? 'Your version' : `Option ${i + 1}`}
                      {sel && <> · <strong style={{ color: 'var(--ink)' }}>Selected</strong></>}
                    </span>
                    {edited && <span className="badge badge-brand"><Icon name="pencil" />Edited</span>}
                  </div>
                  {o.editing ? (
                    <>
                      <label className="visually-hidden" htmlFor={`edit-${i}`}>Edit option {i + 1}</label>
                      <textarea className="textarea" id={`edit-${i}`} maxLength={MAX} value={o.draft} onChange={(e) => update(i, { draft: e.target.value })} />
                    </>
                  ) : (
                    <p className="option-text">
                      {highlightKeywords(o.draft, jobKeywords).map((p, j) => (p.mark ? <mark key={j}>{p.text}</mark> : <span key={j}>{p.text}</span>))}
                    </p>
                  )}
                  {o.flagged && (
                    <div className="alert alert-warn" style={{ padding: '10px 14px' }}>
                      <Icon name="flag" />
                      <div className="alert-body small">
                        <strong>Check this: {kw ? `“${kw}” isn’t in your resume.` : 'it mentions a job skill that isn’t in your resume.'}</strong>
                        Only use this option if it’s true.
                      </div>
                    </div>
                  )}
                  <div className="option-foot">
                    <span className="small muted row" style={{ gap: 6 }}>
                      {o.editing ? <><span className="mono">{o.draft.length} / {MAX}</span> characters</> : <><Icon name="file" className="icon-sm" />Based on your resume</>}
                    </span>
                    <div className="row">
                      {edited && !manual && (
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => { update(i, { draft: o.text, editing: false }); toast('Option reset to the AI version', { icon: 'undo' }); }}>
                          <Icon name="undo" />Reset
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm" type="button" aria-pressed={o.editing}
                        onClick={() => {
                          update(i, { editing: !o.editing });
                          if (!o.editing) {
                            setSelected(i);
                            setTimeout(() => {
                              const ta = document.getElementById(`edit-${i}`);
                              ta?.focus();
                              ta?.setSelectionRange(ta.value.length, ta.value.length);
                            }, 0);
                          }
                        }}>
                        <Icon name={o.editing ? 'check' : 'pencil'} />{o.editing ? 'Done editing' : 'Edit'}
                      </button>
                      <button className={`btn ${sel ? 'btn-primary' : 'btn-secondary'} btn-sm`} type="button" aria-pressed={sel} onClick={() => setSelected(i)}>
                        {sel ? <><Icon name="check-circle" />Selected</> : 'Select'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="actionbar">
            <p className="note"><Icon name="lock" />Your resume won’t change until you press Save.</p>
            <Link className="btn btn-secondary" to={`/results/${analysisId}`}><Icon name="arrow-left" />Back to results</Link>
            <button className="btn btn-secondary" type="button" onClick={() => navigate(target)}>Skip this bullet</button>
            {justSaved ? (
              <Link className="btn btn-primary" id="continue" to={target}>
                {target.endsWith('/export') ? 'Continue to export' : 'Next bullet'} <Icon name="arrow-right" />
              </Link>
            ) : (
              <button className="btn btn-primary" type="button" disabled={selected === null || saving || phase !== 'ready'} aria-busy={saving} onClick={save}>
                {saving ? <><Icon name="refresh" />Saving…</> : 'Save selection'}
              </button>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
