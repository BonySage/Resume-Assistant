// Exports every screen to PNG and builds one PDF for the assignment.
// No npm packages needed: it drives your installed Google Chrome through the
// DevTools protocol (Node 22+ has fetch and WebSocket built in).
//
//   npm run pdf
//   -> exports/screens/*.png  and  exports/Resume-Assistant-UI-Design.pdf
//
// Set CHROME_PATH if Chrome isn't in the default location.

import http from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "frontend");
const OUT = path.join(ROOT, "exports");
const SHOTS = path.join(OUT, "screens");

const CHROME = process.env.CHROME_PATH || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].find(p => existsSync(p));
if (!CHROME) { console.error("Couldn't find Chrome. Set CHROME_PATH to your Chrome executable."); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 1. tiny static server ---------- */
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let file = decodeURIComponent(url.pathname);
  if (file === "/") file = "/index.html";
  const base = file.startsWith("/__exports/") ? OUT : SITE;
  const full = path.join(base, file.replace("/__exports/", "/"));
  try {
    const body = await readFile(full);
    res.writeHead(200, { "content-type": TYPES[path.extname(full)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---------- 2. launch Chrome ---------- */
const profile = path.join(os.tmpdir(), "ra-export-" + Date.now());
const PORT = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--force-color-profile=srgb", "about:blank"
], { stdio: "ignore" });

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === "page")?.webSocketDebuggerUrl; }
  catch { await sleep(200); }
}
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener("message", ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else listeners.forEach(l => l(msg));
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, m => (m.error ? reject(new Error(method + ": " + m.error.message)) : resolve(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expr => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

await send("Page.enable");
await send("Runtime.enable");

async function viewport(width, height, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile });
}
async function go(url) {
  const loaded = new Promise(r => { const l = m => { if (m.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
  // a unique query string forces a full load even when only the #hash differs
  const [pathPart, hashPart] = url.split("#");
  await send("Page.navigate", { url: `${BASE}/${pathPart}?r=${Date.now()}${hashPart ? "#" + hashPart : ""}` });
  await loaded;
  await evaluate("document.fonts.ready.then(() => true)");
  await sleep(600);
}
async function shot(name, { clipSelector, fullPage = true, top = false, clipBelow = null } = {}) {
  let clip;
  // sticky bars would float over content in a full-page capture
  if (fullPage) await evaluate(`(() => { const s = document.createElement("style"); s.textContent = ".actionbar{position:static!important}"; document.head.appendChild(s); return true; })()`);
  if (clipBelow) {
    clip = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(clipBelow)}).getBoundingClientRect(); const y = r.top + scrollY; return { x: 0, y, width: innerWidth, height: document.documentElement.scrollHeight - y }; })()`);
  } else if (clipSelector && top) {
    // from the top of the page down to the end of this element
    clip = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(clipSelector)}).getBoundingClientRect(); return { x: 0, y: 0, width: innerWidth, height: r.bottom + scrollY }; })()`);
  } else if (clipSelector) {
    clip = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(clipSelector)}).getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
  } else if (fullPage) {
    const { width, height } = await evaluate("({ width: innerWidth, height: Math.max(document.documentElement.scrollHeight, innerHeight) })");
    clip = { x: 0, y: 0, width, height };
  }
  const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 88, captureBeyondViewport: !!clip, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  await writeFile(path.join(SHOTS, name + ".jpg"), Buffer.from(data, "base64"));
  console.log("  ✓", name);
  return name + ".jpg";
}

/* ---------- 3. capture screens ---------- */
await rm(SHOTS, { recursive: true, force: true });
await mkdir(SHOTS, { recursive: true });
console.log("Capturing screens…");

await viewport(1440, 900);
await go("index.html"); await sleep(900);
await shot("01-welcome", { clipSelector: ".how" , top: true });
await shot("01b-welcome-more", { clipBelow: "#example" });

await go("login.html");
await shot("02-login", { fullPage: false });

await go("login.html#signup");
await evaluate(`(() => {
  const set = (id, v, ev = "input") => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event(ev, { bubbles: true })); el.dispatchEvent(new Event("blur")); };
  set("su-name", "Alex Rivera"); set("su-email", "alex.rivera@email.com"); set("su-pw", "Resume2026"); set("su-pw2", "Resume20");
  return true; })()`);
await shot("03-signup");

await go("dashboard.html");
await shot("04-dashboard");

await evaluate(`document.querySelector("[data-del='r1']").click(), true`);
await sleep(400);
await shot("05-confirm-delete", { fullPage: false });

await go("job.html");
await evaluate(`document.getElementById("extract-btn").click(), true`);
await sleep(1900);
await shot("06-job-posting");

await go("results.html"); await sleep(1300);
await shot("07-match-results");

await go("improve.html#b1"); await sleep(1800);
await evaluate(`document.querySelector("[data-select='1']").click(), true`);
await sleep(200);
await shot("08-improve-bullets");

await go("export.html");
await shot("09-export");

await go("done.html"); await sleep(5400);
await shot("10-confirmation", { fullPage: false });

await go("settings.html#accessibility");
await evaluate(`(() => { const r = document.querySelector("input[name=palette][value=cb]"); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
await sleep(200);
await shot("11-settings");

await go("styleguide.html");
await shot("12-style-colors", { clipSelector: "#colors" });
await shot("13-style-type", { clipSelector: "#type" });
await shot("14-style-components", { clipSelector: "#components" });
await shot("15-style-icons", { clipSelector: "#icons" });

// states: errors and system feedback
await go("login.html");
await evaluate(`(() => { document.getElementById("login-email").value = "wrong@email.com"; document.getElementById("login-pw").value = "short"; document.querySelector("#login-form button[type=submit]").click(); return true; })()`);
await sleep(1100);
await shot("s1-login-error", { clipSelector: "#panel-login" });
await go("improve.html#b1"); await sleep(1800);
await evaluate(`document.getElementById("demo-down").click(), true`);
await sleep(300);
await shot("s2-ai-down", { clipSelector: "#options" });
await go("settings.html#password");
await evaluate(`document.getElementById("preview-timeout").click(), true`);
await sleep(500);
await shot("s3-timeout", { clipSelector: "dialog.modal" });
await go("styleguide.html");
await shot("s4-principles", { clipSelector: "#principles" });

await viewport(390, 844, true);
await go("login.html"); await shot("m1-login", { fullPage: false });
await go("dashboard.html"); await shot("m2-dashboard", { fullPage: false });
await go("results.html"); await sleep(1300); await shot("m3-results", { fullPage: false });
await go("improve.html#b1"); await sleep(1800); await shot("m4-improve", { fullPage: false });

/* ---------- 4. build the PDF booklet ---------- */
const PAGES = [
  ["01-welcome", "Welcome", "Landing page · SRS 1.2", [
    "One‑sentence value proposition with a highlighter swipe on “any job”.",
    "One primary action (Get started); Log in is secondary.",
    "Example preview uses the real score card, so users know what they’ll get.",
    "Scan · Match · Improve uses the same words as the in‑app step bar (recognition over recall).",
    "Privacy line answers the trust question before it’s asked."]],
  ["01b-welcome-more", "Welcome · rest of the page", "Landing page · footer", [
    "Before / after example shows exactly what the AI does, with the score change.",
    "Feature grid: each feature has its own colour and icon, matching the app.",
    "FAQ uses native disclosure buttons, so it works with keyboard and screen readers.",
    "Final call to action repeats the one primary button.",
    "Footer with product links, team credits and © 2026 copyright."]],
  ["02-login", "Log in", "FR‑1.1 · Screen 1", [
    "Log in and Sign up share one card with a tab switch (consistency).",
    "One‑click sign in with Google, Apple or GitHub, or use email.",
    "Show/Hide password and a Caps Lock warning prevent common errors.",
    "Wrong credentials give one plain‑English message that doesn’t reveal which field was wrong.",
    "Labels always sit above fields; focus ring is a 3 px blue outline."]],
  ["03-signup", "Sign up", "FR‑1.1 · error prevention", [
    "Password rules are a live checklist with ✓ / ✕ icons, not just colour.",
    "Strength meter uses segments and a word (“Good, 3 of 4”).",
    "Fields validate when you leave them, not on every keystroke.",
    "Create account stays disabled until everything is valid, and says why."]],
  ["04-dashboard", "Dashboard", "FR‑2.1 · FR‑2.2 · NFR‑4.1", [
    "Big drag‑and‑drop zone that also works with Browse files (keyboard, mobile).",
    "File rules (PDF/DOCX, 10 MB) are shown before upload.",
    "A resume that couldn’t be read explains why and offers one‑click Re‑upload.",
    "Recent analyses show score + label + icon so users pick up where they left off."]],
  ["05-confirm-delete", "Confirmation dialog", "Error prevention", [
    "Destructive actions always ask first and name exactly what will be lost.",
    "Focus starts on Cancel; the red button says “Delete resume”, not “OK”.",
    "Esc, ✕ or clicking outside closes the dialog.",
    "After deleting, a toast offers Undo."]],
  ["06-job-posting", "Main feature 1 · Job posting", "FR‑3.1 · FR‑3.2 · NFR‑4.2", [
    "Step bar shows step 2 of 5: done steps have a check, the current one is yellow.",
    "Two input methods as tabs with icon + label; typed text is kept when switching.",
    "Shown here: the link couldn’t be read, so the app offers “Paste description instead” in one click.",
    "The chosen resume stays visible on the right."]],
  ["07-match-results", "Main feature 2 · Match results", "FR‑4.1 · FR‑4.2 · FR‑5.1", [
    "Score is a number, a ring, a word (“Fair”) and an icon, with a legend of ranges.",
    "Keywords split into Matched (solid ✓), Missing (dashed ✕) and Weak (striped !).",
    "Recommendations say “if you’ve used…” so users don’t add skills they don’t have.",
    "Select a bullet to improve; the selected one gets a thick border and a filled radio."]],
  ["08-improve-bullets", "Main feature 3 · Improve with AI", "FR‑5.2 · FR‑5.3 · NFR‑4.3", [
    "The original bullet stays on top in dark ink for easy comparison.",
    "Three numbered options, each with Edit and Select; the selected one gets an indigo outline and the word “Selected”.",
    "Option 3 is flagged: “Power BI isn’t in your resume” (hallucination check).",
    "Sticky action bar: nothing changes until Save, and Save gives an Undo toast."]],
  ["09-export", "Main feature 4 · Export", "FR‑6.1", [
    "Preview marks changed bullets with a bar, a tag and the word “Updated”.",
    "Highlight toggle shows the final look; highlights never go into the file.",
    "Before/after score confirms the effect of the changes.",
    "PDF is pre‑selected and the button says exactly what happens."]],
  ["10-confirmation", "Confirmation", "Task complete", [
    "Big check, headline and exact file name confirm the task is finished.",
    "Summary lists job, bullets improved, score change and file type.",
    "No dead end: Match with another job (primary) or Back to dashboard.",
    "Confetti is skipped when Reduce motion is on."]],
  ["11-settings", "Settings · Accessibility", "NFR‑2.5 · FR‑1.2", [
    "Grouped side menu; current group has a bar, bold text and a tint.",
    "Text size options are each shown at their own size.",
    "High contrast, Reduce motion and a colour‑blind keyword palette (shown selected here).",
    "Changes preview instantly; a sticky bar offers Save or Discard."]],
  ["12-style-colors", "Style guide · Colors", "Contrast & colour‑blind safety", ["Ratios are computed live from the CSS. All text pairs pass WCAG AA; most pass AAA."]],
  ["13-style-type", "Style guide · Typography", "Readable text", ["Fraunces for headings, Public Sans for body, IBM Plex Mono for labels. 16 px body, 12 px minimum."]],
  ["14-style-components", "Style guide · Components", "Buttons, forms, feedback", ["Every state is shown: default, focus, disabled, loading, success, warning and error."]],
  ["15-style-icons", "Style guide · Icons", "24 px grid · 2 px stroke", ["Icons always come with a text label; icon‑only buttons have an accessible name and a tooltip."]]
];


const SCREENS = PAGES.slice(0, 12), STYLE = PAGES.slice(12);
const LIVE = "https://claude.ai/artifact/C5V1nGPEJdDgfdezJftwcR";
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
let n = 1;
const num = () => String(++n).padStart(2, "0");
const toc = [];
const pageFor = ([file, title, tag, notes]) => { const k = num(); toc.push([k, title]); return `
<section class="pg">
  <div class="shot"><img src="/__exports/screens/${file}.jpg"></div>
  <div class="side">
    <div class="num">${k}</div>
    <h2>${esc(title)}</h2>
    <div><span class="tag">${esc(tag)}</span></div>
    <ol>${notes.map(t => `<li><span>${esc(t)}</span></li>`).join("")}</ol>
    <div class="foot">Resume Assistant · UI design</div>
  </div>
</section>`; };

const FLOW = [["Welcome", "Landing"], ["Log in / Sign up", "FR‑1.1 · FR‑1.2"], ["Dashboard", "FR‑2.1 · FR‑2.2"], ["Job posting", "FR‑3.1 · FR‑3.2"], ["Match results", "FR‑4.1 · FR‑4.2 · FR‑5.1"], ["Improve bullets", "FR‑5.2 · FR‑5.3"], ["Export", "FR‑6.1"], ["Confirmation", "Download done"]];
const flowPage = (() => { const k = num(); toc.push([k, "User flow & requirements"]); return `
<section class="pg" style="grid-template-columns:1fr;grid-template-rows:auto auto 1fr;gap:28px">
  <div style="display:flex;align-items:baseline;gap:24px"><div class="num">${k}</div><h2 style="margin:0">User flow &amp; requirement coverage</h2><span class="tag">SRS 6.1 · all FRs</span></div>
  <div class="flow">${FLOW.map(([a, b], i) => `<div class="node${i === 0 || i === 7 ? " end" : ""}"><b>${a}</b><span>${b}</span></div>${i < FLOW.length - 1 ? '<div class="arrow">→</div>' : ""}`).join("")}</div>
  <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:36px;min-height:0">
    <table class="req"><thead><tr><th>Requirement</th><th>Where it is shown</th></tr></thead><tbody>
      <tr><td>FR‑1.1 Register with email &amp; password</td><td>Sign up (strength meter, live rules)</td></tr>
      <tr><td>FR‑1.2 Log in securely</td><td>Log in, 15‑min session timeout warning</td></tr>
      <tr><td>FR‑2.1 / 2.2 Upload &amp; parse resume</td><td>Dashboard drop zone, “We found 5 sections and 14 bullets”</td></tr>
      <tr><td>FR‑3.1 / 3.2 Job posting via URL or text</td><td>Job posting tabs, “We pulled 21 keywords”</td></tr>
      <tr><td>FR‑4.1 / 4.2 Score + matched / missing / weak</td><td>Match results ring and keyword lists</td></tr>
      <tr><td>FR‑5.1 – 5.3 Select, generate, save bullets</td><td>Results bullet picker, Improve screen</td></tr>
      <tr><td>FR‑6.1 Export as PDF</td><td>Export preview, Confirmation</td></tr>
      <tr><td>NFR‑4.1 – 4.3 Failure handling</td><td>Unreadable file row, URL fallback, AI outage (page ${String(n + 13).padStart(2, "0")})</td></tr>
      <tr><td>NFR‑3.3 / 3.4 Responsive, tooltips</td><td>Mobile views, tooltips on icon buttons, Help</td></tr>
    </tbody></table>
    <div class="side-box">
      <h3>Global navigation</h3>
      <p>Same top bar on every signed‑in page: Dashboard · New analysis · My analyses, plus Help and the account menu (Settings, Accessibility, Log out). Every page has a Back button.</p>
      <h3>Recovery paths</h3>
      <p>Link can’t be read → paste description. AI unavailable → edit manually. Scanned PDF → re‑upload tip. Delete → confirm dialog + Undo.</p>
      <h3>Try it live</h3>
      <p class="mono">${LIVE}</p>
    </div>
  </div>
</section>`; })();

const screenPages = SCREENS.map(pageFor).join("");

const statesPage = (() => { const k = num(); toc.push([k, "Errors & system feedback"]); return `
<section class="pg" style="grid-template-columns:1fr;grid-template-rows:auto 1fr;gap:24px">
  <div style="display:flex;align-items:baseline;gap:24px"><div class="num">${k}</div><h2 style="margin:0">Errors &amp; system feedback</h2><span class="tag">Heuristics · NFR‑3.2 · NFR‑4.3</span>
    <span style="margin-left:auto;font-size:17px;color:#45464f;max-width:520px">Plain‑English messages that say what happened and what to do next, always with an icon, never colour alone.</span></div>
  <div class="states">
    <figure><img src="/__exports/screens/s1-login-error.jpg"><figcaption><b>Wrong password.</b> One safe message, password cleared, focus returned.</figcaption></figure>
    <figure><img src="/__exports/screens/s2-ai-down.jpg"><figcaption><b>AI unavailable.</b> User can still edit the bullet manually or retry.</figcaption>
      <img src="/__exports/screens/s3-timeout.jpg" style="margin-top:22px"><figcaption><b>Session timeout.</b> 60‑second countdown with “Stay logged in”.</figcaption></figure>
  </div>
</section>`; })();

const stylePages = STYLE.map(pageFor).join("");

const principlesPage = (() => { const k = num(); toc.push([k, "Assignment checklist"]); return `
<section class="pg" style="grid-template-columns:1fr 1fr;gap:44px">
  <div class="side">
    <div class="num">${k}</div>
    <h2>Assignment checklist</h2>
    <ul class="checks">
      <li><b>Style guide</b> colours with contrast ratios, fonts, button shapes and states, icons (pages ${toc.find(t => t[1].includes("Colors"))?.[0]}–${toc.find(t => t[1].includes("Icons"))?.[0]})</li>
      <li><b>All required pages</b> welcome, login, dashboard, 4 main features, settings, confirmation</li>
      <li><b>UI/UX principles</b> consistent layout, simple navigation, feedback indicators</li>
      <li><b>Usability heuristics</b> system status, recognition over recall, error prevention</li>
      <li><b>Accessibility</b> WCAG AA contrast, colour‑blind safe status, 16 px text, clear labels</li>
      <li><b>Exported to PDF</b> this document</li>
    </ul>
    <p style="margin-top:24px;font-size:16px;color:#45464f">Built as a clickable high‑fidelity prototype in HTML, CSS and JavaScript (in place of Figma), so every screen and state can be tried live.</p>
    <div class="foot">Resume Assistant · UI design</div>
  </div>
  <div class="shot"><img src="/__exports/screens/s4-principles.jpg"></div>
</section>`; })();

const mobilePage = (() => { const k = num(); toc.push([k, "Mobile views"]); return `
<section class="pg">
  <div style="grid-column:1/-1;display:flex;align-items:baseline;gap:24px"><div class="num">${k}</div><h2 style="margin:0">Mobile views</h2><span class="tag">Responsive · NFR‑3.3</span>
    <span style="margin-left:auto;font-size:17px;color:#45464f">Single column, 44 px touch targets, top nav becomes a labelled tab bar.</span></div>
  <div class="phones">
    <figure><img src="/__exports/screens/m1-login.jpg"><figcaption>Log in</figcaption></figure>
    <figure><img src="/__exports/screens/m2-dashboard.jpg"><figcaption>Dashboard</figcaption></figure>
    <figure><img src="/__exports/screens/m3-results.jpg"><figcaption>Match results</figcaption></figure>
    <figure><img src="/__exports/screens/m4-improve.jpg"><figcaption>Improve bullets</figcaption></figure>
  </div>
</section>`; })();

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800&family=IBM+Plex+Mono:wght@500;600&family=Public+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: 1600px 1000px; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Public Sans", sans-serif; color: #16171d; }
  .pg { width: 1600px; height: 1000px; page-break-after: always; overflow: hidden; background: #fbfaf7;
        display: grid; grid-template-columns: 1fr 380px; gap: 40px; padding: 48px 56px; }
  .shot { display: flex; align-items: center; justify-content: center; min-height: 0; }
  .shot img { max-width: 100%; max-height: 904px; border-radius: 14px; box-shadow: 0 0 0 1px #d9d4c7, 8px 8px 0 #dfe3ff; background: #fff; }
  .side { display: flex; flex-direction: column; }
  .num { font-family: "Fraunces", serif; font-style: italic; font-size: 64px; line-height: 1; color: #3446e0; }
  h2 { font-family: "Fraunces", serif; font-size: 36px; line-height: 1.1; margin: 14px 0 10px; letter-spacing: -.02em; }
  h3 { font-size: 17px; margin: 0 0 6px; }
  .tag { display: inline-block; font-family: "IBM Plex Mono", monospace; font-size: 13px; padding: 4px 10px; border-radius: 999px; background: #ffd23f; }
  ol { margin: 26px 0 0; padding: 0; list-style: none; counter-reset: n; display: grid; gap: 14px; }
  ol li { counter-increment: n; display: grid; grid-template-columns: 30px 1fr; gap: 10px; font-size: 17px; line-height: 1.45; }
  ol li::before { content: counter(n); width: 28px; height: 28px; border-radius: 50%; background: #3446e0; color: #fff; display: grid; place-items: center; font: 600 13px "IBM Plex Mono", monospace; }
  .foot { margin-top: auto; font: 500 12px "IBM Plex Mono", monospace; color: #45464f; letter-spacing: .06em; text-transform: uppercase; }
  .mono { font-family: "IBM Plex Mono", monospace; font-size: 14px; word-break: break-all; }
  .cover { position: relative; display: flex; flex-direction: column; justify-content: center; padding: 80px 110px; background: #0d0e2a; color: #fff; }
  .cover .glow { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .55; }
  .cover > *:not(.glow) { position: relative; }
  .cover h1 { font-family: "Fraunces", serif; font-size: 116px; line-height: .98; letter-spacing: -.04em; margin: 22px 0; }
  .cover h1 em { font-weight: 500; color: #a78bff; }
  .cover .hl { background: #ffd23f; color: #16171d; padding: 0 12px; }
  .cover p { font-size: 22px; max-width: 900px; color: #c9cbe8; line-height: 1.5; }
  .toc { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 40px; margin-top: 40px; font-size: 17px; color: #e6e7ff; }
  .toc span { font-family: "IBM Plex Mono", monospace; color: #a9abd6; margin-right: 10px; }
  .flow { display: flex; align-items: center; gap: 10px; }
  .flow .node { flex: 1; padding: 14px 12px; border-radius: 16px; background: #fff; box-shadow: 0 0 0 1px #d9d4c7, 4px 4px 0 #dfe3ff; text-align: center; }
  .flow .node.end { background: #eaedff; }
  .flow .node b { display: block; font-size: 16px; }
  .flow .node span { font: 500 11px "IBM Plex Mono", monospace; color: #45464f; }
  .flow .arrow { font-size: 22px; color: #3446e0; font-weight: 700; }
  .req { width: 100%; border-collapse: collapse; font-size: 15.5px; align-self: start; }
  .req th { text-align: left; font: 500 12px "IBM Plex Mono", monospace; text-transform: uppercase; letter-spacing: .06em; color: #45464f; padding: 8px 12px; background: #f1efe9; }
  .req td { padding: 11px 12px; border-bottom: 1px solid #e6e2d8; vertical-align: top; }
  .req td:first-child { font-weight: 700; }
  .side-box { background: #eaedff; border-radius: 20px; padding: 24px 26px; display: grid; gap: 6px; align-content: start; }
  .side-box p { margin: 0 0 12px; font-size: 16px; line-height: 1.5; color: #2b2c35; }
  .states { display: grid; grid-template-columns: 1fr 1.25fr; gap: 40px; min-height: 0; }
  .states figure { margin: 0; }
  .states img { width: 100%; max-height: 760px; object-fit: cover; object-position: top; border-radius: 14px; box-shadow: 0 0 0 1px #d9d4c7, 8px 8px 0 #dfe3ff; }
  .states figcaption { margin-top: 10px; font-size: 15.5px; color: #45464f; }
  .states figcaption b { color: #16171d; }
  .checks { list-style: none; margin: 20px 0 0; padding: 0; display: grid; gap: 14px; }
  .checks li { position: relative; padding-left: 40px; font-size: 17px; line-height: 1.45; }
  .checks li::before { content: "✓"; position: absolute; left: 0; top: 0; width: 28px; height: 28px; border-radius: 50%; background: #0a6e4f; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 15px; }
  .checks b { display: block; }
  .phones { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 36px; align-items: start; }
  .phones figure { margin: 0; text-align: center; }
  .phones img { width: 100%; border-radius: 28px; box-shadow: 0 0 0 1px #d9d4c7, 8px 8px 0 #dfe3ff; }
  .phones figcaption { margin-top: 14px; font-weight: 700; }
</style></head><body>
<section class="pg cover">
  <i class="glow" style="width:520px;height:520px;background:#8b6cff;right:-60px;top:-120px"></i>
  <i class="glow" style="width:420px;height:420px;background:#4cc2ff;right:320px;top:420px;opacity:.4"></i>
  <i class="glow" style="width:360px;height:360px;background:#ff6b4a;right:-80px;bottom:-120px;opacity:.45"></i>
  <span class="tag" style="align-self:flex-start;color:#16171d">CSCE 3444 · UI Design submission</span>
  <h1>Resume <em>Assistant</em><br><span class="hl">Scan. Match. Improve.</span></h1>
  <p>High‑fidelity UI design and style guide for a web app that helps students and early‑career job seekers tailor their resume to a specific job posting.</p>
  <p style="font-size:17px;margin-top:14px">Team: Gaurav Bhandari (Database) · Serene Plummer (Backend) · Ingeet Adhikari (Frontend) · Anup Sharma (QA)</p>
  <p class="mono" style="margin-top:10px;color:#ffd23f">Live prototype: ${LIVE}</p>
  <div class="toc">${toc.map(([k, t]) => `<div><span>${k}</span>${esc(t)}</div>`).join("")}</div>
</section>
${flowPage}${screenPages}${statesPage}${stylePages}${principlesPage}${mobilePage}
</body></html>`;


await writeFile(path.join(OUT, "booklet.html"), html);
await viewport(1600, 1000);
await go("__exports/booklet.html");
await sleep(800);
const { data } = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
const pdfPath = path.join(OUT, "Resume-Assistant-UI-Design.pdf");
await writeFile(pdfPath, Buffer.from(data, "base64"));
console.log("\nPDF saved to", path.relative(ROOT, pdfPath));

ws.close();
chrome.kill();
server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});
