import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './icons.jsx';
import { scoreLevel } from './format.js';

/* ---------- Toasts + confirm dialog ---------- */
const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toastState, setToastState] = useState(null);
  const [dialog, setDialog] = useState(null);

  const toast = useCallback((message, opts = {}) => {
    setToastState({ id: Date.now() + Math.random(), message, ...opts });
  }, []);

  // Toasts with an action stay until dismissed, so keyboard and screen-reader users can reach them.
  useEffect(() => {
    if (!toastState || toastState.action) return undefined;
    const id = toastState.id;
    const t = setTimeout(() => setToastState((cur) => (cur?.id === id ? null : cur)), toastState.timeout || 5000);
    return () => clearTimeout(t);
  }, [toastState]);

  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);

  const closeDialog = (value) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toastState && (
          <div className="toast" key={toastState.id}>
            <Icon name={toastState.icon || 'check-circle'} />
            <p>{toastState.message}</p>
            {toastState.action && (
              <button
                type="button"
                className="act"
                onClick={() => {
                  toastState.action.onClick();
                  setToastState(null);
                }}
              >
                {toastState.action.label}
              </button>
            )}
            <button type="button" className="x" aria-label="Dismiss notification" onClick={() => setToastState(null)}>
              <Icon name="x" className="icon-sm" />
            </button>
          </div>
        )}
      </div>
      {dialog && <ConfirmDialog {...dialog} onDone={closeDialog} />}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}

/* Native <dialog>: focus trap + Esc built in. Focus starts on Cancel, never on the destructive button. */
function ConfirmDialog({ title, body, tone = 'danger', icon = 'trash', cancelLabel = 'Cancel', confirmLabel = 'Confirm', requireText, focusConfirm, onDone }) {
  const ref = useRef(null);
  const [typed, setTyped] = useState('');
  useEffect(() => {
    const d = ref.current;
    if (!d.open) d.showModal();
    const target = focusConfirm ? d.querySelector("[data-v='1']") : d.querySelector(".modal-foot [data-v='0']");
    target?.focus();
    return () => {
      if (d.open) d.close();
    };
  }, [focusConfirm]);
  const disabled = requireText ? typed.trim() !== requireText : false;
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dlg-title"
      aria-describedby="dlg-desc"
      onCancel={(e) => {
        e.preventDefault();
        onDone(false);
      }}
      onClick={(e) => {
        if (e.target === ref.current) onDone(false); // click on backdrop
      }}
    >
      <button className="btn btn-ghost btn-icon modal-close" type="button" aria-label="Close dialog" onClick={() => onDone(false)}>
        <Icon name="x" />
      </button>
      <div className="modal-body">
        <div className={`modal-icon ${tone}`}>
          <Icon name={icon} className="icon-lg" />
        </div>
        <h2 id="dlg-title">{title}</h2>
        <div id="dlg-desc" className="muted">{typeof body === 'function' ? body(onDone) : body}</div>
        {requireText && (
          <div className="field" style={{ marginTop: 16 }}>
            <label className="label" htmlFor="confirm-word">Type {requireText} to confirm</label>
            <input className="input" id="confirm-word" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn btn-secondary" type="button" data-v="0" onClick={() => onDone(false)}>
          {cancelLabel}
        </button>
        <button className={`btn ${tone === 'warn' ? 'btn-primary' : 'btn-danger'}`} type="button" data-v="1" disabled={disabled} onClick={() => onDone(true)}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export function Countdown({ seconds, onEnd }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) {
      onEnd?.();
      return undefined;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onEnd]);
  return <strong className="mono">{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</strong>;
}

/* ---------- Score ring, badges ---------- */
export function ScoreRing({ value, sub = true, className = '', style }) {
  const lvl = scoreLevel(value);
  const r = 70;
  const c = 2 * Math.PI * r;
  const [offset, setOffset] = useState(c);
  useEffect(() => {
    let inner;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setOffset(c * (1 - value / 100)));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [value, c]);
  return (
    <div className={`ring ${className}`} style={{ '--ring': `var(--${lvl.key})`, ...style }} role="img" aria-label={`Match score ${value} out of 100, ${lvl.word}`}>
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <circle className="track" cx="84" cy="84" r={r} fill="none" strokeWidth="16" />
        <circle className="bar" cx="84" cy="84" r={r} fill="none" strokeWidth="16" strokeDasharray={c} style={{ strokeDashoffset: offset }} />
      </svg>
      <div className="ring-label">
        <span className="ring-num">
          {value}
          <small>%</small>
        </span>
        {sub && <span className="ring-sub">match</span>}
      </div>
    </div>
  );
}

export function LevelBadge({ value, suffix = '' }) {
  const l = scoreLevel(value);
  return (
    <span className={`badge badge-${l.key}`}>
      <Icon name={l.icon} />
      {l.word}
      {suffix}
    </span>
  );
}

/* ---------- Step bar for the analysis flow ---------- */
export function Steps({ current, analysisId }) {
  const base = analysisId ? `/results/${analysisId}` : null;
  const steps = [
    ['Resume', '/dashboard'],
    ['Job posting', '/job'],
    ['Match results', base],
    ['Improve', base && `${base}/improve`],
    ['Export', base && `${base}/export`],
  ];
  return (
    <ol className="steps" aria-label={`Step ${current} of ${steps.length}: ${steps[current - 1][0]}`}>
      {steps.map(([label, href], i) => {
        const n = i + 1;
        if (n < current && href) {
          return (
            <li key={label} data-state="done">
              <Link to={href}>
                <span className="num"><Icon name="check" /></span>
                <span className="label-text">{label}</span>
                <span className="visually-hidden"> (done)</span>
              </Link>
            </li>
          );
        }
        if (n === current) {
          return (
            <li key={label} data-state="current" aria-current="step">
              <span className="step"><span className="num">{n}</span><span className="label-text">{label}</span></span>
            </li>
          );
        }
        return (
          <li key={label} data-state="todo">
            <span className="step">
              <span className="num">{n}</span>
              <span className="label-text">{label}</span>
              <span className="visually-hidden"> (not started)</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Alert({ tone = 'info', icon, title, children, role }) {
  const icons = { info: 'info', success: 'check-circle', warn: 'alert', error: 'x-circle', tip: 'zap' };
  return (
    <div className={`alert alert-${tone}`} role={role}>
      <Icon name={icon || icons[tone]} />
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function PageLoading({ label = 'Loading…' }) {
  return (
    <div className="card row" style={{ gap: 14 }} role="status">
      <span className="spinner" />
      <strong>{label}</strong>
    </div>
  );
}
