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
      { key: 'pre-red-ichinohe', title: '一戸ホーム 赤入れ',             path: 'https://contentsx.jp/material/pre/red/ichinohe-red/',   pages: 20 }
    ],
    name: [
      { key: 'pre-name-fax',      title: 'BMS FAX ネーム',     path: 'https://contentsx.jp/material/pre/name/bmsfax/',         pages: 9 },
      { key: 'pre-name-ichinohe', title: '一戸ホーム ネーム',   path: 'https://contentsx.jp/material/pre/name/ichinohe-name/',  pages: 20 }
    ]
  };

  var preData = FALLBACK;
  var SCROLL_SPEED = 1.0; // px per frame
  var GAP = 8;
  var carouselCleanups = {};

  /* ---------- 漫画を開く（ビズ書庫のビューアに遷移） ---------- */
  function openManga(key) {
    window.location.href = 'biz-library?manga=' + encodeURIComponent(key);
  }

  /* ---------- カルーセル初期化（連続スクロール方式） ---------- */
  function initCarousel(type) {
    var trackId = type === 'name' ? 'bmNameTrack' : 'bmRedTrack';
    var track = document.getElementById(trackId);
    if (!track) return;
    if (carouselCleanups[type]) carouselCleanups[type]();

    var items = preData[type];
    if (!items || items.length === 0) return;

    var scrollPos = 0;
    var animId = null;
    var measureId = null;
    var singleSetWidth = 0;
    var disposed = false;

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

        var titleJa = s.title + '\uFF08' + s.page + '/' + s.totalPages + '\uFF09';
        var title = document.createElement('div');
        title.className = 'bm-pre-slide-title';
        title.textContent = titleJa;

        slide.appendChild(imgWrap);
        slide.appendChild(title);
        slide.addEventListener('click', function () {
          openManga(s.key);
        });
        frag.appendChild(slide);
      });
    }
    track.appendChild(frag);

    function normalize(position) {
      return singleSetWidth > 0
        ? ((position % singleSetWidth) + singleSetWidth) % singleSetWidth : 0;
    }

    function move(delta) {
      scrollPos = normalize(scrollPos + delta);
      track.style.transform = 'translateX(' + (-scrollPos) + 'px)';
    }

    // 回転・画面分割でカード幅が変わっても、同じカード位置を保つ。
    // computed widthはhoverの拡大を含まないため、操作中も周期が変わらない。
    function measureLoop() {
      var slideEls = track.querySelectorAll('.bm-pre-carousel-slide');
      var half = Math.floor(slideEls.length / 2);
      if (half === 0) return;
      var width = parseFloat(getComputedStyle(slideEls[0]).width);
      if (!(width > 0)) return;
      var progress = singleSetWidth > 0 ? normalize(scrollPos) / singleSetWidth : 0;
      singleSetWidth = (width + GAP) * half;
      scrollPos = progress * singleSetWidth;
      move(0);
    }

    function queueMeasure() {
      if (disposed || measureId !== null) return;
      measureId = requestAnimationFrame(function () {
        measureId = null;
        if (!disposed) measureLoop();
      });
    }

    // 自動スクロール（毎フレーム連続移動）
    function startAutoScroll() {
      if (animId) cancelAnimationFrame(animId);

      function step() {
        if (disposed) return;
        move(SCROLL_SPEED);
        animId = requestAnimationFrame(step);
      }

      animId = requestAnimationFrame(step);
    }

    // 横スクロール（マウスホイール）対応
    var carousel = track.parentElement;
    function onWheel(e) {
      // 横スクロール（トラックパッド横スワイプ or Shift+ホイール）のみカルーセルを操作
      // 縦スクロール（deltaYが主体）はページスクロールとして通す
      var isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      var isShiftWheel = e.shiftKey && Math.abs(e.deltaY) > 0;
      if (isHorizontal || isShiftWheel) {
        var delta = isShiftWheel ? e.deltaY : e.deltaX;
        e.preventDefault();
        move(delta * 0.8);
      }
      // deltaYが主体の場合はpreventDefaultしない → ページが縦スクロールする
    }
    carousel.addEventListener('wheel', onWheel, { passive: false });

    // タッチスワイプ対応
    var touchStartX = 0;
    function onTouchStart(e) {
      touchStartX = e.touches[0].clientX;
    }
    function onTouchMove(e) {
      var dx = touchStartX - e.touches[0].clientX;
      touchStartX = e.touches[0].clientX;
      move(dx);
    }
    carousel.addEventListener('touchstart', onTouchStart, { passive: true });
    carousel.addEventListener('touchmove', onTouchMove, { passive: true });

    // ボタン操作
    var prevBtn = carousel.querySelector('.prev');
    var nextBtn = carousel.querySelector('.next');
    function onPrev(e) {
      e.stopPropagation();
      move(-400);
    }
    function onNext(e) {
      e.stopPropagation();
      move(400);
    }
    if (prevBtn) prevBtn.addEventListener('click', onPrev);
    if (nextBtn) nextBtn.addEventListener('click', onNext);

    var resizeObserver = window.ResizeObserver ? new ResizeObserver(queueMeasure) : null;
    if (resizeObserver) resizeObserver.observe(carousel);
    window.addEventListener('resize', queueMeasure, { passive: true });
    queueMeasure();
    startAutoScroll();

    // API取得後の差し替えでは、以前の自走・イベント・監視を引き継がない。
    carouselCleanups[type] = function () {
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      if (measureId !== null) cancelAnimationFrame(measureId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', queueMeasure);
      carousel.removeEventListener('wheel', onWheel);
      carousel.removeEventListener('touchstart', onTouchStart);
      carousel.removeEventListener('touchmove', onTouchMove);
      if (prevBtn) prevBtn.removeEventListener('click', onPrev);
      if (nextBtn) nextBtn.removeEventListener('click', onNext);
      delete carouselCleanups[type];
    };
  }

  /* ---------- WP API から制作過程データ取得（専用エンドポイント） ---------- */
  function fetchFromAPI() {
    var apiBase = window.BM_WP_CONFIG ? window.BM_WP_CONFIG.apiBase : 'https://cms.contentsx.jp/wp-json/contentsx/v1';
    fetch(apiBase + '/preproduction')
      .then(function (r) {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then(function (data) {
        if (!data || data.length === 0) return;
        var apiRed = [];
        var apiName = [];
        data.forEach(function (item) {
          var entry = {
            key: 'pre-' + (item.type === 'akapen' ? 'red' : 'name') + '-' + item.id,
            title: item.title,
            path: '',
            pages: item.pages,
            gallery: item.gallery
          };
          if (item.type === 'akapen') {
            apiRed.push(entry);
          } else {
            apiName.push(entry);
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
