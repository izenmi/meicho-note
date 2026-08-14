// トップの絞り込み検索。依存なし・索引は dist/data/search-index.json。
// 全162件でも数十KBなので、まとめて読んで前方一致の素朴な絞り込みで足りる。

(function () {
  var input = document.getElementById("q");
  var status = document.getElementById("search-status");
  var results = document.getElementById("search-results");
  if (!input || !results) return;

  var base = document.querySelector('link[rel="stylesheet"]').getAttribute("href").replace("assets/style.css", "");
  var items = null;
  var total = 0;

  function load() {
    if (items) return Promise.resolve(items);
    return fetch(base + "data/search-index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        items = data.map(function (d) {
          return { d: d, hay: [d.t, d.a, d.g, d.y, d.x].join(" ").toLowerCase() };
        });
        total = items.length;
        return items;
      });
  }

  function render(matches, query) {
    if (!query) {
      results.innerHTML = "";
      status.textContent = total + "件の放送から探せます。";
      return;
    }
    status.textContent = matches.length ? matches.length + "件見つかりました。" : "見つかりませんでした。作品名・著者名・指南役名でお試しください。";
    results.innerHTML = matches.length
      ? '<ul class="card-grid">' + matches.slice(0, 40).map(function (m) {
          var d = m.d;
          return '<li><a class="book-card' + (d.r ? "" : " book-card--draft") + '" href="' + base + d.u + '">' +
            '<span class="book-card__meta">' + d.y + "年" + (d.r ? "" : ' <span class="badge badge--draft">準備中</span>') + "</span>" +
            '<span class="book-card__title">' + escapeHtml(d.t) + "</span>" +
            (d.a ? '<span class="book-card__author">' + escapeHtml(d.a) + "</span>" : "") +
            (d.g ? '<span class="book-card__author">指南役：' + escapeHtml(d.g) + "</span>" : "") +
            "</a></li>";
        }).join("") + "</ul>"
      : "";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var timer = null;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var query = input.value.trim().toLowerCase();
      load().then(function (list) {
        if (!query) return render([], "");
        var terms = query.split(/\s+/);
        render(list.filter(function (item) {
          return terms.every(function (t) { return item.hay.indexOf(t) !== -1; });
        }), query);
      });
    }, 120);
  });
})();
