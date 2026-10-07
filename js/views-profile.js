"use strict";
/* Pathya Care — Profile, Welcome and bottom sheets. */

const DIETS = [["veg", "Vegetarian"], ["egg", "Eggetarian"], ["nonveg", "Non-vegetarian"], ["vegan", "Vegan"], ["jain", "Jain"]];
const REGIONS = [["north", "North Indian"], ["south", "South Indian"], ["west", "West (Gujarati/Marathi)"], ["east", "East (Bengali/Odia)"], ["pan_indian", "Mixed / pan-Indian"]];
const ALLERGY_LIST = ["gluten", "peanut", "tree_nut", "soy", "sesame", "mustard", "coconut", "milk", "egg", "fish", "crustacean"];
const JAIN_OPTS = ["Avoid sprouts", "Avoid dvidal (curd/chaas with pulses or besan)", "No food after sunset (chauvihar)"];
const GOALS = [["lose", "Lose weight"], ["maintain", "Eat healthier, stay the same"], ["gain", "Gain weight"], ["muscle", "Build muscle"]];
const sel = (bind, opts, val) => `<select data-bind="${bind}">${opts.map(([v, l]) => `<option value="${v}" ${String(val) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const inp = (bind, val, type = "text", ph = "", extra = "", aria = "") => `<input data-bind="${bind}" type="${type}" value="${esc(val ?? "")}" placeholder="${esc(ph)}" aria-label="${esc(aria || ph || bind.split(".").pop())}" ${extra}>`;
const fld = (label, html) => `<label class="field"><span class="lbl">${label}</span>${html}</label>`;

function vProfile(R) {
  const p = S.profile, t = S.team, synced = accountsOn() && SYNC.user && !S.demo;
  let h = `<div class="row start" style="margin-bottom:12px"><span class="avatar" style="width:46px;height:46px;font-size:19px">${esc((p.name || "?")[0])}</span><div><div class="h1">${esc(p.name || "Your profile")}</div><div class="tiny muted">${synced ? "Saved to your Pathya account" : "Everything here stays on this device"}</div></div></div>`;
  h += accountCard();
  h += `<div class="card" id="sec-about"><h4>About you</h4>${fld("Name", inp("profile.name", p.name, "text", "Your name"))}<div class="grid3">${fld("Age", inp("profile.age", p.age, "number", "", 'min="10" max="110"'))}${fld("Sex", sel("profile.sex", [["female", "Female"], ["male", "Male"]], p.sex))}${fld("Height (cm)", inp("profile.height", p.height, "number"))}</div>
    <div class="grid3">${R.hideCalories ? "" : fld("Weight (kg)", inp("profile.weight", p.weight, "number", "", 'step="0.1"'))}${fld("Waist (cm)", inp("profile.waist", p.waist, "number"))}${fld("Activity", sel("profile.activity", [["sedentary", "Sedentary"], ["light", "Light"], ["moderate", "Moderate"], ["active", "Active"]], p.activity))}</div>
    <div class="tiny muted">Measured burn: ${R.hideCalories ? "hidden" : fmt(R.burn) + " kcal/day"} · BMR ${R.hideCalories ? "hidden" : fmt(R.bmr)}</div></div>`;
  h += `<div class="card" id="sec-goal"><h4>Goal</h4>${R.edRisk ? `<div class="note lvl-info">Goals are paused while the eating-disorder safety path is on. That's how we keep things safe.</div>` : `<div class="chips">${GOALS.map(([v, l]) => `<button class="chip ${p.goal === v ? "on" : ""}" data-act="setGoal" data-v="${v}" ${p.pregnancy !== "No" && v === "lose" ? "disabled" : ""}>${l}</button>`).join("")}</div>${p.pregnancy !== "No" ? `<div class="tiny muted" style="margin-top:6px">Weight loss is off during pregnancy and breastfeeding.</div>` : ""}${R.blocked("deficit") && p.goal === "lose" ? `<div class="note lvl-warn">${esc(R.blocks.find(b => b.id === "deficit" || b.id.endsWith("_deficit")).why)}</div>` : ""}`}</div>`;
  h += `<div class="card" id="sec-food"><h4>Food</h4><div class="grid2">${fld("Diet", sel("profile.diet", DIETS, p.diet))}${fld("Cuisine", sel("profile.region", REGIONS, p.region))}</div>
    ${p.diet === "jain" ? `<div class="lbl">Jain practice</div>${JAIN_OPTS.map(o => `<label class="check"><input type="checkbox" data-act="jainOpt" data-v="${esc(o)}" ${(p.jainDetail || []).includes(o) ? "checked" : ""}> ${esc(o)}</label>`).join("")}` : ""}
    <div class="lbl" style="margin-top:6px">Food allergies (hard exclusions)</div><div class="chips">${ALLERGY_LIST.map(a => { const x = (p.allergies || []).find(y => y.item === a); return `<button class="chip ${x ? "on" : ""}" data-act="allergy" data-v="${a}">${cap(a.replace("_", " "))}${x?.severity === "severe" ? " ⚠" : ""}</button>`; }).join("")}</div>
    ${(p.allergies || []).length ? `<div class="tiny muted" style="margin-top:4px">Tap an allergy again to mark it severe, a third time to remove it.</div>` : ""}
    ${fld("Foods you dislike", inp("profile.dislikes", p.dislikes, "text", "e.g. karela, baingan"))}${fld("Must-keep foods (never removed from plans)", inp("profile.mustKeep", p.mustKeep, "text", "e.g. morning chai, rajma on Sundays"))}</div>`;
  h += `<div class="card" id="sec-life"><h4>Lifestyle</h4><div class="grid2">${fld("Who cooks most meals?", sel("profile.whoCooks", [["Me", "Me"], ["Family member", "Family member"], ["Cook", "A cook"]], p.whoCooks))}${fld("Shift work?", sel("profile.shift", [["No", "No"], ["Rotating", "Rotating shifts"], ["Night", "Night shifts"]], p.shift))}</div>${fld("Language for cook sheets", sel("profile.language", [["English", "English + हिन्दी"]], p.language))}</div>`;
  h += `<div class="card" id="sec-team"><h4>Care team</h4><div class="lbl">Doctor</div><div class="grid3">${inp("team.doctor.name", t.doctor.name, "text", "Name", "", "Doctor name")}${inp("team.doctor.spec", t.doctor.spec, "text", "Speciality", "", "Doctor speciality")}${inp("team.doctor.phone", t.doctor.phone, "tel", "+91…", "", "Doctor phone")}</div>
    <div class="lbl" style="margin-top:8px">Dietitian</div><div class="grid2">${inp("team.dietitian.name", t.dietitian.name, "text", "Name", "", "Dietitian name")}${inp("team.dietitian.phone", t.dietitian.phone, "tel", "+91…", "", "Dietitian phone")}</div>
    <div class="lbl" style="margin-top:8px">Family member / caregiver</div><div class="grid3">${inp("team.caregiver.name", t.caregiver.name, "text", "Name", "", "Family member name")}${inp("team.caregiver.rel", t.caregiver.rel, "text", "Relation", "", "Relation")}${inp("team.caregiver.phone", t.caregiver.phone, "tel", "+91…", "", "Family member phone")}</div>
    <label class="check"><input type="checkbox" data-act="toggle" data-v="team.caregiver.notify" ${t.caregiver.notify ? "checked" : ""}> Let them get urgent alerts (only if I tap “Tell” on an escalation)</label></div>`;
  h += `<div class="card" id="sec-privacy"><h4>Privacy &amp; data</h4><div class="note lvl-ok">${synced ? "Your health data is encrypted and kept in your Pathya account in India, with a copy on this phone for offline use. Reports leave only when you print or share them." : "Your health data is stored only in this browser on this device. Nothing is uploaded. Reports leave the phone only when you print or share them."}</div>
    <label class="check"><input type="checkbox" data-act="toggle" data-v="privacy.showCalories" ${S.privacy.showCalories && !R.hideCalories ? "checked" : ""} ${R.hideCalories ? "disabled" : ""}> Show calories${R.hideCalories ? " (locked off by the safety path)" : ""}</label>
    <label class="check"><input type="checkbox" data-act="toggle" data-v="privacy.reminders" ${S.privacy.reminders ? "checked" : ""}> Medicine and reading reminders on Today</label>
    <div class="btns"><button class="btn sm" data-act="exportData">Export a copy (file)</button><label class="btn sm" style="cursor:pointer">Import<input type="file" id="importData" accept="application/json" hidden></label>${synced ? "" : '<button class="btn sm danger" data-act="deleteAll">Delete everything</button>'}</div></div>`;
  if (!accountsOn() || S.demo) h += `<div class="card" id="sec-demo"><h4>Demo</h4><div class="tiny muted" style="margin-bottom:8px">Switch to a sample person, or try a moment to see how the whole app reacts.</div><div class="chips">${Object.entries(DEMOS).map(([id, d]) => `<button class="chip ${S.demo === id ? "on" : ""}" data-act="demo" data-v="${id}">${esc(d.profile.name.split(" ")[0])}</button>`).join("")}<button class="chip" data-act="${accountsOn() ? "acctStartOwn" : "welcome"}">Start my own</button></div>
    <h5>Try a moment</h5><div class="chips">${scenarios(R).map(([a, l]) => `<button class="chip" data-act="scenario" data-v="${a}">${l}</button>`).join("")}</div>
    <h5>Clock</h5><div class="row"><button class="btn sm" data-act="clock" data-v="-60">− 1 h</button><b>${clock(now())}${UI.fakeNow != null ? " (simulated)" : ""}</b><button class="btn sm" data-act="clock" data-v="60">+ 1 h</button></div>
    <label class="check"><input type="checkbox" data-act="hl" ${UI.hl ? "checked" : ""}> Highlight everything Care changed, with the rule that caused it</label></div>`;
  h += `<div class="card"><h4>About</h4><div class="small">Pathya Care · built on the Pathya food database (${DB.dishes.length} foods with nutrients) and the Pathya dietitian kit (${Object.keys(DB.pathways).length} pathways, ${Object.keys(DB.drugs).length} medicine classes).</div><div class="tiny muted" style="margin-top:6px">${esc(DB.meta.licence)} Pathya gives food guidance, not medical advice.</div></div>`;
  return h;
}
function scenarios(R) {
  const s = [];
  if (R.has("P_T2D") || R.has("P_T1D")) s.push(["lowGlucose", "🩸 Glucose 62"], ["highGlucose", "🩸 Glucose 320"]);
  if (R.blocked("meal_skipping")) s.push(["missLunch", "⏰ 2:30 pm, no lunch"]);
  if (R.has("P_HTN")) s.push(["bpEmergency", "❤️ BP 182/118 + chest pain"]);
  if (R.has("P_GLP1")) s.push(["doseUp", "💉 Dose increased"], ["vomit", "🤢 Vomiting"]);
  if (R.has("P_CKD")) s.push(["labK", "🧪 Potassium 5.6"]);
  s.push(["scoff", "🧠 Eating screen positive"], ["sick", "🤒 Sick day"], ["festival", "🎉 Wedding week"]);
  return s;
}

/* ---------- Welcome ---------- */
function vWelcome() {
  const acc = SYNC.api !== false;
  return `<div class="welcome"><div class="hero"><div class="hero-t"><div class="row start" style="gap:10px">${LOGO}<span class="brand" style="font-size:26px">Pathya</span></div>
      <h1 class="htitle">Eat what suits your health.</h1>
      <p class="hsub">Pathya checks your everyday Indian meals against your conditions and medicines: diabetes, BP, kidney, PCOS, thyroid, GLP-1 and more. You get a diet chart you'll actually follow, and your doctor stays in the loop.</p>
      <div class="btns">${acc ? `<a class="btn primary" href="#auth">Create free account</a><a class="btn" href="#try">Try a sample person</a>` : `<a class="btn primary" href="#try">Try a sample person</a><a class="btn" href="#setup">Set it up for me</a>`}</div></div>
      <div class="vps">
        <div class="vp"><span>🍛</span><b>Real Indian food</b><small>${DB.dishes.length} dishes and staples with ICMR-NIN (IFCT) nutrition</small></div>
        <div class="vp"><span>🩺</span><b>Built around you</b><small>${Object.keys(DB.pathways).length} care pathways, ${Object.keys(DB.drugs).length} medicine food-rules, Jain and vrat aware</small></div>
        <div class="vp"><span>🗓️</span><b>Diet chart + cook sheet</b><small>7-day plan your cook can follow, in Hindi and English</small></div>
        <div class="vp"><span>🔒</span>${acc ? "<b>Private and secure</b><small>Encrypted and stored in India. Download or delete it anytime</small>" : "<b>Private by design</b><small>Your health data never leaves this phone unless you share it</small>"}</div>
      </div></div>
    <div class="card" id="try"><h4>Try a sample person</h4><p class="tiny muted" style="margin-top:-4px">See how Pathya changes for each condition. You can switch anytime.</p>${Object.entries(DEMOS).map(([id, d]) => `<button class="item persona" data-act="demo" data-v="${id}"><span class="avatar">${d.profile.name[0]}</span><span class="grow"><b>${esc(d.profile.name)}, ${d.profile.age}</b><br><span class="tiny muted">${esc(d.blurb)}</span></span><span aria-hidden="true">›</span></button>`).join("")}</div>
    ${acc ? authCard() : `<div class="card" id="setup"><h4>Set it up for me</h4><p class="tiny muted" style="margin-top:-4px">About 2 minutes. Add conditions and medicines next.</p><div class="grid2">${fld("Name", '<input id="w-name" placeholder="Your name" autocomplete="given-name">')}${fld("Age", '<input id="w-age" type="number" inputmode="numeric" value="35">')}</div>
      <div class="grid3">${fld("Sex", '<select id="w-sex"><option value="female">Female</option><option value="male">Male</option></select>')}${fld("Height (cm)", '<input id="w-h" type="number" inputmode="numeric" value="160">')}${fld("Weight (kg)", '<input id="w-w" type="number" inputmode="decimal" value="65" step="0.1">')}</div>
      <div class="grid2">${fld("Diet", `<select id="w-diet">${DIETS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`)}${fld("Goal", `<select id="w-goal">${GOALS.map(([v, l]) => `<option value="${v}" ${v === "maintain" ? "selected" : ""}>${l}</option>`).join("")}</select>`)}</div>
      <label class="check"><input type="checkbox" id="w-consent"> I agree that Pathya may use the health details I enter to personalise food guidance. They stay on this device, and I can delete them anytime.</label>
      <button class="btn primary block" data-act="startFresh">Start</button></div>`}
    <div class="trust"><span>✓ Grounded in ICMR-NIN data</span><span>✓ Never changes your medicines</span><span>✓ Works offline</span><span>✓ Emergency? Call <a href="tel:112">112</a></span></div>
    <p class="tiny muted" style="text-align:center">${esc(DB.meta.licence)} Pathya gives food guidance, not medical advice.</p></div>`;
}

/* ---------- sheets ---------- */
function vSheet(R) {
  const sh = UI.sheet; if (!sh) return "";
  let h = acctSheet(sh) || "";
  if (sh.type === "addCond") {
    const avail = COND_LIST.filter(([id]) => !S.conditions.some(c => c.id === id));
    h = `<h4>Add a condition</h4><p class="tiny muted">Only what a doctor has told you. Everything in the app adapts.</p><div class="chips">${avail.map(([id, l]) => `<button class="chip ${sh.sel === id ? "on" : ""}" data-act="condPick" data-v="${id}">${esc(l)}</button>`).join("")}</div>
      ${sh.sel ? `<div class="grid2" style="margin-top:10px">${fld("Since (year)", `<input id="c-since" type="number" placeholder="${TODAY.getFullYear()}">`)}${fld("Confirmed by a doctor?", '<select id="c-conf"><option value="1">Yes</option><option value="0">Not yet</option></select>')}</div>${(() => { const path = Object.values(DB.pathways).find(x => (x.triggers || []).some(t => t.includes(`'${sh.sel}'`))); return path?.handoff_message ? `<div class="note lvl-info">${esc(path.handoff_message)}</div>` : ""; })()}<button class="btn primary block" style="margin-top:10px" data-act="condAdd">Add ${esc(COND_NAME[sh.sel])}</button>` : ""}`;
  }
  if (sh.type === "addMed") {
    const m = sh.med;
    if (!m) h = `<h4>Add a medicine</h4><input id="medSearch" aria-label="Search medicines" placeholder="Type the brand or generic name, e.g. Amaryl, Telma, Thyronorm" autocomplete="off"><div id="medResults" class="suggest">${medResults("")}</div><div class="tiny muted" style="margin-top:6px">${Object.keys(DB.drugs).length} medicine classes with food rules from the dietitian kit.</div>`;
    else h = `<h4>${esc(m.brand || m.generic)}</h4><div class="note lvl-info">${m.cls && DB.drugs[m.cls] ? `Is <b>${esc(m.brand || m.generic)}</b> the same as <b>${esc(m.generic)}</b>? ${esc(DB.drugs[m.cls].issue)}` : "No food rules for this medicine. Pathya will still list it in your report."}</div>
      <div class="grid3" style="margin-top:10px">${fld("Brand", `<input id="m-brand" value="${esc(m.brand || "")}">`)}${fld("Dose", `<input id="m-dose" type="number" step="any" value="${esc(m.dose ?? "")}">`)}${fld("Unit", `<select id="m-unit">${["mg", "mcg", "units", "ml", "tablet"].map(u => `<option ${m.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select>`)}</div>
      <div class="grid2">${fld("How often", `<select id="m-freq">${FREQ.map(f => `<option ${m.freq === f ? "selected" : ""}>${f}</option>`).join("")}</select>`)}${fld("When", `<select id="m-timing">${TIMING.map(f => `<option ${m.timing === f ? "selected" : ""}>${f}</option>`).join("")}</select>`)}</div>
      <div class="grid3">${fld("Started (year or month)", `<input id="m-start" placeholder="2024 or 2024-05" value="${esc(m.start || "")}">`)}${fld("How long", `<select id="m-dur">${["Ongoing", "Until", "Course"].map(f => `<option ${m.duration === f ? "selected" : ""} value="${f}">${{ Ongoing: "Ongoing", Until: "Until a date", Course: "A course (days)" }[f]}</option>`).join("")}</select>`)}${fld("Until / days", `<input id="m-until" placeholder="2026-12-31 or 7" value="${esc(m.until || m.days || "")}">`)}</div>
      ${["glp1", "insulin"].includes(m.cls) ? fld("Dose last changed on", `<input id="m-inc" type="date" value="${esc(m.increasedOn || "")}">`) : ""}
      <label class="check"><input type="checkbox" id="m-ok" ${m.confirmed !== false ? "checked" : ""}> Yes, ${esc(m.brand || m.generic)} = ${esc(m.generic)}</label>
      <button class="btn primary block" data-act="medSave">Save medicine</button>`;
  }
  if (sh.type === "track" || sh.type === "addReading") h = readingForm(sh.v || "glucose", R);
  if (sh.type === "addLimit") h = `<h4>Add a limit from your doctor</h4><div class="grid2">${fld("Nutrient", `<select id="l-k">${Object.entries(LIMIT_KEYS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>`)}${fld("Max per day", '<input id="l-v" type="number" placeholder="e.g. 2000">')}</div><div class="grid2">${fld("Set by", `<input id="l-by" value="${esc(S.team.doctor.name || "")}">`)}${fld("Date", `<input id="l-d" type="date" value="${TODAY_KEY}">`)}</div><div class="tiny muted">mg for potassium, phosphorus and sodium; g for protein. Pathya never changes these.</div><button class="btn primary block" style="margin-top:10px" data-act="limitSave">Save limit</button>`;
  if (sh.type === "screen") { const s = DB.screeners[sh.v]; h = `<h4>${esc(s.name)}</h4><p class="tiny muted">${esc(s.purpose)}. Your answers ${whereKept()}. You can stop anytime.</p>${s.items.map((it, i) => { const text = typeof it === "string" ? it : it.text, opts = typeof it === "string" ? s.answers : it.options; return `<div class="field"><label>${i + 1}. ${esc(text)}</label><select id="q-${i}">${Object.entries(opts).map(([l, v]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div>`; }).join("")}<button class="btn primary block" data-act="screenSave" data-v="${sh.v}">See result</button>`; }
  if (sh.type === "docMeta") h = `<h4>Save document</h4>${sh.mime?.startsWith("image") ? `<img src="${sh.data}" alt="" style="max-width:100%;max-height:220px;border-radius:12px;display:block;margin:0 auto 10px">` : `<div class="thumb" style="margin:0 auto 10px">📄</div>`}<div class="grid2">${fld("Type", `<select id="d-type">${["Lab report", "Prescription", "Discharge summary", "Scan / X-ray", "Other"].map(t => `<option>${t}</option>`).join("")}</select>`)}${fld("Date", `<input id="d-date" type="date" value="${TODAY_KEY}">`)}</div>${fld("Title", `<input id="d-title" placeholder="e.g. KFT + HbA1c, Apollo" value="${esc(sh.name || "")}">`)}${fld("Note", '<input id="d-note" placeholder="Optional">')}<div class="tiny muted">Pathya doesn't read values from documents. Add the key numbers yourself after saving.</div><button class="btn primary block" style="margin-top:10px" data-act="docSave">Save to Medical report</button>`;
  if (sh.type === "docView") { const d = S.docs.find(x => x.id === sh.v); h = d ? `<h4>${esc(d.title || d.type)}</h4><div class="tiny muted">${esc(d.type)} · ${nice(d.d)}</div>${d.mime?.startsWith("image") ? `<img src="${d.data}" alt="" style="width:100%;border-radius:12px;margin-top:10px">` : `<a class="btn block" style="margin-top:10px" href="${d.data}" download="${esc((d.title || "document").replace(/\s+/g, "-"))}.pdf">Download PDF</a>`}<div class="btns"><button class="btn sm" data-act="sheet" data-v="addReading">Add values from this report</button></div>` : ""; }
  if (sh.type === "grocery") { const g = groceryList(planWeek(S, R)); h = `<h4>Grocery list · this week</h4><p class="tiny muted">Main ingredients from your 7-day diet chart (how often each appears).</p><ul class="list">${g.map(([n, c]) => `<li class="small">${esc(n)} <span class="muted">×${c}</span></li>`).join("")}</ul><button class="btn block" data-act="shareGrocery">Share on WhatsApp</button>`; }
  if (sh.type === "cook") h = `<h4>Cook sheet</h4><p class="tiny muted">Built from your rules. Show it to whoever cooks.</p>${cookLines(R, S).map(([en, hi]) => `<div class="item"><div class="small"><b>${esc(en)}</b></div><div class="small muted">${esc(hi)}</div></div>`).join("")}<button class="btn block" style="margin-top:10px" data-act="shareCook">Share on WhatsApp</button>`;
  return `<div class="sheet-bg" data-act="closeSheet"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${h}<button class="btn block" style="margin-top:12px" data-act="closeSheet">Close</button></div></div>`;
}
function medResults(q) {
  const t = norm(q), res = [];
  for (const d of Object.values(DB.drugs)) {
    for (const b of d.brands) if (!t || norm(b).startsWith(t) || norm(b).includes(t)) res.push([b, d.generics[0], d.class_id]);
    for (const g of d.generics) if (!t || norm(g).includes(t)) res.push(["", g, d.class_id]);
  }
  const uniq = [...new Map(res.map(r => [r.join("|"), r])).values()].slice(0, t ? 10 : 8);
  return uniq.map(([b, g, c]) => `<button data-act="medPick" data-b="${esc(b)}" data-g="${esc(g)}" data-c="${esc(c)}"><b>${esc(b || g)}</b>${b ? ` <span class="muted">= ${esc(g)}</span>` : ""} <span class="tiny muted">· ${esc(c.replace(/_/g, " "))}</span></button>`).join("") + (t ? `<button data-act="medPick" data-b="${esc(q)}" data-g="${esc(q)}" data-c=""><b>${esc(q)}</b> <span class="tiny muted">· add without food rules</span></button>` : "");
}
function readingForm(key, R) {
  const opts = Object.entries(METRICS).filter(([k, m]) => !["dose"].includes(k) && !(k === "weight" && R.hideCalories));
  const m = METRICS[key] || METRICS.glucose;
  let body = "";
  if (key === "bp") body = `<div class="grid2">${fld("Systolic", '<input id="r-v" type="number" placeholder="130">')}${fld("Diastolic", '<input id="r-v2" type="number" placeholder="85">')}</div><div class="lbl">Any of these right now?</div>${["Chest pain", "Breathlessness", "Weakness or confusion"].map((s, i) => `<label class="check"><input type="checkbox" id="r-s${i}"> ${s}</label>`).join("")}`;
  else if (key === "glucose") body = `<div class="grid2">${fld("mg/dL", '<input id="r-v" type="number" placeholder="e.g. 128">')}${fld("When", `<select id="r-ctx">${["Fasting", "Before a meal", "2 h after a meal", "Random", "Bedtime"].map(c => `<option>${c}</option>`).join("")}</select>`)}</div><label class="check"><input type="checkbox" id="r-s0"> I feel shaky, sweaty or confused</label><label class="check"><input type="checkbox" id="r-s1"> Someone had to help me</label>`;
  else if (key === "nausea") body = `${fld("Nausea", `<select id="r-v">${["0 · none", "1 · mild", "2 · moderate", "3 · severe"].map((l, i) => `<option value="${i}">${l}</option>`).join("")}</select>`)}${["Vomiting, can't keep fluids down", "Severe or persistent stomach pain", "Heavy hair loss, bruising or marked weakness"].map((s, i) => `<label class="check"><input type="checkbox" id="r-s${i}"> ${s}</label>`).join("")}`;
  else if (key === "period") body = `<p class="small">Mark today as day 1 of your period.</p><input id="r-v" type="hidden" value="1">`;
  else if (key === "symptom") body = fld("What happened?", '<input id="r-note" placeholder="e.g. bloating after lunch, 2/3">') + '<input id="r-v" type="hidden" value="1">';
  else if (key === "strength" || key === "activity") body = fld("Minutes", '<input id="r-v" type="number" value="30">');
  else body = fld(`${m[0]} (${m[1]})`, '<input id="r-v" type="number" step="any">');
  return `<h4>Add a reading</h4>${fld("What", `<select data-act="readingKey">${opts.map(([k, x]) => `<option value="${k}" ${k === key ? "selected" : ""}>${x[0]}</option>`).join("")}</select>`)}${body}
    <div class="grid2">${fld("Date", `<input id="r-d" type="date" value="${TODAY_KEY}" max="${TODAY_KEY}">`)}${key !== "symptom" ? fld("Note", '<input id="r-note" placeholder="Optional">') : ""}</div>
    ${METRICS[key]?.[2] === "lab" ? '<div class="tiny muted">Saved for your doctor. Pathya does not interpret lab results.</div>' : ""}<button class="btn primary block" style="margin-top:10px" data-act="readingSave" data-v="${key}">Save</button>`;
}
