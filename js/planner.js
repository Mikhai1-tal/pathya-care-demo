"use strict";
/* Pathya Care — weekly diet chart: a constrained planner over the Pathya dish database. */

function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const BF_RX = /cheela|chilla|upma|poha|idli|dosa|uttapam|paratha|parantha|thepla|dhokla|pongal|appam|daliya|dalia|oats|sandwich|omelette|bhurji|porridge|vermicelli|seviyan|muthia|handvo/i;
const STAPLE_RX = /chapati|roti|phulka|bhakri|bhakhri|boiled rice|jowar|bajra|ragi|missi|makki|tandoori roti/i;
const SOFT_RX = /khichdi|khichri|curd rice|idli|dalia|daliya|soup|upma|porridge|kanji|canjee|stew/i;

function slotPlan(R, S) {
  const five = R.blocked("meal_skipping") || R.mealsMin >= 4 || R.edRisk || R.has("P_T1D") || R.has("P_PREGNANCY");
  const slots = five ? [["Breakfast", 480, 0.24], ["Mid-morning", 660, 0.08], ["Lunch", 795, 0.3], ["Evening snack", 1005, 0.1], ["Dinner", 1215, 0.28]]
    : [["Breakfast", 495, 0.27], ["Lunch", 810, 0.33], ["Evening snack", 1020, 0.1], ["Dinner", 1230, 0.3]];
  if (S.profile.shift && S.profile.shift !== "No") slots.forEach(s => s[1] = (s[1] + 480) % 1440);
  return slots;
}

const JUNK_RX = /gravy|\bdip\b|dressing|stock|filling|sauce|icing|batter|\bmix\b|amylase|weaning|infant|shishu|baby|chocolate|shake|cola|punch|mocktail|cocktail|sherbet|squash|syrup|jam\b|jelly|custard|pudding|cake|cookie|biscuit|pastry|mayonnaise|ketchup/i;
let POOL_CACHE = { key: null };
function pools(R, S) {
  const key = JSON.stringify([R.paths.map(p => p.id), R.dietType, R.excludes.length, S.profile.allergies, S.modes, R.T.potassium_mg?.hi, R.T.sodium_mg?.hi]);
  if (POOL_CACHE.key === key) return POOL_CACHE;
  const ok = [], E = R.T.energy_kcal?.target || R.E;
  for (const d of DB.dishes) {
    if (!d.plan || d.kcal < 15 || d.alc || JUNK_RX.test(d.name)) continue;
    const fl = dishFlags(d, 1, R, S);
    if (fl.some(f => f.lvl === "block")) continue;
    let s = 1 - fl.filter(f => f.lvl === "warn").length * 0.8 + fl.filter(f => f.lvl === "ok").length * 0.25;
    for (const x of R.prefers) if (dishMatch(d, x.field, x.op, x.value)) s += x.weight * 2;
    for (const x of R.avoids) if (dishMatch(d, x.field, x.op, x.value)) s -= x.weight * 3;
    for (const [key2, f] of [["sodium_mg", "na"], ["potassium_mg", "k"], ["phosphorus_mg", "ph"]]) {
      const lim = R.T[key2]?.hi; if (!lim) continue;
      const dens = d[f] / Math.max(d.kcal, 30), budget = lim / E;
      if (dens > budget) s -= Math.min(2.5, (dens / budget - 1) * (R.T[key2].hardMax ? 1.2 : 0.5));
    }
    if (d.region === S.profile.region) s += 0.6;
    if (d.region === "continental" || d.region === "indo_chinese") s -= 0.6;
    if (R.T.protein_g?.lo) { const need = Math.min(3, Math.max(1, (R.T.protein_g.lo * 4 / Math.max(1200, E)) / 0.15)); s += Math.min(1.5 * need, d.p / Math.max(40, d.kcal) * 8 * need); }
    if (R.T.fibre_g?.lo) s += Math.min(0.6, d.fib / 8);
    if (d.fried) s -= 0.6;
    ok.push(Object.assign(Object.create(d), { score: Math.max(0.05, s) }));
  }
  const by = f => ok.filter(f);
  const vrat = S.modes.fasting;
  const MAINX = /samosa|pakor|pakod|kachori|bonda|cutlet|patties|\bpie\b|sandwich|pizza|burger|pasta|noodle|spanish|mexican|chinese|manchurian|chilli |souffle|au gratin|kofta|halwa|kheer|ladoo|laddu|burfi|barfi|mithai|jalebi|gulab|rasgulla|peda|payasam|sheera|shrikhand|chikki|sweet/i;
  const main = d => !MAINX.test(d.name) && !["continental", "indo_chinese"].includes(d.region) && d.asug <= 8;
  const P = {
    key,
    bfMain: by(d => main(d) && (d.cat === "breakfast" || ((d.cat === "other" || d.cat === "bread") && BF_RX.test(d.name))) && d.kcal <= 450 && (!vrat || d.vrat)),
    bfSide: by(d => d.asug <= 5 && !MAINX.test(d.name) && (["curd_raita", "egg", "fruit"].includes(d.cat) || /^Milk/.test(d.name) || (d.cat === "beverage" && d.asug < 3 && d.kcal < 160))).filter(d => !vrat || d.vrat),
    staple: by(d => main(d) && ((d.cat === "bread" && STAPLE_RX.test(d.name) && !d.fried) || (d.cat === "rice" && d.kcal <= 450 && !/biryani|pulao|fried/i.test(d.name)))).filter(d => !vrat || d.vrat),
    protein: by(d => main(d) && ["dal_legume", "paneer", "egg", "meat_fish"].includes(d.cat) && d.kcal <= 450 && !d.fried && (!vrat || d.vrat)),
    veg: by(d => main(d) && d.cat === "vegetable" && d.kcal <= 300 && (!vrat || d.vrat)),
    side: by(d => main(d) && ["curd_raita", "salad"].includes(d.cat) && d.kcal <= 200 && !d.fried && (!vrat || d.vrat)),
    snack: by(d => d.asug < 8 && !/burfi|barfi|halwa|ladoo|laddu|kheer|jalebi|mithai/i.test(d.name) && (["fruit", "nuts", "salad", "curd_raita"].includes(d.cat) || (d.cat === "beverage" && d.asug < 3 && d.kcal < 160) || (d.cat === "egg" && d.kcal < 160) || (d.cat === "other" && d.kcal < 180 && !d.fried)) && (!vrat || d.vrat)),
    soft: by(d => SOFT_RX.test(d.name) && d.kcal <= 450 && (!vrat || d.vrat))
  };
  POOL_CACHE = P;
  return P;
}
function pick(pool, rnd, used) {
  const cand = pool.filter(d => !used.has(d.code));
  const list = cand.length ? cand : pool;
  if (!list.length) return null;
  const total = list.reduce((a, d) => a + d.score * d.score, 0);
  let x = rnd() * total;
  for (const d of list) { x -= d.score * d.score; if (x <= 0) return d; }
  return list[list.length - 1];
}
function buildMeal(slot, kcalT, P, rnd, used, S) {
  const items = [];
  const add = (d, q, pool) => { if (d) { items.push([d.code, q, pool]); used.add(d.code); } };
  if (S.modes.sick && P.soft.length) { add(pick(P.soft, rnd, used), 1, "soft"); }
  else if (slot === "Breakfast") { add(pick(P.bfMain, rnd, used), 1, "bfMain"); add(pick(P.bfSide, rnd, used), 1, "bfSide"); }
  else if (slot === "Lunch" || slot === "Dinner") { add(pick(P.staple, rnd, used), 1, "staple"); add(pick(P.protein, rnd, used), 1, "protein"); add(pick(P.veg, rnd, used), 1, "veg"); if (slot === "Lunch") add(pick(P.side, rnd, used), 1, "side"); }
  else add(pick(P.snack, rnd, used), 1, "snack");
  // portion to the slot's energy share: scale the staple/main first, others in half steps
  const kc = () => items.reduce((a, [c, q]) => a + DB.byCode[c].kcal * q, 0);
  for (let i = 0; i < 6 && items.length; i++) {
    const cur = kc(), ratio = kcalT / Math.max(1, cur);
    if (ratio > 0.85 && ratio < 1.18) break;
    const idx = 0, d = DB.byCode[items[idx][0]];
    const unitStep = /chapati|roti|phulka|bhakri|idli|dosa|cheela|chilla|paratha|parantha|egg|thepla/i.test(d.name) ? 1 : 0.5;
    const next = Math.min(unitStep === 1 ? 3 : 2, Math.max(unitStep, items[idx][1] + (ratio > 1 ? unitStep : -unitStep)));
    if (next === items[idx][1]) { const j = items.length - 1; items[j][1] = Math.min(2, Math.max(0.5, items[j][1] + (ratio > 1 ? 0.5 : -0.5))); }
    else items[idx][1] = next;
  }
  return items;
}
/* repair: swap or shrink whatever drives a broken hard limit */
function repairDay(meals, R, S, P) {
  const FIELD_OF = { "Sodium": "na", "Potassium": "k", "Phosphorus": "ph", "Protein": "p" };
  for (let it = 0; it < 40; it++) {
    const c = dayChecks(R, meals, S), bad = c.hard.find(h => !h.ok && /≤/.test(h.text) && FIELD_OF[h.text.split(" ")[0]]);
    const low = c.hard.find(h => !h.ok && /Protein ≥/.test(h.text));
    if (!bad && !low) return;
    if (bad) {
      const f = FIELD_OF[bad.text.split(" ")[0]];
      let worst = null;
      meals.forEach((m, mi) => m.items.forEach((x, ii) => { const v = DB.byCode[x[0]][f] * x[1]; if (!worst || v > worst.v) worst = { mi, ii, v, x }; }));
      if (!worst) return;
      const pool = P[worst.x[2]] || [], cur = DB.byCode[worst.x[0]];
      const alt = pool.filter(d => d.code !== cur.code && d[f] / Math.max(30, d.kcal) < cur[f] / Math.max(30, cur.kcal) * 0.7).sort((a, b) => (a[f] / Math.max(30, a.kcal)) - (b[f] / Math.max(30, b.kcal)) || b.score - a.score)[it % 3];
      if (alt) { worst.x[0] = alt.code; worst.x[1] = Math.max(0.5, Math.min(2, Math.round(cur.kcal * worst.x[1] / Math.max(30, alt.kcal) * 2) / 2)); }
      else if (worst.x[1] > 0.5) worst.x[1] -= 0.5;
      else return;
    } else {
      // protein short: 1) bigger dal/paneer portions, 2) swap the least protein-dense item for a denser one, 3) add a protein snack
      const dens = d => d.p / Math.max(30, d.kcal);
      const prot = meals.flatMap(m => m.items).filter(x => x[2] === "protein" && x[1] < 2);
      if (prot.length) { prot.sort((a, b) => DB.byCode[b[0]].p - DB.byCode[a[0]].p)[0][1] += 0.5; continue; }
      let worst = null;
      for (const m of meals) for (const x of m.items) if (["snack", "bfSide", "side", "bfMain", "soft", "staple"].includes(x[2])) { const v = dens(DB.byCode[x[0]]); if (!worst || v < worst.v) worst = { x, v }; }
      const inMeal = new Set(meals.flatMap(m => m.items.map(x => x[0])));
      if (worst) {
        const cur = DB.byCode[worst.x[0]], alt = (P[worst.x[2]] || []).filter(d => !inMeal.has(d.code) && dens(d) > worst.v * 1.4).sort((a, b) => dens(b) - dens(a) || b.score - a.score)[0];
        if (alt) { worst.x[0] = alt.code; worst.x[1] = Math.max(0.5, Math.min(2, Math.round(cur.kcal * worst.x[1] / Math.max(30, alt.kcal) * 2) / 2)); continue; }
      }
      const sm = meals.find(m => /snack|Mid/.test(m.slot) && m.items.length < 3) || meals.find(m => m.items.length < 4);
      const add = sm && [...(P.snack || []), ...(P.bfSide || []), ...(P.protein || [])].filter(d => d.p >= 6 && !inMeal.has(d.code)).sort((a, b) => dens(b) - dens(a))[0];
      if (add) { sm.items.push([add.code, 1, "snack"]); continue; }
      return;
    }
  }
}
function dayChecks(R, meals, S) {
  const t = totalsOf(meals.flatMap(m => m.items)), hard = [], soft = [];
  const tp = Math.round(t.p);
  const P = R.T.protein_g;
  // kit: sick days, vrat days and event days pause targets; safety maximums still apply
  const paused = !!(S.modes.sick || S.modes.fasting || S.modes.festival);
  if (P?.hardMin != null && !paused) hard.push({ ok: tp >= P.hardMin * 0.97, text: `Protein ≥ ${P.hardMin} g`, v: `${tp} g`, src: P.src[0] });
  if (P?.hardMax != null) hard.push({ ok: tp <= P.hardMax, text: `Protein ≤ ${P.hardMax} g`, v: `${tp} g`, src: P.src[0] });
  for (const [key, f] of [["sodium_mg", "na"], ["potassium_mg", "k"], ["phosphorus_mg", "ph"]]) { const x = R.T[key]; if (x?.hardMax != null) hard.push({ ok: t[f] <= x.hardMax, text: `${x.label} ≤ ${fmt(x.hardMax)} mg`, v: `${fmt(t[f])} mg`, src: x.src[0] }); }
  if (R.energyWarn && !paused) hard.push({ ok: t.kcal >= R.energyWarn.v, text: `Above ${fmt(R.energyWarn.v)} kcal warning line`, v: `${fmt(t.kcal)}`, src: R.energyWarn.src });
  if (R.mealsMin >= 4) hard.push({ ok: meals.length >= R.mealsMin, text: `${R.mealsMin}+ eating times`, v: `${meals.length}`, src: "P_GLP1" });
  if (R.blocked("meal_skipping")) { const gaps = meals.slice(1).map((m, i) => m.mins - meals[i].mins); hard.push({ ok: Math.max(...gaps) <= 270, text: "No meal gap over 4½ h", v: `max ${(Math.max(...gaps) / 60).toFixed(1)} h`, src: R.blocks.find(b => b.id === "meal_skipping").src[0] }); }
  const E = R.T.energy_kcal;
  if (E?.target && !R.hideCalories) soft.push({ pct: 1 - Math.abs(t.kcal - E.target) / E.target, text: "Energy", v: `${fmt(t.kcal)} / ${fmt(E.target)} kcal`, src: E.src[0] });
  if (P?.softMin) soft.push({ pct: t.p / P.softMin, text: `Protein target ${P.softMin} g`, v: `${tp} g`, src: P.src[0] });
  if (R.T.carb_g) { const pc = t.c * 4 / Math.max(1, t.kcal) * 100, lo = R.T.carb_g.lo * 4 / R.E * 100, hi = R.T.carb_g.hi * 4 / R.E * 100; soft.push({ pct: pc >= lo - 1 && pc <= hi + 1 ? 1 : 1 - Math.min(Math.abs(pc - lo), Math.abs(pc - hi)) / 20, text: `Carbs ${fmt(lo)}–${fmt(hi)}% of energy`, v: `${fmt(pc)}%`, src: R.T.carb_g.src[0] }); }
  if (R.T.fibre_g?.lo) soft.push({ pct: t.fib / R.T.fibre_g.lo, text: `Fibre ≥ ${R.T.fibre_g.lo} g`, v: `${fmt(t.fib)} g`, src: R.T.fibre_g.src[0] });
  if (R.T.sodium_mg?.softMax && !R.T.sodium_mg.hardMax) soft.push({ pct: t.na <= R.T.sodium_mg.softMax ? 1 : R.T.sodium_mg.softMax / t.na, text: `Sodium ≤ ${fmt(R.T.sodium_mg.softMax)} mg`, v: `${fmt(t.na)} mg`, src: R.T.sodium_mg.src[0] });
  if (R.T.added_sugar_g?.hi) soft.push({ pct: t.asug <= R.T.added_sugar_g.hi ? 1 : R.T.added_sugar_g.hi / t.asug, text: `Added sugar ≤ ${R.T.added_sugar_g.hi} g`, v: `${fmt(t.asug)} g`, src: R.T.added_sugar_g.src[0] });
  if (R.T.iron_mg?.lo) soft.push({ pct: t.fe / R.T.iron_mg.lo, text: `Iron ≥ ${R.T.iron_mg.lo} mg`, v: `${fmt(t.fe, 1)} mg`, src: R.T.iron_mg.src[0] });
  return { t, hard, soft, ok: hard.every(h => h.ok) };
}
let PLAN_CACHE = { key: null };
function planWeek(S, R) {
  pools(R, S);
  const key = JSON.stringify([S.planSeed, S.planSwaps, POOL_CACHE.key, R.E, Object.values(R.T).map(t => [t.lo, t.hi]), S.modes, S.profile.region]);
  if (PLAN_CACHE.key === key && PLAN_CACHE.key) return PLAN_CACHE.days;
  const P = pools(R, S), slots = slotPlan(R, S), days = [];
  const E = R.T.energy_kcal?.target || R.E;
  for (let di = 0; di < 7; di++) {
    let best = null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const rnd = rng(S.planSeed * 7919 + di * 104729 + attempt * 31), used = new Set();
      const meals = slots.map(([slot, mins, share], si) => {
        const off = S.planSwaps[`${di}-${si}`] || 0, r2 = off ? rng(S.planSeed * 13 + di * 101 + si * 7 + off * 977 + attempt) : rnd;
        return { slot, mins, items: buildMeal(slot, E * share, P, r2, used, S) };
      });
      const c = dayChecks(R, meals, S);
      let pen = c.hard.filter(h => !h.ok).length * 10 + c.soft.reduce((a, s) => a + Math.max(0, 1 - s.pct), 0);
      if (pen >= 10) { repairDay(meals, R, S, P); const c2 = dayChecks(R, meals, S); pen = c2.hard.filter(h => !h.ok).length * 10 + c2.soft.reduce((a, s) => a + Math.max(0, 1 - s.pct), 0); if (!best || pen < best.pen) best = { meals, checks: c2, pen }; }
      else if (!best || pen < best.pen) best = { meals, checks: c, pen };
      if (best.pen < 0.4) break;
    }
    days.push(best);
  }
  PLAN_CACHE = { key, days };
  return days;
}
function groceryList(days) {
  const c = new Map();
  for (const d of days) for (const m of d.meals) for (const [code] of m.items) for (const ing of (DB.byCode[code].ingr || "").split(";").map(s => s.trim()).filter(Boolean)) {
    const k = ing.replace(/\s*\(.*\)$/, "").replace(/, (raw|whole|dry|boiled).*/i, "");
    c.set(k, (c.get(k) || 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
}
function cookLines(R, S) {
  const L = [];
  if (R.T.sodium_mg?.hi) L.push(["Keep salt low in my food; no extra salt on the table.", "मेरे खाने में नमक कम रखें; ऊपर से नमक न दें।"]);
  if (R.blocked("kcl_salt_substitute")) L.push(["Don't use “low-sodium” salt (it has potassium).", "“लो-सोडियम” नमक इस्तेमाल न करें।"]);
  if (R.excludes.some(x => x.field === "jain_ok")) L.push(["No potato, onion, garlic or other root vegetables.", "आलू, प्याज़, लहसुन या ज़मीन के नीचे की सब्ज़ियाँ नहीं।"]);
  if (R.T.potassium_mg?.hardMax) L.push(["Avoid palak and very tomato-heavy gravies for me.", "मेरे लिए पालक और ज़्यादा टमाटर वाली ग्रेवी नहीं।"]);
  if (R.has("P_GLP1") || R.has("P_OLDER_ADULT")) L.push(["Small portions; dal, paneer, curd or egg in every meal.", "थोड़ी मात्रा में; हर खाने में दाल, पनीर, दही या अंडा।"]);
  if (R.avoids.some(x => x.field === "deep_fried")) L.push(["Please don't deep-fry my food; roast, steam or use a little oil.", "मेरा खाना तलें नहीं; भूनें, भाप में पकाएँ या कम तेल डालें।"]);
  if (R.T.added_sugar_g?.hi) L.push(["No sugar in my tea; sweets only on planned days.", "मेरी चाय में चीनी नहीं; मिठाई सिर्फ़ तय दिन।"]);
  if (R.blocked("meal_skipping")) L.push(["Please keep my meals on time, every day.", "मेरा खाना रोज़ समय पर दें।"]);
  if ((S.profile.allergies || []).length) L.push([`Allergy: no ${S.profile.allergies.map(a => a.item.replace("_", " ")).join(", ")}.`, `एलर्जी: ${S.profile.allergies.map(a => a.item.replace("_", " ")).join(", ")} बिल्कुल नहीं।`]);
  if (!L.length) L.push(["Cook as usual — balanced plate, less oil.", "हमेशा की तरह, कम तेल में।"]);
  return L;
}
