/* ===================================================================
 * BizManga LP — v2 interactions
 *   - Panel "+/−" toggle for pain/merit detail cards
 *   - Reveal-on-scroll for .lpv2-reveal
 *   - Flow step flip
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
  /* 2. Reveal-on-scroll                                             */
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

  /* -------------------------------------------------------------- */
  /* 3. Flow step flip — click flips the card to reveal the detail   */
  /* -------------------------------------------------------------- */
  function bindFlowFlip() {
    var steps = document.querySelectorAll('.lpv2-flow-step');
    steps.forEach(function (step) {
      step.addEventListener('click', function () {
        var flipped = step.classList.toggle('is-flipped');
        step.setAttribute('aria-expanded', flipped ? 'true' : 'false');
      });
    });
  }

  function init() {
    bindPanelToggles();
    bindReveal();
    bindFlowFlip();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
