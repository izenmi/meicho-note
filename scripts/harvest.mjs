// Wikipedia「100分de名著」の放送作品リストから中間JSON(.cache/harvest.json)を起こす、
// 初回限定のスクリプト。ここでは事実データの抽出だけを行い、data/ への書き出しは
// scripts/scaffold.mjs が受け持つ(取得と整形を分けておくと再解析がやり直しやすい)。
//
//   node scripts/harvest.mjs --fetch     Wikipediaから取得し直してから解析する
//   node scripts/harvest.mjs             キャッシュ(.cache/meicho.wiki)を解析する
//
// 表は rowspan / colspan を多用しているのでいったんグリッドへ展開してから列名で引く。
// 月セルの rowspan で複数行にまたがる月(夏休みスペシャル・絵本スペシャル)があるため、
// 行ではなく「月のかたまり」を単位に組み直している。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = join(ROOT, ".cache");
const CACHE = join(CACHE_DIR, "meicho.wiki");
const OUT = join(CACHE_DIR, "harvest.json");
const SOURCE_URL =
  "https://ja.wikipedia.org/w/index.php?title=100%E5%88%86de%E5%90%8D%E8%91%97&action=raw";

const args = new Set(process.argv.slice(2));

async function loadWikitext() {
  if (args.has("--fetch") || !existsSync(CACHE)) {
    const res = await fetch(SOURCE_URL, {
      headers: { "user-agent": "meicho-note/1.0 (https://github.com/izenmi/meicho-note)" },
    });
    if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
    const text = await res.text();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE, text);
    return text;
  }
  return readFileSync(CACHE, "utf8");
}

// ------------------------------------------------------------ wikitable

/** `style="width:6em" rowspan="4"|中身` を属性と中身に割る。属性部に `=` がなければ全部が中身。 */
function splitCell(raw) {
  const m = /^([^|[\]{}]*?=[^|]*?)\|(?!\|)/.exec(raw);
  if (!m) return { attrs: {}, text: raw.trim() };
  const attrs = {};
  for (const a of m[1].matchAll(/(\w+)\s*=\s*"?([^"\s]+)"?/g)) attrs[a[1].toLowerCase()] = a[2];
  return { attrs, text: raw.slice(m[0].length).trim() };
}

/**
 * wikitable をセルの2次元グリッドへ展開する。rowspan は下の行、colspan は右の列へ
 * 同じ内容を複製し、複製側には spanned:true を立てて元セルと区別できるようにする。
 */
function parseTable(body) {
  const rows = [];
  let current = null;
  let pending = []; // rowspan の繰り越し: {col, cell, left}

  const startRow = () => {
    if (current) rows.push(current);
    current = [];
    for (const p of pending) {
      if (p.left <= 0) continue;
      while (current.length < p.col) current.push(null);
      current[p.col] = { ...p.cell, spanned: true };
      p.left--;
    }
    pending = pending.filter((p) => p.left > 0);
  };

  const addCell = (raw, isHeader) => {
    const { attrs, text } = splitCell(raw);
    const colspan = Number(attrs.colspan) || 1;
    const rowspan = Number(attrs.rowspan) || 1;
    let col = 0;
    while (current[col] !== undefined && current[col] !== null) col++;
    const cell = { text, header: isHeader, colspan, rowspan };
    for (let i = 0; i < colspan; i++) {
      while (current.length < col + i) current.push(null);
      current[col + i] = i === 0 ? cell : { ...cell, spanned: true };
      if (rowspan > 1) pending.push({ col: col + i, cell, left: rowspan - 1 });
    }
  };

  for (const line of body.split("\n")) {
    const t = line.trim();
    if (t.startsWith("|-")) {
      startRow();
    } else if (t.startsWith("!")) {
      if (!current) startRow();
      for (const part of t.slice(1).split("!!")) addCell(part, true);
    } else if (t.startsWith("|") && !t.startsWith("|+") && !t.startsWith("|}")) {
      if (!current) startRow();
      for (const part of t.slice(1).split("||")) addCell(part, false);
    }
  }
  if (current) rows.push(current);
  return rows.filter((r) => r.some(Boolean));
}

/** `; 2011年` と `===== 2020年 =====` の両方の見出し形式に続く wikitable を切り出す。 */
function extractYearTables(section) {
  const out = [];
  const re = /^(?:;\s*(\d{4})年\s*|=+\s*(\d{4})年\s*=+)$/gm;
  let m;
  while ((m = re.exec(section))) {
    const year = Number(m[1] ?? m[2]);
    const rest = section.slice(m.index);
    const open = rest.indexOf("{|");
    const close = rest.indexOf("\n|}");
    if (open === -1 || close === -1 || open > close) continue;
    out.push({ year, body: rest.slice(open, close) });
  }
  return out;
}

// --------------------------------------------------------- wiki markup

/** `[[表示|リンク先]]` を表示テキストへ。装飾・脚注を落として素のテキストにする。 */
function plain(s) {
  if (!s) return "";
  return s
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<\/ref>/g, "")
    // {{仮リンク|表記|en|Original}} 。記事側に閉じ忘れ({{仮リンク|寛容論|en|... </ref>)が
    // 複数あるので、`}}` と `</ref>` のどちらでも終端として扱う。
    .replace(/\{\{仮リンク\|([^|}]*?)\|[^}」』]*?label=([^|}]+?)(?:\}\}|<\/ref>)/g, "$2")
    .replace(/\{\{仮リンク\|([^|}]+?)(?:\|[^}」』]*?)?(?:\}\}|<\/ref>)/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[｢｣]/g, (c) => (c === "｢" ? "「" : "」"))
    .replace(/\s+/g, " ")
    .trim();
}

/** <br> 区切りを配列で返す(1セルに複数項目が入る「語り手」「内容」用)。 */
function lines(s) {
  if (!s) return [];
  return s
    .split(/<br\s*\/?>/i)
    .map((part) => plain(part))
    .filter(Boolean);
}

const QUOTE_PAIRS = [
  ["『", "』"],
  ["「", "」"],
  ["《", "》"],
];

/**
 * 「前置き『作品』『作品』」の形を前置きと作品名へ割る。
 *
 * 作品名は**末尾に連続する引用符のかたまり**を採る。前半の見出しにも引用符が入る回
 * (「第3回 多層的な文化が「病」を包む「治療文化論」」「第3回 「明治」という国家」)があり、
 * 最初の引用符から採ると見出しを作品名と取り違えるため。
 * 引用符がなければ全体を作品名とみなす(『論語』『万葉集』のような無署名の古典)。
 */
function parseWork(text) {
  const t = plain(text);
  const tail = /((?:[「『][^「」『』]*[」』][、,・/\s]*)+)$/.exec(t);
  if (tail) {
    const titles = [...tail[1].matchAll(/[「『]([^「」『』]*)[」』]/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);
    if (titles.length) return { author: t.slice(0, tail.index).trim(), title: titles[0], titles };
  }
  // 末尾に付記がある回(「老人と海」(1) など)のために、末尾一致しない場合も拾っておく。
  for (const [open, close] of QUOTE_PAIRS) {
    const first = t.indexOf(open);
    if (first === -1) continue;
    const titles = [...t.matchAll(new RegExp(`${open}([^${open}${close}]*)${close}`, "g"))]
      .map((m) => m[1].trim())
      .filter(Boolean);
    if (titles.length) return { author: t.slice(0, first).trim(), title: titles[0], titles };
  }
  return { author: "", title: t, titles: t ? [t] : [] };
}

/** 「朗読：柄本明」「語り：小口貴子」を役割ごとに分解する。 */
function parseCredits(cell) {
  const out = [];
  for (const line of lines(cell)) {
    const m = /^(朗読|語り|声|出演|生徒役|ナレーション|語り手)\s*[：:]\s*(.+)$/.exec(line);
    const role = m ? m[1] : "朗読";
    const names = (m ? m[2] : line)
      .split(/[、,／/]/)
      .map((s) => s.replace(/（[^）]*）/g, "").trim())
      .filter((s) => s && s !== "-" && s !== "―");
    for (const name of names) out.push({ role, name });
  }
  return out;
}

const COLUMN_ALIASES = {
  月: "month",
  司会: "host",
  内容: "content",
  解説ゲスト: "guide",
  解説: "guide",
  語り手その他出演者: "credits",
  語り手: "credits",
  朗読: "credits",
  アニメーション制作: "animation",
  備考: "note",
};

function columnKey(text) {
  const t = plain(text).replace(/\s/g, "");
  return COLUMN_ALIASES[t] ?? t;
}

// ------------------------------------------------- レギュラー放送の解析

function harvestRegular(section) {
  const months = [];
  const reruns = [];

  for (const { year, body } of extractYearTables(section)) {
    const rows = parseTable(body);
    if (!rows.length) continue;
    const keys = rows[0].map((c) => (c ? columnKey(c.text) : null));
    const col = (row, key, nth = 0) => {
      let seen = 0;
      for (let i = 0; i < keys.length; i++) {
        if (keys[i] !== key) continue;
        if (seen++ < nth) continue;
        return row[i]?.text ?? "";
      }
      return "";
    };

    // 月セルが rowspan でまたがる行をひとかたまりにする
    const groups = [];
    for (const row of rows.slice(1)) {
      const monthCell = row.find((c) => c && c.header);
      const month = Number(plain(monthCell?.text ?? ""));
      if (!Number.isFinite(month) || month < 1 || month > 12) continue;
      if (monthCell.spanned && groups.length) groups.at(-1).rows.push(row);
      else groups.push({ month, rows: [row] });
    }

    for (const { month, rows: groupRows } of groups) {
      // 全列を1セルでつぶした行 = その月は再放送のみ
      const wide = groupRows[0].find((c) => c && !c.spanned && !c.header && c.colspan >= 4);
      if (wide && groupRows.length === 1) {
        reruns.push({ year, month, text: plain(wide.text) });
        continue;
      }

      const hosts = [plain(col(groupRows[0], "host", 0)), plain(col(groupRows[0], "host", 1))].filter(Boolean);
      const credits = parseCredits(col(groupRows[0], "credits"));
      const note = plain(col(groupRows[0], "note"));
      const contentLines = lines(col(groupRows[0], "content"));

      // (a) 月内で複数作品を扱う月。テーブル上は2つの形で現れる。
      //   - 行を分けるもの(夏休みスペシャル・絵本スペシャル): 作品ごとに指南役が違う
      //   - 1セルに <br> で並べるもの(作家スペシャル): 指南役は月で1人
      const isMultiRow = groupRows.length > 1;
      const hasEpisodeMarkers = contentLines.some((l) => /^第\d回/.test(l));
      const labelLooksSpecial = /スペシャル\s*$/.test(contentLines[0] ?? "");
      if (isMultiRow || hasEpisodeMarkers || (labelLooksSpecial && contentLines.length > 1)) {
        const label = contentLines[0] ?? "";
        const parts = [];
        if (isMultiRow) {
          for (const row of groupRows.slice(1)) {
            const work = parseWork(col(row, "content"));
            if (!work.title) continue;
            parts.push({ author: work.author, titles: work.titles, guide: plain(col(row, "guide")) });
          }
        } else {
          const monthGuide = plain(col(groupRows[0], "guide"));
          for (const line of contentLines.slice(1)) {
            const m = /^第(\d)回\s*(.*)$/.exec(line);
            const work = parseWork(m ? m[2] : line);
            if (!work.title) continue;
            parts.push({
              no: m ? Number(m[1]) : undefined,
              subtitle: work.author.trim(),
              titles: work.titles,
              guide: monthGuide,
            });
          }
        }
        months.push({
          year, month, hosts, credits, note,
          kind: "special",
          label,
          // 「夏目漱石スペシャル」のように作家名を冠した月だけ author を立てる。
          // 「絵本スペシャル」「100分de災害を考える」はテーマ月なので author を持たない。
          author: labelLooksSpecial && !isMultiRow ? label.replace(/\s*スペシャル\s*$/, "").trim() : "",
          guides: [...new Set(parts.map((p) => p.guide).filter(Boolean))],
          parts,
        });
        continue;
      }

      // (b) 通常月。1作品(まれに関連2作)。
      const work = parseWork(contentLines.join(" "));
      if (!work.title) continue;
      months.push({
        year, month, hosts, credits, note,
        kind: "regular",
        author: work.author,
        title: work.title,
        titles: work.titles,
        guides: [plain(col(groupRows[0], "guide"))].filter(Boolean),
      });
    }
  }
  return { months, reruns };
}

// ------------------------------------------------ スペシャル放送の解析

/**
 * スペシャル放送は表ではなく箇条書き。
 *   * 2014年1月2日 22:00 - 23:40『100分de幸福論』
 *   ** 司会：伊集院光・武内陶子
 *   ** 文学部門 井原西鶴『好色一代男』『好色一代女』（解説：島田雅彦）
 */
function harvestSpecials(section) {
  const out = [];
  for (const line of section.split("\n")) {
    const top = /^\*\s+(\d{4})年(\d{1,2})月(\d{1,2})日\s*(.*)$/.exec(line);
    if (top) {
      const rest = plain(top[4]);
      const title = /[『「]([^』」]+)[』」]/.exec(rest);
      out.push({
        year: Number(top[1]), month: Number(top[2]), day: Number(top[3]),
        label: title ? title[1] : rest,
        hosts: [], credits: [], parts: [],
      });
      continue;
    }
    const sub = /^\*\*:?\s+(.*)$/.exec(line);
    if (!sub || !out.length) continue;
    const entry = out.at(-1);
    const text = plain(sub[1]);
    if (!text) continue;

    const host = /^司会\s*[：:]\s*(.+)$/.exec(text);
    if (host) { entry.hosts = host[1].split(/[・、,]/).map((s) => s.trim()).filter(Boolean); continue; }
    const credit = /^(朗読|語り|出演)\s*[：:]\s*(.+)$/.exec(text);
    if (credit) { entry.credits.push(...parseCredits(text)); continue; }

    // 「<切り口> <著者>『<作品>』（解説：<指南役>）」
    const guideMatch = /（解説\s*[：:]\s*([^）]+)）/.exec(text);
    const body = text.replace(/（解説\s*[：:]\s*[^）]+）/, "").trim();
    const work = parseWork(body);
    if (!work.title) continue;
    entry.parts.push({
      theme: work.author.trim(),   // 引用符の前に置かれた「文学部門」「世論とメディア」等 + 著者
      titles: work.titles,
      guide: guideMatch ? guideMatch[1].trim() : "",
    });
  }
  return out.filter((e) => e.parts.length);
}

// ------------------------------------------------------------------ main

const wikitext = await loadWikitext();
const regularStart = wikitext.indexOf("=== レギュラー放送 ===");
const specialStart = wikitext.indexOf("=== スペシャル放送 ===");
const radioStart = wikitext.indexOf("=== ラジオ番組");

const { months, reruns } = harvestRegular(wikitext.slice(regularStart, specialStart));
const specials = harvestSpecials(wikitext.slice(specialStart, radioStart));

mkdirSync(CACHE_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify({ months, reruns, specials }, null, 2));

const byKind = {};
for (const m of months) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
console.log(`月エントリ ${months.length}件 ${JSON.stringify(byKind)}`);
console.log(`再放送のみの月 ${reruns.length}件 / スペシャル放送 ${specials.length}件`);
console.log(`→ ${OUT}`);
