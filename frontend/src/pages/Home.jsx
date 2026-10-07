import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Logo } from '../lib/icons.jsx';
import { ScoreRing } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const TICKER = ['SQL', 'Power BI', 'Stakeholder reporting', 'Python', 'A/B testing', 'Tableau', 'KPIs', 'Excel', 'Communication', 'Data cleaning', 'Snowflake', 'ETL'];

const STEPS = [
  { n: '01', icon: 'scan', title: 'Scan', img: '/images/step-1.png', text: 'Upload your resume as a PDF or Word file. We pull out your experience, skills and education.' },
  { n: '02', icon: 'target', title: 'Match', img: '/images/step-2.png', text: 'Paste a job link or description. Get a 0–100 score and see exactly which keywords you’re missing.' },
  { n: '03', icon: 'sparkles', title: 'Improve', img: '/images/step-3.png', text: 'Pick a bullet, choose from 3 AI rewrites, edit it, and download your updated resume.' },
];

export default function Home() {
  const { user } = useAuth();
  const start = user ? '/dashboard' : '/signup';

  useEffect(() => {
    document.title = 'Forma · Tailor your resume to any job';
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>

      <header className="topbar topbar-dark">
        <div className="container topbar-inner">
          <Link className="logo" to="/" aria-label="Forma home"><Logo /></Link>
          <nav className="nav" aria-label="Main">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
            <Link to="/styleguide">Style guide</Link>
          </nav>
          <div className="topbar-actions">
            {user ? (
              <Link className="btn btn-primary btn-sm" to="/dashboard">Open dashboard</Link>
            ) : (
              <>
                <Link className="btn btn-glass btn-sm" to="/login">Log in</Link>
                <Link className="btn btn-primary btn-sm" to="/signup">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        <section className="hero hero-dark" aria-labelledby="hero-title">
          <div className="grid-glow" aria-hidden="true" />
          <div className="blobs" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="container">
            <div className="hero-grid">
              <div>
                <span className="pill-glow"><span className="dot" />Free for students · AI‑powered</span>
                <h1 id="hero-title" className="display" style={{ marginTop: 20 }}>
                  Tailor your resume to <span className="hl">any job</span> in <em className="grad-bright">minutes</em>.
                </h1>
                <p className="lead">Upload your resume, paste a job posting, and see how well they match. Then improve weak bullet points with AI that you stay in control of.</p>
                <div className="hero-cta">
                  <Link className="btn btn-primary btn-lg" to={start}>Get started, it’s free <Icon name="arrow-right" /></Link>
                  <a className="btn btn-glass btn-lg" href="#how">See how it works</a>
                </div>
                <p className="trust"><Icon name="shield" />Your resume stays private. Only you can see it.</p>
              </div>

              {/* Example preview: real UI components, so users see what they'll get */}
              <div className="collage" role="img" aria-label="Example: a resume with highlighted keywords and a match score card showing 68 percent, Fair match, 12 matched, 6 missing and 3 weak keywords.">
                <div className="paper-resume" aria-hidden="true">
                  <div className="name">Alex Rivera</div>
                  <div className="caption">alex.rivera@email.com · linkedin.com/in/alexrivera</div>
                  <div className="sec">Experience</div>
                  <p><strong>Data Intern · Contoso</strong></p>
                  <p>• Built <mark>Tableau</mark> dashboards to track weekly sales for the team.</p>
                  <p>• Automated a weekly <mark>Excel</mark> report with <mark>Python</mark>.</p>
                  <div className="sec">Skills</div>
                  <p><mark>SQL</mark>, <mark>Excel</mark>, Python, Tableau, Data cleaning</p>
                  <div className="line" style={{ width: '90%' }} />
                  <div className="line" style={{ width: '70%' }} />
                </div>
                <div className="float-score" aria-hidden="true">
                  <div className="eyebrow">Junior Data Analyst · Northwind Bank</div>
                  <div className="score" style={{ marginTop: 12 }}>
                    <ScoreRing value={68} sub={false} />
                    <div className="stack" style={{ '--gap': '8px' }}>
                      <span className="badge badge-fair"><Icon name="bang" />Fair match</span>
                      <div className="chips">
                        <span className="chip chip-match"><Icon name="check" />12 matched</span>
                        <span className="chip chip-miss"><Icon name="x" />6 missing</span>
                        <span className="chip chip-weak"><Icon name="bang" />3 weak</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="glass-pill gp-1" aria-hidden="true"><Icon name="trend" /><span><b>68% → 81%</b> after 3 edits</span></div>
                <div className="glass-pill gp-2" aria-hidden="true"><Icon name="sparkles" /><span><b>3 AI rewrites</b> ready</span></div>
                <div className="sticky-note" aria-hidden="true">
                  <span className="mono">AI suggestion</span>
                  “Designed Tableau dashboards reporting weekly sales KPIs to 3 managers.”
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {[...TICKER, ...TICKER].map((t, i) => <span key={i}>{t}</span>)}
          </div>
        </div>

        <section className="how" id="how" aria-labelledby="how-title">
          <div className="container">
            <div className="row-between">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 id="how-title" className="display" style={{ fontSize: 'clamp(2rem,1.4rem + 2vw,3rem)', marginTop: 8 }}>
                  Scan. Match. <em>Improve.</em>
                </h2>
              </div>
              <p className="muted" style={{ maxWidth: '26em' }}>Three steps, the same three you’ll see in the step bar inside the app, so nothing is a surprise.</p>
            </div>
            <ol className="how-grid" style={{ listStyle: 'none', padding: 0 }}>
              {STEPS.map((s) => (
                <li className="how-card" key={s.n}>
                  <div className="how-media">
                    <img src={s.img} alt="" loading="lazy" />
                    <span className="how-num" aria-hidden="true">{s.n}</span>
                  </div>
                  <div className="how-body">
                    <span className="how-ico"><Icon name={s.icon} /></span>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Before / after */}
        <section className="section" id="example" aria-labelledby="ba-title">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">See the difference</p>
              <h2 id="ba-title" className="display section-title">One bullet, <em>rewritten</em>.</h2>
              <p className="muted">An example from a Junior Data Analyst match. The AI uses keywords from the job, and you pick the version you like.</p>
            </div>
            <div className="ba-grid">
              <article className="ba-card ba-before">
                <span className="badge badge-neutral">Before</span>
                <p className="ba-text">“Built Tableau dashboards to track weekly sales for the team.”</p>
                <div className="chips">
                  <span className="chip chip-miss"><Icon name="x" />KPIs</span>
                  <span className="chip chip-miss"><Icon name="x" />Stakeholder reporting</span>
                </div>
                <div className="ba-score"><span className="n">68%</span><span className="badge badge-fair"><Icon name="bang" />Fair match</span></div>
              </article>
              <div className="ba-arrow" aria-hidden="true"><Icon name="sparkles" /></div>
              <article className="ba-card ba-after">
                <span className="badge badge-good"><Icon name="check" />After</span>
                <p className="ba-text">“Designed Tableau dashboards reporting weekly sales <mark>KPIs</mark> to 3 store managers, supporting <mark>stakeholder reporting</mark> every Monday.”</p>
                <div className="chips">
                  <span className="chip chip-match"><Icon name="check" />KPIs</span>
                  <span className="chip chip-match"><Icon name="check" />Stakeholder reporting</span>
                </div>
                <div className="ba-score"><span className="n">81%</span><span className="badge badge-good"><Icon name="check" />Strong match</span></div>
              </article>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="section section-tint" id="features" aria-labelledby="feat-title">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">Features</p>
              <h2 id="feat-title" className="display section-title">Everything you need to <em>get the interview</em>.</h2>
            </div>
            <div className="bento">
              <article className="bento-card b-wide" style={{ '--c': 'var(--brand)', '--t': 'var(--brand-tint)' }}>
                <span className="how-ico"><Icon name="target" /></span>
                <h3>ATS‑style match score</h3>
                <p>See a 0–100 score in seconds, with a clear Low, Fair or Strong label and what it would take to move up.</p>
                <div className="mini-bars" aria-hidden="true">
                  <span style={{ '--w': '41%', '--c2': 'var(--bad)' }} />
                  <span style={{ '--w': '68%', '--c2': 'var(--fair)' }} />
                  <span style={{ '--w': '81%', '--c2': 'var(--good)' }} />
                </div>
              </article>
              <article className="bento-card" style={{ '--c': 'var(--coral-ink)', '--t': 'var(--coral-tint)' }}>
                <span className="how-ico"><Icon name="list" /></span>
                <h3>Keyword gaps</h3>
                <p>Matched, missing and weak keywords, each with its own icon and pattern.</p>
              </article>
              <article className="bento-card" style={{ '--c': 'var(--violet-ink)', '--t': 'var(--violet-tint)' }}>
                <span className="how-ico"><Icon name="sparkles" /></span>
                <h3>3 AI rewrites</h3>
                <p>Pick one, edit it, or skip it. Nothing changes until you press Save.</p>
              </article>
              <article className="bento-card" style={{ '--c': 'var(--mint-ink)', '--t': 'var(--mint-tint)' }}>
                <span className="how-ico"><Icon name="flag" /></span>
                <h3>Honest‑skill check</h3>
                <p>If a suggestion adds a skill you don’t have, we flag it.</p>
              </article>
              <article className="bento-card" style={{ '--c': 'var(--brand-2)', '--t': 'var(--violet-tint)' }}>
                <span className="how-ico"><Icon name="download" /></span>
                <h3>PDF export</h3>
                <p>Preview every change, then download a clean file. Your original stays untouched.</p>
              </article>
              <article className="bento-card b-wide" style={{ '--c': 'var(--ink)', '--t': 'var(--marker-soft)' }}>
                <span className="how-ico"><Icon name="access" /></span>
                <h3>Accessible by design</h3>
                <p>WCAG AA contrast, colour‑blind friendly keyword colours, text up to 150% and full keyboard support.</p>
                <div className="chips" style={{ marginTop: 12 }}>
                  <span className="chip chip-kw">Aa 150%</span>
                  <span className="chip chip-kw">High contrast</span>
                  <span className="chip chip-kw">Reduce motion</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="band" id="privacy" aria-labelledby="privacy-title">
          <div className="container">
            <h2 id="privacy-title">You stay in control</h2>
            <p style={{ marginTop: 8, maxWidth: '40em' }}>Nothing changes on your resume until you press Save, and your original file is never overwritten.</p>
            <div className="band-grid">
              <div><Icon name="lock" /><h3>Private by default</h3><p>Your resumes are only visible to you. Delete your data at any time.</p></div>
              <div><Icon name="flag" /><h3>Honest suggestions</h3><p>If the AI mentions a skill that isn’t on your resume, we flag it so you never claim something untrue.</p></div>
              <div><Icon name="access" /><h3>Built for everyone</h3><p>Large text, high contrast and colour‑blind friendly keyword colours are one click away.</p></div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section" id="faq" aria-labelledby="faq-title">
          <div className="container faq-grid">
            <div>
              <p className="eyebrow">FAQ</p>
              <h2 id="faq-title" className="display section-title">Questions, <em>answered</em>.</h2>
              <p className="muted" style={{ marginTop: 12 }}>Still curious? Open Help from the <b>?</b> button inside the app.</p>
            </div>
            <div className="faq">
              <details open><summary>Is Forma free?</summary><p>Yes. It’s free for students and early‑career job seekers.</p></details>
              <details><summary>Which files can I upload?</summary><p>PDF or Word (DOCX) files up to 10 MB. Scanned images can’t be read, so export your resume from Word or Google Docs.</p></details>
              <details><summary>Will the AI make things up?</summary><p>It only rewrites what’s on your resume. If an option mentions a skill you haven’t listed, it’s flagged so you can skip it.</p></details>
              <details><summary>What if a job link doesn’t work?</summary><p>Some sites block automatic reading. The app offers “Paste description instead” with one click, and nothing you entered is lost.</p></details>
              <details><summary>Who can see my resume?</summary><p>Only you. You can download or delete all of your data from Settings at any time.</p></details>
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="container" aria-labelledby="cta-title">
          <div className="cta-card">
            <div className="blobs" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="cta-inner">
              <h2 id="cta-title" className="display">Ready to tailor your <em className="grad-bright">first resume</em>?</h2>
              <p>Upload once, match with as many jobs as you like.</p>
              <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
                <Link className="btn btn-light btn-lg" to={start}>Get started, it’s free <Icon name="arrow-right" /></Link>
                {!user && <Link className="btn btn-glass btn-lg" to="/login">I already have an account</Link>}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Link className="logo" to="/" aria-label="Forma home"><Logo /></Link>
              <p className="footer-tag">Scan. Match. Improve. A resume helper built for students and early‑career job seekers.</p>
            </div>
            <nav aria-label="Product"><h3>Product</h3><a href="#how">How it works</a><a href="#features">Features</a><a href="#example">Example</a><a href="#faq">FAQ</a></nav>
            <nav aria-label="Resources"><h3>Resources</h3><Link to="/styleguide">Style guide</Link><Link to="/signup">Create account</Link><Link to="/login">Log in</Link></nav>
            <nav aria-label="Team"><h3>Team</h3><span>Gaurav Bhandari · Database</span><span>Serene Plummer · Backend</span><span>Ingeet Adhikari · Frontend</span><span>Anup Sharma · QA</span></nav>
          </div>
          <div className="footer-bottom">
            <span>© 2026 Forma. All rights reserved.</span>
            <span>CSCE 3444 Software Engineering · University of North Texas</span>
            <span className="row" style={{ gap: 16 }}><a href="#privacy">Privacy</a><a href="#faq">Terms</a><a href="#main">Back to top ↑</a></span>
          </div>
        </div>
      </footer>
    </>
  );
}
