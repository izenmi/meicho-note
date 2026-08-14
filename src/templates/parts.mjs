// 複数のページで使い回す小さな部品。

import { attr, each, esc, formatMonth, when } from "../lib/html.mjs";
import { href, paths } from "../lib/paths.mjs";

/** 一覧に並べる本のカード。解説が未執筆のものは破線にして「準備中」を明示する。 */
export function bookCard(book, { showGuide = false } = {}) {
  return `
<li>
  <a class="book-card${book.ready ? "" : " book-card--draft"}" href="${attr(href(book.href))}">
    <span class="book-card__meta">
      ${esc(formatMonth(book.broadcast.year, book.broadcast.month))}
      ${when(book.kind === "special", '<span class="badge badge--special">スペシャル</span>')}
      ${when(!book.ready, '<span class="badge badge--draft">準備中</span>')}
    </span>
    <span class="book-card__title">${esc(book.title)}</span>
    ${when(book.author, () => `<span class="book-card__author">${esc(book.author)}</span>`)}
    ${when(book.lead, () => `<span class="book-card__lead">${esc(book.lead.slice(0, 62))}${book.lead.length > 62 ? "…" : ""}</span>`)}
    ${when(showGuide && book.guides.length, () => `<span class="book-card__author">指南役：${esc(book.guides.map((g) => g.name).join("・"))}</span>`)}
  </a>
</li>`;
}

export function bookGrid(books, options) {
  if (!books.length) return '<p class="muted">該当する本はまだありません。</p>';
  return `<ul class="card-grid">${each(books, (b) => bookCard(b, options))}</ul>`;
}

/** 放送年でまとめた一覧。アーカイブと指南役ページで使う。 */
export function monthList(books) {
  return `
<ul class="month-list">
  ${each(books, (b) => `
  <li>
    <span class="month-list__month">${esc(b.broadcast.month)}月</span>
    <span>
      <a class="month-list__title" href="${attr(href(b.href))}">${esc(b.title)}</a>
      ${when(b.author, () => ` <span class="month-list__author">${esc(b.author)}</span>`)}
      ${when(!b.ready, ' <span class="badge badge--draft">準備中</span>')}
      ${when(b.guides.length, () => `<br /><span class="month-list__guide">指南役：${esc(b.guides.map((g) => g.name).join("・"))}</span>`)}
    </span>
  </li>`)}
</ul>`;
}

/** 人物のリンクリスト(指南役一覧・著者一覧)。 */
export function personList(people, kind) {
  return `
<ul class="entity-list">
  ${each(people, (p) => `
  <li>
    <a href="${attr(href(kind === "guide" ? paths.guide(p.id) : paths.author(p.id)))}">${esc(p.name)}</a>
    <span class="entity-list__count">${esc(p.books.length + (p.specials?.length ?? 0))}回</span>
  </li>`)}
</ul>`;
}
