/**
 * Thin wrapper around the Yandex Games SDK (window.YaGames).
 * Works standalone (outside the Yandex Games iframe) by falling back
 * to localStorage + no-ops, so the game is fully playable/testable
 * during development and only "lights up" the platform features
 * (leaderboard, ads, player data) when actually running on Yandex Games.
 */
const YSDK = (() => {
  const LB_NAME = "planetMerge";
  const BEST_KEY = "planetMerge.best";

  let ysdk = null;
  let player = null;
  let ready = false;
  let lastInterstitial = 0;

  async function init() {
    try {
      if (typeof window.YaGames === "undefined") {
        throw new Error("YaGames SDK not present (running outside Yandex Games)");
      }
      ysdk = await window.YaGames.init();
      ready = true;
      try {
        player = await ysdk.getPlayer({ scopes: false });
      } catch (e) {
        player = null; // anonymous / not authorized
      }
    } catch (e) {
      ysdk = null;
      ready = false;
      console.info("[YSDK] Running in standalone mode:", e.message);
    }
    return ready;
  }

  /** Call as soon as the game is interactive (removes the platform loader). */
  function gameReady() {
    try { ysdk?.features?.LoadingAPI?.ready(); } catch (e) {}
  }

  function gameplayStart() {
    try { ysdk?.features?.GameplayAPI?.start(); } catch (e) {}
  }

  function gameplayStop() {
    try { ysdk?.features?.GameplayAPI?.stop(); } catch (e) {}
  }

  async function getBestScore() {
    if (player) {
      try {
        const data = await player.getData(["best"]);
        if (typeof data?.best === "number") return data.best;
      } catch (e) {}
    }
    return Number(localStorage.getItem(BEST_KEY) || 0);
  }

  async function setBestScore(value) {
    localStorage.setItem(BEST_KEY, String(value));
    if (player) {
      try { await player.setData({ best: value }, true); } catch (e) {}
    }
    if (ysdk) {
      try {
        const lb = await ysdk.getLeaderboards();
        await lb.setLeaderboardScore(LB_NAME, value);
      } catch (e) {
        // leaderboard not configured for this game / player not authorized — ignore
      }
    }
  }

  /** Rate-limited fullscreen interstitial, shown between rounds (e.g. on restart). */
  function showInterstitial() {
    if (!ysdk) return;
    const now = Date.now();
    if (now - lastInterstitial < 60000) return; // respect Yandex's spacing guidance
    lastInterstitial = now;
    try { ysdk.adv.showFullscreenAdv({ callbacks: {} }); } catch (e) {}
  }

  /**
   * Rewarded video for the "continue after game over" feature.
   * Resolves true if the reward was actually granted.
   */
  function showRewarded() {
    return new Promise((resolve) => {
      if (!ysdk) {
        resolve(false);
        return;
      }
      let rewarded = false;
      try {
        ysdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => { rewarded = true; },
            onClose: () => resolve(rewarded),
            onError: () => resolve(false),
          },
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  function isAvailable() {
    return !!ysdk;
  }

  /**
   * Interface language reported by the platform (ISO 639-1, e.g. "ru",
   * "en", "tr"), per Yandex Games requirement 2.14 on automatic language
   * detection. Returns null when the SDK isn't present, so the caller can
   * fall back to navigator.language for standalone/off-platform runs.
   */
  function getLang() {
    try {
      return ysdk?.environment?.i18n?.lang || null;
    } catch (e) {
      return null;
    }
  }

  return {
    init,
    gameReady,
    gameplayStart,
    gameplayStop,
    getBestScore,
    setBestScore,
    showInterstitial,
    showRewarded,
    isAvailable,
    getLang,
  };
})();
