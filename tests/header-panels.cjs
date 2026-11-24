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
 notificationPreviewOpen:true,notificationCenterOpen:false,notificationTab:'all',notificationSettingsOpen:false,notificationUnreadCount:2,groupMessageUnreadCount:0,renderClassPresidentHub:()=>h('section',{id:'class-president-hub'},'Group notices'),setNotificationSettingsOpen:value=>{c.notificationSettingsOpen=value;},
 notificationFeed:Array.from({length:6},(_,i)=>({id:String(i),group:i<3?'today':'week',title:'Title '+i,sub:'Detail '+i,time:'Sot',unread:i<2,action:()=>actions.push(['open',i])})),
 unitUiIcon:()=>null,UNIT_UI_ICONS:{},setNotificationPreviewOpen:v=>actions.push(['preview',v]),setNotificationCenterOpen:v=>actions.push(['center',v]),markNotificationsRead:v=>actions.push(['read',...v]),setNotificationTab:v=>actions.push(['tab',v]),setView:v=>actions.push(['view',v]),...extra});
 vm.runInContext(section('  const renderNotificationCenter =','  /* ── 12')+'this.render=renderNotificationCenter;',c);
 return {c,actions,render:()=>c.render()};
}
let f=notificationFixture(), t=f.render();
ok(find(t,'notification-screen'),'notifications fill the screen below app header');
ok(nodes(t).filter(n=>n.props.className?.includes('notification-row')).length===6,'bell opens all notifications directly');
ok(!nodes(t).some(n=>n.type==='Settings'),'reminder controls stay out of main notification list');
ok(!text(t).includes('Provo çdo 5 min'),'native demo stays out of main notification list');
nodes(t).find(n=>n.type==='button'&&text(n)==='Cilësimet e njoftimeve').props.onClick();t=f.render();
ok(nodes(t).some(n=>n.type==='Settings')&&text(t).includes('Provo çdo 5 min'),'settings open reminder controls and preserve demo functions');
ok(!nodes(t).some(n=>n.props.className?.includes('notification-row')),'settings are a separate screen');
nodes(t).find(n=>n.props['aria-label']==='Kthehu te njoftimet').props.onClick();t=f.render();
ok(nodes(t).filter(n=>n.props.className?.includes('notification-row')).length===6,'back restores notification list');
nodes(t).find(n=>n.props['aria-label']==='Mbyll njoftimet').props.onClick();
ok(JSON.stringify(f.actions)==='[["center",false],["preview",false]]','close exits current and legacy notification opening paths');
f.actions.length=0;find(t,'notification-row').props.onClick();
ok(JSON.stringify(f.actions)==='[["center",false],["preview",false],["read","0"],["open",0]]','item closes screen, marks read and navigates');
f=notificationFixture({notificationPreviewOpen:false,notificationCenterOpen:true});t=f.render();
ok(!nodes(t).some(n=>n.type==='Settings'),'full center opens with minimal list');
ok(!text(t).includes('Provo çdo 5 min'),'full center does not expose demo controls by default');
ok(nodes(t).filter(n=>n.props.className?.includes('notification-row')).length===6,'full center retains all items');
f=notificationFixture({notificationFeed:[]});ok(text(f.render()).includes('Nuk ka njoftime'),'notification empty state');
f=notificationFixture({notificationPreviewOpen:false,notificationCenterOpen:true,notificationTab:'group'});t=f.render();
ok(nodes(t).some(n=>n.props.id==='class-president-hub'),'group hub is available from main notifications');
ok(nodes(t).some(n=>n.props.role==='tab'&&n.props['aria-label']==='Nga grupi'),'full notification center has group destination');

// Presentation keeps specific video titles, dates and their original destinations.
let videoOpened=0;
f=notificationFixture({notificationFeed:[
 {id:'video_qa',group:'week',title:'Video e re',sub:'Si funksionon kujtesa · Psikologji',time:'Këtë javë',unread:true,action:()=>videoOpened++},
 {id:'deadline_qa',group:'today',title:'Dorëzimi i punimit',sub:'Kapitulli 2',time:'Sot, 14:00',action(){}}
]});t=f.render();
let videoRow=nodes(t).find(n=>n.props.key==='video_qa');
ok(text(find(videoRow,'notification-item-title'))==='Si funksionon kujtesa','video exposes its specific title instead of repeated generic heading');
ok(text(find(videoRow,'notification-item-detail'))==='Psikologji','video course remains visible separately');
ok(!find(videoRow,'notification-item-meta'),'duplicate group time is omitted from individual row');
ok(text(find(nodes(t).find(n=>n.props.key==='deadline_qa'),'notification-item-meta')).includes('14:00'),'meaningful deadline time remains visible');
videoRow.props.onClick();ok(videoOpened===1&&f.actions.some(a=>a[0]==='read'&&a[1]==='video_qa'),'restyled video retains read tracking and original destination');
f=notificationFixture({notificationFeed:[{id:'video_fallback',group:'week',title:'Video e re',sub:'Titull pa lëndë',time:'Këtë javë',action(){}}]});
ok(text(find(f.render(),'notification-item-title'))==='Titull pa lëndë','video without course retains its full title');

// Group announcements retain scope, read state and their original hub destination.
function groupFeed(extra={}) {
 const actions=[], writes=[];
 const entry=(id,props={})=>({done:false,item:{id,title:'Njoftim '+id,body:'Detaje',createdAt:'2026-11-24',scopeId:'psych_1',group:'Grupi 1',...props}});
 const state=vm.createContext({appNotifications:[{id:'schedule_1',title:'Ligjërata',detail:'08:00',action(){}}],sortedDeadlines:[],enrolledCourses:[],userAndCourseVideos:[],courseVideoFeed:[],isInstructorAccount:true,
 today:'2026-11-24',hubNoticesOn:true,isClassPresident:false,branchId:'psych',yearId:1,studentGroupId:'Grupi 1',UNIT_UI_ICONS:{calendar:'calendar'},notificationReadIds:[],groupMessageReadIds:[],unreadGroupMessageIds:new Set(['g1']),
 groupAnnouncementEntries:[entry('g1'),entry('old'),entry('other',{scopeId:'social_1'}),entry('g2',{group:'Grupi 2'}),{...entry('done'),done:true}],formatDateSq:d=>d,
 setNotificationReadIds:ids=>actions.push(['read',...ids]),setGroupMessageReadIds:ids=>actions.push(['group-read',...ids]),unitStorage:{setItem:(k,v)=>writes.push([k,v])},
 setNotificationPreviewOpen:v=>actions.push(['preview',v]),setGroupMessagesOpen:v=>actions.push(['messages',v]),setNotificationTab:v=>actions.push(['tab',v]),setNotificationCenterOpen:v=>actions.push(['center',v]),setHubOpenId:v=>actions.push(['hub',v]),...extra});
 vm.runInContext(section('  const notificationFeed =','  // Native notifications use')+'this.feed=notificationFeed;this.mark=markNotificationsRead;this.count=notificationUnreadCount;',state);
 return {state,actions,writes,feed:state.feed};
}
let gf=groupFeed();
ok(gf.feed.filter(n=>n.groupAnnouncementId).length===2,'bell includes only current programme and group announcements');
ok(!gf.feed.some(n=>n.groupAnnouncementId==='done'),'completed notices stay excluded');
ok(gf.state.count===2,'bell counts ordinary and group unread notices together');
ok(gf.feed.find(n=>n.groupAnnouncementId==='old').unread===false,'existing group read state survives move');
const groupItem=gf.feed.find(n=>n.groupAnnouncementId==='g1');
gf.state.mark([groupItem.id]);ok(gf.actions.some(a=>a[0]==='group-read'&&a[1]==='g1'),'reading main notification updates original group read state');
ok(gf.writes.some(w=>w[0]==='u_group_messages_read_v1'),'group read state remains persisted locally');
gf.actions.length=0;groupItem.action();
ok(JSON.stringify(gf.actions)==='[["preview",false],["messages",false],["tab","group"],["center",true],["hub","g1"]]','group notification opens original entry in main notification hub');
ok(groupFeed({hubNoticesOn:false}).feed.every(n=>!n.groupAnnouncementId),'group notification opt-out is preserved');
ok(groupFeed({hubNoticesOn:false,isClassPresident:true}).feed.some(n=>n.groupAnnouncementId),'class president retains access');

const searchActions=[];
const c=vm.createContext({React:{createElement:h,Fragment:'Fragment'},ModalPortal:'Portal',search:'Psikologji',searchFilter:'all',recentSearches:[],UNIT_UI_ICONS:{},unitUiIcon:()=>null,
 buildSearchGroups:()=>[{id:'courses',label:'Lëndët',items:[{key:'c1',title:'Psikologji',sub:'Kapituj',action:()=>searchActions.push('course')}]},{id:'notes',label:'Shënime',items:[]}],
 setSearch:v=>searchActions.push(['query',v]),setSearchFilter:v=>searchActions.push(['filter',v]),rememberSearch:()=>searchActions.push('remember'),closeSearchPage:()=>searchActions.push('close')});
vm.runInContext(section('  const renderHeaderSearchInput =','  /* ── 11')+'this.render=renderSearchPage;this.input=renderHeaderSearchInput;',c);t=c.render();
ok(find(t,'header-search-panel') && find(t,'header-quick-backdrop'),'search is a compact dismissible panel');
ok(!nodes(t).some(n=>n.props.className?.includes('inset-0')),'search no longer replaces whole screen');
ok(!nodes(t).some(n=>n.type==='input'),'results panel no longer duplicates header input');
const headerInput=c.input(), input=nodes(headerInput).find(n=>n.type==='input');
ok(input.props.autoFocus&&input.props.id==='unit-search-input','header input receives focus when opened');
ok(input.props.value==='Psikologji','header input retains query');
input.props.onChange({target:{value:'Etika'}});ok(searchActions.pop()[1]==='Etika','typing in header updates search');
input.props.onKeyDown({key:'Enter'});ok(searchActions.pop()==='remember','header Enter remembers search');
input.props.onKeyDown({key:'Escape'});ok(searchActions.pop()==='close','header Escape closes search');
ok(html.includes('searchOpen && renderHeaderSearchInput()'),'actual app header owns input renderer');
const appHeader=section('  }, /*#__PURE__*/React.createElement("header", {\r\n    className: `app-header','  }, view === \'course\'');
ok(appHeader.indexOf('app-header-identity')<appHeader.indexOf('searchOpen && renderHeaderSearchInput()'),'identity stays before expanded search');
ok(appHeader.indexOf('unit-brand-name')<appHeader.indexOf('searchOpen && renderHeaderSearchInput()'),'name remains next to logo during search');
ok(!html.includes('.app-header.is-searching > div:not(.header-search-heading)'),'search does not hide the identity block');
ok(html.includes('.app-header.is-searching > .app-header-actions { display: none!important; }'),'only action icons make room for expanded search');
nodes(t).find(n=>n.type==='button'&&text(n).includes('Kapituj')).props.onClick();
ok(JSON.stringify(searchActions)==='["remember","close","course"]','search remembers and opens actual result');
nodes(t).find(n=>n.type==='button'&&text(n)==='Lëndët · 1').props.onClick();
ok(searchActions.at(-1)[1]==='courses','search category filter retained');
find(t,'header-quick-backdrop').props;find(t,'header-quick-layer').props.onClick();
ok(searchActions.at(-1)==='close','outside tap closes search');
c.buildSearchGroups=()=>[];ok(text(c.render()).includes('Asnjë rezultat'),'search no-results state');
c.search='';ok(c.render()===null,'empty search opens only the light header field');
ok(nodes(headerInput).filter(n=>n.type==='button').length===1,'header field has a single close button');

const m=vm.createContext({React:{createElement:h},ModalPortal:'Portal',window:{FakultetiGroupMessages:{Screen:'LocalMessageScreen'}}});
vm.runInContext(section('const GroupMessagesPreview =','const dateKey =')+'this.render=GroupMessagesPreview;',m);
t=m.render({branchTitle:'Psikologji',yearTitle:'Viti I',language:'sq',onClose(){}});
ok(t.type==='LocalMessageScreen'&&t.props.Portal==='Portal','messages delegate to persisted local screen with focus-managed portal');
ok(t.props.branchTitle==='Psikologji'&&t.props.yearTitle==='Viti I','academic context is retained');
delete m.window.FakultetiGroupMessages;
t=m.render({onClose(){}});
ok(find(t,'header-quick-layer'),'module-load failure retains full screen below header');
ok(nodes(t).some(n=>n.props.role==='alert'),'module-load failure has a readable recovery message');

// One lock survives switching panels; viewport changes leave room for the keyboard.
const cssValues={}, listeners=new Map();let cleanup;
const style={overflow:'auto'}, rootStyle={setProperty:(k,v)=>cssValues[k]=v,removeProperty:k=>delete cssValues[k]};
const viewport={height:715,offsetTop:0,addEventListener:(k,v)=>listeners.set('viewport:'+k,v),removeEventListener:k=>listeners.delete('viewport:'+k)};
const lock=vm.createContext({notificationCenterOpen:false,notificationPreviewOpen:false,groupMessagesOpen:false,searchOpen:true,
 notificationBellRef:{current:{getBoundingClientRect:()=>({left:380,width:40,bottom:52})}},
 document:{body:{style},documentElement:{style:rootStyle},querySelector:()=>({getBoundingClientRect:()=>({bottom:64})})},
 window:{innerWidth:538,innerHeight:715,visualViewport:viewport,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},useEffect:fn=>cleanup=fn()});
vm.runInContext(section('  const headerPanelOpen =','  const [recentSearches,'),lock);
ok(style.overflow==='hidden','opening search locks background');
ok(cssValues['--header-quick-top']==='72px'&&cssValues['--header-quick-height']==='631px','panel starts below header');
ok(cssValues['--messages-screen-top']==='64px'&&cssValues['--messages-screen-height']==='651px','messages fill all space below header without a gap');
ok(cssValues['--notification-anchor-top']==='64px'&&cssValues['--notification-anchor-x']==='272px','notification pointer follows actual bell center');
viewport.height=390;listeners.get('viewport:resize')();
ok(cssValues['--header-quick-height']==='306px','keyboard reduces panel height');
ok(cssValues['--messages-screen-height']==='326px','full messages screen resizes above the keyboard');
ok(cssValues['--notification-anchor-height']==='314px','anchored popup responds to keyboard');
cleanup();ok(style.overflow==='auto'&&listeners.size===0,'closing restores original scroll and removes viewport listeners');
ok(Object.keys(cssValues).length===0,'viewport styles cleaned up');
const opening=[];
const open=vm.createContext(Object.fromEntries(['NotificationPreviewOpen','NotificationCenterOpen','GroupMessagesOpen','SearchOpen'].map(name=>['set'+name,v=>opening.push([name,v])])));
vm.runInContext(section('  const openHeaderSearch =','  const headerPanelOpen =')+'openHeaderSearch();',open);
ok(JSON.stringify(opening)==='[["NotificationPreviewOpen",false],["NotificationCenterOpen",false],["GroupMessagesOpen",false],["SearchOpen",true]]','search excludes other header panels');

for(const name of ['github-publish/index.html','github-publish/fakulteti-online.html']) ok(fs.readFileSync(path.join(root,name),'utf8')===html,'HTML mirror matches');
console.log(`PASS: ${checks} header panel checks — notification actions, full center, search navigation/filters, chat entry, and mirrors.`);
module.exports={html,section,notificationFixture,h,searchContext:c,messageContext:m,nodes,text,find};
