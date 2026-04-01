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
    { id: 'bms-unso', title_ja: 'BMS運送 - 採用マンガ', pages: 10, category: '営業',
      media: ['採用パンフレット', 'Web掲載'], spec: { pages: '10P', period: '2週間' },
      point: '運送業の魅力をストーリー漫画で伝える採用ツール。', comment: '応募数が増えました。' },
    { id: 'kyoiku-manual', title_ja: '教育マニュアル', pages: 10, category: '研修',
      media: ['研修資料'], spec: { pages: '10P', period: '2週間' },
      point: '新人研修用の教育マニュアルを漫画化。', comment: '理解度が上がりました。' },
    { id: 'shohin-shokai', title_ja: '商品紹介', pages: 8, category: '営業',
      media: ['営業資料', 'Web掲載'], spec: { pages: '8P', period: '10日間' },
      point: '商品の特徴を分かりやすく漫画で紹介。', comment: '商談がスムーズになりました。' },
    { id: 'tagengo', title_ja: '多言語マンガ', pages: 10, category: 'プロモーション',
      media: ['多言語Web', 'SNS'], spec: { pages: '10P', period: '3週間' },
      point: '多言語対応の漫画コンテンツ。', comment: '海外展開に活用しています。' },
    { id: 'merumaga', title_ja: 'メルマガ漫画', pages: 6, category: 'プロモーション',
      media: ['メールマガジン'], spec: { pages: '6P', period: '1週間' },
      point: 'メルマガの開封率を漫画で向上。', comment: '開封率が大幅に上がりました。' },
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
    { id: 'bms-unso-remake', title_ja: 'BMS運送リメイク', pages: 10, category: '創業ストーリー',
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
      renderItems.forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'bm-hero-works-cover';
        div.dataset.workId = item.id;

        var img = document.createElement('img');
        img.src = item.thumbnail || 'https://contentsx.jp/material/manga/' + item.id + '/01.webp';
        img.alt = item.title_ja || item.title || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.style.objectPosition = 'top center';
        div.appendChild(img);
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

  function openWorkDetail(workId) {
    if (!wdOverlay) return;
    var work = worksMap[workId];
    if (!work) return;

    if (wdTitle) wdTitle.textContent = work.title_ja || '';
    if (wdCategory) wdCategory.textContent = work.category || '';
    if (wdMedia) wdMedia.innerHTML = (work.media || []).map(function(m) { return '<li>' + m + '</li>'; }).join('');
    if (wdSpec) {
      var spec = work.spec || {};
      wdSpec.innerHTML = '<li>ページ数：' + (spec.pages || '—') + '</li><li>納期：' + (spec.period || '—') + '</li>';
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
          frag.appendChild(img);
        }
        wdCarousel.appendChild(frag);
      }

      // 1ページ目の画像で縦長判定
      var testImg = new Image();
      var firstSrc = (work.gallery && work.gallery[0]) ? work.gallery[0] : 'https://contentsx.jp/material/manga/' + work.id + '/01.webp';
      testImg.src = firstSrc;
      testImg.onload = function() {
        var ratio = testImg.naturalWidth / testImg.naturalHeight;
        if (ratio < 0.2) {
          // 縦スクロールモード
          wdCarousel.classList.add('vertical-scroll');
          if (wdCarousel.parentElement) wdCarousel.parentElement.classList.add('has-vertical-scroll');
          wdCarousel.style.transform = '';
          buildPages(true);
          if (wdDots) wdDots.style.display = 'none';
          if (wdPrev) wdPrev.style.display = 'none';
          if (wdNext) wdNext.style.display = 'none';
        } else {
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
        testImg.onload = null;
        testImg.onerror = null;
      };
      testImg.onerror = function() {
        wdCarousel.classList.remove('vertical-scroll');
        if (wdCarousel.parentElement) wdCarousel.parentElement.classList.remove('has-vertical-scroll');
        buildPages(false);
        testImg.onload = null;
        testImg.onerror = null;
      };
    }

    wdOverlay.classList.add('active');
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
