/**
 * BizManga 制作事例カード生成
 * ホーム（6件表示）・制作事例ページ（全件）共用
 */
(function() {
  'use strict';

  var grid = document.getElementById('bmWorksGrid');
  var filterContainer = document.querySelector('.bm-category-filter');
  if (!grid) return;

  // ホームページは6件、制作事例ページは全件
  var isWorksPage = document.querySelector('.bm-works-page') !== null;
  var limit = isWorksPage ? 999 : 6;

  function renderWorks(works, filterCategory) {
    grid.innerHTML = '';
    var filtered = works;
    if (filterCategory && filterCategory !== 'すべて') {
      filtered = works.filter(function(w) {
        return w.category === filterCategory || (w.tags && w.tags.indexOf(filterCategory) >= 0);
      });
    }
    var display = filtered.slice(0, limit);

    display.forEach(function(w) {
      var card = document.createElement('div');
      card.className = 'bm-work-card';
      card.addEventListener('click', function() {
        if (window.bmOpenViewer && w.gallery && w.gallery.length > 0) {
          window.bmOpenViewer(w.gallery);
        }
      });

      var imgUrl = w.thumbnail || (w.gallery && w.gallery[0]) || '';
      var pageCount = w.gallery ? w.gallery.length : 0;

      card.innerHTML =
        '<div class="bm-work-card-img">' +
          (imgUrl ? '<img src="' + imgUrl + '" alt="' + (w.title || '') + '" loading="lazy">' : '') +
          (pageCount > 0 ? '<span class="bm-work-card-badge">' + pageCount + 'P</span>' : '') +
        '</div>' +
        '<div class="bm-work-card-body">' +
          (w.category ? '<span class="bm-work-card-category">' + w.category + '</span>' : '') +
          '<h3 class="bm-work-card-title">' + (w.title || '') + '</h3>' +
          (w.tags ? '<p class="bm-work-card-tags">' + w.tags.map(function(t){return '#' + t;}).join(' ') + '</p>' : '') +
        '</div>';

      grid.appendChild(card);
    });

    // カテゴリフィルター（制作事例ページのみ）
    if (filterContainer && isWorksPage) {
      buildFilter(works);
    }
  }

  function buildFilter(works) {
    if (!filterContainer || filterContainer.children.length > 0) return;

    var categories = {};
    categories['すべて'] = works.length;
    works.forEach(function(w) {
      if (w.category) {
        categories[w.category] = (categories[w.category] || 0) + 1;
      }
    });

    Object.keys(categories).forEach(function(cat) {
      var btn = document.createElement('button');
      btn.className = 'bm-filter-btn' + (cat === 'すべて' ? ' active' : '');
      btn.textContent = cat + '(' + categories[cat] + ')';
      btn.addEventListener('click', function() {
        filterContainer.querySelectorAll('.bm-filter-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderWorks(works, cat);
      });
      filterContainer.appendChild(btn);
    });
  }

  // データ準備完了時
  window.addEventListener('bm-data-ready', function() {
    var works = window.BM_WORKS_DATA || [];
    if (works.length > 0) renderWorks(works, null);
  });
})();
