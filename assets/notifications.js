/* Local reminders: no exam titles, task data or schedules are uploaded. */
(function(root){
  'use strict';
  const HOUR=3600000,DAY=24*HOUR,ZONE='Europe/Tirane',KEY='u_notification_settings_v1';
  const clean=(v,n=180)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n);
  const defaults={enabled:false,exams:true,deadlines:true,schedule:true,routines:true};
  const settings=()=>{try{return {...defaults,...JSON.parse(root.FakultetiLocalAccounts.storage.getItem(KEY)||'{}')};}catch{return {...defaults};}};
  const update=value=>{root.FakultetiLocalAccounts.storage.setItem(KEY,JSON.stringify({...settings(),...value}));root.dispatchEvent(new Event('fakulteti:reminder-settings'));};
  root.addEventListener('fakulteti:reminders-permission',event=>{if(event.detail?.granted)update({enabled:true});});
  const stamp=(day,time)=>root.FakultetiWidgets.stamp(day,time);
  function plan(options,now=Date.now()){
    const prefs=options.settings||defaults,jobs=[];
    if(!prefs.enabled)return jobs;
    const add=(id,title,detail,at,target)=>{if(Number.isFinite(at)&&at>=now-60000&&at<=now+365*DAY)jobs.push({id:clean(id,215)+':'+at,title:clean(title),detail:clean(detail,500),at,target});};
    for(const d of options.deadlines||[]){
      if(d.completed||d.done||!/^\d{4}-\d\d-\d\d$/.test(d.date))continue;
      const exam=d.type==='exam';if(!(exam?prefs.exams:prefs.deadlines)||!(exam?options.allow?.exams:options.allow?.home))continue;
      const time=d.time||d.examTime||'',start=stamp(d.date,time||'09:00'),title=clean(d.title||'Afati');
      const detail=[d.date,time||'Pa orë të caktuar',d.room].filter(Boolean).join(' · '),id=exam?'exam':'deadline';
      add(`reminder:${id}:${d.id}:day`,`${exam?'Provimi':'Afati'} nesër: ${title}`,detail,start-DAY,'student');
      add(`reminder:${id}:${d.id}:soon`,`${exam?'Provim':'Afat'}: ${title}`,detail,start-(time?HOUR:0),'student');
    }
    const days=root.FakultetiWidgets.days(now,14);
    if(prefs.schedule&&options.allow?.schedule)for(const day of days){
      for(const s of options.getSessions?.(day.day||7,day.key)||[]){
        const at=stamp(day.key,s.start),lead=Math.max(0,Math.min(120,Number(s.reminderMinutes??15)));
        add(`reminder:schedule:${day.key}:${s.id||s.title}:${s.start}`,s.title||'Ligjërata',[s.start,s.room,'Sipas orarit të ruajtur'].filter(Boolean).join(' · '),at-lead*60000,'week');
      }
    }
    if(prefs.routines&&options.allow?.home)for(const r of options.routines||[]){
      if(!r.time||!r.reminder||r.reminder==='none'||((r.recurrence||'daily')==='once'&&r.completedAt))continue;
      const recurrence=r.recurrence||'daily';
      for(const day of days){
        const dow=day.day||7,due=r.date||day.key;
        if(r.deferredUntil&&day.key<r.deferredUntil)continue;
        if(recurrence==='once'&&day.key!==due)continue;
        if(recurrence==='weekdays'&&dow>5)continue;
        if(recurrence==='weekly'&&(day.key<due||new Date(due+'T12:00:00Z').getUTCDay()!==day.day))continue;
        if(recurrence==='custom_days'&&!(r.repeatDays||[]).includes(dow))continue;
        if((options.routineDone?.[day.key]||[]).includes(r.id))continue;
        const lead=({at:0,'10m':10,'30m':30,'1h':60})[r.reminder]??0;
        add(`reminder:routine:${r.id}:${day.key}`,r.title,[r.time,'Kujtesë për detyrën'].join(' · '),stamp(day.key,r.time)-lead*60000,'home');
      }
    }
    const ordered=[...new Map(jobs.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).map(j=>[j.id,j])).values()];
    const academic=ordered.filter(j=>/^reminder:(exam|deadline):/.test(j.id)).slice(0,40);
    return [...academic,...ordered.filter(j=>!academic.includes(j)).slice(0,60-academic.length)].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  }
  async function show(job,scope){
    if(!root.Notification||root.Notification.permission!=='granted')return false;
    const options={body:job.detail,icon:'./assets/fakulteti-online-logo-192.png',badge:'./assets/fakulteti-online-logo-192.png',tag:scope+':'+job.id,data:{scope,id:job.id,target:job.target}};
    const registration=await root.navigator.serviceWorker?.getRegistration?.();
    if(root.FakultetiLocalAccounts.current?.()===null)return false;
    if(registration){await registration.showNotification(job.title,options);return true;}
    const notification=new root.Notification(job.title,options);notification.onclick=()=>{root.focus?.();root.dispatchEvent(new CustomEvent('fakulteti:notification-open',{detail:job.id}));notification.close();};return true;
  }
  async function permission(){
    if(root.fakultetiAndroid?.scheduledRemindersSupported){root.fakultetiAndroid.send('reminders-permission');return 'pending';}
    if(root.fakultetiFlutter?.requestReminders){await root.fakultetiFlutter.requestReminders();return 'pending';}
    if(!root.Notification)return 'unsupported';
    const result=root.Notification.permission==='granted'?'granted':await root.Notification.requestPermission();
    if(result==='granted')update({enabled:true});
    return result;
  }
  function useBridge(options){
    const {useEffect,useRef}=root.React,latest=useRef(options),running=useRef(false);latest.current=options;
    useEffect(()=>{
      const storage=root.FakultetiLocalAccounts.storage;
      const update=async()=>{
        if(running.current)return;running.current=true;
        try{
          const current=latest.current,prefs=settings(),approved=!!root.FakultetiLocalAccounts.current()&&root.FakultetiApprovals?.policy?.status==='approved';
          const pending=root.__fakultetiPendingReminder;
          if(approved&&pending?.scope===current.scope&&typeof pending.id==='string'&&pending.id.startsWith('reminder:')){delete root.__fakultetiPendingReminder;root.dispatchEvent(new CustomEvent('fakulteti:notification-open',{detail:pending.id}));root.fakultetiFlutter?.ackReminder?.();}
          let jobs=approved?plan({...current,settings:prefs}):[];
          if(approved&&root.fakultetiFlutter&&current.pomoSettings?.notify&&Number(current.pomo?.endsAt)>Date.now()){
            jobs=[{id:'reminder:pomodoro:'+current.pomo.endsAt,title:current.pomo.phase==='focus'?'Fokusi përfundoi':'Pushimi përfundoi',detail:'Hape Pomodoro-n për fazën e radhës.',at:Number(current.pomo.endsAt),target:'home'},...jobs].slice(0,60);
          }
          const payload={schema:1,scope:current.scope,enabled:approved&&(prefs.enabled||jobs.some(j=>j.id.startsWith('reminder:pomodoro:'))),expires:Date.now()+365*DAY,jobs};
          if(root.fakultetiAndroid?.scheduledRemindersSupported){root.fakultetiAndroid.send('reminders-state:'+JSON.stringify(payload));return;}
          if(root.fakultetiFlutter?.syncReminders){root.fakultetiFlutter.syncReminders(payload);return;}
          let sent;try{sent=JSON.parse(storage.getItem('u_delivered_reminders_v1')||'[]');if(!Array.isArray(sent))sent=[];}catch{sent=[];}
          for(const job of jobs.filter(j=>j.at<=Date.now()&&j.at>Date.now()-60000&&!sent.includes(j.id))){
            if(await show(job,current.scope)){sent.push(job.id);storage.setItem('u_delivered_reminders_v1',JSON.stringify(sent.slice(-400)));}
          }
        }catch(error){root.dispatchEvent(new CustomEvent('fakulteti:reminder-error',{detail:'Kujtesa nuk u planifikua. Rihape app-in dhe kontrollo lejen e njoftimeve.'}));}
        finally{running.current=false;}
      };
      const visible=()=>{if(!root.document.hidden)update();};
      const signout=async()=>{try{const registration=await root.navigator.serviceWorker?.getRegistration?.();for(const notification of await registration?.getNotifications?.()||[])if(notification.data?.scope===options.scope)notification.close();}catch{}};
      root.addEventListener('fakulteti:cloud-signout',signout);
      const open=event=>{const value=event.data;if(value?.type==='fakulteti-reminder-open'&&value.scope===options.scope&&typeof value.id==='string'&&value.id.startsWith('reminder:'))root.dispatchEvent(new CustomEvent('fakulteti:notification-open',{detail:value.id}));};
      root.navigator.serviceWorker?.addEventListener('message',open);
      const query=new URLSearchParams(root.location.search),initial=query.get('reminder');
      if(initial&&query.get('reminderScope')===options.scope){setTimeout(()=>open({data:{type:'fakulteti-reminder-open',scope:options.scope,id:initial}}),0);query.delete('reminder');query.delete('reminderScope');root.history.replaceState(root.history.state,'',root.location.pathname+(query.size?'?'+query.toString():'')+root.location.hash);}
      root.addEventListener('fakulteti:reminder-settings',update);root.addEventListener('fakulteti:android-ready',update);root.addEventListener('fakulteti:flutter-ready',update);root.addEventListener('pageshow',visible);root.document.addEventListener('visibilitychange',visible);
      root.addEventListener('fakulteti:flutter-open',update);
      const off=options.store?.subscribe(update),timer=setInterval(update,20000);update();
      return()=>{clearInterval(timer);off?.();root.removeEventListener('fakulteti:cloud-signout',signout);root.removeEventListener('fakulteti:flutter-open',update);root.navigator.serviceWorker?.removeEventListener('message',open);root.removeEventListener('fakulteti:reminder-settings',update);root.removeEventListener('fakulteti:android-ready',update);root.removeEventListener('fakulteti:flutter-ready',update);root.removeEventListener('pageshow',visible);root.document.removeEventListener('visibilitychange',visible);};
    },[options.scope,JSON.stringify([options.deadlines,options.routines,options.routineDone,options.revision,options.allow,options.pomo,options.pomoSettings])]);
  }
  function Settings(){
    const h=root.React.createElement,{useState,useEffect}=root.React,[prefs,setPrefs]=useState(settings),[notice,setNotice]=useState('');
    const save=next=>{root.FakultetiLocalAccounts.storage.setItem(KEY,JSON.stringify(next));setPrefs(next);root.dispatchEvent(new Event('fakulteti:reminder-settings'));};
    useEffect(()=>{const granted=e=>{if(e.detail?.granted){save({...settings(),enabled:true});setNotice(e.detail.exact===false?'Njoftimet janë aktive. Lejo “Alarmet dhe kujtesat” për kohë më të saktë.':'Kujtesat u aktivizuan.');}else setNotice('Lejo njoftimet te cilësimet e telefonit.');};const error=e=>setNotice(e.detail);root.addEventListener('fakulteti:reminders-permission',granted);root.addEventListener('fakulteti:reminder-error',error);return()=>{root.removeEventListener('fakulteti:reminders-permission',granted);root.removeEventListener('fakulteti:reminder-error',error);};},[]);
    const toggle=async()=>{if(prefs.enabled){save({...prefs,enabled:false});setNotice('Kujtesat u ndalën.');return;}try{const result=await permission();if(result==='granted'){save({...prefs,enabled:true});setNotice('Kujtesat u aktivizuan.');}else if(result!=='pending')setNotice(result==='unsupported'?'Ky browser nuk mbështet njoftime. Përdor APK-në e përditësuar.':'Lejo njoftimet te cilësimet e browser-it.');}catch{setNotice('Leja e njoftimeve nuk u aktivizua.');}};
    return h('div',{className:'notification-demo-actions',style:{flexWrap:'wrap'}},h('button',{type:'button',onClick:toggle,'aria-pressed':prefs.enabled},prefs.enabled?'Ndali kujtesat':'Aktivizo kujtesat'),
      prefs.enabled&&['exams','deadlines','schedule','routines'].map((key,i)=>h('label',{key,style:{display:'inline-flex',gap:'6px',alignItems:'center',fontSize:'13px'}},h('input',{type:'checkbox',checked:prefs[key],onChange:e=>save({...prefs,[key]:e.target.checked})}),['Provimet','Afatet','Orari','Detyrat'][i])),
      h('small',{style:{flexBasis:'100%',lineHeight:1.4}},root.fakultetiAndroid?.scheduledRemindersSupported||root.fakultetiFlutter?'Kujtesat ruhen në telefon.':'Në browser kujtesat kontrollohen ndërsa app-i është i hapur. Për kujtesa me app-in të mbyllur përdor APK-në.'),notice&&h('small',{role:'status',style:{flexBasis:'100%'}},notice));
  }
  root.FakultetiNotifications=Object.freeze({plan,settings,update,permission,useBridge,Settings,show});
})(window);
