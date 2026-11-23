import { scrypt, timingSafeEqual } from 'node:crypto';

const utf8 = new TextEncoder();
const hex = value => [...new Uint8Array(value)].map(b => b.toString(16).padStart(2, '0')).join('');
const random = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const digest = async s => hex(await crypto.subtle.digest('SHA-256', utf8.encode(s)));
const fail = (code, status = 400) => { throw Object.assign(new Error(code), {code, status}); };
const emailOf = v => String(v || '').trim().normalize('NFC').toLowerCase();
const validPassword = p => { if (typeof p !== 'string' || p.length < 8 || p.length > 128) fail('PASSWORD_LENGTH'); };
// Bound concurrent 32 MiB scrypt work within a Worker isolate.
let queue = Promise.resolve(), waiting = 0;
async function passwordHash(password, salt) {
  if (waiting >= 4) fail('RATE_LIMITED', 429);
  waiting++;
  const previous = queue;
  let release; queue = new Promise(resolve => { release = resolve; });
  try {
    await previous;
    return await new Promise((resolve, reject) => scrypt(password, Buffer.from(salt, 'hex'), 32,
      {N:32768, r:8, p:3, maxmem:48 * 1024 * 1024}, (error, key) => error ? reject(error) : resolve(key.toString('hex'))));
  } finally { waiting--; release(); }
}
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const PROFILE_KEYS = ['firstName','lastName','nickname','gender','requestedRole','faculty','branch','year','semester','photo'];
export function cleanProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !PROFILE_KEYS.includes(k))) fail('PROFILE_INVALID');
  const p = {};
  for (const key of PROFILE_KEYS) p[key] = String(value[key] ?? '').trim().normalize('NFC');
  if (!p.firstName || !p.lastName || p.firstName.length > 80 || p.lastName.length > 80 || p.nickname.length > 40
    || !['male','female',''].includes(p.gender) || !['student','instructor'].includes(p.requestedRole)
    || ['faculty','branch','year','semester'].some(k => p[k].length > 100)
    || (p.photo && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(p.photo) || p.photo.length > 250000))) fail('PROFILE_INVALID');
  return p;
}
export async function cloudAccount(db, id) {
  const row = await db.prepare('SELECT a.*, d.revision AS device_revision FROM cloud_devices d JOIN cloud_accounts a ON a.id = d.account_id WHERE d.id = ?').bind(id).first();
  if (row && row.device_revision !== row.revision) fail('SESSION_REVOKED', 401);
  return row;
}
const publicAccount = row => ({accountId:row.id, email:row.email, profile:JSON.parse(row.profile), profileVersion:row.profile_version});
async function rateLimit(db, request, email, now) {
  for (const value of ['ip:' + (request.headers.get('CF-Connecting-IP') || 'local'), 'email:' + email]) {
    const key = 'auth:' + await digest(value + ':' + Math.floor(now / 900000));
    const row = await db.prepare('INSERT INTO approval_limits (key,count) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key).first();
    if (row.count > 20) fail('RATE_LIMITED', 429);
  }
}
export async function handleCloudAuth(request, input, body, id, db, now, verify, isLinkedAdmin) {
  const action = new URL(request.url).pathname.split('/').pop();
  const email = emailOf(input.email), jwk = input.publicKey;
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254) fail('EMAIL_INVALID');
  validPassword(input.password);
  if (!jwk || typeof jwk.x !== 'string' || typeof jwk.y !== 'string' || await digest(jwk.x + '.' + jwk.y) !== id) fail('KEY_INVALID');
  await verify(request, body, jwk, id, db, now);
  await rateLimit(db, request, email, now);
  const existingDevice = await db.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(id).first();
  if (existingDevice && existingDevice.email !== email) fail('IDENTITY_CHANGED', 409);
  const bound = await db.prepare('SELECT account_id FROM cloud_devices WHERE id = ?').bind(id).first();
  let account = await db.prepare('SELECT * FROM cloud_accounts WHERE email = ?').bind(email).first();
  let recoveryCode;
  if (action === 'register') {
    if (account) fail('EMAIL_EXISTS', 409);
    const reserved = await db.prepare("SELECT id FROM approval_requests WHERE email = ? ORDER BY CASE WHEN role='admin' AND status='approved' THEN 0 WHEN status='approved' THEN 1 ELSE 2 END, created_at LIMIT 1").bind(email).first();
    if (reserved && (!existingDevice || existingDevice.id !== reserved.id) && !(email==='grent@gmail.com' && await isLinkedAdmin(db,id))) fail('MIGRATION_REQUIRED', 409);
    // The owner must prove the existing administrator device before claiming its email.
    if (email === 'grent@gmail.com' && !(existingDevice && await isLinkedAdmin(db, id))) fail('OWNER_LINK_REQUIRED', 403);
    const profile = cleanProfile(input.profile), salt = random(16);
    recoveryCode = random(24);
    const recoveryHash = input.recoveryHash && /^[a-f0-9]{64}$/.test(input.recoveryHash)
      ? input.recoveryHash : await digest(recoveryCode);
    const hash = await passwordHash(input.password, salt), accountId = random(16);
    const statements = [];
    if (!existingDevice) statements.push(db.prepare('INSERT INTO approval_requests (id,email,name,public_key,requested_role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
      .bind(id,email,profile.firstName+' '+profile.lastName,JSON.stringify(jwk),profile.requestedRole,now,now));
    statements.push(db.prepare('INSERT INTO cloud_accounts (id,email,salt,password_hash,recovery_hash,approval_id,profile,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(accountId,email,salt,hash,recoveryHash,id,JSON.stringify(profile),now,now));
    statements.push(db.prepare('INSERT INTO cloud_devices (id,account_id,revision,linked_at) VALUES (?,?,1,?)').bind(id,accountId,now));
    try { await db.batch(statements); } catch (error) {
      if (await db.prepare('SELECT id FROM cloud_accounts WHERE email = ?').bind(email).first()) fail('EMAIL_EXISTS',409);
      throw error;
    }
    account = await db.prepare('SELECT * FROM cloud_accounts WHERE id = ?').bind(accountId).first();
    if (recoveryHash === input.recoveryHash) recoveryCode = undefined;
  } else if (action === 'login' || action === 'recover') {
    if (action === 'login') {
      const tested = await passwordHash(input.password, account?.salt || '00000000000000000000000000000000');
      if (!account || !equal(tested,account.password_hash)) fail('CREDENTIALS_INVALID',401);
    } else {
      const code = String(input.code || '').toLowerCase().replace(/[\s-]/g,'');
      if (!account || !/^[a-f0-9]{48}$/.test(code) || !equal(await digest(code),account.recovery_hash)) fail('RECOVERY_INVALID',401);
    }
    if (bound && bound.account_id !== account.id) fail('IDENTITY_CHANGED',409);
    const statements = [];
    if (!existingDevice) statements.push(db.prepare('INSERT INTO approval_requests (id,email,name,public_key,requested_role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
      .bind(id,email,JSON.parse(account.profile).firstName+' '+JSON.parse(account.profile).lastName,JSON.stringify(jwk),JSON.parse(account.profile).requestedRole,now,now));
    if (action === 'recover') {
      const salt = random(16), hashed = await passwordHash(input.password,salt);
      statements.push(db.prepare('UPDATE cloud_accounts SET salt=?,password_hash=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(salt,hashed,now,account.id,account.revision));
    }
    const expectedRevision=account.revision+(action==='recover'?1:0);
    statements.push(db.prepare('INSERT INTO cloud_devices (id,account_id,revision,linked_at) SELECT ?,id,revision,? FROM cloud_accounts WHERE id=? AND revision=? ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,linked_at=excluded.linked_at')
      .bind(id,now,account.id,expectedRevision));
    await db.batch(statements);
    account = await db.prepare('SELECT * FROM cloud_accounts WHERE id=?').bind(account.id).first();
    const enrolled=await db.prepare('SELECT revision FROM cloud_devices WHERE id=?').bind(id).first();
    if(account.revision!==expectedRevision || enrolled?.revision!==expectedRevision)fail('CREDENTIALS_INVALID',401);
  } else fail('NOT_FOUND',404);
  await db.batch([
    db.prepare('UPDATE cloud_accounts SET last_login=? WHERE id=?').bind(now,account.id),
    db.prepare('INSERT INTO account_audit (id,actor,subject,action,created_at) VALUES (?,?,?,?,?)').bind(random(16),id,account.id,action,now)
  ]);
  return {...publicAccount(account), ...(recoveryCode ? {recoveryCode:recoveryCode.match(/.{8}/g).join('-')} : {})};
}
export async function handleCloudProfile(request,input,account,db,now) {
  if (!account) fail('MIGRATION_REQUIRED',409);
  if (request.method === 'GET') return publicAccount(account);
  if (request.method !== 'PATCH') fail('NOT_FOUND',404);
  if (!Number.isInteger(input.version)) fail('PROFILE_INVALID');
  const profile = cleanProfile(input.profile);
  const result = await db.prepare('UPDATE cloud_accounts SET profile=?,profile_version=profile_version+1,updated_at=? WHERE id=? AND profile_version=?')
    .bind(JSON.stringify(profile),now,account.id,input.version).run();
  if (!result.meta.changes) fail('PROFILE_CHANGED',409);
  // Names can change; approval privileges are never accepted from a profile.
  await db.prepare('UPDATE approval_requests SET name=? WHERE id=?').bind(profile.firstName+' '+profile.lastName,account.approval_id).run();
  return publicAccount(await db.prepare('SELECT * FROM cloud_accounts WHERE id=?').bind(account.id).first());
}
