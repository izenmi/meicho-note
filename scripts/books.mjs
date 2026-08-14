// 楽天ブックスAPIで、書籍のISBN・表紙・商品ページURLを解決して
// data/generated/covers.json にためる。手動実行。
//
//   RAKUTEN_APP_ID=xxx RAKUTEN_ACCESS_KEY=yyy node scripts/books.mjs            未解決分だけ
//   RAKUTEN_APP_ID=xxx RAKUTEN_ACCESS_KEY=yyy node scripts/books.mjs --text     番組テキストのISBNを探す
//   RAKUTEN_APP_ID=xxx RAKUTEN_ACCESS_KEY=yyy node scripts/books.mjs --only=rongo,kokoro
//   RAKUTEN_APP_ID=xxx RAKUTEN_ACCESS_KEY=yyy node scripts/books.mjs --force    解決済みも取り直す
//
// 認証情報はユーザー管理。**ここにも covers.json にも書かない**(accessKey は秘匿情報)。
// アフィリエイトIDのほうは公開前提なので config.mjs に置いてある。
//
// covers.json の形: { "<ISBN13>": { "coverUrl": "...", "itemUrl": "...", "title": "...", "checkedAt": "..." } }
// 解決できなかったISBNは { "miss": true } を入れて、次回に無駄な再問い合わせをしない。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeIsbn } from "../src/lib/affiliate.mjs";
import { loadAll, ROOT } from "../src/lib/load.mjs";

const APP_ID = process.env.RAKUTEN_APP_ID;
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
if (!APP_ID || !ACCESS_KEY) {
  console.error(
    "RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY が未設定です。\n" +
      "  RAKUTEN_APP_ID=xxx RAKUTEN_ACCESS_KEY=yyy node scripts/books.mjs\n" +
      "認証情報が無くても購入リンク自体は出ます(検索URLへのフォールバック)。表紙画像だけが付きません。",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const TEXT_MODE = args.includes("--text");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean);

const OUT = join(ROOT, "data", "generated", "covers.json");
const cache = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

const ENDPOINT = "https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 楽天ブックス書籍検索。1秒1リクエストの目安を守る(429を踏むと数分止まる)。 */
async function search(params) {
  const query = new URLSearchParams({
    applicationId: APP_ID,
    affiliateId: "",           // アフィリエイトURLはこちらで組むので不要
    format: "json",
    hits: "10",
    ...params,
  });
  const url = `${ENDPOINT}?${query}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "user-agent": "meicho-note/1.0" } });
    if (res.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
    if (!res.ok) { console.warn(`  ! ${res.status} ${res.statusText}`); return []; }
    const json = await res.json();
    return (json.Items ?? []).map((i) => i.Item);
  }
  return [];
}

function pickCover(item) {
  // largeImageUrl は 200x200。`?_ex=` を書き換えれば任意サイズが返るので、
  // 表示側でのサイズ調整に備えて素の形のまま保存する。
  return item.largeImageUrl || item.mediumImageUrl || item.smallImageUrl || "";
}

function record(isbn, item) {
  cache[isbn] = item
    ? {
        coverUrl: pickCover(item),
        itemUrl: item.itemUrl ?? "",
        title: item.title ?? "",
        checkedAt: new Date().toISOString().slice(0, 10),
      }
    : { miss: true, checkedAt: new Date().toISOString().slice(0, 10) };
}

function save() {
  mkdirSync(join(ROOT, "data", "generated"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(cache, null, 2) + "\n");
}

const site = loadAll();
const books = only ? site.books.filter((b) => only.includes(b.id)) : site.books;

// ---------------------------------------------- (1) 登録済みISBNの表紙を引く

const isbns = new Map(); // isbn -> 表示用タイトル
for (const book of books) {
  for (const entry of [book.books?.text, ...(book.books?.original ?? []), ...(book.books?.related ?? [])]) {
    const isbn = normalizeIsbn(entry?.isbn);
    if (isbn) isbns.set(isbn, entry.title ?? book.title);
  }
}

let resolved = 0;
let missed = 0;
for (const [isbn, title] of isbns) {
  if (!FORCE && cache[isbn]) continue;
  const items = await search({ isbn });
  record(isbn, items[0] ?? null);
  if (items[0]) { resolved++; console.log(`  ✓ ${isbn} ${items[0].title}`); }
  else { missed++; console.log(`  · ${isbn} 見つからず（${title}）`); }
  await sleep(1100);
}
if (isbns.size) {
  save();
  console.log(`ISBN直引き: 解決 ${resolved} / 未解決 ${missed} / 済み ${isbns.size - resolved - missed}`);
}

// -------------------------------- (2) --text: 番組テキストのISBNを検索で探す

if (TEXT_MODE) {
  const found = [];
  for (const book of books) {
    if (book.books?.text?.isbn && !FORCE) continue;
    // 「NHK 100分de名著 <作品名>」で引く。シリーズ名が固定なので当たりやすい。
    const items = await search({ title: `100分de名著 ${book.title}`, booksGenreId: "001004008" });
    const hit = items.find((i) => /100分de名著|100分 de 名著/.test(i.title ?? ""));
    if (hit) {
      const isbn = normalizeIsbn(hit.isbn);
      found.push({ id: book.id, isbn, title: hit.title, salesDate: hit.salesDate });
      if (isbn) record(isbn, hit);
      console.log(`  ✓ ${book.id}  ${hit.title}  ISBN=${isbn}`);
    } else {
      console.log(`  · ${book.id}  「${book.title}」のテキストが見つかりませんでした`);
    }
    await sleep(1100);
  }
  save();
  const outFile = join(ROOT, ".cache", "text-isbn.json");
  mkdirSync(join(ROOT, ".cache"), { recursive: true });
  writeFileSync(outFile, JSON.stringify(found, null, 2) + "\n");
  console.log(`\n番組テキスト ${found.length}/${books.length}件を検出 → ${outFile}`);
  console.log("data/books/*.json の books.text へ反映するのは手作業です(取り違えを目で確認するため)。");
}
