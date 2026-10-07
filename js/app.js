"use strict";
/* Pathya Care — app shell, rendering and interactions. */

const ICON = {
  today: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  care: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M8 12h2l1-2 2 4 1-2h2"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'
};
let R = null;
const LOGO = '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" style="fill:var(--cp-accent)"/><path d="M8.5 23.5c0-8.6 5.6-14 15-14-.9 8.7-6.4 14-15 14z" style="fill:var(--cp-accent-fg)"/><path d="M9 23l9.5-8.5" style="stroke:var(--cp-accent);stroke-width:1.7;fill:none;stroke-linecap:round"/><circle cx="24" cy="23.5" r="2.6" style="fill:var(--cp-turmeric)"/></svg>';
function toast(t) { UI.toast = t; clearTimeout(toast.h); paintToast(); toast.h = setTimeout(() => { UI.toast = null; paintToast(); }, 3200); }
function paintToast() { let el = document.getElementById("toast"); if (!UI.toast) { if (el) el.remove(); return; } if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); } el.textContent = UI.toast; }

function render(keep = true) {
  const app = document.getElementById("app"), y = window.scrollY;
  document.body.classList.toggle("hl", !!UI.hl);
  if (!S) { app.innerHTML = vWelcome(); return; }
  R = buildCare(S);
  const n = R.paths.filter(x => !["goal"].includes(x.kind)).length, openEsc = S.escalations.some(e => e.status === "open" && e.level !== "routine");
  const body = { today: vToday, calendar: vCal, care: vCare, profile: vProfile }[UI.tab](R);
  const TABS = [["today", "Today"], ["calendar", "Calendar"], ["care", "Care"], ["profile", "Profile"]];
  const careList = [...S.conditions.map(c => COND_NAME[c.id] || c.id), ...S.meds.map(m => m.brand || m.generic)].join(", ");
  const chip = `<button class="carechip ${n ? "" : "off"}" data-act="tab" data-v="care" title="${esc(careList || "No conditions or medicines added")}">${n ? `✓ Care on` : "Care off"}</button>`;
  app.innerHTML = `<div class="shell">
    <aside class="side" aria-label="Main navigation"><div class="sbrand">${LOGO}<span class="brand">Pathya</span></div>
      <nav>${TABS.map(([k, l]) => `<button class="snav ${UI.tab === k ? "on" : ""}" data-act="tab" data-v="${k}" ${UI.tab === k ? 'aria-current="page"' : ""}>${ICON[k]}<span>${l}</span>${k === "care" && openEsc ? '<i class="dot"></i>' : ""}</button>${k === "care" ? `<div class="ssub">${CARE_SEGS.map(([c, ic, cl]) => `<button class="${UI.tab === "care" && UI.careSeg === c ? "on" : ""}" data-act="care" data-v="${c}"><span aria-hidden="true">${ic}</span> ${cl}</button>`).join("")}</div>` : ""}`).join("")}</nav>
      <div class="sfoot">${chip}<div class="tiny muted" style="margin-top:10px">Food guidance, not medical advice.<br>Emergency: <a href="tel:112">112</a></div></div></aside>
    <div class="mainwrap"><header class="ahead"><span class="row hbrand" style="gap:8px">${LOGO}<span class="brand">Pathya</span></span><span class="row" style="gap:8px">${chip}<button class="avatar" data-act="tab" data-v="profile" aria-label="Profile">${esc((S.profile.name || "?")[0])}</button></span></header>
    <main class="abody" id="main">${body}</main></div></div>
    <nav class="dock" aria-label="Main navigation">${TABS.map(([k, l]) => `<button data-act="tab" data-v="${k}" class="${UI.tab === k ? "on" : ""}" ${UI.tab === k ? 'aria-current="page"' : ""}>${ICON[k]}${l}${k === "care" && openEsc ? '<span class="dot"></span>' : ""}</button>`).join("")}</nav>
    ${vSheet(R)}`;
  if (UI.hl) document.querySelectorAll("[data-src]").forEach(el => { el.dataset.src = el.dataset.src.split(/\s*\+\s*/).map(srcLabel).join(" + "); });
  window.scrollTo(0, keep ? y : 0);
  if (UI.tab === "care" && UI.careSeg === "chat" && !keep) window.scrollTo(0, document.body.scrollHeight);
  if (UI.scrollTo) { document.getElementById(UI.scrollTo)?.scrollIntoView({ block: "start" }); UI.scrollTo = null; }
}
const commit = (keep = true) => { save(); render(keep); };

/* ---------- safety evaluation of readings (kit red flags) ---------- */
function alertFor(level, title, html, src, actions) { UI.alert = { level, title, html, src, actions: actions || [["dismissAlert", "OK"]] }; }
const HYPO = `<ol class="small" style="margin:6px 0 0;padding-left:18px"><li>Take 15 g fast sugar now: 3 tsp sugar or glucose in water, or 150 ml fruit juice.</li><li>Wait 15 minutes, then check again.</li><li>Still under 70? Repeat once more.</li><li>Back above 70? Eat your next meal or a snack.</li></ol><div class="tiny" style="margin-top:6px">If you can't swallow or feel confused, someone should call 112.</div>`;
function evalReading(r, sym = []) {
  const doc = S.team.doctor.name || "your doctor", R0 = buildCare(S);
  if (r.key === "glucose") {
    if (sym[1]) { alertFor("emergency", "A low that needed help: call 112 / see a doctor urgently", `<div class="small">Don't give food or drink to someone who can't swallow.</div>`, "P_T2D", [["call", "Call 112", "112"], ["dismissAlert", "OK"]]); escalate("emergency", "Severe low needing help", `${r.v || ""} mg/dL`, "P_T2D"); return; }
    if ((r.v && r.v < 70) || sym[0]) { alertFor("urgent", `Low sugar${r.v ? ": " + r.v + " mg/dL" : ""}. Treat it now`, HYPO, "P_T2D", [["hypoOK", "Rechecked: above 70"], ["call", "Call 112", "112"]]); escalate(R0.blocked("meal_skipping") ? "urgent" : "routine", `Low glucose ${r.v || ""} mg/dL on ${nice(r.d)}`, `${r.t}${r.note ? " — " + r.note : ""}. Treated with the 15-15 rule.`, "P_T2D"); return; }
    if (r.v > 300) { alertFor("urgent", `High sugar: ${r.v} mg/dL. Contact ${doc} today`, `<div class="small">Drink water. If you're vomiting, very drowsy or breathing fast, get urgent care.</div>`, "P_T2D", [["dismissAlert", "I've contacted my doctor"], ["mode", "Turn on sick-day mode", "sick"]]); escalate("urgent", `High glucose ${r.v} mg/dL`, "", "P_T2D"); return; }
    return toast(`Saved · ${r.v} mg/dL`);
  }
  if (r.key === "bp") {
    if (sym.some(Boolean)) { alertFor("emergency", `${r.v >= 180 || r.v2 >= 120 ? `Very high BP (${r.v}/${r.v2}) with symptoms` : "Chest pain, breathlessness or confusion"}: call 112 now`, `<ul class="list small"><li>Sit down and stay still</li><li>Don't drive yourself</li><li>Keep your medicine list handy</li></ul>`, "P_HTN", [["call", "Call 112", "112"], ["dismissAlert", "I'm safe"]]); escalate("emergency", `BP ${r.v}/${r.v2} with symptoms`, "", "P_HTN"); return; }
    if (r.v >= 180 || r.v2 >= 120) { alertFor("urgent", `Very high reading: ${r.v}/${r.v2}`, `<div class="small">Rest 5 minutes, then recheck. If it stays this high, contact ${esc(doc)} today.</div>`, "P_HTN"); escalate("urgent", `Very high BP ${r.v}/${r.v2}`, "", "P_HTN"); return; }
    return toast(`Saved · ${r.v}/${r.v2}`);
  }
  if (r.key === "nausea") {
    if (sym[0] || sym[1]) { alertFor("urgent", sym[0] ? "Vomiting and can't keep fluids down: get urgent medical care today" : "Severe stomach pain: get urgent medical care today", `<div class="small">${R0.has("P_GLP1") ? "Tell the doctor you take a GLP-1 medicine and when your dose last changed." : ""}</div>`, R0.has("P_GLP1") ? "P_GLP1" : "M_SICK_DAY", [["mode", "Turn on sick-day mode", "sick"], ["dismissAlert", "Understood"]]); escalate("urgent", sym[0] ? "Vomiting, can't keep fluids down" : "Severe abdominal pain", "", "P_GLP1"); return; }
    if (sym[2]) { escalate("routine", "Hair loss / bruising / weakness", "Reported in side-effects check", "P_GLP1"); return toast(`Added to your questions for ${doc}`); }
    return toast(r.v >= 2 ? "Saved. Gentle foods today: no fried or very high-fibre meals" : "Saved");
  }
  if (METRICS[r.key]?.[2] === "lab") return toast(`Saved for ${doc}. Pathya doesn't interpret lab results.`);
  if (r.key === "weight") { S.profile.weight = r.v; return toast("Weight saved. Targets updated"); }
  toast("Saved");
}

/* ---------- demo moments ---------- */
function scenario(a) {
  const p = S.profile;
  switch (a) {
    case "lowGlucose": evalReading(addReading("glucose", 62, { ctx: "Random", note: "Shaky before lunch" })); UI.tab = "today"; break;
    case "highGlucose": evalReading(addReading("glucose", 320, { ctx: "Random" })); UI.tab = "today"; break;
    case "missLunch": UI.fakeNow = 14 * 60 + 30; (S.logs[TODAY_KEY] || []).splice(0, 99, ...(S.logs[TODAY_KEY] || []).filter(l => l.slot !== "Lunch")); UI.tab = "today"; toast("Clock moved to 2:30 pm"); break;
    case "bpEmergency": evalReading(addReading("bp", 182, { v2: 118 }), [true]); UI.tab = "today"; break;
    case "doseUp": { const m = S.meds.find(x => x.cls === "glp1"); if (m) m.increasedOn = TODAY_KEY; addReading("dose", "7.5 mg", { note: "Dose increased" }); UI.tab = "today"; toast("Dose increase logged. Gentle-food window on for 2 weeks"); break; }
    case "vomit": evalReading(addReading("nausea", 3), [true]); UI.tab = "today"; break;
    case "labK": evalReading(addReading("k", 5.6, { t: "", src: "Lab report" })); UI.tab = "care"; UI.careSeg = "state"; break;
    case "scoff": S.screens.scoff = 2; UI.tab = "today"; toast("Safety path on: calories, weight and deficits are hidden across the app"); break;
    case "sick": S.modes.sick = true; UI.tab = "today"; break;
    case "festival": S.modes.festival = true; S.events.push({ id: uid(), d: TODAY_KEY, kind: "festival", label: "Wedding week" }); UI.tab = "today"; break;
  }
}

/* ---------- files ---------- */
function readFile(file, max = 1100, q = 0.72) {
  return new Promise((res, rej) => {
    if (file.type.startsWith("image/")) {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res({ data: c.toDataURL("image/jpeg", q), mime: "image/jpeg" }); };
      img.onerror = rej; img.src = url;
    } else if (file.size < 1.5e6) { const fr = new FileReader(); fr.onload = () => res({ data: fr.result, mime: file.type || "application/pdf" }); fr.onerror = rej; fr.readAsDataURL(file); }
    else rej(new Error("too large"));
  });
}
document.addEventListener("change", async e => {
  const el = e.target;
  if (el.type === "file" && el.files && el.files[0]) {
    const f = el.files[0];
    try {
      const { data, mime } = await readFile(f, el.id === "chatPhoto" || el.id === "logPhoto" ? 800 : 1100);
      if (el.id === "logPhoto") { UI.logPhotoData = data; render(); }
      else if (el.id === "chatPhoto") { UI.chatImg = data; render(); }
      else if (el.id === "docUpload") { UI.sheet = { type: "docMeta", data, mime, name: f.name.replace(/\.[^.]+$/, "") }; render(); }
      else if (el.id === "importData") { const txt = atob(data.split(",")[1]); S = Object.assign(blankState(), JSON.parse(txt)); commit(false); toast("Data imported"); }
    } catch (err) { toast(err.message === "too large" ? "That file is too large. Try a photo or a PDF under 1.5 MB." : "Couldn't read that file"); }
    return;
  }
  if (el.dataset.bind) {
    const path = el.dataset.bind.split("."); let o = S; for (const k of path.slice(0, -1)) o = o[k];
    let v = el.value; if (el.type === "number") v = v === "" ? null : Number(v); if (v === "true") v = true; if (v === "false") v = false;
    o[path[path.length - 1]] = v; POOL_CACHE.key = null; commit(); return;
  }
  if (el.dataset.act === "alt") { UI.review[+el.dataset.i].code = el.value; render(); return; }
  if (el.dataset.act === "readingKey") { UI.sheet = { type: "track", v: el.value }; render(); return; }
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.id === "draft") {
    UI.draft = el.value;
    const last = el.value.split(/,|\band\b|\n/).pop().trim(), box = document.getElementById("sugg");
    if (box) box.innerHTML = last.length >= 2 ? `<div class="suggest">${searchDishes(last, 5, { diet: R.dietType }).map(d => { const bad = isBlocked(d, R, S); return `<button data-act="suggPick" data-v="${d.code}">${esc(dname(d))} <span class="tiny muted">· ${esc(d.unit)}${bad ? " · ⛔ not for you" : ""}</span></button>`; }).join("")}</div>` : "";
  }
  if (el.id === "medSearch") document.getElementById("medResults").innerHTML = medResults(el.value);
});
document.addEventListener("keydown", e => { if (e.target.id === "chatInput" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } });

function sendChat(textArg) {
  const box = document.getElementById("chatInput"), text = (textArg ?? box?.value ?? "").trim();
  if (!text && !UI.chatImg) return;
  S.chat.push({ id: uid(), role: "me", text: text || "(photo)", img: UI.chatImg || null, d: TODAY_KEY, t: clock(now()) });
  if (UI.chatImg && !text) {
    S.chat.push({ id: uid(), role: "bot", text: "Thanks for the photo. I can't recognise food or read reports from photos yet. What is it?", actions: [["photoMeal", "It's my meal: log it", ""], ["photoDoc", "It's a report or prescription", ""]], d: TODAY_KEY, t: "" });
    UI.pendingPhoto = UI.chatImg;
  } else {
    const r = chatReply(text, R);
    if (UI.chatImg) { r.lines.unshift("I've kept your photo with this message."); }
    S.chat.push({ id: uid(), role: "bot", text: r.lines.join("\n"), actions: r.actions, src: r.src, level: r.level || "", d: TODAY_KEY, t: "" });
    if (r.level === "urgent" || r.level === "emergency") alertFor(r.level, r.lines[0].replace(/\*\*/g, ""), "", "Chat", r.actions.some(a => a[2] === "112") ? [["call", "Call 112", "112"], ["dismissAlert", "OK"]] : [["dismissAlert", "OK"]]);
  }
  UI.chatImg = null; commit(); window.scrollTo(0, document.body.scrollHeight);
}
function openReview(items) { UI.review = items; UI.tab = "today"; render(false); }
function addToReview(code, q = 1) { const it = { raw: DB.byCode[code].short, q, code, alts: [code] }; UI.review = [...(UI.review || []), it]; }

/* ---------- clicks ---------- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (el.classList.contains("sheet-bg") && e.target.closest(".sheet")) return;
  const a = el.dataset.act, v = el.dataset.v, i = el.dataset.i != null ? +el.dataset.i : null;
  if (el.tagName === "A") { if (a === "escSent") { const x = S.escalations.find(z => z.id === v); if (x) x.status = "sent"; save(); setTimeout(render, 50); } return; }
  if (!S && !["demo", "startFresh"].includes(a)) return;
  let keep = true;
  switch (a) {
    case "demo": loadDemo(v); POOL_CACHE.key = null; PLAN_CACHE.key = null; UI.alert = null; keep = false; break;
    case "welcome": if (confirm("Start your own profile? The sample person's data will be cleared from this device.")) { resetAll(); UI.alert = null; } keep = false; break;
    case "startFresh": {
      const g = id => document.getElementById(id);
      if (!g("w-consent").checked) return toast("Please tick the consent box to continue");
      startFresh({ name: g("w-name").value.trim(), age: +g("w-age").value || 35, sex: g("w-sex").value, height: +g("w-h").value || 160, weight: +g("w-w").value || 65, diet: g("w-diet").value, goal: g("w-goal").value });
      keep = false; break;
    }
    case "tab": UI.tab = v; UI.sheet = null; keep = false; break;
    case "care": UI.tab = "care"; UI.careSeg = v; UI.sheet = null; keep = false; break;
    case "profileSec": UI.tab = "profile"; UI.scrollTo = "sec-" + v; keep = false; break;
    case "sheet": UI.sheet = { type: v }; break;
    case "closeSheet": UI.sheet = null; break;
    case "track": UI.sheet = { type: "track", v }; break;
    case "hl": UI.hl = !UI.hl; break;
    case "clock": UI.fakeNow = ((now() + Number(v)) % 1440 + 1440) % 1440; break;
    case "scenario": scenario(v); keep = false; break;
    case "dismissAlert": UI.alert = null; break;
    case "hypoOK": UI.alert = null; toast("Good. This low is in your calendar and your doctor questions."); break;
    case "call": location.href = "tel:" + v; return;
    // logging
    case "review": UI.draft = document.getElementById("draft")?.value ?? UI.draft; if (!UI.draft.trim()) return toast("Type what you ate, e.g. 2 roti and dal"); UI.review = parseMeal(UI.draft, { diet: R.dietType }); break;
    case "suggPick": { const parts = UI.draft.split(/,|\band\b|\n/); parts[parts.length - 1] = " " + DB.byCode[v].short.toLowerCase(); UI.draft = parts.join(",").replace(/^,\s*/, "").trim() + ", "; render(); setTimeout(() => { const d = document.getElementById("draft"); d?.focus(); d?.setSelectionRange(d.value.length, d.value.length); }, 0); return; }
    case "addRecent": addToReview(v); break;
    case "logPlanned": { const m = planWeek(S, R)[0].meals.find(x => x.slot === v); if (m) UI.review = m.items.map(([c, q]) => ({ raw: DB.byCode[c].short, q, code: c, alts: [c] })); break; }
    case "logYesterday": { const l = (S.logs[dOff(1)] || []).find(x => x.slot === v); if (l) UI.review = l.items.map(([c, q]) => ({ raw: DB.byCode[c]?.short || c, q, code: c, alts: [c] })); break; }
    case "setupNone": S.setup[v] = true; break;
    case "allTargets": UI.allTargets = !UI.allTargets; break;
    case "quickLog": addToReview(v); UI.tab = "today"; keep = false; break;
    case "focusLog": UI.tab = "today"; render(false); document.getElementById("draft")?.focus(); return;
    case "logFor": UI.logDate = v; UI.tab = "today"; keep = false; break;
    case "qty": { const it = UI.review[i], d = DB.byCode[it.code], step = /bowl|plate|glass|cup|katori/.test(d.unit) ? 0.5 : 1; it.q = Math.max(0.5, it.q + step * Number(v)); break; }
    case "swap": UI.review[i].code = v; UI.review[i].q = 1; UI.review[i].alts = [v]; toast(`Swapped to ${DB.byCode[v].short}`); break;
    case "rmItem": UI.review.splice(i, 1); if (!UI.review.length) UI.review = null; break;
    case "cancelReview": UI.review = null; UI.logPhotoData = null; break;
    case "saveMeal": {
      const items = UI.review.filter(x => x.code).map(x => [x.code, x.q]); if (!items.length) return;
      const d = UI.logDate || TODAY_KEY; addLog(items, { d, mins: d === TODAY_KEY ? now() : 780, photo: UI.logPhotoData });
      const slot = slotAt(now()); UI.review = null; UI.draft = ""; UI.logPhotoData = null; UI.logDate = null;
      toast(`${slot} saved${(R.has("P_T2D") || R.has("P_T1D")) ? ` · check glucose around ${clock(now() + 120)}` : ""}`); keep = false; break;
    }
    case "delLog": for (const k of Object.keys(S.logs)) S.logs[k] = S.logs[k].filter(l => l.id !== v); break;
    case "fluid": tasksOf(TODAY_KEY).fluids++; break;
    case "medTaken": { const tk = tasksOf(TODAY_KEY); if (tk.meds[v]) delete tk.meds[v]; else { tk.meds[v] = clock(now()); const m = S.meds.find(x => x.id === v.split(":")[0]); if (m && m.freq === "Once a week") addReading("dose", `${m.dose || ""} ${m.unit || ""}`.trim()); } break; }
    case "logStrength": addReading("strength", 30); toast("Strength session logged"); break;
    case "askDoc": escalate("routine", v, "", "You").question = v; toast(`Added to your questions for ${S.team.doctor.name || "your doctor"}`); break;
    // care: state
    case "condPick": UI.sheet.sel = v; break;
    case "condAdd": { const id = UI.sheet.sel; S.conditions.push({ id, since: document.getElementById("c-since").value || "", confirmed: document.getElementById("c-conf").value === "1" }); UI.sheet = null; POOL_CACHE.key = null; toast(`${COND_NAME[id]} added. Every tab has adapted`); break; }
    case "condConfirm": S.conditions[i].confirmed = !S.conditions[i].confirmed; break;
    case "condDel": S.conditions.splice(i, 1); POOL_CACHE.key = null; break;
    case "medPick": UI.sheet = { type: "addMed", med: { brand: el.dataset.b, generic: el.dataset.g, cls: el.dataset.c, freq: "Once a day", timing: "Morning", unit: "mg", duration: "Ongoing" } }; break;
    case "editMed": UI.sheet = { type: "addMed", med: { ...S.meds.find(m => m.id === v) } }; break;
    case "medSave": {
      const m = UI.sheet.med, g = id => document.getElementById(id)?.value;
      Object.assign(m, { brand: g("m-brand"), dose: g("m-dose") ? +g("m-dose") : null, unit: g("m-unit"), freq: g("m-freq"), timing: g("m-timing"), start: g("m-start"), duration: g("m-dur"), confirmed: document.getElementById("m-ok").checked });
      if (m.duration === "Until") m.until = g("m-until"); if (m.duration === "Course") m.days = +g("m-until") || null;
      if (document.getElementById("m-inc")) m.increasedOn = g("m-inc") || null;
      if (!m.id) { m.id = uid(); S.meds.push(m); } else S.meds[S.meds.findIndex(x => x.id === m.id)] = m;
      UI.sheet = null; POOL_CACHE.key = null; toast(`${m.brand || m.generic} saved${m.cls ? ". Food rules applied" : ""}`); break;
    }
    case "medDel": S.meds = S.meds.filter(m => m.id !== v); POOL_CACHE.key = null; break;
    case "doseChanged": { const m = S.meds.find(x => x.id === v); m.increasedOn = TODAY_KEY; toast("Noted. Gentle-food window on for 2 weeks"); break; }
    case "readingSave": {
      const g = id => document.getElementById(id), key = v, raw = g("r-v")?.value;
      const val = ["symptom", "period"].includes(key) ? 1 : raw === "" || raw == null ? null : Number(raw);
      if (val == null || isNaN(val)) return toast("Enter a value");
      const r = addReading(key, val, { d: g("r-d")?.value || TODAY_KEY, t: g("r-d")?.value && g("r-d").value !== TODAY_KEY ? "" : clock(now()), ctx: g("r-ctx")?.value, note: g("r-note")?.value || "", v2: key === "bp" ? Number(g("r-v2")?.value) : undefined, src: METRICS[key]?.[2] === "lab" ? "Entered by you" : undefined });
      const sym = [0, 1, 2].map(n => !!g("r-s" + n)?.checked);
      UI.sheet = null; evalReading(r, sym); keep = false; UI.tab = UI.alert && UI.alert.level !== "routine" ? "today" : UI.tab; break;
    }
    case "limitSave": { const g = id => document.getElementById(id).value; if (!+g("l-v")) return toast("Enter a value"); S.limits[g("l-k")] = { v: +g("l-v"), by: g("l-by"), date: g("l-d") }; UI.sheet = null; POOL_CACHE.key = null; toast("Limit saved. It now overrides other targets"); break; }
    case "limitDel": delete S.limits[v]; POOL_CACHE.key = null; break;
    case "screen": UI.sheet = { type: "screen", v }; break;
    case "screenSave": {
      const s = DB.screeners[v]; let score = 0; s.items.forEach((_, n) => score += Number(document.getElementById("q-" + n).value)); S.screens[v] = score; UI.sheet = null;
      if (v === "scoff" && score >= 2) toast("Thank you for answering. We've switched off calories and weight features to keep things safe.");
      else if (v === "phq2" && score >= 3) { alertFor("info", "Thank you for telling me", `<div class="small">It might help to talk to ${esc(S.team.doctor.name || "a doctor")} or a counsellor. Tele-MANAS is free and 24×7: <b>14416</b>.</div>`, "screeners.phq2", [["call", "Call 14416", "14416"], ["dismissAlert", "OK"]]); UI.tab = "today"; }
      else if (v === "idrs" && score >= 60) { alertFor("info", `Diabetes risk score ${score}: high`, `<div class="small">Ask ${esc(S.team.doctor.name || "your doctor")} about a glucose test. Pathya has turned on the prediabetes food pattern.</div>`, "screeners.idrs"); escalate("routine", `IDRS ${score}: ask about a glucose test`, "", "screeners.idrs"); UI.tab = "today"; }
      else toast(`Score ${score}. Saved`);
      POOL_CACHE.key = null; keep = false; break;
    }
    case "docSave": { const g = id => document.getElementById(id).value; S.docs.unshift({ id: uid(), type: g("d-type"), d: g("d-date"), title: g("d-title"), note: g("d-note"), data: UI.sheet.data, mime: UI.sheet.mime }); UI.sheet = null; toast("Saved to your Medical report"); break; }
    case "docView": UI.sheet = { type: "docView", v }; break;
    case "docDel": if (confirm("Delete this document from this device?")) S.docs = S.docs.filter(d => d.id !== v); break;
    // care: plan & day
    case "planDay": UI.planDay = +v; break;
    case "planSwap": S.planSwaps[v] = (S.planSwaps[v] || 0) + 1; break;
    case "planNew": S.planSeed++; S.planSwaps = {}; toast("New week generated"); break;
    case "planLog": { const day = planWeek(S, R)[0]; UI.review = day.meals[+v].items.map(([c, q]) => ({ raw: DB.byCode[c].short, q, code: c, alts: [c] })); UI.tab = "today"; keep = false; break; }
    case "printPlan": document.getElementById("print-area").innerHTML = printHTML(R, "plan"); window.print(); return;
    case "mode": S.modes[v] = !S.modes[v]; POOL_CACHE.key = null; if (v === "sick" && S.modes.sick) { S.events.push({ id: uid(), d: TODAY_KEY, kind: "sick", label: "Sick day" }); if (UI.alert && UI.alert.level !== "emergency") UI.alert = null; } break;
    case "gateOK": S.gatesOK[v] = { by: S.team.doctor.name || "Doctor", d: TODAY_KEY }; if (v === "fasting_mode") S.modes.fasting = true; POOL_CACHE.key = null; toast("Doctor's OK recorded with who and when"); break;
    case "goalPick": { const f = weekFindings(R).f.find(x => x.id === v); if (f && !S.goals.some(g => g.id === v && !g.done)) S.goals.push({ ...f, since: new Date().toISOString() }); break; }
    case "goalDone": { const g = S.goals.find(x => x.id === v && !x.done); if (g) g.done = TODAY_KEY; toast("Nice work 🎉"); break; }
    case "shareCook": window.open(waLink("", "Cook sheet for " + S.profile.name + ":\n" + cookLines(R, S).map(([en, hi]) => `• ${en}\n  ${hi}`).join("\n")), "_blank"); return;
    case "shareGrocery": window.open(waLink("", "Grocery list (Pathya):\n" + groceryList(planWeek(S, R)).map(([n]) => "• " + n).join("\n")), "_blank"); return;
    // chat
    case "chatSend": sendChat(); return;
    case "chatQuick": sendChat(v); return;
    case "chatImgClear": UI.chatImg = null; break;
    case "chatAct": {
      const ca = el.dataset.a;
      if (ca === "call") { location.href = "tel:" + v; return; }
      if (ca === "call-doc") { if (S.team.doctor.phone) location.href = "tel:" + S.team.doctor.phone; else { UI.tab = "profile"; UI.scrollTo = "sec-team"; } return; }
      if (ca === "ask-doc") { escalate("routine", v.slice(0, 90), "", "Chat").question = v; toast(`Added to your questions for ${S.team.doctor.name || "your doctor"}`); }
      if (ca === "mode") { S.modes[v] = true; POOL_CACHE.key = null; toast("Sick-day mode on"); }
      if (ca === "tab") { UI.tab = v; keep = false; }
      if (ca === "care") { UI.careSeg = v; keep = false; }
      if (ca === "log-dish") { addToReview(v); UI.tab = "today"; keep = false; }
      if (ca === "photoMeal") { UI.logPhotoData = UI.pendingPhoto; UI.tab = "today"; keep = false; }
      if (ca === "photoDoc") { UI.sheet = { type: "docMeta", data: UI.pendingPhoto, mime: "image/jpeg", name: "Photo from chat" }; }
      break;
    }
    // report & escalation
    case "printReport": document.getElementById("print-area").innerHTML = printHTML(R, "report"); window.print(); return;
    case "waReport": window.open(waLink(S.team.doctor.phone || "", reportText(R)), "_blank"); return;
    case "copyReport": navigator.clipboard?.writeText(reportText(R)).then(() => toast("Summary copied")); return;
    case "askSave": { const t = document.getElementById("askText").value.trim(); if (!t) return; escalate("routine", t.slice(0, 90), "", "You").question = t; toast("Added to your questions"); break; }
    case "escResolve": { const x = S.escalations.find(z => z.id === v); if (x) x.status = "resolved"; break; }
    // profile
    case "setGoal": S.profile.goal = v; POOL_CACHE.key = null; break;
    case "allergy": { const al = S.profile.allergies, x = al.find(y => y.item === v); if (!x) al.push({ item: v, severity: "mild" }); else if (x.severity !== "severe") x.severity = "severe"; else S.profile.allergies = al.filter(y => y.item !== v); POOL_CACHE.key = null; break; }
    case "jainOpt": { const j = S.profile.jainDetail = S.profile.jainDetail || []; const k = j.indexOf(v); k >= 0 ? j.splice(k, 1) : j.push(v); POOL_CACHE.key = null; break; }
    case "toggle": { const path = v.split("."); let o = S; for (const k of path.slice(0, -1)) o = o[k]; o[path[path.length - 1]] = !o[path[path.length - 1]]; break; }
    case "exportData": { const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }), u = URL.createObjectURL(blob), l = document.createElement("a"); l.href = u; l.download = `pathya-care-${TODAY_KEY}.json`; l.click(); URL.revokeObjectURL(u); return; }
    case "deleteAll": if (confirm("Delete all your Pathya data from this device? This can't be undone.")) { resetAll(); UI.alert = null; keep = false; } else return; break;
    case "calday": UI.calSel = v || null; break;
    case "calf": UI.calFilters[v] = UI.calFilters[v] === false; break;
    case "calNav": { const b = UI.calMonth ? parseKey(UI.calMonth) : new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); b.setMonth(b.getMonth() + Number(v)); UI.calMonth = dkey(b); UI.calSel = null; break; }
    default: return;
  }
  commit(keep);
});

/* ---------- boot ---------- */
(() => {
  const param = new URLSearchParams(location.search);
  const theme = param.get("scoutTheme") || param.get("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  load();
  const want = param.get("demo");
  if (want && DEMOS[want] && (!S || (S.demo && S.demo !== want))) loadDemo(want);
  if (want && history.replaceState) { param.delete("demo"); history.replaceState(null, "", location.pathname + (param.toString() ? "?" + param : "") + location.hash); }
  if (S && param.get("tab")) UI.tab = param.get("tab");
  render(false);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
