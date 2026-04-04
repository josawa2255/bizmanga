/**
 * BizManga ホームページ — 新作漫画ギャラリーカルーセル
 * - 自動スクロール（ホバーで一時停止）
 * - 無限ループ（最後→先頭に自然に繋がる）
 * - WP APIデータ到着時に再構築
 */
(function() {
  'use strict';

  var MAX_NEW_WORKS = 10;
  var SCROLL_SPEED  = 0.6;    // px per frame
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

  var scrollPos = 0;
  var animId = null;
  var isPaused = false;
  var singleSetWidth = 0;

  // ===== カード生成 =====
  function buildGalleryCards(data) {
    var sorted = data.slice().sort(function(a, b) {
      return new Date(b.added) - new Date(a.added);
    }).slice(0, MAX_NEW_WORKS);

    track.innerHTML = '';

    // 無限ループ用に2セット分のカードを作る
    var sets = [sorted, sorted];
    sets.forEach(function(set, setIdx) {
      set.forEach(function(item) {
        var card = document.createElement('div');
        card.className = 'bm-gallery-card';

        var coverSrc = item.thumbnail || 'https://contentsx.jp/material/manga/' + item.id + '/01.webp';

        card.innerHTML =
          '<div class="bm-gallery-card-cover">' +
            '<img src="' + coverSrc + '" alt="' + (item.title_ja || '') + '" loading="lazy">' +
          '</div>' +
          '<p class="bm-gallery-card-title">' + (item.title_ja || '') + '</p>';

        // クリック → ビズ書庫で漫画を直接開く
        (function(workItem) {
          card.addEventListener('click', function() {
            location.href = 'biz-library?manga=' + workItem.id;
          });
        })(item);

        track.appendChild(card);
      });
    });

    // 1セット分の幅を計算
    requestAnimationFrame(function() {
      var cards = track.querySelectorAll('.bm-gallery-card');
      var half = Math.floor(cards.length / 2);
      if (half === 0) return;

      // 最初のセットの末尾カードの右端位置 + gap
      var lastCard = cards[half - 1];
      var gap = 28; // CSS gap
      singleSetWidth = lastCard.offsetLeft + lastCard.offsetWidth + gap;

      scrollPos = 0;
      startAutoScroll();
    });
  }

  // ===== 自動スクロール =====
  function startAutoScroll() {
    if (animId) cancelAnimationFrame(animId);

    function step() {
      if (!isPaused) {
        scrollPos += SCROLL_SPEED;

        // 1セット分スクロールしたらリセット（無限ループ）
        if (singleSetWidth > 0 && scrollPos >= singleSetWidth) {
          scrollPos -= singleSetWidth;
        }

        track.style.transform = 'translateX(' + (-scrollPos) + 'px)';
      }
      animId = requestAnimationFrame(step);
    }

    animId = requestAnimationFrame(step);
  }

  // ===== ホバーで一時停止（クリック可能にする） =====
  var carousel = document.getElementById('bmGalleryCarousel');
  if (carousel) {
    carousel.addEventListener('mouseenter', function() { isPaused = true; });
    carousel.addEventListener('mouseleave', function() { isPaused = false; });
    // タッチ操作もサポート
    carousel.addEventListener('touchstart', function() { isPaused = true; }, { passive: true });
    carousel.addEventListener('touchend', function() {
      setTimeout(function() { isPaused = false; }, 2000);
    }, { passive: true });
  }

  // ===== 初期表示（フォールバック） =====
  buildGalleryCards(FALLBACK_NEW_WORKS);

  // ===== WP APIデータ到着時に再構築 =====
  window.addEventListener('bm-data-ready', function() {
    var wpData = window.BM_NEW_WORKS_DATA;
    if (wpData && wpData.length > 0) {
      scrollPos = 0;
      if (animId) cancelAnimationFrame(animId);
      buildGalleryCards(wpData);
    }
  });
})();
