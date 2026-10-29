const test = require("node:test");
const assert = require("node:assert/strict");
const { convertUrl } = require("./rules.js");

const href = (u) => convertUrl(u)?.href;

test("пример из задачи: query сохраняется", () => {
  assert.equal(
    href("https://www.kinopoisk.ru/film/705356/?socialAlias=c3NzbGRr&utm_referrer=www.kinopoisk.ru"),
    "https://www.kinopoisk.me/film/705356/?socialAlias=c3NzbGRr&utm_referrer=www.kinopoisk.ru"
  );
});

test("сериал и hash", () => {
  assert.equal(href("https://www.kinopoisk.ru/series/123/#cast"), "https://www.kinopoisk.me/series/123/#cast");
});

test("без www", () => {
  assert.equal(href("https://kinopoisk.ru/film/1/"), "https://kinopoisk.me/film/1/");
});

test("другой поддомен", () => {
  assert.equal(href("https://hd.kinopoisk.ru/film/1/"), "https://hd.kinopoisk.me/film/1/");
});

test("главная, поиск и профиль не переносятся", () => {
  assert.equal(convertUrl("https://www.kinopoisk.ru/"), null);
  assert.equal(convertUrl("https://www.kinopoisk.ru/index.php?kp_query=x"), null);
  assert.equal(convertUrl("https://www.kinopoisk.ru/user/1/"), null);
});

test("/film/ без числового id не переносится", () => {
  assert.equal(convertUrl("https://www.kinopoisk.ru/film/"), null);
});

test("чужой домен не переносится", () => {
  assert.equal(convertUrl("https://example.com/film/1/"), null);
  assert.equal(convertUrl("https://notkinopoisk.ru/film/1/"), null);
  assert.equal(convertUrl("https://kinopoisk.ru.evil.com/film/1/"), null);
});

test("мусор вместо URL", () => {
  assert.equal(convertUrl("not a url"), null);
  assert.equal(convertUrl(""), null);
});

test("уже зеркало не переносится повторно", () => {
  assert.equal(convertUrl("https://www.kinopoisk.me/film/1/"), null);
});
