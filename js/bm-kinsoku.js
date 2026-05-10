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
