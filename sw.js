/**
 * BizManga Service Worker — 表紙画像キャッシュ
 * 戦略: Network First + Cache Fallback（画像）
 * - 初回: ネットワークから取得 → キャッシュに保存
 * - 2回目以降: キャッシュから即座に返し、バックグラウンドで更新
 */
var CACHE_NAME = 'bm-covers-v1';

// キャッシュ対象: manga表紙 + material画像
function shouldCache(url) {
  return url.includes('/material/manga/') ||
         url.includes('/material/images/') ||
         url.includes('/wp-content/uploads/');
}

// Install: 即座にactivate
self.addEventListener('install', function(e) {
  self.skipWaiting();
});

// Activate: 古いキャッシュ削除
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch: Stale-While-Revalidate for images
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (!shouldCache(e.request.url)) return;

  e.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        var fetchPromise = fetch(e.request).then(function(response) {
          if (response && response.ok) {
            cache.put(e.request, response.clone());
          }
          return response;
        }).catch(function() {
          return cached; // オフライン時はキャッシュ
        });
        return cached || fetchPromise;
      });
    })
  );
});
