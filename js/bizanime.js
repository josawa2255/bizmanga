/**
 * ビズアニメ (BIZ ANIME) — Hero 登場演出 + スクロール演出
 *
 * ■ この演出の考え方
 *   「iPadの中の映像を見る」→「映像へ近づく」→「画面へ吸い込まれる」→
 *   「映像そのものが世界になる」という体験を、DOM + CSS transform だけで作る。
 *   Three.js / WebGL は使わない。
 *
 * ■ スクロールを奪わない
 *   wheel の preventDefault、scroll lock、body overflow:hidden は一切しない。
 *   position:sticky のステージ内で、通常スクロール量から進捗(0〜1)を計算し
 *   transform と opacity だけを更新する（layout を触らない）。
 *
 * ■ 動画の読み込み
 *   MAIN VIDEO を最初から全部 iframe 化しない。初期はポスター画像だけ置き、
 *   その動画の出番が近づいた時に iframe/video を作る（LCP対策）。
 */
(function () {
  'use strict';

  var API = 'https://cms.contentsx.jp/wp-json/contentsx/v1/bizanime-videos';

  var hero    = document.getElementById('baHero');
  var device  = document.getElementById('baDevice');
  var screenE = document.getElementById('baScreen');
  var poster  = document.getElementById('baPoster');
  var frame   = device ? device.querySelector('.ba-device__frame') : null;
  if (!hero || !device || !screenE) return;
  /* スクロール演出で退場させる要素（キャラ含む）。
     .ba-copy 自体ではなく子要素を対象にする（スマホの display:contents 対策） */
  var fadeEls = Array.prototype.slice.call(hero.querySelectorAll(
    '.ba-eyebrow, .ba-title, .ba-lead, .ba-sub, .ba-cta-row, .ba-media, .ba-character'
  ));

  var reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================================================================
     1. 登場アニメーション（既存挙動を維持）
     ================================================================ */
  (function initIntro() {
    if (reduceMotion) return;
    var started = false;
    function start() {
      if (started) return;
      started = true;
      hero.classList.add('ba-anim');
    }
    var imgs = Array.prototype.slice.call(hero.querySelectorAll('img'));
    var pending = imgs.length;
    if (!pending) { start(); return; }
    imgs.forEach(function (img) {
      if (img.complete) { if (--pending === 0) start(); return; }
      var done = function () {
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        if (--pending === 0) start();
      };
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    });
    setTimeout(start, 1200);
  })();

  /* ================================================================
     2. 動画データの取得
     ---------------------------------------------------------------
     API が落ちても Hero を壊さない。取得できなければ静止画のままにする。
     ================================================================ */
  function fetchVideos() {
    return new Promise(function (resolve) {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 5000);
      fetch(API, { signal: ctrl.signal })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          clearTimeout(timer);
          resolve(d && Array.isArray(d.main) ? d : { main: [], cases: [] });
        })
        .catch(function () {
          clearTimeout(timer);
          resolve({ main: [], cases: [] });
        });
    });
  }

  /* ================================================================
     3. プレイヤー生成（provider別）
     ---------------------------------------------------------------
     URLは組み立て済みのものがAPIから来る（サーバー側で検証済み）。
     ここでも念のため許可ホストを確認してから DOM に入れる。
     ================================================================ */
  var ALLOWED = /^https:\/\/(www\.youtube-nocookie\.com|www\.youtube\.com|drive\.google\.com)\//;

  function buildPlayer(v) {
    if (!v) return null;

    if (v.provider === 'mp4' && /^https:\/\/.+\.mp4(\?|$)/i.test(v.src || '')) {
      var el = document.createElement('video');
      el.src = v.src;
      el.muted = true;            // 自動再生の条件を満たすため
      el.playsInline = true;
      el.loop = true;
      el.autoplay = true;
      el.preload = 'metadata';
      if (v.poster) el.poster = v.poster;
      return el;
    }

    if (!ALLOWED.test(v.embed || '')) return null;

    var ifr = document.createElement('iframe');
    var url = v.embed;
    if (v.provider === 'youtube') {
      // mute=1 でないとブラウザが自動再生を止める。音は音声ボタン（ユーザー操作）から
      // postMessage で unMute する。enablejsapi=1 はそのための指定
      // （iframe_api の外部スクリプトは読まない＝CSPに触れない。BUGS #030 回避）
      url += '?autoplay=1&mute=1&loop=1&playlist=' + encodeURIComponent(v.video_id) +
             '&controls=0&modestbranding=1&playsinline=1&rel=0&enablejsapi=1';
    }
    ifr.src = url;
    ifr.title = v.title || 'ビズアニメの制作事例';
    ifr.loading = 'lazy';
    ifr.allow = 'autoplay; encrypted-media; picture-in-picture';
    ifr.setAttribute('frameborder', '0');
    ifr.setAttribute('allowfullscreen', '');
    return ifr;
  }

  /* ================================================================
     4. スクロール演出
     ================================================================ */
  function initScrollStory(videos) {
    var main = videos.filter(function (v) { return v && (v.embed || v.src); });

    // 動画が無い場合は Hero を静止画のまま見せて終了（§34）
    if (!main.length) {
      if (poster) poster.style.backgroundImage =
        'url("/material/images/biz-anime/hero-player.webp")';
      return;
    }

    // 1本目のポスターを即表示（iframe はまだ作らない = LCP対策）
    if (poster && main[0].poster) {
      poster.style.backgroundImage = 'url("' + main[0].poster.replace(/["\\]/g, '') + '")';
    }

    if (reduceMotion) {
      // 動きを減らす設定: 拡大も角度変化もせず、1本目をその場で再生するだけ
      swapVideo(0, main);
      return;
    }

    /* --- ステージを作る ---
       Hero を sticky で貼り付け、その下にスクロール距離を稼ぐための
       空の領域を置く。距離は動画の本数から算出する（§33）。 */
    /* Hero と ステージを1つのラッパーで包む。
       sticky はスクロール余白を持つ親の中でしか効かないため。 */
    /* 共通CSSの html{overflow-x:hidden} はスクロールコンテナを作り sticky を無効化する。
       CSS側でも :has() で上書きしているが、未対応ブラウザ向けにここでも適用しておく。
       clip は横スクロール抑止の効果は同じで、スクロールコンテナを作らない。 */
    document.documentElement.style.overflowX = 'clip';
    document.body.style.overflowX = 'clip';   // body側も同様に効いている（実測）

    var wrap = document.createElement('div');
    wrap.className = 'ba-scroll-wrap';
    hero.parentNode.insertBefore(wrap, hero);
    wrap.appendChild(hero);

    var stage = document.createElement('div');
    stage.className = 'ba-stage';
    // 1本目: 拡大してフルスクリーンになるまで 180vh
    // 2本目以降: 縮小→切替→再拡大 で 1本あたり 150vh
    var vh = 180 + (main.length - 1) * 150;
    stage.style.height = vh + 'vh';
    wrap.appendChild(stage);
    hero.classList.add('ba-hero--sticky');
    // クラス適用後の寸法で基準を取り直す
    requestAnimationFrame(function () { measureBase(); update(); });

    var current = -1;      // いま画面に出している動画の index
    var ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    function update() {
      ticking = false;

      var rect = stage.getBoundingClientRect();
      var total = stage.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      // ステージ内の進捗 0〜1
      var p = Math.min(1, Math.max(0, -rect.top / total));

      // 動画1本あたりの区間長
      var seg = 1 / main.length;
      var idx = Math.min(main.length - 1, Math.floor(p / seg));
      var t   = (p - idx * seg) / seg;      // その区間内の進捗 0〜1

      /* --- 区間内のフェーズ ---
         0.00〜0.18 : 待機。コピーとキャラが退場する間、iPadはほぼ動かない
                      （拡大の始まりが早い、という指摘への調整 2026-08-30）
         0.18〜0.62 : 右から中央へ / 拡大 / 角度が正面へ
         0.62〜0.80 : フレームが消え、動画がフルスクリーンに
         0.80〜1.00 : 少し縮小してフレームが戻る（次の動画への繋ぎ）
         最後の動画では縮小フェーズを使わず、フルスクリーンのまま終わる */
      var isLast = (idx === main.length - 1);

      var grow, fade, shrink;
      if (t < 0.62) {
        grow = Math.max(0, (t - 0.18) / 0.44); fade = 0; shrink = 0;
      } else if (t < 0.8) {
        grow = 1; fade = (t - 0.62) / 0.18; shrink = 0;
      } else {
        grow = 1; fade = 1;
        shrink = isLast ? 0 : (t - 0.8) / 0.2;
      }

      var e = easeInOut(grow);

      // 右→中央へ。device は right 基準なので translate で戻す
      var dx = e * getCenterDX();
      var dy = e * getCenterDY();
      // 拡大: 画面を覆う倍率まで
      var sc = 1 + e * (coverScale() - 1);
      // 角度: 斜め → 正面
      var ry = -6 * (1 - e);
      var rz = -2.2 * (1 - e);

      // 縮小フェーズ（次の動画へ渡す前に一度引く §11）
      if (shrink > 0) {
        var s2 = easeInOut(shrink);
        sc = sc * (1 - 0.25 * s2);
      }

      device.style.setProperty('--ba-dev-x', dx.toFixed(1) + 'px');
      device.style.setProperty('--ba-dev-y', dy.toFixed(1) + 'px');
      device.style.setProperty('--ba-dev-scale', sc.toFixed(4));
      device.style.setProperty('--ba-dev-ry', ry.toFixed(2) + 'deg');
      device.style.setProperty('--ba-dev-rz', rz.toFixed(2) + 'deg');

      // フレームだけを消す（動画は残す）＝ iPad から映像へ移行する瞬間
      var frameOpacity = 1 - fade;
      if (shrink > 0) frameOpacity = Math.max(frameOpacity, easeInOut(shrink)); // 戻す
      if (frame) frame.style.opacity = frameOpacity.toFixed(3);

      // フレームが消えるにつれ、切り抜きを矩形へ戻して画面全体に見せる
      screenE.style.setProperty('--ba-clip', fade.toFixed(3));
      screenE.classList.toggle('is-full', fade > 0.98 && shrink === 0);

      // コピーとキャラはスクロール開始とともに退場させる。
      // ⚠️ .ba-copy はスマホで display:contents（箱を持たない）ため、
      //    親に opacity を掛けても効かない。個別要素に掛ける。
      var c = Math.min(1, p / (seg * 0.4));
      fadeEls.forEach(function (el) {
        el.style.opacity = (1 - c).toFixed(3);
        var dir = el.classList.contains('ba-character') ? 30 : -24;
        el.style.transform = 'translate3d(' + (dir * c).toFixed(1) + 'px,' +
                             (-10 * c).toFixed(1) + 'px,0)';
        el.style.pointerEvents = c > 0.5 ? 'none' : '';
      });

      // 出番の動画を差し替える。
      // 初回(idx=0)だけはページ読込完了まで遅らせ、ポスター表示を先に立たせる（LCP対策 §24）。
      // スクロールが始まっていれば読込完了を待たずに生成する（体験優先）。
      if (idx !== current) {
        var deferFirst = (current === -1 && idx === 0 &&
                          document.readyState !== 'complete' && p === 0);
        if (!deferFirst) {
          current = idx;
          swapVideo(idx, main);
          preload(idx + 1, main);   // 次の1本だけ先読み（§23）
        }
      }
    }

    /* --- 基準値 ---
       ⚠️ 変形後の getBoundingClientRect から次の変形量を計算すると
          「大きくする→さらに大きく測れる→もっと大きくする」の無限ループになる。
          そこで transform を一度外した素の寸法・位置を基準として持ち、
          そこからの相対量で毎回計算する。 */
    var base = null;
    function measureBase() {
      var prev = device.style.transform;
      device.style.transform = 'none';
      var r = device.getBoundingClientRect();
      // Hero は sticky なので、Hero 上端からの相対位置で覚える
      var hr = hero.getBoundingClientRect();
      base = {
        w: r.width,
        h: r.height,
        cx: r.left + r.width / 2,
        cy: (r.top - hr.top) + r.height / 2   // Hero内での中心Y
      };
      device.style.transform = prev;
    }
    measureBase();

    function getCenterDX() { return base ? (window.innerWidth / 2 - base.cx) : 0; }
    function getCenterDY() {
      if (!base) return 0;
      // Hero は画面に貼り付いている。Hero内での中心Yを画面中央へ寄せる
      var heroTop = parseFloat(getComputedStyle(hero).top) || 0;
      return (window.innerHeight / 2) - (heroTop + base.cy);
    }
    // 「フルスクリーン」時の倍率（素の寸法から算出するので発散しない）。
    // 横画面(PC): 画面全体を覆う cover
    // 縦画面(スマホ): 横動画を cover まで広げると左右が大きくはみ出すため、
    //                 幅フィットで止める（YouTubeの縦画面視聴と同じ。上下は黒帯）
    function coverScale() {
      if (!base || !base.w || !base.h) return 2.4;
      if (window.innerHeight > window.innerWidth) {
        return window.innerWidth / base.w;
      }
      return Math.max(window.innerWidth / base.w, window.innerHeight / base.h) * 1.06;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      measureBase();   // 幅が変わると素の寸法も変わる
      onScroll();
    }, { passive: true });
    // 初回の動画生成はページ読込完了まで遅らせている（LCP対策）。
    // 読込完了時に一度 update を回して、遅延していた生成を発火させる。
    window.addEventListener('load', onScroll, { passive: true });
    update();
  }

  function easeInOut(x) {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }

  /* ---- 音声トグル ----
     自動再生はブラウザ制約でミュート必須。音声はボタンのタップ（＝ユーザー操作）を
     起点に出す。一度ONにしたら動画が切り替わっても引き継ぐ。
     YouTube: enablejsapi=1 の iframe へ postMessage（外部スクリプトは読まない）
     MP4:     video.muted を切り替え
     Drive:   外部から音量制御できないためボタン自体を隠す（§20: ハックしない） */
  var audioBtn  = document.getElementById('baAudio');
  var audioOn   = false;
  var currentEl = null;
  var currentV  = null;

  function ytCommand(iframe, func, args) {
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: func, args: args || [] }), '*');
    } catch (e) {}
  }
  function applyAudio() {
    if (!currentEl || !currentV) return;
    if (currentEl.tagName === 'VIDEO') {
      currentEl.muted = !audioOn;
    } else if (currentV.provider === 'youtube') {
      if (audioOn) {
        ytCommand(currentEl, 'unMute');
        ytCommand(currentEl, 'setVolume', [100]);
      } else {
        ytCommand(currentEl, 'mute');
      }
    }
  }
  function updateAudioBtn() {
    if (!audioBtn) return;
    // Driveは制御できないので隠す。それ以外は動画が出ている間だけ表示
    audioBtn.hidden = !currentV || currentV.provider === 'drive';
    audioBtn.setAttribute('aria-pressed', audioOn ? 'true' : 'false');
    audioBtn.setAttribute('aria-label', audioOn ? '音声をオフにする' : '音声をオンにする');
    audioBtn.classList.toggle('is-on', audioOn);
  }
  if (audioBtn) {
    audioBtn.addEventListener('click', function () {
      audioOn = !audioOn;
      applyAudio();
      updateAudioBtn();
    });
  }

  /* 画面の中身を index の動画へ差し替える */
  var built = {};
  function swapVideo(i, list) {
    var v = list[i];
    if (!v) return;
    var el = built[i] || buildPlayer(v);
    if (!el) return;
    built[i] = el;
    // 前の動画を止める（iframeは破棄して確実に停止させる）
    Array.prototype.slice.call(screenE.children).forEach(function (c) {
      if (c === el) return;
      if (c.id === 'baPoster') { c.style.opacity = '0'; return; }
      if (c.tagName === 'VIDEO') { try { c.pause(); } catch (e) {} }
      c.remove();
    });
    if (el.parentNode !== screenE) screenE.appendChild(el);
    currentEl = el;
    currentV  = v;
    updateAudioBtn();
    // 音声ONのまま切り替わったら、新しいプレイヤーにも引き継ぐ
    // （iframeはプレイヤー初期化を待つ必要があるので load 後に少し遅らせる）
    if (audioOn) {
      if (el.tagName === 'IFRAME') {
        el.addEventListener('load', function () { setTimeout(applyAudio, 600); }, { once: true });
        setTimeout(applyAudio, 1200);   // 既にloadedの場合の保険
      } else {
        applyAudio();
      }
    }
  }

  /* 次の動画を裏で作っておく（DOMには入れない） */
  function preload(i, list) {
    if (built[i] || !list[i]) return;
    var el = buildPlayer(list[i]);
    if (el) built[i] = el;
  }

  /* ================================================================
     5. CASE STUDIES（制作事例グリッド）
     ---------------------------------------------------------------
     一覧はサムネイルのみ（iframeを並べない §26）。
     クリック時にモーダルでプレイヤーを生成し、閉じたら破棄する（§27）。
     WPから来る title / category / poster は textContent と
     検証済みURLでのみ扱う（bmSanitize 併用・XSS鉄則）。
     ================================================================ */
  var CAT_LABEL = {
    ADVERTISING: 'ADVERTISING',
    VTUBER:      'VTUBER / STREAMING',
    MUSIC_VIDEO: 'MUSIC VIDEO',
    IP:          'IP / ORIGINAL ANIME',
    VFX:         'VFX',
    OTHER:       'OTHER'
  };

  /* CSSの url() に入れても安全な形にする（https限定＋引用符類を除去） */
  function cssUrl(u) {
    u = String(u || '');
    if (window.bmSanitize && window.bmSanitize.url) u = window.bmSanitize.url(u);
    if (!/^https:\/\//.test(u)) return '';
    return u.replace(/["\\()]/g, '');
  }

  /* 再生アイコン（静的SVG。DOM APIで生成し、文字列HTMLは使わない） */
  function buildPlayIcon() {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M8 5v14l11-7z');
    svg.appendChild(path);
    return svg;
  }

  function initCases(list) {
    var section = document.getElementById('baCases');
    var grid    = document.getElementById('baCasesGrid');
    if (!section || !grid) return;
    list = (list || []).filter(function (v) { return v && (v.embed || v.src); });
    if (!list.length) return;   // 0件はセクションごと出さない（§34）

    var frag = document.createDocumentFragment();
    list.forEach(function (v) {
      var li  = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ba-case';

      var thumb = document.createElement('span');
      thumb.className = 'ba-case__thumb';
      var pu = cssUrl(v.poster);
      if (pu) thumb.style.backgroundImage = 'url("' + pu + '")';
      var play = document.createElement('span');
      play.className = 'ba-case__play';
      play.appendChild(buildPlayIcon());
      thumb.appendChild(play);

      var cat = document.createElement('span');
      cat.className = 'ba-case__cat';
      cat.textContent = CAT_LABEL[v.category] || 'OTHER';   // textContent = XSS安全

      var title = document.createElement('span');
      title.className = 'ba-case__title';
      title.textContent = v.title || '';

      btn.appendChild(thumb);
      btn.appendChild(cat);
      btn.appendChild(title);
      btn.addEventListener('click', function () { openModal(v, btn); });
      li.appendChild(btn);
      frag.appendChild(li);
    });
    grid.appendChild(frag);
    section.hidden = false;
  }

  /* ---- モーダル ---- */
  var modal       = document.getElementById('baModal');
  var modalPlayer = document.getElementById('baModalPlayer');
  var modalTitle  = document.getElementById('baModalTitle');
  var lastFocus   = null;

  function buildModalPlayer(v) {
    // モーダルはユーザーのクリック起点なので音あり再生でよい
    if (v.provider === 'mp4' && /^https:\/\/.+\.mp4(\?|$)/i.test(v.src || '')) {
      var el = document.createElement('video');
      el.src = v.src;
      el.controls = true;
      el.autoplay = true;
      el.playsInline = true;
      if (v.poster) el.poster = v.poster;
      return el;
    }
    if (!ALLOWED.test(v.embed || '')) return null;
    var ifr = document.createElement('iframe');
    ifr.src = v.embed + (v.provider === 'youtube' ? '?autoplay=1&rel=0&playsinline=1' : '');
    ifr.title = v.title || '制作事例の動画';
    ifr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    ifr.setAttribute('frameborder', '0');
    ifr.setAttribute('allowfullscreen', '');
    return ifr;
  }

  function openModal(v, opener) {
    if (!modal || !modalPlayer) return;
    var el = buildModalPlayer(v);
    if (!el) return;
    lastFocus = opener || null;
    modalPlayer.appendChild(el);
    if (modalTitle) modalTitle.textContent = v.title || '';
    modal.hidden = false;
    document.body.classList.add('ba-modal-open');
    var closeBtn = document.getElementById('baModalClose');
    if (closeBtn) closeBtn.focus();
    document.addEventListener('keydown', onModalKey);
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    // プレイヤーを破棄する＝再生を確実に止める（§27）
    while (modalPlayer.firstChild) modalPlayer.removeChild(modalPlayer.firstChild);
    modal.hidden = true;
    document.body.classList.remove('ba-modal-open');
    document.removeEventListener('keydown', onModalKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  /* ESCで閉じる + Tabをダイアログ内に閉じ込める（focus trap） */
  function onModalKey(e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    var focusables = modal.querySelectorAll(
      'button, [href], video, iframe, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    var first = focusables[0];
    var last  = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  if (modal) {
    // 閉じるボタン・バックドロップ（data-close 持ち）で閉じる
    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeModal();
    });
  }

  /* ================================================================
     6. 起動
     ================================================================ */
  fetchVideos().then(function (data) {
    try {
      initScrollStory(data.main || []);
    } catch (e) {
      // 演出が失敗してもページは壊さない（§34）
      if (window.console && console.warn) console.warn('[bizanime]', e);
    }
    try {
      initCases(data.cases || []);
    } catch (e2) {
      if (window.console && console.warn) console.warn('[bizanime cases]', e2);
    }
    window.dispatchEvent(new CustomEvent('bizanime-data', { detail: data }));
  });
})();
