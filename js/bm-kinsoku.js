/**
 * BizManga 日本語禁則処理 (JS)
 *
 * 対象セレクタ内のテキストについて以下を適用:
 *  1. 「...」『...』 の内側を改行禁止 (nowrap spanで包む)
 *  2. 末尾2文字を word joiner (U+2060) で結合し、1文字孤立を防止
 *
 * CSS の text-wrap: balance/pretty だけでは防げない日本語特有の
 * 改行崩れを確実に抑える。
 */
(function () {
  "use strict";

  var SELECTORS = [
    ".bm-column-lead",
    ".bm-column-card-excerpt",
    ".bm-column-featured-excerpt",
    ".bm-column-hero-eyebrow",
    ".bm-section-desc",
    /* manga-types の7章カード。幅170px前後に11px級の本文が入るため、
       末尾の「。」が1文字だけ次行に落ちやすい（2026-09-10 追加） */
    ".mt-chapter-card__desc",
    /* manga-types の表現カスタマイズ。STEPの説明文は幅によって折り返すので
       末尾の「。」だけが落ちないようにする（旧 .mt-sty-point__text は画風選び廃止で削除）。2026-09-14 */
    ".mt-exp-step__desc",
    /* manga-types の選び方ミニガイド。説明文の末尾「す。」が1文字落ちないように（2026-09-14） */
    ".mt-choose__lead",
    /* manga-types の FAQ 説明文。末尾「い。」が1文字落ちないように（2026-09-14）。
       回答本文は「」内を nowrap にするとスマホで改行が崩れるため対象外 */
    ".mt-faq__lead",
  ];

  var JOINER = "\u2060"; // word joiner (不可視 + 改行禁止)
  var FLAG = "__bmKinsokuApplied";
  var QUOTE_RE = /[「『][^「『」』]+[」』]/g;

  /** 「...」『...』の内側を nowrap span で保護 */
  function protectQuotes(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var targets = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.classList.contains("bm-kinsoku-nobr")) continue;
      if (!/[「『][^「『」』]+[」』]/.test(node.nodeValue)) continue;
      targets.push(node);
    }
    targets.forEach(function (textNode) {
      var text = textNode.nodeValue;
      var frag = document.createDocumentFragment();
      var lastIndex = 0;
      // String.prototype.replace をコールバックで使って書き換え不要
      text.replace(QUOTE_RE, function (match, offset) {
        if (offset > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
        }
        var span = document.createElement("span");
        span.className = "bm-kinsoku-nobr";
        span.style.whiteSpace = "nowrap";
        span.textContent = match;
        frag.appendChild(span);
        lastIndex = offset + match.length;
        return match;
      });
      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  /** 末尾テキストノードの最後2文字を word joiner で結合（1文字孤立回避） */
  function joinTailChars(el) {
    var lastNode = null;
    for (var i = el.childNodes.length - 1; i >= 0; i--) {
      var n = el.childNodes[i];
      if (n.nodeType === Node.TEXT_NODE && n.nodeValue.replace(/[\s\u3000]+$/, "").length > 0) {
        lastNode = n;
        break;
      }
      if (n.nodeType === Node.ELEMENT_NODE) {
        joinTailChars(n);
        return;
      }
    }
    if (!lastNode) return;
    var t = lastNode.nodeValue;
    var trimmed = t.replace(/[\s\u3000]+$/, "");
    if (trimmed.length < 3) return;
    var lastTwo = trimmed.slice(-2);
    if (lastTwo.indexOf(JOINER) !== -1) return;
    var newLastTwo = lastTwo[0] + JOINER + lastTwo[1];
    lastNode.nodeValue = t.slice(0, trimmed.length - 2) + newLastTwo + t.slice(trimmed.length);
  }

  function apply(el) {
    if (!el || el[FLAG]) return;
    protectQuotes(el);
    joinTailChars(el);
    el[FLAG] = true;
  }

  function run() {
    SELECTORS.forEach(function (sel) {
      var els = document.querySelectorAll(sel);
      Array.prototype.forEach.call(els, apply);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

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
