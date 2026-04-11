/**
 * 共通CTAセクション生成
 * <section id="bmCtaMount"></section> を置くだけで統一CTAを挿入
 * ホームページのみキャラクター画像を表示
 */
(function () {
  var mount = document.getElementById('bmCtaMount');
  if (!mount) return;

  var isHome = /index\.html$/.test(location.pathname) || /\/$/.test(location.pathname);

  var characterHtml = isHome
    ? '<div class="bm-cta-character">' +
        '<img src="material/images/character-cta.webp" alt="ビズマンガキャラクター" width="240" height="300" loading="lazy">' +
      '</div>'
    : '';

  mount.className = 'bm-cta';
  mount.innerHTML =
    '<div class="bm-cta-inner">' +
      '<div class="bm-cta-content">' +
        '<h2 data-ja="まずはお気軽にご相談ください" data-en="Please feel free to consult with us first">まずはお気軽にご相談ください</h2>' +
        '<p class="bm-cta-sub" data-ja="お見積り・ご相談は完全無料です" data-en="Estimates and consultations are completely free">お見積り・ご相談は完全無料です</p>' +
        '<p class="bm-cta-desc" data-ja="ビジネス漫画のプロが、貴社に最適なプランをご提案します。" data-en="Our business manga experts will propose the best plan for your company.">ビジネス漫画のプロが、貴社に最適なプランをご提案します。</p>' +
        '<div class="bm-cta-buttons">' +
          '<a href="contact" class="bm-cta-btn bm-cta-btn--contact" data-ja="無料相談する" data-en="Free Consultation">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>' +
            '<span data-ja="無料相談する" data-en="Free Consultation">無料相談する</span>' +
          '</a>' +
          '<a href="https://line.me/R/ti/p/@626kzaze?oat_content=url&ts=01071831" class="bm-cta-btn bm-cta-btn--line" target="_blank" rel="noopener">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 5.93 2 10.66c0 2.73 1.44 5.17 3.7 6.76-.13.47-.84 3.05-.87 3.26 0 0-.02.16.08.22s.21.02.21.02c.28-.04 3.24-2.12 3.75-2.48.96.14 1.95.22 2.96.22h.17c5.52 0 10-3.93 10-8.66S17.52 2 12 2z"/></svg>' +
            '<span data-ja="LINEで相談" data-en="Chat on LINE">LINEで相談</span>' +
          '</a>' +
        '</div>' +
        '<div class="bm-cta-badges">' +
          '<span class="bm-cta-badge" data-ja="最短即日返信" data-en="Same-day reply"><svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg> 最短即日返信</span>' +
          '<span class="bm-cta-badge" data-ja="見積り無料" data-en="Free estimate"><svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg> 見積り無料</span>' +
          '<span class="bm-cta-badge" data-ja="著作権安心" data-en="Copyright safe"><svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg> 著作権安心</span>' +
        '</div>' +
      '</div>' +
      characterHtml +
    '</div>';

  // i18n対応
  if (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en') {
    window.i18n.translateAll();
  }
})();
