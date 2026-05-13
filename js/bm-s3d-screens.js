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
    // 左右スマホは下から押し上げる + フェード + 縮小スタート
    gsap.set(others, { opacity: 0, scale: 0.55, y: 60 });
    gsap.set(labels, { opacity: 0, y: -12 });
    // CSS の transform: translateX(-50%) は GSAP の transform 書き換えで消えるため、
    // xPercent: -50 を明示して中央寄せを維持する（SP は position: static のため不要）
    var isSP = window.matchMedia('(max-width: 768px)').matches;
    if (heading) gsap.set(heading, isSP ? { autoAlpha: 0, y: 12 } : { autoAlpha: 0, y: 12, xPercent: -50 });

    // 1.4秒 → 約2.7秒に伸ばし、各段階の余韻を作る
    var tl = gsap.timeline({ paused: true });
    // (1) 中央スマホがゆっくり viewport サイズに収まる
    tl.to(wrap,    { scale: 1, ease: 'power3.out', duration: 1.6 }, 0);
    // (2) 左右スマホが少し遅れて、下から押し上がる + 拡大しながらフェードイン
    tl.to(others,  { opacity: 1, scale: 1, y: 0, ease: 'power3.out', duration: 1.1, stagger: 0.22 }, 0.55);
    // (3) 各ラベルが上からふわっと
    tl.to(labels,  { opacity: 1, y: 0, ease: 'power2.out', duration: 0.7, stagger: 0.14 }, 1.7);
    // (4) 見出しは下からふわり
    if (heading) tl.to(heading, isSP
      ? { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.8 }
      : { autoAlpha: 1, y: 0, xPercent: -50, ease: 'power2.out', duration: 0.8 }, 1.5);
    // (5) iframe 操作可能化 / CTA 表示は最後に
    tl.call(function() { group.classList.add('is-settled'); }, null, 2.3);
    if (cta) tl.call(function() { cta.classList.add('is-shown'); }, null, 2.5);

    ScrollTrigger.create({
      trigger: '#s3dSection',
      // 80% (≒ 上端が viewport にちょっと顔を出した瞬間) でアニメ開始
      start: 'top 80%',
      once: true,
      onEnter: function() {
        if (scrollHint) scrollHint.classList.add('is-hidden');
        tl.play();
      }
    });

    // SP用 ボイスコミック 音声ON/OFFトグル (YouTube IFrame API postMessage)
    var muteBtn = document.getElementById('s3dMuteToggle');
    var ytIframe = document.getElementById('s3dVideoIframe');
    if (muteBtn && ytIframe) {
      muteBtn.addEventListener('click', function() {
        var isMuted = muteBtn.getAttribute('data-muted') === 'true';
        var cmd = isMuted
          ? '{"event":"command","func":"unMute","args":""}'
          : '{"event":"command","func":"mute","args":""}';
        try {
          ytIframe.contentWindow.postMessage(cmd, '*');
        } catch (e) {}
        muteBtn.setAttribute('data-muted', isMuted ? 'false' : 'true');
        var newLabel = isMuted ? 'ボイスコミックの音声をオフにする' : 'ボイスコミックの音声をオンにする';
        muteBtn.setAttribute('aria-label', newLabel);
        var textEl = muteBtn.querySelector('.s3d-mute-text');
        if (textEl) textEl.textContent = newLabel;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
