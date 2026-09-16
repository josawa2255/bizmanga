/* ===================================================================
 * bm-manga-types.js — 「マンガの種類」ページの章セレクタ / 表現カスタマイズ / FAQ
 *
 * 左の一覧 (button[data-mt-select]) をクリック・キー操作すると、
 * 右の詳細 (article[data-mt-panel]) をページ遷移なしで切り替える。
 * 表現カスタマイズ ([data-mt-exp-group] / [data-mt-exp-option]) も同じ操作感
 * （クリック + 矢印キー）だが、切り替える詳細パネルは持たない。
 *
 * 方針:
 *   - 全パネルのHTMLは常にDOMに存在する。JSが動いたときだけ
 *     コンテナに .is-js を付け、非選択パネルをCSSで隠す
 *     （= JS無効・エラー時はすべて縦に並んだまま読める）
 *   - 選択状態は aria-pressed、詳細側は aria-live="polite" で通知
 *   - #mt-recruit のようなハッシュ付きURLでも該当章を開く（章セレクタのみ）
 * 2026-08-24 新規 / 2026-09-14 形式セレクタ（チケットUI）を廃止し表現カスタマイズへ置換
 * 2026-09-16 表現カスタマイズにも矢印キー操作を追加（章セレクタと操作感を揃えるため）
 * =================================================================== */
(function () {
  'use strict';

  function init() {
    var root = document.querySelector('[data-mt-chapters]');
    if (!root) return;

    var buttons = Array.prototype.slice.call(root.querySelectorAll('[data-mt-select]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-mt-panel]'));
    if (!buttons.length || !panels.length) return;

    // ヒーロー最右の7ジャンル索引（<a href="#mt-founding"> 等）。章一覧の外にあるので
    // root ではなく document から拾い、選択状態だけを章セレクタと同期させる。
    var heroGenres = Array.prototype.slice.call(
      document.querySelectorAll('[data-mt-hero-genre]')
    );

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
        // いま開いている章であることを aria-current でも明示する
        if (on) { b.setAttribute('aria-current', 'true'); }
        else { b.removeAttribute('aria-current'); }
        if (on && moveFocus) b.focus();
      });
      heroGenres.forEach(function (a) {
        var on = a.getAttribute('data-mt-hero-genre') === key;
        a.classList.toggle('is-active', on);
        if (on) { a.setAttribute('aria-current', 'true'); }
        else { a.removeAttribute('aria-current'); }
      });
      return true;
    }

    // ヒーロー索引のクリック: ハッシュが変わらない場合（同じ章を再クリック）でも
    // 表示を合わせておく。スクロール自体は hashchange → selectFromHash が担当する。
    heroGenres.forEach(function (a) {
      a.addEventListener('click', function () {
        select(a.getAttribute('data-mt-hero-genre'), false);
      });
    });

    // カードから選んだときだけ、詳細が画面外なら自然な位置まで寄せる
    // （ヒーロー索引やハッシュ経由は selectFromHash 側でスクロール済みなので何もしない）
    var detail = root.querySelector('.mt-chapter-detail');
    function revealDetail() {
      if (!detail) return;
      var r = detail.getBoundingClientRect();
      var headerH = 92;
      var fits = r.top >= headerH && r.bottom <= window.innerHeight;
      if (fits) return;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var y = r.top + window.pageYOffset - headerH;
      try {
        window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
      } catch (err) {
        window.scrollTo(0, y);
      }
    }

    buttons.forEach(function (btn, index) {
      btn.addEventListener('click', function () {
        select(btn.getAttribute('data-mt-select'), false);
        revealDetail();
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
      if (hash.indexOf('mt-') !== 0) return false;
      if (!select(hash.slice(3), false)) return false;
      if (scroll) scrollToChapters();
      return true;
    }
    // 初回ロードはアニメーションなしで位置だけ合わせる。
    // 画像の読み込みで高さが変わるので load 後にもう一度合わせ直す。
    // 章に一致したときだけ動かす（#mt-format-* / #mt-hero-title 等、章以外の mt- id で
    // CHAPTERS までスクロールしてしまわないように。2026-09-03）
    if (selectFromHash(false)) {
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
   * HOW TO EXPRESS — 表現カスタマイズ（STEP01 形式 / STEP02 画風）
   * 各グループ [data-mt-exp-group] の中で button[data-mt-exp-option] を
   * 1つだけ aria-pressed="true" にする。見た目は CSS 側が aria-pressed で切り替える。
   * 送信や診断はしない（「選べる」ことを伝えるだけ）。JS無効時は HTML の初期選択のまま。
   * 2026-09-14 追加
   * --------------------------------------------------------------- */
  function initExpress() {
    var groups = document.querySelectorAll('[data-mt-exp-group]');
    Array.prototype.forEach.call(groups, function (group) {
      var buttons = Array.prototype.slice.call(group.querySelectorAll('[data-mt-exp-option]'));

      function select(btn, moveFocus) {
        buttons.forEach(function (b) {
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        if (moveFocus) btn.focus();
      }

      buttons.forEach(function (btn, index) {
        btn.addEventListener('click', function () { select(btn, false); });
        // ↑↓←→ で選択を移動（章セレクタと同じ操作感。フォーカスも一緒に動かす）。
        // 2026-09-16: 章セレクタには矢印キーがあるのにここだけ無く、
        // 同じ見た目・同じ aria-pressed のUIで操作方法が食い違っていたため追加
        btn.addEventListener('keydown', function (e) {
          var step =
            e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 :
            e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          select(buttons[(index + step + buttons.length) % buttons.length], true);
        });
      });
    });
  }

  /* ---------------------------------------------------------------
   * FAQ — よくあるご質問（1問ずつ開く single accordion）
   * HTML の aria-expanded を初期状態として読み、項目の .is-open と同期する。
   * .is-js が付くまでは回答を畳まない（JS無効時は4問すべて表示）。
   * .is-ready は初期化の次フレームで付け、読み込み時に開閉アニメを走らせない。
   * --------------------------------------------------------------- */
  function initFaq() {
    var lists = document.querySelectorAll('[data-mt-faq]');
    Array.prototype.forEach.call(lists, function (list) {
      var items = Array.prototype.slice.call(list.querySelectorAll('.mt-faq-item'));

      function setOpen(item, open) {
        var btn = item.querySelector('.mt-faq-q__btn');
        if (!btn) return;
        item.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }

      items.forEach(function (item) {
        var btn = item.querySelector('.mt-faq-q__btn');
        if (!btn) return;
        setOpen(item, btn.getAttribute('aria-expanded') === 'true');
        btn.addEventListener('click', function () {
          var willOpen = btn.getAttribute('aria-expanded') !== 'true';
          items.forEach(function (other) {
            if (other !== item) setOpen(other, false);
          });
          setOpen(item, willOpen);
        });
      });

      list.classList.add('is-js');
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { list.classList.add('is-ready'); });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      initExpress();
      initFaq();
    });
  } else {
    init();
    initExpress();
    initFaq();
  }
})();
