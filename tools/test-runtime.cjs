const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '..');

function worker({ cached, network, put = async () => {} } = {}) {
  const handlers = {}, deleted = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), {
    self: { addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { keys: async () => ['unrelated-app', 'bm-covers-v0', 'bm-covers-v1'],
      delete: async name => deleted.push(name),
      open: async () => ({ match: async () => cached, put }) },
    fetch: network || (async () => { throw new Error('offline'); })
  });
  return { handlers, deleted };
}

function fetchEvent(handlers) {
  const event = { request: { method: 'GET', url: 'https://cms.contentsx.jp/wp-content/uploads/cover.jpg' },
    waitUntil(p) { this.background = p; }, respondWith(p) { this.response = p; } };
  handlers.fetch(event);
  assert.ok(event.background, 'background registered synchronously');
  return event;
}

test('activation only deletes caches owned by this worker', async () => {
  const { handlers, deleted } = worker();
  let done;
  handlers.activate({ waitUntil(p) { done = p; } });
  await done;
  assert.deepEqual(deleted, ['bm-covers-v0']);
});

test('cache hit responds immediately and keeps refresh/write alive', async () => {
  let release;
  const cacheWrite = new Promise(resolve => { release = resolve; });
  const fresh = { ok: true, clone() { return this; } };
  const { handlers } = worker({ cached: 'cached', network: async () => fresh, put: () => cacheWrite });
  const event = fetchEvent(handlers);
  assert.equal(await event.response, 'cached');
  let completed = false;
  event.background.then(() => { completed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false);
  release();
  await event.background;
});

test('cache miss returns the network response while the cache write is pending', async () => {
  let release;
  const cacheWrite = new Promise(resolve => { release = resolve; });
  const fresh = { ok: true, clone() { return this; } };
  const { handlers } = worker({ network: async () => fresh, put: () => cacheWrite });
  const event = fetchEvent(handlers);
  let response, completed = false;
  event.response.then(value => { response = value; });
  event.background.then(() => { completed = true; });
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(response, fresh, 'image delivery must not wait for storage');
    assert.equal(completed, false, 'worker must stay alive until storage finishes');
  } finally {
    release();
    await event.background;
  }
});

test('a synchronous cache write failure cannot hide a network response', async () => {
  const fresh = { ok: true, clone() { return this; } };
  const event = fetchEvent(worker({ network: async () => fresh, put() { throw new Error('storage'); } }).handlers);
  assert.equal(await event.response, fresh);
  await event.background;
});

test('offline fallback and storage failure preserve usable responses', async () => {
  let event = fetchEvent(worker({ cached: 'offline copy' }).handlers);
  assert.equal(await event.response, 'offline copy');
  await event.background;
  const fresh = { ok: true, clone() { return this; } };
  event = fetchEvent(worker({ network: async () => fresh, put: async () => { throw new Error('quota'); } }).handlers);
  assert.equal(await event.response, fresh);
  await event.background;
});

test('shared lead transport preserves field mapping and caller keepalive choice', async () => {
  const calls = [];
  const window = { location: { href: 'https://example.test/contact' } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/bm-lead.js'), 'utf8'), {
    window, fetch: async (...args) => { calls.push(args); return { ok: true }; }
  });
  const payload = window.bmLead.payload({ company: 'ACME', department: 'Sales', name: 'Name', email: 'a@example.test' }, 'Message', 'Page');
  await window.bmLead.send(payload);
  await window.bmLead.send(payload, true);
  const data = JSON.parse(calls[0][1].body);
  assert.deepEqual(data.fields.map(x => x.name), ['company', 'busyo', 'lastname', 'firstname', 'email', 'message']);
  assert.equal(data.fields[2].value, data.fields[3].value);
  assert.deepEqual(data.context, { pageUri: window.location.href, pageName: 'Page' });
  assert.equal('keepalive' in calls[0][1], false);
  assert.equal(calls[1][1].keepalive, true);
});
