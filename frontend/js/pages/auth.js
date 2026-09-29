/* Log in & Sign up (FR‑1.1, FR‑1.2) */
RAPages.auth = function () {
  const $ = s => document.querySelector(s);
  $("#logo").innerHTML = RA.LOGO_HTML;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---------- tabs ---------- */
  const tabs = { login: $("#tab-login"), signup: $("#tab-signup") };
  const panels = { login: $("#panel-login"), signup: $("#panel-signup") };
  function show(which, focus) {
    Object.keys(tabs).forEach(k => {
      const on = k === which;
      tabs[k].setAttribute("aria-selected", on);
      tabs[k].tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
    });
    document.title = (which === "login" ? "Log in" : "Sign up") + " · Resume Assistant";
    try { history.replaceState(null, "", which === "signup" ? "#signup" : "#login"); } catch (_) { /* sandboxed viewer */ }
    if (focus) tabs[which].focus();
  }
  tabs.login.addEventListener("click", () => show("login"));
  tabs.signup.addEventListener("click", () => show("signup"));
  document.querySelector("[role=tablist]").addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") show(tabs.login.getAttribute("aria-selected") === "true" ? "signup" : "login", true);
  });
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => show(b.dataset.go, true)));

  const hash = location.hash.slice(1);
  if (hash === "signup") show("signup");
  const notice = $("#login-notice");
  if (hash === "timeout") {
    notice.hidden = false;
    notice.innerHTML = `<div class="alert alert-info" role="status">${RA.icon("clock")}<div class="alert-body"><strong>You were logged out after 15 minutes of no activity</strong>Log in again to pick up where you left off. Your saved work is safe.</div></div>`;
  } else if (hash === "loggedout") {
    notice.hidden = false;
    notice.innerHTML = `<div class="alert alert-success" role="status">${RA.icon("check-circle")}<div class="alert-body"><strong>You’ve logged out</strong>See you next time.</div></div>`;
  }

  /* ---------- social sign-in (Google, Apple, GitHub) ---------- */
  const LOGOS = {
    Google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
    Apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>',
    GitHub: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>'
  };
  document.querySelectorAll("[data-social]").forEach(box => {
    const verb = box.dataset.social === "signup" ? "Sign up" : "Continue";
    box.innerHTML = `
      <button class="btn btn-secondary btn-social" type="button" data-provider="Google">${LOGOS.Google}${verb} with Google</button>
      <div class="social-row">
        <button class="btn btn-secondary btn-social" type="button" data-provider="Apple">${LOGOS.Apple}Apple</button>
        <button class="btn btn-secondary btn-social" type="button" data-provider="GitHub">${LOGOS.GitHub}GitHub</button>
      </div>`;
  });
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-provider]");
    if (!b) return;
    const name = b.dataset.provider;
    b.setAttribute("aria-busy", "true");
    b.innerHTML = RA.icon("refresh") + `Connecting to ${name}…`;
    await RA.wait(900);
    RAData.save({ user: { name: RAData.state.user?.name || "Alex Rivera", email: RAData.state.user?.email || "alex.rivera@email.com" } });
    RA.go("dashboard.html");
  });

  /* ---------- show / hide password ---------- */
  document.querySelectorAll("[data-toggle-pw]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.togglePw);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute("aria-pressed", String(!showing));
      btn.innerHTML = RA.icon(showing ? "eye" : "eye-off") + `<span>${showing ? "Show" : "Hide"}</span>`;
    });
  });

  /* ---------- caps lock warning ---------- */
  $("#login-pw").addEventListener("keyup", e => {
    if (e.getModifierState) $("#caps-login").hidden = !e.getModifierState("CapsLock");
  });

  /* ---------- LOG IN ---------- */
  const email = $("#login-email"), pw = $("#login-pw"), emailMsg = $("#login-email-msg");
  function checkLoginEmail() {
    const ok = EMAIL_RE.test(email.value.trim());
    email.setAttribute("aria-invalid", String(!ok && email.value !== ""));
    emailMsg.innerHTML = !ok && email.value !== "" ? RA.icon("x-circle") + "Enter an email like name@example.com" : "";
    return ok;
  }
  email.addEventListener("blur", checkLoginEmail); // validate on leave, not every keystroke

  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#login-error");
    err.hidden = true;
    if (!checkLoginEmail()) { email.focus(); return; }
    const btn = e.submitter || $("#login-form button[type=submit]");
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML = RA.icon("refresh") + "Logging in…";
    await RA.wait(700);
    btn.removeAttribute("aria-busy");
    btn.innerHTML = "Log in " + RA.icon("arrow-right");
    if (email.value.trim().toLowerCase().startsWith("wrong") || pw.value.length < 8) {
      err.hidden = false; // one message, doesn't reveal which field was wrong
      pw.value = "";
      pw.focus();
      return;
    }
    const name = RAData.state.user?.name || "Alex Rivera";
    RAData.save({ user: { name, email: email.value.trim() } });
    RA.go("dashboard.html");
  });

  $("#forgot").addEventListener("click", e => {
    e.preventDefault();
    RA.toast("If an account exists for that email, we’ve sent a reset link.", { icon: "mail" });
  });

  /* ---------- SIGN UP ---------- */
  const f = { name: $("#su-name"), email: $("#su-email"), pw: $("#su-pw"), pw2: $("#su-pw2"), terms: $("#su-terms") };
  const touched = {};
  const rules = {
    len: v => v.length >= 8,
    case: v => /[a-z]/.test(v) && /[A-Z]/.test(v),
    num: v => /\d/.test(v),
    sym: v => /[^A-Za-z0-9]/.test(v)
  };
  const WORDS = ["Not set", "Weak", "Fair", "Good", "Strong"];

  function validate() {
    const v = f.pw.value;
    let passed = 0;
    Object.entries(rules).forEach(([k, fn]) => {
      const ok = fn(v);
      if (ok) passed++;
      const li = document.querySelector(`[data-rule="${k}"]`);
      li.dataset.ok = String(ok);
      li.querySelector("svg").outerHTML = RA.icon(ok ? "check" : k === "sym" ? "plus" : "x", "icon-sm");
    });
    const level = v ? Math.max(1, passed) : 0;
    $("#su-strength").dataset.level = level;
    $("#su-strength-word").innerHTML = `<strong>Strength:</strong> <span>${WORDS[level]}${level ? ` (${level} of 4)` : ""}</span>`;

    const emailOk = EMAIL_RE.test(f.email.value.trim());
    const pwOk = rules.len(v) && rules.case(v) && rules.num(v);
    const matchOk = f.pw2.value !== "" && f.pw2.value === v;

    const em = $("#su-email-msg");
    if (touched.email) {
      f.email.setAttribute("aria-invalid", String(!emailOk));
      em.className = "msg " + (emailOk ? "msg-ok" : "msg-error");
      em.innerHTML = emailOk ? RA.icon("check-circle") + "Looks good" : RA.icon("x-circle") + (f.email.value.includes("@") ? "Add a domain, like .com" : "Enter an email like name@example.com");
    }
    const pm = $("#su-pw2-msg");
    if (touched.pw2 || f.pw2.value) {
      f.pw2.setAttribute("aria-invalid", String(!matchOk));
      pm.className = "msg " + (matchOk ? "msg-ok" : "msg-error");
      pm.innerHTML = matchOk ? RA.icon("check-circle") + "Passwords match" : RA.icon("x-circle") + "Passwords don’t match yet";
    }

    const allOk = emailOk && pwOk && matchOk && f.terms.checked;
    $("#su-submit").disabled = !allOk;
    $("#su-why").textContent = allOk ? "Ready when you are." : "Complete the required fields to continue.";
    return allOk;
  }
  f.email.addEventListener("blur", () => { touched.email = true; validate(); });
  f.pw2.addEventListener("blur", () => { touched.pw2 = true; validate(); });
  [f.pw, f.pw2, f.terms].forEach(el => el.addEventListener("input", validate));
  f.email.addEventListener("input", () => touched.email && validate());

  $("#signup-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!validate()) return;
    const btn = $("#su-submit");
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML = RA.icon("refresh") + "Creating your account…";
    await RA.wait(900);
    RAData.save({ user: { name: f.name.value.trim() || "Alex Rivera", email: f.email.value.trim() } });
    RA.go("dashboard.html#welcome");
  });
};
