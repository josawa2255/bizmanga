/**
 * BizManga 漫画ビューア
 * カードクリックで漫画をスクロール表示
 */
(function() {
  'use strict';

  var overlay = document.getElementById('bmViewerOverlay');
  var scroll = document.getElementById('bmViewerScroll');
  var closeBtn = document.getElementById('bmViewerClose');
  if (!overlay || !scroll) return;

  function openViewer(gallery) {
    if (!gallery || gallery.length === 0) return;
    scroll.innerHTML = '';
    gallery.forEach(function(url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      scroll.appendChild(img);
    });
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    scroll.scrollTop = 0;
  }

  function closeViewer() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    scroll.innerHTML = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeViewer);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeViewer();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) closeViewer();
  });

  // グローバル公開
  window.bmOpenViewer = openViewer;
})();
