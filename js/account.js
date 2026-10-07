"use strict";
/* Pathya Care — account screens: sign up, log in, backup key, sync status and account settings. */

const CLOUD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.4 9.2 4.5 4.5 0 0 0 7 18z"/></svg>';
const SYNC_TXT = {
  synced: ["ok", "Saved to your account"], pending: ["busy", "Saving…"], syncing: ["busy", "Syncing…"],
  offline: ["muted", "Offline: saved on this phone"], error: ["warn", "Couldn't sync"], signedout: ["warn", "Log in to sync"], off: ["muted", "Not synced"]
};
const accountsOn = () => SYNC.api === true;
const whereKept = () => accountsOn() && SYNC.user && S && !S.demo ? "saved privately to your account" : "stay on this device";

function syncBadge() {
  if (!accountsOn() || !S || S.demo || (!SYNC.user && !acctLoad())) return '<span class="syncb" hidden></span>';
  const [lvl, label] = SYNC_TXT[SYNC.status] || SYNC_TXT.off, title = SYNC.msg || label;
  return `<button class="syncb ${lvl}" data-act="acctOpen" title="${esc(title)}" aria-label="${esc(title)}">${CLOUD}<span>${esc(label)}</span></button>`;
}
function ago(ms) { if (!ms) return ""; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; }

/* ---------- forms ---------- */
const CONSENT_TXT = `I'm 18 or older and agree that Pathya stores the health details I enter, encrypted, in India, to personalise my food guidance. I can download or delete them anytime. <a href="privacy.html" target="_blank" rel="noopener">Privacy notice</a>`;
const profileFields = () => `<div class="grid2">${fld("Name", '<input id="w-name" placeholder="Your name" autocomplete="given-name">')}${fld("Age", '<input id="w-age" type="number" inputmode="numeric" value="35">')}</div>
      <div class="grid3">${fld("Sex", '<select id="w-sex"><option value="female">Female</option><option value="male">Male</option></select>')}${fld("Height (cm)", '<input id="w-h" type="number" inputmode="numeric" value="160">')}${fld("Weight (kg)", '<input id="w-w" type="number" inputmode="decimal" value="65" step="0.1">')}</div>
      <div class="grid2">${fld("Diet", `<select id="w-diet">${DIETS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`)}${fld("Goal", `<select id="w-goal">${GOALS.map(([v, l]) => `<option value="${v}" ${v === "maintain" ? "selected" : ""}>${l}</option>`).join("")}</select>`)}</div>`;
function authForm(mode, inSheet) {
  const email = esc(UI.authEmail || (acctLoad() || {}).email || "");
  const em = fld("Email", `<input id="a-email" type="email" inputmode="email" autocomplete="email" value="${email}" placeholder="you@example.com">`);
  const err = `<p class="autherr" id="authErr" role="alert"></p>`;
  if (mode === "login") return `${em}${fld("Password", '<input id="a-pass" type="password" autocomplete="current-password">')}${err}
    <button class="btn primary block" data-act="acctLogin">Log in</button>
    <button class="linkbtn" data-act="acctMode" data-v="reset">Forgot your password?</button>`;
  if (mode === "reset") return `<p class="tiny muted" style="margin-top:0">Use the backup key you saved when you created your account.</p>${em}
    ${fld("Backup key", '<input id="a-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX">')}
    ${fld("New password", '<input id="a-pass" type="password" autocomplete="new-password" placeholder="8 or more characters">')}${err}
    <button class="btn primary block" data-act="acctReset">Reset password</button>
    <button class="linkbtn" data-act="acctMode" data-v="login">Back to log in</button>`;
  return `${inSheet ? "" : profileFields()}${em}${fld("Password", '<input id="a-pass" type="password" autocomplete="new-password" placeholder="8 or more characters">')}
    <label class="check"><input type="checkbox" id="a-consent"> <span>${CONSENT_TXT}</span></label>${err}
    <button class="btn primary block" data-act="acctSignup">${inSheet ? "Create account and back up" : "Create my account"}</button>`;
}
function authCard() {
  if (SYNC.api === null) return `<div class="card" id="auth"><h4>Your account</h4><p class="small muted">Connecting…</p></div>`;
  if (SYNC.user && !S) return `<div class="card" id="auth"><h4>Welcome, ${esc(SYNC.user.email)}</h4><p class="tiny muted" style="margin-top:-4px">Your account is ready. Tell Pathya a little about you.</p>${profileFields()}<button class="btn primary block" data-act="startFresh">Start</button></div>`;
  const mode = UI.auth || "signup";
  const tabs = mode === "reset" ? `<h4>Reset your password</h4>` : `<div class="authtabs" role="tablist">${[["signup", "Create account"], ["login", "Log in"]].map(([k, l]) => `<button role="tab" aria-selected="${mode === k}" class="${mode === k ? "on" : ""}" data-act="acctMode" data-v="${k}">${l}</button>`).join("")}</div>`;
  const sub = mode === "signup" ? `<p class="tiny muted">Free. Use Pathya on any phone and never lose your data.</p>` : mode === "login" ? `<p class="tiny muted">Welcome back. Your data will load on this phone.</p>` : "";
  return `<div class="card" id="auth">${tabs}${sub}${authForm(mode, false)}</div>`;
}

/* ---------- sheets ---------- */
function acctSheet(sh) {
  if (sh.type === "acctAuth") {
    const mode = UI.auth || "signup";
    const title = { signup: "Back up to an account", login: "Log in to your account", reset: "Reset your password" }[mode];
    const a = acctLoad();
    const note = mode === "signup" ? `<p class="tiny muted">Everything on this phone is copied to your new account.</p>` : mode === "login" ? `<p class="tiny muted">${a ? `Log in as ${esc(a.email)} to resume syncing. Changes on this phone are kept.` : "What's on this phone is combined with your account."}</p>` : "";
    return `<h4>${title}</h4>${note}${authForm(mode, true)}${mode !== "reset" ? `<button class="linkbtn" data-act="acctMode" data-v="${mode === "signup" ? "login" : "signup"}">${mode === "signup" ? "I already have an account" : "Create a new account instead"}</button>` : ""}`;
  }
  if (sh.type === "backupKey") return `<h4>Save your backup key</h4><p class="small">If you ever forget your password, this key lets you reset it. Pathya can't show it again.</p>
    <div class="keybox" aria-label="Backup key">${esc(sh.code)}</div>
    <div class="btns"><button class="btn sm" data-act="acctCopyKey">Copy</button><a class="btn sm" href="${waLink("", "My Pathya backup key (keep private): " + sh.code)}" target="_blank" rel="noopener">Send to myself on WhatsApp</a></div>
    <p class="tiny muted">Keep it somewhere private, like your notes app or a WhatsApp chat with yourself.</p>
    <button class="btn primary block" data-act="acctKeySaved">I've saved it</button>`;
  if (sh.type === "acctNewKey") return `<h4>Get a new backup key</h4><p class="tiny muted">Your old key stops working.</p>${fld("Your password", '<input id="a-pass" type="password" autocomplete="current-password">')}<p class="autherr" id="authErr" role="alert"></p><button class="btn primary block" data-act="acctNewKey">Show my new key</button>`;
  if (sh.type === "acctDelete") return `<h4>Delete your account?</h4><div class="note lvl-danger">This permanently erases your account and every health detail, photo and document from Pathya's servers and this phone. It can't be undone.</div><p class="tiny muted">Want a copy first? Use “Download my data”.</p>${fld("Type your password to confirm", '<input id="a-pass" type="password" autocomplete="current-password">')}<p class="autherr" id="authErr" role="alert"></p><button class="btn danger block" data-act="acctDelete">Delete my account</button>`;
  return null;
}

/* ---------- Profile card and banners ---------- */
function accountCard() {
  if (!accountsOn() || S.demo) return "";
  const a = acctLoad();
  if (SYNC.user) {
    const [lvl, label] = SYNC_TXT[SYNC.status] || SYNC_TXT.off;
    return `<div class="card" id="sec-account"><h4>Account</h4><div class="row"><div class="grow"><b class="small">${esc(SYNC.user.email)}</b><div class="tiny ${lvl === "warn" ? "" : "muted"}">${esc(SYNC.msg || label)}${SYNC.status === "synced" && a && a.lastSync ? " · " + ago(a.lastSync) : ""}</div></div><button class="btn sm" data-act="acctSyncNow">Sync now</button></div>
      <div class="tiny muted" style="margin:8px 0">Encrypted and stored in India (Azure, Central India). A copy stays on this phone so Pathya works offline.</div>
      <div class="btns"><button class="btn sm" data-act="acctExport">Download my data</button><button class="btn sm" data-act="acctSheet" data-v="acctNewKey">New backup key</button><button class="btn sm" data-act="acctLogout">Log out</button><button class="btn sm danger" data-act="acctSheet" data-v="acctDelete">Delete my account</button></div>
      <div class="tiny" style="margin-top:8px"><a href="privacy.html" target="_blank" rel="noopener">Privacy notice</a></div></div>`;
  }
  if (a) return `<div class="card" id="sec-account"><h4>Account</h4><div class="note lvl-warn">You were logged out of ${esc(a.email)}. Your changes are safe on this phone. Log in to sync them.</div><div class="btns"><button class="btn sm primary" data-act="acctAuthSheet" data-v="login">Log in</button></div></div>`;
  return `<div class="card" id="sec-account"><h4>Back up your data</h4><p class="small">Right now your data is only on this phone. Create a free account to keep it safe and use Pathya on any phone.</p><div class="btns"><button class="btn sm primary" data-act="acctAuthSheet" data-v="signup">Create account</button><button class="btn sm" data-act="acctAuthSheet" data-v="login">Log in</button></div></div>`;
}
function demoBanner() {
  if (!accountsOn() || !S || !S.demo) return "";
  return `<div class="demobar"><span>👀 You're exploring a sample person (${esc(S.profile.name.split(" ")[0])}). Nothing here is saved.</span><button class="btn sm primary" data-act="acctStartOwn">Create my account</button></div>`;
}
function inactiveView() {
  return `<div class="welcome" style="max-width:520px"><div class="card" style="margin-top:12vh;text-align:center"><div class="row" style="justify-content:center;gap:10px">${LOGO}<span class="brand" style="font-size:22px">Pathya</span></div>
    <h4 style="margin-top:14px">Pathya is open somewhere else</h4><p class="small">${esc(SYNC.inactive)}</p><p class="tiny muted">To keep your data safe, Pathya works in one tab or window at a time.</p>
    <button class="btn primary block" data-act="acctUseHere">Use Pathya here</button></div></div>`;
}
const DROP_WARNING = (from, to) => `This phone has changes for ${from} that haven't been saved to that account yet. Logging in as ${to} will remove them from this phone.\n\nLog in as ${to} anyway?`;

/* ---------- actions ---------- */
const val = id => (document.getElementById(id) || {}).value || "";
async function busy(el, fn) {
  const errEl = document.getElementById("authErr"), label = el.textContent;
  if (errEl) errEl.textContent = "";
  el.disabled = true; el.textContent = "Please wait…";
  try { await fn(); }
  catch (e) { if (errEl) errEl.textContent = e.message; else toast(e.message); el.disabled = false; el.textContent = label; }
}
function profileFromForm() {
  const g = id => document.getElementById(id);
  if (!g("w-name")) return null;
  return { name: g("w-name").value.trim(), age: +g("w-age").value || 35, sex: g("w-sex").value, height: +g("w-h").value || 160, weight: +g("w-w").value || 65, diet: g("w-diet").value, goal: g("w-goal").value };
}
async function acctAction(a, el) {
  switch (a) {
    case "acctMode": UI.authEmail = val("a-email") || UI.authEmail; UI.auth = el.dataset.v; render(); return;
    case "acctOpen": UI.tab = "profile"; UI.sheet = null; UI.scrollTo = "sec-account"; render(false); return;
    case "acctAuthSheet": UI.auth = el.dataset.v; UI.sheet = { type: "acctAuth" }; render(); return;
    case "acctSheet": UI.sheet = { type: el.dataset.v }; render(); return;
    case "acctStartOwn": if (!confirm("Leave the sample person and create your own account?")) return; resetAll(); UI.alert = null; UI.auth = "signup"; render(false); setTimeout(() => document.getElementById("auth")?.scrollIntoView({ block: "start" }), 0); return;
    case "acctKeySaved": UI.sheet = null; render(); return;
    case "acctUseHere": location.reload(); return;
    case "acctCopyKey": navigator.clipboard?.writeText(UI.sheet.code).then(() => toast("Backup key copied")); return;
    case "acctSignup": return busy(el, async () => {
      const email = val("a-email"), pw = val("a-pass"), profile = profileFromForm();
      if (!document.getElementById("a-consent").checked) throw new Error("Please tick the box to agree and continue.");
      if (profile && !profile.name) throw new Error("Please tell us your name.");
      const code = await acctSignup(email, pw, profile);
      UI.authEmail = ""; UI.tab = "today"; UI.sheet = { type: "backupKey", code }; render(false);
    });
    case "acctLogin": return busy(el, async () => {
      const email = val("a-email");
      if (await wouldDropChanges(email) && !confirm(DROP_WARNING(acctLoad().email, normEmail(email)))) throw new Error("Log in as " + acctLoad().email + " to keep those changes.");
      await acctLogin(email, val("a-pass"));
      UI.authEmail = ""; UI.sheet = null; UI.tab = "today"; render(false); toast("Welcome back");
    });
    case "acctReset": return busy(el, async () => {
      const email = val("a-email");
      if (await wouldDropChanges(email) && !confirm(DROP_WARNING(acctLoad().email, normEmail(email)))) throw new Error("Log in as " + acctLoad().email + " to keep those changes.");
      const code = await acctReset(email, val("a-code"), val("a-pass"));
      UI.authEmail = ""; UI.tab = "today"; UI.sheet = { type: "backupKey", code }; render(false); toast("Password changed");
    });
    case "acctNewKey": return busy(el, async () => { const code = await acctNewKey(val("a-pass")); UI.sheet = { type: "backupKey", code }; render(); });
    case "acctDelete": return busy(el, async () => { await acctDelete(val("a-pass")); UI.sheet = null; UI.auth = "signup"; render(false); toast("Your account and all its data have been deleted"); });
    case "acctLogout": {
      if (await unsyncedChanges()) { await syncNow(); }
      if (await unsyncedChanges() && !confirm("Some changes haven't reached your account yet (you may be offline). Log out anyway? Those changes will be lost.")) return;
      await acctLogout(); UI.sheet = null; UI.auth = "login"; render(false); toast("Logged out. Your data is safe in your account.");
      return;
    }
    case "acctSyncNow": await syncNow({ pull: true }); render(); toast(SYNC.status === "synced" ? "All synced" : SYNC.msg || "Couldn't sync"); return;
    case "acctExport": return busy(el, async () => {
      const data = await acctExport(), blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }), u = URL.createObjectURL(blob), l = document.createElement("a");
      l.href = u; l.download = `pathya-account-${TODAY_KEY}.json`; l.click(); URL.revokeObjectURL(u);
      el.disabled = false; el.textContent = "Download my data";
    });
  }
}
