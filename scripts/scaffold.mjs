// .cache/harvest.json + data/meta/catalog.json から data/books/*.json と
// data/meta/{authors,guides}.json、data/specials/*.json を起こす。
//
//   node scripts/scaffold.mjs           差分を表示するだけ(書き込まない)
//   node scripts/scaffold.mjs --write   書き出す
//
// **既存ファイルの執筆済みフィールドは上書きしない**。事実データ(放送情報・再放送・出演者)
// だけを更新し、lead / overview / readingPoints などの手書き部分はそのまま残す。
// 新しい月が放送されたら harvest → scaffold を回せば骨格が足される。

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const WRITE = process.argv.includes("--write");
const TODAY = new Date().toISOString().slice(0, 10);

const harvest = JSON.parse(readFileSync(join(ROOT, ".cache", "harvest.json"), "utf8"));
const catalog = JSON.parse(readFileSync(join(DATA, "meta", "catalog.json"), "utf8"));

/**
 * Wikipedia側の表記ゆれ・セル内改行の取りこぼしを個別に補正する。
 * パーサを複雑にするより、件数の少ない例外をここに名指しで置いたほうが読みやすい。
 * 「見出しにも鉤括弧が入る回」で作品名と見出しの切れ目を誤るものが中心。
 */
const OVERRIDES = {
  "2016-03": { parts: [
    { no: 1, subtitle: "", titles: ["国盗り物語"] },
    { no: 2, subtitle: "", titles: ["花神"] },
    { no: 3, subtitle: "", titles: ["『明治』という国家"] },
    { no: 4, subtitle: "", titles: ["この国のかたち"] },
  ] },
  "2019-07": { guides: ["宮崎哲弥", "瀬名秀明"] },
  "2021-10": { parts: [
    { no: 1, subtitle: "大いなる自然との対峙", titles: ["老人と海"] },
    { no: 2, subtitle: "死闘から持ち帰った不屈の塊", titles: ["老人と海"] },
    { no: 3, subtitle: "交錯する「生」と「死」", titles: ["敗れざる者"] },
    { no: 4, subtitle: "作家ヘミングウェイ誕生の軌跡", titles: ["移動祝祭日"] },
  ] },
  "2022-03": { parts: [
    { no: 1, subtitle: "「ページの彼方」への旅", titles: ["アーサー・ゴードン・ピムの冒険"] },
    { no: 2, subtitle: "作家はジャンルを横断する", titles: ["アッシャー家の崩壊"] },
    { no: 3, subtitle: "「狩るもの」と「狩られるもの」", titles: ["黒猫"] },
    { no: 4, subtitle: "ミステリはここから生まれた", titles: ["モルグ街の殺人"] },
  ] },
  "2022-12": { parts: [
    { no: 1, subtitle: "「心の生ぶ毛」を守り育てる", titles: ["最終講義"] },
    { no: 2, subtitle: "「病」は能力である", titles: ["分裂病と人類"] },
    { no: 3, subtitle: "多層的な文化が「病」を包む", titles: ["治療文化論"] },
    { no: 4, subtitle: "精神科医が読み解く「昭和」と「戦争」", titles: ["『昭和』を送る", "戦争と平和 ある考察"] },
  ] },
  // 2017年3月は Wikipedia に各回の記載がなく、セルが「宮沢賢治スペシャル」の1行だけ。
  "2017-03": { kind: "special", label: "宮沢賢治スペシャル", author: "宮沢賢治", parts: [] },
  "2024-12": { parts: [
    { no: 1, subtitle: "", titles: ["華岡青洲の妻"] },
    { no: 2, subtitle: "", titles: ["恍惚の人"] },
    { no: 3, subtitle: "", titles: ["青い壺"] },
  ] },
};

// ------------------------------------------------------------ 人物エンティティ

/** 人名はそのままURLに使う(GitHub PagesはUTF-8のパスをそのまま配信できる)。
 *  空白と中黒前後の揺れだけ正規化して、同じ人が別idにならないようにする。 */
function personId(name) {
  return name.replace(/[\s　]+/g, "").replace(/^・|・$/g, "");
}

const authors = new Map();
const guides = new Map();

function addPerson(map, name, role) {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === "-" || cleaned === "―") return null;
  const id = personId(cleaned);
  if (!map.has(id)) map.set(id, { id, name: cleaned, description: "", externalLinks: {}, role });
  return id;
}

// --------------------------------------------------------------- 本エントリ

const monthKey = (m) => `${m.year}-${String(m.month).padStart(2, "0")}`;

/** 再放送のみの月を、元の放送エントリへ結びつける。まず作品名、外れたら年月で照合する。 */
function attachReruns(books) {
  const byTitle = new Map();
  for (const b of books) {
    for (const t of [b.title, ...(b.titles ?? [])]) {
      if (t && !byTitle.has(t)) byTitle.set(t, b);
    }
  }
  const unmatched = [];
  for (const r of harvest.reruns) {
    const quoted = [...r.text.matchAll(/[「『]([^「」『』]+)[」』]/g)].map((m) => m[1]);
    const origin = /(\d{4})年\s*(\d{1,2})月/.exec(r.text);
    let target = null;
    for (const q of quoted) if (byTitle.has(q)) { target = byTitle.get(q); break; }
    if (!target && origin) {
      target = books.find((b) => b.broadcast.year === Number(origin[1]) && b.broadcast.month === Number(origin[2]));
    }
    if (!target) {
      // 引用符なしの表記(「2022年2月 日蓮の手紙 再放送」)を素のタイトルで拾う
      target = books.find((b) => b.title && r.text.includes(b.title));
    }
    if (!target) { unmatched.push(r); continue; }
    target.reruns.push({ year: r.year, month: r.month });
  }
  return unmatched;
}

const books = [];
const skipped = [];

for (const m of harvest.months) {
  const key = monthKey(m);
  const meta = catalog[key];
  if (!meta) { skipped.push(key); continue; }
  const ov = OVERRIDES[key] ?? {};
  const kind = ov.kind ?? m.kind;
  const label = ov.label ?? m.label ?? "";
  const authorName = ov.author ?? m.author ?? "";
  const guideNames = ov.guides ?? m.guides ?? [];
  // 作品ごとに指南役が違うのは複数行に分かれた月(夏休みスペシャル系)だけ。
  // 1セルに <br> で並ぶ作家スペシャルは月で1人なので、回ごとの guide は持たせない
  // ——「宮崎哲弥 第4回ゲスト：瀬名秀明」のようにセルの注記ごと人名として拾ってしまうため。
  const perPartGuide = guideNames.length > 1 && (m.parts ?? []).some((p) => p.guide && p.guide !== m.parts[0].guide);
  const parts = (ov.parts ?? m.parts ?? []).map((p, i) => ({
    no: p.no ?? i + 1,
    subtitle: p.subtitle ?? p.author ?? "",
    titles: p.titles,
    guide: perPartGuide ? (p.guide ?? "") : "",
  }));

  books.push({
    id: meta.slug,
    title: kind === "special" ? label : m.title,
    titles: kind === "special" ? parts.flatMap((p) => p.titles) : (m.titles ?? []),
    author: authorName,
    authorIds: authorName ? [addPerson(authors, authorName, "author")].filter(Boolean) : [],
    genreId: meta.genre,
    kind,
    broadcast: {
      year: m.year,
      month: m.month,
      guideIds: guideNames.map((n) => addPerson(guides, n, "guide")).filter(Boolean),
      hosts: m.hosts ?? [],
      credits: m.credits ?? [],
      note: m.note ?? "",
    },
    reruns: [],
    special: kind === "special" ? { label, parts } : null,
  });
}

// スペシャル月の作品ごとの指南役も人物として登録する(夏休みスペシャル系)
for (const b of books) {
  if (!b.special) continue;
  for (const p of b.special.parts) if (p.guide) addPerson(guides, p.guide, "guide");
}

const unmatchedReruns = attachReruns(books);

// ---------------------------------------------------------- スペシャル放送

const specials = harvest.specials.map((s) => ({
  id: `${s.year}-${String(s.month).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`,
  label: s.label,
  airedOn: `${s.year}-${String(s.month).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`,
  hosts: s.hosts,
  credits: s.credits,
  parts: s.parts.map((p) => ({
    theme: p.theme,
    titles: p.titles,
    guideId: p.guide ? addPerson(guides, p.guide, "guide") : "",
    guide: p.guide,
  })),
}));

// ------------------------------------------------------------------ 書き出し

/** 執筆済みの手書きフィールドを引き継ぐ。ここに挙げたキーは scaffold では触らない。 */
const AUTHORED_KEYS = [
  "lead", "overview", "readingPoints", "keywords", "whoShouldRead",
  "originalPublishedYear", "originCountry", "titleKana", "books", "sourceNote",
];

const EMPTY_AUTHORED = {
  titleKana: "",
  originalPublishedYear: null,
  originCountry: "",
  lead: "",
  overview: "",
  readingPoints: [],
  keywords: [],
  whoShouldRead: "",
  books: { text: null, original: [], related: [] },
  sourceNote: "",
};

function mergeBook(next) {
  const file = join(DATA, "books", `${next.id}.json`);
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const authored = {};
  for (const k of AUTHORED_KEYS) authored[k] = prev[k] ?? EMPTY_AUTHORED[k];
  const merged = { ...next, ...authored, updatedAt: prev.updatedAt ?? TODAY };
  // キー順を安定させる(diffを読みやすくするため)
  const ordered = {};
  for (const k of [
    "id", "title", "titleKana", "titles", "author", "authorIds", "genreId", "kind",
    "originalPublishedYear", "originCountry", "broadcast", "reruns", "special",
    "lead", "overview", "readingPoints", "keywords", "whoShouldRead", "books",
    "sourceNote", "updatedAt",
  ]) ordered[k] = merged[k];
  return { file, json: JSON.stringify(ordered, null, 2) + "\n" };
}

const writes = [];
for (const b of books) writes.push(mergeBook(b));
writes.push({
  file: join(DATA, "meta", "authors.json"),
  json: JSON.stringify(mergePeople("authors", [...authors.values()]), null, 2) + "\n",
});
writes.push({
  file: join(DATA, "meta", "guides.json"),
  json: JSON.stringify(mergePeople("guides", [...guides.values()]), null, 2) + "\n",
});
writes.push({
  file: join(DATA, "specials", "specials.json"),
  json: JSON.stringify(specials, null, 2) + "\n",
});

/** 人物ファイルも description などの手書き分を残す。 */
function mergePeople(name, list) {
  const file = join(DATA, "meta", `${name}.json`);
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  const prevById = new Map(prev.map((p) => [p.id, p]));
  return list
    .map((p) => ({ ...p, ...(prevById.get(p.id) ?? {}), id: p.id, name: p.name }))
    .sort((a, b) => a.id.localeCompare(b.id, "ja"));
}

if (WRITE) {
  for (const { file, json } of writes) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, json);
  }
}

// ------------------------------------------------------------------ レポート

const existing = existsSync(join(DATA, "books"))
  ? readdirSync(join(DATA, "books")).filter((f) => f.endsWith(".json")).length
  : 0;
console.log(`${WRITE ? "書き出し" : "確認(--write で書き出し)"}: 本 ${books.length}件 / 既存ファイル ${existing}件`);
console.log(`著者 ${authors.size}人 / 指南役 ${guides.size}人 / スペシャル放送 ${specials.length}件`);
console.log(`再放送 ${harvest.reruns.length}件のうち ${harvest.reruns.length - unmatchedReruns.length}件を紐づけ`);
if (unmatchedReruns.length) {
  console.log("  紐づかなかった再放送:");
  for (const r of unmatchedReruns) console.log(`   - ${r.year}/${r.month} ${r.text}`);
}
if (skipped.length) console.log(`catalog.json に未登録のためスキップ: ${skipped.join(", ")}`);

const dupes = books.map((b) => b.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupes.length) {
  console.error(`slug が重複しています: ${[...new Set(dupes)].join(", ")}`);
  process.exit(1);
}
