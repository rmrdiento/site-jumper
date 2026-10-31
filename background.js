// Запрос списка плееров идёт отсюда: у content script на странице Кинопоиска действует CORS, а у фонового скрипта — права из host_permissions.
const api = globalThis.browser ?? chrome;
const PLAYERS_API = "https://fbphdplay.top/api/players";

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "players" || !/^\d+$/.test(String(msg.id))) return;
  fetch(`${PLAYERS_API}?kinopoisk=${msg.id}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
    .then((json) => sendResponse({ json }))
    .catch((err) => sendResponse({ error: String(err.message ?? err) }));
  return true; // ответ асинхронный
});
