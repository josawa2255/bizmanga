/**
 * 強みページ — Bentoカードナビ（クリックでスムーズスクロール）
 */
(function () {
  var cards = document.querySelectorAll('.str-bento-card');
  cards.forEach(function (card) {
    card.addEventListener('click', function (e) {
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
