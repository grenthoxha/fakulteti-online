import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {database,device,linkOwner} from '../server/account-approvals/tests/approval-service.test.mjs';
import {handleApprovalRequest} from '../server/account-approvals/lib/approval-service.mjs';

function page(db,map=new Map(),online=true) {
 const events={},raw={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i]??null,get length(){return map.size;}};
 let reloads=0;
 const root={localStorage:raw,crypto:webcrypto,navigator:{},location:{reload(){reloads++;}},addEventListener:(k,f)=>events[k]=f,dispatchEvent:e=>events[e.type]?.(e),
   fetch:async(url,options)=>handleApprovalRequest(new Request(url,options),{DB:db})};
 const timers=new Set(),setTimer=(f,n)=>{const id=setTimeout(()=>{timers.delete(id);f();},n);timers.add(id);return id;};
 const context=vm.createContext({window:root,TextEncoder,Uint8Array,AbortController,CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},setTimeout:setTimer,clearTimeout,console});
 if(online)vm.runInContext(readFileSync('assets/cloud-accounts.js','utf8'),context);
 vm.runInContext(readFileSync('assets/local-accounts.js','utf8'),context);
 return {api:root.FakultetiLocalAccounts,map,root,get reloads(){return reloads;},close:()=>timers.forEach(clearTimeout)};
}
const profile={firstName:'Arta',lastName:'Hoxha',gender:'female',role:'student'},email='arta@example.test',password='Only-synthetic-test-123';
test('admin assignment reaches the waiting student without deleting any account-local study work',async()=>{
 const db=database(),entry=page(db);const created=await entry.api.register(email,password,false,profile);created.complete();
 const student=page(db,entry.map),admin=await device('grent@gmail.com','Grent Hoxha');
 try {
  student.api.storage.setItem('u_notes','local notes');student.api.storage.setItem('u_grades','local grades');student.api.storage.setItem('u_daily_routines','local tasks');
  const now=Date.parse('2026-11-19T20:00:00Z');await admin.enroll(db);await linkOwner(db,admin);
  const request=await db.prepare('SELECT approval_id FROM cloud_accounts WHERE email=?').bind(email).first();
  let changes=0;student.root.addEventListener('fakulteti:profile',()=>changes++);
  const response=await handleApprovalRequest(await admin.request('/api/admin/requests/'+request.approval_id,'PATCH',{status:'approved',role:'student',permissions:['home','courses','schedule','exams'],landing:'auto',version:1,profileVersion:1,academic:{faculty:'filozofik',branch:'master-sociologji',year:'2',semester:'3'}}),{DB:db},now);
  assert.equal(response.status,200);await student.api.syncProfile();
  assert.equal(student.api.storage.getItem('u_branch'),'master-sociologji');assert.equal(student.api.storage.getItem('u_faculty'),'filozofik');assert.equal(student.api.storage.getItem('u_year'),'2');assert.equal(student.api.storage.getItem('u_semester'),'3');
  assert.equal(student.api.storage.getItem('u_faculty_selected_v1'),'1');assert.deepEqual(JSON.parse(student.api.storage.getItem('u_unlocked')),[1,2]);assert.equal(changes,1);assert.equal(student.reloads,0);
  assert.equal(student.api.storage.getItem('u_notes'),'local notes');assert.equal(student.api.storage.getItem('u_grades'),'local grades');assert.equal(student.api.storage.getItem('u_daily_routines'),'local tasks');
 } finally {entry.close();student.close();}
});
test('frontend cloud flow preserves namespaces, keeps learning local and synchronizes only profiles',async()=>{
 const db=database(),a=page(db),created=await a.api.register(email,password,false,profile);created.complete();
 const first=page(db,a.map);assert.equal(first.api.isOnline(),true);
 first.api.storage.setItem('u_notes','private notes');first.api.storage.setItem('u_grades','private grades');
 first.api.storage.setItem('u_faculty','filozofik');first.api.storage.setItem('u_branch','master-sociologji');first.api.storage.setItem('u_year','2');first.api.storage.setItem('u_semester','3');
 first.api.storage.setItem('u_nickname','Arta student');await first.api.syncProfile();
 const phone=page(db);await phone.api.signIn(email,password);const second=page(db,phone.map);
 assert.equal(second.api.storage.getItem('u_nickname'),'Arta student');assert.equal(second.api.storage.getItem('u_notes'),null);assert.equal(second.api.storage.getItem('u_grades'),null);
 assert.equal(second.api.storage.getItem('u_faculty'),'filozofik');assert.equal(second.api.storage.getItem('u_branch'),'master-sociologji');assert.equal(second.api.storage.getItem('u_year'),'2');assert.equal(second.api.storage.getItem('u_semester'),'3');
 assert.notEqual(second.api.current().id,first.api.current().id);
 assert.deepEqual(JSON.parse(second.api.storage.getItem('u_unlocked')||'[]'),[1,2]);
 const oldId=first.api.current().id;first.api.signOut();await first.api.signIn(email,password);
 const again=page(db,a.map);assert.equal(again.api.current().id,oldId);assert.equal(again.api.storage.getItem('u_notes'),'private notes');
 const row=await db.prepare('SELECT profile FROM cloud_accounts WHERE email=?').bind(email).first();assert(!/private notes|private grades/.test(row.profile));
 second.api.storage.setItem('u_nickname','Phone edits');await second.api.syncProfile();
 again.api.storage.setItem('u_nickname','Computer edits');
 await assert.rejects(again.api.syncProfile(),e=>e.code==='PROFILE_CHANGED');
 assert.equal(again.api.storage.getItem('u_nickname'),'Computer edits');
 await again.api.syncProfile(true);
 assert.equal(JSON.parse((await db.prepare('SELECT profile FROM cloud_accounts WHERE email=?').bind(email).first()).profile).nickname,'Computer edits');
 await phone.api.resetPassword(email,created.recoveryCode,password+'changed');
 await assert.rejects(again.api.syncProfile(),e=>e.code==='SESSION_REVOKED');assert.equal(again.api.current(),null);
 [a,first,phone,second,again].forEach(p=>p.close());
});
test('online profile enrollment opens its selected year without copying study progress',async()=>{
 const db=database(),a=page(db),created=await a.api.register(email,password,false,profile);created.complete();
 const original=page(db,a.map);original.api.storage.setItem('u_faculty','philosophy');original.api.storage.setItem('u_branch','psychology');original.api.storage.setItem('u_year','2');await original.api.syncProfile();
 const phone=page(db);await phone.api.signIn(email,password);const enrolled=page(db,phone.map);
 assert.deepEqual(JSON.parse(enrolled.api.storage.getItem('u_unlocked')),[1,2]);assert.equal(enrolled.api.storage.getItem('u_progress'),null);
 [a,original,phone,enrolled].forEach(p=>p.close());
});

test('background profile sync applies remote changes without restarting the open app',async()=>{
 const db=database(),registered=page(db),created=await registered.api.register(email,password,false,profile);created.complete();
 const computer=page(db,registered.map),phoneEntry=page(db);await phoneEntry.api.signIn(email,password);
 const phone=page(db,phoneEntry.map),updates=[];
 computer.root.addEventListener('fakulteti:profile',event=>updates.push(event.detail));
 computer.api.storage.setItem('u_notes','unfinished local reading notes');
 phone.api.storage.setItem('u_nickname','Updated on phone');await phone.api.syncProfile();
 await computer.api.syncProfile();
 assert.equal(computer.reloads,0);assert.equal(computer.api.storage.getItem('u_name'),'Updated on phone');
 assert.equal(updates.length,1);assert.equal(updates[0].accountId,computer.api.current().id);
 assert.equal(computer.api.storage.getItem('u_notes'),'unfinished local reading notes');
 await computer.api.syncProfile();assert.equal(updates.length,1);assert.equal(computer.reloads,0);
 await phoneEntry.api.resetPassword(email,created.recoveryCode,password+'new');
 await assert.rejects(computer.api.syncProfile(),e=>e.code==='SESSION_REVOKED');
 assert.equal(computer.reloads,1);assert.equal(computer.api.current(),null);
 [registered,computer,phoneEntry,phone].forEach(p=>p.close());
});
test('legacy account migration preserves the local ID, learning data, and original recovery code',async()=>{
 const db=database(),local=page(db,new Map(),false),created=await local.api.register(email,password,false,profile);created.complete();
 const old=page(db,local.map,false);old.api.storage.setItem('u_notes','keep this');const id=old.api.current().id;old.api.signOut();
 const connected=page(db,local.map);await connected.api.signIn(email,password);const migrated=page(db,local.map);
 assert.equal(migrated.api.isOnline(),true);assert.equal(migrated.api.current().id,id);assert.equal(migrated.api.storage.getItem('u_notes'),'keep this');
 const phone=page(db);await phone.api.resetPassword(email,created.recoveryCode,password+'new');
 assert.equal(phone.api.current().email,email);
 [local,old,connected,migrated,phone].forEach(p=>p.close());
});
