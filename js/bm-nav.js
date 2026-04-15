/**
 * BizManga ナビゲーション + 言語切替（ContentsXと同じUI）
 * 全ページで共通メニュー＆JP/EN切替を統一。
 */
(function() {
  var NAV_ITEMS = [
    { label: 'ホーム',     labelEn: 'Home',       href: './' },
    { label: '制作事例',   labelEn: 'Works',      href: 'works' },
    { label: 'ビズ書庫',   labelEn: 'Library',    href: 'biz-library' },
    { label: '強み',       labelEn: 'Strengths',  href: 'strength', children: [
      { label: 'マンガの種類', labelEn: 'Manga Types',  href: 'manga-types' },
      { label: '活用場面',     labelEn: 'Use Cases',    href: 'use-cases' }
    ]},
    { label: '料金',       labelEn: 'Pricing',    href: 'pricing' },
    { label: 'FAQ',        labelEn: 'FAQ',        href: 'faq' }
  ];

  var path = location.pathname;
  var currentFile = path.substring(path.lastIndexOf('/') + 1).replace('.html', '') || 'index';

  // ===== 言語状態の管理 =====
  var currentLang = 'ja';
  try { currentLang = localStorage.getItem('bm-lang') || 'ja'; } catch(e) {}

  // ===== ナビ生成 =====
  var nav = document.getElementById('bmNav');
  if (!nav) return;
  nav.innerHTML = '';

  NAV_ITEMS.forEach(function(item) {
    if (item.children && item.children.length > 0) {
      // ドロップダウン
      var wrapper = document.createElement('div');
      wrapper.className = 'bm-nav-dropdown';

      var a = document.createElement('a');
      a.href = item.href;
      a.className = 'bm-nav-link bm-nav-dropdown-toggle';
      if (item.href === currentFile) a.className += ' active';
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
        if (child.href === currentFile) { ca.className += ' active'; childActive = true; }
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
      if (item.href === currentFile) a.className += ' active';
      a.setAttribute('data-ja', item.label);
      a.setAttribute('data-en', item.labelEn);
      a.textContent = currentLang === 'en' ? item.labelEn : item.label;
      nav.appendChild(a);
    }
  });

  // ===== 言語切替ボタンの挿入 =====
  var headerRight = document.querySelector('.bm-header-right');
  if (headerRight) {
    var existing = headerRight.querySelector('.bm-lang-switch');
    if (existing) existing.remove();

    var langSwitch = document.createElement('div');
    langSwitch.className = 'bm-lang-switch';
    langSwitch.id = 'bmLangSwitch';
    langSwitch.innerHTML =
      '<button class="bm-lang-btn' + (currentLang === 'ja' ? ' active' : '') + '" data-lang="ja">\u65E5\u672C\u8A9E</button>' +
      '<button class="bm-lang-btn' + (currentLang === 'en' ? ' active' : '') + '" data-lang="en">EN</button>';

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
    nav.querySelectorAll('.bm-nav-link:not(.bm-nav-dropdown-toggle)').forEach(function(link) {
      link.addEventListener('click', closeMenu);
    });
    nav.querySelectorAll('.bm-nav-dropdown-item').forEach(function(link) {
      link.addEventListener('click', closeMenu);
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

  // グローバルに公開
  window.bmSwitchLang = switchLang;
})();
