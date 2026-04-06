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

      var cardImg = document.createElement('div');
      cardImg.className = 'bm-work-card-img';
      if (imgUrl) {
        var img = document.createElement('img');
        img.src = imgUrl;
        img.alt = w.title || '';
        img.loading = 'lazy';
        cardImg.appendChild(img);
      }
      if (pageCount > 0) {
        var badge = document.createElement('span');
        badge.className = 'bm-work-card-badge';
        badge.textContent = pageCount + 'P';
        cardImg.appendChild(badge);
      }
      var cardBody = document.createElement('div');
      cardBody.className = 'bm-work-card-body';
      if (w.category) {
        var catSpan = document.createElement('span');
        catSpan.className = 'bm-work-card-category';
        catSpan.textContent = w.category;
        cardBody.appendChild(catSpan);
      }
      var titleEl = document.createElement('h3');
      titleEl.className = 'bm-work-card-title';
      titleEl.textContent = w.title || '';
      cardBody.appendChild(titleEl);
      if (w.tags) {
        var tagsP = document.createElement('p');
        tagsP.className = 'bm-work-card-tags';
        tagsP.textContent = w.tags.map(function(t){return '#' + t;}).join(' ');
        cardBody.appendChild(tagsP);
      }
      card.appendChild(cardImg);
      card.appendChild(cardBody);

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
