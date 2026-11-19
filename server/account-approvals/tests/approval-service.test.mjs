import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import { handleApprovalRequest, SECTIONS } from '../lib/approval-service.mjs';
const crypto = webcrypto, utf8 = new TextEncoder();
const hex = bytes => Buffer.from(bytes).toString('hex');
const NOW = Date.parse('2026-11-19T20:00:00Z');
const SERVICE = 'https://approval.test';
function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../drizzle/0000_daily_chameleon.sql', import.meta.url), 'utf8'));
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
async function device(email='applicant@example.test',name='Arta Hoxha') {
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
async function linkOwner(db, owner) {
  const response=await result(await handleApprovalRequest(await owner.request('/api/admin-link','POST',{}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW));
  assert.equal(response.status,200);
  const link=response.body.url;
  const linked=await handleApprovalRequest(new Request(link,{method:'POST',headers:{Origin:SERVICE,'oai-authenticated-user-id':'verified-site-owner','oai-authenticated-user-email':'owner@example.test'}}),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);
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
