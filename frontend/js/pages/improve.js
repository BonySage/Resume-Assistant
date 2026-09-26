/* Improve bullets with AI (FR‑5.2, FR‑5.3, NFR‑1.4, NFR‑4.3) */
RAPages.improve = function () {
  const $ = s => document.querySelector(s);
  const { icon } = RA;
  const A = RAData.ANALYSIS;
  const id = location.hash.slice(1) || "b1";
  const idx = Math.max(0, A.bullets.findIndex(b => b.id === id));
  const bullet = A.bullets[idx];
  const MAX = 200;

  // working copy of the 3 options (so Edit / Reset work)
  let options = bullet.options.map(o => ({ ...o, draft: strip(o.text), editing: false }));
  let selected = null;

  function strip(html) { const d = document.createElement("div"); d.innerHTML = html; return d.textContent; }

  $("#orig-where").textContent = bullet.where;
  $("#orig-text").textContent = `“${bullet.text}”`;
  $("#orig-fits").innerHTML = bullet.fits.map(k => `<span class="chip chip-kw">${k}</span>`).join("");
  const doneCount = Object.keys(RAData.state.saved).length;
  $("#progress-pill").innerHTML = `<span class="badge badge-good">${icon("check")}${doneCount}</span> of ${A.bullets.length} bullets improved`;

  function render() {
    $("#options").innerHTML = options.map((o, i) => {
      const sel = selected === i;
      const edited = o.draft !== strip(o.text);
      const flag = o.flag ? `
        <div class="alert alert-warn" style="padding:10px 14px">${icon("flag")}
          <div class="alert-body small"><strong>Check this: “${o.flag}” isn’t in your resume.</strong>Only use this option if it’s true.</div></div>` : "";
      const body = o.editing
        ? `<label class="visually-hidden" for="edit-${i}">Edit option ${i + 1}</label>
           <textarea class="textarea" id="edit-${i}" maxlength="${MAX}" data-edit="${i}">${o.draft}</textarea>`
        : `<p class="option-text">${edited ? o.draft : o.text}</p>`;
      return `
        <article class="option" data-selected="${sel}" aria-labelledby="opt-${i}">
          <div class="option-head">
            <span class="eyebrow" id="opt-${i}">Option ${i + 1}${sel ? " · <strong style='color:var(--ink)'>Selected</strong>" : ""}</span>
            ${edited ? `<span class="badge badge-brand">${icon("pencil")}Edited</span>` : ""}
          </div>
          ${body}
          ${flag}
          <div class="option-foot">
            <span class="small muted row" style="gap:6px">${o.editing ? `<span class="mono" id="cc-${i}">${o.draft.length} / ${MAX}</span> characters` : `${icon("file", "icon-sm")}Based on your resume`}</span>
            <div class="row">
              ${edited ? `<button class="btn btn-ghost btn-sm" type="button" data-reset="${i}">${icon("undo")}Reset</button>` : ""}
              <button class="btn btn-secondary btn-sm" type="button" data-toggle-edit="${i}" aria-pressed="${o.editing}">${icon(o.editing ? "check" : "pencil")}${o.editing ? "Done editing" : "Edit"}</button>
              <button class="btn ${sel ? "btn-primary" : "btn-secondary"} btn-sm" type="button" data-select="${i}" aria-pressed="${sel}">${sel ? icon("check-circle") + "Selected" : "Select"}</button>
            </div>
          </div>
        </article>`;
    }).join("");
    $("#save").disabled = selected === null;
  }

  $("#options").addEventListener("click", e => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.select) { selected = Number(t.dataset.select); render(); document.querySelector(`[data-select="${selected}"]`).focus(); }
    if (t.dataset.toggleEdit) {
      const i = Number(t.dataset.toggleEdit);
      options[i].editing = !options[i].editing;
      if (options[i].editing) selected = i;
      render();
      const ta = document.getElementById(`edit-${i}`);
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      else document.querySelector(`[data-toggle-edit="${i}"]`).focus();
    }
    if (t.dataset.reset) { const i = Number(t.dataset.reset); options[i].draft = strip(options[i].text); options[i].editing = false; render(); RA.toast("Option reset to the AI version", { icon: "undo" }); }
  });
  $("#options").addEventListener("input", e => {
    const i = e.target.dataset.edit;
    if (i === undefined) return;
    options[i].draft = e.target.value;
    document.getElementById(`cc-${i}`).textContent = `${e.target.value.length} / ${MAX}`;
  });

  function loading() {
    $("#options").innerHTML = `
      <div class="card row" style="gap:14px"><span class="spinner"></span><div><strong>Writing 3 options…</strong><div class="small muted">About 10 seconds</div></div></div>
      ${[0, 1, 2].map(() => `<div class="option"><div class="skeleton" style="width:30%"></div><div class="skeleton"></div><div class="skeleton" style="width:80%"></div></div>`).join("")}`;
  }

  async function generate() {
    selected = null;
    $("#save").disabled = true;
    loading();
    await RA.wait(1400);
    render();
  }

  $("#regen").addEventListener("click", async () => {
    options = options.slice().reverse().map(o => ({ ...o, draft: strip(o.text), editing: false }));
    await generate();
    RA.toast("Here are 3 new options");
  });

  $("#demo-down").addEventListener("click", () => {
    selected = null;
    $("#options").innerHTML = `
      <div class="alert alert-warn" role="alert">${icon("alert")}
        <div class="alert-body"><strong>AI suggestions are down right now</strong>You can still edit the bullet yourself, and we’ll save it the same way.
          <div class="alert-actions"><button class="btn btn-primary btn-sm" type="button" id="manual">${icon("pencil")}Edit manually</button><button class="btn btn-secondary btn-sm" type="button" id="retry">${icon("refresh")}Try again</button></div></div>
      </div>`;
    $("#manual").addEventListener("click", () => {
      options = [{ text: bullet.text, draft: bullet.text, editing: true, flag: null }];
      selected = 0; render();
      document.getElementById("edit-0").focus();
    });
    $("#retry").addEventListener("click", () => { options = bullet.options.map(o => ({ ...o, draft: strip(o.text), editing: false })); generate(); });
  });

  function next() {
    const nextB = A.bullets.find(b => !RAData.state.saved[b.id] && b.id !== bullet.id);
    return nextB ? "improve.html#" + nextB.id : "export.html";
  }

  $("#save").addEventListener("click", () => {
    if (selected === null) return;
    const text = options[selected].draft;
    const before = RAData.state.saved[bullet.id];
    RAData.save({ saved: { ...RAData.state.saved, [bullet.id]: text } });
    const count = Object.keys(RAData.state.saved).length;
    $("#progress-pill").innerHTML = `<span class="badge badge-good">${icon("check")}${count}</span> of ${A.bullets.length} bullets improved`;
    RA.toast("Bullet saved to your resume", { action: { label: "Undo", onClick() {
      const s = { ...RAData.state.saved };
      if (before) s[bullet.id] = before; else delete s[bullet.id];
      RAData.save({ saved: s });
      RA.toast("Change undone. Your original bullet is back.", { icon: "undo" });
    } } });
    const bar = document.querySelector(".actionbar");
    const target = next();
    $("#save").outerHTML = `<a class="btn btn-primary" id="continue" href="${target}">${target.includes("export") ? "Continue to export" : "Next bullet"} ${icon("arrow-right")}</a>`;
    bar.querySelector("#continue").focus();
  });

  $("#skip").addEventListener("click", () => { RA.go(next()); });

  // moving to the next bullet only changes the #hash, so reload to show it
  window.addEventListener("hashchange", () => { if (!window.RA_ROUTER) location.reload(); });

  generate();
};
