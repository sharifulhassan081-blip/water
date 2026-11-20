/* ==========================================================================
   Ripple — ui.js
   Pure(ish) render helpers. Everything returns HTML strings so the whole
   board can be re-painted after each sip without a framework.
   ========================================================================== */

import {
  formatVolume,
  formatFullVolume,
  formatGlasses,
  formatTime,
  round1,
  clamp,
} from "./store.js";

export const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const TIPS = [
  { text: "A glass right after waking up is the easiest win of the day. Your body has been dry for hours.", tag: "morning ritual" },
  { text: "Thirst shows up late. If you wait until you feel it, you're already a little behind.", tag: "listen closer" },
  { text: "Cold water isn't more hydrating than room-temperature water — but it is easier to drink. Choose the one you'll actually finish.", tag: "no rules" },
  { text: "Eating fruit and soup counts toward your fluids. Your goal isn't only about glasses.", tag: "food counts" },
  { text: "Pair every coffee or tea with a glass of water. For every diuretic, a little balance.", tag: "pairing trick" },
  { text: "Keep your glass in sight. People drink up to 30% more when water is visible on the desk.", tag: "out of sight" },
  { text: "A big bottle beats many small sips. Fill it once in the morning and watch the level drop.", tag: "one bottle" },
  { text: "Headache at 4 PM? Before the painkiller, try 300 ml of water and ten slow breaths.", tag: "tiny remedy" },
  { text: "Your brain is roughly 75% water. Mild dehydration can feel like brain fog, not thirst.", tag: "brain food" },
  { text: "Drink a glass before each meal — it slows you down and makes the meal feel more intentional.", tag: "before meals" },
  { text: "Sweat, long walks and spicy food all raise your needs. Add a glass, don't stress the math.", tag: "adjust gently" },
  { text: "Urine the colour of pale straw is a decent, free hydration check. Darker? Have a glass.", tag: "check-in" },
  { text: "Sipping slowly beats chugging. Your body absorbs small amounts more comfortably.", tag: "slow is fine" },
  { text: "A water reminder should feel like a nudge from a friend, not a manager. Two or three a day is plenty.", tag: "gentle nudges" },
];

export const QUOTES = [
  { text: "Almost everything will work again if you unplug it for a few minutes — including you.", by: "Anne Lamott" },
  { text: "Water is the driving force of all nature.", by: "Leonardo da Vinci" },
  { text: "Small daily improvements are the key to staggering long-term results.", by: "Robin Sharma" },
  { text: "You don't have to see the whole staircase. Just take the first step.", by: "Martin Luther King Jr." },
  { text: "What you do every day matters more than what you do once in a while.", by: "Gretchen Rubin" },
  { text: "The cure for anything is salt water: sweat, tears or the sea.", by: "Karen Blixen" },
  { text: "Take care of your body. It's the only place you have to live.", by: "Jim Rohn" },
  { text: "Drink up, buttercup. Tomorrow's streak starts today.", by: "Ripple" },
];

export function quoteOfDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date - start) / 86400000);
  return QUOTES[day % QUOTES.length];
}

export function tipOfDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date - start) / 86400000);
  return TIPS[day % TIPS.length];
}

export const avatarHueStyle = (hue = 196) =>
  `--av-a:hsl(${hue} 85% 88%);--av-b:hsl(${hue} 58% 45%)`;

export function avatarHTML(emoji, hue, cls = "avatar") {
  return `<span class="${cls}" style="${avatarHueStyle(hue)}">${esc(emoji)}</span>`;
}

/* ------------------------------- glass art -------------------------------- */

export function glassSVG(progress = 0, { width = 108 } = {}) {
  const p = clamp(progress, 0, 1);
  const offset = (1 - p) * 132;
  return `
  <svg class="glass-svg" style="width:${width}px" viewBox="0 0 100 132" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7dd3fc" stop-opacity="0.95" />
        <stop offset="0.55" stop-color="#38bdf8" stop-opacity="0.95" />
        <stop offset="1" stop-color="#0369a1" />
      </linearGradient>
      <clipPath id="glassClip">
        <path d="M18 6h64l-7.5 104a13 13 0 0 1-13 12H38.5a13 13 0 0 1-13-12Z" />
      </clipPath>
    </defs>
    <path d="M18 6h64l-7.5 104a13 13 0 0 1-13 12H38.5a13 13 0 0 1-13-12Z" fill="#dff3fb" fill-opacity="0.5" />
    <g clip-path="url(#glassClip)">
      <g class="glass-water" style="transform: translateY(${offset.toFixed(1)}px)">
        <rect x="0" y="0" width="100" height="132" fill="url(#waterGrad)" />
        <path d="M0 12q12-7 25 0t25 0 25 0 25 0v10H0Z" fill="#bae6fd" fill-opacity="0.9" />
        <circle cx="38" cy="60" r="2.4" fill="#e0f2fe" fill-opacity="0.7" />
        <circle cx="58" cy="86" r="1.8" fill="#e0f2fe" fill-opacity="0.6" />
        <circle cx="46" cy="104" r="1.4" fill="#e0f2fe" fill-opacity="0.5" />
      </g>
    </g>
    <path d="M18 6h64l-7.5 104a13 13 0 0 1-13 12H38.5a13 13 0 0 1-13-12Z" stroke="#c9e8f4" stroke-width="2.4" />
    <path d="M28 20c0 24 1 48 3 68" stroke="#ffffff" stroke-opacity="0.75" stroke-width="2.6" stroke-linecap="round" />
    <ellipse cx="50" cy="6" rx="32" ry="4.2" stroke="#d8eef8" stroke-width="2" fill="#ffffff" fill-opacity="0.35" />
  </svg>`;
}

/* --------------------------------- hero ---------------------------------- */

const heroMessage = (stats) => {
  if (stats.met) return "Target met";
  if (stats.progress >= 0.66) return "Almost there";
  if (stats.progress >= 0.33) return "Halfway energy";
  if (stats.progress > 0) return "Keep sipping";
  return "Fresh start";
};

function heroStatusPill(stats) {
  const msg = heroMessage(stats);
  if (stats.met) return `<span class="pill">🎉 ${msg}</span>`;
  if (stats.streak >= 3) return `<span class="pill pill-warm">🔥 ${stats.streak}-day streak · ${msg}</span>`;
  return `<span class="pill">🌊 ${msg}</span>`;
}

export function renderHero(ctx) {
  const { stats, profile } = ctx;
  const glassMl = stats.glassMl;
  const small = Math.round((glassMl * 0.6) / 10) * 10;
  const bottle = glassMl * 2;
  const pct = Math.round(stats.progress * 100);
  const remaining = stats.remainingGlasses;

  const sub = stats.met
    ? `You’ve had <strong>${formatVolume(stats.todayMl, profile.unit)}</strong> today. Anything more is a bonus — your garden already bloomed.`
    : `You need <strong>${formatGlasses(remaining)} more ${Number(remaining.toFixed(1)) === 1 ? "glass" : "glasses"}</strong> — about ${formatVolume(stats.remainingMl, profile.unit)} — to close the ring.`;

  const lastSip = stats.todaySips.length
    ? `Last sip at ${formatTime(stats.todaySips[stats.todaySips.length - 1].t)}`
    : "No sips logged yet today";

  const circumference = 2 * Math.PI * 46;
  const dash = circumference * stats.progress;

  return `
  <div class="hero-card ${stats.met ? "is-complete" : ""}">
    <span class="celebration"></span>
    <div class="hero-left">
      <div class="hero-status">${heroStatusPill(stats)}</div>
      <h2 class="hero-count">
        <b>${formatGlasses(stats.todayGlasses)}</b>
        <span>of ${stats.targetGlasses} glasses</span>
      </h2>
      <p class="hero-sub">${sub}</p>

      <div class="quick-add">
        <button class="qbtn" data-action="add" data-ml="${small}" title="Add a small glass">
          <span class="q-icon">🥃</span>
          <span class="q-amount">${formatVolume(small, profile.unit)}</span>
          <span class="q-label">small</span>
        </button>
        <button class="qbtn qbtn-primary" data-action="add" data-ml="${glassMl}" title="Add a glass">
          <span class="q-icon">🥛</span>
          <span class="q-amount">${formatVolume(glassMl, profile.unit)}</span>
          <span class="q-label">a glass</span>
        </button>
        <button class="qbtn" data-action="add" data-ml="${bottle}" title="Add a bottle">
          <span class="q-icon">🍶</span>
          <span class="q-amount">${formatVolume(bottle, profile.unit)}</span>
          <span class="q-label">bottle</span>
        </button>
        <button class="qbtn qbtn-custom" data-action="custom-amount" title="Add a custom amount">
          <span class="q-amount">＋ custom</span>
        </button>
      </div>

      <div class="hero-meta">
        <span>${lastSip}</span>
        <span class="meta-actions">
          <button data-action="undo" ${stats.todaySips.length ? "" : "disabled"}>Undo last</button>
          <button data-action="reset-day" ${stats.todaySips.length ? "" : "disabled"}>Reset day</button>
        </span>
      </div>

      <div class="hero-stats">
        <div class="hero-stat">
          <b>${formatVolume(stats.todayMl, profile.unit)}</b>
          <span>drunk today</span>
        </div>
        <div class="hero-stat">
          <b>🔥 ${stats.streak}</b>
          <span>day streak</span>
        </div>
        <div class="hero-stat">
          <b>${stats.targetMl ? formatVolume(stats.targetMl, profile.unit) : "—"}</b>
          <span>daily target</span>
        </div>
      </div>
    </div>

    <div class="hero-visual">
      <span class="drop d1"></span>
      <span class="drop d2"></span>
      <span class="drop d3"></span>
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#38bdf8" />
              <stop offset="1" stop-color="#0f766e" />
            </linearGradient>
          </defs>
          <circle class="ring-track" cx="50" cy="50" r="46" />
          <circle class="ring-bar" cx="50" cy="50" r="46"
            stroke-dasharray="${circumference.toFixed(2)}"
            stroke-dashoffset="${(circumference - dash).toFixed(2)}" />
        </svg>
        <div class="ring-inner">
          ${glassSVG(stats.progress)}
        </div>
        <span class="ring-percent">${pct}% <small>of goal</small></span>
      </div>
      <p class="hero-visual-caption">
        <b>${formatFullVolume(stats.todayMl, profile.unit)}</b> of ${formatFullVolume(stats.targetMl, profile.unit)}
      </p>
    </div>
  </div>`;
}

/* -------------------------------- board ---------------------------------- */

function pin({ id = "", tags = "", cls = "", style = "", body = "" }) {
  return `<article class="pin ${cls}" ${id ? `data-pin="${id}"` : ""} data-tags="${tags}" ${style ? `style="${style}"` : ""}>${body}</article>`;
}

function photoPin({ id, img, alt, tag, title, text, shape = "landscape", saved = false }) {
  return pin({
    id,
    tags: "photos",
    cls: `pin-photo ${shape}`,
    body: `
      <div class="photo">
        <img src="${img}" alt="${esc(alt)}" loading="lazy" />
        <span class="photo-tag">${esc(tag)}</span>
        <div class="photo-overlay">
          <button class="save-btn ${saved ? "is-saved" : ""}" data-action="save-pin" data-pin-id="${id}">
            ${saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
      <div class="photo-caption">
        <h3>${esc(title)}</h3>
        <p>${esc(text)}</p>
      </div>`,
  });
}

function logPin(ctx) {
  const { stats, profile } = ctx;
  const sips = [...stats.todaySips].reverse();
  const rows = sips.length
    ? sips
        .map(
          (sip) => `
        <li class="sip">
          <span class="sip-dot">${sip.ml >= stats.glassMl * 2 ? "🍶" : sip.ml <= stats.glassMl * 0.6 ? "🥃" : "🥛"}</span>
          <span class="sip-main">
            <b>${formatVolume(sip.ml, profile.unit)}</b>
            <span>${formatTime(sip.t)} · ${sip.ml >= stats.glassMl * 2 ? "bottle" : sip.ml <= stats.glassMl * 0.6 ? "small glass" : "glass"}</span>
          </span>
          <button class="sip-del" data-action="delete-sip" data-sip="${sip.id}" aria-label="Remove this sip" title="Remove">✕</button>
        </li>`
        )
        .join("")
    : `<li class="log-empty"><span>🫗</span>Nothing logged yet today.<br />Tap a glass above and it lands here.</li>`;

  const pct = Math.round(stats.progress * 100);
  return pin({
    tags: "today",
    cls: "",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>Today’s sips</h3><span class="pin-badge">${stats.todayCount} logged</span></div>
        <ul class="sip-list">${rows}</ul>
        <div class="log-foot">
          <span>${formatFullVolume(stats.todayMl, profile.unit)} · <b>${pct}%</b> of goal</span>
          <button class="linklike" data-action="custom-amount">Add again</button>
        </div>
      </div>`,
  });
}

function weekPin(ctx) {
  const { stats, profile } = ctx;
  const bars = stats.week
    .map(
      (day) => `
      <div class="bar-col ${day.met ? "is-met" : ""} ${day.isToday ? "is-today" : ""}" title="${day.key} · ${formatVolume(day.ml, profile.unit)}">
        <div class="bar-track"><div class="bar-fill" style="height:${day.ml ? Math.max(4, day.ratio * 100) : 0}%"></div></div>
        <span class="bar-value">${day.ml ? formatGlasses(day.glasses) : "·"}</span>
        <span class="bar-label">${day.label}</span>
      </div>`
    )
    .join("");

  const metDays = stats.week.filter((d) => d.met).length;
  return pin({
    tags: "trends today",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>This week</h3><span class="pin-badge">${metDays}/7 goals</span></div>
        <div class="bars">${bars}</div>
        <div class="legend">
          <span><i style="background:linear-gradient(180deg,#5eead4,#0f766e)"></i>goal met</span>
          <span><i style="background:linear-gradient(180deg,#7dd3fc,#0284c7)"></i>glasses</span>
        </div>
        <p class="pin-note" style="margin-top:10px">Averaging <b>${formatGlasses(stats.avg7 / stats.glassMl)} glasses</b> a day · ${formatVolume(stats.avg7, profile.unit)}</p>
      </div>`,
  });
}

function streakPin(ctx) {
  const { stats } = ctx;
  const atRisk = !stats.met && stats.streak > 0;
  const note = stats.met
    ? "Today is locked in. The flame stays fed."
    : atRisk
      ? `One glass at a time. Meet the goal today to keep this flame alive.`
      : "Start with one glass today and a new flame appears.";
  return pin({
    tags: "streak today",
    cls: "pin-tinted",
    style: "--pin-bg:var(--butter)",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>The streak</h3><span class="pin-badge">best ${stats.bestStreak}</span></div>
        <div class="streak-hero">
          <div class="flame">🔥</div>
          <div class="streak-num">${stats.streak}<small>day streak</small></div>
        </div>
        <p class="pin-note" style="margin-bottom:12px">${note}</p>
        <div class="mini-stats">
          <div class="mini-stat"><b>${stats.daysMetThisMonth}</b><span>goals this month</span></div>
          <div class="mini-stat"><b>${stats.daysMet}</b><span>goals all-time</span></div>
        </div>
      </div>`,
  });
}

function achievementsPin(ctx) {
  const unlocked = ctx.stats.achievements.filter((a) => a.unlocked);
  const badges = ctx.stats.achievements
    .map(
      (a) => `
      <div class="badge ${a.unlocked ? "is-unlocked" : "is-locked"}" title="${esc(a.unlocked ? a.desc : `Locked — ${a.desc}`)}">
        <em>${a.unlocked ? a.emoji : "🔒"}</em>
        <b>${esc(a.title)}</b>
        <span>${esc(a.desc)}</span>
      </div>`
    )
    .join("");
  const pct = Math.round((unlocked.length / ctx.stats.achievements.length) * 100);
  return pin({
    tags: "fun streak",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>Badges</h3><span class="pin-badge">${unlocked.length}/${ctx.stats.achievements.length}</span></div>
        <div class="badges">${badges}</div>
        <div class="progress-line"><i style="width:${pct}%"></i></div>
        <p class="pin-note" style="margin-top:8px">${pct === 100 ? "All badges collected. Show-off." : "Every badge is earned by actually drinking the water."}</p>
      </div>`,
  });
}

function flowerSVG(state, seed) {
  const hue = [338, 14, 44, 190, 268, 152, 216][seed % 7];
  const petal = `hsl(${hue} 78% 72%)`;
  const petalDeep = `hsl(${hue} 66% 60%)`;
  const leaf = "#4caf83";
  if (state === "empty") {
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="5" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.6" stroke-dasharray="2 3"/></svg>`;
  }
  const stem = `<path d="M20 36V19" stroke="${leaf}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (state === "sprout") {
    return `<svg viewBox="0 0 40 40" aria-hidden="true">
      ${stem}
      <path d="M20 27c-6 0-9-3-9-6 4-1 9 1 9 6Z" fill="${leaf}" opacity=".9"/>
      <path d="M20 23c4-1 7-4 7-7-4 0-7 2-7 7Z" fill="${leaf}" opacity=".75"/>
    </svg>`;
  }
  const petals = [0, 72, 144, 216, 288]
    .map(
      (deg) => `<ellipse cx="20" cy="11.5" rx="4.6" ry="7" fill="${petal}" transform="rotate(${deg} 20 19)"/>`
    )
    .join("");
  return `<svg viewBox="0 0 40 40" aria-hidden="true">
    ${stem}
    <path d="M20 30c-5 0-8-3-8-5 4-1 8 1 8 5Z" fill="${leaf}" opacity=".85"/>
    <g>${petals}</g>
    <circle cx="20" cy="19" r="4.4" fill="#fde68a" stroke="${petalDeep}" stroke-width="1.2"/>
  </svg>`;
}

function gardenPin(ctx) {
  const blooms = ctx.stats.garden.filter((d) => d.state === "bloom").length;
  const cells = ctx.stats.garden
    .map(
      (day) => `
      <div class="garden-cell is-${day.state} ${day.isToday ? "is-today" : ""}"
           title="${day.key} · ${formatVolume(day.ml, ctx.profile.unit)}${day.state === "bloom" ? " · goal met 🌷" : ""}">
        ${flowerSVG(day.state, day.seed)}
      </div>`
    )
    .join("");
  return pin({
    tags: "fun",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>The little garden</h3><span class="pin-badge">${blooms}/14 bloomed</span></div>
        <div class="garden">${cells}</div>
        <p class="garden-note">Meet your daily target and a flower blooms. Partial days grow a sprout — nothing dies here.</p>
      </div>`,
  });
}

function heatmapPin(ctx) {
  const cells = ctx.stats.heat
    .map(
      (day) =>
        `<div class="heat-cell" data-f="${day.level}" title="${day.label} · ${formatVolume(day.ml, ctx.profile.unit)}${day.met ? " · goal met" : ""}"></div>`
    )
    .join("");
  return pin({
    tags: "trends",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>Ten weeks</h3><span class="pin-badge">${ctx.stats.daysMet} goal days</span></div>
        <div class="heat-wrap">
          <div class="heat-days"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
          <div class="heatmap">${cells}</div>
        </div>
        <div class="heat-legend">
          <span>less</span>
          <i data-f="0" style="background:#e7eef0"></i>
          <i style="background:#d8f2fb"></i>
          <i style="background:#a5e3f9"></i>
          <i style="background:#56c5ef"></i>
          <i style="background:#0f8fc4"></i>
          <span>more</span>
        </div>
      </div>`,
  });
}

function leaderboardPin(ctx) {
  const rows = ctx.board.slice(0, 6);
  const medals = ["🥇", "🥈", "🥉"];
  const list = rows
    .map(
      (row, i) => `
      <div class="rank-row ${row.isMe ? "is-me" : ""}">
        <span class="rank-medal">${medals[i] || i + 1}</span>
        ${avatarHTML(row.emoji, row.hue, "rank-av")}
        <span class="rank-name">${esc(row.name)}${row.isMe ? " <small>that’s you</small>" : row.met ? " <small>goal met ✓</small>" : row.streak ? `<small>${row.streak}-day streak</small>` : "<small>warming up</small>"}</span>
        <span class="rank-score">${formatVolume(row.ml, ctx.profile.unit)}<span> today</span></span>
      </div>`
    )
    .join("");
  const solo = rows.length <= 1;
  return pin({
    tags: "fun today",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>Household board</h3><span class="pin-badge">${rows.length} profile${rows.length === 1 ? "" : "s"}</span></div>
        <div class="rank-list">${list}</div>
        <p class="pin-note" style="margin-top:10px">${solo ? "Friends who use this browser appear here. Small race, big hydration." : "Everyone with a profile in this browser, ranked by today’s water."}</p>
      </div>`,
  });
}

function reminderPin(ctx) {
  const { profile } = ctx;
  const on = Boolean(profile.remindersOn);
  const options = [30, 45, 60, 90, 120]
    .map((mins) => `<option value="${mins}" ${Number(profile.reminderMins) === mins ? "selected" : ""}>every ${mins} min</option>`)
    .join("");
  return pin({
    tags: "today",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>Gentle nudges</h3><span class="pin-badge">${on ? "on" : "off"}</span></div>
        <div class="switch-row">
          <span class="switch-copy">
            <b>Remind me to sip</b>
            <span>Only while this tab is open.</span>
          </span>
          <button class="switch" role="switch" aria-checked="${on}" data-action="toggle-reminders" aria-label="Toggle reminders"></button>
        </div>
        <div class="reminder-row">
          <label class="pin-note" for="reminderMins">Nudge frequency</label>
          <select id="reminderMins" data-action="reminder-mins" ${on ? "" : "disabled"}>${options}</select>
        </div>
        <div class="countdown">
          <span data-reminder-status>${on ? "Next nudge in" : "Nudges are paused"}</span>
          <b data-reminder-countdown>${on ? "--:--" : "off"}</b>
        </div>
      </div>`,
  });
}

function tipPin(ctx) {
  const tip = ctx.tip;
  return pin({
    tags: "fun",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>Hydration note</h3><span class="pin-badge">${esc(tip.tag)}</span></div>
        <p class="tip-quote">“${esc(tip.text)}”</p>
        <div class="tip-meta">
          <span>a small nudge, not a lecture</span>
          <button class="tip-shuffle" data-action="shuffle-tip">Shuffle ↻</button>
        </div>
      </div>`,
  });
}

function quotePin() {
  const q = quoteOfDay();
  return pin({
    tags: "fun",
    cls: "quote-pin",
    body: `
      <div class="pin-body">
        <span class="quote-mark">“</span>
        <blockquote>${esc(q.text)}</blockquote>
        <cite>${esc(q.by)}</cite>
      </div>`,
  });
}

function profilePin(ctx) {
  const { user, profile, stats, savedCount } = ctx;
  const joined = new Date(user.createdAt).toLocaleDateString([], { month: "long", year: "numeric" });
  return pin({
    tags: "today",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>Your corner</h3><span class="pin-badge">since ${esc(joined)}</span></div>
        <div class="profile-pin-head">
          ${avatarHTML(profile.avatarEmoji, profile.avatarHue)}
          <div>
            <div class="profile-name">${esc(user.name)}</div>
            <div class="profile-meta">${stats.totalSips} sips logged · ${stats.daysTracked} days tracked</div>
          </div>
        </div>
        <div class="kv">
          <div class="kv-row"><span>Daily target</span><b>${stats.targetGlasses} × ${formatVolume(stats.glassMl, profile.unit)}</b></div>
          <div class="kv-row"><span>Total water</span><b>${formatFullVolume(stats.totalMl, profile.unit)}</b></div>
          <div class="kv-row"><span>Saved pins</span><b>${savedCount}</b></div>
        </div>
        <button class="wide-btn" data-action="open-settings">Edit profile & settings</button>
      </div>`,
  });
}

function mathPin(ctx) {
  const { stats, profile } = ctx;
  const glassShare = Math.round((stats.glassMl / stats.targetMl) * 100);
  const perHour = stats.remainingGlasses > 0
    ? round1(stats.remainingGlasses / Math.max(1, 22 - new Date().getHours()))
    : 0;
  return pin({
    tags: "trends",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>The water math</h3><span class="pin-badge">${profile.unit === "oz" ? "fl oz" : "ml"}</span></div>
        <div class="formula">
          Target = <b>${stats.targetGlasses} glasses</b> × <b>${formatVolume(stats.glassMl, profile.unit)}</b><br />
          = <b>${formatFullVolume(stats.targetMl, profile.unit)}</b> per day<br />
          One glass = <b>${glassShare}%</b> of today’s goal
        </div>
        <p class="pin-note" style="margin-top:12px">${
          stats.met
            ? "Goal reached — the rest of the day is free water. Sip if you’re thirsty."
            : `That’s roughly <b>one glass every ${perHour > 0 ? Math.max(1, Math.round(60 / Math.max(0.2, perHour))) : 60} minutes</b> for the rest of the day.`
        }</p>
        <button class="wide-btn" data-action="open-settings">Adjust target</button>
      </div>`,
  });
}

function allTimePin(ctx) {
  const { stats, profile } = ctx;
  return pin({
    tags: "trends",
    body: `
      <div class="pin-body">
        <div class="pin-head"><h3>All-time</h3><span class="pin-badge">${stats.daysTracked} days</span></div>
        <div class="mini-stats" style="grid-template-columns:1fr 1fr">
          <div class="mini-stat"><b>${formatGlasses(stats.totalGlasses)}</b><span>glasses logged</span></div>
          <div class="mini-stat"><b>${formatVolume(stats.totalMl, profile.unit)}</b><span>total water</span></div>
          <div class="mini-stat"><b>${stats.bestStreak}</b><span>best streak</span></div>
          <div class="mini-stat"><b>${formatVolume(stats.biggestDayMl, profile.unit)}</b><span>biggest day</span></div>
        </div>
      </div>`,
  });
}

export function renderBoard(ctx) {
  const saved = new Set(ctx.data.savedPins || []);
  return [
    logPin(ctx),
    weekPin(ctx),
    streakPin(ctx),
    achievementsPin(ctx),
    gardenPin(ctx),
    photoPin({
      id: "mood-lemon",
      img: "assets/img/lemon-tall.jpg",
      alt: "A tall glass of lemon water in sunlight",
      tag: "morning ritual",
      title: "The first glass",
      text: "Before coffee, before the phone. Lemon optional, intention not.",
      shape: "tall",
      saved: saved.has("mood-lemon"),
    }),
    heatmapPin(ctx),
    reminderPin(ctx),
    tipPin(ctx),
    leaderboardPin(ctx),
    photoPin({
      id: "mood-ripple",
      img: "assets/img/ripple.jpg",
      alt: "Blue water ripples",
      tag: "tiny progress",
      title: "One glass ripples",
      text: "Small habits don’t stay small. They spread through the whole day.",
      shape: "square",
      saved: saved.has("mood-ripple"),
    }),
    quotePin(),
    profilePin({ ...ctx, savedCount: saved.size }),
    photoPin({
      id: "mood-bottle",
      img: "assets/img/bottle-plants.jpg",
      alt: "A glass bottle of water among plants in sunlight",
      tag: "desk setup",
      title: "Keep it in sight",
      text: "A bottle on the desk is a quiet reminder you don’t have to think about.",
      shape: "landscape",
      saved: saved.has("mood-bottle"),
    }),
    mathPin(ctx),
    photoPin({
      id: "mood-table",
      img: "assets/img/lemon-glass.jpg",
      alt: "A glass of water with lemon on a wooden table",
      tag: "slow afternoon",
      title: "Pause, sip, repeat",
      text: "Two minutes away from the screen, one glass closer to the goal.",
      shape: "landscape",
      saved: saved.has("mood-table"),
    }),
    allTimePin(ctx),
  ].join("");
}
