import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { Icon } from '../lib/icons.jsx';
import { Alert, PageLoading, Steps, useUI } from '../lib/ui.jsx';
import { containsKeyword, highlightKeywords } from '../lib/format.js';
import { api, loadAnalysisBundle } from '../api.js';

const MAX = 400; // matches MAX_TAILORED_BULLET_LENGTH on the server

const Marked = ({ text, keywords }) =>
  highlightKeywords(text, keywords).map((p, j) => (p.mark ? <mark key={j}>{p.text}</mark> : <span key={j}>{p.text}</span>));

// Skills edit as one "Category: a, b, c" line per category.
const groupsOf = (v) => v.skillGroups || [{ category: '', items: v.skills }]; // versions saved before categories
const skillsToText = (groups) => groups.map((g) => (g.category ? `${g.category}: ` : '') + g.items.join(', ')).join('\n');
const textToSkills = (text) =>
  text.split('\n').map((line) => {
    const at = line.indexOf(':');
    const category = at > -1 ? line.slice(0, at).trim() : '';
    return { category, items: line.slice(at + 1).split(',').map((s) => s.trim()).filter(Boolean) };
  }).filter((g) => g.items.length);
const versionText = (v) => [...v.skills, ...v.sections.flatMap((s) => s.bullets.map((b) => b.text))].join('\n');

function VersionCard({ version, targets, originalSkills, onUse }) {
  const covered = targets.filter((k) => containsKeyword(versionText(version), k)).length;
  const toCheck = version.sections.flatMap((s) => s.bullets).filter((b) => b.issues?.length).length;
  return (
    <article className="option tailor-version" aria-labelledby={`v-${version.key}`}>
      <div className="option-head">
        <h3 id={`v-${version.key}`}>{version.label}</h3>
        <span className={`badge ${covered === targets.length ? 'badge-good' : 'badge-fair'}`}>
          <Icon name={covered === targets.length ? 'check' : 'bang'} />{covered}/{targets.length} keywords
        </span>
      </div>

      <div>
        <p className="eyebrow">Skills</p>
        {groupsOf(version).map((g, gi) => (
          <div key={gi} style={{ marginTop: 8 }}>
            {g.category && <p className="small" style={{ fontWeight: 700, marginBottom: 6 }}>{g.category}</p>}
            <div className="chips">
              {g.items.map((s) => (
                <span key={s} className={`chip ${originalSkills.has(s.toLowerCase()) ? '' : 'chip-kw'}`}>{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {version.sections.map((sec, si) => (
        <div key={si}>
          <p className="eyebrow">{sec.heading}</p>
          <ul className="tailor-bullets">
            {sec.bullets.map((b) => <li key={b.id} className="option-text"><Marked text={b.text} keywords={targets} /></li>)}
          </ul>
        </div>
      ))}

      <div className="option-foot">
        <span className="small muted row" style={{ gap: 6 }}>
          <Icon name={toCheck ? 'flag' : 'file'} className="icon-sm" />
          {toCheck ? `${toCheck} bullet${toCheck > 1 ? 's' : ''} to double-check` : 'Based on your resume'}
        </span>
        <button className="btn btn-primary btn-sm" type="button" onClick={onUse}>Use this version <Icon name="arrow-right" /></button>
      </div>
    </article>
  );
}

export default function TailorResume() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const { toast, confirm } = useUI();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [versions, setVersions] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | generating | compare | edit | down
  const [downMsg, setDownMsg] = useState('');
  const [draft, setDraft] = useState(null); // { label, skillsText, sections }
  const [saving, setSaving] = useState(false);

  const generate = useCallback(async () => {
    setPhase('generating');
    try {
      const { versions: next } = await api.generateTailoredVersions(analysisId);
      setVersions(next);
      setPhase('compare');
      return true;
    } catch (err) {
      setDownMsg(err.message);
      setPhase('down');
      return false;
    }
  }, [analysisId]);

  useEffect(() => {
    document.title = 'Tailor your resume · Forma';
    Promise.all([loadAnalysisBundle(analysisId), api.getTailoredVersions(analysisId)])
      .then(([bundle, { versions: saved }]) => {
        setData(bundle);
        if (saved?.length) {
          setVersions(saved);
          setPhase('compare');
        } else {
          generate();
        }
      })
      .catch((err) => setError(err.message));
  }, [analysisId, generate]);

  const a = data?.analysis;
  // Keywords the AI was asked to add: missing first, then weak (same as the server).
  const targets = useMemo(() => {
    if (!data) return [];
    const job = [...(data.job.requiredSkills?.critical || []), ...(data.job.requiredSkills?.secondary || [])];
    return [...(a.missingCritical || []), ...(a.missingSecondary || []), ...(a.weakKeywords || [])].map(
      (k) => job.find((orig) => orig.toLowerCase().trim() === k) || k
    );
  }, [data, a]);
  const originalSkills = useMemo(() => new Set((data?.resume.parsed?.skills || []).map((s) => s.toLowerCase())), [data]);
  const originalText = data ? `${data.resume.parsed?.skills?.join(', ') || ''}\n${(data.resume.parsed?.experience || []).flatMap((e) => e.bullets.map((b) => b.text)).join('\n')}` : '';

  if (error || !data) {
    return (
      <AppShell active="analyses" back={`/results/${analysisId}`}>
        <main id="main" className="page"><div className="container">
          <Steps current={4} analysisId={analysisId} />
          {error ? <Alert tone="error" role="alert" title="We couldn’t load this analysis">{error} <Link to="/dashboard">Back to dashboard</Link></Alert> : <PageLoading label="Loading your resume…" />}
        </div></main>
      </AppShell>
    );
  }

  const pickVersion = (v) => {
    setDraft({
      label: v.label,
      skillsText: skillsToText(groupsOf(v)),
      sections: v.sections.map((s) => ({ ...s, bullets: s.bullets.map((b) => ({ ...b })) })),
    });
    setPhase('edit');
    window.scrollTo(0, 0);
  };

  const setBullet = (id, text) =>
    setDraft((d) => ({ ...d, sections: d.sections.map((s) => ({ ...s, bullets: s.bullets.map((b) => (b.id === id ? { ...b, text } : b)) })) }));

  const draftBullets = draft ? draft.sections.flatMap((s) => s.bullets) : [];
  const tooLong = draftBullets.some((b) => b.text.length > MAX);
  const empty = draftBullets.some((b) => !b.text.trim());
  // Keywords the edit adds that the original resume never mentions.
  const added = draft ? targets.filter((k) => containsKeyword(`${draft.skillsText}\n${draftBullets.map((b) => b.text).join('\n')}`, k) && !containsKeyword(originalText, k)) : [];

  const save = async () => {
    if (added.length) {
      const ok = await confirm({
        tone: 'warn',
        icon: 'flag',
        title: 'Can you back these up?',
        body: `${added.join(', ')} ${added.length > 1 ? 'weren’t' : 'wasn’t'} in your original resume. Only keep the ones you could talk about in an interview.`,
        cancelLabel: 'Keep editing',
        confirmLabel: 'Yes, save it',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await api.saveTailoredResume(analysisId, {
        skillGroups: textToSkills(draft.skillsText),
        bullets: draftBullets.map((b) => ({ id: b.id, text: b.text })),
      });
      toast('Tailored resume saved');
      navigate(`/results/${analysisId}/export`);
    } catch (err) {
      toast(err.message, { icon: 'x-circle' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell active="analyses" back={`/results/${analysisId}`}>
      <main id="main" className="page">
        <div className="container tailor-container">
          <Steps current={4} analysisId={analysisId} />

          <div className="page-head" style={{ marginBottom: 20 }}>
            <div>
              <p className="eyebrow">Main feature 3 · Tailor with AI</p>
              <h1 style={{ marginTop: 6 }}>{phase === 'edit' ? <>Make it <em>yours</em></> : <>Your resume, <em>tailored 3 ways</em></>}</h1>
              <p className="muted">
                {phase === 'edit'
                  ? `Editing the ${draft.label} version. Change anything, then save.`
                  : 'Each version adds the job’s missing keywords to your skills, experience and projects. Pick one to edit.'}
              </p>
            </div>
            {phase === 'compare' && (
              <button className="btn btn-secondary" type="button" onClick={async () => { if (await generate()) toast('Here are 3 new versions'); }}>
                <Icon name="refresh" />Regenerate
              </button>
            )}
            {phase === 'edit' && (
              <button className="btn btn-secondary" type="button" onClick={() => setPhase('compare')}><Icon name="arrow-left" />Compare versions</button>
            )}
          </div>

          <div aria-live="polite">
            {phase === 'loading' && <PageLoading label="Loading…" />}
            {phase === 'generating' && <PageLoading label="Writing 3 tailored versions of your resume… this takes about 10–20 seconds." />}
            {phase === 'down' && (
              <Alert tone="error" role="alert" title="We couldn’t tailor your resume">
                {downMsg} <button className="btn btn-secondary btn-sm" type="button" onClick={generate} style={{ marginLeft: 8 }}><Icon name="refresh" />Try again</button>
              </Alert>
            )}
          </div>

          {phase === 'compare' && versions && (
            <div className="tailor-grid">
              {versions.map((v) => <VersionCard key={v.key} version={v} targets={targets} originalSkills={originalSkills} onUse={() => pickVersion(v)} />)}
            </div>
          )}

          {phase === 'edit' && draft && (
            <div className="stack" style={{ '--gap': '20px' }}>
              <section className="card">
                <div className="card-head"><h2><Icon name="list" />Skills</h2><span className="caption">One category per line, e.g. “Languages: Python, SQL”</span></div>
                <textarea className="textarea" style={{ minHeight: 150 }} aria-label="Skills" value={draft.skillsText}
                  onChange={(e) => setDraft((d) => ({ ...d, skillsText: e.target.value }))} />
              </section>

              {draft.sections.map((sec, si) => (
                <section className="card" key={si}>
                  <div className="card-head"><h2>{sec.heading}</h2>{sec.dates && <span className="caption">{sec.dates}</span>}</div>
                  <div className="stack" style={{ '--gap': '18px' }}>
                    {sec.bullets.map((b, i) => {
                      const adds = targets.filter((k) => containsKeyword(b.text, k) && !containsKeyword(b.original, k));
                      return (
                        <div className="field" key={b.id}>
                          <label className="label" htmlFor={`b-${b.id}`}>Bullet {i + 1}</label>
                          <textarea id={`b-${b.id}`} className="textarea" style={{ minHeight: 84 }} value={b.text} maxLength={MAX}
                            aria-invalid={!b.text.trim() || undefined} onChange={(e) => setBullet(b.id, e.target.value)} />
                          <div className="row-between">
                            <span className="chips">
                              {adds.map((k) => <span key={k} className="chip chip-kw">+ {k}</span>)}
                            </span>
                            <span className="row" style={{ gap: 8 }}>
                              <span className="small muted mono">{b.text.length} / {MAX}</span>
                              {b.text !== b.original && (
                                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setBullet(b.id, b.original)}><Icon name="undo" />Use original</button>
                              )}
                            </span>
                          </div>
                          <details className="small muted"><summary>Original</summary><p style={{ marginTop: 6 }}>{b.original}</p></details>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              <div className="actionbar">
                <p className="note" role={empty || tooLong ? 'status' : undefined}>
                  <Icon name={empty || tooLong ? 'flag' : 'lock'} />
                  {empty ? 'Fill in every bullet, or use the original.' : tooLong ? `Keep each bullet under ${MAX} characters.` : 'Your resume won’t change until you press Save.'}
                </p>
                <Link className="btn btn-secondary" to={`/results/${analysisId}`}><Icon name="arrow-left" />Back to results</Link>
                <button className="btn btn-primary" type="button" disabled={saving || empty || tooLong} aria-busy={saving} onClick={save}>
                  {saving ? <><Icon name="refresh" />Saving…</> : <>Save and continue <Icon name="arrow-right" /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
