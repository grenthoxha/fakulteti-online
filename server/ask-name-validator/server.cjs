const http = require('node:http');

const ASK_LOOKUP_URL = 'https://ask.rks-gov.net/NameSearch/GetNamesCount/';
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;

function normalizeGivenName(value) {
  const name = String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (name.length > 80 || (name.match(/\p{L}/gu) || []).length < 2
    || !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(name)) return null;
  return name;
}

function createAskNameServer({
  fetchImpl = globalThis.fetch,
  now = Date.now,
  allowedOrigins = ['https://grenthoxha.github.io', 'null']
} = {}) {
  const origins = new Set(allowedOrigins);
  const cache = new Map();

  return http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' };
    const send = (status, body) => {
      response.writeHead(status, headers);
      response.end(JSON.stringify(body));
    };
    if (origin && !origins.has(origin)) return send(403, { error: 'ORIGIN_NOT_ALLOWED' });
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    if (request.method === 'OPTIONS') { response.writeHead(204, headers); return response.end(); }
    if (request.method !== 'GET') return send(405, { error: 'METHOD_NOT_ALLOWED' });

    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/health') return send(200, { status: 'ok' });
    if (url.pathname !== '/api/ask-name') return send(404, { error: 'NOT_FOUND' });
    // This endpoint accepts a given name only. It never receives surnames or ID documents.
    if ([...url.searchParams.keys()].some(key => key !== 'name') || url.searchParams.getAll('name').length !== 1) {
      return send(400, { error: 'INVALID_NAME' });
    }
    const name = normalizeGivenName(url.searchParams.get('name'));
    if (!name) return send(400, { error: 'INVALID_NAME' });
    const key = name.toLocaleLowerCase('sq');
    const saved = cache.get(key);
    if (saved && saved.expiresAt > now()) return send(200, { name, exists: saved.total > 0, total: saved.total, source: 'ASK' });

    try {
      const target = new URL(ASK_LOOKUP_URL);
      target.searchParams.set('Name', name);
      const upstream = await fetchImpl(target.href, {
        signal: AbortSignal.timeout(7000),
        headers: { Accept: 'application/json' },
        redirect: 'error'
      });
      if (!upstream.ok) throw new Error('ASK_UNAVAILABLE');
      const result = await upstream.json();
      const total = result?.data?.[0]?.genderCount?.total;
      if (result?.status !== 0 || !Number.isSafeInteger(total) || total < 0) throw new Error('ASK_UNAVAILABLE');
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
      cache.set(key, { total, expiresAt: now() + CACHE_TTL_MS });
      return send(200, { name, exists: total > 0, total, source: 'ASK' });
    } catch (error) {
      // An unavailable source is not evidence that a name does not exist.
      const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      return send(timeout ? 504 : 502, { error: 'ASK_UNAVAILABLE' });
    }
  });
}

if (require.main === module) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://grenthoxha.github.io,null').split(',').map(value => value.trim()).filter(Boolean);
  const port = Number(process.env.PORT) || 8787;
  createAskNameServer({ allowedOrigins }).listen(port, '0.0.0.0', () => {
    console.log(`ASK name validator listening on port ${port}`);
  });
}

module.exports = { createAskNameServer, normalizeGivenName };
