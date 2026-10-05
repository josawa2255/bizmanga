(function() {
    'use strict';

    var params = new URLSearchParams(location.search);
    var mangaId = params.get('manga') || '';
    var speed = parseFloat(params.get('speed') || '0.5'); // px/frame
    // ltr=1: 横カルーセルをLTR方向(左→右)に流す（右タイル用）
    var ltr = params.get('ltr') === '1' || params.get('reverse') === '1';
    // slides=1: 1ページずつフェード遷移する slideshow モード
    var slidesMode = params.get('slides') === '1';
    var slideInterval = parseInt(params.get('interval') || '2000', 10);
    // manual=1: 自動再生(縦スクロール/スライド)を止め、矢印ボタン + 手動操作にする
    var manual = params.get('manual') === '1';
    // hold=1: 親から postMessage('s3d-start') を受け取るまで自動再生を保留する
    var holdMode = params.get('hold') === '1';
    var holdReleased = !holdMode;
    var pendingStarter = null;
    if (holdMode) {
      window.addEventListener('message', function(e) {
        var d = e && e.data;
        if (!d) return;
        if (d === 's3d-start' || d.type === 's3d-start') {
          holdReleased = true;
          if (pendingStarter) { var fn = pendingStarter; pendingStarter = null; fn(); }
        }
      });
    }
    function gateStart(fn) {
      if (holdReleased) fn();
      else pendingStarter = fn;
    }

    // ============ 手動操作UI: 矢印ボタン + 操作ガイド ============
    var CHEVRON = {
      left:  'M15 18l-6-6 6-6', right: 'M9 18l6-6-6-6',
      up:    'M6 15l6-6 6 6',   down:  'M6 9l6 6 6-6'
    };
    var SVGNS = 'http://www.w3.org/2000/svg';
    function makeNav(modifier, dir, label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ev-nav ev-nav--' + modifier;
      b.setAttribute('aria-label', label);
      var svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2.4');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      var path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', CHEVRON[dir]);
      svg.appendChild(path);
      b.appendChild(svg);
      return b;
    }
    // 横読み用 左右タップゾーン（side=配置, chevronDir=向きヒント）
    function makeTapZone(side, chevronDir, label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ev-tap ev-tap--' + side;
      b.setAttribute('aria-label', label);
      var svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2.4');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      var path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', CHEVRON[chevronDir]);
      svg.appendChild(path);
      b.appendChild(svg);
      return b;
    }

    if (!mangaId) {
      document.getElementById('loading').textContent = 'NO MANGA ID';
      return;
    }

    var loading = document.getElementById('loading');
    var viewer  = document.getElementById('viewer');
    var vStack  = document.getElementById('vStack');
    var hStrip  = document.getElementById('hStrip');
    var sSlides = document.getElementById('sSlides');

    var WP_API = 'https://cms.contentsx.jp/wp-json/contentsx/v1';

    function render(data) {
      if (!data || !data.gallery || data.gallery.length === 0) {
        loading.textContent = 'NO PAGES';
        return;
      }
      loading.style.display = 'none';

      if (slidesMode) {
        renderSlides(data);
        return;
      }
      var isVertical = data.view_type === 'vertical_only' || data.view_type === 'vertical';
      if (isVertical) renderVertical(data);
      else renderHorizontal(data);
    }

    // ============ スライドショー: 1ページずつ interval 秒でフェード切替 ============
    function renderSlides(data) {
      viewer.classList.add('is-slides');
      sSlides.style.display = '';
      vStack.style.display = 'none';
      hStrip.style.display = 'none';

      data.gallery.forEach(function(src, i) {
        var img = document.createElement('img');
        img.src = src;
        img.alt = (data.title_ja || mangaId) + ' p' + (i + 1);
        img.loading = i < 2 ? 'eager' : 'lazy';
        img.decoding = 'async';
        if (i === 0) img.className = 'is-active';
        sSlides.appendChild(img);
      });
      if (manual) { waitImages(sSlides, setupSlidesManual); return; }
      waitImages(sSlides, function() { gateStart(startSlides); });
    }

    // 手動スライド: 画面の左半分タップ=次 / 右半分タップ=前（右綴じ漫画式）
    var slidesManualDone = false;
    function setupSlidesManual() {
      if (slidesManualDone) return;
      slidesManualDone = true;
      var imgs = sSlides.querySelectorAll('img');
      if (!imgs.length) return;
      var idx = 0;
      var last = imgs.length - 1;
      // 左ゾーン=次へ進む、右ゾーン=前へ戻る
      var zoneNext = makeTapZone('left', 'right', '次のページへ');  // 左半分・chevron右向き
      var zonePrev = makeTapZone('right', 'left', '前のページへ');  // 右半分・chevron左向き
      function show(n) {
        // ループしない: 1ページ目より前 / 最終ページより後ろには進まない
        var clamped = Math.max(0, Math.min(last, n));
        if (clamped === idx) return;
        imgs[idx].classList.remove('is-active');
        idx = clamped;
        imgs[idx].classList.add('is-active');
        zoneNext.disabled = idx === last; // 最終ページでは「次」無効
        zonePrev.disabled = idx === 0;     // 1ページ目では「前」無効
      }
      zonePrev.disabled = true;            // 初期は1ページ目
      zoneNext.disabled = last === 0;
      zoneNext.addEventListener('click', function() { show(idx + 1); });
      zonePrev.addEventListener('click', function() { show(idx - 1); });
      document.body.appendChild(zoneNext);
      document.body.appendChild(zonePrev);
      // 漫画の上に「漫画を読む」開始ボタン。タップ後に左右タップゾーンで操作開始
      addReadOverlay();
      // 操作ガイドは親ページ側で端末の直下に表示する（iframe内には出さない）
    }

    var slidesStarted = false;
    function startSlides() {
      if (slidesStarted) return;
      slidesStarted = true;
      var imgs = sSlides.querySelectorAll('img');
      if (imgs.length <= 1) return;
      var idx = 0;
      setInterval(function() {
        imgs[idx].classList.remove('is-active');
        idx = (idx + 1) % imgs.length;
        imgs[idx].classList.add('is-active');
      }, slideInterval);
    }

    // ============ 縦スクロール: 縦に自動スクロール ============
    function renderVertical(data) {
      viewer.classList.add('is-vertical');
      vStack.style.display = '';
      hStrip.style.display = 'none';

      // 自動スクロールは無限ループ用に2セット複製。手動は1セットのみ。
      var reps = manual ? 1 : 2;
      for (var rep = 0; rep < reps; rep++) {
        data.gallery.forEach(function(src, i) {
          var img = document.createElement('img');
          img.src = src;
          img.alt = (data.title_ja || mangaId) + ' p' + (i + 1);
          img.loading = rep === 0 ? 'eager' : 'lazy';
          img.decoding = 'async';
          vStack.appendChild(img);
        });
      }
      if (manual) { waitImages(vStack, setupVerticalManual); return; }
      waitImages(vStack, function() { gateStart(startVerticalScroll); });
    }

    // 漫画の上に「漫画を読む」開始ボタンを表示。タップでオーバーレイ除去＋onStart実行。
    // 縦読み・横読み共通（タップという明確なジェスチャーを起点に操作可能化する）
    function addReadOverlay(onStart) {
      var overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = 'ev-read-overlay';
      overlay.setAttribute('aria-label', '漫画を読む');

      var pill = document.createElement('span');
      pill.className = 'ev-read-btn';
      var svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'currentColor');
      svg.setAttribute('aria-hidden', 'true');
      var path = document.createElementNS(SVGNS, 'path');
      // 見開き本のアイコン
      path.setAttribute('d', 'M3 4a2 2 0 0 0-2 2v12a1 1 0 0 0 1 1h8a1 1 0 0 1 1 1 1 1 0 0 0 2 0 1 1 0 0 1 1-1h8a1 1 0 0 0 1-1V6a2 2 0 0 0-2-2h-6a3 3 0 0 0-3 1.2A3 3 0 0 0 9 4H3zm8 3.5V18a3 3 0 0 0-1-.17H3V6h6a2 2 0 0 1 2 1.5zm2 0A2 2 0 0 1 15 6h6v11.83h-7a3 3 0 0 0-1 .17V7.5z');
      svg.appendChild(path);
      var label = document.createElement('span');
      label.textContent = '漫画を読む';
      pill.appendChild(svg);
      pill.appendChild(label);
      overlay.appendChild(pill);

      overlay.addEventListener('click', function() {
        overlay.remove();
        try { viewer.focus({ preventScroll: true }); } catch (e) { try { viewer.focus(); } catch (e2) {} }
        if (typeof onStart === 'function') onStart();
      });
      document.body.appendChild(overlay);
    }

    // 手動縦スクロール: 「漫画を読む」タップ後、指/ホイールで自由スクロール
    var verticalManualDone = false;
    function setupVerticalManual() {
      if (verticalManualDone) return;
      verticalManualDone = true;
      // スクロールできるよう viewer をフォーカス可能に
      viewer.setAttribute('tabindex', '0');
      viewer.style.outline = 'none';

      // 入れ子iframe＋角丸mask環境ではネイティブの縦スクロールが効かないことがあるため、
      // ドラッグ/ホイールで scrollTop を直接動かして確実にページ送りできるようにする
      var lastY = 0;
      viewer.addEventListener('touchstart', function(e) {
        lastY = e.touches[0].clientY;
      }, { passive: true });
      viewer.addEventListener('touchmove', function(e) {
        var y = e.touches[0].clientY;
        viewer.scrollTop -= (y - lastY);
        lastY = y;
        e.preventDefault(); // ネイティブと二重に動かさない
      }, { passive: false });
      viewer.addEventListener('wheel', function(e) {
        viewer.scrollTop += e.deltaY;
        e.preventDefault();
      }, { passive: false });

      addReadOverlay();
      // 操作ガイドは親ページ側で端末の直下に表示する（iframe内には出さない）
    }

    var vStarted = false;
    function startVerticalScroll() {
      if (vStarted) return;
      vStarted = true;
      var halfHeight = viewer.scrollHeight / 2;
      var paused = false;
      var hoverPause = false;
      var resumeTimer = null;

      viewer.addEventListener('mouseenter', function() { hoverPause = true; });
      viewer.addEventListener('mouseleave', function() { hoverPause = false; });
      document.addEventListener('mouseover', function() { hoverPause = true; });
      document.addEventListener('mouseout', function(e) {
        if (!e.relatedTarget) hoverPause = false;
      });
      viewer.addEventListener('wheel', function() {
        paused = true;
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(function() { paused = false; }, 2000);
      }, { passive: true });

      function tick() {
        if (!paused && !hoverPause) {
          viewer.scrollTop += speed;
          if (viewer.scrollTop >= halfHeight) viewer.scrollTop -= halfHeight;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    // ============ 横カルーセル ============
    // 通常モード: 右→左へ流れる(左タイル用)。初期表示は p1 が左端。
    // ltr モード: 左→右へ流れる(右タイル用)。初期表示は p1 が右端。
    //   DOM を gallery.reverse() にすることで、各セットの右端が p1 になる。
    //   strip 全体を [pN, pN-1, ..., p1, pN, pN-1, ..., p1] の2セット複製。
    //   scroll は pos 減算(strip 右シフト)で LTR 方向。
    function renderHorizontal(data) {
      viewer.classList.add('is-horizontal');
      hStrip.style.display = '';
      vStack.style.display = 'none';

      var pages = ltr ? data.gallery.slice().reverse() : data.gallery;

      for (var rep = 0; rep < 2; rep++) {
        pages.forEach(function(src, i) {
          var img = document.createElement('img');
          img.src = src;
          // ltr時は reverse 後のインデックス i からオリジナルページ番号を逆算
          var origIdx = ltr ? (pages.length - i) : (i + 1);
          img.alt = (data.title_ja || mangaId) + ' p' + origIdx;
          img.loading = rep === 0 ? 'eager' : 'lazy';
          img.decoding = 'async';
          hStrip.appendChild(img);
        });
      }
      waitImages(hStrip, function() { gateStart(startHorizontalScroll); });
    }

    var hStarted = false;
    function startHorizontalScroll() {
      if (hStarted) return;
      hStarted = true;

      var halfWidth = hStrip.scrollWidth / 2;
      var firstImg = hStrip.querySelector('img');
      var pageW = firstImg ? firstImg.offsetWidth : 0;
      var viewW = viewer.clientWidth;

      var paused = false;
      var hoverPause = false;
      var resumeTimer = null;

      // 初期位置:
      //   通常(右→左): pos=0 → p1 が viewport 左端
      //   LTR(左→右): pos=halfWidth-viewW → 各セット右端の p1 が viewport 右端
      var pos = ltr ? Math.max(0, halfWidth - viewW) : 0;
      hStrip.style.transform = 'translateX(' + (-pos) + 'px)';

      viewer.addEventListener('mouseenter', function() { hoverPause = true; });
      viewer.addEventListener('mouseleave', function() { hoverPause = false; });
      document.addEventListener('mouseover', function() { hoverPause = true; });
      document.addEventListener('mouseout', function(e) {
        if (!e.relatedTarget) hoverPause = false;
      });
      viewer.addEventListener('wheel', function() {
        paused = true;
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(function() { paused = false; }, 2000);
      }, { passive: true });
      viewer.addEventListener('touchstart', function() {
        paused = true;
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(function() { paused = false; }, 2500);
      }, { passive: true });

      function tick() {
        if (!paused && !hoverPause) {
          if (ltr) {
            // LTR: strip 右シフト = pos 減算 = translateX 増加
            pos -= speed;
            if (pos < 0) pos += halfWidth;
          } else {
            pos += speed;
            if (pos >= halfWidth) pos -= halfWidth;
          }
          hStrip.style.transform = 'translateX(' + (-pos) + 'px)';
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    // ============ 画像ロード完了待ち ============
    function waitImages(container, callback) {
      var imgs = container.querySelectorAll('img');
      if (imgs.length === 0) { callback(); return; }
      var loaded = 0;
      function check() { if (++loaded === imgs.length) callback(); }
      imgs.forEach(function(img) {
        if (img.complete) check();
        else {
          img.addEventListener('load',  check, { once: true });
          img.addEventListener('error', check, { once: true });
        }
      });
      setTimeout(callback, 1500); // 保険
    }

    // ============ データ取得 ============
    fetch(WP_API + '/manga/' + encodeURIComponent(mangaId))
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data && data.gallery && data.gallery.length > 0) {
          render(data);
        } else {
          var fallback = { view_type: 'spread', gallery: [] };
          for (var i = 1; i <= 30; i++) {
            fallback.gallery.push('https://contentsx.jp/material/manga/' + mangaId + '/' + (i < 10 ? '0' + i : '' + i) + '.webp');
          }
          render(fallback);
        }
      })
      .catch(function() {
        var fallback = { view_type: 'spread', gallery: [] };
        for (var i = 1; i <= 10; i++) {
          fallback.gallery.push('https://contentsx.jp/material/manga/' + mangaId + '/' + (i < 10 ? '0' + i : '' + i) + '.webp');
        }
        render(fallback);
      });
  })();
