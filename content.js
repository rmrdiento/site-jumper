// Плееры прямо на странице фильма/сериала: блок над заголовком фильма, 582×280 на экране 1920 px.
// Список плееров — из API Kinobox (как на зеркале), выбор плеера и озвучки — своя панель. Кинопоиск запрещает чужие фреймы через CSP — её снимает правило из rules.json.
(() => {
  const api = globalThis.browser ?? chrome;
  const SKIP_KEY = "skipConfirm";
  const EMBED_ID = "site-jumper-embed";
  const btnCss = "padding:10px 16px;border:0;border-radius:999px;cursor:pointer;font:600 14px system-ui,sans-serif;";

  // Своё окно подтверждения: window.confirm() в контент-скриптах ненадёжен (в Firefox может молча не показываться).
  // Возвращает { ok, remember }.
  function askConfirm() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);";
      const box = document.createElement("div");
      box.style.cssText = "max-width:380px;padding:20px;border-radius:12px;background:#fff;color:#111;font:14px/1.4 system-ui,sans-serif;";
      box.innerHTML =
        `<p style="margin:0 0 12px">Плееры загружаются со сторонних сайтов: там возможна реклама. Продолжить?</p>` +
        `<label style="display:block;margin-bottom:14px"><input type="checkbox"> Больше не спрашивать</label>` +
        `<div style="display:flex;gap:8px;justify-content:flex-end"></div>`;
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

  async function confirmOnce() {
    const { [SKIP_KEY]: skip } = await api.storage.local.get(SKIP_KEY);
    if (skip) return true;
    const { ok, remember } = await askConfirm();
    if (ok && remember) await api.storage.local.set({ [SKIP_KEY]: true });
    return ok;
  }

  // Заголовок — h1[itemprop=name] (классы Кинопоиска с хешами меняются, itemprop стабильный). Блок ставим перед его обёрткой,
  // т.е. над заголовком в той же колонке. Второй h1 на странице — окно cookie, поэтому ищем по itemprop.
  const findTitle = () => document.querySelector('h1[itemprop="name"]')?.parentElement;

  const selectCss = "flex:1;min-width:0;height:32px;padding:0 8px;border:0;border-radius:6px;background:#333;color:#fff;font:13px system-ui,sans-serif;";
  const PLAYER_KEY = "lastPlayer";

  // Список плееров запрашивает background.js (у content script на странице действует CORS).
  async function loadPlayers(id) {
    const res = await api.runtime.sendMessage({ type: "players", id });
    if (!res || res.error) throw new Error(res?.error ?? "нет ответа от фонового скрипта");
    return normalizePlayers(res.json);
  }

  function makeFrame(src) {
    const frame = document.createElement("iframe");
    frame.src = src;
    // "*": плееры перенаправляют на другие домены, а голое "fullscreen" действует только на домен из src.
    frame.allow = "fullscreen *; autoplay *; encrypted-media *; picture-in-picture *";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "origin"; // без Referer Alloha и др. отвечают «Ошибка!»; "origin" отдаёт только https://www.kinopoisk.ru/
    frame.style.cssText = "display:block;flex:1;min-height:0;width:100%;border:0;";
    return frame;
  }

  const makeSelect = (items) => {
    const sel = document.createElement("select");
    sel.style.cssText = selectCss;
    items.forEach((text, i) => sel.add(new Option(text, i)));
    return sel;
  };

  // Панель выбора (плеер + озвучка) над iframe.
  async function showPlayers(box, start, id) {
    const players = await loadPlayers(id);
    if (!players.length) { start.textContent = "Плееры не найдены"; return; }

    const { [PLAYER_KEY]: last } = await api.storage.local.get(PLAYER_KEY);
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:8px;padding:6px;background:#1b1b1b;";
    const playerSel = makeSelect(players.map((p) => p.label));
    const voiceSel = makeSelect([]);
    bar.append(playerSel, voiceSel);

    let frame = null;
    const load = (url) => {
      const next = makeFrame(url);
      (frame ?? start).replaceWith(next);
      frame = next;
    };
    const fillVoices = () => {
      const p = players[playerSel.value];
      voiceSel.replaceChildren(...p.translations.map((t, i) => new Option(`${t.name} (${t.quality})`, i)));
      voiceSel.hidden = !p.translations.length;
    };
    playerSel.addEventListener("change", () => {
      const p = players[playerSel.value];
      fillVoices();
      load(p.url);
      api.storage.local.set({ [PLAYER_KEY]: p.type });
    });
    voiceSel.addEventListener("change", () => load(players[playerSel.value].translations[voiceSel.value].url));

    const startIndex = Math.max(0, players.findIndex((p) => p.type === last));
    playerSel.value = startIndex;
    fillVoices();
    box.prepend(bar);
    load(players[startIndex].url);
  }

  function buildEmbed(id) {
    const box = document.createElement("div");
    box.id = EMBED_ID;
    box.dataset.id = id;
    box.style.cssText = "display:flex;flex-direction:column;width:100%;max-width:582px;aspect-ratio:582/280;margin:0 0 16px;border-radius:8px;overflow:hidden;background:#111;";

    const start = document.createElement("button");
    start.textContent = "▶ Смотреть здесь";
    start.style.cssText = btnCss + "flex:1;width:100%;border-radius:0;background:#222;color:#fff;";
    start.addEventListener("click", async () => {
      try {
        if (!(await confirmOnce())) return;
        start.textContent = "Загрузка плееров…";
        await showPlayers(box, start, id);
      } catch (err) {
        console.error("[Site Jumper]", err);
        start.textContent = "Не удалось загрузить плееры — нажмите, чтобы повторить";
      }
    });
    box.appendChild(start);
    return box;
  }

  function sync() {
    let box = document.getElementById(EMBED_ID);
    const id = filmId(location.href);
    if (!id) { box?.remove(); return; }

    const title = findTitle();
    if (!title) return; // страница ещё рисуется: повторим на следующей мутации

    if (box && box.dataset.id !== id) { box.remove(); box = null; } // другой фильм (SPA)
    box ??= buildEmbed(id);
    if (box.nextElementSibling !== title) title.before(box);
  }

  // Кинопоиск — SPA: React перерисовывает страницу и меняет адрес без перезагрузки.
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  sync();
})();
