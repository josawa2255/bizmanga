/**
 * BizManga コラム一覧 - カテゴリ絞り込み
 *
 * 特集枠（#bmColumnFeatured）と一覧カード（#bmColumnGrid）は tools/build-columns.py が書き出す
 * 静的HTML。JS が無くても全記事が出る。ここでは次だけを行う:
 *   1. 絞り込みチップを、ビルド時に埋め込んだ <script id="bm-column-data">（カテゴリと件数）から作る
 *   2. チップを押したら、data-category が一致するカードと特集枠だけを表示する
 *      （カテゴリ未設定の記事は、ビルダーが data-category="その他" を付ける）
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

  function init() {
    var data = loadData();
    var list = document.getElementById("bmColumnFilter");
    if (!data || !list) return;

    // "すべて"チップの件数
    var all = list.querySelector('[data-filter="all"]');
    if (all && data.total != null) {
      var count = document.createElement("span");
      count.className = "bm-column-filter-chip-count";
      count.textContent = String(data.total);
      all.appendChild(count);
    }
    (data.categories || []).forEach(function (c) {
      var li = document.createElement("li");
      li.appendChild(buildChip(c.name, c.name, c.count));
      list.appendChild(li);
    });

    var grid = document.getElementById("bmColumnGrid");
    var featured = document.getElementById("bmColumnFeatured");
    var featuredCard = document.getElementById("bmColumnFeaturedCard");

    function matches(el, filter) {
      return filter === "all" || (el && el.getAttribute("data-category") === filter);
    }

    function applyFilter(filter) {
      Array.prototype.forEach.call(list.querySelectorAll(".bm-column-filter-chip"), function (chip) {
        chip.classList.toggle("is-active", chip.getAttribute("data-filter") === filter);
      });
      var cards = grid ? grid.querySelectorAll(".bm-column-card") : [];
      Array.prototype.forEach.call(cards, function (card) {
        card.classList.toggle("is-filtered-out", !matches(card, filter));
      });
      // 特集枠は「すべて」か、特集記事のカテゴリと一致するときだけ（スマホは CSS で常に非表示）
      if (featured) featured.hidden = !matches(featuredCard, filter);
    }

    list.addEventListener("click", function (e) {
      var chip = e.target.closest(".bm-column-filter-chip");
      if (chip) applyFilter(chip.getAttribute("data-filter"));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
