/**
 * BizManga — 制作事例モーダル（静的ページ用の汎用モジュール）
 *
 * 用途:
 *   /works/category/{slug} のような静的生成ページで、カードクリック時に
 *   works.html / index.html と同じ「制作事例モーダル」を開く。
 *   モーダル内の「詳細を見る」ボタンから個別作品ページ /works/{id} へ遷移させる。
 *
 * データ供給:
 *   1. ページ内の <script type="application/json" id="bmWorksModalData"> （ビルド時埋め込み）
 *   2. window.BM_WORKS_DATA（bm-wp-api.js が読み込まれているページのみ・後着で上書き）
 *   静的ページはWP APIを叩かなくても即座にモーダルが開くよう 1 を正とする。
 *
 * 前提:
 *   - ページに works.html と同じ id 群のモーダルHTMLがあること（無ければ何もしない）
 *   - 縦読み/見開きの判定は window.bmViewType に委譲する（BUGS.md #012/#013 の再発防止）
 *
 * 公開API: window.bmWorkModal = { open, close, setWorks }
 */
(function() {
  'use strict';

  var wdOverlay = document.getElementById('workDetailOverlay');
  if (!wdOverlay) return;

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
  var wdLink = document.getElementById('workDetailLink');
  var wdLoader = document.getElementById('workDetailLoader');

  var wdCurrentPage = 0;
  var wdTotalPages = 0;

  function getLang() { return document.documentElement.lang || 'ja'; }
  function esc(s) {
    return window.bmSanitize ? window.bmSanitize.html(s) : (s || '');
  }
  function showLoader() { if (wdLoader) wdLoader.classList.remove('hidden'); }
  function hideLoader() { if (wdLoader) wdLoader.classList.add('hidden'); }

  // ===== 作品データ =====
  var worksMap = {};
  function setWorks(list) {
    if (!list || !list.length) return;
    list.forEach(function(w) { if (w && w.id) worksMap[w.id] = w; });
  }

  var dataEl = document.getElementById('bmWorksModalData');
  if (dataEl) {
    try {
      setWorks(JSON.parse(dataEl.textContent));
    } catch (e) {
      if (window.console) console.warn('[bm-work-modal] 埋め込みJSONの解析に失敗', e);
    }
  }
  if (window.BM_WORKS_DATA) setWorks(window.BM_WORKS_DATA);
  window.addEventListener('bm-data-ready', function() {
    setWorks(window.BM_WORKS_DATA || []);
  });

  // ===== モーダル本体 =====
  function open(workId) {
    var work = worksMap[workId];
    if (!work) return false;
    showLoader();

    var isEn = getLang() === 'en';
    var titleJa = work.title_ja || '';
    var titleEn = work.title_en || titleJa;
    var catJa = work.category || '';
    var catEn = work.category_en || catJa;

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
        return '<li>' + esc(m) + '</li>';
      }).join('');
    }
    if (wdSpec) {
      var spec = work.spec || {};
      var pagesV = esc(spec.pages || (work.pages ? work.pages + 'P' : '—'));
      var periodV = esc(spec.period || '—');
      var periodEn = esc(spec.period_en || spec.period || '—');
      wdSpec.innerHTML =
        '<li data-ja="ページ数：' + pagesV + '" data-en="Pages: ' + pagesV + '">' +
          (isEn ? 'Pages: ' : 'ページ数：') + pagesV + '</li>' +
        '<li data-ja="納期：' + periodV + '" data-en="Delivery: ' + periodEn + '">' +
          (isEn ? 'Delivery: ' + periodEn : '納期：' + periodV) + '</li>';
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
    // 「詳細を見る」→ 個別作品ページ
    if (wdLink) wdLink.href = '/works/' + encodeURIComponent(work.id);

    var previewPages = Math.min(work.pages || 5, 5);
    wdTotalPages = previewPages;
    wdCurrentPage = 0;

    if (wdCarousel) {
      wdCarousel.innerHTML = '';
      wdCarousel.style.transform = 'translateX(0)';

      var hasGallery = work.gallery && work.gallery.length > 0;

      function buildPages() {
        var frag = document.createDocumentFragment();
        for (var i = 1; i <= previewPages; i++) {
          var img = document.createElement('img');
          if (hasGallery && work.gallery[i - 1]) {
            img.src = work.gallery[i - 1];
          } else {
            img.src = 'https://contentsx.jp/material/manga/' + work.id + '/' + String(i).padStart(2, '0') + '.webp';
          }
          img.alt = titleJa + ' ' + i + 'ページ';
          if (i === 1) {
            img.onload = hideLoader;
            img.onerror = hideLoader;
          }
          frag.appendChild(img);
        }
        wdCarousel.appendChild(frag);
      }

      function applyVerticalMode() {
        wdCarousel.classList.add('vertical-scroll');
        if (wdCarousel.parentElement) wdCarousel.parentElement.classList.add('has-vertical-scroll');
        wdCarousel.style.transform = '';
        if (wdDots) wdDots.style.display = 'none';
        if (wdPrev) wdPrev.style.display = 'none';
        if (wdNext) wdNext.style.display = 'none';
      }

      function applyCarouselMode() {
        wdCarousel.classList.remove('vertical-scroll');
        if (wdCarousel.parentElement) wdCarousel.parentElement.classList.remove('has-vertical-scroll');
        if (wdDots) {
          wdDots.style.display = 'flex';
          while (wdDots.firstChild) wdDots.removeChild(wdDots.firstChild);
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

      // 縦読み判定は共通ヘルパーに委譲（自前判定はしない）
      if (window.bmViewType && window.bmViewType.isForcedVertical(work)) {
        applyVerticalMode();
        buildPages();
      } else {
        applyCarouselMode();
        buildPages();
        // view_type 未設定の旧データ向けフォールバック: 1ページ目の縦横比で判定
        var firstSrc = (hasGallery && work.gallery[0])
          ? work.gallery[0]
          : 'https://contentsx.jp/material/manga/' + work.id + '/01.webp';
        if (window.bmViewType && window.bmViewType.probeVerticalByImage) {
          window.bmViewType.probeVerticalByImage(firstSrc).then(function(isV) {
            if (isV) applyVerticalMode();
          });
        }
      }
    }

    wdOverlay.classList.add('active');
    wdOverlay.scrollTop = 0;
    document.body.style.overflow = 'hidden';

    if (isEn && window.i18n && window.i18n.translateAll) window.i18n.translateAll();
    return true;
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

  function close() {
    wdOverlay.classList.remove('active');
    document.body.style.overflow = '';
    hideLoader();
  }

  if (wdPrev) wdPrev.addEventListener('click', function() {
    if (wdCurrentPage > 0) goToPage(wdCurrentPage - 1);
  });
  if (wdNext) wdNext.addEventListener('click', function() {
    if (wdCurrentPage < wdTotalPages - 1) goToPage(wdCurrentPage + 1);
  });
  if (wdClose) wdClose.addEventListener('click', close);
  wdOverlay.addEventListener('click', function(e) {
    if (e.target === wdOverlay) close();
  });
  document.addEventListener('keydown', function(e) {
    if (!wdOverlay.classList.contains('active')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft' && wdCurrentPage > 0) goToPage(wdCurrentPage - 1);
    if (e.key === 'ArrowRight' && wdCurrentPage < wdTotalPages - 1) goToPage(wdCurrentPage + 1);
  });

  // ===== スマホ用: 横スワイプでページ切替 =====
  if (wdCarousel) {
    var touchStartX = 0;
    var touchStartY = 0;
    var touchMoved = false;
    var SWIPE_THRESHOLD = 40;
    wdCarousel.addEventListener('touchstart', function(e) {
      if (wdCarousel.classList.contains('vertical-scroll')) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchMoved = false;
    }, { passive: true });
    wdCarousel.addEventListener('touchmove', function() {
      touchMoved = true;
    }, { passive: true });
    wdCarousel.addEventListener('touchend', function(e) {
      if (wdCarousel.classList.contains('vertical-scroll')) return;
      if (!touchMoved) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dx < -SWIPE_THRESHOLD && wdCurrentPage < wdTotalPages - 1) {
        goToPage(wdCurrentPage + 1);
      } else if (dx > SWIPE_THRESHOLD && wdCurrentPage > 0) {
        goToPage(wdCurrentPage - 1);
      }
    }, { passive: true });
  }

  // ===== カードにモーダルを被せる =====
  // カードは <a href="/works/{id}"> のままにしておく（SEOの内部リンク・
  // Cmd/Ctrl+クリック・中クリックの新規タブを維持するため）。
  function hydrateCards() {
    var cards = document.querySelectorAll('.bm-works-card[data-work-id]');
    cards.forEach(function(card) {
      if (card.dataset.bmModalBound) return;
      card.dataset.bmModalBound = '1';
      var workId = card.getAttribute('data-work-id');
      card.addEventListener('click', function(ev) {
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button === 1) return;
        // データが無い作品はリンク本来の遷移に任せる
        if (!worksMap[workId]) return;
        ev.preventDefault();
        open(workId);
      });
    });
  }
  hydrateCards();

  window.bmWorkModal = { open: open, close: close, setWorks: setWorks, hydrate: hydrateCards };
})();
