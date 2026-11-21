const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};vm.runInNewContext(fs.readFileSync('assets/pomodoro-core.js','utf8'),context);const core=context.window.FakultetiPomodoro;let checks=0;
const ok=(value,label)=>{assert(value,label);checks++},now=Date.parse('2026-11-22T12:00:00Z');
const base={phase:'focus',total:1500,left:1500,endsAt:null,cycle:0,taskId:'chapter3',done:false};
let p=core.start(base,{},now);ok(p.endsAt===now+1500000,'start deadline');
p=core.pause(p,now+61000);ok(p.left===1439&&p.endsAt===null,'pause preserves exact seconds');
p=core.start(p,{},now+300000);ok(p.endsAt===now+300000+1439000,'resume preserves remaining duration');
ok(core.remaining(p,p.endsAt+1000)===0,'never negative');
let result=core.finish({...base,endsAt:now}, {},now);ok(result.state.phase==='short'&&result.state.cycle===1&&result.state.total===300,'25 minutes then short break');ok(result.state.endsAt===now+300000,'auto break default');
result=core.finish({...base,cycle:3,endsAt:now},{},now);ok(result.state.phase==='long'&&result.state.total===900,'long break after fourth focus');ok(!result.state.done,'finish goal after restorative break');
result=core.finish({...base,phase:'long',total:900,cycle:4,endsAt:now},{},now);ok(result.state.done&&result.state.endsAt===null,'stop after goal and final break');
p=core.start(result.state,{},now);ok(p.phase==='focus'&&p.cycle===0&&!p.done&&p.total===1500,'new goal starts from session one');
result=core.finish({...base,phase:'short',total:300,cycle:1,endsAt:now},{},now);ok(result.state.endsAt===null,'next focus waits by default');
result=core.finish({...base,phase:'short',total:300,cycle:1,endsAt:now},{autoFocus:true},now);ok(result.state.endsAt===now+1500000,'auto focus opt-in');
result=core.finish({...base,endsAt:now},{autoBreak:false},now);ok(result.state.endsAt===null,'manual break setting');
result=core.finish({...base,endsAt:now-600000},{autoBreak:true,autoFocus:true},now);ok(result.state.endsAt===null&&result.state.cycle===1,'delayed resume never invents completed focus sessions');
ok(result.completion.id===`pomo_${now-600000}_chapter3`,'stable completion ID across app/widget');
result=core.finish({...base,cycle:1,endsAt:now},{every:2,long:20},now);ok(result.state.phase==='long'&&result.state.total===1200,'custom long-break cadence');
const clean=core.settings({focus:-9,short:999,every:0,goal:'bad'});ok(clean.focus===1&&clean.short===60&&clean.every===1&&clean.goal===4,'settings limits');
ok(core.normalize({...base,left:0}).left===0,'zero does not turn into a fresh session on reload');
const vectors=[];
for(const phase of ['focus','short','long'])for(const cycle of [0,1,3,4])for(const lag of [0,600000]){
 const input={...base,phase,cycle,total:phase==='focus'?1500:phase==='long'?900:300,endsAt:now-lag};
 const settings={focus:25,short:5,long:15,every:4,goal:4,autoBreak:true,autoFocus:false};vectors.push({input,settings,now,expected:JSON.parse(JSON.stringify(core.finish(input,settings,now)))});
}
fs.mkdirSync('.build/widget-tests',{recursive:true});fs.writeFileSync('.build/widget-tests/pomodoro-vectors.json',JSON.stringify(vectors));
const html=fs.readFileSync('fakulteti-online.html','utf8');ok(html.includes("stepper('Pushimi i gjatë'")&&html.includes("['autoFocus', 'Nis fokusin tjetër automatikisht']"),'settings exposed in existing timer');
ok(html.includes('known.has(item.id)')&&html.includes("unitStorage.setItem('u_pomo_history', JSON.stringify(next)); setPomoHistory(next); return true"),'history persisted and deduplicated before native acknowledgement');
console.log(`PASS: ${checks} Pomodoro duration, pause/resume, long breaks, goal, auto-start and durable history checks; wrote ${vectors.length} parity cases.`);
