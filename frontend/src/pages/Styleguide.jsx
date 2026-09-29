import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, ICON_NAMES, Logo } from '../lib/icons.jsx';
import { ScoreRing, Steps } from '../lib/ui.jsx';

// WCAG relative luminance + contrast ratio
const lum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return ((x + 0.05) / (y + 0.05)).toFixed(1);
};
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const BRAND = [
  ['Ink', 'headings, body, primary button', '--ink', '--paper'],
  ['Paper', 'page background', '--paper', '--ink'],
  ['Marker', 'highlight, selected, primary shadow', '--marker', '--ink'],
  ['Indigo', 'buttons, links, focus', '--brand', '--surface'],
  ['Ink 2', 'secondary text', '--paper', '--ink-2'],
  ['Ink 3', 'captions (12 px min)', '--paper', '--ink-3'],
  ['Violet', 'gradient end, AI panels', '--violet-tint', '--violet-ink'],
  ['Coral', 'analyses, PDF files', '--coral-tint', '--coral-ink'],
  ['Mint', 'progress, best score', '--mint-tint', '--mint-ink'],
];
const STATUS = [
  ['Matched / Strong ✓', 'solid chip', '--good-tint', '--good'],
  ['Weak / Fair !', 'striped chip', '--fair-tint', '--fair'],
  ['Missing / Low ✕', 'dashed chip', '--bad-tint', '--bad'],
];
const CB_VARS = { '--good': '#0a5a96', '--good-tint': '#e2eef9', '--fair': '#7a5300', '--fair-tint': '#fcf0cc', '--bad': '#8f2a67', '--bad-tint': '#f7e4ef' };

function Swatches({ list }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    setRows(list.map(([label, use, bgVar, fgVar]) => {
      const bg = cssVar(bgVar);
      const fg = cssVar(fgVar);
      return { label, use, bg, fg, r: ratio(fg, bg) };
    }));
  }, [list]);
  return (
    <div className="swatches">
      {rows.map((s) => (
        <div className="swatch" key={s.label}>
          <div className="chip-color" style={{ background: s.bg, color: s.fg }}><span>Aa</span><span className="ratio">{s.r} : 1</span></div>
          <div className="meta"><strong>{s.label}</strong><span className="mono">{s.bg.toUpperCase()}</span> · {s.use}</div>
        </div>
      ))}
    </div>
  );
}

const Chips = () => (
  <>
    <span className="chip chip-match"><Icon name="check" />SQL</span>
    <span className="chip chip-miss"><Icon name="x" />Power BI</span>
    <span className="chip chip-weak"><Icon name="bang" />Statistics</span>
  </>
);

export default function Styleguide() {
  useEffect(() => {
    document.title = 'Style guide · Forma';
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link className="logo" to="/" aria-label="Forma home"><Logo /></Link>
          <nav className="nav" aria-label="Style guide sections">
            <a href="#colors">Colors</a><a href="#type">Type</a><a href="#components">Components</a><a href="#icons">Icons</a><a href="#screens">Screens</a>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="hero container" style={{ paddingBottom: 48 }}>
          <p className="eyebrow">UI Design Assignment · Style guide</p>
          <h1 className="display" style={{ marginTop: 12 }}>Paper, ink &amp; <span className="grad-text">a little</span> <span className="hl">colour</span>.</h1>
          <p className="lead" style={{ marginTop: 18 }}>A resume is a sheet of paper, and tailoring it is like going over it with a highlighter. The interface keeps that idea (clean off‑white paper, near‑black ink, marker yellow for highlights) and adds an indigo‑to‑violet gradient for actions, plus a small family of coral, mint and sky accents so each feature has its own colour.</p>
          <p className="small muted" style={{ marginTop: 14 }}>Team: Gaurav Bhandari (Database) · Serene Plummer (Backend) · Ingeet Adhikari (Frontend) · Anup Sharma (QA)</p>
        </section>

        {/* 01 COLORS */}
        <section className="sg-sec" id="colors" aria-labelledby="c-title">
          <div className="container">
            <header><span className="sg-num" aria-hidden="true">01</span><div><h2 id="c-title" className="h1">Colors</h2><p className="muted" style={{ marginTop: 6 }}>Contrast ratios below are calculated live from the CSS, so they stay true if a color changes. Every text pair passes WCAG 2.1 AA (4.5 : 1).</p></div></header>
            <h3 style={{ marginBottom: 12 }}>Brand &amp; neutrals</h3>
            <Swatches list={BRAND} />
            <h3 style={{ margin: '28px 0 12px' }}>Status colors · always paired with an icon, a word and a pattern</h3>
            <Swatches list={STATUS} />
            <div className="grid-2" style={{ marginTop: 28 }}>
              <div className="card">
                <h3>Color‑blind safe: never color alone</h3>
                <p className="small muted" style={{ margin: '6px 0 14px' }}>Left: normal. Right: the same chips in grayscale. They still read differently thanks to the icon (✓ ✕ !), the fill (solid, dashed, striped) and the word.</p>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="chips"><Chips /></div>
                  <div className="chips gray" aria-hidden="true"><Chips /></div>
                </div>
              </div>
              <div className="card">
                <h3>Alternate palette (Settings → Accessibility)</h3>
                <p className="small muted" style={{ margin: '6px 0 14px' }}>Blue / amber / purple, based on Okabe–Ito, for users with red‑green color blindness.</p>
                <div className="chips" style={CB_VARS}>
                  <span className="chip chip-match"><Icon name="check" />Matched</span>
                  <span className="chip chip-weak"><Icon name="bang" />Weak</span>
                  <span className="chip chip-miss"><Icon name="x" />Missing</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 TYPE */}
        <section className="sg-sec" id="type" aria-labelledby="t-title">
          <div className="container">
            <header><span className="sg-num" aria-hidden="true">02</span><div><h2 id="t-title" className="h1">Typography</h2><p className="muted" style={{ marginTop: 6 }}><strong>Fraunces</strong> (display serif) for headings, <strong>Public Sans</strong> (designed by the U.S. government for accessible interfaces) for body text, <strong>IBM Plex Mono</strong> for labels and numbers.</p></div></header>
            <div className="type-row"><span className="caption">Display · Fraunces</span><span className="display" style={{ fontSize: '3rem' }}>Scan. Match. <em>Improve.</em></span><span className="caption mono">48–68 / 700 · lh 1.02</span></div>
            <div className="type-row"><span className="caption">H1 · Fraunces</span><span className="h1">Match <em>results</em></span><span className="caption mono">28–40 / 650</span></div>
            <div className="type-row"><span className="caption">H2 · Fraunces</span><span className="h2">Keywords from the job</span><span className="caption mono">22 / 600</span></div>
            <div className="type-row"><span className="caption">H3 · Public Sans</span><span className="h3">My resumes</span><span className="caption mono">17 / 700</span></div>
            <div className="type-row"><span className="caption">Body · Public Sans</span><span>Upload your resume, paste a job posting, and see how well they match.</span><span className="caption mono">16 / 400 · lh 1.5</span></div>
            <div className="type-row"><span className="caption">Small / UI</span><span className="small">Uploaded Sep 24, 2026 · 14 bullets</span><span className="caption mono">14 / 400–600</span></div>
            <div className="type-row"><span className="caption">Label · Plex Mono</span><span className="eyebrow">Main feature 2 · Match results</span><span className="caption mono">12 / 500 caps</span></div>
            <div className="type-row"><span className="caption">Caption (minimum)</span><span className="caption">PDF or DOCX only · up to 10 MB</span><span className="caption mono">12 / 500</span></div>
            <div className="alert alert-tip" style={{ marginTop: 20 }}><Icon name="type" /><div className="alert-body"><strong>Readability rules</strong>Body text is 16 px and nothing is smaller than 12 px. Line height 1.5, lines under ~80 characters, left‑aligned, sentence case. All sizes use rem, so Settings → Text size scales the whole UI to 125% or 150% without breaking layout.</div></div>
          </div>
        </section>

        {/* 03 COMPONENTS */}
        <section className="sg-sec" id="components" aria-labelledby="k-title">
          <div className="container">
            <header><span className="sg-num" aria-hidden="true">03</span><div><h2 id="k-title" className="h1">Components</h2><p className="muted" style={{ marginTop: 6 }}>8‑point spacing grid. Radius 8–10 px on buttons and inputs, 14–20 px on cards, pill for badges. Cards are white with soft, slightly blue shadows; the primary button uses the indigo‑violet gradient.</p></div></header>

            <div className="demo-grid">
              <div className="card">
                <h3 style={{ marginBottom: 14 }}>Buttons</h3>
                <span className="state-label">Primary · one per screen</span>
                <div className="row"><button className="btn btn-primary" type="button">Analyze match</button><button className="btn btn-primary force-focus" type="button" tabIndex={-1}>Focus</button><button className="btn btn-primary" type="button" disabled>Disabled</button></div>
                <span className="state-label" style={{ marginTop: 14 }}>Secondary · ghost · danger</span>
                <div className="row"><button className="btn btn-secondary" type="button">Cancel</button><button className="btn btn-ghost" type="button">Forgot password?</button><button className="btn btn-danger" type="button"><Icon name="trash" />Delete</button></div>
                <span className="state-label" style={{ marginTop: 14 }}>Loading · sizes 36 / 44 / 54 px</span>
                <div className="row"><button className="btn btn-secondary btn-sm" type="button" aria-busy="true"><Icon name="refresh" />Generating…</button><button className="btn btn-secondary" type="button">Default</button><button className="btn btn-secondary btn-lg" type="button">Large</button></div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 14 }}>Form fields · label always visible</h3>
                <div className="field"><label className="label" htmlFor="sg1">Email</label><input className="input" id="sg1" placeholder="you@example.com" /></div>
                <div className="field"><label className="label" htmlFor="sg2">Email</label><input className="input" id="sg2" defaultValue="alex@email.com" /><span className="msg msg-ok"><Icon name="check-circle" />Looks good</span></div>
                <div className="field"><label className="label" htmlFor="sg3">Email</label><input className="input" id="sg3" defaultValue="alex@email" aria-invalid="true" /><span className="msg msg-error"><Icon name="x-circle" />Add a domain, like .com</span></div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 14 }}>Choices</h3>
                <div className="stack" style={{ '--gap': '12px' }}>
                  <label className="check"><input type="checkbox" defaultChecked /> Checkbox (on)</label>
                  <label className="check"><input type="radio" name="sgr" defaultChecked /> Radio (selected)</label>
                  <label className="switch"><input type="checkbox" defaultChecked /><span>Switch</span><span className="switch-state caption">On</span></label>
                  <div className="segmented" role="tablist" aria-label="Example"><button role="tab" type="button" aria-selected="true"><Icon name="link" />Paste URL</button><button role="tab" type="button" aria-selected="false" tabIndex={-1}><Icon name="clipboard" />Paste text</button></div>
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 14 }}>Feedback &amp; system status</h3>
                <div className="stack" style={{ '--gap': '10px' }}>
                  <div className="alert alert-success"><Icon name="check-circle" /><div className="alert-body"><strong>Resume uploaded</strong>We found 5 sections and 14 bullets.</div></div>
                  <div className="alert alert-warn"><Icon name="alert" /><div className="alert-body"><strong>We couldn’t read that link</strong>Paste the job description instead.</div></div>
                  <div className="alert alert-error"><Icon name="x-circle" /><div className="alert-body"><strong>File too large</strong>Resumes must be 10 MB or smaller.</div></div>
                  <div className="alert alert-info"><Icon name="info" /><div className="alert-body"><strong>Tip</strong>Add a job to see your match score.</div></div>
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 14 }}>Progress &amp; loading</h3>
                <span className="state-label">Upload · 64%</span>
                <div className="progress"><span style={{ '--value': '64%' }} /></div>
                <span className="state-label" style={{ marginTop: 16 }}>Working</span>
                <div className="row"><span className="spinner" /><span className="small">Reading job posting… usually under 10 s</span></div>
                <span className="state-label" style={{ marginTop: 16 }}>Skeleton</span>
                <div className="stack" style={{ '--gap': '8px' }}><div className="skeleton" /><div className="skeleton" style={{ width: '70%' }} /></div>
                <span className="state-label" style={{ marginTop: 16 }}>Toast</span>
                <div className="toast" style={{ animation: 'none' }}><Icon name="check-circle" /><p>Bullet saved</p><button type="button">Undo</button></div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 14 }}>Badges &amp; match score</h3>
                <div className="row"><span className="badge badge-good"><Icon name="check" />Strong · 75–100</span><span className="badge badge-fair"><Icon name="bang" />Fair · 50–74</span><span className="badge badge-bad"><Icon name="x" />Low · 0–49</span></div>
                <div className="row" style={{ marginTop: 10 }}><span className="badge badge-marker">Recommended</span><span className="badge badge-brand"><Icon name="pencil" />Edited</span><span className="badge badge-neutral">Draft</span></div>
                <div className="score" style={{ marginTop: 18, gridTemplateColumns: 'auto 1fr' }}><ScoreRing value={68} style={{ width: 120, height: 120 }} /><p className="small muted">Score = number + ring + word + icon. Color is never the only cue.</p></div>
              </div>
            </div>

            <h3 style={{ margin: '32px 0 12px' }}>Step bar · analysis flow</h3>
            <Steps current={3} />
          </div>
        </section>

        {/* 04 ICONS */}
        <section className="sg-sec" id="icons" aria-labelledby="i-title">
          <div className="container">
            <header><span className="sg-num" aria-hidden="true">04</span><div><h2 id="i-title" className="h1">Icons</h2><p className="muted" style={{ marginTop: 6 }}>24 px grid, 2 px round stroke. Icons always come with a text label; icon‑only buttons have an accessible name and a tooltip.</p></div></header>
            <div className="icons-grid">{ICON_NAMES.map((n) => <div key={n}><Icon name={n} /><span>{n}</span></div>)}</div>
          </div>
        </section>

        {/* 05 PRINCIPLES */}
        <section className="sg-sec" id="principles" aria-labelledby="p-title">
          <div className="container">
            <header><span className="sg-num" aria-hidden="true">05</span><div><h2 id="p-title" className="h1">Design principles applied</h2></div></header>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="principles">
                <thead><tr><th scope="col">Principle</th><th scope="col">How it shows up</th><th scope="col">Where</th></tr></thead>
                <tbody>
                  <tr><td><strong>Consistent layout</strong></td><td>Same top bar, page title position, one primary button (indigo gradient) and the same step bar on every flow screen.</td><td>All signed‑in pages</td></tr>
                  <tr><td><strong>Simple navigation</strong></td><td>Three top links; they become a labelled bottom tab bar on phones. Done steps in the step bar are clickable to go back.</td><td>Dashboard, flow</td></tr>
                  <tr><td><strong>Visibility of system status</strong></td><td>Upload progress with % and bytes, “Reading job posting…”, “Writing 3 options…”, toasts after saving, “1 of 3 bullets improved”.</td><td>Dashboard, Job, Improve</td></tr>
                  <tr><td><strong>Recognition over recall</strong></td><td>Chosen resume stays visible, original bullet stays above the AI options, recent analyses show score and label.</td><td>Job, Improve, Dashboard</td></tr>
                  <tr><td><strong>Error prevention</strong></td><td>File rules shown before upload, Caps Lock warning, disabled Create account until valid, AI “check this skill” flag, type DELETE to delete account.</td><td>Login, Dashboard, Improve, Settings</td></tr>
                  <tr><td><strong>Help users recover</strong></td><td>URL fails → paste description in one click; AI down → edit manually; every delete asks for confirmation.</td><td>Job, Improve, Dashboard</td></tr>
                  <tr><td><strong>Contrast</strong></td><td>All text ≥ 4.5 : 1 (most ≥ 7 : 1); focus ring is a 3 px blue outline with a white gap; high‑contrast mode.</td><td>Global, Settings</td></tr>
                  <tr><td><strong>Color‑blind safe</strong></td><td>Status = icon + word + pattern; optional blue/amber/purple palette.</td><td>Results, Settings</td></tr>
                  <tr><td><strong>Readable text &amp; clear labels</strong></td><td>16 px body, 12 px minimum, text size up to 150%, visible labels above fields, buttons say what they do (“Delete resume”, not “OK”).</td><td>Global</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 06 SCREENS */}
        <section className="sg-sec" id="screens" aria-labelledby="s-title">
          <div className="container">
            <header><span className="sg-num" aria-hidden="true">06</span><div><h2 id="s-title" className="h1">Screens</h2><p className="muted" style={{ marginTop: 6 }}>Every page is clickable and uses live data from your account. Flow screens open your most recent analysis.</p></div></header>
            <div className="screens">
              <Link className="screen-link" to="/"><strong>Welcome</strong><span>Landing page</span></Link>
              <Link className="screen-link" to="/login"><strong>Log in</strong><span>FR‑1.1</span></Link>
              <Link className="screen-link" to="/signup"><strong>Sign up</strong><span>FR‑1.1 · strength meter</span></Link>
              <Link className="screen-link" to="/dashboard"><strong>Dashboard</strong><span>FR‑2 · upload resume</span></Link>
              <Link className="screen-link" to="/job"><strong>Job posting</strong><span>Feature 1 · FR‑3</span></Link>
              <Link className="screen-link" to="/latest/results"><strong>Match results</strong><span>Feature 2 · FR‑4</span></Link>
              <Link className="screen-link" to="/latest/improve"><strong>Improve bullets</strong><span>Feature 3 · FR‑5</span></Link>
              <Link className="screen-link" to="/latest/export"><strong>Export</strong><span>Feature 4 · FR‑6</span></Link>
              <Link className="screen-link" to="/latest/done"><strong>Confirmation</strong><span>Download complete</span></Link>
              <Link className="screen-link" to="/settings#accessibility"><strong>Settings</strong><span>Accessibility and account</span></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer container">Forma · UI Design Assignment · 2026</footer>
    </>
  );
}
