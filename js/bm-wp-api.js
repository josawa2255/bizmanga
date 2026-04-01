/**
 * BizManga WordPress API クライアント
 * ContentsX と同じ仕様:
 *   - /works     … 漫画事例（Hero + 制作事例ページ）
 *   - /works-new … 新作漫画（ホーム横スクロールトラック）
 *   - /news      … ニュース（ホームニュースセクション）
 *
 * WP投稿側で publish_to フィールドを想定:
 *   "news"      → ニュースのみ
 *   "new_works" → 新作漫画のみ
 *   "both"      → 両方に公開
 *   （API側で振り分け済みの前提。クライアントは各エンドポイントを叩くだけ）
 */
(function() {
  'use strict';

  if (typeof BM_WP_CONFIG === 'undefined' || !BM_WP_CONFIG.enabled) return;

  var API = BM_WP_CONFIG.apiBase.replace(/\/+$/, '');
  var TIMEOUT = BM_WP_CONFIG.timeout || 5000;
  var CACHE_TTL = BM_WP_CONFIG.cacheTTL || 300000;
  var cache = {};

  async function apiFetch(endpoint) {
    var url = API + endpoint;
    var now = Date.now();
    if (cache[url] && (now - cache[url].ts) < CACHE_TTL) {
      return cache[url].data;
    }
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, TIMEOUT);
    try {
      var res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      cache[url] = { data: data, ts: now };
      return data;
    } catch(e) {
      clearTimeout(timer);
      console.warn('[BM-WP-API] ' + url + ' failed:', e.message);
      return null;
    }
  }

  /* ── 漫画事例をロード（Hero + 制作事例ページ） ── */
  async function loadWorks() {
    var data = await apiFetch('/works?site=bizmanga');
    if (!data || !Array.isArray(data)) return;
    window.BM_WORKS_DATA = data;
    console.log('[BM-WP-API] 漫画事例: ' + data.length + '件 loaded');
  }

  /* ── 新作漫画をロード ── */
  async function loadNewWorks() {
    var data = await apiFetch('/works-new?site=bizmanga');
    if (!data || !Array.isArray(data)) return;
    window.BM_NEW_WORKS_DATA = data;
    console.log('[BM-WP-API] 新作漫画: ' + data.length + '件 loaded');
  }

  /* ── ビズ書庫データをロード ── */
  async function loadLibrary() {
    var data = await apiFetch('/library');
    if (!data || !Array.isArray(data)) return;
    window.BM_LIBRARY_DATA = data;
    console.log('[BM-WP-API] ビズ書庫: ' + data.length + '件 loaded');
  }

  /* ── ニュースDOM を動的に生成 ── */
  var NEWS_HOME_LIMIT = 5;

  async function loadNews() {
    var data = await apiFetch('/news?site=bizmanga&per_page=50');
    if (!data || !Array.isArray(data)) return;

    /* 全データをグローバルに保存（一覧ページ用） */
    window.BM_NEWS_DATA = data;

    var list = document.getElementById('bmNewsList');
    if (!list) return;

    /* ホームでは最大5件表示 */
    var isHome = !document.body.hasAttribute('data-page-news');
    var displayData = isHome ? data.slice(0, NEWS_HOME_LIMIT) : data;

    list.innerHTML = '';
    displayData.forEach(function(item) {
      var li = document.createElement('li');
      li.className = 'bm-news-item';

      var time = document.createElement('time');
      time.className = 'bm-news-date';
      time.textContent = item.date || '';

      /* タグが空の場合はタグ要素を生成しない */
      var tagText = item.tag_ja || '';
      if (tagText) {
        var tag = document.createElement('span');
        tag.className = 'bm-news-tag';
        tag.textContent = tagText;
        li.appendChild(time);
        li.appendChild(tag);
      } else {
        li.appendChild(time);
      }

      var hasLink = item.url || (item.has_detail && item.id);
      var titleEl;
      if (hasLink) {
        titleEl = document.createElement('a');
        titleEl.className = 'bm-news-link';
        titleEl.href = item.url || ('news-detail?id=' + item.id);
      } else {
        titleEl = document.createElement('span');
        titleEl.className = 'bm-news-link bm-news-link--plain';
      }
      titleEl.textContent = item.title_ja || '';

      li.appendChild(titleEl);
      list.appendChild(li);
    });

    /* 5件以上ある場合、ホームに「一覧を見る」リンクを表示 */
    if (isHome && data.length > NEWS_HOME_LIMIT) {
      var moreLink = document.getElementById('bmNewsMore');
      if (moreLink) moreLink.style.display = '';
    }

    console.log('[BM-WP-API] ニュース: ' + displayData.length + '/' + data.length + '件 rendered');
  }

  /* ── 初期化 ── */
  document.addEventListener('DOMContentLoaded', async function() {
    try {
      await Promise.all([
        loadWorks(),
        loadNewWorks(),
        loadNews(),
        loadLibrary()
      ]);

      /* Hero・新作漫画トラックの再描画イベント発火 */
      window.dispatchEvent(new CustomEvent('bm-data-ready'));
    } catch(e) {
      console.warn('[BM-WP-API] 初期化エラー:', e);
    }
  });

  // グローバルに公開（他のスクリプトから利用可能）
  window.bmApiFetch = apiFetch;
})();
