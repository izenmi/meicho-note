// 開発用サーバー。ビルドして dist/ を配信し、リクエストのたびに変更があれば作り直す。
//   node scripts/dev.mjs [--port 4400]

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { SITE } from "../config.mjs";
import { ROOT } from "../src/lib/load.mjs";
import { build } from "./build.mjs";

const args = process.argv.slice(2);
const portArg = args.indexOf("--port");
const PORT = Number(portArg !== -1 ? args[portArg + 1] : process.env.PORT || 4400);
const DIST = join(ROOT, "dist");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

build();
console.log(`\n  http://localhost:${PORT}${SITE.base}\n`);

// 再ビルドは連打を避けるために最短1秒間隔にしておく
let lastBuild = Date.now();
function maybeRebuild() {
  if (Date.now() - lastBuild < 1000) return;
  lastBuild = Date.now();
  try {
    build({ quiet: true });
  } catch (e) {
    console.error(e.message);
  }
}

createServer((req, res) => {
  maybeRebuild();
  let path = decodeURIComponent(req.url.split("?")[0]);
  if (path.startsWith(SITE.base)) path = path.slice(SITE.base.length);
  else if (path === "/") path = "";
  else path = path.replace(/^\//, "");

  let file = join(DIST, normalize(path));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    const notFound = join(DIST, "404.html");
    res.writeHead(404, { "content-type": TYPES[".html"] });
    res.end(existsSync(notFound) ? readFileSync(notFound) : "not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}).listen(PORT);
