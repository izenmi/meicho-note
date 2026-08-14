// data/ を読み込んで、テンプレートがそのまま使える形に組み直す。
// 参照(genreId / authorIds / guideIds)はここで解決し、テンプレート側では引き回さない。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENRES, READY_REQUIRES } from "../../config.mjs";
import { paths } from "./paths.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA = join(ROOT, "data");

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8"));
}

/** 解説が書けている本だけを公開扱いにする。骨格だけの本は詳細ページを「準備中」にし、
 *  sitemap からも外す(中身のないページを検索結果に出さないため)。 */
export function isReady(book) {
  if (READY_REQUIRES.lead && !book.lead) return false;
  if (READY_REQUIRES.overview && !book.overview) return false;
  if ((book.readingPoints?.length ?? 0) < READY_REQUIRES.readingPoints) return false;
  return true;
}

export function loadAll() {
  const bookDir = join(DATA, "books");
  const books = (existsSync(bookDir) ? readdirSync(bookDir) : [])
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(join(bookDir, f)))
    .sort((a, b) => a.broadcast.year - b.broadcast.year || a.broadcast.month - b.broadcast.month);

  const authors = readJson(join(DATA, "meta", "authors.json"), []);
  const guides = readJson(join(DATA, "meta", "guides.json"), []);
  const specials = readJson(join(DATA, "specials", "specials.json"), []);
  const covers = readJson(join(DATA, "generated", "covers.json"), {});

  const authorById = new Map(authors.map((p) => [p.id, { ...p, books: [] }]));
  const guideById = new Map(guides.map((p) => [p.id, { ...p, books: [], specials: [] }]));

  const genreById = new Map(
    Object.entries(GENRES)
      .map(([id, g]) => [id, { id, ...g, books: [], href: paths.genre(id) }])
      .sort((a, b) => a[1].order - b[1].order),
  );

  for (const book of books) {
    book.ready = isReady(book);
    book.href = paths.book(book.id);
    book.genre = genreById.get(book.genreId) ?? null;
    book.authors = book.authorIds.map((id) => authorById.get(id)).filter(Boolean);
    book.guides = book.broadcast.guideIds.map((id) => guideById.get(id)).filter(Boolean);
    // スペシャル月は作品ごとに指南役が違うことがあるので、そちらも拾う
    for (const part of book.special?.parts ?? []) {
      part.guideEntity = part.guide ? guideById.get(part.guide.replace(/\s+/g, "")) ?? null : null;
    }

    book.genre?.books.push(book);
    for (const a of book.authors) a.books.push(book);
    for (const g of book.guides) g.books.push(book);
  }

  for (const special of specials) {
    special.href = `${paths.specials()}#${special.id}`;
    for (const part of special.parts) {
      const g = part.guideId ? guideById.get(part.guideId) : null;
      if (g) { part.guideEntity = g; g.specials.push({ special, part }); }
    }
  }

  const byYear = new Map();
  for (const book of books) {
    const y = book.broadcast.year;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(book);
  }

  return {
    books,
    booksById: new Map(books.map((b) => [b.id, b])),
    readyBooks: books.filter((b) => b.ready),
    genres: [...genreById.values()],
    genreById,
    authors: [...authorById.values()].filter((a) => a.books.length),
    authorById,
    guides: [...guideById.values()].filter((g) => g.books.length || g.specials.length),
    guideById,
    specials,
    covers,
    years: [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => ({ year, books: list })),
  };
}
