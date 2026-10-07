"use strict";
/* Pathya Care — core: utilities, data index, kit rule-language evaluator, care engine, food evaluation. */

/* ---------- utils ---------- */
const pad = n => String(n).padStart(2, "0");
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const TODAY_KEY = dkey(TODAY);
const dOff = o => { const d = new Date(TODAY); d.setDate(d.getDate() - o); return dkey(d); };
const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const nice = k => parseKey(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const niceLong = k => parseKey(k).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const clock = m => { let h = Math.floor(m / 60) % 24; const mi = Math.round(m % 60); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${h}:${pad(mi)} ${ap}`; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n, d = 0) => (n == null || isNaN(n)) ? "–" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: d });
const fmtQ = q => q === 0.5 ? "½" : (q % 1 === 0.5 ? `${Math.floor(q)}½` : String(+q.toFixed(2)));
const pill = (t, l = "accent") => `<span class="pill lvl-${l}">${t}</span>`;
const SRC_LABEL = { P_T2D: "Diabetes", P_PREDIABETES: "Prediabetes", P_T1D: "Type 1 diabetes", P_HTN: "Blood pressure", P_LIPIDS: "Cholesterol", P_CKD: "Kidney", P_PCOS: "PCOS", P_HYPOTHYROID: "Thyroid", P_MASLD: "Fatty liver", P_GOUT: "Gout", P_ANAEMIA: "Iron", P_IBS: "IBS", P_GERD: "Acidity", P_LACTOSE: "Lactose", P_COELIAC: "Coeliac", P_FOOD_ALLERGY: "Allergy", P_PREGNANCY: "Pregnancy", P_OLDER_ADULT: "65+", P_ED_RISK: "Wellbeing", P_POST_BARIATRIC: "After surgery", P_JAIN: "Jain", P_GLP1: "GLP-1 medicine", P_WEIGHT_LOSS: "Weight goal", P_HEALTHY_EATING: "Healthy eating", P_MUSCLE_GAIN: "Muscle goal", P_WEIGHT_GAIN: "Weight gain", P_NUTRIENT_FIX: "Nutrient goal", M_SICK_DAY: "Sick day", M_FASTING: "Vrat", M_FESTIVAL: "Festival", M_EATING_OUT: "Eating out", M_HOUSEHOLD: "Home cook", M_SHIFT_WORK: "Shift work", M_BUDGET: "Budget", CLINICIAN: "Doctor's limit", RDA: "ICMR RDA", GOAL: "Your goal" };
function srcLabel(s) {
  if (!s) return "";
  if (SRC_LABEL[s]) return SRC_LABEL[s];
  if (/^D_/.test(s) && typeof S !== "undefined" && S) { const cls = s.slice(2).toLowerCase(), m = S.meds.find(x => x.cls === cls); return `${m ? (m.brand || cap(m.generic)) : cap(cls.replace(/_/g, " "))} rules`; }
  if (/^screeners\./.test(s)) return "Check-up";
  return s;
}
const srcTag = s => s ? `<span class="src" title="${esc(s)}">${esc(srcLabel(s))}</span>` : "";
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const uid = () => Math.random().toString(36).slice(2, 10);
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

/* ---------- data index ---------- */
const SYN = { roti: "chapati", chapatti: "chapati", phulka: "chapati", chawal: "rice", dahi: "curd", yogurt: "curd", anda: "egg", aloo: "potato", bhindi: "okra", palak: "spinach", rajma: "rajmah", chana: "channa", chole: "channa", daal: "dal", sabzi: "vegetable", sabji: "vegetable", gobi: "cauliflower", matar: "peas", mutter: "peas", baingan: "brinjal", methi: "fenugreek", lauki: "gourd", chai: "tea", chaas: "buttermilk", murgh: "chicken", machli: "fish", macchi: "fish", khichri: "khichdi", chilla: "cheela", paratha: "parantha", subzi: "vegetable", kheera: "cucumber", toor: "arhar", tuvar: "arhar", jeera: "cumin", doodh: "milk", kela: "banana", seb: "apple", amrood: "guava" };
const STOP = new Set(["a", "an", "the", "of", "with", "and", "some", "little", "big", "small", "medium", "bowl", "bowls", "plate", "plates", "glass", "glasses", "cup", "cups", "katori", "piece", "pieces", "pcs", "serving", "servings", "had", "ate", "for", "my", "in", "on", "g", "gm", "gms", "grams", "ml", "half", "one", "two", "three", "four", "five", "ek", "do", "teen", "char", "ka", "ki", "ke", "aur", "tbsp", "tsp", "spoon", "spoons", "breakfast", "lunch", "dinner", "snack", "today", "yesterday"]);
const norm = s => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const toks = s => norm(s).split(" ").filter(Boolean).map(t => SYN[t] || t);
const rawToks = s => norm(s).split(" ").filter(Boolean);

const DB = (() => {
  const F = PD.fields;
  const dishes = PD.dishes.map(r => { const o = {}; F.forEach((f, i) => o[f] = r[i]); return o; });
  for (const d of dishes) {
    const m = d.name.match(/^([^(]+)\(([^)]+)\)/);
    d.short = (m ? m[1] : d.name).replace(/\s+/g, " ").trim();
    d.alt = m ? m[2].split("/")[0].trim() : "";
    d.tk = new Set([...toks(d.name.replace(/[()/]/g, " ")), ...rawToks(d.name.replace(/[()/]/g, " "))]);
    d.algs = d.alg ? d.alg.split(",") : [];
  }
  const byCode = Object.fromEntries(dishes.map(d => [d.code, d]));
  const pathways = Object.fromEntries(PD.pathways.map(p => [p.id, p]));
  const drugs = Object.fromEntries(PD.drugs.map(d => [d.class_id, d]));
  const education = Object.fromEntries(PD.education.map(e => [e.id, e]));
  return { dishes, byCode, pathways, drugs, education, screeners: PD.screeners, fasting: PD.fasting, sources: PD.sources, meta: PD.meta };
})();
const dname = d => d.alt && d.alt.length < 28 ? `${d.short} · ${d.alt}` : d.short;

function searchDishes(q, n = 8, pref = {}) {
  const qt = rawToks(q).filter(t => !STOP.has(t) && !/^\d/.test(t)).map(t => [t, SYN[t] || t]);
  if (!qt.length) return [];
  const out = [];
  for (const d of DB.dishes) {
    let s = 0, ok = true;
    for (const [raw, t] of qt) {
      if (d.tk.has(raw)) s += 3.5;
      else if (d.tk.has(t)) s += 3;
      else if ([...d.tk].some(x => x.startsWith(t) || x.startsWith(raw) || (t.length > 4 && x.startsWith(t.slice(0, -1))))) s += 2;
      else { ok = false; break; }
    }
    if (!ok) continue;
    s -= d.tk.size * 0.15;
    if (d.plan) s += 0.5;
    if (d.code.startsWith("F:")) s += 0.8;
    if (COMMON.has(d.code)) s += 1.5;
    if (pref.diet && !dietOK(d, pref.diet)) s -= 3;
    out.push([s, d]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
}
const QTYW = { half: 0.5, "½": 0.5, a: 1, an: 1, one: 1, ek: 1, two: 2, do: 2, three: 3, teen: 3, four: 4, char: 4, five: 5 };
const COMMON = new Set(["ASC113", "ASC096", "BFP148", "ASC144", "ASC001", "ASC167", "ASC165", "ASC157", "OSR139", "BFP044", "ASC126", "ASC184", "ASC215", "ASC022"]);
function parseMeal(text, pref) {
  const out = [];
  for (const part of text.split(/,|\band\b|\bwith\b|\baur\b|\+|&|\n/i).map(s => s.trim()).filter(Boolean)) {
    const m = norm(part).match(/^(\d+(?:\.\d+)?|half|a|an|one|ek|two|do|three|teen|four|char|five)\b/);
    const q = m ? (QTYW[m[1]] ?? parseFloat(m[1])) : 1;
    const hits = searchDishes(part, 6, pref);
    if (!hits.length) {
      const words = rawToks(part).filter(t => !STOP.has(t) && !/^\d/.test(t));
      if (words.length > 1) { for (const w of words) { const h = searchDishes(w, 6, pref); out.push({ raw: w, q: 1, code: h[0]?.code || null, alts: h.map(x => x.code) }); } continue; }
    }
    out.push({ raw: part, q: q || 1, code: hits[0]?.code || null, alts: hits.map(h => h.code) });
  }
  return out;
}
const dietOK = (d, diet) => diet === "nonveg" ? true : diet === "egg" ? d.diet !== "nonveg" : diet === "vegan" ? d.diet === "veg" && !d.dairy && !d.egg : d.diet === "veg";

/* ---------- kit rule language: safe tokenizer + recursive-descent parser (no eval) ---------- */
const Expr = (() => {
  const cache = new Map();
  function lex(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) { let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++; t.push({ k: "n", v: parseFloat(src.slice(i, j)) }); i = j; continue; }
      if (c === "'" || c === '"') { let j = i + 1; while (j < src.length && src[j] !== c) j++; t.push({ k: "s", v: src.slice(i + 1, j) }); i = j + 1; continue; }
      if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++; t.push({ k: "id", v: src.slice(i, j) }); i = j; continue; }
      const two = src.slice(i, i + 2);
      if (["==", "!=", "<=", ">="].includes(two)) { t.push({ k: "op", v: two }); i += 2; continue; }
      if ("+-*/<>(),[]".includes(c)) { t.push({ k: "op", v: c }); i++; continue; }
      throw new Error("Unexpected character " + c);
    }
    return t;
  }
  function parse(src) {
    const T = lex(src); let p = 0;
    const peek = () => T[p], isOp = v => T[p] && T[p].k === "op" && T[p].v === v, isKw = v => T[p] && T[p].k === "id" && T[p].v === v;
    const expect = v => { if (!isOp(v)) throw new Error("Expected " + v); p++; };
    function ternary() { const a = or(); if (isKw("if")) { p++; const c = or(); if (!isKw("else")) throw new Error("Expected else"); p++; const b = ternary(); return e => truthy(c(e)) ? a(e) : b(e); } return a; }
    function or() { let a = and(); while (isKw("or")) { p++; const l = a, r = and(); a = e => truthy(l(e)) || truthy(r(e)); } return a; }
    function and() { let a = not(); while (isKw("and")) { p++; const l = a, r = not(); a = e => truthy(l(e)) && truthy(r(e)); } return a; }
    function not() { if (isKw("not")) { p++; const a = not(); return e => !truthy(a(e)); } return cmp(); }
    function cmp() {
      let a = add();
      for (;;) {
        let op = null;
        if (T[p] && T[p].k === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(T[p].v)) op = T[p++].v;
        else if (isKw("in")) { p++; op = "in"; }
        else if (isKw("not") && T[p + 1] && T[p + 1].v === "in") { p += 2; op = "notin"; }
        else if (isKw("startswith")) { p++; op = "sw"; }
        if (!op) return a;
        const l = a, r = add();
        a = e => compare(op, l(e), r(e));
      }
    }
    function add() { let a = mul(); while (isOp("+") || isOp("-")) { const o = T[p++].v, l = a, r = mul(); a = e => arith(o, l(e), r(e)); } return a; }
    function mul() { let a = un(); while (isOp("*") || isOp("/")) { const o = T[p++].v, l = a, r = un(); a = e => arith(o, l(e), r(e)); } return a; }
    function un() { if (isOp("-")) { p++; const a = un(); return e => { const v = a(e); return v == null ? null : -v; }; } return prim(); }
    function prim() {
      const t = peek(); if (!t) throw new Error("Unexpected end");
      if (t.k === "n") { p++; return () => t.v; }
      if (t.k === "s") { p++; return () => t.v; }
      if (isOp("(")) { p++; const a = ternary(); expect(")"); return a; }
      if (isOp("[")) { p++; const items = []; while (!isOp("]")) { items.push(ternary()); if (isOp(",")) p++; } p++; return e => items.map(f => f(e)); }
      if (t.k === "id") {
        p++;
        const lit = { true: true, True: true, false: false, False: false, null: null, None: null };
        if (t.v in lit) return () => lit[t.v];
        if (isOp("(")) {
          p++; const args = []; while (!isOp(")")) { args.push(ternary()); if (isOp(",")) p++; } p++;
          return e => { const f = e.funcs[t.v]; if (!f) throw new Error("Unknown function " + t.v); return f(...args.map(a => a(e))); };
        }
        return e => { if (!(t.v in e.vars)) throw new Error("Unknown variable " + t.v); return e.vars[t.v]; };
      }
      throw new Error("Unexpected token " + t.v);
    }
    const f = ternary(); if (p !== T.length) throw new Error("Trailing tokens"); return f;
  }
  const truthy = v => !(v == null || v === false || v === 0 || v === "" || (Array.isArray(v) && !v.length));
  function compare(op, a, b) {
    if (op === "in" || op === "notin") { const r = b == null ? false : Array.isArray(b) ? b.includes(a) : String(b).includes(a); return op === "in" ? r : !r; }
    if (op === "sw") return a != null && b != null && String(a).startsWith(b);
    if (op === "==") return a === b || (a != null && b != null && a == b);
    if (op === "!=") return !(a === b || (a != null && b != null && a == b));
    if (a == null || b == null) return false;
    return op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b;
  }
  function arith(o, a, b) { if (a == null || b == null) return null; return o === "+" ? a + b : o === "-" ? a - b : o === "*" ? a * b : b === 0 ? null : a / b; }
  function evaluate(src, env) {
    if (src == null) return null;
    if (typeof src !== "string") return src;
    let f = cache.get(src); if (!f) { f = parse(src); cache.set(src, f); }
    return f(env);
  }
  return { evaluate, truthy };
})();

/* ---------- care engine: profile + kit pathways + medicine rules → one merged care profile ---------- */
const COND_LIST = [
  ["t2d", "Type 2 diabetes"], ["prediabetes", "Prediabetes"], ["t1d", "Type 1 diabetes"], ["htn", "High blood pressure"], ["lipids", "High cholesterol / triglycerides"],
  ["ckd", "Kidney disease"], ["pcos", "PCOS"], ["hypothyroid", "Underactive thyroid"], ["masld", "Fatty liver (MASLD)"], ["gout", "Gout / high uric acid"],
  ["anaemia", "Anaemia / low iron"], ["ibs", "IBS"], ["gerd", "Acid reflux / GERD"], ["lactose", "Lactose intolerance"], ["coeliac", "Coeliac disease (confirmed)"],
  ["bariatric", "After weight-loss surgery"], ["eating_disorder", "Eating disorder (current or past)"]
];
const COND_NAME = Object.fromEntries(COND_LIST);
const NUT = { energy_kcal: ["kcal", "Energy", "kcal"], protein_g: ["p", "Protein", "g"], carb_g: ["c", "Carbs", "g"], fibre_g: ["fib", "Fibre", "g"], sodium_mg: ["na", "Sodium", "mg"], potassium_mg: ["k", "Potassium", "mg"], phosphorus_mg: ["ph", "Phosphorus", "mg"], added_sugar_g: ["asug", "Added sugar", "g"], added_fat_g: ["afat", "Added oil/fat", "g"], calcium_mg: ["ca", "Calcium", "mg"], iron_mg: ["fe", "Iron", "mg"], vitb12_ug: ["b12", "Vitamin B12", "µg"], sfa_g: ["sfa", "Saturated fat", "g"] };
const PCT = { pct_kcal_carb: ["carb_g", 4], pct_kcal_protein: ["protein_g", 4], pct_kcal_sfa: ["sfa_g", 9] };
const FIELD = { deep_fried: "fried", contains_dairy: "dairy", seafood: "sea", red_meat: "red", organ_meat: "organ", processed_meat: "proc", trans_fat_risk: "trans", lactose_level: "lact", main_protein_source: "mps", category: "cat", contains_alcohol: "alc", tyramine_risk: "tyr", contains_caffeine: "caf", jain_ok: "jain", vrat_ok_common: "vrat", vrat_ok_strict: "vrat", top_ingredients: "ingr", name: "name", added_sugar_g: "asug", vitk_ug: "vitk", vitb12_ug: "b12", contains_egg: "egg" };
const ACT = { sedentary: 1.25, light: 1.4, moderate: 1.55, active: 1.7 };
const bmrOf = p => Math.round(10 * p.weight + 6.25 * (p.height || 160) - 5 * (p.age || 30) + (p.sex === "female" ? -161 : 5));
const burnOf = p => p.burn || Math.round(bmrOf(p) * (ACT[p.activity] || 1.4) / 10) * 10;

function latest(S, key) { const r = S.readings.filter(x => x.key === key).sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t)); return r.length ? r[r.length - 1] : null; }
function medClasses(S) { return new Set(S.meds.map(m => m.cls)); }
function hasCond(S, id) { return S.conditions.some(c => c.id === id); }

function dishMatch(d, field, op, value) {
  let key = FIELD[field], v;
  if (field.startsWith("allergen_")) { const a = field.slice(9); v = d.algs.includes(a) ? 1 : 0; }
  else if (key === undefined) return null;
  else v = d[key];
  if (op === "==") return v == value;
  if (op === "!=") return v != value;
  if (op === ">") return v > value;
  if (op === ">=") return v >= value;
  if (op === "<") return v < value;
  if (op === "in") return Array.isArray(value) && value.includes(v);
  if (op === "contains_any") return Array.isArray(value) && value.some(x => String(v || "").toLowerCase().includes(String(x).toLowerCase()));
  if (op === "regex" || op === "matches" || op === "~") { const s = String(value), i = s.startsWith("(?i)"); return new RegExp(i ? s.slice(4) : s, i ? "i" : "").test(String(v || "")); }
  return null;
}

function buildCare(S) {
  const p = S.profile, M = medClasses(S), W = p.weight, F = p.sex === "female";
  const lab = k => { const r = latest(S, k); return r ? r.v : null; };
  const glpMed = S.meds.find(m => m.cls === "glp1");
  const wsi = glpMed && glpMed.increasedOn ? daysBetween(glpMed.increasedOn, TODAY_KEY) / 7 : null;
  const bmr = bmrOf(p), burn = burnOf(p), bmi = p.height ? W / Math.pow(p.height / 100, 2) : null;
  const answers = Object.assign({ "pattern.who_cooks": p.whoCooks || "Me", "sleep.shift": p.shift || "No", "med.pregnancy": p.pregnancy || "No", "diet.jain_detail": p.jainDetail || [], "ckd.dialysis": !!p.dialysis, "coeliac.confirmed": hasCond(S, "coeliac") ? "Yes" : "No", "allergy.items": (p.allergies || []).map(a => a.item), "intol.items": hasCond(S, "lactose") ? ["Milk (lactose)"] : [] }, S.answers || {});
  const vars = {
    weight_kg: W, height_cm: p.height, bmi, age: p.age, sex: p.sex, goal: p.goal, diet_type: p.diet === "jain" ? "Jain" : p.diet, formula_bmr: bmr, burn, energy_target: burn,
    egfr: lab("egfr"), weeks_since_increase: wsi, rate_kg_wk: 0.5, target_bmi: null, today: TODAY_KEY, travel: !!S.modes.eatingOut, user_reports_illness: !!S.modes.sick,
    outside_meals_this_week: S.modes.eatingOut ? 5 : 0, fast: S.modes.fasting ? (S.modes.fastType || "ekadashi") : null, level: "common", item: null, severity: null, nephrologist_or_null: null, extra_by_stage: 0
  };
  const funcs = {
    has_condition: id => id === "diabetes_any" ? ["t2d", "t1d", "prediabetes"].some(x => hasCond(S, x)) : hasCond(S, id),
    med_class: c => M.has(c), lab, answer: id => answers[id] ?? null, answered: id => answers[id] != null && !(Array.isArray(answers[id]) && !answers[id].length),
    screen: id => S.screens?.[id] ?? null, disclosed: () => false, fasting_day: () => !!S.modes.fasting, event_day: () => !!S.modes.festival,
    max: (...a) => a.some(x => x == null) ? null : Math.max(...a), min: (...a) => a.some(x => x == null) ? null : Math.min(...a), abs: Math.abs, round: Math.round, len: a => a ? a.length : 0
  };
  const env = { vars, funcs }, ev = s => Expr.evaluate(s, env), errors = [];
  const safe = (s, dflt = null) => { try { return ev(s); } catch (e) { errors.push(String(s) + " → " + e.message); return dflt; } };

  // 1. active pathways (kit triggers) + medicine overlays
  const goalPath = { lose: "P_WEIGHT_LOSS", maintain: "P_HEALTHY_EATING", gain: "P_WEIGHT_GAIN", muscle: "P_MUSCLE_GAIN", nutrient: "P_NUTRIENT_FIX" }[p.goal];
  const active = [];
  for (const path of Object.values(DB.pathways)) {
    if (path.kind === "goal") { if (path.id === goalPath) active.push(path); continue; }
    if (path.triggers.some(t => Expr.truthy(safe(t, false)))) active.push(path);
  }
  const edRisk = active.some(x => x.id === "P_ED_RISK");
  if (edRisk) { const gi = active.findIndex(x => x.kind === "goal"); if (gi >= 0) active.splice(gi, 1); }
  for (const cls of M) {
    const d = DB.drugs[cls]; if (!d) continue;
    const names = [...new Set(S.meds.filter(m => m.cls === cls).map(m => m.generic))].join(", ");
    active.push({ id: "D_" + cls.toUpperCase(), name: `Medicine rules · ${names}`, kind: "drug_overlay", precedence: 70, handoff: d.severity === "high" ? "doctor_confirm" : "self_guided", handoff_message: d.issue, rules: d.rules_machine || [], plan_style: d.rules || [], red_flags: [], monitoring: [], education: [], drug: d });
  }
  const lim = S.limits || {};
  if (Object.keys(lim).some(k => lim[k] && lim[k].v)) active.push({ id: "CLINICIAN", name: "Limits from your clinician", kind: "clinician", precedence: 90, handoff: "clinician_led", handoff_message: "Entered by you from your doctor's advice. Pathya never changes them.", rules: Object.entries(lim).filter(([, x]) => x && x.v).map(([k, x]) => ({ action: "limit", strength: "hard", nutrient: k, max: x.v, why: `${x.by || "Your clinician"}${x.date ? " · " + nice(x.date) : ""}` })), plan_style: [], red_flags: [], monitoring: [], education: [] });
  active.sort((a, b) => b.precedence - a.precedence);

  // 2. blocks first (they change the energy target)
  const R = { paths: active, T: {}, blocks: [], gates: [], excludes: [], avoids: [], prefers: [], patterns: [], flags: [], monitoring: [], education: [], conflicts: [], notes: [], errors, edRisk, hideCalories: edRisk, bmr, burn, bmi, wsi };
  const when = r => (r.when ? Expr.truthy(safe(r.when, false)) : true) && !(r.unless && Expr.truthy(safe(r.unless, false)));
  for (const path of active) for (const r of path.rules) if (r.action === "block" && when(r)) for (const f of String(r.feature).split(",")) {
    const b = R.blocks.find(x => x.id === f); if (b) b.src.push(path.id); else R.blocks.push({ id: f, why: r.why, src: [path.id] });
  }
  const blocked = id => R.blocks.some(b => b.id === id || b.id.endsWith("_" + id) || b.id.startsWith(id + "_and_"));
  const noDeficit = blocked("deficit") || blocked("calorie_numbers") || S.modes.sick || S.modes.fasting || S.modes.festival;
  let E = burn;
  if (p.goal === "lose" && !noDeficit) E = Math.max(Math.max(1200, bmr), Math.round((burn - Math.min(0.5 * 7700 / 7, 0.2 * burn)) / 10) * 10);
  if (p.goal === "gain") E = Math.round(burn * 1.1 / 10) * 10;
  if (p.pregnancy === "Pregnant") E = burn + 350; else if (p.pregnancy === "Breastfeeding") E = burn + 600;
  vars.energy_target = E; R.E = E; R.noDeficit = noDeficit;

  // 3. targets & limits with precedence merge
  const setBound = (key, kind, val, strength, path, why) => {
    if (val == null || isNaN(val)) return;
    const t = R.T[key] || (R.T[key] = { key, label: NUT[key]?.[1] || key, unit: NUT[key]?.[2] || "", hardMin: null, hardMax: null, softMin: null, softMax: null, src: [], why: [] });
    const hard = strength === "hard";
    if (kind === "min") {
      const ceil = t.hardMax;
      if (ceil != null && val > ceil) { R.conflicts.push({ text: `${t.label} ≥ ${fmt(val)} ${t.unit} (${path.id}) conflicts with ≤ ${fmt(ceil)} ${t.unit} from a higher-precedence path — dropped`, src: path.id }); return; }
      if (hard) t.hardMin = Math.max(t.hardMin ?? -Infinity, val); else t.softMin = Math.max(t.softMin ?? -Infinity, val);
    } else {
      const floor = t.hardMin;
      if (floor != null && val < floor) { R.conflicts.push({ text: `${t.label} ≤ ${fmt(val)} ${t.unit} (${path.id}) conflicts with ≥ ${fmt(floor)} ${t.unit} from a higher-precedence path — dropped`, src: path.id }); return; }
      const prev = hard ? t.hardMax : t.softMax;
      if (prev != null && val !== prev && t.src.length) R.notes.push(`${t.label}: ${fmt(Math.min(prev, val))} ${t.unit} kept (stricter of ${fmt(prev)} and ${fmt(val)})`);
      if (hard) t.hardMax = Math.min(t.hardMax ?? Infinity, val); else t.softMax = Math.min(t.softMax ?? Infinity, val);
    }
    if (!t.src.includes(path.id)) t.src.push(path.id);
    if (why && !t.why.includes(why)) t.why.push(why);
  };
  const STAGE_E = { Pregnant: 350, Breastfeeding: 600 }, STAGE_P = { Pregnant: 22, Breastfeeding: 16.9 };
  for (const path of active) {
    for (const r of path.rules) {
      if (!when(r)) continue;
      const a = r.action;
      if (a === "target" || a === "limit") {
        if (!r.nutrient) { if (r.field) R.patterns.push({ text: r.why, src: path.id, strength: r.strength, weekly: { field: r.field, op: r.op, value: r.value, max: r.max } }); continue; }
        for (const nk of String(r.nutrient).split("|")) {
          vars.extra_by_stage = nk === "energy_kcal" ? (STAGE_E[p.pregnancy] || 0) : (STAGE_P[p.pregnancy] || 0);
          const evalB = x => x === "nephrologist_or_null" ? (lim[nk]?.v ?? null) : safe(x);
          let lo = r.min != null ? evalB(r.min) : null, hi = r.max != null ? evalB(r.max) : null;
          let key = nk;
          if (PCT[nk]) { const [g, k] = PCT[nk]; key = g; lo = lo != null ? lo * E / 100 / k : null; hi = hi != null ? hi * E / 100 / k : null; }
          if (!NUT[key]) { if (nk === "weight_loss_pct" && lo) R.patterns.push({ text: r.why, src: path.id, strength: r.strength }); continue; }
          if (key === "energy_kcal") { if (r.warn_below) { const w = safe(r.warn_below); if (w) R.energyWarn = { v: w, src: path.id, why: r.why }; } continue; }
          if (nk === "potassium_mg" && hi == null && r.max === "nephrologist_or_null") { if (!R.gates.some(g => g.id === "ckd_limits")) R.gates.push({ id: "ckd_limits", why: "Add your nephrologist's potassium and phosphorus limits — Pathya won't guess them", src: path.id }); continue; }
          if (lo != null) setBound(key, "min", Math.round(lo), r.strength, path, r.why);
          if (hi != null) setBound(key, "max", Math.round(hi), r.strength, path, r.why);
        }
      } else if (a === "gate") { if (!R.gates.some(g => g.id === r.feature)) R.gates.push({ id: r.feature, why: r.why, src: path.id }); }
      else if (a === "exclude") {
        const fields = String(r.field).includes("{item}") ? (p.allergies || []).map(x => r.field.replace("{item}", x.item)) : [String(r.field).replace("{level}", "common")];
        for (const f of fields) if (!R.excludes.some(x => x.field === f && JSON.stringify(x.value) === JSON.stringify(r.value))) R.excludes.push({ field: f, op: r.op, value: r.value, why: r.why, src: path.id });
      }
      else if (a === "avoid") { if (!R.avoids.some(x => x.field === r.field && JSON.stringify(x.value) === JSON.stringify(r.value))) R.avoids.push({ field: r.field, op: r.op, value: r.value, weight: r.weight || 0.3, why: r.why, src: path.id }); }
      else if (a === "prefer") { if (!R.prefers.some(x => x.field === r.field && JSON.stringify(x.value) === JSON.stringify(r.value))) R.prefers.push({ field: r.field, op: r.op, value: r.value, weight: r.weight || 0.2, why: r.why, src: path.id }); }
      else if (a !== "block") { if (!R.patterns.some(x => x.text === r.why)) R.patterns.push({ text: r.why, src: path.id, strength: r.strength, rule: r.rule || r.feature, params: r.params }); }
    }
    for (const f of path.red_flags || []) R.flags.push({ sig: f.signal, act: f.action, src: path.id });
    for (const m of path.monitoring || []) R.monitoring.push({ ...m, src: path.id });
    for (const e of path.education || []) if (DB.education[e]) R.education.push({ ...DB.education[e], src: path.id });
  }
  // dietary pattern from the profile is always a hard filter
  R.dietType = p.diet === "jain" ? "veg" : p.diet;
  // energy display
  if (!R.hideCalories) R.T.energy_kcal = { key: "energy_kcal", label: "Energy", unit: "kcal", hardMin: null, hardMax: null, softMin: null, softMax: null, target: R.noDeficit && blocked("deficit") ? null : E, warn: R.energyWarn?.v, src: [R.noDeficit && blocked("deficit") ? (R.blocks.find(b => b.id === "deficit")?.src[0]) : (goalPath || "GOAL")], why: [R.noDeficit && blocked("deficit") ? "No calorie target — " + (R.blocks.find(b => b.id === "deficit")?.why || "") : p.goal === "lose" ? `Measured burn ${fmt(burn)} minus a safe deficit; never below ${fmt(Math.max(1200, bmr))}` : "Matches your measured burn"] };
  for (const t of Object.values(R.T)) { t.lo = Math.max(t.hardMin ?? -Infinity, t.softMin ?? -Infinity); t.hi = Math.min(t.hardMax ?? Infinity, t.softMax ?? Infinity); if (!isFinite(t.lo)) t.lo = null; if (!isFinite(t.hi)) t.hi = null; if (t.lo != null && t.hi != null && t.lo > t.hi) t.lo = t.hardMin ?? t.hi; t.hard = t.hardMin != null || t.hardMax != null; }
  R.has = id => active.some(x => x.id === id);
  R.blocked = blocked;
  R.gated = id => R.gates.some(g => g.id === id) && !(S.gatesOK || {})[id];
  R.mealsMin = R.patterns.find(x => x.rule === "small_frequent_protein_first")?.params?.min_eating_times || R.patterns.find(x => x.rule === "eating_times_min")?.params?.n || (edRisk ? 5 : 3);
  R.perMealCarb = R.T.carb_g?.hi ? Math.round(R.T.carb_g.hi / 3.5) : null;
  return R;
}

/* ---------- food evaluation (shared by Today, Diet chart, Chat) ---------- */
function totalsOf(items) {
  const t = { kcal: 0, p: 0, c: 0, fib: 0, fat: 0, sfa: 0, asug: 0, afat: 0, na: 0, k: 0, ph: 0, ca: 0, fe: 0, b12: 0 };
  for (const [code, q] of items) { const d = DB.byCode[code]; if (!d) continue; for (const k in t) t[k] += (d[k] || 0) * q; }
  return t;
}
const dayItems = (S, k) => (S.logs[k] || []).flatMap(l => l.items);
function dishFlags(d, q, R, S) {
  const f = [], p = S.profile;
  if (!dietOK(d, R.dietType)) f.push({ lvl: "block", text: `Not ${({ veg: "vegetarian", egg: "eggetarian", vegan: "vegan" })[R.dietType] || R.dietType}`, src: "Profile" });
  for (const x of R.excludes) { const m = dishMatch(d, x.field, x.op, x.value); if (m) f.push({ lvl: "block", text: x.why, src: x.src, swap: true }); }
  if (!R.edRisk) {
    for (const x of R.avoids) if (dishMatch(d, x.field, x.op, x.value)) f.push({ lvl: "warn", text: x.why, src: x.src, swap: true });
    const share = (key, field) => { const t = R.T[key]; return t && t.hi ? d[field] * q / t.hi : 0; };
    for (const [key, field] of [["sodium_mg", "na"], ["potassium_mg", "k"], ["phosphorus_mg", "ph"], ["added_sugar_g", "asug"]]) {
      const s = share(key, field), t = R.T[key];
      if (s >= 0.25) f.push({ lvl: t.hardMax != null && s >= 0.4 ? "block" : "warn", text: `${t.label}: ${fmt(d[field] * q)} ${t.unit} — ${Math.round(s * 100)}% of your daily ${fmt(t.hi)} ${t.unit}`, src: t.src[0], swap: true });
    }
    if (R.T.carb_g && R.perMealCarb && d.c * q > R.perMealCarb) f.push({ lvl: "warn", text: `${fmt(d.c * q)} g carbs — more than your ~${R.perMealCarb} g meal budget`, src: R.T.carb_g.src[0], swap: true });
    if (R.has("P_T1D")) f.push({ lvl: "info", text: `${fmt(d.c * q / 15, 1)} carb exchanges (15 g each)`, src: "P_T1D" });
    for (const x of R.prefers) if (dishMatch(d, x.field, x.op, x.value)) f.push({ lvl: "ok", text: x.why.split(".")[0], src: x.src });
    if (R.T.fibre_g && d.fib * q >= 5) f.push({ lvl: "ok", text: `Good fibre: ${fmt(d.fib * q, 1)} g`, src: R.T.fibre_g.src[0] });
    if (R.T.protein_g && (R.has("P_GLP1") || R.has("P_OLDER_ADULT") || R.has("P_MUSCLE_GAIN")) && d.p * q >= 10) f.push({ lvl: "ok", text: `Protein: ${fmt(d.p * q, 1)} g`, src: R.T.protein_g.src[0] });
  } else {
    for (const x of R.avoids) if (x.src === "P_FOOD_ALLERGY") f.push({ lvl: "warn", text: x.why, src: x.src });
  }
  return f;
}
const isBlocked = (d, R, S) => dishFlags(d, 1, R, S).some(f => f.lvl === "block");
function swapsFor(code, R, S, exclude = [], n = 3) {
  const d = DB.byCode[code]; if (!d) return [];
  const JUNK = /gravy|\bdip\b|dressing|stock|filling|sauce|samosa|pakor|pakod|kachori|bonda|vada|cutlet|patties|cake|pudding|shake|cookie|biscuit|\bpie\b|tart|pastry|souffle|sandwich/i;
  const score = x => x.p / Math.max(30, x.kcal) * 10 + x.fib / 4 - x.na / 600 - (R.T.potassium_mg?.hi ? x.k / 400 : 0) - Math.abs(x.kcal - d.kcal) / 300 - (x.fried ? 1.5 : 0) + (x.region === d.region ? 0.5 : 0) + (x.region === S.profile.region ? 0.4 : 0) - (x.code.startsWith("F:") && !d.code.startsWith("F:") && d.cat !== "sweet" ? 1 : 0) + (d.cat === "sweet" && x.code.startsWith("F:") ? 1 : 0);
  const pass = x => x.code !== code && !exclude.includes(x.code) && x.plan && !JUNK.test(x.name) && !dishFlags(x, 1, R, S).some(f => f.lvl === "block" || f.lvl === "warn");
  let cands = d.cat === "sweet" ? DB.dishes.filter(x => ["fruit", "curd_raita", "nuts"].includes(x.cat) && pass(x)) : DB.dishes.filter(x => x.cat === d.cat && pass(x));
  if (cands.length < n) {
    const P = typeof pools === "function" ? pools(R, S) : null;
    const FALL = { snack_fried: ["snack", "bfMain"], beverage: ["snack"], chutney_pickle: ["side"], snack: ["snack"] };
    let src;
    if (d.cat === "sweet") src = DB.dishes.filter(x => ["fruit", "curd_raita", "nuts"].includes(x.cat));
    else if (P && FALL[d.cat]) src = FALL[d.cat].flatMap(k => P[k] || []);
    else { const pool = P ? Object.entries(P).filter(([k, v]) => k !== "key" && v.some(x => x.code === code)).flatMap(([, v]) => v) : []; src = pool.length ? pool : DB.dishes.filter(x => Math.abs(x.kcal - d.kcal) < d.kcal * 0.5 && ["breakfast", "other", "dal_legume", "vegetable", "rice", "bread", "paneer", "egg", "curd_raita"].includes(x.cat)); }
    cands = cands.concat(src.filter(x => pass(x) && !cands.some(c => c.code === x.code)));
  }
  return cands.map(x => [score(x), x.code]).sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
}
