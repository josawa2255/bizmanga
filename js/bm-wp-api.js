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

  /* ── 漫画事例をロード（制作事例ページ用, show_siteでフィルタ済み） ── */
  async function loadWorks() {
    var data = await apiFetch('/works?site=bizmanga');
    if (!data || !Array.isArray(data)) return;
    window.BM_WORKS_DATA = data;
    console.log('[BM-WP-API] 漫画事例(works page): ' + data.length + '件 loaded');
  }

  /* ── Hero用全作品ロード（?site= 無しで全作品取得、Hero側でshow_hero_siteで判定） ── */
  async function loadWorksForHero() {
    var data = await apiFetch('/works');
    if (!data || !Array.isArray(data)) return;
    window.BM_HERO_WORKS_DATA = data;
    console.log('[BM-WP-API] 漫画事例(hero): ' + data.length + '件 loaded');
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

    while (list.firstChild) list.removeChild(list.firstChild);
    var FALLBACK_THUMB = 'https://contentsx.jp/material/images/og/og-index.webp';
    displayData.forEach(function(item) {
      var li = document.createElement('li');
      li.className = 'bm-news-item';

      var hasLink = item.url || (item.has_detail && item.id);
      var rawUrl = hasLink ? (item.url || ('news-detail?id=' + item.id)) : '';
      var safeUrl = hasLink && window.bmSanitize && window.bmSanitize.url ? window.bmSanitize.url(rawUrl) : rawUrl;

      /* サムネイル（左） */
      var thumbWrap;
      if (hasLink) {
        thumbWrap = document.createElement('a');
        thumbWrap.href = safeUrl;
      } else {
        thumbWrap = document.createElement('div');
      }
      thumbWrap.className = 'bm-news-thumb';
      var img = document.createElement('img');
      img.src = item.thumbnail || FALLBACK_THUMB;
      img.alt = item.title_ja || '';
      img.loading = 'lazy';
      img.width = 200; img.height = 120;
      img.onerror = function() { this.src = FALLBACK_THUMB; };
      thumbWrap.appendChild(img);
      li.appendChild(thumbWrap);

      /* 右側: メタ + タイトル */
      var body = document.createElement('div');
      body.className = 'bm-news-body';

      var meta = document.createElement('div');
      meta.className = 'bm-news-meta';
      var tagText = item.tag_ja || '';
      if (tagText) {
        var tag = document.createElement('span');
        tag.className = 'bm-news-tag';
        tag.textContent = tagText;
        meta.appendChild(tag);
      }
      var time = document.createElement('time');
      time.className = 'bm-news-date';
      time.textContent = item.date || '';
      meta.appendChild(time);
      body.appendChild(meta);

      var titleEl;
      if (hasLink) {
        titleEl = document.createElement('a');
        titleEl.className = 'bm-news-link';
        titleEl.href = safeUrl;
      } else {
        titleEl = document.createElement('span');
        titleEl.className = 'bm-news-link bm-news-link--plain';
      }
      titleEl.textContent = item.title_ja || '';
      body.appendChild(titleEl);

      li.appendChild(body);
      list.appendChild(li);
    });

    /* 5件以上ある場合、ホームに「一覧を見る」リンクを表示 */
    if (isHome && data.length > NEWS_HOME_LIMIT) {
      var moreLink = document.getElementById('bmNewsMore');
      if (moreLink) moreLink.style.display = '';
    }

    console.log('[BM-WP-API] ニュース: ' + displayData.length + '/' + data.length + '件 rendered');
  }

  /* ── コラムデータをロード・ホームカード描画 ── */
  var COLUMN_HOME_LIMIT = 4;

  async function loadColumns() {
    var data = await apiFetch('/columns?site=bizmanga&per_page=50');
    if (!data || !Array.isArray(data)) return;
    window.BM_COLUMNS_DATA = data;

    var grid = document.getElementById('bmColumnGrid');
    if (!grid) return;
    var isHome = !document.body.hasAttribute('data-page-column');
    var displayData = isHome ? data.slice(0, COLUMN_HOME_LIMIT) : data;

    grid.innerHTML = '';
    displayData.forEach(function(item) {
      var card = document.createElement('a');
      card.className = 'bm-column-card';
      var slug = item.slug || String(item.id);
      if (!slug.match(/^[a-z0-9-]+$/)) slug = 'column-detail?id=' + item.id;
      else slug = 'column/' + slug;
      card.href = slug;

      var thumb = item.thumbnail || 'https://contentsx.jp/material/images/og/og-index.webp';
      var catHtml = item.category ? '<span class="bm-column-card-cat">' + item.category + '</span>' : '';

      card.innerHTML =
        '<div class="bm-column-card-img"><img src="' + thumb + '" alt="' + (item.title_ja || '') + '" loading="lazy" width="400" height="225"></div>' +
        '<div class="bm-column-card-body">' +
          catHtml +
          '<h3 class="bm-column-card-title" data-ja="' + (item.title_ja || '') + '" data-en="' + (item.title_en || item.title_ja || '') + '">' + (item.title_ja || '') + '</h3>' +
          '<p class="bm-column-card-excerpt" data-ja="' + (item.excerpt_ja || '') + '" data-en="' + (item.excerpt_en || item.excerpt_ja || '') + '">' + (item.excerpt_ja || '') + '</p>' +
          '<time class="bm-column-card-date">' + (item.date || '') + '</time>' +
        '</div>';
      grid.appendChild(card);
    });

    if (isHome && data.length > COLUMN_HOME_LIMIT) {
      var more = document.getElementById('bmColumnMore');
      if (more) more.style.display = '';
    }

    if (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en') {
      window.i18n.translateAll();
    }
    console.log('[BM-WP-API] コラム: ' + displayData.length + '/' + data.length + '件 rendered');
  }

  /* ── 初期化（Hero優先読み込み） ── */
  document.addEventListener('DOMContentLoaded', async function() {
    try {
      // Hero用全作品データと制作事例用フィルタ済みデータを並列取得
      await Promise.all([loadWorksForHero(), loadWorks()]);
      window.dispatchEvent(new CustomEvent('bm-data-ready'));

      // 残りは並列で取得（Heroをブロックしない）
      await Promise.all([
        loadNewWorks(),
        loadNews(),
        loadLibrary(),
        loadColumns()
      ]);
      // 全データ揃った後の再描画
      window.dispatchEvent(new CustomEvent('bm-all-data-ready'));
    } catch(e) {
      console.warn('[BM-WP-API] 初期化エラー:', e);
    }
  });

  // グローバルに公開（他のスクリプトから利用可能）
  window.bmApiFetch = apiFetch;
})();
