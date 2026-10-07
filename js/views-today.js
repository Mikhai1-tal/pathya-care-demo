"use strict";
/* Pathya Care — Today (log + targets in one place) and Calendar. */

const TKEY = { energy_kcal: "kcal", protein_g: "p", carb_g: "c", fibre_g: "fib", sodium_mg: "na", potassium_mg: "k", phosphorus_mg: "ph", added_sugar_g: "asug", added_fat_g: "afat", calcium_mg: "ca", iron_mg: "fe", vitb12_ug: "b12", sfa_g: "sfa" };
const careSrc = t => (t.src || []).filter(s => s && !["GOAL", "P_WEIGHT_LOSS", "P_HEALTHY_EATING", "P_MUSCLE_GAIN", "P_WEIGHT_GAIN"].includes(s));
const tasksOf = d => (S.tasks[d] = S.tasks[d] || { fluids: 0, meds: {}, done: {} });
const tasksView = d => S.tasks[d] || { fluids: 0, meds: {}, done: {} };   // read-only: drawing a screen must not change saved data
const trackers = R => {
  const t = new Set(["weight"]);
  if (R.has("P_T2D") || R.has("P_T1D") || R.has("P_PREDIABETES")) t.add("glucose");
  if (R.has("P_HTN") || R.has("P_CKD")) t.add("bp");
  if (R.has("P_GLP1")) { t.add("nausea"); t.add("dose"); }
  if (R.has("P_PCOS") || (S.profile.sex === "female" && S.profile.age < 52)) t.add("period");
  if (["P_CKD", "P_T2D", "P_LIPIDS", "P_HYPOTHYROID", "P_ANAEMIA", "P_MASLD", "P_GOUT", "P_PREDIABETES"].some(R.has)) t.add("labs");
  if (R.has("P_IBS")) t.add("symptom");
  if (R.edRisk) t.delete("weight");
  return t;
};

function mState(t, v) {
  if (t.warn && !t.target) return v < t.warn ? "info" : "ok";
  if (t.hi != null && v > t.hi) return "danger";
  if (t.hi != null && t.lo == null && v > 0.85 * t.hi) return "warn";
  if (t.lo != null) return v >= t.lo ? "ok" : "accent";
  if (t.target) return v > t.target * 1.05 ? "warn" : "accent";
  return "ok";
}
function mText(t, v) {
  const u = t.unit ? " " + t.unit : "";
  if (t.warn && !t.target) return `${fmt(v)}${u} · warning line ${fmt(t.warn)}`;
  if (t.lo != null && t.hi != null) return `${fmt(v)} / ${fmt(t.lo)}–${fmt(t.hi)}${u}`;
  if (t.hi != null) return `${fmt(v)} / ${fmt(t.hi)}${u} max`;
  if (t.lo != null) return `${fmt(v)} / ${fmt(t.lo)}+${u}`;
  return `${fmt(v)} / ${fmt(t.target)}${u}`;
}
function mRatio(t, v) { const den = t.warn && !t.target ? t.warn * 1.6 : t.hi ?? t.lo ?? t.target ?? 1; return Math.max(0, Math.min(1, v / den)); }
function metricRow(t, v) {
  const st = mState(t, v), cs = careSrc(t);
  const marker = t.warn && !t.target ? `<b style="left:${(100 / 1.6).toFixed(0)}%"></b>` : t.lo != null && t.hi != null ? `<b style="left:${(t.lo / t.hi * 100).toFixed(0)}%"></b>` : "";
  return `<div class="metric ${cs.length ? "care" : ""}" ${cs.length ? `data-src="${esc(cs.join(" + "))}"` : ""}>
    <div class="row"><span>${t.hard ? "🔒 " : ""}${esc(t.label)}</span><span class="small ${st === "danger" ? "" : "muted"}">${mText(t, v)}</span></div>
    <div class="bar lvl-${st}"><i style="width:${(mRatio(t, v) * 100).toFixed(0)}%"></i>${marker}</div>
    ${t.why?.[0] ? `<div class="tiny soft" style="margin-top:3px" title="${esc(t.why[0])}">${esc(t.why[0].length > 90 ? t.why[0].slice(0, 88).replace(/\s\S*$/, "") + "…" : t.why[0])}</div>` : ""}</div>`;
}
function ring(val, max, label, sub, lvl) {
  const r = 26, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, val / Math.max(1, max)));
  return `<div class="ring lvl-${lvl}"><svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="${r}" style="fill:none;stroke:var(--cp-surface-soft);stroke-width:7"/><circle cx="32" cy="32" r="${r}" style="fill:none;stroke:var(--c);stroke-width:7;stroke-linecap:round" stroke-dasharray="${(f * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/></svg><b>${label}</b><span class="muted">${sub}</span></div>`;
}
function spark(vals, { lo = null, hi = null, band = null, h = 54 } = {}) {
  if (vals.length < 2) return "";
  const w = 300, pd = 5, all = band ? vals.concat(band) : vals, mn = Math.min(...all), mx = Math.max(...all);
  const x = i => pd + i * (w - 2 * pd) / (vals.length - 1), y = v => h - pd - (v - mn) * (h - 2 * pd) / Math.max(1, mx - mn);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" height="${h}" preserveAspectRatio="none">${band ? `<rect x="0" y="${y(band[1]).toFixed(1)}" width="${w}" height="${(y(band[0]) - y(band[1])).toFixed(1)}" style="fill:var(--cp-success);opacity:.12"/>` : ""}<polyline points="${vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}" style="fill:none;stroke:var(--cp-accent);stroke-width:2"/>${vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" style="fill:${lo != null && v < lo ? "var(--cp-danger)" : hi != null && v > hi ? "var(--cp-warning)" : "var(--cp-accent)"}"/>`).join("")}</svg>`;
}
function alertBanner() {
  const a = UI.alert; if (!a) return "";
  return `<div class="alertbar care lvl-${a.level}" data-src="${esc(a.src || "")}" role="alert"><b class="t">${esc(a.title)}</b>${a.html || ""}<div class="btns">${(a.actions || []).map(([act, l, v], i) => `<button class="btn sm ${i === 0 ? "primary" : ""}" data-act="${act}" data-v="${esc(v || "")}">${esc(l)}</button>`).join("")}</div></div>`;
}

/* ---------- TODAY ---------- */
function vToday(R) {
  const p = S.profile, tot = totalsOf(dayItems(S, TODAY_KEY)), first = (p.name || "").split(" ")[0], hr = Math.floor(now() / 60);
  const hello = R.edRisk ? "Hi" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const modes = [["sick", "Sick day"], ["fasting", "Vrat day"], ["festival", "Festival week"], ["eatingOut", "Eating out"]].filter(([k]) => S.modes[k]).map(([, l]) => pill(l, "warn")).join(" ");
  const items = todayItems(R, tot);
  const noCare = !R.paths.some(x => !["goal", "practice"].includes(x.kind)) && (S.setup.noConds || S.setup.dismissed) ? `<div class="card"><h4>Living with a health condition?</h4><p class="small muted" style="margin:0">Add it in Care. Your targets, food checks, diet chart and calendar will all adapt.</p><div class="btns"><button class="btn primary sm" data-act="care" data-v="state">Open Care</button></div></div>` : "";
  const left = setupCard(R) + upNext(items.now) + composer(R) + `<button class="card askcard" data-act="care" data-v="chat"><span class="askicon" aria-hidden="true">💬</span><span class="grow"><b>Ask Pathya</b><span class="tiny muted">“Can I eat rajma?” · “What's for dinner?” · photos too</span></span><span aria-hidden="true">›</span></button>`;
  const right = noCare + hero(R, tot) + timeline(R) + targetsCard(R, tot) + tipsCard(items.tips) + nextCard(R);
  return `<div class="row" style="margin-bottom:12px"><div><div class="tiny muted">${niceLong(TODAY_KEY)} · ${clock(now())}</div><div class="h1">${hello}${first ? ", " + esc(first) : ""}</div></div><div>${modes}</div></div>${alertBanner()}<div class="wide2"><div class="col">${left}</div><div class="col">${right}</div></div>`;
}
function setupCard(R) {
  const p = S.profile, st = S.setup || {};
  if (st.dismissed) return "";
  const steps = [
    ["Your details", !!(p.name && p.height && p.weight), "profileSec", "about", "Add"],
    ["Health conditions", S.conditions.length > 0 || st.noConds, "care", "state", "Add", "noConds", "I have none"],
    ["Medicines", S.meds.length > 0 || st.noMeds, "care", "state", "Add", "noMeds", "I take none"],
    ["Latest weight or numbers", S.readings.length > 0, "track", "weight", "Add"],
    ["Your doctor", !!S.team.doctor.name, "profileSec", "team", "Add"]
  ];
  const done = steps.filter(x => x[1]).length;
  if (done === steps.length) return "";
  return `<div class="card setup"><div class="row"><h4 style="margin:0">Finish setting up</h4>${pill(`${done}/${steps.length}`, "accent")}</div><div class="bar lvl-accent" style="margin:8px 0 6px"><i style="width:${done / steps.length * 100}%"></i></div>
    ${steps.map(([l, ok, act, v, b, act2, b2]) => `<div class="row" style="padding:6px 0"><span class="small">${ok ? "✅" : "⬜"} ${l}</span>${ok ? "" : `<span class="row" style="gap:6px">${act2 ? `<button class="btn sm ghost" data-act="setupNone" data-v="${act2}">${b2}</button>` : ""}<button class="btn sm" data-act="${act}" data-v="${v}">${b}</button></span>`}</div>`).join("")}
    <div class="tiny muted">Takes about 2 minutes. Everything you add is ${accountsOn() && SYNC.user ? "saved privately to your account" : "kept on this phone"}.</div>${done >= 3 ? `<button class="btn sm ghost" data-act="setupNone" data-v="dismissed">Hide</button>` : ""}</div>`;
}
function upNext(list) {
  if (!list.length) return `<div class="card upnext"><div class="row"><h4 style="margin:0">Up next</h4><span class="tiny muted">All caught up ✓</span></div></div>`;
  return `<div class="card upnext"><div class="row"><h4 style="margin:0">Up next</h4>${pill(list.length, list.some(x => x.lvl === "danger") ? "danger" : "accent")}</div>${list.map(x => `<div class="unrow care lvl-${x.lvl}" data-src="${esc(x.src)}"><span class="unic" aria-hidden="true">${x.icon}</span><span class="grow small">${esc(x.text)}</span>${x.act ? `<button class="btn sm ${x.lvl === "danger" ? "primary" : ""}" data-act="${x.act[0]}" data-v="${esc(x.act[2] || "")}">${esc(x.act[1])}</button>` : ""}</div>`).join("")}</div>`;
}
function targetsCard(R, tot) {
  const order = ["energy_kcal", "protein_g", "carb_g", "fibre_g", "sodium_mg", "potassium_mg", "phosphorus_mg", "sfa_g", "added_sugar_g", "added_fat_g", "iron_mg", "calcium_mg"];
  const keys = order.filter(k => R.T[k] && !(k === "energy_kcal" && (R.hideCalories || !S.privacy.showCalories)));
  if (!keys.length) return "";
  const rank = k => (R.T[k].hard ? 0 : 2) + (careSrc(R.T[k]).length ? 0 : 1);
  const sorted = [...keys].sort((a, b) => rank(a) - rank(b) || order.indexOf(a) - order.indexOf(b)), show = UI.allTargets ? sorted : sorted.slice(0, 4);
  return `<div class="card"><div class="row"><h4 style="margin:0">Today's targets</h4><span class="tiny muted">🔒 must-follow</span></div>${show.map(k => metricRow(R.T[k], tot[TKEY[k]])).join("")}${sorted.length > 4 ? `<button class="btn sm ghost" data-act="allTargets">${UI.allTargets ? "Show fewer" : `Show all ${sorted.length}`}</button>` : ""}</div>`;
}
function tipsCard(list) { return list.length ? `<div class="card"><h4>Tips for today</h4>${list.slice(0, 3).map(x => `<div class="note care lvl-${x.lvl}" data-src="${esc(x.src)}">${esc(x.text)}${x.act ? `<div class="btns" style="margin-top:6px"><button class="btn sm" data-act="${x.act[0]}" data-v="${esc(x.act[2] || "")}">${esc(x.act[1])}</button></div>` : ""}</div>`).join("")}</div>` : ""; }
function nextCard(R) {
  if (R.edRisk || !R.paths.some(x => !["goal"].includes(x.kind))) return "";
  const sg = nextSuggestions(R, 2); if (!sg.length) return "";
  return `<div class="card care" data-src="care-aware suggestion"><h4>What to eat next</h4>${sg.map(d => `<div class="row" style="padding:4px 0"><div class="grow"><b class="small">${esc(dname(d))}</b><div class="tiny muted">1 ${esc(d.unit)} · ${fmt(d.p, 1)} g protein${R.T.sodium_mg ? ` · ${fmt(d.na)} mg sodium` : ""}${R.T.potassium_mg?.hardMax ? ` · ${fmt(d.k)} mg K` : ""}</div></div><button class="btn sm" data-act="quickLog" data-v="${d.code}">Log</button></div>`).join("")}<div class="tiny muted" style="margin-top:4px">Chosen from dishes that pass all your rules.</div></div>`;
}function composer(R) {
  const recent = recentDishes(6), slot = slotAt(now()), loggedSlot = (S.logs[TODAY_KEY] || []).some(l => l.slot === slot);
  const planned = !UI.review && !loggedSlot && !R.blocked("planner") && !R.edRisk && (!UI.logDate || UI.logDate === TODAY_KEY) ? planWeek(S, R)[0].meals.find(m => m.slot === slot) : null;
  const yday = !UI.review && !loggedSlot ? (S.logs[dOff(1)] || []).find(l => l.slot === slot) : null;
  const quick = planned || yday ? `<div class="quick">${planned ? `<button class="qbtn" data-act="logPlanned" data-v="${esc(slot)}"><b>📋 As planned</b><span>${esc(planned.items.map(([c, q]) => `${fmtQ(q)} ${DB.byCode[c].short}`).join(", ").slice(0, 70))}</span></button>` : ""}${yday ? `<button class="qbtn" data-act="logYesterday" data-v="${esc(slot)}"><b>↺ Same as yesterday</b><span>${esc(yday.items.map(([c, q]) => `${fmtQ(q)} ${DB.byCode[c]?.short || ""}`).join(", ").slice(0, 70))}</span></button>` : ""}</div>` : "";
  let h = `<div class="card"><div class="row"><h4 style="margin:0">What did you eat?</h4><span class="tiny muted">${UI.logDate && UI.logDate !== TODAY_KEY ? "for " + nice(UI.logDate) : slot}</span></div>${quick}
    <div style="position:relative;margin-top:8px"><textarea id="draft" rows="2" placeholder="Type it the way you'd say it: 2 roti, dal, bhindi and lassi" aria-label="What did you eat?">${esc(UI.draft)}</textarea><div id="sugg"></div></div>
    ${recent.length ? `<div class="chips" style="margin:8px 0 0">${recent.map(d => `<button class="chip" data-act="addRecent" data-v="${d.code}">+ ${esc(d.short.slice(0, 22))}</button>`).join("")}</div>` : ""}
    <div class="row" style="margin-top:10px"><label class="iconbtn" title="Add a photo of your plate" aria-label="Add a photo of your plate">📷<input type="file" accept="image/*" capture="environment" id="logPhoto" hidden></label><button class="btn primary grow" data-act="review">Check &amp; save</button></div>
    ${UI.logPhotoData ? `<div class="row start" style="margin-top:8px"><img src="${UI.logPhotoData}" alt="Meal photo" style="width:56px;height:56px;object-fit:cover;border-radius:10px"><span class="tiny muted">Photo attached. Type or pick what's on the plate. Pathya doesn't guess food from photos yet.</span></div>` : ""}</div>`;
  if (UI.review) h += reviewCard(R);
  return h;
}
function recentDishes(n) {
  const c = new Map();
  for (const d of Object.keys(S.logs).sort().slice(-10)) for (const l of S.logs[d]) for (const [code] of l.items) c.set(code, (c.get(code) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([c]) => DB.byCode[c]).filter(Boolean);
}
function nutrChips(d, q, R) {
  const ch = [];
  if (!R.hideCalories && S.privacy.showCalories) ch.push([`${fmt(d.kcal * q)} kcal`, false]);
  ch.push([`Protein ${fmt(d.p * q, 1)} g`, !!R.T.protein_g?.hardMax || R.has("P_GLP1")]);
  if (R.T.carb_g || R.has("P_T1D")) ch.push([`Carbs ${fmt(d.c * q)} g`, true]);
  if (R.T.sodium_mg?.hi) ch.push([`Sodium ${fmt(d.na * q)} mg`, !!R.T.sodium_mg.hardMax]);
  if (R.T.potassium_mg?.hardMax) ch.push([`K ${fmt(d.k * q)} mg`, true]);
  if (R.T.phosphorus_mg?.hardMax) ch.push([`P ${fmt(d.ph * q)} mg`, true]);
  if (R.T.added_sugar_g && d.asug) ch.push([`Added sugar ${fmt(d.asug * q)} g`, false]);
  return ch.map(([t, f]) => `<span class="nc ${f ? "focus" : ""}">${esc(t)}</span>`).join("");
}
function reviewCard(R) {
  const items = UI.review, codes = items.map(i => i.code).filter(Boolean), d0 = UI.logDate || TODAY_KEY;
  let h = `<div class="card"><div class="row"><h4 style="margin:0">Review · ${slotAt(now())}</h4><button class="btn sm ghost" data-act="cancelReview">Cancel</button></div>`;
  items.forEach((it, i) => {
    if (!it.code) { h += `<div class="item"><div class="row"><b>${esc(it.raw)}</b>${pill("Not found", "warn")}</div><div class="tiny muted">Try another name, or pick from the search while typing.</div><div class="btns"><button class="btn sm" data-act="rmItem" data-i="${i}">Remove</button></div></div>`; return; }
    const d = DB.byCode[it.code], fl = dishFlags(d, it.q, R, S);
    const sw = fl.some(f => f.swap && f.lvl !== "ok") ? swapsFor(it.code, R, S, codes, 2) : [];
    h += `<div class="item"><div class="row top"><div class="grow"><b>${esc(dname(d))}</b><div class="tiny muted">${fmtQ(it.q)} × ${esc(d.unit)}${d.g ? ` (~${fmt(d.g * it.q)} g)` : ""}</div></div><div class="row" style="gap:4px"><button class="btn sm" data-act="qty" data-i="${i}" data-v="-1" aria-label="Less">−</button><button class="btn sm" data-act="qty" data-i="${i}" data-v="1" aria-label="More">+</button></div></div>
      ${it.alts && it.alts.length > 1 ? `<select class="small" style="margin-top:6px;padding:5px 8px" data-act="alt" data-i="${i}" aria-label="Wrong food? Change">${it.alts.map(c => `<option value="${c}" ${c === it.code ? "selected" : ""}>${esc(DB.byCode[c].name.slice(0, 60))}</option>`).join("")}</select>` : ""}
      <div class="nutr">${nutrChips(d, it.q, R)}</div>
      ${fl.map(f => `<div class="flag care lvl-${f.lvl}" data-src="${esc(f.src)}">${{ block: "⛔", warn: "⚠️", ok: "✓", info: "ℹ️" }[f.lvl]} ${esc(f.text)}</div>`).join("")}
      <div class="btns">${sw.map(c => `<button class="btn sm care" data-src="swap engine" data-act="swap" data-i="${i}" data-v="${c}">Swap → ${esc(DB.byCode[c].short.slice(0, 26))}</button>`).join("")}<button class="btn sm ghost" data-act="rmItem" data-i="${i}">Remove</button></div></div>`;
  });
  const t = totalsOf(items.filter(i => i.code).map(i => [i.code, i.q])), day = totalsOf(dayItems(S, d0)), after = f => day[f] + t[f];
  const lv = (v, max) => v > max ? "danger" : v > 0.85 * max ? "warn" : "ok", lines = [];
  if (!R.edRisk) {
    if (R.perMealCarb) lines.push({ lvl: t.c > R.perMealCarb * 1.15 ? "warn" : "ok", text: `Carbs this meal ${fmt(t.c)} g · budget ~${R.perMealCarb} g`, src: R.T.carb_g.src[0] });
    if (R.has("P_T1D")) lines.push({ lvl: "info", text: `${fmt(t.c / 15, 1)} carb exchanges in this meal`, src: "P_T1D" });
    for (const [k, f] of [["sodium_mg", "na"], ["potassium_mg", "k"], ["phosphorus_mg", "ph"], ["added_sugar_g", "asug"]]) if (R.T[k]?.hi) lines.push({ lvl: lv(after(f), R.T[k].hi), text: `${R.T[k].label} after this meal: ${fmt(after(f))} / ${fmt(R.T[k].hi)} ${R.T[k].unit}`, src: R.T[k].src[0] });
    if (R.T.protein_g?.hardMax) lines.push({ lvl: after("p") > R.T.protein_g.hardMax ? "danger" : "ok", text: `Protein after this meal: ${fmt(after("p"))} g · cap ${R.T.protein_g.hardMax} g`, src: R.T.protein_g.src[0] });
    if (R.has("P_GLP1") && codes.length) { const top = [...items].filter(i => i.code).sort((a, b) => DB.byCode[b.code].p * b.q - DB.byCode[a.code].p * a.q)[0]; lines.push({ lvl: t.p >= 20 ? "ok" : "info", text: `Protein ${fmt(t.p, 1)} g. Start with the ${DB.byCode[top.code].short.toLowerCase()}.`, src: "P_GLP1" }); }
    if (R.patterns.some(x => x.rule === "protein_each_main_meal") && /Lunch|Dinner|Breakfast/.test(slotAt(now()))) lines.push({ lvl: t.p >= 20 ? "ok" : "info", text: `Protein in this meal: ${fmt(t.p)} g (aim 20 g+)`, src: "P_WEIGHT_LOSS" });
    if (R.blocked("meal_skipping")) lines.push({ lvl: "ok", text: "Logged on time ✓. Regular meals help prevent lows on your medicine.", src: R.blocks.find(b => b.id === "meal_skipping").src[0] });
  } else lines.push({ lvl: "ok", text: "Thanks for logging. Regular meals matter more than numbers.", src: "P_ED_RISK" });
  h += `<h5>Meal check</h5>${lines.map(l => `<div class="flag care lvl-${l.lvl}" data-src="${esc(l.src)}">${esc(l.text)}</div>`).join("") || '<div class="tiny muted">No care checks yet. Add conditions in Care.</div>'}
    <button class="btn primary block" style="margin-top:12px" data-act="saveMeal" ${codes.length ? "" : "disabled"}>Save ${slotAt(now()).toLowerCase()}</button></div>`;
  return h;
}
function hero(R, tot) {
  const p = S.profile, logs = S.logs[TODAY_KEY] || [], tk = tasksView(TODAY_KEY);
  if (S.modes.sick) return `<div class="card care lvl-warn" data-src="M_SICK_DAY"><h4>🤒 Sick-day mode</h4><p class="small" style="margin:0 0 8px">Targets are paused. Focus on fluids and small, easy food.</p><div class="row"><div class="glasses">${Array.from({ length: 10 }, (_, i) => `<span class="glass ${i < tk.fluids ? "f" : ""}"></span>`).join("")}</div><button class="btn sm" data-act="fluid">+ glass</button></div>${R.patterns.filter(x => x.src === "M_SICK_DAY" || x.rule === "sick_day_medicine_prompt").map(x => `<div class="tiny" style="margin-top:6px">• ${esc(x.text)}</div>`).join("")}<div class="tiny" style="margin-top:6px">Can't keep fluids down for 24 h? Get urgent care.</div></div>`;
  if (R.edRisk) return `<div class="card care" data-src="P_ED_RISK"><h4>Regular eating</h4><p class="small muted" style="margin:0 0 8px">Regular meals matter more than numbers: 3 meals and 2 snacks.</p><div class="dots">${Array.from({ length: 5 }, (_, i) => `<span class="${i < logs.length ? "f" : ""}"></span>`).join("")}</div><div class="tiny muted" style="margin-top:6px">${logs.length} of 5 so far today</div></div>`;
  if (R.has("P_CKD") && R.T.potassium_mg?.hardMax) {
    const t = R.T, lim = S.limits.potassium_mg;
    return `<div class="card care" data-src="P_CKD + CLINICIAN"><div class="row"><h4 style="margin:0">Kidney limits today</h4>${pill("Clinician-led", "warn")}</div><div class="rings">${ring(tot.p, t.protein_g.hi || 60, `${fmt(tot.p)} g`, `protein · cap ${t.protein_g.hi}`, mState(t.protein_g, tot.p))}${ring(tot.k, t.potassium_mg.hi, `${fmt(tot.k)} mg`, `potassium / ${fmt(t.potassium_mg.hi)}`, mState(t.potassium_mg, tot.k))}${t.phosphorus_mg ? ring(tot.ph, t.phosphorus_mg.hi, `${fmt(tot.ph)} mg`, `phosphorus / ${fmt(t.phosphorus_mg.hi)}`, mState(t.phosphorus_mg, tot.ph)) : ""}</div><div class="tiny muted" style="margin-top:8px">Limits from ${esc(lim?.by || "your clinician")}${lim?.date ? " on " + nice(lim.date) : ""}. Pathya won't change them.</div></div>`;
  }
  if (R.has("P_GLP1")) {
    const t = R.T.protein_g;
    return `<div class="card care" data-src="P_GLP1"><div class="row"><h4 style="margin:0">Protein first</h4>${R.wsi != null && R.wsi <= 2 ? pill("Gentle-food window", "warn") : ""}</div><div class="row" style="align-items:flex-end;margin-top:4px"><div><span class="big">${fmt(tot.p)}</span><span class="muted"> / ${t.lo}–${t.hi} g</span></div><span class="tiny muted">${fmt(Math.max(0, t.lo - tot.p))} g to go</span></div><div class="bar lvl-${mState(t, tot.p)}"><i style="width:${(mRatio(t, tot.p) * 100).toFixed(0)}%"></i></div>
      <div class="row" style="margin-top:12px"><div><div class="tiny muted">Eating times</div><div class="dots">${Array.from({ length: Math.max(4, R.mealsMin) + 1 }, (_, i) => `<span class="${i < logs.length ? "f" : ""}"></span>`).join("")}</div></div><div><div class="tiny muted">Fluids ${tk.fluids}/8</div><div class="glasses">${Array.from({ length: 8 }, (_, i) => `<span class="glass ${i < tk.fluids ? "f" : ""}"></span>`).join("")}</div></div><button class="btn sm" data-act="fluid">+ glass</button></div>
      <div class="tiny muted" style="margin-top:8px">${esc(R.blocks.find(b => b.id === "additional_deficit")?.why || "")}</div></div>`;
  }
  if (R.has("P_T1D") || R.T.carb_g) {
    const bud = R.perMealCarb || 60, meals = ["Breakfast", "Lunch", "Evening snack", "Dinner"];
    const vals = meals.map(m => totalsOf(logs.filter(l => l.slot === m || (m === "Breakfast" && l.slot === "Mid-morning")).flatMap(l => l.items)).c), mx = Math.max(bud * 1.4, ...vals);
    const src = R.has("P_T1D") ? "P_T1D" : R.T.carb_g.src[0];
    return `<div class="card care" data-src="${src}"><div class="row"><h4 style="margin:0">Carbs across meals</h4><span class="tiny muted">${R.has("P_T1D") ? "15 g exchanges" : `budget ~${bud} g/meal`}</span></div><div class="mealbars">${meals.map((m, i) => `<div class="mb lvl-${vals[i] > bud * 1.15 ? "warn" : vals[i] ? "ok" : "muted"}"><span class="cap" style="bottom:${(bud / mx * 70 + 30).toFixed(0)}%"></span><span class="tiny">${vals[i] ? (R.has("P_T1D") ? fmt(vals[i] / 15, 1) + " ex" : fmt(vals[i]) + " g") : "–"}</span><i style="height:${(vals[i] / mx * 70).toFixed(0)}%"></i><span class="tiny muted">${m.replace("Evening ", "")}</span></div>`).join("")}</div><div class="tiny muted" style="margin-top:6px">Similar carbs at each meal keep glucose steadier than one big carb meal.</div></div>`;
  }
  if (R.has("P_PCOS")) {
    const per = S.readings.filter(r => r.key === "period").map(r => r.d).sort().pop(), cd = per ? daysBetween(per, TODAY_KEY) + 1 : null;
    return `<div class="card care" data-src="P_PCOS"><div class="row"><h4 style="margin:0">${cd ? "Cycle day " + cd : "Cycle"}</h4><button class="btn sm" data-act="track" data-v="period">Period started</button></div><div class="rings">${R.T.fibre_g ? ring(tot.fib, R.T.fibre_g.lo, `${fmt(tot.fib)} g`, `fibre / ${R.T.fibre_g.lo}+`, mState(R.T.fibre_g, tot.fib)) : ""}${ring(tot.p, R.T.protein_g.lo, `${fmt(tot.p)} g`, `protein / ${R.T.protein_g.lo}+`, mState(R.T.protein_g, tot.p))}${R.T.iron_mg ? ring(tot.fe, R.T.iron_mg.lo, `${fmt(tot.fe, 1)} mg`, `iron / ${R.T.iron_mg.lo}`, mState(R.T.iron_mg, tot.fe)) : ""}</div></div>`;
  }
  const t = R.T.energy_kcal;
  if (!t || !S.privacy.showCalories) return "";
  return `<div class="card"><div class="rings">${ring(tot.kcal, t.target || R.E, fmt(tot.kcal), `of ${fmt(t.target || R.E)} kcal`, mState(t, tot.kcal))}${ring(tot.p, R.T.protein_g.lo, `${fmt(tot.p)} g`, "protein", mState(R.T.protein_g, tot.p))}${R.T.fibre_g ? ring(tot.fib, R.T.fibre_g.lo, `${fmt(tot.fib)} g`, "fibre", mState(R.T.fibre_g, tot.fib)) : ""}</div></div>`;
}
function timeline(R) {
  const logs = S.logs[TODAY_KEY] || [], guard = R.blocked("meal_skipping"), n = now();
  const slots = slotPlan(R, S).map(([s, m]) => [s, m]);
  logs.forEach(l => { if (!slots.some(s => s[0] === l.slot)) slots.push([l.slot, l.mins]); });
  slots.sort((a, b) => a[1] - b[1]);
  const rows = slots.map(([name, m]) => {
    const L = logs.filter(l => l.slot === name);
    if (L.length) return L.map(l => { const t = totalsOf(l.items); return `<div class="tl lvl-ok"><span class="d"></span><span><b class="small">${esc(name)}</b> <span class="tiny muted">${clock(l.mins)}</span><br><span class="tiny muted">${l.items.map(([c, q]) => `${fmtQ(q)} ${esc(DB.byCode[c]?.short || c)}`).join(", ")}</span></span><span class="tiny muted" style="text-align:right">${R.hideCalories || !S.privacy.showCalories ? "" : fmt(t.kcal) + " kcal"}<br><button class="btn sm ghost" data-act="delLog" data-v="${l.id}" aria-label="Delete">✕</button></span></div>`; }).join("");
    let lvl, txt; const main = ["Breakfast", "Lunch", "Dinner"].includes(name);
    if (n >= m + 60) { lvl = guard && main ? "danger" : "muted"; txt = guard && main ? "Overdue" : "Not logged"; }
    else if (n >= m - 30) { lvl = "warn"; txt = "Due now"; } else { lvl = "muted"; txt = clock(m); }
    return `<div class="tl lvl-${lvl}"><span class="d"></span><span class="small">${esc(name)}</span><span class="small ${lvl === "danger" ? "" : "muted"}">${txt}</span></div>`;
  }).join("");
  return `<div class="card ${guard ? "care" : ""}" ${guard ? `data-src="${R.blocks.find(b => b.id === "meal_skipping").src[0]}"` : ""}><h4>Meals</h4>${rows}</div>`;
}
function medsDue() {
  const n = now(), tk = tasksView(TODAY_KEY), out = [];
  const PAIR = { "Before breakfast": "With dinner", "With breakfast": "With dinner", Morning: "Evening", "With lunch": "With dinner", "With dinner": "With breakfast", Evening: "Morning", "At bedtime": "Morning" };
  for (const m of S.meds) {
    if (m.freq === "As needed") continue;
    let doses = [m.timing];
    if (m.freq === "Twice a day") doses = [m.timing, PAIR[m.timing] || "With dinner"];
    if (m.freq === "Three times a day") doses = ["With breakfast", "With lunch", "With dinner"];
    if (m.freq === "Once a week") { const last = S.readings.filter(r => r.key === "dose").map(r => r.d).sort().pop(); if (last && daysBetween(last, TODAY_KEY) < 7) continue; }
    doses.map(lbl => [lbl, TIMING_MINS[lbl] ?? 540]).sort((a, b) => a[1] - b[1]).forEach(([lbl, t], i) => {
      const k = m.id + ":" + i;
      out.push({ m: Object.assign(Object.create(m), { timing: lbl }), k, t, taken: !!tk.meds[k], due: n >= t - 45 });
    });
  }
  return out.sort((a, b) => a.t - b.t);
}
function todayItems(R, tot) {
  const n = now(), logs = S.logs[TODAY_KEY] || [], nowL = [], tips = [], doc = S.team.doctor.name || "your doctor";
  const urgent = S.escalations.filter(e => e.status === "open" && e.level !== "routine");
  if (urgent.length) nowL.push({ lvl: "danger", icon: "🚨", src: "Escalation", text: `${urgent[0].title}. Tell ${doc} today.`, act: ["care", "Open", "esc"] });
  if (R.blocked("meal_skipping")) { const due = slotPlan(R, S).find(([s, m]) => n >= m + 75 && !logs.some(l => l.slot === s) && ["Breakfast", "Lunch", "Dinner"].includes(s)); if (due) nowL.push({ lvl: "danger", icon: "⏰", src: R.blocks.find(b => b.id === "meal_skipping").src[0], text: `${due[0]} is late (${clock(n)}). On your medicine a late meal can cause a low, so eat something now.`, act: ["focusLog", "Log " + due[0].toLowerCase()] }); }
  if (S.privacy.reminders) for (const d of medsDue().filter(x => x.due && !x.taken)) nowL.push({ lvl: "info", icon: "💊", src: "Medicines", text: `${d.m.brand || d.m.generic}${d.m.dose ? " " + d.m.dose + " " + (d.m.unit || "") : ""} · ${d.m.timing.toLowerCase()}`, act: ["medTaken", "Taken", d.k] });
  const last = logs[logs.length - 1], glu = R.has("P_T2D") || R.has("P_T1D") || R.has("P_PREDIABETES");
  if (glu && n < 660 && !S.readings.some(r => r.key === "glucose" && r.d === TODAY_KEY)) nowL.push({ lvl: "info", icon: "🩸", src: "P_T2D", text: "Fasting glucose", act: ["track", "Log", "glucose"] });
  if (glu && last && n - last.mins >= 100 && n - last.mins <= 160 && !S.readings.some(r => r.key === "glucose" && r.d === TODAY_KEY && r.t && /after/.test(r.ctx || ""))) nowL.push({ lvl: "info", icon: "🩸", src: "P_T2D", text: `2-hour check after ${last.slot.toLowerCase()}`, act: ["track", "Log", "glucose"] });
  const ev = S.events.find(e => e.kind === "vrat" && e.d >= TODAY_KEY);
  if (ev && R.gated("fasting_mode")) nowL.push({ lvl: "warn", icon: "🪔", src: R.gates.find(g => g.id === "fasting_mode").src, text: `${ev.label} on ${nice(ev.d)} needs ${doc}'s OK first.`, act: ["care", "Plan it", "day"] });
  const lastCheck = S.goals.length ? Math.max(...S.goals.map(g => +new Date(g.since || 0))) : 0;
  if (R.paths.some(x => x.kind === "condition") && !R.edRisk && (!S.goals.length || Date.now() - lastCheck > 7 * 864e5)) nowL.push({ lvl: "accent", icon: "🎯", src: "Weekly check-in", text: "Weekly check-in: pick up to 2 goals", act: ["care", "Start", "day"] });
  if (R.T.sodium_mg?.hi && !R.edRisk) tips.push({ lvl: tot.na > R.T.sodium_mg.hi * 0.85 ? "warn" : "info", src: R.T.sodium_mg.src.join(" + "), text: S.modes.festival ? "Festival week: salt is counted weekly, so a heavier day is fine if the next is lighter." : `Salt left today: ${fmt(Math.max(0, R.T.sodium_mg.hi - tot.na))} mg sodium (about ${fmt(Math.max(0, R.T.sodium_mg.hi - tot.na) / 400, 1)} g salt).` });
  if (R.patterns.some(x => /strength/i.test(x.rule || "") || /strength|resistance/i.test(x.text))) { const sd = S.readings.filter(r => r.key === "strength" && daysBetween(r.d, TODAY_KEY) < 7).length; tips.push({ lvl: "info", src: R.has("P_GLP1") ? "P_GLP1" : R.has("P_OLDER_ADULT") ? "P_OLDER_ADULT" : "P_MUSCLE_GAIN", text: `Strength training ${sd}/2 this week. It protects muscle.`, act: ["logStrength", "Log 30 min"] }); }
  const b12 = R.patterns.find(x => x.rule === "periodic_prompt"), b12lab = S.readings.filter(r => r.key === "b12").map(r => r.d).sort().pop();
  if (b12 && (!b12lab || daysBetween(b12lab, TODAY_KEY) > 365)) tips.push({ lvl: "info", src: b12.src, text: `It's been over a year since a vitamin B12 test. Ask ${doc}; metformin lowers B12 over time.`, act: ["askDoc", "Add to doctor questions", "Is a vitamin B12 test due? I take metformin."] });
  if (R.has("P_PCOS") && !R.edRisk) tips.push({ lvl: "info", src: "P_PCOS", text: "Aim for 150–300 minutes of movement a week. A 20-minute walk after dinner counts." });
  return { now: nowL.slice(0, 5), tips };
}/* ---------- CALENDAR ---------- */
function vCal(R) {
  const tr = trackers(R), F = [["meals", "Meals"]];
  if (tr.has("glucose")) F.push(["glucose", "Glucose"]); if (tr.has("bp")) F.push(["bp", "BP"]); if (tr.has("dose")) F.push(["dose", "Doses"]);
  if (tr.has("nausea")) F.push(["nausea", "Nausea"]); if (tr.has("period")) F.push(["period", "Cycle"]); if (tr.has("labs")) F.push(["lab", "Labs"]);
  F.push(["meds", "Medicines"], ["events", "Plans & alerts"]);
  const on = k => UI.calFilters[k] !== false;
  const base = UI.calMonth ? parseKey(UI.calMonth) : new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  const y = base.getFullYear(), mo = base.getMonth(), first = new Date(y, mo, 1), lead = (first.getDay() + 6) % 7, nd = new Date(y, mo + 1, 0).getDate();
  let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => `<div class="dow">${d}</div>`).join("") + "<div></div>".repeat(lead);
  for (let day = 1; day <= nd; day++) {
    const k = dkey(new Date(y, mo, day)), rs = S.readings.filter(r => r.d === k), mk = [];
    if (on("meals") && (S.logs[k] || []).length) mk.push(`<span class="dotm" title="${S.logs[k].length} meals"></span>`);
    if (on("glucose")) { const g = rs.filter(r => r.key === "glucose"); if (g.length) { const lo = Math.min(...g.map(x => x.v)), hi = Math.max(...g.map(x => x.v)), v = lo < 70 ? lo : hi; mk.push(`<span class="mk lvl-${v < 70 ? "danger" : v > 180 ? "warn" : "ok"}">${v}</span>`); } }
    if (on("bp")) rs.filter(r => r.key === "bp").slice(0, 1).forEach(r => mk.push(`<span class="mk lvl-${r.v >= 140 || r.v2 >= 90 ? "warn" : "ok"}">${r.v}/${r.v2}</span>`));
    if (on("dose")) rs.filter(r => r.key === "dose").forEach(() => mk.push('<span class="mk lvl-info">💉</span>'));
    if (on("nausea")) rs.filter(r => r.key === "nausea" && r.v >= 2).forEach(r => mk.push(`<span class="mk lvl-warn">N${r.v}</span>`));
    if (on("period")) rs.filter(r => r.key === "period").forEach(() => mk.push('<span class="mk lvl-accent">P</span>'));
    if (on("lab")) if (rs.some(r => METRICS[r.key]?.[2] === "lab")) mk.push('<span class="mk lvl-info">Lab</span>');
    if (on("meds")) { const t = S.tasks[k]; if (t && Object.keys(t.meds || {}).length) mk.push(`<span class="mk lvl-ok">💊${Object.keys(t.meds).length}</span>`); }
    if (on("events")) {
      S.events.filter(e => e.d === k).forEach(e => mk.push(`<span class="mk lvl-${e.kind === "vrat" && R.gated("fasting_mode") ? "warn" : "info"}">${esc({ vrat: "Vrat", festival: "Event", sick: "Sick" }[e.kind] || e.label.slice(0, 6))}</span>`));
      if (S.escalations.some(e => e.d === k)) mk.push('<span class="mk lvl-danger">!</span>');
    }
    cells += `<button class="day ${k === TODAY_KEY ? "today" : ""} ${k > TODAY_KEY ? "future" : ""} ${UI.calSel === k ? "sel" : ""}" data-act="calday" data-v="${k}"><span class="num">${day}</span><span class="marks">${mk.join("")}</span></button>`;
  }
  const loggedDays = Object.keys(S.logs).filter(k => k.startsWith(`${y}-${pad(mo + 1)}`) && S.logs[k].length).length;
  let h = alertBanner() + `<div class="wide2"><div class="col"><div class="card care" data-src="overlays from active paths"><div class="row"><button class="btn sm" data-act="calNav" data-v="-1" aria-label="Previous month">‹</button><h4 style="margin:0">${first.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h4><button class="btn sm" data-act="calNav" data-v="1" aria-label="Next month">›</button></div>
    <div class="tiny muted" style="text-align:center;margin-top:4px">${loggedDays} days logged</div>
    <div class="chips" style="margin:10px 0">${F.map(([k, l]) => `<button class="chip ${on(k) ? "on" : ""}" data-act="calf" data-v="${k}" aria-pressed="${on(k)}">${l}</button>`).join("")}</div>
    <div class="cal">${cells}</div>
    <div class="row start tiny muted" style="flex-wrap:wrap;margin-top:8px;gap:10px"><span><span class="dotm"></span> meals</span>${tr.has("glucose") ? `<span>${pill("62", "danger")} low</span><span>${pill("196", "warn")} high</span>` : ""}<span>${pill("!", "danger")} escalation</span></div></div></div>
    <div class="col">${UI.calSel ? dayDetail(R, UI.calSel) : `<div class="card"><h4>Tap a day</h4><p class="small muted" style="margin:0">See meals, readings, medicines and alerts for that day, or log a meal you forgot.</p></div>`}</div></div>`;
  return h;
}
function dayDetail(R, k) {
  const rs = S.readings.filter(r => r.d === k), logs = S.logs[k] || [], t = totalsOf(logs.flatMap(l => l.items)), tk = S.tasks[k];
  const rline = r => { const m = METRICS[r.key] || [r.key, ""]; if (r.key === "weight" && R.hideCalories) return ""; return `<li>${r.t ? r.t + " · " : ""}${esc(m[0])} <b>${esc(r.key === "bp" ? r.v + "/" + r.v2 : r.v)} ${esc(m[1] && !["", "0–3"].includes(m[1]) ? m[1] : "")}</b>${r.ctx ? ` <span class="muted">(${esc(r.ctx)})</span>` : ""}${r.key === "glucose" && r.v < 70 ? " " + pill("Low", "danger") : ""}${r.note ? `<br><span class="tiny muted">${esc(r.note)}</span>` : ""}</li>`; };
  return `<div class="card"><div class="row"><h4 style="margin:0">${niceLong(k)}</h4><button class="btn sm" data-act="calday" data-v="">Close</button></div>
    ${logs.length ? `<h5>Meals${R.hideCalories || !S.privacy.showCalories ? "" : ` · ${fmt(t.kcal)} kcal`} · protein ${fmt(t.p)} g${R.T.sodium_mg ? ` · sodium ${fmt(t.na)} mg` : ""}${R.T.potassium_mg?.hardMax ? ` · K ${fmt(t.k)} mg` : ""}</h5><ul class="list">${logs.map(l => `<li><b>${esc(l.slot)}</b> ${l.items.map(([c, q]) => `${fmtQ(q)} ${esc(DB.byCode[c]?.short || c)}`).join(", ")}</li>`).join("")}</ul>` : "<p class='small muted'>No meals logged.</p>"}
    ${rs.length ? `<h5>Readings</h5><ul class="list">${rs.map(rline).join("")}</ul>` : ""}
    ${tk && Object.keys(tk.meds || {}).length ? `<h5>Medicines</h5><div class="small">${Object.keys(tk.meds).length} dose(s) marked taken</div>` : ""}
    ${S.events.filter(e => e.d === k).map(e => `<div class="note lvl-info">${esc(e.label)}</div>`).join("")}
    ${S.escalations.filter(e => e.d === k).map(e => `<div class="note lvl-${e.level}"><b class="t">${esc(e.title)}</b>${esc(e.detail || "")}</div>`).join("")}
    <div class="btns"><button class="btn sm" data-act="logFor" data-v="${k}">Log a meal for this day</button></div></div>`;
}
