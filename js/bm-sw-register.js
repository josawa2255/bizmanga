// Service Worker 登録（index.html / biz-library.html）。sw.js は表紙画像をキャッシュする。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  });
}
