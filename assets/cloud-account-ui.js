(function(root) {
  'use strict';
  const h=React.createElement, {useState,useEffect}=React,accounts=root.FakultetiLocalAccounts;
  root.FakultetiCloudAccountCard=function CloudAccountCard() {
    const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[dirty,setDirty]=useState(accounts.storage.getItem('u_cloud_profile_dirty')==='1'),[native,setNative]=useState(!!root.fakultetiFlutter);
    const online=accounts.isOnline();
    const explain=code=>({PROFILE_CHANGED:'Profili ndryshoi në pajisje tjetër. “Ruaj profilin tim” dërgon ndryshimet e kësaj pajisjeje.',CREDENTIALS_INVALID:'Fjalëkalimi nuk është i saktë.',CLOUD_PASSWORD_REQUIRED:'Përdor fjalëkalimin e llogarisë online; ai ndryshon nga fjalëkalimi i ruajtur në këtë pajisje.',MIGRATION_REQUIRED:'Lidhe nga pajisja ku e krijove llogarinë.',OWNER_LINK_REQUIRED:'Lidhe fillimisht administrimin nga kjo pajisje.',RATE_LIMITED:'Provo përsëri pas pak minutash.'}[code]||'Ruajtja online nuk u krye. Kontrollo internetin dhe provo përsëri.');
    useEffect(()=>{const error=e=>{setMessage(explain(e.detail));setDirty(true);};root.addEventListener('fakulteti:cloud-error',error);return()=>root.removeEventListener('fakulteti:cloud-error',error);},[]);
    useEffect(()=>{const ready=()=>setNative(true);root.addEventListener('fakulteti:flutter-ready',ready);return()=>root.removeEventListener('fakulteti:flutter-ready',ready);},[]);
    const submit=async e=>{
      e.preventDefault();if(busy)return;setBusy(true);setMessage('');
      try {
        if(online){await accounts.syncProfile(true);setDirty(false);setMessage('Profili u ruajt online.');}
        else {await accounts.signIn(accounts.current().email,password);setPassword('');root.location.reload();}
      }catch(error){setMessage(explain(error.code||error.message));}finally{setBusy(false);}
    };
    return h('section',{className:'profile-menu-group'},h('form',{className:'card-surface border rounded-2xl p-4 space-y-3',onSubmit:submit},
      h('strong',null,online?'Llogaria online':'Lidhe llogarinë online'),
      h('p',{className:'text-sm text-secondary'},'Profili dhe aprovimi ruhen online. Detyrat, shënimet, notat dhe PDF-të mbeten në këtë pajisje.'),
      !online&&h('label',{className:'local-auth-field'},h('span',null,'Fjalëkalimi aktual'),h('input',{type:'password',value:password,onChange:e=>setPassword(e.target.value),autoComplete:'current-password',required:true,maxLength:128,disabled:busy})),
      (!online||dirty)&&h('button',{type:'submit',className:'approval-primary',disabled:busy},busy?'Po ruhet…':online?'Ruaj profilin tim':'Lidh llogarinë'),
      message&&h('p',{role:'status',className:'text-sm'},message),
      native&&h('button',{type:'button',className:'approval-secondary',onClick:()=>root.fakultetiFlutter.demoNotification()},'Provo njoftimin në telefon')));
  };
})(window);
