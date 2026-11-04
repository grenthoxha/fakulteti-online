const ASK_URL = 'https://ask.rks-gov.net/NameSearch/GetNamesCount/';
const ALLOWED_ORIGINS = new Set(['https://grenthoxha.github.io', 'null']);

export function createAskNameHandler({ fetchImpl = (input, init) => globalThis.fetch(input, init), now = Date.now } = {}) {
  const cache = new Map();
  return async function handleAskNameRequest(request) {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some(key => key !== 'name') || url.searchParams.getAll('name').length !== 1) return reply({ error: 'INVALID_NAME' }, 400);
    const name = String(url.searchParams.get('name') || '').normalize('NFC').trim().replace(/\s+/g, ' ');
    if (name.length > 80 || (name.match(/\p{L}/gu) || []).length < 2 || !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(name)) return reply({ error: 'INVALID_NAME' }, 400);
    const key = name.toLocaleLowerCase('sq');
    const saved = cache.get(key);
    if (saved && saved.expiresAt > now()) return reply({ name, exists: saved.total >= 1, total: saved.total, source: 'ASK' });
    let upstreamStatus = null;
    let upstreamContentType = null;
    let stage = 'prepare';
    try {
      const target = new URL(ASK_URL);
      target.searchParams.set('Name', name);
      stage = 'fetch';
      const response = await fetchImpl(target.href, { signal: AbortSignal.timeout(7000), headers: { Accept: 'application/json' }, redirect: 'manual' });
      upstreamStatus = response.status;
      upstreamContentType = response.headers.get('content-type');
      if (!response.ok) throw new Error('ASK_UNAVAILABLE');
      stage = 'parse';
      const result = await response.json();
      const total = result?.data?.[0]?.genderCount?.total;
      if (result?.status !== 0 || !Number.isSafeInteger(total) || total < 0) throw new Error('ASK_UNAVAILABLE');
      if (cache.size >= 1000) cache.delete(cache.keys().next().value);
      cache.set(key, { total, expiresAt: now() + 3600000 });
      return reply({ name, exists: total >= 1, total, source: 'ASK' });
    } catch (error) {
      console.warn('ASK lookup unavailable', { upstreamStatus, upstreamContentType, errorClass: error?.name || 'Error' });
      return reply({ error: 'ASK_UNAVAILABLE' }, 502);
    }
  };
}

export const handleAskNameRequest = createAskNameHandler();
