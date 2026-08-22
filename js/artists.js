/**
 * 漫画家・作品紹介（/artists）
 *
 * このページは「誰が描くか」ではなく「どんな画風があるか」を探すページ。
 * カードは漫画家個人ではなく画風カテゴリ単位で、漫画家名は出さない。
 *
 * ── データの差し替えについて ────────────────────────────────
 * 画風データは下の STYLE_DATA 配列だけに閉じている。ここを差し替えれば
 * HTML/CSS を触らずに追加・削除・並べ替えができる。
 * 将来 WP/CRM 連携する場合も、同じ形の配列を window.bmArtists.setData() に
 * 渡すだけでよい（ファイル末尾）。
 *
 * 各項目のスキーマ:
 *   id            … 一意キー（DOM の data-style-id に入る）
 *   slug          … 将来の個別URL用。現状は未使用だが CMS 移行時のキーになる
 *   title/titleEn … 画風名
 *   thumbnail     … カード用サムネ（実作品の1ページ目）
 *   summary       … 一言説明
 *   styleTags     … 画風・テイスト
 *   genreTags     … 得意ジャンル（「画風から探す」タブの絞り込み軸）
 *   audienceTags  … 読者層
 *   mediaTags     … 向いている媒体
 *   usecaseTags   … 向いている用途（「用途から探す」タブの絞り込み軸）
 *   gallery       … 詳細モーダルの追加サンプル [{src, alt}]
 *   detail        … この画風の特徴（詳細本文）
 *
 * ⚠️ DOM は createElement + textContent で組む（innerHTML を使わない）。
 *    CMS/CRM 由来の文字列が入っても XSS にならないようにするため。
 * ⚠️ 画像は ContentX 側 (contentsx.jp) を絶対URLで参照している。
 *    移動・削除時は両サイト grep が必要（BUGS #020）。
 */
(function() {
  'use strict';

  var MANGA_BASE = 'https://contentsx.jp/material/manga/';

  /* ===== 画風データ（差し替えポイント） ===== */
  var STYLE_DATA = [
    {
      id: 'business-drama',
      slug: 'business-drama',
      title: 'ビジネス人物描写',
      titleEn: 'Business Drama',
      thumbnail: MANGA_BASE + 'seko/01.webp',
      summary: '実在の人物や現場を等身大で描く、信頼感のあるタッチ。経営者の想いや創業の物語を伝えるのに向いています。',
      summaryEn: 'A grounded, trustworthy touch for real people and workplaces.',
      styleTags: ['リアル寄り', '落ち着き', '信頼感'],
      genreTags: ['ドラマ', '実録'],
      audienceTags: ['経営層', '取引先', '求職者'],
      mediaTags: ['会社案内', 'Web', 'パンフレット'],
      usecaseTags: ['会社紹介', '採用', 'IR・周年史'],
      gallery: [
        { src: MANGA_BASE + 'seko/02.webp', alt: 'ビジネス人物描写の作例2' },
        { src: MANGA_BASE + 'seko/03.webp', alt: 'ビジネス人物描写の作例3' },
        { src: MANGA_BASE + 'hamada-masatada/01.webp', alt: 'ビジネス人物描写の作例4' }
      ],
      detail: '人物の表情と間の取り方で「その人らしさ」を立ち上げる画風です。誇張を抑えた作画のため、経営者インタビューや創業ストーリーなど事実にもとづく内容と相性がよく、読後に信頼が残ります。'
    },
    {
      id: 'corporate-real',
      slug: 'corporate-real',
      title: '実録・企業漫画',
      titleEn: 'Corporate Documentary',
      thumbnail: MANGA_BASE + 'ichinohe-home/02.webp',
      summary: '実際の商談や業務の流れを、順を追って分かりやすく再現。営業資料や研修で「自分ごと」にさせたい時に。',
      summaryEn: 'Reconstructs real deals and workflows step by step.',
      styleTags: ['すっきり', '説明的', 'ビジネス'],
      genreTags: ['実録', 'ハウツー'],
      audienceTags: ['法人担当者', '新入社員'],
      mediaTags: ['営業資料', 'Web', '研修教材'],
      usecaseTags: ['営業資料', '研修', '商品紹介'],
      gallery: [
        { src: MANGA_BASE + 'ichinohe-home/04.webp', alt: '実録・企業漫画の作例2' },
        { src: MANGA_BASE + 'ichinohe-home/03.webp', alt: '実録・企業漫画の作例3' },
        { src: MANGA_BASE + 'ichinohe-home/05.webp', alt: '実録・企業漫画の作例4' }
      ],
      detail: '「何が起きて、どう解決したか」を時系列で追う構成に強い画風です。図解や吹き出しでの補足を入れやすく、複雑な商材やオペレーションの説明でも読者が迷いません。'
    },
    {
      id: 'deformed-gag',
      slug: 'deformed-gag',
      title: 'デフォルメ・4コマ',
      titleEn: 'Deformed & 4-Koma',
      thumbnail: MANGA_BASE + 'omatome-ninja/02.webp',
      summary: '親しみやすいキャラクターとテンポのよい展開。短い尺で覚えてもらいたい告知やSNSに最適です。',
      summaryEn: 'Friendly chibi characters with quick comedic timing.',
      styleTags: ['ポップ', '親しみやすい', 'コミカル'],
      genreTags: ['ギャグ', '4コマ', 'キャラもの'],
      audienceTags: ['一般消費者', '若年層'],
      mediaTags: ['SNS', 'LP', 'チラシ'],
      usecaseTags: ['商品紹介', '集客・広告', 'SNS'],
      gallery: [
        { src: MANGA_BASE + 'omatome-ninja/03.webp', alt: 'デフォルメ・4コマの作例2' },
        { src: MANGA_BASE + 'omatome-ninja-2/01.webp', alt: 'デフォルメ・4コマの作例3' },
        { src: MANGA_BASE + 'omatome-ninja-rohto/01.webp', alt: 'デフォルメ・4コマの作例4' }
      ],
      detail: '1コマあたりの情報量を絞り、テンポで読ませる画風です。キャラクターを固定してシリーズ展開しやすく、SNSや店頭POPなど「短く何度も接触する」媒体で効果を発揮します。'
    },
    {
      id: 'monochrome-business',
      slug: 'monochrome-business',
      title: 'モノクロ・ビジネス実務',
      titleEn: 'Monochrome Business',
      thumbnail: MANGA_BASE + 'torutoru-kun/06.webp',
      summary: '白黒の落ち着いた作画で、担当者の業務と課題を淡々と描く画風。サービス紹介や社内向け資料に。',
      summaryEn: 'Calm monochrome art for everyday business situations.',
      styleTags: ['モノクロ', '実務的', '落ち着き'],
      genreTags: ['実録', 'ハウツー'],
      audienceTags: ['法人担当者', '一般消費者'],
      mediaTags: ['Web', '営業資料', 'SNS'],
      usecaseTags: ['商品紹介', '会社紹介', '営業資料'],
      gallery: [
        { src: MANGA_BASE + 'torutoru-kun/03.webp', alt: 'モノクロ・ビジネス実務の作例2' },
        { src: MANGA_BASE + 'torutoru-kun/08.webp', alt: 'モノクロ・ビジネス実務の作例3' },
        { src: MANGA_BASE + 'torutoru-kun/05.webp', alt: 'モノクロ・ビジネス実務の作例4' }
      ],
      detail: '装飾を抑えた白黒作画で、担当者が抱える課題とサービス導入の流れを順に見せる画風です。印刷しても潰れにくく、営業資料や社内配布物にそのまま使えます。'
    },
    {
      id: 'shonen-school',
      slug: 'shonen-school',
      title: '少年漫画・学園',
      titleEn: 'Shonen & School',
      thumbnail: MANGA_BASE + 'life-school/03.webp',
      summary: '熱量のある表情と動きで、読者を引き込む王道タッチ。挑戦や成長を描く採用マンガと好相性です。',
      summaryEn: 'Classic energetic style driven by emotion and motion.',
      styleTags: ['王道', '熱量', '躍動感'],
      genreTags: ['青春', 'ドラマ'],
      audienceTags: ['学生', '若手社会人'],
      mediaTags: ['採用サイト', 'Web', 'パンフレット'],
      usecaseTags: ['採用', '研修', '集客・広告'],
      gallery: [
        { src: MANGA_BASE + 'life-school/02.webp', alt: '少年漫画・学園の作例2' },
        { src: MANGA_BASE + 'life-school/04.webp', alt: '少年漫画・学園の作例3' },
        { src: MANGA_BASE + 'life-school/05.webp', alt: '少年漫画・学園の作例4' }
      ],
      detail: '主人公の感情の起伏を大きく描き、読者を物語に巻き込む画風です。「入社してからの成長」「仕事のやりがい」といった、共感で動かしたいテーマに向いています。'
    },
    {
      id: 'shojo-romance',
      slug: 'shojo-romance',
      title: '少女・恋愛',
      titleEn: 'Shojo & Romance',
      /* 縦読み作品は1枚が非常に縦長で、上端を切り出すと余白しか映らない。
         そのため作画部分だけを切り出したサムネを別途用意している */
      thumbnail: '/material/images/artists/thumb-shojo.webp',
      summary: '繊細な線と柔らかい表情で、心の機微を丁寧に描く画風。共感を軸にした訴求に向いています。',
      summaryEn: 'Delicate lines that capture subtle emotion.',
      styleTags: ['繊細', '柔らかい', '共感'],
      genreTags: ['恋愛', 'ドラマ'],
      audienceTags: ['20〜40代', '生活者'],
      mediaTags: ['Web', 'SNS', 'LP'],
      usecaseTags: ['商品紹介', '集客・広告', 'SNS'],
      gallery: [
        { src: '/material/images/artists/gallery-shojo-1.webp', alt: '少女・恋愛の作例2' },
        { src: '/material/images/artists/gallery-shojo-2.webp', alt: '少女・恋愛の作例3' },
        { src: '/material/images/artists/gallery-shojo-3.webp', alt: '少女・恋愛の作例4' }
      ],
      detail: '言葉にしづらい感情を、表情と背景のトーンで見せる画風です。悩みへの共感から入って解決策を示す構成と相性がよく、美容・健康・ライフスタイル系の商材でよく選ばれます。'
    },
    {
      id: 'gekiga-serious',
      slug: 'gekiga-serious',
      title: '劇画・重厚タッチ',
      titleEn: 'Gekiga & Serious',
      /* 縦読み作品のため、作画部分を切り出した専用サムネを使う（少女・恋愛と同じ理由） */
      thumbnail: '/material/images/artists/thumb-gekiga.webp',
      summary: '陰影を強く効かせた重厚な作画。専門性や緊張感のあるテーマを、真剣に伝えたい時に選ばれます。',
      summaryEn: 'Heavy shading for weighty, serious subject matter.',
      styleTags: ['重厚', 'シリアス', '硬派'],
      genreTags: ['社会派', 'ドラマ'],
      audienceTags: ['経営層', '専門職'],
      mediaTags: ['パンフレット', 'Web', '書籍'],
      usecaseTags: ['会社紹介', '研修', 'IR・周年史'],
      gallery: [
        { src: '/material/images/artists/gallery-gekiga-1.webp', alt: '劇画・重厚タッチの作例2' },
        { src: '/material/images/artists/gallery-gekiga-2.webp', alt: '劇画・重厚タッチの作例3' },
        { src: '/material/images/artists/gallery-gekiga-3.webp', alt: '劇画・重厚タッチの作例4' }
      ],
      detail: 'コントラストの強い作画で、緊張感と説得力を出す画風です。法務・金融・医療など、扱う内容の重さをそのまま伝えたい領域で選ばれます。軽く見られたくない訴求に向いています。'
    },
    {
      id: 'global-multilingual',
      slug: 'global-multilingual',
      title: 'グローバル・多言語',
      titleEn: 'Global & Multilingual',
      thumbnail: MANGA_BASE + 'tagengo/03.webp',
      summary: '文化圏を選ばない記号設計で、翻訳しても崩れない画面づくり。インバウンドや海外拠点向けに。',
      summaryEn: 'Culture-neutral visuals that survive translation.',
      styleTags: ['ニュートラル', '見やすい', '記号的'],
      genreTags: ['ハウツー', '実録'],
      audienceTags: ['訪日外国人', '海外拠点'],
      mediaTags: ['Web', '掲示物', '営業資料'],
      usecaseTags: ['インバウンド', '研修', '商品紹介'],
      gallery: [
        { src: MANGA_BASE + 'tagengo/05.webp', alt: 'グローバル・多言語の作例2' },
        { src: MANGA_BASE + 'tagengo/04.webp', alt: 'グローバル・多言語の作例3' },
        { src: MANGA_BASE + 'tagengo/06.webp', alt: 'グローバル・多言語の作例4' }
      ],
      detail: '吹き出しの文字量が言語によって変わることを前提に、余白と絵の情報量を設計する画風です。翻訳版を並行して作る前提の案件で、作り直しのコストを抑えられます。'
    }
  ];

  /* ===== フィルタ定義 ===== */
  var FILTER_MODES = {
    style:   { key: 'genreTags',   chips: ['ドラマ', '実録', 'ギャグ', '4コマ', 'キャラもの', '青春', '恋愛', '社会派', 'ハウツー'] },
    usecase: { key: 'usecaseTags', chips: ['採用', '会社紹介', '商品紹介', '営業資料', '研修', '集客・広告', 'SNS', 'インバウンド', 'IR・周年史'] }
  };

  /* 動的生成テキストの英語。data-ja/data-en は i18n が拾うが、
     初期表示のテキストノードはこちらで決める */
  var EN = {
    'すべて': 'All',
    'ドラマ': 'Drama', '実録': 'Documentary', 'ギャグ': 'Comedy', '4コマ': '4-Koma',
    'キャラもの': 'Character', '青春': 'Youth', '恋愛': 'Romance', '社会派': 'Social', 'ハウツー': 'How-to',
    '採用': 'Recruitment', '会社紹介': 'Company', '商品紹介': 'Product', '営業資料': 'Sales',
    '研修': 'Training', '集客・広告': 'Advertising', 'SNS': 'SNS', 'インバウンド': 'Inbound', 'IR・周年史': 'IR',
    'リアル寄り': 'Realistic', '落ち着き': 'Calm', '信頼感': 'Trustworthy',
    'すっきり': 'Clean', '説明的': 'Explanatory', 'ビジネス': 'Business',
    'ポップ': 'Pop', '親しみやすい': 'Friendly', 'コミカル': 'Comical',
    'モノクロ': 'Monochrome', '実務的': 'Practical',
    '王道': 'Classic', '熱量': 'Passionate', '躍動感': 'Dynamic',
    '繊細': 'Delicate', '柔らかい': 'Soft', '共感': 'Empathetic',
    '重厚': 'Weighty', 'シリアス': 'Serious', '硬派': 'Hard-edged',
    'ニュートラル': 'Neutral', '見やすい': 'Legible', '記号的': 'Iconic',
    '経営層': 'Executives', '取引先': 'Partners', '求職者': 'Job seekers',
    '法人担当者': 'B2B staff', '新入社員': 'New hires', '一般消費者': 'Consumers',
    '若年層': 'Young adults', 'ファミリー層': 'Families', '学生': 'Students',
    '若手社会人': 'Young professionals', '20〜40代': 'Ages 20-40', '生活者': 'General public',
    '専門職': 'Professionals', '訪日外国人': 'Inbound visitors', '海外拠点': 'Overseas offices',
    '会社案内': 'Company profile', 'Web': 'Web', 'パンフレット': 'Brochure',
    '営業資料': 'Sales deck', '研修教材': 'Training material', 'LP': 'Landing page',
    'チラシ': 'Flyer', 'グッズ': 'Merchandise', '採用サイト': 'Careers site',
    '書籍': 'Book', '掲示物': 'Signage'
  };

  /* ===== DOM ===== */
  var grid = document.getElementById('artGrid');
  if (!grid) return;

  var chipWrap = document.getElementById('artFilter');
  var tabs = document.querySelectorAll('.art-tab');
  var emptyEl = document.getElementById('artEmpty');
  var countEl = document.getElementById('artCount');

  var overlay = document.getElementById('artModal');
  var mdTitle = document.getElementById('artModalTitle');
  var mdLead = document.getElementById('artModalLead');
  var mdGallery = document.getElementById('artModalGallery');
  var mdDetail = document.getElementById('artModalDetail');
  var mdMeta = document.getElementById('artModalMeta');
  var mdTags = document.getElementById('artModalTags');
  var closeBtn = document.getElementById('artModalClose');

  var currentMode = 'style';
  var selected = [];          /* 複数選択。空 = すべて */
  var lastFocused = null;

  function isEn() {
    return (document.documentElement.lang || 'ja') === 'en';
  }

  function t(ja) {
    return isEn() ? (EN[ja] || ja) : ja;
  }

  /* 日英ペアを持つ要素を作る。テキストは textContent 固定なので XSS しない */
  function el(tag, cls, ja, en) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (ja != null) {
      node.setAttribute('data-ja', ja);
      node.setAttribute('data-en', en || ja);
      node.textContent = isEn() ? (en || ja) : ja;
    }
    return node;
  }

  /* ===== カード描画 ===== */
  function matches(item) {
    if (!selected.length) return true;
    var pool = item[FILTER_MODES[currentMode].key] || [];
    /* OR 検索: 選んだいずれかに当てはまれば表示（AND だと 0 件になりやすい） */
    return selected.some(function(tag) { return pool.indexOf(tag) !== -1; });
  }

  function renderCards() {
    grid.textContent = '';
    var frag = document.createDocumentFragment();
    var shown = 0;

    STYLE_DATA.forEach(function(item, i) {
      if (!matches(item)) return;

      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'art-card';
      card.setAttribute('data-style-id', item.id);
      card.setAttribute('aria-haspopup', 'dialog');

      var label = document.createElement('span');
      label.className = 'art-card__label';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = String.fromCharCode(65 + (shown % 26));  /* A, B, C… の視認ラベル */
      card.appendChild(label);

      var media = document.createElement('span');
      media.className = 'art-card__media';
      var img = document.createElement('img');
      img.className = 'art-card__img';
      img.src = item.thumbnail;
      img.alt = item.title + 'の作例';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 400;
      img.height = 560;
      media.appendChild(img);
      card.appendChild(media);

      var body = document.createElement('span');
      body.className = 'art-card__body';
      body.appendChild(el('span', 'art-card__title', item.title, item.titleEn));
      body.appendChild(el('span', 'art-card__summary', item.summary, item.summaryEn));

      /* 用途タブのときは用途タグを、画風タブのときは画風タグを前に出す */
      var chipSource = currentMode === 'usecase' ? item.usecaseTags : item.styleTags;
      var tagWrap = document.createElement('span');
      tagWrap.className = 'art-card__tags';
      (chipSource || []).slice(0, 3).forEach(function(tag) {
        tagWrap.appendChild(el('span', 'art-card__tag', tag, EN[tag]));
      });
      body.appendChild(tagWrap);
      body.appendChild(el('span', 'art-card__more', 'この画風を詳しく見る', 'View this style'));

      card.appendChild(body);
      card.addEventListener('click', function() { openModal(item); });
      frag.appendChild(card);
      shown++;
    });

    grid.appendChild(frag);
    if (emptyEl) emptyEl.classList.toggle('is-visible', shown === 0);
    if (countEl) countEl.textContent = String(shown);
  }

  /* ===== チップ描画 ===== */
  function makeChip(label, active) {
    var btn = el('button', 'art-chip' + (active ? ' is-active' : ''), label, EN[label]);
    btn.type = 'button';
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    return btn;
  }

  function renderChips() {
    if (!chipWrap) return;
    chipWrap.textContent = '';
    var conf = FILTER_MODES[currentMode];

    var allBtn = makeChip('すべて', selected.length === 0);
    allBtn.addEventListener('click', function() {
      selected = [];
      renderChips();
      renderCards();
    });
    chipWrap.appendChild(allBtn);

    conf.chips.forEach(function(tag) {
      /* 該当0件のタグは出さない（押しても何も起きないチップを作らない） */
      var hit = STYLE_DATA.some(function(it) { return (it[conf.key] || []).indexOf(tag) !== -1; });
      if (!hit) return;

      var btn = makeChip(tag, selected.indexOf(tag) !== -1);
      btn.addEventListener('click', function() {
        var idx = selected.indexOf(tag);
        if (idx === -1) selected.push(tag);
        else selected.splice(idx, 1);
        renderChips();
        renderCards();
      });
      chipWrap.appendChild(btn);
    });
  }

  /* ===== モーダル ===== */
  function addMetaRow(dl, labelJa, labelEn, values) {
    if (!values || !values.length) return;
    var row = document.createElement('div');
    row.className = 'art-modal__meta-row';

    var dt = el('dt', 'art-modal__meta-key', labelJa, labelEn);
    row.appendChild(dt);

    var dd = document.createElement('dd');
    dd.className = 'art-modal__meta-vals';
    values.forEach(function(v) {
      dd.appendChild(el('span', 'art-modal__meta-val', v, EN[v]));
    });
    row.appendChild(dd);
    dl.appendChild(row);
  }

  function openModal(item) {
    if (!overlay) return;
    lastFocused = document.activeElement;

    if (mdTitle) {
      mdTitle.setAttribute('data-ja', item.title);
      mdTitle.setAttribute('data-en', item.titleEn);
      mdTitle.textContent = isEn() ? item.titleEn : item.title;
    }
    if (mdLead) {
      mdLead.setAttribute('data-ja', item.summary);
      mdLead.setAttribute('data-en', item.summaryEn || item.summary);
      mdLead.textContent = isEn() ? (item.summaryEn || item.summary) : item.summary;
    }
    if (mdDetail) mdDetail.textContent = item.detail || '';

    /* サンプル画像: 代表 + gallery */
    if (mdGallery) {
      mdGallery.textContent = '';
      var shots = [{ src: item.thumbnail, alt: item.title + 'の代表作例' }].concat(item.gallery || []);
      shots.forEach(function(g) {
        var fig = document.createElement('figure');
        fig.className = 'art-modal__shot';
        var im = document.createElement('img');
        im.src = g.src;
        im.alt = g.alt;
        im.loading = 'lazy';
        im.decoding = 'async';
        fig.appendChild(im);
        mdGallery.appendChild(fig);
      });
    }

    if (mdMeta) {
      mdMeta.textContent = '';
      addMetaRow(mdMeta, '得意ジャンル', 'Genres', item.genreTags);
      addMetaRow(mdMeta, '向いている用途', 'Best for', item.usecaseTags);
      addMetaRow(mdMeta, '読者層', 'Audience', item.audienceTags);
      addMetaRow(mdMeta, '媒体', 'Media', item.mediaTags);
    }

    if (mdTags) {
      mdTags.textContent = '';
      (item.styleTags || []).forEach(function(tag) {
        mdTags.appendChild(el('span', 'art-modal__tag', tag, EN[tag]));
      });
    }

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('is-open')) closeModal();
  });

  /* ===== タブ切替 ===== */
  Array.prototype.forEach.call(tabs, function(tab) {
    tab.addEventListener('click', function() {
      var mode = tab.getAttribute('data-mode');
      if (!mode || mode === currentMode) return;
      currentMode = mode;
      selected = [];   /* 軸が変わるので選択はリセット */

      Array.prototype.forEach.call(tabs, function(other) {
        var on = other === tab;
        other.classList.toggle('is-active', on);
        other.setAttribute('aria-selected', on ? 'true' : 'false');
      });

      /* 用途タブでは説明文より用途タグを目立たせる（CSS 側で切替） */
      grid.classList.toggle('art-grid--usecase', mode === 'usecase');

      renderChips();
      renderCards();
    });
  });

  /* ===== 初期化 ===== */
  renderChips();
  renderCards();

  /* 言語切替に追従（テキストノードを自前で書いているため再描画する） */
  window.addEventListener('bm-lang-change', function() {
    renderChips();
    renderCards();
  });

  /* CMS/CRM 連携時の入口。STYLE_DATA と同じ形の配列を渡せば差し替わる */
  window.bmArtists = {
    setData: function(list) {
      if (!Array.isArray(list) || !list.length) return;
      STYLE_DATA = list;
      renderChips();
      renderCards();
    }
  };
})();
