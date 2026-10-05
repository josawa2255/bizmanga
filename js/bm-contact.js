/**
 * BizManga お問い合わせフォーム → HubSpot送信
 * トラッキング: pageUri / pageName でビズマンガからの問い合わせと識別
 * URLパラメータ ?plan=xxx がある場合はメッセージ欄に自動入力
 */
(function() {
  var form = document.getElementById('bmContactForm');
  if (!form) return;

  // プランパラメータ自動入力
  var params = new URLSearchParams(window.location.search);
  var plan = params.get('plan');
  if (plan) {
    var msgField = document.getElementById('bmMessage');
    if (msgField) {
      var planNames = { full: 'フル漫画家プラン', hybrid: 'ハイブリッドプラン' };
      msgField.value = '【' + (planNames[plan] || plan) + 'について】\n\n';
    }
  }

  // 二重送信ガード: ボタンの disabled だけだと、Enter や requestSubmit() など
  // ボタンを経由しない送信経路をすり抜ける。フォーム単位のフラグで塞ぐ（BUGS #046）
  var bmIsSubmitting = false;

  // 部署は HubSpot のフォーム側で必須（空だと送信が拒否される）。HTML の required は
  // 空白だけの入力を通すので、送信時に前後の空白を除いて空なら止める
  var bmDepartmentInput = document.getElementById('bmDepartment');
  bmDepartmentInput.addEventListener('input', function () {
    bmDepartmentInput.setCustomValidity('');
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    if (!bmDepartmentInput.value.trim()) {
      bmDepartmentInput.setCustomValidity('部署を入力してください');
      bmDepartmentInput.reportValidity();
      return;
    }

    if (bmIsSubmitting) return;
    bmIsSubmitting = true;

    var submitBtn = e.target.querySelector('.bm-form-submit');
    submitBtn.disabled = true;
    submitBtn.classList.add('is-sending');

    var company    = document.getElementById('bmCompany').value;
    var department = document.getElementById('bmDepartment').value;
    var fullName   = document.getElementById('bmName').value;
    var email      = document.getElementById('bmEmail').value;
    var message    = document.getElementById('bmMessage').value;

    var trackingNote, trackingError;
    try {
      // 流入元トラッキング情報を付加
      var tracking = ['[BizManga経由のお問い合わせ]'];
      if (plan) tracking.push('選択プラン: ' + (plan.charAt(0).toUpperCase() + plan.slice(1)));
      trackingNote = window.bmLead.trackingNote(params, tracking, [
        ['utm_source', '流入元'], ['utm_medium', '媒体'],
        ['utm_campaign', 'キャンペーン'], ['source', '参照ページ']
      ]);
    } catch (error) {
      trackingError = error;
    }

    // CRM の受信箱へも送る（失敗しても HubSpot の受付・完了表示には影響しない）。
    // 送信はページ末尾で読み込む CRM の埋め込みスクリプト（inbound-v1.js）が行う。
    // 項目は各欄の data-crm-field で指定、ボット対策の隠し欄はスクリプトタグの data-honeypot で指定。
    // ⚠️ 外部のスクリプトなので try で囲む（壊れていても HubSpot の送信・完了表示・広告CVを止めない）
    try {
      if (window.BizcarteInbound && typeof window.BizcarteInbound.sendForm === 'function') {
        window.BizcarteInbound.sendForm(e.target);
      } else {
        console.warn('CRM inbound script not loaded; skipped CRM send (HubSpot continues)');
      }
    } catch (err) {
      console.warn('CRM inbound failed (ignored):', err);
    }

    // 共通JSの未読込や同期例外も、通信失敗と同じ復旧処理へ送る。
    Promise.resolve().then(function() {
      if (trackingError) throw trackingError;
      var payload = window.bmLead.payload({
        company: company, department: department, name: fullName, email: email
      }, message + trackingNote, 'BizManga - お問い合わせ');
      return window.bmLead.send(payload);
    })
    .then(function(res) {
      if (res.ok) return res.json();
      return res.text().then(function(t) { throw new Error(t); });
    })
    .then(function() {
      // HubSpotが正常に受理した時だけ、実問い合わせとして計測する。
      if (typeof gtag === 'function') {
        // Google広告: お問合せフォーム送信完了
        gtag('event', 'conversion', {'send_to': 'AW-18108125426/F13ECI3R3qgcEPKh0LpD'});
        // GA4: 推奨イベント generate_lead。PIIは送らない。
        gtag('event', 'generate_lead', {
          'send_to': 'G-Q1T3033Q3W',
          'method': 'contact_form'
        });
      }
      var form = document.getElementById('bmContactForm');
      var thanks = document.createElement('div');
      thanks.innerHTML = '<div class="bm-contact-thanks">'
        + '<p class="bm-contact-thanks-title">お問い合わせありがとうございます。</p>'
        + '<p class="bm-contact-thanks-text">3営業日以内にご連絡いたします。</p>'
        + '</div>';
      form.parentNode.insertBefore(thanks, form.nextSibling);
      form.style.display = 'none';
    })
    .catch(function(err) {
      console.error('HubSpot submission error:', err);
      bmIsSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-sending');
      // 応答が取れなかっただけで送信自体は届いている場合がある（送信後の通信断など）。
      // 「もう一度お試しください」と促すと、届いているのに再送されて重複する（BUGS #046）
      alert('送信結果を確認できませんでした。\n通信状況によっては、すでに送信が完了している場合があります。\n重複を避けるため、しばらく経ってからもう一度お試しいただくか、お電話（03-6261-0764）にてご連絡ください。');
    });
  });
  // HTMLでは無効化しておき、標準送信を止めるハンドラーの登録後に有効化する。
  form.querySelector('.bm-form-submit').disabled = false;
  var status = document.getElementById('bmContactStatus');
  if (status) status.hidden = true;
})();
