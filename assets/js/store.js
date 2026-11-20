/* ==========================================================================
   Ripple — store.js
   Local-first profiles, passkey hashing, sip log and all derived statistics.
   No email, no server: a name + passkey is all it takes.
   ========================================================================== */

const USERS_KEY = "ripple.users.v1";
const SESSION_KEY = "ripple.session.v1";
const DATA_PREFIX = "ripple.data.v1.";

export const DEFAULT_PROFILE = {
  glassMl: 250,
  targetGlasses: 8,
  unit: "ml",
  avatarEmoji: "🫧",
  avatarHue: 196,
  sound: true,
  theme: "light",
  remindersOn: false,
  reminderMins: 60,
  lastReminderAt: 0,
};

/* ------------------------------- tiny utils ------------------------------- */

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const round1 = (n) => Math.round(n * 10) / 10;
const pad = (n) => String(n).padStart(2, "0");

export function dayKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function shiftDay(key, delta) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatVolume(ml, unit = "ml") {
  if (unit === "oz") {
    const oz = ml / 29.5735;
    return `${oz >= 10 ? Math.round(oz) : round1(oz)} fl oz`;
  }
  if (ml >= 1000) return `${round1(ml / 1000)} L`;
  return `${Math.round(ml)} ml`;
}

export function formatFullVolume(ml, unit = "ml") {
  if (unit === "oz") return formatVolume(ml, "oz");
  return `${Math.round(ml).toLocaleString()} ml`;
}

export function formatGlasses(n) {
  const rounded = round1(n);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

const uid = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/* ------------------------------- storage --------------------------------- */

const memory = new Map();
const canUseLS = (() => {
  try {
    const probe = "__ripple_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
})();

function readRaw(key) {
  try {
    return canUseLS ? localStorage.getItem(key) : memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key, value) {
  try {
    if (canUseLS) localStorage.setItem(key, value);
    else memory.set(key, value);
  } catch {
    memory.set(key, value);
  }
}

function readJSON(key, fallback) {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  writeRaw(key, JSON.stringify(value));
}

/* ------------------------------- passkeys -------------------------------- */

const encode = (text) => new TextEncoder().encode(text);

function toB64(bytes) {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return btoa(out);
}

function fromB64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/** Fallback for non-secure contexts where SubtleCrypto is unavailable. */
function weakHash(text) {
  let h1 = 0x811c9dc5;
  let h2 = 0xc2b2ae35;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519) ^ (h2 >>> 13);
  }
  return `w1:${(h1 >>> 0).toString(16)}:${(h2 >>> 0).toString(16)}`;
}

async function deriveKey(passkey, saltB64) {
  if (globalThis.crypto?.subtle && globalThis.isSecureContext !== false) {
    try {
      const baseKey = await crypto.subtle.importKey("raw", encode(passkey), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: fromB64(saltB64), iterations: 120000, hash: "SHA-256" },
        baseKey,
        256
      );
      return toB64(new Uint8Array(bits));
    } catch {
      /* fall through to the lightweight hash */
    }
  }
  return weakHash(`${saltB64}::${passkey}`);
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  (globalThis.crypto?.getRandomValues
    ? crypto.getRandomValues(bytes)
    : bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256))));
  return toB64(bytes);
}

/* -------------------------------- users ---------------------------------- */

export function nameKey(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function getUsers() {
  const users = readJSON(USERS_KEY, {});
  return users && typeof users === "object" ? users : {};
}

function saveUsers(users) {
  writeJSON(USERS_KEY, users);
}

export function getUser(key) {
  return getUsers()[key] || null;
}

export function validateName(name) {
  const clean = String(name || "").trim();
  if (clean.length < 2) return "Names need at least 2 characters.";
  if (clean.length > 24) return "Keep it under 24 characters, please.";
  if (!/^[\p{L}\p{N} ._-]+$/u.test(clean)) return "Letters, numbers, spaces, dots and dashes only.";
  return "";
}

export function validatePasskey(passkey) {
  if (String(passkey || "").length < 4) return "Your passkey needs at least 4 characters.";
  if (String(passkey).length > 64) return "That passkey is a little too long.";
  return "";
}

export async function createUser({ name, passkey, profile = {} }) {
  const nameErr = validateName(name);
  if (nameErr) return { ok: false, error: nameErr };
  const passErr = validatePasskey(passkey);
  if (passErr) return { ok: false, error: passErr };

  const key = nameKey(name);
  const users = getUsers();
  if (users[key]) return { ok: false, error: "That name is already on this device. Try logging in." };

  const salt = randomSalt();
  const hash = await deriveKey(passkey, salt);
  const user = {
    key,
    name: String(name).trim(),
    salt,
    hash,
    createdAt: Date.now(),
    profile: { ...DEFAULT_PROFILE, ...profile },
  };
  users[key] = user;
  saveUsers(users);

  const existing = readJSON(DATA_PREFIX + key, null);
  if (!existing) {
    writeJSON(DATA_PREFIX + key, { v: 1, sips: [], savedPins: [], createdAt: Date.now() });
  }
  setSession(key);

  return { ok: true, user: sanitize(user) };
}

export async function login(name, passkey) {
  const key = nameKey(name);
  const users = getUsers();
  const user = users[key];
  if (!user) return { ok: false, error: "No profile with that name on this device yet." };

  const hash = await deriveKey(passkey, user.salt);
  if (hash !== user.hash) return { ok: false, error: "That passkey doesn't match. Try again?" };

  setSession(key);
  return { ok: true, user: sanitize(user) };
}

function sanitize(user) {
  const { salt, hash, ...rest } = user;
  return rest;
}

export function setSession(key) {
  writeRaw(SESSION_KEY, key);
}

export function getSession() {
  const key = readRaw(SESSION_KEY);
  return key && getUser(key) ? getUser(key) : null;
}

export function clearSession() {
  writeRaw(SESSION_KEY, "");
}

export function updateProfile(key, patch) {
  const users = getUsers();
  if (!users[key]) return null;
  users[key].profile = { ...DEFAULT_PROFILE, ...users[key].profile, ...patch };
  saveUsers(users);
  return sanitize(users[key]);
}

export function deleteUser(key) {
  const users = getUsers();
  delete users[key];
  saveUsers(users);
  try {
    if (canUseLS) localStorage.removeItem(DATA_PREFIX + key);
  } catch {
    /* ignore */
  }
  memory.delete(DATA_PREFIX + key);
  if (readRaw(SESSION_KEY) === key) clearSession();
}

/* --------------------------------- data ---------------------------------- */

export function getData(key) {
  const data = readJSON(DATA_PREFIX + key, null);
  if (!data || !Array.isArray(data.sips)) {
    return { v: 1, sips: [], savedPins: [], createdAt: Date.now() };
  }
  return { v: 1, savedPins: [], ...data };
}

export function saveData(key, data) {
  writeJSON(DATA_PREFIX + key, data);
  return data;
}

export function addSip(key, ml, at = Date.now(), source = "glass") {
  const data = getData(key);
  data.sips.push({ id: uid(), t: at, ml: Math.max(10, Math.round(ml)), source });
  // keep the log bounded — the app only ever reads the last year anyway
  if (data.sips.length > 5000) data.sips = data.sips.slice(-5000);
  return saveData(key, data);
}

export function removeSip(key, id) {
  const data = getData(key);
  data.sips = data.sips.filter((sip) => sip.id !== id);
  return saveData(key, data);
}

export function removeSipsOfDay(key, day) {
  const data = getData(key);
  data.sips = data.sips.filter((sip) => dayKey(sip.t) !== day);
  return saveData(key, data);
}

export function toggleSavedPin(key, pinId) {
  const data = getData(key);
  const saved = new Set(data.savedPins || []);
  saved.has(pinId) ? saved.delete(pinId) : saved.add(pinId);
  data.savedPins = [...saved];
  return saveData(key, data);
}

export function exportUser(key) {
  const user = getUser(key);
  if (!user) return null;
  return {
    exportedAt: new Date().toISOString(),
    app: "ripple-water-diary",
    profile: { name: user.name, createdAt: new Date(user.createdAt).toISOString(), ...user.profile },
    data: getData(key),
  };
}

/* ------------------------------ statistics ------------------------------- */

export const ACHIEVEMENTS = [
  { id: "first-sip", emoji: "💧", title: "First Sip", desc: "Log your very first glass", test: (s) => s.totalSips > 0 },
  { id: "target-hit", emoji: "🎯", title: "Target Hit", desc: "Meet your daily goal", test: (s) => s.daysMet > 0 },
  { id: "streak-3", emoji: "🔥", title: "On a Roll", desc: "3 days in a row", test: (s) => s.bestStreak >= 3 },
  { id: "streak-7", emoji: "🏆", title: "Perfect Week", desc: "7 days in a row", test: (s) => s.bestStreak >= 7 },
  { id: "streak-21", emoji: "🌿", title: "Habit Formed", desc: "21 days in a row", test: (s) => s.bestStreak >= 21 },
  { id: "big-day", emoji: "🐋", title: "Big Gulper", desc: "Double your target in a day", test: (s) => s.biggestDayMl >= s.targetMl * 2 },
  { id: "early-bird", emoji: "🌅", title: "Early Bird", desc: "A glass before 8 AM", test: (s) => s.hasEarlySip },
  { id: "night-owl", emoji: "🌙", title: "Night Owl", desc: "A glass after 10 PM", test: (s) => s.hasLateSip },
  { id: "century", emoji: "💯", title: "Century Club", desc: "100 glasses all-time", test: (s) => s.totalGlasses >= 100 },
];

export function computeStats(user, data, now = new Date()) {
  const profile = { ...DEFAULT_PROFILE, ...(user?.profile || {}) };
  const glassMl = Math.max(50, Number(profile.glassMl) || 250);
  const targetGlasses = clamp(Number(profile.targetGlasses) || 8, 1, 30);
  const targetMl = glassMl * targetGlasses;
  const sips = [...(data?.sips || [])].sort((a, b) => a.t - b.t);

  const days = new Map();
  for (const sip of sips) {
    const key = dayKey(sip.t);
    const entry = days.get(key) || { ml: 0, count: 0, sips: [] };
    entry.ml += sip.ml;
    entry.count += 1;
    entry.sips.push(sip);
    days.set(key, entry);
  }

  const todayK = dayKey(now);
  const today = days.get(todayK) || { ml: 0, count: 0, sips: [] };
  const todayMl = today.ml;
  const progress = clamp(todayMl / targetMl, 0, 1);
  const met = todayMl >= targetMl;

  // streaks ------------------------------------------------------------
  let streak = 0;
  let cursor = todayK;
  if (!met) cursor = shiftDay(cursor, -1);
  while ((days.get(cursor)?.ml || 0) >= targetMl) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }

  let bestStreak = 0;
  let running = 0;
  let prev = null;
  const metKeys = [...days.keys()]
    .filter((k) => (days.get(k)?.ml || 0) >= targetMl)
    .sort();
  for (const k of metKeys) {
    running = prev && shiftDay(prev, 1) === k ? running + 1 : 1;
    bestStreak = Math.max(bestStreak, running);
    prev = k;
  }
  bestStreak = Math.max(bestStreak, streak);

  const monthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const daysMet = metKeys.length;
  const daysMetThisMonth = metKeys.filter((k) => k.startsWith(monthPrefix)).length;

  // week ---------------------------------------------------------------
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const key = shiftDay(todayK, -i);
    const entry = days.get(key);
    const ml = entry?.ml || 0;
    const date = keyToDate(key);
    week.push({
      key,
      ml,
      glasses: ml / glassMl,
      ratio: clamp(ml / targetMl, 0, 1),
      met: ml >= targetMl,
      isToday: key === todayK,
      label: "SMTWTFS"[date.getDay()],
      dayNum: date.getDate(),
    });
  }

  const last7 = week.reduce((sum, day) => sum + day.ml, 0);
  const avg7 = last7 / 7;

  // heatmap — columns are weeks, rows are weekdays ---------------------
  const heat = [];
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const start = new Date(sunday);
  start.setDate(start.getDate() - 63);
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const key = dayKey(d);
    const ml = days.get(key)?.ml || 0;
    const ratio = ml / targetMl;
    heat.push({
      key,
      ml,
      ratio: clamp(ratio, 0, 1),
      met: ml >= targetMl,
      level: ml === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.6 ? 2 : ratio < 1 ? 3 : 4,
      label: d.toLocaleDateString([], { month: "short", day: "numeric" }),
    });
  }

  // garden — last 14 days ---------------------------------------------
  const garden = [];
  for (let i = 13; i >= 0; i--) {
    const key = shiftDay(todayK, -i);
    const ml = days.get(key)?.ml || 0;
    const ratio = ml / targetMl;
    garden.push({
      key,
      ml,
      state: ml === 0 ? "empty" : ratio >= 1 ? "bloom" : "sprout",
      isToday: key === todayK,
      seed: [...key].reduce((n, ch) => n + ch.charCodeAt(0), 0),
    });
  }

  const totalMl = sips.reduce((sum, sip) => sum + sip.ml, 0);
  const totalSips = sips.length;
  const totalGlasses = totalMl / glassMl;
  const biggestDayMl = [...days.values()].reduce((max, entry) => Math.max(max, entry.ml), 0);
  const hasEarlySip = sips.some((sip) => new Date(sip.t).getHours() < 8);
  const hasLateSip = sips.some((sip) => new Date(sip.t).getHours() >= 22);

  const base = {
    glassMl,
    targetGlasses,
    targetMl,
    todayMl,
    todayGlasses: todayMl / glassMl,
    todayCount: today.count,
    todaySips: today.sips,
    progress,
    met,
    remainingMl: Math.max(0, targetMl - todayMl),
    remainingGlasses: Math.max(0, (targetMl - todayMl) / glassMl),
    streak,
    bestStreak,
    daysMet,
    daysMetThisMonth,
    week,
    heat,
    garden,
    avg7,
    totalMl,
    totalSips,
    totalGlasses,
    biggestDayMl,
    hasEarlySip,
    hasLateSip,
    daysTracked: days.size,
  };

  base.achievements = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: Boolean(a.test(base)),
  }));

  return base;
}

/* ------------------------------ leaderboard ------------------------------ */

export function leaderboard(activeKey, now = new Date()) {
  const users = Object.values(getUsers());
  const rows = users.map((user) => {
    const stats = computeStats(user, getData(user.key), now);
    return {
      key: user.key,
      name: user.name,
      emoji: user.profile?.avatarEmoji || "🫧",
      hue: user.profile?.avatarHue ?? 196,
      ml: stats.todayMl,
      streak: stats.streak,
      met: stats.met,
      progress: stats.progress,
      isMe: user.key === activeKey,
    };
  });
  rows.sort((a, b) => b.ml - a.ml || b.streak - a.streak || a.name.localeCompare(b.name));
  return rows;
}

/* -------------------------------- demo ----------------------------------- */

const DEMO_NAME = "Ayaan";
const DEMO_PASS = "ripple123";

const daySeed = (offset) => Math.abs(Math.sin(offset * 12.9898) * 43758.5453) % 1;

/** Seeds a believable demo history so the board has something to show. */
export async function ensureDemoHistory(key, days = 74) {
  const user = getUser(key);
  if (!user) return null;
  const data = getData(key);
  if (data.sips.length > 0) return data;

  const now = new Date();
  const glassMl = user.profile.glassMl;
  const target = user.profile.targetGlasses;
  const sips = [];

  for (let i = days; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12, 0, 0, 0);
    const r = daySeed(i + 3);
    // the last six days are a streak, today is still in progress
    let glasses;
    if (i === 0) glasses = 3;
    else if (i <= 6) glasses = target;
    else if (r < 0.16) glasses = Math.max(2, Math.round(target * 0.45));
    else if (r < 0.36) glasses = Math.max(3, target - 1);
    else glasses = target + (r > 0.86 ? 1 : 0);

    const startHour = 7 + Math.floor(r * 2);
    for (let g = 0; g < glasses; g++) {
      const hour = Math.min(22, startHour + g * 1.7 + (r * 2 - 1));
      const at = new Date(date);
      at.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
      if (i === 0 && g > 2) continue;
      sips.push({
        id: `demo-${i}-${g}`,
        t: at.getTime(),
        ml: g === 0 && r > 0.7 ? glassMl + 100 : glassMl,
        source: "demo",
      });
    }
  }

  data.sips = sips;
  data.savedPins = ["mood-lemon"];
  saveData(key, data);
  return data;
}

export async function startDemo() {
  const candidates = [DEMO_NAME, `${DEMO_NAME} Demo`, `${DEMO_NAME} Demo 2`];
  for (const name of candidates) {
    const key = nameKey(name);
    const existing = getUser(key);
    if (existing) {
      const attempt = await login(name, DEMO_PASS);
      if (attempt.ok) {
        await ensureDemoHistory(key);
        return { ok: true, user: attempt.user, demo: true, passkey: DEMO_PASS };
      }
      continue;
    }
    const created = await createUser({
      name,
      passkey: DEMO_PASS,
      profile: { avatarEmoji: "🐳", avatarHue: 202, targetGlasses: 8, glassMl: 250 },
    });
    if (!created.ok) return created;
    await ensureDemoHistory(key);
    return { ok: true, user: created.user, demo: true, passkey: DEMO_PASS };
  }
  return { ok: false, error: "The demo profiles are taken. Create your own instead — it takes a second." };
}

export { DEMO_NAME, DEMO_PASS };
