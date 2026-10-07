/* =============================================================
   mpc.js — /manga-production-company 専用
   - IntersectionObserver で fade-up アニメ
   - 付箋チェックリストの順次チェック
   - Hero ポイントの Q&A アコーディオン
   ============================================================= */
(function () {
  'use strict';

  // ---------- フェードアップ系 (data-fadeup, .mpc-map-pin) ----------
  function initFadeUp() {
    var targets = document.querySelectorAll('[data-fadeup], .mpc-map-pin');
    if (!('IntersectionObserver' in window) || !targets.length) {
      // フォールバック: 即時表示
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          // 同じ親の中で順次出現
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

  // ---------- 付箋チェックリスト: カードが画面中央付近に来たら順にチェックが入る ----------
  function initChecklist() {
    var items = document.querySelectorAll('.mpc-choose-item');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-checked'); });
      return;
    }
    // 上45%〜下40% の薄い帯にカードが入った時点でチェック → スクロールで1枚ずつ点く
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-checked');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0, rootMargin: '-45% 0px -40% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  // Hero ポイントの Q&A アコーディオン (各カード下に回答を展開)
  function initHeroPoints() {
    var root = document.querySelector('[data-mpc-accordion]');
    if (!root) return;
    var buttons = root.querySelectorAll('.mpc-hero-v3-point');
    buttons.forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      btn.addEventListener('click', function () {
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
          btn.setAttribute('aria-expanded', 'false');
          panel.classList.remove('is-open');
          // トランジション後に hidden を戻す
          window.setTimeout(function () {
            if (btn.getAttribute('aria-expanded') === 'false') panel.hidden = true;
          }, 320);
        } else {
          panel.hidden = false;
          // hidden 解除を反映させてから開く (トランジション発火)
          window.requestAnimationFrame(function () {
            btn.setAttribute('aria-expanded', 'true');
            panel.classList.add('is-open');
          });
        }
      });
    });
  }

  function init() {
    initFadeUp();
    initChecklist();
    initHeroPoints();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
