/**
 * Thin wrapper around the Yandex Games SDK (window.YaGames).
 * Works standalone (outside the Yandex Games iframe) by falling back
 * to localStorage + no-ops, so the game is fully playable/testable
 * during development and only "lights up" the platform features
 * (leaderboard, ads, player data) when actually running on Yandex Games.
 *
 * Unlike Planet Merge's best-score, this game persists a whole save
 * blob (shards, permanent upgrade levels, unlocked lore fragments,
 * best floor reached) as one JSON object under a single player-data key.
 */
const YSDK = (() => {
  const LB_NAME = "keeperAbyssBestFloor";
  const SAVE_KEY = "keeperAbyss.save";

  const DEFAULT_SAVE = () => ({
    shards: 0,
    bestFloor: 0,
    upgrades: { startRank: 0, wellCap: 0, resonance: 0, generosity: 0 },
    fragments: [],
  });

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

  function gameReady() {
    try { ysdk?.features?.LoadingAPI?.ready(); } catch (e) {}
  }

  function gameplayStart() {
    try { ysdk?.features?.GameplayAPI?.start(); } catch (e) {}
  }

  function gameplayStop() {
    try { ysdk?.features?.GameplayAPI?.stop(); } catch (e) {}
  }

  function readLocalSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return DEFAULT_SAVE();
      return { ...DEFAULT_SAVE(), ...JSON.parse(raw) };
    } catch (e) {
      return DEFAULT_SAVE();
    }
  }

  function writeLocalSave(save) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  async function getSave() {
    if (player) {
      try {
        const data = await player.getData(["save"]);
        if (data?.save) return { ...DEFAULT_SAVE(), ...data.save };
      } catch (e) {}
    }
    return readLocalSave();
  }

  /** Persists the whole save blob both locally and (if available) to the cloud. */
  async function setSave(save) {
    writeLocalSave(save);
    if (player) {
      try { await player.setData({ save }, true); } catch (e) {}
    }
    if (ysdk && save.bestFloor > 0) {
      try {
        const lb = await ysdk.getLeaderboards();
        await lb.setLeaderboardScore(LB_NAME, save.bestFloor);
      } catch (e) {
        // leaderboard not configured for this game / player not authorized — ignore
      }
    }
  }

  /** Rate-limited fullscreen interstitial, shown when returning to the hub after a run. */
  function showInterstitial() {
    if (!ysdk) return;
    const now = Date.now();
    if (now - lastInterstitial < 60000) return; // respect Yandex's spacing guidance
    lastInterstitial = now;
    try { ysdk.adv.showFullscreenAdv({ callbacks: {} }); } catch (e) {}
  }

  /**
   * Rewarded video for the "second wind" (continue on overflow) feature.
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
   * Player's language per Yandex Games platform requirements (§2.14): the
   * game must detect locale via the SDK, not hardcode one. Returns an
   * ISO 639-1 code (e.g. "ru", "en", "tr"). Falls back to the browser
   * locale when running outside the Yandex Games iframe.
   */
  function getLanguage() {
    try {
      const lang = ysdk?.environment?.i18n?.lang;
      if (lang) return lang;
    } catch (e) {}
    try {
      const browserLang = navigator.language || navigator.userLanguage || "en";
      return browserLang.split("-")[0];
    } catch (e) {
      return "en";
    }
  }

  return {
    init,
    gameReady,
    gameplayStart,
    gameplayStop,
    getSave,
    setSave,
    showInterstitial,
    showRewarded,
    isAvailable,
    getLanguage,
  };
})();
