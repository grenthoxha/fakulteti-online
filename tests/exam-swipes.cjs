const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('fakulteti-online.html','utf8');
const take=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(n=>n!=null&&n!==false)});
const nodes=n=>n&&typeof n==='object'?[n,...n.children.flatMap(nodes)]:[];
const text=n=>n&&typeof n==='object'?n.children.map(text).join(''):String(n??'');
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
function fixture(pointerType='touch') {
 const exam={id:'master-exam',courseId:'up_socm_01_01',title:'Provimi: Metodat e hulumtimit empirik',date:'2026-12-01',time:'10:00',room:'200'},removed=[],listeners={},timers=new Map();let serial=0,pageStarts=0;
 const actions={style:{}},el={style:{},parentElement:{querySelector:()=>actions},setPointerCapture(){}};
 const target={closest:s=>s.includes('[data-swipe-ignore]')?{}:null};
 const c=vm.createContext({React:{createElement:h,Fragment:'fragment'},window:{addEventListener(){},removeEventListener(){}},navigator:{},allCourses:[{id:exam.courseId,title:'Metodat e hulumtimit empirik',chapters:[]}],enrolledCourses:[],readChapters:{},examDeadlines:[exam],examActionId:null,examSwipeId:null,examSelect:{on:false,ids:[]},examAddMenu:false,examImport:{open:false},deadlineDraft:{},openExamId:null,today:'2026-11-27',openExamAdd(){},formatDateSq:(d,o)=>o.day?'1':o.month?'dhjetor':'e martë',capFirst:v=>v,daysUntil:()=>4,unitUiIcon:()=>null,removeDeadline:id=>removed.push(id),setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),unitSwipeClickGuard:{until:0}});
 for(const[name,key]of[['setDeadlineDraft','deadlineDraft'],['setOpenExamId','openExamId'],['setExamActionId','examActionId'],['setExamSwipeId','examSwipeId']])c[name]=v=>c[key]=typeof v==='function'?v(c[key]):v;
 vm.runInContext(take('  const renderExamsMinimal =','  /* ══ KREU')+'this.render=renderExamsMinimal;',c);
 vm.runInContext(take('function bindUnitSwipe(','const getVideoStorySwipeAction ='),c);
 const main={addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){}};
 const cleanup=c.bindUnitSwipe(main,{onStart:()=>{pageStarts++;return{};},onMove(){},onEnd(){}});
 const render=()=>c.render(),card=tree=>nodes(tree).find(n=>n.props.onPointerMove);
 let tree=render(),row=card(tree);
 const event=(type,x,y=100)=>({type,clientX:x,clientY:y,pointerId:1,isPrimary:true,pointerType,button:0,timeStamp:x+1000,cancelable:true,currentTarget:el,target,preventDefault(){this.prevented=true;}});
 return{c,removed,timers,el,actions,render,card,cleanup,pageStarts:()=>pageStarts,tree:()=>tree,
   start(x=200,y=100){tree=render();row=card(tree);const e=event('pointerdown',x,y);listeners.pointerdown(e);row.props.onPointerDown(e);},
   move(x,y=100){const e=event('pointermove',x,y);listeners.pointermove(e);row.props.onPointerMove(e);return e;},
   end(type='pointerup'){const e=event(type,20);listeners[type]?.(e);row.props[type==='pointercancel'?'onPointerCancel':'onPointerUp'](e);},
   tap(){nodes(tree).find(n=>n.type==='button'&&n.props['aria-expanded']!==undefined).props.onClick();}};
}
for(const type of ['touch','mouse']) {
 const f=fixture(type);ok(nodes(f.render()).some(n=>n.props['data-swipe-ignore']===true),'exam actions own the gesture before the page handler');
 f.start();ok(f.move(20).prevented,'horizontal drag suppresses native browser motion');f.end();
 ok(f.c.examSwipeId==='master-exam'&&f.el.style.transform==='translateX(-156px)','left swipe reveals edit/delete actions');
 ok(f.pageStarts()===0&&f.removed.length===0&&f.c.openExamId===null,'card swipe neither switches page, deletes, nor opens details');
 f.tap();ok(f.c.openExamId===null,'post-drag click is consumed');
 let tree=f.render();nodes(tree).find(n=>n.type==='button'&&text(n)==='Ndrysho').props.onClick();ok(f.c.deadlineDraft.editId==='master-exam','edit action targets the same master exam');
 f.c.deadlineDraft={};f.start();f.move(20);f.end();tree=f.render();nodes(tree).find(n=>n.type==='button'&&text(n)==='Fshi').props.onClick();ok(f.removed.join()==='master-exam','deletion requires the explicit action button');f.cleanup();
}
let f=fixture();f.start();ok(!f.move(197,200).prevented,'vertical scrolling is left to the browser');f.end('pointercancel');ok(f.c.examSwipeId===null,'vertical scroll never reveals exam actions');
f=fixture();f.start();f.move(20);f.end('pointercancel');ok(f.c.examSwipeId===null&&f.el.style.transform==='translateX(0px)','cancelled gesture restores the closed card');
console.log(`PASS: ${checks} exam swipe checks — gesture ownership, touch/mouse, edit/delete, click suppression and cancellation.`);
