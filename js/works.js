// ===== Pre-production carousel state (must be declared early for direct mode) =====
var preCarouselTimers = [];
function pauseAllCarousels() { if (preCarouselTimers) preCarouselTimers.forEach(t => t.pause()); }
function resumeAllCarousels() { if (preCarouselTimers) preCarouselTimers.forEach(t => t.resume()); }

// ===== Global Image Cache Pool (Critical Optimization) =====
// Warms browser cache by loading images; browser will serve from disk/memory cache on subsequent requests
const imageCache = new Set();
function getCachedImage(src) {
  if (imageCache.has(src)) return Promise.resolve(src);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { imageCache.add(src); resolve(src); };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

// ===== Header scroll effect =====
const header = document.getElementById('header');
if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  });
}

// ===== Manga data registry =====
const mangaData = {};

// ===== ページネーション状態（initLibraryUIより前に宣言が必要） =====
let gridCurrentPage = 1;
const ITEMS_PER_PAGE = 18; // 3列 × 6行
const gridPagination = document.getElementById('gridPagination');

// ===== ヘルパー: ギャラリーURL or パスから画像src取得 =====
function getImageSrc(data, pageIndex) {
  if (data.gallery && data.gallery.length > pageIndex) {
    return data.gallery[pageIndex];
  }
  return data.path + String(pageIndex + 1).padStart(2, '0') + '.webp';
}

// ===== フォールバック用ローカルデータ =====
// タグ・カテゴリはWordPress manga_category タクソノミーと統一
// 統一タクソノミー: 営業 / 採用 / 研修 / 集客 / 紹介 / ブランド / IP
const FALLBACK_WORKS = {
  'bms-unso': {
    title: 'BMS 運送 - 採用マンガ', pages: 10,
    path: 'https://contentsx.jp/material/manga/bms-unso/',
    tags: ['採用'], category: '採用',
    viewType: 'spread'
  },
  'kyoiku-manual': {
    title: '教育マニュアル', pages: 10,
    path: 'https://contentsx.jp/material/manga/kyoiku-manual/',
    tags: ['研修'], category: '研修',
    viewType: 'spread'
  },
  'shohin-shokai': {
    title: '商品紹介マンガ', pages: 11,
    path: 'https://contentsx.jp/material/manga/shohin-shokai/',
    tags: ['営業'], category: '営業',
    viewType: 'spread'
  },
  'tagengo': {
    title: '多言語対応マンガ', pages: 12,
    path: 'https://contentsx.jp/material/manga/tagengo/',
    tags: ['研修'], category: '研修',
    viewType: 'spread'
  },
  'merumaga': {
    title: 'メルマガ漫画', pages: 10,
    path: 'https://contentsx.jp/material/manga/merumaga/',
    tags: ['集客'], category: '集客',
    viewType: 'spread'
  },
  'life-school': {
    title: 'スクール紹介', pages: 26,
    path: 'https://contentsx.jp/material/manga/life-school/',
    tags: ['集客'], category: '集客',
    viewType: 'spread'
  },
  'seko': {
    title: '瀬古恭介 始まりのものがたり', pages: 25,
    path: 'https://contentsx.jp/material/manga/seko/',
    tags: ['ブランド'], category: 'ブランド',
    viewType: 'spread'
  },
  'sixtones': {
    title: 'SixTONES 提案用', pages: 4,
    path: 'https://contentsx.jp/material/manga/sixtones/',
    tags: ['IP'], category: 'IP',
    viewType: 'spread'
  },
  'life-buzfes': {
    title: 'バズフェス', pages: 25,
    path: 'https://contentsx.jp/material/manga/life-buzfes/',
    tags: ['集客'], category: '集客',
    viewType: 'spread'
  },
  'lady-column': {
    title: '大人なLADYになるわよコラム', pages: 4,
    path: 'https://contentsx.jp/material/manga/lady-column/',
    tags: ['紹介'], category: '紹介',
    viewType: 'vertical', tallCover: true
  },
  'ichinohe-home': {
    title: '一戸ホーム', pages: 22,
    path: 'https://contentsx.jp/material/manga/ichinohe-home/',
    tags: ['営業'], category: '営業',
    viewType: 'spread'
  },
  'bms-unso-remake': {
    title: 'BMS 運送（リメイク版）', pages: 10,
    path: 'https://contentsx.jp/material/manga/bms-unso-remake/',
    tags: ['採用'], category: '採用',
    viewType: 'spread'
  },
};

// ===== フィルタボタン生成 =====
const worksFilter = document.getElementById('worksFilter');

function buildFilterButtons() {
  worksFilter.innerHTML = '';
  const allWorks = Object.values(mangaData);
  const categories = ['すべて'];
  allWorks.forEach(d => {
    if (d.category && !categories.includes(d.category)) categories.push(d.category);
  });
  const catCount = {};
  allWorks.forEach(d => {
    if (d.category) catCount[d.category] = (catCount[d.category] || 0) + 1;
  });
  catCount['すべて'] = allWorks.length;

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (cat === 'すべて' ? ' active' : '');
    btn.dataset.cat = cat;
    btn.innerHTML = `${cat} <span class="filter-count">${catCount[cat]}</span>`;
    btn.addEventListener('click', () => filterWorks(cat, btn));
    worksFilter.appendChild(btn);
  });
}

function filterWorks(category, activeBtn) {
  worksFilter.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  activeBtn.classList.add('active');
  let visibleCount = 0;
  document.querySelectorAll('.work-card').forEach(card => {
    if (category === 'すべて' || card.dataset.category === category) {
      card.classList.remove('filter-hidden');
      visibleCount++;
    } else {
      card.classList.add('filter-hidden');
    }
  });
  document.getElementById('noResults').classList.toggle('visible', visibleCount === 0);
  gridCurrentPage = 1;
  updateGridPagination();
}

// ===== カード生成 =====
const worksGrid = document.getElementById('worksGrid');

function buildWorkCards() {
  worksGrid.innerHTML = '';
  Object.entries(mangaData).forEach(([key, data]) => {
    // 制作過程（赤ペン・ネーム専用）エントリはカードに出さない
    if (data._isPreProduction) return;
    const card = document.createElement('div');
    card.className = 'work-card';
    card.setAttribute('data-manga', key);
    card.setAttribute('data-category', data.category);
    const coverSrc = data.thumbnail || getImageSrc(data, 0);
    card.innerHTML = `
      <div class="work-card-img-wrapper">
        <img class="work-card-img" src="${coverSrc}" alt="${data.title}" loading="lazy">
        ${data.category ? `<span class="work-card-category">${data.category}</span>` : ''}
        <span class="work-card-page-count">${data.pages}P</span>
      </div>
      <div class="work-card-body">
        <div class="work-card-title">${data.title}</div>
        <div class="work-card-footer">
          <div class="work-card-arrow">→</div>
        </div>
      </div>
    `;
    worksGrid.appendChild(card);
  });
}

// ===== UI構築（フォールバック → API上書き） =====
function initLibraryUI() {
  buildFilterButtons();
  buildWorkCards();
  gridCurrentPage = 1;
  updateGridPagination();
}

// フォールバックデータで即座に構築
Object.assign(mangaData, FALLBACK_WORKS);
initLibraryUI();

// WP API からデータ取得して上書き
(function fetchLibraryFromAPI() {
  fetch('https://cms.contentsx.jp/wp-json/contentsx/v1/library')
    .then(function(res) { return res.json(); })
    .then(function(works) {
      if (!Array.isArray(works) || works.length === 0) return;

      // mangaData をクリアしてAPIデータで再構築
      Object.keys(mangaData).forEach(function(k) {
        // 制作過程エントリは残す
        if (!mangaData[k]._isPreProduction) delete mangaData[k];
      });

      works.forEach(function(w) {
        mangaData[w.id] = {
          title: w.title_ja || '',
          pages: w.pages || 0,
          path: 'https://contentsx.jp/material/manga/' + w.id + '/',
          tags: w.tags && w.tags.length > 0 ? w.tags : (w.category ? [w.category] : []),
          category: w.category || '',
          viewType: w.view_type || 'spread',
          thumbnail: w.thumbnail || '',
          gallery: w.gallery || [],
          akapen_gallery: w.akapen_gallery || [],
          name_gallery: w.name_gallery || [],
        };
      });

      // UIを再構築
      initLibraryUI();

      // 赤ペン・ネームカルーセルも再構築
      if (typeof rebuildPreCarousels === 'function') rebuildPreCarousels();
    })
    .catch(function(err) {
      console.warn('WP API取得失敗、フォールバックデータを使用:', err);
    });
})();

// Event delegation for card clicks + hover preloading
worksGrid.addEventListener('click', (e) => {
  const card = e.target.closest('.work-card');
  if (card) {
    const key = card.dataset.manga;
    openManga(key);
  }
});

// Hover preloading: start loading first 4 pages immediately on hover
worksGrid.addEventListener('mouseenter', (e) => {
  const card = e.target.closest('.work-card');
  if (card) {
    const key = card.dataset.manga;
    const data = mangaData[key];
    if (data) {
      const preloadSrcs = [];
      for (let i = 0; i < Math.min(4, data.pages); i++) {
        preloadSrcs.push(getImageSrc(data, i));
      }
      preloadSrcs.forEach(src => getCachedImage(src));
    }
  }
}, true);

// ===== Card Grid Pagination =====

function updateGridPagination() {
  const visibleCards = Array.from(document.querySelectorAll('.work-card:not(.filter-hidden)'));
  const totalItems = visibleCards.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  if (gridCurrentPage > totalPages) gridCurrentPage = 1;

  // Show/hide cards based on current page
  visibleCards.forEach((card, idx) => {
    const pageForCard = Math.floor(idx / ITEMS_PER_PAGE) + 1;
    card.classList.toggle('page-hidden', pageForCard !== gridCurrentPage);
  });

  // Build pagination bar
  const frag = document.createDocumentFragment();
  if (totalPages <= 1) {
    const singleBtn = mkPgBtn('1', () => {});
    singleBtn.classList.add('active');
    frag.appendChild(singleBtn);
    gridPagination.innerHTML = '';
    gridPagination.appendChild(frag);
    return;
  }

  // Previous
  const prevBtn = mkPgBtn('‹ Previous', () => { gridCurrentPage--; updateGridPagination(); });
  if (gridCurrentPage === 1) prevBtn.classList.add('disabled');
  frag.appendChild(prevBtn);

  // Page numbers
  const pages = generatePageNumbers(gridCurrentPage, totalPages);
  pages.forEach(p => {
    if (p === '...') {
      const el = document.createElement('span');
      el.className = 'pg-ellipsis';
      el.textContent = '...';
      frag.appendChild(el);
    } else {
      const btn = mkPgBtn(p, () => { gridCurrentPage = p; updateGridPagination(); window.scrollTo({ top: worksGrid.offsetTop - 120, behavior: 'smooth' }); });
      if (p === gridCurrentPage) btn.classList.add('active');
      frag.appendChild(btn);
    }
  });

  // Next
  const nextBtn = mkPgBtn('Next ›', () => { gridCurrentPage++; updateGridPagination(); });
  if (gridCurrentPage >= totalPages) nextBtn.classList.add('disabled');
  frag.appendChild(nextBtn);

  gridPagination.innerHTML = '';
  gridPagination.appendChild(frag);
}

function mkPgBtn(label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'pg-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function generatePageNumbers(current, total) {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 4) pages.push('...');
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 3) pages.push('...');
  pages.push(total);
  return pages;
}

// Initial pagination render
updateGridPagination();

// ===== Manga Modal (Vertical Scroll — vertical.html style) =====
const mangaModal = document.getElementById('mangaModal');
const modalManga = document.getElementById('modalManga');
const modalProgress = document.getElementById('modalProgress');
const modalPage = document.getElementById('modalPage');
const modalTitle = document.getElementById('modalTitle');
const modalHeader = document.getElementById('modalHeader');
const modalThumbSidebar = document.getElementById('modalThumbSidebar');
const modalSideIndicator = document.getElementById('modalSideIndicator');
const modalBackToTop = document.getElementById('modalBackToTop');
const modalZoomControls = document.getElementById('modalZoomControls');
const modalFooter = document.getElementById('modalFooter');

// Cache DOM refs for show/hide optimization
const docsToToggle = {
  modalManga,
  modalThumbSidebar,
  modalZoomControls,
  modalSideIndicator,
  modalBackToTop,
  modalProgress,
  modalFooter
};

let modalTotalPages = 0;
let modalPageEls = [];
let modalThumbItems = [];
let modalDots = [];
let modalLastScrollY = 0;
let modalHeaderVisible = true;
let modalScrollTimer = null;
let modalPrevPage = -1;
let verticalObserver = null;

// --- Zoom ---
const MODAL_ZOOM_DEFAULT = 500;
const MODAL_ZOOM_STEP = 100;
const MODAL_ZOOM_MIN = 300;
const MODAL_ZOOM_MAX = 1000;
let modalCurrentZoom = MODAL_ZOOM_DEFAULT;
const modalZoomLabel = document.getElementById('modalZoomLabel');
const modalZoomIn = document.getElementById('modalZoomIn');
const modalZoomOut = document.getElementById('modalZoomOut');
const modalZoomReset = document.getElementById('modalZoomReset');

function modalApplyZoom() {
  modalManga.style.maxWidth = modalCurrentZoom + 'px';
  const pct = Math.round((modalCurrentZoom / MODAL_ZOOM_DEFAULT) * 100);
  modalZoomLabel.textContent = pct + '%';
  modalZoomOut.disabled = modalCurrentZoom <= MODAL_ZOOM_MIN;
  modalZoomIn.disabled = modalCurrentZoom >= MODAL_ZOOM_MAX;
}

modalZoomIn.addEventListener('click', () => {
  modalCurrentZoom = Math.min(MODAL_ZOOM_MAX, modalCurrentZoom + MODAL_ZOOM_STEP);
  modalApplyZoom();
});
modalZoomOut.addEventListener('click', () => {
  modalCurrentZoom = Math.max(MODAL_ZOOM_MIN, modalCurrentZoom - MODAL_ZOOM_STEP);
  modalApplyZoom();
});
modalZoomReset.addEventListener('click', () => {
  modalCurrentZoom = MODAL_ZOOM_DEFAULT;
  modalApplyZoom();
});

// --- Get current page from scroll using binary search (optimized) ---
function modalGetCurrentPage() {
  const center = window.innerHeight * 0.4;
  let left = 0, right = modalPageEls.length - 1;
  let result = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const rect = modalPageEls[mid].getBoundingClientRect();
    if (rect.top <= center) {
      result = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return result;
}

// --- Modal scroll handler with RAF throttle ---
let modalScrollRAFId = null;
function onModalScroll() {
  if (modalScrollRAFId) return;

  modalScrollRAFId = requestAnimationFrame(() => {
    modalScrollRAFId = null;

    const scrollY = mangaModal.scrollTop;
    const docH = mangaModal.scrollHeight - mangaModal.clientHeight;
    const progress = docH > 0 ? (scrollY / docH) * 100 : 0;
    modalProgress.style.width = progress + '%';

    const currentPage = modalGetCurrentPage();
    modalPage.textContent = (currentPage + 1) + ' / ' + modalTotalPages;

    // Side indicator
    modalDots.forEach((d, i) => d.classList.toggle('active', i === currentPage));

    // Thumbnail sidebar update (only on change)
    if (currentPage !== modalPrevPage) {
      modalThumbItems.forEach((t, i) => t.classList.toggle('active', i === currentPage));
      if (modalThumbItems[currentPage]) {
        modalThumbItems[currentPage].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      modalPrevPage = currentPage;
    }

    // Auto-hide header
    if (scrollY > modalLastScrollY && scrollY > 100) {
      if (modalHeaderVisible) { modalHeader.classList.add('hidden'); modalHeaderVisible = false; }
    } else {
      if (!modalHeaderVisible) { modalHeader.classList.remove('hidden'); modalHeaderVisible = true; }
    }
    modalLastScrollY = scrollY;

    // Side indicator visibility
    modalSideIndicator.classList.add('visible');
    clearTimeout(modalScrollTimer);
    modalScrollTimer = setTimeout(() => modalSideIndicator.classList.remove('visible'), 1500);

    // Back to top
    modalBackToTop.classList.toggle('visible', scrollY > window.innerHeight);
  });
}

mangaModal.addEventListener('scroll', onModalScroll, { passive: true });
modalBackToTop.addEventListener('click', () => mangaModal.scrollTo({ top: 0, behavior: 'smooth' }));

// Helper function to show/hide vertical viewer elements (optimized)
function showVerticalElements() {
  modalManga.style.display = 'block';
  modalThumbSidebar.style.display = 'flex';
  modalZoomControls.style.display = 'flex';
  modalSideIndicator.style.display = 'flex';
  modalBackToTop.style.display = 'flex';
  modalProgress.style.display = 'block';
  modalFooter.style.display = 'block';
}

function hideVerticalElements() {
  modalManga.style.display = 'none';
  modalThumbSidebar.style.display = 'none';
  modalZoomControls.style.display = 'none';
  modalSideIndicator.style.display = 'none';
  modalBackToTop.style.display = 'none';
  modalProgress.style.display = 'none';
  modalFooter.style.display = 'none';
}

// Open vertical scroll viewer
function openVerticalViewer(key, data) {
  modalTitle.textContent = data.title;
  modalTotalPages = data.pages;
  currentMangaGallery = (data.gallery && data.gallery.length > 0) ? data.gallery : null;
  modalPage.textContent = `1 / ${data.pages}`;
  modalProgress.style.width = '0%';

  const isWide = ['about-bizmanga'].includes(key);
  modalManga.className = 'modal-manga' + (isWide ? ' wide' : '');

  // Reset zoom
  modalCurrentZoom = MODAL_ZOOM_DEFAULT;
  modalApplyZoom();

  // Clear modal DOM cleanly
  while (modalManga.firstChild) modalManga.removeChild(modalManga.firstChild);
  while (modalThumbSidebar.firstChild) modalThumbSidebar.removeChild(modalThumbSidebar.firstChild);
  while (modalSideIndicator.firstChild) modalSideIndicator.removeChild(modalSideIndicator.firstChild);

  modalPageEls = [];
  modalThumbItems = [];
  modalDots = [];

  // Create shared IntersectionObserver for all vertical images (optimized)
  if (verticalObserver) verticalObserver.disconnect();
  verticalObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('loaded');
        verticalObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '200px 0px', root: mangaModal });

  // Build page images with DocumentFragment
  const pagesFrag = document.createDocumentFragment();
  for (let i = 1; i <= data.pages; i++) {
    const img = document.createElement('img');
    img.src = getImageSrc(data, i - 1);
    img.alt = `${data.title} - ${i}ページ`;
    img.loading = i <= 3 ? 'eager' : 'lazy';
    pagesFrag.appendChild(img);
    verticalObserver.observe(img);
    modalPageEls.push(img);
  }
  modalManga.appendChild(pagesFrag);

  // Build thumbnail sidebar with DocumentFragment
  const thumbsFrag = document.createDocumentFragment();
  for (let i = 0; i < data.pages; i++) {
    const img = document.createElement('img');
    img.className = 'modal-thumb-item' + (i === 0 ? ' active' : '');
    img.src = getImageSrc(data, i);
    img.alt = 'P' + (i + 1);
    const idx = i;
    img.addEventListener('click', () => {
      modalPageEls[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    thumbsFrag.appendChild(img);
    modalThumbItems.push(img);
  }
  modalThumbSidebar.appendChild(thumbsFrag);

  // Build side indicator dots with DocumentFragment
  const dotsFrag = document.createDocumentFragment();
  for (let i = 0; i < data.pages; i++) {
    const dot = document.createElement('div');
    dot.className = 'modal-side-dot' + (i === 0 ? ' active' : '');
    const idx = i;
    dot.addEventListener('click', () => {
      modalPageEls[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    dotsFrag.appendChild(dot);
    modalDots.push(dot);
  }
  modalSideIndicator.appendChild(dotsFrag);

  // Reset state
  modalLastScrollY = 0;
  modalHeaderVisible = true;
  modalPrevPage = -1;
  modalHeader.classList.remove('hidden');
  modalBackToTop.classList.remove('visible');

  mangaModal.scrollTop = 0;
}

// --- Preload helper: enhanced with cache ---
function preloadImages(srcs, timeout) {
  timeout = timeout || 3000;
  var promises = srcs.map(function(src) {
    return getCachedImage(src);
  });
  return Promise.race([
    Promise.all(promises),
    new Promise(function(resolve) { setTimeout(resolve, timeout); })
  ]);
}

// --- Open manga (dispatch to correct viewer) ---
function openManga(key) {
  const data = mangaData[key];
  if (!data) return;

  // viewTypeに基づいてビューアモードを決定
  // スマホではspreadタイプも縦スクロールで表示
  const dataMode = data.viewType || 'vertical';
  const mode = (!isPC() && dataMode === 'spread') ? 'vertical' : dataMode;
  currentViewMode = mode;

  // Set mode class for CSS background switching
  mangaModal.classList.remove('mode-vertical', 'mode-spread');
  mangaModal.classList.add('mode-' + mode);

  modalTitle.textContent = data.title;

  // Pause pre-production carousels while modal is open
  if (typeof pauseAllCarousels === 'function') pauseAllCarousels();

  // Preload first pages then open viewer immediately with loading state
  var firstPages = [getImageSrc(data, 0), getImageSrc(data, 1)];
  if (data.pages >= 3) firstPages.push(getImageSrc(data, 2));
  if (data.pages >= 4) firstPages.push(getImageSrc(data, 3));

  // Show modal immediately with loading indicator
  mangaModal.classList.add('open');
  document.body.style.overflow = 'hidden';

  if (mode === 'vertical') {
    showVerticalElements();
    hideSpreadElements();
    openVerticalViewer(key, data);
  } else {
    hideVerticalElements();
    showSpreadElements();
    // Double rAF ensures layout is fully computed before reading dimensions
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        openSpreadViewer(key, data);
      });
    });
  }

  // Preload in background
  preloadImages(firstPages, 2000).then(function() {
    // Modal already visible, preload continues for subsequent pages
  });

  // Library mode: push history so browser back closes manga
  if (!isDirectMode) {
    history.pushState({ manga: true }, '');
  }
}

// Show spread viewer elements - clear inline styles so CSS classes take control
function showSpreadElements() {
  document.getElementById('bookArea').style.display = '';
  document.getElementById('bottomNav').style.display = '';
  document.getElementById('mobileView').style.display = '';
}

// Hide spread viewer elements
function hideSpreadElements() {
  document.getElementById('bookArea').style.display = 'none';
  document.getElementById('bottomNav').style.display = 'none';
  document.getElementById('mobileView').style.display = 'none';
}

// ======================================================
// ===== BOOK-STYLE MANGA VIEWER (Two-page spread) =====
// ======================================================

const book = document.getElementById('book');
const bookArea = document.getElementById('bookArea');
const bookSpine = document.getElementById('bookSpine');
const pageRight = document.getElementById('pageRight');
const pageLeft = document.getElementById('pageLeft');
const imgRight = document.getElementById('imgRight');
const imgLeft = document.getElementById('imgLeft');
const navScrubber = document.getElementById('navScrubber');
const navThumbs = document.getElementById('navThumbs');
const navPageInfo = document.getElementById('navPageInfo');
const navPrev = document.getElementById('navPrev');
const navNext = document.getElementById('navNext');
const hintLeft = document.getElementById('hintLeft');
const hintRight = document.getElementById('hintRight');

let currentViewMode = 'vertical';
let currentMangaKey = '';
let currentMangaPath = '';
let currentMangaGallery = null; // WP API gallery URLs
let spreadTotalPages = 0;
let currentSpread = 0;
let spreads = [];
let isSpreadAnimating = false;
let currentMobilePage = 0;

// Pre-compute padStart strings for spread sources
const padStartCache = new Map();
function spreadPageSrc(path, num) {
  // ギャラリーURLがあればそちらを優先
  if (currentMangaGallery && currentMangaGallery.length >= num) {
    return currentMangaGallery[num - 1];
  }
  const key = path + num;
  if (!padStartCache.has(key)) {
    padStartCache.set(key, path + String(num).padStart(2, '0') + '.webp');
  }
  return padStartCache.get(key);
}

var thanksPageSrc = 'https://contentsx.jp/material/manga/thanks_v02.webp';

// Helper: get correct image source for a page number (handles 'thanks')
function getPageSrc(path, pageNum) {
  return pageNum === 'thanks' ? thanksPageSrc : spreadPageSrc(path, pageNum);
}

function buildSpreads(total) {
  const arr = [];
  for (let i = 1; i <= total; i += 2) {
    if (i + 1 <= total) {
      arr.push([i, i + 1]);
    } else {
      // 奇数ページ: 最後にthanks画像を挿入
      arr.push([i, 'thanks']);
    }
  }
  return arr;
}

function buildSpreadThumbnails() {
  const thumbsFrag = document.createDocumentFragment();
  for (let i = 0; i < spreads.length; i++) {
    const thumb = document.createElement('div');
    thumb.className = 'nav-thumb' + (i === 0 ? ' active' : '');
    thumb.dataset.spread = i;

    const img = document.createElement('img');
    img.src = spreadPageSrc(currentMangaPath, spreads[i][0]);
    img.alt = `${spreads[i][0]}P`;
    img.loading = 'lazy';
    thumb.appendChild(img);

    thumb.addEventListener('click', () => {
      if (!isSpreadAnimating) showSpread(i);
    });
    thumbsFrag.appendChild(thumb);
  }
  navThumbs.innerHTML = '';
  navThumbs.appendChild(thumbsFrag);
}

function showSpread(index) {
  if (index < 0 || index >= spreads.length) return;
  currentSpread = index;
  const spread = spreads[index];
  const rightNum = spread[0];
  const leftNum = spread[1];

  const areaHeight = Math.max(bookArea.clientHeight - 40, 200);
  const areaWidth = Math.max(bookArea.clientWidth - 60, 200);
  const pageH = Math.min(areaHeight, 700);
  const pageW = Math.round(pageH * 0.707);

  if (leftNum === null) {
    book.classList.add('single-page');
    pageRight.style.display = 'flex';
    pageRight.style.width = pageW + 'px';
    pageRight.style.height = pageH + 'px';
    pageLeft.style.display = 'none';

    imgRight.src = spreadPageSrc(currentMangaPath, rightNum);
    imgRight.alt = `${modalTitle.textContent} - ${rightNum}ページ`;
  } else {
    book.classList.remove('single-page');
    pageRight.style.display = 'flex';
    pageLeft.style.display = 'flex';

    const twoPageW = Math.min(pageW, Math.floor((areaWidth - 6) / 2));
    const adjustedH = Math.min(pageH, Math.round(twoPageW / 0.707));

    pageRight.style.width = twoPageW + 'px';
    pageRight.style.height = adjustedH + 'px';
    pageLeft.style.width = twoPageW + 'px';
    pageLeft.style.height = adjustedH + 'px';

    imgRight.src = spreadPageSrc(currentMangaPath, rightNum);
    imgRight.alt = `${modalTitle.textContent} - ${rightNum}ページ`;
    // thanks画像の場合は専用パスを使う
    if (leftNum === 'thanks') {
      imgLeft.src = thanksPageSrc;
      imgLeft.alt = '最後まで読んでいただきありがとうございます';
    } else {
      imgLeft.src = spreadPageSrc(currentMangaPath, leftNum);
      imgLeft.alt = `${modalTitle.textContent} - ${leftNum}ページ`;
    }
  }

  // Preload next 3 spreads ahead (optimized)
  for (let s = Math.max(0, index - 1); s <= Math.min(spreads.length - 1, index + 3); s++) {
    if (s !== index) {
      getCachedImage(getPageSrc(currentMangaPath, spreads[s][0]));
      if (spreads[s][1]) getCachedImage(getPageSrc(currentMangaPath, spreads[s][1]));
    }
  }

  updateSpreadUI();
}

function updateSpreadUI() {
  if (!isPC()) {
    const pageNum = currentMobilePage + 1;
    modalPage.textContent = `${pageNum} / ${spreadTotalPages}`;
    navPageInfo.textContent = `${pageNum} / ${spreadTotalPages}`;
    navScrubber.value = currentSpread;
    // モバイルは縦スクロールのためボタン無効化不要
  } else {
    const spread = spreads[currentSpread];
    const rightNum = spread[0];
    const leftNum = spread[1];

    if (leftNum) {
      modalPage.textContent = `${rightNum}-${leftNum} / ${spreadTotalPages}`;
      navPageInfo.textContent = `${rightNum}-${leftNum} / ${spreadTotalPages}`;
    } else {
      modalPage.textContent = `${rightNum} / ${spreadTotalPages}`;
      navPageInfo.textContent = `${rightNum} / ${spreadTotalPages}`;
    }

    navScrubber.value = currentSpread;
    navPrev.classList.toggle('disabled', currentSpread >= spreads.length - 1);
    navNext.classList.toggle('disabled', currentSpread <= 0);
  }

  navThumbs.querySelectorAll('.nav-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === currentSpread);
  });

  const activeThumb = navThumbs.querySelector('.nav-thumb.active');
  if (activeThumb) {
    activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  updateScrubberFill();
}

function openSpreadViewer(key, data) {
  currentMangaKey = key;
  currentMangaPath = data.path;
  currentMangaGallery = (data.gallery && data.gallery.length > 0) ? data.gallery : null;
  spreadTotalPages = data.pages;
  currentSpread = 0;
  spreads = buildSpreads(spreadTotalPages);

  navScrubber.min = 0;
  navScrubber.max = spreads.length - 1;
  navScrubber.value = 0;

  buildSpreadThumbnails();
  currentMobilePage = 0;

  if (isPC()) {
    showSpread(0);
    hintLeft.style.opacity = '1';
    hintRight.style.opacity = '1';
    setTimeout(() => {
      hintLeft.style.opacity = '0';
      hintRight.style.opacity = '0';
    }, 3000);
  } else {
    document.getElementById('mobilePage').src = spreadPageSrc(currentMangaPath, 1);
    updateSpreadUI();
  }
}

const flipOverlay = document.getElementById('flipOverlay');
const flipFrontImg = document.getElementById('flipFrontImg');
const flipBackImg = document.getElementById('flipBackImg');
const pageShadowLeft = document.getElementById('pageShadowLeft');
const pageShadowRight = document.getElementById('pageShadowRight');
const FLIP_DURATION = 500;

function goNext() {
  if (isSpreadAnimating || currentSpread >= spreads.length - 1) return;
  isSpreadAnimating = true;

  const nextIndex = currentSpread + 1;
  const nextSpr = spreads[nextIndex];
  const currentSpr = spreads[currentSpread];

  flipOverlay.classList.remove('flip-next', 'flip-prev');
  flipOverlay.classList.add('flip-prev');

  flipFrontImg.src = currentSpr[1]
    ? getPageSrc(currentMangaPath, currentSpr[1])
    : getPageSrc(currentMangaPath, currentSpr[0]);
  flipBackImg.src = getPageSrc(currentMangaPath, nextSpr[0]);

  flipOverlay.style.transition = 'none';
  flipOverlay.style.transform = 'rotateY(0deg)';
  flipOverlay.classList.add('active');

  pageShadowRight.classList.add('active');

  const halfDuration = FLIP_DURATION * 0.45;
  setTimeout(() => {
    imgRight.src = getPageSrc(currentMangaPath, nextSpr[0]);
    if (nextSpr[1]) {
      pageLeft.style.display = 'flex';
      imgLeft.src = getPageSrc(currentMangaPath, nextSpr[1]);
    } else {
      pageLeft.style.display = 'none';
    }
  }, halfDuration);

  pageShadowRight.style.transition = 'none';
  pageShadowRight.style.opacity = '0';
  setTimeout(() => {
    pageShadowRight.style.transition = `opacity ${FLIP_DURATION * 0.3}ms ease`;
    pageShadowRight.style.opacity = '0.6';
  }, FLIP_DURATION * 0.15);
  setTimeout(() => {
    pageShadowRight.style.opacity = '0';
  }, FLIP_DURATION * 0.65);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flipOverlay.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.3, 0.0, 0.2, 1)`;
      flipOverlay.style.transform = 'rotateY(180deg)';
    });
  });

  setTimeout(() => {
    flipOverlay.classList.remove('active', 'flip-prev');
    flipOverlay.style.transition = 'none';
    flipOverlay.style.transform = '';
    pageShadowRight.classList.remove('active');
    pageShadowRight.style.transition = 'none';
    pageShadowRight.style.opacity = '';

    showSpread(nextIndex);
    isSpreadAnimating = false;
  }, FLIP_DURATION + 30);
}

function goPrev() {
  if (isSpreadAnimating || currentSpread <= 0) return;
  isSpreadAnimating = true;

  const prevIndex = currentSpread - 1;
  const prevSpr = spreads[prevIndex];
  const currentSpr = spreads[currentSpread];

  flipOverlay.classList.remove('flip-next', 'flip-prev');
  flipOverlay.classList.add('flip-next');

  flipFrontImg.src = getPageSrc(currentMangaPath, currentSpr[0]);
  flipBackImg.src = prevSpr[1]
    ? getPageSrc(currentMangaPath, prevSpr[1])
    : getPageSrc(currentMangaPath, prevSpr[0]);

  flipOverlay.style.transition = 'none';
  flipOverlay.style.transform = 'rotateY(0deg)';
  flipOverlay.classList.add('active');

  pageShadowLeft.classList.add('active');

  const halfDuration = FLIP_DURATION * 0.45;
  setTimeout(() => {
    imgRight.src = getPageSrc(currentMangaPath, prevSpr[0]);
    if (prevSpr[1]) {
      pageLeft.style.display = 'flex';
      imgLeft.src = getPageSrc(currentMangaPath, prevSpr[1]);
    } else {
      pageLeft.style.display = 'none';
    }
  }, halfDuration);

  pageShadowLeft.style.transition = 'none';
  pageShadowLeft.style.opacity = '0';
  setTimeout(() => {
    pageShadowLeft.style.transition = `opacity ${FLIP_DURATION * 0.3}ms ease`;
    pageShadowLeft.style.opacity = '0.6';
  }, FLIP_DURATION * 0.15);
  setTimeout(() => {
    pageShadowLeft.style.opacity = '0';
  }, FLIP_DURATION * 0.65);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flipOverlay.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.3, 0.0, 0.2, 1)`;
      flipOverlay.style.transform = 'rotateY(-180deg)';
    });
  });

  setTimeout(() => {
    flipOverlay.classList.remove('active', 'flip-next');
    flipOverlay.style.transition = 'none';
    flipOverlay.style.transform = '';
    pageShadowLeft.classList.remove('active');
    pageShadowLeft.style.transition = 'none';
    pageShadowLeft.style.opacity = '';

    showSpread(prevIndex);
    isSpreadAnimating = false;
  }, FLIP_DURATION + 30);
}

function isPC() { return window.innerWidth >= 769; }

const mobilePage = document.getElementById('mobilePage');
const mobileFlipOverlay = document.getElementById('mobileFlipOverlay');
const mobileFlipFrontImg = document.getElementById('mobileFlipFrontImg');
const mobileFlipBackImg = document.getElementById('mobileFlipBackImg');
const mobileFlipShadow = document.getElementById('mobileFlipShadow');
const mobileView = document.getElementById('mobileView');

function mobileFlipTo(index, direction) {
  if (isSpreadAnimating || index < 0 || index >= spreadTotalPages || index === currentMobilePage) return;
  isSpreadAnimating = true;

  const goForward = direction === 'forward';
  const currentSrc = spreadPageSrc(currentMangaPath, currentMobilePage + 1);
  const targetSrc = spreadPageSrc(currentMangaPath, index + 1);

  if (goForward) {
    mobileFlipOverlay.style.transformOrigin = 'left center';
    mobileFlipFrontImg.src = currentSrc;
    mobileFlipBackImg.src = targetSrc;
    mobilePage.src = targetSrc;
    mobileFlipShadow.style.background = 'linear-gradient(to right, rgba(0,0,0,0.35), transparent 50%)';

    mobileFlipOverlay.style.transition = 'none';
    mobileFlipOverlay.style.transform = 'rotateY(0deg)';
    mobileFlipOverlay.classList.add('active');
    mobileFlipShadow.classList.add('active');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mobileFlipOverlay.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.3, 0.0, 0.2, 1)`;
        mobileFlipOverlay.style.transform = 'rotateY(-180deg)';
      });
    });
  } else {
    mobileFlipOverlay.style.transformOrigin = 'left center';
    mobileFlipFrontImg.src = targetSrc;
    mobileFlipBackImg.src = currentSrc;
    mobilePage.src = targetSrc;
    mobileFlipShadow.style.background = 'linear-gradient(to left, rgba(0,0,0,0.35), transparent 50%)';

    mobileFlipOverlay.style.transition = 'none';
    mobileFlipOverlay.style.transform = 'rotateY(-180deg)';
    mobileFlipOverlay.classList.add('active');
    mobileFlipShadow.classList.add('active');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mobileFlipOverlay.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.3, 0.0, 0.2, 1)`;
        mobileFlipOverlay.style.transform = 'rotateY(0deg)';
      });
    });
  }

  mobileFlipShadow.style.transition = 'none';
  mobileFlipShadow.style.opacity = '0';
  setTimeout(() => {
    mobileFlipShadow.style.transition = `opacity ${FLIP_DURATION * 0.3}ms ease`;
    mobileFlipShadow.style.opacity = '0.6';
  }, FLIP_DURATION * 0.15);
  setTimeout(() => {
    mobileFlipShadow.style.opacity = '0';
  }, FLIP_DURATION * 0.65);

  setTimeout(() => {
    mobileFlipOverlay.classList.remove('active');
    mobileFlipOverlay.style.transition = 'none';
    mobileFlipOverlay.style.transform = '';
    mobileFlipShadow.classList.remove('active');
    mobileFlipShadow.style.transition = 'none';
    mobileFlipShadow.style.opacity = '';

    currentMobilePage = index;
    mobilePage.src = spreadPageSrc(currentMangaPath, currentMobilePage + 1);
    currentSpread = currentMobilePage === 0 ? 0 : Math.ceil(currentMobilePage / 2);
    updateSpreadUI();
    isSpreadAnimating = false;
  }, FLIP_DURATION + 30);
}

function mobileNext() { mobileFlipTo(currentMobilePage + 1, 'forward'); }
function mobilePrev() { mobileFlipTo(currentMobilePage - 1, 'backward'); }

function nextPage() { if (isPC()) goNext(); else mobileNext(); }
function prevPage() { if (isPC()) goPrev(); else mobilePrev(); }

// PC: Left click = next
document.getElementById('clickLeft').addEventListener('click', (e) => {
  e.preventDefault();
  goNext();
});

// PC: Right click = prev
document.getElementById('clickRight').addEventListener('click', (e) => {
  e.preventDefault();
  goPrev();
});

pageRight.addEventListener('click', (e) => {
  e.stopPropagation();
  goNext();
});
pageLeft.addEventListener('click', (e) => {
  e.stopPropagation();
  goPrev();
});

bookArea.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  goPrev();
});

// Mobile: tap areas
document.getElementById('tapLeft').addEventListener('click', mobileNext);
document.getElementById('tapRight').addEventListener('click', mobilePrev);

// Mobile: touch/swipe
let touchStartX = 0, touchStartY = 0, touchStartTime = 0, swiping = false;

mobileView.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
  swiping = false;
}, { passive: true });

mobileView.addEventListener('touchmove', (e) => {
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) swiping = true;
}, { passive: true });

mobileView.addEventListener('touchend', (e) => {
  if (!swiping) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const elapsed = Date.now() - touchStartTime;
  const velocity = Math.abs(dx) / elapsed;
  if (Math.abs(dx) > 50 || velocity > 0.3) {
    if (dx < 0) mobileNext();
    else mobilePrev();
  }
});

// Bottom nav buttons (Japanese manga reads right-to-left: ◀ = next page, ▶ = prev page)
navPrev.addEventListener('click', nextPage);
navNext.addEventListener('click', prevPage);

// Scrubber fill color update
function updateScrubberFill() {
  const min = parseInt(navScrubber.min) || 0;
  const max = parseInt(navScrubber.max) || 1;
  const val = parseInt(navScrubber.value) || 0;
  const pct = ((val - min) / (max - min)) * 100;
  // RTL: right side = read pages (orange), left side = unread (gray)
  navScrubber.style.background =
    'linear-gradient(to left, #EB5200 ' + pct + '%, rgba(255,255,255,0.15) ' + pct + '%)';
}

navScrubber.addEventListener('input', () => {
  const val = parseInt(navScrubber.value);
  if (!isSpreadAnimating && val !== currentSpread) {
    if (isPC()) {
      showSpread(val);
    } else {
      const targetPage = val === 0 ? 0 : val * 2 - 1;
      currentMobilePage = Math.min(targetPage, spreadTotalPages - 1);
      mobilePage.src = spreadPageSrc(currentMangaPath, currentMobilePage + 1);
      currentSpread = val;
      updateSpreadUI();
    }
  }
});

// Resize handler
window.addEventListener('resize', () => {
  if (!mangaModal.classList.contains('open')) return;
  if (!mangaModal.classList.contains('mode-spread')) return;
  if (isPC()) {
    currentSpread = currentMobilePage === 0 ? 0 : Math.ceil(currentMobilePage / 2);
    showSpread(currentSpread);
  } else {
    const spr = spreads[currentSpread];
    currentMobilePage = spr[0] - 1;
    mobilePage.src = spreadPageSrc(currentMangaPath, currentMobilePage + 1);
    updateSpreadUI();
  }
});

// Keyboard: route to spread viewer when in spread mode
function handleSpreadKeyboard(e) {
  if (!mangaModal.classList.contains('mode-spread')) return;
  if (e.key === 'ArrowLeft') nextPage();
  if (e.key === 'ArrowRight') prevPage();
}

function closeManga() {
  if (isDirectMode) return;

  // Clean up modal DOM
  while (modalManga.firstChild) modalManga.removeChild(modalManga.firstChild);

  // Disconnect vertical observer
  if (verticalObserver) {
    verticalObserver.disconnect();
    verticalObserver = null;
  }

  // Clear references
  modalPageEls = [];
  modalThumbItems = [];
  modalDots = [];

  mangaModal.classList.remove('open');
  document.body.style.overflow = '';

  // Resume pre-production carousels from same position
  if (typeof resumeAllCarousels === 'function') resumeAllCarousels();
}

document.getElementById('modalClose').addEventListener('click', () => {
  if (!isDirectMode) {
    history.back(); // triggers popstate → closeManga
  }
});
document.addEventListener('keydown', (e) => {
  if (!mangaModal.classList.contains('open')) return;
  if (e.key === 'Escape' && !isDirectMode) {
    history.back();
  }
  // Spread mode keyboard handling
  if (mangaModal.classList.contains('mode-spread')) {
    if (e.key === 'ArrowLeft') nextPage();
    if (e.key === 'ArrowRight') prevPage();
  }
});

// Browser back closes manga (library mode)
window.addEventListener('popstate', () => {
  if (mangaModal.classList.contains('open') && !isDirectMode) {
    closeManga();
  }
});

// ===== Direct access mode (QR code: works.html?manga=bms-unso) =====
const params = new URLSearchParams(window.location.search);
const autoOpen = params.get('manga');
const isDirectMode = !!autoOpen; // true = QR/direct link, false = from library

if (isDirectMode && (mangaData[autoOpen] || FALLBACK_WORKS[autoOpen])) {
  // Hide library entirely
  // biz-library.html uses .bm-header; works.html uses .header — handle both
  const headerEl = document.querySelector('.bm-header') || document.querySelector('.header');
  if (headerEl) headerEl.style.display = 'none';
  const pageHeroEl = document.querySelector('.page-hero');
  if (pageHeroEl) pageHeroEl.style.display = 'none';
  const worksSectionEl = document.querySelector('.works-section');
  if (worksSectionEl) worksSectionEl.style.display = 'none';
  const preSection = document.querySelector('.pre-section');
  if (preSection) preSection.style.display = 'none';
  const footerEl = document.querySelector('.footer');
  if (footerEl) footerEl.style.display = 'none';

  // Hide close button (no library to return to)
  const modalCloseEl = document.getElementById('modalClose');
  if (modalCloseEl) modalCloseEl.style.display = 'none';

  // Open manga immediately
  openManga(autoOpen);
}

// ===== Pre-production Carousels (赤ペン・ネーム) =====
// pauseAllCarousels / resumeAllCarousels はファイル先頭で宣言済み

// フォールバック用の赤ペン・ネームデータ
const FALLBACK_PRE_DATA = {
  red: [
    { key: 'pre-red-bms', title: 'BMS 運送 赤入れ', path: 'https://contentsx.jp/material/pre/red/bms-unso-red/', pages: 8 },
    { key: 'pre-red-life', title: 'ライフエンターテイメント 赤入れ', path: 'https://contentsx.jp/material/pre/red/life-ent-red/', pages: 27 },
    { key: 'pre-red-ichinohe', title: '一戸ホーム 赤入れ', path: 'https://contentsx.jp/material/pre/red/ichinohe-red/', pages: 20 }
  ],
  name: [
    { key: 'pre-name-merumaga', title: 'BMS メルマガ ネーム', path: 'https://contentsx.jp/material/pre/name/bms-merumaga/', pages: 9 },
    { key: 'pre-name-fax', title: 'BMS FAX ネーム', path: 'https://contentsx.jp/material/pre/name/bmsfax/', pages: 9 },
    { key: 'pre-name-ichinohe', title: '一戸ホーム ネーム', path: 'https://contentsx.jp/material/pre/name/ichinohe-name/', pages: 20 }
  ]
};

// 現在有効な preData（API取得後に上書きされる可能性あり）
let preData = FALLBACK_PRE_DATA;

// WP APIデータから赤ペン・ネームデータを構築
function buildPreDataFromAPI() {
  const apiRed = [];
  const apiName = [];
  Object.entries(mangaData).forEach(function([key, data]) {
    if (data._isPreProduction) return;
    if (data.akapen_gallery && data.akapen_gallery.length > 0) {
      const akapenKey = 'pre-red-' + key;
      apiRed.push({
        key: akapenKey,
        title: data.title + ' 赤入れ',
        path: '',
        pages: data.akapen_gallery.length,
        gallery: data.akapen_gallery
      });
      // mangaDataに登録してopenManga()で開けるようにする
      mangaData[akapenKey] = {
        title: data.title + ' 赤入れ',
        pages: data.akapen_gallery.length,
        path: '',
        gallery: data.akapen_gallery,
        tags: [],
        category: '制作過程',
        viewType: 'vertical',
        _isPreProduction: true
      };
    }
    if (data.name_gallery && data.name_gallery.length > 0) {
      const nameKey = 'pre-name-' + key;
      apiName.push({
        key: nameKey,
        title: data.title + ' ネーム',
        path: '',
        pages: data.name_gallery.length,
        gallery: data.name_gallery
      });
      mangaData[nameKey] = {
        title: data.title + ' ネーム',
        pages: data.name_gallery.length,
        path: '',
        gallery: data.name_gallery,
        tags: [],
        category: '制作過程',
        viewType: 'vertical',
        _isPreProduction: true
      };
    }
  });
  if (apiRed.length > 0 || apiName.length > 0) {
    preData = {
      red: apiRed.length > 0 ? apiRed : FALLBACK_PRE_DATA.red,
      name: apiName.length > 0 ? apiName : FALLBACK_PRE_DATA.name
    };
  }
}

function registerFallbackPreData() {
  Object.values(preData).flat().forEach(item => {
    if (!mangaData[item.key]) {
      mangaData[item.key] = {
        title: item.title,
        pages: item.pages,
        path: item.path,
        gallery: item.gallery || [],
        tags: [],
        category: '制作過程',
        viewType: 'spread',
        _isPreProduction: true
      };
    }
  });
}

(function() {
  // フォールバックデータを登録
  registerFallbackPreData();

  function initCarousel(type) {
    const track = document.getElementById(type + 'Track');
    const dotsContainer = document.getElementById(type + 'Dots');
    if (!track || !dotsContainer) return null;

    const items = preData[type];
    if (!items || items.length === 0) return null;
    const slidesPerView = window.innerWidth <= 768 ? 1 : 3;
    let current = 0;
    let autoTimer = null;
    let carouselRAFId = null;

    // Build slides — ALL pages from ALL works, each page is a slide
    const allSlides = [];
    items.forEach((item) => {
      for (let p = 1; p <= item.pages; p++) {
        const src = (item.gallery && item.gallery.length >= p)
          ? item.gallery[p - 1]
          : item.path + String(p).padStart(2, '0') + '.webp';
        allSlides.push({
          key: item.key,
          title: item.title,
          page: p,
          totalPages: item.pages,
          src: src
        });
      }
    });

    const slidesFrag = document.createDocumentFragment();
    allSlides.forEach((s) => {
      const slide = document.createElement('div');
      slide.className = 'pre-carousel-slide';

      const imgWrap = document.createElement('div');
      imgWrap.className = 'pre-slide-img-wrap';
      const img = document.createElement('img');
      img.src = s.src;
      img.alt = s.title + ' ' + s.page + 'P';
      img.loading = 'lazy';
      imgWrap.appendChild(img);

      const title = document.createElement('div');
      title.className = 'pre-slide-title';
      title.textContent = s.title + '（' + s.page + '/' + s.totalPages + '）';

      slide.appendChild(imgWrap);
      slide.appendChild(title);
      slide.addEventListener('click', () => openManga(s.key));
      slidesFrag.appendChild(slide);
    });
    track.appendChild(slidesFrag);

    const totalSlides = allSlides.length;
    const maxIndex = Math.max(0, totalSlides - slidesPerView);

    // Calculate slide width in pixels (recalculated each move for resize safety)
    function getSlideWidth() {
      return track.parentElement.offsetWidth / slidesPerView;
    }

    function goTo(index) {
      current = Math.max(0, Math.min(index, maxIndex));
      var px = current * getSlideWidth();
      track.scrollTo({ left: px, behavior: 'smooth' });
    }

    var autoStep = 1;  // 自動スライドで1ページ分
    var btnStep = 3;   // 矢印ボタンで3ページスキップ
    function autoNext() {
      var next = current + autoStep;
      goTo(next > maxIndex ? 0 : next);
    }
    function btnNext() {
      var next = current + btnStep;
      goTo(next > maxIndex ? 0 : next);
    }
    function btnPrev() {
      var prev = current - btnStep;
      goTo(prev < 0 ? maxIndex : prev);
    }

    // Sync current index when user scrolls manually (touch/mouse drag)
    var scrollSyncTimer = null;
    track.addEventListener('scroll', function() {
      clearTimeout(scrollSyncTimer);
      scrollSyncTimer = setTimeout(function() {
        var sw = getSlideWidth();
        if (sw > 0) {
          current = Math.round(track.scrollLeft / sw);
          current = Math.max(0, Math.min(current, maxIndex));
        }
      }, 150);
    }, { passive: true });

    // Buttons
    const carousel = track.parentElement;
    carousel.querySelector('.prev').addEventListener('click', (e) => { e.stopPropagation(); btnPrev(); resetAuto(); });
    carousel.querySelector('.next').addEventListener('click', (e) => { e.stopPropagation(); btnNext(); resetAuto(); });

    // Auto-slide: use requestAnimationFrame instead of setInterval
    var paused = false;
    var lastAutoTime = 0;
    const AUTO_INTERVAL = 2500;

    function scheduleAutoSlide() {
      if (paused || !autoTimer) return;
      const now = Date.now();
      const timeSinceLastSlide = now - lastAutoTime;

      if (timeSinceLastSlide >= AUTO_INTERVAL) {
        lastAutoTime = now;
        autoNext();
      }
      carouselRAFId = requestAnimationFrame(scheduleAutoSlide);
    }

    function startAuto() {
      if (!paused) {
        lastAutoTime = Date.now();
        autoTimer = true;
        carouselRAFId = requestAnimationFrame(scheduleAutoSlide);
      }
    }
    function stopAuto() {
      if (carouselRAFId) cancelAnimationFrame(carouselRAFId);
      autoTimer = null;
    }
    function resetAuto() { stopAuto(); startAuto(); }
    startAuto();

    // Mouse wheel: passive で縦スクロールを絶対にブロックしない
    // トラックパッドの横スワイプはブラウザの overflow-x: auto が自動処理
    track.addEventListener('wheel', function() {
      resetAuto();
    }, { passive: true });

    // Pause on hover
    carousel.addEventListener('mouseenter', () => stopAuto());
    carousel.addEventListener('mouseleave', () => startAuto());

    // Register for global pause/resume (modal open/close)
    preCarouselTimers.push({
      pause: function() { paused = true; stopAuto(); },
      resume: function() { paused = false; startAuto(); }
    });

    return { goTo, btnNext, btnPrev };
  }

  try { initCarousel('red'); } catch(e) { console.error('Red carousel error:', e); }
  try { initCarousel('name'); } catch(e) { console.error('Name carousel error:', e); }

  // API取得後にカルーセルを再構築するためのグローバル関数
  window.rebuildPreCarousels = function() {
    // APIデータから赤ペン・ネームデータを構築
    buildPreDataFromAPI();
    registerFallbackPreData();

    // 既存タイマーを停止
    preCarouselTimers.forEach(function(t) { t.pause(); });
    preCarouselTimers = [];

    // トラックをクリアして再構築
    ['red', 'name'].forEach(function(type) {
      var track = document.getElementById(type + 'Track');
      if (track) track.innerHTML = '';
    });

    try { initCarousel('red'); } catch(e) { console.error('Red carousel rebuild error:', e); }
    try { initCarousel('name'); } catch(e) { console.error('Name carousel rebuild error:', e); }
  };
})();
