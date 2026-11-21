const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'fakulteti-online.html'),'utf8');
const a=html.indexOf('  const renderMinimalProfile ='),b=html.indexOf('  const renderAcademicProgress =',a);
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!==false&&x!=null)});
const nodes=t=>t&&typeof t==='object'?[t,...t.children.flatMap(nodes)]:[];
const text=t=>t&&typeof t==='object'?t.children.map(text).join(''):String(t??'');
let checks=0;const ok=(value,message)=>{assert(value,message);checks++};
function fixture(extra={}){
 const actions=[],writes=[];const all={bookmarks:{c1:[2,2,-1,999,3.3],other:[1]},positions:{c1:{page:1,at:123}}};
 const c=vm.createContext({React:{createElement:h,Fragment:'Fragment'},androidNativeReady:false,view:'settings',uiLanguage:'sq',BRANCHES:[{id:'psych',label:'Psikologji'}],branchId:'psych',yr:{label:'Viti II'},yearId:2,
 facultyContext:{hasFreeRooms:true,faculty:{label:'Fakulteti Filozofik'}},window:{FakultetiManageAccountsButton:'AdminButton',matchMedia:()=>({matches:false})},
 enrolledCourses:[{id:'c1',title:'Psikologji sociale'},{id:'c2',title:'Metodat e hulumtimit'},{id:'c3',title:'Psikologji zhvillimore'}],done:['c1','c2'],studentGrades:{c1:8,c2:10,c3:9},pct:50,
 courseNotes:{c1:'Një shënim i ruajtur për ligjëratën.',other:'Shënim nga një lëndë tjetër'},courseBooks:{c1:{name:'Libri i psikologjisë',pages:10}},courseVideoFeed:[{id:'v1',title:'Video e ruajtur',url:'youtube'},{id:'p1',title:'Artikulli i ruajtur',kind:'article'}],likedVideoIds:['v1','p1','missing'],
 UNIT_BOOK_BM:'bookmarks',UNIT_BOOK_POS:'positions',unitReadJson:key=>all[key]||{},unitReadSave:(key,value)=>writes.push([key,JSON.parse(JSON.stringify(value))]),
 studentName:'Arta',studentFullName:'Arta Hoxha',profilePhoto:'',profileInitials:'AH',isEditingName:false,profileNeedsRealName:false,profileNameChecking:false,
 profileNameRequestRef:{current:0},profilePhotoInputRef:{current:{click:()=>actions.push('photo')}},profileDraft:{firstName:'Arta',lastName:'Hoxha',nickname:'Arta'},
 getStudentCardData:()=>({number:'FO-2026-001'}),onAcademicChange:()=>actions.push('faculty'),setView:view=>actions.push(view),goBackOr:view=>actions.push(['back',view]),openCourseSection:(course,tab)=>actions.push([course.id,tab]),openCourseVideoFeed:index=>actions.push(['story',index]),
 setStudentCardSide:side=>actions.push(['card-side',side]),setStudentCardOpen:open=>actions.push(['card-open',open]),openProfileEditor:()=>actions.push('editor'),setIsEditingName:value=>actions.push(['editing',value]),setProfileNameChecking(){},setProfileDraft(){},handleProfilePhoto(){},removeProfilePhoto(){},saveProfile:async()=>true,
 isDark:false,setIsDark:value=>actions.push(['dark',value]),onLanguageChange:lang=>actions.push(['lang',lang]),setNotificationPreviewOpen:value=>actions.push(['preview',value]),setNotificationCenterOpen:value=>actions.push(['notifications',value]),
 UnitInstallButton:'InstallButton',onLogout:()=>actions.push('logout'),exportBackup:()=>actions.push('export'),importBackup:()=>actions.push('import'),
 requestAnimationFrame:fn=>fn(),document:{getElementById:id=>({click:()=>actions.push(['click',id]),scrollIntoView:()=>actions.push(['scroll',id])})},...extra});
 vm.runInContext(html.slice(a,b)+'this.render=renderMinimalProfile;',c);
 return {c,actions,writes,render:()=>c.render()};
}

const button=(t,label)=>nodes(t).find(n=>n.type==='button'&&text(n)===label);
const aria=(t,label)=>nodes(t).find(n=>n.type==='button'&&n.props['aria-label']===label);
const cls=(t,name)=>nodes(t).find(n=>n.props.className?.split(' ').includes(name));
(async()=>{
let f=fixture(),tree=f.render();
ok(text(cls(tree,'profile-native-identity')).includes('Arta Hoxha'),'full identity retained');
ok(!nodes(tree).some(n=>n.type==='details'||n.type==='form'),'home has no nested accordions or editor');
ok(text(cls(tree,'profile-progress-link')).includes('2 provime · Mesatarja 9.00'),'average uses completed passing grades');
ok(text(cls(tree,'profile-progress-link')).includes('50%'),'progress retained');
const flat=nodes(tree);ok(flat.indexOf(cls(tree,'profile-student-card'))<flat.indexOf(cls(tree,'profile-progress-link')),'progress follows card');
ok(!text(tree).includes('Një shënim i ruajtur'),'notes stay on dedicated page');
ok(!button(tree,'Tema e errët'),'settings stay on dedicated page');
ok(f.actions.length===0&&f.writes.length===0,'render does not mutate local data');
button(tree,'Lëndët e mia3').props.onClick();ok(f.actions.at(-1)==='courses');
button(tree,'Shënimet e mia1').props.onClick();ok(f.actions.at(-1)==='profile-notes');
button(tree,'Materialet e ruajtura3').props.onClick();ok(f.actions.at(-1)==='profile-saved');
button(tree,'Ndrysho profilin').props.onClick();ok(f.actions.at(-1)==='editor');
aria(tree,'Cilësimet').props.onClick();ok(f.actions.at(-1)==='profile-settings');
button(tree,'Kartela e studentitFO-2026-001').props.onClick();ok(JSON.stringify(f.actions.slice(-2))==='[["card-side","front"],["card-open",true]]');
f=fixture({view:'profile-notes'});tree=f.render();
ok(text(tree).includes('Një shënim i ruajtur'),'own notes present');ok(!text(tree).includes('Shënim nga një lëndë tjetër'),'unknown course notes omitted');
button(tree,'Psikologji socialeNjë shënim i ruajtur për ligjëratën.').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["c1","notes"]');
aria(tree,'Kthehu').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["back","settings"]');
f=fixture({view:'profile-saved'});tree=f.render();
ok(nodes(tree).filter(n=>n.type==='button').length===4,'only 3 valid unique saves plus back');
button(tree,'Libri i psikologjisëFaqja 2 · Psikologji sociale').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["c1","read"]');ok(f.writes[0][1].c1.page===2&&f.writes[0][1].c1.at===123,'bookmark preserves other position fields');
button(tree,'Artikulli i ruajturFotografi · Artikull').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["story",1]');
button(tree,'Video e ruajturVideo e ruajtur').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["story",0]');
f=fixture({view:'profile-resources'});tree=f.render();
for(const title of ['Artikujt','Librat dhe skriptat','Grupet e studimit','Provimet e vjetra','Mentorimi','Bursa','Banesa dhe cimerë','Linjat e autobusit','Sallat e lira (Fakulteti Filozofik)','Harta e kampusit','Zbritjet studentore','Portofoli dhe praktikat','Të drejtat dhe statuti','Kurrikula e padukshme'])ok(button(tree,title),title+' still accessible');
button(tree,'Sallat e lira (Fakulteti Filozofik)').props.onClick();ok(f.actions.at(-1)==='freerooms');
f=fixture({view:'profile-settings'});tree=f.render();
button(tree,'Njoftimet').props.onClick();ok(JSON.stringify(f.actions.slice(-2))==='[["preview",false],["notifications",true]]');
button(tree,'Tema e errët').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["dark",true]');
button(tree,'GjuhaShqip').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["lang","en"]');
button(tree,'Llogaria dhe të dhënat').props.onClick();ok(f.actions.at(-1)==='profile-account');
button(tree,'Dil nga llogaria').props.onClick();ok(f.actions.at(-1)==='logout');
ok(nodes(tree).some(n=>n.type==='AdminButton'),'admin management preserved');ok(nodes(tree).some(n=>n.type==='InstallButton'),'APK/install preserved');
f=fixture({view:'profile-settings',androidNativeReady:true,window:{fakultetiAndroid:{widgetsSupported:true,send:command=>f.actions.push(command)}}});tree=f.render();button(tree,'Widget-et e telefonit').props.onClick();ok(f.actions.at(-1)==='widget-picker','native widget placement entry works');
f=fixture({view:'profile-account'});tree=f.render();
button(tree,'Të dhënat personale').props.onClick();ok(f.actions.at(-1)==='editor');
button(tree,'Fakulteti dhe drejtimi').props.onClick();ok(f.actions.at(-1)==='faculty');
button(tree,'Eksporto kopjen rezervë').props.onClick();ok(f.actions.at(-1)==='export');
button(tree,'Importo kopjen rezervë').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["click","profile-backup-import"]');
for(const valid of [false,true]){
 f=fixture({view:'profile-edit',saveProfile:async()=>valid});tree=f.render();const form=nodes(tree).find(n=>n.type==='form');
 ok(nodes(form).filter(n=>n.type==='input'&&n.props.required).length===2,'first and last name remain required');
 await form.props.onSubmit({});ok(f.actions.some(a=>Array.isArray(a)&&a[0]==='back')===valid,'only successful validation returns');
}
f=fixture({view:'profile-edit'});tree=f.render();button(tree,'Anulo').props.onClick();ok(f.c.profileNameRequestRef.current===1);ok(JSON.stringify(f.actions.at(-1))==='["back","settings"]');
f=fixture({profileNeedsRealName:true});tree=f.render();ok(nodes(tree).some(n=>n.type==='form'),'missing real identity forces editor');ok(!button(tree,'Anulo')&&!aria(tree,'Kthehu'),'required identity cannot be dismissed');
f=fixture({studentGrades:{c1:5,c2:'invalid'},courseNotes:null,courseBooks:null});tree=f.render();ok(text(tree).includes('Mesatarja —'),'invalid grades never create average');
for(const [view,needle] of [['profile-notes','Ende nuk ke shënime'],['profile-saved','Ende asgjë e ruajtur']]){f=fixture({view,courseNotes:{},courseBooks:{},likedVideoIds:[]});ok(text(f.render()).includes(needle),'empty state '+view);}
const restricted={canView:view=>['settings','freerooms'].includes(view),can:()=>false};
f=fixture({window:{FakultetiApprovals:restricted}});tree=f.render();ok(!button(tree,'Shënimet e mia1'),'rooms-only home hides studies');ok(cls(tree,'profile-progress-link').props['data-access-hidden']==='true');
f=fixture({view:'profile-resources',window:{FakultetiApprovals:restricted}});tree=f.render();ok(button(tree,'Sallat e lira (Fakulteti Filozofik)'));ok(!button(tree,'Artikujt'),'resources honor individual permissions');
f=fixture({view:'profile-settings',window:{FakultetiApprovals:restricted}});tree=f.render();ok(!button(tree,'Njoftimet'),'restricted notifications hidden');
f=fixture({uiLanguage:'en',view:'profile-edit'});tree=f.render();ok(button(tree,'Cancel')&&button(tree,'Save'),'editor translated');
const approvalSource=fs.readFileSync(path.join(root,'assets/account-approvals.js'),'utf8');
const routes=approvalSource.match(/  const ROUTES = .*;/)[0];
const ca=approvalSource.indexOf('  function can(section)'),cb=approvalSource.indexOf('\n  function ',approvalSource.indexOf('  function canView(',ca)+10);
const scope=vm.createContext({currentPolicy:{status:'approved',role:'student',permissions:['rooms']}});
vm.runInContext(routes+'\n'+approvalSource.slice(ca,cb)+'this.allowed=canView;',scope);
for(const route of ['settings','profile-edit','profile-settings','profile-account','profile-resources'])ok(scope.allowed(route),'rooms account can manage '+route);
for(const route of ['profile-notes','profile-saved'])ok(!scope.allowed(route),'rooms account cannot open '+route);
scope.currentPolicy.permissions=['articles'];ok(scope.allowed('profile-saved')&&!scope.allowed('profile-notes'),'article permissions independently preserved');
scope.currentPolicy.status='pending';for(const route of ['profile-edit','profile-settings','profile-account','profile-notes','profile-saved'])ok(!scope.allowed(route),'pending denied '+route);
const nav=vm.createContext({window:{scrollY:120,scrollTo(){}},useCallback:fn=>fn,navCtxRef:{current:{view:'settings',studentTab:'exams'}},navStackRef:{current:[]},setViewRaw:view=>{nav.navCtxRef.current.view=view},setStudentTab(){},setSidebarOpen(){},setTimeout:fn=>fn()});
const navStart=html.indexOf('  const setView = useCallback('),navEnd=html.indexOf('  useEffect(',navStart);
const backStart=html.indexOf('  const goBackOr = fallback =>'),backEnd=html.indexOf('  const [selectedPlanDate',backStart);
vm.runInContext(html.slice(navStart,navEnd)+html.slice(backStart,backEnd)+'this.navigate=setView;this.back=goBackOr;',nav);
for(const route of ['profile-settings','profile-account','profile-edit'])nav.navigate(route);
for(const expected of ['profile-account','profile-settings','settings']){nav.back('settings');ok(nav.navCtxRef.current.view===expected,'real history returns to '+expected);}
ok(html.includes("view === 'settings' || view.startsWith('profile-') ? renderSettingsView()"),'child profile routes render in main app');
ok((html.match(/view\.startsWith\('profile-'\)/g)||[]).length>=5,'profile tab stays selected on child routes');
for(const file of fs.existsSync(path.join(root,'github-publish'))?['github-publish/index.html','github-publish/fakulteti-online.html']:['index.html'])ok(fs.readFileSync(path.join(root,file)).equals(fs.readFileSync(path.join(root,'fakulteti-online.html'))));
console.log('PASS: '+checks+' profile pages, own notes/saves, validation, navigation, permissions and mirror checks.');
})().catch(error=>{console.error(error);process.exitCode=1});
