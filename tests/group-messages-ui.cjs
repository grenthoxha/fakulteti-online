const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)});
const nodes=t=>t&&typeof t==='object'?[t,...t.children.flatMap(nodes)]:[];
const text=t=>t&&typeof t==='object'?t.children.map(text).join(''):String(t??'');
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const jpg='data:image/jpeg;base64,AA==',calls=[],records=[],hooks=[],cleanups=[];let cursor=0,sequence=0;
const current={id:'group1',name:'',description:'',photo:'',ownerId:'a',members:[{id:'a',name:'Arta Hoxha',email:'arta@example.test',role:'owner',photo:''}],createdAt:Date.now(),updatedAt:Date.now()};
const messages=[],drafts={};
const store={actorId:'a',list:async()=>records,subscribe:()=>()=>{},close(){calls.push('closed');},
 create:async form=>{Object.assign(current,{name:form.name,description:form.description,photo:form.photo});records.push(current);calls.push('create');return current;},
 update:async(id,form)=>{Object.assign(current,form);calls.push('update');return current;},
 messages:async()=>({room:current,items:messages.slice(),hasMore:false,draft:drafts.text||'',draftPhoto:drafts.photo||''}),
 saveDraft:async(id,value,photo)=>{Object.assign(drafts,{text:value,photo});calls.push('draft');},
 send:async(id,data)=>{const message={...data,id:'m'+(++sequence),roomId:id,authorId:'a',authorName:'Arta Hoxha',createdAt:Date.now()};messages.push(message);drafts.text='';drafts.photo='';calls.push('send');return message;},
 saveMember:async(id,form,memberId)=>{const member={...form,id:memberId||'contact1'};current.members=memberId?current.members.map(m=>m.id===memberId?member:m):[...current.members,member];calls.push('member');return current;},
 removeMember:async(id,memberId)=>{current.members=current.members.filter(m=>m.id!==memberId);calls.push('remove-member');return current;},
 removeMessage:async(id,messageId)=>{const i=messages.findIndex(m=>m.id===messageId);messages.splice(i,1);calls.push('remove-message');},
 remove:async()=>{records.length=0;calls.push('remove-group');}
};
const React={createElement:h,Fragment:'Fragment',
 useState:initial=>{const key=cursor++;if(!(key in hooks))hooks[key]={value:typeof initial==='function'?initial():initial};return[hooks[key].value,value=>{hooks[key].value=typeof value==='function'?value(hooks[key].value):value;}];},
 useRef:value=>{const key=cursor++;if(!(key in hooks))hooks[key]={current:value};return hooks[key];},
 useEffect:(fn,deps)=>{const key=cursor++;if(!(key in hooks)||deps.some((v,i)=>v!==hooks[key].deps[i])){hooks[key]={deps};const done=fn();if(done)cleanups.push(done);}}
};
const root={FakultetiLocalMessages:{createStore:()=>store,preparePhoto:async()=>{calls.push('photo');return jpg;}},requestAnimationFrame:fn=>fn()};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/group-messages-ui.js'),'utf8'),{window:root,React,Intl,Date,Promise,setTimeout,clearTimeout});
const props={branchTitle:'Psikologji',yearTitle:'Viti I',language:'sq',Portal:'Portal',onClose:()=>calls.push('close')};
const render=()=>{cursor=0;return root.FakultetiGroupMessages.Screen(props);};
const tick=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
const aria=(t,label)=>nodes(t).find(n=>n.type==='button'&&n.props['aria-label']===label);
const cls=(t,name)=>nodes(t).find(n=>n.props.className?.split(' ').includes(name));
const input=(t,label)=>{const field=nodes(t).find(n=>n.type==='label'&&text(n.children[0])===label);return nodes(field).find(n=>['input','textarea','select'].includes(n.type));};
(async()=>{
 let tree=render();await tick();tree=render();
 ok(tree.type==='Portal'&&cls(tree,'unit-messages-overlay'),'screen retains existing portal and full-screen layout');
 ok(text(tree).includes('Grupi yt i parë'),'new account starts empty, without demo people or messages');
 ok(!nodes(tree).some(n=>n.props.role==='tab'),'group notices stay outside messages');
 aria(tree,'Krijo grup').props.onClick();tree=render();
 input(tree,'Emri i grupit').props.onChange({target:{value:'Grupi i studimit'}});tree=render();
 input(tree,'Përshkrimi').props.onChange({target:{value:'Përsëritje para provimit'}});tree=render();
 await nodes(tree).find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[{type:'image/png'}],value:'file'}});tree=render();
 ok(nodes(tree).some(n=>n.type==='img'&&n.props.src===jpg),'group photo is previewed before saving');
 nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await tick();tree=render();
 ok(calls.includes('create')&&cls(tree,'fm-chat-log'),'creating group opens its conversation');
 ok(current.name==='Grupi i studimit'&&current.photo===jpg,'actual name and photo reach local storage');
 ok(messages.length===0,'creation does not inject fake chat messages');
 nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:'Përshëndetje grupit'}});tree=render();
 await nodes(tree).find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[{type:'image/png'}],value:'file'}});tree=render();
 ok(cls(tree,'fm-attachment'),'conversation photo has a removable preview');
 cls(tree,'fm-compose').props.onSubmit({preventDefault(){}});await tick();tree=render();
 ok(messages.length===1&&messages[0].photo===jpg&&messages[0].text==='Përshëndetje grupit','text and photo are saved together');
 ok(nodes(tree).find(n=>n.type==='textarea').props.value==='','successful save clears composer');
 aria(tree,'Hap fotografinë').props.onClick();tree=render();
 ok(cls(tree,'fm-photo-stage'),'photo opens in a dedicated unobstructed view');
 aria(tree,'Kthehu').props.onClick();tree=render();
 aria(tree,'Hap detajet e grupit').props.onClick();tree=render();
 ok(text(tree).includes('Krijues')&&text(tree).includes('1 anëtar'),'details show actual owner and member count');
 aria(tree,'Shto anëtar').props.onClick();tree=render();
 input(tree,'Emri dhe mbiemri').props.onChange({target:{value:'Bujar Hoti'}});tree=render();
 input(tree,'Emaili (opsional)').props.onChange({target:{value:'bujar@example.test'}});tree=render();
 input(tree,'Roli në grup').props.onChange({target:{value:'admin'}});tree=render();
 nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await tick();tree=render();
 ok(text(tree).includes('Bujar Hoti')&&text(tree).includes('Administrator')&&text(tree).includes('2 anëtarë'),'adding contact updates membership, role and count');
 ok(text(tree).includes('lokalë për këtë pajisje'),'local membership is clearly described');
 aria(tree,'Ndrysho grupin').props.onClick();tree=render();
 input(tree,'Emri i grupit').props.onChange({target:{value:'Grupi i ndryshuar'}});tree=render();
 nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await tick();tree=render();
 ok(current.name==='Grupi i ndryshuar'&&calls.includes('update'),'group details can be edited');
 nodes(tree).find(n=>n.type==='button'&&text(n).includes('Fshi grupin')).props.onClick();tree=render();
 ok(nodes(tree).some(n=>n.props.role==='alertdialog')&&!calls.includes('remove-group'),'group deletion requires confirmation');
 nodes(tree).find(n=>n.type==='button'&&text(n)==='Anulo').props.onClick();tree=render();
 ok(!nodes(tree).some(n=>n.props.role==='alertdialog')&&records.length===1,'cancel preserves group and photos');
 nodes(tree).find(n=>n.type==='button'&&text(n).includes('Fshi grupin')).props.onClick();tree=render();
 nodes(tree).find(n=>n.type==='button'&&text(n)==='Fshi').props.onClick();await tick();tree=render();
 ok(calls.includes('remove-group')&&text(tree).includes('Grupi yt i parë'),'confirmed deletion returns to empty list');
 aria(tree,'Mbyll mesazhet').props.onClick();ok(calls.includes('close'),'close returns to retained app chrome');
 cleanups.forEach(fn=>fn());await tick();
 ok(!/\bfetch\s*\(/.test(fs.readFileSync(path.join(__dirname,'../assets/group-messages-ui.js'),'utf8')),'UI never uploads photos, messages or local contacts');
 console.log(`PASS: ${checks} message UI checks — group creation/editing, photos, members, roles, local messaging, confirmation and retained chrome.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
