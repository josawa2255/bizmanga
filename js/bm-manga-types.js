/* ===================================================================
 * bm-manga-types.js — 「マンガの種類」ページの章セレクタ
 *
 * 左の章一覧 (button[data-mt-select]) をクリック/キー操作すると、
 * 右の詳細 (article[data-mt-panel]) をページ遷移なしで切り替える。
 *
 * 方針:
 *   - 7章分のHTMLは常にDOMに存在する。JSが動いたときだけ
 *     コンテナに .is-js を付け、非選択章をCSSで隠す
 *     （= JS無効・エラー時は7章すべてが縦に並んだまま読める）
 *   - 選択状態は aria-pressed、詳細側は aria-live="polite" で通知
 *   - #mt-recruit のようなハッシュ付きURLでも該当章を開く
 * 2026-08-24 新規
 * =================================================================== */
(function () {
  'use strict';

  function init() {
    var root = document.querySelector('[data-mt-chapters]');
    if (!root) return;

    var buttons = Array.prototype.slice.call(root.querySelectorAll('[data-mt-select]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-mt-panel]'));
    if (!buttons.length || !panels.length) return;

    // ここまで来て初めて「JSで切替できる」状態にする
    root.classList.add('is-js');

    function select(key, moveFocus) {
      var matched = panels.filter(function (p) {
        return p.getAttribute('data-mt-panel') === key;
      });
      if (!matched.length) return false;

      panels.forEach(function (p) {
        p.classList.toggle('is-active', p.getAttribute('data-mt-panel') === key);
      });
      buttons.forEach(function (b) {
        var on = b.getAttribute('data-mt-select') === key;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && moveFocus) b.focus();
      });
      return true;
    }

    buttons.forEach(function (btn, index) {
      btn.addEventListener('click', function () {
        select(btn.getAttribute('data-mt-select'), false);
      });
      // ↑↓←→ で章を移動（フォーカスも一緒に動かす）
      btn.addEventListener('keydown', function (e) {
        var step =
          e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 :
          e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = buttons[(index + step + buttons.length) % buttons.length];
        select(next.getAttribute('data-mt-select'), true);
      });
    });

    // #mt-recruit のようなハッシュで該当章を開く（旧アンカー互換）
    function selectFromHash() {
      var hash = (window.location.hash || '').replace(/^#/, '');
      if (hash.indexOf('mt-') !== 0) return;
      select(hash.slice(3), false);
    }
    selectFromHash();
    window.addEventListener('hashchange', selectFromHash);

    // 何も選択されていなければ先頭（01 創業ストーリー）を開く
    if (!root.querySelector('.mt-chapter-panel.is-active')) {
      select(buttons[0].getAttribute('data-mt-select'), false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
