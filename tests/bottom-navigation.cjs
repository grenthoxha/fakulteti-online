const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'fakulteti-online.html'),'utf8');
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(n=>n!=null&&n!==false)});
const nodes=t=>t&&typeof t==='object'?[t,...t.children.flatMap(nodes)]:[];
const title=t=>t&&typeof t==='object'?t.children.map(title).join(''):String(t??'');
const mapping=html.slice(html.indexOf('  const primaryNavigation ='),html.indexOf('  const viewTitle ='));
const start=html.lastIndexOf('React.createElement("nav", {',html.indexOf('"aria-label": "Navigimi kryesor"'));
const nav=html.slice(html.lastIndexOf('!isInstructorAccount &&',start),html.indexOf('), groupMessagesOpen &&',start));
function render(view,studentTab='exams',allowed=()=>true,hidden=false,isInstructorAccount=false){
 const actions=[];const c=vm.createContext({view,studentTab,isMobileNavHidden:hidden,isInstructorAccount,window:{FakultetiApprovals:{canView:allowed}},React:{createElement:h},yearId:1,activeSemesterId:1,
 setView:v=>actions.push(['view',v]),setStudentTab:v=>actions.push(['tab',v]),setScheduleWeekOffset:v=>actions.push(['week',v]),setScheduleSelectedDayKey:v=>actions.push(['day',v]),setCoursesSemesterId:v=>actions.push(['semester',v])});
 vm.runInContext(mapping+'this.nav='+nav,c);return {tree:c.nav,actions};
}
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
for(const [view,section] of [['videos','Lëndët'],['library','Lëndët'],['books','Lëndët'],['topic-explain','Lëndët'],['session','Lëndët'],['articles','Lëndët'],['freerooms','Orari'],['pastexams','Provimet'],['examclash','Provimet'],['exam','Provimet'],['certificate','Provimet'],['grade-calculator','Provimet'],['archive-exam','Provimet'],['mock-exam','Provimet'],['mock-analysis','Provimet'],['final-prep','Provimet'],['studentservices','Profili'],['housing','Profili'],['profile-edit','Profili'],['academic-progress','Profili'],['support-lostfound','Profili']]){
 const {tree}=render(view),active=nodes(tree).filter(n=>n.props['aria-current']==='page');
 ok(active.length===1&&title(active[0])===section,view+' highlights exactly its parent section');
 ok(active[0].props.className.includes('text-brand-600'),'active text and accessible current page agree for '+view);
}
for(const view of [...new Set([...html.matchAll(/view === ['"]([^'"]+)['"]/g)].map(m=>m[1]))].filter(v=>v!=='instructor')){
 ok(nodes(render(view).tree).filter(n=>n.props['aria-current']==='page').length===1,'rendered destination '+view+' always has a primary section');
}
for(const tab of ['exams','arena_redirect','cases'])ok(title(nodes(render('student',tab).tree).find(n=>n.props['aria-current']==='page'))==='Provimet','exam subtab '+tab+' retains parent');
const {tree,actions}=render('videos');const buttons=nodes(tree).filter(n=>n.type==='button');
buttons.find(n=>title(n)==='Orari').props.onClick();ok(JSON.stringify(actions)==='[["week",0],["day",null],["view","week"]]','timetable button still resets selected week and day');
actions.length=0;buttons.find(n=>title(n)==='Lëndët').props.onClick();ok(JSON.stringify(actions)==='[["semester","1:1"],["view","courses"]]','courses button retains current semester');
actions.length=0;buttons.find(n=>title(n)==='Provimet').props.onClick();ok(JSON.stringify(actions)==='[["tab","exams"],["view","student"]]','exam navigation retains original action');
const restricted=render('videos','exams',v=>v!=='courses').tree;ok(nodes(restricted).find(n=>n.props['aria-current']==='page').props['data-access-hidden']==='true','parent highlighting does not bypass access permissions');
for(const hidden of [false,true]){
 const courseNav=render('course','exams',()=>true,hidden).tree;
 ok(courseNav?.type==='nav','course retains actual navigation element, including while scrolling');
 ok(!courseNav.props['aria-hidden']&&courseNav.props.inert===undefined&&!courseNav.props.className.includes('app-scroll-chrome--bottom-hidden'),'course navigation stays visible and usable');
 ok(title(nodes(courseNav).find(n=>n.props['aria-current']==='page'))==='Lëndët','course navigation keeps courses selected');
}
const scrollingHome=render('home','exams',()=>true,true).tree;
ok(scrollingHome.props['aria-hidden']===true&&scrollingHome.props.inert==='','other pages retain existing scroll behaviour');
ok(render('course','exams',()=>true,false,true).tree===false,'instructor navigation remains unchanged');
for(const mirror of ['github-publish/index.html','github-publish/fakulteti-online.html'])ok(fs.readFileSync(path.join(root,mirror),'utf8')===html,'published HTML stays identical');
console.log(`PASS: ${checks} navigation checks — child destinations, unique active section, original actions and permissions.`);
module.exports={render,nodes,title,html};
