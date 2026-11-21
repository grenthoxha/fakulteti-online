/* Android launcher widgets: a local, permission-filtered snapshot; no account secrets. */
(function(root){
  'use strict';
  const ZONE='Europe/Tirane',HOUR=3600000;
  const clean=(value,max=180)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
  const dayKey=time=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
  function stamp(day,clock){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d\d:\d\d$/.test(clock))return NaN;
    const target=Date.parse(day+'T'+clock+':00Z');let result=target;
    for(let i=0;i<2;i++){
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(result)).map(p=>[p.type,p.value]));
      result+=target-Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    }
    return result;
  }
  function days(now,count=8){
    const base=Date.parse(dayKey(now)+'T12:00:00Z');
    return Array.from({length:count},(_,i)=>{const d=new Date(base+i*86400000);return{key:d.toISOString().slice(0,10),day:d.getUTCDay()};});
  }
  function snapshot(options,now=Date.now()){
    const allow=options.allow||{},sessions=[];
    if(allow.schedule)for(const day of days(now)){
      if(day.day<1||day.day>5)continue;
      for(const item of options.getSessions(day.day,day.key)||[]){
        const start=stamp(day.key,item.start),end=stamp(day.key,item.end);
        if(Number.isFinite(start)&&end>now&&end>start&&clean(item.title))sessions.push({title:clean(item.title),room:clean(item.room,80),start,end});
      }
    }
    sessions.sort((a,b)=>a.start-b.start||a.title.localeCompare(b.title));
    const rooms={checkedAt:0,expires:0,windows:[]};
    if(allow.rooms&&options.store){
      const sync=options.store.getSyncState(),data=options.store.getData();
      rooms.checkedAt=Number(sync.lastSuccessAt)||0;rooms.expires=rooms.checkedAt+8*HOUR;
      if(rooms.checkedAt>0&&rooms.checkedAt<=now+60000&&rooms.expires>now&&Array.isArray(data?.rooms)&&Array.isArray(data?.times)){
        for(const day of days(now,2)){
          if(day.day<1||day.day>5)continue;
          for(const room of data.rooms){
            const start=stamp(day.key,'08:00'),end=stamp(day.key,'21:15');let cursor=start;
            const busy=(options.getRoomEvents(data,room,day.day-1,day.key)||[]).map(event=>({start:stamp(day.key,data.times[event.s]),end:stamp(day.key,data.times[event.e])})).filter(event=>Number.isFinite(event.start)&&event.end>event.start).sort((a,b)=>a.start-b.start);
            for(const event of [...busy,{start:end,end}]){
              const until=Math.min(end,event.start);
              if(until>cursor&&until>now)rooms.windows.push({name:clean(room.l||room.n,80),from:cursor,to:until});
              cursor=Math.max(cursor,event.end);if(cursor>=end)break;
            }
          }
        }
      }
    }
    const p=options.pomo||{},total=Math.max(1,Math.min(10800,Number(p.total)||1500));
    return{schema:1,scope:clean(options.scope,240),capturedAt:now,expires:now+8*HOUR,
      allow:{schedule:!!allow.schedule,rooms:!!allow.rooms,pomodoro:!!allow.pomodoro},sessions:sessions.slice(0,100),rooms,
      settings:{...(root.FakultetiPomodoro?.settings(options.settings)||{focus:25,short:5,long:15,every:4,goal:4,autoBreak:true,autoFocus:false}),notify:!!options.settings?.notify,sound:options.settings?.sound!==false,vibrate:options.settings?.vibrate!==false},
      pomo:allow.pomodoro?{phase:['focus','short','long'].includes(p.phase)?p.phase:'focus',total,left:Math.max(0,Math.min(total,Number(p.left)||0)),endsAt:Number(p.endsAt)>0?Number(p.endsAt):0,cycle:Math.max(0,Number(p.cycle)||0),taskId:clean(p.taskId,120),task:clean(options.task),done:!!p.done}:null};
  }
  function useBridge(options){
    const {useEffect,useRef}=React;
    const latest=useRef(options),bridge=useRef({ack:'',override:null,last:'',ready:false});latest.current=options;
    const publish=()=>{
      const native=root.fakultetiAndroid,state=bridge.current;if(!native?.widgetsSupported||!state.ready)return;
      const current=latest.current;
      if(!current.scope||root.FakultetiApprovals?.policy?.status!=='approved'){native.send('widget-clear');return;}
      const value=snapshot(current);if(state.override)value.pomo=state.override;
      value.ack=state.ack;const payload=JSON.stringify(value);
      // State changes and explicit requests publish immediately; the interval is only a safety refresh.
      if(payload!==state.last){state.last=payload;native.send('widget-state:'+payload);}
    };
    const publishRef=useRef(publish);publishRef.current=publish;
    useEffect(()=>{
      const state=bridge.current;
      const connect=()=>{if(root.fakultetiAndroid?.widgetsSupported){state.ready=false;root.fakultetiAndroid.send('widget-ready');}};
      const sync=()=>{state.ready=true;publishRef.current();latest.current.onHydrated?.();};
      const command=event=>{
        const item=event.detail,current=latest.current;
        if(!item||item.scope!==current.scope)return;
        if(item.kind==='pomo'&&current.allow.pomodoro&&item.id&&item.pomo){
          const p=item.pomo;if(!['focus','short','long'].includes(p.phase)||!Number.isFinite(p.total)||p.total<1||p.total>10800||!Number.isFinite(p.left)||p.left<0||p.left>p.total||!Number.isFinite(p.endsAt)||p.endsAt<0||p.endsAt>Date.now()+10800000)return;
          if(current.onPomo?.(p,item.completions||[])===false)return;
          state.ack=item.id;state.override=p;publishRef.current();
        }else if(item.kind==='open'){
          const permitted=item.target==='schedule'?current.allow.schedule:item.target==='rooms'?current.allow.rooms:item.target==='pomodoro'?current.allow.pomodoro:false;
          if(permitted){current.onOpen?.(item.target);if(item.target==='rooms'&&item.refresh)current.store.refresh({force:true}).then(()=>publishRef.current());}
        }
      };
      const visible=()=>{if(!document.hidden){connect();publishRef.current();}};
      root.addEventListener('fakulteti:android-ready',connect);root.addEventListener('fakulteti:widget-sync',sync);root.addEventListener('fakulteti:widget-command',command);
      document.addEventListener('visibilitychange',visible);root.addEventListener('pageshow',visible);
      const store=latest.current.store,off=store?.subscribe(()=>publishRef.current()),offSync=store?.subscribeSync(()=>publishRef.current());
      const timer=setInterval(()=>publishRef.current(),60000);connect();
      return()=>{clearInterval(timer);off?.();offSync?.();root.removeEventListener('fakulteti:android-ready',connect);root.removeEventListener('fakulteti:widget-sync',sync);root.removeEventListener('fakulteti:widget-command',command);document.removeEventListener('visibilitychange',visible);root.removeEventListener('pageshow',visible);};
    },[options.scope]);
    const stateKey=JSON.stringify([options.pomo,options.settings,options.task,options.allow,options.revision]);
    useEffect(()=>{bridge.current.override=null;publishRef.current();},[stateKey]);
  }
  root.FakultetiWidgets=Object.freeze({snapshot,stamp,days,useBridge});
})(window);
