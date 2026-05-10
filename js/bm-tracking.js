/**
 * BizManga 行動トラッキング
 * sessionStorageに閲覧行動を蓄積し、問い合わせフォーム送信時にメッセージに付加
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'bm_tracking';

  function getTracking() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    } catch(e) { return {}; }
  }

  function saveTracking(data) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
  }

  // ===== ページ訪問記録 =====
  var t = getTracking();
  if (!t.startTime) t.startTime = Date.now();
  if (!t.pages) t.pages = [];
  var currentPage = location.pathname.replace(/\.html$/, '').replace(/^\//, '') || 'home';
  if (t.pages.indexOf(currentPage) === -1) t.pages.push(currentPage);
  saveTracking(t);

  // ===== スクロール深度トラッキング =====
  var maxScroll = 0;
  var scrollKey = 'scroll_' + currentPage;
  window.addEventListener('scroll', function() {
    var scrollPct = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );
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
          if (!t[viewedKey]) t[viewedKey] = [];
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
      if (!t.faqClicked) t.faqClicked = [];
      var q = btn.getAttribute('data-ja') || btn.textContent.trim().slice(0, 30);
      if (t.faqClicked.indexOf(q) === -1) {
        t.faqClicked.push(q);
        saveTracking(t);
      }
    });
  });

  // ===== 制作事例カテゴリフィルタートラッキング =====
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.bm-filter-btn, .filter-btn');
    if (!btn) return;
    var t = getTracking();
    if (!t.categoryViewed) t.categoryViewed = [];
    var cat = btn.getAttribute('data-ja') || btn.textContent.trim().replace(/\(\d+\)/, '').trim();
    if (cat && cat !== 'すべて' && t.categoryViewed.indexOf(cat) === -1) {
      t.categoryViewed.push(cat);
      saveTracking(t);
    }
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
    if (t.pages && t.pages.length > 0) {
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
    if (t.faqClicked && t.faqClicked.length > 0) {
      lines.push('閲覧FAQ: ' + t.faqClicked.join(', '));
    }

    // 関心カテゴリ
    if (t.categoryViewed && t.categoryViewed.length > 0) {
      lines.push('関心カテゴリ: ' + t.categoryViewed.join(', '));
    }

    return lines.length > 0 ? '\n[行動ログ]\n' + lines.join('\n') : '';
  };
})();
