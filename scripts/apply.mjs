// 執筆したバッチを data/books/*.json へ流し込む。
//   node scripts/apply.mjs batches/001.json
//
// バッチの形は { "<book id>": { lead, overview, readingPoints, ... } }。
// 事実データ(broadcast / reruns / special / authorIds ...)は触らない —— あちらは
// scripts/scaffold.mjs の担当で、こちらが書き換えると次の harvest で衝突する。
//
// **同じバッチを二度当てない**。適用前に「すでに執筆済みのid」を数えて表示するので、
// 意図しない上書きになっていないかを見てから --write すること。

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT } from "../src/lib/load.mjs";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("使い方: node scripts/apply.mjs <batch.json> [--write]");
  process.exit(1);
}

/** バッチで指定してよいキー。ここに無いキーは弾く(事実データの混入を防ぐ)。 */
const ALLOWED = new Set([
  "titleKana", "originalPublishedYear", "originCountry",
  "lead", "overview", "readingPoints", "keywords", "whoShouldRead",
  "books", "sourceNote",
]);

const batch = JSON.parse(readFileSync(resolve(file), "utf8"));
const TODAY = new Date().toISOString().slice(0, 10);

let applied = 0;
const overwrites = [];
const missing = [];

for (const [id, patch] of Object.entries(batch)) {
  if (id.startsWith("_")) continue; // _comment などは無視
  const target = join(ROOT, "data", "books", `${id}.json`);
  if (!existsSync(target)) { missing.push(id); continue; }

  const book = JSON.parse(readFileSync(target, "utf8"));
  const unknown = Object.keys(patch).filter((k) => !ALLOWED.has(k));
  if (unknown.length) {
    console.error(`  ! ${id}: 書き換えできないキー ${unknown.join(", ")}`);
    process.exit(1);
  }
  if (book.lead && book.overview) overwrites.push(id);

  Object.assign(book, patch, { updatedAt: TODAY });
  if (WRITE) writeFileSync(target, JSON.stringify(book, null, 2) + "\n");
  applied++;
}

console.log(`${WRITE ? "適用" : "確認(--write で適用)"}: ${applied}件`);
if (overwrites.length) console.log(`  すでに執筆済み(上書きになる): ${overwrites.join(", ")}`);
if (missing.length) console.error(`  data/books に無いid: ${missing.join(", ")}`);
if (missing.length) process.exit(1);
