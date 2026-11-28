import test from 'node:test';
import assert from 'node:assert/strict';
import {database,device,linkOwner} from './approval-service.test.mjs';
import {handleApprovalRequest} from '../lib/approval-service.mjs';
import catalog from '../lib/academic-catalog.json' with {type:'json'};
const NOW=Date.parse('2026-11-19T20:00:00Z'),password='Synthetic-test-password-2026';
const profile={firstName:'Arta',lastName:'Hoxha',nickname:'Arta',gender:'female',requestedRole:'student',faculty:'',branch:'',year:'',semester:''};
const academic={faculty:'filozofik',branch:'master-sociologji',year:'2',semester:'3'};
async function call(db,d,path,method='GET',input){const r=await handleApprovalRequest(await d.request(path,method,input),{DB:db,APPROVAL_OWNER_EMAIL:'owner@example.test'},NOW);return {status:r.status,data:await r.json()};}
async function setup(){const db=database(),admin=await device('grent@gmail.com','Grent Hoxha'),student=await device();await admin.enroll(db);await linkOwner(db,admin);await call(db,student,'/api/cloud/register','POST',{email:student.email,password,profile,publicKey:student.publicKey});return {db,admin,student};}
const decision=(extra={})=>({status:'approved',role:'student',permissions:['home','courses','schedule','exams'],landing:'auto',version:1,academic,profileVersion:1,...extra});
test('academic options include all Master programmes and valid years and semester IDs',()=>{
  assert.equal(catalog.find(f=>f.id==='filozofik').programmes.filter(b=>b.level==='master').length,8);
  assert.equal(catalog.find(f=>f.id==='filozofik').programmes.find(b=>b.id==='master-arkivistike').years.length,1);
});
test('verified admin assigns a pending applicant a programme atomically; every authenticated device receives it',async()=>{
  const {db,admin,student}=await setup();
  const list=await call(db,admin,'/api/admin/requests');assert.equal(list.status,200);assert.deepEqual(list.data.academicCatalog,catalog);
  const request=list.data.requests.find(r=>r.id===student.id);assert.equal(request.profileVersion,1);assert.deepEqual(request.profile,{faculty:'',branch:'',year:'',semester:''});assert(!JSON.stringify(request).includes('nickname'));
  const saved=await call(db,admin,'/api/admin/requests/'+student.id,'PATCH',decision());assert.equal(saved.status,200);assert.equal(saved.data.status,'approved');assert.deepEqual(saved.data.profile,academic);assert.equal(saved.data.profileVersion,2);
  const current=await call(db,student,'/api/cloud/profile');assert.deepEqual(current.data.profile,{...profile,photo:'',...academic});assert.equal(current.data.profileVersion,2);
  const phone=await device();const login=await call(db,phone,'/api/cloud/login','POST',{email:student.email,password,publicKey:phone.publicKey});assert.equal(login.status,200);assert.equal(login.data.profile.branch,academic.branch);assert.equal((await call(db,phone,'/api/me')).data.status,'approved');
  const audit=await call(db,admin,'/api/admin/audit');assert(audit.data.events.some(e=>e.action==='academic:assigned'&&e.email===student.email));
  const ba={faculty:'filozofik',branch:'psikologji',year:'1',semester:'2'};
  assert.equal((await call(db,admin,'/api/admin/requests/'+student.id,'PATCH',decision({version:2,profileVersion:2,academic:ba}))).status,200);
  assert.equal((await call(db,phone,'/api/cloud/profile')).data.profile.branch,'psikologji');
});
test('students and email impersonators cannot assign programmes or read admin options',async()=>{
  const {db,admin,student}=await setup();const imposter=await device('grent@gmail.com','Grent Hoxha');await imposter.enroll(db);
  for(const d of [student,imposter]){assert.equal((await call(db,d,'/api/admin/requests')).status,403);assert.equal((await call(db,d,'/api/admin/requests/'+student.id,'PATCH',decision())).status,403);}
  assert.equal((await call(db,student,'/api/me')).data.status,'pending');
  assert.equal((await call(db,admin,'/api/admin/requests/'+admin.id,'PATCH',decision())).data.error,'ADMIN_SELF_CHANGE_DENIED');
});
test('invalid faculty, programme, year, semester, injected profile fields and legacy accounts never get partial approval',async()=>{
  const {db,admin,student}=await setup();
  for(const value of [{...academic,faculty:'fiek'},{...academic,branch:'invented'},{...academic,year:'3'},{...academic,semester:'1'},{...academic,role:'admin'},{...academic,year:2}]){
    assert.equal((await call(db,admin,'/api/admin/requests/'+student.id,'PATCH',decision({academic:value}))).data.error,'ACADEMIC_INVALID');
    assert.equal((await call(db,student,'/api/me')).data.status,'pending');
  }
  const legacy=await device('legacy@example.test');await legacy.enroll(db);
  assert.equal((await call(db,admin,'/api/admin/requests/'+legacy.id,'PATCH',decision())).data.error,'MIGRATION_REQUIRED');
  assert.equal((await call(db,legacy,'/api/me')).data.status,'pending');
});
test('stale profile and approval versions cannot overwrite profiles, approve the wrong revision or write audit entries',async()=>{
  const {db,admin,student}=await setup(),url='/api/admin/requests/'+student.id;
  await call(db,student,'/api/cloud/profile','PATCH',{version:1,profile:{...profile,nickname:'New nickname'}});
  assert.equal((await call(db,admin,url,'PATCH',decision())).data.error,'PROFILE_CHANGED');
  assert.equal((await call(db,student,'/api/me')).data.status,'pending');
  assert.equal((await call(db,admin,url,'PATCH',decision({version:0,profileVersion:2}))).data.error,'POLICY_CHANGED');
  assert.equal((await call(db,student,'/api/cloud/profile')).data.profile.branch,'');
  assert(!(await call(db,admin,'/api/admin/audit')).data.events.some(e=>e.action==='academic:assigned'));
  assert.equal((await call(db,admin,url,'PATCH',decision({profileVersion:2}))).status,200);
  assert.equal((await call(db,student,'/api/cloud/profile')).data.profile.nickname,'New nickname');
});
test('a profile change between validation and the D1 transaction prevents both writes',async()=>{
  const {db,admin,student}=await setup();const batch=db.batch.bind(db);let raced=false;
  db.batch=async statements=>{if(!raced){raced=true;await db.prepare('UPDATE cloud_accounts SET profile_version=profile_version+1 WHERE approval_id=?').bind(student.id).run();}return batch(statements);};
  assert.equal((await call(db,admin,'/api/admin/requests/'+student.id,'PATCH',decision())).data.error,'PROFILE_CHANGED');
  assert.equal((await call(db,student,'/api/me')).data.status,'pending');
  assert.equal((await call(db,student,'/api/cloud/profile')).data.profile.branch,'');
});
