// dist/ を作り直す。依存パッケージなし。
//   node scripts/build.mjs
//   node scripts/build.mjs --quiet

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SITE } from "../config.mjs";
import { loadAll, ROOT } from "../src/lib/load.mjs";
import { absolute, outputFile, paths } from "../src/lib/paths.mjs";
import { validate } from "../src/validate.mjs";
import { renderAbout } from "../src/templates/about.mjs";
import { renderBook } from "../src/templates/book.mjs";
import { renderHome } from "../src/templates/home.mjs";
import {
  renderArchive, renderAuthor, renderAuthorIndex, renderGenre, renderGenreIndex,
  renderGuide, renderGuideIndex, renderNotFound, renderSpecials,
} from "../src/templates/lists.mjs";

const DIST = join(ROOT, "dist");

export function build({ quiet = false } = {}) {
  const log = quiet ? () => {} : (...a) => console.log(...a);
  const site = loadAll();

  const { errors, warnings } = validate(site);
  const drafts = warnings.filter((w) => w.includes("未執筆"));
  for (const w of warnings) if (!w.includes("未執筆")) log(`  warn: ${w}`);
  if (drafts.length) log(`  warn: 解説が未執筆の回が ${drafts.length}件（準備中として公開）`);
  if (errors.length) {
    console.error(`\nバリデーションエラー ${errors.length}件:`);
    for (const e of errors) console.error(`  - ${e}`);
    throw new Error("validation failed");
  }

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  const sitemap = [];
  let written = 0;
  const emit = (path, html, { indexed = true } = {}) => {
    written++;
    const dest = join(DIST, outputFile(path));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, html);
    if (indexed) sitemap.push(path);
  };

  emit(paths.home(), renderHome(site));
  emit(paths.archive(), renderArchive(site));
  emit("genres/", renderGenreIndex(site));
  emit("guides/", renderGuideIndex(site));
  emit("authors/", renderAuthorIndex(site));
  emit(paths.specials(), renderSpecials(site));
  emit(paths.about(), renderAbout(site));
  emit("404.html", renderNotFound(), { indexed: false });

  // 解説が未執筆の回は sitemap に載せない(中身のないページを検索結果に出さないため)
  for (const book of site.books) emit(book.href, renderBook(book, site), { indexed: book.ready });
  for (const genre of site.genres) emit(genre.href, renderGenre(genre, site));
  for (const guide of site.guides) emit(paths.guide(guide.id), renderGuide(guide, site));
  for (const author of site.authors) emit(paths.author(author.id), renderAuthor(author, site));

  // 検索用の索引。クライアント側の assets/search.js が読む。
  const searchIndex = site.books.map((b) => ({
    t: b.title,
    a: b.author,
    g: b.guides.map((g) => g.name).join(" "),
    y: `${b.broadcast.year}`,
    u: b.href,
    r: b.ready ? 1 : 0,
    x: b.titles.filter((t) => t !== b.title).join(" "),
  }));
  mkdirSync(join(DIST, "data"), { recursive: true });
  writeFileSync(join(DIST, "data", "search-index.json"), JSON.stringify(searchIndex));

  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
      .map((p) => `  <url><loc>${absolute(p)}</loc><lastmod>${today}</lastmod></url>`)
      .join("\n")}\n</urlset>\n`,
  );
  writeFileSync(
    join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${absolute("sitemap.xml")}\n`,
  );
  // GitHub Pages の Jekyll 処理を止める(アンダースコア始まりのパスを消されないように)
  writeFileSync(join(DIST, ".nojekyll"), "");

  const publicDir = join(ROOT, "public");
  if (existsSync(publicDir)) cpSync(publicDir, DIST, { recursive: true });

  log(`${written}ページ生成（sitemap ${sitemap.length}件） → dist/`);
  log(`解説公開済み ${site.readyBooks.length} / 全${site.books.length}回`);
  return { site, written, sitemap };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build({ quiet: process.argv.includes("--quiet") });
}
