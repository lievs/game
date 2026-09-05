/**
 * Tiny synthesized sound-effects engine (WebAudio oscillators/noise).
 * No external audio files — keeps the game a single self-contained bundle.
 * Extends Planet Merge's approach with combat/floor cues (attack tick,
 * floor clear, boss sting, lore-fragment chime).
 */
const SFX = (() => {
  let ctx = null;
  let muted = false;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, duration = 0.15, type = "sine", volume = 0.2, slideTo = null, delay = 0 }) {
    if (muted) return;
    const c = ensureCtx();
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noiseBurst({ duration = 0.3, volume = 0.18, delay = 0 }) {
    if (muted) return;
    const c = ensureCtx();
    const bufferSize = Math.floor(c.sampleRate * duration);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + duration);
    src.connect(gain).connect(c.destination);
    src.start(c.currentTime + delay);
  }

  return {
    setMuted(v) { muted = v; },
    isMuted() { return muted; },
    drop() {
      tone({ freq: 260, slideTo: 180, duration: 0.12, type: "triangle", volume: 0.12 });
    },
    merge(tierIndex = 0) {
      const base = 220 + tierIndex * 40;
      tone({ freq: base, slideTo: base * 2.2, duration: 0.22, type: "sine", volume: 0.22 });
      tone({ freq: base * 1.5, slideTo: base * 2.8, duration: 0.18, type: "triangle", volume: 0.12, delay: 0.03 });
    },
    wallBonk() {
      tone({ freq: 120, duration: 0.06, type: "square", volume: 0.05 });
    },
    combo(step = 1) {
      tone({ freq: 500 + step * 60, duration: 0.14, type: "square", volume: 0.14 });
    },
    attackTick() {
      tone({ freq: 180, slideTo: 140, duration: 0.08, type: "sawtooth", volume: 0.05 });
    },
    floorClear() {
      tone({ freq: 440, duration: 0.16, type: "triangle", volume: 0.18 });
      tone({ freq: 587, duration: 0.16, type: "triangle", volume: 0.18, delay: 0.11 });
      tone({ freq: 880, duration: 0.28, type: "triangle", volume: 0.2, delay: 0.22 });
    },
    bossAppear() {
      tone({ freq: 90, duration: 0.7, type: "sawtooth", volume: 0.22 });
      noiseBurst({ duration: 0.5, volume: 0.12, delay: 0.05 });
    },
    fragmentUnlock() {
      tone({ freq: 660, duration: 0.2, type: "sine", volume: 0.16 });
      tone({ freq: 990, duration: 0.35, type: "sine", volume: 0.14, delay: 0.14 });
    },
    overflow() {
      tone({ freq: 300, slideTo: 60, duration: 0.9, type: "sawtooth", volume: 0.18 });
      noiseBurst({ duration: 0.6, volume: 0.15, delay: 0.05 });
    },
    retreat() {
      tone({ freq: 320, slideTo: 200, duration: 0.4, type: "triangle", volume: 0.14 });
    },
    resonance() {
      noiseBurst({ duration: 1.1, volume: 0.28 });
      tone({ freq: 90, slideTo: 30, duration: 1.0, type: "sine", volume: 0.3 });
    },
    upgradeBuy() {
      tone({ freq: 520, duration: 0.1, type: "square", volume: 0.14 });
      tone({ freq: 780, duration: 0.12, type: "square", volume: 0.1, delay: 0.08 });
    },
    click() {
      tone({ freq: 700, duration: 0.05, type: "square", volume: 0.08 });
    },
  };
})();
