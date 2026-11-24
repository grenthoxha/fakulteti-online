/* Account-scoped groups and conversations. No network requests or account-directory access. */
(function(root) {
  'use strict';
  const fail = code => { throw Object.assign(new Error(code), {code}); };
  const clean = (value, max, required=false) => {
    const text=String(value||'').normalize('NFC').trim();
    if(text.length>max || (required&&!text))fail('INVALID_DETAILS');
    return text;
  };
  const photo = (value, max=180000) => {
    if(!value)return '';
    if(typeof value!=='string'||value.length>max||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value))fail('INVALID_PHOTO');
    return value;
  };
  const email = value => {
    const result=clean(value,254).toLowerCase();
    if(result&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result))fail('INVALID_EMAIL');
    return result;
  };
  const uid = () => root.crypto.randomUUID();
  const DEFAULT_GROUP_PHOTO='./assets/fakulteti-online-logo.png';
  const groupPhoto=value=>!value||value===DEFAULT_GROUP_PHOTO?DEFAULT_GROUP_PHOTO:photo(value);
  function createStore() {
    const accounts=root.FakultetiLocalAccounts, actor=accounts?.current();
    if(!actor?.id)fail('SESSION_CHANGED');
    const scope=accounts.databaseName('local-messages-v1');
    const guard=()=>{if(closed||accounts.current()?.id!==actor.id)fail('SESSION_CHANGED');};
    const active=new Set(), subscribers=new Set();let opening=null, connection=null, closed=false;
    const channel=typeof root.BroadcastChannel==='function'?new root.BroadcastChannel(scope):null;
    if(channel)channel.onmessage=()=>{if(!closed&&accounts.current()?.id===actor.id)subscribers.forEach(fn=>fn());};
    const changed=()=>{try{channel?.postMessage('changed');}catch{}subscribers.forEach(fn=>{try{fn();}catch{}});};
    const open=()=>{
      guard();if(closed)fail('SESSION_CHANGED');if(opening)return opening;
      if(!root.indexedDB)fail('STORAGE_UNAVAILABLE');
      opening=new Promise((resolve,reject)=>{
        const request=root.indexedDB.open('fakulteti-'+scope,1);
        request.onupgradeneeded=()=>{
          const db=request.result;
          db.createObjectStore('rooms',{keyPath:'id'});
          const messages=db.createObjectStore('messages',{keyPath:'id'});
          messages.createIndex('roomTime',['roomId','createdAt','id']);
          messages.createIndex('roomId','roomId');
          db.createObjectStore('drafts',{keyPath:'roomId'});
        };
        request.onerror=()=>{opening=null;reject(Object.assign(new Error('STORAGE_UNAVAILABLE'),{code:'STORAGE_UNAVAILABLE'}));};
        request.onblocked=()=>{opening=null;reject(Object.assign(new Error('STORAGE_BLOCKED'),{code:'STORAGE_BLOCKED'}));};
        request.onsuccess=()=>{
          connection=request.result;
          if(closed||accounts.current()?.id!==actor.id){connection.close();reject(Object.assign(new Error('SESSION_CHANGED'),{code:'SESSION_CHANGED'}));return;}
          connection.onversionchange=()=>{connection.close();connection=null;opening=null;};
          resolve(connection);
        };
      });return opening;
    };
    async function transaction(names, mode, work) {
      const db=await open();guard();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction(names,mode);active.add(tx);let result,error;
        const abort=e=>{error=e;try{tx.abort();}catch{}};
        const step=fn=>event=>{try{guard();fn(event.target.result);}catch(e){abort(e);}};
        tx.oncomplete=()=>{active.delete(tx);try{guard();if(mode==='readwrite')changed();resolve(result);}catch(e){reject(e);}};
        tx.onabort=()=>{active.delete(tx);const code=typeof error?.code==='string'?error.code:((error?.name==='QuotaExceededError'||tx.error?.name==='QuotaExceededError')?'STORAGE_FULL':'STORAGE_UNAVAILABLE');reject(Object.assign(new Error(code,{cause:error||tx.error}),{code}));};
        try{work(tx,step,value=>{result=value;});}catch(e){abort(e);}
      });
    }
    const getRoom=(tx,step,id,fn)=>{
      tx.objectStore('rooms').get(id).onsuccess=step(room=>{
        if(!room||!room.members.some(m=>m.id===actor.id))fail('GROUP_NOT_FOUND');if(!room.photo)room.photo=DEFAULT_GROUP_PHOTO;fn(room);
      });
    };
    const requireOwner=room=>{if(room.ownerId!==actor.id)fail('OWNER_REQUIRED');};
    const me=()=>({id:actor.id,name:clean(accounts.storage.getItem('u_real_name')||accounts.storage.getItem('u_name')||actor.email,160,true),email:actor.email,role:'owner',photo:accounts.storage.getItem('u_profile_photo')||''});
    const api={
      scope,actorId:actor.id,
      subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},
      list:()=>transaction(['rooms'],'readonly',(tx,step,done)=>{tx.objectStore('rooms').getAll().onsuccess=step(rooms=>done(rooms.filter(r=>r.members.some(m=>m.id===actor.id)).map(r=>({...r,photo:r.photo||DEFAULT_GROUP_PHOTO})).sort((a,b)=>b.updatedAt-a.updatedAt)));}),
      create:details=>transaction(['rooms'],'readwrite',(tx,step,done)=>{
        const store=tx.objectStore('rooms');
        store.count().onsuccess=step(count=>{
          if(count>=50)fail('GROUP_LIMIT');
          const now=Date.now(),room={id:uid(),name:clean(details.name,80,true),description:clean(details.description,500),photo:groupPhoto(details.photo),members:[me()],ownerId:actor.id,createdAt:now,updatedAt:now,lastMessage:null};
          store.add(room);done(room);
        });
      }),
      update:(id,details)=>transaction(['rooms'],'readwrite',(tx,step,done)=>getRoom(tx,step,id,room=>{
        requireOwner(room);room={...room,name:clean(details.name,80,true),description:clean(details.description,500),photo:groupPhoto(details.photo),updatedAt:Date.now()};tx.objectStore('rooms').put(room);done(room);
      })),
      saveMember:(id,details,memberId)=>transaction(['rooms'],'readwrite',(tx,step,done)=>getRoom(tx,step,id,room=>{
        requireOwner(room);if(memberId===room.ownerId)fail('OWNER_REQUIRED');
        if(memberId&&!room.members.some(m=>m.id===memberId))fail('MEMBER_NOT_FOUND');
        if(!memberId&&room.members.length>=50)fail('MEMBER_LIMIT');
        const member={id:memberId||uid(),name:clean(details.name,80,true),email:email(details.email),photo:photo(details.photo),role:details.role==='admin'?'admin':'member'};
        const fold=v=>v.normalize('NFC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
        if(room.members.some(m=>m.id!==member.id&&((member.email&&m.email===member.email)||(!member.email&&fold(m.name)===fold(member.name)))))fail('MEMBER_EXISTS');
        room={...room,members:memberId?room.members.map(m=>m.id===memberId?member:m):[...room.members,member],updatedAt:Date.now()};tx.objectStore('rooms').put(room);done(room);
      })),
      removeMember:(id,memberId)=>transaction(['rooms'],'readwrite',(tx,step,done)=>getRoom(tx,step,id,room=>{
        requireOwner(room);if(memberId===room.ownerId)fail('OWNER_REQUIRED');
        room={...room,members:room.members.filter(m=>m.id!==memberId),updatedAt:Date.now()};tx.objectStore('rooms').put(room);done(room);
      })),
      messages:(id,before=Number.MAX_SAFE_INTEGER)=>transaction(['rooms','messages','drafts'],'readonly',(tx,step,done)=>getRoom(tx,step,id,room=>{
        const items=[];let draft='',draftPhoto='',finished=false;
        const finish=()=>{if(finished)done({room,items:items.slice(0,100).reverse(),hasMore:items.length>100,draft,draftPhoto});};
        tx.objectStore('drafts').get(id).onsuccess=step(value=>{draft=value?.text||'';draftPhoto=value?.photo||'';finish();});
        const range=root.IDBKeyRange.bound([id,0,''],[id,before,'']);
        tx.objectStore('messages').index('roomTime').openCursor(range,'prev').onsuccess=step(cursor=>{
          if(cursor&&items.length<101){items.push(cursor.value);cursor.continue();}
          else{finished=true;finish();}
        });
      })),
      saveDraft:(id,text,image='')=>transaction(['rooms','drafts'],'readwrite',(tx,step,done)=>getRoom(tx,step,id,()=>{
        const value=String(text||'');if(value.length>4000)fail('MESSAGE_LENGTH');
        image=photo(image,1200000);
        if(value||image)tx.objectStore('drafts').put({roomId:id,text:value,photo:image});else tx.objectStore('drafts').delete(id);done(true);
      })),
      send:(id,details)=>transaction(['rooms','messages','drafts'],'readwrite',(tx,step,done)=>getRoom(tx,step,id,room=>{
        const text=clean(details.text,4000),image=photo(details.photo,1200000);if(!text&&!image)fail('EMPTY_MESSAGE');
        const createdAt=Math.max(Date.now(),(room.lastMessage?.createdAt||0)+1),message={id:uid(),roomId:id,authorId:actor.id,authorName:me().name,text,photo:image,createdAt};
        tx.objectStore('messages').add(message);tx.objectStore('drafts').delete(id);
        tx.objectStore('rooms').put({...room,updatedAt:createdAt,lastMessage:{id:message.id,text:text.slice(0,100),hasPhoto:Boolean(image),createdAt}});done(message);
      })),
      removeMessage:(roomId,id)=>transaction(['rooms','messages'],'readwrite',(tx,step,done)=>getRoom(tx,step,roomId,room=>{
        const store=tx.objectStore('messages');store.get(id).onsuccess=step(message=>{
          if(!message||message.roomId!==roomId)fail('MESSAGE_NOT_FOUND');
          if(message.authorId!==actor.id&&room.ownerId!==actor.id)fail('OWNER_REQUIRED');
          store.delete(id);
          const range=root.IDBKeyRange.bound([roomId,0,''],[roomId,Number.MAX_SAFE_INTEGER,'\uffff']);
          store.index('roomTime').openCursor(range,'prev').onsuccess=step(cursor=>{
            const last=cursor?.value;tx.objectStore('rooms').put({...room,lastMessage:last?{id:last.id,text:last.text.slice(0,100),hasPhoto:Boolean(last.photo),createdAt:last.createdAt}:null,updatedAt:Date.now()});done(true);
          });
        });
      })),
      remove:id=>transaction(['rooms','messages','drafts'],'readwrite',(tx,step,done)=>getRoom(tx,step,id,room=>{
        requireOwner(room);tx.objectStore('rooms').delete(id);tx.objectStore('drafts').delete(id);
        tx.objectStore('messages').index('roomId').openCursor(root.IDBKeyRange.only(id)).onsuccess=step(cursor=>{if(cursor){cursor.delete();cursor.continue();}});done(true);
      })),
      close(){closed=true;for(const tx of active){try{tx.abort();}catch{}}connection?.close();channel?.close();subscribers.clear();}
    };
    return Object.freeze(api);
  }
  async function preparePhoto(file,avatar=false) {
    if(!file||!/^image\/(jpeg|png|webp|gif)$/.test(file.type)||file.size>12*1024*1024)fail('INVALID_PHOTO');
    const url=root.URL.createObjectURL(file);
    try{
      const image=await new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Object.assign(new Error('INVALID_PHOTO'),{code:'INVALID_PHOTO'}));img.src=url;});
      const w=image.naturalWidth,h=image.naturalHeight;if(!w||!h||w*h>40000000)fail('INVALID_PHOTO');
      const canvas=root.document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)fail('INVALID_PHOTO');
      const edge=avatar?400:1400,scale=Math.min(1,edge/Math.max(w,h));
      canvas.width=avatar?400:Math.max(1,Math.round(w*scale));canvas.height=avatar?400:Math.max(1,Math.round(h*scale));
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
      if(avatar){const side=Math.min(w,h);ctx.drawImage(image,(w-side)/2,(h-side)/2,side,side,0,0,400,400);}else ctx.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [.82,.65,.48,.32]){const result=canvas.toDataURL('image/jpeg',quality);if(result.length<=(avatar?180000:1200000))return photo(result,avatar?180000:1200000);}
      fail('PHOTO_TOO_LARGE');
    }finally{root.URL.revokeObjectURL(url);}
  }
  root.FakultetiLocalMessages=Object.freeze({createStore,preparePhoto,DEFAULT_GROUP_PHOTO});
})(window);
