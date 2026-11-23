/* Only the explicit profile allowlist is synchronized. Learning data never leaves the device. */
(function (root) {
  'use strict';
  const SERVICE = 'https://fakulteti-aprovimet.personalebuds.chatgpt.site';
  const raw = root.localStorage, utf8 = new TextEncoder();
  const fields = {firstName:'u_real_first_name',lastName:'u_real_last_name',nickname:'u_nickname',gender:'u_gender',faculty:'u_faculty',branch:'u_branch',year:'u_year',semester:'u_semester',photo:'u_profile_photo'};
  const hex = v => [...new Uint8Array(v)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const fail = code => { throw Object.assign(new Error(code),{code}); };
  const prefix = account => account.importedLegacy ? '' : 'fakulteti.account.v1:'+account.id+':';
  const read = (account,key) => raw.getItem(prefix(account)+key);
  const write = (account,key,value) => raw.setItem(prefix(account)+key,String(value));
  async function identity(account) {
    try { const v=JSON.parse(read(account,'u_approval_device_v1')); if(v?.privateKey&&v?.publicKey&&v?.id)return v; } catch {}
    const pair=await root.crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const publicKey=await root.crypto.subtle.exportKey('jwk',pair.publicKey),privateKey=await root.crypto.subtle.exportKey('jwk',pair.privateKey);
    const id=hex(await root.crypto.subtle.digest('SHA-256',utf8.encode(publicKey.x+'.'+publicKey.y)));
    return {id,publicKey,privateKey};
  }
  async function call(who,path,method='GET',value) {
    const body=value===undefined?'':JSON.stringify(value),time=String(Date.now()),nonce=hex(root.crypto.getRandomValues(new Uint8Array(16)));
    const key=await root.crypto.subtle.importKey('jwk',who.privateKey,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
    const signature=hex(await root.crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,utf8.encode([method,path,time,nonce,body].join('\n'))));
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),25000);
    try {
      const response=await root.fetch(SERVICE+path,{method,cache:'no-store',credentials:'omit',signal:abort.signal,
        headers:{'Content-Type':'application/json','X-Fakulteti-Id':who.id,'X-Fakulteti-Time':time,'X-Fakulteti-Nonce':nonce,'X-Fakulteti-Signature':signature},...(body?{body}:{})});
      let result; try {result=await response.json();} catch {fail('SERVICE_UNAVAILABLE');}
      if(!response.ok)fail(result.error||'SERVICE_UNAVAILABLE');
      return result;
    } catch(e) {if(e.code)throw e;fail('SERVICE_UNAVAILABLE');} finally {clearTimeout(timer);}
  }
  function profile(account) {
    const p=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,read(account,v)||'']));
    if(!p.firstName || !p.lastName){const parts=(read(account,'u_real_name')||read(account,'u_name')||'').trim().split(/\s+/);p.firstName ||= parts[0]||'';p.lastName ||= parts.slice(1).join(' ');}
    p.requestedRole=read(account,'u_role')==='instructor'?'instructor':'student';
    return p;
  }
  function apply(account,result,who) {
    const previousBranch=read(account,'u_branch');
    for(const [k,key] of Object.entries(fields))write(account,key,result.profile[k]||'');
    const year=Number(result.profile.year);
    if(Number.isInteger(year)&&year>=1&&year<=10) {
      let unlocked=[];try {const v=JSON.parse(read(account,'u_unlocked')||'[]');if(Array.isArray(v)&&previousBranch===result.profile.branch)unlocked=v.filter(n=>Number.isInteger(n)&&n>=1&&n<=10);}catch{}
      write(account,'u_unlocked',JSON.stringify([...new Set([...unlocked,...Array.from({length:year},(_,i)=>i+1)])].sort((a,b)=>a-b)));
    }
    const full=result.profile.firstName+' '+result.profile.lastName;
    write(account,'u_real_name',full);write(account,'u_name',result.profile.nickname||full);
    write(account,'u_faculty_selected_v1',result.profile.faculty?'1':'');
    write(account,'u_role',result.profile.requestedRole);
    write(account,'u_cloud_profile_version',result.profileVersion);
    raw.removeItem(prefix(account)+'u_cloud_profile_dirty');
    if(who)write(account,'u_approval_device_v1',JSON.stringify(who));
    raw.removeItem(prefix(account)+'u_approval_profile_v1');
  }
  root.FakultetiCloud = Object.freeze({fields,profile,apply,identity,call,
    async authenticate(action,email,password,account,options={}) {
      const who=await identity(account);
      const result=await call(who,'/api/cloud/'+action,'POST',{email,password,publicKey:who.publicKey,...options});
      return {result,who};
    }
  });
})(window);
