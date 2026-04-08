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
    { id: 'ichinohe-home', title_ja: '一戸ホーム', title_en: 'Ichinohe Home', pages: 22, added: '2026-03-12' },
    { id: 'life-school', title_ja: 'ライフスクール', title_en: 'Life School', pages: 10, added: '2026-03-10' },
    { id: 'seko', title_ja: '施工会社紹介', title_en: 'Construction Company Story', pages: 8, added: '2026-03-05' },
    { id: 'sixtones', title_ja: 'SixTones', title_en: 'SixTones', pages: 10, added: '2026-03-01' },
    { id: 'life-buzfes', title_ja: 'ライフバズフェス', title_en: 'Life BuzzFes', pages: 8, added: '2026-02-28' }
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

        var titleJa = item.title_ja || '';
        var titleEn = item.title_en || titleJa;
        card.innerHTML =
          '<div class="bm-gallery-card-cover">' +
            '<img src="' + coverSrc + '" alt="' + titleJa + '" loading="lazy">' +
          '</div>' +
          '<p class="bm-gallery-card-title" data-ja="' + titleJa + '" data-en="' + titleEn + '">' + titleJa + '</p>';

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

      // 現在の言語が英語なら即座に反映（i18n システムに委譲）
      var lang = document.documentElement.lang || 'ja';
      if (lang === 'en') {
        if (window.i18n && window.i18n.translateAll) {
          window.i18n.translateAll();
        } else if (typeof window.bmSwitchLang === 'function') {
          window.bmSwitchLang('en');
        }
      }
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

  // ===== 常時スクロール（ホバーで停止しない） =====
  // 横スクロール（マウスホイール）対応
  var carousel = document.getElementById('bmGalleryCarousel');
  if (carousel) {
    carousel.addEventListener('wheel', function(e) {
      // 横スクロール（トラックパッド横スワイプ or Shift+ホイール）のみカルーセルを操作
      // 縦スクロール（deltaYが主体）はページスクロールとして通す
      var isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      var isShiftWheel = e.shiftKey && Math.abs(e.deltaY) > 0;
      if (isHorizontal || isShiftWheel) {
        var delta = isShiftWheel ? e.deltaY : e.deltaX;
        e.preventDefault();
        scrollPos += delta * 0.8;
        if (scrollPos < 0) scrollPos += singleSetWidth;
        if (singleSetWidth > 0 && scrollPos >= singleSetWidth) {
          scrollPos -= singleSetWidth;
        }
      }
      // deltaYが主体の場合はpreventDefaultしない → ページが縦スクロールする
    }, { passive: false });
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
