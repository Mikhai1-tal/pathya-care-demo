"use strict";
/* Pathya Care — accounts and cloud sync.
   Offline-first: the phone keeps a full copy and syncs in the background. Concurrent edits from two phones
   are combined with a 3-way merge (items with an id are merged one by one). Photos and documents travel
   separately as content-addressed blobs ("pblob:<sha256>"), so each file is uploaded only once. */

const ACCT_KEY = "pathya-care-acct", LOGOUT_KEY = "pathya-care-logout";
const SYNC = { api: null, user: null, status: "off", msg: "", busy: false, again: false, timer: null, needRender: false, inactive: false };
const BLOB_PREFIXES = ["data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,", "data:application/pdf;base64,"];
const HASHES = new Map();

const acctLoad = () => { try { return JSON.parse(localStorage.getItem(ACCT_KEY)) || null; } catch (e) { return null; } };
const acctSave = a => a ? localStorage.setItem(ACCT_KEY, JSON.stringify(a)) : localStorage.removeItem(ACCT_KEY);
// The synced version and merge base live in LOCAL (js/store.js) and are saved together with the data itself.

/* ---------- API ---------- */
// `who` names the account a data call is for; the server refuses it if this browser is now signed in as someone else.
async function api(method, path, body, who) {
  const opt = { method, headers: { "X-Pathya": "1" }, credentials: "same-origin", cache: "no-store" };
  if (who) opt.headers["X-Pathya-Account"] = encodeURIComponent(who);   // header values must be ASCII; emails need not be
  if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  let r;
  try { r = await fetch("api/" + path, opt); } catch (e) { const err = new Error("You're offline. Your changes are saved on this phone."); err.offline = true; throw err; }
  let data = null;
  try { data = await r.json(); } catch (e) { /* empty body */ }
  if (!r.ok) {
    const d = data && data.detail, err = new Error(typeof d === "string" ? d : r.status >= 500 ? "Pathya's server had a problem. Please try again." : "Something went wrong.");
    err.status = r.status; err.data = typeof d === "object" ? d : null; throw err;
  }
  return data;
}
async function detectApi() {
  if (!/^https?:$/.test(location.protocol)) return (SYNC.api = false);
  if (typeof document !== "undefined" && document.querySelector('meta[name="pathya-mode"][content="local"]')) return (SYNC.api = false);   // static demo build
  try {
    const ctl = typeof AbortController === "function" ? new AbortController() : null, t = setTimeout(() => ctl && ctl.abort(), 6000);
    const r = await fetch("api/health", { cache: "no-store", signal: ctl ? ctl.signal : undefined }); clearTimeout(t);
    SYNC.api = r.ok && (await r.json()).accounts === true;
  } catch (e) { SYNC.api = !!acctLoad(); }
  return SYNC.api;
}

/* ---------- comparing and merging ---------- */
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
function stable(v) { return JSON.stringify(v, (k, x) => isObj(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x); }
const same = (a, b) => a === b || stable(a) === stable(b);
const hasId = x => isObj(x) && (typeof x.id === "string" || typeof x.id === "number");
const idArray = a => Array.isArray(a) && a.length > 0 && a.every(hasId);
const okForIds = a => a === undefined || (Array.isArray(a) && a.every(hasId));

function merge3(b, l, s, preferServer = false) {
  if (same(l, s)) return l;
  if (b !== undefined && same(b, l)) return s;
  if (b !== undefined && same(b, s)) return l;
  if (Array.isArray(l) && Array.isArray(s) && [b, l, s].some(idArray) && [b, l, s].every(okForIds)) return mergeById(b, l, s, preferServer);
  if (isObj(l) && isObj(s)) return mergeObj(b, l, s, preferServer);
  return preferServer ? s : l;
}
function mergeObj(b, l, s, preferServer) {
  const B = isObj(b) ? b : {}, out = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(s)])) {
    const inL = k in l, inS = k in s, inB = k in B;
    if (inL && inS) out[k] = merge3(inB ? B[k] : undefined, l[k], s[k], preferServer);
    else if (inL) { if (!inB || !same(B[k], l[k])) out[k] = l[k]; }      // else: deleted on the other phone
    else if (!inB || !same(B[k], s[k])) out[k] = s[k];                   // else: deleted on this phone
  }
  return out;
}
function mergeById(b, l, s, preferServer) {
  const key = x => String(x.id), map = a => new Map((a || []).map(x => [key(x), x]));
  const bm = map(b), lm = map(l), sm = map(s), keep = new Map();
  for (const id of new Set([...lm.keys(), ...sm.keys()])) {
    const inB = bm.has(id), inL = lm.has(id), inS = sm.has(id);
    if (inL && inS) keep.set(id, merge3(inB ? bm.get(id) : undefined, lm.get(id), sm.get(id), preferServer));
    else if (inL) { if (!inB || !same(bm.get(id), lm.get(id))) keep.set(id, lm.get(id)); }
    else if (!inB || !same(bm.get(id), sm.get(id))) keep.set(id, sm.get(id));
  }
  // Keep this phone's order, and slot items that only the server has in after their server-side neighbour.
  const out = l.map(key).filter(id => keep.has(id));
  let prev = null;
  for (const id of s.map(key)) {
    if (keep.has(id) && !out.includes(id)) out.splice(prev == null ? 0 : out.indexOf(prev) + 1, 0, id);
    if (out.includes(id)) prev = id;
  }
  return out.map(id => keep.get(id));
}

/* ---------- photos and documents as blobs ---------- */
async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, "0")).join("");
}
const isBlobData = v => typeof v === "string" && v.length > 1024 && v.length <= 3e6 && BLOB_PREFIXES.some(p => v.startsWith(p));
function walk(v, fn) {
  if (typeof v === "string") return fn(v);
  if (Array.isArray(v)) return v.map(x => walk(x, fn));
  if (isObj(v)) { const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k], fn); return o; }
  return v;
}
async function externalize(state) {
  const found = [];
  walk(state, v => { if (isBlobData(v) && !HASHES.has(v)) found.push(v); return v; });
  for (const v of found) HASHES.set(v, await sha256hex(v));
  const blobs = {};
  const out = walk(state, v => { if (!isBlobData(v)) return v; const h = HASHES.get(v); blobs[h] = v; return "pblob:" + h; });
  return { state: out, blobs };
}
const REF_RX = /^pblob:[0-9a-f]{64}$/;
async function fetchBlobs(state, known, who) {
  const need = new Set();
  walk(state, v => { if (REF_RX.test(v) && !known[v.slice(6)]) need.add(v.slice(6)); return v; });
  for (const h of need) {
    try { const r = await api("GET", "blobs/" + h, undefined, who); if (r && typeof r.data === "string") { known[h] = r.data; HASHES.set(r.data, h); } }
    catch (e) { if (e.offline || e.status === 401 || e.status === 412) break; }   // stays a reference; fetched on a later sync
  }
  return known;
}
const replaceRefs = (state, known) => walk(state, v => REF_RX.test(v) && known[v.slice(6)] ? known[v.slice(6)] : v);
async function internalize(state, known, who) { return replaceRefs(state, await fetchBlobs(state, known, who)); }

/* ---------- one active tab ----------
   All tabs and the installed app share one login cookie and one copy of the data. Only the most recently opened
   one works; the others show a notice, never write data and never sync, so two tabs can't overwrite each other. */
const TAB_KEY = "pathya-care-tab", TAB_ID = Math.random().toString(36).slice(2);
function claimTab() { try { localStorage.setItem(TAB_KEY, TAB_ID + ":" + Date.now()); } catch (e) { /* storage unavailable */ } }
function goInactive(msg) {
  if (SYNC.inactive) return;
  SYNC.inactive = msg || "Pathya is open in another tab or window.";
  clearTimeout(SYNC.timer); clearTimeout(saveTimer); saveTimer = null;
  if (typeof render === "function" && typeof document !== "undefined") render();
}

/* ---------- the sync loop ---------- */
const syncable = () => !!(SYNC.user && S && !S.demo && !SYNC.inactive);
const stale = (who, startS) => !SYNC.user || SYNC.user.email !== who || S !== startS || !S || S.demo || !!SYNC.inactive;
function setStatus(st, msg = "") {
  SYNC.status = st; SYNC.msg = msg;
  if (st === "synced") { const a = acctLoad(); if (a) { a.lastSync = Date.now(); acctSave(a); } }
  if (typeof document !== "undefined") document.querySelectorAll(".syncb").forEach(el => { el.outerHTML = syncBadge(); });
}
function syncSoon(ms = 1500) {
  if (!syncable()) return;
  clearTimeout(SYNC.timer); SYNC.timer = setTimeout(() => syncNow(), ms);
  if (SYNC.status !== "syncing") setStatus(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "pending");
}
async function uploadBlobs(ids, blobs, who) {
  const a = acctLoad() || {}, up = new Set(a.up || []), errors = [];
  for (const h of ids) {
    if (up.has(h) || !blobs[h]) continue;
    try { await api("PUT", "blobs/" + h, { data: blobs[h] }, who); up.add(h); }
    catch (e) { if (e.offline || [401, 412, 507].includes(e.status) || e.status >= 500) throw e; errors.push(e.message); }   // one bad file mustn't block sync
  }
  const fresh = acctLoad();
  if (fresh && fresh.email === who) { fresh.up = [...up].slice(-3000); acctSave(fresh); }
  return errors;
}
const refsIn = st => [...new Set((JSON.stringify(st).match(/pblob:[0-9a-f]{64}/g) || []).map(x => x.slice(6)))];

async function syncNow(opts = {}) {
  if (!syncable()) return;
  if (SYNC.busy) { SYNC.again = true; return; }
  SYNC.busy = true; clearTimeout(SYNC.timer); setStatus("syncing");
  const who = SYNC.user.email;
  let blobErrors = [];
  try {
    await healBlobs(who);
    let server = null, pull = !!opts.pull || !LOCAL.version;
    for (let round = 0; round < 5; round++) {
      const acct = acctLoad() || {}, base = LOCAL.base, haveVersion = LOCAL.version, startS = S, startJSON = JSON.stringify(S);
      if (acct.email !== who) { goInactive("You logged out or switched accounts in another window. Reload to continue here."); return; }
      const { state: local, blobs } = await externalize(S);
      if (pull && !server) {
        const r = await api("GET", "state" + (haveVersion ? "?have=" + haveVersion : ""), undefined, who);
        if (!r.unchanged) server = r;
      }
      let target = local, baseVersion = haveVersion || 0;
      if (server) {
        baseVersion = server.version;
        if (server.state) target = merge3(haveVersion && base ? base : undefined, local, server.state, !haveVersion);
      }
      const upToDate = server && server.state ? same(target, server.state) : (!server && base && same(local, base));
      let version = baseVersion;
      if (!upToDate) {
        blobErrors = await uploadBlobs(refsIn(target), blobs, who);
        try {
          const res = await api("PUT", "state", { base: baseVersion, state: target }, who);
          version = res.version;
          if (res.missing && res.missing.length) { const a2 = acctLoad(); if (a2) { a2.up = (a2.up || []).filter(h => !res.missing.includes(h)); acctSave(a2); } blobErrors = blobErrors.concat(await uploadBlobs(res.missing, blobs, who)); }
        } catch (e) {
          if (e.status === 409 && e.data) { server = e.data; pull = true; continue; }
          throw e;
        }
      }
      if (stale(who, startS)) return;   // logged out, switched account or tab, or opened a sample meanwhile
      if (!(await adopt(target, version, local, blobs, startJSON, who, startS)) && !stale(who, startS)) SYNC.again = true;
      break;
    }
    if (stale(who, S)) return;
    if (blobErrors.length) setStatus("error", "Some photos couldn't be saved to your account: " + blobErrors[0]);
    else if (LOCAL.failed) setStatus("error", "Saved to your account, but this phone's storage is full. Free up space so Pathya works offline.");
    else setStatus("synced");
  } catch (e) {
    if (e.status === 401) { SYNC.user = null; setStatus("signedout", "Please log in again to keep your data in sync."); }
    else if (e.status === 412) goInactive("You signed in to a different account in another window. Reload to continue here.");
    else setStatus(e.offline ? "offline" : "error", e.message);
  } finally {
    SYNC.busy = false;
    if (SYNC.again) { SYNC.again = false; syncSoon(300); }
  }
}
/* Take the merged result. Downloads happen first; the final check and the swap run with no await in between,
   so nothing the person does meanwhile (a new reading, logging out) can be overwritten. */
async function adopt(target, version, pushedLocal, blobs, startJSON, who, startS) {
  const known = Object.assign({}, blobs);
  for (let i = 0; i < 6; i++) {
    const snapJSON = JSON.stringify(S), edited = snapJSON !== startJSON;
    let next = target;
    if (edited) { const cur = await externalize(S); Object.assign(known, cur.blobs); next = merge3(pushedLocal, cur.state, target); }
    if (edited || !same(target, pushedLocal)) await fetchBlobs(next, known, who);
    // ---- no awaits below this line ----
    if (stale(who, startS)) return false;
    if (JSON.stringify(S) !== snapJSON) continue;         // changed while we were downloading: merge again
    // version, base and data change together in memory and are saved together, so the phone never thinks it
    // is further along than what it actually stored
    LOCAL.version = version; LOCAL.base = target;
    if (!edited && same(target, pushedLocal)) { persist(); return true; }
    S = Object.assign(blankState(), replaceRefs(next, known));
    if (edited) SYNC.again = true;                         // push the edits made during this sync
    if (typeof POOL_CACHE !== "undefined") { POOL_CACHE.key = null; PLAN_CACHE.key = null; }
    persist();
    safeRender();
    return true;
  }
  return false;   // very busy: leave everything as it is; the next sync merges again
}
function safeRender() {
  if (typeof render !== "function" || typeof document === "undefined") return;
  const el = document.activeElement;
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.closest("#app")) { SYNC.needRender = true; return; }
  render();
}

/* ---------- account actions ---------- */
const normEmail = e => String(e || "").trim().toLowerCase();
function startAccount(user) { SYNC.user = user; acctSave({ email: user.email, up: [] }); LOCAL.base = null; LOCAL.version = 0; HASHES.clear(); localStorage.removeItem(LOGOUT_KEY); }
/* Photos that couldn't be downloaded earlier (e.g. a patchy connection) are retried on every sync. */
async function healBlobs(who) {
  if (!S || !refsIn(S).length) return;
  const startS = S, snap = JSON.stringify(S), known = await fetchBlobs(S, {}, who);
  if (!Object.keys(known).length || stale(who, startS) || JSON.stringify(S) !== snap) return;
  S = Object.assign(blankState(), replaceRefs(S, known));
  persist(); safeRender();
}
async function acctSignup(email, password, profile) {
  const r = await api("POST", "auth/signup", { email, password, consent: true });
  if (S && S.demo) resetAll();
  startAccount(r.user);
  if (profile) startFresh(profile);
  await syncNow();
  return r.recovery_code;
}
async function enterAccount(user) {
  const prev = acctLoad();
  localStorage.removeItem(LOGOUT_KEY);
  if (prev && prev.email === user.email && S && !S.demo) { SYNC.user = user; return syncNow({ pull: true }); }  // same account again: keep the merge base
  if (S && (S.demo || prev)) resetAll();          // a sample person, or another account's data (the UI asks first if unsynced)
  startAccount(user);
  if (S) return syncNow({ pull: true });           // data entered on this phone before signing in: combine it
  const r = await api("GET", "state", undefined, user.email);
  if (!r.state) return;
  const known = await fetchBlobs(r.state, {}, user.email);
  if (!SYNC.user || SYNC.user.email !== user.email || S || SYNC.inactive) return;   // logged out, switched or opened a sample meanwhile
  S = Object.assign(blankState(), replaceRefs(r.state, known));
  LOCAL.version = r.version; LOCAL.base = r.state;
  persist();
  setStatus("synced");
}
async function acctLogin(email, password) { const r = await api("POST", "auth/login", { email, password }); await enterAccount(r.user); }
async function acctReset(email, code, password) { const r = await api("POST", "auth/reset", { email, recovery_code: code, new_password: password }); await enterAccount(r.user); return r.recovery_code; }
async function acctNewKey(password) { return (await api("POST", "auth/recovery", { password }, SYNC.user && SYNC.user.email)).recovery_code; }
async function unsyncedChanges() {
  if (!S || S.demo || !acctLoad()) return false;
  const base = LOCAL.base;
  return !base || !same((await externalize(S)).state, base);
}
/** True if logging in as `email` would remove another account's unsynced changes from this phone. */
async function wouldDropChanges(email) {
  const prev = acctLoad();
  return !!(prev && prev.email !== normEmail(email) && (await unsyncedChanges()));
}
function clearDevice() { SYNC.user = null; acctSave(null); HASHES.clear(); resetAll(); SYNC.status = "off"; }
async function acctLogout() {
  try { await api("POST", "auth/logout"); }
  catch (e) { localStorage.setItem(LOGOUT_KEY, "1"); }   // offline: finish logging out on the next visit
  clearDevice();
}
async function acctDelete(password) { await api("DELETE", "account", { password }, SYNC.user && SYNC.user.email); clearDevice(); }
async function acctExport() { return api("GET", "account/export", undefined, SYNC.user && SYNC.user.email); }

/** Read a file from "Export a copy" or "Download my data". Returns the state to load, or throws a friendly error. */
function parseImport(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { throw new Error("That file isn't a Pathya export."); }
  let st = obj;
  if (obj && obj.format === "pathya-account-export") st = obj.state ? replaceRefs(obj.state, obj.files || {}) : null;
  if (!isObj(st) || !isObj(st.profile) || (st.v !== undefined && st.v !== 1) || !Array.isArray(st.conditions || []) || !isObj(st.logs || {}))
    throw new Error("That file isn't a Pathya export.");
  return st;
}

async function acctBoot() {
  if (!(await detectApi())) return;
  if (localStorage.getItem(LOGOUT_KEY)) {
    try { await api("POST", "auth/logout"); localStorage.removeItem(LOGOUT_KEY); } catch (e) { /* try again next time */ }
    return;
  }
  const acct = acctLoad();
  try {
    const r = await api("GET", "auth/me");
    if (!r.user) { SYNC.user = null; if (acct && S) setStatus("signedout", "Please log in again to keep your data in sync."); return; }
    if (acct && acct.email !== r.user.email && S && !S.demo && (await unsyncedChanges())) {
      SYNC.user = null;   // never silently discard someone's unsynced changes
      setStatus("signedout", `This phone has changes for ${acct.email} that haven't synced. Log in as ${acct.email} to save them.`);
      return;
    }
    if (!acct || acct.email !== r.user.email) await enterAccount(r.user);
    else { SYNC.user = r.user; if (S && !S.demo) await syncNow({ pull: true }); else if (!S) await enterAccount(r.user); }
  } catch (e) {
    if (e.status === 401) { SYNC.user = null; if (acct && S) setStatus("signedout", "Please log in again to keep your data in sync."); }
    else if (acct) { SYNC.user = { email: acct.email }; setStatus("offline", e.message); }
  }
}
if (typeof document !== "undefined" && typeof addEventListener === "function") {
  addEventListener("storage", e => { if (e.key === TAB_KEY && e.newValue && !e.newValue.startsWith(TAB_ID + ":")) goInactive(); });
  addEventListener("online", () => syncNow({ pull: true }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow({ pull: true }); });
  document.addEventListener("focusout", () => setTimeout(() => {
    if (SYNC.needRender && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "")) { SYNC.needRender = false; render(); }
  }, 0));
  setInterval(() => { if (document.visibilityState === "visible") syncNow({ pull: true }); }, 180000);
}
