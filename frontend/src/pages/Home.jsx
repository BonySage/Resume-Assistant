import { useNavigate } from 'react-router-dom';
import { PublicNav } from '../components/Nav.jsx';
import WaveHero from '../components/WaveHero.jsx';

const steps = [
  { n: 1, title: 'Upload', desc: 'Drop in your resume as a PDF or Word doc.' },
  { n: 2, title: 'Add a job posting', desc: 'Paste a job URL or the description text.' },
  { n: 3, title: 'See your match score', desc: 'Get a 0-100% ATS score with matched, missing, and weak keywords.' },
  { n: 4, title: 'Improve & download', desc: 'Pick from 3 AI-tailored bullet rewrites, then export the updated PDF.' },
];

const capabilities = [
  { title: 'ATS Match Score', desc: 'A 0-100% score comparing your resume to a specific job posting, not a generic grade.' },
  { title: 'Keyword Gaps', desc: 'See exactly which required and nice-to-have skills are missing or under-emphasized.' },
  { title: 'Grounded AI Rewrites', desc: 'Bullet suggestions are checked against your resume so they never invent skills you don\'t have.' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page-fade">
      <PublicNav />

      <main>
        <section style={{ maxWidth: 1180, margin: '0 auto', padding: '96px 24px 64px', position: 'relative', overflow: 'hidden' }}>
          <WaveHero />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 48, alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <h1
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(34px,7vw,56px)',
                    fontWeight: 600,
                    lineHeight: 1.07,
                    letterSpacing: -0.28,
                    margin: '0 0 20px',
                    color: 'var(--ink)',
                  }}
                >
                  Scan. Match.
                  <br />
                  Improve.
                </h1>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(20px,3vw,28px)',
                    fontWeight: 400,
                    lineHeight: 1.14,
                    letterSpacing: 0.196,
                    color: 'var(--ink)',
                    maxWidth: 520,
                    margin: '0 0 36px',
                  }}
                >
                  See exactly how your resume stacks up against a real job posting — then fix the gaps with AI-tailored rewrites.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button className="lg-cta btn-primary" onClick={() => navigate('/signup')}>
                    Get Started
                    <span className="lg-shimmer" />
                  </button>
                  <button className="btn-outline" onClick={() => navigate('/login')}>
                    Log In
                  </button>
                </div>
              </div>
              <div
                className="lg-card"
                style={{
                  width: '100%',
                  height: 'clamp(280px,32vw,380px)',
                  borderRadius: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 44, fontWeight: 700, color: 'var(--primary)' }}>78%</div>
                <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Match score example</div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ background: 'var(--canvas)', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, #dcebfa 0%, #e9e9ff 35%, #f7f7f5 70%)', opacity: 0.7, zIndex: 0 }} />
          <div style={{ maxWidth: 980, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 600, textAlign: 'center', margin: '0 0 48px', color: 'var(--ink)' }}>
              How it works
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
              {steps.map((step) => (
                <div
                  key={step.n}
                  style={{
                    borderRadius: 18,
                    background: 'rgba(255,255,255,.55)',
                    backdropFilter: 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    border: '1px solid rgba(255,255,255,.6)',
                    boxShadow: '0 8px 28px rgba(17,19,24,.1), inset 0 1px 0 rgba(255,255,255,.5)',
                    padding: 22,
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9999,
                      background: 'var(--primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 14,
                    }}
                  >
                    {step.n}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: 'var(--ink)' }}>{step.title}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.43, color: 'var(--ink3)' }}>{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ background: 'var(--tile1)', padding: '80px 24px' }}>
          <div style={{ maxWidth: 980, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 600, textAlign: 'center', margin: '0 0 48px', color: '#fff' }}>
              Built for tailoring, not guessing.
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
              {capabilities.map((cap) => (
                <div key={cap.title} style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 18, padding: 24, background: 'var(--tile2)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, marginBottom: 10, color: '#fff' }}>{cap.title}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.43, color: '#ccc' }}>{cap.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ background: 'var(--parchment)', padding: '80px 24px' }}>
          <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 48, alignItems: 'center' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 600, margin: '0 0 14px', color: 'var(--ink)' }}>
                See the difference.
              </h2>
              <p style={{ fontSize: 17, color: 'var(--ink2)', margin: 0 }}>
                Every suggestion is grounded in your actual resume — no invented skills, just sharper phrasing of what's already true.
              </p>
            </div>
            <div style={{ background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--hairline)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink3)', marginBottom: 8 }}>Before</div>
                <div style={{ fontSize: 16, color: 'var(--ink2)', lineHeight: 1.47 }}>"Responsible for managing team projects and tasks."</div>
              </div>
              <div style={{ padding: '20px 22px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>After</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.24 }}>"Led 6 cross-functional projects, cutting delivery time 23%."</div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ background: 'var(--tile1)', padding: '80px 24px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 600, color: '#fff', margin: '0 0 28px' }}>
            Ready to see your match score?
          </h2>
          <button
            className="lg-cta"
            onClick={() => navigate('/signup')}
            style={{ fontSize: 18, fontWeight: 300, color: '#fff', background: 'var(--primary)', border: 'none', padding: '14px 28px', borderRadius: 9999, cursor: 'pointer' }}
          >
            Get Started — It's Free
            <span className="lg-shimmer" />
          </button>
        </section>

        <footer style={{ background: 'var(--parchment)', padding: '48px 24px' }}>
          <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink2)' }}>AI Resume Assistant</div>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <a onClick={() => navigate('/')} style={{ fontSize: 15, color: 'var(--ink2)', textDecoration: 'none', cursor: 'pointer' }}>
                Home
              </a>
              <a onClick={() => navigate('/login')} style={{ fontSize: 15, color: 'var(--ink2)', textDecoration: 'none', cursor: 'pointer' }}>
                Log In
              </a>
              <a onClick={() => navigate('/signup')} style={{ fontSize: 15, color: 'var(--ink2)', textDecoration: 'none', cursor: 'pointer' }}>
                Sign Up
              </a>
            </div>
          </div>
          <div style={{ maxWidth: 980, margin: '32px auto 0', fontSize: 12, color: 'var(--ink3)' }}>© 2026 AI Resume Assistant</div>
        </footer>
      </main>
    </div>
  );
}
