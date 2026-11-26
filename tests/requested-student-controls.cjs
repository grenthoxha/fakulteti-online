const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('fakulteti-online.html','utf8');
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(n=>n!=null&&n!==false)});
const nodes=n=>n&&typeof n==='object'?[n,...n.children.flatMap(nodes)]:[];
const text=n=>n&&typeof n==='object'?n.children.map(text).join(''):String(n??'');
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const take=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const source=take('  const renderExamsMinimal =','  /* ══ KREU');
function exams(records,extra={}) {
 const calls=[],c=vm.createContext({React:{createElement:h,Fragment:'fragment'},window:{},navigator:{},allCourses:[{id:'psych',title:'Hyrje në psikologji',chapters:[]}],enrolledCourses:[],readChapters:{},examDeadlines:records,examActionId:null,examSwipeId:null,examSelect:{on:false,ids:[]},examAddMenu:false,examImport:{open:false},deadlineDraft:{},openExamId:null,today:'2026-11-26',openExamAdd(){},formatDateSq:(d,o)=>o.day?'1':o.month?'dhjetor':'e martë',capFirst:v=>v,daysUntil:()=>5,unitUiIcon:d=>h('svg',{},h('path',{d})),setTimeout,clearTimeout,...extra});
 for(const [name,key] of [['setDeadlineDraft','deadlineDraft'],['setOpenExamId','openExamId'],['setExamActionId','examActionId']]) c[name]=value=>{c[key]=typeof value==='function'?value(c[key]):value;calls.push([name,c[key]]);};
 vm.runInContext(source+'this.render=renderExamsMinimal;',c);return{c,calls,render:()=>c.render()};
}
const exam={id:'personal-exam',courseId:'psych',title:'Provimi: Hyrje në psikologji',date:'2026-12-01',time:'',room:''};
for(const fields of [{time:'',room:''},{time:'10:00',room:''},{time:'',room:'200'},{time:'  ',room:' '}]) {
 const f=exams([{...exam,...fields}]),tree=f.render(),edit=nodes(tree).find(n=>n.props.className==='exam-complete-details');
 ok(edit?.type==='button','missing time or room exposes an explicit edit action');
 let stopped=0;const event={stopPropagation(){stopped++;}};edit.props.onPointerDown(event);edit.props.onPointerUp(event);edit.props.onClick(event);
 ok(stopped===3&&f.c.openExamId===null,'edit interaction does not start card swipe or expansion');
 ok(f.c.deadlineDraft.editId===exam.id&&f.c.deadlineDraft.courseId==='psych'&&f.c.deadlineDraft.date===exam.date,'edit targets the existing exam and preserves its course/date');
 ok(f.c.deadlineDraft.examTime===fields.time.trim()&&f.c.deadlineDraft.examRoom===fields.room.trim(),'known details are preserved and missing details stay empty');
}
let f=exams([{...exam,time:'10:00',room:'200'}]);ok(!nodes(f.render()).some(n=>n.props.className==='exam-complete-details'),'complete exams retain the existing compact row');
f=exams([exam],{openExamId:exam.id});let tree=f.render();
for(const label of ['Shto orën: Hyrje në psikologji','Shto sallën: Hyrje në psikologji']) {const button=nodes(tree).find(n=>n.props['aria-label']===label);ok(button?.type==='button','expanded missing field is directly editable: '+label);button.props.onClick();ok(f.c.deadlineDraft.editId===exam.id,'missing field opens the same exam composer');}
f=exams([exam],{examSelect:{on:true,ids:[exam.id]}});ok(!nodes(f.render()).some(n=>n.props.className==='exam-complete-details'),'selection mode does not introduce competing edit controls');
// Execute the real save handler: editing cannot duplicate the exam or erase its other data.
const save=take('  const handleAddExam =','  const removeDeadline =');
const c=vm.createContext({deadlineDraft:{editId:exam.id,courseId:'psych',date:exam.date,examTime:'11:15',examRoom:' 103 '},allCourses:[{id:'psych',title:'Hyrje në psikologji'}],deadlines:[{...exam,customNote:'Keep me'},{id:'other',type:'task'}],showToast(){},branchId:'psychology',yearId:1});
c.setDeadlines=fn=>{c.deadlines=fn(c.deadlines);};c.setDeadlineDraft=value=>{c.deadlineDraft=value;};
vm.runInContext(save+'handleAddExam();',c);
ok(c.deadlines.length===2&&c.deadlines[0].time==='11:15'&&c.deadlines[0].room==='103'&&c.deadlines[0].customNote==='Keep me','saving details updates the existing exam only and preserves other data');
function events(target={}) {const map=new Map();return Object.assign(target,{listeners:map,addEventListener(k,f){if(!map.has(k))map.set(k,new Set());map.get(k).add(f);},removeEventListener(k,f){map.get(k)?.delete(f);},emit(k){map.get(k)?.forEach(f=>f());}});}
const overlay={style:{}},viewport=events({height:844,offsetTop:0}),win=events({visualViewport:viewport,innerHeight:844}),doc={getElementById:()=>overlay};
const v=vm.createContext({});vm.runInContext(take('function bindTaskComposerViewport','function bindBujarRoomsResume'),v);
const release=v.bindTaskComposerViewport(doc,win);ok(overlay.style.height==='844px'&&overlay.style.top==='0px','task sheet starts inside the current viewport');
viewport.height=410;viewport.offsetTop=24;viewport.emit('resize');ok(overlay.style.height==='410px'&&overlay.style.top==='24px','keyboard viewport and offset keep the bottom sheet visible');
viewport.height=380;viewport.offsetTop=0;win.emit('resize');ok(overlay.style.height==='380px','rotating the phone updates the available sheet height');
release();viewport.height=900;viewport.emit('resize');ok(overlay.style.height==='380px'&&[...viewport.listeners.values(),...win.listeners.values()].every(s=>s.size===0),'closing the sheet removes all viewport listeners');
ok(typeof v.bindTaskComposerViewport({getElementById:()=>null},win)==='function','an absent sheet has no side effects');
// Room cards remain visible; navigation is still denied when the role cannot open rooms.
const serviceSource=take('  const renderHomeServicesReference =','  const renderTodayTasksMinimal =');
for(const allowed of [false,true]) {
 const calls=[],s=vm.createContext({React:{createElement:h},appearanceText:sq=>sq,facultyContext:{hasFreeRooms:true},window:{FakultetiApprovals:{canView:id=>id!=='freerooms'||allowed}},unitUiIcon:d=>h('svg',{},h('path',{d})),setView:id=>calls.push(['navigate',id]),showToast:message=>calls.push(['notice',message])});
 vm.runInContext(serviceSource+'this.render=renderHomeServicesReference;',s);tree=s.render();const card=nodes(tree).find(n=>n.type==='button'&&text(n).includes('Sallat e Lira'));
 ok(Boolean(card),'rooms card remains visible for an ordinary or privileged account');
 ok(card.props['aria-disabled']===(allowed?undefined:'true'),'rooms card communicates its access state');card.props.onClick();
 ok(calls[0][0]===(allowed?'navigate':'notice'),'locked rooms card never invokes navigation');
 const books=nodes(tree).find(n=>n.type==='button'&&text(n).includes('Skripta & Libra'));books.props.onClick();ok(calls.at(-1)[1]==='books','other service access stays unchanged');
}
console.log(`PASS: ${checks} exam editing, existing-data preservation, keyboard sheet lifecycle and privileged-card interaction checks`);
