/**
 * BizManga — ホーム用 制作過程カルーセル
 * ネーム（下描き）と赤ペン（修正指示）を表示
 * クリックでビズ書庫のビューアで漫画を表示
 * translateX方式の無限ループ自動カルーセル
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

  /* ---------- 漫画を開く（ビズ書庫のビューアに遷移） ---------- */
  function openManga(key) {
    window.location.href = 'biz-library?manga=' + encodeURIComponent(key);
  }

  /* ---------- カルーセル初期化（translateX方式） ---------- */
  function initCarousel(type) {
    var trackId = type === 'name' ? 'bmNameTrack' : 'bmRedTrack';
    var track = document.getElementById(trackId);
    if (!track) return;

    var items = preData[type];
    if (!items || items.length === 0) return;

    var GAP = 8;
    var AUTO_INTERVAL = 2500;
    var current = 0;
    var animId = null;
    var isPaused = false;
    var lastAutoTime = 0;

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

    // スライドDOM生成
    track.innerHTML = '';
    var frag = document.createDocumentFragment();
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
      title.textContent = s.title + '（' + s.page + '/' + s.totalPages + '）';

      slide.appendChild(imgWrap);
      slide.appendChild(title);
      slide.addEventListener('click', function () {
        openManga(s.key);
      });
      frag.appendChild(slide);
    });
    track.appendChild(frag);

    var totalSlides = allSlides.length;
    var slidesPerView = window.innerWidth <= 768 ? 1 : 3;
    var maxIndex = Math.max(0, totalSlides - slidesPerView);

    function getSlideWidth() {
      if (!track.children[0]) return 0;
      return track.children[0].offsetWidth + GAP;
    }

    function goTo(index) {
      current = Math.max(0, Math.min(index, maxIndex));
      var px = current * getSlideWidth();
      track.style.transform = 'translateX(' + (-px) + 'px)';
    }

    function autoNext() {
      var next = current + 1;
      goTo(next > maxIndex ? 0 : next);
    }
    function btnNext() {
      var next = current + 3;
      goTo(next > maxIndex ? 0 : next);
    }
    function btnPrev() {
      var prev = current - 3;
      goTo(prev < 0 ? maxIndex : prev);
    }

    // ボタン
    var carousel = track.parentElement;
    var prevBtn = carousel.querySelector('.prev');
    var nextBtn = carousel.querySelector('.next');
    if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); btnPrev(); resetAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); btnNext(); resetAuto(); });

    // 自動スライド（requestAnimationFrame + 2.5秒間隔）
    function scheduleAuto() {
      if (!animId && animId !== 0) return;
      var now = Date.now();
      if (!isPaused && now - lastAutoTime >= AUTO_INTERVAL) {
        lastAutoTime = now;
        autoNext();
      }
      animId = requestAnimationFrame(scheduleAuto);
    }

    function startAuto() {
      lastAutoTime = Date.now();
      animId = requestAnimationFrame(scheduleAuto);
    }
    function stopAuto() {
      if (animId) cancelAnimationFrame(animId);
      animId = null;
    }
    function resetAuto() { stopAuto(); startAuto(); }

    startAuto();

    // ホバーで一時停止
    carousel.addEventListener('mouseenter', function () { isPaused = true; });
    carousel.addEventListener('mouseleave', function () { isPaused = false; });

    // タッチ操作
    carousel.addEventListener('touchstart', function () { isPaused = true; }, { passive: true });
    carousel.addEventListener('touchend', function () {
      setTimeout(function () { isPaused = false; }, 2000);
    }, { passive: true });
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
          // カルーセル再構築
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
