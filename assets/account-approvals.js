/* Signed approval access. Online accounts/profile sync excludes all learning data and private keys. */
(function (root) {
  'use strict';
  const SERVICE = 'https://fakulteti-aprovimet.personalebuds.chatgpt.site';
  const ADMIN_EMAIL = 'grent@gmail.com';
  const SECTIONS = Object.freeze({ home:'Kreu dhe detyrat', schedule:'Orari', courses:'Lëndët dhe mësimi', exams:'Provimet dhe notat', services:'Shërbimet studentore', rooms:'Sallat e lira', messages:'Mesazhet dhe njoftimet', articles:'Artikujt dhe videot' });
  const ROUTES = { home:'home', week:'schedule', courses:'courses', course:'courses', session:'courses', 'topic-explain':'courses', library:'courses', student:'exams', exam:'exams', 'mock-exam':'exams', 'mock-analysis':'exams', 'final-prep':'exams', 'grade-calculator':'exams', 'archive-exam':'exams', pastexams:'exams', 'academic-progress':'exams', certificate:'exams', examclash:'exams', freerooms:'rooms', articles:'articles', videos:'articles', studentservices:'services', housing:'services', books:'services', campusguide:'services', career:'services', invisiblecurriculum:'services', scholarship:'services', scholarshiptarget:'services', seniortips:'services', studentperks:'services', studentrights:'services', studygroups:'services', tutoring:'services', urbantraffic:'services' };
  const KEYS = { identity:'u_approval_device_v1', cache:'u_approval_policy_v1', profile:'u_approval_profile_v1' };
  const accounts = root.FakultetiLocalAccounts, storage = accounts.storage;
  const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,'0')).join('');
  const utf8 = new TextEncoder();
  let identityPromise, currentPolicy = null, checking = null;
  const read = key => { try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; } };
  const changed = policy => { currentPolicy = policy; root.dispatchEvent(new CustomEvent('fakulteti:approval', { detail:policy })); return policy; };
  async function identity() {
    if (!identityPromise) {
      const create = async () => {
      const saved = read(KEYS.identity);
      if (saved?.privateKey && saved?.publicKey && saved?.id) return saved;
      const pair = await root.crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'}, true, ['sign','verify']);
      const publicKey = await root.crypto.subtle.exportKey('jwk', pair.publicKey);
      const privateKey = await root.crypto.subtle.exportKey('jwk', pair.privateKey);
      const id = hex(await root.crypto.subtle.digest('SHA-256', utf8.encode(publicKey.x + '.' + publicKey.y)));
      const record = { id, publicKey, privateKey };
      storage.setItem(KEYS.identity, JSON.stringify(record));
      return record;
      };
      identityPromise = (root.navigator?.locks?.request ? root.navigator.locks.request('fakulteti-approval-key:' + accounts.current()?.id,create) : create()).catch(error => { identityPromise = null; throw error; });
    }
    return identityPromise;
  }
  async function call(path, method = 'GET', value) {
    const who = await identity(), body = value === undefined ? '' : JSON.stringify(value);
    const time = String(Date.now()), nonce = hex(root.crypto.getRandomValues(new Uint8Array(16)));
    const key = await root.crypto.subtle.importKey('jwk', who.privateKey, {name:'ECDSA',namedCurve:'P-256'}, false, ['sign']);
    const signature = hex(await root.crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'}, key, utf8.encode([method,path,time,nonce,body].join('\n'))));
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await root.fetch(SERVICE + path, {method, cache:'no-store', credentials:'omit', signal:abort.signal,
        headers:{'Content-Type':'application/json','X-Fakulteti-Id':who.id,'X-Fakulteti-Time':time,'X-Fakulteti-Nonce':nonce,'X-Fakulteti-Signature':signature}, ...(body ? {body} : {})});
      let result; try { result = await response.json(); } catch { throw Error('SERVICE_UNAVAILABLE'); }
      if (!response.ok) { if(result.error==='SESSION_REVOKED'){storage.removeItem(KEYS.cache);accounts.signOut();root.location.reload();} throw Error(result.error || 'SERVICE_UNAVAILABLE'); }
      return result;
    } finally { clearTimeout(timer); }
  }
  function applicant() {
    const account = accounts.current();
    const saved = read(KEYS.profile);
    if (saved?.email === account?.email) return saved;
    const name = storage.getItem('u_real_name') || storage.getItem('u_name') || '';
    const result = { email:account?.email || '', name:name.trim().replace(/\s+/g,' '), role:storage.getItem('u_role') === 'instructor' ? 'instructor' : 'student' };
    if (result.name.split(/\s+/).length < 2 || !result.email) throw Error('PROFILE_REQUIRED');
    storage.setItem(KEYS.profile, JSON.stringify(result));
    return result;
  }
  async function check() {
    if (checking) return checking;
    checking = (async () => {
      let policy;
      await accounts.syncProfile?.();
      try { policy = await call('/api/me'); }
      catch (error) {
        if (error.message !== 'REQUEST_NOT_FOUND') throw error;
        const who = await identity();
        await call('/api/requests', 'POST', {...applicant(), publicKey:who.publicKey});
        policy = await call('/api/me');
      }
      const who = await identity();
      if (policy.id !== who.id || policy.email !== accounts.current()?.email || !['pending','approved','rejected','suspended'].includes(policy.status)) throw Error('POLICY_INVALID');
      const result = {...policy, offline:false};
      storage.setItem(KEYS.cache, JSON.stringify(result));
      return changed(result);
    })().finally(() => { checking = null; });
    return checking;
  }
  function cached() {
    const policy = read(KEYS.cache), who = read(KEYS.identity), account = accounts.current();
    if (!who || !account || policy?.id !== who.id || policy.email !== account.email || policy.status !== 'approved' || !Array.isArray(policy.permissions)) return null;
    // Offline approval never grants remote administrative actions; those are verified on the service.
    return {...policy, offline:true};
  }
  function isClassPresident() { return Boolean(currentPolicy?.status === 'approved' && (currentPolicy.isAdmin || currentPolicy.role === 'president')); }
  function hasRoomsPrivilege() {
    const name=String(currentPolicy?.name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    return Boolean(currentPolicy?.status === 'approved' && (isClassPresident() || ['bujar hoti','agron miftari','grent hoxha','grenti hoxha'].includes(name)));
  }
  function can(section) { return Boolean(currentPolicy?.status === 'approved' && (currentPolicy.isAdmin || currentPolicy.permissions?.includes(section)) && (section !== 'rooms' || hasRoomsPrivilege())); }
  function canView(view) {
    if (['settings','account-access','profile-edit','profile-settings','profile-account','profile-resources'].includes(view)) return currentPolicy?.status === 'approved';
    if (view === 'profile-notes') return can('courses');
    if (view === 'profile-saved') return can('courses') || can('articles');
    return view === 'instructor' ? can('courses') && ['instructor','admin'].includes(currentPolicy.role) : can(ROUTES[view] || (String(view).startsWith('support-') ? 'services' : 'courses'));
  }
  function landing(preferred = 'home', configured = true) {
    const choice = configured && currentPolicy?.landing;
    if (choice && choice !== 'auto' && canView(choice)) return choice;
    if (canView(preferred)) return preferred;
    return ['home','freerooms','week','courses','student','studentservices','articles','settings'].find(canView) || 'settings';
  }
  const api = root.FakultetiApprovals = { SECTIONS, ADMIN_EMAIL, check, cached, can, canView, landing, isClassPresident, hasRoomsPrivilege, fallback: view => landing(view,false),
    get policy() { return currentPolicy; }, isAdmin: () => Boolean(currentPolicy?.isAdmin),
    adminLink: () => call('/api/admin-link','POST',{}),
    audit: () => call('/api/admin/audit'),
    alertsEnroll:()=>call('/api/admin/alerts','POST',{}),alertsRevoke:()=>call('/api/admin/alerts','DELETE'),
    list: () => call('/api/admin/requests'), update: async (id, policy) => {const result=await call('/api/admin/requests/' + id,'PATCH',policy);root.dispatchEvent(new CustomEvent('fakulteti:requests-updated'));return result;} };

  const h = React.createElement, {useState,useEffect,useRef} = React;
  const icon = path => h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:path}));
  const brand = () => h('div',{className:'approval-brand'},h('img',{src:root.document.documentElement.classList.contains('dark')?'./assets/fakulteti-online-logo-dark.png':'./assets/fakulteti-online-logo.png',alt:'',width:36,height:36}),h('strong',null,'Fakulteti'));
  const errorText = error => ({ ADMIN_ALREADY_LINKED:'Administrimi është lidhur në një pajisje tjetër.', POLICY_CHANGED:'Kërkesa ndryshoi. Rifresko listën dhe rihap kërkesën.', PROFILE_CHANGED:'Përdoruesi e ndryshoi profilin. Rifresko listën dhe rihap kërkesën para ruajtjes.', ACADEMIC_INVALID:'Zgjidh fakultetin, drejtimin, vitin dhe semestrin përkatës.', MIGRATION_REQUIRED:'Përdoruesi duhet ta lidhë llogarinë online para caktimit të drejtimit.', PROFILE_REQUIRED:'Plotëso emrin dhe mbiemrin për ta dërguar kërkesën.', RATE_LIMITED:'Ka shumë kërkesa. Provo përsëri pas pak.', ADMIN_REQUIRED:'Vetëm administratori i lidhur mund ta kryejë këtë veprim.', SIGNATURE_INVALID:'Kontrollo datën dhe orën e pajisjes dhe provo përsëri.' }[error?.message] || 'Lidhja me aprovimet nuk u krye. Provo përsëri me internet.');
  const academicOf = profile => Object.fromEntries(['faculty','branch','year','semester'].map(key=>[key,String(profile?.[key]||'')]));
  function AdminDeviceLink() {
    const [busy,setBusy]=useState(false),[link,setLink]=useState(''),[error,setError]=useState('');
    return h('div',{className:'approval-owner-link'},
      h('button',{type:'button',className:'approval-secondary',disabled:busy,onClick:async()=>{setBusy(true);setError('');setLink('');try{const result=await api.adminLink();setLink(result.url);}catch(e){setError(errorText(e));}finally{setBusy(false);}}},busy?'Po përgatitet lidhja…':'Lidh administrimin në këtë pajisje'),
      h('p',{className:'approval-device-note'},'Mund ta lidhësh edhe telefonin. Pajisjet e tjera mbeten të lidhura.'),
      link&&h('a',{href:link,target:'_blank',rel:'noopener noreferrer',className:'approval-primary'},'Autorizo pajisjen administruese'),
      error&&h('p',{className:'approval-error',role:'alert'},error));
  }
  root.FakultetiApprovalGate = function ApprovalGate({children}) {
    const [policy,setPolicy] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(true), [managerOpen,setManagerOpen] = useState(false);
    const [needsProfile,setNeedsProfile]=useState(false),[firstName,setFirstName]=useState(storage.getItem('u_real_first_name')||''),[lastName,setLastName]=useState(storage.getItem('u_real_last_name')||'');
    const alive = useRef(true);
    const refresh = async () => {
      setBusy(true); setError('');
      try { const result = await check(); if(alive.current) setPolicy(result); }
      catch(error) { const local=cached(); if(alive.current) { if(local) setPolicy(changed(local)); else {setNeedsProfile(error.message==='PROFILE_REQUIRED');setError(errorText(error));} } }
      finally { if(alive.current) setBusy(false); }
    };
    useEffect(() => {
      alive.current=true; refresh();
      const resume=()=>{if(!root.document.hidden) refresh();};
      const policyChecked=event=>{if(alive.current && event.detail===api.policy)setPolicy(api.policy);};
      root.addEventListener('fakulteti:approval',policyChecked);
      const timer=setInterval(resume,30000), openManager=()=>{if(api.isAdmin())setManagerOpen(true);};
      root.addEventListener('fakulteti:manage-accounts',openManager);
      root.addEventListener('online',resume);root.addEventListener('pageshow',resume);root.document.addEventListener('visibilitychange',resume);
      return()=>{alive.current=false;clearInterval(timer);root.removeEventListener('fakulteti:approval',policyChecked);root.removeEventListener('fakulteti:manage-accounts',openManager);root.removeEventListener('online',resume);root.removeEventListener('pageshow',resume);root.document.removeEventListener('visibilitychange',resume);};
    },[]);
    useEffect(()=>{if(policy&&policy.status!=='approved'){root.fakultetiAndroid?.send('notification-clear');root.fakultetiAndroid?.send('widget-clear');root.fakultetiAndroid?.send('focus-unlock');}},[policy?.status]);
    if(policy?.status==='approved') return h(React.Fragment,null,React.cloneElement(children,{key:JSON.stringify([policy.id,policy.role,Boolean(policy.isAdmin),[...(policy.permissions||[])].sort()])}),root.FakultetiAppRefresh&&h(root.FakultetiAppRefresh,{onRefresh:root.fakultetiRefreshApp}),managerOpen&&api.isAdmin()&&ReactDOM.createPortal(h(root.FakultetiAccessManager,{onClose:()=>setManagerOpen(false)}),root.document.body));
    // Only cold entry waits behind the logo. Background checks keep the approved tree mounted.
    if(!policy && busy && !needsProfile && !error) return h('main',{className:'approval-launch',role:'status','aria-label':'Po ngarkohet Fakulteti','aria-busy':true},
      h('div',{className:'approval-launch-content','aria-hidden':true},
        h('div',{className:'approval-launch-mark'},h('img',{src:root.document.documentElement.classList.contains('dark')?'./assets/fakulteti-online-logo-dark.png':'./assets/fakulteti-online-logo.png',alt:'Fakulteti',width:80,height:80}))));
    const status=policy?.status || 'loading';
    const titles={pending:'Në pritje të aprovimit',rejected:'Kërkesa nuk u aprovua',suspended:'Qasja është pezulluar',loading:needsProfile?'Plotëso profilin':'Kërkesa për aprovim'};
    return h('main',{className:'approval-wait-page'},h('section',{className:'approval-wait-card card-surface border border-default'},brand(),
      h('div',{className:'approval-status-icon'},icon(status==='pending'?'M12 8v4l3 2M22 12a10 10 0 11-20 0 10 10 0 0120 0':'M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7zM12 8v5M12 16h.01')),
      h('h1',null,titles[status]),h('p',null,status==='pending'?'Kërkesa jote i është dërguar Grent Hoxhës. Mund ta përdorësh app-in pasi të aprovohet.':status==='rejected'?'Grent Hoxha nuk e ka aprovuar kërkesën tënde.':status==='suspended'?'Grent Hoxha e ka pezulluar përkohësisht qasjen tënde.':needsProfile?'Plotëso emrin dhe mbiemrin që kërkesa jote t’i dërgohet Grent Hoxhës.':'Lidhu me internet për të kontrolluar aprovimin e llogarisë.'),
      h('div',{className:'approval-applicant'},h('strong',null,storage.getItem('u_real_name')||storage.getItem('u_name')),h('span',null,accounts.current()?.email)),
      needsProfile&&h('form',{className:'approval-legacy-profile',onSubmit:async event=>{event.preventDefault();setBusy(true);setError('');try{const identity=root.FakultetiStudentIdentity;const result=await identity.validate(firstName,lastName);if(!result.ok){setError(result.error);return;}const first=identity.normalize(firstName),last=identity.normalize(lastName);storage.setItem('u_real_first_name',first);storage.setItem('u_real_last_name',last);storage.setItem('u_real_name',first+' '+last);if(!storage.getItem('u_nickname'))storage.setItem('u_name',first+' '+last);setNeedsProfile(false);await refresh();}catch(e){setError(errorText(e));}finally{setBusy(false);}}},
        h('label',null,'Emri',h('input',{value:firstName,onChange:e=>setFirstName(e.target.value),required:true,autoComplete:'given-name',maxLength:80,disabled:busy})),
        h('label',null,'Mbiemri',h('input',{value:lastName,onChange:e=>setLastName(e.target.value),required:true,autoComplete:'family-name',maxLength:80,disabled:busy})),
        h('button',{type:'submit',className:'approval-primary',disabled:busy},'Dërgo kërkesën për aprovim')),
      error&&h('p',{className:'approval-error',role:'alert'},error),
      !needsProfile&&h('button',{type:'button',className:'approval-primary',disabled:busy,onClick:refresh},busy?'Po kontrollohet…':'Kontrollo aprovimin'),
      accounts.current()?.email===ADMIN_EMAIL&&!needsProfile&&policy&&!policy.isAdmin&&h(AdminDeviceLink),
      !accounts.isOnline?.()&&root.FakultetiCloudAccountCard&&h(root.FakultetiCloudAccountCard),
      h('button',{type:'button',className:'approval-text-button',onClick:()=>{accounts.signOut();root.location.reload();}},'Dil nga llogaria')));
  };
  root.FakultetiAcademicAssignmentWait = function AcademicAssignmentWait({onLogout}) {
    const [busy,setBusy]=useState(false),[error,setError]=useState('');
    const refresh=async()=>{setBusy(true);setError('');try{await api.check();}catch{setError('Kontrolli nuk u krye. Provo përsëri me internet.');}finally{setBusy(false);}};
    return h('main',{className:'approval-wait-page'},h('section',{className:'approval-wait-card card-surface border border-default'},brand(),
      h('div',{className:'approval-status-icon','aria-hidden':true},icon('M12 8v4l3 2M22 12a10 10 0 11-20 0 10 10 0 0120 0')),
      h('h1',null,'Në pritje të caktimit të drejtimit'),
      h('p',null,'Administratori do të caktojë drejtimin dhe vitin e studimit. App-i do të hapet automatikisht sapo të jenë caktuar.'),
      error&&h('p',{className:'approval-error',role:'alert'},error),
      h('button',{type:'button',className:'approval-primary',disabled:busy,onClick:refresh},busy?'Po kontrollohet…':'Kontrollo përsëri'),
      h('button',{type:'button',className:'approval-text-button',onClick:onLogout},'Dil nga llogaria')));
  };
  root.FakultetiAccessManager = function AccessManager({onClose}) {
    const [events,setEvents]=useState([]);
    const [catalog,setCatalog]=useState([]);
    const [rows,setRows]=useState([]),[query,setQuery]=useState(''),[tab,setTab]=useState('pending'),[selected,setSelected]=useState(null),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
    const load=async()=>{setBusy(true);setError('');try{const [result,audit]=await Promise.all([api.list(),api.audit()]);setRows(result.requests);setCatalog(result.academicCatalog||[]);setEvents(audit.events);}catch(e){setError(errorText(e));}finally{setBusy(false);}};
    useEffect(()=>{if(!api.isAdmin())return;load();const timer=setInterval(()=>{if(!root.document.hidden)load();},30000);return()=>clearInterval(timer);},[]);
    useEffect(()=>{const release=root.lockFilozofikuPageScroll?.();const key=event=>{if(event.key==='Escape')onClose();};root.document.addEventListener('keydown',key);return()=>{release?.();root.document.removeEventListener('keydown',key);};},[]);
    const choose=row=>{setSelected(row);setDraft({...row,academic:academicOf(row.profile),permissions:row.status==='pending'?Object.keys(SECTIONS):row.permissions,role:row.requestedRole==='instructor'&&row.status==='pending'?'instructor':row.role});setError('');setNotice('');};
    const save=async status=>{setBusy(true);setError('');setNotice('');try{
      const input={status,role:draft.role,permissions:draft.permissions,landing:draft.landing,version:selected.version};
      const academicChanged=Object.keys(draft.academic).some(key=>draft.academic[key]!==academicOf(selected.profile)[key]);
      if(status==='approved'&&selected.online){
        const year=catalog.find(f=>f.id===draft.academic.faculty)?.programmes.find(b=>b.id===draft.academic.branch)?.years.find(y=>y.id===draft.academic.year);
        if(!year?.semesters.some(s=>s.id===draft.academic.semester))throw Error('ACADEMIC_INVALID');
        if(academicChanged){input.academic=draft.academic;input.profileVersion=selected.profileVersion;}
      }
      const result=await api.update(selected.id,input);const saved={...selected,...result};setRows(rows=>rows.map(row=>row.id===result.id?{...row,...result}:row));setSelected(saved);setDraft({...saved,academic:academicOf(saved.profile)});setNotice(status==='approved'?(academicChanged?'Drejtimi dhe qasja u ruajtën.':'Qasja u ruajt.'):status==='rejected'?'Kërkesa u refuzua.':'Qasja u pezullua.');
    }catch(e){setError(errorText(e));}finally{setBusy(false);}};
    const faculty=catalog.find(f=>f.id===draft?.academic.faculty);
    const branch=faculty?.programmes.find(b=>b.id===draft?.academic.branch);
    const year=branch?.years.find(y=>y.id===draft?.academic.year);
    const setAcademic=value=>setDraft({...draft,academic:{...draft.academic,...value}});
    const options=(items,empty)=>[h('option',{key:'',value:''},empty),...(items||[]).map(item=>h('option',{key:item.id,value:item.id},item.label+(item.level==='master'?' · Master':item.level==='bachelor'?' · Bachelor':'')))];
    if(!api.isAdmin()) return null;
    const visible=rows.filter(row=>row.id!==currentPolicy.id&&row.role!=='admin').filter(row=>tab==='all'||(tab==='active'?row.status==='approved':row.status==='pending')).filter(row=>(row.name+' '+row.email).toLocaleLowerCase('sq').includes(query.toLocaleLowerCase('sq')));
    return h('div',{className:'approval-manager-overlay',role:'dialog','aria-modal':true,'aria-label':'Aprovimet dhe qasja'},h('section',{className:'approval-manager card-surface'},
      h('header',{className:'approval-manager-header'},h('div',null,h('h2',null,'Aprovimet dhe qasja'),h('p',null,rows.filter(r=>r.status==='pending').length+' në pritje · '+rows.filter(r=>r.status==='approved').length+' aktivë · '+rows.filter(r=>r.online).length+' llogari online')),h('button',{type:'button','aria-label':'Mbyll administrimin',className:'approval-icon-button',onClick:onClose},icon('M6 6l12 12M18 6L6 18'))),
      root.FakultetiAdminAlertsControl&&h(root.FakultetiAdminAlertsControl),
      h('div',{className:'approval-manager-body'},h('aside',{className:'approval-requests'},
        h('div',{className:'approval-manager-tools'},h('input',{type:'search',placeholder:'Kërko emrin ose emailin',value:query,onChange:e=>setQuery(e.target.value),'aria-label':'Kërko kërkesat'}),h('button',{type:'button',onClick:load,disabled:busy,className:'approval-icon-button','aria-label':'Rifresko kërkesat'},icon('M20 8a8 8 0 10.5 5M20 3v5h-5'))),
        h('div',{className:'approval-tabs'},[['pending','Në pritje'],['active','Aktivë'],['all','Të gjithë']].map(([value,label])=>h('button',{key:value,type:'button','aria-pressed':tab===value,onClick:()=>setTab(value)},label,value==='pending'?' ('+rows.filter(row=>row.status==='pending').length+')':''))),
        h('div',{className:'approval-request-list'},visible.length?visible.map(row=>h('button',{type:'button',key:row.id,disabled:busy,onClick:()=>choose(row),'aria-pressed':selected?.id===row.id,className:'approval-request'},h('span',{className:'approval-request-avatar'},row.name.split(/\s+/).map(p=>p[0]).slice(0,2).join('')),h('span',null,h('strong',null,row.name),h('small',null,row.email),h('small',{className:'approval-request-status'},({pending:'Në pritje',approved:'Aprovuar',rejected:'Refuzuar',suspended:'Pezulluar'})[row.status])))):h('p',{className:'approval-empty'},busy?'Po ngarkohen kërkesat…':'Nuk ka kërkesa në këtë listë.'))),
      h('section',{className:'approval-user-details'},selected&&draft?h(React.Fragment,null,
        h('div',{className:'approval-user-heading'},h('h3',null,selected.name),h('p',null,selected.email),h('p',{className:'text-sm text-secondary'},selected.online?'Llogari online':'Llogari e mëparshme · Ende pa u lidhur online'),selected.lastLogin&&h('p',{className:'text-sm text-secondary'},'Hyrja e fundit: '+new Date(selected.lastLogin).toLocaleString('sq'))),
        h('fieldset',{className:'approval-academic',disabled:busy||!selected.online||!catalog.length},h('legend',null,'Fakulteti dhe drejtimi'),
          h('p',null,selected.online?'Cakto drejtimin dhe vitin. Pas aprovimit studenti hyn drejtpërdrejt, pa i zgjedhur përsëri.':'Caktimi bëhet pasi përdoruesi ta lidhë llogarinë online.'),
          h('div',{className:'approval-form-row'},
            h('label',null,'Fakulteti',h('select',{'aria-label':'Fakulteti i përdoruesit',value:draft.academic.faculty,onChange:e=>setAcademic({faculty:e.target.value,branch:'',year:'',semester:''})},options(catalog,'Zgjidh fakultetin'))),
            h('label',null,'Drejtimi',h('select',{'aria-label':'Drejtimi i përdoruesit',value:draft.academic.branch,disabled:!faculty,onChange:e=>{const b=faculty.programmes.find(item=>item.id===e.target.value),y=b?.years[0];setAcademic({branch:e.target.value,year:y?.id||'',semester:y?.semesters[0]?.id||''});}},options(faculty?.programmes,'Zgjidh drejtimin'))),
            h('label',null,'Viti',h('select',{'aria-label':'Viti i përdoruesit',value:draft.academic.year,disabled:!branch,onChange:e=>{const y=branch.years.find(item=>item.id===e.target.value);setAcademic({year:e.target.value,semester:y?.semesters[0]?.id||''});}},options(branch?.years,'Zgjidh vitin'))),
            h('label',null,'Semestri',h('select',{'aria-label':'Semestri i përdoruesit',value:draft.academic.semester,disabled:!year,onChange:e=>setAcademic({semester:e.target.value})},options(year?.semesters,'Zgjidh semestrin'))))),
        h('div',{className:'approval-presets'},h('button',{type:'button',onClick:()=>setDraft({...draft,permissions:Object.keys(SECTIONS),landing:'auto'})},'Qasje e plotë'),h('button',{type:'button',onClick:()=>setDraft({...draft,permissions:['rooms'],landing:'freerooms'})},'Vetëm sallat e lira'),h('button',{type:'button',onClick:()=>setDraft({...draft,permissions:['home','schedule','courses','exams','articles'],landing:'courses'})},'Mësimi')),
        h('fieldset',{className:'approval-permissions'},h('legend',null,'Pjesët që i shfaqen'),Object.entries(SECTIONS).map(([key,label])=>h('label',{key},h('input',{type:'checkbox',checked:draft.permissions.includes(key),onChange:e=>setDraft({...draft,permissions:e.target.checked?[...draft.permissions,key]:draft.permissions.filter(p=>p!==key),landing:'auto'})}),h('span',null,label)))),
        h('div',{className:'approval-form-row'},h('label',null,'Roli',h('select',{value:draft.role,onChange:e=>{const role=e.target.value;setDraft({...draft,role,permissions:role==='president'?[...new Set([...draft.permissions,'rooms'])]:draft.permissions});}},h('option',{value:'student'},'Student'),h('option',{value:'instructor'},'Profesor'),h('option',{value:'president'},'Kryetar klase/grupi'))),
        h('label',null,'Faqja që hapet',h('select',{value:draft.landing,onChange:e=>setDraft({...draft,landing:e.target.value})},[['auto','Sipas profilit'],['home','Kreu'],['week','Orari'],['courses','Lëndët'],['student','Provimet'],['studentservices','Shërbimet studentore'],['freerooms','Sallat e lira'],['articles','Artikujt'],['settings','Profili']].filter(([view])=>view==='auto'||view==='settings'||draft.permissions.includes(ROUTES[view])).map(([value,label])=>h('option',{key:value,value},label))))),
        h('div',{className:'approval-save-actions'},h('button',{type:'button',disabled:busy,className:'approval-primary',onClick:()=>save('approved')},selected.status==='approved'?'Ruaj qasjen':'Aprovo llogarinë'),selected.status==='approved'&&h('button',{type:'button',disabled:busy,className:'approval-secondary',onClick:()=>save('suspended')},'Pezullo qasjen'),selected.status!=='approved'&&h('button',{type:'button',disabled:busy,className:'approval-text-button',onClick:()=>save('rejected')},'Refuzo kërkesën')),
        h('section',{className:'approval-permissions'},h('h3',null,'Aktiviteti i llogarisë'),
          events.filter(event=>event.email===selected.email).slice(0,8).map((event,index)=>h('p',{key:index,className:'text-sm text-secondary'},({register:'Regjistrim',login:'Hyrje',recover:'Rikuperim','academic:assigned':'U caktua drejtimi','access:approved':'Qasja u aprovua','access:suspended':'Qasja u pezullua','access:rejected':'Kërkesa u refuzua'})[event.action]||event.action,' · ',new Date(event.createdAt).toLocaleString('sq')))),
        notice&&h('p',{role:'status',className:'approval-notice'},notice)) : h('div',{className:'approval-empty'},icon('M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7zM8 12l3 3 5-6'),h('p',null,'Zgjidh një përdorues për aprovimin dhe qasjen.')))),
      error&&h('p',{className:'approval-error approval-manager-error',role:'alert'},error)));
  };
  root.FakultetiManageAccountsButton = function ManageAccountsButton() {
    const [pendingCount,setPendingCount]=useState(0);
    useEffect(()=>{if(!api.isAdmin())return;let alive=true;const refresh=async()=>{if(root.document.hidden)return;try{const data=await api.list();if(alive)setPendingCount(data.requests.filter(row=>row.status==='pending').length);}catch{}};refresh();const timer=setInterval(refresh,30000);return()=>{alive=false;clearInterval(timer);};},[]);
    if(!api.isAdmin())return accounts.current()?.email===ADMIN_EMAIL?h(AdminDeviceLink):null;
    return h('button',{type:'button',className:'approval-manage-button',onClick:()=>root.dispatchEvent(new CustomEvent('fakulteti:manage-accounts'))},icon('M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7zM8 12l3 3 5-6'),'Aprovimet dhe qasja',pendingCount>0&&h('span',{className:'approval-pending-count'},pendingCount));
  };
})(window);
