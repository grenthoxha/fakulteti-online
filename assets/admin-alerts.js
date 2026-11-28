/* Verified administrator only. APK background checks are separate from study reminders. */
(function(root){
  'use strict';
  const api=root.FakultetiApprovals,accounts=root.FakultetiLocalAccounts,KEY='u_admin_alerts_v1';
  if(!api||!accounts)return;
  let syncing=null,state={enabled:false,registered:false,permission:false},error='';
  const supported=()=>Boolean(root.fakultetiAndroid?.adminApprovalsSupported);
  const read=()=>{try{return JSON.parse(accounts.storage.getItem(KEY)||'{}');}catch{return {};}};
  const write=value=>accounts.storage.setItem(KEY,JSON.stringify(value));
  const emit=()=>root.dispatchEvent(new CustomEvent('fakulteti:admin-alerts',{detail:snapshot()}));
  const snapshot=()=>({...state,supported:supported(),wanted:read().enabled!==false,error});
  const send=command=>root.fakultetiAndroid?.send(command);
  async function sync(requestPermission=false){
    if(!api.policy)return; // Keep a cold notification tap until the account has been verified.
    if(!api.isAdmin()){send('approval-alerts-clear');state={enabled:false,registered:false,permission:false};emit();return;}
    if(!supported()){emit();return;}
    if(read().enabled===false){send('approval-alerts-clear');emit();return;}
    if(syncing){await syncing;if(requestPermission&&api.isAdmin())send('approval-alerts-permission');return;}
    const accountId=accounts.current()?.id;
    syncing=(async()=>{
      try{
        let saved=read();
        if(!saved.grant||saved.grant.expires<Date.now()+86400000){
          const grant=await api.alertsEnroll();
          if(!/^[a-f0-9]{64}$/.test(grant.deviceId)||!/^[a-f0-9]{64}$/.test(grant.token)||!Number.isSafeInteger(grant.expires))throw Error('INVALID_GRANT');
          if(!api.isAdmin()||accounts.current()?.id!==accountId||read().enabled===false)return;
          saved={enabled:true,grant};write(saved);
        }
        if(!api.isAdmin()||accounts.current()?.id!==accountId)return;
        send('approval-alerts-sync:'+JSON.stringify(saved.grant));
        send('approval-alerts-ready:'+saved.grant.deviceId);
        send('approval-alerts-state');
        if(requestPermission)send('approval-alerts-permission');
        error='';emit();
      }catch{error='Lidhja e njoftimeve nuk u krye. Provo përsëri me internet.';emit();}
    })().finally(()=>{syncing=null;});
    return syncing;
  }
  async function enable(){write({...read(),enabled:true});await sync(true);}
  async function disable(){write({enabled:false});state={enabled:false,registered:false,permission:state.permission};send('approval-alerts-clear');emit();try{await api.alertsRevoke();}catch{}}
  root.addEventListener('fakulteti:approval',()=>sync());
  root.addEventListener('fakulteti:android-ready',()=>sync());
  root.addEventListener('fakulteti:approval-alerts-state',event=>{if(!api.isAdmin())return;state=event.detail||{};emit();});
  root.addEventListener('fakulteti:approval-alerts-open',event=>{
    if(api.isAdmin()&&event.detail===read().grant?.deviceId){root.dispatchEvent(new CustomEvent('fakulteti:manage-accounts'));}
  });
  root.addEventListener('fakulteti:requests-updated',()=>{if(api.isAdmin()&&read().enabled!==false&&supported())send('approval-alerts-check');});
  root.addEventListener('fakulteti:cloud-signout',()=>{const wasAdmin=api.isAdmin();send('approval-alerts-clear');write({enabled:read().enabled!==false});state={enabled:false,registered:false,permission:false};if(wasAdmin)api.alertsRevoke().catch(()=>{});});
  root.FakultetiAdminAlerts={sync,enable,disable,snapshot};
  root.FakultetiAdminAlertsControl=function AdminAlertsControl(){
    const h=root.React.createElement,[value,setValue]=root.React.useState(snapshot),[busy,setBusy]=root.React.useState(false);
    root.React.useEffect(()=>{const update=()=>setValue(snapshot());root.addEventListener('fakulteti:admin-alerts',update);sync();return()=>root.removeEventListener('fakulteti:admin-alerts',update);},[]);
    if(!api.isAdmin())return null;
    const toggle=async()=>{setBusy(true);try{await(value.enabled?disable():enable());}finally{setBusy(false);setValue(snapshot());}};
    return h('div',{className:'approval-alert-settings'},h('div',null,h('strong',null,'Njoftimet në telefon'),h('p',null,value.supported?(value.enabled?'Aktive · Kontroll rreth çdo 15 minuta, edhe kur APK-ja është e mbyllur.':'Lejo njoftimet për të marrë kërkesat e reja për aprovim.'):'Për këtë mundësi nevojitet APK-ja 1.0.10 ose më e re.'),value.error&&h('p',{role:'alert',className:'approval-error'},value.error)),
      value.supported?h('button',{type:'button',className:'approval-secondary',disabled:busy,onClick:toggle,'aria-pressed':value.enabled},busy?'Po lidhet…':value.enabled?'Ndali':'Aktivizo'):h('a',{className:'approval-secondary',href:'https://github.com/grenthoxha/fakulteti-online/releases/download/v1.0.10-android-preview/Fakulteti-Online.apk'},'Përditëso APK-në'));
  };
})(window);
