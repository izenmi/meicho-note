// URL の組み立て。dist の出力パスとHTML内のリンクを1か所で決める。
//
// 指南役・著者のidは日本語のまま(「西研」「夏目漱石」)。GitHub Pages は UTF-8 の
// パスをそのまま配信できるので、ローマ字化の対応表を人手で持つより読みやすいURLになる。
// HTMLへ書き出すときだけ encodeURIComponent を通す。

import { SITE } from "../../config.mjs";

/** サイト内リンク。先頭スラッシュなしの相対パス("books/rongo/")を受け取る。 */
export function href(path) {
  return SITE.base + path;
}

/** 絶対URL。canonical と og:url、JSON-LD に使う。 */
export function absolute(path) {
  return SITE.url + path;
}

const enc = (s) => encodeURIComponent(String(s));

export const paths = {
  home: () => "",
  book: (id) => `books/${enc(id)}/`,
  genre: (id) => `genres/${enc(id)}/`,
  guide: (id) => `guides/${enc(id)}/`,
  author: (id) => `authors/${enc(id)}/`,
  archive: () => "archive/",
  specials: () => "specials/",
  about: () => "about/",
};

/** dist に書き出すファイルパス(index.html まで含む)。 */
export function outputFile(path) {
  if (path === "") return "index.html";
  if (path.endsWith(".html")) return path;
  // URLはエンコード済みだが、ファイルシステム側は生の文字で置く
  return `${decodeURIComponent(path)}index.html`;
}
