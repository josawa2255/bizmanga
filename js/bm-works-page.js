/**
 * BizManga 制作事例ページ
 * - 全作品をbook.asahi.com風カードで一覧表示
 * - カテゴリフィルター
 * - クリックで制作事例モーダル（Hero同様の2カラム）
 * - WordPress API優先、フォールバックはローカルデータ
 */
(function() {
  'use strict';

  var grid = document.getElementById('bmWorksGrid');
  var filterContainer = document.getElementById('bmCategoryFilter');
  if (!grid) return;

  // ===== 言語ヘルパー =====
  function getLang() { return document.documentElement.lang || 'ja'; }
  function t(ja) {
    if (getLang() !== 'en') return ja;
    if (window.i18n && window.i18n.t) {
      var result = window.i18n.t(ja);
      return (result !== ja) ? result : ja;
    }
    return ja;
  }

  // ===== カテゴリ英訳マップ =====
  var CATEGORY_EN = {
    'すべて': 'All',
    '営業': 'Sales',
    '採用': 'Recruitment',
    '研修': 'Training',
    '集客': 'Marketing',
    '紹介': 'Introduction',
    'ブランド': 'Branding',
    'IP': 'IP',
    'プロモーション': 'Promotion',
    'その他': 'Other',
    '創業ストーリー': 'Founding Story'
  };

  // ===== メディア英訳マップ =====
  var MEDIA_EN = {
    '採用パンフレット': 'Recruitment Pamphlet',
    'Web掲載': 'Web Publication',
    '研修資料': 'Training Material',
    '営業資料': 'Sales Material',

    'SNS': 'SNS',
    'メールマガジン': 'Email Newsletter',
    'Webサイト': 'Website',
    '営業ツール': 'Sales Tool',
    'イベント配布': 'Event Distribution',
    'Web': 'Web',
    'イベント': 'Event',
    'Webコラム': 'Web Column',
    '採用サイト': 'Recruitment Site',
    'パンフレット': 'Pamphlet',
    '社内説明・営業研修': 'Internal Briefing / Sales Training',
    'Webサイト（製品紹介ページ）': 'Website (Product Page)',
    'SNS（X・Instagram）': 'SNS (X / Instagram)'
  };

  // ===== フォールバック用データ（bm-hero.jsと同じ構造） =====
  var FALLBACK_WORKS = [
    { id: 'life-school', title_ja: 'ライフスクール', title_en: 'Life School', pages: 10, category: 'プロモーション',
      media: ['Webサイト', 'SNS'], spec: { pages: '10P', period: '2週間', period_en: '2 weeks' },
      point: 'スクールの魅力を漫画で発信。', point_en: 'Promoting school appeal through manga.',
      comment: '問い合わせが増えました。', comment_en: 'Inquiries increased.' },
    { id: 'seko', title_ja: '施工会社紹介', title_en: 'Construction Company Story', pages: 8, category: '営業',
      media: ['営業ツール'], spec: { pages: '8P', period: '10日間', period_en: '10 days' },
      point: '施工実績を漫画でビジュアル化。', point_en: 'Construction achievements visualized through manga.',
      comment: '信頼感が増しました。', comment_en: 'Trust and credibility increased.' },
    { id: 'sixtones', title_ja: 'SixTones', title_en: 'SixTones', pages: 10, category: 'プロモーション',
      media: ['イベント配布', 'Web'], spec: { pages: '10P', period: '2週間', period_en: '2 weeks' },
      point: 'プロモーション漫画制作。', point_en: 'Promotional manga production.',
      comment: 'ファンに好評でした。', comment_en: 'Well received by fans.' },
    { id: 'life-buzfes', title_ja: 'ライフバズフェス', title_en: 'Life BuzzFes', pages: 8, category: 'プロモーション',
      media: ['イベント', 'SNS'], spec: { pages: '8P', period: '10日間', period_en: '10 days' },
      point: 'イベント告知を漫画で訴求。', point_en: 'Event promotion through manga.',
      comment: '集客効果がありました。', comment_en: 'Effective in attracting visitors.' },
    { id: 'lady-column', title_ja: 'レディコラム', title_en: 'Lady Column', pages: 6, category: 'その他',
      media: ['Webコラム'], spec: { pages: '6P', period: '1週間', period_en: '1 week' },
      point: 'コラム連載の漫画化。', point_en: 'Serialized column converted to manga.',
      comment: 'PVが伸びました。', comment_en: 'Page views increased.' },
    { id: 'ichinohe-home', title_ja: '一戸ホーム', title_en: 'Ichinohe Home', pages: 22, category: '営業',
      media: ['営業ツール', 'Web掲載'], spec: { pages: '22P', period: '3週間', period_en: '3 weeks' },
      point: '住宅メーカーの魅力をストーリー漫画で伝える営業ツール。', point_en: 'A sales tool that conveys the appeal of a home builder through story manga.',
      comment: '商談がスムーズになりました。', comment_en: 'Business negotiations became smoother.' },
    { id: 'bms-unso-remake', title_ja: 'BMS運送', title_en: 'BMS Transport', pages: 10, category: '創業ストーリー',
      media: ['採用サイト', 'パンフレット'], spec: { pages: '10P', period: '2週間', period_en: '2 weeks' },
      point: 'リメイク版で新たな魅力を訴求。', point_en: 'Remake version showcasing renewed appeal.',
      comment: '応募者の質が上がりました。', comment_en: 'Quality of applicants improved.' }
  ];

  // ===== O(1) ルックアップ用マップ =====
  var worksMap = {};
  function rebuildMap(works) {
    worksMap = {};
    works.forEach(function(w) { worksMap[w.id] = w; });
  }

  // ===== book.asahi.com 風カード生成 =====
  function renderWorks(works, filterCategory) {
    grid.innerHTML = '';
    var filtered = works;
    if (filterCategory && filterCategory !== 'すべて') {
      filtered = works.filter(function(w) {
        return w.category === filterCategory;
      });
    }

    var isEn = getLang() === 'en';
    var frag = document.createDocumentFragment();
    filtered.forEach(function(w) {
      var card = document.createElement('article');
      card.className = 'bm-works-card';
      card.dataset.workId = w.id;

      var coverSrc = w.thumbnail || 'https://contentsx.jp/material/manga/' + w.id + '/01.webp';
      var mediaArr = (w.media || []);
      var mediaStrJa = mediaArr.join(' / ');
      var mediaStrEn = mediaArr.map(function(m) { return MEDIA_EN[m] || m; }).join(' / ');
      var pagesStr = w.spec ? w.spec.pages : (w.pages + 'P');

      var catEn = w.category_en || CATEGORY_EN[w.category] || w.category || '';
      var titleEn = w.title_en || w.title_ja || '';
      var pointEn = w.point_en || w.point || '';

      card.innerHTML =
        '<div class="bm-works-card-thumb">' +
          '<img src="' + coverSrc + '" alt="' + (w.title_ja || '') + '" loading="lazy">' +
        '</div>' +
        '<div class="bm-works-card-body">' +
          '<span class="bm-works-card-category" data-ja="' + (w.category || '') + '" data-en="' + catEn + '">' + (w.category || '') + '</span>' +
          '<h3 class="bm-works-card-title" data-ja="' + (w.title_ja || '') + '" data-en="' + titleEn + '">' + (w.title_ja || '') + '</h3>' +
          (w.point ? '<p class="bm-works-card-desc" data-ja="' + w.point + '" data-en="' + pointEn + '">' + w.point + '</p>' : '') +
          '<div class="bm-works-card-meta">' +
            (mediaStrJa ? '<span class="bm-works-card-media" data-ja="' + mediaStrJa + '" data-en="' + mediaStrEn + '">' + mediaStrJa + '</span>' : '') +
          '</div>' +
        '</div>';

      // クリック → 制作事例モーダル
      (function(workId) {
        card.addEventListener('click', function() {
          openWorkDetail(workId);
        });
      })(w.id);

      frag.appendChild(card);
    });
    grid.appendChild(frag);

    // カテゴリフィルター構築
    buildFilter(works, filterCategory);

    // 現在の言語が英語なら即座に反映
    if (isEn) {
      if (window.i18n && window.i18n.translateAll) {
        window.i18n.translateAll();
      } else if (typeof window.bmSwitchLang === 'function') {
        window.bmSwitchLang('en');
      }
    }
  }

  // ===== カテゴリフィルター =====
  function buildFilter(works, activeCategory) {
    if (!filterContainer) return;
    filterContainer.innerHTML = '';

    var categories = {};
    categories['すべて'] = works.length;
    works.forEach(function(w) {
      if (w.category) {
        categories[w.category] = (categories[w.category] || 0) + 1;
      }
    });

    var isEn = getLang() === 'en';
    var currentWorks = works;
    Object.keys(categories).forEach(function(cat) {
      var btn = document.createElement('button');
      var isActive = (!activeCategory && cat === 'すべて') || activeCategory === cat;
      btn.className = 'bm-filter-btn' + (isActive ? ' active' : '');

      var catEn = CATEGORY_EN[cat] || cat;
      var labelJa = cat + '（' + categories[cat] + '）';
      var labelEn = catEn + ' (' + categories[cat] + ')';
      btn.setAttribute('data-ja', labelJa);
      btn.setAttribute('data-en', labelEn);
      btn.textContent = isEn ? labelEn : labelJa;

      btn.addEventListener('click', function() {
        renderWorks(currentWorks, cat);
      });
      filterContainer.appendChild(btn);
    });
  }

  // ===== 制作事例モーダル（bm-hero.jsと同じ） =====
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

    var isEn = getLang() === 'en';
    var titleJa = work.title_ja || '';
    var titleEn = work.title_en || titleJa;
    var catJa = work.category || '';
    var catEn = work.category_en || CATEGORY_EN[catJa] || catJa;

    if (wdTitle) {
      wdTitle.setAttribute('data-ja', titleJa);
      wdTitle.setAttribute('data-en', titleEn);
      wdTitle.textContent = isEn ? titleEn : titleJa;
    }
    if (wdCategory) {
      wdCategory.setAttribute('data-ja', catJa);
      wdCategory.setAttribute('data-en', catEn);
      wdCategory.textContent = isEn ? catEn : catJa;
    }
    if (wdMedia) {
      wdMedia.innerHTML = (work.media || []).map(function(m) {
        var mEn = MEDIA_EN[m] || m;
        return '<li data-ja="' + m + '" data-en="' + mEn + '">' + (isEn ? mEn : m) + '</li>';
      }).join('');
    }
    if (wdSpec) {
      var spec = work.spec || {};
      var periodEn = spec.period_en || spec.period || '—';
      wdSpec.innerHTML =
        '<li data-ja="ページ数：' + (spec.pages || '—') + '" data-en="Pages: ' + (spec.pages || '—') + '">' + (isEn ? 'Pages: ' : 'ページ数：') + (spec.pages || '—') + '</li>' +
        '<li data-ja="納期：' + (spec.period || '—') + '" data-en="Delivery: ' + periodEn + '">' + (isEn ? 'Delivery: ' + periodEn : '納期：' + (spec.period || '—')) + '</li>';
    }
    if (wdPoint) {
      var pointEn = work.point_en || work.point || '';
      wdPoint.setAttribute('data-ja', work.point || '');
      wdPoint.setAttribute('data-en', pointEn);
      wdPoint.textContent = isEn ? pointEn : (work.point || '');
    }
    if (wdComment) {
      var commentEn = work.comment_en || work.comment || '';
      wdComment.setAttribute('data-ja', work.comment || '');
      wdComment.setAttribute('data-en', commentEn);
      wdComment.textContent = isEn ? commentEn : (work.comment || '');
    }

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
          if (i === 1) {
            img.onload = hideWdLoader;
            img.onerror = hideWdLoader;
          }
          frag.appendChild(img);
        }
        wdCarousel.appendChild(frag);
      }

      var testImg = new Image();
      var firstSrc = (work.gallery && work.gallery[0]) ? work.gallery[0] : 'https://contentsx.jp/material/manga/' + work.id + '/01.webp';
      testImg.src = firstSrc;
      testImg.onload = function() {
        var ratio = testImg.naturalWidth / testImg.naturalHeight;
        if (ratio < 0.2) {
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
    hideWdLoader();
  }

  // モーダル操作
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

  // ===== 初期表示（フォールバック） =====
  rebuildMap(FALLBACK_WORKS);
  renderWorks(FALLBACK_WORKS, null);

  // ===== WP APIデータ到着時に再構築 =====
  window.addEventListener('bm-data-ready', function() {
    var works = window.BM_WORKS_DATA || [];
    if (works.length > 0) {
      rebuildMap(works);
      renderWorks(works, null);
    }
  });
})();
