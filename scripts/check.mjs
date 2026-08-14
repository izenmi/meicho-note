// dist/ のリンク切れと参照漏れを検査する。CIでビルドの直後に走らせる。
//   node scripts/check.mjs

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SITE } from "../config.mjs";
import { ROOT } from "../src/lib/load.mjs";

const DIST = join(ROOT, "dist");
if (!existsSync(DIST)) {
  console.error("dist/ がありません。先に node scripts/build.mjs を実行してください。");
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const problems = [];

/** サイト内のパスが dist に存在するか。 */
function resolves(path) {
  const clean = decodeURIComponent(path.split("#")[0].split("?")[0]);
  if (!clean.startsWith(SITE.base)) return true; // 外部リンクは対象外
  const rel = clean.slice(SITE.base.length);
  const target = join(DIST, rel);
  if (existsSync(target) && statSync(target).isDirectory()) return existsSync(join(target, "index.html"));
  return existsSync(target) || existsSync(join(target, "index.html"));
}

let linkCount = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const rel = file.slice(DIST.length + 1);
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|#|data:)/.test(url)) continue;
    linkCount++;
    if (!resolves(url)) problems.push(`${rel}: リンク切れ ${url}`);
  }
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel}: title が空です`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) problems.push(`${rel}: description が空です`);
  if (!/rel="canonical"/.test(html)) problems.push(`${rel}: canonical がありません`);
}

// sitemap に載っているURLが実在するか
const sitemap = readFileSync(join(DIST, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  const path = loc.slice(SITE.origin.length);
  if (!resolves(path)) problems.push(`sitemap.xml: 実体のないURL ${loc}`);
}

console.log(`HTML ${htmlFiles.length}ファイル / 内部リンク ${linkCount}本 / sitemap ${locs.length}件を検査`);
if (problems.length) {
  console.error(`\n問題 ${problems.length}件:`);
  for (const p of problems.slice(0, 40)) console.error(`  - ${p}`);
  if (problems.length > 40) console.error(`  ... ほか${problems.length - 40}件`);
  process.exit(1);
}
console.log("問題なし");
