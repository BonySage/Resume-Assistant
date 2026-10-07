import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, Logo } from '../lib/icons.jsx';
import { useUI, Countdown } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

const ShellContext = createContext(null);
export const useShell = () => useContext(ShellContext);

// FR-1.2: the server logs out after 15 idle minutes; warn 1 minute before.
const IDLE_MS = 14 * 60 * 1000;
const ACTIVITY = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];

// "Back" goes to the previous page in this tab, or to a sensible parent for shared links.
export function BackButton({ fallback }) {
  const navigate = useNavigate();
  return (
    <Link
      className="btn btn-secondary btn-sm back-btn"
      to={fallback}
      aria-label="Back"
      onClick={(e) => {
        if ((window.history.state?.idx ?? 0) > 0) {
          e.preventDefault();
          navigate(-1);
        }
      }}
    >
      <Icon name="arrow-left" />
      <span>Back</span>
    </Link>
  );
}

export default function AppShell({ active, back = '/dashboard', children }) {
  const { user, displayName, logout } = useAuth();
  const { toast, confirm } = useUI();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);
  const warningOpen = useRef(false);
  const idleTimer = useRef(null);

  const doLogout = useCallback(
    async (timedOut) => {
      await logout().catch(() => {});
      navigate('/login', { state: { notice: timedOut ? 'timeout' : 'loggedout' } });
    },
    [logout, navigate]
  );

  const resetIdle = useCallback(() => {
    if (warningOpen.current) return;
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => showTimeoutWarningRef.current(), IDLE_MS);
  }, []);

  const showTimeoutWarning = useCallback(async () => {
    warningOpen.current = true;
    const result = await confirm({
      tone: 'warn',
      icon: 'clock',
      title: 'Still there?',
      body: (done) => (
        <>
          For your safety you’ll be logged out in <Countdown seconds={60} onEnd={() => done('timeout')} />. Your saved work is kept.
        </>
      ),
      cancelLabel: 'Log out',
      confirmLabel: 'Stay logged in',
      focusConfirm: true,
    });
    warningOpen.current = false;
    if (result === true) {
      await api.me().catch(() => {}); // refreshes the sliding session cookie
      toast('You’re still logged in.');
      resetIdle();
    } else {
      doLogout(result === 'timeout');
    }
  }, [confirm, toast, resetIdle, doLogout]);
  const showTimeoutWarningRef = useRef(showTimeoutWarning);
  showTimeoutWarningRef.current = showTimeoutWarning;

  useEffect(() => {
    ACTIVITY.forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      clearTimeout(idleTimer.current);
      ACTIVITY.forEach((ev) => window.removeEventListener(ev, resetIdle));
    };
  }, [resetIdle]);

  // close the account menu on outside click
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', onDoc);
    menuRef.current?.querySelector('[role=menuitem]')?.focus();
    return () => document.removeEventListener('click', onDoc);
  }, [menuOpen]);

  const onMenuKey = (e) => {
    const items = [...menuRef.current.querySelectorAll('[role=menuitem]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      setMenuOpen(false);
      btnRef.current.focus();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length].focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    }
  };

  const initials = displayName.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase() || 'ME';
  const cur = (key) => (active === key ? 'page' : undefined);

  return (
    <ShellContext.Provider value={{ showTimeoutWarning, doLogout }}>
      <a className="skip-link" href="#main">Skip to main content</a>
      <header className="topbar">
        <div className="container topbar-inner">
          <BackButton fallback={back} />
          <Link className="logo" to="/dashboard" aria-label="Forma, go to dashboard">
            <Logo />
          </Link>
          <nav className="nav" aria-label="Main">
            <Link to="/dashboard" aria-current={cur('dashboard')}><Icon name="grid" />Dashboard</Link>
            <Link to="/job" aria-current={cur('new')}><Icon name="plus" />New analysis</Link>
            <Link to="/dashboard#analyses" aria-current={cur('analyses')}><Icon name="list" />My analyses</Link>
          </nav>
          <div className="topbar-actions">
            <button
              className="btn btn-ghost btn-icon"
              type="button"
              data-tip="Help"
              aria-label="Help"
              onClick={() => toast('Tip: hover or focus any icon button to see what it does. Press Tab to move between controls.', { icon: 'help', timeout: 7000 })}
            >
              <Icon name="help" />
            </button>
            <div className="avatar-menu">
              <button
                ref={btnRef}
                className="avatar-btn"
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls="account-menu"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((o) => !o);
                }}
              >
                <span className="avatar" aria-hidden="true">{initials}</span>
                <span className="who small"><span className="visually-hidden">Account menu for </span>{displayName.split(' ')[0]}</span>
                <Icon name="chevron" className="icon-sm" />
              </button>
              <div className="menu" id="account-menu" role="menu" ref={menuRef} data-open={menuOpen} onKeyDown={onMenuKey}>
                <div className="menu-head">
                  <strong>{displayName}</strong>
                  <div className="caption">{user?.email}</div>
                </div>
                <hr />
                <Link role="menuitem" to="/settings#profile" onClick={() => setMenuOpen(false)}><Icon name="settings" />Settings</Link>
                <Link role="menuitem" to="/settings#accessibility" onClick={() => setMenuOpen(false)}><Icon name="access" />Accessibility</Link>
                <hr />
                <button role="menuitem" type="button" onClick={() => doLogout(false)}><Icon name="logout" />Log out</button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <nav className="tabbar" aria-label="Main (mobile)">
        <Link to="/dashboard" aria-current={cur('dashboard')}><Icon name="home" />Home</Link>
        <Link to="/job" aria-current={cur('new')}><Icon name="plus" />New</Link>
        <Link to="/dashboard#analyses" aria-current={cur('analyses')}><Icon name="list" />Analyses</Link>
        <Link to="/settings" aria-current={cur('settings')}><Icon name="settings" />Settings</Link>
      </nav>
      {children}
    </ShellContext.Provider>
  );
}
