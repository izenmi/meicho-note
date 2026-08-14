import { SITE } from "../../config.mjs";
import { attr, each, esc, when } from "../lib/html.mjs";
import { absolute, href, paths } from "../lib/paths.mjs";
import { layout } from "./layout.mjs";
import { bookGrid } from "./parts.mjs";

/**
 * ピックアップは**ビルド時に決めて固定する**。訪問のたびに並びが変わると
 * 「戻る」で違うものが出てきて迷子になるため、乱数はビルド1回に閉じ込める。
 * 放送月から決める素朴なハッシュにしてあるので、データが変わらなければ同じ並びになる。
 */
function pickup(books, count) {
  const scored = books.map((b) => {
    const seed = b.broadcast.year * 12 + b.broadcast.month;
    return { book: b, key: (seed * 2654435761) % 1000003 };
  });
  return scored.sort((a, b) => a.key - b.key).slice(0, count).map((s) => s.book);
}

export function renderHome(site) {
  const latest = [...site.books].reverse().slice(0, 8);
  const readyCount = site.readyBooks.length;
  // 「最近の放送」に出したものはピックアップから外す(同じ本が2度並ぶのを防ぐ)
  const latestIds = new Set(latest.map((b) => b.id));
  const pool = (readyCount >= 8 ? site.readyBooks : site.books).filter((b) => !latestIds.has(b.id));
  const featured = pickup(pool, 8);

  return layout({
    title: SITE.title,
    description: SITE.description,
    path: paths.home(),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE.title,
        url: absolute(""),
        description: SITE.description,
      },
    ],
    head: `<script src="${attr(href("assets/search.js"))}" defer></script>`,
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>『100分de名著』の名著を、1冊ずつ読み解く</h1>
    <p class="page-head__lead">
      NHK Eテレ『100分de名著』で取り上げられた${esc(site.books.length)}回分の名著を、放送年月・指南役といった基本情報とあわせて紹介しています。
      解説は番組の内容ではなく、原著そのものを読んで書いています。読んでみたくなったら、そのまま本を探せるようにしました。
    </p>
    <div class="search">
      <label class="visually-hidden" for="q">名著を検索</label>
      <input class="search__field" id="q" type="search" placeholder="作品名・著者・指南役で探す（例：論語、カフカ、齋藤孝）" autocomplete="off" />
      <p class="search__status" id="search-status">${esc(site.books.length)}件の放送から探せます。</p>
      <div class="search__results" id="search-results"></div>
    </div>
  </header>

  <section class="section">
    <h2>ジャンルから探す</h2>
    <ul class="entity-list">
      ${each(site.genres, (g) => `
      <li>
        <a href="${attr(href(g.href))}">${esc(g.name)}</a>
        <span class="entity-list__count">${esc(g.books.length)}冊</span>
      </li>`)}
    </ul>
  </section>

  <section class="section">
    <h2>最近の放送</h2>
    ${bookGrid(latest, { showGuide: true })}
  </section>

  <section class="section">
    <h2>${readyCount ? "読んでみる" : "収録している名著から"}</h2>
    <p class="section__note">${readyCount
      ? "解説を書き終えたものから並べています。"
      : "解説は順次追加しています。いまは放送情報のみのページが多くあります。"}</p>
    ${bookGrid(featured)}
  </section>

  <section class="section">
    <h2>このサイトについて</h2>
    <div class="prose">
      <p>
        放送は2010年9月から続いており、当サイトは${esc(site.books.length)}回分の放送を収録しています。
        各ページでは、その回で取り上げられた名著が<strong>どんな本なのか</strong>、
        <strong>100分で読み解くならどこを押さえるか</strong>を原著に沿ってまとめ、
        あわせて<strong>いま手に入る版</strong>と<strong>番組テキスト</strong>へのリンクを置いています。
      </p>
      <p><a href="${attr(href(paths.about()))}">出典と方針についてはこちら</a>。</p>
    </div>
  </section>
</div>`,
  });
}
