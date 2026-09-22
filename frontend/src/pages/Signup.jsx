import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicNav } from '../components/Nav.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Mirrors the backend's FR-1.1 rule: 8+ chars, upper+lower case, a number.
function passwordChecks(password) {
  return {
    length: password.length >= 8,
    case: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
}

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const checks = passwordChecks(password);
  const passwordValid = checks.length && checks.case && checks.number;
  const strengthScore = [checks.length, checks.case, checks.number].filter(Boolean).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!emailValid || !passwordValid) return;
    setError('');
    setSubmitting(true);
    try {
      await signup(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-fade">
      <PublicNav />
      <main style={{ minHeight: 'calc(100vh - 44px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 380 }} noValidate>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, lineHeight: 1.1, margin: '0 0 8px', textAlign: 'center', color: 'var(--ink)' }}>
            Create your account
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink2)', textAlign: 'center', margin: '0 0 32px' }}>Takes less than a minute.</p>

          {error ? (
            <div style={{ background: 'rgba(224,82,82,.08)', color: 'var(--error)', fontSize: 14, padding: '10px 14px', borderRadius: 12, marginBottom: 16 }}>
              {error}
            </div>
          ) : null}

          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, letterSpacing: -0.224, marginBottom: 6, color: 'var(--ink)' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="you@example.com"
            style={inputStyle}
          />
          {touched && !emailValid ? <FieldError>Enter a valid email address.</FieldError> : <Spacer />}

          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, letterSpacing: -0.224, marginBottom: 6, color: 'var(--ink)' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="••••••••"
            style={{ ...inputStyle, marginBottom: 10 }}
          />

          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 4,
                  flex: 1,
                  borderRadius: 2,
                  background: strengthScore > i ? strengthColor(strengthScore) : 'var(--hairline)',
                  transition: 'background .2s ease',
                }}
              />
            ))}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', fontSize: 12, color: 'var(--ink3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <ChecklistItem ok={checks.length}>At least 8 characters</ChecklistItem>
            <ChecklistItem ok={checks.case}>Upper and lowercase letters</ChecklistItem>
            <ChecklistItem ok={checks.number}>At least one number</ChecklistItem>
          </ul>

          <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%', padding: 12, marginBottom: 20 }}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink2)', margin: '0 0 20px' }}>
            Already have an account?{' '}
            <a onClick={() => navigate('/login')} style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
              Log in
            </a>
          </p>
          <p style={{ textAlign: 'center' }}>
            <a onClick={() => navigate('/')} style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none', cursor: 'pointer' }}>
              ← Back to home
            </a>
          </p>
        </form>
      </main>
    </div>
  );
}

function strengthColor(score) {
  if (score >= 3) return 'var(--success)';
  if (score === 2) return 'var(--warning)';
  return 'var(--error)';
}

function ChecklistItem({ ok, children }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 6, color: ok ? 'var(--success)' : 'var(--ink3)' }}>
      <span>{ok ? '✓' : '·'}</span>
      {children}
    </li>
  );
}

function FieldError({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--error)', margin: '-10px 0 12px' }}>{children}</div>;
}
function Spacer() {
  return <div style={{ margin: '-10px 0 12px' }} />;
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  height: 44,
  padding: '0 18px',
  fontSize: 17,
  border: '1px solid rgba(0,0,0,.08)',
  borderRadius: 9999,
  marginBottom: 6,
  outline: 'none',
};
