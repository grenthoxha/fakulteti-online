/* Entry UX for phones; account permissions remain enforced by the server. */
(function(root){
  'use strict';
  function isPhone(nav){
    const ua=String(nav?.userAgent||'');
    if(/iPhone|iPod/i.test(ua))return true;
    return /Android/i.test(ua)&&(/Mobile/i.test(ua)||nav?.userAgentData?.mobile===true);
  }
  const allowed=isPhone(root.navigator);
  root.document.documentElement.setAttribute('data-phone-entry',allowed?'allowed':'blocked');
  const publicURL='https://grenthoxha.github.io/fakulteti-online/';
  function PhoneEntry(){
    const h=root.React.createElement,[copied,setCopied]=root.React.useState(false),[copyError,setCopyError]=root.React.useState(false);
    const copy=async()=>{try{await root.navigator.clipboard.writeText(publicURL);setCopied(true);setCopyError(false);}catch{setCopyError(true);}};
    return h('main',{className:'phone-entry-page'},h('section',{className:'phone-entry-card','aria-labelledby':'phone-entry-title'},
      h('div',{className:'phone-entry-brand'},h('img',{src:'./assets/fakulteti-online-logo.png',alt:'',width:38,height:38}),h('span',null,'Fakulteti')),
      h('div',{className:'phone-entry-device','aria-hidden':true},h('svg',{viewBox:'0 0 96 128',fill:'none'},h('rect',{x:16,y:5,width:64,height:116,rx:16,stroke:'currentColor',strokeWidth:3}),h('path',{d:'M37 14h22M39 111h18',stroke:'currentColor',strokeWidth:3,strokeLinecap:'round'}),h('path',{d:'m35 62 10 10 19-23',stroke:'currentColor',strokeWidth:4,strokeLinecap:'round',strokeLinejoin:'round'}))),
      h('h1',{id:'phone-entry-title'},'Kthehu në telefon'),
      h('p',{className:'phone-entry-description'},'Fakulteti është i disponueshëm vetëm në telefon. Hape në Android ose iPhone për të vazhduar.'),
      h('div',{className:'phone-entry-link'},h('span',null,'Hape këtë adresë në telefon'),h('p',null,'grenthoxha.github.io/fakulteti-online/')),
      h('button',{type:'button',onClick:copy,className:'phone-entry-copy'},copied?'Linku u kopjua':'Kopjo linkun'),
      h('p',{className:'phone-entry-feedback',role:'status'},copyError?'Mund ta kopjosh adresën më sipër.':copied?'Tani hape linkun në telefon.':'Android · iPhone')));
  }
  root.FakultetiPhoneEntry=Object.freeze({allowed,isPhone,View:PhoneEntry});
})(window);
