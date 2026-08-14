# 名著ノート（meicho-note）

NHK Eテレ『100分de名著』で取り上げられた名著を1冊ずつ解説する、**非公式の**ガイドサイト。

- 公開URL: https://izenmi.github.io/meicho-note/
- 収録: 2010年9月〜2026年8月の放送 162回分（再放送のみの月24件は各回の `reruns` に畳んである）

NHKおよび番組制作者とは一切関係がない。解説は放送内容の要約ではなく、**原著そのものを読んで書き下ろした文章**。

## 使い方

Node 22 以降が必要（このリポジトリは npm 依存をほぼ持たない。Playwright だけが devDependency で、
OG画像とスクリーンショットの手動生成にしか使わない）。

```sh
node scripts/build.mjs        # dist/ を作り直す
node scripts/check.mjs        # リンク切れ・title/description/canonical の検査
node scripts/dev.mjs          # http://localhost:4400/meicho-note/
node scripts/screenshot.mjs   # shots/ に主要ページのスクリーンショット
```

`main` への push で `.github/workflows/deploy.yml` がビルドして GitHub Pages へデプロイする。

## データの流れ

```
Wikipedia「100分de名著」
   ↓  scripts/harvest.mjs         放送作品リストを解析 → .cache/harvest.json
   ↓  scripts/scaffold.mjs        + data/meta/catalog.json → data/books/*.json の骨格
data/books/*.json                 ← 解説はここへ手で書く
   ↓  scripts/build.mjs
dist/
```

- `scripts/harvest.mjs --fetch` で Wikipedia を取り直す。表は rowspan / colspan を多用しているので
  いったんグリッドへ展開してから列名で引いている。
- `scripts/scaffold.mjs --write` は**執筆済みのフィールドを上書きしない**。事実データ（放送情報・
  再放送・出演者）だけを更新する。新しい月が放送されたら harvest → scaffold を回せば骨格が足される。
- `data/meta/catalog.json` が放送月 → URL slug とジャンルの対応表。**slug は公開後に変えない**。

## 執筆するフィールド

`data/books/<slug>.json` のうち手で書くのは以下。全部埋まると「準備中」が外れて公開扱いになる
（判定は `config.mjs` の `READY_REQUIRES` と `src/lib/load.mjs` の `isReady`）。

| フィールド | 目安 | 内容 |
| --- | --- | --- |
| `lead` | 100〜150字 | カードと meta description に出る一文 |
| `overview` | 800〜1200字 | 何が書かれた本で、なぜ読み継がれるか |
| `readingPoints` | 4本×200〜300字 | 原著の構成に沿った読みどころ。**番組の各回とは対応しない** |
| `keywords` | 3〜5語 | その本を読むのに要る言葉 |
| `whoShouldRead` | 120字程度 | こんな人に |
| `books.original` | 1〜3件 | いま手に入る版。ISBNが確実なものだけ `isbn` を入れる |
| `books.text` | 1件 | NHKテキスト。ISBNが一意に決まる |
| `books.related` | 0〜2件 | 指南役の関連書籍 |
| `originalPublishedYear` / `originCountry` | | 原著の刊行年と成立地 |
| `sourceNote` | | 事実関係で参照した資料 |

## 購入リンク

`src/lib/affiliate.mjs` が組み立てる。

- ISBN-13（978始まり）は ISBN-10 へ変換して Amazon の商品ページへ直リンク。979始まりは ISBN-10 が
  存在しないので検索URLへ落とす
- 楽天は `data/generated/covers.json` に商品ページURLがあれば直リンク、無ければ ISBN 検索 → 書名検索
- **楽天APIが返す `affiliateUrl` は他人のIDが入っているので使わない**。`config.mjs` の
  `RAKUTEN_AFFILIATE_ID` で自前で包む
- 文庫・新訳が複数ある名著は**あえて検索リンク**にしている（版で訳文も注釈も変わるため、
  こちらで1つに決め打ちしない）。UI上は「（検索）」と表記して区別する

表紙とISBNの解決は楽天ブックスAPI。認証情報は環境変数で渡す（`accessKey` は秘匿情報なので
リポジトリには置かない）。

```sh
RAKUTEN_APP_ID=xxx RAKUTEN_ACCESS_KEY=yyy node scripts/books.mjs          # 登録済みISBNの表紙を引く
RAKUTEN_APP_ID=xxx RAKUTEN_ACCESS_KEY=yyy node scripts/books.mjs --text   # 番組テキストのISBNを探す
```

認証情報が無くても購入リンクは出る（検索URLへのフォールバック）。表紙画像だけが付かない。

## OG画像

```sh
node scripts/ogimage.mjs           # 既定のOG画像と apple-touch-icon
node scripts/ogimage.mjs --books   # 解説公開済みの回のページ別OG画像
```

**SVGはSNSのカードに一切表示されない**（X・Facebook・Slackいずれも非対応）ので必ずPNGに焼く。
このコンテナには明朝体が入っていないため、OG画像はゴシックで焼かれる。

## 設計上の判断

- **姉妹サイト（ranobe-db など）とは相互リンクしない。** 単体で完結させる方針
- **各回のサブタイトルは持たない。** 通常月の第1回〜第4回の題は公開されている一覧に揃っておらず、
  NHK公式サイトはこの環境から取得できない。代わりに原著の構成に沿った「4つの勘所」を自前で立てている
- **指南役・原著者のURLは日本語のまま**（`/guides/西研/`）。GitHub Pages は UTF-8 のパスをそのまま
  配信できるので、ローマ字化の対応表を人手で持つより読みやすい。作品のslugだけはSEOを優先してローマ字
- **トップのピックアップはビルド時に固定。** 訪問のたびに並びが変わると「戻る」で迷子になる
- **解説が未執筆の回も公開する**が、`noindex` を立てて sitemap からも外す
- ページ背景は生成り、アクセントは藍。既存の姉妹サイト（黒背景）とは別系統の、読み物としての紙面
