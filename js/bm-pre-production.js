/**
 * BizManga — ホーム用 制作過程カルーセル
 * ギャラリーと同じ連続スクロール方式（毎フレーム px 移動）
 * 無限ループ・横スクロール（マウスホイール）対応
 * クリックでビズ書庫のビューアに遷移
 */
(function () {
  'use strict';

  var nameTrack = document.getElementById('bmNameTrack');
  var redTrack  = document.getElementById('bmRedTrack');
  if (!nameTrack && !redTrack) return;

  /* ---------- フォールバックデータ ---------- */
  var FALLBACK = {
    red: [
      { key: 'pre-red-bms',      title: 'BMS 運送 赤入れ',              path: 'https://contentsx.jp/material/pre/red/bms-unso-red/',  pages: 8 },
      { key: 'pre-red-life',     title: 'ライフエンターテイメント 赤入れ', path: 'https://contentsx.jp/material/pre/red/life-ent-red/',   pages: 27 },
      { key: 'pre-red-ichinohe', title: '一戸ホーム 赤入れ',             path: 'https://contentsx.jp/material/pre/red/ichinohe-red/',   pages: 20 }
    ],
    name: [
      { key: 'pre-name-merumaga',  title: 'BMS メルマガ ネーム', path: 'https://contentsx.jp/material/pre/name/bms-merumaga/',   pages: 9 },
      { key: 'pre-name-fax',      title: 'BMS FAX ネーム',     path: 'https://contentsx.jp/material/pre/name/bmsfax/',         pages: 9 },
      { key: 'pre-name-ichinohe', title: '一戸ホーム ネーム',   path: 'https://contentsx.jp/material/pre/name/ichinohe-name/',  pages: 20 }
    ]
  };

  var preData = FALLBACK;
  var SCROLL_SPEED = 1.0; // px per frame
  var GAP = 8;

  /* ---------- 漫画を開く（ビズ書庫のビューアに遷移） ---------- */
  function openManga(key) {
    window.location.href = 'biz-library?manga=' + encodeURIComponent(key);
  }

  /* ---------- カルーセル初期化（連続スクロール方式） ---------- */
  function initCarousel(type) {
    var trackId = type === 'name' ? 'bmNameTrack' : 'bmRedTrack';
    var track = document.getElementById(trackId);
    if (!track) return;

    var items = preData[type];
    if (!items || items.length === 0) return;

    var scrollPos = 0;
    var animId = null;
    var singleSetWidth = 0;

    // 全ページをスライドに展開
    var allSlides = [];
    items.forEach(function (item) {
      for (var p = 1; p <= item.pages; p++) {
        var src = (item.gallery && item.gallery.length >= p)
          ? item.gallery[p - 1]
          : item.path + String(p).padStart(2, '0') + '.webp';
        allSlides.push({
          key: item.key,
          title: item.title,
          page: p,
          totalPages: item.pages,
          src: src
        });
      }
    });

    // スライドDOM生成（2セット分 = 無限ループ用）
    track.innerHTML = '';
    var frag = document.createDocumentFragment();
    // 2回繰り返してシームレスループ
    for (var rep = 0; rep < 2; rep++) {
      allSlides.forEach(function (s) {
        var slide = document.createElement('div');
        slide.className = 'bm-pre-carousel-slide';

        var imgWrap = document.createElement('div');
        imgWrap.className = 'bm-pre-slide-img-wrap';
        var img = document.createElement('img');
        img.src = s.src;
        img.alt = s.title + ' ' + s.page + 'P';
        img.loading = 'lazy';
        imgWrap.appendChild(img);

        var title = document.createElement('div');
        title.className = 'bm-pre-slide-title';
        title.textContent = s.title + '\uFF08' + s.page + '/' + s.totalPages + '\uFF09';

        slide.appendChild(imgWrap);
        slide.appendChild(title);
        slide.addEventListener('click', function () {
          openManga(s.key);
        });
        frag.appendChild(slide);
      });
    }
    track.appendChild(frag);

    // 1セット分の幅を計算
    requestAnimationFrame(function () {
      var slideEls = track.querySelectorAll('.bm-pre-carousel-slide');
      var half = Math.floor(slideEls.length / 2);
      if (half === 0) return;
      var lastCard = slideEls[half - 1];
      singleSetWidth = lastCard.offsetLeft + lastCard.offsetWidth + GAP;

      scrollPos = 0;
      startAutoScroll();
    });

    // 自動スクロール（毎フレーム連続移動）
    function startAutoScroll() {
      if (animId) cancelAnimationFrame(animId);

      function step() {
        scrollPos += SCROLL_SPEED;

        // 1セット分スクロールしたらリセット（無限ループ）
        if (singleSetWidth > 0 && scrollPos >= singleSetWidth) {
          scrollPos -= singleSetWidth;
        }

        track.style.transform = 'translateX(' + (-scrollPos) + 'px)';
        animId = requestAnimationFrame(step);
      }

      animId = requestAnimationFrame(step);
    }

    // 横スクロール（マウスホイール）対応
    var carousel = track.parentElement;
    carousel.addEventListener('wheel', function (e) {
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

    // タッチスワイプ対応
    var touchStartX = 0;
    carousel.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    carousel.addEventListener('touchmove', function (e) {
      var dx = touchStartX - e.touches[0].clientX;
      touchStartX = e.touches[0].clientX;
      scrollPos += dx;
      if (scrollPos < 0) scrollPos += singleSetWidth;
      if (singleSetWidth > 0 && scrollPos >= singleSetWidth) {
        scrollPos -= singleSetWidth;
      }
    }, { passive: true });

    // ボタン操作
    var prevBtn = carousel.querySelector('.prev');
    var nextBtn = carousel.querySelector('.next');
    if (prevBtn) prevBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      scrollPos -= 400;
      if (scrollPos < 0) scrollPos += singleSetWidth;
    });
    if (nextBtn) nextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      scrollPos += 400;
      if (singleSetWidth > 0 && scrollPos >= singleSetWidth) {
        scrollPos -= singleSetWidth;
      }
    });
  }

  /* ---------- WP API から制作過程データ取得 ---------- */
  function fetchFromAPI() {
    var apiBase = window.BM_WP_CONFIG ? window.BM_WP_CONFIG.apiBase : 'https://cms.contentsx.jp/wp-json/contentsx/v1';
    fetch(apiBase + '/works?per_page=100')
      .then(function (r) {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then(function (data) {
        if (!data || data.length === 0) return;
        var apiRed = [];
        var apiName = [];
        data.forEach(function (item) {
          if (item.akapen_gallery && item.akapen_gallery.length > 0) {
            apiRed.push({
              key: 'pre-red-' + item.slug,
              title: item.title + ' 赤入れ',
              path: '',
              pages: item.akapen_gallery.length,
              gallery: item.akapen_gallery
            });
          }
          if (item.name_gallery && item.name_gallery.length > 0) {
            apiName.push({
              key: 'pre-name-' + item.slug,
              title: item.title + ' ネーム',
              path: '',
              pages: item.name_gallery.length,
              gallery: item.name_gallery
            });
          }
        });
        if (apiRed.length > 0 || apiName.length > 0) {
          preData = {
            red: apiRed.length > 0 ? apiRed : FALLBACK.red,
            name: apiName.length > 0 ? apiName : FALLBACK.name
          };
          initCarousel('name');
          initCarousel('red');
        }
      })
      .catch(function () {
        // フォールバックのまま
      });
  }

  /* ---------- 初期化 ---------- */
  initCarousel('name');
  initCarousel('red');
  fetchFromAPI();

})();
