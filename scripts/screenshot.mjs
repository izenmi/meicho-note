// 見た目の確認用。dist/ をその場で配信してページを撮る。手動実行。
//   node scripts/screenshot.mjs                    主要ページ
//   node scripts/screenshot.mjs books/rongo/ ...   任意のパス

import { chromium } from "playwright";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { SITE } from "../config.mjs";
import { ROOT } from "../src/lib/load.mjs";

const DIST = join(ROOT, "dist");
const SHOTS = join(ROOT, "shots");
const PORT = Number(process.env.PORT || 4401);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png",
};

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["", "archive/", "genres/", "guides/", "specials/", "about/"];

const server = createServer((req, res) => {
  let path = decodeURIComponent(req.url.split("?")[0]);
  path = path.startsWith(SITE.base) ? path.slice(SITE.base.length) : path.replace(/^\//, "");
  let file = join(DIST, normalize(path));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}).listen(PORT);

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });

for (const target of targets) {
  await page.goto(`http://localhost:${PORT}${SITE.base}${target}`, { waitUntil: "networkidle" });
  const name = (target.replace(/\/$/, "").replace(/\//g, "_") || "home") + ".png";
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
  console.log(`shots/${name}`);
}

await browser.close();
server.close();
