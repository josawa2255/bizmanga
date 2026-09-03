/* ===================================================================
 * bm-use-cases.js — 「活用場面」ページの接点セレクタ
 *
 * 左の場面一覧 (button[data-uc-select]) をクリック/キー操作すると、
 * 右の詳細 (article[data-uc-panel]) をページ遷移なしで切り替える。
 *
 * 方針（js/bm-manga-types.js と同じ設計）:
 *   - 9グループ分のHTMLは常にDOMに存在する。JSが動いたときだけ
 *     コンテナに .is-js を付け、非選択の詳細をCSSで隠す
 *     （= JS無効・エラー時は9グループすべてが縦に並んだまま読める）
 *   - 選択状態は aria-pressed、詳細側は aria-live="polite" で通知
 *   - #uc-meishi のようなハッシュ付きURL（旧アンカー）でも該当場面を開く
 *   - 選択時に詳細へ強制スクロールはしない（SPで画面が飛ぶのを防ぐ）
 *   - 表示テキスト・画像パスはHTML側に置き、JSはクラスと属性だけ触る
 *     （i18n の data-ja/data-en がそのまま効くようにするため）
 * 2026-08-24 新規
 * =================================================================== */
(function () {
  'use strict';

  var HASH_PREFIX = 'uc-';

  function init() {
    var root = document.querySelector('[data-uc-scenes]');
    if (!root) return;

    var buttons = Array.prototype.slice.call(root.querySelectorAll('[data-uc-select]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-uc-panel]'));
    if (!buttons.length || !panels.length) return;

    // ここまで来て初めて「JSで切替できる」状態にする
    root.classList.add('is-js');

    function select(key, moveFocus) {
      var matched = panels.filter(function (p) {
        return p.getAttribute('data-uc-panel') === key;
      });
      if (!matched.length) return false;

      panels.forEach(function (p) {
        p.classList.toggle('is-active', p.getAttribute('data-uc-panel') === key);
      });
      buttons.forEach(function (b) {
        var on = b.getAttribute('data-uc-select') === key;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && moveFocus) b.focus();
      });
      return true;
    }

    buttons.forEach(function (btn, index) {
      btn.addEventListener('click', function () {
        select(btn.getAttribute('data-uc-select'), false);
      });
      // ↑↓←→ で場面を移動（フォーカスも一緒に動かす）
      btn.addEventListener('keydown', function (e) {
        var step =
          e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 :
          e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = buttons[(index + step + buttons.length) % buttons.length];
        select(next.getAttribute('data-uc-select'), true);
      });
    });

    // #uc-meishi のようなハッシュで該当場面を開く（旧アンカー互換）
    function selectFromHash() {
      var hash = (window.location.hash || '').replace(/^#/, '');
      if (hash.indexOf(HASH_PREFIX) !== 0) return;
      select(hash.slice(HASH_PREFIX.length), false);
    }
    selectFromHash();
    window.addEventListener('hashchange', selectFromHash);

    // 何も選択されていなければ先頭（01 名刺）を開く
    if (!root.querySelector('.uc-scene-panel.is-active')) {
      select(buttons[0].getAttribute('data-uc-select'), false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
