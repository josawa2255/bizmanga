/**
 * クライアント企業ロゴ無限カルーセル
 * データ: js/data/client-logos.js (CLIENT_LOGOS)
 * レンダリング: 6セット並べて translateX(-16.6667%) アニメでループ
 * 2026-05-13 manga-production-company に移植 (Cホームと同一仕様)
 * innerHTMLを避けてDOM APIで構築 (XSS対策)
 */
(function () {
  'use strict';

  function createItem(c, prefix) {
    const el = document.createElement(c.url ? 'a' : 'span');
    el.className = prefix + 'client-logo-item';
    el.setAttribute('aria-label', c.name);
    if (c.url) {
      el.href = c.url;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
    if (c.logo) {
      const img = document.createElement('img');
      img.src = c.logo;
      img.alt = c.name;
      img.loading = 'lazy';
      img.width = 140;
      img.height = 48;
      el.appendChild(img);
    } else {
      const txt = document.createElement('span');
      txt.className = prefix + 'client-logo-text';
      txt.textContent = c.name;
      el.appendChild(txt);
    }
    return el;
  }

  function render(trackId, items, prefix) {
    const track = document.getElementById(trackId);
    if (!track || !items || !items.length) return;
    const fragment = document.createDocumentFragment();
    for (let n = 0; n < 6; n++) {
      items.forEach(function (c) {
        fragment.appendChild(createItem(c, prefix));
      });
    }
    track.replaceChildren(fragment);
  }

  function init() {
    render('clientLogosTrack', typeof CLIENT_LOGOS === 'undefined' ? [] : CLIENT_LOGOS, '');
    render('bmClientLogosTrack', typeof BM_CLIENT_LOGOS === 'undefined' ? [] : BM_CLIENT_LOGOS, 'bm-');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
