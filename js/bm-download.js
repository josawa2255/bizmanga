/**
 * BizManga 資料ダウンロード（download.html）
 *
 * 入力チェックを通ったら、次の順に実行する。どれも応答を待たない（ダウンロードを止めない）。
 *   1. HubSpot へ送る（既存のお問い合わせと同じフォーム。本文の先頭に【資料ダウンロード】を付けて区別する）
 *   2. CRM の受信箱「資料DL」へ送る（ページ末尾で読み込む inbound-v1.js。種類と資料名は
 *      <form data-crm-form="download" data-crm-document="…"> の目印から自動で付く）
 *   3. PDF のダウンロードを始め、お礼と「始まらない場合」のリンクを出す
 *
 * PDF への直接リンクはフォームを通らない場所に置かない（このファイルと、送信後に出すリンクだけ）。
 * 資料を差し替えるときは PDF_URL / PDF_FILENAME と、download.html の data-crm-document・
 * ページ内の説明（ページ数・容量）を合わせて直す。
 */
(function () {
  'use strict';

  var form = document.getElementById('download-form');
  if (!form) return;

  var PDF_URL = '/material/docs/bizmanga-service-guide-202609.pdf';
  var PDF_FILENAME = 'bizmanga-service-guide-202609.pdf';
  var DOCUMENT_NAME = form.getAttribute('data-crm-document') || '';

  // HubSpot は廃止予定（2026年11月）。廃止したら false にする（CRM への送信はそのまま動く）
  var SEND_TO_HUBSPOT = true;

  // ブラウザ標準の type="email" は「a@b」も通すため、ドメインに「.」があるかも見る
  var EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/;

  var params = new URLSearchParams(window.location.search);
  var body = document.getElementById('dlFormBody');
  var thanks = document.getElementById('dlThanks');
  var fallback = document.getElementById('dlFallback');
  var emailInput = form.elements.email;
  var submitBtn = form.querySelector('button[type="submit"]');

  // 送信ボタンは download.html で disabled にしてあり、この JS が動いてから押せるようにする
  // （JS の読み込み前・失敗時にブラウザ標準の送信で入力内容が URL や計測へ載るのを防ぐ。form も method="post"）
  submitBtn.disabled = false;

  // 二重送信ガード: ボタンの disabled だけだと Enter 等の経路をすり抜ける（BUGS #046）
  var isSubmitting = false;

  emailInput.addEventListener('input', function () {
    emailInput.setCustomValidity('');
  });

  // 部署名は HubSpot のフォーム側で必須（空だと HubSpot への送信が拒否される）。
  // HTML の required は空白だけの入力を通すので、送信時に前後の空白を除いて空なら止める
  var departmentInput = form.elements.department;
  departmentInput.addEventListener('input', function () {
    departmentInput.setCustomValidity('');
  });

  function value(name) {
    var el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  }

  function sendToHubSpot() {
    var tracking = ['[BizManga 資料ダウンロード]'];
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (key) {
      var v = params.get(key);
      if (v) tracking.push(key + ': ' + v);
    });
    tracking.push('ページ: ' + window.location.href);
    var behaviorLog = typeof window.bmGetTrackingNote === 'function' ? window.bmGetTrackingNote() : '';

    var lines = ['【資料ダウンロード】' + DOCUMENT_NAME];
    if (value('tel')) lines.push('電話番号: ' + value('tel'));
    var message = lines.join('\n') + '\n\n---\n' + tracking.join('\n') + behaviorLog;

    try {
      // 共通JSの読込・ペイロード生成に失敗しても、CRM送信と資料提供を続ける。
      var payload = window.bmLead.payload({
        company: value('company'), department: value('department'),
        name: value('name'), email: value('email')
      }, message, 'BizManga - 資料ダウンロード');
      window.bmLead.send(payload, true).catch(function (err) {
        console.warn('HubSpot submission failed (download continues):', err);
      });
    } catch (err) {
      console.warn('HubSpot submission skipped:', err);
    }
  }

  function startDownload() {
    var a = document.createElement('a');
    a.href = PDF_URL;
    a.download = PDF_FILENAME;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function showThanks() {
    fallback.href = PDF_URL;
    body.hidden = true;
    thanks.hidden = false;
    thanks.focus({ preventScroll: true });
    thanks.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (isSubmitting) return;

    // 必須・メール形式・同意はブラウザ標準のチェックが済んでいる（通らないと submit 自体が起きない）
    if (!EMAIL_RE.test(value('email'))) {
      emailInput.setCustomValidity('メールアドレスの形式をご確認ください（例: name@company.co.jp）');
      emailInput.reportValidity();
      return;
    }
    if (!value('department')) {
      departmentInput.setCustomValidity('部署名を入力してください');
      departmentInput.reportValidity();
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;

    // ボット対策の隠し欄（#dlWebsite）に値がある送信は、どこへも送らずお礼だけ出す（ボットに気付かせない）
    var honeypot = form.elements.website;
    if (honeypot && String(honeypot.value || '').trim()) {
      showThanks();
      return;
    }

    if (SEND_TO_HUBSPOT) sendToHubSpot();
    // CRM の受信箱（資料DL）へも送る。外部のスクリプトなので try で囲む（壊れていてもダウンロードは止めない）
    try {
      if (window.BizcarteInbound && typeof window.BizcarteInbound.sendForm === 'function') {
        window.BizcarteInbound.sendForm(form);
      } else {
        console.warn('CRM inbound script not loaded; skipped CRM send (download continues)');
      }
    } catch (err) {
      console.warn('CRM inbound failed (ignored):', err);
    }

    startDownload();
    showThanks();
  });
})();
