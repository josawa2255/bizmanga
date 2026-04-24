// 3Dスマホ端末ギャラリー 制御 (GSAP ScrollTrigger 使用)
// 依存: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/{gsap,ScrollTrigger}.min.js
(function() {
  'use strict';

  function init() {
    var section = document.getElementById('s3dSection');
    if (!section) return;

    var screens = section.querySelectorAll('.s3d-screen');
    screens.forEach(function(s, i) {
      setTimeout(function() { s.classList.add('is-ready'); }, 150 + i * 120);
    });

    if (!(window.gsap && window.ScrollTrigger)) return;

    gsap.registerPlugin(ScrollTrigger);
    var wrap   = document.getElementById('s3dScreensWrap');
    var group  = document.getElementById('s3dScreens');
    var others = Array.prototype.slice.call(
      group.querySelectorAll('.s3d-screen:not(.s3d-screen--hero)')
    );
    var labels = Array.prototype.slice.call(document.querySelectorAll('.s3d-label'));
    var heading = document.getElementById('s3dHeading');
    var scrollHint = document.getElementById('s3dScrollHint');

    var initScale = window.matchMedia('(max-width: 768px)').matches ? 2.8 : 1.25;
    gsap.set(wrap, { scale: initScale, transformOrigin: '50% 0%' });
    gsap.set(others, { opacity: 0, scale: 0.6 });
    gsap.set(labels, { opacity: 0, y: -8 });

    var tl = gsap.timeline({ paused: true });
    tl.to({}, { duration: 0.35 });
    tl.to(wrap, { scale: 1, ease: 'power3.out', duration: 0.4 }, 0.35);
    tl.to(others, { opacity: 1, scale: 1, ease: 'power3.out', duration: 0.25, stagger: 0.05 }, 0.5);
    tl.to(labels, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.25, stagger: 0.06 }, 0.7);
    tl.to({}, { duration: 0.25 });

    var maxP = 0;
    ScrollTrigger.create({
      trigger: '#s3dSection',
      start: 'top 20%',
      end: '+=180%',
      pin: '#s3dStage',
      anticipatePin: 1,
      onUpdate: function(self) {
        if (self.progress > maxP) {
          maxP = self.progress;
          tl.progress(maxP);
        }
        if (maxP >= 0.75) group.classList.add('is-settled');
        if (maxP > 0.15 && scrollHint) scrollHint.classList.add('is-hidden');
        if (maxP > 0.75 && heading) heading.classList.add('is-shown');
      },
      onLeave: function() {
        maxP = 1;
        tl.progress(1);
        group.classList.add('is-settled');
        if (heading) heading.classList.add('is-shown');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
