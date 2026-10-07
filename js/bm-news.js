// ニュース一覧（news.html）。bm-wp-api.js がデータを読み込んだ後、一覧を表示する。
window.addEventListener('bm-data-ready', function() {
  var loading = document.getElementById('newsPageLoading');
  var list = document.getElementById('bmNewsList');
  if (loading) loading.style.display = 'none';
  if (list) list.style.display = '';
});
