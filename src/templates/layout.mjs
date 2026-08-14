import { AFFILIATE_NOTICE, DISCLAIMER, SITE } from "../../config.mjs";
import { attr, each, esc, when } from "../lib/html.mjs";
import { absolute, href, paths } from "../lib/paths.mjs";

const NAV = [
  { label: "名著一覧", path: paths.archive() },
  { label: "ジャンル", path: "genres/" },
  { label: "指南役", path: "guides/" },
  { label: "スペシャル", path: paths.specials() },
  { label: "このサイトについて", path: paths.about() },
];

/**
 * 全ページ共通の外枠。
 * `path` は自分のパス("books/rongo/")。canonical と現在地ハイライトに使う。
 * `noindex` は解説が未執筆の「準備中」ページに立てる。
 */
export function layout({
  title,
  description,
  path,
  body,
  breadcrumbs = [],
  jsonLd = [],
  noindex = false,
  bodyClass = "",
  head = "",
}) {
  const fullTitle = path === "" ? `${SITE.title}｜${SITE.tagline}` : `${title}｜${SITE.title}`;
  const desc = (description || SITE.description).replace(/\s+/g, " ").slice(0, 160);
  const url = absolute(path);

  const crumbLd = breadcrumbs.length
    ? [{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.label,
          item: absolute(c.path),
        })),
      }]
    : [];

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(fullTitle)}</title>
<meta name="description" content="${attr(desc)}" />
${when(noindex, '<meta name="robots" content="noindex" />')}
<link rel="canonical" href="${attr(url)}" />
<meta property="og:type" content="${path === "" ? "website" : "article"}" />
<meta property="og:site_name" content="${attr(SITE.title)}" />
<meta property="og:title" content="${attr(fullTitle)}" />
<meta property="og:description" content="${attr(desc)}" />
<meta property="og:url" content="${attr(url)}" />
<meta property="og:image" content="${attr(absolute("og/default.png"))}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="${attr(href("favicon.svg"))}" type="image/svg+xml" />
<link rel="apple-touch-icon" href="${attr(href("apple-touch-icon.png"))}" />
<link rel="stylesheet" href="${attr(href("assets/style.css"))}" />
${head}
${each([...jsonLd, ...crumbLd], (ld) => `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`)}
</head>
<body${bodyClass ? ` class="${attr(bodyClass)}"` : ""}>
<a class="skip" href="#main">本文へスキップ</a>
<header class="site-header">
  <div class="wrap site-header__inner">
    <a class="brand" href="${attr(href(paths.home()))}">
      <span class="brand__mark" aria-hidden="true">著</span>
      <span class="brand__text">
        <span class="brand__name">${esc(SITE.title)}</span>
        <span class="brand__tagline">${esc(SITE.tagline)}</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="メインメニュー">
      ${each(NAV, (item) => {
        const current = path === item.path;
        return `<a href="${attr(href(item.path))}"${current ? ' aria-current="page"' : ""}>${esc(item.label)}</a>`;
      })}
    </nav>
  </div>
</header>
${when(breadcrumbs.length > 1, () => `
<nav class="breadcrumbs wrap" aria-label="パンくずリスト">
  ${each(breadcrumbs, (c, i) =>
    i === breadcrumbs.length - 1
      ? `<span aria-current="page">${esc(c.label)}</span>`
      : `<a href="${attr(href(c.path))}">${esc(c.label)}</a><span class="breadcrumbs__sep" aria-hidden="true">›</span>`,
  )}
</nav>`)}
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p class="site-footer__disclaimer">${esc(DISCLAIMER)}</p>
    <p class="site-footer__notice">${esc(AFFILIATE_NOTICE)}</p>
    <p class="site-footer__links">
      <a href="${attr(href(paths.about()))}">このサイトについて</a>
      <a href="${attr(href(paths.archive()))}">名著一覧</a>
      <a href="https://github.com/izenmi/${attr(SITE.repo)}" rel="noopener">GitHub</a>
    </p>
  </div>
</footer>
</body>
</html>
`;
}
