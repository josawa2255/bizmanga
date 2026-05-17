/**
 * BizManga ホームページ — 漫画ギャラリー (横読み / 縦読み 一覧グリッド)
 * - キーエンス風グリッド表示 (4-5 列)
 * - 横読み / 縦読み の 2 グループに分けて表示
 * - WP API データ到着時に再描画
 */
(function() {
  'use strict';

  var MAX_PER_GROUP = 10;
  var gridManga = document.getElementById('bmGalleryGridManga');
  var gridWebtoon = document.getElementById('bmGalleryGridWebtoon');
  if (!gridManga && !gridWebtoon) return;

  // ===== フォールバック用データ (sitemap除外作品は載せない) =====
  var FALLBACK_WORKS = [
    { id: 'ichinohe-home', title_ja: '一戸ホーム', title_en: 'Ichinohe Home', pages: 22, added: '2026-03-12' },
    { id: 'seko', title_ja: '施工会社紹介', title_en: 'Construction Company Story', pages: 8, added: '2026-03-05' },
    { id: 'life-buzfes', title_ja: 'ライフバズフェス', title_en: 'Life BuzzFes', pages: 8, added: '2026-02-28' }
  ];

  var allWorksData = [];

  function isWebtoon(item) {
    return window.bmViewType ? window.bmViewType.isForcedVertical(item) : false;
  }

  function renderCard(item) {
    var card = document.createElement('div');
    card.className = 'bm-gallery-card';

    var coverSrc = item.thumbnail || 'https://contentsx.jp/material/manga/' + item.id + '/01.webp';
    var titleJa = item.title_ja || '';
    var titleEn = item.title_en || titleJa;
    var labelJa = item.subtitle_ja || titleJa;
    var labelEn = item.subtitle_en || titleEn;

    var coverWrap = document.createElement('div');
    coverWrap.className = 'bm-gallery-card-cover';
    var img = document.createElement('img');
    img.src = coverSrc;
    img.alt = titleJa;
    img.loading = 'lazy';
    coverWrap.appendChild(img);

    var titleEl = document.createElement('p');
    titleEl.className = 'bm-gallery-card-title';
    titleEl.setAttribute('data-ja', labelJa);
    titleEl.setAttribute('data-en', labelEn);
    titleEl.textContent = labelJa;

    card.appendChild(coverWrap);
    card.appendChild(titleEl);

    card.addEventListener('click', function() {
      location.href = 'biz-library?manga=' + item.id;
    });

    return card;
  }

  function buildGroup(grid, data) {
    if (!grid) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    /* WP /works-new は cx_sort_order 昇順で返ってくる（sort_order 0 は末尾扱い） */
    var sorted = data.slice();
    var hasOrder = sorted.some(function(d) { return d && typeof d.sort_order === 'number' && d.sort_order > 0; });
    if (hasOrder) {
      sorted.sort(function(a, b) {
        var ao = (typeof a.sort_order === 'number' && a.sort_order > 0) ? a.sort_order : 9999;
        var bo = (typeof b.sort_order === 'number' && b.sort_order > 0) ? b.sort_order : 9999;
        if (ao !== bo) return ao - bo;
        return new Date(b.added || 0) - new Date(a.added || 0);
      });
    } else {
      var hasAdded = sorted.some(function(d) { return d && d.added; });
      if (hasAdded) {
        sorted.sort(function(a, b) { return new Date(b.added || 0) - new Date(a.added || 0); });
      }
    }
    sorted = sorted.slice(0, MAX_PER_GROUP);

    var groupEl = grid.closest('.bm-gallery-group');
    if (sorted.length === 0) {
      if (groupEl) groupEl.hidden = true;
      return;
    }
    if (groupEl) groupEl.hidden = false;

    sorted.forEach(function(item) { grid.appendChild(renderCard(item)); });
  }

  function buildAll() {
    var mangaItems = allWorksData.filter(function(d) { return !isWebtoon(d); });
    var webtoonItems = allWorksData.filter(isWebtoon);

    buildGroup(gridManga, mangaItems);
    buildGroup(gridWebtoon, webtoonItems);

    // 全体が空なら empty メッセージ
    var emptyEl = document.getElementById('bmGalleryEmpty');
    if (emptyEl) {
      emptyEl.hidden = (mangaItems.length + webtoonItems.length) > 0;
    }

    // 英語表示中なら i18n を再適用
    var lang = document.documentElement.lang || 'ja';
    if (lang === 'en') {
      if (window.i18n && window.i18n.translateAll) {
        window.i18n.translateAll();
      } else if (typeof window.bmSwitchLang === 'function') {
        window.bmSwitchLang('en');
      }
    }
  }

  // ===== 初期表示 (フォールバック) =====
  allWorksData = FALLBACK_WORKS;
  buildAll();

  // ===== WP API データ到着時に再構築 =====
  // ホームのギャラリー枠は /works-new?site=bizmanga (= BM_NEW_WORKS_DATA) を優先。
  // WP側で cx_show_gallery_bizmanga=1 の作品のみが入っているため、ここでは追加フィルタ不要。
  // /works-new が空 or 未取得の場合は BM_WORKS_DATA で後方互換フォールバック。
  function refreshFromWp() {
    var wpData = window.BM_NEW_WORKS_DATA;
    if (!wpData || !wpData.length) wpData = window.BM_WORKS_DATA;
    if (wpData && wpData.length > 0) {
      allWorksData = wpData;
      buildAll();
    }
  }
  window.addEventListener('bm-data-ready', refreshFromWp);
  window.addEventListener('bm-all-data-ready', refreshFromWp);
})();
