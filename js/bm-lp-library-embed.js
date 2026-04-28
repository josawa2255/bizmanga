/**
 * BizManga LP — ビズ書庫 / 制作事例 埋込モジュール
 * 用途別LPページに、ビズ書庫のグリッドや制作事例カードをカテゴリ絞込みで埋め込む。
 *
 * 使い方A（ビズ書庫グリッド：表紙のみ・クリックで全画面ビューア）:
 *   <section data-bm-lp-library data-category="紹介">
 *     <div data-bm-lp-library-grid></div>
 *   </section>
 *
 * 使い方B（制作事例カード：サムネ＋カテゴリタグ＋タイトル＋説明）:
 *   <section data-bm-lp-cases data-category="紹介" data-limit="3">
 *     <div data-bm-lp-cases-grid></div>
 *   </section>
 *
 * data-category: 絞り込みカテゴリ（必須）
 * data-limit: 表示件数の上限（任意、デフォルト無制限）
 */
(function() {
  'use strict';

  var LIBRARY_API = 'https://cms.contentsx.jp/wp-json/contentsx/v1/library';
  var WORKS_API = 'https://cms.contentsx.jp/wp-json/contentsx/v1/works?site=bizmanga';
  var BIZLIBRARY_BASE = '/biz-library?manga=';

  // LP のカテゴリに対応する旧カテゴリ名のマッピング（build-lp-cases.py と統一）
  var LP_CATEGORY_ALIASES = {
    '商品紹介':   ['商品紹介', '紹介'],
    '採用':       ['採用'],
    '広告':       ['広告', '集客', 'IP'],
    '会社紹介':   ['会社紹介', '企業紹介', 'ブランド'],
    '営業資料':   ['営業資料', '営業'],
    '研修':       ['研修'],
    'インバウンド': ['インバウンド', '英語版', '海外版', '多言語'],
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
  var cachedWorksPromise = null;

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

  function fetchWorks() {
    if (!cachedWorksPromise) {
      cachedWorksPromise = fetch(WORKS_API).then(function(r) { return r.json(); });
    }
    return cachedWorksPromise;
  }

  // ===== Mode A: ビズ書庫グリッド =====
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

  // ===== Mode B: 制作事例カード =====
  function initCases() {
    document.querySelectorAll('[data-bm-lp-cases]').forEach(function(section) {
      var category = section.getAttribute('data-category');
      var limit = parseInt(section.getAttribute('data-limit') || '0', 10);
      var grid = section.querySelector('[data-bm-lp-cases-grid]');
      if (!category || !grid) return;
      loadCases(grid, category, limit);
    });
  }

  function loadCases(grid, category, limit) {
    clearChildren(grid);
    var loading = document.createElement('p');
    loading.className = 'bm-lp-lib-loading';
    loading.textContent = '読み込み中…';
    grid.appendChild(loading);

    // /works エンドポイントは cx_comment / cx_pages 等が取得できる
    // 失敗時は /library にフォールバック
    fetchWorks()
      .then(function(works) {
        if (!Array.isArray(works) || works.length === 0) {
          throw new Error('empty works');
        }
        return works;
      })
      .catch(function() {
        return fetchLibrary();
      })
      .then(function(works) {
        if (!Array.isArray(works) || works.length === 0) {
          renderMessage(grid, '事例データが取得できませんでした。', '制作事例一覧を見る', '/works');
          return;
        }
        var filtered = works.filter(function(w) { return workMatchesCategory(w, category); });
        if (filtered.length === 0) {
          renderMessage(grid, 'このカテゴリの事例はまだ登録されていません。', '制作事例一覧を見る', '/works');
          return;
        }
        if (limit > 0) filtered = filtered.slice(0, limit);
        renderCases(grid, filtered);
      })
      .catch(function(err) {
        console.warn('[bm-lp-library-embed] cases fetch error', err);
        renderMessage(grid, '事例の読み込みに失敗しました。', '制作事例一覧を見る', '/works');
      });
  }

  function renderCases(grid, works) {
    clearChildren(grid);
    works.forEach(function(w, index) {
      var slug = w.slug || w.id;
      var card = document.createElement('a');
      card.className = 'pm-case-item' + (index % 2 === 1 ? ' pm-case-item--alt' : '');
      // 静的個別ページがある前提で /works/{slug} へ。なければ作品ビューア起動でも良い
      card.href = '/biz-library?manga=' + w.id;
      card.setAttribute('aria-label', (w.title_ja || '事例') + 'を読む');

      // 表紙（左カラム）
      var coverWrap = document.createElement('div');
      coverWrap.className = 'pm-case-cover';
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
        ph.className = 'pm-case-placeholder';
        var phSpan = document.createElement('span');
        phSpan.textContent = '素材準備中';
        ph.appendChild(phSpan);
        coverWrap.appendChild(ph);
      }
      card.appendChild(coverWrap);

      // 本文（右カラム）
      var body = document.createElement('div');
      body.className = 'pm-case-body';

      if (w.category) {
        var cat = document.createElement('span');
        cat.className = 'pm-case-cat';
        cat.textContent = w.category;
        body.appendChild(cat);
      }

      var title = document.createElement('h3');
      title.className = 'pm-case-title';
      title.textContent = w.title_ja || '無題';
      body.appendChild(title);

      // 説明文：point（制作意図）優先、なければ comment（顧客の声）
      var description = w.point || w.comment || '';
      if (description) {
        var desc = document.createElement('p');
        desc.className = 'pm-case-desc';
        if (description.length > 130) description = description.slice(0, 129) + '…';
        desc.textContent = description;
        body.appendChild(desc);
      }

      // 用途タグ（media配列）
      if (Array.isArray(w.media) && w.media.length > 0) {
        var tags = document.createElement('div');
        tags.className = 'pm-case-tags';
        w.media.forEach(function(m) {
          var pill = document.createElement('span');
          pill.className = 'pm-case-tag';
          pill.textContent = m;
          tags.appendChild(pill);
        });
        body.appendChild(tags);
      }

      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  function init() {
    initLibraryGrid();
    initCases();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
