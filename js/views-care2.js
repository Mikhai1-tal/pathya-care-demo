"use strict";
/* Pathya Care — Care tab: Diet chart, Chat, Medical report, Doctor escalation. */

/* ---------- Diet chart ---------- */
function carePlan(R) {
  if (R.blocked("planner")) return `<div class="card care" data-src="P_POST_BARIATRIC"><h4>Diet chart is off</h4><p class="small">${esc(R.paths.find(p => p.id === "P_POST_BARIATRIC")?.handoff_message || "Your surgical team's diet stages lead.")}</p><p class="small muted">You can still log meals on Today, and Pathya will check them against your rules.</p></div>`;
  if (R.edRisk) return `<div class="card care" data-src="P_ED_RISK"><h4>A gentle rhythm, no numbers</h4><ul class="list"><li>Breakfast: something you enjoy, with a protein</li><li>Mid-morning snack</li><li>Lunch: a full plate</li><li>Evening snack</li><li>Dinner: a full plate</li></ul><div class="note lvl-info"><b class="t">Talk to someone</b>Tele-MANAS (free, 24×7): <b>14416</b></div></div>`;
  const days = planWeek(S, R), di = Math.min(UI.planDay, 6), day = days[di];
  const names = [...Array(7)].map((_, i) => { const d = new Date(TODAY); d.setDate(d.getDate() + i); return i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short" }); });
  const showK = !R.hideCalories && S.privacy.showCalories;
  let h = `<div class="card care" data-src="constrained planner · ${DB.dishes.filter(d => d.plan).length} plannable dishes"><div class="row"><h4 style="margin:0">Your diet chart${S.modes.fasting ? " · vrat" : S.modes.sick ? " · sick day" : ""}</h4>${pill(day.checks.ok ? "Safe for you ✓" : "Review with your dietitian", day.checks.ok ? "ok" : "warn")}</div>
    <div class="chips" style="margin:10px 0">${names.map((n, i) => `<button class="chip ${i === di ? "on" : ""}" data-act="planDay" data-v="${i}">${n}</button>`).join("")}</div>
    ${day.meals.map((m, si) => { const t = totalsOf(m.items); return `<div class="item"><div class="row"><b>${esc(m.slot)}</b><span class="tiny muted">${clock(m.mins)}${showK ? " · " + fmt(t.kcal) + " kcal" : ""}</span></div>
      ${m.items.map(([c, q]) => { const d = DB.byCode[c]; const ok = dishFlags(d, q, R, S).filter(f => f.lvl === "ok").slice(0, 1); return `<div class="row small" style="padding:3px 0"><span class="grow">${fmtQ(q)} × ${esc(dname(d))} <span class="tiny muted">${esc(d.unit)}</span></span>${ok.map(f => `<span class="nc">${esc(f.text.slice(0, 20))}</span>`).join("")}</div>`; }).join("")}
      <div class="nutr"><span class="nc">Protein ${fmt(t.p)} g</span>${R.T.carb_g ? `<span class="nc focus">Carbs ${fmt(t.c)} g</span>` : ""}${R.T.sodium_mg?.hi ? `<span class="nc">Na ${fmt(t.na)} mg</span>` : ""}${R.T.potassium_mg?.hardMax ? `<span class="nc focus">K ${fmt(t.k)} mg</span>` : ""}</div>
      <div class="btns"><button class="btn sm" data-act="planSwap" data-v="${di}-${si}">↻ Swap meal</button>${di === 0 ? `<button class="btn sm" data-act="planLog" data-v="${si}">Log this</button>` : ""}</div></div>`; }).join("")}
    <div class="btns"><button class="btn sm" data-act="planNew">New week</button><button class="btn sm" data-act="sheet" data-v="grocery">Grocery list</button><button class="btn sm" data-act="sheet" data-v="cook">Cook sheet</button><button class="btn sm" data-act="printPlan">Print</button></div></div>`;
  h += `<div class="card"><h4>Day check</h4><h5>Must-follow rules</h5>${day.checks.hard.map(x => `<div class="row small" style="padding:4px 0"><span>${x.ok ? "✅" : "❌"} ${esc(x.text)} ${srcTag(x.src)}</span><span class="muted">${esc(x.v)}</span></div>`).join("") || '<div class="tiny muted">No must-follow limits for you.</div>'}
    ${day.checks.soft.length ? `<h5>Aim for</h5>${day.checks.soft.map(x => `<div class="metric"><div class="row small"><span>${esc(x.text)} ${srcTag(x.src)}</span><span class="muted">${esc(x.v)}</span></div><div class="bar lvl-${x.pct >= 0.95 ? "ok" : "accent"}"><i style="width:${Math.max(4, Math.min(100, x.pct * 100)).toFixed(0)}%"></i></div></div>`).join("")}` : ""}</div>`;
  const style = [...new Set(R.paths.flatMap(p => p.kind === "drug_overlay" ? [] : (p.plan_style || [])))].slice(0, 5);
  if (style.length) h += `<div class="card"><h4>How this plan is built</h4><ul class="list">${style.map(s => `<li class="small">${esc(s)}</li>`).join("")}</ul></div>`;
  if (R.conflicts.length) h += `<div class="card care" data-src="merge engine"><h4>Conflicting advice I resolved</h4><ul class="list">${R.conflicts.map(c => `<li class="small">${esc(c.text)}</li>`).join("")}</ul></div>`;
  const locked = R.gates.filter(g => !(S.gatesOK || {})[g.id]);
  if (locked.length) h += `<div class="card"><h4>Locked until your doctor confirms</h4>${locked.map(g => `<div class="note lvl-warn">🔐 ${esc(g.why)} ${srcTag(g.src)}</div>`).join("")}</div>`;
  return h;
}

/* ---------- Chat ---------- */
function careChat(R) {
  const quick = ["Can I eat rajma?", "What should I eat for dinner?", "How much salt is left today?", "Can I keep a vrat?", "My sugar is 65", "Explain the Indian plate"];
  return `<div class="card" style="padding:10px 12px"><div class="row"><b class="small">Ask Pathya</b><span class="tiny muted">Answers come from your food database and care rules</span></div></div>
    <div class="chatlog" id="chatlog">${S.chat.slice(-40).map(m => `<div class="bubble ${m.role === "me" ? "me" : "bot"} ${m.level || ""}">${m.img ? `<img src="${m.img}" alt="Uploaded photo">` : ""}${m.role === "me" ? esc(m.text) : md(m.text)}${m.src && m.src.length ? `<div style="margin-top:6px">${[...new Set(m.src)].slice(0, 3).map(srcTag).join(" ")}</div>` : ""}${m.actions && m.actions.length ? `<div class="btns">${m.actions.map(([a, l, v]) => `<button class="btn sm" data-act="chatAct" data-a="${esc(a)}" data-v="${esc(v)}">${esc(l)}</button>`).join("")}</div>` : ""}</div>`).join("")}</div>
    <div class="chips" style="margin-top:10px">${quick.map(q => `<button class="chip" data-act="chatQuick" data-v="${esc(q)}">${esc(q)}</button>`).join("")}</div>
    ${UI.chatImg ? `<div class="row start" style="margin-top:8px"><img src="${UI.chatImg}" style="width:52px;height:52px;object-fit:cover;border-radius:10px" alt=""><span class="tiny muted">Photo ready to send</span><button class="btn sm ghost" data-act="chatImgClear">✕</button></div>` : ""}
    <div class="chatbar"><label class="iconbtn" title="Attach a photo">📷<input type="file" id="chatPhoto" accept="image/*" hidden></label><textarea id="chatInput" rows="1" placeholder="Ask about any food, your targets or how you feel…" aria-label="Message"></textarea><button class="iconbtn primary" data-act="chatSend" aria-label="Send">➤</button></div>`;
}

/* ---------- Medical report ---------- */
function reportData(R) {
  const p = S.profile, rs = S.readings, since = dOff(30);
  const inRange = r => r.d >= since;
  const gF = rs.filter(r => r.key === "glucose" && r.ctx === "Fasting" && inRange(r)).map(r => r.v), gP = rs.filter(r => r.key === "glucose" && /after/.test(r.ctx || "") && inRange(r)).map(r => r.v), lows = rs.filter(r => r.key === "glucose" && r.v < 70 && inRange(r));
  const bp = rs.filter(r => r.key === "bp" && inRange(r)), w = rs.filter(r => r.key === "weight").sort((a, b) => a.d.localeCompare(b.d)), naus = rs.filter(r => r.key === "nausea" && inRange(r));
  const labs = Object.keys(METRICS).filter(k => METRICS[k][2] === "lab").map(k => latest(S, k)).filter(Boolean);
  const logDays = Object.keys(S.logs).filter(k => k >= dOff(14) && k < TODAY_KEY && S.logs[k].length), per = logDays.map(k => totalsOf(dayItems(S, k)));
  const medDays = Object.keys(S.tasks).filter(k => k >= dOff(14)), taken = medDays.reduce((n, k) => n + Object.keys(S.tasks[k].meds || {}).length, 0);
  const qs = S.escalations.filter(e => e.status !== "resolved").map(e => e.question || `${e.title}${e.detail ? " — " + e.detail : ""}`);
  return { p, gF, gP, lows, bp, w, naus, labs, logDays, per, medDays, taken, qs };
}
function careReport(R) {
  const x = reportData(R), p = x.p, doc = S.team.doctor;
  const fA = k => avg(x.per.map(t => t[k]));
  return `<div class="card care" data-src="built from your care profile"><div class="row"><h4 style="margin:0">Medical report</h4>${pill("Patient-reported", "info")}</div><div class="tiny muted">Last 30 days · for ${esc(doc.name || "your doctor")} · not a diagnosis</div>
    <h5>Patient</h5><div class="small">${esc(p.name || "—")}, ${p.age} ${p.sex === "female" ? "F" : "M"}${R.hideCalories ? "" : ` · ${p.weight} kg · ${p.height} cm${R.bmi ? " · BMI " + fmt(R.bmi, 1) : ""}`} · ${esc({ veg: "Vegetarian", egg: "Eggetarian", nonveg: "Non-vegetarian", vegan: "Vegan", jain: "Jain" }[p.diet] || p.diet)}${p.pregnancy !== "No" ? " · " + esc(p.pregnancy) : ""}</div>
    ${(p.allergies || []).length ? `<div class="small">Allergies: ${p.allergies.map(a => esc(a.item.replace("_", " ") + (a.severity === "severe" ? " (severe)" : ""))).join(", ")}</div>` : ""}
    <h5>Conditions</h5>${S.conditions.length ? `<ul class="list">${S.conditions.map(c => `<li>${esc(COND_NAME[c.id] || c.id)}${c.since ? ", since " + esc(c.since) : ""}${c.confirmed ? " ✓" : " (unconfirmed)"}</li>`).join("")}</ul>` : `<div class="small muted">None reported</div>`}
    <h5>Medicines</h5>${S.meds.length ? `<ul class="list">${S.meds.map(m => `<li><b>${esc(m.brand || m.generic)}</b> (${esc(m.generic)}) ${esc((m.dose || "") + " " + (m.unit || ""))} · ${esc(m.freq)} · ${esc(m.timing)}${m.start ? " · since " + esc(m.start) : ""}${m.duration && m.duration !== "Ongoing" ? " · " + esc(m.duration === "Until" ? "until " + (m.until || "") : m.days + " days") : ""}${m.increasedOn ? " · dose changed " + nice(m.increasedOn) : ""}</li>`).join("")}</ul>${x.medDays.length ? `<div class="tiny muted">${x.taken} doses marked taken in the last 14 days</div>` : ""}` : `<div class="small muted">None reported</div>`}
    ${x.gF.length || x.gP.length ? `<h5>Glucose</h5><div class="kv"><span>Fasting average (${x.gF.length})</span><span>${fmt(avg(x.gF))} mg/dL</span>${x.gP.length ? `<span>2 h after meals (${x.gP.length})</span><span>${fmt(avg(x.gP))} mg/dL</span>` : ""}<span>Lows under 70</span><span>${x.lows.length}${x.lows.length ? " (" + x.lows.map(l => l.v + " on " + nice(l.d)).join(", ") + ")" : ""}</span></div>${x.gF.length > 2 ? spark(x.gF, { lo: 70, hi: 130, band: [80, 130], h: 44 }) : ""}` : ""}
    ${x.bp.length ? `<h5>Home blood pressure</h5><div class="kv"><span>Average (${x.bp.length})</span><span>${fmt(avg(x.bp.map(b => b.v)))}/${fmt(avg(x.bp.map(b => b.v2)))} mmHg</span></div>` : ""}
    ${!R.hideCalories && x.w.length > 1 ? `<h5>Weight</h5><div class="kv"><span>${nice(x.w[0].d)} → ${nice(x.w[x.w.length - 1].d)}</span><span>${x.w[0].v} → ${x.w[x.w.length - 1].v} kg (${fmt(x.w[x.w.length - 1].v - x.w[0].v, 1)})</span></div>` : ""}
    ${x.labs.length ? `<h5>Latest labs</h5><div class="kv">${x.labs.map(l => `<span>${esc(METRICS[l.key][0])} · ${nice(l.d)}</span><span>${l.v} ${esc(METRICS[l.key][1])}</span>`).join("")}</div>` : ""}
    ${Object.keys(S.limits).length ? `<h5>Limits from clinicians</h5><div class="kv">${Object.entries(S.limits).map(([k, l]) => `<span>${LIMIT_KEYS[k] || k} · ${esc(l.by || "")}</span><span>≤ ${fmt(l.v)} ${k.endsWith("_g") ? "g" : "mg"}/day</span>`).join("")}</div>` : ""}
    ${x.naus.length ? `<h5>Side effects</h5><div class="kv"><span>Nausea (0–3), ${x.naus.length} days</span><span>avg ${fmt(avg(x.naus.map(n => n.v)), 1)}, peak ${Math.max(...x.naus.map(n => n.v))}</span></div>` : ""}
    <h5>Food (last 14 days)</h5><div class="kv"><span>Days logged</span><span>${x.logDays.length}/14</span>${x.per.length ? `${R.hideCalories ? "" : `<span>Average energy</span><span>${fmt(fA("kcal"))} kcal</span>`}<span>Average protein</span><span>${fmt(fA("p"))} g${R.T.protein_g ? ` (target ${R.T.protein_g.lo ?? ""}${R.T.protein_g.hi ? "–" + R.T.protein_g.hi : "+"} g)` : ""}</span>${R.T.sodium_mg ? `<span>Average sodium</span><span>${fmt(fA("na"))} mg</span>` : ""}${R.T.potassium_mg?.hardMax ? `<span>Average potassium</span><span>${fmt(fA("k"))} mg</span>` : ""}${R.T.carb_g ? `<span>Average carbs</span><span>${fmt(fA("c"))} g</span>` : ""}` : ""}</div>
    ${x.qs.length ? `<h5>Questions &amp; events for the doctor</h5><ol class="list">${x.qs.map(q => `<li class="small">${esc(q)}</li>`).join("")}</ol>` : ""}
    <div class="btns"><button class="btn sm primary" data-act="printReport">Print / save PDF</button><button class="btn sm" data-act="waReport">Share on WhatsApp</button><button class="btn sm" data-act="copyReport">Copy text</button></div></div>
    <div class="card"><div class="row"><h4 style="margin:0">Documents</h4><label class="btn sm" style="cursor:pointer">+ Upload<input type="file" id="docUpload" accept="image/*,application/pdf" hidden></label></div>${S.docs.length ? S.docs.map(docRow).join("") : `<div class="empty">No documents yet. Upload a lab report or prescription. Documents ${whereKept()} and print with your report.</div>`}</div>`;
}
function reportText(R) {
  const x = reportData(R), p = x.p, L = [];
  L.push(`PATHYA CARE SUMMARY (patient-reported, last 30 days)`, `${p.name}, ${p.age} ${p.sex === "female" ? "F" : "M"}${R.hideCalories ? "" : `, ${p.weight} kg`}`);
  if (S.conditions.length) L.push("Conditions: " + S.conditions.map(c => (COND_NAME[c.id] || c.id) + (c.since ? ` (since ${c.since})` : "")).join("; "));
  if (S.meds.length) L.push("Medicines: " + S.meds.map(m => `${m.brand || m.generic} (${m.generic}) ${m.dose || ""}${m.unit || ""} ${m.freq}, ${m.timing}${m.start ? ", since " + m.start : ""}`).join("; "));
  if (x.gF.length) L.push(`Fasting glucose avg ${fmt(avg(x.gF))} mg/dL (${x.gF.length}); lows <70: ${x.lows.length}`);
  if (x.bp.length) L.push(`Home BP avg ${fmt(avg(x.bp.map(b => b.v)))}/${fmt(avg(x.bp.map(b => b.v2)))}`);
  if (x.labs.length) L.push("Labs: " + x.labs.map(l => `${METRICS[l.key][0]} ${l.v} ${METRICS[l.key][1]} (${nice(l.d)})`).join("; "));
  if (x.qs.length) L.push("Questions: " + x.qs.map((q, i) => `${i + 1}. ${q}`).join(" "));
  return L.join("\n");
}
function printHTML(R, mode) {
  if (mode === "plan") {
    const days = planWeek(S, R);
    return `<h1>Pathya diet chart — ${esc(S.profile.name)}</h1><div>Week from ${nice(TODAY_KEY)} · built from your care rules</div>${days.map((d, i) => { const dt = new Date(TODAY); dt.setDate(dt.getDate() + i); return `<h2>${dt.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</h2><table>${d.meals.map(m => `<tr><td><b>${esc(m.slot)}</b> ${clock(m.mins)}</td><td>${m.items.map(([c, q]) => `${fmtQ(q)} × ${esc(DB.byCode[c].short)}`).join(", ")}</td></tr>`).join("")}</table>`; }).join("")}<h2>Cook sheet</h2>${cookLines(R, S).map(([en, hi]) => `<div>• ${esc(en)} — ${esc(hi)}</div>`).join("")}`;
  }
  return `<h1>Pathya care summary</h1><pre style="white-space:pre-wrap;font-family:inherit">${esc(reportText(R))}</pre>${S.docs.filter(d => d.mime?.startsWith("image")).map(d => `<div><b>${esc(d.title || d.type)}</b> · ${nice(d.d)}<br><img src="${d.data}" alt=""></div>`).join("")}<p style="font-size:10px;color:#666">Generated by Pathya on ${nice(TODAY_KEY)}. Patient-reported data; not a diagnosis.</p>`;
}

/* ---------- Doctor escalation ---------- */
const waLink = (phone, text) => `https://wa.me/${String(phone || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(text)}`;
function careEsc(R) {
  const t = S.team, open = S.escalations.filter(e => e.status !== "resolved"), done = S.escalations.filter(e => e.status === "resolved");
  const lvlName = { emergency: "Emergency", urgent: "Today", routine: "Next visit" };
  let h = `<div class="card lvl-danger" style="border-color:var(--cp-danger)"><div class="row"><div><b>Emergency?</b><div class="tiny muted">Chest pain, breathlessness, confusion, a severe low or a severe allergic reaction</div></div><a class="btn danger" href="tel:112">Call 112</a></div><div class="row" style="margin-top:8px"><div class="tiny muted">Feeling low or overwhelmed? Free, 24×7</div><a class="btn sm" href="tel:14416">Tele-MANAS 14416</a></div></div>`;
  h += `<div class="card"><div class="row"><h4 style="margin:0">Care team</h4><button class="btn sm" data-act="profileSec" data-v="team">Edit</button></div>
    ${[["doctor", "🩺", t.doctor.name, t.doctor.spec, t.doctor.phone], ["dietitian", "🥗", t.dietitian.name, "Dietitian", t.dietitian.phone], ["caregiver", "👪", t.caregiver.name, t.caregiver.rel + (t.caregiver.notify ? " · gets urgent alerts" : ""), t.caregiver.phone]].map(([k, ic, n, s, ph]) => n ? `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--cp-border)"><div class="grow"><b class="small">${ic} ${esc(n)}</b><div class="tiny muted">${esc(s || "")}</div></div>${ph ? `<a class="btn sm" href="tel:${esc(ph)}">Call</a><a class="btn sm" href="${waLink(ph, "Hello " + n + ", ")}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div>` : "").join("") || `<div class="empty">Add your doctor and a family member so Pathya can route questions and urgent alerts.</div>`}</div>`;
  h += `<div class="card"><h4>Ask your doctor</h4><textarea id="askText" rows="2" aria-label="Question for your doctor" placeholder="e.g. Should my evening snack change after the low on Saturday?"></textarea><div class="btns"><button class="btn sm primary" data-act="askSave">Add to my questions</button></div><div class="tiny muted" style="margin-top:6px">Questions collect here and print in your Medical report. Send them now on WhatsApp, or take them to your visit.</div></div>`;
  h += `<div class="card"><div class="row"><h4 style="margin:0">Open escalations</h4>${pill(open.length + " open", open.length ? "warn" : "ok")}</div>
    ${open.length ? open.map(e => `<div class="item"><div class="row top"><div class="grow"><b class="small">${esc(e.title)}</b><div class="tiny muted">${nice(e.d)} ${esc(e.t || "")} · ${srcTag(e.src)}</div>${e.detail ? `<div class="tiny" style="margin-top:3px">${esc(e.detail)}</div>` : ""}</div>${pill(lvlName[e.level] || e.level, e.level === "routine" ? "info" : "danger")}</div>
      <div class="btns">${t.doctor.phone ? `<a class="btn sm" href="${waLink(t.doctor.phone, `${t.doctor.name || "Doctor"}, ${e.question || e.title}. ${e.detail || ""} — ${S.profile.name} (via Pathya)`)}" target="_blank" rel="noopener" data-act="escSent" data-v="${e.id}">WhatsApp ${esc(t.doctor.name || "doctor")}</a>` : ""}${e.level !== "routine" && t.caregiver.phone && t.caregiver.notify ? `<a class="btn sm" href="${waLink(t.caregiver.phone, `${S.profile.name}: ${e.title}. ${e.detail || ""} (Pathya alert)`)}" target="_blank" rel="noopener">Tell ${esc(t.caregiver.name.split(" ")[0])}</a>` : ""}${e.status === "sent" ? pill("Sent", "ok") : ""}<button class="btn sm" data-act="escResolve" data-v="${e.id}">Resolved</button></div></div>`).join("") : `<div class="empty">Nothing open. Red flags from readings, chat or check-ups appear here automatically.</div>`}
    ${done.length ? `<h5>Resolved</h5>${done.slice(0, 5).map(e => `<div class="tiny muted" style="padding:3px 0">✓ ${esc(e.title)} · ${nice(e.d)}</div>`).join("")}` : ""}</div>`;
  h += `<div class="card"><h4>How escalation works</h4><div class="kv small"><span>🚨 Emergency (112)</span><span>chest pain, a severe low, an allergic reaction</span><span>⚠️ Today</span><span>glucose &gt; 300, vomiting, BP ≥ 180/120</span><span>📝 Next visit</span><span>questions, a low that resolved, side effects</span></div><div class="tiny muted" style="margin-top:6px">Rules come from the red flags in your active pathways. Family members only get urgent alerts if you turn that on.</div></div>`;
  return h;
}
