/**
 * BizManga ホームページ — 新作漫画トラック生成
 * ContentsX の script.js 新作情報セクションと同じ仕様:
 *   - 新しい順にソート → 最大10件
 *   - 横スクロールカード表示
 *   - クリックで制作事例モーダル（openWorkDetail）
 *   - ドラッグスクロール対応
 *   - WP APIデータ到着時に再構築
 */
(function() {
  'use strict';

  var MAX_NEW_WORKS = 10;
  var track = document.getElementById('bmNewWorksTrack');
  if (!track) return;

  // ===== フォールバック用データ =====
  var FALLBACK_NEW_WORKS = [
    { id: 'bms-unso', title_ja: 'BMS運送 - 採用マンガ', pages: 10, added: '2026-03-20' },
    { id: 'kyoiku-manual', title_ja: '教育マニュアル', pages: 10, added: '2026-03-18' },
    { id: 'shohin-shokai', title_ja: '商品紹介', pages: 8, added: '2026-03-15' },
    { id: 'ichinohe-home', title_ja: '一戸ホーム', pages: 22, added: '2026-03-12' },
    { id: 'life-school', title_ja: 'ライフスクール', pages: 10, added: '2026-03-10' },
    { id: 'merumaga', title_ja: 'メルマガ漫画', pages: 6, added: '2026-03-08' },
    { id: 'seko', title_ja: '施工会社紹介', pages: 8, added: '2026-03-05' },
    { id: 'tagengo', title_ja: '多言語マンガ', pages: 10, added: '2026-03-03' },
    { id: 'sixtones', title_ja: 'SixTones', pages: 10, added: '2026-03-01' },
    { id: 'life-buzfes', title_ja: 'ライフバズフェス', pages: 8, added: '2026-02-28' }
  ];

  // ===== カード生成 =====
  function buildNewWorksCards(data) {
    // 新しい順にソート → 最大10件
    var sorted = data.slice().sort(function(a, b) {
      return new Date(b.added) - new Date(a.added);
    }).slice(0, MAX_NEW_WORKS);

    track.innerHTML = '';
    var frag = document.createDocumentFragment();

    sorted.forEach(function(item) {
      var card = document.createElement('div');
      card.className = 'bm-new-works-card';

      var coverSrc = item.thumbnail || 'https://contentsx.jp/material/manga/' + item.id + '/01.webp';

      card.innerHTML =
        '<div class="bm-new-works-card-cover">' +
          '<img src="' + coverSrc + '" alt="' + (item.title_ja || '') + '" loading="lazy" style="object-position:top center;">' +
        '</div>' +
        '<p class="bm-new-works-card-title">' + (item.title_ja || '') + '</p>';

      // クリック → 制作事例モーダル
      (function(workItem) {
        card.addEventListener('click', function() {
          if (window.openWorkDetail) {
            window.openWorkDetail(workItem.id);
          }
        });
      })(item);

      frag.appendChild(card);
    });

    track.appendChild(frag);
  }

  // ===== ドラッグスクロール =====
  var wrapper = track.parentElement;
  if (wrapper) {
    var isDragging = false;
    var startX, scrollLeft;

    wrapper.addEventListener('mousedown', function(e) {
      isDragging = true;
      wrapper.style.cursor = 'grabbing';
      startX = e.pageX - wrapper.offsetLeft;
      scrollLeft = wrapper.scrollLeft;
    });
    wrapper.addEventListener('mouseleave', function() {
      isDragging = false;
      wrapper.style.cursor = '';
    });
    wrapper.addEventListener('mouseup', function() {
      isDragging = false;
      wrapper.style.cursor = '';
    });
    wrapper.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      e.preventDefault();
      var x = e.pageX - wrapper.offsetLeft;
      wrapper.scrollLeft = scrollLeft - (x - startX);
    });
  }

  // ===== 初期表示（フォールバック） =====
  buildNewWorksCards(FALLBACK_NEW_WORKS);

  // ===== WP APIデータ到着時に再構築 =====
  window.addEventListener('bm-data-ready', function() {
    var wpData = window.BM_NEW_WORKS_DATA;
    if (wpData && wpData.length > 0) {
      buildNewWorksCards(wpData);
    }
  });
})();
