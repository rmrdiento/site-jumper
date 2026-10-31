// Плеер зеркала прямо на странице фильма/сериала: блок между обложкой и трейлером, размером с трейлер.
// Кинопоиск запрещает чужие фреймы через CSP — её снимает правило из rules.json.
(() => {
  const api = globalThis.browser ?? chrome;
  const SKIP_KEY = "skipConfirm";
  const EMBED_ID = "site-jumper-embed";
  const btnCss = "padding:10px 16px;border:0;border-radius:999px;cursor:pointer;font:600 14px system-ui,sans-serif;";

  // Своё окно подтверждения: window.confirm() в контент-скриптах ненадёжен (в Firefox может молча не показываться).
  // Возвращает { ok, remember }.
  function askConfirm(host) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);";
      const box = document.createElement("div");
      box.style.cssText = "max-width:380px;padding:20px;border-radius:12px;background:#fff;color:#111;font:14px/1.4 system-ui,sans-serif;";
      box.innerHTML =
        `<p style="margin:0 0 12px">Откроется сторонний сайт <b></b>: там возможна реклама. Продолжить?</p>` +
        `<label style="display:block;margin-bottom:14px"><input type="checkbox"> Больше не спрашивать</label>` +
        `<div style="display:flex;gap:8px;justify-content:flex-end"></div>`;
      box.querySelector("b").textContent = host;
      const remember = box.querySelector("input");
      const row = box.querySelector("div");
      const done = (ok) => { overlay.remove(); resolve({ ok, remember: remember.checked }); };
      for (const [text, ok, css] of [["Отмена", false, "background:#ddd;color:#111;"], ["Продолжить", true, "background:#f60;color:#fff;"]]) {
        const b = document.createElement("button");
        b.textContent = text;
        b.style.cssText = btnCss + css;
        b.addEventListener("click", () => done(ok));
        row.appendChild(b);
      }
      overlay.addEventListener("click", (e) => { if (e.target === overlay) done(false); });
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  }

  async function confirmOnce(host) {
    const { [SKIP_KEY]: skip } = await api.storage.local.get(SKIP_KEY);
    if (skip) return true;
    const { ok, remember } = await askConfirm(host);
    if (ok && remember) await api.storage.local.set({ [SKIP_KEY]: true });
    return ok;
  }

  // Класс .film-trailer стабильный, остальные классы Кинопоиска содержат хеши и меняются.
  const findTrailer = () => {
    const trailer = document.querySelector(".film-trailer");
    return trailer?.closest("aside") ?? trailer;
  };

  // Адрес без трекинг-параметров Кинопоиска (utm_referrer, socialAlias).
  const cleanUrl = (href) => {
    const url = new URL(href);
    url.search = "";
    url.hash = "";
    return url.toString();
  };

  function buildEmbed(result) {
    const box = document.createElement("div");
    box.id = EMBED_ID;
    box.dataset.href = result.href;
    box.style.cssText = "width:100%;margin:0 0 16px;border-radius:8px;overflow:hidden;background:#111;";

    const start = document.createElement("button");
    start.textContent = "▶ Смотреть здесь";
    start.style.cssText = btnCss + "display:block;width:100%;height:100%;border-radius:0;background:#222;color:#fff;";
    start.addEventListener("click", async () => {
      try {
        if (!(await confirmOnce(result.host))) return;
        const frame = document.createElement("iframe");
        frame.src = cleanUrl(result.href);
        // "*": зеркало перенаправляет на другие домены, а голое "fullscreen" действует только на домен из src.
        frame.allow = "fullscreen *; autoplay *; encrypted-media *; picture-in-picture *";
        frame.allowFullscreen = true;
        frame.referrerPolicy = "no-referrer";
        frame.style.cssText = "display:block;width:100%;height:100%;border:0;";
        start.replaceWith(frame);
      } catch (err) {
        console.error("[Site Jumper]", err);
      }
    });
    box.appendChild(start);
    return box;
  }

  function sync() {
    let box = document.getElementById(EMBED_ID);
    const result = convertUrl(location.href);
    if (!result) { box?.remove(); return; }

    const trailer = findTrailer();
    if (!trailer) return; // страница ещё рисуется: повторим на следующей мутации

    if (box && box.dataset.href !== result.href) { box.remove(); box = null; } // другой фильм (SPA)
    box ??= buildEmbed(result);
    if (box.nextElementSibling !== trailer) trailer.before(box);
    box.style.height = trailer.offsetHeight + "px"; // размер как у трейлера
  }

  // Кинопоиск — SPA: React перерисовывает страницу и меняет адрес без перезагрузки.
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  sync();
})();
