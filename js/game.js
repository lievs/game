"use strict";

/* ===================== Tiers ===================== */
// Only the first few tiers (see SPAWN_WEIGHTS below) ever drop from the
// top; bigger bodies can only be reached by merging, same structure as
// the classic "watermelon merge" formula, re-skinned as a journey from
// space debris to a black hole.
const TIERS = [
  { name: "Метеорит", r: 17, c1: "#c9c9c9", c2: "#5a5a5a", score: 1 },
  { name: "Луна", r: 23, c1: "#f2f2f2", c2: "#9a9a9a", score: 3 },
  { name: "Меркурий", r: 29, c1: "#d8c3ad", c2: "#8a6f57", score: 6 },
  { name: "Марс", r: 36, c1: "#f0906a", c2: "#a34328", score: 10 },
  { name: "Венера", r: 44, c1: "#f2d79a", c2: "#c99b4a", score: 15 },
  { name: "Земля", r: 53, c1: "#6fb6ef", c2: "#265d99", score: 21 },
  { name: "Нептун", r: 63, c1: "#7288f2", c2: "#2c3fa0", score: 28 },
  { name: "Уран", r: 74, c1: "#a6ecE6", c2: "#4fa39c", score: 36 },
  { name: "Сатурн", r: 86, c1: "#f2df9a", c2: "#b89a4e", score: 45, ring: true },
  { name: "Юпитер", r: 99, c1: "#f0b57a", c2: "#a8613a", score: 55 },
  { name: "Солнце", r: 113, c1: "#fff6b0", c2: "#ffb347", score: 66, glow: true },
  { name: "Чёрная дыра", r: 128, c1: "#5a3d8a", c2: "#050108", score: 200, glow: true, final: true },
];
const SPAWN_WEIGHTS = [38, 27, 18, 12, 5];

/* ===================== World constants ===================== */
const LOGICAL_W = 576;
const LOGICAL_H = 864;
const WELL_LEFT = 40;
const WELL_RIGHT = LOGICAL_W - 40;
const WELL_FLOOR = LOGICAL_H - 40;
const WELL_TOP_VISUAL = 188;
const DANGER_Y = 226;
const AIM_Y = 130;

const GRAVITY = 1500;
const WALL_RESTITUTION = 0.28;
const FLOOR_RESTITUTION = 0.22;
const COLLISION_RESTITUTION = 0.12;
const REST_SPEED = 90;
const SLEEP_SPEED = 55;
const SLEEP_DELAY = 0.15;
const COLLISION_ITERS = 6;
const FIXED_DT = 1 / 120;
const DROP_COOLDOWN = 0.28;
const DANGER_GRACE = 1.05;
const MERGE_MIN_AGE = 0.05;

/* ===================== DOM refs ===================== */
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const soundBtn = document.getElementById("sound-btn");
const comboPopup = document.getElementById("combo-popup");

const loadingScreen = document.getElementById("loading-screen");
const introScreen = document.getElementById("intro-screen");
const gameoverScreen = document.getElementById("gameover-screen");
const pauseScreen = document.getElementById("pause-screen");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const reviveBtn = document.getElementById("revive-btn");
const resumeBtn = document.getElementById("resume-btn");
const finalScoreEl = document.getElementById("final-score");
const finalBestEl = document.getElementById("final-best");

/* ===================== Game state ===================== */
let state = "loading"; // loading | intro | playing | paused | gameover
let pieces = [];
let particles = [];
let nextId = 1;
let score = 0;
let best = 0;
let comboCount = 0;
let comboTimer = 0;
let dangerTimer = 0;
let dropCooldown = 0;
let revived = false;
let shakeMag = 0;
let shakeTime = 0;

let aim = { tier: 0, x: LOGICAL_W / 2, r: TIERS[0].r };
let queuedNextTier = 0;
let isPointerDown = false;
let resyncClock = false;

let dpr = 1, scale = 1, offsetX = 0, offsetY = 0;
const stars = Array.from({ length: 70 }, () => ({
  x: Math.random() * LOGICAL_W,
  y: Math.random() * LOGICAL_H,
  r: Math.random() * 1.4 + 0.3,
  seed: Math.random() * Math.PI * 2,
}));

/* ===================== Helpers ===================== */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);

function pickSpawnTier() {
  const total = SPAWN_WEIGHTS.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SPAWN_WEIGHTS.length; i++) {
    if (r < SPAWN_WEIGHTS[i]) return i;
    r -= SPAWN_WEIGHTS[i];
  }
  return 0;
}

function setState(next) {
  state = next;
}

function shake(mag) {
  shakeMag = Math.max(shakeMag, mag);
  shakeTime = 0.35;
}

/* ===================== Resize / coordinate mapping ===================== */
function resize() {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  scale = Math.min(cssW / LOGICAL_W, cssH / LOGICAL_H);
  offsetX = (cssW - LOGICAL_W * scale) / 2;
  offsetY = (cssH - LOGICAL_H * scale) / 2;
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  return { x: (cssX - offsetX) / scale, y: (cssY - offsetY) / scale };
}

/* ===================== Spawning ===================== */
function refreshAimAndPreview() {
  aim.tier = queuedNextTierCurrent;
  aim.r = TIERS[aim.tier].r;
  aim.x = clamp(aim.x, WELL_LEFT + aim.r, WELL_RIGHT - aim.r);
  drawNextPreview();
}

let queuedNextTierCurrent = 0;

function initQueue() {
  queuedNextTierCurrent = pickSpawnTier();
  queuedNextTier = pickSpawnTier();
  aim.x = LOGICAL_W / 2;
  refreshAimAndPreview();
}

function drawNextPreview() {
  const t = TIERS[queuedNextTier];
  const w = nextCanvas.width, h = nextCanvas.height;
  nextCtx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 6;
  const r = Math.min(t.r * 0.55, maxR);
  drawPlanet(nextCtx, cx, cy, r, t, 1);
}

/* ===================== Physics ===================== */
function pieceAge(p, now) {
  return now - p.bornAt;
}

function stepPhysics(dt, now) {
  for (const p of pieces) {
    if (p.merging || p.sleeping) continue;
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.x - p.r < WELL_LEFT) {
      p.x = WELL_LEFT + p.r;
      p.vx = Math.abs(p.vx) > REST_SPEED ? -p.vx * WALL_RESTITUTION : 0;
    } else if (p.x + p.r > WELL_RIGHT) {
      p.x = WELL_RIGHT - p.r;
      p.vx = Math.abs(p.vx) > REST_SPEED ? -p.vx * WALL_RESTITUTION : 0;
    }
    if (p.y + p.r > WELL_FLOOR) {
      p.y = WELL_FLOOR - p.r;
      p.vy = Math.abs(p.vy) > REST_SPEED ? -p.vy * FLOOR_RESTITUTION : 0;
    }
    p.vx *= 0.98;
    p.vy *= 0.999;
  }

  const pendingMerges = [];

  for (let iter = 0; iter < COLLISION_ITERS; iter++) {
    for (let i = 0; i < pieces.length; i++) {
      const a = pieces[i];
      if (a.merging) continue;
      for (let j = i + 1; j < pieces.length; j++) {
        const b = pieces[j];
        if (b.merging) continue;
        resolvePair(a, b, now, pendingMerges);
      }
    }
  }

  if (pendingMerges.length) applyMerges(pendingMerges, now);

  // Sleep system: once a piece has been slow for a moment, freeze it
  // (infinite mass in future contacts) so a deep stack fully settles
  // instead of oscillating forever under a low-iteration solver.
  for (const p of pieces) {
    if (p.merging || p.sleeping) continue;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed < SLEEP_SPEED) {
      p.sleepTimer += dt;
      if (p.sleepTimer > SLEEP_DELAY) {
        p.sleeping = true;
        p.vx = 0;
        p.vy = 0;
      }
    } else {
      p.sleepTimer = 0;
    }
  }
}

function resolvePair(a, b, now, pendingMerges) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  const minDist = a.r + b.r;
  if (dist >= minDist) return;
  if (dist < 0.0001) {
    dist = 0.0001;
  }
  const nx = dx / dist;
  const ny = dy / dist;

  if (
    a.tier === b.tier &&
    !a.merging &&
    !b.merging &&
    pieceAge(a, now) > MERGE_MIN_AGE &&
    pieceAge(b, now) > MERGE_MIN_AGE
  ) {
    a.merging = true;
    b.merging = true;
    pendingMerges.push({ a, b, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    return;
  }

  const ma = a.r * a.r, mb = b.r * b.r;
  // A sleeping piece has effectively infinite mass: it won't be pushed or
  // budged by the collision, only the other (awake) piece reacts to it.
  const invA = a.sleeping ? 0 : 1 / ma;
  const invB = b.sleeping ? 0 : 1 / mb;
  const totalInv = invA + invB;
  if (totalInv <= 0) return; // both asleep and touching — nothing to resolve

  const overlap = minDist - dist;
  const pushA = (overlap * invA) / totalInv;
  const pushB = (overlap * invB) / totalInv;
  a.x -= nx * pushA;
  a.y -= ny * pushA;
  b.x += nx * pushB;
  b.y += ny * pushB;

  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal < 0) {
    // Below REST_SPEED, treat the contact as inelastic (no bounce-back) so
    // stacked pieces settle instead of jittering forever off tiny impulses.
    const restitution = -velAlongNormal > REST_SPEED ? COLLISION_RESTITUTION : 0;
    const j = (-(1 + restitution) * velAlongNormal) / totalInv;
    const ix = j * nx, iy = j * ny;
    a.vx -= ix * invA;
    a.vy -= iy * invA;
    b.vx += ix * invB;
    b.vy += iy * invB;
  }
}

function applyMerges(pending, now) {
  for (const { a, b, x, y } of pending) {
    pieces = pieces.filter((p) => p !== a && p !== b);

    const tier = a.tier;
    if (TIERS[tier].final) {
      score += TIERS[tier].score;
      spawnParticles(x, y, TIERS[tier], 34);
      shake(26);
      SFX.bigBang();
      registerCombo(now);
      updateScoreUI();
      continue;
    }

    const newTier = tier + 1;
    const merged = {
      id: nextId++,
      tier: newTier,
      x, y,
      vx: (a.vx + b.vx) * 0.15,
      vy: Math.min((a.vy + b.vy) * 0.15, 0),
      r: TIERS[newTier].r,
      merging: false,
      sleeping: false,
      sleepTimer: 0,
      bornAt: now,
    };
    pieces.push(merged);

    const combo = registerCombo(now);
    const gained = Math.round(TIERS[newTier].score * (1 + 0.5 * (combo - 1)));
    score += gained;
    updateScoreUI();
    spawnParticles(x, y, TIERS[newTier], 12 + newTier);
    shake(4 + newTier * 1.6);
    SFX.merge(newTier);
    if (combo >= 2) showCombo(combo);
  }
}

function registerCombo(now) {
  if (now - comboTimer < 0.7) {
    comboCount += 1;
  } else {
    comboCount = 1;
  }
  comboTimer = now;
  return comboCount;
}

function showCombo(combo) {
  comboPopup.textContent = `Комбо x${combo}!`;
  comboPopup.classList.remove("show");
  // force reflow so the animation restarts on rapid combos
  void comboPopup.offsetWidth;
  comboPopup.classList.add("show");
  SFX.combo(combo);
  clearTimeout(showCombo._t);
  showCombo._t = setTimeout(() => comboPopup.classList.remove("show"), 500);
}

function updateScoreUI() {
  scoreEl.textContent = String(score);
}

/* ===================== Particles ===================== */
function spawnParticles(x, y, tier, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = rand(40, 220);
    particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: rand(0.35, 0.75),
      age: 0,
      r: rand(1.5, 4),
      color: Math.random() > 0.5 ? tier.c1 : tier.c2,
    });
  }
}

function updateParticles(dt) {
  particles = particles.filter((p) => p.age < p.life);
  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.vx *= 0.98;
  }
}

/* ===================== Danger line / game over ===================== */
function updateDanger(dt, now) {
  let dangerActive = false;
  for (const p of pieces) {
    if (p.merging) continue;
    if (p.sleeping && p.y - p.r < DANGER_Y) {
      dangerActive = true;
      break;
    }
  }
  if (dangerActive) {
    dangerTimer += dt;
    if (dangerTimer > DANGER_GRACE) triggerGameOver();
  } else {
    dangerTimer = 0;
  }
  return dangerActive;
}

/* ===================== Rendering ===================== */
function drawPlanet(c, cx, cy, r, tier, scaleAnim) {
  const rr = r * scaleAnim;
  if (tier.glow) {
    c.save();
    c.shadowColor = tier.c1;
    c.shadowBlur = rr * 1.4;
  }
  const grad = c.createRadialGradient(cx - rr * 0.35, cy - rr * 0.35, rr * 0.15, cx, cy, rr);
  grad.addColorStop(0, tier.c1);
  grad.addColorStop(1, tier.c2);
  c.beginPath();
  c.arc(cx, cy, rr, 0, Math.PI * 2);
  c.fillStyle = grad;
  c.fill();
  if (tier.glow) c.restore();

  c.beginPath();
  c.arc(cx - rr * 0.32, cy - rr * 0.32, rr * 0.28, 0, Math.PI * 2);
  c.fillStyle = "rgba(255,255,255,0.22)";
  c.fill();

  if (tier.ring) {
    c.save();
    c.translate(cx, cy);
    c.rotate(-0.35);
    c.scale(1, 0.32);
    c.beginPath();
    c.arc(0, 0, rr * 1.55, 0, Math.PI * 2);
    c.strokeStyle = "rgba(230,215,170,0.85)";
    c.lineWidth = Math.max(2, rr * 0.14);
    c.stroke();
    c.restore();
  }
}

function drawWell() {
  ctx.save();
  ctx.strokeStyle = "rgba(120,150,220,0.55)";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(WELL_LEFT, WELL_TOP_VISUAL);
  ctx.lineTo(WELL_LEFT, WELL_FLOOR + 6);
  ctx.lineTo(WELL_RIGHT, WELL_FLOOR + 6);
  ctx.lineTo(WELL_RIGHT, WELL_TOP_VISUAL);
  ctx.shadowColor = "rgba(79,155,224,0.5)";
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
}

function drawDangerLine(active, now) {
  const pulse = active ? 0.5 + 0.5 * Math.sin(now * 14) : 0.35;
  ctx.save();
  ctx.strokeStyle = active ? `rgba(255,91,106,${pulse})` : "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(WELL_LEFT, DANGER_Y);
  ctx.lineTo(WELL_RIGHT, DANGER_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawStars(now) {
  ctx.save();
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(now * 1.5 + s.seed);
    ctx.globalAlpha = tw * 0.8;
    ctx.fillStyle = "#cfe0ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAimGuide() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.moveTo(aim.x, AIM_Y + aim.r);
  ctx.lineTo(aim.x, WELL_FLOOR);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  drawPlanet(ctx, aim.x, AIM_Y, aim.r, TIERS[aim.tier], 1);
}

function render(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
  ctx.clearRect(0, 0, cssW, cssH);

  let sx = 0, sy = 0;
  if (shakeTime > 0) {
    sx = rand(-shakeMag, shakeMag);
    sy = rand(-shakeMag, shakeMag);
  }

  ctx.save();
  ctx.translate(offsetX + sx, offsetY + sy);
  ctx.scale(scale, scale);

  drawStars(now);
  drawWell();
  drawDangerLine(lastDangerActive, now);

  for (const p of pieces) {
    const age = now - p.bornAt;
    const pop = age < 0.12 ? 0.7 + 0.3 * (age / 0.12) : 1;
    drawPlanet(ctx, p.x, p.y, p.r, TIERS[p.tier], pop);
  }

  for (const pt of particles) {
    const t = 1 - pt.age / pt.life;
    ctx.globalAlpha = Math.max(0, t);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (state === "playing") drawAimGuide();

  ctx.restore();
}

let lastDangerActive = false;

/* ===================== Main loop ===================== */
let lastTime = 0;
let accumulator = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const t = now / 1000;
  if (!lastTime || resyncClock) {
    lastTime = t;
    resyncClock = false;
  }
  let frameDt = t - lastTime;
  lastTime = t;
  frameDt = Math.min(frameDt, 0.05);

  if (dropCooldown > 0) dropCooldown = Math.max(0, dropCooldown - frameDt);
  if (shakeTime > 0) {
    shakeTime -= frameDt;
    if (shakeTime <= 0) shakeMag = 0;
  }

  if (state === "playing") {
    accumulator += frameDt;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 8) {
      stepPhysics(FIXED_DT, t);
      accumulator -= FIXED_DT;
      steps++;
    }
    updateParticles(frameDt);
    lastDangerActive = updateDanger(frameDt, t);
  } else {
    updateParticles(frameDt);
  }

  render(t);
}

/* ===================== Input ===================== */
function updateAimFromEvent(e) {
  const { x } = toLogical(e.clientX, e.clientY);
  aim.x = clamp(x, WELL_LEFT + aim.r, WELL_RIGHT - aim.r);
}

function dropCurrent() {
  if (state !== "playing" || dropCooldown > 0) return;
  const now = performance.now() / 1000;
  pieces.push({
    id: nextId++,
    tier: aim.tier,
    x: aim.x,
    y: AIM_Y,
    vx: 0,
    vy: 0,
    r: TIERS[aim.tier].r,
    merging: false,
    sleeping: false,
    sleepTimer: 0,
    bornAt: now,
  });
  SFX.drop();
  dropCooldown = DROP_COOLDOWN;

  queuedNextTierCurrent = queuedNextTier;
  queuedNextTier = pickSpawnTier();
  refreshAimAndPreview();
}

canvas.addEventListener("pointerdown", (e) => {
  if (state !== "playing") return;
  isPointerDown = true;
  updateAimFromEvent(e);
});
canvas.addEventListener("pointermove", (e) => {
  if (state !== "playing") return;
  if (e.pointerType === "mouse" || isPointerDown) updateAimFromEvent(e);
});
window.addEventListener("pointerup", (e) => {
  if (!isPointerDown) return;
  isPointerDown = false;
  if (state === "playing") dropCurrent();
});
canvas.addEventListener("pointercancel", () => { isPointerDown = false; });

window.addEventListener("keydown", (e) => {
  if (state !== "playing") return;
  if (e.code === "ArrowLeft") aim.x = clamp(aim.x - 18, WELL_LEFT + aim.r, WELL_RIGHT - aim.r);
  else if (e.code === "ArrowRight") aim.x = clamp(aim.x + 18, WELL_LEFT + aim.r, WELL_RIGHT - aim.r);
  else if (e.code === "Space" || e.code === "ArrowDown") dropCurrent();
});

/* ===================== Screens / flow ===================== */
function resetGame() {
  pieces = [];
  particles = [];
  score = 0;
  comboCount = 0;
  comboTimer = -10;
  dangerTimer = 0;
  dropCooldown = 0;
  revived = false;
  shakeMag = 0;
  shakeTime = 0;
  updateScoreUI();
  initQueue();
  resyncClock = true;
  accumulator = 0;
}

async function triggerGameOver() {
  if (state !== "playing") return;
  setState("gameover");
  YSDK.gameplayStop();
  SFX.gameOver();
  shake(20);

  finalScoreEl.textContent = String(score);
  if (score > best) {
    best = score;
    bestEl.textContent = String(best);
    finalBestEl.textContent = "Новый рекорд!";
    YSDK.setBestScore(best);
  } else {
    finalBestEl.textContent = `Рекорд: ${best}`;
  }

  reviveBtn.classList.toggle("hidden", revived || !YSDK.isAvailable());
  reviveBtn.disabled = false;
  reviveBtn.textContent = "▶ Посмотреть рекламу и продолжить";
  gameoverScreen.classList.remove("hidden");
}

function clearOverflow() {
  // Remove the highest few pieces so the well has breathing room again.
  const sorted = [...pieces].sort((a, b) => a.y - b.y);
  const toRemove = sorted.slice(0, Math.min(4, sorted.length));
  const removeIds = new Set(toRemove.map((p) => p.id));
  pieces = pieces.filter((p) => !removeIds.has(p.id));
  dangerTimer = 0;
}

startBtn.addEventListener("click", () => {
  SFX.click();
  introScreen.classList.add("hidden");
  resetGame();
  setState("playing");
  YSDK.gameplayStart();
});

restartBtn.addEventListener("click", () => {
  SFX.click();
  YSDK.showInterstitial();
  gameoverScreen.classList.add("hidden");
  resetGame();
  setState("playing");
  YSDK.gameplayStart();
});

reviveBtn.addEventListener("click", async () => {
  reviveBtn.disabled = true;
  reviveBtn.textContent = "Загрузка…";
  const rewarded = await YSDK.showRewarded();
  if (rewarded) {
    revived = true;
    clearOverflow();
    gameoverScreen.classList.add("hidden");
    setState("playing");
    resyncClock = true;
    accumulator = 0;
    YSDK.gameplayStart();
  } else {
    reviveBtn.textContent = "Реклама недоступна";
    setTimeout(() => {
      reviveBtn.textContent = "▶ Посмотреть рекламу и продолжить";
      reviveBtn.disabled = false;
    }, 1200);
  }
});

resumeBtn.addEventListener("click", () => {
  pauseScreen.classList.add("hidden");
  setState("playing");
  resyncClock = true;
  YSDK.gameplayStart();
});

soundBtn.addEventListener("click", () => {
  const muted = !SFX.isMuted();
  SFX.setMuted(muted);
  localStorage.setItem("planetMerge.muted", muted ? "1" : "0");
  soundBtn.textContent = muted ? "🔇" : "🔊";
  if (!muted) SFX.click();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") {
    setState("paused");
    pauseScreen.classList.remove("hidden");
    YSDK.gameplayStop();
  }
});
window.addEventListener("blur", () => {
  if (state === "playing") {
    setState("paused");
    pauseScreen.classList.remove("hidden");
    YSDK.gameplayStop();
  }
});

/* ===================== Boot ===================== */
async function boot() {
  SFX.setMuted(localStorage.getItem("planetMerge.muted") === "1");
  soundBtn.textContent = SFX.isMuted() ? "🔇" : "🔊";

  resize();
  initQueue();
  requestAnimationFrame(loop);

  await YSDK.init();
  best = await YSDK.getBestScore();
  bestEl.textContent = String(best);
  YSDK.gameReady();

  loadingScreen.classList.add("hidden");
  introScreen.classList.remove("hidden");
}

boot();
