const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'fakulteti-online.html'),'utf8');
const a=html.indexOf('  const renderMinimalProfile ='),b=html.indexOf('  const renderAcademicProgress =',a);
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!==false&&x!=null)});
const nodes=t=>t&&typeof t==='object'?[t,...t.children.flatMap(nodes)]:[];
const text=t=>t&&typeof t==='object'?t.children.map(text).join(''):String(t??'');
let checks=0;const ok=(value,message)=>{assert(value,message);checks++};
function fixture(extra={}){
 const actions=[],writes=[];const all={bookmarks:{c1:[2,2,-1,999,3.3],other:[1]},positions:{c1:{page:1,at:123}}};
 const c=vm.createContext({React:{createElement:h},uiLanguage:'sq',BRANCHES:[{id:'psych',label:'Psikologji'}],branchId:'psych',yr:{label:'Viti II'},yearId:2,
 facultyContext:{hasFreeRooms:true,faculty:{label:'Fakulteti Filozofik'}},window:{FakultetiManageAccountsButton:'AdminButton',matchMedia:()=>({matches:false})},
 enrolledCourses:[{id:'c1',title:'Psikologji sociale'},{id:'c2',title:'Metodat e hulumtimit'},{id:'c3',title:'Psikologji zhvillimore'}],done:['c1','c2'],studentGrades:{c1:8,c2:10,c3:9},pct:50,
 courseNotes:{c1:'Një shënim i ruajtur për ligjëratën.',other:'Shënim nga një lëndë tjetër'},courseBooks:{c1:{name:'Libri i psikologjisë',pages:10}},courseVideoFeed:[{id:'v1',title:'Video e ruajtur',url:'youtube'},{id:'p1',title:'Artikulli i ruajtur',kind:'article'}],likedVideoIds:['v1','p1','missing'],
 UNIT_BOOK_BM:'bookmarks',UNIT_BOOK_POS:'positions',unitReadJson:key=>all[key]||{},unitReadSave:(key,value)=>writes.push([key,JSON.parse(JSON.stringify(value))]),
 studentName:'Arta',studentFullName:'Arta Hoxha',profilePhoto:'',profileInitials:'AH',isEditingName:false,profileNeedsRealName:false,profileNameChecking:false,
 profileNameRequestRef:{current:0},profilePhotoInputRef:{current:{click:()=>actions.push('photo')}},profileDraft:{firstName:'Arta',lastName:'Hoxha',nickname:'Arta'},
 getStudentCardData:()=>({number:'FO-2026-001'}),onAcademicChange:()=>actions.push('faculty'),setView:view=>actions.push(view),openCourseSection:(course,tab)=>actions.push([course.id,tab]),openCourseVideoFeed:index=>actions.push(['story',index]),
 setStudentCardSide:side=>actions.push(['card-side',side]),setStudentCardOpen:open=>actions.push(['card-open',open]),openProfileEditor:()=>actions.push('editor'),setIsEditingName:value=>actions.push(['editing',value]),setProfileNameChecking(){},setProfileDraft(){},handleProfilePhoto(){},removeProfilePhoto(){},saveProfile:async()=>true,
 isDark:false,setIsDark:value=>actions.push(['dark',value]),onLanguageChange:lang=>actions.push(['lang',lang]),setNotificationPreviewOpen:value=>actions.push(['preview',value]),setNotificationCenterOpen:value=>actions.push(['notifications',value]),
 UnitInstallButton:'InstallButton',onLogout:()=>actions.push('logout'),exportBackup:()=>actions.push('export'),importBackup:()=>actions.push('import'),
 requestAnimationFrame:fn=>fn(),document:{getElementById:id=>({click:()=>actions.push(['click',id]),scrollIntoView:()=>actions.push(['scroll',id])})},...extra});
 vm.runInContext(html.slice(a,b)+'this.render=renderMinimalProfile;',c);
 return {c,actions,writes,render:()=>c.render()};
}
let f=fixture(),tree=f.render(),list=nodes(tree);
const button=(t,label)=>nodes(t).find(n=>n.type==='button'&&text(n)===label);
const fold=(t,label)=>nodes(t).find(n=>n.type==='details'&&text(n.children.find(c=>c?.type==='summary')).startsWith(label));
const section=(t,label)=>nodes(t).find(n=>n.type==='section'&&n.children.some(c=>c?.props?.className?.includes('profile-section-label')&&text(c)===label));
ok(tree.children[0].props.className.includes('profile-overview'),'identity first');ok(text(tree.children[0]).includes('Arta Hoxha'),'full name leads profile');
ok(list.find(n=>n.props.className?.includes('profile-overview-edit')).props['aria-label']==='Ndrysho profilin','icon editor keeps an accessible name');
ok(tree.children[1].props.className.includes('profile-student-card'),'student card immediately after identity');
ok(tree.children[2].props.className.includes('profile-progress-link'),'progress immediately after card');
ok(text(tree.children[2]).includes('2 provime · Mesatarja 9.00'),'average uses completed passing grades only');ok(text(tree.children[2]).includes('50%'),'progress retained');
ok(section(tree,'Studimi im')&&section(tree,'Shërbimet studentore')&&section(tree,'Cilësimet'),'three compact main sections');
ok(fold(tree,'Shënimet e mia').props.open===undefined,'notes collapsed initially');ok(fold(tree,'Materialet e ruajtura').props.open===undefined,'saved list collapsed initially');
ok(text(fold(tree,'Shënimet e mia')).includes('Një shënim i ruajtur'),'own course notes present');ok(!text(tree).includes('Shënim nga një lëndë tjetër'),'other course notes omitted');
ok(text(fold(tree,'Materialet e ruajtura')).includes('Faqja 2'),'saved book page present');ok(nodes(fold(tree,'Materialet e ruajtura')).filter(n=>n.type==='button').length===3,'deduplicate bookmarks and omit stale saved IDs');
ok(f.actions.length===0&&f.writes.length===0,'render never changes account data');
button(tree,'Lëndët e mia3').props.onClick();ok(f.actions.at(-1)==='courses');
button(tree,'Psikologji socialeNjë shënim i ruajtur për ligjëratën.').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["c1","notes"]','note opens its course');
button(tree,'Libri i psikologjisëFaqja 2 · Psikologji sociale').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["c1","read"]');ok(f.writes[0][1].c1.page===2&&f.writes[0][1].c1.at===123,'bookmark opens the chosen page without replacing other saved position fields');
button(tree,'Artikulli i ruajturFotografi · Artikull').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["story",1]');
button(tree,'Video e ruajturVideo e ruajtur').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["story",0]');
button(tree,'Njoftimet').props.onClick();ok(JSON.stringify(f.actions.slice(-2))==='[["preview",false],["notifications",true]]');
button(tree,'Ndrysho të dhënat').props.onClick();ok(f.actions.includes('editor')&&JSON.stringify(f.actions.at(-1))==='["scroll","profile-edit"]');
button(tree,'Eksporto kopjen rezervë').props.onClick();ok(f.actions.at(-1)==='export');
button(tree,'Importo kopjen rezervë').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["click","profile-backup-import"]');
button(tree,'Tema e errët').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["dark",true]');button(tree,'GjuhaShqip').props.onClick();ok(JSON.stringify(f.actions.at(-1))==='["lang","en"]');button(tree,'Dil nga llogaria').props.onClick();ok(f.actions.at(-1)==='logout');
ok(nodes(section(tree,'Cilësimet')).some(n=>n.type==='AdminButton'),'admin access preserved inside settings');ok(list.some(n=>n.type==='InstallButton'),'install/download preserved');
for(const title of ['Artikujt','Librat dhe skriptat','Grupet e studimit','Provimet e vjetra','Mentorimi','Bursa','Banesa dhe cimerë','Linjat e autobusit','Sallat e lira (Fakulteti Filozofik)','Harta e kampusit','Zbritjet studentore','Portofoli dhe praktikat','Të drejtat dhe statuti','Kurrikula e padukshme'])ok(button(tree,title),title+' still accessible');
f=fixture({done:['c1','c2'],studentGrades:{c1:5,c2:'invalid'},courseNotes:{},courseBooks:{},likedVideoIds:[]});tree=f.render();ok(text(tree).includes('Mesatarja —'),'invalid grades never become a fake average');ok(text(tree).includes('Shënimet që shkruan te lëndët shfaqen këtu.'));ok(text(tree).includes('Fotot, videot dhe faqeshënuesit e ruajtur shfaqen këtu.'));
f=fixture({window:{FakultetiApprovals:{canView:view=>['settings','freerooms'].includes(view),can:()=>false}},facultyContext:{hasFreeRooms:true,faculty:{label:'Fakulteti Filozofik'}}});tree=f.render();ok(!section(tree,'Studimi im'),'restricted account has no study links');ok(!button(tree,'Njoftimet'),'restricted account has no notification entry');ok(button(tree,'Sallat e lira (Fakulteti Filozofik)'),'rooms-only access retained');ok(nodes(tree).find(n=>n.props.className?.includes('profile-progress-link')).props['data-access-hidden']==='true','existing progress permission retained');
f=fixture({courseNotes:null,courseBooks:null,studentGrades:null});tree=f.render();ok(text(tree).includes('Mesatarja —'),'missing local grades remain empty');ok(fold(tree,'Shënimet e mia'),'missing notes do not prevent the profile from opening');
f=fixture({uiLanguage:'en',isEditingName:true});tree=f.render();ok(section(tree,'My studies')&&button(tree,'Notifications'));ok(nodes(tree).some(n=>n.type==='form'&&n.props.id==='profile-edit'),'editing form preserved');
for(const file of fs.existsSync(path.join(root,'github-publish'))?['github-publish/index.html','github-publish/fakulteti-online.html']:['index.html'])ok(fs.readFileSync(path.join(root,file)).equals(fs.readFileSync(path.join(root,'fakulteti-online.html'))));
console.log(`PASS: ${checks} profile structure, own notes/saves, grades, navigation, settings, permissions and mirror checks.`);
