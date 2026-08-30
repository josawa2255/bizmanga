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
    if (poster) setThumbBg(poster, main[0].poster);

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
    // 1本目: 拡大してフルスクリーンになるまで 180vh（うち滞在 60vh を含む）
    // 2本目以降: 縮小→切替→再拡大 で 1本あたり 170vh（うち滞在 60vh を含む）
    // ⚠️ フレームが消えて「普通の枠」になった瞬間にすぐ次へ流れると
    //    動画をほぼ見れないまま通過してしまう（実際に指摘された）。
    //    フルスクリーンで止まって見える滞在区間を確保するため、
    //    2本目以降のvhを150→170に拡張した（§フルスクリーン滞在 参照）。
    var vh = 180 + (main.length - 1) * 170;
    stage.style.height = vh + 'vh';
    wrap.appendChild(stage);
    hero.classList.add('ba-hero--sticky');
    // クラス適用後の寸法で基準を取り直す
    requestAnimationFrame(function () { measureBase(); update(); });

    var current = -1;      // いま画面に出している動画の index

    /* --- 慣性スムージング ---
       スクロール位置へ1:1で即追従させるとトラックパッドの段付きが
       そのまま見えて機械的な動きになる。目標進捗(target)へ毎フレーム
       14%ずつ寄せることで、ヌルッとした「気持ちいい」追従にする。
       スクロール自体は奪っていない（描画だけが柔らかく遅れて付いてくる） */
    var target = 0;
    var smooth = 0;
    var rafId  = null;

    function computeTarget() {
      /* 進捗はラッパー（Hero+ステージ）全体で測る。
         ⚠️ ステージ基準にすると、ステージが画面に達するまでの最初の1画面分
            （約100vh）のスクロールが進捗0のままになり、「スクロールし始めても
            反応しない」死に区間が生まれる（実際に指摘された）。
            ラッパー基準なら最初の1pxから進捗が動く。 */
      var rect = wrap.getBoundingClientRect();
      var total = wrap.offsetHeight - window.innerHeight;
      if (total <= 0) return 0;
      return Math.min(1, Math.max(0, -rect.top / total));
    }

    function onScroll() {
      target = computeTarget();
      if (rafId === null) rafId = requestAnimationFrame(tick);
    }

    function tick() {
      smooth += (target - smooth) * 0.14;
      if (Math.abs(target - smooth) < 0.0005) {
        smooth = target;
        render(smooth);
        rafId = null;      // 収束したらループを止める（無駄なrAFを回さない）
        return;
      }
      render(smooth);
      rafId = requestAnimationFrame(tick);
    }

    function update() {           // 互換: 即時反映が必要な箇所（初期化・resize）用
      target = computeTarget();
      smooth = target;
      render(smooth);
    }

    function render(p) {

      // 動画1本あたりの区間長
      var seg = 1 / main.length;
      var idx = Math.min(main.length - 1, Math.floor(p / seg));
      var t   = (p - idx * seg) / seg;      // その区間内の進捗 0〜1

      /* --- 区間内のフェーズ ---
         0.00〜0.58 : 右から中央へ / 拡大 / 角度が正面へ
                      スクロール開始と同時に反応する（待機なし）。ただし区間を
                      長めに取り、イージングで序盤は微動から立ち上げることで
                      「すぐ動くが、速すぎない」体感にする（2026-08-30 調整。
                      一度入れた待機18%は「反応が遅い」となり撤廃した）
         0.58〜0.70 : フレームが消え、動画がフルスクリーンに
         0.70〜0.88 : フルスクリーンのまま静止滞在（スクロールしても動画は動かない）
                      ⚠️ フレームが消えた瞬間にすぐ次へ流れると動画をほぼ見れずに
                      通過してしまう（実際に指摘された）。ここで一度止めて
                      「ちゃんと見れる」時間を確保する（2026-08-30 追加）
         0.88〜1.00 : 少し縮小してフレームが戻る（次の動画への繋ぎ）
         最後の動画では縮小フェーズを使わず、フルスクリーンのまま終わる */
      var isLast = (idx === main.length - 1);

      var grow, fade, shrink;
      if (t < 0.58) {
        grow = t / 0.58; fade = 0; shrink = 0;
      } else if (t < 0.70) {
        grow = 1; fade = (t - 0.58) / 0.12; shrink = 0;
      } else if (t < 0.88) {
        grow = 1; fade = 1; shrink = 0;   // 滞在: フレーム消滅済み・縮小前で完全に静止
      } else {
        grow = 1; fade = 1;
        shrink = isLast ? 0 : (t - 0.88) / 0.12;
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
      var frameOpacity = 1 - easeInOut(fade);   // フレーム消滅も柔らかく
      if (shrink > 0) frameOpacity = Math.max(frameOpacity, easeInOut(shrink)); // 戻す
      if (frame) frame.style.opacity = frameOpacity.toFixed(3);

      // フレームが消えるにつれ、切り抜きを矩形へ戻して画面全体に見せる
      screenE.style.setProperty('--ba-clip', fade.toFixed(3));
      screenE.classList.toggle('is-full', fade > 0.98 && shrink === 0);

      // コピーとキャラはスクロール開始とともに退場させる。
      // ⚠️ .ba-copy はスマホで display:contents（箱を持たない）ため、
      //    親に opacity を掛けても効かない。個別要素に掛ける。
      var c = easeInOut(Math.min(1, p / (seg * 0.4)));   // 退場も柔らかく
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
  var storyBar  = document.getElementById('baDeviceProgress');
  var storyFill = storyBar ? storyBar.querySelector('i') : null;
  var storyDur  = 0;
  if (storyBar) {
    storyBar.addEventListener('click', function (e) {
      if (!storyDur || !currentEl || currentEl.tagName !== 'IFRAME') return;
      var r = storyBar.getBoundingClientRect();
      var ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      ytCommand(currentEl, 'seekTo', [ratio * storyDur, true]);
    });
  }
  var audioOn   = false;
  var currentEl = null;
  var currentV  = null;

  function ytCommand(iframe, func, args) {
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: func, args: args || [] }), '*');
    } catch (e) {}
  }
  /* --- YouTubeプレイヤーの再生情報を受け取る ---
     enablejsapi=1 のプレイヤーに {event:'listening'} を送ると、以後
     currentTime / duration / muted 等が message イベントで届く
     （infoDelivery）。外部スクリプト不要＝CSPに触れない。 */
  var ytWatchers = [];   // {iframe, onInfo}
  var listenSeq = 0;

  window.addEventListener('message', function (e) {
    if (!/^https:\/\/(www\.youtube-nocookie\.com|www\.youtube\.com)$/.test(e.origin)) return;
    var d;
    try { d = JSON.parse(e.data); } catch (err) { return; }
    if (!d || !d.info) return;
    for (var i = 0; i < ytWatchers.length; i++) {
      if (ytWatchers[i].iframe.contentWindow === e.source) {
        ytWatchers[i].onInfo(d.info);
      }
    }
  });

  function watchPlayer(iframe, onInfo) {
    ytWatchers.push({ iframe: iframe, onInfo: onInfo });
    function handshake() {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'listening', id: String(++listenSeq), channel: 'widget' }), '*');
      } catch (e) {}
    }
    iframe.addEventListener('load', function () { setTimeout(handshake, 500); }, { once: true });
    setTimeout(handshake, 1500);   // 既にloaded時の保険
  }
  function unwatchPlayer(iframe) {
    ytWatchers = ytWatchers.filter(function (w) { return w.iframe !== iframe; });
  }

  /* YouTubeの字幕を消す。動画側が「デフォルトで字幕ON」だと埋め込みにも
     字幕が出るが、URLパラメータでは強制OFFにできない。プレイヤーAPIで
     字幕モジュールごと外す（captions=新プレイヤー / cc=旧プレイヤー）。
     プレイヤー初期化前のpostMessageは無視されるので、少し遅らせて2回送る。 */
  function disableCaptions(iframe) {
    ytCommand(iframe, 'unloadModule', ['captions']);
    ytCommand(iframe, 'unloadModule', ['cc']);
  }
  function scheduleCaptionsOff(iframe) {
    iframe.addEventListener('load', function () {
      setTimeout(function () { disableCaptions(iframe); }, 600);
    }, { once: true });
    setTimeout(function () { disableCaptions(iframe); }, 1600);  // 既にloaded時の保険
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
      if (c.tagName === 'IFRAME') unwatchPlayer(c);
      c.remove();
    });
    if (el.parentNode !== screenE) screenE.appendChild(el);
    if (el.tagName === 'IFRAME' && v.provider === 'youtube') {
      scheduleCaptionsOff(el);
      // フルスクリーン時に出す進捗バー（YouTube風の細いバー 2026-08-30 指示）
      storyDur = 0;
      watchPlayer(el, function (info) {
        if (typeof info.duration === 'number' && info.duration > 0) storyDur = info.duration;
        if (storyFill && storyDur > 0 && typeof info.currentTime === 'number') {
          storyFill.style.width = Math.min(100, 100 * info.currentTime / storyDur).toFixed(2) + '%';
        }
      });
    }
    currentEl = el;
    currentV  = v;
    // 実績バッジ（フルスクリーン時にCSSが表示する）
    var sBadge = document.getElementById('baDeviceBadge');
    if (sBadge) {
      sBadge.textContent = v.achievement || '';
      sBadge.hidden = !v.achievement;
    }
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

  /* CSSの url() に入れても安全な形にする（https限定＋引用符類を除去）。
     ⚠️ bmSanitize.url は使わない。あれは許可ドメイン=contentsx.jp のみの設計で、
        i.ytimg.com のサムネURLが全部空文字になる（実測でサムネ全滅した）。 */
  function cssUrl(u) {
    u = String(u || '').trim();
    if (!/^https:\/\//.test(u)) return '';
    return u.replace(/["'\\()\s]/g, '');
  }

  /* 背景画像を読み込めたら適用する。maxresdefault はHD版が無い動画だと404に
     なるため、その場合は hqdefault へフォールバックする */
  function setThumbBg(el, url) {
    var pu = cssUrl(url);
    if (!pu) return;
    var im = new Image();
    im.onload = function () { el.style.backgroundImage = 'url("' + pu + '")'; };
    im.onerror = function () {
      var fb = pu.replace('/maxresdefault.', '/hqdefault.');
      if (fb === pu) return;
      var im2 = new Image();
      im2.onload = function () { el.style.backgroundImage = 'url("' + fb + '")'; };
      im2.src = fb;
    };
    im.src = pu;
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
      setThumbBg(thumb, v.poster);
      var play = document.createElement('span');
      play.className = 'ba-case__play';
      play.appendChild(buildPlayIcon());
      thumb.appendChild(play);
      if (v.achievement) {
        var badge = document.createElement('span');
        badge.className = 'ba-case__badge';
        badge.textContent = v.achievement;   // textContent = XSS安全
        thumb.appendChild(badge);
      }

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
      el.muted = false;      // モーダルはクリック起点なので音ありで開始できる
      el.playsInline = true;
      if (v.poster) el.poster = v.poster;
      return el;
    }
    if (!ALLOWED.test(v.embed || '')) return null;
    var ifr = document.createElement('iframe');
    // YouTube: 標準UI（タイトルバー/関連動画/ロゴ）を出さないため controls=0 で埋め込み、
    // 操作は下の自前バー（音声・元の動画を開く）に寄せる。
    // ⚠️ ミュート必須。音あり自動再生はブロックされることがあり、その場合
    //    一時停止のまま止まり、YouTubeのタイトル・関連動画UIが全面に出てしまう
    //    （まさに消したいUI）。確実に再生を始めてから、音はボタンでONにする。
    ifr.src = v.embed + (v.provider === 'youtube'
      ? '?autoplay=1&mute=1&rel=0&playsinline=1&controls=0&enablejsapi=1&iv_load_policy=3' : '');
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
    if (el.tagName === 'IFRAME' && v.provider === 'youtube') scheduleCaptionsOff(el);
    modalPlayer.className = 'ba-modal__player ba-modal__player--' + (v.provider || 'other');
    if (modalTitle) modalTitle.textContent = v.title || '';
    var mBadge = document.getElementById('baModalBadge');
    if (mBadge) {
      mBadge.textContent = v.achievement || '';
      mBadge.hidden = !v.achievement;
    }

    var mAudio = document.getElementById('baModalAudio');
    var mBar   = document.getElementById('baModalProgress');
    var mFill  = mBar ? mBar.querySelector('i') : null;
    var mDur   = 0;
    if (mBar) {
      mBar.hidden = (v.provider !== 'youtube');   // mp4はnativeバー/Driveは情報が取れない
      if (mFill) mFill.style.width = '0%';
    }

    if (v.provider === 'youtube') {
      /* 音ONで開始（2026-08-30 指示）。モーダルはカードのクリック＝ユーザー操作で
         開くため、ミュート再生を開始した直後に unMute すれば音が出せる。
         万一ブラウザに拒まれた場合は infoDelivery の muted で検知し、
         ボタン表示を実態に同期させる。 */
      var unmute = function () { ytCommand(el, 'unMute'); ytCommand(el, 'setVolume', [100]); };
      el.addEventListener('load', function () { setTimeout(unmute, 700); }, { once: true });
      setTimeout(unmute, 1700);

      watchPlayer(el, function (info) {
        if (typeof info.duration === 'number' && info.duration > 0) mDur = info.duration;
        if (mFill && mDur > 0 && typeof info.currentTime === 'number') {
          mFill.style.width = Math.min(100, 100 * info.currentTime / mDur).toFixed(2) + '%';
        }
        if (mAudio && typeof info.muted === 'boolean') {
          mAudio.classList.toggle('is-on', !info.muted);
          mAudio.setAttribute('aria-pressed', info.muted ? 'false' : 'true');
        }
      });

      // バーをクリック/ドラッグ位置へシーク
      if (mBar) {
        mBar.onclick = function (e) {
          if (!mDur) return;
          var r = mBar.getBoundingClientRect();
          var ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          ytCommand(el, 'seekTo', [ratio * mDur, true]);
        };
      }
    }

    if (mAudio) {
      mAudio.hidden = (v.provider !== 'youtube');
      mAudio.classList.add('is-on');             // 音ONで開始する想定の初期表示
      mAudio.setAttribute('aria-pressed', 'true');
      mAudio.onclick = function () {
        var on = !mAudio.classList.contains('is-on');
        mAudio.classList.toggle('is-on', on);
        mAudio.setAttribute('aria-pressed', on ? 'true' : 'false');
        ytCommand(el, on ? 'unMute' : 'mute');
        if (on) ytCommand(el, 'setVolume', [100]);
      };
    }
    modal.hidden = false;
    document.body.classList.add('ba-modal-open');
    var closeBtn = document.getElementById('baModalClose');
    if (closeBtn) closeBtn.focus();
    document.addEventListener('keydown', onModalKey);
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    // プレイヤーを破棄する＝再生を確実に止める（§27）
    Array.prototype.slice.call(modalPlayer.querySelectorAll('iframe')).forEach(unwatchPlayer);
    // バッジ(p要素)は残し、プレイヤー(iframe/video)だけ破棄する
    Array.prototype.slice.call(modalPlayer.querySelectorAll('iframe, video'))
      .forEach(function (n) { n.remove(); });
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
     6. 追加セクション共通基盤（USE CASE / WHY / RANGE / FAQ）
     ---------------------------------------------------------------
     方針:
       - 動画は poster first。iframe/videoは active になった時だけ生成
       - ページ全体で自動プレビューは同時1本（preview マネージャで強制）
       - hover は (hover:hover) and (pointer:fine) の端末のみ
       - reduced-motion / saveData では自動プレビューをしない
     ================================================================ */

  /* --- 調整ノブ（window.BA_TUNE から実行時に変更できる） --- */
  var TUNE = {
    USECASE_PREVIEW_DELAY: 160,   // hover後にプレビューを始めるまでのms
    USECASE_EXPAND_RATIO:  2,     // activeパネルのflex-grow（2 → 40/20/20/20）
    WHY_TRANSITION_MS:     340,   // WHYのステージ切替ms
    RANGE_MAX_TILES:       12,    // RANGEに並べる最大枚数
    FAQ_ANIMATION_MS:      220,   // アコーディオン開閉ms
    SECTION_REVEAL_MS:     600    // セクション出現ms
  };
  window.BA_TUNE = TUNE;
  document.documentElement.style.setProperty('--uc-active-grow', TUNE.USECASE_EXPAND_RATIO);
  document.documentElement.style.setProperty('--why-transition', TUNE.WHY_TRANSITION_MS + 'ms');
  document.documentElement.style.setProperty('--faq-anim', TUNE.FAQ_ANIMATION_MS + 'ms');
  document.documentElement.style.setProperty('--sec-reveal', TUNE.SECTION_REVEAL_MS + 'ms');

  var MQ_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)');
  var MQ_SP    = window.matchMedia('(max-width: 1024px)');
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var noAutoPreview = reduceMotion || saveData;   // 軽量モード: 自動プレビュー禁止

  /* --- プレビューマネージャ: ページ全体で同時1本を強制する --- */
  var preview = {
    host: null,
    el:   null,
    play: function (host, v) {
      if (!host || !v || noAutoPreview) return;
      if (v.provider === 'drive') return;   // DriveのプレビューUIは消せないので出さない
      if (this.host === host) return;
      this.stop();
      var el = buildPlayer(v);              // muted autoplay（既存の安全経路を再利用）
      if (!el) return;
      if (el.tagName === 'IFRAME') scheduleCaptionsOff(el);
      el.classList.add('ba-preview-player');
      host.appendChild(el);
      host.classList.add('is-playing');
      this.host = host;
      this.el = el;
    },
    stop: function () {
      if (this.el) {
        if (this.el.tagName === 'IFRAME') unwatchPlayer(this.el);
        if (this.el.tagName === 'VIDEO') { try { this.el.pause(); } catch (e) {} }
        try { this.el.remove(); } catch (e) {}
      }
      if (this.host) this.host.classList.remove('is-playing');
      this.host = null;
      this.el = null;
    }
  };

  /* --- セクション可視管理: 画面外に出たらそのセクションのプレビューを止める --- */
  var visibleSecs = {};
  function watchSection(sec, onShow) {
    if (!('IntersectionObserver' in window)) {
      visibleSecs[sec.id] = true;
      sec.classList.add('is-in');
      if (onShow) onShow();
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        visibleSecs[sec.id] = en.isIntersecting;
        if (en.isIntersecting) {
          sec.classList.add('is-in');
          if (onShow) onShow();            // 見えたら現在activeのプレビューを起こす
        } else if (preview.host && sec.contains(preview.host)) {
          preview.stop();
        }
      });
    }, { threshold: 0.12 });
    io.observe(sec);
  }

  /* --- Hero演出の動画は、Heroが画面外に出たら一時停止する（同時再生の抑制） --- */
  if ('IntersectionObserver' in window) {
    var heroIO = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!currentEl) return;
        if (currentEl.tagName === 'IFRAME') {
          ytCommand(currentEl, en.isIntersecting ? 'playVideo' : 'pauseVideo');
        } else if (currentEl.tagName === 'VIDEO') {
          try { en.isIntersecting ? currentEl.play() : currentEl.pause(); } catch (e) {}
        }
      });
    }, { threshold: 0.05 });
    heroIO.observe(hero);
  }

  /* --- データ整形 --- */
  function dedupePool(data) {
    var seen = {};
    var out = [];
    (data.main || []).concat(data.cases || []).forEach(function (v) {
      if (!v || !(v.embed || v.src)) return;
      var key = v.video_id || v.src || v.embed;
      if (seen[key]) return;
      seen[key] = 1;
      out.push(v);
    });
    return out;
  }
  function byCat(pool, cat) {
    return pool.filter(function (v) { return v.category === cat; });
  }
  function pickBy(pool, regs, cat, used) {
    for (var i = 0; i < regs.length; i++) {
      var hit = pool.filter(function (v) {
        return regs[i].test(v.title || '') && used.indexOf(v) === -1;
      })[0];
      if (hit) return hit;
    }
    return byCat(pool, cat).filter(function (v) { return used.indexOf(v) === -1; })[0] || null;
  }

  /* ================================================================
     6a. USE CASE — 4パネル・シネマティック
     ================================================================ */
  var UC_DEFS = [
    { cat: 'ADVERTISING', en: 'ADVERTISING',        ja: '広告',
      copy: '広告導線に合わせて、つい見てしまう動きを設計。' },
    { cat: 'VTUBER',      en: 'VTUBER / STREAMING', ja: '配信・VTuber',
      copy: '待機時間まで、世界観の一部に。' },
    { cat: 'MUSIC_VIDEO', en: 'MUSIC VIDEO',        ja: 'ミュージックビデオ',
      copy: '音楽の印象を、動きで増幅する。' },
    { cat: 'IP',          en: 'IP / ORIGINAL ANIME', ja: 'オリジナルアニメ',
      copy: 'キャラクターと世界観を、ゼロから立ち上げる。' }
  ];

  function initUseCase(pool) {
    var sec = document.getElementById('baUseCase');
    var wrapP = document.getElementById('baUcPanels');
    var stage = document.getElementById('baUcStage');
    var stageMedia = document.getElementById('baUcStageMedia');
    var stageCopy = document.getElementById('baUcStageCopy');
    var stagePlay = document.getElementById('baUcStagePlay');
    if (!sec || !wrapP || !pool.length) return;

    var videos = UC_DEFS.map(function (d) { return byCat(pool, d.cat)[0] || null; });
    var lockIdx = 0;
    for (var i = 0; i < videos.length; i++) { if (videos[i]) { lockIdx = i; break; } }
    var activeIdx = -1;
    var hoverTimer = null;
    var panels = [];

    UC_DEFS.forEach(function (d, i) {
      var v = videos[i];
      var panel = document.createElement('div');
      panel.className = 'ba-uc-panel' + (v ? '' : ' is-empty');

      var hit = document.createElement('button');
      hit.type = 'button';
      hit.className = 'ba-uc-hit';
      hit.setAttribute('aria-label', d.en + ' を選択');

      var media = document.createElement('span');
      media.className = 'ba-vhost ba-uc-media';
      if (v) setThumbBg(media, v.poster);
      var now = document.createElement('span');
      now.className = 'ba-now';
      now.textContent = 'NOW PLAYING';
      media.appendChild(now);
      hit.appendChild(media);

      var info = document.createElement('span');
      info.className = 'ba-uc-info';
      var num = document.createElement('span');
      num.className = 'ba-uc-num';
      num.textContent = '0' + (i + 1);
      var en = document.createElement('span');
      en.className = 'ba-uc-en';
      en.textContent = d.en;
      var ja = document.createElement('span');
      ja.className = 'ba-uc-ja';
      ja.textContent = d.ja;
      var copy = document.createElement('span');
      copy.className = 'ba-uc-copy';
      copy.textContent = v ? d.copy : '事例は現在準備中です。';
      info.appendChild(num); info.appendChild(en); info.appendChild(ja); info.appendChild(copy);
      hit.appendChild(info);
      panel.appendChild(hit);

      var ctas = document.createElement('span');
      ctas.className = 'ba-uc-ctas';
      if (v) {
        var b1 = document.createElement('button');
        b1.type = 'button';
        b1.className = 'ba-mini-cta';
        b1.textContent = 'プレビューを見る';
        b1.addEventListener('click', function (e) { e.stopPropagation(); openModal(v, b1); });
        var b2 = document.createElement('a');
        b2.className = 'ba-mini-cta ba-mini-cta--ghost';
        b2.href = '#baCases';
        b2.textContent = '事例を見る';
        ctas.appendChild(b1); ctas.appendChild(b2);
      } else {
        var b3 = document.createElement('a');
        b3.className = 'ba-mini-cta ba-mini-cta--ghost';
        b3.href = '/contact';
        b3.textContent = '相談する';
        ctas.appendChild(b3);
      }
      panel.appendChild(ctas);

      hit.addEventListener('click', function () { lockIdx = i; setActive(i); });
      hit.addEventListener('focus', function () { setActive(i); });
      if (MQ_HOVER.matches) {
        panel.addEventListener('mouseenter', function () { setActive(i); });
      }
      wrapP.appendChild(panel);
      panels.push({ panel: panel, media: media, def: d, video: v });
    });

    if (MQ_HOVER.matches) {
      wrapP.addEventListener('mouseleave', function () { setActive(lockIdx); });
    }

    function setActive(i) {
      if (i === activeIdx) return;
      activeIdx = i;
      panels.forEach(function (p, n) { p.panel.classList.toggle('is-active', n === i); });
      var v = videos[i];
      clearTimeout(hoverTimer);
      if (MQ_SP.matches) {
        // SP: 下のステージに集約（同時1本）
        if (stage && v) {
          stage.hidden = false;
          setThumbBg(stageMedia, v.poster);
          stageCopy.textContent = UC_DEFS[i].copy;
          stagePlay.onclick = function () { openModal(v, stagePlay); };
          preview.play(stageMedia, v);   // tap起点なのでmutedプレビュー即時
        }
      } else if (v && visibleSecs[sec.id]) {
        hoverTimer = setTimeout(function () {
          if (activeIdx === i) preview.play(panels[i].media, v);
        }, TUNE.USECASE_PREVIEW_DELAY);
      }
      if (!v) preview.stop();
    }

    sec.hidden = false;
    watchSection(sec, function () {
      var i = activeIdx;
      activeIdx = -1;        // 同値ガードを外して再適用
      setActive(i === -1 ? lockIdx : i);
    });
    setActive(lockIdx);
  }

  /* ================================================================
     6b. WHY BIZ ANIME — editorial split（stickyは使わない判断）
     ================================================================ */
  var WHY_DEFS = [
    { en: 'AI VIDEO TECHNOLOGY', title: '生成技術の進化を、制作のスピードへ。',
      sub: '生成技術を、制作効率だけで終わらせない',
      pick: [/式法戦線/, /存在しないアニメ/], cat: 'IP' },
    { en: 'CREATIVE DIRECTION', title: 'ただ生成するのではなく、目的に合わせて演出を設計する。',
      sub: '目的に合わせて、動きの意味まで設計する',
      pick: [/I eye/i], cat: 'MUSIC_VIDEO' },
    { en: 'MULTI FORMAT', title: 'ひとつの表現に縛られず、媒体や目的に合わせて形を変える。',
      sub: '広告も、配信も、MVも、同じ型にはめない',
      pick: [/カミツギ.*一話/, /カミツギ/], cat: 'IP' }
  ];

  function initWhy(pool) {
    var sec = document.getElementById('baWhy');
    var nav = document.getElementById('baWhyNav');
    var stageHost = document.getElementById('baWhyStage');
    var idxLabel = document.getElementById('baWhyIdx');
    var altWrap = document.getElementById('baWhyAlt');
    var viewBtn = document.getElementById('baWhyView');
    if (!sec || !nav || !pool.length) return;

    var used = [];
    var items = WHY_DEFS.map(function (d) {
      var v = pickBy(pool, d.pick, d.cat, used);
      if (v) used.push(v);
      return { def: d, video: v };
    }).filter(function (it) { return it.video; });
    if (!items.length) return;

    var cur = 0;
    var curVideo = items[0].video;
    var btns = [];

    items.forEach(function (it, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ba-why-item';
      var num = document.createElement('span');
      num.className = 'ba-why-num';
      num.textContent = '0' + (i + 1);
      var tl = document.createElement('span');
      tl.className = 'ba-why-en';
      tl.textContent = it.def.en;
      var tt = document.createElement('span');
      tt.className = 'ba-why-title';
      tt.textContent = it.def.title;
      var sub = document.createElement('span');
      sub.className = 'ba-why-sub';
      sub.textContent = it.def.sub;
      b.appendChild(num); b.appendChild(tl); b.appendChild(tt); b.appendChild(sub);
      b.addEventListener('click', function () { setWhy(i); });
      if (MQ_HOVER.matches) b.addEventListener('mouseenter', function () { setWhy(i); });
      nav.appendChild(b);
      btns.push(b);
    });

    function renderAlt() {
      while (altWrap.firstChild) altWrap.removeChild(altWrap.firstChild);
      var alts = byCat(pool, items[cur].def.cat).filter(function (v) {
        return v !== curVideo;
      }).slice(0, 2);
      alts.forEach(function (v) {
        var t = document.createElement('button');
        t.type = 'button';
        t.className = 'ba-vhost ba-why-thumb';
        t.setAttribute('aria-label', (v.title || '関連作品') + ' に切り替え');
        setThumbBg(t, v.poster);
        t.addEventListener('click', function () { swapStage(v); });
        altWrap.appendChild(t);
      });
    }

    function swapStage(v) {
      curVideo = v;
      stageHost.classList.add('is-swap');
      setTimeout(function () {
        setThumbBg(stageHost, v.poster);
        preview.stop();
        if (!MQ_SP.matches && visibleSecs[sec.id]) preview.play(stageHost, v);
        stageHost.classList.remove('is-swap');
      }, TUNE.WHY_TRANSITION_MS / 2);
      renderAlt();
    }

    function setWhy(i) {
      if (i === cur && curVideo === items[i].video) return;
      cur = i;
      btns.forEach(function (b, n) {
        b.classList.toggle('is-active', n === i);
        b.setAttribute('aria-pressed', n === i ? 'true' : 'false');
      });
      if (idxLabel) idxLabel.textContent = '0' + (i + 1) + ' / 0' + items.length;
      swapStage(items[i].video);
    }

    if (viewBtn) viewBtn.addEventListener('click', function () { openModal(curVideo, viewBtn); });

    sec.hidden = false;
    watchSection(sec, function () {
      if (!MQ_SP.matches && !preview.host) preview.play(stageHost, curVideo);
    });
    btns[0].classList.add('is-active');
    btns[0].setAttribute('aria-pressed', 'true');
    if (idxLabel) idxLabel.textContent = '01 / 0' + items.length;
    setThumbBg(stageHost, curVideo.poster);
    renderAlt();
  }

  /* ================================================================
     6c. PRODUCTION RANGE — モニターウォール
     フォーマット断定はしない（全ソースが16:9のため）。実在カテゴリの
     チップ＋大小タイルで「幅」を見せる。
     ================================================================ */
  var RANGE_LABEL = {
    ADVERTISING: 'ADVERTISING',
    VTUBER:      'VTUBER / STREAMING',
    MUSIC_VIDEO: 'MUSIC VIDEO',
    IP:          'IP / ORIGINAL ANIME',
    OTHER:       'SHORT & EXPERIMENTAL'
  };
  var RANGE_SIZES = ['t-w', 't-s', 't-t', 't-s', 't-s', 't-t', 't-w', 't-s', 't-s', 't-t', 't-s', 't-s'];

  function initRange(pool) {
    var sec = document.getElementById('baRange');
    var chipsWrap = document.getElementById('baRangeChips');
    var wall = document.getElementById('baRangeWall');
    if (!sec || !wall || !pool.length) return;

    var tiles = pool.slice(0, TUNE.RANGE_MAX_TILES);
    var cats = ['ADVERTISING', 'VTUBER', 'MUSIC_VIDEO', 'IP', 'OTHER'].filter(function (c) {
      return tiles.some(function (v) { return v.category === c; });
    });

    /* chips */
    var chipBtns = [];
    ['ALL'].concat(cats).forEach(function (c) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ba-chip';
      chip.textContent = c === 'ALL' ? 'ALL' : RANGE_LABEL[c];
      chip.setAttribute('aria-pressed', c === 'ALL' ? 'true' : 'false');
      chip.addEventListener('click', function () { setFilter(c); });
      chipsWrap.appendChild(chip);
      chipBtns.push({ btn: chip, cat: c });
    });

    var tileEls = [];
    tiles.forEach(function (v, i) {
      var li = document.createElement('li');
      li.className = 'ba-range-tile ' + RANGE_SIZES[i % RANGE_SIZES.length];
      li.dataset.cat = v.category;

      var hit = document.createElement('button');
      hit.type = 'button';
      hit.className = 'ba-vhost ba-range-hit';
      hit.setAttribute('aria-label', (v.title || '作品') + ' をプレビュー');
      setThumbBg(hit, v.poster);

      var cap = document.createElement('span');
      cap.className = 'ba-range-cap';
      var cc = document.createElement('span');
      cc.className = 'ba-range-cat';
      cc.textContent = RANGE_LABEL[v.category] || 'OTHER';
      var tt = document.createElement('span');
      tt.className = 'ba-range-title';
      tt.textContent = v.title || '';
      cap.appendChild(cc); cap.appendChild(tt);
      hit.appendChild(cap);

      var cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'ba-mini-cta ba-range-view';
      cta.textContent = 'VIEW WORK';
      cta.addEventListener('click', function (e) { e.stopPropagation(); openModal(v, cta); });

      function act() {
        tileEls.forEach(function (t) { t.li.classList.remove('is-active'); });
        li.classList.add('is-active');
        if (visibleSecs[sec.id] && !li.classList.contains('is-dim')) preview.play(hit, v);
      }
      hit.addEventListener('click', act);
      hit.addEventListener('focus', act);
      if (MQ_HOVER.matches) li.addEventListener('mouseenter', act);

      li.appendChild(hit);
      li.appendChild(cta);
      wall.appendChild(li);
      tileEls.push({ li: li, hit: hit, video: v });
    });

    function setFilter(cat) {
      chipBtns.forEach(function (c) {
        c.btn.setAttribute('aria-pressed', c.cat === cat ? 'true' : 'false');
        c.btn.classList.toggle('is-on', c.cat === cat);
      });
      tileEls.forEach(function (t) {
        var dim = cat !== 'ALL' && t.video.category !== cat;
        t.li.classList.toggle('is-dim', dim);
        if (dim && preview.host === t.hit) preview.stop();
      });
    }
    setFilter('ALL');

    sec.hidden = false;
    watchSection(sec);
  }

  /* ================================================================
     6d. FAQ — 1項目ずつ開くアコーディオン（WAI-ARIA）
     ================================================================ */
  function initFaq() {
    var sec = document.getElementById('baFaq');
    if (!sec) return;
    var items = Array.prototype.slice.call(sec.querySelectorAll('.ba-faq-item'));

    items.forEach(function (item) {
      var btn = item.querySelector('.ba-faq-q button');
      var panel = item.querySelector('.ba-faq-a');
      if (!btn || !panel) return;
      panel.style.height = '0px';

      btn.addEventListener('click', function () {
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        // 他を閉じる（1つだけopen方式）
        items.forEach(function (other) {
          if (other === item) return;
          var ob = other.querySelector('.ba-faq-q button');
          var op = other.querySelector('.ba-faq-a');
          if (ob && ob.getAttribute('aria-expanded') === 'true') {
            ob.setAttribute('aria-expanded', 'false');
            other.classList.remove('is-open');
            op.style.height = op.scrollHeight + 'px';
            requestAnimationFrame(function () { op.style.height = '0px'; });
          }
        });
        btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        item.classList.toggle('is-open', !isOpen);
        if (isOpen) {
          panel.style.height = panel.scrollHeight + 'px';
          requestAnimationFrame(function () { panel.style.height = '0px'; });
        } else {
          panel.style.height = panel.scrollHeight + 'px';
          panel.addEventListener('transitionend', function fin() {
            panel.removeEventListener('transitionend', fin);
            if (btn.getAttribute('aria-expanded') === 'true') panel.style.height = 'auto';
          });
        }
      });
    });
    watchSection(sec);
  }

  /* ================================================================
     7. 起動
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
    try {
      var pool = dedupePool(data);
      initUseCase(pool);
      initWhy(pool);
      initRange(pool);
    } catch (e3) {
      if (window.console && console.warn) console.warn('[bizanime sections]', e3);
    }
    try { initFaq(); } catch (e4) {
      if (window.console && console.warn) console.warn('[bizanime faq]', e4);
    }
    window.dispatchEvent(new CustomEvent('bizanime-data', { detail: data }));
  });
})();
