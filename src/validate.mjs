// data/ の整合性チェック。errors があればビルドを止める。
// warnings は公開できるが埋めたいもの(解説未執筆など)。

import { GENRES } from "../config.mjs";
import { normalizeIsbn } from "./lib/affiliate.mjs";

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function validate(site) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  const seenSlugs = new Set();
  for (const book of site.books) {
    const at = `${book.id}`;
    if (!SLUG.test(book.id)) err(`${at}: slug は英小文字・数字・ハイフンのみ`);
    if (seenSlugs.has(book.id)) err(`${at}: slug が重複しています`);
    seenSlugs.add(book.id);

    if (!book.title) err(`${at}: title が空です`);
    if (!GENRES[book.genreId]) err(`${at}: 未知の genreId "${book.genreId}"`);
    if (!book.broadcast?.year || !book.broadcast?.month) err(`${at}: 放送年月がありません`);

    for (const id of book.authorIds) {
      if (!site.authorById.has(id)) err(`${at}: authors.json に無い著者 "${id}"`);
    }
    for (const id of book.broadcast.guideIds) {
      if (!site.guideById.has(id)) err(`${at}: guides.json に無い指南役 "${id}"`);
    }

    // 執筆済みなら中身の体裁も見る
    if (book.ready) {
      if (book.readingPoints.length !== 4) {
        warn(`${at}: 勘所が${book.readingPoints.length}本です(4本を想定)`);
      }
      for (const [i, p] of book.readingPoints.entries()) {
        if (!p.heading || !p.body) err(`${at}: 勘所${i + 1}に heading か body がありません`);
      }
      if (book.lead.length > 160) warn(`${at}: lead が${book.lead.length}字(160字以内を想定)`);
      if (book.overview.length < 300) warn(`${at}: overview が${book.overview.length}字と短めです`);
      if (!book.books?.original?.length && !book.books?.text) {
        warn(`${at}: 購入リンクの対象が1件もありません`);
      }
    } else {
      warn(`${at}: 解説が未執筆(準備中として公開)`);
    }

    // ISBN の形だけ検査する。実在チェックは scripts/books.mjs の役目。
    const isbns = [
      book.books?.text?.isbn,
      ...(book.books?.original ?? []).map((b) => b.isbn),
      ...(book.books?.related ?? []).map((b) => b.isbn),
    ].filter(Boolean);
    for (const isbn of isbns) {
      if (!normalizeIsbn(isbn)) err(`${at}: ISBNの形式が不正 "${isbn}"`);
    }
  }

  for (const genre of site.genres) {
    if (!genre.books.length) warn(`ジャンル「${genre.name}」に本がありません`);
  }

  return { errors, warnings };
}
