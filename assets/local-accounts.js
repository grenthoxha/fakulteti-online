/* Online accounts and profiles; learning storage retains its original device namespace. */
(function (root) {
  'use strict';
  const raw = root.localStorage;
  const cloud = root.FakultetiCloud;
  const USERS = 'fakulteti.local-accounts.v1';
  const SESSION = 'fakulteti.local-session.v1';
  const PREFIX = 'fakulteti.account.v1:';
  const ITERATIONS = 210000;
  const fail = code => { const error = new Error(code); error.code = code; throw error; };
  const read = key => { try { return JSON.parse(raw.getItem(key) || 'null'); } catch { return null; } };
  function registry() {
    const data = read(USERS);
    if (data === null && raw.getItem(USERS) === null) return { version: 1, accounts: [], legacyOwner: null };
    if (!data || data.version !== 1 || !Array.isArray(data.accounts)) fail('STORAGE_INVALID');
    return data;
  }
  const normalizeEmail = value => String(value || '').trim().normalize('NFC').toLowerCase();
  const validEmail = email => email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
  const checkPassword = password => { if (typeof password !== 'string' || password.length < 8 || password.length > 128) fail('PASSWORD_LENGTH'); };
  const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  const unhex = value => new Uint8Array(String(value).match(/.{1,2}/g).map(b => parseInt(b, 16)));
  function cryptoApi() {
    if (!root.crypto?.subtle || !root.crypto?.getRandomValues) fail('CRYPTO_UNAVAILABLE');
    return root.crypto;
  }
  const random = size => hex(cryptoApi().getRandomValues(new Uint8Array(size)));
  const digest = async text => hex(await cryptoApi().subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const passwordHash = async (password, salt, iterations = ITERATIONS) => {
    const api = cryptoApi();
    const key = await api.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return hex(await api.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(salt), iterations }, key, 256));
  };
  const equal = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  };
  const write = (key, value) => { try { raw.setItem(key, JSON.stringify(value)); } catch { fail('STORAGE_UNAVAILABLE'); } };
  const lock = work => root.navigator?.locks?.request ? root.navigator.locks.request('fakulteti-local-accounts', work) : Promise.resolve().then(work);
  const accountPrefix = id => PREFIX + id + ':';
  function current() {
    try {
      const session = read(SESSION);
      const account = registry().accounts.find(a => a.id === session?.id && a.revision === session?.revision);
      return account ? { id: account.id, email: account.email, importedLegacy: Boolean(account.importedLegacy) } : null;
    } catch { return null; }
  }
  const startupAccount = current();
  const startupSession = raw.getItem(SESSION);
  // A page retains its account namespace until reload, including late timer writes.
  // The explicitly imported legacy profile stays in place, avoiding a second
  // copy of photos/notes and storage-quota failures. Every other account uses its ID.
  const prefix = startupAccount && !startupAccount.importedLegacy ? accountPrefix(startupAccount.id) : '';
  const physical = key => prefix + String(key);
  const keys = () => {
    const all = [];
    for (let i = 0; i < raw.length; i++) {
      const key = raw.key(i);
      if (prefix ? key?.startsWith(prefix) : key && !key.startsWith('fakulteti.')) all.push(prefix ? key.slice(prefix.length) : key);
    }
    return all;
  };
  const storage = Object.freeze({
    get length() { return keys().length; },
    key(index) { return keys()[Number(index)] ?? null; },
    getItem(key) { return raw.getItem(physical(key)); },
    setItem(key, value) { raw.setItem(physical(key), String(value)); profileChanged(key); },
    removeItem(key) { raw.removeItem(physical(key)); profileChanged(key); },
    clear() { for (const key of keys()) raw.removeItem(physical(key)); }
  });
  function legacyProfile() {
    try {
      if (registry().legacyOwner) return null;
      const name = raw.getItem('u_real_name') || raw.getItem('u_name');
      return name ? { name } : null;
    } catch { return null; }
  }
  function startSession(account) {
    write(SESSION, { id: account.id, revision: account.revision });
  }
  async function register(email, password, importLegacy = false, profile = null) {
    if(root.FakultetiOnlineAccountsRequired && !cloud)fail('SERVICE_UNAVAILABLE');
    email = normalizeEmail(email);
    if (!validEmail(email)) fail('EMAIL_INVALID');
    checkPassword(password);
    if (registry().accounts.some(a => a.email === email)) fail('EMAIL_EXISTS');
    if (profile && (!['male', 'female'].includes(profile.gender) || !['student', 'instructor', 'admin'].includes(profile.role) || !String(profile.firstName || '').trim() || !String(profile.lastName || '').trim())) fail('PROFILE_INVALID');
    const salt = random(16), recovery = random(24), id = random(16), revision = random(16);
    const [hash, recoveryHash] = await Promise.all([passwordHash(password, salt), digest(recovery)]);
    let online;
    if (cloud) online = await cloud.authenticate('register',email,password,{id,importedLegacy:false},{profile:{...(importLegacy ? cloud.profile({id,importedLegacy:true}) : {}),firstName:profile?.firstName,lastName:profile?.lastName,gender:profile?.gender,requestedRole:profile?.role === 'instructor' ? 'instructor' : 'student'}});
    const account = await lock(() => {
      const data = registry();
      if (data.accounts.some(a => a.email === email)) fail('EMAIL_EXISTS');
      if (importLegacy && (!legacyProfile() || data.legacyOwner)) fail('LEGACY_CLAIMED');
      const record = { id, email, salt, hash, iterations: ITERATIONS, recoveryHash, revision, importedLegacy: Boolean(importLegacy), createdAt: new Date().toISOString(), ...(online ? {cloudId:online.result.accountId} : {}) };
      const initial = profile ? {
        u_real_first_name: String(profile.firstName).trim(), u_real_last_name: String(profile.lastName).trim(),
        u_real_name: `${String(profile.firstName).trim()} ${String(profile.lastName).trim()}`,
        u_name: `${String(profile.firstName).trim()} ${String(profile.lastName).trim()}`,
        u_gender: profile.gender, u_role: profile.role
      } : {};
      const targetPrefix = importLegacy ? '' : accountPrefix(id);
      const previous = Object.keys(initial).map(key => [targetPrefix + key, raw.getItem(targetPrefix + key)]);
      try {
        for (const [key, value] of Object.entries(initial)) raw.setItem(targetPrefix + key, value);
        write(USERS, { ...data, accounts: [...data.accounts, record], legacyOwner: importLegacy ? id : data.legacyOwner });
      } catch (error) {
        for (const [key, value] of previous) {
          try { if (value === null) raw.removeItem(key); else raw.setItem(key, value); } catch {}
        }
        fail('STORAGE_UNAVAILABLE');
      }
      if (online) cloud.apply(record,online.result,online.who);
      return record;
    });
    return {
      email, recoveryCode: online?.result.recoveryCode || recovery.match(/.{8}/g).join('-'),
      complete() {
        const saved = registry().accounts.find(a => a.id === account.id && a.revision === account.revision);
        if (!saved) fail('SESSION_INVALID');
        startSession(saved);
      }
    };
  }
  async function signIn(email, password) {
    if(root.FakultetiOnlineAccountsRequired && !cloud)fail('SERVICE_UNAVAILABLE');
    email = normalizeEmail(email);
    if (cloud) return cloudSignIn(email,password);
    const account = registry().accounts.find(a => a.email === email);
    if (!account || typeof password !== 'string' || password.length > 128) fail('CREDENTIALS_INVALID');
    if (!Number.isInteger(account.iterations) || account.iterations < 100000 || account.iterations > 600000 || !/^[a-f0-9]{32}$/.test(account.salt)) fail('STORAGE_INVALID');
    if (!equal(await passwordHash(password, account.salt, account.iterations), account.hash)) fail('CREDENTIALS_INVALID');
    const saved = registry().accounts.find(a => a.id === account.id && a.revision === account.revision);
    if (!saved) fail('SESSION_INVALID');
    startSession(saved);
  }
  async function resetPassword(email, code, password) {
    if(root.FakultetiOnlineAccountsRequired && !cloud)fail('SERVICE_UNAVAILABLE');
    checkPassword(password);
    if (cloud) return cloudSignIn(normalizeEmail(email),password,code);
    const data = registry(), account = data.accounts.find(a => a.email === normalizeEmail(email));
    const normalized = String(code || '').toLowerCase().replace(/[\s-]/g, '');
    if (!account || !/^[a-f0-9]{48}$/.test(normalized) || !equal(await digest(normalized), account.recoveryHash)) fail('RECOVERY_INVALID');
    const salt = random(16), hash = await passwordHash(password, salt), revision = random(16);
    await lock(() => {
      const latest = registry();
      const saved = latest.accounts.find(a => a.id === account.id && a.revision === account.revision);
      if (!saved) fail('SESSION_INVALID');
      const changed = { ...saved, salt, hash, iterations: ITERATIONS, revision };
      write(USERS, { ...latest, accounts: latest.accounts.map(a => a.id === changed.id ? changed : a) });
      startSession(changed);
    });
  }

  async function cloudSignIn(email,password,code) {
    if (!validEmail(email)) fail('EMAIL_INVALID');
    const existing=registry().accounts.find(a=>a.email===email);
    const account=existing || {id:random(16),email,importedLegacy:false};
    let online;
    try {online=await cloud.authenticate(code ? 'recover':'login',email,password,account,code ? {code}:{});}
    catch(error) {
      if(code || error.code!=='CREDENTIALS_INVALID' || !existing || existing.cloudId)throw error;
      // Claim a legacy account only after its local password and signed device both verify.
      if(!equal(await passwordHash(password,existing.salt,existing.iterations),existing.hash))fail('CREDENTIALS_INVALID');
      try { online=await cloud.authenticate('register',email,password,existing,{profile:cloud.profile(existing),recoveryHash:existing.recoveryHash}); }
      catch(migrationError){if(migrationError.code==='EMAIL_EXISTS')fail('CLOUD_PASSWORD_REQUIRED');throw migrationError;}
    }
    const salt=random(16),hash=await passwordHash(password,salt),revision=random(16);
    const record={...account,salt,hash,iterations:ITERATIONS,revision,cloudId:online.result.accountId,createdAt:account.createdAt||new Date().toISOString()};
    await lock(()=>{
      const data=registry();
      if(existing?.cloudId && raw.getItem((existing.importedLegacy?'':accountPrefix(existing.id))+'u_cloud_profile_dirty')==='1') {
        raw.setItem((existing.importedLegacy?'':accountPrefix(existing.id))+'u_approval_device_v1',JSON.stringify(online.who));
      } else cloud.apply(record,online.result,online.who);
      write(USERS,{...data,accounts:[...data.accounts.filter(a=>a.email!==email),record]});
      startSession(record);
    });
  }
  let syncTimer, syncing=null;
  function profileChanged(key) {
    if(!cloud || !startupAccount || !Object.values(cloud.fields).includes(String(key)))return;
    if(!registry().accounts.find(a=>a.id===startupAccount.id)?.cloudId)return;
    storage.setItem('u_cloud_profile_dirty','1');
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>syncProfile().catch(error=>root.dispatchEvent(new CustomEvent('fakulteti:cloud-error',{detail:error.code||error.message}))),900);
  }
  async function syncProfile(rebase = false) {
    if(syncing)return syncing;
    const account=registry().accounts.find(a=>a.id===startupAccount?.id);
    if(!cloud || !account?.cloudId)return;
    syncing=(async()=>{
      const who=await cloud.identity(account),dirty=storage.getItem('u_cloud_profile_dirty')==='1';
      if(rebase && dirty) {
        const latest=await cloud.call(who,'/api/cloud/profile');
        storage.setItem('u_cloud_profile_version',latest.profileVersion);
      }
      const snapshot=cloud.profile(account);
      const result=await cloud.call(who,'/api/cloud/profile',dirty?'PATCH':'GET',dirty?{version:Number(storage.getItem('u_cloud_profile_version')),profile:snapshot}:undefined);
      const currentProfile=cloud.profile(account);
      // Preserve edits made while this request was in flight.
      if (Object.keys(snapshot).some(key=>snapshot[key]!==currentProfile[key])) {
        storage.setItem('u_cloud_profile_version',result.profileVersion);
        storage.setItem('u_cloud_profile_dirty','1');
        syncTimer=setTimeout(()=>syncProfile().catch(()=>{}),900);
        return result;
      }
      const changed=Object.keys(result.profile).some(key=>String(currentProfile[key]||'')!==String(result.profile[key]||''));
      cloud.apply(account,result);
      if(!dirty && changed)root.location.reload();
      return result;
    })().catch(error=>{
      if(error.code==='SESSION_REVOKED'){signOut();root.location.reload();}
      throw error;
    }).finally(()=>{syncing=null;});
    return syncing;
  }

  function signOut() {
    root.dispatchEvent?.(new CustomEvent('fakulteti:cloud-signout'));
    root.fakultetiAndroid?.send('notification-clear');root.fakultetiAndroid?.send('widget-clear');
    raw.removeItem(SESSION);
  }
  root.addEventListener('storage', event => {
    if ((event.key === SESSION || event.key === null || event.key === USERS) && raw.getItem(SESSION) !== startupSession) {
      root.fakultetiAndroid?.send('notification-clear');root.fakultetiAndroid?.send('widget-clear');
      root.location.reload();
    } else if (event.key === USERS && startupAccount && !current()) {
      signOut(); root.location.reload();
    }
  });
  root.FakultetiLocalAccounts = Object.freeze({
    storage, current, legacyProfile, register, signIn, signOut, resetPassword, syncProfile,
    isOnline() { return Boolean(registry().accounts.find(a=>a.id===current()?.id)?.cloudId); },
    databaseName(base) { return startupAccount && !startupAccount.importedLegacy ? base + '-' + startupAccount.id : base; }
  });
})(window);
