(() => {
  "use strict";

  const HISTORY_URL = "/music-history";

  const HIDDEN_NAV_ITEMS = [
    "NAVBAR_NAVIGATION_ITEM_CONCERTS",
    "NAVBAR_NAVIGATION_ITEM_NON_MUSIC",
    "NAVBAR_NAVIGATION_ITEM_PLUS"
  ];

  /* Блоки, которые точно не нужны в «Для вас» и «Трендах». */
  const HIDDEN_FEED_BLOCKS = [
    "CONCERTS_PERSONAL",
    "SMART_OPEN_PLAYLIST",
    "DONATIONS",
    "RECOMMENDED_PLAYLISTS"
  ];

  let scheduled = false;

  const $all = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const addClass = (element, className) => {
    if (element && !element.classList.contains(className)) {
      element.classList.add(className);
    }
  };

  /* ---------------- Боковое меню ---------------- */

  function hideExtraNavigation() {
    HIDDEN_NAV_ITEMS.forEach((id) => {
      $all(`[data-test-id="${id}"]`).forEach((link) => {
        addClass(link.closest("li") || link, "yfm-nav-hidden");
      });
    });
  }

  /* ---------------- Мобильное промо приложения ---------------- */

  const MOBILE_APP_PROMO_TEXTS = [
    "слушать в приложении",
    "скачать в google play",
    "скачать в app store"
  ];

  function hideMobileAppPromo() {
    $all('button[role="link"]').forEach((button) => {
      const text = normalizeText(button.textContent);
      const isPromo = MOBILE_APP_PROMO_TEXTS.some((part) =>
        text.includes(part)
      );

      if (!isPromo) {
        return;
      }

      const block =
        button.closest('[class*="DeeplinkAndOnelinkContainer_root"]') ||
        button.parentElement;

      addClass(block || button, "yfm-app-promo-hidden");
    });
  }

  /* ---------------- «Для вас» и «Тренды» ---------------- */

  function isFeedPage(panel) {
    return Boolean(
      document.querySelector('[data-test-id="LANDING_PAGE"]') ||
      panel?.querySelector('[data-test-id="PERSONAL_PLAYLISTS"]')
    );
  }

  function hideFeedBlock(element) {
    addClass(element, "yfm-block-hidden");

    const wrapper = element.closest("[data-index]");
    if (
      wrapper &&
      !wrapper.querySelector('[data-test-id="PERSONAL_PLAYLISTS"]') &&
      wrapper !== element
    ) {
      addClass(wrapper, "yfm-block-hidden");
    }
  }

  function addHistoryLink(landing) {
    if (!landing || landing.querySelector(".yfm-history-link")) {
      return;
    }

    const header =
      landing.querySelector('[data-test-id="COMPOSITE_HEADER_CONTAINER"]') ||
      landing.querySelector(".LandingPage_header__TiraG") ||
      landing.querySelector('[data-test-id="LANDING_PAGE_HEADER"]')?.parentElement;

    if (!header) {
      return;
    }

    const link = document.createElement("a");
    link.className = "yfm-history-link";
    link.href = HISTORY_URL;
    link.textContent = "История треков";
    link.setAttribute("data-yfm-injected", "1");

    header.insertAdjacentElement("afterend", link);
  }

  function cleanFeed() {
    const landing = document.querySelector('[data-test-id="LANDING_PAGE"]');
    const panel =
      landing?.querySelector('[role="tabpanel"]') ||
      document.querySelector('[role="tabpanel"]');

    if (!isFeedPage(panel)) {
      document.documentElement.classList.remove("yfm-feed");
      return;
    }

    document.documentElement.classList.add("yfm-feed");

    if (panel) {
      /* Все блоки-секции, кроме «Настроили для вас». */
      $all("section[data-test-id]", panel).forEach((section) => {
        const id = section.getAttribute("data-test-id");

        if (id === "PERSONAL_PLAYLISTS") {
          section.classList.remove("yfm-block-hidden");
          section
            .closest("[data-index]")
            ?.classList.remove("yfm-block-hidden");
          return;
        }

        hideFeedBlock(section);
      });

      /* Известные блоки на случай, если они отрисованы не как <section>. */
      HIDDEN_FEED_BLOCKS.forEach((id) => {
        $all(`[data-test-id="${id}"]`, panel).forEach((block) => {
          hideFeedBlock(block);
        });
      });
    }

    addHistoryLink(landing);
  }

  /* ---------------- «Моя волна» ---------------- */

  const normalizeText = (text) =>
    (text || "").replace(/\s+/g, " ").trim().toLowerCase();

  const isBackToUsual = (element) =>
    normalizeText(element?.textContent).includes("назад к привычному");

  const WHEEL_SELECTOR =
    '[data-test-id="WHEEL_DESKTOP"], [data-test-id="WHEEL_MOBILE"]';

  /*
   * Колесо Swiper не перестраиваем: оно лежит в панели с фиксированной
   * высотой, и любые изменения его разметки/размеров ломают раскладку всей
   * страницы. Вместо этого оставляем оригинальные кнопки в DOM (они скрыты
   * стилями), а поверх колеса показываем свою панель. Нажатие на нашу кнопку
   * пробрасывается в настоящую кнопку, поэтому обработчики React работают.
   */
  function findWheelControls(wheel) {
    const setting = wheel.querySelector(
      '[data-test-id="WHEEL_SETTING_ITEM"]'
    );
    const reshuffles = $all(
      '[data-test-id="WHEEL_RESHUFFLE_ITEM"]',
      wheel
    );
    const reshuffle =
      reshuffles.find(isBackToUsual) || reshuffles[0] || null;

    return { setting, reshuffle };
  }

  /* Не даём Swiper перехватывать колесо мыши: страница должна скроллиться
     как обычно. preventDefault не вызываем, поэтому прокрутка сохраняется. */
  function disableWheelHijack(wheel) {
    /* Если у Swiper есть доступный экземпляр, выключаем модуль mousewheel. */
    const instance = wheel.swiper || wheel.__swiper__;
    instance?.mousewheel?.disable?.();

    if (wheel.dataset.yfmWheelGuard) {
      return;
    }

    wheel.dataset.yfmWheelGuard = "1";
    wheel.addEventListener(
      "wheel",
      (event) => event.stopImmediatePropagation(),
      { capture: true, passive: true }
    );
  }

  function createActionButton(label, original) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;

    /* Swiper слушает нажатия на своём корне; не даём ему принять нажатие
       по нашей кнопке за начало свайпа. */
    ["pointerdown", "mousedown", "touchstart"].forEach((type) => {
      button.addEventListener(type, (event) => event.stopPropagation());
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      original.click();
    });
    return button;
  }

  function labelOf(element) {
    return (
      element.getAttribute("aria-label") ||
      element.textContent ||
      ""
    ).trim();
  }

  function renderWheelActions(wheel, controls) {
    let panel = wheel.querySelector(".yfm-wave-actions");

    if (
      panel &&
      panel.yfmSetting === controls.setting &&
      panel.yfmReshuffle === controls.reshuffle
    ) {
      return;
    }

    panel?.remove();

    panel = document.createElement("div");
    panel.className = "yfm-wave-actions";
    panel.setAttribute("data-yfm-injected", "1");

    if (controls.setting) {
      panel.append(
        createActionButton(labelOf(controls.setting), controls.setting)
      );
    }

    if (controls.reshuffle) {
      panel.append(
        createActionButton(labelOf(controls.reshuffle), controls.reshuffle)
      );
    }

    /* Ссылки на настоящие кнопки: если React их пересоздаст, панель
       перестроится при следующем проходе. */
    panel.yfmSetting = controls.setting;
    panel.yfmReshuffle = controls.reshuffle;

    wheel.append(panel);
  }

  function cleanVibeWheel() {
    const wheel = document.querySelector(WHEEL_SELECTOR);

    if (!wheel) {
      document.documentElement.classList.remove("yfm-wave");
      return;
    }

    const controls = findWheelControls(wheel);

    if (!controls.setting && !controls.reshuffle) {
      document.documentElement.classList.remove("yfm-wave");
      return;
    }

    document.documentElement.classList.add("yfm-wave");
    disableWheelHijack(wheel);
    renderWheelActions(wheel, controls);
  }

  /* ---------------- Запуск ---------------- */

  function processPage() {
    hideExtraNavigation();
    hideMobileAppPromo();
    cleanFeed();
    cleanVibeWheel();
  }

  function scheduleProcess() {
    if (scheduled) {
      return;
    }

    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      processPage();
    }, 120);
  }

  function start() {
    if (!document.body) {
      window.setTimeout(start, 50);
      return;
    }

    const observer = new MutationObserver(scheduleProcess);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("popstate", scheduleProcess);

    processPage();

    /* Страховка на случай, если React перерисует классы элементов. */
    window.setInterval(processPage, 2500);
  }

  start();
})();
