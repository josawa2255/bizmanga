/* =============================================================
   bm-work-modal.js — 制作事例モーダル汎用ユーティリティ
   - LP の制作事例カード [data-work-modal-id] クリックでモーダル展開
   - data-work 属性に JSON で work データ（ホームworksMap互換）
   - 縦読み / 横カルーセル両対応（bm-view-type に委譲）
   - bm-sanitize.html で XSS対策、ユーザーデータは textContent / setAttribute 経由
   既存 .work-detail-overlay CSS（bizmanga.css）を流用
   ============================================================= */
(function () {
  'use strict';

  function esc(s) {
    return (window.bmSanitize && window.bmSanitize.html)
      ? window.bmSanitize.html(s)
      : (s == null ? '' : String(s));
  }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (children) children.forEach(function (c) {
      if (typeof c === 'string') n.appendChild(document.createTextNode(c));
      else if (c) n.appendChild(c);
    });
    return n;
  }

  function buildModal() {
    if (document.getElementById('workDetailOverlay')) return;
    var overlay = el('div', { class: 'work-detail-overlay', id: 'workDetailOverlay' });
    var close = el('button', { class: 'work-detail-close', id: 'workDetailClose', 'aria-label': '閉じる' });
    close.innerHTML = '&times;';
    overlay.appendChild(close);
    var content = el('div', { class: 'work-detail-content' });
    var left = el('div', { class: 'work-detail-left' });
    var carouselWrap = el('div', { class: 'work-detail-carousel-wrap', style: 'position:relative;' });
    var loaderWrap = el('div', { class: 'bm-manga-loader-wrap', id: 'workDetailLoader' });
    loaderWrap.appendChild(el('span', { class: 'bm-manga-loader' }));
    carouselWrap.appendChild(loaderWrap);
    var prevBtn = el('button', { class: 'work-detail-arrow work-detail-prev', id: 'workDetailPrev', 'aria-label': '前のページ' });
    prevBtn.innerHTML = '&#8249;';
    carouselWrap.appendChild(prevBtn);
    carouselWrap.appendChild(el('div', { class: 'work-detail-carousel', id: 'workDetailCarousel' }));
    var nextBtn = el('button', { class: 'work-detail-arrow work-detail-next', id: 'workDetailNext', 'aria-label': '次のページ' });
    nextBtn.innerHTML = '&#8250;';
    carouselWrap.appendChild(nextBtn);
    left.appendChild(carouselWrap);
    left.appendChild(el('div', { class: 'work-detail-dots', id: 'workDetailDots' }));
    content.appendChild(left);
    var right = el('div', { class: 'work-detail-right' });
    var titleRow = el('div', { class: 'work-detail-title-row' }, [
      el('h2', { class: 'work-detail-title', id: 'workDetailTitle' }),
      el('span', { class: 'work-detail-category', id: 'workDetailCategory' })
    ]);
    right.appendChild(titleRow);
    function section(heading, listId, isText) {
      var sec = el('div', { class: 'work-detail-section' });
      sec.appendChild(el('h3', { class: 'work-detail-heading', text: heading }));
      sec.appendChild(el(isText ? 'p' : 'ul', { class: isText ? 'work-detail-text' : 'work-detail-list', id: listId }));
      return sec;
    }
    right.appendChild(section('使用媒体', 'workDetailMedia', false));
    right.appendChild(section('導入内容', 'workDetailSpec', false));
    right.appendChild(section('演出ポイント', 'workDetailPoint', true));
    var commentSec = el('div', { class: 'work-detail-section' });
    commentSec.appendChild(el('h3', { class: 'work-detail-heading', text: '客先コメント' }));
    commentSec.appendChild(el('p', { class: 'work-detail-quote', id: 'workDetailComment' }));
    right.appendChild(commentSec);
    var linkSec = el('div', { class: 'work-detail-section', style: 'margin-top:24px; text-align:center;' });
    var linkA = el('a', {
      class: 'work-detail-detail-link',
      id: 'workDetailLink',
      href: '#',
      style: 'display:inline-block; padding:10px 20px; background:#fff9f4; color:#e85500; border:1px solid #e85500; border-radius:4px; text-decoration:none; font-weight:700; font-size:13px;',
      text: 'この事例の詳細ページへ →'
    });
    linkSec.appendChild(linkA);
    right.appendChild(linkSec);
    content.appendChild(right);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
  }

  var initialized = false;
  var overlay, closeBtn, carousel, dots, prev, next, title, category, media, spec, point, comment, loader, link;
  var currentPage = 0, totalPages = 0;

  function showLoader() { if (loader) loader.classList.remove('hidden'); }
  function hideLoader() { if (loader) loader.classList.add('hidden'); }

  function buildPages(work) {
    if (!carousel) return;
    var previewPages = Math.min(work.pages || 5, 5);
    totalPages = previewPages;
    currentPage = 0;
    carousel.textContent = '';
    carousel.style.transform = 'translateX(0)';
    var hasGallery = work.gallery && work.gallery.length > 0;
    for (var i = 1; i <= previewPages; i++) {
      var img = document.createElement('img');
      var src = hasGallery && work.gallery[i - 1]
        ? work.gallery[i - 1]
        : 'https://contentsx.jp/material/manga/' + encodeURIComponent(work.id) + '/' + String(i).padStart(2, '0') + '.webp';
      img.src = src;
      img.alt = (work.title_ja || '') + ' ' + i + 'ページ';
      img.loading = i === 1 ? 'eager' : 'lazy';
      if (i === 1) {
        img.onload = hideLoader;
        img.onerror = hideLoader;
      }
      carousel.appendChild(img);
    }
  }

  function applyVertical(work) {
    carousel.classList.add('vertical-scroll');
    if (carousel.parentElement) carousel.parentElement.classList.add('has-vertical-scroll');
    carousel.style.transform = '';
    buildPages(work);
    if (dots) dots.style.display = 'none';
    if (prev) prev.style.display = 'none';
    if (next) next.style.display = 'none';
  }

  function applyCarousel(work) {
    carousel.classList.remove('vertical-scroll');
    if (carousel.parentElement) carousel.parentElement.classList.remove('has-vertical-scroll');
    buildPages(work);
    if (dots) {
      dots.style.display = 'flex';
      dots.textContent = '';
      var n = Math.min(work.pages || 5, 5);
      for (var j = 0; j < n; j++) {
        (function (idx) {
          var dot = document.createElement('div');
          dot.className = 'work-detail-dot' + (idx === 0 ? ' active' : '');
          dot.addEventListener('click', function () { goToPage(idx); });
          dots.appendChild(dot);
        })(j);
      }
    }
    if (prev) prev.style.display = '';
    if (next) next.style.display = '';
  }

  function goToPage(idx) {
    currentPage = idx;
    if (carousel) carousel.style.transform = 'translateX(-' + (idx * 100) + '%)';
    if (dots) {
      var d = dots.querySelectorAll('.work-detail-dot');
      for (var i = 0; i < d.length; i++) d[i].classList.toggle('active', i === idx);
    }
  }

  function openModal(work) {
    if (!overlay || !work || !work.id) return;
    showLoader();
    if (title) title.textContent = work.title_ja || '';
    if (category) category.textContent = work.category || '';
    if (media) {
      media.textContent = '';
      (work.media || []).forEach(function (m) {
        var li = document.createElement('li');
        li.textContent = m;
        media.appendChild(li);
      });
    }
    if (spec) {
      spec.textContent = '';
      var s = work.spec || {};
      var li1 = document.createElement('li'); li1.textContent = 'ページ数：' + (s.pages || (work.pages ? work.pages + 'P' : '—'));
      var li2 = document.createElement('li'); li2.textContent = '納期：' + (s.period || '—');
      spec.appendChild(li1); spec.appendChild(li2);
    }
    if (point) point.textContent = work.point || '';
    if (comment) comment.textContent = work.comment || '';
    if (link) link.setAttribute('href', '/works/' + encodeURIComponent(work.id));

    if (window.bmViewType && window.bmViewType.isForcedVertical && window.bmViewType.isForcedVertical(work)) {
      applyVertical(work);
    } else {
      applyCarousel(work);
      var hasGallery = work.gallery && work.gallery.length > 0;
      var firstSrc = hasGallery && work.gallery[0]
        ? work.gallery[0]
        : 'https://contentsx.jp/material/manga/' + encodeURIComponent(work.id) + '/01.webp';
      if (window.bmViewType && window.bmViewType.probeVerticalByImage) {
        window.bmViewType.probeVerticalByImage(firstSrc).then(function (isV) {
          if (isV) applyVertical(work);
        });
      }
    }
    overlay.classList.add('active');
    overlay.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
    hideLoader();
  }

  function init() {
    if (initialized) return;
    buildModal();
    overlay = document.getElementById('workDetailOverlay');
    closeBtn = document.getElementById('workDetailClose');
    carousel = document.getElementById('workDetailCarousel');
    dots = document.getElementById('workDetailDots');
    prev = document.getElementById('workDetailPrev');
    next = document.getElementById('workDetailNext');
    title = document.getElementById('workDetailTitle');
    category = document.getElementById('workDetailCategory');
    media = document.getElementById('workDetailMedia');
    spec = document.getElementById('workDetailSpec');
    point = document.getElementById('workDetailPoint');
    comment = document.getElementById('workDetailComment');
    loader = document.getElementById('workDetailLoader');
    link = document.getElementById('workDetailLink');

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-work-modal-id]');
      if (!trigger) return;
      e.preventDefault();
      var work;
      try { work = JSON.parse(trigger.getAttribute('data-work') || '{}'); }
      catch (err) { work = { id: trigger.getAttribute('data-work-modal-id') }; }
      if (!work.id) work.id = trigger.getAttribute('data-work-modal-id');
      openModal(work);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    if (prev) prev.addEventListener('click', function () {
      if (currentPage > 0) goToPage(currentPage - 1);
    });
    if (next) next.addEventListener('click', function () {
      if (currentPage < totalPages - 1) goToPage(currentPage + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (!overlay || !overlay.classList.contains('active')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft' && currentPage > 0) goToPage(currentPage - 1);
      if (e.key === 'ArrowRight' && currentPage < totalPages - 1) goToPage(currentPage + 1);
    });

    initialized = true;
    window.bmOpenWorkModal = openModal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
