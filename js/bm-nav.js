/**
 * BizManga ナビゲーション + 言語切替（ContentsXと同じUI）
 * 全ページで共通メニュー＆JP/EN切替を統一。
 */
(function() {
  var NAV_ITEMS = [
    { label: 'ホーム',     labelEn: 'Home',       href: '/' },
    /* ビズ書庫＝実物を読む場所、制作事例＝実績を見る場所。どちらも「作った漫画を見る」
       入口なので、ビズ書庫のメガメニューに制作事例をまとめている（2026-08-30）。
       独立していた「制作事例」項目はここへ統合したため削除した（入口の二重化を避ける） */
    { label: 'ビズ書庫',   labelEn: 'Library',    href: '/biz-library', mega: true, columns: [
      {
        heading: '漫画を読む',
        headingEn: 'Read',
        items: [
          { label: 'ビズ書庫（全作品）', labelEn: 'Biz Library', href: '/biz-library' },
          /* children を持つ項目はホバーで右側にサブメニューが開く（第3階層） */
          { label: '制作事例（一覧）', labelEn: 'All Works', href: '/works', children: [
            { label: '採用マンガ',     labelEn: 'Recruit',  href: '/works/category/recruit' },
            { label: '営業マンガ',     labelEn: 'Sales',    href: '/works/category/sales' },
            { label: '商品紹介マンガ', labelEn: 'Product',  href: '/works/category/product' },
            { label: '会社紹介マンガ', labelEn: 'Company',  href: '/works/category/company' },
            { label: '研修マンガ',     labelEn: 'Training', href: '/works/category/training' },
            { label: 'マンガ広告',     labelEn: 'Manga Ad', href: '/works/category/ad' },
            { label: 'IR漫画',         labelEn: 'IR',       href: '/works/category/ir' }
          ]}
        ]
      }
    ]},
    { label: '漫画家紹介', labelEn: 'Artists',    href: '/artists' },
    { label: 'ビズアニメ', labelEn: 'Biz Anime',  href: '/bizanime' },
    { label: 'サービス',   labelEn: 'Services',   href: '/product-manga', mega: true, columns: [
      {
        heading: 'マーケ・広報部門向け',
        headingEn: 'For Marketing & PR',
        items: [
          { label: '商品紹介マンガ',     labelEn: 'Product Manga',   href: '/product-manga' },
          { label: 'マンガ広告',         labelEn: 'Manga Ad',        href: '/manga-ad-lp' },
          { label: 'インバウンド漫画',   labelEn: 'Inbound Manga',   href: '/inbound-manga' },
          { label: '会社紹介マンガ',     labelEn: 'Company Manga',   href: '/company-manga' }
        ]
      },
      {
        heading: '人事・営業部門向け',
        headingEn: 'For HR & Sales',
        items: [
          { label: '採用マンガ',         labelEn: 'Recruit Manga',   href: '/recruit-manga' },
          { label: '営業資料マンガ',     labelEn: 'Sales Manga',     href: '/sales-manga' },
          { label: '研修マンガ',         labelEn: 'Training Manga',  href: '/training-manga' },
          { label: 'IR・周年史マンガ',   labelEn: 'IR Manga',        href: '/ir-manga' }
        ]
      },
      {
        heading: 'ビズマンガを知る',
        headingEn: 'About BizManga',
        items: [
          { label: '漫画制作会社 比較',  labelEn: 'Company Comparison', href: '/manga-production-company' },
          { label: '強み',               labelEn: 'Strengths',       href: '/strength' },
          { label: 'マンガの種類',       labelEn: 'Manga Types',     href: '/manga-types' },
          { label: '活用場面',           labelEn: 'Use Cases',       href: '/use-cases' }
        ]
      }
    ]},
    { label: '料金',       labelEn: 'Pricing',    href: '/pricing' },
    { label: 'コラム',     labelEn: 'Column',     href: '/column' },
    { label: 'FAQ',        labelEn: 'FAQ',        href: '/faq' }
  ];

  var path = location.pathname;
  var currentFile = path.substring(path.lastIndexOf('/') + 1).replace('.html', '') || 'index';

  // hrefとcurrentFileを正規化して比較する関数（先頭/とindex/末尾スラッシュの差を吸収）
  function isCurrent(href) {
    if (!href) return false;
    var normalizedHref = href.replace(/^\//, '').replace(/\.html$/, '').replace(/\/$/, '') || 'index';
    return normalizedHref === currentFile;
  }

  // ===== 言語状態の管理 =====
  var currentLang = 'ja';
  try { currentLang = localStorage.getItem('bm-lang') || 'ja'; } catch(e) {}

  // ===== ナビ生成 =====
  var nav = document.getElementById('bmNav');
  if (!nav) return;
  nav.innerHTML = '';

  NAV_ITEMS.forEach(function(item) {
    if (item.mega && item.columns && item.columns.length > 0) {
      // メガメニュー
      var wrapper = document.createElement('div');
      wrapper.className = 'bm-nav-dropdown bm-nav-megamenu-wrap';

      var a = document.createElement('a');
      a.href = item.href;
      a.className = 'bm-nav-link bm-nav-dropdown-toggle';
      a.setAttribute('data-ja', item.label);
      a.setAttribute('data-en', item.labelEn);
      a.textContent = currentLang === 'en' ? item.labelEn : item.label;

      var arrow = document.createElement('span');
      arrow.className = 'bm-nav-dropdown-arrow';
      arrow.textContent = '▾';
      a.appendChild(arrow);
      wrapper.appendChild(a);

      var mega = document.createElement('div');
      mega.className = 'bm-nav-megamenu';
      var anyActive = false;
      item.columns.forEach(function(col) {
        var colEl = document.createElement('div');
        colEl.className = 'bm-nav-megamenu-col';

        var h = document.createElement('div');
        h.className = 'bm-nav-megamenu-heading';
        h.setAttribute('data-ja', col.heading);
        h.setAttribute('data-en', col.headingEn || col.heading);
        h.textContent = currentLang === 'en' ? (col.headingEn || col.heading) : col.heading;
        colEl.appendChild(h);

        col.items.forEach(function(child) {
          var ca = document.createElement('a');
          ca.href = child.href;
          ca.className = 'bm-nav-dropdown-item bm-nav-megamenu-item';
          if (isCurrent(child.href)) { ca.className += ' active'; anyActive = true; }
          ca.setAttribute('data-ja', child.label);
          ca.setAttribute('data-en', child.labelEn);
          ca.textContent = currentLang === 'en' ? child.labelEn : child.label;

          /* 第3階層。children があればホバーで右側にサブメニューを開く。
             項目自体はリンクのままなので、押せば親ページ(/works)へ行ける */
          if (child.children && child.children.length) {
            var sub = document.createElement('div');
            sub.className = 'bm-nav-submenu';

            child.children.forEach(function(gc) {
              var ga = document.createElement('a');
              ga.href = gc.href;
              ga.className = 'bm-nav-dropdown-item bm-nav-submenu-item';
              if (isCurrent(gc.href)) { ga.className += ' active'; anyActive = true; }
              ga.setAttribute('data-ja', gc.label);
              ga.setAttribute('data-en', gc.labelEn);
              ga.textContent = currentLang === 'en' ? gc.labelEn : gc.label;
              sub.appendChild(ga);
            });

            /* サブメニューは項目を包む入れ物側に持たせる（a の中に置くと入れ子リンクになる） */
            var holder = document.createElement('div');
            holder.className = 'bm-nav-submenu-wrap';
            ca.className += ' bm-nav-has-sub';
            holder.appendChild(ca);
            holder.appendChild(sub);
            colEl.appendChild(holder);
            return;
          }

          colEl.appendChild(ca);
        });
        mega.appendChild(colEl);
      });
      if (anyActive) a.className += ' active';
      wrapper.appendChild(mega);
      nav.appendChild(wrapper);
    } else if (item.children && item.children.length > 0) {
      // ドロップダウン
      var wrapper = document.createElement('div');
      wrapper.className = 'bm-nav-dropdown';

      var a = document.createElement('a');
      a.href = item.href;
      a.className = 'bm-nav-link bm-nav-dropdown-toggle';
      if (isCurrent(item.href)) a.className += ' active';
      a.setAttribute('data-ja', item.label);
      a.setAttribute('data-en', item.labelEn);
      a.textContent = currentLang === 'en' ? item.labelEn : item.label;

      var arrow = document.createElement('span');
      arrow.className = 'bm-nav-dropdown-arrow';
      arrow.textContent = '▾';
      a.appendChild(arrow);
      wrapper.appendChild(a);

      var sub = document.createElement('div');
      sub.className = 'bm-nav-dropdown-menu';
      var childActive = false;
      item.children.forEach(function(child) {
        var ca = document.createElement('a');
        ca.href = child.href;
        ca.className = 'bm-nav-dropdown-item';
        if (isCurrent(child.href)) { ca.className += ' active'; childActive = true; }
        ca.setAttribute('data-ja', child.label);
        ca.setAttribute('data-en', child.labelEn);
        ca.textContent = currentLang === 'en' ? child.labelEn : child.label;
        sub.appendChild(ca);
      });
      if (childActive) a.className += ' active';
      wrapper.appendChild(sub);
      nav.appendChild(wrapper);
    } else {
      var a = document.createElement('a');
      a.href = item.href;
      a.className = 'bm-nav-link';
      if (isCurrent(item.href)) a.className += ' active';
      a.setAttribute('data-ja', item.label);
      a.setAttribute('data-en', item.labelEn);
      a.textContent = currentLang === 'en' ? item.labelEn : item.label;
      nav.appendChild(a);
    }
  });

  // ===== モバイル専用CTA: LINE + 電話 (ハンバーガーメニューの末尾に追加) =====
  function buildSvg(pathD) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathD);
    svg.appendChild(p);
    return svg;
  }
  var PATH_LINE = 'M12 2C6.48 2 2 5.93 2 10.66c0 2.73 1.44 5.17 3.7 6.76-.13.47-.84 3.05-.87 3.26 0 0-.02.16.08.22s.21.02.21.02c.28-.04 3.24-2.12 3.75-2.48.96.14 1.95.22 2.96.22h.17c5.52 0 10-3.93 10-8.66S17.52 2 12 2z';
  var PATH_TEL = 'M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z';
  var mobileCtas = [
    { href: 'https://line.me/R/ti/p/@626kzaze?oat_content=url&ts=01071831', label: 'LINEで相談', labelEn: 'Chat on LINE', cls: 'bm-nav-mobile-cta bm-nav-mobile-cta--line', target: '_blank', pathD: PATH_LINE },
    { href: 'tel:03-6261-0764', label: '03-6261-0764 に電話', labelEn: 'Call 03-6261-0764', cls: 'bm-nav-mobile-cta bm-nav-mobile-cta--tel', pathD: PATH_TEL }
  ];
  mobileCtas.forEach(function(c) {
    var a = document.createElement('a');
    a.href = c.href;
    a.className = c.cls;
    if (c.target) { a.target = c.target; a.rel = 'noopener'; }
    a.appendChild(buildSvg(c.pathD));
    var span = document.createElement('span');
    span.setAttribute('data-ja', c.label);
    span.setAttribute('data-en', c.labelEn);
    span.textContent = currentLang === 'en' ? c.labelEn : c.label;
    a.appendChild(span);
    nav.appendChild(a);
  });

  // ===== 言語切替ボタンの挿入 =====
  var headerRight = document.querySelector('.bm-header-right');
  if (headerRight) {
    var existing = headerRight.querySelector('.bm-lang-switch');
    if (existing) existing.remove();

    var langSwitch = document.createElement('div');
    langSwitch.className = 'bm-lang-switch';
    langSwitch.id = 'bmLangSwitch';
    // 言語ボタンのラベルは絶対に翻訳しない（i18n辞書ヒットで幅が変わりレイアウト崩れ）
    langSwitch.innerHTML =
      '<button class="bm-lang-btn' + (currentLang === 'ja' ? ' active' : '') + '" data-lang="ja" data-i18n-skip>\u65E5\u672C\u8A9E</button>' +
      '<button class="bm-lang-btn' + (currentLang === 'en' ? ' active' : '') + '" data-lang="en" data-i18n-skip>EN</button>';

    // お問い合わせボタンの前に挿入
    var cta = headerRight.querySelector('.bm-nav-cta');
    if (cta) {
      headerRight.insertBefore(langSwitch, cta);
    } else {
      var hamburger = headerRight.querySelector('.bm-hamburger');
      if (hamburger) {
        headerRight.insertBefore(langSwitch, hamburger);
      } else {
        headerRight.appendChild(langSwitch);
      }
    }
  }

  // ===== 言語切替ロジック =====
  // bm-i18n.js が読み込まれていればそちらに委譲
  // bm-i18n.js は JSON辞書ベースの翻訳 + MutationObserver で動的DOM対応
  function switchLang(lang) {
    if (window.i18n && typeof window.i18n.switchLang === 'function') {
      // i18n システムに委譲（辞書翻訳 + data-ja/data-en + 自動検出すべて処理）
      window.i18n.switchLang(lang);
    } else {
      // フォールバック: i18n.js 未読み込み時は従来方式
      currentLang = lang;
      try { localStorage.setItem('bm-lang', lang); } catch(e) {}

      document.querySelectorAll('.bm-lang-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-lang') === lang);
      });

      document.querySelectorAll('[data-ja][data-en]').forEach(function(el) {
        var newText = lang === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-ja');
        var arrow = el.querySelector('.bm-nav-dropdown-arrow');
        if (arrow) {
          el.firstChild.textContent = newText;
        } else {
          el.textContent = newText;
        }
      });

      document.querySelectorAll('.bm-nav-cta').forEach(function(el) {
        el.textContent = lang === 'en' ? 'Contact' : 'お問い合わせ';
      });

      document.documentElement.lang = lang;
    }
  }

  // ボタンにイベント登録
  document.querySelectorAll('.bm-lang-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchLang(btn.getAttribute('data-lang'));
    });
  });

  // 初回: localStorageにENが保存されていればEN表示に切替
  if (currentLang === 'en') {
    // bm-i18n.js の init() が辞書ロード後に自動で EN 適用するので、
    // i18n が存在する場合は二重実行を避ける
    if (!window.i18n) {
      switchLang('en');
    }
  }

  // ===== ハンバーガーメニュー =====
  var hamburger = document.getElementById('bmHamburger');
  if (hamburger) {
    /* a11y初期属性 */
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-controls', 'bmNav');
    nav.setAttribute('aria-label', 'メインナビゲーション');

    var closeMenu = function() {
      nav.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.setAttribute('aria-label', 'メニューを開く');
      document.body.classList.remove('bm-nav-locked');
      nav.querySelectorAll('.bm-nav-dropdown.is-open').forEach(function(d) {
        d.classList.remove('is-open');
        var t = d.querySelector('.bm-nav-dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    };
    var bmToggleMenu = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      var willOpen = !nav.classList.contains('open');
      if (willOpen) {
        nav.classList.add('open');
        hamburger.classList.add('active');
        hamburger.classList.add('is-open');
        hamburger.setAttribute('aria-expanded', 'true');
        hamburger.setAttribute('aria-label', 'メニューを閉じる');
        document.body.classList.add('bm-nav-locked');
      } else {
        closeMenu();
      }
    };
    hamburger.addEventListener('click', bmToggleMenu);
    hamburger.addEventListener('touchend', function(e) { bmToggleMenu(e); }, { passive: false });
    /* ESC キーで閉じる */
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        closeMenu();
        hamburger.focus();
      }
    });
    /* PC: サブメニュークリック後、マウスが離れるまでドロップダウンを閉じたままにする */
    var dismissDesktopDropdown = function(dropdown) {
      if (!dropdown) return;
      dropdown.classList.add('bm-nav-dropdown-dismissed');
      var reset = function() {
        dropdown.classList.remove('bm-nav-dropdown-dismissed');
        dropdown.removeEventListener('mouseleave', reset);
      };
      dropdown.addEventListener('mouseleave', reset);
    };
    nav.querySelectorAll('.bm-nav-link:not(.bm-nav-dropdown-toggle)').forEach(function(link) {
      link.addEventListener('click', closeMenu);
    });
    nav.querySelectorAll('.bm-nav-dropdown-item').forEach(function(link) {
      link.addEventListener('click', function() {
        closeMenu();
        if (window.innerWidth > 768) {
          dismissDesktopDropdown(link.closest('.bm-nav-dropdown'));
        }
      });
    });
    /* ドロップダウン親: 1回目サブ開く、2回目遷移 + aria更新 */
    nav.querySelectorAll('.bm-nav-dropdown-toggle').forEach(function(toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-haspopup', 'true');
      toggle.addEventListener('click', function(e) {
        if (nav.classList.contains('open')) {
          var dd = this.closest('.bm-nav-dropdown');
          if (!dd.classList.contains('is-open')) {
            e.preventDefault();
            nav.querySelectorAll('.bm-nav-dropdown.is-open').forEach(function(other) {
              if (other !== dd) {
                other.classList.remove('is-open');
                var ot = other.querySelector('.bm-nav-dropdown-toggle');
                if (ot) ot.setAttribute('aria-expanded', 'false');
              }
            });
            dd.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
          }
        }
      });
    });
  }

  /* サブメニュー(第3階層)の開閉。
     :hover だけだと、項目からサブメニューへ斜めにカーソルを動かす途中で
     項目の下端を外れた瞬間に閉じてしまう（実測で移動の50%地点で消えた）。
     閉じる方を少し遅らせて、斜めの移動やわずかな行き過ぎを許容する。
     ⚠️ ドロワー(モバイル)では常時展開しておりホバーも無いので何もしない。 */
  nav.querySelectorAll('.bm-nav-submenu-wrap').forEach(function(wrap) {
    var closeTimer = null;
    var CLOSE_DELAY = 320;   /* 斜め移動に十分／意図して離れた時は気にならない程度 */

    var open = function() {
      if (nav.classList.contains('open')) return;   // ドロワー中は触らない
      clearTimeout(closeTimer);
      /* 他のサブメニューは閉じる（複数開きっぱなしを防ぐ）。
         ⚠️ ただし今カーソルがその判定域の中にいる場合は閉じない。
         項目の真下へ抜けると下の兄弟に入るが、そこで強制的に閉じると
         斜め移動でサブメニューへ辿り着けなくなるため（実測で確認） */
      nav.querySelectorAll('.bm-nav-submenu-wrap.is-sub-open').forEach(function(o) {
        if (o !== wrap && !o.__bmInZone) o.classList.remove('is-sub-open');
      });
      wrap.classList.add('is-sub-open');
    };
    var scheduleClose = function() {
      if (nav.classList.contains('open')) return;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(function() {
        wrap.classList.remove('is-sub-open');
        var mw = wrap.closest('.bm-nav-megamenu-wrap');
        if (mw) mw.classList.remove('is-mega-open');
      }, CLOSE_DELAY);
    };
    /* サブメニュー上に入ったら、予約されている「閉じる」を取り消す */
    var cancelClose = function() { clearTimeout(closeTimer); };

    wrap.addEventListener('mouseenter', open);

    /* 閉じる判定は座標で行う。
       wrap は項目1行ぶん(50px)しか無く、サブメニューは position:absolute で
       その外に出ているため、DOMの mouseleave だけだと項目を1px出た時点で
       「離れた」扱いになり、斜め移動の途中で閉じてしまう（実測で確認）。
       項目とサブメニューを内包する矩形＋余白の中にカーソルがある限り開いたままにする。 */
    var subEl = wrap.querySelector('.bm-nav-submenu');
    var PAD = 24;   /* 経路のブレを吸収する余白 */

    /* ① 項目・サブメニューの上にいるか（素直な矩形判定） */
    var overElements = function(x, y) {
      var boxes = [wrap.getBoundingClientRect()];
      if (subEl) boxes.push(subEl.getBoundingClientRect());
      return boxes.some(function(b) {
        return x >= b.left - PAD && x <= b.right + PAD &&
               y >= b.top - PAD && y <= b.bottom + PAD;
      });
    };

    /* ② サブメニューへ「向かっているか」を進行方向で判定する。
       Amazon のメガドロップダウンで使われている三角形（prediction cone）方式。
       現在位置とサブメニューの手前側の上下の角で三角形を作り、
       次の位置がその中にあれば「サブメニューへ向かっている」とみなして開いたままにする。
       斜め移動が途中で別の項目の上を通っても閉じないのはこのため。
       参考: https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown */
    var headingToSub = function(prevX, prevY, x, y) {
      if (!subEl) return false;
      var s = subEl.getBoundingClientRect();
      if (s.width === 0) return false;

      /* サブメニューが右に出るか左に出るかで、手前側の辺が変わる */
      var toRight = s.left >= wrap.getBoundingClientRect().right - 1;
      var edgeX = toRight ? s.left : s.right;
      var apexTop = { x: edgeX, y: s.top - PAD };
      var apexBottom = { x: edgeX, y: s.bottom + PAD };

      /* 進行方向が逆（サブメニューから遠ざかる）なら判定しない */
      if (toRight && x < prevX - 1) return false;
      if (!toRight && x > prevX + 1) return false;

      var sign = function(ax, ay, bx, by, cx, cy) {
        return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
      };
      var d1 = sign(x, y, prevX, prevY, apexTop.x, apexTop.y);
      var d2 = sign(x, y, apexTop.x, apexTop.y, apexBottom.x, apexBottom.y);
      var d3 = sign(x, y, apexBottom.x, apexBottom.y, prevX, prevY);
      var hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
      var hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
      return !(hasNeg && hasPos);   /* 全て同じ符号＝三角形の内側 */
    };

    var lastX = null, lastY = null;
    var insideZone = function(x, y) {
      var ok = overElements(x, y) || headingToSub(lastX == null ? x : lastX, lastY == null ? y : lastY, x, y);
      lastX = x; lastY = y;
      return ok;
    };

    /* サブメニューが開いている間は、親のメガメニューも開いたままにする。
       ⚠️ メガメニューは max-height + overflow:hidden でアニメーションしており、
       カーソルがメガメニュー本体から離れると縮んで、中にあるサブメニューごと
       切り取られてしまう（実測: 下側5件がクリック不能、うち1件は誤遷移した）。 */
    var megaWrap = wrap.closest('.bm-nav-megamenu-wrap');

    var onMove = function(e) {
      if (!wrap.classList.contains('is-sub-open')) {
        wrap.__bmInZone = false;
        /* サブメニューが閉じたら、保持していたメガメニューも解放する。
           ここで外さないと、離れてもメガメニューが開きっぱなしになる */
        if (megaWrap && megaWrap.classList.contains('is-mega-open') &&
            !megaWrap.matches(':hover')) {
          megaWrap.classList.remove('is-mega-open');
        }
        return;
      }
      var inside = insideZone(e.clientX, e.clientY);
      wrap.__bmInZone = inside;   /* 他の項目の open() から参照される */
      if (inside) {
        cancelClose();
        if (megaWrap) megaWrap.classList.add('is-mega-open');
      } else {
        scheduleClose();
        if (megaWrap) megaWrap.classList.remove('is-mega-open');
      }
    };
    document.addEventListener('mousemove', onMove);

    if (subEl) {
      subEl.addEventListener('mouseenter', cancelClose);
    }
    /* キーボード操作でも開けるように */
    wrap.addEventListener('focusin', open);
    wrap.addEventListener('focusout', scheduleClose);
  });

  /* メガメニュー自体を離れたらサブメニューも畳む（開いたまま残らないように） */
  /* メガメニュー(ビズ書庫/サービス)の開閉。
     CSSの :hover だけだと、カーソルが少し外れた瞬間に閉じ始めてしまい
     （実測: 外して60msで3分の1まで消えていた）、狙って動かさないと使えない。
     mouseenter で is-mega-open を付け、離れてから MEGA_CLOSE_DELAY だけ待って外す。
     ⚠️ ドロワー(モバイル)はアコーディオン方式なので触らない。 */
  /* CSS側の消えるアニメーション(0.45s)と合わせて体感を作る。
     待機を長くしすぎると「閉じない」と感じるので、待機は短め・
     フェードを長めにして、カードへ手を伸ばす時間を確保する。 */
  var MEGA_CLOSE_DELAY = 160;

  nav.querySelectorAll('.bm-nav-megamenu-wrap').forEach(function(mw) {
    var megaTimer = null;

    mw.addEventListener('mouseenter', function() {
      if (nav.classList.contains('open')) return;
      clearTimeout(megaTimer);
      mw.classList.add('is-mega-open');
    });

    mw.addEventListener('mouseleave', function() {
      if (nav.classList.contains('open')) return;
      clearTimeout(megaTimer);
      megaTimer = setTimeout(function() {
        /* 戻ってきていたら閉じない。サブメニュー上に残っている場合も同様（誤爆防止） */
        var subHovered = !!mw.querySelector('.bm-nav-submenu:hover');
        if (mw.matches(':hover') || subHovered) return;

        mw.querySelectorAll('.bm-nav-submenu-wrap.is-sub-open').forEach(function(o) {
          o.classList.remove('is-sub-open');
          o.__bmInZone = false;
        });
        mw.classList.remove('is-mega-open');
      }, MEGA_CLOSE_DELAY);
    });
  });

  // ===== TOPに戻るボタン（フルスクリーンheroがあるページのみ） =====
  var hasFullHero = document.querySelector('.str-hero, .uc-hero, .mt-hero');
  if (hasFullHero) {
    var topBtn = document.createElement('button');
    topBtn.className = 'bm-back-to-top';
    topBtn.setAttribute('aria-label', 'TOPに戻る');
    topBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3L3 9.5M9 3l6 6.5M9 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>TOP</span>';
    document.body.appendChild(topBtn);

    topBtn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', function() {
      if (window.scrollY > 400) {
        topBtn.classList.add('visible');
      } else {
        topBtn.classList.remove('visible');
      }
    }, { passive: true });
  }

  // ===== 追従CTA（LINE + お問い合わせ）— contact.html / biz-library.html 以外 =====
  if (currentFile !== 'contact' && currentFile !== 'biz-library') {
    var svgNS = 'http://www.w3.org/2000/svg';
    function buildFabBtn(opts) {
      var a = document.createElement('a');
      a.className = 'bm-fab__btn ' + opts.cls;
      a.href = opts.href;
      a.setAttribute('aria-label', opts.labelJa);
      a.setAttribute('data-tooltip', opts.labelJa);
      if (opts.external) { a.target = '_blank'; a.rel = 'noopener'; }

      var wrap = document.createElement('span');
      wrap.className = 'bm-fab__wrap';

      var textBox = document.createElement('span');
      textBox.className = 'bm-fab__text';
      textBox.setAttribute('data-ja', opts.labelJa);
      textBox.setAttribute('data-en', opts.labelEn);
      textBox.textContent = opts.labelJa;
      wrap.appendChild(textBox);

      var iconBox = document.createElement('span');
      iconBox.className = 'bm-fab__icon-box';
      var svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'bm-fab__icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      if (opts.iconFill) {
        svg.setAttribute('fill', 'currentColor');
      } else {
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
      }
      opts.paths.forEach(function(p) {
        var el = document.createElementNS(svgNS, p.tag);
        Object.keys(p.attrs).forEach(function(k) { el.setAttribute(k, p.attrs[k]); });
        svg.appendChild(el);
      });
      iconBox.appendChild(svg);
      wrap.appendChild(iconBox);

      a.appendChild(wrap);
      return a;
    }

    var fab = document.createElement('div');
    fab.className = 'bm-fab';
    fab.appendChild(buildFabBtn({
      cls: 'bm-fab__btn--line',
      href: 'https://line.me/R/ti/p/@626kzaze?oat_content=url&ts=01071831',
      external: true,
      labelJa: 'LINEで相談',
      labelEn: 'Chat on LINE',
      iconFill: true,
      paths: [{ tag: 'path', attrs: { d: 'M12 2C6.48 2 2 5.58 2 10c0 2.83 1.85 5.3 4.65 6.71-.2.72-.74 2.7-.85 3.12-.14.52.19.51.4.37.16-.11 2.57-1.75 3.61-2.46.72.1 1.45.16 2.19.16 5.52 0 10-3.58 10-8S17.52 2 12 2zM7.4 12.6h-1.9c-.1 0-.2-.1-.2-.2V8.6c0-.1.1-.2.2-.2h.3c.1 0 .2.1.2.2v3.2h1.4c.1 0 .2.1.2.2v.4c0 .1-.1.2-.2.2zm1.6-.2c0 .1-.1.2-.2.2h-.3c-.1 0-.2-.1-.2-.2V8.6c0-.1.1-.2.2-.2h.3c.1 0 .2.1.2.2v3.8zm4.3 0c0 .1-.1.2-.2.2h-.3c-.06 0-.12-.03-.16-.08l-1.85-2.5v2.38c0 .1-.1.2-.2.2h-.3c-.1 0-.2-.1-.2-.2V8.6c0-.1.1-.2.2-.2h.3c.06 0 .11.03.15.07l1.86 2.51V8.6c0-.1.1-.2.2-.2h.3c.1 0 .2.1.2.2v3.8zm3-3.2h-1.4v.8h1.4c.1 0 .2.1.2.2v.4c0 .1-.1.2-.2.2h-1.4v.8h1.4c.1 0 .2.1.2.2v.4c0 .1-.1.2-.2.2h-1.9c-.1 0-.2-.1-.2-.2V8.6c0-.1.1-.2.2-.2h1.9c.1 0 .2.1.2.2v.4c0 .1-.1.2-.2.2z' } }]
    }));
    fab.appendChild(buildFabBtn({
      cls: 'bm-fab__btn--contact',
      href: '/contact',
      labelJa: 'お問い合わせ',
      labelEn: 'Contact',
      iconFill: false,
      paths: [
        { tag: 'path', attrs: { d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' } },
        { tag: 'polyline', attrs: { points: '22,6 12,13 2,6' } }
      ]
    }));
    fab.appendChild(buildFabBtn({
      cls: 'bm-fab__btn--tel',
      href: 'tel:03-6261-0764',
      labelJa: '電話で相談',
      labelEn: 'Call us',
      iconFill: true,
      paths: [{ tag: 'path', attrs: { d: 'M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z' } }]
    }));
    document.body.appendChild(fab);
    if (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en' && window.i18n.translateAll) {
      window.i18n.translateAll();
    }
  }

  // グローバルに公開
  window.bmSwitchLang = switchLang;
})();

/* =====================================================================
 * Google広告 コンバージョン「LINEお問い合わせ」（2026-09-03 / Issue #27）
 * ---------------------------------------------------------------------
 * サイト内の「LINEで相談」リンク（ヘッダー丸アイコン・ハンバーガー末尾・
 * 追従FAB・共通CTA(bm-cta.js)・LP内ボタン・制作事例カテゴリ）は全て同じ
 * LINE公式アカウントURLを指すので、個別に onclick を付けず document で
 * クリックを委譲して拾う。静的HTML／このファイルや bm-cta.js が生成する
 * CTA／build-columns・build-works が今後生成するページ、全て自動で対象。
 *
 * Google発行スニペット gtag_report_conversion は原文どおり公開しておく。
 * ただし LINE リンクは target="_blank" で元ページが残るため、Google例の
 * 「遷移を止めて event_callback で window.location」は使わない
 * （新規タブがポップアップブロックに掛かる／return false で遷移しなくなる）。
 * クリック時に event だけ送り、遷移はブラウザ標準に任せる。
 *
 * ⚠️ ラベルは Google広告管理画面「タグを設定する」の send_to をコピペした値。
 *    l(エル)/I(アイ)/1(イチ) の取り違えで計測が死ぬ（BUGS #025）。手入力しない。
 * ⚠️ 上の main IIFE は #bmNav が無いページで早期 return するので、ここは独立させる。
 * ⚠️ capture 段階で拾う: メニュー側の stopPropagation に巻き込まれないため。
 * ===================================================================== */
(function () {
  var SEND_TO = 'AW-18108125426/LX7_CMndmO0cEPKh0LpD';
  // 「LINEで相談」= LINE公式アカウントURL。シェアボタン(social-plugins.line.me)は対象外
  var LINE_SELECTOR = 'a[href*="line.me/R/ti/p/"]';

  function gtag_report_conversion(url) {
    var callback = function () {
      if (typeof(url) != 'undefined') {
        window.location = url;
      }
    };
    if (typeof gtag !== 'function') { callback(); return false; }
    gtag('event', 'conversion', {
      'send_to': SEND_TO,
      'event_callback': callback
    });
    return false;
  }
  window.gtag_report_conversion = gtag_report_conversion;

  document.addEventListener('click', function (e) {
    var t = e.target;
    var a = (t && typeof t.closest === 'function') ? t.closest(LINE_SELECTOR) : null;
    if (!a) return;
    // url を渡さない = event_callback は何もしない。新規タブへの遷移はブラウザに任せる
    gtag_report_conversion();
  }, true);
})();
