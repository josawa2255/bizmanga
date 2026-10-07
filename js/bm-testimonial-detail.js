(async function() {
  const safePos = (s) => /^[a-zA-Z0-9% .-]+$/.test(String(s || 'center')) ? String(s || 'center') : 'center';

  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  const loadingEl = document.getElementById('tmDetailLoading');
  const errorEl = document.getElementById('tmDetailError');
  const articleEl = document.getElementById('tmDetailArticle');

  if (!id) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  const apiBase = (window.BM_WP_CONFIG && window.BM_WP_CONFIG.apiBase)
    ? window.BM_WP_CONFIG.apiBase.replace(/\/+$/, '')
    : 'https://cms.contentsx.jp/wp-json/contentsx/v1';

  try {
    const sanitize = window.bmSanitize;
    if (!sanitize || typeof sanitize.html !== 'function' || typeof sanitize.rich !== 'function') {
      throw new Error('Sanitizer is unavailable');
    }
    /* XSS対策: HTML連結に使う文字列は必ず esc() を通す */
    const esc = sanitize.html;
    const res = await fetch(apiBase + '/testimonials/' + encodeURIComponent(id));
    if (!res.ok) throw new Error('API error');
    const data = await res.json();

    const title = data.heading || 'お客様の声';
    const tag = data.tag || '';
    const thumb = data.thumbnail || '';
    const content = data.content || ('<p>' + (data.excerpt || '') + '</p>');
    const articleUrl = 'https://bizmanga.contentsx.jp/testimonial-detail?id=' + encodeURIComponent(id);

    // Title & meta update
    document.title = title + ' - 導入事例 | BizManga';
    const setMeta = (sel, attr, val) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute(attr, val);
    };
    const plainExcerpt = (data.excerpt || content.replace(/<[^>]+>/g, '').slice(0, 120));
    setMeta('link[rel="canonical"]', 'href', articleUrl);
    setMeta('meta[name="description"]', 'content', plainExcerpt);
    setMeta('meta[property="og:url"]', 'content', articleUrl);
    setMeta('meta[property="og:title"]', 'content', title + ' - 導入事例 | BizManga');
    setMeta('meta[property="og:description"]', 'content', plainExcerpt);
    setMeta('meta[name="twitter:title"]', 'content', title + ' - 導入事例 | BizManga');
    setMeta('meta[name="twitter:description"]', 'content', plainExcerpt);
    if (thumb) {
      setMeta('meta[property="og:image"]', 'content', thumb);
      setMeta('meta[name="twitter:image"]', 'content', thumb);
    }

    // Review JSON-LD 動的更新
    const oldLd = document.getElementById('testimonialReviewSchema');
    if (oldLd) oldLd.remove();
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.id = 'testimonialReviewSchema';
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Review",
      "name": title,
      "description": plainExcerpt,
      "url": articleUrl,
      "image": thumb || undefined,
      "datePublished": new Date().toISOString().slice(0, 10),
      "itemReviewed": {
        "@type": "Service",
        "name": "BizManga ビジネスマンガ制作",
        "provider": {
          "@type": "Organization",
          "name": "Contents X 株式会社",
          "url": "https://contentsx.jp"
        }
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5",
        "worstRating": "1"
      },
      "author": {
        "@type": "Organization",
        "name": tag ? (tag + "業界の導入企業") : "導入企業"
      },
      "reviewBody": plainExcerpt
    });
    document.head.appendChild(ld);

    // Render
    if (thumb) {
      /* esc()/safePos() でサニタイズ済み（XSS対策） */
      document.getElementById('tmDetailHero').innerHTML =
        '<img src="' + esc(thumb) + '" alt="' + esc(title) + '" style="object-position:' + safePos(data.img_position) + ';">';
    }
    if (tag) {
      const tagEl = document.getElementById('tmDetailTag');
      tagEl.textContent = tag;
      tagEl.style.display = '';
    }
    document.getElementById('tmDetailHeading').textContent = title;
    /* XSS対策: 既知のタグのみ許可 */
    const contentEl = document.getElementById('tmDetailContent');
    contentEl.innerHTML = sanitize.rich(content);

    // Share
    const shareText = encodeURIComponent(title + ' - BizManga導入事例');
    const shareUrl = encodeURIComponent(articleUrl);
    document.getElementById('tmDetailShareBtns').innerHTML =
      '<a href="https://twitter.com/intent/tweet?text=' + shareText + '&url=' + shareUrl + '" target="_blank" rel="noopener noreferrer">X</a>' +
      '<a href="https://social-plugins.line.me/lineit/share?url=' + shareUrl + '" target="_blank" rel="noopener noreferrer">LINE</a>' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + shareUrl + '" target="_blank" rel="noopener noreferrer">FB</a>' +
      '<button type="button" id="tmDetailCopy">URLをコピー</button>';
    document.getElementById('tmDetailCopy').addEventListener('click', function() {
      navigator.clipboard && navigator.clipboard.writeText(articleUrl).then(() => {
        this.textContent = 'コピーしました';
        setTimeout(() => { this.textContent = 'URLをコピー'; }, 2000);
      });
    });

    // Related (同タグ)
    try {
      const resAll = await fetch(apiBase + '/testimonials?site=bizmanga');
      const all = await resAll.json();
      const related = all.filter(x => x.id !== parseInt(id, 10) && x.tag === tag).slice(0, 3);
      if (related.length > 0) {
        const grid = document.getElementById('tmDetailRelatedGrid');
        /* 全フィールド esc() 済み（XSS対策） */
        grid.innerHTML = related.map(r =>
          '<a class="tm-detail-related-card" href="testimonial-detail?id=' + encodeURIComponent(r.id) + '">' +
          (r.thumbnail ? '<img src="' + esc(r.thumbnail) + '" alt="" loading="lazy">' : '') +
          (r.tag ? '<span class="tag">' + esc(r.tag) + '</span>' : '') +
          '<span class="t">' + esc(r.heading) + '</span>' +
          '</a>'
        ).join('');
        document.getElementById('tmDetailRelated').style.display = '';
      }
    } catch(e) {}

    loadingEl.style.display = 'none';
    articleEl.style.display = 'block';

  } catch (e) {
    console.warn('testimonial load failed', e);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
})();
