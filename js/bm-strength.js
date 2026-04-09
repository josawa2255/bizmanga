/**
 * 強みページ — 巻物ナビ（クリックでスムーズスクロール）
 */
(function () {
  var items = document.querySelectorAll('.str-scroll-item');
  items.forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      var targetId = this.getAttribute('href').substring(1);
      var target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ===== i18n 対応 =====
  if (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en') {
    window.i18n.translateAll();
  }
})();
