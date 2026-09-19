/**
 * BizManga 共通ナビゲーション（ContentsXと同じUI）
 * 全ページで共通メニューを統一する。
 */
(function() {
  // 廃止した言語設定を消去し、既存訪問者も日本語表示にする。
  try { localStorage.removeItem('bm-lang'); } catch (e) {}

  var NAV_ITEMS = [
    { label: 'ホーム',       href: '/' },
    /* ビズ書庫＝実物を読む場所、制作事例＝実績を見る場所。どちらも「作った漫画を見る」
       入口なので、ビズ書庫のメガメニューに制作事例をまとめている（2026-08-30）。
       独立していた「制作事例」項目はここへ統合したため削除した（入口の二重化を避ける） */
    { label: 'ビズ書庫',    href: '/biz-library', mega: true, columns: [
      {
        heading: '漫画を読む',
        items: [
          { label: 'ビズ書庫（全作品）', href: '/biz-library' },
          /* children を持つ項目はホバーで右側にサブメニューが開く（第3階層） */
          { label: '制作事例（一覧）', href: '/works', children: [
            { label: '採用マンガ',  href: '/works/category/recruit' },
            { label: '営業マンガ',    href: '/works/category/sales' },
            { label: '商品紹介マンガ',  href: '/works/category/product' },
            { label: '会社紹介マンガ',  href: '/works/category/company' },
            { label: '研修マンガ', href: '/works/category/training' },
            { label: 'マンガ広告', href: '/works/category/ad' },
            { label: 'IR漫画',       href: '/works/category/ir' }
          ]}
        ]
      }
    ]},
    { label: '漫画家紹介',    href: '/artists' },
    { label: 'ビズアニメ',  href: '/bizanime' },
    { label: 'サービス',   href: '/product-manga', mega: true, columns: [
      {
        heading: 'マーケ・広報部門向け',
        items: [
          { label: '商品紹介マンガ',   href: '/product-manga' },
          { label: 'マンガ広告',        href: '/manga-ad-lp' },
          { label: 'インバウンド漫画',   href: '/inbound-manga' },
          { label: '会社紹介マンガ',   href: '/company-manga' }
        ]
      },
      {
        heading: '人事・営業部門向け',
        items: [
          { label: '採用マンガ',   href: '/recruit-manga' },
          { label: '営業資料マンガ',     href: '/sales-manga' },
          { label: '研修マンガ',  href: '/training-manga' },
          { label: 'IR・周年史マンガ',        href: '/ir-manga' }
        ]
      },
      {
        heading: 'ビズマンガを知る',
        items: [
          { label: '漫画制作会社 比較', href: '/manga-production-company' },
          { label: '強み',       href: '/strength' },
          { label: 'マンガの種類',     href: '/manga-types' },
          { label: '活用場面',       href: '/use-cases' }
        ]
      }
    ]},
    { label: '料金',    href: '/pricing' },
    { label: 'コラム',     href: '/column' },
    { label: 'FAQ',        href: '/faq' }
  ];

  var path = location.pathname;
  var currentFile = path.substring(path.lastIndexOf('/') + 1).replace('.html', '') || 'index';

  // hrefとcurrentFileを正規化して比較する関数（先頭/とindex/末尾スラッシュの差を吸収）
  function isCurrent(href) {
    if (!href) return false;
    var normalizedHref = href.replace(/^\//, '').replace(/\.html$/, '').replace(/\/$/, '') || 'index';
    return normalizedHref === currentFile;
  }


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
      a.textContent = item.label;

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
        h.textContent = col.heading;
        colEl.appendChild(h);

        col.items.forEach(function(child) {
          var ca = document.createElement('a');
          ca.href = child.href;
          ca.className = 'bm-nav-dropdown-item bm-nav-megamenu-item';
          if (isCurrent(child.href)) { ca.className += ' active'; anyActive = true; }
          ca.textContent = child.label;

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
              ga.textContent = gc.label;
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
      a.textContent = item.label;

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
        ca.textContent = child.label;
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
      a.textContent = item.label;
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
    { href: 'https://line.me/R/ti/p/@626kzaze?oat_content=url&ts=01071831', label: 'LINEで相談', cls: 'bm-nav-mobile-cta bm-nav-mobile-cta--line', target: '_blank', pathD: PATH_LINE },
    { href: 'tel:03-6261-0764', label: '03-6261-0764 に電話', cls: 'bm-nav-mobile-cta bm-nav-mobile-cta--tel', pathD: PATH_TEL }
  ];
  mobileCtas.forEach(function(c) {
    var a = document.createElement('a');
    a.href = c.href;
    a.className = c.cls;
    if (c.target) { a.target = c.target; a.rel = 'noopener'; }
    a.appendChild(buildSvg(c.pathD));
    var span = document.createElement('span');
    span.textContent = c.label;
    a.appendChild(span);
    nav.appendChild(a);
  });

  // ===== ハンバーガーメニュー =====
  var hamburger = document.getElementById('bmHamburger');
  var header = nav.closest('.bm-header');
  var drawerMedia = window.matchMedia('(max-width: 1024px)');

  function updateDropdownAria(dropdown) {
    var toggle = dropdown.querySelector('.bm-nav-dropdown-toggle');
    if (!toggle) return;
    var expanded = !dropdown.classList.contains('bm-nav-dropdown-dismissed') &&
      (dropdown.classList.contains('is-open') || (!drawerMedia.matches &&
      (dropdown.classList.contains('is-mega-open') || dropdown.matches(':focus-within'))));
    toggle.setAttribute('aria-expanded', String(expanded));
  }

  function clearDismissed(dropdown) {
    dropdown.classList.remove('bm-nav-dropdown-dismissed');
    if (dropdown.__bmDismissCleanup) dropdown.__bmDismissCleanup();
  }

  function resetDropdown(dropdown) {
    clearDismissed(dropdown);
    if (dropdown.__bmCancelClose) dropdown.__bmCancelClose();
    dropdown.classList.remove('is-open', 'is-mega-open');
    dropdown.querySelectorAll('.bm-nav-submenu-wrap').forEach(function(wrap) {
      if (wrap.__bmCloseSubmenu) wrap.__bmCloseSubmenu();
    });
    dropdown.querySelectorAll('[aria-expanded]').forEach(function(toggle) {
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  if (hamburger) {
    var lastPointerType = '';
    var navigationFocus = null;
    nav.addEventListener('pointerdown', function(e) { lastPointerType = e.pointerType; });
    var isTouchClick = function(e) {
      return e.pointerType === 'touch' || e.pointerType === 'pen' ||
        (e.detail !== 0 && (lastPointerType === 'touch' || lastPointerType === 'pen'));
    };
    var inertBackground = new Map();
    var isolateDrawer = function() {
      for (var branch = header; branch && branch !== document.body; branch = branch.parentElement) {
        Array.prototype.forEach.call(branch.parentElement.children, function(el) {
          if (el === branch || /^(SCRIPT|STYLE|LINK)$/.test(el.tagName) || inertBackground.has(el)) return;
          inertBackground.set(el, el.hasAttribute('inert'));
          el.setAttribute('inert', '');
        });
      }
    };
    var backgroundObserver = new MutationObserver(function() {
      if (nav.classList.contains('open')) isolateDrawer();
    });
    var restoreBackground = function() {
      backgroundObserver.disconnect();
      inertBackground.forEach(function(wasInert, el) {
        if (!wasInert) el.removeAttribute('inert');
      });
      inertBackground.clear();
    };
    var drawerFocusables = function() {
      return Array.prototype.filter.call(header.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'), function(el) {
        if (el.closest('[inert]')) return false;
        for (var a = el; a && a !== header.parentElement; a = a.parentElement) {
          var style = getComputedStyle(a);
          if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
        }
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    };
    var focusWithoutScroll = function(el) { if (el) el.focus({ preventScroll: true }); };
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
      restoreBackground();
      nav.querySelectorAll('.bm-nav-dropdown').forEach(resetDropdown);
    };
    drawerMedia.addEventListener('change', function() {
      // A browser can blur a link as soon as the new media rule hides it,
      // before this change event is delivered. Retain that hidden focus target.
      var moveFocus = nav.contains(document.activeElement) || document.activeElement === hamburger ||
        (document.activeElement === document.body && navigationFocus);
      closeMenu();
      if (moveFocus) {
        focusWithoutScroll(drawerMedia.matches ? hamburger : nav.querySelector('.bm-nav-link:not(.bm-nav-dropdown-toggle)'));
      }
    });
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
        isolateDrawer();
        backgroundObserver.observe(document.body, { childList: true, subtree: true });
        nav.scrollTop = 0;
        focusWithoutScroll(nav.querySelector('.bm-nav-link'));
      } else {
        closeMenu();
      }
    };
    hamburger.addEventListener('click', bmToggleMenu);
    hamburger.addEventListener('touchend', function(e) { bmToggleMenu(e); }, { passive: false });
    /* ESC キーで閉じる */
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Tab' && nav.classList.contains('open')) {
        var focusables = drawerFocusables();
        var index = focusables.indexOf(document.activeElement);
        var next = e.shiftKey ? (index <= 0 ? focusables.length - 1 : index - 1) : (index + 1) % focusables.length;
        e.preventDefault();
        focusWithoutScroll(focusables[next] || hamburger);
        return;
      }
      if (e.key === 'Escape' && (nav.classList.contains('open') || nav.querySelector('.is-open, .is-mega-open, .bm-nav-dropdown:focus-within'))) {
        var dropdown = nav.querySelector('.bm-nav-dropdown:focus-within, .bm-nav-dropdown.is-open, .bm-nav-dropdown.is-mega-open');
        var opener = dropdown && dropdown.querySelector('.bm-nav-dropdown-toggle');
        closeMenu();
        if (drawerMedia.matches) hamburger.focus();
        else if (opener) {
          opener.focus();
          dismissDesktopDropdown(dropdown);
        }
      }
    });
    document.addEventListener('focusin', function(e) {
      navigationFocus = nav.contains(e.target) || e.target === hamburger ? e.target : null;
      if (!nav.classList.contains('open')) return;
      if (!header.contains(e.target)) {
        focusWithoutScroll(nav.querySelector('.bm-nav-link'));
      } else if (nav.contains(e.target)) {
        var box = e.target.getBoundingClientRect();
        var viewport = nav.getBoundingClientRect();
        if (box.top < viewport.top + 4) nav.scrollTop -= viewport.top + 4 - box.top;
        else if (box.bottom > viewport.bottom - 4) nav.scrollTop += box.bottom - viewport.bottom + 4;
      }
    });
    document.addEventListener('focusout', function(e) {
      if (e.target === navigationFocus && (e.relatedTarget || e.target.getClientRects().length)) navigationFocus = null;
    });
    /* PC: サブメニュークリック後、マウスが離れるまでドロップダウンを閉じたままにする */
    var dismissDesktopDropdown = function(dropdown) {
      if (!dropdown) return;
      clearDismissed(dropdown);
      dropdown.classList.add('bm-nav-dropdown-dismissed');
      updateDropdownAria(dropdown);
      var reset = function(e) {
        if (e.type === 'focusout' && dropdown.contains(e.relatedTarget)) return;
        if (e.type === 'mouseleave' && dropdown.contains(document.activeElement)) return;
        clearDismissed(dropdown);
        updateDropdownAria(dropdown);
      };
      dropdown.__bmDismissCleanup = function() {
        dropdown.removeEventListener('mouseenter', reset);
        dropdown.removeEventListener('mouseleave', reset);
        dropdown.removeEventListener('focusout', reset);
        dropdown.__bmDismissCleanup = null;
      };
      dropdown.addEventListener('mouseenter', reset);
      dropdown.addEventListener('mouseleave', reset);
      dropdown.addEventListener('focusout', reset);
    };
    nav.querySelectorAll('.bm-nav-link:not(.bm-nav-dropdown-toggle)').forEach(function(link) {
      link.addEventListener('click', closeMenu);
    });
    nav.querySelectorAll('.bm-nav-dropdown-item').forEach(function(link) {
      link.addEventListener('click', function(e) {
        var wrap = link.closest('.bm-nav-submenu-wrap');
        if (!drawerMedia.matches && link.classList.contains('bm-nav-has-sub') && isTouchClick(e) &&
            !wrap.classList.contains('is-touch-open')) {
          e.preventDefault();
          wrap.classList.add('is-touch-open');
          wrap.__bmOpenSubmenu();
          return;
        }
        closeMenu();
        if (!drawerMedia.matches) {
          dismissDesktopDropdown(link.closest('.bm-nav-dropdown'));
        }
      });
    });
    /* ドロップダウン親: 1回目サブ開く、2回目遷移 + aria更新 */
    nav.querySelectorAll('.bm-nav-dropdown-toggle').forEach(function(toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-haspopup', 'true');
      toggle.addEventListener('click', function(e) {
        clearDismissed(this.closest('.bm-nav-dropdown'));
        if (nav.classList.contains('open') || isTouchClick(e)) {
          var dd = this.closest('.bm-nav-dropdown');
          if (!dd.classList.contains('is-open')) {
            e.preventDefault();
            nav.querySelectorAll('.bm-nav-dropdown.is-open').forEach(function(other) {
              if (other !== dd) {
                resetDropdown(other);
              }
            });
            dd.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            if (drawerMedia.matches) dd.querySelectorAll('.bm-nav-has-sub').forEach(function(link) {
              link.setAttribute('aria-expanded', 'true');
            });
          }
        }
      });
    });
    document.addEventListener('pointerdown', function(e) {
      if (!drawerMedia.matches && !nav.contains(e.target)) closeMenu();
    });
  }

  /* サブメニュー(第3階層)の開閉。
     :hover だけだと、項目からサブメニューへ斜めにカーソルを動かす途中で
     項目の下端を外れた瞬間に閉じてしまう（実測で移動の50%地点で消えた）。
     閉じる方を少し遅らせて、斜めの移動やわずかな行き過ぎを許容する。
     ⚠️ ドロワー(モバイル)では常時展開しておりホバーも無いので何もしない。 */
  nav.querySelectorAll('.bm-nav-submenu-wrap').forEach(function(wrap, index) {
    var closeTimer = null;
    var subEl = wrap.querySelector('.bm-nav-submenu');
    var subToggle = wrap.querySelector('.bm-nav-has-sub');
    subEl.id = 'bmNavSubmenu' + index;
    subToggle.setAttribute('aria-controls', subEl.id);
    subToggle.setAttribute('aria-haspopup', 'true');
    subToggle.setAttribute('aria-expanded', 'false');

    // Place the flyout inside the actual viewport, including short landscape windows.
    var positionSubmenu = function() {
      if (drawerMedia.matches) return;
      var margin = 8;
      var topLimit = header.getBoundingClientRect().bottom + margin;
      subEl.style.maxHeight = Math.max(0, window.innerHeight - topLimit - margin) + 'px';
      var anchor = wrap.getBoundingClientRect();
      var box = subEl.getBoundingClientRect();
      var left = anchor.right;
      if (left + box.width > window.innerWidth - margin) left = anchor.left - box.width;
      left = Math.max(margin, Math.min(left, window.innerWidth - box.width - margin));
      var top = Math.max(topLimit, Math.min(anchor.top - 8, window.innerHeight - box.height - margin));
      subEl.style.left = (left - anchor.left) + 'px';
      subEl.style.right = 'auto';
      subEl.style.top = (top - anchor.top) + 'px';
    };
    var close = function() {
      clearTimeout(closeTimer);
      wrap.classList.remove('is-sub-open', 'is-touch-open');
      wrap.__bmInZone = false;
      subToggle.setAttribute('aria-expanded', 'false');
      ['left', 'right', 'top', 'max-height'].forEach(function(prop) { subEl.style.removeProperty(prop); });
    };
    var CLOSE_DELAY = 320;   /* 斜め移動に十分／意図して離れた時は気にならない程度 */

    var open = function() {
      if (drawerMedia.matches) return;   // ドロワー幅ではホバーで開かない
      clearTimeout(closeTimer);
      /* 他のサブメニューは閉じる（複数開きっぱなしを防ぐ）。
         ⚠️ ただし今カーソルがその判定域の中にいる場合は閉じない。
         項目の真下へ抜けると下の兄弟に入るが、そこで強制的に閉じると
         斜め移動でサブメニューへ辿り着けなくなるため（実測で確認） */
      nav.querySelectorAll('.bm-nav-submenu-wrap.is-sub-open').forEach(function(o) {
        if (o !== wrap && !o.__bmInZone) o.__bmCloseSubmenu();
      });
      wrap.classList.add('is-sub-open');
      subToggle.setAttribute('aria-expanded', 'true');
      positionSubmenu();
    };
    var scheduleClose = function() {
      if (drawerMedia.matches) return;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(function() {
        if (wrap.contains(document.activeElement)) return;
        close();
        var mw = wrap.closest('.bm-nav-megamenu-wrap');
        if (mw) {
          mw.classList.remove('is-mega-open');
          updateDropdownAria(mw);
        }
      }, CLOSE_DELAY);
    };
    wrap.__bmOpenSubmenu = open;
    wrap.__bmCloseSubmenu = close;
    window.addEventListener('resize', function() {
      if (wrap.classList.contains('is-sub-open')) positionSubmenu();
    });
    /* サブメニュー上に入ったら、予約されている「閉じる」を取り消す */
    var cancelClose = function() { clearTimeout(closeTimer); };

    wrap.addEventListener('mouseenter', open);

    /* 閉じる判定は座標で行う。
       wrap は項目1行ぶん(50px)しか無く、サブメニューは position:absolute で
       その外に出ているため、DOMの mouseleave だけだと項目を1px出た時点で
       「離れた」扱いになり、斜め移動の途中で閉じてしまう（実測で確認）。
       項目とサブメニューを内包する矩形＋余白の中にカーソルがある限り開いたままにする。 */
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
    if (megaWrap) megaWrap.addEventListener('transitionend', function(e) {
      if (e.target.classList.contains('bm-nav-megamenu') && wrap.classList.contains('is-sub-open')) positionSubmenu();
    });

    var onMove = function(e) {
      if (!wrap.classList.contains('is-sub-open')) {
        wrap.__bmInZone = false;
        /* サブメニューが閉じたら、保持していたメガメニューも解放する。
           ここで外さないと、離れてもメガメニューが開きっぱなしになる */
        if (megaWrap && megaWrap.classList.contains('is-mega-open') &&
            !megaWrap.matches(':hover')) {
          megaWrap.classList.remove('is-mega-open');
          updateDropdownAria(megaWrap);
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
      if (megaWrap) updateDropdownAria(megaWrap);
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
    mw.__bmCancelClose = function() { clearTimeout(megaTimer); };

    mw.addEventListener('focusin', function(e) {
      if (!e.target.classList.contains('bm-nav-dropdown-toggle')) clearDismissed(mw);
      updateDropdownAria(mw);
    });
    mw.addEventListener('focusout', function() {
      setTimeout(function() { updateDropdownAria(mw); }, 0);
    });

    mw.addEventListener('mouseenter', function() {
      if (drawerMedia.matches) return;
      clearDismissed(mw);
      clearTimeout(megaTimer);
      mw.classList.add('is-mega-open');
      updateDropdownAria(mw);
    });

    mw.addEventListener('mouseleave', function() {
      if (drawerMedia.matches) return;
      clearTimeout(megaTimer);
      megaTimer = setTimeout(function() {
        /* 戻ってきていたら閉じない。サブメニュー上に残っている場合も同様（誤爆防止） */
        var subHovered = !!mw.querySelector('.bm-nav-submenu:hover');
        if (mw.matches(':hover') || subHovered || mw.contains(document.activeElement)) return;

        mw.querySelectorAll('.bm-nav-submenu-wrap.is-sub-open').forEach(function(o) {
          o.__bmCloseSubmenu();
        });
        mw.classList.remove('is-mega-open');
        updateDropdownAria(mw);
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
      a.setAttribute('aria-label', opts.label);
      a.setAttribute('data-tooltip', opts.label);
      if (opts.external) { a.target = '_blank'; a.rel = 'noopener'; }

      var wrap = document.createElement('span');
      wrap.className = 'bm-fab__wrap';

      var textBox = document.createElement('span');
      textBox.className = 'bm-fab__text';
      textBox.textContent = opts.label;
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
      label: 'LINEで相談',
      iconFill: true,
      paths: [{ tag: 'path', attrs: { d: 'M12 2C6.48 2 2 5.58 2 10c0 2.83 1.85 5.3 4.65 6.71-.2.72-.74 2.7-.85 3.12-.14.52.19.51.4.37.16-.11 2.57-1.75 3.61-2.46.72.1 1.45.16 2.19.16 5.52 0 10-3.58 10-8S17.52 2 12 2zM7.4 12.6h-1.9c-.1 0-.2-.1-.2-.2V8.6c0-.1.1-.2.2-.2h.3c.1 0 .2.1.2.2v3.2h1.4c.1 0 .2.1.2.2v.4c0 .1-.1.2-.2.2zm1.6-.2c0 .1-.1.2-.2.2h-.3c-.1 0-.2-.1-.2-.2V8.6c0-.1.1-.2.2-.2h.3c.1 0 .2.1.2.2v3.8zm4.3 0c0 .1-.1.2-.2.2h-.3c-.06 0-.12-.03-.16-.08l-1.85-2.5v2.38c0 .1-.1.2-.2.2h-.3c-.1 0-.2-.1-.2-.2V8.6c0-.1.1-.2.2-.2h.3c.06 0 .11.03.15.07l1.86 2.51V8.6c0-.1.1-.2.2-.2h.3c.1 0 .2.1.2.2v3.8zm3-3.2h-1.4v.8h1.4c.1 0 .2.1.2.2v.4c0 .1-.1.2-.2.2h-1.4v.8h1.4c.1 0 .2.1.2.2v.4c0 .1-.1.2-.2.2h-1.9c-.1 0-.2-.1-.2-.2V8.6c0-.1.1-.2.2-.2h1.9c.1 0 .2.1.2.2v.4c0 .1-.1.2-.2.2z' } }]
    }));
    fab.appendChild(buildFabBtn({
      cls: 'bm-fab__btn--contact',
      href: '/contact',
      label: 'お問い合わせ',
      iconFill: false,
      paths: [
        { tag: 'path', attrs: { d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' } },
        { tag: 'polyline', attrs: { points: '22,6 12,13 2,6' } }
      ]
    }));
    fab.appendChild(buildFabBtn({
      cls: 'bm-fab__btn--tel',
      href: 'tel:03-6261-0764',
      label: '電話で相談',
      iconFill: true,
      paths: [{ tag: 'path', attrs: { d: 'M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z' } }]
    }));
    document.body.appendChild(fab);
  }

})();

/* =====================================================================
 * Google広告 コンバージョン「LINEお問い合わせ」「電話お問い合わせ」
 * （2026-09-03 / Issue #27）
 * ---------------------------------------------------------------------
 * サイト内の「LINEで相談」「電話」リンク（ヘッダー丸アイコン・ハンバーガー末尾・
 * 追従FAB・共通CTA(bm-cta.js)・LP内ボタン・制作事例カテゴリ）は全て同じ
 * LINE公式URL／同じ電話番号を指すので、個別に onclick を付けず document で
 * クリックを委譲して拾う。静的HTML／このファイルや bm-cta.js が生成する
 * CTA／build-columns・build-works が今後生成するページ、全て自動で対象。
 *
 * Google発行スニペット（gtag_report_conversion）は「遷移を止めて
 * event_callback で window.location」する作りだが、LINE は target="_blank"、
 * 電話は tel: で元ページが残るため、その方式は使わない（新規タブがポップアップ
 * ブロックに掛かる／return false で遷移しなくなる）。
 * クリック時に event だけ送り、遷移はブラウザ標準に任せる。
 *
 * ⚠️ ラベルは Google広告管理画面「タグを設定する」の send_to をコピペした値。
 *    l(エル)/I(アイ)/1(イチ) の取り違えで計測が死ぬ（BUGS #025）。手入力しない。
 * ⚠️ 上の main IIFE は #bmNav が無いページで早期 return するので、ここは独立させる。
 * ⚠️ capture 段階で拾う: メニュー側の stopPropagation に巻き込まれないため。
 * ===================================================================== */
(function () {
  // CVを増やす時はこの表に1行足すだけ（selector=対象リンク, sendTo=管理画面のラベル）
  var CONVERSIONS = [
    // 「LINEで相談」= LINE公式アカウントURL。シェアボタン(social-plugins.line.me)は当たらない
    { name: 'LINEお問い合わせ', selector: 'a[href*="line.me/R/ti/p/"]', sendTo: 'AW-18108125426/LX7_CMndmO0cEPKh0LpD' },
    // 電話はビズマンガ専用番号 tel:03-6261-0764 の1本のみ（2026-09-03 時点）
    { name: '電話お問い合わせ', selector: 'a[href^="tel:"]',             sendTo: 'AW-18108125426/Cf7LCMzdmO0cEPKh0LpD' }
  ];

  // Google例の gtag_report_conversion 相当。url を渡した時だけ送信後にそこへ遷移する
  function reportConversion(sendTo, url) {
    var callback = function () {
      if (typeof(url) != 'undefined') {
        window.location = url;
      }
    };
    if (typeof gtag !== 'function') { callback(); return false; }
    gtag('event', 'conversion', {
      'send_to': sendTo,
      'event_callback': callback
    });
    return false;
  }
  window.bmReportConversion = reportConversion;

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    for (var i = 0; i < CONVERSIONS.length; i++) {
      if (t.closest(CONVERSIONS[i].selector)) {
        // url を渡さない = event_callback は何もしない。遷移(新規タブ/電話アプリ)はブラウザに任せる
        reportConversion(CONVERSIONS[i].sendTo);
        return;
      }
    }
  }, true);
})();
