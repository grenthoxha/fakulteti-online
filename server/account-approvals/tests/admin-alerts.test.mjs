import test from 'node:test';
import assert from 'node:assert/strict';
import {database,device,linkOwner} from './approval-service.test.mjs';
import {handleApprovalRequest} from '../lib/approval-service.mjs';
const NOW=Date.parse('2026-11-19T20:00:00Z');
async function call(db,d,path,method='GET',input,now=NOW){const response=await handleApprovalRequest(await d.request(path,method,input),{DB:db},now);return {status:response.status,data:await response.json()};}
async function setup(){const db=database(),admin=await device('grent@gmail.com','Grent Hoxha');await admin.enroll(db);await linkOwner(db,admin);return {db,admin};}
async function poll(db,grant,extra={},now=NOW){const request=new Request('https://approval.test/api/admin/alerts/pending',{headers:{'X-Fakulteti-Device':grant.deviceId,'X-Fakulteti-Alert':grant.token,...extra}});const response=await handleApprovalRequest(request,{DB:db},now);return {status:response.status,data:await response.json()};}
test('background alert credentials require verified admin and disclose only pending IDs/counts',async()=>{
 const {db,admin}=await setup(),student=await device(),imposter=await device('grent@gmail.com','Imposter Hoxha');await student.enroll(db);await imposter.enroll(db);
 for(const who of [student,imposter])assert.equal((await call(db,who,'/api/admin/alerts','POST',{})).status,403);
 const grant=(await call(db,admin,'/api/admin/alerts','POST',{})).data;assert.match(grant.token,/^[a-f0-9]{64}$/);assert.equal(grant.deviceId,admin.id);
 const stored=await db.prepare('SELECT value FROM approval_settings WHERE key=?').bind('admin_alert_device:'+admin.id).first();assert(!stored.value.includes(grant.token));
 const response=await poll(db,grant);assert.equal(response.status,200);assert.equal(response.data.pending,2);assert.deepEqual(new Set(response.data.ids),new Set([student.id,imposter.id]));assert(!/name|email|profile|permissions|token/.test(JSON.stringify(response.data)));
 const approved=await call(db,admin,'/api/admin/requests/'+student.id,'PATCH',{status:'approved',role:'student',permissions:['home'],landing:'auto',version:1});assert.equal(approved.status,200);
 assert.equal((await poll(db,grant)).data.pending,1);
});
test('wrong, expired, replaced or revoked tokens cannot poll or authorize administrative actions',async()=>{
 const {db,admin}=await setup(),first=(await call(db,admin,'/api/admin/alerts','POST',{})).data;
 assert.equal((await poll(db,{...first,token:'0'.repeat(64)})).status,401);
 assert.equal((await poll(db,first,{},first.expires+1)).status,401);
 const second=(await call(db,admin,'/api/admin/alerts','POST',{})).data;assert.equal((await poll(db,first)).status,401);assert.equal((await poll(db,second)).status,200);
 const unauthorized=await handleApprovalRequest(new Request('https://approval.test/api/admin/requests',{headers:{'X-Fakulteti-Device':second.deviceId,'X-Fakulteti-Alert':second.token}}),{DB:db},NOW);assert.equal(unauthorized.status,401);
 await call(db,admin,'/api/admin/alerts','DELETE');assert.equal((await poll(db,second)).status,401);
});
test('admin suspension and removed owner binding revoke background access',async()=>{
 const {db,admin}=await setup(),grant=(await call(db,admin,'/api/admin/alerts','POST',{})).data;
 await db.prepare("UPDATE approval_requests SET status='suspended' WHERE id=?").bind(admin.id).run();assert.equal((await poll(db,grant)).status,403);
 await db.prepare("UPDATE approval_requests SET status='approved' WHERE id=?").bind(admin.id).run();
 await db.prepare("DELETE FROM approval_settings WHERE key='admin_id' OR key=?").bind('admin_device:'+admin.id).run();assert.equal((await poll(db,grant)).status,403);
});
test('cloud password recovery revokes old alert tokens and duplicate login devices do not create pending notifications',async()=>{
 const {db,admin}=await setup(),profile={firstName:'Grent',lastName:'Hoxha',requestedRole:'student'},password='Synthetic-admin-password-2026';
 const registered=await call(db,admin,'/api/cloud/register','POST',{email:admin.email,password,profile,publicKey:admin.publicKey});assert.equal(registered.status,200);
 const grant=(await call(db,admin,'/api/admin/alerts','POST',{})).data,phone=await device();
 assert.equal((await call(db,phone,'/api/cloud/login','POST',{email:admin.email,password,publicKey:phone.publicKey})).status,200);
 assert.equal((await poll(db,grant)).data.pending,0);
 assert.equal((await call(db,phone,'/api/cloud/recover','POST',{email:admin.email,password:password+'new',code:registered.data.recoveryCode,publicKey:phone.publicKey})).status,200);
 assert.equal((await poll(db,grant)).status,401);
 const newGrant=(await call(db,phone,'/api/admin/alerts','POST',{})).data;assert.equal((await poll(db,newGrant)).status,200);
});
