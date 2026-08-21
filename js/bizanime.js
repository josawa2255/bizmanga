/**
 * ビズアニメ (BIZ ANIME) — Hero
 *
 * 演出はCSSアニメーション側に持たせ、JSは「いつ再生するか」だけを担当する。
 * 背景画像が乗る前にコピーだけ動き出すとチラつくため、素材の読み込みを待ってから
 * .ba-anim を付与して一斉に開始させる。GSAPは使わない（この規模では過剰）。
 */
(function() {
  'use strict';

  var hero = document.getElementById('baHero');
  if (!hero) return;

  /* 動きを減らす設定なら、アニメーションを開始せず最終状態のまま見せる */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  var started = false;
  function start() {
    if (started) return;
    started = true;
    hero.classList.add('ba-anim');
  }

  /* Hero内の主要画像（キャラ・プレイヤー）の読み込みを待つ。
     3枚目の背景はCSS背景なのでdecodeを待てない = 全体のタイムアウトで担保する。 */
  var imgs = Array.prototype.slice.call(hero.querySelectorAll('img'));
  var pending = imgs.length;

  if (!pending) {
    start();
  } else {
    imgs.forEach(function(img) {
      if (img.complete) {
        if (--pending === 0) start();
        return;
      }
      var done = function() {
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        if (--pending === 0) start();
      };
      img.addEventListener('load', done);
      img.addEventListener('error', done); /* 読めなくても止めない */
    });
  }

  /* 素材が重い/失敗した時に演出ごと止まらないための保険 */
  setTimeout(start, 1200);
})();
