/* Device-local accounts. This is not server authentication or cross-device sync. */
(function (root) {
  'use strict';
  const raw = root.localStorage;
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
    setItem(key, value) { raw.setItem(physical(key), String(value)); },
    removeItem(key) { raw.removeItem(physical(key)); },
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
    email = normalizeEmail(email);
    if (!validEmail(email)) fail('EMAIL_INVALID');
    checkPassword(password);
    if (registry().accounts.some(a => a.email === email)) fail('EMAIL_EXISTS');
    if (profile && (!['male', 'female'].includes(profile.gender) || !['student', 'instructor', 'admin'].includes(profile.role) || !String(profile.firstName || '').trim() || !String(profile.lastName || '').trim())) fail('PROFILE_INVALID');
    const salt = random(16), recovery = random(24), id = random(16), revision = random(16);
    const [hash, recoveryHash] = await Promise.all([passwordHash(password, salt), digest(recovery)]);
    const account = await lock(() => {
      const data = registry();
      if (data.accounts.some(a => a.email === email)) fail('EMAIL_EXISTS');
      if (importLegacy && (!legacyProfile() || data.legacyOwner)) fail('LEGACY_CLAIMED');
      const record = { id, email, salt, hash, iterations: ITERATIONS, recoveryHash, revision, importedLegacy: Boolean(importLegacy), createdAt: new Date().toISOString() };
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
      return record;
    });
    return {
      email, recoveryCode: recovery.match(/.{8}/g).join('-'),
      complete() {
        const saved = registry().accounts.find(a => a.id === account.id && a.revision === account.revision);
        if (!saved) fail('SESSION_INVALID');
        startSession(saved);
      }
    };
  }
  async function signIn(email, password) {
    email = normalizeEmail(email);
    const account = registry().accounts.find(a => a.email === email);
    if (!account || typeof password !== 'string' || password.length > 128) fail('CREDENTIALS_INVALID');
    if (!Number.isInteger(account.iterations) || account.iterations < 100000 || account.iterations > 600000 || !/^[a-f0-9]{32}$/.test(account.salt)) fail('STORAGE_INVALID');
    if (!equal(await passwordHash(password, account.salt, account.iterations), account.hash)) fail('CREDENTIALS_INVALID');
    const saved = registry().accounts.find(a => a.id === account.id && a.revision === account.revision);
    if (!saved) fail('SESSION_INVALID');
    startSession(saved);
  }
  async function resetPassword(email, code, password) {
    checkPassword(password);
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
  function signOut() {
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
    storage, current, legacyProfile, register, signIn, signOut, resetPassword,
    databaseName(base) { return startupAccount && !startupAccount.importedLegacy ? base + '-' + startupAccount.id : base; }
  });
})(window);
