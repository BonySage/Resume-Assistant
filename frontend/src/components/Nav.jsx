import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}

export function PublicNav() {
  const scrolled = useScrolled();
  const navigate = useNavigate();
  const textColor = scrolled ? '#ffffff' : 'var(--ink)';
  const textColorMuted = scrolled ? 'rgba(255,255,255,.8)' : 'var(--ink3)';

  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, height: 44 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.78)',
          backdropFilter: 'blur(6px) saturate(180%)',
          WebkitBackdropFilter: 'blur(6px) saturate(180%)',
          filter: 'url(#glass-distortion)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), inset 0 -1px 0 rgba(255,255,255,.06)',
          opacity: scrolled ? 1 : 0,
          transition: 'opacity .25s ease',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          height: 44,
          padding: '0 22px',
        }}
      >
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.12, color: textColor, transition: 'color .25s ease' }}>
            AI Resume Assistant
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a
            onClick={() => navigate('/')}
            style={{ fontSize: 12, letterSpacing: -0.12, color: textColorMuted, textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color .25s ease' }}
          >
            Home
          </a>
          <a
            onClick={() => navigate('/login')}
            style={{ fontSize: 12, letterSpacing: -0.12, color: textColorMuted, textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color .25s ease' }}
          >
            Log In
          </a>
          <button
            className="lg-cta"
            onClick={() => navigate('/signup')}
            style={{ fontSize: 12, letterSpacing: -0.12, color: '#fff', background: 'var(--primary)', border: 'none', padding: '7px 16px', borderRadius: 9999, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Get Started
            <span className="lg-shimmer" />
          </button>
        </div>
      </div>
    </nav>
  );
}

export function AppNav() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const initials = (user?.email || '??').slice(0, 2).toUpperCase();

  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, height: 44 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.78)',
          backdropFilter: 'blur(6px) saturate(180%)',
          WebkitBackdropFilter: 'blur(6px) saturate(180%)',
          filter: 'url(#glass-distortion)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), inset 0 -1px 0 rgba(255,255,255,.06)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          height: 44,
          padding: '0 22px',
        }}
      >
        <div
          onClick={() => navigate('/dashboard')}
          style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.12, cursor: 'pointer', color: '#fff' }}
        >
          AI Resume Assistant
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 9999,
              background: 'var(--chip)',
              color: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {initials}
          </div>
          <a
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Log Out
          </a>
        </div>
      </div>
    </nav>
  );
}
