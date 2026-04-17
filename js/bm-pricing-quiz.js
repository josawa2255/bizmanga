/* ============================================================
   BizManga — Pricing Quiz (Apple-style step estimator)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 料金マスター ---------- */
  const PRICE_PER_PAGE = { 1: 15800, 3: 14800, 5: 13800 };
  const MANUSCRIPT_FEE = 0;
  const PLAN_ADD = { light: 0, standard: 15000, premium: 80000 };

  /* ---------- 言語ヘルパー ---------- */
  function getLang() { return document.documentElement.lang || 'ja'; }
  function t(ja, en) {
    if (getLang() !== 'en') return ja;
    // i18n.t() がある場合は辞書優先、なければ直指定のenを使用
    if (window.i18n && window.i18n.t) {
      var fromDict = window.i18n.t(ja);
      return (fromDict !== ja) ? fromDict : (en || ja);
    }
    return en || ja;
  }

  /* ---------- クイズ定義 ---------- */
  const STEPS = [
    {
      id: 'purpose',
      question: '用途を選んでください。', question_en: 'Select the purpose.',
      sub: '漫画をどんな目的で使いますか？', sub_en: 'What will you use the manga for?',
      options: [
        { value: 'sales',    label: '営業・商談', label_en: 'Sales' },
        { value: 'recruit',  label: '採用', label_en: 'Recruitment' },
        { value: 'training', label: '研修・マニュアル', label_en: 'Training / Manual' },
        { value: 'sns',      label: 'SNS・ブランディング', label_en: 'SNS / Branding' },
        { value: 'other',    label: 'その他', label_en: 'Other' },
      ],
    },
    {
      id: 'qty',
      question: '本数を選んでください。', question_en: 'Select quantity.',
      sub: '本数が多いほどページ単価がお得になります', sub_en: 'More volumes = lower price per page',
      options: [
        { value: 1, label: '1本', label_en: '1 volume',     right: '15,800円 / P', right_en: '¥15,800 / P' },
        { value: 3, label: '3本', label_en: '3 volumes',     right: '14,800円 / P', right_en: '¥14,800 / P', badge: 'おすすめ', badge_en: 'Recommended' },
        { value: 5, label: '5本以上', label_en: '5+ volumes',  right: '13,800円 / P', right_en: '¥13,800 / P', badge: 'お得', badge_en: 'Best Deal' },
      ],
    },
    {
      id: 'pages',
      question: 'ページ数を選んでください。', question_en: 'Select page count.',
      sub: '1本あたりのページ数。標準は12Pです', sub_en: 'Pages per volume. Standard is 12P.',
      options: [
        { value: 8,   label: '8ページ', label_en: '8 Pages',     right: 'コンパクト', right_en: 'Compact' },
        { value: 12,  label: '12ページ', label_en: '12 Pages',    right: 'スタンダード', right_en: 'Standard', badge: '人気', badge_en: 'Popular' },
        { value: 16,  label: '16ページ', label_en: '16 Pages',    right: 'しっかり', right_en: 'Detailed' },
        { value: 20,  label: '20ページ以上', label_en: '20+ Pages', right: 'ロング', right_en: 'Long' },
      ],
    },
    {
      id: 'plan',
      question: 'プランを選んでください。', question_en: 'Select a plan.',
      sub: '漫画制作後の活用方法によってプランが変わります', sub_en: 'Plans vary based on how you will use the manga',
      options: [
        {
          value: 'light',
          label: 'ライト', label_en: 'Light',
          desc: '漫画制作のみ', desc_en: 'Manga production only',
          right: '+0円', right_en: '+¥0',
        },
        {
          value: 'standard',
          label: 'スタンダード', label_en: 'Standard',
          desc: '漫画制作 + SNS展開', desc_en: 'Manga + SNS distribution',
          right: '+15,000円', right_en: '+¥15,000',
          badge: 'おすすめ', badge_en: 'Recommended',
        },
        {
          value: 'premium',
          label: 'プレミアム', label_en: 'Premium',
          desc: '漫画制作 + SNS展開 + ボイスコミック', desc_en: 'Manga + SNS + Voice Comic',
          right: '+80,000円', right_en: '+¥80,000',
        },
      ],
    },
  ];

  /* ---------- 状態 ---------- */
  const answers = {};
  let currentStep = 0;

  /* ---------- ヘルパー ---------- */
  function calcPrice() {
    const qty   = answers.qty   || 1;
    const pages = answers.pages || 12;
    const plan  = answers.plan  || 'light';
    const ppp   = PRICE_PER_PAGE[qty];
    const totalPages = pages * qty;
    const base  = ppp * totalPages + MANUSCRIPT_FEE * qty;
    const planAdd = PLAN_ADD[plan] * qty;
    return { base, planAdd, total: base + planAdd, qty, pages, ppp };
  }

  function fmt(n) {
    return n.toLocaleString('ja-JP') + '円';
  }

  /* ---------- レンダリング ---------- */
  function renderProgress(container) {
    const bar = container.querySelector('.bm-quiz-progress-bar');
    const label = container.querySelector('.bm-quiz-progress-label');
    const pct = Math.round(((currentStep) / STEPS.length) * 100);
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = 'STEP ' + (currentStep + 1) + ' / ' + STEPS.length;
  }

  function renderStep(container) {
    const step = STEPS[currentStep];
    const body = container.querySelector('.bm-quiz-body');
    if (!body) return;

    body.classList.remove('bm-quiz-enter');
    void body.offsetWidth;
    body.classList.add('bm-quiz-enter');

    var q = getLang() === 'en' ? (step.question_en || step.question) : step.question;
    var sub = getLang() === 'en' ? (step.sub_en || step.sub) : step.sub;
    body.innerHTML =
      '<p class="bm-quiz-step-label">STEP ' + (currentStep + 1) + '</p>' +
      '<h3 class="bm-quiz-question">' + q + '</h3>' +
      (sub ? '<p class="bm-quiz-sub">' + sub + '</p>' : '') +
      '<div class="bm-quiz-options">' +
        step.options.map(function(opt) { return renderOption(step, opt); }).join('') +
      '</div>';

    body.querySelectorAll('.bm-quiz-option').forEach(function(el) {
      el.addEventListener('click', function() {
        var raw = el.dataset.value;
        var val = isNaN(raw) ? raw : parseInt(raw, 10);
        answers[step.id] = val;

        body.querySelectorAll('.bm-quiz-option').forEach(function(o) { o.classList.remove('selected'); });
        el.classList.add('selected');

        setTimeout(function() {
          currentStep++;
          if (currentStep < STEPS.length) {
            renderProgress(container);
            renderStep(container);
          } else {
            renderResult(container);
          }
        }, 280);
      });
    });

    renderProgress(container);
  }

  function renderOption(step, opt) {
    var en = getLang() === 'en';
    var selected = answers[step.id] === opt.value ? 'selected' : '';
    var badgeText = en ? (opt.badge_en || opt.badge) : opt.badge;
    var badge = badgeText ? '<span class="bm-quiz-badge">' + badgeText + '</span>' : '';
    var label = en ? (opt.label_en || opt.label) : opt.label;
    var desc = en ? (opt.desc_en || opt.desc) : opt.desc;
    var right = en ? (opt.right_en || opt.right) : opt.right;

    return '<div class="bm-quiz-option ' + selected + '" data-value="' + opt.value + '">' +
      badge +
      '<div class="bm-quiz-opt-left">' +
        '<p class="bm-quiz-opt-label">' + label + '</p>' +
        (desc ? '<p class="bm-quiz-opt-desc">' + desc + '</p>' : '') +
      '</div>' +
      (right ? '<span class="bm-quiz-opt-right">' + right + '</span>' : '') +
    '</div>';
  }

  function renderResult(container) {
    var body = container.querySelector('.bm-quiz-body');
    if (!body) return;

    var prog = container.querySelector('.bm-quiz-progress-wrap');
    if (prog) prog.style.display = 'none';

    var r = calcPrice();
    var en = getLang() === 'en';
    var planLabel = en
      ? { light: 'Light', standard: 'Standard', premium: 'Premium' }
      : { light: 'ライト', standard: 'スタンダード', premium: 'プレミアム' };
    var purposeLabel = en
      ? { sales: 'Sales', recruit: 'Recruitment', training: 'Training / Manual', sns: 'SNS / Branding', other: 'Other' }
      : { sales: '営業・商談', recruit: '採用', training: '研修・マニュアル', sns: 'SNS・ブランディング', other: 'その他' };

    function fmtEn(n) { return '¥' + n.toLocaleString('en-US'); }
    var f = en ? fmtEn : fmt;
    var vol = en ? (r.qty === 5 ? '5+ volumes' : r.qty + ' volume' + (r.qty > 1 ? 's' : '')) : (r.qty === 5 ? '5本以上' : r.qty + '本');
    var pg = en ? (r.pages === 20 ? '20+ P' : r.pages + 'P') : (r.pages === 20 ? '20P以上' : r.pages + 'P');

    body.classList.remove('bm-quiz-enter');
    void body.offsetWidth;
    body.classList.add('bm-quiz-enter');

    body.innerHTML =
      '<div class="bm-quiz-result">' +
        '<p class="bm-quiz-result-label">' + t('概算見積もり', 'Estimated Price') + '</p>' +
        '<p class="bm-quiz-result-total">' + f(r.total) + '<span>' + t('〜（税抜）', '~ (excl. tax)') + '</span></p>' +
        '<p class="bm-quiz-result-note">' + t('※ 実際の料金は詳細のヒアリング後にご提示します', '* Final pricing will be provided after a detailed consultation') + '</p>' +
        '<div class="bm-quiz-result-breakdown">' +
          '<div class="bm-quiz-result-row"><span>' + t('制作本数', 'Volumes') + '</span><span>' + vol + '</span></div>' +
          '<div class="bm-quiz-result-row"><span>' + t('ページ数', 'Pages') + '</span><span>' + pg + ' × ' + vol + '</span></div>' +
          '<div class="bm-quiz-result-row"><span>' + t('ページ単価', 'Price / Page') + '</span><span>' + f(r.ppp) + ' / P</span></div>' +
          '<div class="bm-quiz-result-row"><span>' + t('原稿料', 'Manuscript Fee') + '</span><span>' + f(MANUSCRIPT_FEE) + ' × ' + vol + '</span></div>' +
          '<div class="bm-quiz-result-row"><span>' + t('プラン', 'Plan') + '</span><span>' + planLabel[answers.plan] + '（' + (r.planAdd > 0 ? '+' + f(r.planAdd) : t('追加なし', 'No extra')) + '）</span></div>' +
          '<div class="bm-quiz-result-row bm-quiz-result-row--purpose"><span>' + t('用途', 'Purpose') + '</span><span>' + (purposeLabel[answers.purpose] || t('その他', 'Other')) + '</span></div>' +
        '</div>' +
        '<div class="bm-quiz-result-actions">' +
          '<a href="/contact" class="bm-btn bm-btn--accent">' + t('この内容で無料相談する →', 'Get a Free Consultation →') + '</a>' +
          '<button class="bm-quiz-restart">' + t('やり直す', 'Start Over') + '</button>' +
        '</div>' +
      '</div>';

    // カウントアップアニメーション
    var totalEl = body.querySelector('.bm-quiz-result-total');
    if (totalEl) {
      var start = 0;
      var end = r.total;
      var duration = 900;
      var step = Math.ceil(end / (duration / 16));
      var timer = setInterval(function() {
        start = Math.min(start + step, end);
        totalEl.innerHTML = (getLang() === 'en' ? '¥' + start.toLocaleString('en-US') : start.toLocaleString('ja-JP') + '円') + '<span>' + t('〜（税抜）', '~ (excl. tax)') + '</span>';
        if (start >= end) clearInterval(timer);
      }, 16);
    }

    var restart = body.querySelector('.bm-quiz-restart');
    if (restart) {
      restart.addEventListener('click', function() {
        Object.keys(answers).forEach(function(k) { delete answers[k]; });
        currentStep = 0;
        if (prog) prog.style.display = '';
        renderProgress(container);
        renderStep(container);
      });
    }
  }

  /* ---------- 初期化 ---------- */
  function init() {
    var container = document.querySelector('.bm-quiz-container');
    if (!container) return;
    renderProgress(container);
    renderStep(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
