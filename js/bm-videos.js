/**
 * bm-videos.js — ホーム対談・動画セクション
 * 初期表示はサムネイル(<button.bm-video-thumb>)のみで、クリックされた時に
 * youtube-nocookie の iframe を生成して差し替える（初回ロードを重くしないため。
 * bizanime.js と同じ遅延方針）。
 */
(function () {
  'use strict';

  var ID_RE = /^[\w-]{6,20}$/; // YouTube動画IDは英数・-・_のみ

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.bm-video-thumb') : null;
    if (!btn) return;

    var id = btn.getAttribute('data-video-id') || '';
    if (!ID_RE.test(id)) return;

    var ifr = document.createElement('iframe');
    ifr.className = 'bm-video-frame';
    ifr.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0';
    ifr.title = btn.getAttribute('aria-label') || 'YouTube video';
    ifr.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    ifr.setAttribute('allowfullscreen', '');
    ifr.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    btn.replaceWith(ifr);
  });
})();
