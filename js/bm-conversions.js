/* =====================================================================
 * Google広告 コンバージョン「LINEお問い合わせ」「電話お問い合わせ」
 * （2026-09-03 / Issue #27）
 * ---------------------------------------------------------------------
 * サイト内の「LINEで相談」「電話」リンク（ヘッダー丸アイコン・ハンバーガー末尾・
 * 追従FAB・共通CTA(bm-cta.js)・LP内ボタン・制作事例カテゴリ）は全て同じ
 * LINE公式URL／同じ電話番号を指すので、個別に onclick を付けず document で
 * クリックを委譲して拾う。静的HTML／bm-nav.js や bm-cta.js が生成する
 * CTA／build-columns・build-works が今後生成するページ、全て自動で対象。
 *
 * Google発行スニペット（gtag_report_conversion）は「遷移を止めて
 * event_callback で window.location」する作りだが、LINE は target="_blank"、
 * 電話は tel: で元ページが残るため、その方式は使わない（新規タブがポップアップ
 * ブロックに掛かる／return false で遷移しなくなる）。
 * クリック時に event だけ送り、遷移はブラウザ標準に任せる。
 *
 * ⚠️ ラベルは Google広告管理画面「タグを設定する」の send_to をコピペした値。
 *    l(エル)/I(アイ)/1(イチ) の取り違えで計測が死ぬ（BUGS #025）。手入力しない。
 * ⚠️ bm-nav.js は #bmNav が無いページで早期 return するので、計測は独立させる。
 * ⚠️ capture 段階で拾う: メニュー側の stopPropagation に巻き込まれないため。
 * ===================================================================== */
(function () {
  // CVを増やす時はこの表に1行足すだけ（selector=対象リンク, sendTo=管理画面のラベル）
  var CONVERSIONS = [
    // 「LINEで相談」= LINE公式アカウントURL。シェアボタン(social-plugins.line.me)は当たらない
    { name: 'LINEお問い合わせ', selector: 'a[href*="line.me/R/ti/p/"]', sendTo: 'AW-18108125426/LX7_CMndmO0cEPKh0LpD' },
    // 電話はビズマンガ専用番号 tel:03-6261-0764 の1本のみ（2026-09-03 時点）
    { name: '電話お問い合わせ', selector: 'a[href^="tel:"]',             sendTo: 'AW-18108125426/Cf7LCMzdmO0cEPKh0LpD' }
  ];

  // Google例の gtag_report_conversion 相当。url を渡した時だけ送信後にそこへ遷移する
  function reportConversion(sendTo, url) {
    var callback = function () {
      if (typeof(url) != 'undefined') {
        window.location = url;
      }
    };
    if (typeof gtag !== 'function') { callback(); return false; }
    gtag('event', 'conversion', {
      'send_to': sendTo,
      'event_callback': callback
    });
    return false;
  }
  window.bmReportConversion = reportConversion;

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    for (var i = 0; i < CONVERSIONS.length; i++) {
      if (t.closest(CONVERSIONS[i].selector)) {
        // url を渡さない = event_callback は何もしない。遷移(新規タブ/電話アプリ)はブラウザに任せる
        reportConversion(CONVERSIONS[i].sendTo);
        return;
      }
    }
  }, true);
})();
