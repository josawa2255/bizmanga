/**
 * 漫画家・作品紹介（/artists）
 *
 * カードは「漫画家1人＝1枚」。画風・ジャンル・用途などのカテゴリは
 * カードの単位ではなく、あくまで**絞り込みの軸**として使う。
 *
 * ── 作家名の扱い ──────────────────────────────────────────
 * 営業資料『ContentsX_漫画家作品紹介』と同じく、作家は A〜K の記号で指名する運用。
 * ペンネームは出さない（記号 + 画風 + 作例で選んでもらい、指名は記号で受ける）。
 *
 * ── データの差し替えについて ────────────────────────────────
 * 作家データは下の CREATORS 配列だけに閉じている。ここを差し替えれば
 * HTML/CSS を触らずに追加・削除・並べ替えができる。
 * 将来 CRM(Supabase creators テーブル)と繋ぐ場合も、同じ形の配列を
 * window.bmArtists.setData() に渡すだけでよい（ファイル末尾）。
 *
 * 各項目のスキーマ（CRM の creators / creator_tags に対応）:
 *   id          … 記号（A〜K）。表示ラベル兼キー
 *   slug        … 将来の個別URL用
 *   title       … 画風の見出し（営業資料の見出しに準拠）
 *   summary     … 一言説明
 *   thumbnail   … カード用サムネ
 *   gallery[]   … 詳細モーダルの追加サンプル
 *   styleTags[] … 画風・テイスト   ← CRM creator_tags.category = 'style'
 *   genreTags[] … ジャンル         ← 同 'genre'
 *   audienceTags[] … 読者層        ← 同 'audience'
 *   mediaTags[] … 媒体             ← 同 'medium'
 *   usecaseTags[] … 向いている用途（CRMには無い。営業資料の記述から付与）
 *   works       … 代表作（表に出してよいものだけ）
 *   yearsActive … 活動歴
 *   detail      … この作家の特徴
 *
 * ⚠️ DOM は createElement + textContent で組む（innerHTML を使わない）。
 *    CRM 由来の文字列が入っても XSS にならないようにするため。
 */
(function() {
  'use strict';

  var IMG = '/material/images/artists/';

  /* ===== 作家データ（差し替えポイント） ===== */
  var CREATORS = [
    {
      id: 'A',
      slug: 'isekai-fantasy',
      title: '異世界・ファンタジーの縦読み',
      titleEn: 'Fantasy Vertical Scroll',
      summary: '異世界ファンタジーを縦読みで読ませる作家。キャラクターデザインからネームまで一貫して対応できます。',
      summaryEn: 'Fantasy storytelling built for vertical scroll reading.',
      thumbnail: IMG + 'creator-a.webp',
      gallery: [
        { src: IMG + 'creator-a-1.webp', alt: '異世界・ファンタジーの作例1' },
        { src: IMG + 'creator-a-2.webp', alt: '異世界・ファンタジーの作例2' },
        { src: IMG + 'creator-a-3.webp', alt: '異世界・ファンタジーの作例3' }
      ],
      styleTags: ['キレイめ・美麗', '可愛い・デフォルメ', 'かっこいい・スタイリッシュ'],
      genreTags: ['SF・ファンタジー', '少年漫画', '青年漫画', '縦読み漫画'],
      audienceTags: ['10代', '20代', '30代', '男性'],
      mediaTags: ['Webコミックサイト/アプリ', '商業誌'],
      usecaseTags: ['集客・広告', '商品紹介', 'SNS'],
      works: ['竜宮少女は恩返したい！', 'アインの伝説', '醜いゴブリンは、今度こそ魔王様を死なせない'],
      yearsActive: '3年',
      detail: 'キャラクターデザイン・ネーム・作画までを通して担当できる作家です。縦読み（スクロール）の見せ方に慣れているため、スマートフォンで読ませる企画と相性がよく、世界観のあるストーリーを1本立ち上げたいときに向いています。'
    },
    {
      id: 'B',
      slug: 'shonen-school',
      title: '少年漫画・学園／アクション',
      titleEn: 'Shonen & School Action',
      summary: '少年漫画テイストの読み切りを手がける作家。学園もの・アクションの見せゴマに強みがあります。',
      summaryEn: 'Shonen-style one-shots with strong action framing.',
      thumbnail: IMG + 'creator-b.webp',
      gallery: [
        { src: IMG + 'creator-b-1.webp', alt: '少年漫画・学園の作例1' },
        { src: IMG + 'creator-b-2.webp', alt: '少年漫画・学園の作例2' },
        { src: IMG + 'creator-b-3.webp', alt: '少年漫画・学園の作例3' }
      ],
      styleTags: ['ポップ・親しみやすい', 'かっこいい・スタイリッシュ'],
      genreTags: ['少年漫画', '青年漫画', '横読み漫画'],
      audienceTags: ['10代', '20代', 'どちらも'],
      mediaTags: ['月刊誌', '隔週/不定期誌', '同人誌'],
      usecaseTags: ['採用', '研修', '集客・広告'],
      works: ['ブリュンヒルデ姫学園', 'モナリザの剣（集英社 ジャンプSQ.RISE 掲載）'],
      yearsActive: '5年',
      detail: '背景の描き起こしから仕上げ（ベタ・トーン・効果）まで工程を通して対応できる作家です。読み切りの経験があるため、限られたページ数で起承転結を作る構成に慣れています。挑戦や成長を描く採用マンガと好相性です。'
    },
    {
      id: 'C',
      slug: 'character-illust',
      title: 'キャラクターイラスト・ビズキャラ開発',
      titleEn: 'Character Illustration',
      summary: 'カラーのキャラクターイラストが主戦場。自社キャラクターを立てたSNS運用にも対応できます。',
      summaryEn: 'Full-color character art for brand mascots and SNS.',
      thumbnail: IMG + 'creator-c.webp',
      gallery: [
        { src: IMG + 'creator-c-1.webp', alt: 'キャラクターイラストの作例1' },
        { src: IMG + 'creator-c-2.webp', alt: 'キャラクターイラストの作例2' },
        { src: IMG + 'creator-c-3.webp', alt: 'キャラクターイラストの作例3' }
      ],
      styleTags: ['アニメ調', '可愛い・デフォルメ', 'キレイめ・美麗'],
      genreTags: ['かわいい系', 'SF・ファンタジー', '青年漫画'],
      audienceTags: ['10代', '20代', 'どちらも'],
      mediaTags: ['Webコミックサイト/アプリ', '同人誌'],
      usecaseTags: ['集客・広告', 'SNS', '会社紹介'],
      works: ['男性向け漫画の連載（メディア編集部）', 'キャラクターイラスト多数'],
      yearsActive: '—',
      detail: 'アニメ調のカラーイラストとキャラクターデザインを得意とする作家です。立ち絵・表情差分・デフォルメ（SD）まで展開できるため、企業のマスコットキャラクターを作って継続的に発信していく企画に向いています。'
    },
    {
      id: 'D',
      slug: 'retro-pop',
      title: 'レトロポップ・4コマ／企業広報',
      titleEn: 'Retro Pop & 4-Koma',
      summary: 'レトロポップな色使いで企業広報を描く作家。4コマ・パンフレット漫画・書籍装丁まで対応します。',
      summaryEn: 'Retro-pop corporate comms, 4-koma and book covers.',
      thumbnail: IMG + 'creator-d.webp',
      gallery: [
        { src: IMG + 'creator-d-1.webp', alt: 'レトロポップ・4コマの作例1' },
        { src: IMG + 'creator-d-2.webp', alt: 'レトロポップ・4コマの作例2' },
        { src: IMG + 'creator-d-3.webp', alt: 'レトロポップ・4コマの作例3' }
      ],
      styleTags: ['ポップ・親しみやすい', '可愛い・デフォルメ', 'リアル・劇画調'],
      genreTags: ['ギャグ・コメディ', '4コマ漫画', 'ビジネス・IT', '日常・ほのぼの'],
      audienceTags: ['幅広い年代', 'どちらも'],
      mediaTags: ['商業誌', 'パンフレットなどに載る漫画'],
      usecaseTags: ['商品紹介', '会社紹介', '集客・広告', 'SNS'],
      works: ['#うっかり課長物語（SNS連載4コマ）', '企業タイアップWeb漫画', '書籍装丁イラスト'],
      yearsActive: '—',
      detail: '限定色とレトロな線で強い印象を残す作家です。4コマの短い尺で要点を伝える構成に慣れており、SNS連載・パンフレット・書籍装丁まで幅広く展開できます。硬くなりがちな企業広報を、親しみやすい絵で軽くしたいときに向いています。'
    },
    {
      id: 'E',
      slug: 'gekiga-serious',
      title: '劇画・重厚タッチ／経営者ストーリー',
      titleEn: 'Gekiga & Executive Stories',
      summary: '経営者の評伝や重いテーマを、緻密な劇画タッチで描く作家。実績30年のベテランです。',
      summaryEn: 'Weighty gekiga art for executive biographies.',
      thumbnail: IMG + 'creator-e.webp',
      gallery: [
        { src: IMG + 'creator-e-1.webp', alt: '劇画・重厚タッチの作例1' },
        { src: IMG + 'creator-e-2.webp', alt: '劇画・重厚タッチの作例2' },
        { src: IMG + 'creator-e-3.webp', alt: '劇画・重厚タッチの作例3' }
      ],
      styleTags: ['リアル・劇画調', 'かっこいい・スタイリッシュ'],
      genreTags: ['青年漫画', '歴史・時代劇', 'ホラー・サスペンス', 'スポーツ'],
      audienceTags: ['40代以上', '男性'],
      mediaTags: ['週刊誌', '月刊誌', '商業誌', '学習教材'],
      usecaseTags: ['会社紹介', 'IR・周年史', '研修'],
      works: ['ジョニー・デップ物語', '影を売った男', 'ビリ玉剣士'],
      yearsActive: '30年',
      detail: '週刊誌・月刊誌での連載実績が長いベテラン作家です。陰影を強く効かせた緻密な描線で、扱う内容の重さをそのまま伝えられます。創業者の評伝・周年史など、軽く見られたくない訴求に向いています。'
    },
    {
      id: 'F',
      slug: 'business-person',
      title: 'ビジネス人物描写／採用・研修',
      titleEn: 'Business Character Drawing',
      summary: '採用・研修漫画のビジネス人物描写を得意とする作家。短納期の案件にも対応します。',
      summaryEn: 'Business character work for recruiting and training.',
      thumbnail: IMG + 'creator-f.webp',
      gallery: [
        { src: IMG + 'creator-f-1.webp', alt: 'ビジネス人物描写の作例1' },
        { src: IMG + 'creator-f-2.webp', alt: 'ビジネス人物描写の作例2' },
        { src: IMG + 'creator-f-3.webp', alt: 'ビジネス人物描写の作例3' }
      ],
      styleTags: ['キレイめ・美麗', 'ポップ・親しみやすい'],
      genreTags: ['青年漫画', '女性漫画', '日常・ほのぼの', '縦読み漫画'],
      audienceTags: ['20代', '30代', 'どちらも'],
      mediaTags: ['Webコミックサイト/アプリ', '商業誌'],
      usecaseTags: ['採用', '研修', '会社紹介'],
      works: ['縦読み週刊連載のネーム担当2作品', '『ねこぱんち』読切10作以上掲載'],
      yearsActive: '—',
      detail: '縦読み週刊連載のネームを担当した経験があり、話の設計から任せられる作家です。実在の社員をモデルにした人物描写に慣れているため、採用マンガや研修マンガで「自分ごと」として読ませたい場面に向いています。短納期の相談も可能です。'
    },
    {
      id: 'G',
      slug: 'corporate-documentary',
      title: '実録・企業漫画／ドキュメンタリー',
      titleEn: 'Corporate Documentary',
      summary: '実際の出来事をドキュメンタリータッチで再現する作家。単行本の実績もあります。',
      summaryEn: 'Documentary-style retelling of real business events.',
      thumbnail: IMG + 'creator-g.webp',
      gallery: [
        { src: IMG + 'creator-g-1.webp', alt: '実録・企業漫画の作例1' },
        { src: IMG + 'creator-g-2.webp', alt: '実録・企業漫画の作例2' },
        { src: IMG + 'creator-g-3.webp', alt: '実録・企業漫画の作例3' }
      ],
      styleTags: ['ポップ・親しみやすい', 'リアル・劇画調'],
      genreTags: ['青年漫画', 'ギャグ・コメディ', 'ホラー・サスペンス', '医療・ヘルスケア', '4コマ漫画'],
      audienceTags: ['20代', '30代', '40代以上', '男性'],
      mediaTags: ['月刊誌', 'Webコミックサイト/アプリ', '商業誌'],
      usecaseTags: ['営業資料', '商品紹介', '会社紹介', '研修'],
      works: ['私をフォローしないで', 'ノロイゴト', '阿曽山大噴火の面白人間傍聴記'],
      yearsActive: '—',
      detail: '「何が起きて、どう解決したか」を時系列で追う構成に強い作家です。キャラクターの表情差分やカラー4コマまで対応できるため、サービスの説明を順を追って理解させたい営業資料・商品紹介と相性がよいです。'
    },
    {
      id: 'H',
      slug: 'romance-drama',
      title: '恋愛・ドラマ性の縦読み／エッセイ',
      titleEn: 'Romance Drama & Essay',
      summary: '恋愛やドラマ性で読ませる作家。コミックエッセイの作画も長期連載で担当しています。',
      summaryEn: 'Romance-driven vertical scroll and comic essays.',
      thumbnail: IMG + 'creator-h.webp',
      gallery: [
        { src: IMG + 'creator-h-1.webp', alt: '恋愛・ドラマ性の作例1' },
        { src: IMG + 'creator-h-2.webp', alt: '恋愛・ドラマ性の作例2' },
        { src: IMG + 'creator-h-3.webp', alt: '恋愛・ドラマ性の作例3' }
      ],
      styleTags: ['キレイめ・美麗', 'ポップ・親しみやすい', '可愛い・デフォルメ'],
      genreTags: ['少女漫画', '女性漫画', 'TL（ティーンズラブ）', '恋愛', '縦読み漫画'],
      audienceTags: ['20代', '30代', '女性'],
      mediaTags: ['Webコミックサイト/アプリ', '商業誌'],
      usecaseTags: ['商品紹介', '集客・広告', 'SNS'],
      works: ['異世界系Webtoonのネーム担当（2023年連載／2024年アニメ化）', 'TLコミカライズ 全6巻（作画担当）', 'コミックエッセイ 全52話（作画担当）'],
      yearsActive: '—',
      detail: '全52話のコミックエッセイを作画担当した実績があり、長期の連載を安定して走らせられる作家です。悩みへの共感から入って解決策を示す構成に慣れているため、生活者向けの商品紹介やSNS連載に向いています。'
    },
    {
      id: 'I',
      slug: 'anime-3dcg',
      title: 'アニメ品質の作画・3DCG',
      titleEn: 'Anime Quality & 3DCG',
      summary: 'アニメの原画・3DCGディレクションまで手がける作家。メカ・背景の描き込みが要る案件に。',
      summaryEn: 'Anime-grade art and 3DCG for mecha and detailed backgrounds.',
      thumbnail: IMG + 'creator-i.webp',
      gallery: [
        { src: IMG + 'creator-i-1.webp', alt: 'アニメ作画・3DCGの作例1' },
        { src: IMG + 'creator-i-2.webp', alt: 'アニメ作画・3DCGの作例2' },
        { src: IMG + 'creator-i-3.webp', alt: 'アニメ作画・3DCGの作例3' }
      ],
      styleTags: ['アニメ調', 'キレイめ・美麗', '可愛い・デフォルメ'],
      genreTags: ['SF・ファンタジー', '少年漫画', '青年漫画', '歴史・時代劇'],
      audienceTags: ['幅広い年代', 'どちらも'],
      mediaTags: ['Webコミックサイト/アプリ', '同人誌'],
      usecaseTags: ['商品紹介', '集客・広告', '会社紹介'],
      works: ['オリジナル漫画『STAR FRIGATE』（合同誌にて連載）', '劇場アニメ・TVアニメの原画', '3DCGディレクション'],
      yearsActive: '30年以上',
      detail: '劇場アニメ・TVアニメの原画や3DCGディレクションまで担当できる作家です。メカ・背景の描き込みが必要な題材や、キャラクターを3Dモデル化して動かしたい企画など、通常の漫画制作を超える要求に応えられます。'
    },
    {
      id: 'J',
      slug: 'romance-comedy',
      title: '女性向け恋愛漫画（横読み）',
      titleEn: 'Romance Comedy',
      summary: '日常のときめきを描くラブコメ作家。商業連載の実績が複数あります。',
      summaryEn: 'Everyday romantic comedy with commercial credits.',
      thumbnail: IMG + 'creator-j.webp',
      gallery: [
        { src: IMG + 'creator-j-1.webp', alt: '女性向け恋愛漫画の作例1' },
        { src: IMG + 'creator-j-2.webp', alt: '女性向け恋愛漫画の作例2' },
        { src: IMG + 'creator-j-3.webp', alt: '女性向け恋愛漫画の作例3' }
      ],
      styleTags: ['ポップ・親しみやすい', '可愛い・デフォルメ'],
      genreTags: ['女性漫画', 'ギャグ・コメディ', '日常・ほのぼの', '横読み漫画'],
      audienceTags: ['20代', '30代', '40代以上', 'どちらも'],
      mediaTags: ['月刊誌', 'Webコミックサイト/アプリ', '商業誌'],
      usecaseTags: ['商品紹介', '集客・広告', 'SNS'],
      works: ['ご飯つくりすぎ子と完食系男子', '脇役女子は後輩くんに酔わされたい', 'ハッピーアワーガールズ'],
      yearsActive: '10年',
      detail: '複数の商業連載を持つ作家です。food や飲みの席など、日常のワンシーンを軸に感情を動かす構成を得意とします。生活者に近い距離感で商品を紹介したいとき、押しつけがましくない訴求ができます。'
    },
    {
      id: 'K',
      slug: 'business-versatile',
      title: 'ビジネスドラマ調〜マスコット4コマ',
      titleEn: 'Versatile Business Manga',
      summary: 'ビジネスドラマ調からマスコット4コマまで、幅広いタッチに対応できる作家です。',
      summaryEn: 'From business drama to mascot 4-koma, a wide range.',
      thumbnail: IMG + 'creator-k.webp',
      gallery: [
        { src: IMG + 'creator-k-1.webp', alt: 'ビジネス4コマの作例1' },
        { src: IMG + 'creator-k-2.webp', alt: 'ビジネス4コマの作例2' },
        { src: IMG + 'creator-k-3.webp', alt: 'ビジネス4コマの作例3' }
      ],
      styleTags: ['ポップ・親しみやすい', '可愛い・デフォルメ', 'キレイめ・美麗'],
      genreTags: ['ビジネス・IT', '4コマ漫画', '日常・ほのぼの', '教育・学習・育児'],
      audienceTags: ['幅広い年代', 'どちらも'],
      mediaTags: ['パンフレットなどに載る漫画', 'Webコミックサイト/アプリ'],
      usecaseTags: ['営業資料', '研修', '商品紹介', '会社紹介'],
      works: ['オフィスドラマ調ビジネス漫画', 'マスコットキャラクター4コマ', '制度・サービス紹介インフォグラフィック漫画'],
      yearsActive: '—',
      detail: '1人で複数のタッチを描き分けられる作家です。硬めのオフィスドラマ調から、親しみやすいマスコット4コマ、ほのぼのした家族ものまで対応できるため、同じシリーズ内でトーンを変えたい制度説明・サービス紹介に向いています。'
    }
  ];

  /* ===== 絞り込み定義 ===== */
  /* CRM の creator_tags（category = style / genre / audience / medium）に対応。
     用途(usecase)だけは CRM に無く、営業資料の記述から付与している。 */
  var FILTERS = [
    { key: 'styleTags',    label: '画風',   labelEn: 'Style' },
    { key: 'usecaseTags',  label: '用途',   labelEn: 'Purpose' },
    { key: 'genreTags',    label: 'ジャンル', labelEn: 'Genre' },
    { key: 'audienceTags', label: '読者層', labelEn: 'Audience' },
    { key: 'mediaTags',    label: '媒体',   labelEn: 'Media' }
  ];

  var EN = {
    'すべて': 'All',
    /* 画風 */
    'キレイめ・美麗': 'Refined', '可愛い・デフォルメ': 'Cute / Chibi',
    'かっこいい・スタイリッシュ': 'Stylish', 'ポップ・親しみやすい': 'Pop / Friendly',
    'リアル・劇画調': 'Realistic / Gekiga', 'アニメ調': 'Anime style',
    /* 用途 */
    '採用': 'Recruitment', '会社紹介': 'Company', '商品紹介': 'Product',
    '営業資料': 'Sales', '研修': 'Training', '集客・広告': 'Advertising',
    'SNS': 'SNS', 'IR・周年史': 'IR',
    /* ジャンル */
    '少年漫画': 'Shonen', '少女漫画': 'Shojo', '青年漫画': 'Seinen', '女性漫画': 'Josei',
    'TL（ティーンズラブ）': 'Teens Love', '恋愛': 'Romance', 'ギャグ・コメディ': 'Comedy',
    'SF・ファンタジー': 'SF / Fantasy', 'ホラー・サスペンス': 'Horror', 'スポーツ': 'Sports',
    '日常・ほのぼの': 'Slice of life', '歴史・時代劇': 'Historical', 'かわいい系': 'Kawaii',
    '4コマ漫画': '4-Koma', 'ビジネス・IT': 'Business / IT', '医療・ヘルスケア': 'Medical',
    '教育・学習・育児': 'Education', '横読み漫画': 'Horizontal', '縦読み漫画': 'Vertical scroll',
    /* 読者層 */
    '10代': 'Teens', '20代': '20s', '30代': '30s', '40代以上': '40+',
    '幅広い年代': 'All ages', '男性': 'Male', '女性': 'Female', 'どちらも': 'Both',
    /* 媒体 */
    '週刊誌': 'Weekly', '月刊誌': 'Monthly', '隔週/不定期誌': 'Biweekly',
    '商業誌': 'Commercial', 'Webコミックサイト/アプリ': 'Web / App', '同人誌': 'Doujin',
    '学習教材': 'Educational', 'パンフレットなどに載る漫画': 'Brochure'
  };

  /* ===== DOM ===== */
  var grid = document.getElementById('artGrid');
  if (!grid) return;

  var filterWrap = document.getElementById('artFilter');
  var emptyEl = document.getElementById('artEmpty');
  var countEl = document.getElementById('artCount');
  var resetBtn = document.getElementById('artReset');

  var overlay = document.getElementById('artModal');
  var mdLabel = document.getElementById('artModalLabel');
  var mdTitle = document.getElementById('artModalTitle');
  var mdLead = document.getElementById('artModalLead');
  var mdGallery = document.getElementById('artModalGallery');
  var mdDetail = document.getElementById('artModalDetail');
  var mdMeta = document.getElementById('artModalMeta');
  var closeBtn = document.getElementById('artModalClose');

  var selected = {};    /* { styleTags: [...], usecaseTags: [...] } */
  FILTERS.forEach(function(f) { selected[f.key] = []; });
  var lastFocused = null;

  function isEn() {
    return (document.documentElement.lang || 'ja') === 'en';
  }

  function t(ja) {
    return isEn() ? (EN[ja] || ja) : ja;
  }

  /* 日英ペアを持つ要素。テキストは textContent 固定なので XSS しない */
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

  /* ===== 絞り込み ===== */
  function matches(item) {
    /* 軸をまたぐときは AND、同じ軸の中では OR。
       （「画風=アニメ調」かつ「用途=採用」を両方満たす人、という直感に合わせる） */
    return FILTERS.every(function(f) {
      var sel = selected[f.key];
      if (!sel.length) return true;
      var pool = item[f.key] || [];
      return sel.some(function(tag) { return pool.indexOf(tag) !== -1; });
    });
  }

  function activeCount() {
    return FILTERS.reduce(function(n, f) { return n + selected[f.key].length; }, 0);
  }

  /* ===== カード描画 ===== */
  function renderCards() {
    grid.textContent = '';
    var frag = document.createDocumentFragment();
    var shown = 0;

    CREATORS.forEach(function(item) {
      if (!matches(item)) return;
      shown++;

      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'art-card';
      card.setAttribute('data-creator-id', item.id);
      card.setAttribute('aria-haspopup', 'dialog');

      var label = document.createElement('span');
      label.className = 'art-card__label';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = item.id;
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
      img.height = 300;
      media.appendChild(img);
      card.appendChild(media);

      var body = document.createElement('span');
      body.className = 'art-card__body';
      body.appendChild(el('span', 'art-card__title', item.title, item.titleEn));
      body.appendChild(el('span', 'art-card__summary', item.summary, item.summaryEn));

      /* タグはカードに出さず、詳細モーダル内にだけ表示する。
         一覧は「絵＋画風の見出し」で見比べる場所にして、
         タグの読み込みは詳細を開いてからにするため */
      body.appendChild(el('span', 'art-card__more', 'この作家を詳しく見る', 'View this artist'));
      card.appendChild(body);

      card.addEventListener('click', function() { openModal(item); });
      frag.appendChild(card);
    });

    grid.appendChild(frag);
    if (emptyEl) emptyEl.classList.toggle('is-visible', shown === 0);
    if (countEl) countEl.textContent = String(shown);
    if (resetBtn) resetBtn.hidden = activeCount() === 0;
  }

  /* ===== フィルタ描画 ===== */
  /* タグを全部出すと（特にジャンル19件）画面が埋まって選びづらいので、
     既定は各軸 VISIBLE_CHIPS 件までにして、残りは「すべて見る」で開く。
     選択中のタグは畳んだ状態でも必ず見せる（選んだものが隠れると混乱するため）。 */
  var VISIBLE_CHIPS = 6;
  var expanded = {};
  FILTERS.forEach(function(f) { expanded[f.key] = false; });

  function renderFilters() {
    if (!filterWrap) return;
    filterWrap.textContent = '';

    FILTERS.forEach(function(f) {
      /* データに実在する値だけを、CREATORS の出現順で並べる */
      var values = [];
      CREATORS.forEach(function(c) {
        (c[f.key] || []).forEach(function(v) {
          if (values.indexOf(v) === -1) values.push(v);
        });
      });
      if (!values.length) return;

      var isOpen = expanded[f.key];
      var shownValues;
      if (isOpen || values.length <= VISIBLE_CHIPS) {
        shownValues = values;
      } else {
        /* 先頭 N 件 + 選択済み（Nより後ろにあるもの）を必ず含める */
        shownValues = values.slice(0, VISIBLE_CHIPS);
        selected[f.key].forEach(function(v) {
          if (shownValues.indexOf(v) === -1) shownValues.push(v);
        });
      }
      var hiddenCount = values.length - shownValues.length;

      var row = document.createElement('div');
      row.className = 'art-filter__row';
      row.appendChild(el('span', 'art-filter__label', f.label, f.labelEn));

      var chips = document.createElement('div');
      chips.className = 'art-filter__chips';

      shownValues.forEach(function(v) {
        var on = selected[f.key].indexOf(v) !== -1;
        var btn = el('button', 'art-chip' + (on ? ' is-active' : ''), v, EN[v]);
        btn.type = 'button';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.addEventListener('click', function() {
          var i = selected[f.key].indexOf(v);
          if (i === -1) selected[f.key].push(v);
          else selected[f.key].splice(i, 1);
          renderFilters();
          renderCards();
        });
        chips.appendChild(btn);
      });

      /* 開閉ボタン。畳めるものが無ければ出さない */
      if (hiddenCount > 0 || isOpen) {
        var more = document.createElement('button');
        more.type = 'button';
        more.className = 'art-more';
        more.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (isOpen) {
          more.setAttribute('data-ja', '閉じる');
          more.setAttribute('data-en', 'Close');
          more.textContent = isEn() ? 'Close' : '閉じる';
        } else {
          var ja = 'すべて見る（+' + hiddenCount + '）';
          var en = 'Show all (+' + hiddenCount + ')';
          more.setAttribute('data-ja', ja);
          more.setAttribute('data-en', en);
          more.textContent = isEn() ? en : ja;
        }
        more.addEventListener('click', function() {
          expanded[f.key] = !expanded[f.key];
          renderFilters();
        });
        chips.appendChild(more);
      }

      row.appendChild(chips);
      filterWrap.appendChild(row);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      FILTERS.forEach(function(f) {
        selected[f.key] = [];
        expanded[f.key] = false;   /* 展開も畳んで初期状態に戻す */
      });
      renderFilters();
      renderCards();
    });
  }

  /* ===== モーダル ===== */
  function addMetaRow(dl, labelJa, labelEn, values, translate) {
    if (!values || !values.length) return;
    var row = document.createElement('div');
    row.className = 'art-modal__meta-row';
    row.appendChild(el('dt', 'art-modal__meta-key', labelJa, labelEn));

    var dd = document.createElement('dd');
    dd.className = 'art-modal__meta-vals';
    values.forEach(function(v) {
      dd.appendChild(el('span', 'art-modal__meta-val', v, translate ? EN[v] : v));
    });
    row.appendChild(dd);
    dl.appendChild(row);
  }

  function openModal(item) {
    if (!overlay) return;
    lastFocused = document.activeElement;

    if (mdLabel) mdLabel.textContent = item.id;
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
      addMetaRow(mdMeta, '画風・テイスト', 'Style', item.styleTags, true);
      addMetaRow(mdMeta, '向いている用途', 'Best for', item.usecaseTags, true);
      addMetaRow(mdMeta, '得意ジャンル', 'Genres', item.genreTags, true);
      addMetaRow(mdMeta, '読者層', 'Audience', item.audienceTags, true);
      addMetaRow(mdMeta, '媒体', 'Media', item.mediaTags, true);
      if (item.yearsActive && item.yearsActive !== '—') {
        addMetaRow(mdMeta, '活動歴', 'Experience', [item.yearsActive], false);
      }
      addMetaRow(mdMeta, '代表作', 'Works', item.works, false);
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

  /* ===== 初期化 ===== */
  renderFilters();
  renderCards();

  /* 言語切替に追従（テキストノードを自前で書いているため再描画する） */
  window.addEventListener('bm-lang-change', function() {
    renderFilters();
    renderCards();
  });

  /* ===== 追従CTA（.bm-fab）の開閉 =====
     共通CTAは幅200px×3個=600pxあり、カードの1列目に被って作例が隠れる。
     このページでは既定をアイコンのみに畳み、トグルで開くようにする（CSS側は
     body.art-page にスコープ済みなので他ページの .bm-fab は変わらない）。
     .bm-fab は bm-nav.js が load 後に body へ挿す＝ここでは未生成のことがあるため待つ。 */
  function setupFabToggle(fab) {
    if (!fab || fab.querySelector('.art-fab-toggle')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'art-fab-toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', '相談メニューを開く');

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '3');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', '9 6 15 12 9 18');   /* > 。開くと180度回って < */
    svg.appendChild(poly);
    btn.appendChild(svg);

    btn.addEventListener('click', function() {
      var open = fab.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? '相談メニューを閉じる' : '相談メニューを開く');
    });

    fab.appendChild(btn);
  }

  var fabNow = document.querySelector('.bm-fab');
  if (fabNow) {
    setupFabToggle(fabNow);
  } else {
    /* bm-nav.js の挿入を待つ。取り逃すと巨大なCTAが出たままになるので監視する */
    var mo = new MutationObserver(function() {
      var f = document.querySelector('.bm-fab');
      if (f) { setupFabToggle(f); mo.disconnect(); }
    });
    mo.observe(document.body, { childList: true });
    window.addEventListener('load', function() {
      var f = document.querySelector('.bm-fab');
      if (f) { setupFabToggle(f); mo.disconnect(); }
    });
  }

  /* CRM 連携時の入口。CREATORS と同じ形の配列を渡せば差し替わる */
  window.bmArtists = {
    setData: function(list) {
      if (!Array.isArray(list) || !list.length) return;
      CREATORS = list;
      FILTERS.forEach(function(f) { selected[f.key] = []; });
      renderFilters();
      renderCards();
    }
  };
})();
