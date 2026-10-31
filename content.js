// Плавающая кнопка прямо на странице сайта + переход по команде от иконки расширения.
(() => {
  if (document.getElementById("site-jumper-btn")) return;

  const api = globalThis.browser ?? chrome;
  const SKIP_KEY = "skipConfirm";
  const btnCss = "padding:10px 16px;border:0;border-radius:999px;cursor:pointer;font:600 14px system-ui,sans-serif;";

  const btn = document.createElement("button");
  btn.id = "site-jumper-btn";
  btn.style.cssText = btnCss + "position:fixed;right:20px;bottom:20px;z-index:2147483647;color:#fff;background:#f60;box-shadow:0 4px 14px rgba(0,0,0,.35);";

  const update = () => {
    const result = convertUrl(location.href);
    btn.style.display = result ? "block" : "none";
    btn.textContent = result ? "▶ " + result.label : "";
  };

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
      for (const [text, ok, css] of [["Отмена", false, "background:#ddd;color:#111;"], ["Перейти", true, "background:#f60;color:#fff;"]]) {
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

  async function jump() {
    try {
      const result = convertUrl(location.href);
      if (!result) return;
      const { [SKIP_KEY]: skip } = await api.storage.local.get(SKIP_KEY);
      if (!skip) {
        const { ok, remember } = await askConfirm(result.host);
        if (!ok) return;
        if (remember) await api.storage.local.set({ [SKIP_KEY]: true });
      }
      location.href = result.href;
    } catch (err) {
      console.error("[Site Jumper]", err);
    }
  }

  // Плеер зеркала прямо на странице: блок перед секцией «О фильме».
  // Кинопоиск запрещает чужие фреймы через CSP — её снимает правило из rules.json.
  const EMBED_ID = "site-jumper-embed";

  function findAboutHeading() {
    return [...document.querySelectorAll("h3")].find((h) => /^О (фильме|сериале)$/.test(h.textContent.trim()));
  }

  async function confirmOnce(host) {
    const { [SKIP_KEY]: skip } = await api.storage.local.get(SKIP_KEY);
    if (skip) return true;
    const { ok, remember } = await askConfirm(host);
    if (ok && remember) await api.storage.local.set({ [SKIP_KEY]: true });
    return ok;
  }

  function buildEmbed(result) {
    const box = document.createElement("div");
    box.id = EMBED_ID;
    box.dataset.href = result.href;
    box.style.cssText = "margin:0 0 32px;border-radius:12px;overflow:hidden;background:#111;color:#fff;font:14px system-ui,sans-serif;";
    const start = document.createElement("button");
    start.textContent = "▶ Смотреть здесь (" + result.host + ")";
    start.style.cssText = btnCss + "display:block;width:100%;padding:70px 16px;border-radius:0;background:#222;color:#fff;";
    start.addEventListener("click", async () => {
      try {
        if (!(await confirmOnce(result.host))) return;
        const frame = document.createElement("iframe");
        frame.src = result.href;
        frame.allow = "fullscreen; autoplay; encrypted-media";
        frame.allowFullscreen = true;
        frame.referrerPolicy = "no-referrer";
        frame.style.cssText = "display:block;width:100%;height:480px;border:0;";
        start.replaceWith(frame);
      } catch (err) {
        console.error("[Site Jumper]", err);
      }
    });
    box.appendChild(start);
    return box;
  }

  function syncEmbed() {
    const result = convertUrl(location.href);
    const old = document.getElementById(EMBED_ID);
    if (!result) { old?.remove(); return; }
    if (old && old.dataset.href !== result.href) old.remove(); // другой фильм (SPA)
    else if (old?.isConnected) return;
    const h = findAboutHeading();
    if (!h) return;
    // Секция целиком (заголовок + таблица) — на два уровня выше h3; если она узкая, вставляем рядом с заголовком.
    let anchor = h.parentElement?.parentElement;
    if (!anchor || anchor.getBoundingClientRect().width < 500) anchor = h;
    anchor.parentElement.insertBefore(buildEmbed(result), anchor);
  }

  let embedTimer;
  new MutationObserver(() => {
    clearTimeout(embedTimer);
    embedTimer = setTimeout(syncEmbed, 300);
  }).observe(document.body, { childList: true, subtree: true });

  btn.addEventListener("click", jump);
  api.runtime.onMessage.addListener((msg) => { if (msg?.type === "jump") jump(); });

  document.body.appendChild(btn);
  update();

  // Кинопоиск — SPA: адрес меняется без перезагрузки страницы.
  if (window.navigation) {
    window.navigation.addEventListener("navigatesuccess", update);
  } else {
    let last = location.href;
    setInterval(() => {
      if (location.href !== last) { last = location.href; update(); }
    }, 500);
  }
})();
