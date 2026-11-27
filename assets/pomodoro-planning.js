/* Account-local task estimates and projections; never alter the running timer. */
(function(root){
  'use strict';
  const core=root.FakultetiPomodoro;
  const bounded=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Math.round(Number(value)))):fallback;
  const clampEstimate=value=>bounded(value,1,1,12);
  const dayKey=now=>{const date=new Date(now);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
  function estimate(task,settings={}){
    const focus=core.settings(settings).focus;
    return task?.pomodoroEstimate!=null?clampEstimate(task.pomodoroEstimate):clampEstimate(Math.ceil((Number(task?.minutes)||focus)/focus));
  }
  function completed(task,history=[],now=Date.now()){
    if(!task?.id)return 0;
    const recurring=task.recurrence&&task.recurrence!=='once',today=dayKey(now),ids=new Set();
    for(const item of Array.isArray(history)?history:[]){
      if(item?.routineId!==task.id||typeof item.id!=='string'||!item.id||Number(item.minutes)<=0||!Number.isFinite(Number(item.minutes)))continue;
      if(typeof item.date==='string'&&item.date>today)continue;
      if(recurring&&item.date!==today)continue;
      ids.add(item.id);
    }
    return ids.size;
  }
  function project(state,settings,remainingSessions,now=Date.now(),includeFinalBreak=false){
    const config=core.settings(settings);
    let p=core.normalize(state,config),count=bounded(remainingSessions,0,0,24);
    if(p.done&&count>0)p={...p,phase:'focus',total:config.focus*60,left:config.focus*60,endsAt:null,cycle:0,done:false};
    if(p.done)return {seconds:0,finishAt:null};
    const current=Math.min(p.total,core.remaining(p,now));
    if(!count){const seconds=includeFinalBreak&&p.phase!=='focus'?current:0;return {seconds,finishAt:seconds?now+seconds*1000:null};}
    let seconds=0,cycle=p.cycle;
    if(p.phase!=='focus'){
      seconds+=current;
      if(cycle>=config.goal)cycle=0;
    }
    for(let index=0;index<count;index++){
      seconds+=index===0&&p.phase==='focus'?current:config.focus*60;
      cycle++;
      if(index<count-1||includeFinalBreak)seconds+=(cycle%config.every===0?config.long:config.short)*60;
      if(cycle>=config.goal)cycle=0;
    }
    return {seconds,finishAt:now+seconds*1000};
  }
  function plan({task,history,state,settings,now=Date.now()}){
    const count=task?estimate(task,settings):core.settings(settings).goal;
    const done=task?completed(task,history,now):core.normalize(state,settings).cycle;
    const remaining=Math.max(!task&&!state.done&&state.phase==='focus'?1:0,count-done);
    return {estimate:count,completed:done,remaining,...project(state,settings,remaining,now,!task)};
  }
  root.FakultetiPomodoroPlanning=Object.freeze({clampEstimate,estimate,completed,project,plan});
})(window);
