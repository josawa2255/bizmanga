/* ===================================================================
 * BizManga LP — v2 interactions
 *   - Sticky chapter nav with scrollspy
 *   - Panel "+/−" toggle for pain/merit detail cards
 *   - Reveal-on-scroll for .lpv2-reveal
 * Pilot: recruit-manga.html (2026-05-13)
 * =================================================================== */
(function () {
  'use strict';

  /* -------------------------------------------------------------- */
  /* 1. Panel toggle — click anywhere on [data-lpv2-toggle] expands  */
  /* -------------------------------------------------------------- */
  function bindPanelToggles() {
    var panels = document.querySelectorAll('[data-lpv2-toggle]');
    panels.forEach(function (panel) {
      panel.addEventListener('click', function (e) {
        // Allow nested links/buttons that aren't the "more" trigger
        var target = e.target;
        if (target.closest('a')) return;
        // Toggle
        var isOpen = panel.classList.toggle('is-open');
        // Sync aria on the "more" button if present
        var moreBtn = panel.querySelector('.lpv2-pain__more, .lpv2-merit-card__more');
        if (moreBtn) moreBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }

  /* -------------------------------------------------------------- */
  /* 2. Scrollspy for sticky chapter nav                             */
  /* -------------------------------------------------------------- */
  function bindScrollspy() {
    var toc = document.getElementById('lpv2Toc');
    if (!toc) return;
    var links = Array.prototype.slice.call(toc.querySelectorAll('.lpv2-toc-link'));
    if (!links.length) return;

    var sections = links
      .map(function (a) {
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) !== '#') return null;
        var el = document.getElementById(href.slice(1));
        return el ? { link: a, section: el } : null;
      })
      .filter(Boolean);

    if (!sections.length) return;

    // Smooth-scroll with offset to account for sticky header + toc
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) !== '#') return;
        var target = document.getElementById(href.slice(1));
        if (!target) return;
        e.preventDefault();
        var headerH = 68;
        var tocH = toc.offsetHeight || 56;
        var y = target.getBoundingClientRect().top + window.pageYOffset - (headerH + tocH - 4);
        window.scrollTo({ top: y, behavior: 'smooth' });
      });
    });

    // IntersectionObserver for active highlighting
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var match = sections.find(function (s) {
              return s.section === entry.target;
            });
            if (!match) return;
            if (entry.isIntersecting) {
              links.forEach(function (l) {
                l.classList.remove('is-active');
              });
              match.link.classList.add('is-active');
            }
          });
        },
        {
          // Trigger when section's top crosses 30% from top of viewport
          rootMargin: '-30% 0px -60% 0px',
          threshold: 0,
        }
      );
      sections.forEach(function (s) {
        observer.observe(s.section);
      });
    }
  }

  /* -------------------------------------------------------------- */
  /* 3. Reveal-on-scroll                                             */
  /* -------------------------------------------------------------- */
  function bindReveal() {
    var els = document.querySelectorAll('.lpv2-reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    els.forEach(function (el) {
      io.observe(el);
    });
  }

  function init() {
    bindPanelToggles();
    bindScrollspy();
    bindReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
