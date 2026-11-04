const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createAskNameServer } = require('./server.cjs');

async function start(t, options) {
  const server = createAskNameServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return name => fetch(`http://127.0.0.1:${server.address().port}/api/ask-name?name=${encodeURIComponent(name)}`, {
    headers: { Origin: 'https://grenthoxha.github.io' }
  });
}

test('a name outside the old 100-name list is decided by ASK, and cached', async t => {
  let requests = 0;
  let clock = 1000;
  const lookup = await start(t, {
    now: () => clock,
    fetchImpl: async address => {
      requests++;
      const url = new URL(address);
      assert.equal(url.origin, 'https://ask.rks-gov.net');
      assert.equal(url.searchParams.get('Name'), 'Grent');
      return { ok: true, json: async () => ({ status: 0, data: [{ genderCount: { total: 12 } }] }) };
    }
  });
  const first = await lookup('Grent');
  assert.equal(first.headers.get('access-control-allow-origin'), 'https://grenthoxha.github.io');
  assert.deepEqual(await first.json(), { name: 'Grent', exists: true, total: 12, source: 'ASK' });
  assert.equal((await (await lookup('Grent')).json()).exists, true);
  assert.equal(requests, 1);
  clock += 3600001;
  await lookup('Grent');
  assert.equal(requests, 2);
});

test('a successful zero-count response means the name was not found', async t => {
  const lookup = await start(t, { fetchImpl: async () => ({ ok: true, json: async () => ({ status: 0, data: [{ genderCount: { total: 0 } }] }) }) });
  const result = await lookup('Testname');
  assert.equal(result.status, 200);
  assert.equal((await result.json()).exists, false);
});

test('source outages and malformed responses never return exists:false', async t => {
  for (const upstream of [async () => { throw new Error('offline'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({ status: 0, data: [] }) })]) {
    const lookup = await start(t, { fetchImpl: upstream });
    const result = await lookup('Arta');
    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), { error: 'ASK_UNAVAILABLE' });
  }
});

test('invalid names are rejected before contacting ASK', async t => {
  const lookup = await start(t, { fetchImpl: async () => { throw new Error('must not be called'); } });
  for (const name of ['', '123', 'Arta<script>', 'x'.repeat(81)]) {
    const response = await lookup(name);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'INVALID_NAME' });
  }
});
