/* Refresh data without navigating, remounting the app, or intercepting reader gestures. */
(function(root){
  'use strict';
  const THRESHOLD=88;
  const excluded='input,textarea,select,iframe,canvas,video,audio,[contenteditable="true"],[data-no-pull-refresh],.cm-reader,.course-video-stories,.pomo-surface';
  function bind({document:doc=root.document,window:win=root,refresh,onUpdate}){
    let gesture=null,job=null,closed=false,settleTimer=null,suppressUntil=0,suppressTarget=null;
    let state={phase:'idle',distance:0,top:64};
    const clock=()=>win.performance?.now?.()??Date.now();
    const emit=value=>{if(!closed){state={...state,...value};onUpdate(state);}};
    const top=()=>Math.max(0,doc.querySelector('header.app-header,.bujar-rooms-header')?.getBoundingClientRect().bottom||64);
    const blocked=()=>doc.hidden||doc.body.style.overflow==='hidden'||Boolean(doc.querySelector('[aria-modal="true"],.course-video-stories,.pomo-surface'));
    const atTop=target=>{
      if(Number(doc.scrollingElement?.scrollTop||win.scrollY||0)>1)return false;
      for(let node=target;node&&node!==doc.documentElement;node=node.parentElement)if(Number(node.scrollTop||0)>1)return false;
      return true;
    };
    const reset=()=>{gesture=null;emit({phase:'idle',distance:0});};
    const finish=ok=>{
      if(closed)return;
      emit({phase:ok?'success':'error',distance:48});
      settleTimer=win.setTimeout(()=>emit({phase:'idle',distance:0}),ok?650:3000);
    };
    const run=()=>{
      if(job)return job;
      if(closed)return Promise.resolve({ok:false});
      win.clearTimeout(settleTimer);gesture=null;emit({phase:'loading',distance:48,top:top()});
      job=Promise.resolve().then(()=>refresh()).then(result=>{finish(result?.ok!==false);return result;},()=>{finish(false);return{ok:false};}).finally(()=>{job=null;});
      return job;
    };
    const start=event=>{
      if(gesture)reset();
      if(job||blocked()||event.touches?.length!==1){gesture=null;return;}
      const target=event.target?.nodeType===3?event.target.parentElement:event.target;
      if(!target?.closest||target.closest(excluded)||!target.closest('main.app-main,.bujar-rooms-shell main')||!atTop(target))return;
      win.clearTimeout(settleTimer);
      const touch=event.touches[0];gesture={x:touch.clientX,y:touch.clientY,target,active:false,dy:0};
      emit({phase:'idle',distance:0,top:top()});
    };
    const move=event=>{
      if(!gesture)return;
      if(event.touches?.length!==1||blocked()||!atTop(gesture.target)){reset();return;}
      const touch=event.touches[0],dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y;
      if(!gesture.active){
        if(Math.max(Math.abs(dx),Math.abs(dy))<10)return;
        if(dy<=0||Math.abs(dx)>dy*.7){reset();return;}
        gesture.active=true;
      }
      if(!event.cancelable){reset();return;}
      event.preventDefault();suppressUntil=clock()+450;suppressTarget=gesture.target.closest('button,a,summary,[role="button"]');gesture.dy=Math.max(0,dy);
      emit({phase:dy>=THRESHOLD?'armed':'pulling',distance:Math.min(68,Math.max(0,dy)*.55)});
    };
    const end=()=>{
      if(!gesture)return;
      const ready=gesture.active&&gesture.dy>=THRESHOLD&&!blocked()&&atTop(gesture.target);gesture=null;
      if(ready)run();else reset();
    };
    const cancel=()=>{if(gesture)reset();};
    const click=event=>{if(clock()<suppressUntil&&suppressTarget?.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}};
    const resize=()=>{if(state.phase!=='idle')emit({top:top()});};
    const hide=()=>{if(doc.hidden)cancel();};
    doc.addEventListener('touchstart',start,{passive:true,capture:true});
    doc.addEventListener('touchmove',move,{passive:false,capture:true});
    doc.addEventListener('touchend',end,{passive:true,capture:true});
    doc.addEventListener('touchcancel',cancel,{passive:true,capture:true});
    doc.addEventListener('click',click,true);doc.addEventListener('visibilitychange',hide);
    win.addEventListener('resize',resize);
    return{refresh:run,dispose(){closed=true;gesture=null;win.clearTimeout(settleTimer);
      doc.removeEventListener('touchstart',start,true);doc.removeEventListener('touchmove',move,true);doc.removeEventListener('touchend',end,true);doc.removeEventListener('touchcancel',cancel,true);
      doc.removeEventListener('click',click,true);doc.removeEventListener('visibilitychange',hide);win.removeEventListener('resize',resize);
    }};
  }
  root.FakultetiPullRefresh=Object.freeze({bind});
  const React=root.React;if(!React)return;
  const h=React.createElement;
  root.FakultetiAppRefresh=function AppRefresh({onRefresh}){
    const[state,setState]=React.useState({phase:'idle',distance:0,top:64}),controller=React.useRef(null);
    React.useEffect(()=>{
      const control=bind({refresh:onRefresh,onUpdate:setState});controller.current=control;
      root.document.documentElement.classList.add('app-pull-ready');
      return()=>{control.dispose();controller.current=null;root.document.documentElement.classList.remove('app-pull-ready');};
    },[onRefresh]);
    const{phase,distance,top}=state,busy=phase==='loading',visible=phase!=='idle';
    const labels={idle:'Rifresko faqen',pulling:'Tërhiq poshtë për rifreskim',armed:'Lësho për rifreskim',loading:'Po rifreskohet',success:'U rifreskua',error:'Rifreskimi nuk u krye. Provo përsëri'};
    const path=phase==='success'?'M5 12l4 4L19 6':phase==='error'?'M12 7v6M12 17h.01M12 3l10 18H2z':'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-2L20 7M4 17l2.3 2a7 7 0 0 0 11.6-2';
    return h('div',{className:`app-pull-refresh is-${phase}`,'aria-hidden':!visible,style:{top:top+8,opacity:visible?Math.min(1,distance/30):0,transform:`translateY(${visible?Math.min(24,distance*.35):-12}px)`}},
      h('span',{className:'app-pull-announcement',role:'status','aria-live':'polite'},visible?labels[phase]:''),
      h('button',{type:'button',tabIndex:visible?0:-1,disabled:busy,'aria-busy':busy,'aria-label':labels[phase],title:labels[phase],onClick:()=>controller.current?.refresh()},
        h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,className:busy?'is-spinning':undefined,style:!busy&&['pulling','armed'].includes(phase)?{transform:`rotate(${distance*3}deg)`}:undefined},
          busy?h('circle',{cx:12,cy:12,r:8,strokeDasharray:'36 51'}):h('path',{d:path}))));
  };
})(window);
