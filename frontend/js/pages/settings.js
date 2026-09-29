/* Settings (FR‑1.2, NFR‑2.5, accessibility) */
RAPages.settings = function () {
  const $ = s => document.querySelector(s);
  const root = document.documentElement;
  const st = RAData.state;

  /* ---------- section switching via #hash ---------- */
  function showSection() {
    const sec = (location.hash || "#accessibility").slice(1);
    document.querySelectorAll("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== sec; });
    document.querySelectorAll(".side-nav [data-sec]").forEach(a => {
      if (a.dataset.sec === sec) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", showSection);
  showSection();

  /* ---------- load saved prefs ---------- */
  function readPrefs() { try { return JSON.parse(localStorage.getItem("ra:prefs") || "{}"); } catch (e) { return {}; } }
  let saved = Object.assign({ text: "default", contrast: "off", motion: "off", palette: "standard" }, readPrefs());

  function fill(p) {
    document.querySelector(`input[name=text][value="${p.text}"]`).checked = true;
    document.querySelector(`input[name=palette][value="${p.palette}"]`).checked = true;
    $("#t-contrast").checked = p.contrast === "high";
    $("#t-motion").checked = p.motion === "reduce";
    $("#p-name").value = st.user?.name || "";
    $("#p-email").value = st.user?.email || "";
    $("#pw-old").value = ""; $("#pw-new").value = "";
    syncSwitchText();
  }
  function current() {
    return {
      text: document.querySelector("input[name=text]:checked").value,
      palette: document.querySelector("input[name=palette]:checked").value,
      contrast: $("#t-contrast").checked ? "high" : "off",
      motion: $("#t-motion").checked ? "reduce" : "off"
    };
  }
  // live preview: apply straight to <html>
  function apply(p) {
    if (p.text === "default") delete root.dataset.text; else root.dataset.text = p.text;
    if (p.contrast === "high") root.dataset.contrast = "high"; else delete root.dataset.contrast;
    if (p.motion === "reduce") root.dataset.motion = "reduce"; else delete root.dataset.motion;
    if (p.palette === "cb") root.dataset.palette = "cb"; else delete root.dataset.palette;
  }
  function syncSwitchText() {
    document.querySelectorAll(".switch input").forEach(i => { i.parentElement.querySelector(".switch-state").textContent = i.checked ? "On" : "Off"; });
  }

  fill(saved);

  /* ---------- unsaved-changes bar ---------- */
  let dirty = false;
  const bar = $("#unsaved");
  function markDirty() { dirty = true; bar.dataset.show = "true"; }
  document.querySelectorAll("[data-track]").forEach(el => el.addEventListener(el.type === "text" || el.type === "email" || el.type === "password" ? "input" : "change", () => {
    syncSwitchText();
    apply(current());
    markDirty();
  }));

  $("#discard").addEventListener("click", () => {
    fill(saved); apply(saved);
    dirty = false; bar.dataset.show = "false";
    RA.toast("Changes discarded", { icon: "undo" });
  });
  $("#save").addEventListener("click", () => {
    saved = current();
    try { localStorage.setItem("ra:prefs", JSON.stringify(saved)); } catch (e) { /* ignore */ }
    const name = $("#p-name").value.trim(), email = $("#p-email").value.trim();
    if (name && email) RAData.save({ user: { name, email } });
    dirty = false; bar.dataset.show = "false";
    RA.toast("Settings saved");
  });
  window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- other actions ---------- */
  $("#preview-timeout").addEventListener("click", () => RA.showTimeoutWarning());
  $("#export-data").addEventListener("click", () => RA.toast("We’re preparing your data. We’ll email you a link within 24 hours.", { icon: "mail", timeout: 7000 }));
  $("#del-account").addEventListener("click", async () => {
    const ok = await RA.confirm({
      title: "Delete your account?",
      body: "This permanently removes your account, <strong>all resumes and all analyses</strong>. This can’t be undone.",
      extra: `<div class="field" style="margin-top:16px"><label class="label" for="confirm-word">Type DELETE to confirm</label><input class="input" id="confirm-word" autocomplete="off"></div>`,
      confirmLabel: "Delete account",
      onOpen(d) {
        const btn = d.querySelector("[data-v='1']"), input = d.querySelector("#confirm-word");
        btn.disabled = true;
        input.addEventListener("input", () => { btn.disabled = input.value.trim() !== "DELETE"; });
      }
    });
    if (ok) { RAData.reset(); RAData.save({ user: null }); RA.go("index.html"); }
    else $("#del-account").focus();
  });
};
