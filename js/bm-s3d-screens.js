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

    // 冒頭/末尾の hold は削除 — 「スマホ静止状態でスクロール消化」を減らす
    var tl = gsap.timeline({ paused: true });
    tl.to(wrap,   { scale: 1, ease: 'power3.out', duration: 0.45 }, 0);
    tl.to(others, { opacity: 1, scale: 1, ease: 'power3.out', duration: 0.3, stagger: 0.05 }, 0.2);
    tl.to(labels, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.3, stagger: 0.06 }, 0.55);

    var maxP = 0;
    ScrollTrigger.create({
      trigger: '#s3dSection',
      start: 'top 20%',
      // pin 期間を短縮: アニメ完了後の静止時間を削減
      end: '+=100%',
      pin: '#s3dStage',
      anticipatePin: 1,
      onUpdate: function(self) {
        if (self.progress > maxP) {
          maxP = self.progress;
          tl.progress(maxP);
        }
        if (maxP >= 0.7) group.classList.add('is-settled');
        if (maxP > 0.1 && scrollHint) scrollHint.classList.add('is-hidden');
        if (maxP > 0.6 && heading) heading.classList.add('is-shown');
      },
      onLeave: function(self) {
        // pin 終点まで到達したら trigger を kill → pin 解除、以降再発動なし
        // 上スクロール時も phones は静止 pin されず自然に流れる
        maxP = 1;
        tl.progress(1);
        group.classList.add('is-settled');
        if (heading) heading.classList.add('is-shown');
        self.kill(false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
