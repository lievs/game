"use strict";

/**
 * Minimal i18n layer driven by the Yandex Games SDK's automatic language
 * detection (`ysdk.environment.i18n.lang`), per platform requirement 2.14.
 *
 * Yandex's own guidance for the minimum viable localization set is: serve
 * Russian for the RU-family locales the platform reports (ru, be, kk, uk,
 * uz) and English for everything else. We never ask the player to pick a
 * language — it's always taken from the SDK (with navigator.language as a
 * same-mapping fallback for the brief window before the SDK responds, and
 * for standalone/off-platform testing where there is no SDK at all).
 */
const I18N = (() => {
  const STRINGS = {
    ru: {
      loading_title: "Слияние планет",
      loading_sub: "Загрузка космоса…",
      score_label: "Счёт",
      best_label: "Рекорд",
      sound_label: "Звук",
      next_label: "Далее",
      intro_title: "Слияние планет",
      intro_p1: "Роняй небесные тела и соединяй одинаковые — они превратятся в объект покрупнее.",
      intro_p2: "Дойди до Чёрной дыры и не дай башне переполниться!",
      start_btn: "Играть",
      gameover_title: "Коллапс!",
      your_score: "Ваш счёт",
      new_record: "Новый рекорд!",
      record_x: "Рекорд: {n}",
      revive_btn: "▶ Посмотреть рекламу и продолжить",
      revive_loading: "Загрузка…",
      revive_unavailable: "Реклама недоступна",
      restart_btn: "Ещё раз",
      pause_title: "Пауза",
      resume_btn: "Продолжить",
      combo_x: "Комбо x{n}!",
    },
    en: {
      loading_title: "Planet Merge",
      loading_sub: "Loading the cosmos…",
      score_label: "Score",
      best_label: "Best",
      sound_label: "Sound",
      next_label: "Next",
      intro_title: "Planet Merge",
      intro_p1: "Drop celestial bodies and merge matching ones — they'll turn into something bigger.",
      intro_p2: "Reach the Black Hole and don't let the well overflow!",
      start_btn: "Play",
      gameover_title: "Collapse!",
      your_score: "Your score",
      new_record: "New record!",
      record_x: "Best: {n}",
      revive_btn: "▶ Watch an ad to continue",
      revive_loading: "Loading…",
      revive_unavailable: "Ad unavailable",
      restart_btn: "Play again",
      pause_title: "Paused",
      resume_btn: "Resume",
      combo_x: "Combo x{n}!",
    },
  };

  // Locales Yandex Games reports whose interface bucket is Russian.
  const RU_FAMILY = new Set(["ru", "be", "kk", "uk", "uz"]);

  let lang = "ru";

  function normalize(code) {
    const short = String(code || "").toLowerCase().split("-")[0];
    return RU_FAMILY.has(short) ? "ru" : "en";
  }

  function setLang(code) {
    lang = normalize(code);
    document.documentElement.lang = lang;
    return lang;
  }

  function getLang() {
    return lang;
  }

  function t(key, vars) {
    const dict = STRINGS[lang] || STRINGS.ru;
    let str = dict[key] ?? STRINGS.ru[key] ?? key;
    if (vars) {
      for (const k in vars) str = str.replace(`{${k}}`, vars[k]);
    }
    return str;
  }

  function applyToDOM(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.getAttribute("data-i18n-attr").split(",").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        el.setAttribute(attr, t(key));
      });
    });
  }

  return { setLang, getLang, t, applyToDOM, normalize };
})();
