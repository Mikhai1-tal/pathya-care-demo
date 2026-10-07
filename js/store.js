"use strict";
/* Pathya Care — state, persistence (on-device only) and demo people. */

const STORE_KEY = "pathya-care-v1";
const SLOTS = [["Breakfast", 510], ["Mid-morning", 660], ["Lunch", 810], ["Evening snack", 1020], ["Dinner", 1230]];
const slotAt = m => m < 630 ? "Breakfast" : m < 750 ? "Mid-morning" : m < 930 ? "Lunch" : m < 1140 ? "Evening snack" : "Dinner";
const METRICS = {
  weight: ["Weight", "kg", "vital"], waist: ["Waist", "cm", "vital"], bp: ["Blood pressure", "mmHg", "vital"], glucose: ["Glucose", "mg/dL", "vital"],
  hba1c: ["HbA1c", "%", "lab"], tg: ["Triglycerides", "mg/dL", "lab"], ldl: ["LDL cholesterol", "mg/dL", "lab"], hdl: ["HDL cholesterol", "mg/dL", "lab"],
  egfr: ["eGFR", "mL/min/1.73m²", "lab"], creat: ["Creatinine", "mg/dL", "lab"], k: ["Potassium (blood)", "mmol/L", "lab"], phos: ["Phosphorus (blood)", "mg/dL", "lab"],
  tsh: ["TSH", "mIU/L", "lab"], hb: ["Haemoglobin", "g/dL", "lab"], b12: ["Vitamin B12", "pg/mL", "lab"], vitd: ["Vitamin D", "ng/mL", "lab"], uric: ["Uric acid", "mg/dL", "lab"],
  nausea: ["Nausea", "0–3", "symptom"], symptom: ["Symptom note", "", "symptom"], dose: ["Dose taken", "", "dose"], period: ["Period started", "", "cycle"], strength: ["Strength training", "min", "activity"], activity: ["Activity", "min", "activity"]
};
const LIMIT_KEYS = { potassium_mg: "Potassium", phosphorus_mg: "Phosphorus", protein_g: "Protein", sodium_mg: "Sodium" };
const FREQ = ["Once a day", "Twice a day", "Three times a day", "Once a week", "As needed"];
const TIMING = ["Before breakfast", "With breakfast", "With lunch", "With dinner", "At bedtime", "Morning", "Evening", "Weekly"];
const TIMING_MINS = { "Before breakfast": 480, "With breakfast": 510, Morning: 540, "With lunch": 810, Evening: 1080, "With dinner": 1230, "At bedtime": 1320, Weekly: 1260 };

function blankState() {
  return {
    v: 1, demo: null,
    profile: { name: "", age: 35, sex: "female", height: 160, weight: 65, activity: "light", waist: null, diet: "veg", region: "north", jainDetail: [], allergies: [], dislikes: "", mustKeep: "", goal: "maintain", whoCooks: "Me", shift: "No", pregnancy: "No", dialysis: false, language: "English", consent: false },
    conditions: [], meds: [], readings: [], limits: {}, logs: {}, docs: [], chat: [], escalations: [], events: [],
    team: { doctor: { name: "", spec: "", phone: "" }, dietitian: { name: "", phone: "" }, caregiver: { name: "", rel: "", phone: "", notify: true } },
    modes: { sick: false, fasting: false, fastType: "ekadashi", festival: false, eatingOut: false }, gatesOK: {}, screens: {}, answers: {}, tasks: {}, goals: [], planSeed: 1, planSwaps: {},
    setup: { noConds: false, noMeds: false, dismissed: false },
    privacy: { showCalories: true, reminders: true, shareCaregiver: true }
  };
}
let S = null;
const UI = { tab: "today", careSeg: "state", sheet: null, review: null, draft: "", toast: null, calMonth: null, calSel: null, calFilters: {}, planDay: 0, hl: false, fakeNow: null, logDate: null, chatImg: null, allTargets: false };
const now = () => UI.fakeNow ?? nowMins();

function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { S = Object.assign(blankState(), JSON.parse(raw)); return true; } } catch (e) { console.warn(e); }
  S = null; return false;
}
let saveTimer = null;
function writeNow() {
  clearTimeout(saveTimer); saveTimer = null; if (!S) return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { toast("Storage is full on this device. Remove some uploaded photos in Medical report."); }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 150);
}
if (typeof addEventListener === "function") {
  addEventListener("pagehide", () => { if (saveTimer) writeNow(); });
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && saveTimer) writeNow(); });
}
function resetAll() { clearTimeout(saveTimer); saveTimer = null; localStorage.removeItem(STORE_KEY); S = null; }

function addReading(key, v, extra = {}) { const r = { id: uid(), key, v, d: extra.d || TODAY_KEY, t: extra.t || clock(now()), ...extra }; S.readings.push(r); return r; }
function addLog(items, opts = {}) {
  const d = opts.d || TODAY_KEY, mins = opts.mins ?? now();
  (S.logs[d] = S.logs[d] || []).push({ id: uid(), slot: opts.slot || slotAt(mins), mins, items, photo: opts.photo || null });
}
function escalate(level, title, detail, src) {
  const open = S.escalations.find(e => e.title === title && e.status !== "resolved" && e.d === TODAY_KEY);
  if (open) return open;
  const e = { id: uid(), level, title, detail, src, d: TODAY_KEY, t: clock(now()), status: "open" };
  S.escalations.unshift(e); return e;
}

/* ---------- demo people (built from the dietitian kit's worked examples) ---------- */
const DEMOS = {
  rajesh: {
    blurb: "T2D + high BP · glimepiride, metformin, telmisartan · Punjabi vegetarian",
    profile: { name: "Rajesh Kumar", age: 45, sex: "male", height: 172, weight: 82, activity: "light", waist: 98, diet: "veg", region: "north", goal: "lose", whoCooks: "Family member", burn: 2350 },
    conditions: [["t2d", "2019", true], ["htn", "2021", true]],
    meds: [["glimepiride", "sulfonylurea", "Amaryl", 2, "mg", "Once a day", "Before breakfast", 2020], ["metformin", "metformin", "Glycomet", 500, "mg", "Twice a day", "With lunch", 2019], ["telmisartan", "acei_arb", "Telma", 40, "mg", "Once a day", "Morning", 2021]],
    labs: { hba1c: [7.8, 40], tg: [182, 40], ldl: [118, 40], egfr: [88, 40], b12: [310, 200] },
    glucose: [148, 152, 139, 144, 136, 141, 150, 133, 138, 146, 129, 137, 142, 134], bp: [[142, 90], [138, 88], [146, 92], [136, 86], [134, 86], [138, 84], [132, 84]], weight: [84.1, 83.4, 82.6, 82.0],
    low: [4, "5:10 pm", 66, "Shaky and sweaty — evening snack was late"],
    usual: [[["ASC101", 2], ["ASC022", 1]], [["ASC096", 3], ["ASC165", 1], ["ASC184", 1]], [["ASC001", 1], ["OSR100", 1]], [["ASC096", 2], ["ASC215", 1]]],
    today: [["Breakfast", 490, [["ASC101", 2], ["ASC022", 1]]], ["Mid-morning", 660, [["ASC001", 1]]]],
    team: { doctor: { name: "Dr. Mehta", spec: "Diabetologist", phone: "+919800000001" }, caregiver: { name: "Priya Kumar", rel: "Daughter", phone: "+919800000002", notify: true } },
    events: [[6, "vrat", "Ekadashi vrat planned"]], draft: "2 roti, rajma, bhindi and a glass of lassi"
  },
  meera: {
    blurb: "On Mounjaro (tirzepatide), dose raised 13 days ago · eggetarian, Tamil",
    profile: { name: "Meera Iyer", age: 38, sex: "female", height: 160, weight: 68, activity: "light", diet: "egg", region: "south", goal: "lose", burn: 2050 },
    conditions: [],
    meds: [["tirzepatide", "glp1", "Mounjaro", 5, "mg", "Once a week", "Weekly", 2026, 13]],
    labs: { hba1c: [5.9, 60] }, weight: [70.2, 69.4, 68.6, 68.3, 68.0], nausea: [2, 3, 2, 2, 1, 1, 2, 1, 1, 1, 0, 1, 1, 1],
    usual: [[["ASC144", 2], ["ASC167", 0.5]], [["F:IFCT:E012", 1]], [["ASC126", 0.5], ["ASC056", 1]], [["ASC001", 1]], [["BFP148", 2], ["ASC215", 0.5]]],
    today: [["Breakfast", 540, [["ASC144", 2], ["ASC167", 0.5]]]],
    team: { doctor: { name: "Dr. Natarajan", spec: "Endocrinologist", phone: "+919800000003" } },
    events: [], draft: "1 samosa and chai"
  },
  anaya: {
    blurb: "PCOS · Jain food rules · goal: lose",
    profile: { name: "Anaya Shah", age: 29, sex: "female", height: 158, weight: 64, activity: "light", diet: "jain", region: "west", goal: "lose", jainDetail: [], burn: 2000 },
    conditions: [["pcos", "2023", true]], meds: [], labs: { tsh: [2.1, 90], hb: [11.4, 90] }, weight: [64.4, 64.0, 63.6], period: [54, 18],
    usual: [[["ASC462", 2], ["ASC001", 1]], [["ASC096", 2], ["ASC184", 1], ["BFP303", 1]], [["F:IFCT:E028", 1]], [["ASC096", 2], ["BFP576", 1]]],
    today: [["Breakfast", 510, [["ASC462", 2], ["ASC001", 1]]]],
    team: { doctor: { name: "Dr. Desai", spec: "Gynaecologist", phone: "+919800000004" } },
    events: [[-10, "festival", "Cousin's wedding"]], draft: "poha and palak paneer"
  },
  suresh: {
    blurb: "T2D + kidney disease (stage 3b) + high BP · clinician-led",
    profile: { name: "Suresh Rao", age: 62, sex: "male", height: 168, weight: 70, activity: "sedentary", diet: "veg", region: "south", goal: "maintain", burn: 1650 },
    conditions: [["t2d", "2012", true], ["ckd", "2023", true], ["htn", "2015", true]],
    meds: [["gliclazide", "sulfonylurea", "Diamicron", 30, "mg", "Once a day", "With breakfast", 2016], ["telmisartan", "acei_arb", "Telma", 40, "mg", "Once a day", "Morning", 2015]],
    labs: { egfr: [38, 35], k: [5.1, 35], phos: [4.8, 35], hba1c: [7.2, 48], creat: [1.9, 35] },
    limits: { potassium_mg: [2000, "Dr. Rao (nephrologist)"], phosphorus_mg: [900, "Dr. Rao (nephrologist)"] },
    glucose: [118, 124, 131, 115, 127, 122, 119, 126, 121, 117, 124, 120, 118, 122], bp: [[138, 86], [136, 84], [140, 88], [134, 84], [136, 82], [138, 84], [132, 82]], weight: [70.4, 70.0],
    usual: [[["ASC144", 3], ["ASC167", 0.5]], [["BFP148", 2], ["ASC184", 1]], [["ASC001", 1]], [["ASC096", 3], ["ASC184", 0.5], ["OSR100", 1]]],
    today: [["Breakfast", 480, [["ASC144", 3], ["ASC167", 0.5]]]],
    team: { doctor: { name: "Dr. Rao", spec: "Nephrologist", phone: "+919800000005" }, caregiver: { name: "Lakshmi Rao", rel: "Wife", phone: "+919800000006", notify: true } },
    events: [], draft: "2 roti, palak paneer and sambar"
  }
};

function loadDemo(id) {
  const x = DEMOS[id], s = blankState();
  s.demo = id;
  Object.assign(s.profile, x.profile, { consent: true });
  s.conditions = x.conditions.map(([cid, since, confirmed]) => ({ id: cid, since, confirmed }));
  s.meds = x.meds.map(([generic, cls, brand, dose, unit, freq, timing, start, incDaysAgo]) => ({ id: uid(), generic, cls, brand, dose, unit, freq, timing, start: String(start), duration: "Ongoing", increasedOn: incDaysAgo != null ? dOff(incDaysAgo) : null, confirmed: true }));
  const R = [];
  const add = (key, v, o, extra = {}) => R.push({ id: uid(), key, v, d: dOff(o), t: extra.t || "8:00 am", ...extra });
  for (const [k, [v, o]] of Object.entries(x.labs || {})) add(k, v, o, { t: "", src: "Lab report" });
  (x.glucose || []).forEach((v, i) => add("glucose", v, 13 - i, { t: "7:30 am", ctx: "Fasting" }));
  if (x.glucose) [[12, 196], [10, 184], [8, 205], [6, 178], [4, 172], [2, 188], [1, 169]].forEach(([o, v]) => add("glucose", id === "suresh" ? v - 30 : v, o, { t: "3:30 pm", ctx: "2 h after a meal" }));
  if (x.low) add("glucose", x.low[2], x.low[0], { t: x.low[1], ctx: "Random", note: x.low[3] });
  (x.bp || []).forEach(([sy, di], i) => add("bp", sy, 12 - i * 2, { v2: di }));
  (x.weight || []).forEach((v, i, a) => add("weight", v, (a.length - 1 - i) * 7, { t: "7:00 am" }));
  (x.nausea || []).forEach((v, i) => add("nausea", v, 13 - i, { t: "8:00 pm" }));
  if (id === "meera") { [27, 20, 13, 6].forEach((o, i) => add("dose", i < 2 ? "2.5 mg" : "5 mg", o, { t: "9:00 pm", note: i === 2 ? "Dose increased" : "" })); add("strength", 30, 5, { t: "7:00 pm" }); }
  (x.period || []).forEach(o => add("period", 1, o, { t: "" }));
  s.readings = R;
  for (const [k, [v, by]] of Object.entries(x.limits || {})) s.limits[k] = { v, by, date: dOff(33) };
  for (let o = 13; o >= 1; o--) {
    if ((id === "rajesh" && (o === 3 || o === 9)) || (id === "anaya" && o % 3 === 1)) continue;
    const d = dOff(o);
    s.logs[d] = x.usual.map((items, i) => ({ id: uid(), slot: x.usual.length === 5 ? SLOTS[i][0] : ["Breakfast", "Lunch", "Evening snack", "Dinner"][i], mins: x.usual.length === 5 ? SLOTS[i][1] : [510, 810, 1020, 1230][i], items }));
  }
  s.logs[TODAY_KEY] = x.today.map(([slot, mins, items]) => ({ id: uid(), slot, mins, items }));
  Object.assign(s.team.doctor, x.team.doctor || {}); Object.assign(s.team.caregiver, x.team.caregiver || {});
  s.events = (x.events || []).map(([o, kind, label]) => ({ id: uid(), d: dOff(o), kind, label }));
  if (id === "rajesh") s.escalations.push({ id: uid(), level: "routine", title: `Low glucose (66 mg/dL) on ${nice(dOff(4))}`, detail: "Shaky and sweaty at 5:10 pm — evening snack was late. Treated with the 15-15 rule.", src: "P_T2D", d: dOff(4), t: "5:30 pm", status: "open" });
  s.chat = [{ id: uid(), role: "bot", text: `Namaste ${x.profile.name.split(" ")[0]}! Ask me about any food, your targets, fasting, or how you feel. I answer from Pathya's food database and your care rules. I never change medicines; I'll help you ask your doctor instead.`, d: TODAY_KEY, t: "" }];
  s.planSeed = 7; s.setup = { noConds: true, noMeds: true, dismissed: true };
  S = s; UI.draft = x.draft || ""; UI.review = null; UI.fakeNow = null; UI.tab = "today"; UI.careSeg = "state";
  writeNow();
}
function startFresh(p) {
  const s = blankState(); Object.assign(s.profile, p, { consent: true });
  s.chat = [{ id: uid(), role: "bot", text: `Namaste ${p.name ? p.name.split(" ")[0] : ""}! Add any conditions and medicines in Care › Current state, and I'll adapt everything. Ask me about any food or how you feel.`, d: TODAY_KEY, t: "" }];
  S = s; UI.tab = "today"; UI.careSeg = "state"; writeNow();
}
