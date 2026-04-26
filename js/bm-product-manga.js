/* =============================================================
   bm-product-manga.js
   /product-manga.html 専用 — 3分割ビューポート固定レイアウトの制御
   - 左ペイン：キャラクター + クリック詳細スワップ
   - スクロール連動：「お悩み」セクションは thinking、メリット以降は confident
   - 右ペイン：サンプル誌面プレビュー（4ページ循環）
   - SP（< 1180px）：単カラム + アコーディオン
   ============================================================= */
(function () {
  'use strict';

  const DESKTOP_MQ = window.matchMedia('(min-width: 1180px)');
  const isDesktop = () => DESKTOP_MQ.matches;

  // ---------- キャラクター画像のスワップ ----------
  const CHARACTER_SRC = {
    confident: 'images/product-manga/hero_confident.png',
    thinking: 'images/product-manga/hero_thinking.png'
  };
  const CAPTION_BY_MOOD = {
    confident: "EDITOR'S DESK",
    thinking: 'LISTENING…'
  };

  function setMood(mood) {
    const wrap = document.getElementById('pmCharacter');
    const caption = document.getElementById('pmCaption');
    if (!wrap) return;
    if (wrap.dataset.mood === mood) return;
    wrap.dataset.mood = mood;
    const img = wrap.querySelector('img');
    if (!img) return;
    wrap.classList.add('is-out');
    setTimeout(() => {
      img.src = CHARACTER_SRC[mood] || CHARACTER_SRC.confident;
      if (caption) caption.textContent = CAPTION_BY_MOOD[mood] || CAPTION_BY_MOOD.confident;
      requestAnimationFrame(() => wrap.classList.remove('is-out'));
    }, 220);
  }

  // ---------- スクロール連動（IntersectionObserver） ----------
  function initMoodObserver() {
    // 「こんなお悩みは、ありませんか。」セクションだけ thinking、他はすべて confident
    const painSection = document.querySelector('.pm-section--alt.pm-section--first');
    if (!painSection) return;

    const observer = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e.isIntersecting && e.intersectionRatio > 0.2) {
        setMood('thinking');
      } else {
        setMood('confident');
      }
    }, {
      rootMargin: '-25% 0px -25% 0px',
      threshold: [0, 0.2, 0.5, 0.8, 1]
    });
    observer.observe(painSection);
  }

  // ---------- 左ペイン詳細スワップ（DOM clone でXSS回避） ----------
  function showDetail(item) {
    const detail = document.getElementById('pmDetail');
    const titleEl = document.getElementById('pmDetailTitle');
    const bodyEl = document.getElementById('pmDetailBody');
    const railContent = document.getElementById('pmRailContent');
    const railLeft = document.querySelector('.pm-rail--left');
    if (!detail || !titleEl || !bodyEl) return;

    const title = item.dataset.detailTitle
      || item.querySelector('.pm-pain-title, .pm-merit-title, .pm-format-name')?.textContent.trim()
      || '';
    const detailNode = item.querySelector('.pm-pain-detail, .pm-merit-detail, .pm-format-detail');
    if (!detailNode) return;

    titleEl.textContent = title;
    while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
    Array.from(detailNode.children).forEach((child) => {
      bodyEl.appendChild(child.cloneNode(true));
    });
    detail.hidden = false;
    if (railLeft) railLeft.classList.add('has-detail');
    if (railContent) railContent.scrollTop = 0;

    document.querySelectorAll('.pm-pain-item.is-active, .pm-merit-item.is-active, .pm-format-item.is-active')
      .forEach((el) => el.classList.remove('is-active'));
    item.classList.add('is-active');
  }

  function hideDetail() {
    const detail = document.getElementById('pmDetail');
    const railLeft = document.querySelector('.pm-rail--left');
    if (detail) detail.hidden = true;
    if (railLeft) railLeft.classList.remove('has-detail');
    document.querySelectorAll('.pm-pain-item.is-active, .pm-merit-item.is-active, .pm-format-item.is-active')
      .forEach((el) => el.classList.remove('is-active'));
  }

  function initClickDetail() {
    document.addEventListener('click', (e) => {
      // 戻るボタン
      if (e.target.closest('#pmDetailBack')) {
        hideDetail();
        return;
      }
      const item = e.target.closest('[data-pm-detail]');
      if (!item) return;

      // SP：アコーディオン
      if (!isDesktop()) {
        const willOpen = !item.classList.contains('is-open');
        // 自分以外を閉じる（一度に1つだけ展開）
        document.querySelectorAll('[data-pm-detail].is-open').forEach((el) => {
          if (el !== item) el.classList.remove('is-open');
        });
        item.classList.toggle('is-open', willOpen);
        return;
      }

      // PC：左ペイン詳細
      showDetail(item);
    });

    // ブレークポイント跨ぎでハイライトをリセット
    DESKTOP_MQ.addEventListener('change', () => {
      hideDetail();
      document.querySelectorAll('[data-pm-detail].is-open').forEach((el) => el.classList.remove('is-open'));
    });
  }

  // ---------- 右ペイン：サンプルリーダー循環 ----------
  function initSampleReader() {
    const page = document.getElementById('pmReaderPage');
    const numEl = document.getElementById('pmReaderPageNum');
    const counter = document.getElementById('pmReaderCounter');
    const prev = document.getElementById('pmReaderPrev');
    const next = document.getElementById('pmReaderNext');
    if (!page || !numEl || !counter || !prev || !next) return;

    const TOTAL = 4;
    let current = 1;

    function render(n) {
      page.classList.add('is-fading');
      setTimeout(() => {
        current = ((n - 1 + TOTAL) % TOTAL) + 1;
        numEl.textContent = String(current).padStart(2, '0');
        counter.textContent = `${current} / ${TOTAL}`;
        page.classList.remove('is-fading');
      }, 180);
    }

    prev.addEventListener('click', () => render(current - 1));
    next.addEventListener('click', () => render(current + 1));
  }

  // ---------- init ----------
  function init() {
    initMoodObserver();
    initClickDetail();
    initSampleReader();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
