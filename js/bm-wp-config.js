/* BizManga WordPress API 設定 */
var BM_WP_CONFIG = {
  apiBase: 'https://cms.contentsx.jp/wp-json/contentsx/v1',
  enabled: true,
  timeout: 3000,
  cacheTTL: 5 * 60 * 1000,

  /* メンテナンス表示スイッチ（手順: SPEC.md「WordPress 一時停止スイッチ」）
     true にすると WordPress API へのアクセスをすべて止め、画面下に中立なお知らせを出す。
     自動ビルド（コラム・作品・LP事例）もこの行を見て止まる。行の書式を変えないこと。 */
  maintenance: false
};

/* メンテナンス中: WordPress API 宛ての fetch をここで一括して失敗させる。
   WP の URL を直書きしている部品もあるため、呼び出し側ではなく fetch 自体で止める。
   失敗扱いになるので、各部品は既存の「読み込めなかったとき」の表示に落ちる。 */
(function () {
  if (!BM_WP_CONFIG.maintenance || typeof window.fetch !== 'function') return;

  var WP_API_PREFIX = 'https://cms.contentsx.jp/wp-json/';
  /* enabled は false にしない（bm-wp-api.js が早期 return して bm-data-ready が出ず、/news が読み込み中のまま止まる） */
  var originalFetch = window.fetch;

  window.fetch = function (input) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    if (url.indexOf(WP_API_PREFIX) === 0) {
      return Promise.reject(new TypeError('maintenance'));
    }
    return originalFetch.apply(this, arguments);
  };

  /* 埋め込みビューアなど iframe の中では出さない（親ページ側で1本だけ出す） */
  if (window.top !== window.self) return;

  var DISMISS_KEY = 'bmMaintenanceNoticeClosed';
  try { if (sessionStorage.getItem(DISMISS_KEY)) return; } catch (e) {}

  function showNotice() {
    if (document.getElementById('bmMaintenanceNotice')) return;

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/bm-maintenance-notice.css';
    document.head.appendChild(link);

    var bar = document.createElement('div');
    bar.id = 'bmMaintenanceNotice';
    bar.className = 'bm-maintenance-notice';
    bar.setAttribute('role', 'status');

    var text = document.createElement('p');
    text.className = 'bm-maintenance-notice__text';
    text.textContent = 'ただいま一部の表示を一時停止しています。しばらくしてから再度ご覧ください。';

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'bm-maintenance-notice__close';
    close.setAttribute('aria-label', 'お知らせを閉じる');
    close.textContent = '×';
    close.addEventListener('click', function () {
      bar.remove();
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    });

    bar.appendChild(text);
    bar.appendChild(close);
    document.body.appendChild(bar);
  }

  if (document.body) showNotice();
  else document.addEventListener('DOMContentLoaded', showNotice);
})();
