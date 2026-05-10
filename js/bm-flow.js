/**
 * 制作フローギャラリー: CSS scroll-snap + scrollIntoView
 * ContentsXと同一仕様
 */
(function() {
  'use strict';

  var gallery = document.getElementById('flowGallery');
  if (!gallery) return;

  var items = gallery.querySelectorAll('.flow-gallery-item');
  var totalItems = items.length;
  if (totalItems === 0) return;

  var flowSteps = document.querySelectorAll('.flow-step[data-step]');
  var currentIndex = 0;

  // --- STEP連動ハイライト ---
  function highlightStep(stepNum) {
    flowSteps.forEach(function(el) { el.classList.remove('flow-hover'); });
    flowSteps.forEach(function(el) {
      if (el.getAttribute('data-step') === String(stepNum)) el.classList.add('flow-hover');
    });
  }
  highlightStep(1);

  // --- 中央に表示されているアイテムを検出 ---
  function detectCenteredItem() {
    var galRect = gallery.getBoundingClientRect();
    var center = galRect.left + galRect.width / 2;
    var closest = 0;
    var minDist = Infinity;
    items.forEach(function(item, i) {
      var r = item.getBoundingClientRect();
      var d = Math.abs((r.left + r.width / 2) - center);
      if (d < minDist) { minDist = d; closest = i; }
    });
    if (closest !== currentIndex) {
      currentIndex = closest;
      highlightStep(currentIndex + 1);
    }
  }

  var scrollTimer = null;
  gallery.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(detectCenteredItem, 80);
  }, { passive: true });

  // --- ギャラリー内スクロール ---
  function scrollToIndex(index, smooth) {
    index = Math.max(0, Math.min(index, totalItems - 1));
    var item = items[index];
    var scrollTarget = item.offsetLeft - (gallery.offsetWidth - item.offsetWidth) / 2;
    gallery.scrollTo({
      left: Math.max(0, scrollTarget),
      behavior: smooth ? 'smooth' : 'instant'
    });
    currentIndex = index;
    highlightStep(index + 1);
  }

  // 初期位置
  gallery.scrollLeft = 0;
  window.addEventListener('load', function() {
    scrollToIndex(0, false);
  });

  // --- 左のステップをクリック ---
  flowSteps.forEach(function(el) {
    el.addEventListener('click', function() {
      var step = parseInt(el.getAttribute('data-step'), 10);
      if (step >= 1 && step <= totalItems) {
        scrollToIndex(step - 1, true);
        resetAuto();
      }
    });
  });

  // --- ホバー連動 ---
  flowSteps.forEach(function(el) {
    el.addEventListener('mouseenter', function() { highlightStep(el.getAttribute('data-step')); });
    el.addEventListener('mouseleave', function() { highlightStep(currentIndex + 1); });
  });
  items.forEach(function(el) {
    el.addEventListener('mouseenter', function() { highlightStep(el.getAttribute('data-step')); });
    el.addEventListener('mouseleave', function() { highlightStep(currentIndex + 1); });
  });

  // --- 画像クリックで進む/戻る ---
  gallery.addEventListener('click', function(e) {
    var rect = gallery.getBoundingClientRect();
    var clickX = e.clientX - rect.left;
    if (clickX > rect.width / 2) {
      if (currentIndex < totalItems - 1) { scrollToIndex(currentIndex + 1, true); resetAuto(); }
    } else {
      if (currentIndex > 0) { scrollToIndex(currentIndex - 1, true); resetAuto(); }
    }
  });

  // --- 4秒ごとに自動スクロール ---
  var autoInterval = setInterval(function() {
    if (currentIndex < totalItems - 1) {
      scrollToIndex(currentIndex + 1, true);
    } else {
      scrollToIndex(0, true);
    }
  }, 4000);

  function resetAuto() {
    clearInterval(autoInterval);
    autoInterval = setInterval(function() {
      if (currentIndex < totalItems - 1) {
        scrollToIndex(currentIndex + 1, true);
      } else {
        scrollToIndex(0, true);
      }
    }, 4000);
  }
  gallery.addEventListener('touchstart', resetAuto, { passive: true });
  gallery.addEventListener('wheel', resetAuto, { passive: true });
  flowSteps.forEach(function(el) { el.addEventListener('click', resetAuto); });

  // i18n対応
  if (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en') {
    window.i18n.translateAll();
  }
})();
