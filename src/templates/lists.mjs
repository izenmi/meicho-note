// 一覧系のページ(アーカイブ・ジャンル・指南役・原著者・スペシャル放送)。
// どれも「本の集合を見せる」だけなので1ファイルにまとめてある。

import { attr, each, esc, formatDate, formatMonth, when } from "../lib/html.mjs";
import { href, paths } from "../lib/paths.mjs";
import { layout } from "./layout.mjs";
import { bookGrid, monthList, personList } from "./parts.mjs";

const HOME = { label: "ホーム", path: paths.home() };

// ------------------------------------------------------------ アーカイブ

export function renderArchive(site) {
  const readyCount = site.readyBooks.length;
  return layout({
    title: "名著一覧（放送アーカイブ）",
    description: `『100分de名著』で取り上げられた${site.books.length}回分の名著を、放送年月順に並べた一覧です。`,
    path: paths.archive(),
    breadcrumbs: [HOME, { label: "名著一覧", path: paths.archive() }],
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>名著一覧</h1>
    <p class="page-head__lead">
      2010年9月の放送開始から現在までの${esc(site.books.length)}回分を、新しい順に並べています。
      うち${esc(readyCount)}件の解説を公開済みです。
    </p>
  </header>
  ${each(site.years, (y) => `
  <section class="year-block">
    <h2>${esc(y.year)}年</h2>
    ${monthList([...y.books].reverse())}
  </section>`)}
</div>`,
  });
}

// -------------------------------------------------------------- ジャンル

export function renderGenreIndex(site) {
  return layout({
    title: "ジャンルから探す",
    description: "哲学・思想、日本の古典、海外の文学など、ジャンル別に名著を探せます。",
    path: "genres/",
    breadcrumbs: [HOME, { label: "ジャンル", path: "genres/" }],
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>ジャンルから探す</h1>
    <p class="page-head__lead">当サイトが独自に分類したジャンルです。番組の区分ではありません。</p>
  </header>
  ${each(site.genres, (g) => `
  <section class="section">
    <h2><a href="${attr(href(g.href))}">${esc(g.name)}</a> <span class="entity-list__count">${esc(g.books.length)}冊</span></h2>
    <p class="section__note">${esc(g.description)}</p>
    ${bookGrid(g.books.slice(0, 6))}
  </section>`)}
</div>`,
  });
}

export function renderGenre(genre, site) {
  const sorted = [...genre.books].reverse();
  return layout({
    title: `${genre.name}の名著`,
    description: `${genre.description} 『100分de名著』で取り上げられた${genre.books.length}冊を紹介します。`,
    path: genre.href,
    breadcrumbs: [HOME, { label: "ジャンル", path: "genres/" }, { label: genre.name, path: genre.href }],
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>${esc(genre.name)}</h1>
    <p class="page-head__lead">${esc(genre.description)}　全${esc(genre.books.length)}冊。</p>
  </header>
  <section class="section">
    ${bookGrid(sorted, { showGuide: true })}
  </section>
</div>`,
  });
}

// ---------------------------------------------------------------- 指南役

export function renderGuideIndex(site) {
  const sorted = [...site.guides].sort(
    (a, b) => b.books.length + b.specials.length - (a.books.length + a.specials.length) || a.name.localeCompare(b.name, "ja"),
  );
  return layout({
    title: "指南役から探す",
    description: `『100分de名著』で解説を務めた${site.guides.length}名の指南役と、その担当回の一覧です。`,
    path: "guides/",
    breadcrumbs: [HOME, { label: "指南役", path: "guides/" }],
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>指南役から探す</h1>
    <p class="page-head__lead">番組で解説を務めた${esc(site.guides.length)}名です。担当回の多い順に並べています。</p>
  </header>
  <section class="section">
    ${personList(sorted, "guide")}
  </section>
</div>`,
  });
}

export function renderGuide(guide, site) {
  const books = [...guide.books].reverse();
  return layout({
    title: `${guide.name}が指南した回`,
    description: `${guide.name}が『100分de名著』で解説を務めた回の一覧です。`,
    path: paths.guide(guide.id),
    breadcrumbs: [HOME, { label: "指南役", path: "guides/" }, { label: guide.name, path: paths.guide(guide.id) }],
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>${esc(guide.name)}</h1>
    <p class="page-head__lead">
      ${when(guide.description, () => `${esc(guide.description)}<br />`)}
      指南を務めた回：${esc(books.length)}件${when(guide.specials.length, () => `／スペシャル放送 ${esc(guide.specials.length)}件`)}
    </p>
  </header>
  ${when(books.length, () => `
  <section class="section">
    <h2>担当した回</h2>
    ${bookGrid(books)}
  </section>`)}
  ${when(guide.specials.length, () => `
  <section class="section">
    <h2>スペシャル放送での担当</h2>
    <ul class="special-parts">
      ${each(guide.specials, ({ special, part }) => `
      <li>
        <span class="special-parts__title">${esc(part.titles.join("／"))}</span>
        <span class="special-parts__theme">${esc(part.theme)}</span>
        <span class="special-parts__guide"><a href="${attr(href(special.href))}">『${esc(special.label)}』</a>　${esc(formatDate(special.airedOn))}</span>
      </li>`)}
    </ul>
  </section>`)}
</div>`,
  });
}

// ---------------------------------------------------------------- 原著者

export function renderAuthor(author, site) {
  const books = [...author.books].reverse();
  return layout({
    title: `${author.name}の名著`,
    description: `${author.name}の著作が『100分de名著』で取り上げられた回の一覧です。`,
    path: paths.author(author.id),
    breadcrumbs: [HOME, { label: author.name, path: paths.author(author.id) }],
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>${esc(author.name)}</h1>
    <p class="page-head__lead">
      ${when(author.description, () => `${esc(author.description)}<br />`)}
      取り上げられた回：${esc(books.length)}件
    </p>
  </header>
  <section class="section">
    ${bookGrid(books, { showGuide: true })}
  </section>
</div>`,
  });
}

// ------------------------------------------------------- スペシャル放送

export function renderSpecials(site) {
  return layout({
    title: "スペシャル放送",
    description: "4名の指南役が1作品ずつ取り上げ、100分間一挙放送するスペシャル回の一覧です。",
    path: paths.specials(),
    breadcrumbs: [HOME, { label: "スペシャル", path: paths.specials() }],
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>スペシャル放送</h1>
    <p class="page-head__lead">
      通常の月とは別に、4名の指南役が原則1作品ずつ取り上げて100分一挙放送する特別編です。
      1回で複数の名著を扱うため、月ごとの名著一覧とは分けて並べています。
    </p>
  </header>
  ${each(site.specials, (s) => `
  <section class="special-block" id="${attr(s.id)}">
    <h2>『${esc(s.label)}』</h2>
    <p class="special-block__date">${esc(formatDate(s.airedOn))}放送${when(s.hosts.length, () => `　司会：${esc(s.hosts.join("・"))}`)}</p>
    <ul class="special-parts">
      ${each(s.parts, (p) => `
      <li>
        <span class="special-parts__title">${esc(p.titles.join("／"))}</span>
        ${when(p.theme, () => `<span class="special-parts__theme">${esc(p.theme)}</span>`)}
        ${when(p.guideEntity, () => `<span class="special-parts__guide">指南役：<a href="${attr(href(paths.guide(p.guideEntity.id)))}">${esc(p.guideEntity.name)}</a></span>`)}
      </li>`)}
    </ul>
  </section>`)}
</div>`,
  });
}

// ------------------------------------------------------------------ 著者索引

export function renderAuthorIndex(site) {
  const sorted = [...site.authors].sort((a, b) => b.books.length - a.books.length || a.name.localeCompare(b.name, "ja"));
  return layout({
    title: "原著者から探す",
    description: `『100分de名著』で取り上げられた${site.authors.length}名の著者の一覧です。`,
    path: "authors/",
    breadcrumbs: [HOME, { label: "原著者", path: "authors/" }],
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>原著者から探す</h1>
    <p class="page-head__lead">
      取り上げられた名著の書き手${esc(site.authors.length)}名です。無署名の古典（『万葉集』『古事記』など）はここには並びません。
    </p>
  </header>
  <section class="section">
    ${personList(sorted, "author")}
  </section>
</div>`,
  });
}

// ------------------------------------------------------------------ その他

export function renderNotFound() {
  return layout({
    title: "ページが見つかりません",
    description: "お探しのページは見つかりませんでした。",
    path: "404.html",
    noindex: true,
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>ページが見つかりません</h1>
    <p class="page-head__lead">
      URLが変わったか、削除された可能性があります。
      <a href="${attr(href(paths.archive()))}">名著一覧</a>からお探しください。
    </p>
  </header>
</div>`,
  });
}
