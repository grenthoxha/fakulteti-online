const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('fakulteti-online.html','utf8');
const take=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const calls=[];let exists=true,available=true;
const c=vm.createContext({window:{},URL,AbortSignal,fetch:async url=>{const u=new URL(url);calls.push(u);if(!available)throw Error('offline');return{ok:true,json:async()=>({source:'ASK',name:u.searchParams.get('name'),total:exists?1:0,exists})};}});
vm.runInContext(take('const normalizeStudentName =','const ASK_DEFAULT_STUDENT_NAME =')+take('const ASK_NAME_LOOKUP_ENDPOINT =','const getStoredStudentIdentity =')+'this.valid=validateAskStudentIdentity;this.full=isValidStudentFullName;',c);
(async()=>{
 for(const surname of ['O’Neill','Zyss-Unglisted','赵','X','van der Meer','Smith Jr.']) {
  const result=await c.valid('Arta',surname);ok(result.ok,'a surname outside the old list, with punctuation or one character, is accepted: '+surname);
  ok(c.full('Arta '+surname),'accepted surname remains valid when the account is reopened: '+surname);
 }
 ok(calls.length===1,'the name-only ASK lookup can use its existing cache regardless of surname');
 ok(calls.every(url=>[...url.searchParams.keys()].join()==='name'&&url.searchParams.get('name')==='Arta'),'only the given name is sent for verification');
 ok(!(await c.valid('Arta','')).ok&&!(await c.valid('Arta','x'.repeat(81))).ok,'the surname remains an ordinary required bounded field');
 ok(!(await c.valid('123','Anything')).ok,'given-name format validation remains active');
 exists=false;ok(!(await c.valid('Unknownname','O’Neill')).ok,'a name absent from ASK still cannot register');
 available=false;ok(!(await c.valid('Anothername','O’Neill')).ok,'a failed given-name check never silently approves registration');
 console.log(`PASS: ${checks} registration checks — only given names are verified; surnames are free text and persist across launch.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
