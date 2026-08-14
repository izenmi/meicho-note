// サイト全体の設定。リポジトリ名を変えるときはここの repo だけ直せばよい。
export const SITE = {
  repo: "meicho-note",
  origin: "https://izenmi.github.io",
  title: "名著ノート",
  tagline: "『100分de名著』の名著を、1冊ずつ読み解く",
  description:
    "NHK Eテレ『100分de名著』で取り上げられた名著を1冊ずつ解説する非公式ガイド。放送年月・指南役といった基本情報に加え、原著そのものの読みどころ・キーワード・入手できる版と番組テキストへのリンクをまとめています。",
  get base() {
    return `/${this.repo}/`;
  },
  get url() {
    return `${this.origin}${this.base}`;
  },
};

// 当サイトはNHKとは無関係の非公式サイト。全ページのフッターと /about/ に出す。
export const DISCLAIMER =
  "当サイトはNHKおよび『100分de名著』制作者とは一切関係のない、個人が運営する非公式サイトです。";

// アフィリエイトプログラムの規約上、リンクを含むページでの明示が必要。
export const AFFILIATE_NOTICE =
  "当サイトはAmazonアソシエイト・楽天アフィリエイトのリンクを含みます。";

// 作品のジャンル。data/books/*.json の genreId がこのキーを指す。
// order はトップページとナビでの並び順。
export const GENRES = {
  philosophy: { name: "哲学・思想", order: 1, description: "生き方と世界の見え方を根本から問い直してきた本。" },
  religion: { name: "宗教・信仰", order: 2, description: "経典と、そこから生まれた思索の系譜。" },
  "classic-jp": { name: "日本の古典", order: 3, description: "千年読み継がれてきた日本語の書物。" },
  "literature-jp": { name: "日本の文学", order: 4, description: "近代以降の日本の小説・詩・評論。" },
  "literature-world": { name: "海外の文学", order: 5, description: "翻訳で読み継がれる世界の小説と戯曲。" },
  society: { name: "社会・政治", order: 6, description: "人が集まって暮らすことの仕組みを扱った本。" },
  economy: { name: "経済・経営", order: 7, description: "お金と仕事の原理を解き明かそうとした本。" },
  history: { name: "歴史・紀行", order: 8, description: "過去の出来事と、それを見た人の記録。" },
  science: { name: "科学・自然", order: 9, description: "自然界の成り立ちと、それを見る方法。" },
  psychology: { name: "心理・精神", order: 10, description: "心のはたらきと、傷つくことをめぐる本。" },
  art: { name: "芸術・文化", order: 11, description: "表現とその背景にある文化を論じた本。" },
};

// 執筆済みとみなす条件のしきい値。下回るとビルド時に「準備中」扱いになる。
export const READY_REQUIRES = {
  lead: true,
  overview: true,
  readingPoints: 4,
};

// アフィリエイトID。いずれも公開前提の識別子なので出力HTMLに入ってよい。
// 楽天ウェブサービスの accessKey は別物(秘匿情報)。あれは環境変数からしか読まない。
export const AMAZON_ASSOCIATE_TAG = "izenmi-22";
export const RAKUTEN_AFFILIATE_ID = "563a399e.14e18d72.563a399f.79fc1b6e";
