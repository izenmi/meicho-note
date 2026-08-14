// テンプレートで使う最小限のHTMLヘルパー。テンプレートエンジンは入れない。

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** テキストをHTMLへ埋める。data/ の値は必ずこれを通す。 */
export function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** 属性値に使う。esc と同じだが、意図が読めるように名前を分けてある。 */
export const attr = esc;

/** 段落テキストを <p> に割る。空行区切り。 */
export function paragraphs(text) {
  if (!text) return "";
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

/** 配列を map して join する。テンプレート内の `.map(...).join("")` の定型を短くするため。 */
export function each(items, fn) {
  return items.map(fn).join("");
}

/** 条件付き出力。false/null/undefined/"" のときは空文字。 */
export function when(condition, output) {
  return condition ? (typeof output === "function" ? output() : output) : "";
}

/** 2011年5月 のような表示。 */
export function formatMonth(year, month) {
  return `${year}年${month}月`;
}

/** 2014-01-02 → 2014年1月2日 */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return iso ?? "";
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}
