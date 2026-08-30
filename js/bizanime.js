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
    // 1本目: 拡大してフルスクリーンになるまで 180vh
    // 2本目以降: 縮小→切替→再拡大 で 1本あたり 150vh
    var vh = 180 + (main.length - 1) * 150;
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
         0.00〜0.66 : 右から中央へ / 拡大 / 角度が正面へ
                      スクロール開始と同時に反応する（待機なし）。ただし区間を
                      長めに取り、イージングで序盤は微動から立ち上げることで
                      「すぐ動くが、速すぎない」体感にする（2026-08-30 調整。
                      一度入れた待機18%は「反応が遅い」となり撤廃した）
         0.66〜0.82 : フレームが消え、動画がフルスクリーンに
         0.82〜1.00 : 少し縮小してフレームが戻る（次の動画への繋ぎ）
         最後の動画では縮小フェーズを使わず、フルスクリーンのまま終わる */
      var isLast = (idx === main.length - 1);

      var grow, fade, shrink;
      if (t < 0.66) {
        grow = t / 0.66; fade = 0; shrink = 0;
      } else if (t < 0.82) {
        grow = 1; fade = (t - 0.66) / 0.16; shrink = 0;
      } else {
        grow = 1; fade = 1;
        shrink = isLast ? 0 : (t - 0.82) / 0.18;
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
