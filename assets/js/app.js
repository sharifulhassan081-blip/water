/* ==========================================================================
   Ripple — app.js
   Bootstraps auth, paints the board, and wires the little interactions.
   ========================================================================== */

import {
  DEFAULT_PROFILE,
  dayKey,
  timeGreeting,
  computeStats,
  leaderboard,
  getData,
  getSession,
  getUser,
  updateProfile,
  addSip,
  removeSip,
  removeSipsOfDay,
  toggleSavedPin,
  deleteUser,
  exportUser,
  createUser,
  login,
  clearSession,
  startDemo,
  formatVolume,
  formatGlasses,
} from "./store.js";

import { renderHero, renderBoard, tipOfDay, esc, avatarHueStyle, TIPS } from "./ui.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  user: null,
  profile: { ...DEFAULT_PROFILE },
  data: null,
  stats: null,
  board: [],
  tip: tipOfDay(),
  filter: "all",
  query: "",
  authMode: "login",
  signupTarget: 8,
  renderedDay: null,
  seenAchievements: new Set(),
  audio: null,
  timer: null,
};

const AVATARS = ["🫧", "🐳", "🐙", "🦦", "🦩", "🐢", "🌿", "🍋", "🥤", "🌊", "🍉", "🧊"];

/* ==========================================================================
   Theme + sound
   ========================================================================== */

function setTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  const icon = $("#themeIcon");
  if (icon) icon.textContent = theme === "dark" ? "☀" : "☾";
  try {
    localStorage.setItem("ripple.theme", theme);
  } catch {
    /* ignore */
  }
  if (persist && state.user) {
    state.profile = { ...state.profile, theme };
    updateProfile(state.user.key, { theme });
  }
}

function initTheme() {
  let theme = null;
  try {
    theme = localStorage.getItem("ripple.theme");
  } catch {
    /* ignore */
  }
  if (!theme) {
    theme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  setTheme(theme, false);
}

function playDrop() {
  if (!state.profile?.sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    state.audio ||= new Ctx();
    const ctx = state.audio;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    /* audio is a nice-to-have */
  }
}

/* ==========================================================================
   Toasts + confetti
   ========================================================================== */

function toast(message, emoji = "💧", ms = 3000) {
  const root = $("#toastRoot");
  if (!root) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `${emoji ? `<em>${emoji}</em>` : ""}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add("is-out");
    setTimeout(() => el.remove(), 320);
  }, ms);
  while (root.children.length > 3) root.firstElementChild.remove();
}

function confetti() {
  const canvas = $("#confetti");
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const colors = ["#38bdf8", "#0f766e", "#ffd166", "#f9755a", "#a7f3d0", "#7dd3fc", "#fde68a"];
  const parts = Array.from({ length: 110 }, () => ({
    x: window.innerWidth * (0.35 + Math.random() * 0.3),
    y: window.innerHeight * (0.28 + Math.random() * 0.15),
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 2,
    size: 5 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    life: 1,
  }));
  const started = performance.now();
  const frame = (now) => {
    const elapsed = now - started;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of parts) {
      p.vy += 0.22;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.995;
      p.rot += p.vr;
      p.life = Math.max(0, 1 - elapsed / 2400);
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (elapsed < 2600) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  };
  requestAnimationFrame(frame);
}

/* ==========================================================================
   Auth screen
   ========================================================================== */

function setAuthMode(mode) {
  state.authMode = mode;
  const segmented = $(".segmented");
  segmented.dataset.mode = mode;
  $$(".seg-btn").forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  $("#signupFields").hidden = mode !== "signup";
  $("#authTitle").textContent = mode === "signup" ? "Make it official" : "Welcome back";
  $("#authSub").textContent =
    mode === "signup"
      ? "Pick a name, choose a passkey. No email, no fuss."
      : "Your passkey is the only key. Keep it close.";
  $("#authSubmit span").textContent = mode === "signup" ? "Create my profile" : "Log in";
  $("#passInput").setAttribute("autocomplete", mode === "signup" ? "new-password" : "current-password");
  hideAuthError();
}

function showAuthError(message) {
  const box = $("#authError");
  box.innerHTML = `<span>⚠️</span><span>${esc(message)}</span>`;
  box.hidden = false;
}

function hideAuthError() {
  $("#authError").hidden = true;
}

function setAuthBusy(busy, label) {
  const btn = $("#authSubmit");
  btn.disabled = busy;
  btn.style.opacity = busy ? "0.7" : "";
  btn.querySelector("span").textContent = busy ? label : state.authMode === "signup" ? "Create my profile" : "Log in";
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  hideAuthError();

  const name = $("#nameInput").value;
  const passkey = $("#passInput").value;
  const isSignup = state.authMode === "signup";

  if (isSignup) {
    const confirm = $("#passConfirmInput").value;
    if (passkey !== confirm) {
      showAuthError("Those passkeys don’t match. Try once more.");
      return;
    }
  }

  setAuthBusy(true, isSignup ? "Creating…" : "Checking…");
  try {
    const result = isSignup
      ? await createUser({
          name,
          passkey,
          profile: {
            targetGlasses: state.signupTarget,
            glassMl: Number($("#glassSelect").value) || 250,
          },
        })
      : await login(name, passkey);

    if (!result.ok) {
      showAuthError(result.error);
      return;
    }

    $("#authForm").reset();
    state.signupTarget = 8;
    $("#targetOut").textContent = "8 glasses";
    enterApp(result.user);
    toast(isSignup ? `Welcome to Ripple, ${result.user.name}.` : `Welcome back, ${result.user.name}.`, "🌊");
  } catch (err) {
    showAuthError("Something went wrong while signing you in. Try again.");
    console.error(err);
  } finally {
    setAuthBusy(false);
  }
}

async function handleDemo() {
  const btn = $("#demoBtn");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Filling a glass…";
  try {
    const result = await startDemo();
    if (!result.ok) {
      showAuthError(result.error || "Could not start the demo.");
      return;
    }
    enterApp(result.user);
    toast(`Demo profile loaded — passkey “${result.passkey}”`, "🐳", 5000);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

/* ==========================================================================
   Enter / leave the app
   ========================================================================== */

function enterApp(user) {
  state.profile = { ...DEFAULT_PROFILE, ...(getUser(user.key)?.profile || user.profile || {}) };
  state.user = { ...user, profile: state.profile };
  state.data = getData(user.key);
  state.stats = computeStats(user, state.data);
  state.seenAchievements = new Set(state.stats.achievements.filter((a) => a.unlocked).map((a) => a.id));
  state.tip = tipOfDay();

  $("#authView").hidden = true;
  $("#appView").hidden = false;
  document.title = `Ripple — ${user.name}’s water diary`;

  setTheme(state.profile.theme || "light", false);
  render();
  startTimer();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function logout() {
  clearSession();
  state.user = null;
  state.data = null;
  state.stats = null;
  state.seenAchievements = new Set();
  clearInterval(state.timer);
  $("#appView").hidden = true;
  $("#authView").hidden = false;
  document.title = "Ripple — your daily water diary";
  $("#passInput").value = "";
  $("#passConfirmInput").value = "";
  state.query = "";
  state.filter = "all";
  const search = $("#searchInput");
  if (search) search.value = "";
  $$(".chip[data-filter]").forEach((chip) => {
    const active = chip.dataset.filter === "all";
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-selected", String(active));
  });
  setAuthMode("login");
  closeModal();
  setTheme("light", false);
}

/* ==========================================================================
   Render
   ========================================================================== */

function greetingSub(stats, name) {
  if (stats.met) {
    return `Target met — ${formatGlasses(stats.todayGlasses)} glasses. Anything more is pure bonus.`;
  }
  const left = formatGlasses(stats.remainingGlasses);
  const streak = stats.streak > 0 ? ` ${stats.streak}-day streak on the line.` : "";
  if (stats.todayCount === 0) return `A fresh page. One glass starts the day — about ${formatVolume(stats.remainingMl, state.profile.unit)} to go.${streak}`;
  return `${left} ${Number(left) === 1 ? "glass" : "glasses"} to go — about ${formatVolume(stats.remainingMl, state.profile.unit)}.${streak}`;
}

function render() {
  if (!state.user) return;
  // merge the freshest profile into the user object so target / glass edits apply instantly
  const user = { ...state.user, profile: state.profile };
  const stats = computeStats(user, state.data);
  state.stats = stats;
  const board = leaderboard(user.key);

  const ctx = {
    user,
    profile: state.profile,
    stats,
    data: state.data,
    board,
    tip: state.tip,
    now: new Date(),
  };

  // greeting -----------------------------------------------------------
  $("#todayLabel").textContent = new Date().toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  $("#greetTitle").innerHTML = `${timeGreeting()}, <em>${esc(user.name)}</em>`;
  $("#greetSub").textContent = greetingSub(stats, user.name);

  // avatar -------------------------------------------------------------
  const topAvatar = $("#topAvatar");
  topAvatar.textContent = state.profile.avatarEmoji;
  topAvatar.style.cssText = avatarHueStyle(state.profile.avatarHue);

  // hero + board -------------------------------------------------------
  $("#hero").innerHTML = renderHero(ctx);
  const boardEl = $("#board");
  boardEl.innerHTML = renderBoard(ctx);
  boardEl.classList.toggle("is-instant", Boolean(state.renderedDay));

  // misc ---------------------------------------------------------------
  $("#soundIcon").textContent = state.profile.sound ? "🔊" : "🔇";
  $("#soundBtn").classList.toggle("is-off", !state.profile.sound);
  const savedCount = (state.data.savedPins || []).length;
  $("#footTotal").textContent = `${formatGlasses(stats.totalGlasses)} glasses logged · ${savedCount} saved pin${savedCount === 1 ? "" : "s"}`;

  state.renderedDay = dayKey();
  applyFilters();
  updateReminderUI();
}

function applyFilters() {
  const q = state.query.trim().toLowerCase();
  let visible = 0;
  $$(".pin").forEach((pin) => {
    const tags = (pin.dataset.tags || "").split(" ");
    let matchesFilter = true;
    if (state.filter === "saved") {
      matchesFilter = Boolean(pin.querySelector(".save-btn.is-saved"));
    } else if (state.filter !== "all") {
      matchesFilter = tags.includes(state.filter);
    }
    const text = pin.textContent.toLowerCase();
    const matchesQuery = !q || text.includes(q) || (pin.dataset.tags || "").includes(q);
    const show = matchesFilter && matchesQuery;
    pin.hidden = !show;
    if (show) visible += 1;
  });
  $("#boardEmpty").hidden = visible > 0;
}

/* ==========================================================================
   Sip actions
   ========================================================================== */

function addWater(ml) {
  if (!state.user || !ml) return;
  const before = state.stats;
  state.data = addSip(state.user.key, ml);
  render();
  playDrop();
  try {
    navigator.vibrate?.(18);
  } catch {
    /* ignore */
  }

  const after = state.stats;
  toast(`+${formatVolume(ml, state.profile.unit)} · ${formatGlasses(after.todayGlasses)} of ${after.targetGlasses}`, "💧", 2200);

  if (!before?.met && after.met) {
    confetti();
    setTimeout(() => toast(`Daily target complete. Streak: ${after.streak} days 🔥`, "🎉", 5000), 350);
  }

  const fresh = after.achievements.filter((a) => a.unlocked && !state.seenAchievements.has(a.id));
  fresh.forEach((a, i) => {
    state.seenAchievements.add(a.id);
    setTimeout(() => toast(`Badge unlocked — ${a.title}`, a.emoji, 4000), 900 + i * 700);
  });
}

function undoLast() {
  const last = state.stats?.todaySips.at(-1);
  if (!last) return;
  state.data = removeSip(state.user.key, last.id);
  render();
  toast("Last sip removed.", "↩️", 2200);
}

function deleteSip(id) {
  state.data = removeSip(state.user.key, id);
  render();
  toast("Sip removed.", "↩️", 2000);
}

/* ==========================================================================
   Modals
   ========================================================================== */

function closeModal() {
  const root = $("#modalRoot");
  root.innerHTML = "";
  document.body.style.overflow = "";
}

function openModal(html, onReady) {
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.style.overflow = "hidden";
  const backdrop = root.firstElementChild;
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop || event.target.closest("[data-close-modal]")) closeModal();
  });
  const dialog = backdrop.querySelector(".modal");
  const focusTarget = dialog.querySelector("input, select, button");
  focusTarget?.focus({ preventScroll: true });
  onReady?.(dialog);
  return dialog;
}

function openAmountModal() {
  if (!state.user) return;
  const glass = state.stats?.glassMl || 250;
  const amount = glass;
  const presets = [150, 250, 330, 500, 750];
  const dialog = openModal(
    `
    <div class="modal-head">
      <div>
        <h2>How much?</h2>
        <p>A splash, a glass, or the whole bottle — it all counts.</p>
      </div>
      <button class="modal-close" data-close-modal aria-label="Close">✕</button>
    </div>
    <label class="field">
      <span class="field-label">Amount in millilitres</span>
      <input id="amountInput" type="number" min="10" max="3000" step="10" value="${amount}" />
    </label>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 12px">
      ${presets
        .map(
          (p) =>
            `<button class="chip" type="button" data-preset="${p}" style="padding:6px 11px;font-size:11.5px">${formatVolume(p, state.profile.unit)}</button>`
        )
        .join("")}
    </div>
    <div class="countdown"><span>That’s about</span><b id="amountPreview">${formatGlasses(amount / glass)} glasses</b></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" type="button" data-close-modal>Cancel</button>
      <button class="btn btn-primary" type="button" id="amountAdd">Add water</button>
    </div>`,
    (d) => {
      const input = $("#amountInput", d);
      const preview = $("#amountPreview", d);
      const sync = () => {
        const value = Number(input.value) || 0;
        preview.textContent = `${formatGlasses(value / glass)} glasses`;
      };
      input.addEventListener("input", sync);
      d.addEventListener("click", (event) => {
        const preset = event.target.closest("[data-preset]");
        if (preset) {
          input.value = preset.dataset.preset;
          sync();
        }
      });
      const submit = () => {
        const value = Math.min(3000, Math.max(10, Number(input.value) || 0));
        closeModal();
        addWater(value);
      };
      $("#amountAdd", d).addEventListener("click", submit);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      });
    }
  );
  void dialog;
}

function confirmModal({ title, body, confirmLabel, danger = false, requireText = "", onConfirm }) {
  const dialog = openModal(
    `
    <div class="modal-head">
      <div><h2>${esc(title)}</h2><p>${esc(body)}</p></div>
      <button class="modal-close" data-close-modal aria-label="Close">✕</button>
    </div>
    ${
      requireText
        ? `<label class="field"><span class="field-label">Type “${esc(requireText)}” to confirm</span><input id="confirmText" type="text" autocomplete="off" /></label>`
        : ""
    }
    <div class="modal-actions">
      <button class="btn btn-ghost" type="button" data-close-modal>Keep it</button>
      <button class="btn ${danger ? "btn-danger" : "btn-primary"}" type="button" id="confirmGo">${esc(confirmLabel)}</button>
    </div>`,
    (d) => {
      const go = $("#confirmGo", d);
      const input = $("#confirmText", d);
      if (requireText && input) {
        go.disabled = true;
        go.style.opacity = "0.5";
        input.addEventListener("input", () => {
          const match = input.value.trim().toLowerCase() === requireText.toLowerCase();
          go.disabled = !match;
          go.style.opacity = match ? "" : "0.5";
        });
      }
      go.addEventListener("click", () => {
        closeModal();
        onConfirm?.();
      });
    }
  );
  void dialog;
}

function openSettings() {
  if (!state.user) return;
  const p = state.profile;
  const created = new Date(state.user.createdAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

  openModal(
    `
    <div class="modal-head">
      <div><h2>Make it yours</h2><p>Small settings for a habit that sticks.</p></div>
      <button class="modal-close" data-close-modal aria-label="Close">✕</button>
    </div>

    <div class="modal-section">
      <h3>Profile</h3>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <span class="avatar" id="settingsAvatar" style="${avatarHueStyle(p.avatarHue)};width:54px;height:54px;font-size:26px">${esc(p.avatarEmoji)}</span>
        <div>
          <div style="font-family:var(--font-display);font-size:20px">${esc(state.user.name)}</div>
          <div class="pin-note">Member since ${esc(created)}</div>
        </div>
      </div>
      <div class="emoji-grid" id="emojiGrid">
        ${AVATARS.map(
          (emoji) =>
            `<button class="emoji-opt ${emoji === p.avatarEmoji ? "is-active" : ""}" type="button" data-emoji="${emoji}">${emoji}</button>`
        ).join("")}
      </div>
      <label class="field" style="margin-top:12px;margin-bottom:0">
        <span class="field-label">Avatar colour</span>
        <input id="hueRange" type="range" min="0" max="360" value="${p.avatarHue}" style="width:100%;accent-color:#0f766e" />
      </label>
    </div>

    <div class="modal-section">
      <h3>Daily goal</h3>
      <div class="field-row">
        <div class="field">
          <span class="field-label">Glasses per day</span>
          <div class="stepper">
            <button type="button" data-goal-step="-1" aria-label="Fewer glasses">−</button>
            <output id="settingsTarget">${p.targetGlasses} glasses</output>
            <button type="button" data-goal-step="1" aria-label="More glasses">+</button>
          </div>
        </div>
        <label class="field">
          <span class="field-label">Glass size (ml)</span>
          <input id="settingsGlass" type="number" min="50" max="1500" step="10" value="${p.glassMl}" />
        </label>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${[150, 200, 250, 330, 500]
          .map(
            (ml) =>
              `<button class="chip" type="button" data-glass-preset="${ml}" style="padding:5px 10px;font-size:11px">${ml} ml</button>`
          )
          .join("")}
      </div>
      <p class="hint" id="targetHint">Daily target: ${p.targetGlasses * p.glassMl} ml</p>
    </div>

    <div class="modal-section">
      <h3>Display</h3>
      <div class="switch-row">
        <span class="switch-copy"><b>Units</b><span>Applies to every number on the board.</span></span>
        <span class="seg-mini" id="unitSeg">
          <button type="button" data-unit="ml" class="${p.unit !== "oz" ? "is-active" : ""}">ml</button>
          <button type="button" data-unit="oz" class="${p.unit === "oz" ? "is-active" : ""}">fl oz</button>
        </span>
      </div>
      <div class="switch-row">
        <span class="switch-copy"><b>Theme</b><span>Daylight or midnight sips.</span></span>
        <span class="seg-mini" id="themeSeg">
          <button type="button" data-theme-opt="light" class="${p.theme !== "dark" ? "is-active" : ""}">Light</button>
          <button type="button" data-theme-opt="dark" class="${p.theme === "dark" ? "is-active" : ""}">Dark</button>
        </span>
      </div>
      <div class="switch-row">
        <span class="switch-copy"><b>Pour sound</b><span>A tiny water drop when you log.</span></span>
        <button class="switch" id="soundSwitch" role="switch" aria-checked="${p.sound}" aria-label="Toggle pour sound"></button>
      </div>
    </div>

    <div class="modal-section">
      <h3>Your data</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" type="button" id="settingsExport">Export JSON</button>
        <button class="btn btn-ghost" type="button" id="settingsLogout">Log out</button>
        <button class="btn btn-ghost" type="button" id="settingsDelete" style="color:#b4362a">Delete profile</button>
      </div>
      <p class="hint">Profiles live only in this browser. Export a copy if you want a backup.</p>
    </div>

    <div class="modal-actions">
      <button class="btn btn-ghost" type="button" data-close-modal>Cancel</button>
      <button class="btn btn-primary" type="button" id="settingsSave">Save changes</button>
    </div>`,
    (d) => {
      let emoji = p.avatarEmoji;
      let hue = p.avatarHue;
      let unit = p.unit;
      let theme = p.theme;
      let sound = p.sound;
      let target = p.targetGlasses;

      const avatar = $("#settingsAvatar", d);
      const hueRange = $("#hueRange", d);
      const targetOut = $("#settingsTarget", d);
      const glassInput = $("#settingsGlass", d);

      const paintAvatar = () => {
        avatar.textContent = emoji;
        avatar.style.cssText = `${avatarHueStyle(hue)};width:54px;height:54px;font-size:26px`;
      };
      const paintTarget = () => {
        target = Math.min(30, Math.max(1, target));
        targetOut.textContent = `${target} glasses`;
        const glass = Math.max(50, Number(glassInput.value) || 250);
        $("#targetHint", d).textContent = `Daily target: ${(target * glass).toLocaleString()} ml`;
      };

      d.addEventListener("click", (event) => {
        const emojiBtn = event.target.closest("[data-emoji]");
        if (emojiBtn) {
          emoji = emojiBtn.dataset.emoji;
          $$("[data-emoji]", d).forEach((b) => b.classList.toggle("is-active", b === emojiBtn));
          paintAvatar();
        }
        const step = event.target.closest("[data-goal-step]");
        if (step) {
          target += Number(step.dataset.goalStep);
          paintTarget();
        }
        const glassPreset = event.target.closest("[data-glass-preset]");
        if (glassPreset) {
          glassInput.value = glassPreset.dataset.glassPreset;
          paintTarget();
        }
        const unitBtn = event.target.closest("[data-unit]");
        if (unitBtn) {
          unit = unitBtn.dataset.unit;
          $$("[data-unit]", d).forEach((b) => b.classList.toggle("is-active", b === unitBtn));
        }
        const themeBtn = event.target.closest("[data-theme-opt]");
        if (themeBtn) {
          theme = themeBtn.dataset.themeOpt;
          $$("[data-theme-opt]", d).forEach((b) => b.classList.toggle("is-active", b === themeBtn));
          setTheme(theme, false);
        }
      });

      hueRange.addEventListener("input", () => {
        hue = Number(hueRange.value);
        paintAvatar();
      });
      glassInput.addEventListener("input", paintTarget);
      $("#soundSwitch", d).addEventListener("click", (event) => {
        sound = !sound;
        event.currentTarget.setAttribute("aria-checked", String(sound));
      });

      $("#settingsExport", d).addEventListener("click", exportData);
      $("#settingsLogout", d).addEventListener("click", () => {
        closeModal();
        logout();
        toast("Logged out. Your data is waiting here.", "👋");
      });
      $("#settingsDelete", d).addEventListener("click", () => {
        closeModal();
        confirmModal({
          title: "Delete this profile?",
          body: "Every sip, badge and flower goes with it. This cannot be undone.",
          confirmLabel: "Delete forever",
          danger: true,
          requireText: state.user.name,
          onConfirm: () => {
            deleteUser(state.user.key);
            logout();
            toast("Profile deleted. Fresh water, fresh start.", "🫧", 4000);
          },
        });
      });

      $("#settingsSave", d).addEventListener("click", () => {
        const glassMl = Math.min(1500, Math.max(50, Number(glassInput.value) || 250));
        if (glassInput.value && glassMl !== Number(glassInput.value)) {
          toast("Glass size kept between 50 and 1500 ml.", "⚠️");
        }
        const patch = {
          avatarEmoji: emoji,
          avatarHue: hue,
          unit,
          theme,
          sound,
          targetGlasses: target,
          glassMl,
        };
        updateProfile(state.user.key, patch);
        state.profile = { ...state.profile, ...patch };
        setTheme(theme, false);
        closeModal();
        render();
        toast("Settings saved.", "✅", 2200);
      });

      paintTarget();
    }
  );
}

function exportData() {
  const payload = exportUser(state.user.key);
  if (!payload) return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ripple-${state.user.key.replace(/[^\w-]+/g, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Exported. A little backup never hurt.", "📦");
}

/* ==========================================================================
   Reminders
   ========================================================================== */

function startTimer() {
  clearInterval(state.timer);
  state.timer = setInterval(tick, 1000);
  tick();
}

async function requestNotifications() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

async function toggleReminders() {
  const next = !state.profile.remindersOn;
  const patch = { remindersOn: next, lastReminderAt: next ? Date.now() : 0 };
  updateProfile(state.user.key, patch);
  state.profile = { ...state.profile, ...patch };

  if (next) {
    const granted = await requestNotifications();
    toast(
      granted
        ? `Nudges on — every ${state.profile.reminderMins} minutes while this tab is open.`
        : `Nudges on in-app. Browser notifications are blocked, so keep the tab open.`,
      "⏰",
      4200
    );
  } else {
    toast("Nudges paused. Drink when you feel like it.", "🌙", 2600);
  }
  render();
}

function tick() {
  if (!state.user) return;
  if (dayKey() !== state.renderedDay) {
    render();
    toast("A new day. The board reset — your streak is safe.", "🌅", 4200);
  }
  updateReminderUI();

  const { remindersOn, reminderMins, lastReminderAt } = state.profile;
  if (!remindersOn || !lastReminderAt) return;
  if (state.stats?.met) return;

  const due = lastReminderAt + reminderMins * 60 * 1000;
  if (Date.now() >= due) {
    const patch = { lastReminderAt: Date.now() };
    updateProfile(state.user.key, patch);
    state.profile = { ...state.profile, ...patch };
    const msg = `Time for a glass — ${formatGlasses(state.stats.remainingGlasses)} to go today.`;
    toast(msg, "💧", 4200);
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Ripple · water o’clock", { body: msg, tag: "ripple-sip" });
      }
    } catch {
      /* notifications can fail silently */
    }
    updateReminderUI();
  }
}

function updateReminderUI() {
  const node = $("[data-reminder-countdown]");
  if (!node) return;
  const status = $("[data-reminder-status]");
  const { remindersOn, reminderMins, lastReminderAt } = state.profile;
  if (!remindersOn) {
    node.textContent = "off";
    if (status) status.textContent = "Nudges are paused";
    return;
  }
  if (state.stats?.met) {
    node.textContent = "done";
    if (status) status.textContent = "Goal met — no need to nag";
    return;
  }
  const due = (lastReminderAt || Date.now()) + reminderMins * 60 * 1000;
  const left = Math.max(0, due - Date.now());
  const totalSeconds = Math.ceil(left / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  node.textContent = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}:${String(seconds).padStart(2, "0")}`;
  if (status) status.textContent = "Next nudge in";
}

/* ==========================================================================
   Global events
   ========================================================================== */

function bindEvents() {
  // auth ---------------------------------------------------------------
  $$(".seg-btn").forEach((btn) => btn.addEventListener("click", () => setAuthMode(btn.dataset.mode)));
  $("#authForm").addEventListener("submit", handleAuthSubmit);
  $("#demoBtn").addEventListener("click", handleDemo);
  $("#eyeBtn").addEventListener("click", (event) => {
    const input = $("#passInput");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    event.currentTarget.setAttribute("aria-pressed", String(show));
    event.currentTarget.setAttribute("aria-label", show ? "Hide passkey" : "Show passkey");
  });
  $$("[data-step]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.signupTarget = Math.min(20, Math.max(1, state.signupTarget + Number(btn.dataset.step)));
      $("#targetOut").textContent = `${state.signupTarget} glass${state.signupTarget === 1 ? "" : "es"}`;
    })
  );
  $("#nameInput").addEventListener("input", hideAuthError);
  $("#passInput").addEventListener("input", hideAuthError);

  // topbar -------------------------------------------------------------
  $("#themeBtn").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next, true);
    const sec = $(".seg-mini [data-theme-opt]");
    if (sec) {
      $$("[data-theme-opt]").forEach((b) => b.classList.toggle("is-active", b.dataset.themeOpt === next));
    }
  });
  $("#soundBtn").addEventListener("click", () => {
    const next = !state.profile.sound;
    state.profile = { ...state.profile, sound: next };
    if (state.user) updateProfile(state.user.key, { sound: next });
    $("#soundIcon").textContent = next ? "🔊" : "🔇";
    $("#soundBtn").classList.toggle("is-off", !next);
    if (next) playDrop();
    else toast("Sound off. Silent sips.", "🔇", 1800);
  });
  $("#profileBtn").addEventListener("click", openSettings);
  $("#settingsBtn").addEventListener("click", openSettings);
  $("#logoutBtn").addEventListener("click", () => {
    confirmModal({
      title: "Log out?",
      body: "Your profile and history stay saved in this browser.",
      confirmLabel: "Log out",
      onConfirm: () => {
        logout();
        toast("Logged out. See you at the next glass.", "👋");
      },
    });
  });
  $("#exportBtn").addEventListener("click", exportData);

  // search + chips -----------------------------------------------------
  $("#searchInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    applyFilters();
  });
  $("#chips").addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    state.filter = chip.dataset.filter;
    $$(".chip").forEach((c) => {
      const active = c === chip;
      c.classList.toggle("is-active", active);
      c.setAttribute("aria-selected", String(active));
    });
    applyFilters();
  });

  // action delegation --------------------------------------------------
  document.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl || !state.user) return;
    const action = actionEl.dataset.action;

    switch (action) {
      case "add":
        addWater(Number(actionEl.dataset.ml));
        break;
      case "custom-amount":
        openAmountModal();
        break;
      case "undo":
        undoLast();
        break;
      case "reset-day":
        confirmModal({
          title: "Clear today?",
          body: "Today’s sips will be removed from your log. Your streak may change.",
          confirmLabel: "Clear today",
          danger: true,
          onConfirm: () => {
            state.data = removeSipsOfDay(state.user.key, dayKey());
            render();
            toast("Today’s log cleared.", "🧽", 2400);
          },
        });
        break;
      case "delete-sip":
        deleteSip(actionEl.dataset.sip);
        break;
      case "save-pin": {
        const id = actionEl.dataset.pinId;
        state.data = toggleSavedPin(state.user.key, id);
        render();
        const isSaved = (state.data.savedPins || []).includes(id);
        toast(isSaved ? "Saved to your board." : "Removed from saved pins.", isSaved ? "📌" : "🤍", 1800);
        break;
      }
      case "shuffle-tip": {
        const pool = tipPool().filter((t) => t !== state.tip);
        state.tip = pool[Math.floor(Math.random() * pool.length)];
        render();
        break;
      }
      case "toggle-reminders":
        toggleReminders();
        break;
      case "open-settings":
        openSettings();
        break;
      default:
        break;
    }
  });

  // reminder frequency select -----------------------------------------
  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-action='reminder-mins']")) {
      const mins = Number(event.target.value);
      updateProfile(state.user.key, { reminderMins: mins, lastReminderAt: Date.now() });
      state.profile = { ...state.profile, reminderMins: mins, lastReminderAt: Date.now() };
      toast(`Nudges every ${mins} minutes.`, "⏰", 2200);
      updateReminderUI();
    }
  });

  // keyboard -----------------------------------------------------------
  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
    if (event.key === "Escape") {
      closeModal();
      return;
    }
    if (!typing && event.key === "/") {
      event.preventDefault();
      $("#searchInput")?.focus();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#searchInput")?.focus();
    }
  });

  // date rollover when returning to the tab ----------------------------
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.user && dayKey() !== state.renderedDay) render();
  });

  window.addEventListener("resize", () => {
    const canvas = $("#confetti");
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });
}

function tipPool() {
  return TIPS;
}

/* ==========================================================================
   Boot
   ========================================================================== */

function boot() {
  initTheme();
  bindEvents();
  setAuthMode("login");

  const session = getSession();
  if (session) {
    enterApp(session);
    return;
  }

  // friendly nudge for first-time visitors
  setTimeout(() => {
    if (!state.user) toast("New here? Try the demo profile below — it’s pre-filled with a month of water.", "🐳", 6000);
  }, 1400);
}

boot();
