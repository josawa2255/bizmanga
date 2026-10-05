/**
 * BizManga Service Worker — 表紙画像キャッシュ
 * 戦略: Stale-While-Revalidate（画像）
 * - 初回: ネットワークから取得 → キャッシュに保存
 * - 2回目以降: キャッシュから即座に返し、バックグラウンドで更新
 */
var CACHE_PREFIX = 'bm-covers-';
var CACHE_NAME = CACHE_PREFIX + 'v1';

// キャッシュ対象: manga表紙 + material画像
function shouldCache(url) {
  return url.includes('/material/manga/') ||
         url.includes('/material/images/') ||
         url.includes('/wp-content/uploads/');
}

// Install: 即座にactivate
self.addEventListener('install', function(e) {
  e.waitUntil(self.skipWaiting());
});

// Activate: 古いキャッシュ削除
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch: Stale-While-Revalidate for images
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (!shouldCache(e.request.url)) return;

  var lookup = caches.open(CACHE_NAME).then(function(cache) {
    return cache.match(e.request).then(function(cached) {
      return { cache: cache, cached: cached };
    });
  });
  var refresh = lookup.then(function() {
    return fetch(e.request);
  });
  var cacheWrite = Promise.all([lookup, refresh]).then(function(results) {
    var entry = results[0], response = results[1];
    if (response && response.ok) {
      return entry.cache.put(e.request, response.clone());
    }
  });
  // Keep writes alive without delaying the network response on a cache miss.
  e.waitUntil(cacheWrite.catch(function() {}));
  e.respondWith(lookup.then(function(entry) { return entry.cached || refresh; }));
});
