const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{}};vm.createContext(ctx);
for(const file of ['assets/pomodoro-core.js','assets/pomodoro-planning.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const api=ctx.window.FakultetiPomodoroPlanning;
const now=new Date(2026,10,27,12,0).getTime(),base={phase:'focus',total:1500,left:1500,endsAt:null,cycle:0,taskId:'task',done:false};
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const seconds=(state,count,settings={},final=false)=>api.project({...base,...state},settings,count,now,final).seconds;
ok(api.estimate({minutes:25},{focus:25})===1&&api.estimate({minutes:60},{focus:25})===3,'new tasks derive a sensible estimate from their existing duration');
ok(api.estimate({minutes:60,pomodoroEstimate:4},{focus:25})===4,'explicit estimate overrides the duration fallback');
ok(api.clampEstimate(-3)===1&&api.clampEstimate(99)===12&&api.clampEstimate('bad')===1,'estimate controls remain bounded');
ok(seconds({},3)===85*60,'three focus sessions include two short breaks and no extra break after task completion');
ok(seconds({},4,{},true)===130*60,'a complete four-session cycle includes its final long break');
ok(seconds({left:600,endsAt:now+600000,cycle:1},2)===40*60,'active work uses actual remaining time rather than restarting the current session');
ok(seconds({left:600,wasPaused:true,cycle:1},2)===40*60,'paused work projects from its preserved remaining time');
ok(seconds({phase:'short',total:300,left:180,cycle:1},3)===88*60,'projection includes the remaining current break exactly once');
ok(seconds({phase:'long',total:900,left:180,cycle:4},0,{},true)===180,'end-of-cycle long break still has an accurate finish time');
ok(seconds({phase:'long',total:900,left:180,cycle:4},0)===0,'completed task estimate does not wait for an unrelated final rest');
ok(seconds({cycle:3,left:600},3)===80*60,'long breaks and restarting a finished cycle are accounted for');
ok(seconds({},3,{goal:2,every:4})===85*60,'custom cycle goals reset the break cadence at the same point as the real timer');
ok(seconds({done:true,cycle:4,phase:'long',total:900,left:0},2)===55*60,'a task can need another cycle after the preceding cycle is done');
ok(seconds({},2,{focus:50,short:10,long:20,every:2})===85*60,'current session length is preserved while future sessions follow the selected settings');
const projected=api.project(base,{},3,now);ok(projected.finishAt===now+projected.seconds*1000,'finish clock is timestamp-based');
ok(api.project(base,{},0,now).finishAt===null,'reached estimates never invent more work or a false future completion');
ok(api.plan({state:{...base,left:600,endsAt:now+600000,cycle:3},settings:{goal:2},now}).seconds===25*60,'lowering a cycle goal cannot erase its already-running focus session and final break');
const today='2026-11-27',history=[{id:'one',routineId:'task',date:today,minutes:25},{id:'one',routineId:'task',date:today,minutes:25},{id:'yesterday',routineId:'task',date:'2026-11-26',minutes:25},{id:'other',routineId:'other-task',date:today,minutes:25},{id:'future',routineId:'task',date:'2026-11-28',minutes:25},{id:'invalid',routineId:'task',date:today,minutes:0}];
ok(api.completed({id:'task',recurrence:'daily'},history,now)===1,'recurring task progress uses only unique completed sessions from today');
ok(api.completed({id:'task',recurrence:'once'},history,now)===2,'one-off task progress carries over across days without counting future, duplicate or other-task sessions');
ok(api.completed({id:'unrelated'},history,now)===0,'another account/task with no matching history starts at zero');
const snapshot=JSON.stringify(history);api.plan({task:{id:'task',pomodoroEstimate:3,recurrence:'daily'},history,state:base,settings:{},now});ok(JSON.stringify(history)===snapshot,'planning never rewrites completed history');

// Reuse the real timer rendering fixture to check controls and layout with planning enabled.
const {fixture,html,nodes,text}=require('./pomodoro-layout.cjs');
const tasks=[{id:'task',title:'Leximi i kapitullit',minutes:25,recurrence:'once',pomodoroEstimate:3},{id:'other',title:'Tjetër',pomodoroEstimate:2}];
for(const style of ['eklipsi','flip','horizont'])for(const viewport of [{w:338,h:715},{w:844,h:390}]){
 const f=fixture({window:ctx.window,pomoVp:viewport,pomoNow:now,pomoHistory:[history[0]],visibleDailyRoutines:tasks,pomoSettings:{focus:25,short:5,long:15,every:4,goal:4,style},pomo:{...base,left:600,endsAt:now+600000,cycle:1},pomoLeftSecs:()=>600});
 const tree=f.render(),display=nodes(tree).find(n=>n.props.className==='pomo-timer-display'),plan=nodes(tree).find(n=>n.props.key==='plan');
 ok(text(plan).includes('Detyra: 1/3'),'task progress is visible in '+style+' '+viewport.w);
 ok(text(plan).includes(new Date(now+40*60000).toLocaleTimeString('sq-AL',{hour:'2-digit',minute:'2-digit',hour12:false})),'finish clock reflects task progress and breaks in '+style);
 ok(display.props.style.left+display.props.style.width/2===viewport.w/2,'planning never displaces the timer centre');
}
let changed;
const editing=fixture({window:ctx.window,pomoNow:now,pomoHistory:[],visibleDailyRoutines:tasks,pomoSetOpen:true,pomo:{...base,taskId:'task'},pomoLeftSecs:()=>1500,setDailyRoutines:update=>{changed=update(tasks);}});
nodes(editing.render()).find(n=>n.props['aria-label']==='Më shumë Pomodoro për këtë detyrë').props.onClick();
ok(changed[0].pomodoroEstimate===4&&changed[1]===tasks[1],'estimate editing changes only the selected task and never restarts the timer');
const builderStart=html.indexOf('    const existingRoutine = dailyRoutineDraft.id ?'),builderEnd=html.indexOf('    if (dailyRoutineDraft.id)',builderStart);
const editContext={dailyRoutineDraft:{id:'task',title:'Updated'},dailyRoutines:tasks,quickAdd:{},title:'Updated',today};vm.createContext(editContext);vm.runInContext(html.slice(builderStart,builderEnd)+'this.saved=routine;',editContext);
ok(editContext.saved.pomodoroEstimate===3,'later task-title/details edits preserve its Pomodoro estimate');
console.log(`PASS: ${checks} task Pomodoro planning checks — estimates, actual history, break cadence, finish clocks and UI controls.`);
