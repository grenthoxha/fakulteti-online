import test from 'node:test';
import assert from 'node:assert/strict';
import {database,device,linkOwner} from './approval-service.test.mjs';
import {handleApprovalRequest} from '../lib/approval-service.mjs';
const NOW=Date.parse('2026-11-19T20:00:00Z');
const profile={firstName:'Arta',lastName:'Hoxha',gender:'female',requestedRole:'student',faculty:'philosophy',branch:'psychology',year:'2',semester:'1'};
const password='Synthetic-test-password-2026';
async function call(db,d,path,method='GET',body){const r=await handleApprovalRequest(await d.request(path,method,body),{DB:db},NOW);return {status:r.status,data:await r.json()};}
async function register(db,d){return call(db,d,'/api/cloud/register','POST',{email:d.email,password,profile,publicKey:d.publicKey});}
test('online registration stores a unique account and profile, never grants approval or returns credentials',async()=>{
 const db=database(),d=await device();
 const r=await register(db,d);assert.equal(r.status,200);assert.match(r.data.recoveryCode,/^[a-f0-9-]+$/);
 assert.equal(r.data.email,d.email);assert.equal(r.data.profile.firstName,'Arta');
 assert(!/password_hash|salt|recovery_hash|privateKey/.test(JSON.stringify(r.data)));
 assert.equal((await call(db,d,'/api/me')).data.status,'pending');
 const stored=await db.prepare('SELECT * FROM cloud_accounts WHERE email=?').bind(d.email).first();
 assert.notEqual(stored.password_hash,password);assert.equal(stored.password_hash.length,64);
 const other=await device();assert.equal((await register(db,other)).data.error,'EMAIL_EXISTS');
 const injected=await device('other@example.test');assert.equal((await call(db,injected,'/api/cloud/register','POST',{email:injected.email,password,publicKey:injected.publicKey,profile:{...profile,notes:'private'}})).data.error,'PROFILE_INVALID');
});
test('password login on another device shares approvals and profile; private profile APIs reject other devices',async()=>{
 const db=database(),d=await device(),phone=await device();const r=await register(db,d);
 assert.equal((await call(db,phone,'/api/cloud/login','POST',{email:d.email,password:'wrong-password',publicKey:phone.publicKey})).status,401);
 await db.prepare("UPDATE approval_requests SET status='approved',permissions='[\"rooms\"]',landing='freerooms' WHERE id=?").bind(d.id).run();
 const login=await call(db,phone,'/api/cloud/login','POST',{email:d.email,password,publicKey:phone.publicKey});
 assert.equal(login.status,200);assert.equal(login.data.accountId,r.data.accountId);
 const me=(await call(db,phone,'/api/me')).data;assert.equal(me.id,phone.id);assert.equal(me.status,'approved');assert.deepEqual(me.permissions,['rooms']);assert.equal(me.isAdmin,false);
 const changed=await call(db,phone,'/api/cloud/profile','PATCH',{version:1,profile:{...profile,nickname:'Arta'}});assert.equal(changed.status,200);
 assert.equal((await call(db,d,'/api/cloud/profile')).data.profile.nickname,'Arta');
 assert.equal((await call(db,d,'/api/cloud/profile','PATCH',{version:1,profile})).data.error,'PROFILE_CHANGED');
 const stranger=await device('stranger@example.test');await stranger.enroll(db);
 assert.equal((await call(db,stranger,'/api/cloud/profile')).data.error,'MIGRATION_REQUIRED');
 await db.prepare("UPDATE approval_requests SET status='suspended' WHERE id=?").bind(d.id).run();
 assert.equal((await call(db,phone,'/api/me')).data.status,'suspended');
});
test('recovery revokes existing devices and old password; the recovered device stays linked to canonical approval',async()=>{
 const db=database(),d=await device(),phone=await device();const r=await register(db,d);
 const recovered=await call(db,phone,'/api/cloud/recover','POST',{email:d.email,password:password+'new',code:r.data.recoveryCode,publicKey:phone.publicKey});assert.equal(recovered.status,200);
 assert.equal((await call(db,d,'/api/me')).data.error,'SESSION_REVOKED');
 const third=await device();assert.equal((await call(db,third,'/api/cloud/login','POST',{email:d.email,password,publicKey:third.publicKey})).data.error,'CREDENTIALS_INVALID');
 assert.equal((await call(db,third,'/api/cloud/login','POST',{email:d.email,password:password+'new',publicKey:third.publicKey})).status,200);
});
test('legacy email cannot be claimed from an unrelated key; owner email cannot self-register as admin',async()=>{
 const db=database(),old=await device(),stranger=await device(),owner=await device('grent@gmail.com','Grent Hoxha');await old.enroll(db);
 assert.equal((await register(db,stranger)).data.error,'MIGRATION_REQUIRED');
 assert.equal((await register(db,old)).status,200);
 assert.equal((await register(db,owner)).data.error,'OWNER_LINK_REQUIRED');
});
test('verified Grent account can administer from another password-authenticated device; audit is admin-only',async()=>{
 const db=database(),owner=await device('grent@gmail.com','Grent Hoxha'),phone=await device('grent@gmail.com','Grent Hoxha'),student=await device();
 await owner.enroll(db);await linkOwner(db,owner);assert.equal((await register(db,owner)).status,200);
 assert.equal((await call(db,phone,'/api/cloud/login','POST',{email:owner.email,password,publicKey:phone.publicKey})).status,200);
 assert.equal((await call(db,phone,'/api/me')).data.isAdmin,true);
 await register(db,student);
 const list=await call(db,phone,'/api/admin/requests');assert.equal(list.status,200);assert.equal(list.data.requests.filter(r=>r.email===student.email).length,1);
 assert.equal(list.data.requests.find(r=>r.email===student.email).online,true);
 const approved=await call(db,phone,'/api/admin/requests/'+student.id,'PATCH',{status:'approved',role:'student',permissions:['rooms'],landing:'freerooms',version:1});assert.equal(approved.status,200);
 const audit=await call(db,phone,'/api/admin/audit');assert.equal(audit.status,200);assert(audit.data.events.some(e=>e.action==='access:approved'&&e.email===student.email));
 assert.equal((await call(db,student,'/api/admin/audit')).status,403);
 const imposter=await device('grent@gmail.com','Grent Hoxha');await imposter.enroll(db);assert.equal((await call(db,imposter,'/api/me')).data.isAdmin,false);
});
