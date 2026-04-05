/**
 * BizManga i18n System
 * =====================
 * 日本語テキストをキーにした自動翻訳システム。
 *
 * 仕組み:
 *   1. i18n/en.json に { "日本語": "English" } の辞書を用意
 *   2. EN ボタンで全 DOM テキストを一括置換
 *   3. MutationObserver で後から追加された DOM も自動処理
 *   4. JS からは i18n.t('日本語テキスト') で翻訳取得
 *
 * HTML 側の書き方:
 *   <h2>日本語テキスト</h2>             ← 自動検出（data属性不要）
 *   <h2 data-i18n-html>テキスト<br>改行</h2>  ← HTMLを含む場合
 *   <h2 data-i18n-skip>翻訳しない</h2>  ← 除外
 *
 * JS 側の書き方:
 *   var en = i18n.t('営業');              // → 'Sales'
 *   card.innerHTML = '<span>' + i18n.t('営業') + '</span>';
 *
 * 後方互換:
 *   data-ja / data-en が付いた要素は従来通り動作する（優先）
 */
(function () {
  'use strict';

  /* ============================================================
     設定
     ============================================================ */
  var JSON_PATH = (function () {
    // スクリプトのパスから相対パスを算出
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf('bm-i18n.js') !== -1) {
        return scripts[i].src.replace(/js\/bm-i18n\.js.*$/, 'i18n/en.json');
      }
    }
    return 'i18n/en.json';
  })();

  /* ============================================================
     状態
     ============================================================ */
  var dict = {};             // { ja: en } 翻訳辞書
  var loaded = false;        // 辞書読み込み完了フラグ
  var currentLang = 'ja';    // 現在の言語
  var originals = new Map(); // element → { type: 'text'|'html', value: string }
  var observer = null;       // MutationObserver

  /* ============================================================
     辞書ロード
     ============================================================ */
  function loadDict() {
    return fetch(JSON_PATH)
      .then(function (res) {
        if (!res.ok) throw new Error('i18n: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        dict = data;
        loaded = true;
        console.log('[i18n] Loaded ' + Object.keys(dict).length + ' translations');
      })
      .catch(function (err) {
        console.warn('[i18n] Failed to load translations:', err);
      });
  }

  /* ============================================================
     翻訳関数 (JS から呼ぶ用)
     ============================================================ */
  function t(jaText, fallback) {
    if (currentLang === 'ja') return jaText;
    return dict[jaText] || fallback || jaText;
  }

  /* ============================================================
     DOM 翻訳
     ============================================================ */
  // 翻訳対象にならないタグ
  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, IFRAME: 1, SVG: 1,
    CODE: 1, PRE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1
  };

  // 日本語が含まれるか判定
  function hasJapanese(str) {
    return /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/.test(str);
  }

  /**
   * 要素 1 つを翻訳 (ja → en)
   */
  function translateElement(el) {
    if (!el || !el.tagName) return;
    if (SKIP_TAGS[el.tagName]) return;
    if (el.hasAttribute && el.hasAttribute('data-i18n-skip')) return;

    // ── 後方互換: data-ja / data-en がある場合はそちら優先 ──
    if (el.hasAttribute('data-ja') && el.hasAttribute('data-en')) {
      var enAttr = el.getAttribute('data-en');
      // 元テキストを保存（まだ保存していなければ）
      if (!originals.has(el)) {
        var useHtml = el.hasAttribute('data-i18n-html') ||
                      el.getAttribute('data-ja').indexOf('<') !== -1;
        originals.set(el, {
          type: useHtml ? 'html' : 'text',
          value: useHtml ? el.innerHTML : el.textContent
        });
      }
      if (el.getAttribute('data-ja').indexOf('<') !== -1) {
        el.innerHTML = enAttr;
      } else {
        // SVG 等の子要素がある場合は最後のテキストノードだけ差し替え
        var textNodes = getTextNodes(el);
        if (textNodes.length === 1) {
          el.textContent = enAttr;
        } else if (textNodes.length > 1) {
          // 子SVG等を壊さないよう、テキストノードだけ差し替え
          replaceTextNodes(el, enAttr);
        } else {
          el.textContent = enAttr;
        }
      }
      return;
    }

    // ── data-i18n-html: innerHTML ごと翻訳 ──
    if (el.hasAttribute && el.hasAttribute('data-i18n-html')) {
      var html = el.innerHTML.trim();
      var enHtml = dict[html];
      if (enHtml) {
        if (!originals.has(el)) {
          originals.set(el, { type: 'html', value: html });
        }
        el.innerHTML = enHtml;
      }
      return;
    }

    // ── 自動検出: テキストノードを走査して日本語を翻訳 ──
    translateTextNodes(el);
  }

  /**
   * 要素内のテキストノードを走査して翻訳
   */
  function translateTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.textContent.trim();
      if (!text || !hasJapanese(text)) continue;

      var en = dict[text];
      if (en) {
        if (!originals.has(node)) {
          originals.set(node, { type: 'textNode', value: node.textContent });
        }
        node.textContent = node.textContent.replace(text, en);
      }
    }
  }

  /**
   * テキストノード一覧を取得
   */
  function getTextNodes(el) {
    var nodes = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = walker.nextNode())) {
      if (n.textContent.trim()) nodes.push(n);
    }
    return nodes;
  }

  /**
   * SVG等の子要素を壊さずテキスト部分だけ差し替え
   */
  function replaceTextNodes(el, newText) {
    var textNodes = getTextNodes(el);
    // 日本語を含むテキストノードだけ差し替え
    for (var i = 0; i < textNodes.length; i++) {
      if (hasJapanese(textNodes[i].textContent.trim())) {
        if (!originals.has(textNodes[i])) {
          originals.set(textNodes[i], { type: 'textNode', value: textNodes[i].textContent });
        }
        textNodes[i].textContent = ' ' + newText;
        return; // 最初の日本語ノードだけ
      }
    }
  }

  /**
   * DOM 全体を英語に翻訳
   */
  function translateAll() {
    // data-ja/data-en 付き要素を最優先
    var legacy = document.querySelectorAll('[data-ja][data-en]');
    for (var i = 0; i < legacy.length; i++) {
      translateElement(legacy[i]);
    }
    // data-i18n-html 付き要素
    var htmlEls = document.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmlEls.length; j++) {
      translateElement(htmlEls[j]);
    }
    // 残りの body 内テキストノード（自動検出）
    translateTextNodes(document.body);
  }

  /**
   * DOM 全体を日本語に復元
   */
  function restoreAll() {
    originals.forEach(function (data, target) {
      if (data.type === 'html') {
        target.innerHTML = data.value;
      } else if (data.type === 'textNode') {
        target.textContent = data.value;
      } else {
        target.textContent = data.value;
      }
    });
    originals.clear();
  }

  /* ============================================================
     MutationObserver — 動的に追加された DOM を自動翻訳
     ============================================================ */
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (mutations) {
      if (currentLang === 'ja') return;
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 新しく追加された要素とその子孫を翻訳
            translateElement(node);
            var children = node.querySelectorAll ? node.querySelectorAll('*') : [];
            for (var i = 0; i < children.length; i++) {
              translateElement(children[i]);
            }
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ============================================================
     言語切替
     ============================================================ */
  function switchLang(lang) {
    currentLang = lang;
    try { localStorage.setItem('bm-lang', lang); } catch (e) {}
    document.documentElement.lang = lang;

    // ボタンの active 切替
    document.querySelectorAll('.bm-lang-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });

    if (lang === 'en') {
      if (!loaded) {
        loadDict().then(function () {
          translateAll();
          startObserver();
        });
      } else {
        translateAll();
        startObserver();
      }
    } else {
      restoreAll();
    }

    // お問い合わせCTAボタン（bm-nav.js 互換）
    document.querySelectorAll('.bm-nav-cta').forEach(function (el) {
      el.textContent = lang === 'en' ? 'Contact' : 'お問い合わせ';
    });

    // カスタムイベント発火（他のJSが言語変更を知れるように）
    document.dispatchEvent(new CustomEvent('i18n-lang-changed', { detail: { lang: lang } }));
  }

  /* ============================================================
     辞書を外部から追加（WP APIデータ等）
     ============================================================ */
  function addTranslations(entries) {
    if (typeof entries !== 'object') return;
    Object.keys(entries).forEach(function (k) {
      dict[k] = entries[k];
    });
  }

  /* ============================================================
     初期化
     ============================================================ */
  function init() {
    // 辞書をプリロード（キャッシュに乗せる）
    loadDict().then(function () {
      // 保存された言語設定を復元
      var saved = 'ja';
      try { saved = localStorage.getItem('bm-lang') || 'ja'; } catch (e) {}
      if (saved === 'en') {
        switchLang('en');
      }
    });
  }

  // DOMReady で初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================================
     パブリック API
     ============================================================ */
  window.i18n = {
    t: t,                           // i18n.t('日本語') → 'English'
    switchLang: switchLang,          // i18n.switchLang('en')
    addTranslations: addTranslations, // i18n.addTranslations({ ja: en })
    getLang: function () { return currentLang; },
    getDict: function () { return dict; },
    translateElement: translateElement,
    translateAll: translateAll
  };

  // bm-nav.js 互換
  window.bmSwitchLang = switchLang;

})();
