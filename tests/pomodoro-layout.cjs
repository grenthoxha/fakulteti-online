const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'fakulteti-online.html'),'utf8');
const part=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)}),nodes=t=>t&&typeof t==='object'?[t,...t.children.flatMap(nodes)]:[],text=t=>t&&typeof t==='object'?t.children.map(text).join(''):String(t??'');
const code=part('  const POMO_STYLES =','  const POMO_MOON_SVG =')+part('  const renderPomodoroSheet =','  const renderHomeServicesReference =')+'this.render=renderPomodoroSheet;';
function fixture(extra={}){
 const actions=[];const c=vm.createContext({React:{createElement:h,cloneElement:(e,p)=>({...e,props:{...e.props,...p}})},ModalPortal:'Portal',pomoSettings:{focus:25,short:5,long:15,every:4,goal:4,style:'eklipsi'},pomo:{phase:'focus',total:1500,left:1498,cycle:0,endsAt:123,taskId:'task'},pomoLeftSecs:()=>1498,pomoVp:{w:390,h:844},pomoFull:true,pomoLocked:false,pomoHold:false,pomoSetOpen:false,visibleDailyRoutines:[{id:'task',title:'Lexim i kapitullit të ditës'}],routineIsDoneToday:()=>false,POMO_MOON_SVG:'<circle r="100" fill="white"/>',unitUiIcon:(d,cls)=>h('svg',{className:cls,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8},h('path',{d})),...Object.fromEntries(['pomoStart','pomoPause','pomoStop','pomoReset','pomoToggleFull','pomoLock','pomoClose','pomoHoldStart','pomoHoldEnd','pomoRestartAll','updatePomoSetting','setPomoSetOpen','setPomo','showToast'].map(k=>[k,(...args)=>actions.push([k,...args])])),...extra});vm.runInContext(code,c);return {render:()=>c.render(),actions,c};
}
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
for(const [w,height] of [[338,715],[430,932],[844,390],[667,320],[1280,800]])for(const style of ['eklipsi','flip','horizont'])for(const locked of [false,true]){
 const {render}=fixture({pomoVp:{w,h:height},pomoSettings:{focus:25,short:5,long:15,every:4,goal:4,style},pomoLocked:locked});const tree=render(),all=nodes(tree),surface=all.find(n=>n.props.className==='pomo-surface'),display=all.find(n=>n.props.className==='pomo-timer-display');
 ok(surface.props.style.width===w&&surface.props.style.height===height,'full screen follows visible viewport '+[w,height,style,locked]);
 const ds=display.props.style;ok(ds.left+ds.width/2===w/2,'horizontal center '+[w,height,style,locked]);
 ok(ds.height?Math.abs(ds.top+ds.height/2-height/2)<1:ds.top===height/2&&ds.transform==='translateY(-50%)','vertical center '+[w,height,style,locked]);
 if(ds.height)ok(ds.top>=0&&ds.top+ds.height<=height,'timer fits visible height '+[w,height,style,locked]);
 if(locked)ok(all.filter(n=>n.type==='button').length===1&&all.some(n=>n.props['aria-label']==='Mbaj shtypur për të zhbllokuar'),'locked screen only exposes hold to unlock');
 else if(w>height*1.05){const side=all.find(n=>n.props.key==='side'),buttons=side.children.filter(n=>n.type==='button'),used=buttons.reduce((sum,b)=>sum+b.props.style.height,0)+side.props.style.gap*(buttons.length-1);ok(used<=height-20,'landscape controls fit without clipping '+[w,height]);}
}
let f=fixture(),tree=f.render();nodes(tree).find(n=>n.type==='button'&&text(n)==='Pauzë').props.onClick();ok(f.actions[0][0]==='pomoPause','running timer retains pause action');
f=fixture({pomo:{phase:'focus',total:1500,left:1498,cycle:0,endsAt:null,taskId:'task'}});nodes(f.render()).find(n=>n.type==='button'&&text(n)==='Vazhdo').props.onClick();ok(f.actions[0][0]==='pomoStart','paused timer retains resume action');
f=fixture({pomoFull:false,pomoVp:{w:538,h:849}});tree=f.render();let surface=nodes(tree).find(n=>n.props.className==='pomo-surface'),display=nodes(tree).find(n=>n.props.className==='pomo-timer-display');ok(surface.props.style.height<849&&display.props.style.top+display.props.style.height/2===surface.props.style.height/2,'sheet timer is centered too');
f=fixture({pomoSetOpen:true});tree=f.render();ok(text(tree).includes('Nis pushimin automatikisht')&&text(tree).includes('Pushimi i gjatë'),'real duration and auto-start settings remain available');
// Timer interaction uses the same start/pause action in all three appearances.
for(const style of ['eklipsi','flip','horizont']){
 let f=fixture({pomoSettings:{focus:25,short:5,long:15,every:4,goal:4,style}}),display=nodes(f.render()).find(n=>n.props.className==='pomo-timer-display');
 ok(display.props.role==='button'&&display.props.tabIndex===0&&display.props['aria-pressed']===true,'running timer is an accessible toggle: '+style);
 display.props.onClick();ok(f.actions.length===1&&f.actions[0][0]==='pomoPause','tapping running timer pauses: '+style);
 f=fixture({pomoSettings:{focus:25,short:5,long:15,every:4,goal:4,style},pomo:{phase:'focus',total:1500,left:1498,cycle:0,endsAt:null,taskId:'task'}});display=nodes(f.render()).find(n=>n.props.className==='pomo-timer-display');
 display.props.onClick();ok(f.actions[0][0]==='pomoStart','tapping paused timer resumes: '+style);
 for(const key of ['Enter',' ']){let prevented=false;display.props.onKeyDown({key,preventDefault(){prevented=true;}});ok(prevented&&f.actions.at(-1)[0]==='pomoStart','timer supports keyboard activation: '+style+' '+key);}
 const count=f.actions.length;display.props.onKeyDown({key:' ',repeat:true,preventDefault(){}});ok(f.actions.length===count,'holding a key never repeatedly toggles: '+style);
 f=fixture({pomoLocked:true,pomoSettings:{focus:25,short:5,long:15,every:4,goal:4,style}});display=nodes(f.render()).find(n=>n.props.className==='pomo-timer-display');
 ok(!display.props.onClick&&display.props.tabIndex==null,'locked timer cannot be paused by tapping or tabbing: '+style);
}
for(const vp of [{w:538,h:849},{w:844,h:390}]){
 const f=fixture({pomoVp:vp}),stop=nodes(f.render()).find(n=>n.props['aria-label']==='Ndalo Pomodoron');
 stop.props.onClick();ok(f.actions[0][0]==='pomoStop','stop icon ends the entire sequence in portrait and landscape');
 ok(!nodes(f.render()).some(n=>n.props['aria-label']==='Rifillo kohëmatësin'),'phase reset is replaced by complete stop');
}
const settingsFixture=fixture({pomoSetOpen:true});ok(!nodes(settingsFixture.render()).find(n=>n.props.className==='pomo-timer-display').props.onClick,'timer cannot activate behind its settings panel');
for(const style of ['eklipsi','flip','horizont'])for(const vp of [{w:390,h:844},{w:844,h:390}]){
 for(const [state,label,action] of [[{endsAt:123,left:1500},'FOKUS','Pauzë'],[{endsAt:null,left:1500,wasPaused:true},'NË PAUZË','Vazhdo'],[{endsAt:null,left:1500},'GATI','Fillo'],[{endsAt:123,left:300,total:300,phase:'short'},'PUSHIM','Pauzë']]){
  const f=fixture({pomoVp:vp,pomoSettings:{focus:25,short:5,long:15,every:4,goal:4,style},pomo:{phase:'focus',total:1500,cycle:0,taskId:'task',done:false,...state},pomoLeftSecs:()=>state.left});
  const tree=f.render();ok(text(tree).includes(label),'persistent timer state is visible in every style/orientation: '+label);
  ok(nodes(tree).some(n=>n.type==='button'&&(text(n)===action||n.props['aria-label']===action)),'clear primary action matches timer state: '+action);
 }
}
// A pause during the first second still looks paused despite rounded-up 25:00.
const immediate=vm.createContext({window:{},Date:{now:()=>1000},pomo:{phase:'focus',total:1500,left:1500,endsAt:1501000,cycle:0},pomoSettings:{},setPomoNow(){},pomoFinishPhase(){throw Error('not finished');}});
vm.runInContext(fs.readFileSync(path.join(root,'assets/pomodoro-core.js'),'utf8'),immediate);
immediate.setPomo=update=>{immediate.pomo=update(immediate.pomo);};immediate.pomoPhaseSecs=()=>1500;
vm.runInContext(part('  const pomoStart =','  const pomoStop =')+'this.pause=pomoPause;this.start=pomoStart;this.reset=pomoReset;',immediate);
immediate.pause();ok(immediate.pomo.left===1500&&immediate.pomo.wasPaused&&!immediate.pomo.endsAt,'immediate pause has a durable explicit paused state');
immediate.start();ok(!immediate.pomo.wasPaused&&immediate.pomo.endsAt===1501000,'resume clears paused state without changing the deadline');
immediate.pause();immediate.reset();ok(!immediate.pomo.wasPaused&&!immediate.pomo.endsAt,'reset returns to ready rather than paused');
// Execute the real stop handler: it cancels the deadline and resets the sequence,
// while preserving the task and completed-session history.
let stoppedState={phase:'long',total:900,left:411,endsAt:Date.now()+411000,cycle:3,taskId:'chapter',done:false},settingsOpen=true;
const history=[{id:'completed-session'}],stopContext=vm.createContext({pomoLocked:false,pomoPhaseSecs:phase=>phase==='focus'?3000:900,setPomo:update=>{stoppedState=update(stoppedState);},setPomoSetOpen:value=>{settingsOpen=value;},pomoHistory:history});
vm.runInContext(part('  const pomoStart =','  const pomoSetPhase =')+'this.stop=pomoStop;',stopContext);stopContext.stop();
ok(stoppedState.phase==='focus'&&stoppedState.cycle===0&&stoppedState.endsAt===null&&stoppedState.left===3000&&stoppedState.total===3000&&!stoppedState.done,'stop resets every phase to the configured fresh focus duration');
ok(stoppedState.taskId==='chapter'&&history.length===1&&!settingsOpen,'stop preserves task and completed history');
const snapshot=stoppedState;stopContext.pomoLocked=true;stopContext.stop();ok(stoppedState===snapshot,'stop cannot bypass focus lock');
// Fullscreen and mobile browser viewport changes are measured and cleaned up.
const listeners=new Map(),viewport={width:430,height:780,addEventListener:(k,fn)=>listeners.set('viewport:'+k,fn),removeEventListener:k=>listeners.delete('viewport:'+k)};let cleanup,measured;
const c=vm.createContext({pomoOpen:true,window:{innerWidth:430,innerHeight:932,visualViewport:viewport,addEventListener:(k,fn)=>listeners.set('window:'+k,fn),removeEventListener:k=>listeners.delete('window:'+k)},document:{addEventListener:(k,fn)=>listeners.set('document:'+k,fn),removeEventListener:k=>listeners.delete('document:'+k)},setPomoVp:v=>measured=v,useEffect:fn=>cleanup=fn(),cancelAnimationFrame(){},requestAnimationFrame:fn=>{fn();return 1;}});
const marker=html.indexOf('  const [pomoVp, setPomoVp]');const effect=html.indexOf('  useEffect(() => {',marker);vm.runInContext(html.slice(effect,html.indexOf('  }, [pomoOpen]);',effect)+'  }, [pomoOpen]);'.length),c);
ok(measured.h===780,'uses visible mobile viewport instead of stale layout height');viewport.height=932;listeners.get('document:fullscreenchange')();ok(measured.h===932,'fullscreen remeasures the timer stage');viewport.width=932;viewport.height=430;listeners.get('viewport:resize')();ok(measured.w===932&&measured.h===430,'rotation remeasures dimensions');cleanup();ok(listeners.size===0,'viewport listeners cleaned up on close');
for(const file of ['github-publish/index.html','github-publish/fakulteti-online.html'])ok(fs.readFileSync(path.join(root,file),'utf8')===html,'HTML mirrors match');
console.log(`PASS: ${checks} Pomodoro layout checks — centered timer, rotations, controls, lock mode and viewport changes.`);
module.exports={fixture,html,nodes,text,h};
