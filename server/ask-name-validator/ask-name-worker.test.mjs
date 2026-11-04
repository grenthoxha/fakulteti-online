import test from 'node:test';
import assert from 'node:assert/strict';
import { createAskNameHandler } from './ask-name-worker.mjs';

const request = (name, origin = 'https://grenthoxha.github.io') => new Request(`https://name-check.test/api/ask-name?name=${encodeURIComponent(name)}`, { headers: { Origin: origin } });
test('one matching person is sufficient, including names outside the old list', async () => {
  let count = 0;
  const handler = createAskNameHandler({ fetchImpl: async address => {
    count++;
    assert.equal(new URL(address).searchParams.get('Name'), 'Grent');
    return Response.json({ status: 0, data: [{ genderCount: { total: 1 } }] });
  } });
  const result = await handler(request('Grent'));
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'https://grenthoxha.github.io');
  assert.deepEqual(await result.json(), { name: 'Grent', exists: true, total: 1, source: 'ASK' });
  assert.equal((await (await handler(request('Grent'))).json()).exists, true);
  assert.equal(count, 1);
});
test('zero matches and a source failure are distinct', async () => {
  const absent = createAskNameHandler({ fetchImpl: async () => Response.json({ status: 0, data: [{ genderCount: { total: 0 } }] }) });
  assert.equal((await (await absent(request('Testname'))).json()).exists, false);
  const offline = createAskNameHandler({ fetchImpl: async () => { throw new Error('offline'); } });
  const result = await offline(request('Arta'));
  assert.equal(result.status, 502);
  const failure = await result.json();
  assert.equal(failure.error, 'ASK_UNAVAILABLE');
  assert.equal(failure.exists, undefined);
});
test('invalid input and disallowed origins do not contact ASK', async () => {
  const handler = createAskNameHandler({ fetchImpl: async () => { assert.fail('must not call ASK'); } });
  assert.equal((await handler(request('123'))).status, 400);
  assert.equal((await handler(request('Arta', 'https://example.com'))).status, 403);
  assert.equal((await handler(new Request('https://name-check.test/api/ask-name?name=Arta&surname=Hoxha'))).status, 400);
});
