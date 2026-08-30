/**
 * BizManga — 制作事例モーダル 上下2ペイン分割（スマホ × 縦読みのみ）
 *
 * 課題:
 *   縦読み作品は漫画本体が非常に長く、スマホの一体スクロールだと
 *   「使用媒体 / 導入内容 / 演出ポイント」まで到達できず実質読まれない。
 *
 * 挙動:
 *   上ペイン=漫画 / 下ペイン=詳細 に分け、それぞれ独立スクロールさせる。
 *   さらに「読んでいる側に広さを譲る」= 下ペインをスクロールしたら下が伸び、
 *   上ペインをスクロールしたら上が伸びて既定比率に戻る（A案）。
 *   ハンドルのドラッグで手動リサイズも可能。
 *
 * 適用条件（いずれか欠けたら何もしない）:
 *   - 画面幅 768px 以下（CSS側のメディアクエリと一致させること）
 *   - 縦読み（.work-detail-carousel.vertical-scroll が付いている）
 *   横読みは従来どおり一体スクロールのまま。
 *
 * 呼び出し元: js/bm-hero.js（index.html） / js/bm-works-page.js（works.html）
 *   両方が同じ #workDetailOverlay を操作するため、ロジックはここに一本化する。
 *   （片側だけ直して挙動がズレる BUGS.md #012 / #013 の再発防止）
 */
(function() {
  'use strict';

  // CSS の @media (max-width: 768px) と必ず揃えること
  var MOBILE_MAX_WIDTH = 768;

  // 上ペイン（漫画）の高さ比率
  var SPLIT_MANGA = 0.75;   // 既定 / 漫画を読んでいるとき
  var SPLIT_EVEN = 0.5;     // 詳細を読み始めたとき
  var SPLIT_DETAIL = 0.25;  // 詳細を深く読み込んでいるとき（漫画は最低 1/4 残す）

  // スクロールを「読む意図」とみなす最小量(px)。慣性の揺り戻しでの誤発火を防ぐ
  var INTENT_THRESHOLD = 24;

  var overlay = document.getElementById('workDetailOverlay');
  var content = overlay && overlay.querySelector('.work-detail-content');
  var carousel = document.getElementById('workDetailCarousel');
  var right = overlay && overlay.querySelector('.work-detail-right');
  if (!overlay || !content || !carousel || !right) return;

  var handle = null;
  var currentSplit = SPLIT_MANGA;
  var enabled = false;

  function isMobile() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX_WIDTH + 'px)').matches;
  }

  function isVertical() {
    return carousel.classList.contains('vertical-scroll');
  }

  // 比率を変えるとペインの高さが変わり、その結果 scrollTop が押し戻されて
  // scroll イベントが再発火する。それを「ユーザーが読んでいる」と誤認すると
  // 比率が勝手に戻る/固まるフィードバックループになるため、変更直後の
  // scroll は意図とみなさない（高さトランジション 0.32s + 余裕）。
  var SETTLE_MS = 420;
  var settleUntil = 0;

  function isSettling() {
    return performance.now() < settleUntil;
  }

  function setSplit(v) {
    if (v === currentSplit) return;
    currentSplit = v;
    overlay.style.setProperty('--wd-split', String(v));
    settleUntil = performance.now() + SETTLE_MS;
  }

  // --- ハンドル（下ペインを掴んで上下にリサイズ） ---
  function ensureHandle() {
    if (handle) return handle;
    handle = document.createElement('div');
    handle.className = 'wd-split-handle';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'horizontal');
    handle.setAttribute('aria-label', '漫画と詳細の表示比率を変更');
    // 上ペインと下ペインの境界に差し込む
    content.insertBefore(handle, right);

    var dragging = false;

    function onDown(e) {
      dragging = true;
      handle.setPointerCapture && e.pointerId != null && handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var y = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      var ratio = y / (window.innerHeight || 1);
      // 上下とも最低 1/4 は残す
      ratio = Math.max(SPLIT_DETAIL, Math.min(SPLIT_MANGA, ratio));
      // ドラッグ中は追従性を優先してトランジションを切る
      overlay.classList.add('wd-split-dragging');
      setSplit(ratio);
      e.preventDefault();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      overlay.classList.remove('wd-split-dragging');
    }

    if (window.PointerEvent) {
      handle.addEventListener('pointerdown', onDown);
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    } else {
      handle.addEventListener('touchstart', onDown, { passive: false });
      handle.addEventListener('touchmove', onMove, { passive: false });
      handle.addEventListener('touchend', onUp);
    }
    return handle;
  }

  // --- スクロール意図の検知 ---
  // 下ペインを読み進めるほど詳細を広げ、上ペイン（漫画）に戻れば元に戻す。
  var rightStartTop = 0;
  var rightTicking = false;

  function onRightScroll() {
    if (!enabled || rightTicking || isSettling()) return;
    rightTicking = true;
    requestAnimationFrame(function() {
      rightTicking = false;
      if (isSettling()) return;
      var top = right.scrollTop;
      if (top <= 2) {
        // 先頭に戻った = 詳細を読み終えた／閉じた扱い。均等までは維持する
        setSplit(SPLIT_EVEN);
        rightStartTop = 0;
        return;
      }
      if (top - rightStartTop > INTENT_THRESHOLD) {
        // 読み進めている → さらに詳細へ寄せる
        setSplit(SPLIT_DETAIL);
      } else if (currentSplit === SPLIT_MANGA) {
        setSplit(SPLIT_EVEN);
      }
    });
  }

  function onRightTouchStart() {
    if (!enabled) return;
    rightStartTop = right.scrollTop;
    // 触れた時点で「詳細を読む」意図とみなし、最低でも均等まで開く
    if (currentSplit === SPLIT_MANGA) setSplit(SPLIT_EVEN);
  }

  var mangaTicking = false;
  function onMangaScroll() {
    if (!enabled || mangaTicking || isSettling()) return;
    mangaTicking = true;
    requestAnimationFrame(function() {
      mangaTicking = false;
      if (isSettling()) return;
      // 漫画に戻った = 漫画を読む意図。既定比率へ戻す（A案）
      setSplit(SPLIT_MANGA);
    });
  }

  function onMangaTouchStart() {
    if (!enabled) return;
    setSplit(SPLIT_MANGA);
  }

  function attach() {
    right.addEventListener('scroll', onRightScroll, { passive: true });
    right.addEventListener('touchstart', onRightTouchStart, { passive: true });
    right.addEventListener('pointerdown', onRightTouchStart);
    carousel.addEventListener('scroll', onMangaScroll, { passive: true });
    carousel.addEventListener('touchstart', onMangaTouchStart, { passive: true });
    carousel.addEventListener('pointerdown', onMangaTouchStart);
  }

  function detach() {
    right.removeEventListener('scroll', onRightScroll);
    right.removeEventListener('touchstart', onRightTouchStart);
    right.removeEventListener('pointerdown', onRightTouchStart);
    carousel.removeEventListener('scroll', onMangaScroll);
    carousel.removeEventListener('touchstart', onMangaTouchStart);
    carousel.removeEventListener('pointerdown', onMangaTouchStart);
  }

  /**
   * モーダルを開いた直後（縦読み/横読みが確定した後）に呼ぶ。
   * 条件を満たさなければ自動的に無効化するので、呼び出し側で分岐は不要。
   */
  function apply() {
    var shouldEnable = isMobile() && isVertical();

    if (!shouldEnable) {
      if (enabled) {
        detach();
        enabled = false;
      }
      overlay.classList.remove('wd-split');
      overlay.style.removeProperty('--wd-split');
      if (handle) handle.style.display = '';
      return;
    }

    if (!enabled) {
      ensureHandle();
      attach();
      enabled = true;
    }
    overlay.classList.add('wd-split');
    // 開くたびに既定比率・スクロール位置へリセット
    currentSplit = null;
    setSplit(SPLIT_MANGA);
    carousel.scrollTop = 0;
    right.scrollTop = 0;
    rightStartTop = 0;
  }

  /** モーダルを閉じるときに呼ぶ（状態を残さない） */
  function reset() {
    if (enabled) {
      detach();
      enabled = false;
    }
    overlay.classList.remove('wd-split', 'wd-split-dragging');
    overlay.style.removeProperty('--wd-split');
  }

  // 回転・ウィンドウリサイズで条件が変わったら再判定
  window.addEventListener('resize', function() {
    if (overlay.classList.contains('active')) apply();
  });

  window.bmWdSplit = { apply: apply, reset: reset };
})();
