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

    // セクションが画面に入ったら、保留中の embed-viewer iframe に開始合図を送る
    var iframeStartFired = false;
    function startEmbedIframes() {
      if (iframeStartFired) return;
      iframeStartFired = true;
      var iframes = section.querySelectorAll('.s3d-screen iframe');
      iframes.forEach(function(f) {
        try { f.contentWindow && f.contentWindow.postMessage('s3d-start', '*'); } catch (e) {}
      });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(en) {
          if (en.isIntersecting) { startEmbedIframes(); io.disconnect(); }
        });
      }, { threshold: 0.15 });
      io.observe(section);
    } else {
      // 古いブラウザ向けフォールバック: 即時開始
      startEmbedIframes();
    }
    // iframe のロード完了タイミングがセクション到達後の場合に備え、load 後にも再送
    section.querySelectorAll('.s3d-screen iframe').forEach(function(f) {
      f.addEventListener('load', function() {
        if (iframeStartFired) {
          try { f.contentWindow && f.contentWindow.postMessage('s3d-start', '*'); } catch (e) {}
        }
      });
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
    var cta = document.getElementById('s3dCta');

    // 初期は中央スマホを大きく見せる(viewport 高さに迫る迫力)
    var initScale = window.matchMedia('(max-width: 768px)').matches ? 2.8 : 1.55;
    gsap.set(wrap, { scale: initScale, transformOrigin: '50% 0%' });
    gsap.set(others, { opacity: 0, scale: 0.6 });
    gsap.set(labels, { opacity: 0, y: -8 });
    if (heading) gsap.set(heading, { autoAlpha: 0 });

    // セクションが viewport に入った時に一度だけ自動再生(scroll 奪取なし)
    var tl = gsap.timeline({ paused: true });
    tl.to(wrap,   { scale: 1, ease: 'power3.out', duration: 0.85 }, 0);
    tl.to(others, { opacity: 1, scale: 1, ease: 'power3.out', duration: 0.55, stagger: 0.1 }, 0.3);
    tl.to(labels, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.45, stagger: 0.1 }, 0.95);
    if (heading) tl.to(heading, { autoAlpha: 1, duration: 0.5 }, 0.8);
    tl.call(function() { group.classList.add('is-settled'); }, null, 1.1);
    if (cta) tl.call(function() { cta.classList.add('is-shown'); }, null, 1.2);

    ScrollTrigger.create({
      trigger: '#s3dSection',
      // セクション上部が viewport の 65% に到達(≒半分ほど見えた瞬間)でアニメ開始
      start: 'top 65%',
      once: true,
      onEnter: function() {
        if (scrollHint) scrollHint.classList.add('is-hidden');
        tl.play();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
