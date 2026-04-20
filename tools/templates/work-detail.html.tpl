<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title_ja}} | 制作事例 | ビズマンガ</title>
  <meta name="description" content="{{description}}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{{url}}">
  <!-- OGP -->
  <meta property="og:title" content="{{title_ja}} | 制作事例 | ビズマンガ">
  <meta property="og:description" content="{{description}}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{{url}}">
  <meta property="og:site_name" content="ビズマンガ">
  <meta property="og:image" content="{{og_image}}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{{title_ja}}｜ビズマンガ制作事例">
  <meta property="og:locale" content="ja_JP">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@Bizmanga_">
  <meta name="twitter:title" content="{{title_ja}} | 制作事例 | ビズマンガ">
  <meta name="twitter:description" content="{{description}}">
  <meta name="twitter:image" content="{{og_image}}">
  <!-- GA4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-Q1T3033Q3W"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Q1T3033Q3W');</script>
  <!-- Microsoft Clarity -->
  <script type="text/javascript">
  (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "wd18nkhvy8");
  </script>
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="https://contentsx.jp/material/images/logo/bizmanga-icon.png">
  <!-- Styles -->
  <link rel="stylesheet" href="/css/bizmanga.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <link rel="preload" as="image" href="{{thumbnail}}" fetchpriority="high">
  <!-- JSON-LD: BreadcrumbList -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://bizmanga.contentsx.jp/" },
      { "@type": "ListItem", "position": 2, "name": "制作事例", "item": "https://bizmanga.contentsx.jp/works" },
      { "@type": "ListItem", "position": 3, "name": "{{title_ja}}", "item": "{{url}}" }
    ]
  }
  </script>
  <!-- JSON-LD: CreativeWork -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "name": "{{title_ja}}",
    "alternateName": "{{title_en}}",
    "description": "{{description}}",
    "url": "{{url}}",
    "image": {
      "@type": "ImageObject",
      "url": "{{og_image}}",
      "width": 1200,
      "height": 630
    },
    "genre": "{{category}}",
    "creator": {
      "@type": "Organization",
      "name": "ビズマンガ（BizManga）",
      "url": "https://bizmanga.contentsx.jp/"
    },
    "publisher": {
      "@type": "Organization",
      "name": "ビズマンガ（BizManga）",
      "url": "https://bizmanga.contentsx.jp/",
      "parentOrganization": {
        "@type": "Organization",
        "name": "ContentsX（コンテンツエックス株式会社）",
        "url": "https://contentsx.jp"
      }
    }
  }
  </script>
</head>
<body>

  <!-- ===== ヘッダー ===== -->
  <header class="bm-header" id="header">
    <div class="bm-header-inner">
      <a href="/" class="bm-logo">
        <img src="https://contentsx.jp/material/images/logo/bizmanga-logo.webp" alt="BizManga" class="bm-logo-img">
      </a>
      <nav class="bm-nav" id="bmNav"></nav>
      <div class="bm-header-right">
        <a href="/contact" class="bm-nav-cta" data-ja="お問い合わせ" data-en="Contact">お問い合わせ</a>
        <button class="bm-hamburger" id="bmHamburger" aria-label="メニュー">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>

  <main class="bm-work-detail-page">
    <div class="bm-container">
      <nav class="bm-work-detail-breadcrumb" aria-label="breadcrumb">
        <a href="/">ホーム</a> &rsaquo; <a href="/works">制作事例</a> &rsaquo; {{title_ja}}
      </nav>

      <header class="bm-work-detail-hero">
        <span class="bm-work-detail-category">{{category}}</span>
        <h1 class="bm-work-detail-title">{{title_ja}}</h1>
        <p class="bm-work-detail-client">{{client_line}}</p>
        <div class="bm-work-detail-thumb">
          <img src="{{thumbnail}}" alt="{{title_ja}}" width="1200" height="630" fetchpriority="high" decoding="async">
        </div>
      </header>

      <dl class="bm-work-detail-spec">
        <div><dt>ページ数</dt><dd>{{pages_count}}</dd></div>
        <div><dt>制作期間</dt><dd>{{period}}</dd></div>
        <div><dt>用途・メディア</dt><dd>{{media}}</dd></div>
        <div><dt>カテゴリ</dt><dd>{{category}}</dd></div>
      </dl>

      <section class="bm-work-detail-section">
        <h2>制作ポイント</h2>
        <p>{{point}}</p>
      </section>

{{comment_section}}

      <section class="bm-work-detail-section">
        <h2>ページ一覧</h2>
        <div class="bm-work-detail-gallery">
{{gallery_html}}
        </div>
      </section>

      <div style="text-align: center;">
        <a href="/works" class="bm-work-detail-back">&larr; 制作事例一覧に戻る</a>
      </div>

      <aside class="bm-work-detail-cta">
        <h3>こんな漫画を作りたい方へ</h3>
        <p>ビジネス課題に合わせたオリジナル漫画を制作します。お気軽にご相談ください。</p>
        <a href="/contact">お問い合わせ・見積もり相談</a>
      </aside>
    </div>
  </main>

  <!-- ===== Footer ===== -->
  <footer class="bm-footer">
    <div class="bm-container">
      <div class="bm-footer-inner">
        <div class="bm-footer-brand">
          <img src="https://contentsx.jp/material/images/logo/bizmanga-logo.webp" alt="BizManga" class="bm-logo-img">
          <p class="bm-footer-company">コンテンツエックス株式会社</p>
          <p class="bm-footer-address" data-ja="東京都目黒区中目黒1-8-8 目黒F2ビル1F" data-en="1F Meguro F2 Building, 1-8-8 Nakameguro, Meguro-ku, Tokyo">東京都目黒区中目黒1-8-8 目黒F2ビル1F</p>
        </div>
        <div class="bm-footer-links">
          <a href="/">ホーム</a>
          <a href="/works">制作事例</a>
          <a href="/biz-library">ビズ書庫</a>
          <a href="/pricing">料金</a>
          <a href="/faq">FAQ</a>
          <a href="/contact">お問い合わせ</a>
          <a href="/privacy-policy" data-ja="プライバシーポリシー" data-en="Privacy Policy">プライバシーポリシー</a>
        </div>
      </div>
      <div class="bm-footer-bottom">
        <p>&copy; Contents X Co., Ltd. 2026 All rights reserved.</p>
        <a href="https://contentsx.jp/" class="bm-footer-parent">ContentsX Corporate Site &rarr;</a>
      </div>
    </div>
  </footer>

  <script src="/js/bm-i18n.js" defer></script>
  <script src="/js/bm-nav.js" defer></script>
  <script src="/js/bm-tracking.js" defer></script>
</body>
</html>
