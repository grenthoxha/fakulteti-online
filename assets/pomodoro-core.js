/* Timestamp-based focus sessions. A delayed wake never invents completed sessions. */
(function(root){
  'use strict';
  const integer=(n,fallback,min,max)=>Number.isFinite(Number(n))?Math.min(max,Math.max(min,Math.round(Number(n)))):fallback;
  function settings(input={}){return{focus:integer(input.focus,25,1,180),short:integer(input.short,5,1,60),long:integer(input.long,15,1,120),every:integer(input.every,4,1,12),goal:integer(input.goal,4,1,24),autoBreak:input.autoBreak!==false,autoFocus:input.autoFocus===true};}
  const seconds=(phase,s)=>settings(s)[phase==='focus'?'focus':phase==='long'?'long':'short']*60;
  function normalize(input={},config={}){
    const phase=['focus','short','long'].includes(input.phase)?input.phase:'focus',total=integer(input.total,seconds(phase,config),1,10800);
    return{...input,phase,total,left:integer(input.left,total,0,total),endsAt:Number(input.endsAt)>0?Number(input.endsAt):null,cycle:integer(input.cycle,0,0,10000),taskId:String(input.taskId||''),done:!!input.done};
  }
  const remaining=(p,now=Date.now())=>p.endsAt?Math.max(0,Math.ceil((p.endsAt-now)/1000)):Math.max(0,p.left);
  function start(input,config,now=Date.now()){
    let p=normalize(input,config);
    if(p.done)p={...p,phase:'focus',total:seconds('focus',config),left:seconds('focus',config),cycle:0,done:false,endsAt:null};
    if(p.endsAt)return p;const left=p.left>0?p.left:p.total;
    return{...p,left,endsAt:now+left*1000,done:false};
  }
  function finish(input,config,now=Date.now()){
    const p=normalize(input,config),s=settings(config),endedAt=p.endsAt||now;
    let phase='focus',cycle=p.cycle,done=false,completion=null;
    if(p.phase==='focus'){
      cycle++;phase=cycle%s.every===0?'long':'short';
      completion={id:`pomo_${endedAt}_${p.taskId}`,endedAt,taskId:p.taskId,minutes:p.total/60};
    }else done=cycle>=s.goal;
    const total=seconds(phase,s),auto=!done&&now-endedAt<60000&&(phase==='focus'?s.autoFocus:s.autoBreak);
    return{state:{...p,phase,total,left:total,endsAt:auto?now+total*1000:null,cycle,done},completion};
  }
  const pause=(p,now=Date.now())=>({...p,left:remaining(p,now),endsAt:null});
  root.FakultetiPomodoro=Object.freeze({settings,seconds,normalize,remaining,start,pause,finish});
})(window);
