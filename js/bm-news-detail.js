// ニュース詳細（news-detail.html）。関数をページのグローバルに出さないよう即時関数で包む。
(function () {
  document.addEventListener('DOMContentLoaded', async function() {
    var params = new URLSearchParams(window.location.search);
    var newsId = params.get('id');

    var loadingEl = document.getElementById('newsDetailLoading');
    var errorEl   = document.getElementById('newsDetailError');
    var articleEl = document.getElementById('newsDetailArticle');

    if (!newsId) {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      return;
    }

    try {
      var apiBase = (typeof BM_WP_CONFIG !== 'undefined' && BM_WP_CONFIG.enabled && BM_WP_CONFIG.apiBase)
        ? BM_WP_CONFIG.apiBase.replace(/\/+$/, '')
        : 'https://cms.contentsx.jp/wp-json/contentsx/v1';

      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 8000);

      var res = await fetch(apiBase + '/news/' + encodeURIComponent(newsId), { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();

      var title = data.title_ja || '';
      document.title = (title || 'ニュース') + ' | ビズマンガ';

      document.getElementById('newsDate').textContent = data.date || '';

      var tagEl = document.getElementById('newsTag');
      tagEl.textContent = data.tag_ja || '';

      var titleEl = document.getElementById('newsTitle');
      titleEl.textContent = title || '';

      if (data.thumbnail) {
        var heroEl = document.getElementById('newsHero');
        var heroImg = document.getElementById('newsHeroImg');
        // 詳細ページ用: image_mode_detail を優先
        var mode = data.image_mode_detail || data.image_mode || 'contain';
        if (mode === 'crop') {
          var w = parseFloat(data.image_crop_w_detail || data.image_crop_w) || 100;
          var h = parseFloat(data.image_crop_h_detail || data.image_crop_h) || 100;
          var x = parseFloat(data.image_crop_x_detail || data.image_crop_x) || 0;
          var y = parseFloat(data.image_crop_y_detail || data.image_crop_y) || 0;
          heroImg.removeAttribute('src');
          heroImg.style.display = 'none';
          var cropEl = document.createElement('div');
          cropEl.setAttribute('role', 'img');
          cropEl.setAttribute('aria-label', title || '');
          cropEl.style.cssText =
            'width:100%;max-width:720px;' +
            'aspect-ratio:' + (w / h).toFixed(4) + ';' +
            'background-image:url(' + data.thumbnail + ');' +
            'background-size:' + (10000 / w).toFixed(2) + '% auto;' +
            'background-position:' +
              ((100 - w > 0) ? (x / (100 - w) * 100).toFixed(2) + '%' : '50%') + ' ' +
              ((100 - h > 0) ? (y / (100 - h) * 100).toFixed(2) + '%' : '50%') + ';' +
            'background-repeat:no-repeat;border-radius:8px;';
          heroEl.appendChild(cropEl);
        } else {
          heroImg.src = data.thumbnail;
          heroImg.alt = title || '';
          if (!data.image_mode_detail && !data.image_mode && data.image_fit)      heroImg.style.objectFit      = data.image_fit;
          if (!data.image_mode_detail && !data.image_mode && data.image_position) heroImg.style.objectPosition = data.image_position;
        }
        heroEl.style.display = 'block';
      }

      var contentEl = document.getElementById('newsContent');
      var content = data.content || '<p>詳細情報はありません。</p>';
      if (window.bmSanitize && window.bmSanitize.rich) {
        contentEl.innerHTML = window.bmSanitize.rich(content);
      } else {
        contentEl.textContent = content;
      }

      loadingEl.style.display = 'none';
      articleEl.style.display = 'block';

    } catch(e) {
      console.warn('[BM News Detail] Failed:', e.message);
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
    }
  });
})();
