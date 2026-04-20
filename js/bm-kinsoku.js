/**
 * BizManga 日本語禁則処理 (JS fallback)
 *
 * CSSの text-wrap: balance / pretty で解決できない「末尾1文字孤立」
 * (例: 「効く使い方」→「方」だけ次行) を防ぐため、
 * 指定セレクタ内のテキストの末尾2文字を word joiner (\u2060) で結合する。
 *
 * word joiner は不可視 & 幅ゼロ、改行禁止の効果のみ。
 *
 * 対象: 主要段落/キャプションクラス。冪等に動作（二重処理なし）。
 */
(function () {
  "use strict";

  var SELECTORS = [
    ".bm-column-lead",
    ".bm-column-card-excerpt",
    ".bm-column-featured-excerpt",
    ".bm-column-hero-eyebrow",
    ".bm-section-desc",
  ];

  var JOINER = "\u2060"; // word joiner (invisible, prevents break)
  var FLAG = "__bmKinsokuApplied";

  function processTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    var t = node.nodeValue;
    if (!t || t.length < 3) return;
    // trim trailing whitespace to find "last" meaningful char
    var trimmed = t.replace(/[\s\u3000]+$/, "");
    if (trimmed.length < 3) return;
    // Insert joiner between last 2 characters
    var lastTwo = trimmed.slice(-2);
    // Skip if already joined
    if (lastTwo.indexOf(JOINER) !== -1) return;
    var newLastTwo = lastTwo[0] + JOINER + lastTwo[1];
    node.nodeValue = t.slice(0, trimmed.length - 2) + newLastTwo + t.slice(trimmed.length);
  }

  function applyToElement(el) {
    if (!el || el[FLAG]) return;
    // Only process direct text children (avoid nested elements)
    var lastTextNode = null;
    for (var i = el.childNodes.length - 1; i >= 0; i--) {
      var n = el.childNodes[i];
      if (n.nodeType === Node.TEXT_NODE && n.nodeValue.replace(/[\s\u3000]+$/, "").length > 0) {
        lastTextNode = n;
        break;
      }
      // If last non-empty node is an element with text, recurse
      if (n.nodeType === Node.ELEMENT_NODE) {
        applyToElement(n);
        break;
      }
    }
    if (lastTextNode) processTextNode(lastTextNode);
    el[FLAG] = true;
  }

  function run() {
    SELECTORS.forEach(function (sel) {
      var els = document.querySelectorAll(sel);
      Array.prototype.forEach.call(els, applyToElement);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  // i18n 切替などで DOM が書き換わったら再適用
  window.addEventListener("i18n-lang-changed", function () {
    SELECTORS.forEach(function (sel) {
      var els = document.querySelectorAll(sel);
      Array.prototype.forEach.call(els, function (el) {
        el[FLAG] = false;
      });
    });
    run();
  });
})();
