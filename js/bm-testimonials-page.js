/**
 * BizManga — お客様の声 一覧ページ
 * 4列グリッドで全カードを表示
 * WP API + フォールバック
 */
(function () {
  'use strict';

  var grid = document.getElementById('bmTmListGrid');
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
      thumbnail: 'https://contentsx.jp/material/manga/kyoiku-manual/01.webp',
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
      thumbnail: 'https://contentsx.jp/material/manga/shohin-shokai/01.webp',
      img_position: 'center',
      tag: 'プロモーション'
    }
  ];

  /* ---------- カード生成 ---------- */
  function buildCards(items) {
    grid.innerHTML = '';
    var frag = document.createDocumentFragment();

    items.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'bm-tm-list-card';

      var tagHtml = item.tag
        ? '<span class="bm-tm-list-tag" data-ja="' + item.tag + '">' + item.tag + '</span>'
        : '';

      card.innerHTML =
        '<div class="bm-tm-list-cover">' +
          (item.thumbnail ? '<img src="' + item.thumbnail + '" alt="" loading="lazy" style="object-position:' + (item.img_position || 'center') + ';">' : '') +
        '</div>' +
        '<div class="bm-tm-list-body">' +
          tagHtml +
          '<h3 class="bm-tm-list-title" data-ja="' + (item.heading || '') + '" data-en="' + (item.heading_en || '') + '">' + (item.heading || '') + '</h3>' +
          '<p class="bm-tm-list-text" data-ja="' + (item.excerpt || '') + '" data-en="' + (item.excerpt_en || '') + '">' + (item.excerpt || '') + '</p>' +
        '</div>';

      // クリックで詳細モーダル
      if (item.id > 0) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', function () {
          openDetail(item.id, item);
        });
      }

      frag.appendChild(card);
    });

    grid.appendChild(frag);
  }

  /* ---------- 詳細モーダル ---------- */
  function openDetail(id, item) {
    var modal = document.getElementById('bmTmPageModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bmTmPageModal';
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
    var modal = document.getElementById('bmTmPageModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDetail();
  });

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
          buildCards(data);
        }
      })
      .catch(function () {
        // フォールバックのまま
      });
  }

  /* ---------- 初期化 ---------- */
  buildCards(FALLBACK);
  // fetchFromAPI(); // WPプラグインに /testimonials エンドポイント追加後に有効化

})();
