/**
 * BizManga WordPress API クライアント
 * ContentsX と同じ仕様:
 *   - /works     … 漫画事例（Hero + 制作事例ページ）
 *   - /works-new … 新作漫画（ホーム横スクロールトラック）
 *   - /news      … ニュース（ホームのニュース枠・news.html の一覧）
 *   - /columns   … コラム（ホームのコラム枠。column.html は静的カードが無いときだけ）
 *   取得するのは、そのデータを使う画面要素があるページだけ（下の USED_BY。Issue #85）。
 *
 * イベント（window に dispatch。各1回）:
 *   bm-data-ready     … 漫画事例（/works・/works?site=bizmanga）の取得が終わった。
 *                       漫画事例を使わないページでも出す（取得なしで即時）
 *   bm-news-ready     … ニュースの取得が終わった。detail = { ok: 取得できたか, count: 件数 }
 *                       （news.html はこれを待って「読み込み中」を消す）
 *   bm-all-data-ready … このページで取得したものが全部終わった（失敗したものがあっても出す）
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

  /* XSS対策ヘルパー（bm-sanitize.js 未ロード時も最低限エスケープ） */
  function esc(s) {
    if (window.bmSanitize && window.bmSanitize.html) return window.bmSanitize.html(s);
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeUrl(s) {
    if (window.bmSanitize && window.bmSanitize.url) return window.bmSanitize.url(s);
    return /^javascript:|^data:|^vbscript:/i.test(String(s || '').trim()) ? '' : (s || '');
  }
  /* リンク先（外部サイトも可）: スキームだけを確かめる（http/https/相対。SPEC §16.2）。
     自社ドメインに限る safeUrl とは別。bm-sanitize.js が無いときはリンクにしない */
  function safeLinkUrl(s) {
    if (window.bmSanitize && window.bmSanitize.linkUrl) return window.bmSanitize.linkUrl(s);
    return '';
  }

  /* ── 各データを使う画面要素 ──
     使う側の JS（右のコメント）も、この要素が無いページでは何もしない。
     要素があるページでだけ取得する（Issue #85。以前は全ページで6本取得していた）。
     library は先読みだけ: ビズ書庫（works.js）が同じ /library を取得するので、漫画の一覧から書庫へ進む前に
     ブラウザのキャッシュ（WP の応答は max-age=300）に載せておく。結果は使わず、ほかの描画も待たせない */
  var USED_BY = {
    // BM_HERO_WORKS_DATA: bm-hero.js（Hero マーキー）
    heroWorks: '#bmHeroWorksBg',
    // BM_WORKS_DATA: bm-works-page.js / bm-works.js / bm-work-modal.js、Hero とホームギャラリーの予備
    works: '#bmHeroWorksBg, #bmGalleryGridManga, #bmGalleryGridWebtoon, #bmWorksGrid, .bm-works-card[data-work-id]',
    // BM_NEW_WORKS_DATA: bm-home.js（ホームギャラリー）
    newWorks: '#bmGalleryGridManga, #bmGalleryGridWebtoon',
    // BM_NEWS_DATA: loadNews()（ホームのニュース枠・news.html の一覧）
    news: '#bmNewsList',
    // BM_COLUMNS_DATA: loadColumns()（ホームのコラム枠・column.html の予備）
    columns: '#bmColumnGrid',
    // 先読みのみ（上の説明）: 漫画事例を並べるページ（ホームのギャラリー・制作事例）
    library: '#bmGalleryGridManga, #bmGalleryGridWebtoon, #bmWorksGrid, .bm-works-card[data-work-id]'
  };
  function isUsed(key) {
    return !!document.querySelector(USED_BY[key]);
  }

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

  /* ── ニュースDOM を動的に生成 ── */
  var NEWS_HOME_LIMIT = 5;

  async function loadNews() {
    var data = await apiFetch('/news?site=bizmanga&per_page=50');
    var count = -1; /* -1 = 取得または描画に失敗 */
    try {
      if (data && Array.isArray(data)) {
        renderNews(data);
        count = data.length;
      }
    } finally {
      /* 成功・0件・失敗のどれでも必ず知らせる（news.html が「読み込み中」を消す合図） */
      window.dispatchEvent(new CustomEvent('bm-news-ready', {
        detail: { ok: count >= 0, count: Math.max(count, 0) }
      }));
    }
  }

  function renderNews(data) {
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

      /* リンク先: WP の「リンクURL」（cx_news_url。外部サイト可）→ 本文があれば詳細ページ → どちらも無ければリンクなし。
         リンクURLは自社ドメイン限定の safeUrl に通すと外部URLが href="" になり、
         クリックでページが再読み込みされていた（Issue #85）。詳細ページは / 始まり（BUGS #006） */
      var linkUrl = safeLinkUrl(item.url) ||
        ((item.has_detail && item.id) ? '/news-detail?id=' + encodeURIComponent(item.id) : '');
      var hasLink = !!linkUrl;

      /* サムネイル（左） */
      var thumbWrap;
      if (hasLink) {
        thumbWrap = document.createElement('a');
        thumbWrap.href = linkUrl;
      } else {
        thumbWrap = document.createElement('div');
      }
      thumbWrap.className = 'bm-news-thumb';
      var src = safeUrl(item.thumbnail) || FALLBACK_THUMB;
      var mode = item.image_mode_top || item.image_mode || 'contain';
      if (mode === 'crop' && item.thumbnail) {
        // crop: 親枠 (aspect-ratio:5/3) を cover で埋め、クロップ中心を背景中央に置く
        var w = parseFloat(item.image_crop_w_top || item.image_crop_w) || 100;
        var h = parseFloat(item.image_crop_h_top || item.image_crop_h) || 100;
        var x = parseFloat(item.image_crop_x_top || item.image_crop_x) || 0;
        var y = parseFloat(item.image_crop_y_top || item.image_crop_y) || 0;
        var cropCenterX = Math.max(0, Math.min(100, x + w / 2));
        var cropCenterY = Math.max(0, Math.min(100, y + h / 2));
        var cropEl = document.createElement('div');
        cropEl.className = 'bm-news-thumb-crop';
        cropEl.setAttribute('role', 'img');
        cropEl.setAttribute('aria-label', item.title_ja || '');
        cropEl.style.backgroundImage = 'url("' + src.replace(/["\\)]/g, '') + '")';
        cropEl.style.backgroundPosition = cropCenterX.toFixed(2) + '% ' + cropCenterY.toFixed(2) + '%';
        thumbWrap.appendChild(cropEl);
      } else {
        var img = document.createElement('img');
        img.src = src;
        img.alt = item.title_ja || '';
        img.loading = 'lazy';
        img.width = 200; img.height = 120;
        if (!item.image_mode_top && !item.image_mode && item.image_fit)      img.style.objectFit      = item.image_fit;
        if (!item.image_mode_top && !item.image_mode && item.image_position) img.style.objectPosition = item.image_position;
        img.onerror = function() { this.src = FALLBACK_THUMB; };
        thumbWrap.appendChild(img);
      }
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
        titleEl.href = linkUrl;
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
  var COLUMN_HOME_LIMIT = 8;

  async function loadColumns() {
    /* コラム一覧ページ（column.html）は tools/build-columns.py が書き出す静的カードが正
       （特集記事の除外・data-category・読了時間つき・100件まで）。WP から作り直すと特集記事の重複・
       カテゴリ色と読了時間の消失・51件目以降の欠落・絞り込みの解除が起きるので、静的カードが
       1枚でもあれば取得もしない。静的カードが無いときだけ下で描く（Issue #85 / #74） */
    var pageGrid = document.getElementById('bmColumnGrid');
    if (pageGrid && document.body.hasAttribute('data-page-column') &&
        pageGrid.querySelector('.bm-column-card')) return;

    var data = await apiFetch('/columns?site=bizmanga&per_page=50');
    if (!data || !Array.isArray(data)) return;
    if (window.bmPricing) data = window.bmPricing.post(data);
    window.BM_COLUMNS_DATA = data;

    var grid = document.getElementById('bmColumnGrid');
    if (!grid) return;
    var isHome = !document.body.hasAttribute('data-page-column');
    var displayData = isHome ? data.slice(0, COLUMN_HOME_LIMIT) : data;

    grid.innerHTML = '';
    var colFrag = document.createDocumentFragment();
    displayData.forEach(function(item) {
      var card = document.createElement('a');
      card.className = 'bm-column-card';
      var slug = item.slug || String(item.id);
      if (!slug.match(/^[a-z0-9-]+$/)) slug = 'column-detail?id=' + encodeURIComponent(item.id);
      else slug = 'column/' + slug;
      card.href = slug;

      var thumb = safeUrl(item.thumbnail) || 'https://contentsx.jp/material/images/og/og-index.webp';
      var catHtml = item.category ? '<span class="bm-column-card-cat">' + esc(item.category) + '</span>' : '';

      /* 全フィールド esc() 済み（XSS対策） */
      card.innerHTML =
        '<div class="bm-column-card-img"><img src="' + esc(thumb) + '" alt="' + esc(item.title_ja) + '" loading="lazy" width="400" height="225"></div>' +
        '<div class="bm-column-card-body">' +
          catHtml +
          '<h3 class="bm-column-card-title">' + esc(item.title_ja) + '</h3>' +
          '<p class="bm-column-card-excerpt">' + esc(item.excerpt_ja) + '</p>' +
          '<time class="bm-column-card-date">' + esc(item.date) + '</time>' +
        '</div>';
      colFrag.appendChild(card);
    });
    grid.appendChild(colFrag);

    if (isHome && data.length > COLUMN_HOME_LIMIT) {
      var more = document.getElementById('bmColumnMore');
      if (more) more.style.display = '';
    }
    console.log('[BM-WP-API] コラム: ' + displayData.length + '/' + data.length + '件 rendered');
  }

  /* 1つが例外で止まっても、ほかのデータ・イベントは止めない */
  function settle(promise, label) {
    return promise.catch(function(e) {
      console.warn('[BM-WP-API] ' + label + ' エラー:', e);
    });
  }

  /* ── 初期化 ──
     使うデータだけを同時に取りに行く。ニュース・コラムは漫画事例（Hero）の取得を待たない（Issue #85） */
  document.addEventListener('DOMContentLoaded', function() {
    // Hero用全作品データと制作事例用フィルタ済みデータ → bm-data-ready（使わないページでは即時）
    var worksStage = Promise.all([
      isUsed('heroWorks') ? settle(loadWorksForHero(), 'hero works') : null,
      isUsed('works') ? settle(loadWorks(), 'works') : null
    ]).then(function() {
      window.dispatchEvent(new CustomEvent('bm-data-ready'));
    });

    var all = [worksStage];
    if (isUsed('newWorks')) all.push(settle(loadNewWorks(), 'new works'));
    if (isUsed('news')) all.push(settle(loadNews(), 'news'));
    if (isUsed('columns')) all.push(settle(loadColumns(), 'columns'));
    // ビズ書庫の先読み（bm-all-data-ready は待たせない）
    if (isUsed('library')) settle(apiFetch('/library'), 'library prefetch');

    // 全データ揃った後の再描画（ホームギャラリーはここで描く）
    Promise.all(all).then(function() {
      window.dispatchEvent(new CustomEvent('bm-all-data-ready'));
    });
  });

  // グローバルに公開（他のスクリプトから利用可能）
  window.bmApiFetch = apiFetch;
})();
