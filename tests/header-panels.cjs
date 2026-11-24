const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'fakulteti-online.html'), 'utf8');
const section = (a,b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
const h = (type, props, ...children) => ({type, props:props || {}, children:children.flat(Infinity).filter(x=>x!=null && x!==false)});
const nodes = t => t && typeof t === 'object' ? [t,...t.children.flatMap(nodes)] : [];
const text = t => t && typeof t === 'object' ? t.children.map(text).join('') : String(t ?? '');
const find = (t, cls) => nodes(t).find(n=>n.props.className?.split(' ').includes(cls));
let checks=0;
const ok = (v,m) => {assert(v,m); checks++;};
function notificationFixture(extra={}) {
 const actions=[];
 const c=vm.createContext({React:{createElement:h},ModalPortal:'Portal',window:{FakultetiNotifications:{Settings:'Settings'},fakultetiAndroid:{demoRepeatSupported:true}},androidNativeReady:true,androidDemoRepeating:false,
 notificationPreviewOpen:true,notificationCenterOpen:false,notificationTab:'all',notificationUnreadCount:2,
 notificationFeed:Array.from({length:6},(_,i)=>({id:String(i),group:i<3?'today':'week',title:'Title '+i,sub:'Detail '+i,time:'Sot',unread:i<2,action:()=>actions.push(['open',i])})),
 unitUiIcon:()=>null,UNIT_UI_ICONS:{},setNotificationPreviewOpen:v=>actions.push(['preview',v]),setNotificationCenterOpen:v=>actions.push(['center',v]),markNotificationsRead:v=>actions.push(['read',...v]),setNotificationTab:v=>actions.push(['tab',v]),setView:v=>actions.push(['view',v]),...extra});
 vm.runInContext(section('  const renderNotificationCenter =','  /* ── 12')+'this.render=renderNotificationCenter;',c);
 return {c,actions,render:()=>c.render()};
}
let f=notificationFixture(), t=f.render();
ok(find(t,'header-quick-layer'),'notifications use attached panel');
ok(nodes(t).filter(n=>n.props.className?.includes('notification-row')).length===4,'preview bounded to four items');
ok(!nodes(t).some(n=>n.type==='Settings'),'settings stay out of quick list');
ok(!text(t).includes('Provo çdo 5 min'),'demo stays out of quick list');
nodes(t).find(n=>n.type==='button'&&text(n)==='Shiko të gjitha').props.onClick();
ok(JSON.stringify(f.actions)==='[["preview",false],["center",true]]','view all opens full center');
f.actions.length=0;find(t,'notification-row').props.onClick();
ok(JSON.stringify(f.actions)==='[["preview",false],["read","0"],["open",0]]','item marks read and navigates');
f=notificationFixture({notificationPreviewOpen:false,notificationCenterOpen:true});t=f.render();
ok(nodes(t).some(n=>n.type==='Settings'),'full center retains reminder settings');
ok(text(t).includes('Provo çdo 5 min'),'full center retains native demo');
ok(nodes(t).filter(n=>n.props.className?.includes('notification-row')).length===6,'full center retains all items');
f=notificationFixture({notificationFeed:[]});ok(text(f.render()).includes('Nuk ka njoftime'),'notification empty state');

const searchActions=[];
const c=vm.createContext({React:{createElement:h,Fragment:'Fragment'},ModalPortal:'Portal',search:'Psikologji',searchFilter:'all',recentSearches:[],UNIT_UI_ICONS:{},unitUiIcon:()=>null,
 buildSearchGroups:()=>[{id:'courses',label:'Lëndët',items:[{key:'c1',title:'Psikologji',sub:'Kapituj',action:()=>searchActions.push('course')}]},{id:'notes',label:'Shënime',items:[]}],
 setSearch:v=>searchActions.push(['query',v]),setSearchFilter:v=>searchActions.push(['filter',v]),rememberSearch:()=>searchActions.push('remember'),closeSearchPage:()=>searchActions.push('close')});
vm.runInContext(section('  const renderSearchPage =','  /* ── 11')+'this.render=renderSearchPage;',c);t=c.render();
ok(find(t,'header-search-panel') && find(t,'header-quick-backdrop'),'search is a compact dismissible panel');
ok(!nodes(t).some(n=>n.props.className?.includes('inset-0')),'search no longer replaces whole screen');
nodes(t).find(n=>n.type==='button'&&text(n).includes('Kapituj')).props.onClick();
ok(JSON.stringify(searchActions)==='["remember","close","course"]','search remembers and opens actual result');
nodes(t).find(n=>n.type==='button'&&text(n)==='Lëndët · 1').props.onClick();
ok(searchActions.at(-1)[1]==='courses','search category filter retained');
find(t,'header-quick-backdrop').props;find(t,'header-quick-layer').props.onClick();
ok(searchActions.at(-1)==='close','outside tap closes search');
c.buildSearchGroups=()=>[];ok(text(c.render()).includes('Asnjë rezultat'),'search no-results state');
c.search='';ok(text(c.render()).includes('Kërko në lëndët'),'search initial state');

const stateSetters=[], initial=[];
const m=vm.createContext({React:{createElement:h,Fragment:'Fragment'},ModalPortal:'Portal',nativeCreateElement:h,TaskIcons:new Proxy({},{get:()=> 'Icon'}),
 useState:v=>{const i=initial.length;initial.push(v);return[v,n=>stateSetters.push([i,n])];},useRef:()=>({current:null}),useEffect:()=>{}});
vm.runInContext(section('const GroupMessagesPreview =','const dateKey =')+'this.render=GroupMessagesPreview;',m);
t=m.render({branchTitle:'Psikologji',yearTitle:'Viti I',studentName:'Arta',language:'sq',classPresidentHub:'Notices',onClose:()=>stateSetters.push('close')});
ok(initial[1]==='chat','messages start with chats');
ok(find(t,'header-quick-layer'),'messages use attached panel');
ok(nodes(t).filter(n=>n.props.className==='mx-room').length===5,'all group destinations retained');
ok(!nodes(t).some(n=>n.props.className==='mx-sec'),'no repeated group heading blocks');
nodes(t).find(n=>n.props.className==='mx-room').props.onClick();
ok(stateSetters.some(x=>x[0]===0&&x[1]==='group'),'group selection still works');
ok(nodes(t).some(n=>n.props.role==='tab'&&text(n)==='Njoftime'),'notices remain accessible in messages');

// One lock survives switching panels; viewport changes leave room for the keyboard.
const cssValues={}, listeners=new Map();let cleanup;
const style={overflow:'auto'}, rootStyle={setProperty:(k,v)=>cssValues[k]=v,removeProperty:k=>delete cssValues[k]};
const viewport={height:715,offsetTop:0,addEventListener:(k,v)=>listeners.set('viewport:'+k,v),removeEventListener:k=>listeners.delete('viewport:'+k)};
const lock=vm.createContext({notificationCenterOpen:false,notificationPreviewOpen:false,groupMessagesOpen:false,searchOpen:true,
 document:{body:{style},documentElement:{style:rootStyle},querySelector:()=>({getBoundingClientRect:()=>({bottom:64})})},
 window:{innerHeight:715,visualViewport:viewport,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},useEffect:fn=>cleanup=fn()});
vm.runInContext(section('  const headerPanelOpen =','  const [recentSearches,'),lock);
ok(style.overflow==='hidden','opening search locks background');
ok(cssValues['--header-quick-top']==='72px'&&cssValues['--header-quick-height']==='631px','panel starts below header');
viewport.height=390;listeners.get('viewport:resize')();
ok(cssValues['--header-quick-height']==='306px','keyboard reduces panel height');
cleanup();ok(style.overflow==='auto'&&listeners.size===0,'closing restores original scroll and removes viewport listeners');
ok(Object.keys(cssValues).length===0,'viewport styles cleaned up');
const opening=[];
const open=vm.createContext(Object.fromEntries(['NotificationPreviewOpen','NotificationCenterOpen','GroupMessagesOpen','SearchOpen'].map(name=>['set'+name,v=>opening.push([name,v])])));
vm.runInContext(section('  const openHeaderSearch =','  const headerPanelOpen =')+'openHeaderSearch();',open);
ok(JSON.stringify(opening)==='[["NotificationPreviewOpen",false],["NotificationCenterOpen",false],["GroupMessagesOpen",false],["SearchOpen",true]]','search excludes other header panels');

for(const name of ['github-publish/index.html','github-publish/fakulteti-online.html']) ok(fs.readFileSync(path.join(root,name),'utf8')===html,'HTML mirror matches');
console.log(`PASS: ${checks} header panel checks — notification actions, full center, search navigation/filters, chat entry, and mirrors.`);
module.exports={html,section,notificationFixture,h,searchContext:c,messageContext:m,nodes,text,find};
