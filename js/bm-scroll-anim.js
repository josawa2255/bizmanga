/**
 * BizManga — スクロールアニメーション
 * zoon.jp 風：要素ごとに方向の異なるスライド + ステップ遅延で
 * カクカクッと順番に出現する演出
 */
(function () {
  'use strict';

  /* ---------- アニメーション方向 ---------- */
  // data-sa 属性: "up" "down" "left" "right" "scale" "fade"
  var ANIM_MAP = {
    up:    { x: 0,   y: 60,  s: 1    },
    down:  { x: 0,   y: -40, s: 1    },
    left:  { x: 80,  y: 0,   s: 1    },
    right: { x: -80, y: 0,   s: 1    },
    scale: { x: 0,   y: 20,  s: 0.88 },
    fade:  { x: 0,   y: 0,   s: 1    }
  };

  /* ---------- 対象セクション ---------- */
  var SECTION_SELECTORS = [
    '.bm-about',
    '.bm-whatis',
    '.bm-news',
    '.bm-testimonials',
    '.bm-gallery',
    '.bm-pre-section',
    '.bm-cta'
  ];

  /* ---------- 子要素: [selector, animDir] ---------- */
  var CHILD_RULES = [
    ['.bm-about-heading',     'up'],
    ['.bm-about-text',        'up'],
    ['.bm-whatis-heading',    'up'],
    ['.bm-whatis-text',       'up'],
    ['.bm-section-title',     'up'],
    ['.bm-section-sub',       'up'],
    ['.bm-testimonials-header', 'up'],
    ['.bm-testimonials-scroll', 'up'],
    ['.bm-gallery-header',    'left'],
    ['.bm-gallery-carousel',  'up'],
    ['.bm-pre-section-title',  'up'],
    ['.bm-pre-section-subtitle','up'],
    ['.bm-pre-carousel-wrap',  'up'],
    ['.bm-news-item',         'right'],
    ['.bm-cta h2',            'up'],
    ['.bm-cta p',             'up'],
    ['.bm-cta .bm-btn',       'scale']
  ];

  var STEP_DELAY = 140; // 子要素間の遅延 ms

  /* ---------- 初期化: 非表示にする ---------- */
  function hideElements() {
    SECTION_SELECTORS.forEach(function (sel) {
      var sections = document.querySelectorAll(sel);
      sections.forEach(function (section) {
        var children = [];
        CHILD_RULES.forEach(function (rule) {
          var found = section.querySelectorAll(rule[0]);
          found.forEach(function (el) {
            el.setAttribute('data-sa', rule[1]);
            children.push(el);
          });
        });

        if (children.length > 0) {
          children.forEach(function (el) {
            applyHidden(el);
          });
        } else {
          section.setAttribute('data-sa', 'up');
          applyHidden(section);
        }
      });
    });
  }

  function applyHidden(el) {
    var dir = el.getAttribute('data-sa') || 'up';
    var a = ANIM_MAP[dir] || ANIM_MAP.up;
    el.style.opacity = '0';
    el.style.transform =
      'translate3d(' + a.x + 'px, ' + a.y + 'px, 0) scale(' + a.s + ')';
    el.style.willChange = 'opacity, transform';
    el.classList.add('bm-sa-queued');
  }

  /* ---------- 表示アニメーション ---------- */
  function showElement(el) {
    el.classList.remove('bm-sa-queued');
    el.classList.add('bm-sa-animating');
    el.style.transition =
      'opacity 0.45s cubic-bezier(0.0, 0.0, 0.15, 1), ' +
      'transform 0.45s cubic-bezier(0.0, 0.0, 0.15, 1)';
    el.style.opacity = '1';
    el.style.transform = 'translate3d(0,0,0) scale(1)';

    // アニメーション後にクリーンアップ
    el.addEventListener('transitionend', function cleanup(e) {
      if (e.propertyName !== 'opacity') return;
      el.removeEventListener('transitionend', cleanup);
      el.style.willChange = '';
      el.style.transition = '';
      el.classList.remove('bm-sa-animating');
    });
  }

  /* ---------- Observer ---------- */
  function onIntersect(entries, observer) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;

      var section = entry.target;
      observer.unobserve(section);

      var queued = section.querySelectorAll('.bm-sa-queued');

      if (queued.length > 0) {
        var delay = 0;
        queued.forEach(function (el) {
          setTimeout(function () { showElement(el); }, delay);
          delay += STEP_DELAY;
        });
      } else if (section.classList.contains('bm-sa-queued')) {
        showElement(section);
      }
    });
  }

  /* ---------- 起動 ---------- */
  function init() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    hideElements();

    var observer = new IntersectionObserver(onIntersect, {
      threshold: 0.1,
      rootMargin: '0px 0px -60px 0px'
    });

    SECTION_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        observer.observe(el);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
