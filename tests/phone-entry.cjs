const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/phone-entry.js','utf8'),html=fs.readFileSync('fakulteti-online.html','utf8');let checks=0;
const ok=(v,m)=>{assert(v,m);checks++;};
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(v=>v!=null&&v!==false)});
const nodes=t=>t&&typeof t==='object'?[t,...t.children.flatMap(nodes)]:[];
const text=t=>t&&typeof t==='object'?t.children.map(text).join(''):String(t??'');
function fixture(ua,mobile){let copied='',attrs={},states=[],cursor=0;const root={navigator:{userAgent:ua,...(mobile===undefined?{}:{userAgentData:{mobile}}),clipboard:{writeText:async s=>copied=s}},document:{documentElement:{setAttribute:(k,v)=>attrs[k]=v}},React:{createElement:h,useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=v];}}};const c=vm.createContext({window:root});vm.runInContext(source,c);return {root,attrs,get copied(){return copied;},render(){cursor=0;return root.FakultetiPhoneEntry.View();}};}
const phoneUAs=[
 'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36',
 'Mozilla/5.0 (Linux; Android 15; SM-S928B Build/AP3A; wv) AppleWebKit/537.36 Version/4.0 Chrome/131.0 Mobile Safari/537.36',
 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) FxiOS/130.0 Mobile/15E148 Safari/605.1.15'
];
for(const ua of phoneUAs){const f=fixture(ua);ok(f.root.FakultetiPhoneEntry.allowed&&f.attrs['data-phone-entry']==='allowed','Android, Android WebView and iPhone remain supported');}
for(const ua of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36','Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15','Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0','Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1','Mozilla/5.0 (Linux; Android 15; Tablet) Safari/537.36','']){
 const f=fixture(ua,false);ok(!f.root.FakultetiPhoneEntry.allowed&&f.attrs['data-phone-entry']==='blocked','desktop/tablet/unknown does not become a phone merely by narrowing the window');
}
ok(fixture('Mozilla/5.0 (Linux; Android 15)',true).root.FakultetiPhoneEntry.allowed,'Android mobile client hint is accepted');
const f=fixture('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');let tree=f.render();ok(text(tree).includes('Kthehu në telefon')&&text(tree).includes('Android ose iPhone'),'desktop has the requested phone handoff message');ok(!nodes(tree).some(n=>['form','input','select'].includes(n.type)),'no login or app controls are offered');
const renderSource=html.slice(html.indexOf('ReactDOM.createRoot(document.getElementById(\'root\'))'),html.indexOf('</script>',html.indexOf('ReactDOM.createRoot(document.getElementById(\'root\'))')));
let accountReads=0,rendered;f.root.FakultetiLocalAccounts={current:()=>{accountReads++;return {id:'admin'};}};f.root.FakultetiApprovalGate='ApprovalGate';f.root.FakultetiLocalAuthView='Auth';
vm.runInNewContext(renderSource,{window:f.root,React:{createElement:h},ReactDOM:{createRoot:()=>({render:t=>rendered=t})},document:{getElementById:()=>({})},AppErrorBoundary:'Boundary',App:'App'});
ok(accountReads===0&&rendered.children[0].type===f.root.FakultetiPhoneEntry.View,'desktop entry does not mount authentication, approvals or app even for an admin session');
const p=fixture(phoneUAs[0]);p.root.FakultetiLocalAccounts={current:()=>({id:'student'})};p.root.FakultetiApprovalGate='ApprovalGate';
vm.runInNewContext(renderSource,{window:p.root,React:{createElement:h},ReactDOM:{createRoot:()=>({render:t=>rendered=t})},document:{getElementById:()=>({})},AppErrorBoundary:'Boundary',App:'App'});
ok(rendered.children[0].type==='ApprovalGate','phone retains the existing verified approval flow');
(async()=>{await nodes(tree).find(n=>n.type==='button').props.onClick();ok(f.copied==='https://grenthoxha.github.io/fakulteti-online/','copy button copies only the public app URL');ok(text(f.render()).includes('Linku u kopjua'),'copy has feedback');console.log(`PASS: ${checks} phone detection, laptop blocking, entry isolation and handoff checks`);})().catch(e=>{console.error(e);process.exitCode=1;});
