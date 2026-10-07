// Offline regression checks; no requests, real leads, or Google hits are sent.
// Run: node tools/test-bm-tracking.cjs [path/to/bm-tracking.js]
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../js/bm-tracking.js'), 'utf8');
const test = require('node:test');
function setup(options = {}) {
  const hits = [], winListeners = {}, docListeners = {}, faqListeners = {};
  let stored = options.stored || '{}';
  function on(store, name, fn, opts) { (store[name] ||= []).push({ fn, once: !!(opts && opts.once) }); }
  function emit(store, name, event) {
    const listeners = [...(store[name] || [])];
    store[name] = (store[name] || []).filter(x => !x.once);
    listeners.forEach(x => x.fn(event));
  }
  const location = new URL(options.url || 'https://bizmanga.contentsx.jp/pricing?utm_source=test');
  const faq = { textContent: '料金は？', addEventListener: (name, fn, opts) => on(faqListeners, name, fn, opts) };
  const document = {
    readyState: options.readyState || 'complete',
    documentElement: { scrollHeight: options.scrollHeight ?? 1800 },
    querySelectorAll: selector => selector === '.bm-faq-q' ? [faq] : [],
    addEventListener: (name, fn, opts) => on(docListeners, name, fn, opts)
  };
  const window = {
    scrollY: 0, innerHeight: 800,
    addEventListener: (name, fn, opts) => on(winListeners, name, fn, opts),
    gtag: (...args) => hits.push(args)
  };
  if (options.noGtag) delete window.gtag;
  if (options.throwGtag) window.gtag = () => { throw Error('blocked'); };
  const sessionStorage = {
    getItem() { if (options.denyStorage) throw Error('denied'); return stored; },
    setItem(key, val) { if (options.denyStorage) throw Error('denied'); stored = val; }
  };
  const context = vm.createContext({ window, document, location, sessionStorage, URL, console });
  const run = () => vm.runInContext(source, context);
  run();
  const click = (href, overrides = {}) => {
    const link = { getAttribute: () => href };
    const target = { closest: selector => selector === 'a[href]' ? link : null };
    emit(docListeners, 'click', {
      target, isTrusted: true, button: 0,
      preventDefault() { throw Error('Navigation must not be prevented'); },
      stopPropagation() { throw Error('Propagation must not be stopped'); },
      ...overrides
    });
  };
  return { hits, window, document, run, click, data: () => JSON.parse(stored),
    note: () => window.bmGetTrackingNote(),
    faq: () => emit(faqListeners, 'click', {}),
    event: event => emit(docListeners, 'click', event),
    load: () => { document.readyState = 'complete'; emit(winListeners, 'load', {}); },
    scroll: y => { window.scrollY = y; emit(winListeners, 'scroll', {}); }
  };
}
test('initialization emits no analytics event and preserves visit note', () => {
  const h = setup(); assert.equal(h.hits.length, 0); assert.match(h.note(), /訪問ページ: pricing/);
});
for (const [href, event] of [
  ['/contact', 'contact_link_click'], ['contact.html?plan=full', 'contact_link_click'],
  ['/contact/?source=pricing', 'contact_link_click'], ['/download', 'download_link_click'],
  ['/download.html?source=pricing', 'download_link_click'], ['tel:03-6261-0764', 'phone_click'],
  ['https://line.me/R/ti/p/@626kzaze?secret=not-logged', 'line_click'],
  ['https://lin.ee/example', 'line_click']
]) test('classifies ' + href.split('?')[0], () => {
  const h = setup(); h.click(href); assert.equal(h.hits.length, 1); assert.equal(h.hits[0][0], 'event');
  assert.equal(h.hits[0][1], event);
  assert.deepEqual(JSON.parse(JSON.stringify(h.hits[0][2])), { send_to: 'G-Q1T3033Q3W', page_path: '/pricing' });
});
test('unrelated links, lookalikes, and non-HTTPS LINE links are ignored', () => {
  const h = setup();
  for (const u of ['/works','/contact/contact','https://contentsx.jp/contact','https://line.me.evil.example/','http://line.me/R/','mailto:a@example.test','#contact','javascript:void(0)','https://[bad']) h.click(u);
  assert.equal(h.hits.length, 0);
});
test('self links are not counted as new form visits', () => {
  const a = setup({ url: 'https://bizmanga.contentsx.jp/contact.html' }); a.click('/contact?x=1');
  const b = setup({ url: 'https://bizmanga.contentsx.jp/download/' }); b.click('/download.html');
  assert.equal(a.hits.length + b.hits.length, 0);
});
test('local and preview environments cannot emit new production events', () => {
  for (const url of ['http://127.0.0.1:5500/','http://localhost:3000/','https://example.github.io/']) {
    const h = setup({ url }); h.click('/contact'); h.click('https://line.me/R/'); assert.equal(h.hits.length,0);
  }
});
test('synthetic and right-button clicks are ignored', () => {
  const h = setup(); h.click('/contact', { isTrusted: false }); h.click('/contact', { button: 2 }); assert.equal(h.hits.length,0);
});
test('non-element click targets do not throw', () => { setup().event({ target: {}, isTrusted: true }); });
test('duplicate loading does not duplicate listeners', () => {
  const h=setup(); h.run(); h.click('/contact'); assert.equal(h.hits.length,1); assert.equal(h.data().pages.length,1);
});
test('missing or throwing analytics cannot block navigation', () => {
  setup({noGtag:true}).click('/contact'); setup({throwGtag:true}).click('/contact');
});
test('early events wait for existing load initialization and emit once', () => {
  const h=setup({readyState:'interactive'}); h.click('/contact'); assert.equal(h.hits.length,0);
  h.load(); h.load(); assert.equal(h.hits.length,1);
});
for (const stored of ['null','[]','true','42','"string"','{bad','{"pages":{}}','{"pages":"wrong","faqClicked":"wrong","categoryViewed":"wrong"}'])
  test('recovers malformed stored data ' + stored, () => {
    const h=setup({stored}); h.note(); h.faq(); h.note(); h.click('/contact'); assert.equal(h.hits.length,1);
  });
test('storage access denied does not break analytics or form note', () => {
  const h=setup({denyStorage:true}); assert.equal(h.note(),''); h.click('/contact'); assert.equal(h.hits.length,1);
});
test('normal scroll and overscroll remain within 0 to 100', () => {
  const h=setup(); h.scroll(500); assert.equal(h.data().scroll_pricing,50);
  h.scroll(2000); assert.equal(h.data().scroll_pricing,100); h.scroll(-100); assert.equal(h.data().scroll_pricing,100);
});
test('non-scrollable page records neither Infinity nor null', () => {
  const h=setup({scrollHeight:800}); h.scroll(10); assert.equal(h.data().scroll_pricing,undefined);
});
test('FAQ and category logging retain existing form-note behavior', () => {
  const h=setup(); h.faq(); h.faq();
  h.event({target:{closest: s => s === '.bm-filter-btn, .filter-btn' ? {textContent:'採用 (3)'} : null}, isTrusted:true});
  assert.equal(h.data().faqClicked.length,1); assert.match(h.note(),/閲覧FAQ: 料金は？/); assert.match(h.note(),/関心カテゴリ: 採用/);
});
test('no click emits a lead or Google Ads conversion', () => {
  const h=setup(); ['/contact','/download','tel:000','https://line.me/R/'].forEach(href=>h.click(href));
  assert.ok(h.hits.every(hit => !['generate_lead','conversion','click'].includes(hit[1])));
});
