const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/admin-alerts.js','utf8');let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(v=>v!=null&&v!==false)});
const nodes=t=>t&&typeof t==='object'?[t,...t.children.flatMap(nodes)]:[];
const text=t=>t&&typeof t==='object'?t.children.map(text).join(''):String(t??'');
class Event{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
function fixture(supported=true){
 let admin=false,policy=null,account='owner',enrolls=0,revokes=0,opens=0,fail=false,deferred;
 const events=new Map(),map=new Map(),commands=[],states=[],cleanups=[];let cursor=0;
 const root={React:{createElement:h,useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useEffect(effect){const i=cursor++;if(!(i in states)){states[i]=true;cleanups.push(effect());}}},
  addEventListener(k,f){if(!events.has(k))events.set(k,new Set());events.get(k).add(f);},removeEventListener(k,f){events.get(k)?.delete(f);},dispatchEvent(e){for(const f of events.get(e.type)||[])f(e);},
  FakultetiLocalAccounts:{current:()=>account?{id:account}:null,storage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v))}},
  fakultetiAndroid:{adminApprovalsSupported:supported,send:c=>commands.push(c)}};
 root.FakultetiApprovals={get policy(){return policy;},isAdmin:()=>admin,alertsEnroll:async()=>{enrolls++;if(fail)throw Error('offline');if(deferred)return deferred;return {deviceId:'a'.repeat(64),token:'b'.repeat(64),expires:Date.now()+30*86400000};},alertsRevoke:async()=>{revokes++;}};
 root.addEventListener('fakulteti:manage-accounts',()=>opens++);
 const c=vm.createContext({window:root,CustomEvent:Event,console});vm.runInContext(source,c);
 return {root,map,commands,api:root.FakultetiAdminAlerts,setAdmin(value){admin=value;policy={status:value?'approved':'pending',isAdmin:value};},setAccount:v=>account=v,setFail:v=>fail=v,setDeferred:p=>deferred=p,
  emit:(k,detail)=>root.dispatchEvent(new Event(k,{detail})),render(){cursor=0;return root.FakultetiAdminAlertsControl();},get enrolls(){return enrolls;},get revokes(){return revokes;},get opens(){return opens;},close(){cleanups.forEach(f=>f?.());}};
}
async function settle(){for(let i=0;i<15;i++)await Promise.resolve();}
(async()=>{
 const f=fixture();f.emit('fakulteti:android-ready');await settle();ok(f.commands.length===0,'cold notification tap is kept until policy is known');
 f.setAdmin(false);f.emit('fakulteti:approval');await settle();ok(f.enrolls===0&&f.commands.includes('approval-alerts-clear'),'non-admin cannot enroll and clears the native job');ok(f.render()===null,'student never sees admin alert settings');
 f.setAdmin(true);f.emit('fakulteti:approval');await settle();ok(f.enrolls===1&&f.commands.some(s=>s.startsWith('approval-alerts-sync:')),'verified admin automatically registers on the supported APK');
 ok(f.commands.includes('approval-alerts-ready:'+'a'.repeat(64)),'native deep link is acknowledged for the authenticated device');
 await f.api.sync();ok(f.enrolls===1,'regular policy checks reuse the read-only credential');
 f.emit('fakulteti:approval-alerts-open','wrong-scope');ok(f.opens===0,'notification for a different account cannot open approvals');
 f.emit('fakulteti:approval-alerts-open','a'.repeat(64));ok(f.opens===1,'correct administrator notification opens approval manager');
 f.emit('fakulteti:approval-alerts-state',{enabled:true,registered:true,permission:true});let tree=f.render();ok(text(tree).includes('15 minuta')&&text(tree).includes('Ndali'),'enabled state is visible with the actual interval');
 await nodes(tree).find(n=>n.type==='button').props.onClick();ok(f.revokes===1&&JSON.parse(f.map.get('u_admin_alerts_v1')).enabled===false,'disable revokes the server credential');
 const before=f.enrolls;f.emit('fakulteti:approval');await settle();ok(f.enrolls===before,'background policy refresh respects opt-out');
 await f.api.enable();ok(f.commands.includes('approval-alerts-permission')&&f.enrolls===before+1,'enabling requests Android permission and a fresh credential');
 f.emit('fakulteti:requests-updated');ok(f.commands.at(-1)==='approval-alerts-check','approval decisions refresh or clear the phone notice');
 f.emit('fakulteti:cloud-signout');await settle();ok(!JSON.parse(f.map.get('u_admin_alerts_v1')).grant&&f.revokes===2,'logout clears stored token and revokes background access');
 f.setAdmin(false);f.emit('fakulteti:approval-alerts-open','a'.repeat(64));ok(f.opens===1,'an inactive admin cannot follow an old notification');f.close();
 const old=fixture(false);old.setAdmin(true);tree=old.render();await settle();ok(text(tree).includes('1.0.10')&&nodes(tree).some(n=>n.type==='a'&&n.props.href.includes('v1.0.10')),'older APK/browser receives the actual upgrade link');ok(old.enrolls===0,'unsupported runtime does not create unused tokens');old.close();
 const offline=fixture();offline.setAdmin(true);offline.setFail(true);await offline.api.sync();ok(offline.api.snapshot().error&&!offline.api.snapshot().enabled,'failed enrollment does not claim notifications are active');offline.close();
 const race=fixture();race.setAdmin(true);let resolve;race.setDeferred(new Promise(r=>resolve=r));const inFlight=race.api.sync();race.setAdmin(false);race.setAccount('student');resolve({deviceId:'a'.repeat(64),token:'b'.repeat(64),expires:Date.now()+86400000});await inFlight;ok(!race.commands.some(s=>s.startsWith('approval-alerts-sync:')),'a late enrollment cannot activate alerts for a switched account');race.close();
 const native=fs.readFileSync('android-native/src/io/github/grenthoxha/fakultetionline/MainActivity.java','utf8');
 for(const [prefix,offset] of [['approval-alerts-state:',22],['approval-alerts-open:',21],['approval-alerts-sync:',21],['approval-alerts-ready:',22]])ok(prefix.length===offset&&native.includes(prefix),'web/native protocol '+prefix+' stays aligned');
 console.log(`PASS: ${checks} administrator enrollment, permission, opt-out, logout, native deep link and account isolation checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
