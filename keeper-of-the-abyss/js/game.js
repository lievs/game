"use strict";

/* ===================== Tiers ===================== */
// DPS doubles every rank — simple enough that a player can eyeball "this
// merge doubled my damage". Only the first three tiers of the current
// spawn window ever drop from the top (see pickSpawnTier); everything
// above that is reached by merging, same skeleton as Planet Merge's
// "watermelon merge" formula, re-skinned as a descent through the Abyss.
const TIERS = [
  { name: "Искра", r: 18, c1: "#eafcff", c2: "#7fd9e8", dps: 1 },
  { name: "Дух", r: 24, c1: "#cdb8ff", c2: "#6a4fd1", dps: 2 },
  { name: "Тень", r: 31, c1: "#8f6fd9", c2: "#2e1a52", dps: 4 },
  { name: "Страж", r: 39, c1: "#6fa8f2", c2: "#1c3a78", dps: 8 },
  { name: "Химера", r: 48, c1: "#f2705a", c2: "#7a1c1c", dps: 16 },
  { name: "Голем Бездны", r: 58, c1: "#b9b3a8", c2: "#4a463f", dps: 32 },
  { name: "Древний", r: 69, c1: "#7be0a0", c2: "#145a34", dps: 64 },
  { name: "Повелитель тьмы", r: 81, c1: "#a13a6a", c2: "#05010a", dps: 128, glow: true },
  { name: "Осколок Башни", r: 94, c1: "#eafcff", c2: "#8fa8c9", dps: 256, glow: true },
  { name: "Эхо Хранителя", r: 108, c1: "#fff3b0", c2: "#caa227", dps: 512, glow: true, final: true },
];

/* ===================== Combat / floor content ===================== */
const BASE_ENEMY_HP = 40;
const ENEMY_HP_GROWTH = 1.35;
const BOSS_EVERY = 5;
const BOSS_HP_MULT = 3;
const BOSS_BONUS_SHARDS = 25;

function isBossFloor(f) { return f % BOSS_EVERY === 0; }
function enemyHpForFloor(f) {
  return Math.round(BASE_ENEMY_HP * Math.pow(ENEMY_HP_GROWTH, f - 1) * (isBossFloor(f) ? BOSS_HP_MULT : 1));
}
function shardsForFloor(f) {
  const base = 5 + f * 2 + (isBossFloor(f) ? BOSS_BONUS_SHARDS : 0);
  return Math.round(base * shardMultiplier());
}

const ENEMY_NAMES = {
  ru: ["Порождение мрака", "Костяной страж", "Шёпот теней", "Всадник пустоты", "Клык Бездны", "Стая теней", "Кристальный страж", "Дитя провала"],
  en: ["Spawn of Dusk", "Bone Warden", "Whisper of Shadows", "Void Rider", "Fang of the Abyss", "Shadow Pack", "Crystal Sentinel", "Child of the Fall"],
};
const BOSS_NAMES = {
  ru: ["Страж Порога", "Гончая Забвения", "Королева Теней", "Кузнец Осколков", "Плакальщица Бездны", "Хранитель Ключа", "Тень Башни", "Эхо Первого Хранителя"],
  en: ["Warden of the Threshold", "Hound of Oblivion", "Queen of Shadows", "Shardsmith", "Mourner of the Abyss", "Keeper of the Key", "Shade of the Tower", "Echo of the First Keeper"],
};

// Narrative fragments — one per boss milestone, unlocked once and kept
// forever in the player's journal. Builds towards the reveal that the
// Abyss is an inverted mirror of the world above, slowly devouring it.
const FRAGMENTS = [
  { floor: 5, ru: "Ты не помнишь своего имени. Помнишь только холод колодца и голоса, зовущие тебя вниз.", en: "You don't remember your name. Only the cold of the well, and voices calling you down." },
  { floor: 10, ru: "Когда-то здесь стояла Башня Алхимика. Она искала способ отразить целый мир — и ошиблась.", en: "An Alchemist's Tower once stood here. It sought to mirror an entire world — and failed." },
  { floor: 15, ru: "Тени здесь — не чудовища. Это осколки тех, кто спускался до тебя и не поднялся.", en: "The shadows here aren't monsters. They're echoes of those who descended before you and never rose." },
  { floor: 20, ru: "Чем глубже ты падаешь, тем яснее видишь: своды Бездны похожи на небо. Слишком похожи.", en: "The deeper you fall, the clearer it becomes: the Abyss's ceiling looks like a sky. Too much like one." },
  { floor: 25, ru: "Королевство наверху меркнет с каждым твоим шагом вниз. Никто там этого не замечает.", en: "The kingdom above dims with every step you take down. No one up there has noticed yet." },
  { floor: 30, ru: "Ты вспоминаешь: это ты запечатал Башню. Это ты не удержал печать.", en: "You remember now: you sealed the Tower. You were the one who let the seal fail." },
  { floor: 35, ru: "Бездна — не яма под миром. Это его отражение, растущее и пожирающее оригинал.", en: "The Abyss isn't a pit beneath the world. It's the world's reflection, growing and devouring the original." },
  { floor: 40, ru: "Дно, к которому ты стремишься, — это небо над твоим домом. Ты спускаешься, чтобы подняться.", en: "The bottom you're reaching for is the sky above your home. You descend in order to rise." },
];

/* ===================== Meta-progression (Лагерь Хранителя) ===================== */
const UPGRADES = [
  { id: "startRank", maxLevel: 3, baseCost: 30, nameKey: "up_startrank_name", descKey: "up_startrank_desc", effect: (lvl) => lvl },
  { id: "wellCap", maxLevel: 5, baseCost: 25, nameKey: "up_wellcap_name", descKey: "up_wellcap_desc", effect: (lvl) => lvl * 6 },
  { id: "resonance", maxLevel: 6, baseCost: 40, nameKey: "up_resonance_name", descKey: "up_resonance_desc", effect: (lvl) => lvl * 8 },
  { id: "generosity", maxLevel: 5, baseCost: 50, nameKey: "up_generosity_name", descKey: "up_generosity_desc", effect: (lvl) => lvl * 10 },
];

function upgradeCost(def, level) {
  return Math.ceil(def.baseCost * Math.pow(1.6, level));
}
function dpsMultiplier() {
  return 1 + (save.upgrades.resonance || 0) * 0.08;
}
function shardMultiplier() {
  return 1 + (save.upgrades.generosity || 0) * 0.10;
}
function dangerYFor() {
  return BASE_DANGER_Y - (save.upgrades.wellCap || 0) * 6;
}

let save = { shards: 0, bestFloor: 0, upgrades: { startRank: 0, wellCap: 0, resonance: 0, generosity: 0 }, fragments: [] };

function persistSave() {
  YSDK.setSave(save); // fire-and-forget; never blocks gameplay
}

/* ===================== Localization ===================== */
const LANGUAGES = {
  ru: {
    title: "Хранитель Бездны",
    loading_sub: "Спуск начинается…",
    hub_title: "Лагерь Хранителя",
    shards_label: "Осколки памяти",
    best_floor_label: "Лучший этаж",
    descend_btn: "Спуститься в Бездну",
    howto_btn: "Как играть",
    journal_btn: "Дневник Хранителя",
    journal_title: "Дневник Хранителя",
    close_btn: "Закрыть",
    intro_p1: "Роняй духов Бездны и соединяй одинаковых — они сольются в более сильную форму.",
    intro_p2: "Осевшие духи сами атакуют стража этажа. Побеждай его — и спускайся глубже.",
    intro_p3: "Не дай колодцу переполниться — иначе Бездна вытеснит тебя наверх (но всё заработанное останется).",
    play_btn: "Начать спуск",
    back_btn: "Назад в лагерь",
    floor_label: "Этаж",
    next_label: "Далее",
    sound_label: "Звук",
    fragment_title: "Фрагмент памяти",
    continue_btn: "Продолжить",
    overflow_title: "Бездна вытесняет тебя!",
    retreat_title: "Ты отступил с добычей",
    runend_floor_label: "Ты дошёл до этажа",
    runend_shards_label: "Осколков получено:",
    runend_new_best: "Новый рекорд глубины!",
    runend_best_label: "Лучший этаж: {n}",
    revive_btn: "▶ Посмотреть рекламу и продолжить",
    revive_loading: "Загрузка…",
    revive_unavailable: "Реклама недоступна",
    tohub_btn: "В лагерь",
    pause_title: "Пауза",
    resume_btn: "Продолжить",
    combo_text: "Комбо x{n}!",
    floor_clear_toast: "Этаж пройден!",
    up_startrank_name: "Начальный ранг",
    up_startrank_desc: "Мин. ранг падающих духов: +{n}",
    up_wellcap_name: "Вместимость колодца",
    up_wellcap_desc: "+{n}px запаса высоты",
    up_resonance_name: "Резонанс",
    up_resonance_desc: "+{n}% урона всех духов",
    up_generosity_name: "Щедрость Бездны",
    up_generosity_desc: "+{n}% осколков за этаж",
    level_label: "Уровень {n}/{max}",
    maxed_label: "Макс.",
    journal_locked: "???",
  },
  en: {
    title: "Keeper of the Abyss",
    loading_sub: "The descent begins…",
    hub_title: "The Keeper's Camp",
    shards_label: "Memory Shards",
    best_floor_label: "Best floor",
    descend_btn: "Descend into the Abyss",
    howto_btn: "How to play",
    journal_btn: "Keeper's Journal",
    journal_title: "Keeper's Journal",
    close_btn: "Close",
    intro_p1: "Drop spirits of the Abyss and merge matching ones — they fuse into a stronger form.",
    intro_p2: "Settled spirits automatically attack the floor's warden. Defeat it to descend further.",
    intro_p3: "Don't let the well overflow — the Abyss will push you back up (but you keep everything earned).",
    play_btn: "Begin the descent",
    back_btn: "Back to camp",
    floor_label: "Floor",
    next_label: "Next",
    sound_label: "Sound",
    fragment_title: "Memory Fragment",
    continue_btn: "Continue",
    overflow_title: "The Abyss pushes you back!",
    retreat_title: "You retreated with the spoils",
    runend_floor_label: "You reached floor",
    runend_shards_label: "Shards earned:",
    runend_new_best: "New depth record!",
    runend_best_label: "Best floor: {n}",
    revive_btn: "▶ Watch an ad to continue",
    revive_loading: "Loading…",
    revive_unavailable: "Ad unavailable",
    tohub_btn: "To camp",
    pause_title: "Paused",
    resume_btn: "Resume",
    combo_text: "Combo x{n}!",
    floor_clear_toast: "Floor cleared!",
    up_startrank_name: "Starting Rank",
    up_startrank_desc: "Min. rank of falling spirits: +{n}",
    up_wellcap_name: "Well Capacity",
    up_wellcap_desc: "+{n}px of extra headroom",
    up_resonance_name: "Resonance",
    up_resonance_desc: "+{n}% damage from all spirits",
    up_generosity_name: "Abyssal Generosity",
    up_generosity_desc: "+{n}% shards per floor",
    level_label: "Level {n}/{max}",
    maxed_label: "Max",
    journal_locked: "???",
  },
};

let currentLang = "ru";

function t(key, params = {}) {
  let text = LANGUAGES[currentLang]?.[key] ?? LANGUAGES.ru[key] ?? key;
  Object.keys(params).forEach((k) => {
    text = text.replace(new RegExp(`\\{${k}\\}`, "g"), params[k]);
  });
  return text;
}

function applyLanguage(lang) {
  currentLang = LANGUAGES[lang] ? lang : "ru";
  document.documentElement.lang = currentLang;
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  soundBtn.setAttribute("aria-label", t("sound_label"));
  soundBtn.setAttribute("title", t("sound_label"));
  if (state === "hub") renderHub();
}

/* ===================== World constants ===================== */
const LOGICAL_W = 576;
const LOGICAL_H = 864;
const WELL_LEFT = 40;
const WELL_RIGHT = LOGICAL_W - 40;
const WELL_FLOOR = LOGICAL_H - 40;
const WELL_TOP_VISUAL = 188;
const BASE_DANGER_Y = 226;
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
const ATTACK_TICK = 1.0;
const FLOOR_PAUSE = 0.9;

/* ===================== DOM refs ===================== */
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");

const topbar = document.getElementById("topbar");
const enemyWrap = document.getElementById("enemy-wrap");
const enemyNameEl = document.getElementById("enemy-name");
const enemyHpFill = document.getElementById("enemy-hp-fill");
const nextWrap = document.getElementById("next-wrap");
const floorNumEl = document.getElementById("floor-num");
const soundBtn = document.getElementById("sound-btn");
const retreatBtn = document.getElementById("retreat-btn");
const comboPopup = document.getElementById("combo-popup");
const floorToast = document.getElementById("floor-toast");

const loadingScreen = document.getElementById("loading-screen");
const hubScreen = document.getElementById("hub-screen");
const journalScreen = document.getElementById("journal-screen");
const introScreen = document.getElementById("intro-screen");
const fragmentScreen = document.getElementById("fragment-screen");
const runendScreen = document.getElementById("runend-screen");
const pauseScreen = document.getElementById("pause-screen");

const hubShardsEl = document.getElementById("hub-shards");
const hubBestFloorEl = document.getElementById("hub-best-floor");
const upgradeListEl = document.getElementById("upgrade-list");
const journalListEl = document.getElementById("journal-list");
const descendBtn = document.getElementById("descend-btn");
const howtoBtn = document.getElementById("howto-btn");
const journalBtn = document.getElementById("journal-btn");
const journalCloseBtn = document.getElementById("journal-close-btn");
const startBtn = document.getElementById("start-btn");
const introBackBtn = document.getElementById("intro-back-btn");
const fragmentTextEl = document.getElementById("fragment-text");
const fragmentCloseBtn = document.getElementById("fragment-close-btn");
const runendTitleEl = document.getElementById("runend-title");
const runendFloorEl = document.getElementById("runend-floor");
const runendShardsEl = document.getElementById("runend-shards");
const runendBestEl = document.getElementById("runend-best");
const reviveBtn = document.getElementById("revive-btn");
const tohubBtn = document.getElementById("tohub-btn");
const resumeBtn = document.getElementById("resume-btn");

/* ===================== Game state ===================== */
let state = "loading"; // loading | hub | intro | playing | paused | runend
let pieces = [];
let particles = [];
let nextId = 1;
let comboCount = 0;
let comboTimer = 0;
let dangerTimer = 0;
let dropCooldown = 0;
let revived = false;
let shakeMag = 0;
let shakeTime = 0;

let floor = 1;
let enemyHP = 1;
let enemyMaxHP = 1;
let atkTimer = 0;
let floorPending = false;
let floorPauseTimer = 0;
let pendingFragmentFloor = null;
let shardsThisRun = 0;
let fleeingForced = false;
let fragmentModalOpen = false;

let aim = { tier: 0, x: LOGICAL_W / 2, r: TIERS[0].r };
let queuedNextTier = 0;
let queuedNextTierCurrent = 0;
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

function spawnWindow() {
  const start = clamp(save.upgrades.startRank || 0, 0, TIERS.length - 3);
  return [start, start + 1, start + 2];
}
function pickSpawnTier() {
  const win = spawnWindow();
  const weights = [50, 35, 15];
  let r = Math.random() * 100;
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return win[i];
    r -= weights[i];
  }
  return win[0];
}

function setState(next) {
  state = next;
}

function shake(mag) {
  shakeMag = Math.max(shakeMag, mag);
  shakeTime = 0.35;
}

function setPlayingUiVisible(visible) {
  topbar.classList.toggle("hidden", !visible);
  enemyWrap.classList.toggle("hidden", !visible);
  nextWrap.classList.toggle("hidden", !visible);
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

/* ===================== Spawning (drop queue) ===================== */
function refreshAimAndPreview() {
  aim.tier = queuedNextTierCurrent;
  aim.r = TIERS[aim.tier].r;
  aim.x = clamp(aim.x, WELL_LEFT + aim.r, WELL_RIGHT - aim.r);
  drawNextPreview();
}

function initQueue() {
  queuedNextTierCurrent = pickSpawnTier();
  queuedNextTier = pickSpawnTier();
  aim.x = LOGICAL_W / 2;
  refreshAimAndPreview();
}

function drawNextPreview() {
  const tier = TIERS[queuedNextTier];
  const w = nextCanvas.width, h = nextCanvas.height;
  nextCtx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 6;
  const r = Math.min(tier.r * 0.55, maxR);
  drawSpirit(nextCtx, cx, cy, r, tier, 1);
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
  if (dist < 0.0001) dist = 0.0001;
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
  const invA = a.sleeping ? 0 : 1 / ma;
  const invB = b.sleeping ? 0 : 1 / mb;
  const totalInv = invA + invB;
  if (totalInv <= 0) return;

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
      spawnParticles(x, y, TIERS[tier], 34);
      shake(26);
      SFX.resonance();
      const bonus = Math.round(50 * shardMultiplier());
      shardsThisRun += bonus;
      save.shards += bonus;
      if (!floorPending && enemyHP > 0) {
        enemyHP = 0;
        updateEnemyHpBar();
        handleFloorCleared(floor);
      }
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
  comboPopup.textContent = t("combo_text", { n: combo });
  comboPopup.classList.remove("show");
  void comboPopup.offsetWidth;
  comboPopup.classList.add("show");
  SFX.combo(combo);
  clearTimeout(showCombo._t);
  showCombo._t = setTimeout(() => comboPopup.classList.remove("show"), 500);
}

function showFloorToast(text) {
  floorToast.textContent = text;
  floorToast.classList.remove("show");
  void floorToast.offsetWidth;
  floorToast.classList.add("show");
  clearTimeout(showFloorToast._t);
  showFloorToast._t = setTimeout(() => floorToast.classList.remove("show"), 900);
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

/* ===================== Combat: enemies / floors ===================== */
function totalBoardDps() {
  let sum = 0;
  for (const p of pieces) {
    if (p.sleeping) sum += TIERS[p.tier].dps;
  }
  return sum * dpsMultiplier();
}

function updateEnemyHpBar() {
  const pct = enemyMaxHP > 0 ? clamp((enemyHP / enemyMaxHP) * 100, 0, 100) : 0;
  enemyHpFill.style.width = `${pct}%`;
}

function spawnEnemy(f) {
  const boss = isBossFloor(f);
  enemyMaxHP = enemyHpForFloor(f);
  enemyHP = enemyMaxHP;
  const names = boss ? BOSS_NAMES[currentLang] || BOSS_NAMES.ru : ENEMY_NAMES[currentLang] || ENEMY_NAMES.ru;
  const idx = boss ? Math.floor(f / BOSS_EVERY - 1) % names.length : (f - 1) % names.length;
  enemyNameEl.textContent = (boss ? "👑 " : "") + names[idx];
  floorNumEl.textContent = String(f);
  updateEnemyHpBar();
  if (boss) SFX.bossAppear();
  atkTimer = 0;
}

function handleFloorCleared(clearedFloor) {
  const reward = shardsForFloor(clearedFloor);
  shardsThisRun += reward;
  save.shards += reward;
  SFX.floorClear();
  showFloorToast(t("floor_clear_toast"));
  persistSave();

  floor = clearedFloor + 1;
  floorPending = true;
  floorPauseTimer = FLOOR_PAUSE;

  if (isBossFloor(clearedFloor)) {
    const fragment = FRAGMENTS.find((fr) => fr.floor === clearedFloor);
    if (fragment && !save.fragments.includes(fragment.floor)) {
      save.fragments.push(fragment.floor);
      pendingFragmentFloor = fragment.floor;
      persistSave();
    }
  }
}

function openFragmentModal(fragmentFloor) {
  const fragment = FRAGMENTS.find((fr) => fr.floor === fragmentFloor);
  if (!fragment) return;
  fragmentModalOpen = true;
  fragmentTextEl.textContent = fragment[currentLang] || fragment.ru;
  fragmentScreen.classList.remove("hidden");
  SFX.fragmentUnlock();
}

fragmentCloseBtn.addEventListener("click", () => {
  SFX.click();
  fragmentScreen.classList.add("hidden");
  fragmentModalOpen = false;
  resyncClock = true;
  spawnEnemy(floor);
});

/* ===================== Danger line / run end ===================== */
function updateDanger(dt, now) {
  let dangerActive = false;
  const dy = dangerYFor();
  for (const p of pieces) {
    if (p.merging) continue;
    if (p.sleeping && p.y - p.r < dy) {
      dangerActive = true;
      break;
    }
  }
  if (dangerActive) {
    dangerTimer += dt;
    if (dangerTimer > DANGER_GRACE) triggerRunEnd(true);
  } else {
    dangerTimer = 0;
  }
  return dangerActive;
}

/* ===================== Rendering ===================== */
function drawSpirit(c, cx, cy, r, tier, scaleAnim) {
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
}

function drawWell() {
  ctx.save();
  ctx.strokeStyle = "rgba(150,110,220,0.55)";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(WELL_LEFT, WELL_TOP_VISUAL);
  ctx.lineTo(WELL_LEFT, WELL_FLOOR + 6);
  ctx.lineTo(WELL_RIGHT, WELL_FLOOR + 6);
  ctx.lineTo(WELL_RIGHT, WELL_TOP_VISUAL);
  ctx.shadowColor = "rgba(138,99,232,0.5)";
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
}

function drawDangerLine(active, now) {
  const dy = dangerYFor();
  const pulse = active ? 0.5 + 0.5 * Math.sin(now * 14) : 0.35;
  ctx.save();
  ctx.strokeStyle = active ? `rgba(255,91,106,${pulse})` : "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(WELL_LEFT, dy);
  ctx.lineTo(WELL_RIGHT, dy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawStars(now) {
  ctx.save();
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(now * 1.5 + s.seed);
    ctx.globalAlpha = tw * 0.8;
    ctx.fillStyle = "#d8c8ff";
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
  drawSpirit(ctx, aim.x, AIM_Y, aim.r, TIERS[aim.tier], 1);
}

let lastDangerActive = false;

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
    drawSpirit(ctx, p.x, p.y, p.r, TIERS[p.tier], pop);
  }

  for (const pt of particles) {
    const lifeT = 1 - pt.age / pt.life;
    ctx.globalAlpha = Math.max(0, lifeT);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (state === "playing" && !fragmentModalOpen) drawAimGuide();

  ctx.restore();
}

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

  if (state === "playing" && !fragmentModalOpen) {
    accumulator += frameDt;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 8) {
      stepPhysics(FIXED_DT, t);
      accumulator -= FIXED_DT;
      steps++;
    }
    updateParticles(frameDt);
    lastDangerActive = updateDanger(frameDt, t);

    if (floorPending) {
      floorPauseTimer -= frameDt;
      if (floorPauseTimer <= 0) {
        floorPending = false;
        if (pendingFragmentFloor != null) {
          const f = pendingFragmentFloor;
          pendingFragmentFloor = null;
          openFragmentModal(f);
        } else {
          spawnEnemy(floor);
        }
      }
    } else if (enemyHP > 0) {
      atkTimer += frameDt;
      if (atkTimer >= ATTACK_TICK) {
        atkTimer -= ATTACK_TICK;
        const dmg = totalBoardDps();
        if (dmg > 0) {
          enemyHP = Math.max(0, enemyHP - dmg);
          updateEnemyHpBar();
          SFX.attackTick();
          if (enemyHP <= 0) handleFloorCleared(floor);
        }
      }
    }
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
  if (state !== "playing" || fragmentModalOpen || dropCooldown > 0) return;
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
  if (state !== "playing" || fragmentModalOpen) return;
  isPointerDown = true;
  updateAimFromEvent(e);
});
canvas.addEventListener("pointermove", (e) => {
  if (state !== "playing" || fragmentModalOpen) return;
  if (e.pointerType === "mouse" || isPointerDown) updateAimFromEvent(e);
});
window.addEventListener("pointerup", () => {
  if (!isPointerDown) return;
  isPointerDown = false;
  if (state === "playing") dropCurrent();
});
canvas.addEventListener("pointercancel", () => { isPointerDown = false; });

window.addEventListener("keydown", (e) => {
  if (state !== "playing" || fragmentModalOpen) return;
  if (e.code === "ArrowLeft") aim.x = clamp(aim.x - 18, WELL_LEFT + aim.r, WELL_RIGHT - aim.r);
  else if (e.code === "ArrowRight") aim.x = clamp(aim.x + 18, WELL_LEFT + aim.r, WELL_RIGHT - aim.r);
  else if (e.code === "Space" || e.code === "ArrowDown") dropCurrent();
});

/* ===================== Hub (meta-progression) ===================== */
function renderHub() {
  hubShardsEl.textContent = String(save.shards);
  hubBestFloorEl.textContent = String(save.bestFloor);

  upgradeListEl.innerHTML = UPGRADES.map((def) => {
    const level = save.upgrades[def.id] || 0;
    const maxed = level >= def.maxLevel;
    const cost = maxed ? null : upgradeCost(def, level);
    const canAfford = !maxed && save.shards >= cost;
    return `
      <div class="upgrade-card">
        <div class="upgrade-info">
          <div class="upgrade-name">${t(def.nameKey)}</div>
          <div class="upgrade-desc">${t(def.descKey, { n: def.effect(maxed ? level : level + 1) })}</div>
          <div class="upgrade-level">${t("level_label", { n: level, max: def.maxLevel })}</div>
        </div>
        <button class="upgrade-buy-btn${maxed ? " maxed" : ""}" data-upgrade="${def.id}" ${maxed || !canAfford ? "disabled" : ""}>
          ${maxed ? t("maxed_label") : cost}
        </button>
      </div>`;
  }).join("");
}

upgradeListEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".upgrade-buy-btn");
  if (!btn || btn.disabled) return;
  const id = btn.dataset.upgrade;
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return;
  const level = save.upgrades[id] || 0;
  if (level >= def.maxLevel) return;
  const cost = upgradeCost(def, level);
  if (save.shards < cost) return;
  save.shards -= cost;
  save.upgrades[id] = level + 1;
  SFX.upgradeBuy();
  persistSave();
  renderHub();
});

function renderJournal() {
  journalListEl.innerHTML = FRAGMENTS.map((fr) => {
    const unlocked = save.fragments.includes(fr.floor);
    if (!unlocked) return `<div class="journal-item locked">${t("journal_locked")}</div>`;
    return `<div class="journal-item">${fr[currentLang] || fr.ru}</div>`;
  }).join("");
}

/* ===================== Run flow ===================== */
function resetRun() {
  pieces = [];
  particles = [];
  comboCount = 0;
  comboTimer = -10;
  dangerTimer = 0;
  dropCooldown = 0;
  revived = false;
  shakeMag = 0;
  shakeTime = 0;
  shardsThisRun = 0;
  floor = 1;
  floorPending = false;
  pendingFragmentFloor = null;
  fragmentModalOpen = false;
  atkTimer = 0;
  initQueue();
  spawnEnemy(1);
  resyncClock = true;
  accumulator = 0;
}

function beginRun() {
  resetRun();
  setState("playing");
  setPlayingUiVisible(true);
  YSDK.gameplayStart();
}

function triggerRunEnd(forced) {
  if (state !== "playing") return;
  setState("runend");
  setPlayingUiVisible(false);
  YSDK.gameplayStop();
  fleeingForced = forced;

  const prevBest = save.bestFloor;
  save.bestFloor = Math.max(prevBest, floor);
  persistSave();

  if (forced) {
    SFX.overflow();
    shake(20);
  } else {
    SFX.retreat();
  }

  runendTitleEl.textContent = forced ? t("overflow_title") : t("retreat_title");
  runendFloorEl.textContent = String(floor);
  runendShardsEl.textContent = String(shardsThisRun);
  runendBestEl.textContent = floor > prevBest ? t("runend_new_best") : t("runend_best_label", { n: save.bestFloor });

  reviveBtn.classList.toggle("hidden", !forced || revived || !YSDK.isAvailable());
  reviveBtn.disabled = false;
  reviveBtn.textContent = t("revive_btn");
  runendScreen.classList.remove("hidden");
}

function clearOverflow() {
  const sorted = [...pieces].sort((a, b) => a.y - b.y);
  const toRemove = sorted.slice(0, Math.min(4, sorted.length));
  const removeIds = new Set(toRemove.map((p) => p.id));
  pieces = pieces.filter((p) => !removeIds.has(p.id));
  dangerTimer = 0;
}

/* ===================== Screen wiring ===================== */
descendBtn.addEventListener("click", () => {
  SFX.click();
  hubScreen.classList.add("hidden");
  if (localStorage.getItem("keeperAbyss.seenIntro") === "1") {
    beginRun();
  } else {
    introScreen.classList.remove("hidden");
  }
});

howtoBtn.addEventListener("click", () => {
  SFX.click();
  hubScreen.classList.add("hidden");
  introScreen.classList.remove("hidden");
});

introBackBtn.addEventListener("click", () => {
  SFX.click();
  introScreen.classList.add("hidden");
  hubScreen.classList.remove("hidden");
});

startBtn.addEventListener("click", () => {
  SFX.click();
  localStorage.setItem("keeperAbyss.seenIntro", "1");
  introScreen.classList.add("hidden");
  beginRun();
});

journalBtn.addEventListener("click", () => {
  SFX.click();
  renderJournal();
  hubScreen.classList.add("hidden");
  journalScreen.classList.remove("hidden");
});
journalCloseBtn.addEventListener("click", () => {
  SFX.click();
  journalScreen.classList.add("hidden");
  hubScreen.classList.remove("hidden");
});

retreatBtn.addEventListener("click", () => {
  if (state !== "playing" || fragmentModalOpen) return;
  triggerRunEnd(false);
});

reviveBtn.addEventListener("click", async () => {
  reviveBtn.disabled = true;
  reviveBtn.textContent = t("revive_loading");
  const rewarded = await YSDK.showRewarded();
  if (rewarded) {
    revived = true;
    clearOverflow();
    runendScreen.classList.add("hidden");
    setState("playing");
    setPlayingUiVisible(true);
    resyncClock = true;
    accumulator = 0;
    YSDK.gameplayStart();
  } else {
    reviveBtn.textContent = t("revive_unavailable");
    setTimeout(() => {
      reviveBtn.textContent = t("revive_btn");
      reviveBtn.disabled = false;
    }, 1200);
  }
});

tohubBtn.addEventListener("click", () => {
  SFX.click();
  YSDK.showInterstitial();
  runendScreen.classList.add("hidden");
  renderHub();
  hubScreen.classList.remove("hidden");
  setState("hub");
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
  localStorage.setItem("keeperAbyss.muted", muted ? "1" : "0");
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
  SFX.setMuted(localStorage.getItem("keeperAbyss.muted") === "1");
  soundBtn.textContent = SFX.isMuted() ? "🔇" : "🔊";

  applyLanguage(YSDK.getLanguage()); // best-effort guess before the SDK finishes loading

  resize();
  initQueue();
  requestAnimationFrame(loop);

  await YSDK.init();
  save = await YSDK.getSave();
  applyLanguage(YSDK.getLanguage()); // authoritative platform language, once available
  YSDK.gameReady();

  loadingScreen.classList.add("hidden");
  renderHub();
  hubScreen.classList.remove("hidden");
  setState("hub");
}

boot();
