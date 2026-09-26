/* ==========================================================================
   Shared UI: icons, top bar, step bar, toasts, dialogs, session timeout.
   Every page loads this file (after data.js).
   ========================================================================== */
(function () {
  /* ---------- Icons (24px grid, 2px stroke — Lucide style) ---------- */
  const ICONS = {
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M8 12h8M8 16h5"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    grid: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    bang: '<path d="M12 4v10M12 19.5h.01"/>',
    "check-circle": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    "x-circle": '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    "arrow-right": '<path d="M5 12h14M12 5l7 7-7 7"/>',
    "arrow-left": '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    access: '<circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5 12 10l7-1.5M12 10v4.5M12 14.5 9 21M12 14.5l3 6.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    contrast: '<circle cx="12" cy="12" r="10"/><path d="M12 2v20" /><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/>',
    motion: '<path d="M2 12h4l3-9 6 18 3-9h4"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
  }

  // <i data-icon="upload" class="icon-sm"></i>  ->  inline SVG
  function hydrateIcons(root) {
    (root || document).querySelectorAll("i[data-icon]").forEach(el => {
      el.outerHTML = icon(el.dataset.icon, el.className);
    });
  }

  const LOGO = '<svg class="logo-mark" viewBox="0 0 34 34" aria-hidden="true"><rect x="6" y="2.5" width="22" height="29" rx="3" fill="#fffefb" stroke="#16171d" stroke-width="2"/><path d="M11 8.5h12M11 25.5h8" stroke="#16171d" stroke-width="2" stroke-linecap="round"/><rect x="2.5" y="13" width="29" height="8" rx="1.5" fill="#ffd23f" stroke="#16171d" stroke-width="2" transform="rotate(-7 17 17)"/></svg>';
  const LOGO_HTML = LOGO + '<span class="logo-word">Resume <span>Assistant</span></span>';

  /* ---------- Top bar ---------- */
  function renderShell() {
    const slot = document.querySelector("[data-shell]");
    if (!slot) return;
    const active = slot.dataset.active || "";
    const minimal = slot.hasAttribute("data-minimal");
    const user = RAData.state.user || { name: "Alex Rivera", email: "alex.rivera@email.com" };
    const initials = user.name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
    const cur = key => (active === key ? ' aria-current="page"' : "");

    const nav = minimal ? "" : `
      <nav class="nav" aria-label="Main">
        <a href="dashboard.html"${cur("dashboard")}>${icon("grid")}Dashboard</a>
        <a href="job.html"${cur("new")}>${icon("plus")}New analysis</a>
        <a href="dashboard.html#analyses"${cur("analyses")}>${icon("list")}My analyses</a>
      </nav>`;

    slot.outerHTML = `
      <header class="topbar">
        <div class="container topbar-inner">
          <a class="logo" href="dashboard.html" aria-label="Resume Assistant, go to dashboard">${LOGO_HTML}</a>
          ${nav}
          <div class="topbar-actions">
            <a class="btn btn-ghost btn-icon" href="#" data-tip="Help" aria-label="Help" data-action="help">${icon("help")}</a>
            <div class="avatar-menu">
              <button class="avatar-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="account-menu">
                <span class="avatar" aria-hidden="true">${initials}</span>
                <span class="who small"><span class="visually-hidden">Account menu for </span>${user.name.split(" ")[0]}</span>
                ${icon("chevron", "icon-sm")}
              </button>
              <div class="menu" id="account-menu" role="menu">
                <div class="menu-head"><strong>${user.name}</strong><div class="caption">${user.email}</div></div>
                <hr>
                <a role="menuitem" href="settings.html">${icon("settings")}Settings</a>
                <a role="menuitem" href="settings.html#accessibility">${icon("access")}Accessibility</a>
                <hr>
                <button role="menuitem" type="button" data-action="logout">${icon("logout")}Log out</button>
              </div>
            </div>
          </div>
        </div>
      </header>
      ${minimal ? "" : `
      <nav class="tabbar" aria-label="Main (mobile)">
        <a href="dashboard.html"${cur("dashboard")}>${icon("home")}Home</a>
        <a href="job.html"${cur("new")}>${icon("plus")}New</a>
        <a href="dashboard.html#analyses"${cur("analyses")}>${icon("list")}Analyses</a>
        <a href="settings.html"${cur("settings")}>${icon("settings")}Settings</a>
      </nav>`}`;

    // avatar menu behaviour
    const btn = document.querySelector(".avatar-btn");
    const menu = document.getElementById("account-menu");
    const setOpen = open => {
      btn.setAttribute("aria-expanded", String(open));
      menu.dataset.open = String(open);
      if (open) menu.querySelector("[role=menuitem]").focus();
    };
    btn.addEventListener("click", e => { e.stopPropagation(); setOpen(menu.dataset.open !== "true"); });
    document.addEventListener("click", e => { if (!menu.contains(e.target)) setOpen(false); });
    menu.addEventListener("keydown", e => {
      const items = [...menu.querySelectorAll("[role=menuitem]")];
      const i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { setOpen(false); btn.focus(); }
      if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
  }

  /* ---------- Step bar for the analysis flow ---------- */
  const STEPS = [
    ["Resume", "dashboard.html"],
    ["Job posting", "job.html"],
    ["Match results", "results.html"],
    ["Improve", "improve.html"],
    ["Export", "export.html"]
  ];
  function renderSteps() {
    document.querySelectorAll("ol.steps[data-current]").forEach(ol => {
      const current = Number(ol.dataset.current);
      ol.setAttribute("aria-label", `Step ${current} of ${STEPS.length}: ${STEPS[current - 1][0]}`);
      ol.innerHTML = STEPS.map(([label, href], i) => {
        const n = i + 1;
        if (n < current) return `<li data-state="done"><a href="${href}"><span class="num">${icon("check")}</span><span class="label-text">${label}</span><span class="visually-hidden"> (done)</span></a></li>`;
        if (n === current) return `<li data-state="current" aria-current="step"><span class="step"><span class="num">${n}</span><span class="label-text">${label}</span></span></li>`;
        return `<li data-state="todo"><span class="step"><span class="num">${n}</span><span class="label-text">${label}</span><span class="visually-hidden"> (not started)</span></span></li>`;
      }).join("");
    });
  }

  /* ---------- Toasts ---------- */
  function toast(message, opts) {
    opts = opts || {};
    let region = document.querySelector(".toasts");
    if (!region) {
      region = document.createElement("div");
      region.className = "toasts";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    region.innerHTML = ""; // one at a time keeps things calm
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `${icon(opts.icon || "check-circle")}<p>${message}</p>` +
      (opts.action ? `<button type="button" class="act">${opts.action.label}</button>` : "") +
      `<button type="button" class="x" aria-label="Dismiss notification">${icon("x", "icon-sm")}</button>`;
    region.appendChild(el);
    const close = () => el.remove();
    el.querySelector(".x").addEventListener("click", close);
    if (opts.action) el.querySelector(".act").addEventListener("click", () => { opts.action.onClick(); close(); });
    // Toasts with an action stay until dismissed, so screen-reader and keyboard users can reach them.
    if (!opts.action) setTimeout(close, opts.timeout || 5000);
    return el;
  }

  /* ---------- Confirm dialog (native <dialog>: focus trap + Esc built in) ---------- */
  function confirmDialog(o) {
    return new Promise(resolve => {
      const d = document.createElement("dialog");
      d.className = "modal";
      d.setAttribute("aria-labelledby", "dlg-title");
      d.setAttribute("aria-describedby", "dlg-desc");
      d.innerHTML = `
        <button class="btn btn-ghost btn-icon modal-close" type="button" aria-label="Close dialog" data-v="0">${icon("x")}</button>
        <div class="modal-body">
          <div class="modal-icon ${o.tone || "danger"}">${icon(o.icon || "trash", "icon-lg")}</div>
          <h2 id="dlg-title">${o.title}</h2>
          <div id="dlg-desc" class="muted">${o.body || ""}</div>
          ${o.extra || ""}
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" type="button" data-v="0" autofocus>${o.cancelLabel || "Cancel"}</button>
          <button class="btn ${o.tone === "warn" ? "btn-primary" : "btn-danger"}" type="button" data-v="1">${o.confirmLabel || "Confirm"}</button>
        </div>`;
      document.body.appendChild(d);
      const done = v => { d.close(); d.remove(); resolve(v); };
      d.addEventListener("click", e => {
        const b = e.target.closest("[data-v]");
        if (b) done(b.dataset.v === "1");
        else if (e.target === d) done(false); // click on backdrop
      });
      d.addEventListener("cancel", e => { e.preventDefault(); done(false); });
      d.showModal();
      // Safe default: focus starts on Cancel, never on the destructive button.
      d.querySelector(".modal-foot [data-v='0']").focus();
      if (o.onOpen) o.onOpen(d);
    });
  }

  /* ---------- Session timeout (FR‑1.2: 15 minutes idle, warn 1 minute before) ---------- */
  const IDLE_MS = 14 * 60 * 1000;
  let idleTimer;
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(showTimeoutWarning, IDLE_MS);
  }
  function showTimeoutWarning() {
    let left = 60;
    let tick;
    confirmDialog({
      tone: "warn",
      icon: "clock",
      title: "Still there?",
      body: `For your safety you’ll be logged out in <strong class="mono" id="countdown">1:00</strong>. Your saved work is kept.`,
      cancelLabel: "Log out",
      confirmLabel: "Stay logged in",
      onOpen(d) {
        d.querySelector("[data-v='1']").focus();
        tick = setInterval(() => {
          left -= 1;
          const el = d.querySelector("#countdown");
          if (el) el.textContent = `0:${String(left).padStart(2, "0")}`;
          if (left <= 0) { clearInterval(tick); logout(true); }
        }, 1000);
      }
    }).then(stay => {
      clearInterval(tick);
      if (stay) { toast("You’re still logged in."); resetIdle(); }
      else logout();
    });
  }
  function logout(timedOut) {
    RAData.save({ user: null });
    go("login.html#" + (timedOut ? "timeout" : "loggedout"));
  }

  /* ---------- Helpers shared by pages ---------- */
  function scoreRing(el, value, opts) {
    opts = opts || {};
    const lvl = RAData.scoreLevel(value);
    const r = 70, c = 2 * Math.PI * r;
    el.style.setProperty("--ring", `var(--${lvl.key})`);
    el.innerHTML = `
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <circle class="track" cx="84" cy="84" r="${r}" fill="none" stroke-width="16"/>
        <circle class="bar" cx="84" cy="84" r="${r}" fill="none" stroke-width="16" stroke-dasharray="${c}" stroke-dashoffset="${c}"/>
      </svg>
      <div class="ring-label"><span class="ring-num">${value}<small>%</small></span>${opts.sub === false ? "" : '<span class="ring-sub">match</span>'}</div>`;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", `Match score ${value} out of 100, ${lvl.word}`);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.querySelector(".bar").style.strokeDashoffset = c * (1 - value / 100);
    }));
    return lvl;
  }

  function levelBadge(value) {
    const l = RAData.scoreLevel(value);
    return `<span class="badge badge-${l.key}">${icon(l.icon)}${l.word}</span>`;
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ---------- Back button on every page except Welcome ---------- */
  // Where "Back" goes when there is no previous page in this tab (e.g. a shared link).
  const PARENT = {
    auth: "index.html", dashboard: "index.html", job: "dashboard.html", results: "job.html",
    improve: "results.html", export: "improve.html", done: "dashboard.html",
    settings: "dashboard.html", styleguide: "index.html"
  };
  function renderBack() {
    const page = document.body.dataset.page;
    if (!PARENT[page]) return;
    const a = document.createElement("a");
    a.className = "btn btn-secondary btn-sm back-btn";
    a.href = PARENT[page];
    a.setAttribute("aria-label", "Back");
    a.innerHTML = icon("arrow-left") + "<span>Back</span>";
    a.addEventListener("click", e => {
      if (window.RA_ROUTER) { e.preventDefault(); window.RA_ROUTER.back(PARENT[page]); return; }
      let sameSite = false;
      try { sameSite = document.referrer && new URL(document.referrer).origin === location.origin && document.referrer !== location.href; } catch (_) { /* ignore */ }
      if (sameSite && history.length > 1) { e.preventDefault(); history.back(); }
    });
    const host = document.querySelector(".topbar-inner") || document.querySelector(".auth-card");
    if (host) host.prepend(a);
  }

  // Page-to-page navigation. The shared (artifact) build swaps screens in place
  // through RA_ROUTER; the normal site just loads the next file.
  function go(url) {
    if (window.RA_ROUTER) window.RA_ROUTER.go(url);
    else location.href = url;
  }

  /* ---------- Boot ---------- */
  function boot() {
    clearTimeout(idleTimer);
    renderShell();
    renderBack();
    renderSteps();
    hydrateIcons();

    document.addEventListener("click", e => {
      const a = e.target.closest("[data-action]");
      if (!a) return;
      if (a.dataset.action === "logout") { e.preventDefault(); logout(); }
      if (a.dataset.action === "help") {
        e.preventDefault();
        toast("Tip: hover or focus any icon button to see what it does. Press Tab to move between controls.", { icon: "help", timeout: 7000 });
      }
    });

    if (document.body.dataset.auth === "required") {
      if (!RAData.state.user) RAData.save({ user: { name: "Alex Rivera", email: "alex.rivera@email.com" } }); // demo: auto sign-in
      ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));
      resetIdle();
    }

    const page = document.body.dataset.page;
    if (page && window.RAPages && window.RAPages[page]) window.RAPages[page]();
    hydrateIcons(); // catch icons that page scripts rendered
  }

  window.RA = { go, boot, icon, iconNames: Object.keys(ICONS), hydrateIcons, toast, confirm: confirmDialog, scoreRing, levelBadge, wait, showTimeoutWarning, logout, LOGO_HTML };
  window.RAPages = window.RAPages || {};

  if (window.RA_ROUTER) { /* the router calls RA.boot() after each screen swap */ }
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
