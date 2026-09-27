import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Logo } from '../lib/icons.jsx';
import { useUI } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { BackButton } from '../components/AppShell.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RULES = {
  len: (v) => v.length >= 8,
  case: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  num: (v) => /\d/.test(v),
  sym: (v) => /[^A-Za-z0-9]/.test(v),
};
const RULE_TEXT = {
  len: 'At least 8 characters',
  case: 'Upper and lower case letters',
  num: 'At least one number',
  sym: 'A symbol makes it stronger (optional)',
};
const WORDS = ['Not set', 'Weak', 'Fair', 'Good', 'Strong'];

const SOCIAL_LOGOS = {
  Google: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  ),
  Apple: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  ),
  GitHub: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
};

function Social({ verb }) {
  const { toast } = useUI();
  const soon = (name) => toast(`Sign-in with ${name} isn’t available yet. Use your email for now.`, { icon: 'info' });
  return (
    <div className="social" style={{ marginTop: 24 }}>
      <button className="btn btn-secondary btn-social" type="button" onClick={() => soon('Google')}>{SOCIAL_LOGOS.Google}{verb} with Google</button>
      <div className="social-row">
        <button className="btn btn-secondary btn-social" type="button" onClick={() => soon('Apple')}>{SOCIAL_LOGOS.Apple}Apple</button>
        <button className="btn btn-secondary btn-social" type="button" onClick={() => soon('GitHub')}>{SOCIAL_LOGOS.GitHub}GitHub</button>
      </div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, describedBy, onKeyUp, onBlur }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input className="input" id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} required aria-required="true"
        aria-describedby={describedBy} value={value} onChange={onChange} onKeyUp={onKeyUp} onBlur={onBlur} />
      <button className="input-action" type="button" aria-pressed={show} onClick={() => setShow((s) => !s)}>
        <Icon name={show ? 'eye-off' : 'eye'} />
        <span>{show ? 'Hide' : 'Show'}</span>
      </button>
    </div>
  );
}

function LoginPanel({ notice, goSignup }) {
  const { login } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [error, setError] = useState('');
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const pwRef = useRef(null);

  const checkEmail = () => {
    const ok = EMAIL_RE.test(email.trim());
    setEmailErr(!ok && email !== '' ? 'Enter an email like name@example.com' : '');
    return ok;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!checkEmail()) {
      document.getElementById('login-email').focus();
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), pw);
      navigate(location.state?.from && location.state.from !== '/login' ? location.state.from : '/dashboard');
    } catch (err) {
      setError(err.message || 'That email and password don’t match.');
      setPw('');
      pwRef.current?.querySelector('input')?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="panel-login" role="tabpanel" aria-labelledby="tab-login">
      <h1>Welcome <em>back</em></h1>
      <p className="muted" style={{ marginTop: 8 }}>Log in to see your resumes and matches.</p>

      {notice === 'timeout' && (
        <div className="alert alert-info" role="status" style={{ marginTop: 20 }}>
          <Icon name="clock" />
          <div className="alert-body"><strong>You were logged out after 15 minutes of no activity</strong>Log in again to pick up where you left off. Your saved work is safe.</div>
        </div>
      )}
      {notice === 'loggedout' && (
        <div className="alert alert-success" role="status" style={{ marginTop: 20 }}>
          <Icon name="check-circle" />
          <div className="alert-body"><strong>You’ve logged out</strong>See you next time.</div>
        </div>
      )}
      {notice === 'deleted' && (
        <div className="alert alert-success" role="status" style={{ marginTop: 20 }}>
          <Icon name="check-circle" />
          <div className="alert-body"><strong>Your account was deleted</strong>All resumes and analyses were removed.</div>
        </div>
      )}

      <Social verb="Continue" />
      <div className="divider">or log in with email</div>

      <form noValidate style={{ marginTop: 0 }} onSubmit={submit}>
        {error && (
          <div className="alert alert-error" role="alert">
            <Icon name="x-circle" />
            <div className="alert-body"><strong>{error}</strong>Check for typos and try again.</div>
          </div>
        )}

        <div className="field" style={{ marginTop: 18 }}>
          <label className="label" htmlFor="login-email">Email</label>
          <input className="input" id="login-email" type="email" autoComplete="email" placeholder="you@example.com" required
            aria-describedby="login-email-msg" aria-invalid={emailErr ? 'true' : 'false'} value={email}
            onChange={(e) => setEmail(e.target.value)} onBlur={checkEmail} />
          <span className="msg msg-error" id="login-email-msg" aria-live="polite">{emailErr && <><Icon name="x-circle" />{emailErr}</>}</span>
        </div>

        <div className="field" ref={pwRef}>
          <label className="label" htmlFor="login-pw">
            Password
            <a href="#" onClick={(e) => { e.preventDefault(); toast('Password reset isn’t available yet. Ask your admin to reset it for now.', { icon: 'mail' }); }}>Forgot password?</a>
          </label>
          <PasswordInput id="login-pw" autoComplete="current-password" describedBy="caps-login" value={pw}
            onChange={(e) => setPw(e.target.value)} onKeyUp={(e) => e.getModifierState && setCaps(e.getModifierState('CapsLock'))} />
          <span className="msg msg-warn" id="caps-login" hidden={!caps}><Icon name="alert" />Caps Lock is on</span>
        </div>

        <button className="btn btn-primary btn-lg btn-block" type="submit" style={{ marginTop: 24 }} aria-busy={busy}>
          {busy ? <><Icon name="refresh" />Logging in…</> : <>Log in <Icon name="arrow-right" /></>}
        </button>
      </form>

      <div className="divider">or</div>
      <p style={{ textAlign: 'center' }}>New here? <button className="link-btn" type="button" onClick={goSignup}>Create an account</button></p>
    </section>
  );
}

function SignupPanel() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '', terms: false });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const passed = Object.values(RULES).filter((fn) => fn(f.pw)).length;
  const level = f.pw ? Math.max(1, passed) : 0;
  const emailOk = EMAIL_RE.test(f.email.trim());
  const pwOk = RULES.len(f.pw) && RULES.case(f.pw) && RULES.num(f.pw);
  const matchOk = f.pw2 !== '' && f.pw2 === f.pw;
  const allOk = emailOk && pwOk && matchOk && f.terms;
  const showMatch = touched.pw2 || f.pw2;

  const submit = async (e) => {
    e.preventDefault();
    if (!allOk) return;
    setError('');
    setBusy(true);
    try {
      await signup(f.email.trim(), f.pw, f.name.trim());
      navigate('/dashboard', { state: { welcome: true } });
    } catch (err) {
      setError(err.message || 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="panel-signup" role="tabpanel" aria-labelledby="tab-signup">
      <h1>Create your <em>account</em></h1>
      <p className="muted" style={{ marginTop: 8 }}>
        Fields marked <span aria-hidden="true" style={{ color: 'var(--bad)' }}>*</span><span className="visually-hidden">with an asterisk</span> are required.
      </p>

      <Social verb="Sign up" />
      <div className="divider">or sign up with email</div>

      <form noValidate style={{ marginTop: 0 }} onSubmit={submit}>
        {error && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: 18 }}>
            <Icon name="x-circle" />
            <div className="alert-body"><strong>{error}</strong></div>
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="su-name">Full name</label>
          <input className="input" id="su-name" autoComplete="name" placeholder="Alex Rivera" value={f.name} onChange={set('name')} />
        </div>

        <div className="field">
          <label className="label" htmlFor="su-email"><span>Email <span className="req" aria-hidden="true">*</span></span></label>
          <input className="input" id="su-email" type="email" autoComplete="email" required aria-required="true" placeholder="you@example.com"
            aria-describedby="su-email-msg" aria-invalid={touched.email ? String(!emailOk) : 'false'} value={f.email}
            onChange={set('email')} onBlur={() => setTouched((t) => ({ ...t, email: true }))} />
          <span className={`msg ${touched.email ? (emailOk ? 'msg-ok' : 'msg-error') : ''}`} id="su-email-msg" aria-live="polite">
            {touched.email && (emailOk
              ? <><Icon name="check-circle" />Looks good</>
              : <><Icon name="x-circle" />{f.email.includes('@') ? 'Add a domain, like .com' : 'Enter an email like name@example.com'}</>)}
          </span>
        </div>

        <div className="field">
          <label className="label" htmlFor="su-pw"><span>Password <span className="req" aria-hidden="true">*</span></span></label>
          <PasswordInput id="su-pw" autoComplete="new-password" describedBy="su-strength-word su-rules" value={f.pw} onChange={set('pw')} />
          <div className="strength" data-level={level} aria-hidden="true"><i /><i /><i /><i /></div>
          <span className="small" id="su-strength-word" aria-live="polite">
            <strong>Strength:</strong> <span>{WORDS[level]}{level ? ` (${level} of 4)` : ''}</span>
          </span>
          <ul className="rules" id="su-rules">
            {Object.keys(RULES).map((k) => {
              const ok = RULES[k](f.pw);
              return (
                <li key={k} data-rule={k} data-ok={String(ok)}>
                  <Icon name={ok ? 'check' : k === 'sym' ? 'plus' : 'x'} className="icon-sm" />
                  {RULE_TEXT[k]}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="field">
          <label className="label" htmlFor="su-pw2"><span>Confirm password <span className="req" aria-hidden="true">*</span></span></label>
          <input className="input" id="su-pw2" type="password" autoComplete="new-password" required aria-required="true" aria-describedby="su-pw2-msg"
            aria-invalid={showMatch ? String(!matchOk) : 'false'} value={f.pw2} onChange={set('pw2')} onBlur={() => setTouched((t) => ({ ...t, pw2: true }))} />
          <span className={`msg ${showMatch ? (matchOk ? 'msg-ok' : 'msg-error') : ''}`} id="su-pw2-msg" aria-live="polite">
            {showMatch && (matchOk ? <><Icon name="check-circle" />Passwords match</> : <><Icon name="x-circle" />Passwords don’t match yet</>)}
          </span>
        </div>

        <label className="check" style={{ marginTop: 18 }}>
          <input type="checkbox" id="su-terms" required checked={f.terms} onChange={set('terms')} />
          <span>I agree to the <a href="#" onClick={(e) => e.preventDefault()}>Terms</a> and <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a></span>
        </label>

        <button className="btn btn-primary btn-lg btn-block" type="submit" style={{ marginTop: 24 }} disabled={!allOk || busy} aria-busy={busy} aria-describedby="su-why">
          {busy ? <><Icon name="refresh" />Creating your account…</> : 'Create account'}
        </button>
        <p className="caption" id="su-why" style={{ marginTop: 10, textAlign: 'center' }}>
          {allOk ? 'Ready when you are.' : 'Complete the required fields to continue.'}
        </p>
      </form>
    </section>
  );
}

export default function Auth({ mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, clearSessionMessage } = useAuth();
  const which = mode === 'signup' ? 'signup' : 'login';
  const notice = location.state?.notice;

  useEffect(() => {
    document.title = `${which === 'login' ? 'Log in' : 'Sign up'} · Forma`;
  }, [which]);
  useEffect(() => {
    if (notice) clearSessionMessage();
  }, [notice, clearSessionMessage]);
  // Already signed in when the page opened: skip straight to the dashboard.
  // (Deliberately keyed on `loading` only, so a fresh login can pick its own destination.)
  const userRef = useRef(user);
  userRef.current = user;
  useEffect(() => {
    if (!loading && userRef.current) navigate('/dashboard', { replace: true });
  }, [loading, navigate]);

  const show = (w, focus) => {
    navigate(w === 'signup' ? '/signup' : '/login', { replace: true });
    if (focus) setTimeout(() => document.getElementById(`tab-${w}`)?.focus(), 0);
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <div className="auth">
        <aside className="auth-side">
          <div className="blobs" aria-hidden="true"><i /><i /><i /><i /></div>
          <Link className="logo" to="/" aria-label="Forma home"><Logo /></Link>
          <blockquote>
            One resume.<br />Every job.<br /><span className="hl">Tailored in minutes.</span>
          </blockquote>
          <div className="auth-float" aria-hidden="true">
            <div className="glass-card gc-1"><span className="eyebrow">Match score</span><div className="big">81<small>%</small></div><span className="badge badge-good" style={{ background: '#e0f2e6' }}>✓ Strong</span></div>
            <div className="glass-card gc-2"><span className="eyebrow">AI suggestion</span><p>“Designed Tableau dashboards reporting weekly <mark>KPIs</mark> to 3 managers.”</p></div>
            <div className="glass-card gc-3"><span className="eyebrow">Keywords</span><div className="chips"><span className="chip chip-match">✓ SQL</span><span className="chip chip-match">✓ Python</span><span className="chip chip-miss" style={{ background: '#fff' }}>✕ Power BI</span></div></div>
          </div>
          <p className="caption">Used by students and early‑career job seekers.</p>
        </aside>

        <main className="auth-main" id="main">
          <div className="auth-card">
            <BackButton fallback="/" />
            <div
              className="segmented"
              role="tablist"
              aria-label="Choose log in or sign up"
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') show(which === 'login' ? 'signup' : 'login', true);
              }}
            >
              <button role="tab" id="tab-login" aria-controls="panel-login" aria-selected={which === 'login'} tabIndex={which === 'login' ? 0 : -1} type="button" onClick={() => show('login')}>
                <Icon name="user" />Log in
              </button>
              <button role="tab" id="tab-signup" aria-controls="panel-signup" aria-selected={which === 'signup'} tabIndex={which === 'signup' ? 0 : -1} type="button" onClick={() => show('signup')}>
                <Icon name="plus" />Sign up
              </button>
            </div>
            {which === 'login' ? <LoginPanel notice={notice} goSignup={() => show('signup', true)} /> : <SignupPanel />}
          </div>
        </main>
      </div>
    </>
  );
}
