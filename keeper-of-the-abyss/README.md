# Хранитель Бездны (Keeper of the Abyss)

A merge + roguelite-descent hybrid for **Yandex Games**: drop spirits into
a well, merge matching ones into stronger forms, and let them
auto-battle the warden of each floor. Clear it to descend further; a
persistent camp between runs turns every attempt — even a failed one —
into permanent progress. Full game design in [`GDD.md`](GDD.md).

## Why this game / genre

This is the second title in the repository, built specifically to chase a
trend the first one (Planet Merge, at the repo root) couldn't: research
into Yandex Games' own 2025–2026 developer communications shows **midcore
entered the platform's top-5 genres**, average session length is
approaching 60 minutes, and developer IAP revenue grew 75% year over
year — all pointing the same direction: the pure 30-second casual loop is
being out-earned by casual mechanics wrapped in **meta-progression**.

So rather than a from-scratch bet on an unproven genre, this reuses
Planet Merge's proven, already-shipped drop-and-merge core (the same
physics engine, same tactile mobile input) and layers exactly what the
platform data says is missing: a floor-by-floor combat structure, a
persistent currency and upgrade shop, and a narrative delivered in small,
permanently-unlocked fragments — the ingredients research on roguelite
meta-progression design consistently flags as what keeps players coming
back without turning failed runs into wasted time (a run that ends in
"the well overflowed" still pays out shards and keeps any lore fragment
just unlocked).

## Core loop

1. Drop spirits into the well; merge two of the same rank into the next,
   stronger one (10 ranks, DPS doubling each rank, from a tiny Искра to
   the golden Эхо Хранителя).
2. Settled spirits automatically attack the current floor's enemy (an HP
   bar, no direct threat to the player — the only failure condition is
   the well overflowing, same mechanic Planet Merge already proved works).
3. Defeat the enemy to advance a floor — the well is **not** reset, so
   progress compounds within a run. Every 5th floor is a boss and, the
   first time you reach it, permanently unlocks a memory fragment in
   your journal.
4. Overflow ends the run softly ("the Abyss pushes you back") — you keep
   everything earned. You can also retreat voluntarily at any time to
   bank your rewards without the risk.
5. Between runs, spend **Memory Shards** in the Keeper's Camp on
   permanent upgrades (starting rank, well capacity, damage, shard gain).

## What's implemented

- **Physics/merge engine** adapted from Planet Merge (custom gravity,
  circle-circle impulse collision, sleep system) — same feel, reskinned
  as spirits of the Abyss instead of planets.
- **Floor/combat system**: exponential enemy HP scaling, boss floors
  every 5th level with a 3x HP spike, a resonance "nuke" event when two
  max-rank spirits collide (instant floor clear + bonus shards, the
  direct analogue of Planet Merge's black-hole collision "big bang").
- **Meta-progression hub** ("Лагерь Хранителя"): 4 upgrade branches with
  scaling costs, persisted shards/best-floor/fragments via
  `player.getData/setData` (localStorage fallback), deliberately kept
  small (max 3–6 levels each) so a skilled player can go deep with zero
  upgrades — progression should expand what's possible, not gate the
  baseline experience.
- **Narrative delivered via unlockable journal fragments** (8 fragments,
  one per boss milestone through floor 40), building toward a twist
  revealed gradually rather than through cutscenes — cheap to produce,
  free content-drip retention hook.
- **Full game flow**: loading → hub → (first-time) how-to-play → playing
  → floor-clear toast → boss + fragment modal → run-end (overflow or
  voluntary retreat) → hub, plus auto-pause on tab blur.
- **Real Yandex Games SDK integration** (`js/yandex-sdk.js`): leaderboard
  `keeperAbyssBestFloor`, a rate-limited interstitial when returning to
  the hub after a run, a rewarded-video "second wind" continue on
  overflow (once per run), and SDK-driven language detection
  (ru/en, §2.14 compliance) — all gracefully degrading to a fully
  playable standalone mode when `window.YaGames` isn't present.
- **Synthesized audio** (Web Audio, no asset files), extended with
  combat-specific cues (attack tick, floor clear, boss sting, fragment
  chime) on top of Planet Merge's drop/merge/combo set.

## Project structure

```
GDD.md               full design document (tiers, floors, economy, narrative)
index.html            entry point, loads the Yandex SDK script + the game
style.css             all styling (dark abyss theme, responsive, mobile-first)
js/yandex-sdk.js       thin wrapper around window.YaGames with safe fallbacks
js/audio.js            synthesized WebAudio sound effects (no asset files)
js/game.js             physics engine, combat/floor system, hub, game state machine
```

No build step, no dependencies — a static site, self-contained in this
folder so it can be zipped and published independently of Planet Merge
at the repo root.

## Running locally

```
python3 -m http.server 8080
# open http://localhost:8080/
```

## Controls

- **Mouse**: move to aim, click to drop.
- **Touch**: drag to aim, release to drop.
- **Keyboard** (desktop convenience): ←/→ to aim, Space/↓ to drop.

## Publishing to Yandex Games

1. Zip the contents of *this* directory (`index.html`, `style.css`,
   `js/`) — the zip root must contain `index.html` directly.
2. In the [Yandex Games developer console](https://games.yandex.ru/),
   create a game, upload the zip, fill in title/description/icon.
3. Create a leaderboard named `keeperAbyssBestFloor` if you want the
   leaderboard calls to record scores (or change `LB_NAME` in
   `js/yandex-sdk.js`).
4. Test through the console's built-in preview — that's the only
   environment where `window.YaGames` is actually present.

## Testing notes

The full loop — merge chain, settled-spirit auto-damage, floor
clear/advance, boss floor + fragment unlock + journal persistence,
voluntary retreat vs. forced overflow, hub upgrade purchases, and save
persistence across reloads (localStorage fallback) — was driven
end-to-end with a headless-browser (Playwright) script, since this
sandbox can't reach the real Yandex Games platform (the SDK `<script>`
tag fails to load here, which the game detects and falls back to
standalone mode automatically, exactly like Planet Merge). The SDK
integration itself should get a real smoke test in the Yandex console's
preview before launch.
