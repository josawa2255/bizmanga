/* ============================================================
   BizManga — Pricing Quiz (Apple-style step estimator)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 料金マスター ---------- */
  const PRICE_PER_PAGE = { 1: 18900, 3: 16900, 5: 15800 };
  const MANUSCRIPT_FEE = 19800;
  const PLAN_ADD = { light: 0, standard: 15000, premium: 80000 };

  /* ---------- クイズ定義 ---------- */
  const STEPS = [
    {
      id: 'purpose',
      question: '用途を選んでください。',
      sub: '漫画をどんな目的で使いますか？',
      options: [
        { value: 'sales',    label: '営業・商談' },
        { value: 'recruit',  label: '採用' },
        { value: 'training', label: '研修・マニュアル' },
        { value: 'sns',      label: 'SNS・ブランディング' },
        { value: 'other',    label: 'その他' },
      ],
    },
    {
      id: 'qty',
      question: '本数を選んでください。',
      sub: '本数が多いほどページ単価がお得になります',
      options: [
        { value: 1, label: '1本',     right: '18,900円 / P' },
        { value: 3, label: '3本',     right: '16,900円 / P', badge: 'おすすめ' },
        { value: 5, label: '5本以上',  right: '15,800円 / P', badge: 'お得' },
      ],
    },
    {
      id: 'pages',
      question: 'ページ数を選んでください。',
      sub: '1本あたりのページ数。標準は12Pです',
      options: [
        { value: 8,   label: '8ページ',     right: 'コンパクト' },
        { value: 12,  label: '12ページ',    right: 'スタンダード', badge: '人気' },
        { value: 16,  label: '16ページ',    right: 'しっかり' },
        { value: 20,  label: '20ページ以上', right: 'ロング' },
      ],
    },
    {
      id: 'plan',
      question: 'プランを選んでください。',
      sub: '漫画制作後の活用方法によってプランが変わります',
      options: [
        {
          value: 'light',
          label: 'ライト',
          desc: '漫画制作のみ',
          right: '+0円',
        },
        {
          value: 'standard',
          label: 'スタンダード',
          desc: '漫画制作 + SNS展開',
          right: '+15,000円',
          badge: 'おすすめ',
        },
        {
          value: 'premium',
          label: 'プレミアム',
          desc: '漫画制作 + SNS展開 + ボイスコミック',
          right: '+80,000円',
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

    body.innerHTML =
      '<p class="bm-quiz-step-label">STEP ' + (currentStep + 1) + '</p>' +
      '<h3 class="bm-quiz-question">' + step.question + '</h3>' +
      (step.sub ? '<p class="bm-quiz-sub">' + step.sub + '</p>' : '') +
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
    var selected = answers[step.id] === opt.value ? 'selected' : '';
    var badge = opt.badge ? '<span class="bm-quiz-badge">' + opt.badge + '</span>' : '';

    return '<div class="bm-quiz-option ' + selected + '" data-value="' + opt.value + '">' +
      badge +
      '<div class="bm-quiz-opt-left">' +
        '<p class="bm-quiz-opt-label">' + opt.label + '</p>' +
        (opt.desc ? '<p class="bm-quiz-opt-desc">' + opt.desc + '</p>' : '') +
      '</div>' +
      (opt.right ? '<span class="bm-quiz-opt-right">' + opt.right + '</span>' : '') +
    '</div>';
  }

  function renderResult(container) {
    var body = container.querySelector('.bm-quiz-body');
    if (!body) return;

    var prog = container.querySelector('.bm-quiz-progress-wrap');
    if (prog) prog.style.display = 'none';

    var r = calcPrice();
    var planLabel = { light: 'ライト', standard: 'スタンダード', premium: 'プレミアム' };
    var purposeLabel = {
      sales: '営業・商談', recruit: '採用', training: '研修・マニュアル',
      sns: 'SNS・ブランディング', other: 'その他',
    };

    body.classList.remove('bm-quiz-enter');
    void body.offsetWidth;
    body.classList.add('bm-quiz-enter');

    body.innerHTML =
      '<div class="bm-quiz-result">' +
        '<p class="bm-quiz-result-label">概算見積もり</p>' +
        '<p class="bm-quiz-result-total">' + fmt(r.total) + '<span>〜（税抜）</span></p>' +
        '<p class="bm-quiz-result-note">※ 実際の料金は詳細のヒアリング後にご提示します</p>' +
        '<div class="bm-quiz-result-breakdown">' +
          '<div class="bm-quiz-result-row"><span>制作本数</span><span>' + (r.qty === 5 ? '5本以上' : r.qty + '本') + '</span></div>' +
          '<div class="bm-quiz-result-row"><span>ページ数</span><span>' + (r.pages === 20 ? '20P以上' : r.pages + 'P') + ' × ' + r.qty + '本</span></div>' +
          '<div class="bm-quiz-result-row"><span>ページ単価</span><span>' + fmt(r.ppp) + ' / P</span></div>' +
          '<div class="bm-quiz-result-row"><span>原稿料</span><span>' + fmt(MANUSCRIPT_FEE) + ' × ' + r.qty + '本</span></div>' +
          '<div class="bm-quiz-result-row"><span>プラン</span><span>' + planLabel[answers.plan] + '（' + (r.planAdd > 0 ? '+' + fmt(r.planAdd) : '追加なし') + '）</span></div>' +
          '<div class="bm-quiz-result-row bm-quiz-result-row--purpose"><span>用途</span><span>' + (purposeLabel[answers.purpose] || 'その他') + '</span></div>' +
        '</div>' +
        '<div class="bm-quiz-result-actions">' +
          '<a href="contact" class="bm-btn bm-btn--accent">この内容で無料相談する →</a>' +
          '<button class="bm-quiz-restart">やり直す</button>' +
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
        totalEl.innerHTML = start.toLocaleString('ja-JP') + '円<span>〜（税抜）</span>';
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
