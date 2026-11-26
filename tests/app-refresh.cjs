const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/app-refresh.js','utf8'),html=fs.readFileSync('fakulteti-online.html','utf8');
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
function events(target={}){const map=new Map();return Object.assign(target,{listeners:map,addEventListener(k,f){if(!map.has(k))map.set(k,new Set());map.get(k).add(f);},removeEventListener(k,f){map.get(k)?.delete(f);},emit(k,e={}){map.get(k)?.forEach(f=>f(e));}});}
function fixture(options={}){
 let calls=0,now=1000,modal=false,serial=0;
 const states=[],timers=new Map(),documentElement={},main={parentElement:documentElement,scrollTop:0};
 const clickable={contains:node=>node===target};
 const target={parentElement:main,closest(selector){if(selector.startsWith('input,'))return options.excluded?this:null;if(selector.startsWith('button,'))return options.interactive?clickable:null;return options.outside?null:main;}};
 const doc=events({hidden:false,body:{style:{}},documentElement,scrollingElement:{scrollTop:0},querySelector(selector){return selector.startsWith('header.')?{getBoundingClientRect:()=>({bottom:64})}:modal?{}:null;}});
 const win=events({document:doc,scrollY:0,setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}});
 vm.runInNewContext(source,{window:win,Date:{now:()=>now}});
 const control=win.FakultetiPullRefresh.bind({document:doc,window:win,refresh(){calls++;return options.refresh?options.refresh():Promise.resolve({ok:true});},onUpdate:value=>states.push(value)});
 const touch=(x,y)=>({clientX:x,clientY:y});
 const start=(x=150,y=100)=>doc.emit('touchstart',{target,touches:[touch(x,y)]});
 const move=(x=150,y=220,cancelable=true,count=1)=>{let prevented=false;doc.emit('touchmove',{touches:Array.from({length:count},()=>touch(x,y)),cancelable,preventDefault(){prevented=true;}});return prevented;};
 return{doc,win,target,main,states,timers,control,start,move,end:()=>doc.emit('touchend'),cancel:()=>doc.emit('touchcancel'),setModal:v=>{modal=v;},get calls(){return calls;},get state(){return states.at(-1);},tick:()=>{now+=1000;for(const[id,fn]of timers){timers.delete(id);fn();}}};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
(async()=>{
 let f=fixture();f.start();ok(f.move(),'downward pull at the top prevents native page reload');ok(f.state.phase==='armed','crossing the threshold arms refresh');f.end();await flush();ok(f.calls===1&&f.state.phase==='success','release refreshes once and shows success only after completion');f.tick();ok(f.state.phase==='idle','success indicator disappears');f.control.dispose();
 f=fixture();f.start();f.move(150,140);f.end();await flush();ok(f.calls===0&&f.state.phase==='idle','short pulls do not request data');
 f=fixture();f.start();ok(!f.move(260,120),'horizontal swipe keeps its normal behavior');f.end();await flush();ok(f.calls===0,'horizontal page changes never refresh');
 f=fixture();f.start();ok(!f.move(150,40),'upward scrolling is untouched');f.end();ok(f.calls===0,'normal upward scroll does not refresh');
 f=fixture();f.doc.scrollingElement.scrollTop=250;f.start();f.move();f.end();await flush();ok(f.calls===0,'no refresh halfway down the page');
 f=fixture();f.main.scrollTop=60;f.start();f.move();f.end();await flush();ok(f.calls===0,'nested scrolling stays independent');
 f=fixture();f.start();f.main.scrollTop=15;ok(!f.move(),'a scroll position change cancels an uncommitted pull');f.end();ok(f.calls===0,'cancelled scroller movement does not refresh');
 for(const option of ['excluded','outside']){f=fixture({[option]:true});f.start();f.move();f.end();await flush();ok(f.calls===0,'does not intercept '+option+' reading/form/media surfaces');}
 f=fixture();f.setModal(true);f.start();f.move();f.end();await flush();ok(f.calls===0,'modal and reader gestures remain independent');
 f=fixture();f.doc.body.style.overflow='hidden';f.start();f.move();f.end();await flush();ok(f.calls===0,'locked page/dialogs cannot trigger refresh');
 f=fixture();f.start();ok(!f.move(150,220,true,2),'pinch zoom is not intercepted');f.end();ok(f.calls===0,'multi-touch never refreshes');
 f=fixture();f.start();f.move();f.doc.emit('touchstart',{target:f.target,touches:[{clientX:150,clientY:220},{clientX:200,clientY:220}]});f.end();await flush();ok(f.calls===0&&f.state.phase==='idle','adding a second finger hides an already-armed indicator without refreshing');
 f=fixture();f.start();f.move();f.setModal(true);f.end();await flush();ok(f.calls===0&&f.state.phase==='idle','a dialog opening before release cancels refresh');
 f=fixture();f.start();f.move();f.cancel();f.end();await flush();ok(f.calls===0,'cancelled touches never refresh');
 f=fixture();f.start();ok(!f.move(150,220,false),'non-cancelable browser gestures are not claimed');f.end();ok(f.calls===0,'browser-owned gesture cannot trigger a duplicate refresh');
 f=fixture({interactive:true});f.start();f.move();let prevented=false,stopped=false;f.doc.emit('click',{target:f.target,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});ok(prevented&&stopped,'pulling a card does not accidentally activate its click');
 prevented=false;f.doc.emit('click',{target:{},preventDefault(){prevented=true;},stopImmediatePropagation(){}});ok(!prevented,'other controls remain usable immediately after a pull');f.cancel();
 f=fixture();f.start();f.move();f.doc.hidden=true;f.doc.emit('visibilitychange');f.end();await flush();ok(f.calls===0,'backgrounding cancels a pending gesture');
 let resolve;f=fixture({refresh:()=>new Promise(r=>{resolve=r;})});f.start();f.move();f.end();await flush();ok(f.state.phase==='loading','spinner follows a real pending request');f.start();f.move();f.end();const pending=f.control.refresh();await flush();ok(f.calls===1,'repeated pulls and retries coalesce while loading');resolve({ok:true});await pending;ok(f.state.phase==='success','pending success settles normally');
 f=fixture({refresh:()=>Promise.resolve({ok:false})});await f.control.refresh();ok(f.state.phase==='error','partial or offline failure is not presented as a successful refresh');
 f=fixture({refresh:()=>Promise.reject(Error('offline'))});await f.control.refresh();ok(f.state.phase==='error','network rejection keeps the current page and offers retry');
 resolve=null;f=fixture({refresh:()=>new Promise(r=>{resolve=r;})});const loading=f.control.refresh();await flush();const count=f.states.length;f.control.dispose();resolve({ok:true});await loading;ok(f.states.length===count&&f.timers.size===0,'late completion after unmount cannot update the old screen');ok([...f.doc.listeners.values(),...f.win.listeners.values()].every(set=>set.size===0),'all listeners are removed on unmount');
 // Execute the actual app refresh, including parallel profile and official-data requests.
 const dataSource=html.slice(html.indexOf('async function refreshApplicationData()'),html.indexOf('window.fakultetiRefreshApp ='));
 const calls=[],context={hasFreeRooms:true};
 let account={},online=true,policyResult={status:'approved'},roomResult={ok:true};
 const root={FakultetiLocalAccounts:{current:()=>account},FakultetiApprovals:{check:async()=>{calls.push('policy');if(policyResult instanceof Error)throw policyResult;return policyResult;}},location:{reload(){throw Error('Unexpected navigation');}}};
 const c=vm.createContext({window:root,navigator:{get onLine(){return online;}},unitStorage:{getItem:()=>''},getStudentFacultyContext:()=>context,FilozofikuDailyStore:{refresh:async options=>{calls.push(['rooms',options.force]);return roomResult;}}});vm.runInContext(dataSource,c);
 ok((await c.refreshApplicationData()).ok&&calls.length===2&&calls[1][1]===true,'manual refresh bypasses the normal eight-hour cache');
 const originalCheck=root.FakultetiApprovals.check;let releasePolicy;calls.length=0;
 root.FakultetiApprovals.check=()=>{calls.push('policy');return new Promise(resolve=>{releasePolicy=resolve;});};
 const parallel=c.refreshApplicationData();ok(calls.length===2&&calls[1][0]==='rooms','official-data refresh starts while the account request is still pending');releasePolicy({status:'approved'});ok((await parallel).ok,'refresh waits for both data sources before reporting success');root.FakultetiApprovals.check=originalCheck;
 roomResult={ok:false};ok(!(await c.refreshApplicationData()).ok,'a failed official source yields failure while retaining existing records');roomResult={ok:true};policyResult=Error('offline');ok(!(await c.refreshApplicationData()).ok,'failed account sync does not produce a false success');policyResult={status:'approved'};
 calls.length=0;context.hasFreeRooms=false;ok((await c.refreshApplicationData()).ok&&calls.length===1,'other faculties refresh the account without fetching unrelated classrooms');
 calls.length=0;online=false;ok(!(await c.refreshApplicationData()).ok&&calls.length===0,'offline mode fails immediately without clearing local data');online=true;account=null;ok(!(await c.refreshApplicationData()).ok&&calls.length===0,'signed-out sessions cannot issue refresh requests');
 const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(n=>n!=null&&n!==false)}),all=n=>n&&typeof n==='object'?[n,...n.children.flatMap(all)]:[];
 const programSource=html.slice(html.indexOf('  const renderProgramScheduleDay ='),html.indexOf('  const renderScheduleMinDay ='));
 const p=vm.createContext({React:{createElement:h},getScheduleMinSelectedDay:()=>({id:4,key:'2026-11-26'}),programScheduleSessions:()=>[{room:'Salla 103',s:1,g:'Punë Sociale-1BA',start:'09:00',end:'10:30',t:'Të drejtat e njeriut',a:'Ushtrime',p:'Profesor'}],scheduleProgramFilter:'social-work',facultyScheduleProgram:{label:'Punë Sociale · Viti I'},formatFilozofikuProf:v=>v});vm.runInContext(programSource+'this.render=renderProgramScheduleDay;',p);const tree=p.render();ok(!all(tree).some(n=>n.type==='h2')&&all(tree).filter(n=>n.type==='article').length===1,'remove only the repeated programme heading; preserve the actual sessions');ok(tree.props['aria-label']==='Orari i Punë Sociale · Viti I','programme context remains available to screen readers');
 console.log(`PASS: ${checks} pull gestures, scroll/media exclusions, request lifecycle, real data refresh and schedule-heading checks`);
})().catch(error=>{console.error(error);process.exitCode=1;});
