// Плееры берём из того же API Kinobox, что использует зеркало (его kinobox.js ходит на /api/players?kinopoisk=ID).
// Чтобы сменить источник — поправьте PLAYERS_API здесь и хост в "host_permissions" в manifest.json.
const PLAYERS_API = "https://fbphdplay.top/api/players";

// Страницы фильмов и сериалов Кинопоиска: возвращает числовой id или null.
function filmId(href) {
  let url;
  try { url = new URL(href); } catch { return null; }
  const onSite = url.hostname === "kinopoisk.ru" || url.hostname.endsWith(".kinopoisk.ru");
  const m = onSite && /^\/(?:film|series)\/(\d+)/.exec(url.pathname);
  return m ? m[1] : null;
}

const isHttps = (u) => {
  try { return new URL(u).protocol === "https:"; } catch { return false; }
};

// Ответ API → список плееров для выбора. Подпись пункта — как в меню зеркала: «1 :: Дублированный (BDRip)»
// (название и качество берутся у первой озвучки). В iframe попадают только https-адреса.
function normalizePlayers(json) {
  const list = Array.isArray(json?.data) ? json.data : [];
  const players = [];
  for (const p of list) {
    if (!p || !isHttps(p.iframeUrl)) continue;
    const translations = (Array.isArray(p.translations) ? p.translations : [])
      .map((t) => ({ name: t?.name || "Не указано", quality: t?.quality || "-", url: isHttps(t?.iframeUrl) ? t.iframeUrl : p.iframeUrl }));
    const first = translations[0] ?? { name: "Не указано", quality: "-" };
    players.push({
      type: String(p.type ?? ""),
      url: p.iframeUrl,
      label: `${players.length + 1} :: ${first.name} (${first.quality})`,
      // Озвучки показываем, только если у них разные адреса; иначе (Veoveo, Collaps) озвучка выбирается внутри самого плеера.
      translations: new Set(translations.map((t) => t.url)).size > 1 ? translations : [],
    });
  }
  return players;
}

if (typeof module !== "undefined") module.exports = { filmId, normalizePlayers, PLAYERS_API };
