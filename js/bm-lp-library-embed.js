/**
 * BizManga LP — ビズ書庫 埋込モジュール
 * 用途別LPページに、ビズ書庫のグリッドをカテゴリ絞込みで埋め込む
 * （表紙のみ・クリックで全画面ビューア）。制作事例カードは tools/build-lp-cases.py が静的に出力する。
 *
 *   <section data-bm-lp-library data-category="紹介">
 *     <div data-bm-lp-library-grid></div>
 *   </section>
 *
 * data-category: 絞り込みカテゴリ（必須）
 */
(function() {
  'use strict';

  var LIBRARY_API = 'https://cms.contentsx.jp/wp-json/contentsx/v1/library';
  var BIZLIBRARY_BASE = '/biz-library?manga=';

  // LP のカテゴリに対応する旧カテゴリ名のマッピング（build-lp-cases.py と統一）
  var LP_CATEGORY_ALIASES = {
    '商品紹介':   ['商品紹介', '紹介'],
    '採用':       ['採用'],
    '広告':       ['広告', '集客', 'IP'],
    '会社紹介':   ['会社紹介', '企業紹介', 'ブランド'],
    '営業資料':   ['営業資料', '営業'],
    '研修':       ['研修'],
    'インバウンド': ['インバウンド', '英語版', '海外版', '多言語', '集客'],
    'IR':         ['IR']
  };

  // work が指定カテゴリにマッチするか（categories 配列 + 旧カテゴリ alias 対応）
  function workMatchesCategory(w, category) {
    var aliases = LP_CATEGORY_ALIASES[category] || [category];
    // 1. categories 配列があれば優先（WP plugin v2026-04-27 以降）
    if (Array.isArray(w.categories)) {
      for (var i = 0; i < w.categories.length; i++) {
        if (aliases.indexOf(w.categories[i]) !== -1) return true;
      }
      return false;
    }
    // 2. fallback: category 単数
    return aliases.indexOf(w.category) !== -1;
  }

  // 同一APIへの fetch を1回にまとめる簡易キャッシュ
  var cachedLibraryPromise = null;

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function renderMessage(grid, message, linkText, linkHref) {
    clearChildren(grid);
    var p = document.createElement('p');
    p.className = 'bm-lp-lib-empty';
    p.appendChild(document.createTextNode(message));
    if (linkText && linkHref) {
      p.appendChild(document.createTextNode(' '));
      var a = document.createElement('a');
      a.href = linkHref;
      a.textContent = linkText;
      p.appendChild(a);
    }
    grid.appendChild(p);
  }

  function fetchLibrary() {
    if (!cachedLibraryPromise) {
      cachedLibraryPromise = fetch(LIBRARY_API).then(function(r) { return r.json(); });
    }
    return cachedLibraryPromise;
  }

  // ===== ビズ書庫グリッド =====
  function initLibraryGrid() {
    document.querySelectorAll('[data-bm-lp-library]').forEach(function(section) {
      var category = section.getAttribute('data-category');
      var grid = section.querySelector('[data-bm-lp-library-grid]');
      if (!category || !grid) return;
      loadLibraryGrid(grid, category);
    });
  }

  function loadLibraryGrid(grid, category) {
    clearChildren(grid);
    var loading = document.createElement('p');
    loading.className = 'bm-lp-lib-loading';
    loading.textContent = '読み込み中…';
    grid.appendChild(loading);

    fetchLibrary()
      .then(function(works) {
        if (!Array.isArray(works) || works.length === 0) {
          renderMessage(grid, '作品データが取得できませんでした。', 'ビズ書庫を見る', '/biz-library');
          return;
        }
        var filtered = works.filter(function(w) { return workMatchesCategory(w, category); });
        if (filtered.length === 0) {
          renderMessage(grid, 'このカテゴリの作品はまだ登録されていません。', 'ビズ書庫で全作品を見る', '/biz-library');
          return;
        }
        renderLibraryGrid(grid, filtered);
      })
      .catch(function(err) {
        console.warn('[bm-lp-library-embed] library fetch error', err);
        renderMessage(grid, '作品の読み込みに失敗しました。', 'ビズ書庫を見る', '/biz-library');
      });
  }

  function renderLibraryGrid(grid, works) {
    clearChildren(grid);
    works.forEach(function(w) {
      var item = document.createElement('a');
      item.className = 'bm-lp-lib-item';
      item.href = BIZLIBRARY_BASE + w.id;
      item.setAttribute('aria-label', (w.title_ja || '作品') + 'を読む');

      var coverWrap = document.createElement('div');
      coverWrap.className = 'bm-lp-lib-cover';

      if (w.thumbnail) {
        var img = document.createElement('img');
        img.src = w.thumbnail;
        img.alt = w.title_ja || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 400;
        img.height = 565;
        coverWrap.appendChild(img);
      } else {
        var ph = document.createElement('div');
        ph.className = 'bm-lp-lib-placeholder';
        ph.textContent = '素材準備中';
        coverWrap.appendChild(ph);
      }

      var pages = document.createElement('span');
      pages.className = 'bm-lp-lib-pages';
      pages.textContent = (w.pages || (w.gallery && w.gallery.length) || 0) + 'P';
      coverWrap.appendChild(pages);

      item.appendChild(coverWrap);

      var meta = document.createElement('div');
      meta.className = 'bm-lp-lib-meta';
      var title = document.createElement('span');
      title.className = 'bm-lp-lib-title';
      title.textContent = w.title_ja || '無題';
      meta.appendChild(title);
      item.appendChild(meta);

      grid.appendChild(item);
    });
  }

  function init() {
    initLibraryGrid();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
