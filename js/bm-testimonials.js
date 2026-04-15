/**
 * BizManga — お客様の声（CMS連携）
 * - WP API からデータ取得 → カードグリッド生成
 * - クリックで詳細モーダル（WPエディタの本文を表示）
 * - フォールバック: API失敗時は静的データで表示
 */
(function () {
  'use strict';

  var grid = document.getElementById('bmTestimonialsGrid');
  if (!grid) return;

  /* ---------- フォールバックデータ ---------- */
  var FALLBACK = [
    {
      id: 0,
      heading: '採用応募数が2倍に増加',
      heading_en: 'Application numbers doubled',
      excerpt: '漫画にしたことで、求職者に仕事の魅力がダイレクトに伝わるようになりました。面接でも「漫画を見て興味を持った」という声が増えています。',
      excerpt_en: 'By converting to manga, the appeal of the job is communicated directly to job seekers.',
      thumbnail: 'https://contentsx.jp/material/manga/bms-unso/01.webp',
      img_position: 'center',
      tag: '営業'
    },
    {
      id: 0,
      heading: '研修の理解度が大幅に向上',
      heading_en: 'Training comprehension significantly improved',
      excerpt: 'テキストだけのマニュアルでは何度説明しても伝わらなかった内容が、漫画にした途端スッと理解してもらえるようになりました。',
      excerpt_en: 'Content that was never understood with text-only manuals is now easily grasped once converted to manga.',
      thumbnail: 'https://contentsx.jp/material/manga/life-school/01.webp',
      img_position: 'center',
      tag: '研修'
    },
    {
      id: 0,
      heading: '商談がスムーズになった',
      heading_en: 'Business negotiations became smoother',
      excerpt: '漫画にしたことで、お客様との商談がスムーズになりました。紙面だけでは伝わらなかった住まいへの想いが伝わるようになったと感じています。',
      excerpt_en: 'By converting to manga, our business negotiations with customers have become smoother.',
      thumbnail: 'https://contentsx.jp/material/manga/ichinohe-home/01.webp',
      img_position: 'center',
      tag: '営業'
    },
    {
      id: 0,
      heading: 'SNSでの反応が3倍に',
      heading_en: '3x increase in social media engagement',
      excerpt: '漫画コンテンツはSNSでの拡散力が段違いでした。広告費を抑えながら認知拡大ができ、費用対効果に大変満足しています。',
      excerpt_en: 'Manga content spreads far more effectively on social media.',
      thumbnail: 'https://contentsx.jp/material/manga/seko/01.webp',
      img_position: 'center',
      tag: 'プロモーション'
    }
  ];

  /* ---------- タグ英訳マップ ---------- */
  var TAG_EN = {
    '営業': 'Sales', '採用': 'Recruitment', '研修': 'Training',
    '集客': 'Marketing', '紹介': 'Introduction', 'ブランド': 'Branding',
    'IP': 'IP', 'プロモーション': 'Promotion', 'その他': 'Other'
  };

  /* ---------- カード生成 ---------- */
  function buildCards(items) {
    grid.innerHTML = '';
    var frag = document.createDocumentFragment();

    items.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'bm-testimonial-card';
      if (item.id) card.id = 'testimonial-' + item.id;

      var tagEn = item.tag_en || TAG_EN[item.tag] || item.tag || '';
      var tagHtml = item.tag
        ? '<span class="bm-testimonial-tag" data-ja="' + item.tag + '" data-en="' + tagEn + '">' + item.tag + '</span>'
        : '';

      card.innerHTML =
        '<div class="bm-testimonial-cover" style="' + (item.img_position ? 'overflow:hidden;' : '') + '">' +
          (item.thumbnail ? '<img src="' + item.thumbnail + '" alt="" loading="lazy" style="object-position:' + (item.img_position || 'center') + ';">' : '') +
        '</div>' +
        tagHtml +
        '<h3 class="bm-testimonial-title" data-ja="' + (item.heading || '') + '" data-en="' + (item.heading_en || '') + '">' + (item.heading || '') + '</h3>' +
        '<p class="bm-testimonial-text" data-ja="' + (item.excerpt || '') + '" data-en="' + (item.excerpt_en || '') + '">' + (item.excerpt || '') + '</p>';

      // クリックで詳細モーダル（API IDがある場合のみ）
      if (item.id > 0) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', function () {
          openDetail(item.id, item);
        });
      }

      frag.appendChild(card);
    });

    grid.appendChild(frag);

    // URLハッシュでお客様の声にスクロール（ディープリンク）
    if (window.location.hash && window.location.hash.startsWith('#testimonial-')) {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target) {
        setTimeout(function() {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.boxShadow = '0 0 0 3px var(--bm-accent)';
          setTimeout(function() { target.style.boxShadow = ''; }, 2000);
        }, 300);
      }
    }

    // 現在の言語が英語なら即座に反映（i18n システムに委譲）
    var lang = document.documentElement.lang || 'ja';
    if (lang === 'en') {
      if (window.i18n && window.i18n.translateAll) {
        window.i18n.translateAll();
      } else if (typeof window.bmSwitchLang === 'function') {
        window.bmSwitchLang('en');
      }
    }
  }

  /* ---------- 詳細モーダル ---------- */
  function openDetail(id, item) {
    // モーダルがすでにあれば再利用
    var modal = document.getElementById('bmTestimonialModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bmTestimonialModal';
      modal.className = 'bm-tm-modal';
      modal.innerHTML =
        '<div class="bm-tm-modal-overlay"></div>' +
        '<div class="bm-tm-modal-content">' +
          '<button class="bm-tm-modal-close">&times;</button>' +
          '<div class="bm-tm-modal-body"></div>' +
        '</div>';
      document.body.appendChild(modal);

      modal.querySelector('.bm-tm-modal-overlay').addEventListener('click', closeDetail);
      modal.querySelector('.bm-tm-modal-close').addEventListener('click', closeDetail);
    }

    var body = modal.querySelector('.bm-tm-modal-body');
    body.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">読み込み中…</p>';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // APIから本文を取得
    var apiBase = window.BM_WP_CONFIG ? window.BM_WP_CONFIG.apiBase : 'https://cms.contentsx.jp/wp-json/contentsx/v1';
    fetch(apiBase + '/testimonials/' + id)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var tagHtml = item.tag ? '<span class="bm-tm-tag">' + item.tag + '</span>' : '';
        body.innerHTML =
          (item.thumbnail ? '<div class="bm-tm-hero"><img src="' + item.thumbnail + '" alt="" style="object-position:' + (item.img_position || 'center') + ';"></div>' : '') +
          '<div class="bm-tm-inner">' +
            tagHtml +
            '<h2 class="bm-tm-heading">' + (data.heading || item.heading) + '</h2>' +
            '<div class="bm-tm-content">' + (data.content || '<p>' + (item.excerpt || '') + '</p>') + '</div>' +
          '</div>';
      })
      .catch(function () {
        body.innerHTML =
          '<div class="bm-tm-inner">' +
            '<h2 class="bm-tm-heading">' + (item.heading || '') + '</h2>' +
            '<p>' + (item.excerpt || '') + '</p>' +
          '</div>';
      });
  }

  function closeDetail() {
    var modal = document.getElementById('bmTestimonialModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ESCキーで閉じる
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeDetail();
    }
  });

  /* ---------- ドラッグスクロール ---------- */
  function enableDragScroll() {
    var wrapper = document.querySelector('.bm-testimonials-scroll');
    if (!wrapper) return;
    var isDragging = false, startX, scrollLeft;

    wrapper.addEventListener('mousedown', function (e) {
      isDragging = true;
      wrapper.style.cursor = 'grabbing';
      startX = e.pageX - wrapper.offsetLeft;
      scrollLeft = wrapper.scrollLeft;
    });
    wrapper.addEventListener('mouseleave', function () {
      isDragging = false;
      wrapper.style.cursor = '';
    });
    wrapper.addEventListener('mouseup', function () {
      isDragging = false;
      wrapper.style.cursor = '';
    });
    wrapper.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      e.preventDefault();
      var x = e.pageX - wrapper.offsetLeft;
      wrapper.scrollLeft = scrollLeft - (x - startX);
    });
  }

  /* ---------- API取得 ---------- */
  function fetchFromAPI() {
    var apiBase = window.BM_WP_CONFIG ? window.BM_WP_CONFIG.apiBase : 'https://cms.contentsx.jp/wp-json/contentsx/v1';
    fetch(apiBase + '/testimonials?site=bizmanga')
      .then(function (r) {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then(function (data) {
        if (data && data.length > 0) {
          currentItems = data;
          buildCards(data);
        }
      })
      .catch(function () {
        // フォールバックのまま
      });
  }

  /* ---------- 初期化 ---------- */
  var currentItems = FALLBACK;
  buildCards(FALLBACK);
  enableDragScroll();
  fetchFromAPI(); // WP /testimonials エンドポイント有効化済み

})();
