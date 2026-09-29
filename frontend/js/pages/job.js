/* Job posting input (FR‑3.1, FR‑3.2, NFR‑1.2, NFR‑4.2) */
RAPages.job = function () {
  const $ = s => document.querySelector(s);
  const { icon } = RA;
  const res = RAData.activeResume();
  $("#res-name").textContent = res.name;
  $("#res-meta").textContent = `${res.bullets} bullets · ${res.sections} sections`;
  $("#res-kind").textContent = res.kind.toUpperCase();
  $("#res-kind").dataset.kind = res.kind;

  let jobReady = false;
  const analyze = $("#analyze");
  const setReady = v => { jobReady = v; analyze.disabled = !v; };

  /* ---------- tabs (text typed is kept when switching) ---------- */
  const tabs = [$("#tab-url"), $("#tab-text")];
  function select(i, focus) {
    tabs.forEach((t, j) => {
      t.setAttribute("aria-selected", String(i === j));
      t.tabIndex = i === j ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = i !== j;
    });
    if (focus) tabs[i].focus();
    if (i === 1) updateCount(); else setReady(!!$("#url-status .alert-success"));
  }
  tabs.forEach((t, i) => t.addEventListener("click", () => select(i)));
  $("[role=tablist]").addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") select(tabs[0].getAttribute("aria-selected") === "true" ? 1 : 0, true);
  });

  /* ---------- paste text ---------- */
  const ta = $("#job-text");
  function updateCount() {
    const n = ta.value.length;
    $("#char-count").textContent = `${n.toLocaleString()} / 10,000`;
    setReady(n >= 80);
  }
  ta.addEventListener("input", updateCount);

  /* ---------- URL extract with automatic fallback ---------- */
  let cancel = false;
  $("#url-form").addEventListener("submit", async e => {
    e.preventDefault();
    const input = $("#job-url"), msg = $("#url-msg"), status = $("#url-status");
    let url;
    try { url = new URL(input.value.trim()); } catch (_) { url = null; }
    if (!url || !/^https?:$/.test(url.protocol)) {
      input.setAttribute("aria-invalid", "true");
      msg.innerHTML = icon("x-circle") + "That doesn’t look like a web link. It should start with https://";
      input.focus();
      return;
    }
    input.setAttribute("aria-invalid", "false");
    msg.innerHTML = "";
    cancel = false;
    setReady(false);
    status.innerHTML = `
      <div class="alert alert-info">
        <span class="spinner" aria-hidden="true"></span>
        <div class="alert-body"><strong>Reading job posting…</strong>Usually under 10 seconds.
          <div class="progress" style="margin-top:10px"><span style="--value:0%" id="read-bar"></span></div>
        </div>
        <button class="btn btn-secondary btn-sm" type="button" id="cancel-read">Cancel</button>
      </div>`;
    $("#cancel-read").addEventListener("click", () => { cancel = true; status.innerHTML = ""; input.focus(); });
    for (let p = 0; p <= 100; p += 5) {
      if (cancel) return;
      $("#read-bar").style.setProperty("--value", p + "%");
      await RA.wait(60);
    }
    if (cancel) return;

    // Demo: LinkedIn blocks automatic reading, so show the recovery path (NFR‑4.2)
    if (/linkedin\./i.test(url.hostname)) {
      status.innerHTML = `
        <div class="alert alert-warn" role="alert">${icon("alert")}
          <div class="alert-body"><strong>We couldn’t read that page</strong>Some sites block automatic reading. Nothing is lost: paste the job description instead and we’ll continue from there.
            <div class="alert-actions">
              <button class="btn btn-primary btn-sm" type="button" id="go-paste">${icon("clipboard")}Paste description instead</button>
              <button class="btn btn-secondary btn-sm" type="submit" form="url-form">${icon("refresh")}Try again</button>
            </div>
          </div>
        </div>`;
      $("#go-paste").addEventListener("click", () => { select(1, false); ta.focus(); });
      return;
    }
    status.innerHTML = `
      <div class="alert alert-success">${icon("check-circle")}
        <div class="alert-body"><strong>Job found: Junior Data Analyst · Northwind Bank</strong>We pulled 21 keywords from the posting. Press Analyze match to continue.</div>
      </div>`;
    RAData.save({ job: { title: "Junior Data Analyst", company: "Northwind Bank" } });
    setReady(true);
    analyze.focus();
  });

  /* ---------- analyze ---------- */
  analyze.addEventListener("click", async () => {
    if (!jobReady) return;
    analyze.setAttribute("aria-busy", "true");
    analyze.innerHTML = icon("refresh") + "Analyzing your match…";
    await RA.wait(1100);
    RA.go("results.html");
  });
};
