/* =============================================================
   mpc.js — /manga-production-company 専用
   - IntersectionObserver で fade-up アニメ
   - data-counter で数字カウントアップ
   - 追従CTA (fix-btn) のヒーロー外〜フッター手前で表示制御
   - 比較表 sticky ヘッダー対応
   ============================================================= */
(function () {
  'use strict';

  // ---------- フェードアップ系 (data-fadeup, .mpc-pain-card, .mpc-criteria-card, .mpc-map-pin, .mpc-stat) ----------
  function initFadeUp() {
    var targets = document.querySelectorAll(
      '[data-fadeup], .mpc-pain-card, .mpc-criteria-card, .mpc-map-pin, .mpc-stat'
    );
    if (!('IntersectionObserver' in window) || !targets.length) {
      // フォールバック: 即時表示
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          // .mpc-pain-card / .mpc-criteria-card は順次出現
          var idx = Array.prototype.indexOf.call(e.target.parentElement.children, e.target);
          var delay = Math.min(idx, 4) * 80;
          setTimeout(function () {
            e.target.classList.add('is-visible');
          }, delay);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -10% 0px' });
    targets.forEach(function (el) { io.observe(el); });
  }

  // ---------- カウントアップ ----------
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function startCounter(el) {
    var numEl = el.querySelector('.mpc-stat-num');
    if (!numEl) return;
    var to = parseInt(numEl.dataset.counterTo || '0', 10);
    if (!to) return;
    var duration = 1000;
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var elapsed = ts - start;
      var t = Math.min(elapsed / duration, 1);
      var v = Math.floor(easeOutCubic(t) * to);
      numEl.textContent = v.toLocaleString('ja-JP');
      if (t < 1) requestAnimationFrame(tick);
      else numEl.textContent = to.toLocaleString('ja-JP');
    }
    requestAnimationFrame(tick);
  }

  function initCounters() {
    var stats = document.querySelectorAll('.mpc-stat[data-counter]');
    if (!('IntersectionObserver' in window) || !stats.length) {
      stats.forEach(startCounter);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          startCounter(e.target);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    stats.forEach(function (el) { io.observe(el); });
  }

  // ---------- 追従CTA: ヒーロー外〜フッター手前で表示 ----------
  function initFixBtn() {
    var btn = document.getElementById('mpcFixBtn');
    if (!btn) return;
    var hero = document.querySelector('.mpc-hero');
    var finalCta = document.querySelector('.mpc-final-cta');
    if (!hero || !finalCta) {
      // フォールバック: スクロール量で判定
      window.addEventListener('scroll', function () {
        if (window.scrollY > 600) btn.classList.add('is-visible');
        else btn.classList.remove('is-visible');
      }, { passive: true });
      return;
    }
    var heroBottom = 0;
    var finalCtaTop = Number.MAX_SAFE_INTEGER;
    function updateOffsets() {
      heroBottom = hero.offsetTop + hero.offsetHeight - 60;
      finalCtaTop = finalCta.offsetTop - 200;
    }
    updateOffsets();
    window.addEventListener('resize', updateOffsets);

    var lastY = 0;
    var ticking = false;
    function update() {
      var y = window.scrollY;
      if (y > heroBottom && y < finalCtaTop) {
        btn.classList.add('is-visible');
      } else {
        btn.classList.remove('is-visible');
      }
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  // ---------- 左 sticky 目次: 現在地ハイライト (a16z風) ----------
  function initToc() {
    var toc = document.querySelector('.mpc-toc');
    if (!toc) return;
    var links = toc.querySelectorAll('.mpc-toc-list a[data-toc]');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var linkMap = {};
    links.forEach(function (a) { linkMap[a.dataset.toc] = a; });

    function setActive(id) {
      links.forEach(function (a) { a.classList.remove('is-active'); });
      var active = linkMap[id];
      if (active) active.classList.add('is-active');
    }

    // ビューポート上部 30〜45% に入ったセクションを「現在地」とみなす
    var io = new IntersectionObserver(function (entries) {
      var top = entries
        .filter(function (e) { return e.isIntersecting; })
        .map(function (e) { return { id: e.target.id, y: e.boundingClientRect.top }; })
        .sort(function (a, b) { return a.y - b.y; })[0];
      if (top) setActive(top.id);
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });

    Object.keys(linkMap).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });

    // 比較表 (max-width: 1280px) は TOC と幅で被るため、
    // 表示中だけ TOC を左にスライドアウトさせる
    var comparison = document.getElementById('comparison');
    if (comparison) {
      var tuckIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          toc.classList.toggle('is-tucked', e.isIntersecting);
        });
      }, { rootMargin: '-10% 0px -10% 0px', threshold: 0 });
      tuckIO.observe(comparison);
    }
  }

  // ---------- 比較表: sticky ヘッダー対応の補正 ----------
  function initStickyTable() {
    var table = document.querySelector('.mpc-table');
    if (!table) return;
    var wrap = table.closest('.mpc-table-wrap');
    if (!wrap) return;
    // ヘッダーのオフセットをCSS変数化（外部ヘッダー高さに連動）
    var bmHeader = document.querySelector('.bm-header');
    if (bmHeader) {
      var h = bmHeader.offsetHeight;
      table.style.setProperty('--mpc-table-sticky-top', h + 'px');
      var thead = table.querySelector('thead th');
      if (thead) thead.style.top = '0px'; // sticky は wrap 内で動く
    }
  }

  function init() {
    initFadeUp();
    initCounters();
    initFixBtn();
    initStickyTable();
    initToc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
