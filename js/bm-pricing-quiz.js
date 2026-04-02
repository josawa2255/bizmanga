/* ============================================================
   BizManga — Pricing Quiz (Apple-style step estimator)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 料金マスター ---------- */
  const PRICE_PER_PAGE = { 1: 18900, 3: 16900, 5: 15800 };
  const MANUSCRIPT_FEE = 19800; // 原稿料（1本あたり）
  const PLAN_ADD = { light: 0, standard: 15000, premium: 80000 };

  /* ---------- クイズ定義 ---------- */
  const STEPS = [
    {
      id: 'purpose',
      question: '漫画をどんな目的で使いますか？',
      sub: '最も近いものをお選びください',
      options: [
        { value: 'sales',    label: '営業・商談',     icon: '💼' },
        { value: 'recruit',  label: '採用',           icon: '🤝' },
        { value: 'training', label: '研修・マニュアル', icon: '📚' },
        { value: 'sns',      label: 'SNS・ブランディング', icon: '📱' },
        { value: 'other',    label: 'その他',          icon: '✨' },
      ],
    },
    {
      id: 'qty',
      question: '制作本数はどのくらいをお考えですか？',
      sub: '本数が多いほどページ単価がお得になります',
      options: [
        { value: 1, label: '1本',    sub: '18,900円 / P',  badge: '' },
        { value: 3, label: '3本',    sub: '16,900円 / P',  badge: 'おすすめ' },
        { value: 5, label: '5本以上', sub: '15,800円 / P',  badge: 'お得' },
      ],
    },
    {
      id: 'pages',
      question: '1本あたりのページ数は？',
      sub: '標準は12Pです。用途によって調整できます',
      options: [
        { value: 8,   label: '8P',     sub: 'コンパクト' },
        { value: 12,  label: '12P',    sub: 'スタンダード', badge: '人気' },
        { value: 16,  label: '16P',    sub: 'リッチ' },
        { value: 20,  label: '20P以上', sub: 'ロング' },
      ],
    },
    {
      id: 'plan',
      question: '展開プランをお選びください',
      sub: '漫画制作後の活用方法によってプランが変わります',
      options: [
        {
          value: 'light',
          label: 'ライト',
          icon: '📄',
          desc: '漫画制作のみ',
          add: '+0円',
        },
        {
          value: 'standard',
          label: 'スタンダード',
          icon: '📢',
          desc: '漫画制作 + SNS展開',
          add: '+15,000円',
          badge: 'おすすめ',
        },
        {
          value: 'premium',
          label: 'プレミアム',
          icon: '🎙️',
          desc: '漫画制作 + SNS展開 + ボイスコミック',
          add: '+80,000円',
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
    if (label) label.textContent = `STEP ${currentStep + 1} / ${STEPS.length}`;
  }

  function renderStep(container) {
    const step = STEPS[currentStep];
    const body = container.querySelector('.bm-quiz-body');
    if (!body) return;

    body.classList.remove('bm-quiz-enter');
    void body.offsetWidth; // reflow
    body.classList.add('bm-quiz-enter');

    body.innerHTML = `
      <p class="bm-quiz-step-label">STEP ${currentStep + 1}</p>
      <h3 class="bm-quiz-question">${step.question}</h3>
      ${step.sub ? `<p class="bm-quiz-sub">${step.sub}</p>` : ''}
      <div class="bm-quiz-options ${step.id === 'plan' ? 'bm-quiz-options--plan' : ''}">
        ${step.options.map(opt => renderOption(step, opt)).join('')}
      </div>
    `;

    // イベント登録
    body.querySelectorAll('.bm-quiz-option').forEach(el => {
      el.addEventListener('click', () => {
        const raw = el.dataset.value;
        const val = isNaN(raw) ? raw : parseInt(raw, 10);
        answers[step.id] = val;

        // 選択アニメーション
        body.querySelectorAll('.bm-quiz-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');

        setTimeout(() => {
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
    const selected = answers[step.id] === opt.value ? 'selected' : '';
    const badge = opt.badge ? `<span class="bm-quiz-badge">${opt.badge}</span>` : '';

    if (step.id === 'plan') {
      return `
        <div class="bm-quiz-option bm-quiz-option--plan ${selected}" data-value="${opt.value}">
          ${badge}
          <span class="bm-quiz-plan-icon">${opt.icon}</span>
          <p class="bm-quiz-plan-label">${opt.label}</p>
          <p class="bm-quiz-plan-desc">${opt.desc}</p>
          <p class="bm-quiz-plan-add">${opt.add}</p>
        </div>
      `;
    }

    if (step.id === 'purpose') {
      return `
        <div class="bm-quiz-option bm-quiz-option--purpose ${selected}" data-value="${opt.value}">
          <span class="bm-quiz-purpose-icon">${opt.icon}</span>
          <span class="bm-quiz-purpose-label">${opt.label}</span>
        </div>
      `;
    }

    // qty / pages
    return `
      <div class="bm-quiz-option bm-quiz-option--default ${selected}" data-value="${opt.value}">
        ${badge}
        <p class="bm-quiz-opt-main">${opt.label}</p>
        ${opt.sub ? `<p class="bm-quiz-opt-sub">${opt.sub}</p>` : ''}
      </div>
    `;
  }

  function renderResult(container) {
    const body = container.querySelector('.bm-quiz-body');
    if (!body) return;

    const prog = container.querySelector('.bm-quiz-progress-wrap');
    if (prog) prog.style.display = 'none';

    const { base, planAdd, total, qty, pages, ppp } = calcPrice();
    const planLabel = { light: 'ライト', standard: 'スタンダード', premium: 'プレミアム' };
    const purposeLabel = {
      sales: '営業・商談', recruit: '採用', training: '研修・マニュアル',
      sns: 'SNS・ブランディング', other: 'その他',
    };

    body.classList.remove('bm-quiz-enter');
    void body.offsetWidth;
    body.classList.add('bm-quiz-enter');

    body.innerHTML = `
      <div class="bm-quiz-result">
        <p class="bm-quiz-result-label">概算見積もり</p>
        <p class="bm-quiz-result-total">${fmt(total)}<span>〜（税抜）</span></p>
        <p class="bm-quiz-result-note">※ 実際の料金は詳細のヒアリング後にご提示します</p>

        <div class="bm-quiz-result-breakdown">
          <div class="bm-quiz-result-row">
            <span>制作本数</span><span>${qty === 5 ? '5本以上' : qty + '本'}</span>
          </div>
          <div class="bm-quiz-result-row">
            <span>ページ数</span><span>${pages === 20 ? '20P以上' : pages + 'P'} × ${qty}本</span>
          </div>
          <div class="bm-quiz-result-row">
            <span>ページ単価</span><span>${fmt(ppp)} / P</span>
          </div>
          <div class="bm-quiz-result-row">
            <span>原稿料</span><span>${fmt(MANUSCRIPT_FEE)} × ${qty}本</span>
          </div>
          <div class="bm-quiz-result-row">
            <span>プラン</span><span>${planLabel[answers.plan]}（${planAdd > 0 ? '+' + fmt(planAdd) : '追加なし'}）</span>
          </div>
          <div class="bm-quiz-result-row bm-quiz-result-row--purpose">
            <span>用途</span><span>${purposeLabel[answers.purpose] || 'その他'}</span>
          </div>
        </div>

        <div class="bm-quiz-result-actions">
          <a href="contact" class="bm-btn bm-btn--accent">この内容で無料相談する →</a>
          <button class="bm-quiz-restart">やり直す</button>
        </div>
      </div>
    `;

    // カウントアップアニメーション
    const totalEl = body.querySelector('.bm-quiz-result-total');
    if (totalEl) {
      let start = 0;
      const end = total;
      const duration = 900;
      const step = Math.ceil(end / (duration / 16));
      const timer = setInterval(() => {
        start = Math.min(start + step, end);
        totalEl.innerHTML = `${start.toLocaleString('ja-JP')}円<span>〜（税抜）</span>`;
        if (start >= end) clearInterval(timer);
      }, 16);
    }

    // やり直しボタン
    const restart = body.querySelector('.bm-quiz-restart');
    if (restart) {
      restart.addEventListener('click', () => {
        Object.keys(answers).forEach(k => delete answers[k]);
        currentStep = 0;
        if (prog) prog.style.display = '';
        renderProgress(container);
        renderStep(container);
      });
    }
  }

  /* ---------- 初期化 ---------- */
  function init() {
    const container = document.querySelector('.bm-quiz-container');
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
