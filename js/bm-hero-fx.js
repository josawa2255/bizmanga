/**
 * BizManga Hero FX — 映画的演出エフェクト
 * - マウス追従パララックス（PC）
 * - スクロール連動フェードアウト＋スケール
 * - reduced-motion対応
 */
(function() {
  'use strict';

  var hero = document.getElementById('hero');
  if (!hero) return;

  var worksBg = document.getElementById('bmHeroWorksBg');
  var heroCenter = hero.querySelector('.bm-hero-center');
  var speedlines = hero.querySelector('.bm-hero-speedlines');
  var glow = hero.querySelector('.bm-hero-glow');

  // ===== タグライン1文字ずつ分割 =====
  var tagline = document.getElementById('heroTagline');
  if (tagline) {
    var text = tagline.textContent;
    var charCount = text.length;
    tagline.innerHTML = '';
    for (var ci = 0; ci < charCount; ci++) {
      var span = document.createElement('span');
      span.className = 'tl-char';
      span.textContent = text[ci];
      span.style.setProperty('--d', (1.6 + ci * 0.06) + 's');
      span.style.setProperty('--wd', (ci * 0.15) + 's');
      tagline.appendChild(span);
    }
    // 波打ち登場完了後にシャインを開始
    var lastCharDelay = 1.6 + (charCount - 1) * 0.06 + 0.6; // 最後の文字のdelay + duration
    setTimeout(function() {
      var chars = tagline.querySelectorAll('.tl-char');
      for (var j = 0; j < chars.length; j++) {
        chars[j].classList.add('wave-active');
      }
    }, lastCharDelay * 1000);
  }

  // reduced-motion チェック
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===== マウス追従パララックス（PCのみ） =====
  if (!prefersReducedMotion && window.innerWidth > 768) {
    var targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    var rafId = null;

    hero.addEventListener('mousemove', function(e) {
      var rect = hero.getBoundingClientRect();
      // -1〜1 に正規化
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    });

    hero.addEventListener('mouseleave', function() {
      targetX = 0;
      targetY = 0;
    });

    function animateParallax() {
      // lerp（線形補間）でなめらかに追従
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

      if (worksBg) {
        // 3Dパースペクティブ回転 + 平行移動
        worksBg.style.transform =
          'perspective(1200px)' +
          ' rotateY(' + (currentX * 3) + 'deg)' +
          ' rotateX(' + (currentY * -2) + 'deg)' +
          ' scale(1.08)' +
          ' translate(' + (currentX * -8) + 'px, ' + (currentY * -5) + 'px)';
      }
      if (speedlines) {
        speedlines.style.transform = 'translate(' + (currentX * 4) + 'px, ' + (currentY * 3) + 'px)';
      }

      rafId = requestAnimationFrame(animateParallax);
    }
    rafId = requestAnimationFrame(animateParallax);

    // ヒーロー外に出たらRAFを止める（パフォーマンス）
    var observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) {
        if (!rafId) rafId = requestAnimationFrame(animateParallax);
      } else {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }
    }, { threshold: 0 });
    observer.observe(hero);
  }

  // ===== スクロール連動フェードアウト =====
  // モバイルでは無効化（スクロールジャンク回避）
  if (!prefersReducedMotion && window.innerWidth > 768) {
    var ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function() {
        var scrollY = window.pageYOffset || document.documentElement.scrollTop;
        var heroH = hero.offsetHeight;
        var progress = Math.min(scrollY / (heroH * 0.6), 1); // 60%スクロールで完了

        // ヒーロー全体: スケールダウン + フェード
        var scale = 1 - progress * 0.08; // 1.0 → 0.92
        var opacity = 1 - progress * 0.7; // 1.0 → 0.3

        if (heroCenter) {
          heroCenter.style.transform = 'scale(' + scale + ')';
          heroCenter.style.opacity = Math.max(opacity, 0);
        }
        if (glow) {
          glow.style.opacity = Math.max(1 - progress * 1.2, 0);
        }
        if (speedlines) {
          speedlines.style.opacity = Math.max(1 - progress * 1.5, 0);
        }

        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
