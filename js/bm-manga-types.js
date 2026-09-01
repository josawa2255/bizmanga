/* ===================================================================
 * bm-manga-types.js — 「マンガの種類」ページの章/形式セレクタ
 *
 * 左の一覧 (button[data-mt-select] / [data-mt-format-select]) をクリック・
 * キー操作すると、右の詳細 (article[data-mt-panel] / [data-mt-format-panel])
 * をページ遷移なしで切り替える。章セレクタ・形式セレクタは同じ設計。
 *
 * 方針:
 *   - 全パネルのHTMLは常にDOMに存在する。JSが動いたときだけ
 *     コンテナに .is-js を付け、非選択パネルをCSSで隠す
 *     （= JS無効・エラー時はすべて縦に並んだまま読める）
 *   - 選択状態は aria-pressed、詳細側は aria-live="polite" で通知
 *   - #mt-recruit のようなハッシュ付きURLでも該当章を開く（章セレクタのみ）
 * 2026-08-24 新規 / 2026-08-31 形式セレクタ（上映形式チケットUI）を追加
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

    // #mt-recruit のようなハッシュで該当章を開く（旧アンカー互換 +
    // ヒーローのチャプター索引からの遷移）。
    // 非選択章は display:none なので、ブラウザ側のアンカージャンプは効かない。
    // 章を開いたあとに、こちらで章一覧までスクロールさせる。
    function scrollToChapters() {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try {
        root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      } catch (err) {
        root.scrollIntoView(true);
      }
    }
    function selectFromHash(scroll) {
      var hash = (window.location.hash || '').replace(/^#/, '');
      if (hash.indexOf('mt-') !== 0) return;
      if (!select(hash.slice(3), false)) return;
      if (scroll) scrollToChapters();
    }
    // 初回ロードはアニメーションなしで位置だけ合わせる。
    // 画像の読み込みで高さが変わるので load 後にもう一度合わせ直す。
    selectFromHash(false);
    if ((window.location.hash || '').indexOf('#mt-') === 0) {
      var settle = function () { root.scrollIntoView(true); };
      window.requestAnimationFrame(settle);
      window.addEventListener('load', settle);
    }
    window.addEventListener('hashchange', function () { selectFromHash(true); });

    // 何も選択されていなければ先頭（01 創業ストーリー）を開く
    if (!root.querySelector('.mt-chapter-panel.is-active')) {
      select(buttons[0].getAttribute('data-mt-select'), false);
    }
  }

  /* -----------------------------------------------------------------
   * SCREENING FORMAT — 上映形式のチケットセレクタ（章セレクタと同じ設計）
   * デフォルトは HTML 側で「03 ストーリー型」に is-active / aria-pressed
   * が付与済み。JSが動いたときだけ .is-js を付けて他形式を隠す。
   * --------------------------------------------------------------- */
  function initFormats() {
    var root = document.querySelector('[data-mt-formats]');
    if (!root) return;

    var buttons = Array.prototype.slice.call(root.querySelectorAll('[data-mt-format-select]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-mt-format-panel]'));
    if (!buttons.length || !panels.length) return;

    root.classList.add('is-js');

    function select(key, moveFocus) {
      var matched = panels.filter(function (p) {
        return p.getAttribute('data-mt-format-panel') === key;
      });
      if (!matched.length) return false;

      panels.forEach(function (p) {
        p.classList.toggle('is-active', p.getAttribute('data-mt-format-panel') === key);
      });
      buttons.forEach(function (b) {
        var on = b.getAttribute('data-mt-format-select') === key;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && moveFocus) b.focus();
      });
      return true;
    }

    buttons.forEach(function (btn, index) {
      btn.addEventListener('click', function () {
        select(btn.getAttribute('data-mt-format-select'), false);
      });
      btn.addEventListener('keydown', function (e) {
        var step =
          e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 :
          e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = buttons[(index + step + buttons.length) % buttons.length];
        select(next.getAttribute('data-mt-format-select'), true);
      });
    });

    // 何も選択されていなければ先頭を開く（通常はHTML側の初期値=ストーリー型が使われる）
    if (!root.querySelector('.mt-ticket-panel.is-active')) {
      select(buttons[0].getAttribute('data-mt-format-select'), false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      initFormats();
    });
  } else {
    init();
    initFormats();
  }
})();
