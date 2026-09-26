/* Dashboard · resume upload (FR‑2.1, FR‑2.2, NFR‑4.1) */
RAPages.dashboard = function () {
  const $ = s => document.querySelector(s);
  const { icon } = RA;
  const st = RAData.state;
  const MAX = 10 * 1024 * 1024;

  $("#first-name").textContent = (st.user?.name || "Alex").split(" ")[0];
  $("#today").textContent = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  if (location.hash === "#welcome") RA.toast("Account created. Let’s upload your first resume.");

  /* ---------- resumes table ---------- */
  function renderResumes() {
    const rows = RAData.state.resumes;
    $("#resume-count").textContent = rows.length;
    $("#t-resumes").textContent = rows.filter(r => r.status === "ready").length;
    $("#resume-rows").innerHTML = rows.map(r => {
      const status = r.status === "ready"
        ? `<span class="badge badge-good">${icon("check")}Ready · ${r.bullets} bullets</span>`
        : `<span class="badge badge-bad">${icon("x")}Couldn’t read text</span>`;
      const note = r.status === "error"
        ? `<div class="row-note">${icon("info", "icon-sm")}<span>This looks like a scanned image. Upload a PDF exported from Word or Google Docs so we can read the text.</span></div>` : "";
      const action = r.status === "ready"
        ? `<a class="btn btn-secondary btn-sm" href="job.html" data-use="${r.id}">${icon("target")}Analyze</a>`
        : `<label class="btn btn-secondary btn-sm" for="file-input">${icon("upload")}Re‑upload</label>`;
      return `<tr>
        <td><div class="file-cell"><span class="file-ico" data-kind="${r.kind}">${r.kind.toUpperCase()}</span><div>${r.name}${note}</div></div></td>
        <td class="muted">${r.date}</td>
        <td>${status}</td>
        <td><div class="row" style="justify-content:flex-end">${action}
          <button class="btn btn-ghost btn-sm btn-icon" type="button" data-del="${r.id}" aria-label="Delete ${r.name}" data-tip="Delete resume">${icon("trash")}</button></div></td>
      </tr>`;
    }).join("") || `<tr><td colspan="4"><div class="empty">No resumes yet. Upload one above to get started.</div></td></tr>`;
  }

  /* ---------- recent analyses ---------- */
  function renderAnalyses() {
    $("#analysis-list").innerHTML = RAData.state.analyses.map(a => `
      <li><a class="analysis-item" href="results.html">
        <span><strong>${a.title}</strong><span class="small muted">${a.company} · ${a.date}</span></span>
        <span class="mini-score"><span class="n">${a.score}<span class="small">%</span></span>${RA.levelBadge(a.score)}</span>
      </a></li>`).join("");
  }

  renderResumes();
  renderAnalyses();
  RA.scoreRing($("#banner-ring"), 68);
  if (location.hash === "#analyses") setTimeout(() => $("#analyses").focus(), 50);

  document.addEventListener("click", async e => {
    const use = e.target.closest("[data-use]");
    if (use) RAData.save({ activeResumeId: use.dataset.use });

    const del = e.target.closest("[data-del]");
    if (!del) return;
    const idx = RAData.state.resumes.findIndex(r => r.id === del.dataset.del);
    const r = RAData.state.resumes[idx];
    const ok = await RA.confirm({
      title: "Delete this resume?",
      body: `<strong>${r.name}</strong> and its analyses will be permanently deleted. This can’t be undone.`,
      extra: `<label class="check" style="margin-top:16px"><input type="checkbox" checked> Also delete my saved bullet improvements</label>`,
      confirmLabel: "Delete resume"
    });
    if (!ok) { del.focus(); return; }
    const copy = RAData.state.resumes.slice();
    copy.splice(idx, 1);
    RAData.save({ resumes: copy });
    renderResumes();
    RA.toast(`Deleted ${r.name}`, { icon: "trash", action: { label: "Undo", onClick() {
      const back = RAData.state.resumes.slice(); back.splice(idx, 0, r);
      RAData.save({ resumes: back }); renderResumes(); RA.toast("Resume restored");
    } } });
  });

  /* ---------- upload: drag & drop + browse ---------- */
  const dz = $("#dropzone"), input = $("#file-input"), area = $("#upload-area");
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.dataset.drag = "true"; }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.dataset.drag = "false"; }));
  dz.addEventListener("drop", e => handle(e.dataTransfer.files[0]));
  input.addEventListener("change", () => { handle(input.files[0]); input.value = ""; });

  function fail(title, text) {
    area.innerHTML = `<div class="alert alert-error" role="alert" style="margin-top:16px">${icon("x-circle")}<div class="alert-body"><strong>${title}</strong>${text}</div></div>`;
  }

  let cancelled = false;
  async function handle(file) {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx"].includes(ext)) return fail("That file type isn’t supported", `“${file.name}” is a .${ext} file. Upload a PDF or DOCX instead.`);
    if (file.size > MAX) return fail("File too large", `Resumes must be 10 MB or smaller. This one is ${(file.size / 1048576).toFixed(1)} MB.`);

    cancelled = false;
    const total = Math.max(file.size, 350000);
    area.innerHTML = `
      <div class="upload-status">
        <div class="row-between">
          <div class="file-cell"><span class="file-ico" data-kind="${ext}">${ext.toUpperCase()}</span>
            <div><div>${file.name}</div><div class="small muted" id="up-bytes">0 KB of ${(total / 1024).toFixed(0)} KB</div></div></div>
          <div class="row"><strong class="mono" id="up-pct">0%</strong><button class="btn btn-secondary btn-sm" type="button" id="up-cancel">Cancel</button></div>
        </div>
        <div class="progress" style="margin-top:12px" role="progressbar" aria-label="Uploading ${file.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
        <p class="small muted" style="margin-top:8px" id="up-next">Uploading… next we’ll read your sections (about 5 seconds)</p>
      </div>`;
    $("#up-cancel").addEventListener("click", () => {
      cancelled = true;
      area.innerHTML = "";
      RA.toast("Upload cancelled", { icon: "x-circle" });
    });

    const bar = area.querySelector(".progress");
    for (let p = 0; p <= 100; p += 4) {
      if (cancelled) return;
      bar.style.setProperty("--value", p + "%");
      bar.setAttribute("aria-valuenow", p);
      $("#up-pct").textContent = p + "%";
      $("#up-bytes").textContent = `${(total * p / 100 / 1024).toFixed(0)} KB of ${(total / 1024).toFixed(0)} KB`;
      await RA.wait(55);
    }
    $("#up-next").innerHTML = `<span class="row" style="gap:8px"><span class="spinner"></span>Reading sections and bullets…</span>`;
    await RA.wait(1200);
    if (cancelled) return;

    const r = { id: "r" + Date.now(), name: file.name, kind: ext, date: "Today", status: "ready", bullets: 14, sections: 5 };
    RAData.save({ resumes: [r, ...RAData.state.resumes], activeResumeId: r.id });
    renderResumes();
    area.innerHTML = `
      <div class="alert alert-success" style="margin-top:16px">${icon("check-circle")}
        <div class="alert-body"><strong>Resume uploaded</strong>We found 5 sections and 14 bullets in ${file.name}.
          <div class="alert-actions"><a class="btn btn-primary btn-sm" href="job.html">Compare with a job ${icon("arrow-right")}</a></div>
        </div>
      </div>`;
  }
};
