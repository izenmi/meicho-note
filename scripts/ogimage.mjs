// OG画像(SNSのカード)と apple-touch-icon を焼く。手動実行。
//   node scripts/ogimage.mjs            既定のOG画像とアイコンだけ
//   node scripts/ogimage.mjs --books    解説公開済みの回のページ別OG画像も焼く
//   node scripts/ogimage.mjs --all      全162回分を焼く（重い）
//
// **SVGのままではSNSのカードに一切表示されない**(X・Facebook・Slackいずれも非対応)。
// 必ずPNGに焼いてから og:image に指定すること。
//
// このコンテナには明朝体が入っていないため、OG画像はゴシックで焼かれる。
// サイト本体の見出し(明朝)とは印象が変わるが、閲覧者の環境に依存しない画像を作るには
// コンテナ側のフォントで焼くしかない。

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SITE } from "../config.mjs";
import { loadAll, ROOT } from "../src/lib/load.mjs";

const args = new Set(process.argv.slice(2));
const PUBLIC = join(ROOT, "public");

const escape = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const FONT = '"IPAPGothic", "IPAGothic", "Noto Sans CJK JP", sans-serif';

function ogHtml({ kicker, title, subtitle }) {
  // 長いタイトルは行数を増やさず級数を落とす
  const size = title.length > 22 ? 46 : title.length > 14 ? 58 : 72;
  return `<!doctype html><meta charset="utf-8" />
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    display: flex; flex-direction: column; justify-content: center;
    padding: 84px 96px 84px 116px;
    background: #faf7f0;
    font-family: ${FONT};
    color: #1f1c17;
    position: relative;
  }
  body::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 28px; background: #2b4a7d;
  }
  .kicker { font-size: 26px; color: #2b4a7d; letter-spacing: 0.12em; margin-bottom: 26px; }
  .title { font-size: ${size}px; font-weight: 700; line-height: 1.35; letter-spacing: 0.02em; }
  .subtitle { font-size: 32px; color: #5d564a; margin-top: 22px; }
  .footer {
    position: absolute; left: 116px; right: 96px; bottom: 62px;
    display: flex; align-items: center; gap: 16px;
    font-size: 24px; color: #8b8375;
  }
  .mark {
    width: 44px; height: 44px; display: grid; place-items: center;
    background: #2b4a7d; color: #faf7f0; font-size: 26px; border-radius: 4px;
  }
  .rule { flex: 1; height: 1px; background: #ddd4c3; }
</style>
<div class="kicker">${escape(kicker)}</div>
<div class="title">${escape(title)}</div>
${subtitle ? `<div class="subtitle">${escape(subtitle)}</div>` : ""}
<div class="footer">
  <span class="mark">著</span>
  <span>${escape(SITE.title)}</span>
  <span class="rule"></span>
  <span>${escape(subtitle ? SITE.tagline : "")}</span>
</div>`;
}

function iconHtml(size) {
  return `<!doctype html><meta charset="utf-8" />
<style>
  * { margin: 0; }
  body {
    width: ${size}px; height: ${size}px;
    display: grid; place-items: center;
    background: #2b4a7d; color: #faf7f0;
    font-family: ${FONT};
    font-size: ${Math.round(size * 0.62)}px;
    line-height: 1;
  }
</style>
<div>著</div>`;
}

const browser = await chromium.launch();

async function shoot(html, { width, height, out }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  const buffer = await page.screenshot({ type: "png" });
  mkdirSync(join(PUBLIC, out, ".."), { recursive: true });
  writeFileSync(join(PUBLIC, out), buffer);
  await page.close();
  return out;
}

mkdirSync(join(PUBLIC, "og"), { recursive: true });

await shoot(
  ogHtml({ kicker: "100分de名著 非公式ガイド", title: SITE.title, subtitle: SITE.tagline }),
  { width: 1200, height: 630, out: "og/default.png" },
);
await shoot(iconHtml(180), { width: 180, height: 180, out: "apple-touch-icon.png" });
console.log("og/default.png・apple-touch-icon.png を生成");

if (args.has("--books") || args.has("--all")) {
  const site = loadAll();
  const targets = args.has("--all") ? site.books : site.readyBooks;
  for (const book of targets) {
    await shoot(
      ogHtml({
        kicker: `${book.broadcast.year}年${book.broadcast.month}月放送`,
        title: book.title,
        subtitle: book.author,
      }),
      { width: 1200, height: 630, out: `og/books/${book.id}.png` },
    );
  }
  console.log(`ページ別OG画像 ${targets.length}件を生成`);
}

await browser.close();
