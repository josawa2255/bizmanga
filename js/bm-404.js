// 404ページ（404.html）。存在しない /column/{slug} と /works/{slug} を、動的なコラム詳細とビズ書庫へ転送する。
// 本文の描画前に転送を始めるため、head で同期読込する。
(function() {
  var path = location.pathname;
  // /column/{slug} が404の場合、WP APIからIDを探して動的ページにリダイレクト
  var m = path.match(/^\/column\/([a-z0-9-]+)\/?$/);
  if (m) {
    var slug = m[1];
    var api = 'https://cms.contentsx.jp/wp-json/contentsx/v1/columns?site=bizmanga&per_page=100';
    fetch(api)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!Array.isArray(data)) return;
        for (var i = 0; i < data.length; i++) {
          var c = data[i];
          if (c.slug === slug || String(c.id) === slug) {
            location.replace('/column-detail?id=' + c.id);
            return;
          }
        }
      })
      .catch(function() {});
  }
  // /works/{slug} が404の場合、ビズ書庫にリダイレクト
  var w = path.match(/^\/works\/([a-z0-9-]+)\/?$/);
  if (w) {
    location.replace('/biz-library?manga=' + w[1]);
    return;
  }
})();
