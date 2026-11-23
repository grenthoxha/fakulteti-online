import { handleCloudAuth, cloudAccount, handleCloudProfile } from './cloud-accounts.mjs';
export const ADMIN_EMAIL = 'grent@gmail.com';
export const SECTIONS = ['home', 'schedule', 'courses', 'exams', 'services', 'rooms', 'messages', 'articles'];
const LANDINGS = ['auto', 'home', 'week', 'courses', 'student', 'studentservices', 'freerooms', 'articles', 'settings'];
const allowedOrigins = new Set(['https://grenthoxha.github.io', 'null']);
const utf8 = new TextEncoder();
const hex = value => [...new Uint8Array(value)].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = value => new Uint8Array(value.match(/../g).map(v => parseInt(v, 16)));
const hash = async value => hex(await crypto.subtle.digest('SHA-256', utf8.encode(value)));
const random = () => hex(crypto.getRandomValues(new Uint8Array(24)));
const fail = (code, status = 400) => { throw Object.assign(new Error(code), { code, status }); };
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const policy = row => ({ id: row.id, email: row.email, name: row.name, status: row.status,
  role: row.role, requestedRole: row.requested_role, permissions: JSON.parse(row.permissions),
  landing: row.landing, createdAt: row.created_at, updatedAt: row.updated_at, version: row.version });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const signedText = (request, body) => [request.method, new URL(request.url).pathname,
  request.headers.get('X-Fakulteti-Time'), request.headers.get('X-Fakulteti-Nonce'), body].join('\n');
async function isLinkedAdmin(db, id) {
  // Keep the original desktop binding valid while allowing owner-authorized phones.
  return Boolean(await db.prepare("SELECT value FROM approval_settings WHERE (key = 'admin_id' AND value = ?) OR key = ?").bind(id, 'admin_device:' + id).first());
}
async function verify(request, body, jwk, id, db, now) {
  const time = Number(request.headers.get('X-Fakulteti-Time'));
  const nonce = request.headers.get('X-Fakulteti-Nonce') || '';
  const signature = request.headers.get('X-Fakulteti-Signature') || '';
  if (!Number.isFinite(time) || Math.abs(now - time) > 300000 || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{128}$/.test(signature)) fail('SIGNATURE_INVALID', 401);
  let valid = false;
  try {
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || 'd' in jwk) fail('KEY_INVALID');
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unhex(signature), utf8.encode(signedText(request, body)));
  } catch { fail('SIGNATURE_INVALID', 401); }
  if (!valid) fail('SIGNATURE_INVALID', 401);
  await db.prepare('DELETE FROM approval_nonces WHERE expires_at < ?').bind(now).run();
  const saved = await db.prepare('INSERT OR IGNORE INTO approval_nonces (key, expires_at) VALUES (?, ?)').bind(id + ':' + nonce, now + 600000).run();
  if (!saved.meta?.changes) fail('REQUEST_REPLAYED', 409);
}
function accessPage(content, status = 200) {
  return new Response(`<!doctype html><html lang="sq"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>Fakulteti · Administrimi</title><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#0b1020;color:#e8eef7;font:16px/1.6 system-ui}main{width:min(420px,calc(100% - 64px));padding:26px;border:1px solid #283247;background:#141d2d;border-radius:24px}h1{font-size:24px;line-height:1.25}p{color:#adb9cd}a,button{display:block;box-sizing:border-box;width:100%;padding:13px 18px;border:0;border-radius:12px;background:#1557b0;color:white;text-align:center;text-decoration:none;font:600 16px system-ui;cursor:pointer}small{color:#adb9cd}</style><main><strong>Fakulteti</strong>${content}</main></html>`, {
    status, headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", 'Referrer-Policy':'no-referrer' }
  });
}
async function linkAdmin(request, db, now, ownerEmail) {
  const url = new URL(request.url);
  const id = url.searchParams.get('request') || '', token = url.searchParams.get('token') || '';
  if (!/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9]{48}$/.test(token)) return accessPage('<h1>Lidhja nuk është e vlefshme</h1><p>Hape lidhjen e administrimit nga llogaria grent@gmail.com në app.</p>');
  const userId = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (!userId || !email) return accessPage(`<h1>Lidh administrimin</h1><p>Identifikohu me llogarinë që zotëron këtë shërbim për ta lidhur administrimin me grent@gmail.com në pajisjen tënde.</p><a target="_top" href="/signin-with-chatgpt?return_to=${encodeURIComponent(url.pathname + url.search)}">Vazhdo me ChatGPT</a>`);
  if (!ownerEmail || email.toLowerCase() !== ownerEmail.toLowerCase()) return accessPage('<h1>Kjo llogari nuk ka leje</h1><p>Lidhjen fillestare mund ta bëjë vetëm pronari i shërbimit.</p>');
  const link = await db.prepare('SELECT * FROM approval_admin_links WHERE token_hash = ? AND request_id = ? AND expires_at > ?').bind(await hash(token), id, now).first();
  const row = await db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(id).first();
  if (!link || row?.email !== ADMIN_EMAIL) return accessPage('<h1>Lidhja ka skaduar</h1><p>Krijo një lidhje të re nga app-i dhe provo sërish.</p>');
  if (request.method === 'GET') {
    const csrf = random();
    await db.prepare('UPDATE approval_admin_links SET csrf_hash = ?, csrf_owner = ? WHERE token_hash = ?').bind(await hash(csrf), userId, await hash(token)).run();
    return accessPage(`<h1>Lidh administrimin</h1><p>Po lidh llogarinë <strong>${escape(row.email)}</strong> të ${escape(row.name)} me pajisjen që krijoi këtë kërkesë.</p><form method="post" action="${escape(url.pathname + url.search)}"><input type="hidden" name="csrf" value="${csrf}"><button type="submit">Lidh këtë pajisje si administrator</button></form><p><small>Kjo pajisje do të shtohet për administrim. Pajisjet e lidhura më parë mbeten aktive. Materialet e mësimit qëndrojnë lokalisht.</small></p>`);
  }
  // Privacy-preserving browser contexts can send Origin:null on same-site form
  // submissions. Require the one-use form proof and verified owner in both cases.
  if (request.method !== 'POST' || ![url.origin, 'null'].includes(request.headers.get('Origin'))) fail('ORIGIN_DENIED', 403);
  if (Number(request.headers.get('Content-Length') || 0) > 1024) fail('REQUEST_TOO_LARGE', 413);
  const formBody = await request.text();
  if (utf8.encode(formBody).length > 1024) fail('REQUEST_TOO_LARGE', 413);
  const csrf = new URLSearchParams(formBody).get('csrf') || '';
  if (!/^[a-f0-9]{48}$/.test(csrf) || link.csrf_owner !== userId || !link.csrf_hash || await hash(csrf) !== link.csrf_hash) fail('CONFIRMATION_EXPIRED', 403);
  const consumed = await db.prepare('DELETE FROM approval_admin_links WHERE token_hash = ? AND csrf_hash = ? AND csrf_owner = ? AND expires_at > ? RETURNING request_id').bind(await hash(token), link.csrf_hash, userId, now).first();
  if (!consumed || consumed.request_id !== id) fail('CONFIRMATION_EXPIRED', 403);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO approval_settings (key, value) VALUES ('admin_id', ?)").bind(id),
    db.prepare('INSERT OR IGNORE INTO approval_settings (key, value) VALUES (?, ?)').bind('admin_device:' + id, String(now)),
    db.prepare("UPDATE approval_requests SET status = 'approved', role = 'admin', permissions = ?, landing = 'auto', version = version + 1, updated_at = ? WHERE id = ?").bind(JSON.stringify(SECTIONS), now, id)
  ]);
  return accessPage('<h1>Administrimi u lidh</h1><p>Kthehu te app-i nga ku e nise kërkesën, në telefon ose kompjuter. Aty tani mund të menaxhosh kërkesat dhe lejet. Pajisjet e tjera mbeten të lidhura.</p><a href="https://grenthoxha.github.io/fakulteti-online/">Hap Fakulteti në browser</a>');
}
export async function handleApprovalRequest(request, env, now = Date.now()) {
  const url = new URL(request.url), origin = request.headers.get('Origin');
  const local = origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const headers = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Vary':'Origin' };
  if (allowedOrigins.has(origin) || local) Object.assign(headers, { 'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, X-Fakulteti-Id, X-Fakulteti-Time, X-Fakulteti-Nonce, X-Fakulteti-Signature' });
  const finish = response => { Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value)); return response; };
  try {
    if (url.pathname === '/link-admin') return finish(await linkAdmin(request, env.DB, now, env.APPROVAL_OWNER_EMAIL));
    if (url.pathname === '/' || url.pathname === '/health') return finish(json({ service:'Fakulteti approvals', status:'ok', stores:'accounts, profiles and approvals; learning data stays local', accountDatabase:1 }));
    if (origin && !allowedOrigins.has(origin) && !local && origin !== url.origin) fail('ORIGIN_DENIED', 403);
    if (request.method === 'OPTIONS') return finish(new Response(null, { status:204 }));
    if (!env.DB) fail('SERVICE_UNAVAILABLE', 503);
    const db = env.DB;
    const body = ['POST','PATCH'].includes(request.method) ? await request.text() : '';
    if (utf8.encode(body).length > (url.pathname === '/api/cloud/profile' || url.pathname === '/api/cloud/register' ? 270000 : 8192)) fail('REQUEST_TOO_LARGE', 413);
    let input = {};
    if (body) { try { input = JSON.parse(body); } catch { fail('BODY_INVALID'); } }
    const id = request.headers.get('X-Fakulteti-Id') || '';
    if (!/^[a-f0-9]{64}$/.test(id)) fail('SIGNATURE_REQUIRED', 401);
    if (/^\/api\/cloud\/(register|login|recover)$/.test(url.pathname) && request.method === 'POST') {
      return finish(json(await handleCloudAuth(request,input,body,id,db,now,verify,isLinkedAdmin)));
    }
    if (url.pathname === '/api/requests' && request.method === 'POST') {
      const email = String(input.email || '').trim().toLowerCase(), name = String(input.name || '').normalize('NFC').trim();
      const jwk = input.publicKey;
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254 || name.length < 3 || name.length > 180 || !['student','instructor'].includes(input.role)) fail('PROFILE_INVALID');
      if (!jwk || typeof jwk.x !== 'string' || typeof jwk.y !== 'string' || await hash(jwk.x + '.' + jwk.y) !== id) fail('KEY_INVALID');
      await verify(request, body, jwk, id, db, now);
      const existing = await db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(id).first();
      if (existing) { if (existing.email !== email || existing.name !== name) fail('IDENTITY_CHANGED', 409); return finish(json(policy(existing))); }
      const address = request.headers.get('CF-Connecting-IP') || id;
      const limitKey = await hash(address + ':' + Math.floor(now / 900000));
      const limit = await db.prepare('INSERT INTO approval_limits (key, count) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(limitKey).first();
      if (limit.count > 20) fail('RATE_LIMITED', 429);
      await db.prepare('INSERT INTO approval_requests (id,email,name,public_key,requested_role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id,email,name,JSON.stringify({kty:jwk.kty,crv:jwk.crv,x:jwk.x,y:jwk.y}),input.role,now,now).run();
      return finish(json(policy(await db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(id).first()), 201));
    }
    const caller = await db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(id).first();
    if (!caller) fail('REQUEST_NOT_FOUND', 404);
    await verify(request, body, JSON.parse(caller.public_key), id, db, now);
    const account = await cloudAccount(db,id);
    if (url.pathname === '/api/cloud/profile') return finish(json(await handleCloudProfile(request,input,account,db,now)));
    const canonical = account ? await db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(account.approval_id).first() : caller;
    // A password-enrolled device inherits the verified owner's account rights.
    // An unrelated request using the same email never gets a cloud binding.
    const isAdmin = canonical.email === ADMIN_EMAIL && canonical.status === 'approved' && canonical.role === 'admin' && await isLinkedAdmin(db, canonical.id);
    if (url.pathname === '/api/me' && request.method === 'GET') return finish(json({ ...policy(canonical), id, isAdmin }));
    if (url.pathname === '/api/admin-link' && request.method === 'POST') {
      if (caller.email !== ADMIN_EMAIL) fail('ADMIN_REQUIRED', 403);
      const token = random();
      await db.prepare('DELETE FROM approval_admin_links WHERE request_id = ? OR expires_at < ?').bind(id, now).run();
      await db.prepare('INSERT INTO approval_admin_links (token_hash,request_id,expires_at) VALUES (?,?,?)').bind(await hash(token),id,now + 600000).run();
      return finish(json({ url:url.origin + '/link-admin?request=' + id + '&token=' + token }));
    }
    if (!isAdmin) fail('ADMIN_REQUIRED', 403);
    if (url.pathname === '/api/admin/audit' && request.method === 'GET') {
      const rows=await db.prepare('SELECT e.action,e.created_at AS createdAt,COALESCE(a.email,r.email) AS email,COALESCE(r.name,ar.name) AS name FROM account_audit e LEFT JOIN cloud_accounts a ON a.id=e.subject LEFT JOIN approval_requests r ON r.id=e.subject LEFT JOIN approval_requests ar ON ar.id=a.approval_id ORDER BY e.created_at DESC LIMIT 100').all();
      return finish(json({events:rows.results}));
    }
    if (url.pathname === '/api/admin/requests' && request.method === 'GET') {
      const rows = await db.prepare("SELECT r.*,a.id AS account_id,a.profile AS cloud_profile,a.last_login FROM approval_requests r LEFT JOIN cloud_accounts a ON a.approval_id=r.id WHERE (r.role <> 'admin' OR r.id = ?) AND NOT EXISTS (SELECT 1 FROM cloud_accounts ca WHERE ca.email=r.email AND ca.approval_id<>r.id) ORDER BY r.created_at DESC LIMIT 1000").bind(canonical.id).all();
      return finish(json({ requests:rows.results.map(row=>{
        const profile=row.cloud_profile?JSON.parse(row.cloud_profile):null;
        return {...policy(row),online:Boolean(row.account_id),lastLogin:row.last_login||null,
          profile:profile?{faculty:profile.faculty,branch:profile.branch,year:profile.year}:null};
      }) }));
    }
    const target = /^\/api\/admin\/requests\/([a-f0-9]{64})$/.exec(url.pathname);
    if (target && request.method === 'PATCH') {
      if (await isLinkedAdmin(db, target[1])) fail('ADMIN_SELF_CHANGE_DENIED', 403);
      if (!['approved','rejected','suspended','pending'].includes(input.status) || !['student','instructor'].includes(input.role) || !Array.isArray(input.permissions) || input.permissions.some(p => !SECTIONS.includes(p)) || !LANDINGS.includes(input.landing) || !Number.isInteger(input.version)) fail('POLICY_INVALID');
      const routeSections = {home:'home',week:'schedule',courses:'courses',student:'exams',studentservices:'services',freerooms:'rooms',articles:'articles'};
      if (input.status === 'approved' && input.landing !== 'auto' && input.landing !== 'settings' && !input.permissions.includes(routeSections[input.landing])) fail('LANDING_DENIED');
      const result = await db.prepare('UPDATE approval_requests SET status = ?, role = ?, permissions = ?, landing = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?').bind(input.status,input.role,JSON.stringify([...new Set(input.permissions)]),input.landing,now,target[1],input.version).run();
      if (!result.meta.changes) fail('POLICY_CHANGED', 409);
      await db.prepare('INSERT INTO account_audit (id,actor,subject,action,created_at) VALUES (?,?,?,?,?)').bind(random(),id,target[1],'access:'+input.status,now).run();
      return finish(json(policy(await db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(target[1]).first())));
    }
    fail('NOT_FOUND', 404);
  } catch (error) {
    if (url.pathname === '/link-admin') return finish(accessPage(`<h1>Konfirmimi nuk u përfundua</h1><p>Rihape konfirmimin dhe provo përsëri. Nëse lidhja ka skaduar, krijo një lidhje të re nga app-i. Të dhënat e llogarisë ruhen.</p><a href="${escape(url.pathname + url.search)}">Rihap konfirmimin</a>`, error.status || 503));
    return finish(json({ error:error.code || 'SERVICE_UNAVAILABLE' }, error.status || 503));
  }
}
