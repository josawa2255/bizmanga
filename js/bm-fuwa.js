/* =============================================================
   bm-fuwa.js — 汎用「ふわふわスクロール」ユーティリティ
   サイト全体で使用可能。属性ベースで opt-in 設計。

   使い方:
   - <element data-fuwa>          スクロールで下から弾むように出現
   - <element data-fuwa-delay="0.2">  0.2 秒遅延
   - <element data-fuwa-float>    出現後も上下にゆっくり浮遊
   - <element data-fuwa-parallax="0.3">  スクロール量×0.3 で背景をずらす（パララックス）
   - <body data-fuwa-auto>        body に付けると主要要素を自動検出して data-fuwa を付与

   prefers-reduced-motion: reduce のユーザーには無効化される。
   ============================================================= */
(function () {
  'use strict';
  if (window.__bmFuwa) return;
  window.__bmFuwa = true;

  // モーション低減ユーザーは何もしない
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    // ---------- 1. 自動モード: body[data-fuwa-auto] で主要要素を opt-in 化 ----------
    if (document.body.hasAttribute('data-fuwa-auto')) {
      var autoSelectors = [
        'main h2',
        'main h3',
        'main p',
        'main blockquote',
        'main article',
        'main section > .pm-container > *',
        'main section > .mpc-container > *',
        'main .pm-format-item',
        'main .pm-faq-item',
        'main .pm-related-card',
        'main .pm-case-card',
        'main .pm-flow-step-row',
        'main .pm-merit-item',
        'main .pm-pain-item',
        'main .bm-works-card',
        'main .bm-work-related-card',
      ];
      try {
        document.querySelectorAll(autoSelectors.join(',')).forEach(function (el) {
          // 既存の独自アニメ要素 (class 名が動的アニメを持っているもの) はスキップ
          if (el.hasAttribute('data-fuwa')) return;
          if (el.classList.contains('mpc-pain-card')) return;
          if (el.classList.contains('mpc-criteria-card')) return;
          if (el.classList.contains('mpc-map-pin')) return;
          if (el.classList.contains('mpc-stat')) return;
          if (el.classList.contains('mpc-h1')) return;
          if (el.classList.contains('flow-step')) return;
          el.setAttribute('data-fuwa', '');
        });
      } catch (e) { /* noop */ }
    }

    // ---------- 2. Reveal-on-scroll ----------
    if ('IntersectionObserver' in window) {
      var revealTargets = document.querySelectorAll('[data-fuwa]');
      if (revealTargets.length) {
        var revealIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              var d = parseFloat(e.target.dataset.fuwaDelay || 0) * 1000;
              if (d) {
                setTimeout(function () { e.target.classList.add('is-fuwa-in'); }, d);
              } else {
                e.target.classList.add('is-fuwa-in');
              }
              revealIO.unobserve(e.target);
            }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        revealTargets.forEach(function (el) { revealIO.observe(el); });
      }
    } else {
      // フォールバック: 即時表示
      document.querySelectorAll('[data-fuwa]').forEach(function (el) {
        el.classList.add('is-fuwa-in');
      });
    }

    // ---------- 3. Parallax (subtle) ----------
    var parallaxTargets = document.querySelectorAll('[data-fuwa-parallax]');
    if (parallaxTargets.length) {
      var ticking = false;
      function updateParallax() {
        var y = window.scrollY;
        parallaxTargets.forEach(function (el) {
          var speed = parseFloat(el.dataset.fuwaParallax) || 0.3;
          el.style.transform = 'translate3d(0, ' + (y * speed * -0.1) + 'px, 0)';
        });
        ticking = false;
      }
      window.addEventListener('scroll', function () {
        if (!ticking) {
          requestAnimationFrame(updateParallax);
          ticking = true;
        }
      }, { passive: true });
      updateParallax();
    }

    // ---------- 4. Smooth anchor scroll (CSS scroll-behavior の補強) ----------
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var hash = a.getAttribute('href');
      if (!hash || hash === '#' || hash === '#!') return;
      var target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      var headerOffset = 80; // bm-header 高さぶん
      var top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });
})();
