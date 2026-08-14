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

// 2026年5月の刷新でドメインとパラメータが変わった。旧 app.rakuten.co.jp は廃止済み。
//   - ドメイン: app.rakuten.co.jp → openapi.rakuten.co.jp（パスは /services/api/… のまま）
//   - applicationId が UUID 形式になり、accessKey（pk_ で始まる）が必須に
//   - **Origin ヘッダーが必須**。無いと 403 REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING で弾かれる
const ENDPOINT = "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404";
const ORIGIN = "https://izenmi.github.io";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 楽天ブックス書籍検索。1秒1リクエストの目安を守る(429を踏むと数分止まる)。 */
async function search(params) {
  const query = new URLSearchParams({
    applicationId: APP_ID,
    accessKey: ACCESS_KEY,
    format: "json",
    hits: "10",
    ...params,
  });
  const url = `${ENDPOINT}?${query}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        origin: ORIGIN,
        referer: `${ORIGIN}/meicho-note/`,
        "user-agent": "meicho-note/1.0",
      },
    });
    if (res.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
    if (!res.ok) { console.warn(`  ! ${res.status} ${res.statusText}`); return []; }
    const json = await res.json();
    if (json.errors) { console.warn(`  ! ${json.errors.errorCode} ${json.errors.errorMessage}`); return []; }
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
  // 作品ごとに検索すると162回叩くうえ取り違えが多い(「論語」で『論語と算盤』が返る)。
  // シリーズ名で全点を一度に引いてから、ローカルで作品名と突き合わせるほうが速く正確。
  const series = [];
  for (let page = 1; page <= 10; page++) {
    const items = await search({ title: "100分de名著", hits: "30", page: String(page) });
    if (!items.length) break;
    series.push(...items);
    await sleep(1100);
    if (items.length < 30) break;
  }
  console.log(`シリーズ書籍 ${series.length}点を取得`);

  /** 突き合わせ用の正規化。空白と約物を落とすだけ(語は消さない)。 */
  const norm = (s) =>
    String(s ?? "").replace(/[\s　]/g, "").replace(/[「」『』（）()【】・･,、。／/＋+!！?？:：-]/g, "");

  /** シリーズ名の冠を外して「著者＋作品名」の部分だけ取り出す。 */
  const strip = (title) =>
    norm(title).replace(/^(NHK)?(別冊NHK)?(まんが)?(マンガでわかる)?100分de名著(ブックス)?(集中講義)?/, "");

  const found = [];
  const rejected = [];
  for (const book of books) {
    if (book.books?.text?.isbn && !FORCE) continue;
    const key = norm(book.title);
    if (!key) continue;

    const candidates = series
      .filter((i) => /100分de名著/.test(i.title ?? ""))   // シリーズ外の本を排除（『古事記の根源へ』など）
      .map((i) => ({ item: i, rest: strip(i.title) }))
      // 作品名は書名の**末尾**に来る。部分一致だと「論語」に『論語と算盤』が当たる
      .filter((c) => c.rest.endsWith(key))
      // 著者名が入っている書名なら、その著者が一致することも要求する
      // （『幸福論』はアランとラッセルの2回があり、書名の著者部分でしか区別できない）
      .filter((c) => {
        const authorPart = c.rest.slice(0, c.rest.length - key.length);
        if (!authorPart || !book.author) return true;
        return norm(book.author).split("").some((ch) => authorPart.includes(ch))
          ? authorPart.includes(norm(book.author)) || norm(book.author).includes(authorPart)
          : false;
      })
      // 冠が短い＝通常のブックス版を、まんが版より優先する
      .sort((a, b) => a.rest.length - b.rest.length);

    if (!candidates.length) {
      const loose = series.filter((i) => norm(i.title).includes(key));
      if (loose.length) rejected.push(`${book.id}（${book.title}）← ${loose[0].title}`);
      continue;
    }
    const hit = candidates[0].item;
    const isbn = normalizeIsbn(hit.isbn);
    found.push({ id: book.id, work: book.title, isbn, title: hit.title, salesDate: hit.salesDate });
    if (isbn) record(isbn, hit);
    console.log(`  ✓ ${book.id.padEnd(28)} ${hit.title}`);
  }
  if (rejected.length) {
    console.log(`\n  照合が緩ければ当たったが、別作品と判断して除外したもの ${rejected.length}件:`);
    for (const r of rejected) console.log(`   × ${r}`);
  }
  save();
  const outFile = join(ROOT, ".cache", "text-isbn.json");
  mkdirSync(join(ROOT, ".cache"), { recursive: true });
  writeFileSync(outFile, JSON.stringify(found, null, 2) + "\n");
  console.log(`\n番組テキスト ${found.length}/${books.length}件を突き合わせ → ${outFile}`);

  // --write-text を付けたときだけ data/books/*.json の books.text を差し替える。
  // 触るのは books.text だけで、手書きの original / related には手を出さない。
  if (process.argv.includes("--write-text")) {
    for (const f of found) {
      const file = join(ROOT, "data", "books", `${f.id}.json`);
      const json = JSON.parse(readFileSync(file, "utf8"));
      json.books = json.books ?? { text: null, original: [], related: [] };
      json.books.text = {
        title: f.title.replace(/[\s　]+/g, " ").trim(),
        isbn: f.isbn,
        publishedYear: Number(String(f.salesDate ?? "").slice(0, 4)) || undefined,
      };
      writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
    }
    console.log(`data/books/*.json の books.text を ${found.length}件更新しました。`);
  } else {
    console.log("反映するには --write-text を付けて実行してください（先に上の一覧を目で確認すること）。");
  }
}
