"use strict";
/* Pathya Care — Care tab: shell, Current state, Day to day, Rules in effect. */

const HANDOFF = { self_guided: ["Self-guided", "ok"], doctor_confirm: ["Doctor to confirm", "info"], clinician_led: ["Clinician-led", "warn"], handoff: ["Hand off to a professional", "danger"], stop_and_refer: ["Stop & refer", "danger"] };
const CARE_SEGS = [["state", "🩺", "Current state"], ["plan", "🥗", "Diet chart"], ["day", "✅", "Day to day"], ["chat", "💬", "Chat"], ["report", "📄", "Medical report"], ["esc", "🚨", "Doctor escalation"], ["rules", "⚖️", "Your care rules"]];
function vCare(R) {
  if (!CARE_SEGS.some(s => s[0] === UI.careSeg)) UI.careSeg = "state";
  const openEsc = S.escalations.filter(e => e.status === "open" && e.level !== "routine").length;
  let h = alertBanner() + `<nav class="carenav" aria-label="Care sections">${CARE_SEGS.map(([k, ic, l]) => `<button class="${UI.careSeg === k ? "on" : ""}" data-act="care" data-v="${k}" ${UI.careSeg === k ? 'aria-current="page"' : ""}><span class="ci" aria-hidden="true">${ic}</span><span>${l}</span>${k === "esc" && openEsc ? '<i class="dot" aria-label="needs attention"></i>' : ""}</button>`).join("")}</nav>`;
  h += `<div class="carebody">${{ state: careState, plan: carePlan, day: careDay, chat: careChat, report: careReport, esc: careEsc, rules: careRules }[UI.careSeg](R)}</div>`;
  return h;
}

/* ---------- Current state ---------- */
function careState(R) {
  const p = S.profile;
  let h = "";
  // conditions
  h += `<div class="card"><div class="row"><h4 style="margin:0">Conditions</h4><button class="btn sm" data-act="sheet" data-v="addCond">+ Add</button></div>
    ${S.conditions.length ? S.conditions.map((c, i) => { const path = Object.values(DB.pathways).find(x => (x.triggers || []).some(t => t.includes(`'${c.id}'`))); const clin = path && ["clinician_led", "stop_and_refer"].includes(path.handoff); return `<div class="item"><div class="row top"><div class="grow"><b>${esc(COND_NAME[c.id] || c.id)}</b><div class="tiny muted">${c.since ? "Since " + esc(c.since) : "Added by you"}</div></div>${clin ? pill(HANDOFF[path.handoff][0], "warn") : c.confirmed ? pill("Doctor-confirmed ✓", "ok") : pill("Not confirmed yet", "muted")}</div>${path?.handoff_message ? `<div class="tiny soft" style="margin-top:4px">${esc(path.handoff_message)}</div>` : ""}<div class="btns">${c.confirmed ? "" : `<button class="btn sm" data-act="condConfirm" data-i="${i}">My doctor confirmed this</button>`}<button class="btn sm ghost" data-act="condDel" data-i="${i}">Remove</button></div></div>`; }).join("") : `<div class="empty">No conditions added. Pathya works as a general nutrition app until you add one.</div>`}
    <div class="grid2" style="margin-top:10px"><div class="field"><label for="preg">Pregnancy</label><select id="preg" data-bind="profile.pregnancy">${["No", "Pregnant", "Breastfeeding"].map(o => `<option ${p.pregnancy === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>${S.conditions.some(c => c.id === "ckd") ? `<div class="field"><label for="dial">On dialysis?</label><select id="dial" data-bind="profile.dialysis">${[["false", "No"], ["true", "Yes"]].map(([v, l]) => `<option value="${v}" ${String(!!p.dialysis) === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>` : ""}</div></div>`;
  // medicines
  h += `<div class="card"><div class="row"><h4 style="margin:0">Medicines</h4><button class="btn sm" data-act="sheet" data-v="addMed">+ Add</button></div>
    ${S.meds.length ? S.meds.map(m => { const d = DB.drugs[m.cls]; const since = m.start ? `since ${esc(m.start)}` : ""; const dur = m.duration === "Ongoing" ? "ongoing" : m.duration === "Until" && m.until ? `until ${nice(m.until)}` : m.duration === "Course" && m.days ? `${m.days}-day course` : ""; return `<div class="item"><div class="row top"><div class="grow"><b>${esc(m.brand || m.generic)}</b> <span class="muted small">${m.brand ? "(" + esc(m.generic) + ")" : ""}</span><div class="small">${m.dose ? esc(m.dose + " " + (m.unit || "")) + " · " : ""}${esc(m.freq)} · ${esc(m.timing)}</div><div class="tiny muted">${[since, dur].filter(Boolean).join(" · ")}${m.increasedOn ? ` · dose changed ${nice(m.increasedOn)}` : ""}</div></div>${d ? pill(d.severity === "high" ? "Food rules: high" : "Food rules", d.severity === "high" ? "warn" : "info") : pill("No food rules", "muted")}</div>
      ${d ? `<div class="tiny" style="margin-top:6px">${esc(d.issue)}</div>` : ""}<div class="btns"><button class="btn sm" data-act="editMed" data-v="${m.id}">Edit</button>${m.cls === "glp1" || m.cls === "insulin" ? `<button class="btn sm" data-act="doseChanged" data-v="${m.id}">My dose changed today</button>` : ""}<button class="btn sm ghost" data-act="medDel" data-v="${m.id}">Remove</button></div></div>`; }).join("") : `<div class="empty">No medicines added.</div>`}
    <div class="tiny muted" style="margin-top:8px">Pathya matches brands to generics using 41 medicine classes and applies their food rules. It never changes a dose.</div></div>`;
  // health metrics
  const tr = trackers(R), show = ["weight", "waist", "bp", "glucose", "hba1c", "tg", "ldl", "egfr", "creat", "k", "phos", "tsh", "hb", "b12", "uric"].filter(k => S.readings.some(r => r.key === k) || (k === "glucose" && tr.has("glucose")) || (k === "bp" && tr.has("bp")) || k === "weight");
  const bmi = R.bmi ? `<div class="tile"><b>BMI</b><span>${fmt(R.bmi, 1)} · ${R.bmi < 18.5 ? "underweight" : R.bmi < 23 ? "healthy (Asian cut-off)" : R.bmi < 25 ? "overweight (Asian cut-off)" : "obese range (Asian cut-off)"}</span></div>` : "";
  h += `<div class="card"><div class="row"><h4 style="margin:0">Health metrics</h4><button class="btn sm" data-act="sheet" data-v="addReading">+ Add reading</button></div><div class="tiles" style="margin-top:8px">${show.filter(k => !(k === "weight" && R.hideCalories)).map(k => { const r = latest(S, k), m = METRICS[k], prev = S.readings.filter(x => x.key === k).sort((a, b) => a.d.localeCompare(b.d)).slice(-2, -1)[0]; const arrow = r && prev && r.v !== prev.v ? (r.v > prev.v ? " ↑" : " ↓") : ""; return `<button class="tile" data-act="track" data-v="${k}"><b>${m[0]}</b><span>${r ? `${k === "bp" ? r.v + "/" + r.v2 : r.v} ${m[1]}${arrow} · ${nice(r.d)}` : "Add"}</span></button>`; }).join("")}${R.hideCalories ? "" : bmi}</div></div>`;
  // clinician limits
  if (S.conditions.some(c => ["ckd", "t1d", "lipids"].includes(c.id)) || Object.keys(S.limits).length) h += `<div class="card care" data-src="CLINICIAN"><div class="row"><h4 style="margin:0">Limits from your doctor</h4><button class="btn sm" data-act="sheet" data-v="addLimit">+ Add</button></div>${Object.entries(S.limits).filter(([, x]) => x && x.v).map(([k, x]) => `<div class="row small" style="padding:5px 0;border-bottom:1px solid var(--cp-border)"><span>🔒 ${LIMIT_KEYS[k] || k} ≤ <b>${fmt(x.v)} ${k.endsWith("_g") ? "g" : "mg"}</b>/day<br><span class="tiny muted">${esc(x.by || "")}${x.date ? " · " + nice(x.date) : ""}</span></span><button class="btn sm ghost" data-act="limitDel" data-v="${k}">Remove</button></div>`).join("") || `<div class="note lvl-warn">No limits entered. For kidney disease, Pathya won't guess potassium or phosphorus limits; ask your nephrologist.</div>`}</div>`;
  // documents
  h += `<div class="card"><div class="row"><h4 style="margin:0">Reports &amp; prescriptions</h4><label class="btn sm" style="cursor:pointer">+ Upload<input type="file" id="docUpload" accept="image/*,application/pdf" hidden></label></div>
    ${S.docs.length ? S.docs.slice(0, 4).map(docRow).join("") + (S.docs.length > 4 ? `<button class="btn sm ghost" data-act="care" data-v="report">See all ${S.docs.length} in Medical report</button>` : "") : `<div class="empty">Upload lab reports, prescriptions or discharge summaries. They stay on this device and appear in your Medical report.</div>`}</div>`;
  // screeners from the kit
  const scr = [["idrs", !S.conditions.some(c => ["t2d", "t1d", "prediabetes"].includes(c.id))], ["scoff", true], ["phq2", true]].filter(([, ok]) => ok);
  h += `<div class="card"><h4>Quick check-ups</h4>${scr.map(([id]) => { const s = DB.screeners[id], v = S.screens[id]; return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--cp-border)"><div class="grow"><b class="small">${esc(s.name)}</b><div class="tiny muted">${esc(s.purpose)}${v != null ? ` · last score ${v}` : ""}</div></div><button class="btn sm" data-act="screen" data-v="${id}">${v != null ? "Retake" : "Start"}</button></div>`; }).join("")}<div class="tiny muted" style="margin-top:6px">Sensitive questions are asked only if you choose to start. Results route you to help; they never diagnose.</div></div>`;
  return h;
}
function docRow(d) {
  return `<div class="doc">${d.data && d.mime?.startsWith("image") ? `<img class="thumb" src="${d.data}" alt="">` : `<div class="thumb">📄</div>`}<div class="grow"><b class="small">${esc(d.title || d.type)}</b><div class="tiny muted">${esc(d.type)} · ${nice(d.d)}${d.note ? " · " + esc(d.note) : ""}</div></div><div class="row" style="gap:4px"><button class="btn sm" data-act="docView" data-v="${d.id}">View</button><button class="btn sm ghost" data-act="docDel" data-v="${d.id}" aria-label="Delete">✕</button></div></div>`;
}

/* ---------- Day to day ---------- */
function careDay(R) {
  const tk = tasksOf(TODAY_KEY), doc = S.team.doctor.name || "your doctor";
  let h = "";
  const meds = medsDue();
  const tr = trackers(R), rd = [];
  if (tr.has("glucose")) rd.push(["glucose", "Fasting glucose", S.readings.some(r => r.key === "glucose" && r.d === TODAY_KEY)]);
  if (tr.has("bp")) rd.push(["bp", "Blood pressure (weekly)", S.readings.some(r => r.key === "bp" && daysBetween(r.d, TODAY_KEY) < 7)]);
  if (tr.has("weight")) rd.push(["weight", "Weight (weekly)", S.readings.some(r => r.key === "weight" && daysBetween(r.d, TODAY_KEY) < 7)]);
  if (tr.has("nausea")) rd.push(["nausea", "Side effects check", S.readings.some(r => r.key === "nausea" && r.d === TODAY_KEY)]);
  if (tr.has("symptom")) rd.push(["symptom", "Symptom diary", S.readings.some(r => r.key === "symptom" && r.d === TODAY_KEY)]);
  const done = meds.filter(x => x.taken).length + rd.filter(x => x[2]).length, total = meds.length + rd.length;
  h += `<div class="card"><div class="row"><h4 style="margin:0">Today's checklist</h4>${total ? pill(`${done}/${total} done`, done === total ? "ok" : "accent") : ""}</div>
    ${meds.map(x => `<label class="check"><input type="checkbox" data-act="medTaken" data-v="${x.k}" ${x.taken ? "checked" : ""}> <span>💊 <b>${esc(x.m.brand || x.m.generic)}</b> ${x.m.dose ? esc(x.m.dose + " " + (x.m.unit || "")) : ""} <span class="muted">· ${clock(x.t)} · ${esc(x.m.timing.toLowerCase())}</span></span></label>`).join("")}
    ${rd.map(([k, l, ok]) => `<div class="row" style="padding:5px 0"><span class="small">${ok ? "✅" : "⬜"} ${l}</span>${ok ? "" : `<button class="btn sm" data-act="track" data-v="${k}">Log</button>`}</div>`).join("")}
    ${R.has("P_GLP1") || S.modes.sick ? `<div class="row" style="padding:5px 0"><span class="small">💧 Fluids ${tk.fluids}/${S.modes.sick ? 10 : 8} glasses</span><button class="btn sm" data-act="fluid">+ glass</button></div>` : ""}
    ${!total && !R.has("P_GLP1") ? `<div class="empty">Add medicines or conditions in Current state to build your daily checklist.</div>` : ""}
    ${R.patterns.filter(x => x.rule && /timing|empty_stomach|mineral|tea_gap|iron_tablet|dose_with_meal|last_meal/.test(x.rule + "")).slice(0, 4).map(x => `<div class="note care lvl-info" data-src="${esc(x.src)}">⏱ ${esc(x.text)}</div>`).join("")}</div>`;
  // weekly check-in + goals
  h += checkIn(R);
  // modes
  const fastGate = R.gates.find(g => g.id === "fasting_mode"), fastOK = (S.gatesOK || {}).fasting_mode;
  const modes = [
    ["sick", "🤒 Sick day", "Fever, cold or upset stomach. Pauses targets and plans soft food.", null],
    ["fasting", "🪔 Vrat / fasting day", "Ekadashi, Navratri, Karva Chauth, Ramadan or a weekly vrat.", fastGate && !fastOK ? (R.edRisk ? "not" : "gated") : null],
    ["festival", "🎉 Festival / wedding week", "Counts salt and sweets weekly; no compensation fasting after.", null],
    ["eatingOut", "🍽 Eating out / travel", "Assumes more oil; suggests grilled, dal, roti, raita and salad.", null]
  ];
  h += `<div class="card"><h4>Modes</h4>${modes.map(([id, name, desc, st]) => `<div class="item ${S.modes[id] ? "care" : ""}" ${S.modes[id] ? `data-src="M_${id.toUpperCase()}"` : ""}><div class="row top"><div class="grow"><b class="small">${name}</b><div class="tiny muted">${desc}</div></div>${st === "gated" ? pill("Needs doctor's OK", "warn") : st === "not" ? pill("Not advised now", "danger") : S.modes[id] ? pill("On", "ok") : ""}</div>
    ${st === "gated" ? `<div class="note lvl-warn">${esc(fastGate.why)} ${srcTag(fastGate.src)}</div><div class="btns"><button class="btn sm" data-act="askDoc" data-v="Is it safe for me to keep a vrat with my current medicines, and what should change on that day?">Ask ${esc(doc)}</button><button class="btn sm primary" data-act="gateOK" data-v="fasting_mode">${esc(doc)} said OK</button></div>`
      : st === "not" ? `<div class="note lvl-danger">${esc(fastGate.why)}</div>`
        : `<div class="btns">${id === "fasting" ? `<select style="width:auto;padding:5px 8px" data-bind="modes.fastType" aria-label="Type of fast">${Object.keys(DB.fasting).map(k => `<option value="${k}" ${S.modes.fastType === k ? "selected" : ""}>${cap(k.replace("_", " "))}</option>`).join("")}</select>` : ""}<button class="btn sm ${S.modes[id] ? "" : "primary"}" data-act="mode" data-v="${id}">${S.modes[id] ? "Turn off" : "Turn on"}</button></div>`}
    ${id === "fasting" && S.modes.fasting && DB.fasting[S.modes.fastType] ? `<div class="tiny" style="margin-top:6px"><b>Allowed:</b> ${esc(DB.fasting[S.modes.fastType].allowed?.slice(0, 10).join(", ") || "")}</div>` : ""}</div>`).join("")}
    <div class="item"><div class="row"><div class="grow"><b class="small">👩‍🍳 Who cooks?</b><div class="tiny muted">${S.profile.whoCooks === "Me" ? "You" : esc(S.profile.whoCooks)} · cook sheet in Hindi + English</div></div><button class="btn sm" data-act="sheet" data-v="cook">Cook sheet</button></div></div></div>`;
  return h;
}
function weekFindings(R) {
  const days = [...Array(7)].map((_, i) => dOff(i + 1)).filter(k => (S.logs[k] || []).length);
  if (!days.length) return { days: 0, f: [] };
  const per = days.map(k => totalsOf(dayItems(S, k))), a = key => avg(per.map(t => t[key])), f = [];
  if (R.T.sodium_mg?.hi && a("na") > R.T.sodium_mg.hi) f.push({ id: "salt", title: `Bring salt under ${fmt(R.T.sodium_mg.hi)} mg`, why: `Average ${fmt(a("na"))} mg sodium a day last week.`, how: "Skip pickle/papad on weekdays; less salt in dal; no salt on salad.", src: R.T.sodium_mg.src[0] });
  if (R.T.protein_g?.lo && a("p") < R.T.protein_g.lo * 0.9) f.push({ id: "protein", title: "Protein at every main meal", why: `Average ${fmt(a("p"))} g a day vs ${R.T.protein_g.lo} g.`, how: "Add dal, curd, paneer, egg or sprouts to breakfast.", src: R.T.protein_g.src[0] });
  if (R.T.protein_g?.hardMax && a("p") > R.T.protein_g.hardMax) f.push({ id: "protein_cap", title: `Keep protein under ${R.T.protein_g.hardMax} g`, why: `Average ${fmt(a("p"))} g a day last week.`, how: "Smaller dal/paneer portions; more vegetables and roti.", src: R.T.protein_g.src[0] });
  if (R.T.potassium_mg?.hardMax && a("k") > R.T.potassium_mg.hardMax * 0.9) f.push({ id: "potassium", title: "Lower-potassium vegetables", why: `Average ${fmt(a("k"))} mg potassium vs ${fmt(R.T.potassium_mg.hardMax)} mg.`, how: "Swap palak, tomato gravies and bananas for bhindi, lauki, cabbage, apple.", src: "CLINICIAN" });
  if (R.T.fibre_g?.lo && a("fib") < R.T.fibre_g.lo * 0.8) f.push({ id: "fibre", title: "More fibre", why: `Average ${fmt(a("fib"))} g vs ${R.T.fibre_g.lo} g.`, how: "Whole dal, sprouts, salad with lunch, fruit instead of juice.", src: R.T.fibre_g.src[0] });
  const fried = days.reduce((n, k) => n + dayItems(S, k).filter(([c]) => DB.byCode[c]?.fried).length, 0);
  if (fried >= 3 && R.avoids.some(x => x.field === "deep_fried")) f.push({ id: "fried", title: "Fried food twice a week at most", why: `${fried} fried items last week.`, how: "Roasted chana or fruit as the evening snack.", src: R.avoids.find(x => x.field === "deep_fried").src });
  if (R.T.carb_g) { const sd = days.map(k => { const c = (S.logs[k] || []).filter(l => ["Breakfast", "Lunch", "Dinner"].includes(l.slot)).map(l => totalsOf(l.items).c); return c.length > 1 ? Math.max(...c) - Math.min(...c) : 0; }); if (avg(sd) > 40) f.push({ id: "carbs", title: "Even out carbs across meals", why: `Meals differed by ~${fmt(avg(sd))} g carbs on average.`, how: "Similar roti/rice portions at lunch and dinner.", src: R.T.carb_g.src[0] }); }
  if (days.length < 5) f.push({ id: "logging", title: "Log at least 5 days", why: `${days.length} of 7 days logged.`, how: "Use the recent-dish chips on Today to log in seconds.", src: "Pathya" });
  return { days: days.length, f };
}
function checkIn(R) {
  if (R.edRisk) return `<div class="card care" data-src="P_ED_RISK"><h4>Weekly check-in</h4><p class="small muted">Goals are paused. How did eating feel this week? You can talk it over with ${esc(S.team.doctor.name || "a professional")} or Tele-MANAS 14416.</p></div>`;
  const { days, f } = weekFindings(R), active = S.goals.filter(g => !g.done);
  return `<div class="card"><div class="row"><h4 style="margin:0">Weekly check-in</h4><span class="tiny muted">${days}/7 days logged</span></div>
    ${active.length ? `<h5>This week's goals</h5>${active.map(g => `<div class="item"><div class="row"><b class="small">🎯 ${esc(g.title)}</b><button class="btn sm" data-act="goalDone" data-v="${g.id}">Done</button></div><div class="tiny muted">${esc(g.how)}</div></div>`).join("")}` : ""}
    ${f.length ? `<h5>Pick up to 2 goals${active.length ? " for next week" : ""}</h5>${f.slice(0, 3).map(x => `<div class="item"><div class="row top"><div class="grow"><b class="small">${esc(x.title)}</b><div class="tiny muted">${esc(x.why)} ${srcTag(x.src)}</div><div class="tiny">${esc(x.how)}</div></div><button class="btn sm ${active.some(g => g.id === x.id) ? "" : "primary"}" data-act="goalPick" data-v="${x.id}" ${active.length >= 2 && !active.some(g => g.id === x.id) ? "disabled" : ""}>${active.some(g => g.id === x.id) ? "Chosen" : "Choose"}</button></div></div>`).join("")}<div class="tiny muted" style="margin-top:6px">You choose the goals: at most 2 at a time, small changes, built around food you love.</div>` : `<div class="empty">Nothing to fix from last week. Keep going!</div>`}</div>`;
}

/* ---------- Rules in effect (transparency) ---------- */
function careRules(R) {
  const ho = x => x.handoff && HANDOFF[x.handoff] ? pill(HANDOFF[x.handoff][0], HANDOFF[x.handoff][1]) : "";
  const targets = Object.values(R.T).filter(t => t.key !== "energy_kcal" || !R.hideCalories);
  const impacts = careImpacts(R);
  return `<div class="card"><h4>Why Pathya suggests what it does</h4><p class="small muted" style="margin:0">Pathya merges your goal, conditions, medicines, food practice and modes into one care profile. Every screen reads from it.</p>
    <button class="btn sm" style="margin-top:8px" data-act="hl">${UI.hl ? "Hide" : "Show"} what Care changed on each screen</button></div>
    <div class="card"><h4>Active pathways · merge order</h4>${R.paths.map(x => `<div class="row top" style="padding:6px 0;border-bottom:1px solid var(--cp-border)"><span class="src" style="min-width:26px;text-align:center">${x.precedence}</span><div class="grow"><b class="small">${esc(x.name)}</b> ${srcTag(x.id)}<div class="tiny muted">${esc(x.kind.replace("_", " "))}${x.handoff_message ? " · " + esc(x.handoff_message) : ""}</div></div>${ho(x)}</div>`).join("") || `<div class="empty">Nothing active yet.</div>`}<div class="tiny muted" style="margin-top:6px">Order: safety › your clinician's limits › clinician-led conditions › medicines › other conditions › goals › taste.</div></div>
    ${R.conflicts.length || R.notes.length ? `<div class="card care" data-src="merge engine"><h4>Conflicts resolved</h4><ul class="list">${R.conflicts.map(c => `<li class="small">${esc(c.text)}</li>`).join("")}${R.notes.map(n => `<li class="small">${esc(n)}</li>`).join("")}</ul></div>` : ""}
    <div class="card"><h4>Targets</h4>${targets.map(t => `<div class="row small" style="padding:5px 0;border-bottom:1px solid var(--cp-border)"><span>${t.hard ? "🔒" : "◦"} ${esc(t.label)}<br><span class="tiny muted">${esc((t.why || [])[0] || "")}</span></span><span style="text-align:right"><b>${t.warn && !t.target ? "warn < " + fmt(t.warn) : t.lo != null && t.hi != null ? fmt(t.lo) + "–" + fmt(t.hi) : t.hi != null ? "≤ " + fmt(t.hi) : t.lo != null ? "≥ " + fmt(t.lo) : fmt(t.target)} ${esc(t.unit)}</b><br>${(t.src || []).slice(0, 2).map(srcTag).join(" ")}</span></div>`).join("")}</div>
    ${R.blocks.length || R.gates.length || R.excludes.length ? `<div class="card"><h4>Must-follow: blocks, locks &amp; exclusions</h4>${R.blocks.map(b => `<div class="small" style="padding:4px 0">⛔ ${esc(b.why || b.id)} ${b.src.slice(0, 2).map(srcTag).join(" ")}</div>`).join("")}${R.gates.map(g => `<div class="small" style="padding:4px 0">🔐 ${esc(g.why)} ${srcTag(g.src)} ${(S.gatesOK || {})[g.id] ? pill("Doctor OK on file", "ok") : ""}</div>`).join("")}${R.excludes.map(x => `<div class="small" style="padding:4px 0">🚫 ${esc(x.why)} ${srcTag(x.src)}</div>`).join("")}</div>` : ""}
    ${R.avoids.length || R.prefers.length || R.patterns.length ? `<div class="card"><h4>Food patterns &amp; timing</h4>${R.patterns.slice(0, 14).map(x => `<div class="small" style="padding:4px 0">${x.strength === "hard" ? "🔒" : "◦"} ${esc(x.text)} ${srcTag(x.src)}</div>`).join("")}${R.avoids.map(x => `<div class="small" style="padding:4px 0">↓ ${esc(x.why)} ${srcTag(x.src)}</div>`).join("")}${R.prefers.map(x => `<div class="small" style="padding:4px 0">↑ ${esc(x.why)} ${srcTag(x.src)}</div>`).join("")}</div>` : ""}
    ${R.flags.length ? `<div class="card"><h4>Safety net: I watch for</h4>${R.flags.map(f => `<div class="note lvl-${/112|emergency|urgent/.test(f.act) ? "danger" : "info"}"><b class="t">${esc(f.sig)}</b>→ ${esc(f.act.replace(/_/g, " "))} ${srcTag(f.src)}</div>`).join("")}</div>` : ""}
    <div class="card"><h4>How Care changes each tab</h4>${Object.entries(impacts).map(([tab, list]) => `<h5>${tab}</h5>${list.length ? `<ul class="list">${list.map(([t, s]) => `<li class="small">${esc(t)} ${srcTag(s)}</li>`).join("")}</ul>` : `<div class="tiny muted">Baseline Pathya.</div>`}`).join("")}</div>
    <div class="card"><h4>What Pathya won't do</h4><ul class="list small"><li>Change, stop or time a medicine dose</li><li>Diagnose a condition or interpret lab results</li><li>Override limits set by your doctor</li><li>Share anything without your say-so</li></ul></div>
    ${R.errors.length ? `<div class="card"><h4>Rules not applied</h4><div class="tiny muted">${R.errors.slice(0, 6).map(esc).join("<br>")}</div></div>` : ""}`;
}
function careImpacts(R) {
  const I = { Today: [], Calendar: [], "Diet chart": [], Chat: [], "Medical report": [], Profile: [] };
  const a = (t, x, s) => I[t].push([x, s]);
  if (R.edRisk) { Object.keys(I).forEach(t => a(t, "Calories, weight and deficits hidden; no food judgement", "P_ED_RISK")); return I; }
  if (R.has("P_CKD")) a("Today", "“Kidney limits” card: protein cap, potassium, phosphorus", "P_CKD");
  if (R.has("P_GLP1")) a("Today", "“Protein first” card, eating times, fluids; no calorie target", "P_GLP1");
  if (R.T.carb_g) a("Today", "“Carbs across meals” card with a per-meal budget", R.T.carb_g.src[0]);
  if (R.blocked("meal_skipping")) a("Today", "Meal-timing guard: overdue meals escalate", R.blocks.find(b => b.id === "meal_skipping").src[0]);
  if (S.meds.length) a("Today", "Medicine reminders at your dose times", "Medicines");
  for (const t of Object.values(R.T)) if (careSrc(t).length && t.key !== "energy_kcal") a("Today", `${t.label} ${t.hi != null ? "≤ " + fmt(t.hi) : "≥ " + fmt(t.lo)} ${t.unit} bar; meals checked before saving`, careSrc(t)[0]);
  for (const x of R.excludes) a("Diet chart", "Excluded: " + x.why.split(".")[0], x.src);
  for (const x of R.avoids) a("Diet chart", "Less often: " + x.why.split(".")[0], x.src);
  if (R.mealsMin >= 4) a("Diet chart", `${R.mealsMin}+ eating times a day`, "P_GLP1");
  const tr = trackers(R);
  if (tr.has("glucose")) a("Calendar", "Glucose overlay: lows red, highs amber", "P_T2D");
  if (tr.has("bp")) a("Calendar", "Home BP overlay", "P_HTN");
  if (tr.has("dose")) a("Calendar", "Dose days and nausea", "P_GLP1");
  if (tr.has("period")) a("Calendar", "Cycle overlay", "P_PCOS");
  if (tr.has("labs")) a("Calendar", "Lab results", "Labs");
  for (const f of R.flags.slice(0, 4)) a("Chat", `Watches for: ${f.sig.slice(0, 60)}`, f.src);
  a("Chat", "Medicine-dose questions go to your doctor, never answered", "Safety");
  if (S.conditions.length || S.meds.length) a("Medical report", "Conditions, medicines with dose and duration, key metrics, questions for your doctor", "Care profile");
  if (R.has("P_PCOS")) a("Profile", "Copy avoids weight-stigmatising language", "P_PCOS");
  if (R.excludes.some(x => x.field === "jain_ok")) a("Profile", "Cook sheet says no aloo, pyaaz, lahsun", "P_JAIN");
  if (Object.keys(S.limits).length) a("Profile", "Every limit shows who set it and when", "CLINICIAN");
  return I;
}
