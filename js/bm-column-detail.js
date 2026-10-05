document.addEventListener('DOMContentLoaded', async function() {
      var params = new URLSearchParams(window.location.search);
      var colId = params.get('id');
      var isPreview = params.get('preview') === '1';
      var previewNonce = params.get('_wpnonce') || '';
      var loadingEl = document.getElementById('colDetailLoading');
      var errorEl = document.getElementById('colDetailError');
      var articleEl = document.getElementById('colDetailArticle');

      if (!colId) {
        loadingEl.style.display = 'none';
        errorEl.style.display = '';
        return;
      }

      var apiBase = (window.BM_WP_CONFIG && window.BM_WP_CONFIG.apiBase) || 'https://cms.contentsx.jp/wp-json/contentsx/v1';
      /* プレビュー時は /preview エンドポイント + nonce + 認証Cookie を付与 */
      var endpoint = isPreview
        ? apiBase + '/columns/' + encodeURIComponent(colId) + '/preview?_wpnonce=' + encodeURIComponent(previewNonce)
        : apiBase + '/columns/' + encodeURIComponent(colId);
      var fetchOpts = isPreview ? { credentials: 'include' } : {};
      try {
        var res = await fetch(endpoint, fetchOpts);
        if (!res.ok) {
          if (isPreview && (res.status === 401 || res.status === 403)) {
            throw new Error('プレビューには cms.contentsx.jp 管理画面ログインが必要です');
          }
          throw new Error('HTTP ' + res.status);
        }
        var data = window.bmPricing.post(await res.json());

        /* プレビュー表示バナー（画面上部・閉じれない） */
        if (isPreview) {
          var banner = document.createElement('div');
          banner.setAttribute('role', 'status');
          banner.className = 'bm-col-preview-banner';
          banner.textContent = 'プレビュー中（status: ' + (data.post_status || 'unknown') + '）— 公開中のページには反映されていません';
          document.body.insertBefore(banner, document.body.firstChild);
        }

        var titleText = data.title_ja || '';
        var contentHtml = data.content || '';
        /* 注意: エクスポート名は rich（richHTMLはエイリアス）。
           以前 richHTML 参照で undefined になりサニタイズが素通りしていた */
        var sanitize = window.bmSanitize && window.bmSanitize.rich;

        document.getElementById('colDate').textContent = data.date || '';
        var catEl = document.getElementById('colCat');
        if (data.category) { catEl.textContent = data.category; } else { catEl.style.display = 'none'; }
        document.getElementById('colTitle').textContent = titleText;

        if (data.thumbnail) {
          var heroEl = document.getElementById('colHero');
          document.getElementById('colHeroImg').src = data.thumbnail;
          document.getElementById('colHeroImg').alt = titleText;
          heroEl.style.display = '';
        }

        var contentEl = document.getElementById('colContent');
        if (sanitize) contentEl.innerHTML = sanitize(contentHtml);
        else contentEl.textContent = contentHtml;

        document.title = titleText + ' | コラム | ビズマンガ';
        var ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', titleText + ' | ビズマンガ');
        var desc = data.excerpt_ja || '';
        var ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc && desc) ogDesc.setAttribute('content', desc);
        if (data.thumbnail) {
          var ogImg = document.querySelector('meta[property="og:image"]');
          if (ogImg) ogImg.setAttribute('content', data.thumbnail);
        }

        loadingEl.style.display = 'none';
        articleEl.style.display = '';

        buildToc();
        loadRelated(apiBase, colId, data.category);
        injectArticleSchema(data);

      } catch (e) {
        console.warn('[column-detail] fetch failed:', e.message);
        loadingEl.style.display = 'none';
        errorEl.style.display = '';
      }
    });

    function buildToc() {
      var content = document.getElementById('colContent');
      var tocNav = document.getElementById('colToc');
      var tocList = document.getElementById('colTocList');
      if (!content || !tocNav || !tocList) return;
      var headings = content.querySelectorAll('h2');
      if (headings.length < 2) { tocNav.style.display = 'none'; return; }
      tocList.innerHTML = '';
      headings.forEach(function(h, i) {
        var id = 'sec-' + (i + 1);
        h.id = id;
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + id;
        a.textContent = h.textContent;
        li.appendChild(a);
        tocList.appendChild(li);
      });
      tocNav.style.display = '';
    }

    function injectArticleSchema(data) {
      var existing = document.getElementById('article-ld');
      if (existing) existing.remove();
      var slug = data.slug || data.id;
      var schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": data.title_ja || "",
        "description": data.excerpt_ja || "",
        "url": "https://bizmanga.contentsx.jp/column/" + slug,
        "datePublished": data.date_ymd || "",
        "dateModified": data.modified_ymd || data.date_ymd || "",
        "image": data.thumbnail || "https://contentsx.jp/material/images/logo/bizmanga-logo.webp",
        "author": {"@type": "Organization", "name": "ビズマンガ編集部", "url": "https://bizmanga.contentsx.jp/", "logo": {"@type": "ImageObject", "url": "https://contentsx.jp/material/images/logo/bizmanga-logo.webp"}},
        "publisher": {"@type": "Organization", "name": "ビズマンガ", "url": "https://bizmanga.contentsx.jp/", "logo": {"@type": "ImageObject", "url": "https://contentsx.jp/material/images/logo/bizmanga-logo.webp"}},
        "inLanguage": "ja",
        "mainEntityOfPage": {"@type": "WebPage", "@id": "https://bizmanga.contentsx.jp/column/" + slug}
      };
      if (data.category) schema.articleSection = data.category;
      var script = document.createElement('script');
      script.id = 'article-ld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    async function loadRelated(apiBase, currentId, category) {
      try {
        var res = await fetch(apiBase + '/columns?site=bizmanga&per_page=50');
        if (!res.ok) return;
        var all = window.bmPricing.post(await res.json());
        var sameCat = all.filter(function(c) { return c.id !== parseInt(currentId) && c.category === category; });
        var others = all.filter(function(c) { return c.id !== parseInt(currentId) && c.category !== category; });
        var related = sameCat.concat(others).slice(0, 3);
        if (related.length === 0) return;
        var grid = document.getElementById('colRelatedGrid');
        var section = document.getElementById('colRelated');
        if (!grid || !section) return;
        grid.innerHTML = '';
        var esc = (window.bmSanitize && window.bmSanitize.html) || function(s) {
          return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        };
        related.forEach(function(item) {
          var card = document.createElement('a');
          card.className = 'bm-column-card';
          card.href = 'column-detail?id=' + encodeURIComponent(item.id);
          var thumb = item.thumbnail || 'https://contentsx.jp/material/images/og/og-index.webp';
          var catHtml = item.category ? '<span class="bm-column-card-cat">' + esc(item.category) + '</span>' : '';
          /* 全フィールドを esc() でエスケープしてから挿入（XSS対策） */
          card.innerHTML =
            '<div class="bm-column-card-img"><img src="' + esc(thumb) + '" alt="' + esc(item.title_ja) + '" loading="lazy" width="400" height="225"></div>' +
            '<div class="bm-column-card-body">' + catHtml +
            '<h3 class="bm-column-card-title">' + esc(item.title_ja) + '</h3>' +
            '<p class="bm-column-card-excerpt">' + esc(item.excerpt_ja) + '</p>' +
            '<time class="bm-column-card-date">' + esc(item.date) + '</time></div>';
          grid.appendChild(card);
        });
        section.style.display = '';
      } catch(e) { /* 関連記事は失敗しても無視 */ }
    }
