/* ホームのキャンペーン見出し「○月限定」を日本時間の当月に合わせる（#63）。
   HTML には公開時点の月を書いておくので、JS が動かない環境でもその表示が残る。
   キャンペーンを終えるときは index.html の見出し（.bm-campaign-link）ごと外す。 */
(function () {
  'use strict';
  var link = document.querySelector('[data-bm-campaign]');
  var label = link && link.querySelector('[data-bm-campaign-month]');
  if (!label) return;

  var month;
  try {
    // 閲覧者の端末の時刻帯ではなく、日本時間で月を決める
    month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', month: 'numeric' }).format(new Date()));
  } catch (e) {
    return;
  }
  if (!(month >= 1 && month <= 12)) return;

  var text = month + '月限定';
  label.textContent = text;
  var aria = link.getAttribute('aria-label');
  if (aria) link.setAttribute('aria-label', aria.replace(/^\d{1,2}月限定/, text));
})();
