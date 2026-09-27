import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppShell, { useShell } from '../components/AppShell.jsx';
import { Icon } from '../lib/icons.jsx';
import { useUI } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

const DEFAULTS = { text: 'default', contrast: 'off', motion: 'off', palette: 'standard', notifyDone: true, notifyTips: false };
const SECTIONS = [
  ['profile', 'user', 'Profile'],
  ['password', 'lock', 'Password & login'],
  ['accessibility', 'access', 'Accessibility'],
  ['notifications', 'bell', 'Notifications'],
  ['privacy', 'database', 'Data & privacy'],
];

function readPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ra:prefs') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

// Live preview: apply straight to <html> (same attributes public/prefs.js sets on load).
function applyPrefs(p) {
  const root = document.documentElement;
  if (p.text === 'default') delete root.dataset.text; else root.dataset.text = p.text;
  if (p.contrast === 'high') root.dataset.contrast = 'high'; else delete root.dataset.contrast;
  if (p.motion === 'reduce') root.dataset.motion = 'reduce'; else delete root.dataset.motion;
  if (p.palette === 'cb') root.dataset.palette = 'cb'; else delete root.dataset.palette;
}

function Switch({ id, checked, onChange }) {
  return (
    <label className="switch">
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-state" aria-hidden="true">{checked ? 'On' : 'Off'}</span>
    </label>
  );
}

function SettingsBody() {
  const { user, displayName, setName, setUser } = useAuth();
  const { toast, confirm } = useUI();
  const { showTimeoutWarning, doLogout } = useShell();
  const location = useLocation();
  const navigate = useNavigate();
  const sec = location.hash.slice(1) || 'accessibility';

  const [saved, setSaved] = useState(() => ({ ...readPrefs(), name: displayName }));
  const [draft, setDraft] = useState(saved);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const set = (k, v) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    applyPrefs(next);
  };

  // Leaving the page with unsaved preview changes restores the saved look.
  useEffect(() => () => applyPrefs(savedRef.current), []);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = () => {
    const { name, ...prefs } = draft;
    try {
      localStorage.setItem('ra:prefs', JSON.stringify(prefs));
    } catch {
      // storage blocked
    }
    setName(user.email, name.trim());
    setSaved({ ...draft, name: name.trim() });
    setDraft((d) => ({ ...d, name: name.trim() }));
    toast('Settings saved');
  };

  const discard = () => {
    setDraft(saved);
    applyPrefs(saved);
    toast('Changes discarded', { icon: 'undo' });
  };

  const exportData = async () => {
    try {
      const [r, j, a] = await Promise.all([api.listResumes(), api.listJobPostings(), api.listAnalyses()]);
      const bullets = await Promise.all(a.analyses.map((x) => api.listBulletSuggestions(x.id).then((s) => ({ analysisId: x.id, ...s }))));
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), user, resumes: r.resumes, jobPostings: j.jobPostings, analyses: a.analyses, bulletSuggestions: bullets }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'forma-data.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Your data was downloaded', { icon: 'download' });
    } catch (err) {
      toast(err.message, { icon: 'x-circle' });
    }
  };

  const deleteAccount = async (btn) => {
    const ok = await confirm({
      title: 'Delete your account?',
      body: <>This permanently removes your account, <strong>all resumes and all analyses</strong>. This can’t be undone.</>,
      requireText: 'DELETE',
      confirmLabel: 'Delete account',
    });
    if (!ok) {
      btn?.focus();
      return;
    }
    try {
      await api.deleteAccount();
      setName(user.email, '');
      setUser(null);
      navigate('/login', { state: { notice: 'deleted' } });
    } catch (err) {
      toast(err.message, { icon: 'x-circle' });
    }
  };

  return (
    <main id="main" className="page">
      <div className="container">
        <div className="page-head">
          <div>
            <p className="eyebrow">Account</p>
            <h1 style={{ marginTop: 6 }}>Settings</h1>
          </div>
        </div>

        <div className="settings">
          <nav className="side-nav" aria-label="Settings sections">
            {SECTIONS.map(([key, icon, label]) => (
              <Link key={key} to={`#${key}`} replace aria-current={sec === key ? 'true' : undefined}><Icon name={icon} />{label}</Link>
            ))}
            <hr />
            <button type="button" onClick={() => doLogout(false)}><Icon name="logout" />Log out</button>
          </nav>

          <div>
            {sec === 'profile' && (
              <section className="card" aria-labelledby="h-profile">
                <h2 id="h-profile">Profile</h2>
                <p className="muted" style={{ marginTop: 6 }}>This is the name we greet you with. Your exported resume uses the name on the resume itself.</p>
                <div className="grid-2" style={{ marginTop: 20 }}>
                  <div className="field"><label className="label" htmlFor="p-name">Full name</label><input className="input" id="p-name" value={draft.name} onChange={(e) => set('name', e.target.value)} /></div>
                  <div className="field" style={{ marginTop: 0 }}>
                    <label className="label" htmlFor="p-email">Email</label>
                    <input className="input" id="p-email" type="email" value={user.email} readOnly aria-describedby="p-email-hint" />
                    <span className="hint" id="p-email-hint">Your login email can’t be changed yet.</span>
                  </div>
                </div>
              </section>
            )}

            {sec === 'password' && (
              <section className="card" aria-labelledby="h-password">
                <h2 id="h-password">Password &amp; login</h2>
                <p className="muted" style={{ marginTop: 6 }}>Passwords follow the sign‑up rules: 8+ characters, mixed case and a number. Changing your password isn’t available yet.</p>
                <hr className="divider-line" />
                <div className="setting" style={{ borderTop: 0 }}>
                  <div><h3>Automatic log out</h3><p>For your safety you’re logged out after <strong>15 minutes</strong> of no activity. We warn you 1 minute before.</p></div>
                  <div className="row">
                    <span className="badge badge-neutral"><Icon name="lock" />Always on</span>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={showTimeoutWarning}>Preview warning</button>
                  </div>
                </div>
              </section>
            )}

            {sec === 'accessibility' && (
              <section className="card card-ink glow" aria-labelledby="h-access">
                <div className="row-between">
                  <h2 id="h-access">Accessibility</h2>
                  <span className="badge badge-brand"><Icon name="eye" />Changes preview instantly</span>
                </div>

                <div className="setting" style={{ marginTop: 8 }}>
                  <div><h3 id="lbl-size">Text size</h3><p>Each option is shown at its own size.</p></div>
                  <div className="size-opts" role="radiogroup" aria-labelledby="lbl-size">
                    {[['default', '1rem', 'Default'], ['large', '1.25rem', 'Large'], ['xl', '1.5rem', 'Extra large']].map(([v, size, label]) => (
                      <label className="size-opt" key={v}>
                        <input type="radio" name="text" value={v} checked={draft.text === v} onChange={() => set('text', v)} />
                        <span><b style={{ fontSize: size }}>Aa</b>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="setting">
                  <div><h3><label htmlFor="t-contrast">High‑contrast mode</label></h3><p>Darker borders and text, stronger focus outlines.</p></div>
                  <Switch id="t-contrast" checked={draft.contrast === 'high'} onChange={(on) => set('contrast', on ? 'high' : 'off')} />
                </div>

                <div className="setting">
                  <div><h3><label htmlFor="t-motion">Reduce motion</label></h3><p>Turn off animations and loading shimmer.</p></div>
                  <Switch id="t-motion" checked={draft.motion === 'reduce'} onChange={(on) => set('motion', on ? 'reduce' : 'off')} />
                </div>

                <div className="setting">
                  <div>
                    <h3 id="lbl-pal">Keyword colors</h3>
                    <p>Icons and patterns always stay on. Choose the color set.</p>
                    <div className="palette-preview" aria-hidden="true">
                      <span className="chip chip-match"><Icon name="check" />Matched</span>
                      <span className="chip chip-weak"><Icon name="bang" />Weak</span>
                      <span className="chip chip-miss"><Icon name="x" />Missing</span>
                    </div>
                  </div>
                  <div className="segmented" role="radiogroup" aria-labelledby="lbl-pal">
                    <label><input type="radio" name="palette" value="standard" checked={draft.palette === 'standard'} onChange={() => set('palette', 'standard')} /><span>Standard</span></label>
                    <label><input type="radio" name="palette" value="cb" checked={draft.palette === 'cb'} onChange={() => set('palette', 'cb')} /><span><Icon name="palette" className="icon-sm" />Color‑blind friendly</span></label>
                  </div>
                </div>
              </section>
            )}

            {sec === 'notifications' && (
              <section className="card" aria-labelledby="h-notif">
                <h2 id="h-notif">Notifications</h2>
                <p className="muted" style={{ marginTop: 6 }}>Saved to this browser. Email delivery is coming soon.</p>
                <div className="setting" style={{ marginTop: 8 }}>
                  <div><h3><label htmlFor="n-email">Email me when an analysis is ready</label></h3><p>Useful for long job postings.</p></div>
                  <Switch id="n-email" checked={draft.notifyDone} onChange={(on) => set('notifyDone', on)} />
                </div>
                <div className="setting">
                  <div><h3><label htmlFor="n-tips">Weekly resume tips</label></h3><p>One short email a week. Unsubscribe any time.</p></div>
                  <Switch id="n-tips" checked={draft.notifyTips} onChange={(on) => set('notifyTips', on)} />
                </div>
              </section>
            )}

            {sec === 'privacy' && (
              <div className="stack" style={{ '--gap': '20px' }}>
                <section className="card" aria-labelledby="h-priv">
                  <h2 id="h-priv">Data &amp; privacy</h2>
                  <p className="muted" style={{ marginTop: 6 }}>Your resumes are only visible to you.</p>
                  <div className="setting" style={{ marginTop: 8 }}>
                    <div><h3>Download my data</h3><p>Your resumes, job postings, analyses and saved bullets as a .json file.</p></div>
                    <button className="btn btn-secondary" type="button" onClick={exportData}><Icon name="download" />Download data</button>
                  </div>
                </section>
                <section className="card danger-zone" aria-labelledby="h-danger">
                  <h2 id="h-danger" className="row" style={{ gap: 10 }}><Icon name="alert" />Danger zone</h2>
                  <div className="setting" style={{ borderTop: 0 }}>
                    <div><h3>Delete account</h3><p>Permanently removes your account, resumes and analyses.</p></div>
                    <button className="btn btn-danger-outline" type="button" onClick={(e) => deleteAccount(e.currentTarget)}><Icon name="trash" />Delete account…</button>
                  </div>
                </section>
              </div>
            )}

            <div className="actionbar unsaved" role="region" aria-label="Unsaved changes" data-show={dirty}>
              <p className="note"><Icon name="info" /><strong style={{ color: 'var(--ink)' }}>You have unsaved changes</strong></p>
              <button className="btn btn-secondary" type="button" onClick={discard}>Discard</button>
              <button className="btn btn-primary" type="button" onClick={save}>Save changes</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Settings() {
  useEffect(() => {
    document.title = 'Settings · Forma';
  }, []);
  return (
    <AppShell active="settings" back="/dashboard">
      <SettingsBody />
    </AppShell>
  );
}
