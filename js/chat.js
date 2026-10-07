"use strict";
/* Pathya Care — chat assistant. Deterministic and grounded: every number comes from the Pathya
   food database or the care engine; safety checks run before anything else; it never gives dose advice. */

const MED_WORDS = /\b(dose|dosage|tablet|tablets|pill|pills|insulin|injection|mg\b|stop taking|skip (my )?(medicine|tablet|dose)|increase|decrease|reduce|double)\b/i;
function chatReply(text, R) {
  const t = text.toLowerCase(), doc = S.team.doctor.name || "your doctor", out = { lines: [], actions: [], src: [] };
  const say = (...l) => out.lines.push(...l), act = (a, l, v) => out.actions.push([a, l, v || ""]);

  // 1. crisis and emergencies — always first
  if (/suicid|kill myself|self.?harm|end (my|it all)|don'?t want to live|hurt myself/.test(t)) {
    say("**I'm really glad you told me. You deserve support right now.**", "Please call **Tele-MANAS 14416** (free, 24×7) or **112** if you're in danger. If you can, tell someone near you.", "I'm pausing food advice for now.");
    act("call", "Call Tele-MANAS 14416", "14416"); act("call", "Call 112", "112"); escalate("emergency", "Crisis message in chat", text, "screeners.phq2"); out.level = "emergency"; return out;
  }
  if (/chest pain|can'?t breathe|cannot breathe|breathless|unconscious|fainted|seizure|throat (is )?(tight|closing)|lips? swell|face swell|anaphyla/.test(t)) {
    say("**This could be an emergency. Call 112 now.**", "Sit down, don't drive yourself, and keep your medicine list handy. I've added this to Doctor escalation.");
    act("call", "Call 112", "112"); escalate("emergency", "Emergency symptoms reported in chat", text, R.has("P_FOOD_ALLERGY") ? "P_FOOD_ALLERGY" : "P_HTN"); out.level = "emergency"; return out;
  }
  const g = t.match(/(?:sugar|glucose|bg|reading|fasting|pp)\D{0,12}(\d{2,3})/) || (/(?:sugar|glucose)/.test(t) && t.match(/\b(\d{2,3})\b/));
  if (g) {
    const v = +g[1];
    addReading("glucose", v, { ctx: /fasting/.test(t) ? "Fasting" : /after|pp/.test(t) ? "2 h after a meal" : "Random", note: "From chat" });
    if (v < 70) {
      say(`**${v} mg/dL is low. Treat it now with the 15-15 rule:**`, "1. Take 15 g fast sugar: 3 tsp sugar or glucose in water, or 150 ml fruit juice.", "2. Wait 15 minutes and check again.", "3. Still under 70? Repeat once more.", "4. Back above 70? Eat your next meal or a snack.", `If you can't swallow or feel confused, someone should call 112. I've logged this low for ${doc}.`);
      escalate(R.blocked("meal_skipping") ? "urgent" : "routine", `Low glucose ${v} mg/dL`, `Reported in chat at ${clock(now())}.`, "P_T2D"); out.src.push("P_T2D", "D_SULFONYLUREA"); out.level = "urgent"; return out;
    }
    if (v > 300) { say(`**${v} mg/dL is very high. Contact ${doc} today.**`, "Drink water. If you're vomiting, very drowsy or breathing fast, get urgent care."); escalate("urgent", `High glucose ${v} mg/dL`, "Reported in chat.", "P_T2D"); act("call-doc", `Call ${doc}`); out.level = "urgent"; return out; }
    say(`Logged **${v} mg/dL** in your readings. ${v <= 180 ? "That's within the usual range doctors aim for." : "That's on the high side. Check what you ate in the 2 hours before; your calendar shows the pattern."}`); out.src.push("P_T2D"); return out;
  }
  const bp = t.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/);
  if (bp && /bp|pressure|\//.test(t)) {
    const sy = +bp[1], di = +bp[2]; addReading("bp", sy, { v2: di, note: "From chat" });
    if (sy >= 180 || di >= 120) { say(`**${sy}/${di} is very high.** Rest 5 minutes and recheck. If it stays this high, contact ${doc} today. Chest pain, breathlessness or confusion means call 112.`); escalate("urgent", `Very high BP ${sy}/${di}`, "Reported in chat.", "P_HTN"); out.level = "urgent"; return out; }
    say(`Logged BP **${sy}/${di}**. ${sy >= 140 || di >= 90 ? "It's above 140/90. Salt is the biggest food lever." : "Nice. That's under 140/90."}`); return out;
  }
  if (/vomit|throwing up|can'?t keep (food|water|fluids|anything) down/.test(t)) {
    say("**If you can't keep fluids down, or you've been vomiting for more than a day, get medical care today.**", R.has("P_GLP1") ? "Tell the doctor you take a GLP-1 medicine and when your dose last changed." : "Sip small amounts of fluid often (ORS, water, coconut water).", "I can switch on Sick-day mode, which pauses calorie goals and plans soft, easy food.");
    act("mode", "Turn on Sick-day mode", "sick"); escalate("urgent", "Vomiting / can't keep fluids down", text, R.has("P_GLP1") ? "P_GLP1" : "M_SICK_DAY"); out.level = "urgent"; return out;
  }
  if (/black stool|blood in (my )?stool|vomiting blood|blood in vomit|severe (stomach|abdominal|tummy) pain/.test(t)) { say(`**Please see ${doc} today**, or go to urgent care if it's severe. I've added it to Doctor escalation.`); escalate("urgent", "Red-flag symptom in chat", text, "P_ANAEMIA"); out.level = "urgent"; return out; }

  // 2. medicines — never dose advice
  const med = S.meds.find(m => t.includes(m.generic) || t.includes((m.brand || "").toLowerCase()));
  const drugHit = med ? DB.drugs[med.cls] : Object.values(DB.drugs).find(d => d.generics.some(x => t.includes(x)) || d.brands.some(x => t.includes(x.toLowerCase())));
  if (MED_WORDS.test(t) || (drugHit && /should|can i|safe|okay|ok to|stop|skip|take/.test(t) && !/\beat\b|\bfood\b/.test(t))) {
    say(`I can't advise on medicine doses or timing changes. Only ${doc} can do that safely.`);
    if (drugHit) { say(`What Pathya knows about **food with ${drugHit.generics.join("/")}**: ${drugHit.issue}`); (drugHit.rules || []).slice(0, 3).forEach(r => say("• " + cap(r))); out.src.push("D_" + drugHit.class_id.toUpperCase()); }
    act("ask-doc", `Send this question to ${doc}`, text); return out;
  }

  // 3. fasting / vrat
  if (/\b(vrat|fast|fasting|navratri|ekadashi|ramadan|roza|karva|upvas|upwas)\b/.test(t)) {
    const type = /navratri/.test(t) ? "navratri" : /ramadan|roza/.test(t) ? "ramadan" : /karva/.test(t) ? "karva_chauth" : /ekadashi/.test(t) ? "ekadashi" : "weekly_vrat";
    const rules = DB.fasting[type] || {};
    if (R.gated("fasting_mode")) { const gt = R.gates.find(x => x.id === "fasting_mode"); say(`**Fasting needs ${doc}'s OK first.** ${gt.why}`); out.src.push(gt.src); act("ask-doc", `Ask ${doc} about fasting`, `Is it safe for me to keep a ${type.replace("_", " ")} fast with my medicines? What should change on that day?`); act("care", "Open Day to day › Modes", "day"); }
    else say(`You can plan a ${type.replace("_", " ")} in **Care › Day to day › Modes**. I'll switch to vrat-friendly dishes.`);
    if (rules.allowed) say(`**Usually allowed:** ${rules.allowed.slice(0, 10).join(", ")}.`, `**Usually avoided:** ${(rules.avoid || []).slice(0, 8).join(", ")}.`);
    if (rules.notes) say(String(rules.notes).slice(0, 220));
    return out;
  }

  // 4. progress today
  const tot = totalsOf(dayItems(S, TODAY_KEY));
  if (/how (am i|much|many)|left|remaining|so far|today'?s? (total|progress)|on track/.test(t)) {
    const keys = [["protein_g", "p", /protein/], ["sodium_mg", "na", /salt|sodium/], ["potassium_mg", "k", /potassium/], ["phosphorus_mg", "ph", /phosph/], ["carb_g", "c", /carb/], ["added_sugar_g", "asug", /sugar|sweet/], ["fibre_g", "fib", /fib/], ["energy_kcal", "kcal", /calorie|kcal|energy/]];
    const asked = keys.filter(k => k[2].test(t)), show = (asked.length ? asked : keys).filter(([k]) => R.T[k] && !(k === "energy_kcal" && R.hideCalories));
    say(`**Today so far** (${(S.logs[TODAY_KEY] || []).length} meals logged):`);
    for (const [k, f] of show) { const x = R.T[k], v = tot[f]; say(`• ${x.label}: **${fmt(v)} ${x.unit}**${x.lo != null && x.hi != null ? ` of ${fmt(x.lo)}–${fmt(x.hi)} (${v < x.lo ? fmt(x.lo - v) + " to go" : v > x.hi ? fmt(v - x.hi) + " over" : "on target"})` : x.hi != null ? ` of ${fmt(x.hi)} max (${fmt(Math.max(0, x.hi - v))} left)` : x.lo != null ? ` of ${fmt(x.lo)}+ (${fmt(Math.max(0, x.lo - v))} to go)` : x.target ? ` of ${fmt(x.target)}` : ""}`); out.src.push(x.src[0]); }
    act("tab", "Open Today", "today"); return out;
  }

  // 5. what to eat
  if (/what (should|can) i (eat|have)|suggest|recommend|idea for|options? for|(breakfast|lunch|dinner|snack) (idea|option)/.test(t)) {
    const sugg = nextSuggestions(R, 3);
    if (!sugg.length) { say("I couldn't find a dish that passes all your rules right now. Try the Diet chart."); return out; }
    say("Here are dishes that pass all your rules and fill today's biggest gaps:");
    sugg.forEach(d => say(`• **${dname(d)}** — 1 ${d.unit}: ${R.hideCalories ? "" : fmt(d.kcal) + " kcal, "}${fmt(d.p, 1)} g protein${R.T.sodium_mg ? `, ${fmt(d.na)} mg sodium` : ""}${R.T.potassium_mg?.hardMax ? `, ${fmt(d.k)} mg potassium` : ""}`));
    sugg.forEach(d => act("log-dish", "Log " + d.short.slice(0, 22), d.code)); return out;
  }

  // 6. education cards
  const edu = Object.values(DB.education).find(e => rawToks(e.title).filter(w => w.length > 3).some(w => t.includes(w)));
  if (edu && /what|how|why|explain|tell|teach|plate|rule/.test(t)) { say(`**${edu.title}**`, edu.body); if (edu.teach_back) say(`_Quick check: ${edu.teach_back}_`); out.src.push(...(edu.sources || []).slice(0, 2)); return out; }

  // 7. why-questions about rules
  if (/\bwhy\b/.test(t)) {
    const all = [...R.blocks.map(b => [b.id.replace(/_/g, " "), b.why, b.src[0]]), ...R.excludes.map(x => [x.field.replace(/_/g, " "), x.why, x.src]), ...R.avoids.map(x => [x.field.replace(/_/g, " "), x.why, x.src]), ...R.gates.map(x => [x.id.replace(/_/g, " "), x.why, x.src])];
    const hit = all.find(([k]) => rawToks(k).some(w => w.length > 3 && t.includes(w))) || (searchDishes(t, 1)[0] && null);
    if (hit) { say(`**${cap(hit[0])}**: ${hit[1]}`, `This rule comes from ${hit[2]}. See Care › Rules in effect for everything that's on.`); out.src.push(hit[2]); return out; }
  }

  // 8. food questions — the most common
  const q = t.replace(/can i (eat|have|take)|is it (ok|okay|safe|good)|is|are|ok|okay|safe|good|for me|to eat|today|tonight|\?|please/g, " ");
  const hits = searchDishes(q, 4, { diet: R.dietType });
  if (hits.length) {
    const d = hits[0], qn = (t.match(/\b(\d+(?:\.\d+)?)\b/) || [])[1] ? +t.match(/\b(\d+(?:\.\d+)?)\b/)[1] : 1;
    const fl = dishFlags(d, qn, R, S), block = fl.filter(f => f.lvl === "block"), warn = fl.filter(f => f.lvl === "warn"), good = fl.filter(f => f.lvl === "ok");
    const verdict = block.length ? "**Not for you right now.**" : warn.length ? "**Okay in a smaller portion, or swap it.**" : "**Yes, this fits your plan.**";
    say(`${verdict} ${dname(d)}, ${fmtQ(qn)} ${d.unit}:`);
    say(`${R.hideCalories ? "" : fmt(d.kcal * qn) + " kcal · "}protein ${fmt(d.p * qn, 1)} g · carbs ${fmt(d.c * qn)} g · fibre ${fmt(d.fib * qn, 1)} g · sodium ${fmt(d.na * qn)} mg${R.T.potassium_mg?.hi ? ` · potassium ${fmt(d.k * qn)} mg · phosphorus ${fmt(d.ph * qn)} mg` : ""}`);
    [...block, ...warn].slice(0, 3).forEach(f => { say(`${f.lvl === "block" ? "⛔" : "⚠️"} ${f.text}`); out.src.push(f.src); });
    good.slice(0, 2).forEach(f => say(`✓ ${f.text}`));
    if (block.length || warn.length) { const sw = swapsFor(d.code, R, S); if (sw.length) { say(`**Try instead:** ${sw.map(c => DB.byCode[c].short).join(", ")}`); sw.forEach(c => act("log-dish", "Log " + DB.byCode[c].short.slice(0, 22), c)); } }
    else act("log-dish", "Log it", d.code);
    if (hits.length > 1) say(`_Did you mean another dish? ${hits.slice(1).map(h => h.short).join(", ")}_`);
    return out;
  }
  say(`I'm not sure about that one. I answer from Pathya's food database and your care rules. Try asking “can I eat poha?”, “what should I eat for dinner?” or “how much salt is left?”.`);
  act("ask-doc", `Add to my questions for ${doc}`, text);
  return out;
}
function nextSuggestions(R, n = 3) {
  const tot = totalsOf(dayItems(S, TODAY_KEY)), slot = slotAt(now());
  const P = pools(R, S), pool = slot === "Breakfast" ? P.bfMain : (slot === "Lunch" || slot === "Dinner") ? P.protein : P.snack;
  return [...pool].map(d => {
    let s = d.score;
    if (R.T.protein_g?.lo && tot.p < R.T.protein_g.lo) s += d.p / Math.max(40, d.kcal) * 10;
    if (R.T.protein_g?.hi && tot.p + d.p > R.T.protein_g.hi) s -= 5;
    for (const [k, f] of [["sodium_mg", "na"], ["potassium_mg", "k"], ["phosphorus_mg", "ph"]]) if (R.T[k]?.hi && tot[f] + d[f] > R.T[k].hi * 0.9) s -= 4;
    if (R.perMealCarb && d.c > R.perMealCarb) s -= 2;
    if (d.fried) s -= 1.5;
    if (/pakod|pakor|samosa|kachori|bonda|vada|patties|cutlet/i.test(d.name)) s -= 1;
    return [s, d];
  }).sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
}
function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|\s)_(.+?)_(\s|$)/g, "$1<i>$2</i>$3"); }
