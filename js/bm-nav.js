/**
 * BizManga ナビゲーション + 言語切替（ContentsXと同じUI）
 * 全ページで共通メニュー＆JP/EN切替を統一。
 */
(function() {
  var NAV_ITEMS = [
    { label: 'ホーム',     labelEn: 'Home',       href: './' },
    { label: '制作事例',   labelEn: 'Works',      href: 'works' },
    { label: 'ビズ書庫',   labelEn: 'Library',    href: 'biz-library' },
    { label: '料金',       labelEn: 'Pricing',    href: 'pricing' },
    { label: 'FAQ',        labelEn: 'FAQ',        href: 'faq' }
  ];

  var path = location.pathname;
  var currentFile = path.substring(path.lastIndexOf('/') + 1) || 'index';

  // ===== 言語状態の管理 =====
  var currentLang = 'ja';
  try { currentLang = localStorage.getItem('bm-lang') || 'ja'; } catch(e) {}

  // ===== ナビ生成 =====
  var nav = document.getElementById('bmNav');
  if (!nav) return;
  nav.innerHTML = '';

  NAV_ITEMS.forEach(function(item) {
    var a = document.createElement('a');
    a.href = item.href;
    a.className = 'bm-nav-link';
    if (item.href === currentFile) a.className += ' active';
    a.setAttribute('data-ja', item.label);
    a.setAttribute('data-en', item.labelEn);
    a.textContent = currentLang === 'en' ? item.labelEn : item.label;
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
  function switchLang(lang) {
    currentLang = lang;
    try { localStorage.setItem('bm-lang', lang); } catch(e) {}

    // ボタンの active 切替
    document.querySelectorAll('.bm-lang-btn').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });

    // data-ja / data-en を持つ全要素のテキストを切替
    document.querySelectorAll('[data-ja][data-en]').forEach(function(el) {
      var newText = lang === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-ja');
      el.textContent = newText;
    });

    // お問い合わせCTAボタン
    document.querySelectorAll('.bm-nav-cta').forEach(function(el) {
      el.textContent = lang === 'en' ? 'Contact' : 'お問い合わせ';
    });

    // html lang 属性も更新
    document.documentElement.lang = lang;
  }

  // ボタンにイベント登録
  document.querySelectorAll('.bm-lang-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchLang(btn.getAttribute('data-lang'));
    });
  });

  // 初回: localStorageにENが保存されていればEN表示に切替
  if (currentLang === 'en') {
    switchLang('en');
  }

  // ===== ハンバーガーメニュー =====
  var hamburger = document.getElementById('bmHamburger');
  if (hamburger) {
    hamburger.addEventListener('click', function() {
      nav.classList.toggle('open');
      hamburger.classList.toggle('active');
    });
    nav.querySelectorAll('.bm-nav-link').forEach(function(link) {
      link.addEventListener('click', function() {
        nav.classList.remove('open');
        hamburger.classList.remove('active');
      });
    });
  }

  // グローバルに公開
  window.bmSwitchLang = switchLang;
})();
