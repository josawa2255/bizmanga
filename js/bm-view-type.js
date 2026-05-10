/**
 * BizManga — 漫画ビューの表示モード判定（縦読み / 見開き）共通ヘルパー
 *
 * 目的: `works.js` / `bm-works-page.js` / `bm-hero.js` の3ファイルが
 *       独自に判定していた view_type 解決ロジックを一本化する。
 *       ズレによるバグ（BUGS.md #012, #013）を構造的に防ぐ。
 *
 * API:
 *   window.bmViewType.isForcedVertical(work)
 *     → WPの view_type が 'vertical_only' | 'vertical' なら true（強制縦読み）
 *   window.bmViewType.isVerticalOnly(work)
 *     → 'vertical_only' のみ true（切替ボタン無効のロック状態）
 *   window.bmViewType.isVerticalByRatio(width, height)
 *     → height/width > THRESHOLD なら true（画像プローブ用）
 *   window.bmViewType.probeVerticalByImage(src)
 *     → Promise<boolean>（1枚だけロードして縦長か判定）
 *
 * 閾値を変更するときはこのファイルだけを触ること。
 */
(function() {
  // height/width > 1.8 を縦読みと判定（= width/height < 0.556）
  var VERTICAL_ASPECT_THRESHOLD = 1.8;

  function isForcedVertical(work) {
    if (!work) return false;
    var vt = work.view_type || work.viewType || work.mode;
    return vt === 'vertical_only' || vt === 'vertical';
  }

  function isVerticalOnly(work) {
    if (!work) return false;
    return (work.view_type || work.viewType) === 'vertical_only';
  }

  function isVerticalByRatio(w, h) {
    if (!w || !h) return false;
    return (h / w) > VERTICAL_ASPECT_THRESHOLD;
  }

  function probeVerticalByImage(src) {
    return new Promise(function(resolve) {
      if (!src) { resolve(false); return; }
      var img = new Image();
      img.onload = function() {
        resolve(isVerticalByRatio(img.naturalWidth, img.naturalHeight));
      };
      img.onerror = function() { resolve(false); };
      img.src = src;
    });
  }

  window.bmViewType = {
    THRESHOLD: VERTICAL_ASPECT_THRESHOLD,
    isForcedVertical: isForcedVertical,
    isVerticalOnly: isVerticalOnly,
    isVerticalByRatio: isVerticalByRatio,
    probeVerticalByImage: probeVerticalByImage
  };
})();
