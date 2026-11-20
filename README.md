# Ripple — a water diary

A Pinterest-style water tracker with name + passkey profiles, a daily glass goal,
streaks, badges, a tiny flower garden and a moodboard you can save pins to.

No framework, no build step, no backend — open it and drink.

![Moodboard pins](assets/img/lemon-glass.jpg)

## What's inside

**Profiles without email**
- Sign up with just a name and a passkey (4+ characters). Log back in any time with the same pair.
- Passkeys are hashed with PBKDF2-SHA256 (120k iterations, per-user random salt) before being stored.
- Profiles live in this browser's `localStorage`, so they sync across tabs on the same device — not across devices.
- Any number of profiles can share one browser; they are ranked on a little household leaderboard.

**The daily goal**
- Pick your glass size and how many glasses you want per day (e.g. 8 × 250 ml = 2 L).
- Log with one tap: small glass, regular glass, bottle, or a custom amount.
- The hero ring fills as you go; the target is the promise the streak depends on.

**Things that make it interesting**
- **Streaks** — consecutive days that hit the goal, with best-streak tracking.
- **Ten-week heatmap** and a **seven-day bar chart** of volume.
- **Badges** — 9 achievements, from First Sip to Century Club, earned automatically.
- **The little garden** — every met day grows a flower, partial days grow sprouts.
- **Gentle nudges** — optional in-app reminders (and browser notifications) every 30–120 minutes while the tab is open.
- **Moodboard** — photo pins you can save, plus a quote and a rotating hydration note.
- **Kitchen-sink settings** — avatar emoji + colour, units (ml / fl oz), light/dark theme, pour sound, JSON export, profile deletion.

## Run it

Any static file server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or open `index.html` through your editor's live-server. (Use a server rather than
`file://` so ES modules and `crypto.subtle` behave normally.)

**Try it fast:** press **“Peek inside the demo profile”** on the login screen.
It creates a demo account with ~10 weeks of believable history
(passkey `ripple123`) so the charts, streaks and badges have something to show.

## Structure

```
index.html            markup for the auth screen and the app shell
assets/css/styles.css design tokens, masonry board, pins, dark theme, responsive rules
assets/js/store.js    storage, passkey hashing, sip log, stats, streaks, achievements, demo seed
assets/js/ui.js       render helpers: hero, ring + glass art, charts, pins, copy
assets/js/app.js      boot, auth flow, rendering, modals, reminders, confetti, events
assets/img/           moodboard photography
```

## Notes

- Data is local to the browser. Clearing site data deletes profiles — use **Export JSON** for a backup.
- Reminders only fire while the tab is open (there is no server pushing notifications).
- The passkey protects against someone casually opening your profile on the same device; it is not
  encryption of the stored data.
