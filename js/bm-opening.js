/**
 * BizManga オープニング動画
 * - ページ読み込み時に全画面オーバーレイで動画再生
 * - 左下にSKIPボタン
 * - 動画終了 or スキップ → フェードアウトしてHeroへ
 * - セッション中1回のみ再生（sessionStorageで制御）
 */
(function() {
  'use strict';

  var opening = document.getElementById('bmOpening');
  var video = document.getElementById('bmOpeningVideo');
  var skipBtn = document.getElementById('bmOpeningSkip');
  if (!opening || !video) return;

  // セッション中に既に見た場合はスキップ
  if (sessionStorage.getItem('bm_opening_seen')) {
    opening.remove();
    return;
  }

  // 動画終了 → フェードアウト
  function endOpening() {
    sessionStorage.setItem('bm_opening_seen', '1');
    opening.classList.add('fade-out');
    opening.addEventListener('transitionend', function() {
      opening.remove();
    });
    // フォールバック: transitionendが発火しない場合
    setTimeout(function() {
      if (opening.parentNode) opening.remove();
    }, 1200);
  }

  // 動画終了イベント
  video.addEventListener('ended', endOpening);

  // スキップボタン
  if (skipBtn) {
    skipBtn.addEventListener('click', function() {
      video.pause();
      endOpening();
    });
  }

  // 動画再生開始
  video.play().catch(function(err) {
    // 自動再生ブロック時は即スキップ
    console.warn('[BM-Opening] 自動再生できません:', err.message);
    endOpening();
  });

  // スクロール無効化（オープニング中）
  document.body.style.overflow = 'hidden';
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.removedNodes.forEach(function(node) {
        if (node === opening) {
          document.body.style.overflow = '';
          observer.disconnect();
        }
      });
    });
  });
  observer.observe(opening.parentNode, { childList: true });
})();
