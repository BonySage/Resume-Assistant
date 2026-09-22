import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicNav } from '../components/Nav.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!emailValid || !password) return;
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
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
            Welcome back
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink2)', textAlign: 'center', margin: '0 0 32px' }}>Log in to continue tailoring your resume.</p>

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
            style={inputStyle}
          />
          {touched && !password ? <FieldError>Password is required.</FieldError> : <Spacer />}

          <div style={{ textAlign: 'right', margin: '4px 0 22px' }}>
            <a title="Password reset isn't implemented in this MVP." style={{ fontSize: 14, color: 'var(--primary)', textDecoration: 'none', cursor: 'pointer' }}>
              Forgot password?
            </a>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%', padding: 12, marginBottom: 20 }}>
            {submitting ? 'Logging in…' : 'Log In'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink2)', margin: '0 0 20px' }}>
            Don't have an account?{' '}
            <a onClick={() => navigate('/signup')} style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
              Sign up
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
