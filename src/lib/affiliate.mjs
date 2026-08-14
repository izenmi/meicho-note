// 購入リンクの組み立て。
//
// ISBNが分かっている本は商品ページへ直リンクし、分からない本は検索結果へ落とす。
// 名著そのもの(原著/翻訳)は岩波文庫・光文社古典新訳文庫…と版が何種類もあり、
// 「この版」と特定できないことが多いので検索リンクで構わない。番組テキストは
// 版が一意に決まるのでISBNが取れる。
//
// アフィリエイトIDは公開前提の識別子なので出力HTMLに入ってよい。
// 楽天ウェブサービスの accessKey とは別物 —— あちらは秘匿情報なのでここに置かない。

import { AMAZON_ASSOCIATE_TAG, RAKUTEN_AFFILIATE_ID } from "../../config.mjs";

/** ISBN-13(978始まり)をISBN-10へ。書籍のAmazon ASINはISBN-10と一致するので商品ページへ直リンクできる。
 *  979始まりはISBN-10が存在しないので undefined を返し、呼び出し側は検索URLへ落とす。 */
export function isbn13to10(isbn13) {
  if (!isbn13) return undefined;
  const d = String(isbn13).replace(/[^0-9Xx]/g, "");
  if (d.length !== 13 || !d.startsWith("978")) return undefined;
  const core = d.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(core[i]);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? "X" : String(check));
}

export function normalizeIsbn(isbn) {
  if (!isbn) return "";
  const d = String(isbn).replace(/[^0-9Xx]/g, "").toUpperCase();
  return d.length === 10 || d.length === 13 ? d : "";
}

/** Amazon。ISBN-10が作れれば商品ページ、無ければ検索結果へ。 */
export function amazonUrl({ title, author, isbn }) {
  const asin = isbn13to10(isbn) ?? (normalizeIsbn(isbn).length === 10 ? normalizeIsbn(isbn) : undefined);
  if (asin) return `https://www.amazon.co.jp/dp/${asin}/?tag=${AMAZON_ASSOCIATE_TAG}`;
  const query = [title, author].filter(Boolean).join(" ");
  const params = new URLSearchParams({ k: query, i: "stripbooks", tag: AMAZON_ASSOCIATE_TAG });
  return `https://www.amazon.co.jp/s?${params.toString()}`;
}

/** 楽天ブックス。商品ページURL(covers.json 由来)があれば直リンク、無ければISBN検索、
 *  それも無ければタイトル+著者検索。最後に必ずアフィリエイトリンクで包む。
 *  ——楽天APIが返す affiliateUrl は他人のIDが入っているので使わないこと。 */
export function rakutenUrl({ title, author, isbn, itemUrl }) {
  const cleaned = normalizeIsbn(isbn);
  const target =
    itemUrl ||
    `https://books.rakuten.co.jp/search?sitem=${encodeURIComponent(
      cleaned || [title, author].filter(Boolean).join(" "),
    )}`;
  if (!RAKUTEN_AFFILIATE_ID) return target;
  const encoded = encodeURIComponent(target);
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encoded}&m=${encoded}`;
}

/**
 * 1冊分の購入リンク一式。テンプレートはこれを受け取って並べるだけにする。
 * `covers` は data/generated/covers.json（ISBN → {coverUrl, itemUrl}）。
 */
export function buyLinks(book, covers = {}) {
  const isbn = normalizeIsbn(book?.isbn);
  const cached = isbn ? covers[isbn] : undefined;
  return {
    title: book?.title ?? "",
    author: book?.author ?? "",
    publisher: book?.publisher ?? "",
    translator: book?.translator ?? "",
    note: book?.note ?? "",
    isbn,
    coverUrl: cached?.coverUrl ?? "",
    exact: Boolean(isbn),
    amazon: amazonUrl({ title: book?.title, author: book?.author, isbn }),
    rakuten: rakutenUrl({ title: book?.title, author: book?.author, isbn, itemUrl: cached?.itemUrl }),
  };
}
