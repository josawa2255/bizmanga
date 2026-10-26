/**
 * BizManga コラム一覧 - カテゴリフィルタ & Featured注入
 *
 * column.html の <script id="bm-column-data"> にビルド時に埋め込まれた
 * データを読み、以下を実行する:
 *   1. Featured記事セクションに最新1件を注入
 *   2. フィルターチップをカテゴリ一覧から生成
 *   3. チップクリックで data-category マッチのカードのみ表示
 */
(function () {
  "use strict";

  function loadData() {
    var el = document.getElementById("bm-column-data");
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      console.warn("[bm-column-filter] invalid data JSON", e);
      return null;
    }
  }

  function renderFeatured(data) {
    var f = data && data.featured;
    if (!f) return;
    var section = document.getElementById("bmColumnFeatured");
    var card = document.getElementById("bmColumnFeaturedCard");
    var img = document.getElementById("bmColumnFeaturedImg");
    var date = document.getElementById("bmColumnFeaturedDate");
    var cat = document.getElementById("bmColumnFeaturedCat");
    var title = document.getElementById("bmColumnFeaturedTitle");
    var excerpt = document.getElementById("bmColumnFeaturedExcerpt");
    if (!section || !card) return;

    card.href = "/column/" + f.slug;
    card.setAttribute("data-category", f.category || "");
    if (img) {
      img.src = f.thumbnail;
      img.alt = f.title;
    }
    if (date) date.textContent = f.date;
    if (cat) {
      if (f.category) {
        cat.textContent = f.category;
        cat.style.display = "";
      } else {
        cat.style.display = "none";
      }
    }
    if (title) title.textContent = f.title;
    if (excerpt) excerpt.textContent = f.excerpt;
    section.style.display = "";
  }

  function buildChip(label, filterValue, count) {
    var btn = document.createElement("button");
    btn.className = "bm-column-filter-chip";
    btn.setAttribute("data-filter", filterValue);
    btn.appendChild(document.createTextNode(label));
    if (count != null) {
      var sp = document.createElement("span");
      sp.className = "bm-column-filter-chip-count";
      sp.textContent = String(count);
      btn.appendChild(sp);
    }
    return btn;
  }

  function renderFilterChips(data, grid) {
    var list = document.getElementById("bmColumnFilter");
    if (!list || !data) return;
    var cats = data.categories || [];

    // "すべて"チップの件数を更新
    var all = list.querySelector('[data-filter="all"]');
    if (all && data.total != null) {
      var count = document.createElement("span");
      count.className = "bm-column-filter-chip-count";
      count.textContent = String(data.total);
      all.appendChild(count);
    }

    cats.forEach(function (c) {
      var li = document.createElement("li");
      li.appendChild(buildChip(c.name, c.name, c.count));
      list.appendChild(li);
    });

    var featured = document.getElementById("bmColumnFeatured");
    var updateActive = function (filter) {
      Array.prototype.forEach.call(
        list.querySelectorAll(".bm-column-filter-chip"),
        function (c) {
          if (c.getAttribute("data-filter") === filter) {
            c.classList.add("is-active");
          } else {
            c.classList.remove("is-active");
          }
        }
      );
      var cards = grid ? grid.querySelectorAll(".bm-column-card") : [];
      Array.prototype.forEach.call(cards, function (card) {
        if (filter === "all") {
          card.classList.remove("is-filtered-out");
        } else {
          // data-category属性を優先、無ければバッジテキストから推定（キャッシュ耐性）
          var cat = card.getAttribute("data-category");
          if (!cat) {
            var badge = card.querySelector(".bm-column-card-cat");
            cat = badge ? badge.textContent.trim() : "";
          }
          if (cat === filter) card.classList.remove("is-filtered-out");
          else card.classList.add("is-filtered-out");
        }
      });
      // Featuredは「すべて」or カテゴリ一致時のみ表示
      if (featured) {
        var fCard = document.getElementById("bmColumnFeaturedCard");
        var fCat = fCard ? fCard.getAttribute("data-category") : "";
        if (filter === "all" || filter === fCat) {
          featured.style.display = "";
        } else {
          featured.style.display = "none";
        }
      }
    };

    list.addEventListener("click", function (e) {
      var t = e.target.closest(".bm-column-filter-chip");
      if (!t) return;
      updateActive(t.getAttribute("data-filter"));
      scrollToListTop(featured, grid);
    });
  }

  /* 追従しているチップを一覧の途中・下で押したとき、絞り込んだ結果の先頭を
     フィルター帯のすぐ下へ戻す（そのままだと結果が画面の上に外れて何も無いように見える。PR #78 レビュー）。
     先頭 = 表示中の特集記事（スマホと絞り込み外では非表示）、無ければカード一覧。
     送り先の計算は全ページ共通の window.bmScrollBelowSticky（js/bm-nav.js）。
     一覧の先頭より上にいるとき（帯がまだ貼り付いていないとき）は動かさない（onlyIfBelow）。 */
  function scrollToListTop(featured, grid) {
    if (!grid || !window.bmScrollBelowSticky) return;
    var first = featured && featured.offsetParent !== null ? featured : grid;
    window.bmScrollBelowSticky(first, document.querySelector(".bm-column-filter"), { onlyIfBelow: true });
  }

  function init() {
    var data = loadData();
    if (!data) return;
    var grid = document.getElementById("bmColumnGrid");

    renderFeatured(data);
    renderFilterChips(data, grid);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
