/* =============================================================
   mpc-scale.js — /manga-production-company ヒーローの
   インタラクティブ天秤 (ComparisonScale)
   - PC(hover可): 左右ホバーで傾く / 離れると中央へ戻る
   - スマホ(hover不可): 左右タップで傾く / 反対側タップで反転
   - 初回ロード後 0.6秒でアイドルスイング (1回だけ)
   - prefers-reduced-motion: reduce ではアイドル演出を無効化
   傾きの実体は CSS (.is-tilt-left / .is-tilt-right / .is-idle-swing)
   ============================================================= */
(function () {
  'use strict';

  function init() {
    var scale = document.getElementById('comparisonScale');
    if (!scale) return;

    var left = scale.querySelector('.scale-hit-left');
    var right = scale.querySelector('.scale-hit-right');
    if (!left || !right) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function tiltLeft() {
      scale.classList.remove('is-tilt-right');
      scale.classList.add('is-tilt-left');
    }
    function tiltRight() {
      scale.classList.remove('is-tilt-left');
      scale.classList.add('is-tilt-right');
    }
    function center() {
      scale.classList.remove('is-tilt-left', 'is-tilt-right');
    }

    if (canHover) {
      // PC: ホバーで傾き、天秤から離れたら中央へ
      left.addEventListener('mouseenter', tiltLeft);
      right.addEventListener('mouseenter', tiltRight);
      scale.addEventListener('mouseleave', center);
      // キーボード操作にも対応
      left.addEventListener('focus', tiltLeft);
      right.addEventListener('focus', tiltRight);
      scale.addEventListener('focusout', function (e) {
        if (!scale.contains(e.relatedTarget)) center();
      });
    } else {
      // スマホ: タップした側に傾く / 反対側タップで反転 (戻さない)
      left.addEventListener('click', tiltLeft);
      right.addEventListener('click', tiltRight);
    }

    // 初回アイドルスイング (インタラクティブであることの示唆)
    if (!reduceMotion) {
      setTimeout(function () {
        // すでにユーザーが操作していたら出さない
        if (scale.classList.contains('is-tilt-left') || scale.classList.contains('is-tilt-right')) return;
        scale.classList.add('is-idle-swing');
        setTimeout(function () {
          scale.classList.remove('is-idle-swing');
        }, 1300);
      }, 600);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
