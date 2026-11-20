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

  const isBackToUsual = (slide) =>
    normalizeText(slide.textContent).includes("назад к привычному");

  function cleanVibeWheel() {
    let waveActive = false;

    $all(
      '[data-test-id="WHEEL_DESKTOP"], [data-test-id="WHEEL_MOBILE"]'
    ).forEach((wheel) => {
      const slides = $all(
        '[data-test-id="WHEEL_DESKTOP_SLIDE"], [data-test-id="WHEEL_MOBILE_SLIDE"]',
        wheel
      );

      if (!slides.length) {
        return;
      }

      const hasControls = slides.some(
        (slide) =>
          slide.querySelector('[data-test-id="WHEEL_SETTING_ITEM"]') ||
          slide.querySelector('[data-test-id="WHEEL_RESHUFFLE_ITEM"]')
      );

      if (!hasControls) {
        return;
      }

      waveActive = true;
      document.documentElement.classList.add("yfm-wave");

      const hasBackToUsual = slides.some(
        (slide) =>
          slide.querySelector('[data-test-id="WHEEL_RESHUFFLE_ITEM"]') &&
          isBackToUsual(slide)
      );

      let settingKept = false;
      let backKept = false;
      let reshuffleKept = false;

      slides.forEach((slide) => {
        const setting = slide.querySelector(
          '[data-test-id="WHEEL_SETTING_ITEM"]'
        );
        const reshuffle = slide.querySelector(
          '[data-test-id="WHEEL_RESHUFFLE_ITEM"]'
        );

        let keep = false;

        if (setting) {
          if (!settingKept) {
            keep = true;
            settingKept = true;
          }
        } else if (reshuffle) {
          if (hasBackToUsual) {
            if (isBackToUsual(slide) && !backKept) {
              keep = true;
              backKept = true;
            }
          } else if (!reshuffleKept) {
            keep = true;
            reshuffleKept = true;
          }
        }

        slide.classList.toggle("yfm-wheel-keep", keep);
        slide.classList.toggle("yfm-wheel-hidden", !keep);
        if (!keep) {
          slide.classList.remove("yfm-wheel-keep");
        }
      });

      wheel.classList.add("yfm-wheel-cleaned");
      wheel.parentElement?.classList.add("yfm-wheel-parent");
    });

    if (!waveActive) {
      document.documentElement.classList.remove("yfm-wave");
    }
  }

  /* ---------------- Запуск ---------------- */

  function processPage() {
    hideExtraNavigation();
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
