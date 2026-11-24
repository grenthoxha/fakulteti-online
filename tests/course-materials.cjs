const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'fakulteti-online.html'),'utf8');
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)}),nodes=t=>t&&typeof t==='object'?[t,...t.children.flatMap(nodes)]:[],text=t=>t&&typeof t==='object'?t.children.map(text).join(''):String(t??'');
let checks=0;const ok=(value,label)=>{assert(value,label);checks++;};
function context(protocol='file:') {
 const requests=[],listeners=new Map(),React={createElement:h,Fragment:'Fragment'},body={style:{overflow:'auto'}};
 const document={currentScript:{src:protocol==='file:'?'file:///C:/faculty/assets/course-materials.js':'https://grenthoxha.github.io/fakulteti-online/assets/course-materials.js'},body,createElement:()=>({remove(){}}),head:{appendChild:script=>requests.push(script)}};
 const window={React,navigator:{onLine:true},addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 const c=vm.createContext({window,document,URL,Map,Promise,setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync(path.join(root,'assets/course-materials-index.js'),'utf8'),c);
 vm.runInContext(fs.readFileSync(path.join(root,'assets/course-material-reader.js'),'utf8'),c);
 vm.runInContext(fs.readFileSync(path.join(root,'assets/course-materials.js'),'utf8'),c);
 return {c,React,window,requests,listeners,body,api:window.FakultetiCourseMaterials};
}
function mount(env,Component,props) {
 let cursor=0;const hooks=[],cleanups=[];
 return {render(){cursor=0;Object.assign(env.React,{useState:initial=>{const k=cursor++;if(!(k in hooks))hooks[k]={value:typeof initial==='function'?initial():initial};return[hooks[k].value,value=>{hooks[k].value=typeof value==='function'?value(hooks[k].value):value;}];},useMemo:fn=>fn(),useEffect:(fn,deps)=>{const k=cursor++;if(!(k in hooks)||deps.some((v,i)=>v!==hooks[k].deps[i])){hooks[k]={deps};const cleanup=fn();if(cleanup)cleanups.push(cleanup);}}});return Component(props);},close(){for(const fn of cleanups.reverse())fn();}};
}
const cls=(tree,name)=>nodes(tree).find(n=>n.props.className?.split(' ').includes(name));
const tick=()=>new Promise(setImmediate);
(async()=>{
 const env=context(),{api,c}=env,index=env.window.FakultetiCourseMaterialsIndex.courses;
 ok(Object.keys(index).length===33,'all 33 course folders have a mapping');ok(env.requests.length===0,'library does not download all catalogues at startup');
 const first=api.load('up_psi_03_01'),again=api.load('up_psi_03_01');ok(first===again&&env.requests.length===1,'only the chosen course loads, with concurrent requests deduplicated');
 ok(env.requests[0].src.startsWith('file:///C:/faculty/assets/course-materials/up_psi_03_01.js'),'local-file app loads catalogues using scripts rather than blocked file fetch');
 vm.runInContext(fs.readFileSync(path.join(root,'assets/course-materials/up_psi_03_01.js'),'utf8'),c);const data=await first;ok(data.files.length===index.up_psi_03_01.count,'catalogue completes registration');
 ok(await api.load('up_psi_03_01')===data&&env.requests.length===1,'reopening a course reuses its catalogue');ok(await api.load('up_psi_missing')===null,'unknown courses never load unrelated material');
 const all=[];for(const id of Object.keys(index)){
  let loaded;const original=api.register;api.register=value=>{loaded=value;original(value);};vm.runInContext(fs.readFileSync(path.join(root,'assets/course-materials/'+id+'.js'),'utf8'),c);api.register=original;
  ok(loaded.courseId===id&&loaded.semester===index[id].semester,'course and semester match '+id);
  ok(loaded.files.length===index[id].count,'file count matches '+id);
  ok(loaded.files.every(f=>/^https:\/\/fakulteti-aprovimet\.personalebuds\.chatgpt\.site\/api\/materials\/[a-f0-9]{32}\.[a-z0-9]{1,8}\?download=1$/.test(f.url)&&/^[a-f0-9]{64}$/.test(f.sha256)&&/^[a-f0-9]{32}\.(?:pdf|jpg|json)$/.test(f.preview.path)&&['pdf','image','text','table','archive'].includes(f.preview.type)&&!f.url.includes('ouid=')&&Number.isFinite(f.size)&&f.size>=0&&api.categories[f.category]),'app original URLs, hashes and native previews valid '+id);
  const entries=api.buildEntries(loaded.files),flat=entries.flatMap(e=>e.files);ok(flat.length===loaded.files.length&&new Set(flat.map(f=>f.id)).size===flat.length,'grouping keeps every file exactly once '+id);all.push(...loaded.files);
  ok(fs.readFileSync(path.join(root,'github-publish/assets/course-materials/'+id+'.js'),'utf8')===fs.readFileSync(path.join(root,'assets/course-materials/'+id+'.js'),'utf8'),'course catalogue mirror matches '+id);
 }
 ok(all.length===1335&&new Set(all.map(f=>f.id)).size===1335,'all 1335 learning files are covered once');
 ok(all.every(f=>f.title!=='.DS_Store'&&f.title!=='WhatsApp Image 2026-04-15 at 21.21.51.jpeg'),'technical files and verified repeated advertisement excluded');
 ok(index.up_psi_04_02.semester===4&&index.up_psi_05_06.semester===5&&index.up_psi_04_02.sourceUrl.includes('/materiale-psikologji-2026-s4/up_psi_04_02-')&&index.up_psi_05_06.sourceUrl.includes('/materiale-psikologji-2026-s5/up_psi_05_06-'),'CBT and ethics mapped to proper semester packages');
 ok(!JSON.stringify(index).includes('drive.google.com')&&all.every(f=>!JSON.stringify(f).includes('google.com')),'catalogues have no Drive viewer or download links');
 ok(Object.values(index).filter(c=>c.count).length===29,'29 populated and four empty course folders are represented');
 const guard=context();const blocked={...data,files:[{...data.files[0],id:'1rbGp6CTqMxiUh7qr9f0kzxm7FbfPwe1f'},{...data.files[0],id:'otherwise_valid_id',sha256:'6a8627e4461c0fb909b3a5b0c97411ea6ee150b191942f17e6404bf05d4178f8'}]};guard.api.register(blocked);ok((await guard.api.load(data.courseId)).files.length===0,'verified ad IDs and repeated ad binaries cannot re-enter the library');
 const entries=api.buildEntries(data.files);ok(entries.some(e=>e.kind==='gallery'&&e.files.length>=3),'exam photos form a gallery');
 ok(api.filterEntries(entries,'notes','agresioni').some(e=>e.title.toLowerCase().includes('agresion')),'search finds original notes');
 ok(api.filterEntries(entries,'literature','').every(e=>e.category==='literature'),'category filter restricts resources');
 ok(!api.previewUrl({id:'../../javascript:alert(1)'}),'invalid IDs cannot become frame URLs');
 ok(api.buildEntries([{id:'abcdefghijk',title:'PsikoterapisÃ« Jungiane (1).docx',category:'notes',mime:'application/msword'}])[0].title==='Psikoterapisë Jungiane','display names repair source encoding and copy suffixes without renaming originals');
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const screen=mount(env,api.Section,{courseId:'up_psi_03_01',storage,Portal:'Portal'});let tree=screen.render();await tick();tree=screen.render();
 ok(nodes(tree).filter(n=>n.props.className==='cl-row').length<=5,'initial list is bounded on phones');ok(!nodes(tree).some(n=>n.type==='iframe'||n.type==='img'),'documents and photos wait until opened');
 const search=nodes(tree).find(n=>n.type==='input');search.props.onChange({target:{value:'agresioni'}});tree=screen.render();ok(nodes(tree).some(n=>n.props.className==='cl-row'&&text(n).toLowerCase().includes('agresion')),'typing filters the visible list');
 nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:''}});tree=screen.render();nodes(tree).find(n=>n.type==='button'&&text(n)==='Teste').props.onClick();tree=screen.render();
 for(let i=0;i<8&&!nodes(tree).some(n=>n.props.className==='cl-row'&&text(n).includes('foto'))&&cls(tree,'cl-more');i++){cls(tree,'cl-more').props.onClick();tree=screen.render();}
 const gallery=nodes(tree).find(n=>n.props.className==='cl-row'&&text(n).includes('foto'));ok(gallery,'test image album is reachable');gallery.props.onClick();tree=screen.render();const viewerNode=nodes(tree).find(n=>n.type===api.Viewer);
 ok(viewerNode&&viewerNode.props.selection.files.length>1,'gallery opens its original files');
 const viewer=mount(env,api.Viewer,viewerNode.props);let page=viewer.render();ok(!nodes(page).some(n=>n.type==='iframe')&&nodes(page).filter(n=>n.type===env.window.FakultetiMaterialReader.Reader).length===1,'exactly one native reader, without external embeds');ok(env.body.style.overflow==='hidden','reader locks background scrolling');
 ok(nodes(page).find(n=>n.type===env.window.FakultetiMaterialReader.Reader).props.file.id===viewerNode.props.selection.files[0].id,'reader uses the selected file');
 nodes(page).find(n=>n.props['aria-label']==='Fotoja tjetër').props.onClick();page=viewer.render();ok(nodes(page).find(n=>n.type===env.window.FakultetiMaterialReader.Reader).props.file.id===viewerNode.props.selection.files[1].id,'next photo changes the native image');
 ok(store.size===1,'recent item is saved through supplied account storage');viewer.close();ok(env.body.style.overflow==='auto'&&env.listeners.size===0,'closing reader restores scroll and listeners');
 const another=new Map(),otherScreen=mount(env,api.Section,{courseId:'up_psi_03_01',storage:{getItem:k=>another.get(k),setItem:(k,v)=>another.set(k,v)},Portal:'Portal'});otherScreen.render();ok(!cls(otherScreen.render(),'cl-recent'),'another account does not inherit recent items');otherScreen.close();screen.close();
 const zip=all.find(file=>file.preview.type==='archive');ok(zip,'SPSS reports are included with a native content preview');const archive=mount(env,api.Viewer,{selection:{id:'zip',files:[zip]},onVisit(){},onClose(){},Portal:'Portal'});page=archive.render();ok(!nodes(page).some(n=>n.type==='iframe')&&nodes(page).some(n=>n.type===env.window.FakultetiMaterialReader.Reader),'specialized files use the native reader');archive.close();
 const off=context();off.window.navigator.onLine=false;const offline=mount(off,off.api.Viewer,{selection:{id:'doc',files:[data.files[0]]},onVisit(){},onClose(){},Portal:'Portal'});page=offline.render();ok(text(page).includes('nevojitet internet')&&!nodes(page).some(n=>n.type==='iframe'),'offline state is honest and does not promise unavailable files');offline.close();
 const failed=context('https:');const failure=failed.api.load('up_psi_03_01');failed.requests[0].onerror();await assert.rejects(failure);ok(failed.requests.length===1,'loader failure rejects cleanly');const retry=failed.api.load('up_psi_03_01');ok(failed.requests.length===2,'failed catalogue can be retried');vm.runInContext(fs.readFileSync(path.join(root,'assets/course-materials/up_psi_03_01.js'),'utf8'),failed.c);await retry;
 const integration=vm.createContext({window:{FakultetiCourseMaterials:api},React:{createElement:h},unitStorage:storage,ModalPortal:'Portal'});vm.runInContext(html.slice(html.indexOf('  const renderCourseMaterials ='),html.indexOf('  const renderCourseStudyView ='))+'this.render=renderCourseMaterials;',integration);const integrated=integration.render({id:'up_psi_03_01'});
 ok(integrated.type===api.Section&&integrated.props.storage===storage&&integrated.props.Portal==='Portal','course passes the account store and existing focus-managed portal');ok(integration.render({id:'filo_social_work_1'})===null,'other directions do not receive psychology course materials');
 for(const file of ['course-materials.js','course-materials.css','course-materials-index.js','course-material-reader.js','course-material-reader.css','vendor/pdfjs/VERSION.txt','vendor/pdfjs/LICENSE'])ok(fs.readFileSync(path.join(root,'assets',file),'utf8')===fs.readFileSync(path.join(root,'github-publish/assets',file),'utf8'),'asset mirror matches '+file);
 console.log(`PASS: ${checks} course library checks — complete mapping, lazy loading, filters, native previews, galleries, permissions and account scope.`);
})();
