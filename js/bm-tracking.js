/**
 * BizManga 行動トラッキング
 * sessionStorageに閲覧行動を蓄積し、問い合わせフォーム送信時にメッセージに付加
 */
(function() {
  'use strict';

  // 二重読込でもログ・イベントリスナーを重複させない。
  if (window.__bmTrackingInitialized) return;
  window.__bmTrackingInitialized = true;

  var STORAGE_KEY = 'bm_tracking';

  function getTracking() {
    try {
      var data = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
      // null・配列・プリミティブが残っていてもフォーム用ログを壊さない。
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch(e) { return {}; }
  }

  function saveTracking(data) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
  }

  // ===== ページ訪問記録 =====
  var t = getTracking();
  if (!t.startTime) t.startTime = Date.now();
  if (!Array.isArray(t.pages)) t.pages = [];
  var currentPage = location.pathname.replace(/\.html$/, '').replace(/^\//, '') || 'home';
  if (t.pages.indexOf(currentPage) === -1) t.pages.push(currentPage);
  saveTracking(t);

  // ===== スクロール深度トラッキング =====
  var maxScroll = 0;
  var scrollKey = 'scroll_' + currentPage;
  window.addEventListener('scroll', function() {
    var scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollRange <= 0) return;
    // 短いページのゼロ除算と、端末のオーバースクロールを除外。
    var scrollPct = Math.max(0, Math.min(100,
      Math.round((window.scrollY / scrollRange) * 100)
    ));
    if (scrollPct > maxScroll) {
      maxScroll = scrollPct;
      var t = getTracking();
      t[scrollKey] = maxScroll;
      saveTracking(t);
    }
  }, { passive: true });

  // ===== セクション可視化トラッキング =====
  var sections = document.querySelectorAll('section[id], .bm-about, .bm-whatis, .bm-news, .bm-gallery, .bm-testimonials, .bm-pre-section, .bm-faq-page, .bm-pricing-section');
  if (sections.length > 0 && 'IntersectionObserver' in window) {
    var viewedKey = 'viewed_' + currentPage;
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var t = getTracking();
          if (!Array.isArray(t[viewedKey])) t[viewedKey] = [];
          var name = entry.target.id || entry.target.className.split(' ')[0];
          if (t[viewedKey].indexOf(name) === -1) {
            t[viewedKey].push(name);
            saveTracking(t);
          }
        }
      });
    }, { threshold: 0.3 });
    sections.forEach(function(s) { observer.observe(s); });
  }

  // ===== FAQ クリックトラッキング =====
  document.querySelectorAll('.bm-faq-q').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var t = getTracking();
      if (!Array.isArray(t.faqClicked)) t.faqClicked = [];
      var q = btn.textContent.trim().slice(0, 30);
      if (t.faqClicked.indexOf(q) === -1) {
        t.faqClicked.push(q);
        saveTracking(t);
      }
    });
  });

  // ===== 制作事例カテゴリフィルタートラッキング =====
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    var btn = target.closest('.bm-filter-btn, .filter-btn');
    if (!btn) return;
    var t = getTracking();
    if (!Array.isArray(t.categoryViewed)) t.categoryViewed = [];
    var cat = btn.textContent.trim().replace(/\(\d+\)/, '').trim();
    if (cat && cat !== 'すべて' && t.categoryViewed.indexOf(cat) === -1) {
      t.categoryViewed.push(cat);
      saveTracking(t);
    }
  });

  // ===== 相談導線のGA4計測（クリックと送信成功は必ず別イベント） =====
  // 既存のGoogle広告CV・generate_lead・拡張計測clickは変更しない。
  // これらのクリックイベントは補助指標。主要CVへの登録は行わない。
  function normalizedPath(path) {
    return path.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
  }

  function sendIntentEvent(eventName) {
    var eventParams = {
      send_to: 'G-Q1T3033Q3W',
      page_path: normalizedPath(location.pathname)
    };
    function send() {
      // 計測失敗がリンク遷移やフォームの操作に影響しないよう分離。
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', eventName, eventParams);
        }
      } catch (e) {}
    }
    // 既存ページのheadで登録されたload時のgtag configを先に実行する。
    if (document.readyState === 'complete') send();
    else window.addEventListener('load', send, { once: true });
  }

  document.addEventListener('click', function(e) {
    // ローカル確認や自動クリックで、本番の行動指標を増やさない。
    if (location.hostname !== 'bizmanga.contentsx.jp' || e.isTrusted === false) return;
    if (e.button != null && e.button !== 0) return;
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    var link = target.closest('a[href]');
    if (!link) return;
    var rawHref = link.getAttribute('href');
    if (!rawHref || rawHref.charAt(0) === '#') return;
    var url;
    try { url = new URL(rawHref, location.href); } catch (err) { return; }

    if (url.protocol === 'tel:') {
      sendIntentEvent('phone_click');
    } else if (url.protocol === 'https:' &&
      (url.hostname === 'line.me' || url.hostname === 'lin.ee')) {
      sendIntentEvent('line_click');
    } else if (url.origin === location.origin) {
      var path = normalizedPath(url.pathname);
      if (path === '/contact' && normalizedPath(location.pathname) !== '/contact') {
        sendIntentEvent('contact_link_click');
      } else if (path === '/download' && normalizedPath(location.pathname) !== '/download') {
        sendIntentEvent('download_link_click');
      }
    }
    // 氏名・メール・電話番号・リンクの全文/クエリはイベントに付加しない。
    // preventDefault/stopPropagationを使わず既存の導線をそのまま維持する。
  });

  // ===== トラッキングデータをテキスト化（フォーム送信時に使用） =====
  window.bmGetTrackingNote = function() {
    var t = getTracking();
    var lines = [];

    // 滞在時間
    if (t.startTime) {
      var mins = Math.round((Date.now() - t.startTime) / 60000);
      if (mins > 0) lines.push('滞在時間: ' + mins + '分');
    }

    // 訪問ページ
    if (Array.isArray(t.pages) && t.pages.length > 0) {
      lines.push('訪問ページ: ' + t.pages.join(' → '));
    }

    // スクロール深度
    var scrollLines = [];
    Object.keys(t).forEach(function(k) {
      if (k.startsWith('scroll_')) {
        var page = k.replace('scroll_', '');
        scrollLines.push(page + ': ' + t[k] + '%');
      }
    });
    if (scrollLines.length > 0) {
      lines.push('スクロール深度: ' + scrollLines.join(', '));
    }

    // 閲覧FAQ
    if (Array.isArray(t.faqClicked) && t.faqClicked.length > 0) {
      lines.push('閲覧FAQ: ' + t.faqClicked.join(', '));
    }

    // 関心カテゴリ
    if (Array.isArray(t.categoryViewed) && t.categoryViewed.length > 0) {
      lines.push('関心カテゴリ: ' + t.categoryViewed.join(', '));
    }

    return lines.length > 0 ? '\n[行動ログ]\n' + lines.join('\n') : '';
  };
})();
