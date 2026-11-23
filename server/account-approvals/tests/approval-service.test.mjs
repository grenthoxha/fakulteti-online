import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import { handleApprovalRequest, SECTIONS } from '../lib/approval-service.mjs';
const crypto = webcrypto, utf8 = new TextEncoder();
const hex = bytes => Buffer.from(bytes).toString('hex');
const NOW = Date.parse('2026-11-19T20:00:00Z');
const SERVICE = 'https://approval.test';
export function database() {
  const sql = new DatabaseSync(':memory:');
  for (const name of readdirSync(new URL('../drizzle/', import.meta.url)).filter(name=>name.endsWith('.sql')).sort()) sql.exec(readFileSync(new URL('../drizzle/'+name, import.meta.url), 'utf8'));
  const db = { prepare(query) {
    const result = { args:[], bind(...args) { result.args=args;return result; },
      async first() { return sql.prepare(query).get(...result.args) || null; },
      async all() { return {results:sql.prepare(query).all(...result.args)}; },
      async run() { return {meta:{changes:Number(sql.prepare(query).run(...result.args).changes)}}; } };
    return result;
  }, async batch(statements) {
    sql.exec('BEGIN');
    try { const result=await Promise.all(statements.map(s=>s.run()));sql.exec('COMMIT');return result; }
    catch(error) { sql.exec('ROLLBACK');throw error; }
  }};
  return db;
}
export async function device(email='applicant@example.test',name='Arta Hoxha') {
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
  const id=hex(await crypto.subtle.digest('SHA-256',utf8.encode(publicKey.x+'.'+publicKey.y)));
  return {id,email,name,publicKey,async request(path,method='GET',value,extra={}) {
    const body=value===undefined?'':JSON.stringify(value),time=String(extra.time||NOW),nonce=extra.nonce||hex(crypto.getRandomValues(new Uint8Array(16)));
    const signature=hex(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,utf8.encode([method,path,time,nonce,body].join('\n'))));
    return new Request(SERVICE+path,{method,headers:{Origin:'https://grenthoxha.github.io','Content-Type':'application/json','X-Fakulteti-Id':id,'X-Fakulteti-Time':time,'X-Fakulteti-Nonce':nonce,'X-Fakulteti-Signature':signature,...extra.headers},...(body?{body}:{})});
  }, async enroll(db,role='student') {return handleApprovalRequest(await this.request('/api/requests','POST',{email,name,publicKey,role}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);} };
}
const result = async response => ({status:response.status,body:await response.json()});
export async function linkOwner(db, owner, origin = 'null') {
  const response=await result(await handleApprovalRequest(await owner.request('/api/admin-link','POST',{}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW));
  assert.equal(response.status,200);
  const link=response.body.url;
  const identity={'oai-authenticated-user-id':'verified-site-owner','oai-authenticated-user-email':'owner@example.test'};
  const page=await handleApprovalRequest(new Request(link,{headers:identity}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);
  const csrf=(await page.text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
  const linked=await handleApprovalRequest(new Request(link,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...identity},body:new URLSearchParams({csrf})}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);
  assert.equal(linked.status,200);assert.match(await linked.text(),/Administrimi u lidh/);
}
test('new devices remain pending; knowing the administrator email grants no privileges',async()=>{
  const db=database(),applicant=await device(),imposter=await device('grent@gmail.com','Grent Hoxha');
  const enrolled=await result(await applicant.enroll(db));assert.equal(enrolled.status,201);assert.equal(enrolled.body.status,'pending');assert.deepEqual(enrolled.body.permissions,[]);
  assert.equal((await result(await imposter.enroll(db))).body.status,'pending');
  assert.equal((await result(await handleApprovalRequest(await imposter.request('/api/admin/requests'),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW))).status,403);
  assert.equal((await result(await applicant.enroll(db,'admin'))).status,400);
  const me=await result(await handleApprovalRequest(await applicant.request('/api/me'),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW));assert.equal(me.body.isAdmin,false);assert.equal(me.body.public_key,undefined);
});
test('only a verified owner can link Grent; approvals and individual visibility are enforced remotely',async()=>{
  const db=database(),admin=await device('grent@gmail.com','Grent Hoxha'),student=await device();
  await admin.enroll(db);await student.enroll(db);
  const link=await result(await handleApprovalRequest(await admin.request('/api/admin-link','POST',{}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW));
  const anonymous=await handleApprovalRequest(new Request(link.body.url),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);assert.match(await anonymous.text(),/Vazhdo me ChatGPT/);
  const wrong=await handleApprovalRequest(new Request(link.body.url,{headers:{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.test'}}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);assert.match(await wrong.text(),/nuk ka leje/);
  const csrf=await handleApprovalRequest(new Request(link.body.url,{method:'POST',headers:{Origin:'https://evil.test','oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'}}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);assert.equal(csrf.status,403);
  await linkOwner(db,admin);
  const me=await result(await handleApprovalRequest(await admin.request('/api/me'),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW));assert.equal(me.body.isAdmin,true);assert.deepEqual(me.body.permissions,SECTIONS);
  const list=await result(await handleApprovalRequest(await admin.request('/api/admin/requests'),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW));assert.equal(list.body.requests.length,2);assert(!JSON.stringify(list.body).includes('public_key'));
  const policy={status:'approved',role:'student',permissions:['rooms'],landing:'freerooms',version:1};
  const saved=await result(await handleApprovalRequest(await admin.request('/api/admin/requests/'+student.id,'PATCH',policy),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW));assert.equal(saved.status,200);assert.deepEqual(saved.body.permissions,['rooms']);assert.equal(saved.body.version,2);
  const stale=await handleApprovalRequest(await admin.request('/api/admin/requests/'+student.id,'PATCH',policy),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);assert.equal(stale.status,409);
  const own=await result(await handleApprovalRequest(await student.request('/api/me'),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW));assert.equal(own.body.status,'approved');assert.equal(own.body.landing,'freerooms');assert.equal(own.body.isAdmin,false);
  const elevate=await handleApprovalRequest(await student.request('/api/admin/requests/'+student.id,'PATCH',{...policy,permissions:SECTIONS,version:2}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);assert.equal(elevate.status,403);
  const suspend=await handleApprovalRequest(await admin.request('/api/admin/requests/'+student.id,'PATCH',{...policy,status:'suspended',version:2}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);assert.equal(suspend.status,200);
  assert.equal((await result(await handleApprovalRequest(await student.request('/api/me'),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW))).body.status,'suspended');
  const self=await handleApprovalRequest(await admin.request('/api/admin/requests/'+admin.id,'PATCH',policy),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);assert.equal(self.status,403);
});
test('admin form accepts opaque origins only with the owner-bound one-use confirmation',async()=>{
  const db=database(),admin=await device('grent@gmail.com','Grent Hoxha');await admin.enroll(db);
  const env={DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'};
  const identity={'oai-authenticated-user-id':'verified-site-owner','oai-authenticated-user-email':'owner@example.test'};
  const link=(await result(await handleApprovalRequest(await admin.request('/api/admin-link','POST',{}),env,NOW))).body.url;
  const get=async headers=>{const page=await handleApprovalRequest(new Request(link,{headers}),env,NOW);return (await page.text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];};
  const send=(csrf,origin='null',user=identity)=>handleApprovalRequest(new Request(link,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...user},body:new URLSearchParams({csrf})}),env,NOW);
  const old=await get(identity),current=await get(identity);
  assert.equal((await send('')).status,403);
  assert.equal((await send(old)).status,403);
  assert.equal((await send(current,'https://evil.test')).status,403);
  assert.equal((await send(current,'null',{...identity,'oai-authenticated-user-id':'different-session-owner'})).status,403);
  assert.equal((await result(await handleApprovalRequest(await admin.request('/api/me'),env,NOW))).body.isAdmin,false);
  const valid=await send(current);assert.equal(valid.status,200);assert.match(await valid.text(),/Administrimi u lidh/);
  const replay=await send(current);assert.match(await replay.text(),/Lidhja ka skaduar/);
  await linkOwner(db,admin,SERVICE); // Standard browser Origin remains supported too.
});
test('the owner can add a phone while the original desktop remains an administrator',async()=>{
  const db=database(),desktop=await device('grent@gmail.com','Grent Hoxha'),phone=await device('grent@gmail.com','Grent Hoxha'),unlinked=await device('grent@gmail.com','Grent Hoxha'),student=await device();
  const env={DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'};
  for(const d of [desktop,phone,unlinked,student])await d.enroll(db);
  await linkOwner(db,desktop);
  // Simulate the already-deployed single-device binding, without a new-style entry.
  await db.prepare('DELETE FROM approval_settings WHERE key = ?').bind('admin_device:'+desktop.id).run();
  const me=async d=>(await result(await handleApprovalRequest(await d.request('/api/me'),env,NOW))).body;
  assert.equal((await me(desktop)).isAdmin,true);assert.equal((await me(phone)).isAdmin,false);
  await linkOwner(db,phone,'null');
  assert.equal((await me(phone)).isAdmin,true);assert.equal((await me(desktop)).isAdmin,true);assert.equal((await me(unlinked)).isAdmin,false);
  assert.equal((await db.prepare("SELECT value FROM approval_settings WHERE key = 'admin_id'").first()).value,desktop.id);
  const requests=await result(await handleApprovalRequest(await desktop.request('/api/admin/requests'),env,NOW));
  assert(!requests.body.requests.some(row=>row.id===phone.id));
  const policy={status:'approved',role:'student',permissions:['rooms'],landing:'freerooms',version:1};
  const approved=await handleApprovalRequest(await phone.request('/api/admin/requests/'+student.id,'PATCH',policy),env,NOW);assert.equal(approved.status,200);
  assert.equal((await me(student)).status,'approved');
  const updated=await handleApprovalRequest(await desktop.request('/api/admin/requests/'+student.id,'PATCH',{...policy,permissions:['courses'],landing:'courses',version:2}),env,NOW);assert.equal(updated.status,200);
  assert.deepEqual((await me(student)).permissions,['courses']);
  const adminChange=await handleApprovalRequest(await desktop.request('/api/admin/requests/'+phone.id,'PATCH',{...policy,version:(await me(phone)).version}),env,NOW);assert.equal(adminChange.status,403);
  assert.equal((await handleApprovalRequest(await unlinked.request('/api/admin/requests'),env,NOW)).status,403);
});
test('signature integrity, replay prevention, clock bounds and origins reject unauthorized requests',async()=>{
  const db=database(),a=await device();await a.enroll(db);
  const nonce='0'.repeat(32),first=await a.request('/api/me','GET',undefined,{nonce});
  assert.equal((await handleApprovalRequest(first,{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW)).status,200);
  assert.equal((await handleApprovalRequest(await a.request('/api/me','GET',undefined,{nonce}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW)).status,409);
  assert.equal((await handleApprovalRequest(await a.request('/api/me','GET',undefined,{time:NOW-600000}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW)).status,401);
  const signed=await a.request('/api/me');signed.headers.set('X-Fakulteti-Signature','0'.repeat(128));assert.equal((await handleApprovalRequest(signed,{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW)).status,401);
  assert.equal((await handleApprovalRequest(await a.request('/api/me','GET',undefined,{headers:{Origin:'https://evil.test'}}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW)).status,403);
  const options=await handleApprovalRequest(new Request(SERVICE+'/api/me',{method:'OPTIONS',headers:{Origin:'https://grenthoxha.github.io'}}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),'https://grenthoxha.github.io');
});
