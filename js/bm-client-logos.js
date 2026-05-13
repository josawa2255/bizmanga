/**
 * クライアント企業ロゴ無限カルーセル (BizManga版)
 * データ: js/data/bm-client-logos.js (BM_CLIENT_LOGOS) — 静的・信頼済み
 */
(function () {
  'use strict';

  function renderItem(c) {
    const tag = c.url ? 'a' : 'span';
    const href = c.url ? ` href="${c.url}" target="_blank" rel="noopener noreferrer"` : '';
    const inner = c.logo
      ? `<img src="${c.logo}" alt="${c.name}" loading="lazy" width="140" height="48">`
      : `<span class="bm-client-logo-text">${c.name}</span>`;
    return `<${tag} class="bm-client-logo-item" aria-label="${c.name}"${href}>${inner}</${tag}>`;
  }

  function init() {
    const track = document.getElementById('bmClientLogosTrack');
    if (!track || typeof BM_CLIENT_LOGOS === 'undefined' || !BM_CLIENT_LOGOS.length) return;
    const items = BM_CLIENT_LOGOS.map(renderItem).join('');
    track.innerHTML = items.repeat(6);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
