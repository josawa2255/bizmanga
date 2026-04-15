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

// ===== Manga Page Loader Helpers =====
// srcをセットする「前に」呼ぶ。リスナーを先に付けてからsrcを変更する。
function prepareImgLoad(imgEl, containerEl) {
  if (!containerEl) return;
  containerEl.classList.remove('img-loaded');
  function markLoaded() { containerEl.classList.add('img-loaded'); }
  imgEl.addEventListener('load', markLoaded, { once: true });
  imgEl.addEventListener('error', markLoaded, { once: true });
}
// 後方互換
function watchImgLoad(imgEl, containerEl) { prepareImgLoad(imgEl, containerEl); }
function showMangaLoader() {}
function hideMangaLoader() {}

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
// 全作品の表紙＋最小情報（即座にカード表示用、WP API取得後にgallery等をマージ）
const FALLBACK_WORKS = (function() {
  var F = [
    ['diamond','DIAMOND シャンパンコール','DIAMOND Champagne Call',11,'研修','spread'],
    ['ichinohe-home','一戸ホーム','Ichinohe Home',22,'営業','spread'],
    ['omatome-ninja','おまとめ忍者 見つけてみせる！トレンドの兆し','Omatome Ninja: Discovering Trend Signs',15,'紹介','spread'],
    ['omatome-ninja-2','おまとめ忍者 手間な議事録をこっそり要約','Omatome Ninja: Secretly Summarizing Meeting Notes',15,'紹介','spread'],
    ['omatome-ninja-3','おまとめ忍者 地獄のまとめ作業 拙者におまかせ！','Omatome Ninja: Leave the Tedious Summarizing to Me!',15,'紹介','spread'],
    ['omatome-ninja-4','おまとめ忍者 手書き派の悩み 拙者にお任せ！','Omatome Ninja: Helping the Handwriting Fans!',15,'紹介','spread'],
    ['omatome-ninja-5','おまとめ忍者 長時間会議も怖くない！','Omatome Ninja: No More Fear of Long Meetings!',15,'紹介','spread'],
    ['omatome-ninja-rohto','おまとめ忍者 忍者参上！！欠席者をお助けいたす！','Omatome Ninja: Here to Help Absentees!',15,'紹介','spread'],
    ['omatome-ninja-english','おまとめ忍者（海外版）','Omatome Ninja (Global Edition)',15,'紹介','spread'],
    ['seko','瀬古恭介 始まりのものがたり','Kyosuke Seko: A Story of Beginnings',25,'ブランド','spread'],
    ['life-buzfes','バズフェス','BuzzFes',25,'集客','spread'],
    ['life-school','バズスクール','Buzz School',26,'集客','spread'],
    ['bms-unso','BMS運送','BMS Transport',10,'採用','spread'],
    ['sixtones','SixTONES風キャラ','SixTONES-style Characters',4,'IP','spread'],
    ['torutoru-kun','トルトルくん','Torutoru-kun',21,'採用','spread'],
    ['hamada-masatada','濱田将匡 信頼を、つなぐ。','Masatada Hamada: Connecting Trust',20,'ブランド','spread'],
    ['asobi-kyary','ASOBI SYSTEM×きゃりーぱみゅぱみゅ','ASOBI SYSTEM x Kyary Pamyu Pamyu',6,'IP','spread'],
    ['uike-law','正義の価値','The Value of Justice',8,'ブランド','spread'],
    ['lady-column','レディーコラム','Lady Column',8,'紹介','spread']
  ];
  var out = {};
  F.forEach(function(r) {
    out[r[0]] = {
      title: r[1], title_en: r[2], pages: r[3],
      path: 'https://contentsx.jp/material/manga/' + r[0] + '/',
      tags: [r[4]], category: r[4],
      viewType: r[5]
    };
  });
  return out;
})();

// ===== カテゴリ英訳マップ =====
const CATEGORY_EN_MAP = {
  'すべて': 'All', '営業': 'Sales', '採用': 'Recruitment', '研修': 'Training',
  '集客': 'Marketing', '紹介': 'Introduction', 'ブランド': 'Branding',
  'IP': 'IP', 'プロモーション': 'Promotion', 'その他': 'Other', '創業ストーリー': 'Founding Story'
};

// ===== フィルタボタン生成 =====
const worksFilter = document.getElementById('worksFilter');

function buildFilterButtons() {
  worksFilter.innerHTML = '';
  // 制作過程エントリはフィルタから除外
  const allWorks = Object.values(mangaData).filter(d => !d._isPreProduction);
  const categories = ['すべて'];
  allWorks.forEach(d => {
    if (d.category && !categories.includes(d.category)) categories.push(d.category);
  });
  const catCount = {};
  allWorks.forEach(d => {
    if (d.category) catCount[d.category] = (catCount[d.category] || 0) + 1;
  });
  catCount['すべて'] = allWorks.length;

  const isEn = getBmLang() === 'en';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (cat === 'すべて' ? ' active' : '');
    btn.dataset.cat = cat;
    const catEn = CATEGORY_EN_MAP[cat] || cat;
    const labelJa = cat;
    const labelEn = catEn;
    btn.innerHTML = `<span data-ja="${labelJa}" data-en="${labelEn}">${isEn ? labelEn : labelJa}</span> <span class="filter-count">${catCount[cat]}</span>`;
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
  const isEn = getBmLang() === 'en';
  Object.entries(mangaData).forEach(([key, data]) => {
    // 制作過程（赤ペン・ネーム専用）エントリはカードに出さない
    if (data._isPreProduction) return;
    const card = document.createElement('div');
    card.className = 'work-card';
    card.setAttribute('data-manga', key);
    card.setAttribute('data-category', data.category);
    const coverSrc = data.thumbnail || getImageSrc(data, 0);
    const tallClass = data.tallCover ? ' tall-cover' : '';
    const titleEn = data.title_en || (window.i18n && window.i18n.t ? window.i18n.t(data.title) : data.title);
    const catEn = CATEGORY_EN_MAP[data.category] || data.category || '';
    card.innerHTML = `
      <div class="work-card-img-wrapper${tallClass}">
        <img class="work-card-img" src="${coverSrc}" alt="${data.title}" loading="lazy">
        ${data.category ? `<span class="work-card-category" data-ja="${data.category}" data-en="${catEn}">${isEn ? catEn : data.category}</span>` : ''}
        <span class="work-card-page-count">${data.pages}P</span>
      </div>
      <div class="work-card-body">
        <div class="work-card-title" data-ja="${data.title}" data-en="${titleEn}">${isEn ? titleEn : data.title}</div>
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

// ===== 表紙の縦長自動検出（カード表示修正用） =====
function probeCoverImages() {
  document.querySelectorAll('.work-card').forEach(function(card) {
    var key = card.dataset.manga;
    var data = mangaData[key];
    if (!data) return;
    var wrapper = card.querySelector('.work-card-img-wrapper');
    var img = card.querySelector('.work-card-img');
    if (!wrapper || !img) return;

    // WPでvertical指定済み → プローブ不要、tall-coverだけ確実に付ける
    if (data.tallCover) {
      wrapper.classList.add('tall-cover');
      return;
    }

    function checkTall() {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        var ratio = img.naturalHeight / img.naturalWidth;
        if (ratio > 1.8) {
          data.tallCover = true;
          data.verticalOnly = true;
          data.viewType = 'vertical';
          wrapper.classList.add('tall-cover');
        }
      }
    }
    if (img.complete && img.naturalWidth > 0) {
      checkTall();
    } else {
      img.addEventListener('load', checkTall);
    }
  });
}

// フォールバックデータで即座に構築
Object.assign(mangaData, FALLBACK_WORKS);
initLibraryUI();
probeCoverImages();  // 表紙の縦長自動検出

// 現在の言語が英語なら即座に反映
if (getBmLang() === 'en') {
  if (window.i18n && window.i18n.translateAll) {
    window.i18n.translateAll();
  } else if (typeof window.bmSwitchLang === 'function') {
    window.bmSwitchLang('en');
  }
}

// WP API からデータ取得して上書き
(function fetchLibraryFromAPI() {
  fetch('https://cms.contentsx.jp/wp-json/contentsx/v1/library')
    .then(function(res) { return res.json(); })
    .then(function(works) {
      if (!Array.isArray(works) || works.length === 0) return;

      // APIの並び順を尊重するため、漫画作品は一度全削除してAPI順で再登録
      // （プリプロ関連データ _isPreProduction は保持）
      var apiIds = {};
      Object.keys(mangaData).forEach(function(k) {
        if (!mangaData[k]._isPreProduction) delete mangaData[k];
      });
      works.forEach(function(w) {
        apiIds[w.id] = true;
        var galleryLen = (w.gallery && w.gallery.length) || 0;
        var pages = w.pages || 0;
        if (galleryLen > 0 && pages > galleryLen) {
          pages = galleryLen;
        }
        mangaData[w.id] = {
          title: w.title_ja || '',
          title_en: w.title_en || '',
          pages: pages,
          path: 'https://contentsx.jp/material/manga/' + w.id + '/',
          tags: w.tags && w.tags.length > 0 ? w.tags : [],
          category: w.category || '',
          viewType: w.view_type || 'spread',
          verticalOnly: w.view_type === 'vertical_only',
          tallCover: w.tall_cover || w.view_type === 'vertical_only',
          thumbnail: w.thumbnail || '',
          gallery: w.gallery || [],
          akapen_gallery: w.akapen_gallery || [],
          name_gallery: w.name_gallery || [],
        };
        if (w.view_type === 'vertical_only' || w.view_type === 'vertical') {
          mangaData[w.id].viewType = 'vertical';
        }
      });

      // フィルター状態とページを保持してUI再構築
      var activeFilter = worksFilter.querySelector('.filter-btn.active');
      var savedCategory = activeFilter ? activeFilter.dataset.cat : 'すべて';
      var savedPage = gridCurrentPage;
      initLibraryUI();
      // フィルターを復元
      if (savedCategory !== 'すべて') {
        var targetBtn = worksFilter.querySelector('.filter-btn[data-cat="' + savedCategory + '"]');
        if (targetBtn) {
          targetBtn.click();
          gridCurrentPage = savedPage;
          updateGridPagination();
        }
      } else {
        gridCurrentPage = savedPage;
        updateGridPagination();
      }
      probeCoverImages();  // WP APIデータでも表紙の縦長自動検出

      // 赤ペン・ネームカルーセルも再構築
      if (typeof rebuildPreCarousels === 'function') rebuildPreCarousels();

      // ダイレクトモードで既にモーダルが開いている場合、APIの正しいviewTypeで再オープン
      if (isDirectMode && autoOpen && mangaData[autoOpen] && mangaModal.classList.contains('open')) {
        var newMode = mangaData[autoOpen].viewType || 'spread';
        if (newMode !== currentViewMode) {
          console.log('[works] ダイレクトモード: APIデータで再オープン (' + currentViewMode + ' → ' + newMode + ')');
          // closeManga()はダイレクトモードでページ遷移するので、UIだけリセット
          while (modalManga.firstChild) modalManga.removeChild(modalManga.firstChild);
          if (verticalObserver) { verticalObserver.disconnect(); verticalObserver = null; }
          modalPageEls = []; modalThumbItems = []; modalDots = [];
          mangaModal.classList.remove('open');
          document.body.style.overflow = '';
          setTimeout(function() { openManga(autoOpen); }, 50);
        }
      }
      // ダイレクトモードでまだモーダルが開いていない場合（mangaDataに無かった）
      if (isDirectMode && autoOpen && mangaData[autoOpen] && !mangaModal.classList.contains('open')) {
        openManga(autoOpen);
      }
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
  modalTitle.setAttribute('data-ja', data.title);
  modalTitle.setAttribute('data-en', data.title_en || (window.i18n && window.i18n.t ? window.i18n.t(data.title) : data.title));
  modalTitle.textContent = getBmLang() === 'en' ? (data.title_en || (window.i18n && window.i18n.t ? window.i18n.t(data.title) : data.title)) : data.title;
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
    img.onerror = function() { this.style.display = 'none'; };
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

  // ギャラリーがある場合、実際の画像数にpagesを補正（存在しないページの読み込みを防止）
  if (data.gallery && data.gallery.length > 0 && data.pages > data.gallery.length) {
    data.pages = data.gallery.length;
  }

  // 1枚目の画像をプローブして縦長判定 → 自動でverticalに切り替え
  const firstSrc = getImageSrc(data, 0);
  const probe = new Image();
  probe.src = firstSrc;

  function proceedOpen() {
    // 縦長自動検出: height/width > 1.8 なら縦読みに強制切り替え
    if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
      const ratio = probe.naturalHeight / probe.naturalWidth;
      if (ratio > 1.8) {
        data.viewType = 'vertical';
        data.tallCover = true;
        data.verticalOnly = true; // 見開き不可
      }
    }
    // WPでvertical_only指定の場合もロック
    if (data.verticalOnly) {
      data.viewType = 'vertical';
    }

    // viewTypeに基づいてビューアモードを決定
    // スマホではspreadタイプも縦スクロールで表示
    const dataMode = data.viewType || 'spread';
    const mode = (!isPC() && dataMode === 'spread') ? 'vertical' : dataMode;
    currentViewMode = mode;

    // Set mode class for CSS background switching
    mangaModal.classList.remove('mode-vertical', 'mode-spread');
    mangaModal.classList.add('mode-' + mode);

    modalTitle.setAttribute('data-ja', data.title);
    modalTitle.setAttribute('data-en', data.title_en || (window.i18n && window.i18n.t ? window.i18n.t(data.title) : data.title));
    modalTitle.textContent = getBmLang() === 'en' ? (data.title_en || (window.i18n && window.i18n.t ? window.i18n.t(data.title) : data.title)) : data.title;
    currentMangaKey = key; // トグルボタン用に早期セット

    // 切り替えボタンの表示制御（PC + 非verticalOnlyのみ）
    updateViewToggle(mode, data.verticalOnly);

    // Pause pre-production carousels while modal is open
    if (typeof pauseAllCarousels === 'function') pauseAllCarousels();

    // Preload first pages then open viewer immediately with loading state
    var firstPages = [getImageSrc(data, 0), getImageSrc(data, 1)];
    if (data.pages >= 3) firstPages.push(getImageSrc(data, 2));
    if (data.pages >= 4) firstPages.push(getImageSrc(data, 3));

    // Show modal immediately with loading indicator
    showMangaLoader();
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

    // Preload in background, hide loader when first pages ready
    preloadImages(firstPages, 2000).then(function() {
      hideMangaLoader();
    });
  }

  // 画像がキャッシュ済みなら即座に、そうでなければロード後に判定
  if (probe.complete && probe.naturalWidth > 0) {
    proceedOpen();
  } else {
    probe.onload = proceedOpen;
    probe.onerror = proceedOpen;
  }

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

let currentViewMode = 'spread';
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

// 画像ロード完了を待つヘルパー（タイムアウト付き）
function waitForImage(imgEl, callback, timeout) {
  if (imgEl.complete && imgEl.naturalWidth > 0) {
    callback();
    return;
  }
  var done = false;
  function finish() {
    if (done) return;
    done = true;
    imgEl.onload = null;
    imgEl.onerror = null;
    callback();
  }
  imgEl.onload = finish;
  imgEl.onerror = finish;
  // 安全策: 最大待ち時間
  setTimeout(finish, timeout || 3000);
}

function showSpread(index, onReady) {
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

    // リスナーを先に付けてからsrcをセット
    prepareImgLoad(imgRight, pageRight);
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

    // リスナーを先に付けてからsrcをセット
    prepareImgLoad(imgRight, pageRight);
    prepareImgLoad(imgLeft, pageLeft);
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

  // 画像ロード完了コールバック（goNext/goPrev で isSpreadAnimating 解除に使用）
  if (typeof onReady === 'function') {
    if (leftNum === null || pageLeft.style.display === 'none') {
      // 右ページのみ
      waitForImage(imgRight, onReady);
    } else {
      // 両ページのロード待ち
      var count = 2;
      function check() { if (--count <= 0) onReady(); }
      waitForImage(imgRight, check);
      waitForImage(imgLeft, check);
    }
  }
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
    var mp = document.getElementById('mobilePage');
    mp.src = spreadPageSrc(currentMangaPath, 1);
    watchImgLoad(mp, mobileContainer);
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

    showSpread(nextIndex, function() {
      isSpreadAnimating = false;
    });
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

    showSpread(prevIndex, function() {
      isSpreadAnimating = false;
    });
  }, FLIP_DURATION + 30);
}

function isPC() { return window.innerWidth >= 769; }

const mobilePage = document.getElementById('mobilePage');
const mobileContainer = document.getElementById('mobileContainer');
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
    watchImgLoad(mobilePage, mobileContainer);
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
  // ダイレクトモード: 前のページに戻るか、ホームへ遷移
  if (isDirectMode) {
    if (document.referrer && document.referrer.indexOf(location.hostname) !== -1) {
      history.back();
    } else {
      location.href = './';
    }
    return;
  }

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
  hideMangaLoader();

  // Resume pre-production carousels from same position
  if (typeof resumeAllCarousels === 'function') resumeAllCarousels();
}

// ===== View Toggle Button (PC: spread ⇔ vertical) =====
var viewToggleBtn = document.getElementById('viewToggle');
var viewToggleIcon = document.getElementById('viewToggleIcon');
var viewToggleLabel = document.getElementById('viewToggleLabel');

function getBmLang() { return document.documentElement.lang || 'ja'; }

function updateViewToggle(mode, verticalOnly) {
  if (!viewToggleBtn) return;
  // スマホ or verticalOnly → ボタン非表示
  if (!isPC() || verticalOnly) {
    viewToggleBtn.style.display = 'none';
    return;
  }
  viewToggleBtn.style.display = 'flex';
  var isEn = getBmLang() === 'en';
  if (mode === 'vertical') {
    viewToggleIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="8" height="18" rx="1"/><rect x="14" y="3" width="8" height="18" rx="1"/></svg>';
    viewToggleLabel.setAttribute('data-ja', '見開き');
    viewToggleLabel.setAttribute('data-en', 'Spread View');
    viewToggleLabel.textContent = isEn ? 'Spread View' : '見開き';
  } else {
    viewToggleIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="14" y2="16"/></svg>';
    viewToggleLabel.setAttribute('data-ja', '縦読み');
    viewToggleLabel.setAttribute('data-en', 'Vertical Scroll');
    viewToggleLabel.textContent = isEn ? 'Vertical Scroll' : '縦読み';
  }
}

if (viewToggleBtn) {
  viewToggleBtn.addEventListener('click', function() {
    if (!currentMangaKey || !mangaData[currentMangaKey]) return;
    var data = mangaData[currentMangaKey];
    if (data.verticalOnly) return; // 切り替え不可

    // 現在のモードを切り替え
    var newMode = (currentViewMode === 'spread') ? 'vertical' : 'spread';
    currentViewMode = newMode;

    // CSS class 切り替え
    mangaModal.classList.remove('mode-vertical', 'mode-spread');
    mangaModal.classList.add('mode-' + newMode);

    // ボタンラベル更新
    updateViewToggle(newMode, false);

    // ビューア切り替え
    if (newMode === 'vertical') {
      showVerticalElements();
      hideSpreadElements();
      openVerticalViewer(currentMangaKey, data);
    } else {
      hideVerticalElements();
      showSpreadElements();
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          openSpreadViewer(currentMangaKey, data);
        });
      });
    }
  });
}

document.getElementById('modalClose').addEventListener('click', () => {
  // ダイレクトモード(QR)では閉じさせない(ビズ書庫へ戻らないように)
  if (isDirectMode) return;
  history.back(); // triggers popstate → closeManga
});
document.addEventListener('keydown', (e) => {
  if (!mangaModal.classList.contains('open')) return;
  if (e.key === 'Escape') {
    // ダイレクトモードではESCも無効
    if (isDirectMode) return;
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

// 制作過程のフォールバックデータを先に登録（pre-red-*, pre-name-* のダイレクトアクセス用）
// FALLBACK_PRE_DATA を直接 mangaData に登録
(function() {
  var fb = {
    red: [
      { key: 'pre-red-bms', title: 'BMS 運送 赤入れ', path: 'https://contentsx.jp/material/pre/red/bms-unso-red/', pages: 8 },
        { key: 'pre-red-ichinohe', title: '一戸ホーム 赤入れ', path: 'https://contentsx.jp/material/pre/red/ichinohe-red/', pages: 20 }
    ],
    name: [
      { key: 'pre-name-fax', title: 'BMS FAX ネーム', path: 'https://contentsx.jp/material/pre/name/bmsfax/', pages: 9 },
      { key: 'pre-name-ichinohe', title: '一戸ホーム ネーム', path: 'https://contentsx.jp/material/pre/name/ichinohe-name/', pages: 20 }
    ]
  };
  [].concat(fb.red, fb.name).forEach(function(item) {
    if (!mangaData[item.key]) {
      mangaData[item.key] = {
        title: item.title, pages: item.pages, path: item.path,
        gallery: [], tags: [], category: '制作過程',
        viewType: 'vertical', _isPreProduction: true
      };
    }
  });
})();

if (isDirectMode) {
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

  if (mangaData[autoOpen]) {
    // FALLBACK or library API で既に取得済み
    openManga(autoOpen);
  } else {
    // /manga/{id} エンドポイントで単一作品取得（表示フラグ無関係）
    const apiBase = (window.BM_WP_CONFIG && window.BM_WP_CONFIG.apiBase) || 'https://cms.contentsx.jp/wp-json/contentsx/v1';
    fetch(apiBase + '/manga/' + encodeURIComponent(autoOpen))
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(data) {
        if (!data || !data.id) throw new Error('invalid data');
        // mangaDataに登録してopenManga
        mangaData[data.id] = {
          id: data.id,
          title: data.title_ja || data.id,
          title_en: data.title_en || data.title_ja || data.id,
          pages: data.pages || (data.gallery && data.gallery.length) || 1,
          category: data.category || '',
          tags: [],
          gallery: data.gallery || [],
          thumbnail: data.thumbnail || '',
          viewType: (data.gallery && data.gallery.length > 0 && data.gallery[0].indexOf('webtoon') !== -1) ? 'vertical' : 'spread',
          point: data.point || '',
          comment: data.comment || ''
        };
        openManga(autoOpen);
      })
      .catch(function(err) {
        console.warn('[direct-mode] manga fetch failed:', err.message);
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#fff;background:#1a1a1a;font-size:16px;text-align:center;padding:24px;">作品が見つかりませんでした。<br><br><a href="/" style="color:#eb5200;">トップページへ戻る</a></div>';
      });
  }
}

// ===== Pre-production Carousels (赤ペン・ネーム) =====
// pauseAllCarousels / resumeAllCarousels はファイル先頭で宣言済み

// フォールバック用の赤ペン・ネームデータ
const FALLBACK_PRE_DATA = {
  red: [
    { key: 'pre-red-bms', title: 'BMS 運送 赤入れ', path: 'https://contentsx.jp/material/pre/red/bms-unso-red/', pages: 8 },
    { key: 'pre-red-ichinohe', title: '一戸ホーム 赤入れ', path: 'https://contentsx.jp/material/pre/red/ichinohe-red/', pages: 20 }
  ],
  name: [
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
        viewType: 'vertical',
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

  // カルーセル再描画の共通処理
  function doRebuild() {
    preCarouselTimers.forEach(function(t) { t.pause(); });
    preCarouselTimers = [];
    ['red', 'name'].forEach(function(type) {
      var track = document.getElementById(type + 'Track');
      if (track) track.innerHTML = '';
    });
    try { initCarousel('red'); } catch(e) { console.error('Red carousel rebuild error:', e); }
    try { initCarousel('name'); } catch(e) { console.error('Name carousel rebuild error:', e); }
  }

  // API取得後にカルーセルを再構築するためのグローバル関数
  window.rebuildPreCarousels = function() {
    // まず既存のmanga_workデータから赤ペン・ネームを構築
    buildPreDataFromAPI();
    registerFallbackPreData();

    // 次に専用APIからも取得して統合
    var apiBase = window.BM_WP_CONFIG ? window.BM_WP_CONFIG.apiBase : 'https://cms.contentsx.jp/wp-json/contentsx/v1';
    fetch(apiBase + '/preproduction')
      .then(function(r) {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then(function(data) {
        if (!data || data.length === 0) { doRebuild(); return; }
        var apiRed = [];
        var apiName = [];
        data.forEach(function(item) {
          var key = 'pre-' + (item.type === 'akapen' ? 'red' : 'name') + '-wp' + item.id;
          var entry = {
            key: key,
            title: item.title,
            path: '',
            pages: item.pages,
            gallery: item.gallery
          };
          if (item.type === 'akapen') {
            apiRed.push(entry);
          } else {
            apiName.push(entry);
          }
          // mangaDataに登録してビューアで開けるようにする
          mangaData[key] = {
            title: item.title,
            pages: item.pages,
            path: '',
            gallery: item.gallery,
            tags: [],
            category: '制作過程',
            viewType: 'vertical',
            _isPreProduction: true
          };
        });
        // 専用APIのデータがあればフォールバック＋manga_workデータを上書き
        if (apiRed.length > 0) preData.red = apiRed;
        if (apiName.length > 0) preData.name = apiName;
        doRebuild();
      })
      .catch(function() {
        doRebuild();
      });
  };
})();
