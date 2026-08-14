import { AFFILIATE_NOTICE, DISCLAIMER, SITE } from "../../config.mjs";
import { esc } from "../lib/html.mjs";
import { paths } from "../lib/paths.mjs";
import { layout } from "./layout.mjs";

export function renderAbout(site) {
  return layout({
    title: "このサイトについて",
    description: "名著ノートの方針・出典・免責事項について。",
    path: paths.about(),
    breadcrumbs: [
      { label: "ホーム", path: paths.home() },
      { label: "このサイトについて", path: paths.about() },
    ],
    body: `
<div class="wrap">
  <header class="page-head">
    <h1>このサイトについて</h1>
    <p class="page-head__lead">${esc(SITE.description)}</p>
  </header>

  <section class="section">
    <h2>非公式サイトです</h2>
    <div class="prose">
      <p>${esc(DISCLAIMER)}番組の公式情報は、NHKの番組サイトをご確認ください。</p>
      <p>
        サイト名に番組名を含めていないのも、公式サイトと取り違えられないようにするためです。
        番組で扱われた名著を入り口に、原著そのものを読む人を増やしたい、というのがこのサイトの目的です。
      </p>
    </div>
  </section>

  <section class="section">
    <h2>解説の書き方</h2>
    <div class="prose">
      <p>
        各ページの「どんな本か」「100分で読み解くための4つの勘所」は、<strong>原著を読んだうえで当サイトが書き下ろした文章</strong>です。
        放送で語られた内容の要約ではありません。番組は25分×4回の構成ですが、当サイトの「4つの勘所」は
        原著の構成に沿って独自に立てたもので、各回の内容とは対応しません。
      </p>
      <p>
        Wikipedia・出版社の紹介文・番組サイトの記述をそのまま書き写すことはしていません。
        事実関係で参照した資料がある場合は、各ページの「出典メモ」に記しています。
      </p>
    </div>
  </section>

  <section class="section">
    <h2>放送情報の出典</h2>
    <div class="prose">
      <p>
        放送年月・取り上げられた作品・指南役・朗読・再放送といった事実データは、
        <a href="https://ja.wikipedia.org/wiki/100分de名著" rel="noopener">Wikipedia日本語版「100分de名著」</a>の
        放送作品リストを元にしています（CC BY-SA 4.0）。表記ゆれや取りこぼしを見つけた場合は個別に補正しています。
      </p>
      <p>
        なお<strong>通常月の各回のサブタイトルは収録していません</strong>。公開されている一覧に揃っていないためです。
        スペシャル回など、各回の題が判明しているものについてはそのまま掲載しています。
      </p>
    </div>
  </section>

  <section class="section">
    <h2>書籍リンクについて</h2>
    <div class="prose">
      <p>${esc(AFFILIATE_NOTICE)}リンクを経由して商品が購入された場合、当サイトに紹介料が入ることがあります。</p>
      <p>
        ISBNが特定できる本（番組テキストなど）は商品ページへ直接リンクし、
        文庫・新訳が複数ある名著は<strong>「（検索）」と表記した検索結果へのリンク</strong>にしています。
        版によって訳文も注釈も大きく変わるため、当サイトで1つに決め打ちしないほうがよいと考えているためです。
      </p>
      <p>表紙画像は当サイトでは保管せず、各ストアが配信している画像を参照しています。価格・在庫はリンク先でご確認ください。</p>
    </div>
  </section>

  <section class="section">
    <h2>収録状況</h2>
    <div class="prose">
      <p>
        全${esc(site.books.length)}回のうち、解説を公開しているのは${esc(site.readyBooks.length)}件です。
        残りは放送情報のみのページとして公開し、解説を書き終えたものから順に差し替えています。
      </p>
    </div>
  </section>
</div>`,
  });
}
