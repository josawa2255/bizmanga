/**
 * HubSpot Tracking Script 遅延ローダー
 *
 * 問題: hs-scripts.com/48367061.js がメインスレッドを約18秒占有し、
 *       LCP 19.8s / TBT 19.28s を引き起こしていた（Lighthouse実測）。
 * 対策: 初回ユーザーインタラクション or 4秒後にロード。
 *       フォーム送信は hsforms.com の REST API を直接叩いているため、
 *       この遅延ロードで機能影響なし（トラッキング開始が4秒遅れるのみ）。
 */
(function () {
  "use strict";
  if (window.__hsInit) return;
  window.__hsInit = true;

  function loadHubSpot() {
    if (window.__hsLoaded) return;
    window.__hsLoaded = true;
    var s = document.createElement("script");
    s.id = "hs-script-loader";
    s.src = "https://js-na2.hs-scripts.com/48367061.js";
    s.async = true;
    document.head.appendChild(s);
  }

  var events = ["mousemove", "scroll", "touchstart", "keydown", "click"];
  events.forEach(function (ev) {
    window.addEventListener(ev, loadHubSpot, { once: true, passive: true });
  });

  // セーフティネット: 4秒後には強制ロード
  setTimeout(loadHubSpot, 4000);
})();
