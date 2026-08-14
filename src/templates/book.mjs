import { AFFILIATE_NOTICE } from "../../config.mjs";
import { buyLinks } from "../lib/affiliate.mjs";
import { attr, each, esc, formatMonth, paragraphs, when } from "../lib/html.mjs";
import { absolute, href, paths } from "../lib/paths.mjs";
import { layout } from "./layout.mjs";

/** 出演者クレジットを「朗読：柄本明／語り：小口貴子」の形にまとめる。 */
function creditsText(credits) {
  const byRole = new Map();
  for (const c of credits) {
    if (!byRole.has(c.role)) byRole.set(c.role, []);
    byRole.get(c.role).push(c.name);
  }
  return [...byRole.entries()].map(([role, names]) => `${role}：${names.join("・")}`).join("／");
}

function personLinks(people, kind) {
  return each(people, (p, i) =>
    `${i ? "・" : ""}<a href="${attr(href(kind === "guide" ? paths.guide(p.id) : paths.author(p.id)))}">${esc(p.name)}</a>`,
  );
}

/** 1冊分の購入カード。ISBNが分かっているものは商品ページへ、そうでなければ検索へ。 */
function buyItem(link) {
  const exactLabel = link.exact ? "" : "（検索）";
  return `
<div class="buy-item">
  ${link.coverUrl
    ? `<img class="buy-item__cover" src="${attr(link.coverUrl)}" alt="" loading="lazy" />`
    : `<div class="buy-item__cover buy-item__cover--blank" aria-hidden="true">${esc(link.title.slice(0, 14))}</div>`}
  <div class="buy-item__body">
    <div class="buy-item__title">${esc(link.title)}</div>
    <div class="buy-item__meta">${esc([link.author, link.translator && `${link.translator}訳`, link.publisher].filter(Boolean).join("／"))}</div>
    ${when(link.note, () => `<div class="buy-item__note">${esc(link.note)}</div>`)}
  </div>
  <div class="buy-item__links">
    <a class="buy-link${link.exact ? "" : " buy-link--search"}" href="${attr(link.amazon)}" rel="nofollow sponsored noopener" target="_blank">Amazon${exactLabel}</a>
    <a class="buy-link${link.exact ? "" : " buy-link--search"}" href="${attr(link.rakuten)}" rel="nofollow sponsored noopener" target="_blank">楽天ブックス${exactLabel}</a>
  </div>
</div>`;
}

function buySection(book, covers) {
  const text = book.books?.text ? buyLinks({ ...book.books.text, author: "" }, covers) : null;
  const originals = (book.books?.original ?? []).map((b) => buyLinks({ ...b, author: b.author ?? book.author }, covers));
  const related = (book.books?.related ?? []).map((b) => buyLinks(b, covers));
  if (!text && !originals.length && !related.length) return "";

  return `
<section class="section" id="buy">
  <h2>読むための本を手に入れる</h2>
  <div class="buy">
    ${when(originals.length, () => `
    <div class="buy__group">
      <h3>名著そのものを読む</h3>
      <p>いま新刊で手に入りやすい版です。文庫・新訳が複数ある作品では、読みやすさの違いを注記に添えています。</p>
      ${each(originals, buyItem)}
    </div>`)}
    ${when(text, () => `
    <div class="buy__group">
      <h3>番組の解説書で読み解きを追う</h3>
      <p>指南役による解説をまとめた書籍です。放送当時の月刊テキストは品切れのことが多いため、いま新刊で手に入る「NHK「100分de名著」ブックス」版などを挙げています。</p>
      ${buyItem(text)}
    </div>`)}
    ${when(related.length, () => `
    <div class="buy__group">
      <h3>指南役の関連書籍</h3>
      <p>その回を担当した指南役自身の著書です。名著を読んだあとの一歩に。</p>
      ${each(related, buyItem)}
    </div>`)}
  </div>
  <p class="notice">${esc(AFFILIATE_NOTICE)}リンク先の価格・在庫は変動します。</p>
</section>`;
}

export function renderBook(book, site) {
  const { broadcast } = book;
  const covers = site.covers;
  const airDate = formatMonth(broadcast.year, broadcast.month);
  const credits = creditsText(broadcast.credits ?? []);

  const breadcrumbs = [
    { label: "ホーム", path: paths.home() },
    ...(book.genre ? [{ label: book.genre.name, path: book.genre.href }] : []),
    { label: book.title, path: book.href },
  ];

  const factbox = `
<div class="factbox">
  <dl>
    <dt>放送</dt><dd>${esc(airDate)}${when(book.kind === "special", ' <span class="badge badge--special">スペシャル</span>')}</dd>
    ${when(book.guides.length, () => `<dt>指南役</dt><dd>${personLinks(book.guides, "guide")}</dd>`)}
    ${when(book.authors.length, () => `<dt>原著者</dt><dd>${personLinks(book.authors, "author")}</dd>`)}
    ${when(book.originalPublishedYear, () => `<dt>原著刊行</dt><dd>${esc(book.originalPublishedYear)}年${when(book.originCountry, () => `（${esc(book.originCountry)}）`)}</dd>`)}
    ${when(credits, () => `<dt>朗読・語り</dt><dd>${esc(credits)}</dd>`)}
    ${when(broadcast.hosts?.length, () => `<dt>司会</dt><dd>${esc(broadcast.hosts.join("・"))}</dd>`)}
    ${when(book.reruns.length, () => `<dt>再放送</dt><dd>${esc(book.reruns.map((r) => formatMonth(r.year, r.month)).join("／"))}</dd>`)}
    ${when(book.genre, () => `<dt>ジャンル</dt><dd><a href="${attr(href(book.genre.href))}">${esc(book.genre.name)}</a></dd>`)}
  </dl>
</div>`;

  const episodes = when(book.special?.parts?.length, () => `
<section class="section">
  <h2>この月に取り上げられた作品</h2>
  <ul class="episodes">
    ${each(book.special.parts, (p) => `
    <li>
      <span class="episodes__no">${p.no ? `第${esc(p.no)}回` : "―"}</span>
      <span class="episodes__title">${esc(p.titles.join("／"))}</span>
      ${when(p.subtitle, () => `<span class="episodes__subtitle">${esc(p.subtitle)}</span>`)}
      ${when(p.guideEntity && book.guides.length !== 1, () => `<span class="episodes__subtitle">指南役：<a href="${attr(href(paths.guide(p.guideEntity.id)))}">${esc(p.guideEntity.name)}</a></span>`)}
    </li>`)}
  </ul>
</section>`);

  const body = book.ready
    ? `
${episodes}
<section class="section">
  <h2>どんな本か</h2>
  <div class="prose">${paragraphs(book.overview)}</div>
</section>
<section class="section">
  <h2>100分で読み解くための4つの勘所</h2>
  <p class="section__note">原著の構成に沿って、当サイトが立てた読みどころです。番組の各回構成とは対応しません。</p>
  <ol class="points">
    ${each(book.readingPoints, (p) => `
    <li>
      <h3 class="points__heading">${esc(p.heading)}</h3>
      <p class="points__body">${esc(p.body)}</p>
    </li>`)}
  </ol>
</section>
${when(book.keywords?.length, () => `
<section class="section">
  <h2>おさえておきたい言葉</h2>
  <dl class="keywords">
    ${each(book.keywords, (k) => `<div><dt>${esc(k.term)}</dt><dd>${esc(k.description)}</dd></div>`)}
  </dl>
</section>`)}
${when(book.whoShouldRead, () => `
<section class="section">
  <h2>こんな人に</h2>
  <div class="prose">${paragraphs(book.whoShouldRead)}</div>
</section>`)}
${buySection(book, covers)}
${when(book.sourceNote, () => `
<section class="section">
  <h2>出典メモ</h2>
  <p class="muted" style="font-size:0.85rem">${esc(book.sourceNote)}</p>
</section>`)}`
    : `
${episodes}
<div class="draft-note">
  <p><strong>この回の解説は準備中です。</strong></p>
  <p>放送情報は上のとおり確定しています。原著を読み解いた解説と、入手できる版へのリンクを順次追加しています。</p>
</div>`;

  const jsonLd = book.ready
    ? [{
        "@context": "https://schema.org",
        "@type": "Book",
        name: book.title,
        ...(book.author ? { author: { "@type": "Person", name: book.author } } : {}),
        ...(book.originalPublishedYear ? { datePublished: String(book.originalPublishedYear) } : {}),
        description: book.lead,
        url: absolute(book.href),
      }]
    : [];

  return layout({
    title: `${book.title}${book.author ? `（${book.author}）` : ""}`,
    description: book.lead || `${book.title}は${formatMonth(broadcast.year, broadcast.month)}に『100分de名著』で取り上げられました。`,
    path: book.href,
    breadcrumbs,
    jsonLd,
    // ページ別OG画像は解説を公開した回だけ焼いている(scripts/ogimage.mjs --books)
    ogImage: book.ready ? `og/books/${book.id}.png` : "og/default.png",
    noindex: !book.ready,
    body: `
<div class="wrap">
  <header class="book-head">
    <p class="book-head__kicker">${esc(airDate)}放送${when(book.genre, () => `・${esc(book.genre.name)}`)}</p>
    <h1>${esc(book.title)}</h1>
    ${when(book.author, () => `<p class="book-head__author">${esc(book.author)}</p>`)}
    ${when(book.lead, () => `<p class="book-head__lead">${esc(book.lead)}</p>`)}
    ${factbox}
  </header>
  ${body}
</div>`,
  });
}
