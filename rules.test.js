const test = require("node:test");
const assert = require("node:assert/strict");
const { filmId, normalizePlayers } = require("./rules.js");

test("id фильма и сериала", () => {
  assert.equal(filmId("https://www.kinopoisk.ru/film/705356/?socialAlias=x#cast"), "705356");
  assert.equal(filmId("https://kinopoisk.ru/series/123/"), "123");
  assert.equal(filmId("https://hd.kinopoisk.ru/film/1/"), "1");
});

test("не страницы фильма и чужие домены", () => {
  for (const u of ["https://www.kinopoisk.ru/", "https://www.kinopoisk.ru/film/", "https://www.kinopoisk.ru/user/1/",
    "https://example.com/film/1/", "https://notkinopoisk.ru/film/1/", "https://kinopoisk.ru.evil.com/film/1/",
    "https://www.kinopoisk.me/film/1/", "not a url", ""]) assert.equal(filmId(u), null, u);
});

const sample = {
  data: [
    { type: "Alloha", iframeUrl: "https://a.example/?m=1", translations: [
      { name: "Дублированный", quality: "BDRip", iframeUrl: "https://a.example/?m=1&t=66" },
      { name: "ОРТ", quality: "BDRip", iframeUrl: "https://a.example/?m=1&t=211" }] },
    { type: "Dead", iframeUrl: null, translations: [] },
    { type: "Turbo", iframeUrl: "https://t.example/e", translations: [{ name: null, quality: null, iframeUrl: "https://t.example/e" }] },
    { type: "Evil", iframeUrl: "javascript:alert(1)", translations: [] },
  ],
};

test("подписи как в меню зеркала, без плееров без ссылки и не-https", () => {
  const p = normalizePlayers(sample);
  assert.deepEqual(p.map((x) => x.label), ["1 :: Дублированный (BDRip)", "2 :: Не указано (-)"]);
  assert.deepEqual(p.map((x) => x.type), ["Alloha", "Turbo"]);
});

test("озвучки: только если их больше одной, у каждой своя ссылка", () => {
  const [a, t] = normalizePlayers(sample);
  assert.equal(a.translations.length, 2);
  assert.equal(a.translations[1].url, "https://a.example/?m=1&t=211");
  assert.equal(t.translations.length, 0);
});

test("озвучки с одинаковым адресом не показываем", () => {
  const same = { data: [{ type: "V", iframeUrl: "https://v.example/", translations: [
    { name: "a", quality: null, iframeUrl: "https://v.example/" }, { name: "b", quality: null, iframeUrl: "https://v.example/" }] }] };
  assert.deepEqual(normalizePlayers(same)[0].translations, []);
});

test("мусор вместо ответа API", () => {
  for (const j of [null, {}, { data: null }, { error: { title: "x" } }]) assert.deepEqual(normalizePlayers(j), []);
});
