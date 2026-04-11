/**
 * BizManga Hero — 集英社スタイル マーキーカルーセル + 制作事例モーダル
 * ContentsX と全く同じ仕様:
 *   - 作品表紙が5行マーキーで横スクロール
 *   - クリックで制作事例モーダル（2カラム: 漫画カルーセル + 詳細）
 *   - WordPress API データ優先、フォールバックはローカル
 */
(function() {
  'use strict';

  var heroWorksBg = document.getElementById('bmHeroWorksBg');
  if (!heroWorksBg) return;

  // ===== フォールバック用 漫画データ（ContentsX の WORKS_DETAIL_DATA と同等構造） =====
  var FALLBACK_WORKS = [
    { id: 'life-school', title_ja: 'ライフスクール', pages: 10, category: 'プロモーション',
      media: ['Webサイト', 'SNS'], spec: { pages: '10P', period: '2週間' },
      point: 'スクールの魅力を漫画で発信。', comment: '問い合わせが増えました。' },
    { id: 'seko', title_ja: '施工会社紹介', pages: 8, category: '営業',
      media: ['営業ツール'], spec: { pages: '8P', period: '10日間' },
      point: '施工実績を漫画でビジュアル化。', comment: '信頼感が増しました。' },
    { id: 'sixtones', title_ja: 'SixTones', pages: 10, category: 'プロモーション',
      media: ['イベント配布', 'Web'], spec: { pages: '10P', period: '2週間' },
      point: 'プロモーション漫画制作。', comment: 'ファンに好評でした。' },
    { id: 'life-buzfes', title_ja: 'ライフバズフェス', pages: 8, category: 'プロモーション',
      media: ['イベント', 'SNS'], spec: { pages: '8P', period: '10日間' },
      point: 'イベント告知を漫画で訴求。', comment: '集客効果がありました。' },
    { id: 'lady-column', title_ja: 'レディコラム', pages: 6, category: 'その他',
      media: ['Webコラム'], spec: { pages: '6P', period: '1週間' },
      point: 'コラム連載の漫画化。', comment: 'PVが伸びました。' },
    { id: 'ichinohe-home', title_ja: '一戸ホーム', pages: 22, category: '営業',
      media: ['営業ツール', 'Web掲載'], spec: { pages: '22P', period: '3週間' },
      point: '住宅メーカーの魅力をストーリー漫画で伝える営業ツール。', comment: '商談がスムーズになりました。' },
    { id: 'bms-unso', title_ja: 'BMS運送', pages: 10, category: '創業ストーリー',
      media: ['採用サイト', 'パンフレット'], spec: { pages: '10P', period: '2週間' },
      point: 'リメイク版で新たな魅力を訴求。', comment: '応募者の質が上がりました。' }
  ];

  // ===== O(1) ルックアップ用マップ =====
  var worksMap = {};
  function rebuildMap(works) {
    worksMap = {};
    works.forEach(function(w) { worksMap[w.id] = w; });
  }
  rebuildMap(FALLBACK_WORKS);

  // ===== マーキーカルーセル構築 =====
  function buildMarquee(works) {
    var rowEls = [
      document.getElementById('bmHeroRow1'),
      document.getElementById('bmHeroRow2'),
      document.getElementById('bmHeroRow3'),
      document.getElementById('bmHeroRow4'),
      document.getElementById('bmHeroRow5')
    ].filter(Boolean);
    if (rowEls.length === 0 || works.length === 0) return;

    var numRows = rowEls.length;
    var rows = [];
    for (var r = 0; r < numRows; r++) rows.push([]);
    works.forEach(function(w, i) { rows[i % numRows].push(w); });

    rowEls.forEach(function(rowEl, ri) {
      var items = rows[ri];
      if (items.length === 0) return;
      rowEl.innerHTML = '';

      var frag = document.createDocumentFragment();
      var renderItems = items.concat(items, items, items);
      var itemCount = items.length;
      renderItems.forEach(function(item, idx) {
        var div = document.createElement('div');
        div.className = 'bm-hero-works-cover';
        div.dataset.workId = item.id;

        var img = document.createElement('img');
        img.alt = item.title_ja || item.title || '';
        /* 最初の1セットだけeager、複製分はlazyで帯域節約 */
        var isFirstSet = idx < itemCount;
        img.loading = isFirstSet ? 'eager' : 'lazy';
        img.decoding = 'async';
        if (isFirstSet) img.fetchPriority = 'high';
        img.style.objectPosition = 'top center';

        // リスナーを先に付けてからsrcをセット（キャッシュ済みでも確実にキャッチ）
        (function(coverDiv, imgEl) {
          function markLoaded() { coverDiv.classList.add('img-loaded'); }
          imgEl.addEventListener('load', markLoaded, { once: true });
          imgEl.addEventListener('error', markLoaded, { once: true });
        })(div, img);

        img.src = item.thumbnail || 'https://contentsx.jp/material/manga/' + item.id + '/01.webp';

        div.appendChild(img);

        // スピナー（imgの後 = 上に表示される）
        var spinner = document.createElement('div');
        spinner.className = 'bm-cover-spinner';
        div.appendChild(spinner);
        frag.appendChild(div);

        // クリック → 制作事例モーダル
        div.addEventListener('click', function(e) {
          e.stopPropagation();
          openWorkDetail(item.id);
        });
      });
      rowEl.appendChild(frag);
    });

    rebuildMap(works);
    explodeGatherIntro();
  }

  // ===== 爆発→集合イントロ =====
  function explodeGatherIntro() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // reduced-motion: スキップしてすぐマーキー開始
      heroWorksBg.classList.add('hero-marquee-go');
      return;
    }

    var covers = heroWorksBg.querySelectorAll('.bm-hero-works-cover');
    if (covers.length === 0) return;

    // 1) 全カバーにランダムな初期位置を設定
    var viewW = window.innerWidth;
    var viewH = window.innerHeight;
    covers.forEach(function(cover, i) {
      var angle = Math.random() * Math.PI * 2;
      var dist = 500 + Math.random() * 600;
      var x = Math.cos(angle) * dist;
      var y = Math.sin(angle) * dist;
      var rot = (Math.random() * 360 - 180);
      cover.style.setProperty('--ex-x', x + 'px');
      cover.style.setProperty('--ex-y', y + 'px');
      cover.style.setProperty('--ex-r', rot + 'deg');
      cover.style.setProperty('--ex-dur', (0.8 + Math.random() * 0.6) + 's');
      cover.style.setProperty('--ex-delay', (i * 0.02) + 's');
      cover.classList.add('explode-init');
    });

    // 2) 次フレームで集合クラスを付与（transitionを発火）
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        covers.forEach(function(cover) {
          cover.classList.remove('explode-init');
          cover.classList.add('explode-gather');
        });

        // 3) 集合完了後にマーキー開始 + クラス除去
        var maxDelay = covers.length * 0.02 + 1.4; // 最大delay + duration
        setTimeout(function() {
          heroWorksBg.classList.add('hero-marquee-go');
          covers.forEach(function(cover) {
            cover.classList.remove('explode-gather');
            cover.style.removeProperty('--ex-x');
            cover.style.removeProperty('--ex-y');
            cover.style.removeProperty('--ex-r');
            cover.style.removeProperty('--ex-dur');
            cover.style.removeProperty('--ex-delay');
          });
        }, maxDelay * 1000);
      });
    });
  }

  // ===== 制作事例モーダル (ContentsX同様) =====
  var wdOverlay = document.getElementById('workDetailOverlay');
  var wdClose = document.getElementById('workDetailClose');
  var wdCarousel = document.getElementById('workDetailCarousel');
  var wdDots = document.getElementById('workDetailDots');
  var wdPrev = document.getElementById('workDetailPrev');
  var wdNext = document.getElementById('workDetailNext');
  var wdTitle = document.getElementById('workDetailTitle');
  var wdCategory = document.getElementById('workDetailCategory');
  var wdMedia = document.getElementById('workDetailMedia');
  var wdSpec = document.getElementById('workDetailSpec');
  var wdPoint = document.getElementById('workDetailPoint');
  var wdComment = document.getElementById('workDetailComment');

  var wdCurrentPage = 0;
  var wdTotalPages = 0;
  var wdLoader = document.getElementById('workDetailLoader');

  function showWdLoader() { if (wdLoader) wdLoader.classList.remove('hidden'); }
  function hideWdLoader() { if (wdLoader) wdLoader.classList.add('hidden'); }

  function openWorkDetail(workId) {
    if (!wdOverlay) return;
    var work = worksMap[workId];
    if (!work) return;
    showWdLoader();

    if (wdTitle) wdTitle.textContent = work.title_ja || '';
    if (wdCategory) wdCategory.textContent = work.category || '';
    var esc = window.bmSanitize ? window.bmSanitize.html : function(s){ return s || ''; };
    if (wdMedia) wdMedia.innerHTML = (work.media || []).map(function(m) { return '<li>' + esc(m) + '</li>'; }).join('');
    if (wdSpec) {
      var spec = work.spec || {};
      wdSpec.innerHTML = '<li>ページ数：' + esc(spec.pages || '—') + '</li><li>納期：' + esc(spec.period || '—') + '</li>';
    }
    if (wdPoint) wdPoint.textContent = work.point || '';
    if (wdComment) wdComment.textContent = work.comment || '';

    var previewPages = Math.min(work.pages || 5, 5);
    wdTotalPages = previewPages;
    wdCurrentPage = 0;

    if (wdCarousel) {
      wdCarousel.innerHTML = '';
      wdCarousel.style.transform = 'translateX(0)';

      function buildPages(isVertical) {
        var frag = document.createDocumentFragment();
        var hasGallery = work.gallery && work.gallery.length > 0;
        for (var i = 1; i <= previewPages; i++) {
          var img = document.createElement('img');
          if (hasGallery && work.gallery[i - 1]) {
            img.src = work.gallery[i - 1];
          } else {
            img.src = 'https://contentsx.jp/material/manga/' + work.id + '/' + String(i).padStart(2, '0') + '.webp';
          }
          img.alt = (work.title_ja || '') + ' ' + i + 'ページ';
          // 1枚目のロード完了でローダーを非表示
          if (i === 1) {
            img.onload = hideWdLoader;
            img.onerror = hideWdLoader;
          }
          frag.appendChild(img);
        }
        wdCarousel.appendChild(frag);
      }

      // 縦読み判定: 1ページ目 or 2ページ目が縦長なら縦スクロール
      function applyVerticalMode() {
        wdCarousel.classList.add('vertical-scroll');
        if (wdCarousel.parentElement) wdCarousel.parentElement.classList.add('has-vertical-scroll');
        wdCarousel.style.transform = '';
        buildPages(true);
        if (wdDots) wdDots.style.display = 'none';
        if (wdPrev) wdPrev.style.display = 'none';
        if (wdNext) wdNext.style.display = 'none';
      }
      function applyCarouselMode() {
        wdCarousel.classList.remove('vertical-scroll');
        if (wdCarousel.parentElement) wdCarousel.parentElement.classList.remove('has-vertical-scroll');
        buildPages(false);
        if (wdDots) {
          wdDots.style.display = 'flex';
          wdDots.innerHTML = '';
          for (var j = 0; j < previewPages; j++) {
            var dot = document.createElement('div');
            dot.className = 'work-detail-dot' + (j === 0 ? ' active' : '');
            (function(idx) {
              dot.addEventListener('click', function() { goToPage(idx); });
            })(j);
            wdDots.appendChild(dot);
          }
        }
        if (wdPrev) wdPrev.style.display = '';
        if (wdNext) wdNext.style.display = '';
      }
      function isVerticalRatio(r) { return r < 0.2; }

      // 即座にカルーセルモードで仮表示（体感速度向上）
      applyCarouselMode();

      // 1ページ目で縦読み判定
      var hasGallery = work.gallery && work.gallery.length > 0;
      var firstSrc = hasGallery && work.gallery[0] ? work.gallery[0] : 'https://contentsx.jp/material/manga/' + work.id + '/01.webp';

      var testImg = new Image();
      testImg.src = firstSrc;
      testImg.onload = function() {
        if (isVerticalRatio(testImg.naturalWidth / testImg.naturalHeight)) {
          applyVerticalMode();
        }
      };
    }

    wdOverlay.classList.add('active');
    wdOverlay.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }

  function goToPage(idx) {
    wdCurrentPage = idx;
    if (wdCarousel) wdCarousel.style.transform = 'translateX(-' + (idx * 100) + '%)';
    if (wdDots) {
      var dots = wdDots.querySelectorAll('.work-detail-dot');
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('active', i === idx);
      }
    }
  }

  function closeModal() {
    if (wdOverlay) wdOverlay.classList.remove('active');
    document.body.style.overflow = '';
    hideWdLoader();
  }

  if (wdPrev) wdPrev.addEventListener('click', function() {
    if (wdCurrentPage > 0) goToPage(wdCurrentPage - 1);
  });
  if (wdNext) wdNext.addEventListener('click', function() {
    if (wdCurrentPage < wdTotalPages - 1) goToPage(wdCurrentPage + 1);
  });
  if (wdClose) wdClose.addEventListener('click', closeModal);
  if (wdOverlay) wdOverlay.addEventListener('click', function(e) {
    if (e.target === wdOverlay) closeModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && wdOverlay && wdOverlay.classList.contains('active')) closeModal();
    if (wdOverlay && wdOverlay.classList.contains('active')) {
      if (e.key === 'ArrowLeft' && wdCurrentPage > 0) goToPage(wdCurrentPage - 1);
      if (e.key === 'ArrowRight' && wdCurrentPage < wdTotalPages - 1) goToPage(wdCurrentPage + 1);
    }
  });

  // グローバルに公開（他のスクリプトからも呼べるように）
  window.openWorkDetail = openWorkDetail;

  // ===== データ初期化 =====
  // 即座にフォールバックで構築
  buildMarquee(FALLBACK_WORKS);

  // WP APIデータが来たら上書き（show_hero_site でフィルタ）
  window.addEventListener('bm-data-ready', function() {
    var allWorks = window.BM_WORKS_DATA || [];
    // show_hero_site: 'both' or 'bizmanga' → BizMangaヒーローに表示
    // 後方互換: show_hero_site がない場合は show_hero フラグで判定
    var works = allWorks.filter(function(w) {
      if ('show_hero_site' in w) {
        return w.show_hero_site === 'both' || w.show_hero_site === 'bizmanga';
      }
      return w.show_hero !== false;
    });
    if (works.length > 0) {
      buildMarquee(works);
    }
  });
})();
