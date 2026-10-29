// Правила переноса: заменяем домен `from` на `to`, путь и параметры сохраняются.
// `paths` — на каких страницах правило действует (страницы фильмов и сериалов).
// Чтобы добавить новый сайт — добавьте правило сюда и его адрес в "matches" в manifest.json.
const SITE_RULES = [
  { from: "kinopoisk.ru", to: "kinopoisk.me", label: "Смотреть", paths: [/^\/(film|series)\/\d+/] },
];

function convertUrl(href) {
  let url;
  try { url = new URL(href); } catch { return null; }
  for (const rule of SITE_RULES) {
    const onSite = url.hostname === rule.from || url.hostname.endsWith("." + rule.from);
    if (!onSite || !rule.paths.some((p) => p.test(url.pathname))) continue;
    url.hostname = url.hostname.slice(0, -rule.from.length) + rule.to;
    return { href: url.toString(), label: rule.label, host: rule.to };
  }
  return null;
}

if (typeof module !== "undefined") module.exports = { convertUrl, SITE_RULES };
