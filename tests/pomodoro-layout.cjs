const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'fakulteti-online.html'),'utf8');
const part=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)}),nodes=t=>t&&typeof t==='object'?[t,...t.children.flatMap(nodes)]:[],text=t=>t&&typeof t==='object'?t.children.map(text).join(''):String(t??'');
const code=part('  const POMO_STYLES =','  const POMO_MOON_SVG =')+part('  const renderPomodoroSheet =','  const renderHomeServicesReference =')+'this.render=renderPomodoroSheet;';
function fixture(extra={}){
 const actions=[];const c=vm.createContext({React:{createElement:h,cloneElement:(e,p)=>({...e,props:{...e.props,...p}})},ModalPortal:'Portal',pomoSettings:{focus:25,short:5,long:15,every:4,goal:4,style:'eklipsi'},pomo:{phase:'focus',total:1500,left:1498,cycle:0,endsAt:123,taskId:'task'},pomoLeftSecs:()=>1498,pomoVp:{w:390,h:844},pomoFull:true,pomoLocked:false,pomoHold:false,pomoSetOpen:false,visibleDailyRoutines:[{id:'task',title:'Lexim i kapitullit të ditës'}],routineIsDoneToday:()=>false,POMO_MOON_SVG:'<circle r="100" fill="white"/>',unitUiIcon:(d,cls)=>h('svg',{className:cls,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8},h('path',{d})),...Object.fromEntries(['pomoStart','pomoPause','pomoReset','pomoToggleFull','pomoLock','pomoClose','pomoHoldStart','pomoHoldEnd','pomoRestartAll','updatePomoSetting','setPomoSetOpen','setPomo','showToast'].map(k=>[k,(...args)=>actions.push([k,...args])])),...extra});vm.runInContext(code,c);return {render:()=>c.render(),actions,c};
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
// Fullscreen and mobile browser viewport changes are measured and cleaned up.
const listeners=new Map(),viewport={width:430,height:780,addEventListener:(k,fn)=>listeners.set('viewport:'+k,fn),removeEventListener:k=>listeners.delete('viewport:'+k)};let cleanup,measured;
const c=vm.createContext({pomoOpen:true,window:{innerWidth:430,innerHeight:932,visualViewport:viewport,addEventListener:(k,fn)=>listeners.set('window:'+k,fn),removeEventListener:k=>listeners.delete('window:'+k)},document:{addEventListener:(k,fn)=>listeners.set('document:'+k,fn),removeEventListener:k=>listeners.delete('document:'+k)},setPomoVp:v=>measured=v,useEffect:fn=>cleanup=fn(),cancelAnimationFrame(){},requestAnimationFrame:fn=>{fn();return 1;}});
const marker=html.indexOf('  const [pomoVp, setPomoVp]');const effect=html.indexOf('  useEffect(() => {',marker);vm.runInContext(html.slice(effect,html.indexOf('  }, [pomoOpen]);',effect)+'  }, [pomoOpen]);'.length),c);
ok(measured.h===780,'uses visible mobile viewport instead of stale layout height');viewport.height=932;listeners.get('document:fullscreenchange')();ok(measured.h===932,'fullscreen remeasures the timer stage');viewport.width=932;viewport.height=430;listeners.get('viewport:resize')();ok(measured.w===932&&measured.h===430,'rotation remeasures dimensions');cleanup();ok(listeners.size===0,'viewport listeners cleaned up on close');
for(const file of ['github-publish/index.html','github-publish/fakulteti-online.html'])ok(fs.readFileSync(path.join(root,file),'utf8')===html,'HTML mirrors match');
console.log(`PASS: ${checks} Pomodoro layout checks — centered timer, rotations, controls, lock mode and viewport changes.`);
module.exports={fixture,html,nodes,text,h};
