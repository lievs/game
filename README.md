# Слияние планет (Planet Merge)

A drop-and-merge physics puzzle built for **Yandex Games**: drop small
celestial bodies into a well, merge two matching ones into the next tier,
and try to reach the final tier — a black hole — before the well overflows.

## Why this game / genre

Before writing any code, I looked at what actually performs well on Yandex
Games right now:

- **Bubble shooter** is described by Yandex's own developer content as
  "the absolute king" of casual browser/mobile gaming on the platform —
  but it's also the single most saturated genre in the catalog, so a new
  entry has a hard time standing out.
- **Racing** games pull several thousand daily players consistently.
- **Merge / "watermelon" games** (the *Suika Game* format: drop items,
  merge same-tier pairs into the next size, avoid overflowing the
  container) are a genuinely global phenomenon — the original exploded
  from a few thousand downloads to 11M+ worldwide after going viral with
  streamers, and it spawned an entire genre of clones that keep doing
  well on every casual platform, Yandex Games included. The loop is
  trivially easy to learn (drop, watch, "just one more"), naturally
  produces long sessions and replay ("almost beat my record"), and scales
  perfectly to a phone screen — which matters, since a large share of
  Yandex Games traffic is mobile.

Given that, cloning bubble shooter #4000 seemed like a worse bet than
building a **merge game with a distinct visual hook**: instead of fruit,
the theme is a journey through space — asteroid → moon → planets → sun →
**black hole**. It's the same proven addictive core loop, but the theme
gives it a much stronger thumbnail/icon (a glowing planet chain
collapsing into a black hole reads well at a small size, which matters a
lot for click-through on a catalog page) and a satisfying, novel "finale"
event when two black holes collide.

## What's implemented

- **Custom lightweight 2D physics** (no external engine/library): gravity,
  circle-circle collision with impulse resolution, and a sleep system so
  stacks actually settle instead of jittering forever — this also drives
  the authoritative "is the well overflowing" check.
- **12 merge tiers**, from Метеорит (meteorite) to Чёрная дыра (black
  hole), each with its own size, colour gradient, and score value; Saturn
  gets a ring, the sun and the black hole get a glow.
- **Combo scoring**: chained merges within a short window multiply the
  score and pop a "Комбо x*N*!" toast.
- **Juice**: particle bursts on merge, screen shake scaled to the merge
  size, a "big bang" event (screen shake + burst + bonus score) when two
  max-tier bodies collide, spawn-in pop animation.
- **Full game flow**: loading → intro/how-to-play → playing → game over,
  plus auto-pause when the tab loses focus/visibility.
- **Mobile + desktop input**: drag/tap via Pointer Events, plus
  arrow-keys + space for desktop testing.
- **Responsive canvas**: fixed logical coordinate space, letterboxed and
  scaled to fit any viewport/aspect ratio, DPR-aware for crisp rendering.
- **Synthesized audio** (Web Audio oscillators/noise, no asset files) for
  drop/merge/combo/game-over/big-bang sounds, with a mute toggle
  persisted to `localStorage`.
- **Real Yandex Games SDK integration** (`js/yandex-sdk.js`), wired to:
  - `LoadingAPI.ready()` once the game is interactive;
  - `GameplayAPI.start()/stop()` around active play (including on
    pause/resume);
  - best-score persistence via `player.getData/setData` (with a
    `localStorage` fallback) **and** submission to a Yandex leaderboard;
  - a rate-limited fullscreen interstitial on restart;
  - a rewarded-video **"continue" (revive)** flow on game over — a
    retention feature common to the platform's better-performing titles,
    since it turns a hard fail into a monetized second chance instead of
    an immediate bounce.
  - Every call is wrapped so the game runs and is fully playable
    **outside** the Yandex Games iframe too (falls back to `localStorage`
    and simply hides SDK-only UI), which is what makes local testing and
    the zip-upload preview work.

## Project structure

```
index.html          entry point, loads the Yandex SDK script + the game
style.css            all styling (dark space theme, responsive, mobile-first)
js/yandex-sdk.js      thin wrapper around window.YaGames with safe fallbacks
js/audio.js           synthesized WebAudio sound effects (no asset files)
js/game.js             physics engine, rendering, input, game state machine
```

No build step, no dependencies — it's a static site.

## Running locally

```
python3 -m http.server 8080
# open http://localhost:8080/
```

(Any static file server works — the Yandex SDK `<script>` tag will
simply fail to load outside the platform, which the game detects and
falls back to standalone mode automatically.)

## Controls

- **Mouse**: move to aim, click to drop.
- **Touch**: drag to aim, release to drop.
- **Keyboard** (desktop convenience): ←/→ to aim, Space/↓ to drop.

## Publishing to Yandex Games

1. Zip the contents of this directory (`index.html`, `style.css`, `js/`)
   — the zip root must contain `index.html` directly, not a subfolder.
2. In the [Yandex Games developer console](https://games.yandex.ru/),
   create a game, upload the zip on the Onboarding → Stage 1 step, and
   fill in the title/description/icon/screenshots on Stage 2.
3. If you want the leaderboard calls to actually record scores, create a
   leaderboard named `planetMerge` in the console (or change `LB_NAME` in
   `js/yandex-sdk.js` to match whatever you create).
4. Test through the console's built-in preview — that's the only
   environment where `window.YaGames` is actually present, so it's the
   only place the leaderboard/ads/player-data calls will do anything.

## Testing notes

The core loop, merging, combo scoring, the danger-line/game-over
condition, restart, mute toggle, and auto-pause were all driven end-to-end
with a headless-browser script (Playwright) during development — including
deliberately stacking pieces to force a game over — since this sandbox
can't reach the real Yandex Games platform. The SDK integration itself
therefore couldn't be exercised end-to-end here; it's implemented against
the documented API shape and degrades safely when the SDK is absent, but
should get a real smoke test in the Yandex console's preview before launch.
