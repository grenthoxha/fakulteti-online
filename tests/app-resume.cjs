const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const {webcrypto} = require('node:crypto');
const h = (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity).filter(v => v != null && v !== false)});
const nodes = n => n && typeof n === 'object' ? [n, ...n.children.flatMap(nodes)] : [];
const text = n => n && typeof n === 'object' ? n.children.map(text).join('') : String(n ?? '');
let checks = 0;
const ok = (value, reason) => { assert(value, reason); checks++; };
function harness() {
  let cursor = 0, effects = [], pending = [], cleanups = [];
  const states = [], deps = [];
  const hooks = {
    createElement: h, Fragment: 'fragment', cloneElement: (child, props) => ({...child, props: {...child.props, ...props}}),
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(initial) { const [value] = hooks.useState(() => ({current: initial})); return value; },
    useEffect(effect, next) { const i = cursor++; if (!deps[i] || !next || next.some((v, k) => v !== deps[i][k])) { deps[i] = next; pending.push(() => { cleanups[i]?.(); cleanups[i] = effect(); }); } }
  };
  return {hooks, render(component) { cursor = 0; const result = component(); effects = pending; pending = []; effects.forEach(f => f()); return result; }, unmount() { cleanups.forEach(f => f?.()); }};
}
function events(target = {}) {
  const listeners = new Map();
  Object.assign(target, {addEventListener(k, f) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(f); }, removeEventListener(k, f) { listeners.get(k)?.delete(f); }, dispatchEvent(e) { [...(listeners.get(e.type) || [])].forEach(f => f(e)); }});
  return target;
}
class Event { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } }
const tick = () => new Promise(resolve => setImmediate(resolve));
async function gateFixture(status = 'approved') {
  const hooks = harness(), map = new Map(), intervals = new Set();
  const who = {id: 'test-device', publicKey: {}, privateKey: {}};
  map.set('u_approval_device_v1', JSON.stringify(who));
  let policy = {id: who.id, email: 'student@example.test', status, role: 'student', isAdmin: false, permissions: ['home', 'courses', 'rooms'], version: 1, landing: 'auto'}, offline = false, error = '', requests = 0, reloads = 0, signedOut = false;
  const document = events({hidden: false, body: {}, documentElement: {classList: {contains: () => false}}});
  const root = events({document, navigator: {}, location: {reload() { reloads++; }}, crypto: {getRandomValues: a => webcrypto.getRandomValues(a), subtle: {importKey: async () => ({}), sign: async () => new Uint8Array(64)}},
    FakultetiLocalAccounts: {storage: {getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k)}, current: () => signedOut ? null : {id: 'account', email: 'student@example.test'}, syncProfile: async () => {}, isOnline: () => true, signOut() { signedOut = true; }},
    fetch: async () => { requests++; if (offline) throw Error('OFFLINE'); return {ok: !error, json: async () => error ? {error} : {...policy}}; }});
  const c = vm.createContext({window: root, React: hooks.hooks, ReactDOM: {createPortal: h}, TextEncoder, Uint8Array, AbortController, CustomEvent: Event, setTimeout, clearTimeout, setInterval(f) { intervals.add(f); return f; }, clearInterval(f) { intervals.delete(f); }});
  vm.runInContext(fs.readFileSync('assets/account-approvals.js', 'utf8'), c);
  const child = h('App', {}), render = () => hooks.render(() => root.FakultetiApprovalGate({children: child}));
  const settled = async () => { for (let i = 0; i < 20; i++) await tick(); return render(); };
  return {root, map, intervals, render, settled, setPolicy: value => { policy = {...policy, ...value}; }, setOffline: v => { offline = v; }, setError: v => { error = v; }, get requests() { return requests; }, get reloads() { return reloads; }, unmount: hooks.unmount};
}
(async () => {
  const f = await gateFixture();
  let tree = f.render();
  ok(tree.props.className === 'approval-launch' && nodes(tree).some(n => n.type === 'img' && n.props.alt === 'Fakulteti'), 'cold launch shows the actual logo');
  ok(text(tree) === '' && tree.props['aria-busy'] === true && tree.props['aria-label'] === 'Po ngarkohet Fakulteti' && !nodes(tree).some(n => n.type === 'button'), 'initial check shows only the visual loader, with an accessible status and no visible words or approval controls');
  tree = await f.settled();
  const key = tree.children[0].props.key;
  ok(tree.children[0].type === 'App', 'approval mounts the app only after identity validation');
  // Reconciliation retains component state when its type and key stay the same.
  for (const event of ['visibilitychange', 'pageshow', 'online']) {
    f.setPolicy({version: 12, permissions: ['rooms', 'courses', 'home']});
    (event === 'visibilitychange' ? f.root.document : f.root).dispatchEvent(new Event(event, {persisted: true}));
    ok(f.render().children[0].props.key === key, event + ' keeps the approved tree visible while checking');
    ok((await f.settled()).children[0].props.key === key, event + ' preserves the app instance, even with a new policy version/order');
  }
  f.setOffline(true); f.root.dispatchEvent(new Event('online')); tree = await f.settled();
  ok(tree.children[0].props.key === key && f.reloads === 0, 'temporary network loss keeps the matching cached approval without restarting');
  const count = f.requests; f.root.document.hidden = true; f.intervals.forEach(callback => callback()); await f.settled();
  ok(f.requests === count, 'hidden app does not poll');
  f.root.document.hidden = false; f.setOffline(false); f.setPolicy({permissions: ['rooms']}); f.root.document.dispatchEvent(new Event('visibilitychange')); tree = await f.settled();
  ok(tree.children[0].props.key !== key && !f.root.FakultetiApprovals.can('courses'), 'actual access changes invalidate the old protected tree');
  f.setPolicy({status: 'suspended'}); f.root.dispatchEvent(new Event('pageshow')); tree = await f.settled();
  ok(!nodes(tree).some(n => n.type === 'App') && text(tree).includes('pezulluar'), 'suspension still removes protected content');
  f.unmount(); ok(f.intervals.size === 0, 'resume checks are cleaned up');
  for (const status of ['pending', 'rejected']) { const p = await gateFixture(status); p.render(); tree = await p.settled(); ok(!nodes(tree).some(n => n.type === 'App') && tree.props.className === 'approval-wait-page', status + ' never bypasses approval'); p.unmount(); }
  const invalid = await gateFixture(); invalid.setPolicy({email: 'other@example.test'}); invalid.render(); tree = await invalid.settled(); ok(!nodes(tree).some(n => n.type === 'App') && text(tree).includes('Lidhja'), 'mismatched policy identity cannot unlock app'); invalid.unmount();
  const revoked = await gateFixture(); revoked.render(); await revoked.settled(); revoked.setError('SESSION_REVOKED'); revoked.root.dispatchEvent(new Event('online')); await revoked.settled(); ok(revoked.reloads === 1 && revoked.root.FakultetiLocalAccounts.current() === null, 'revoked sessions still sign out and reload'); revoked.unmount();

  const html = fs.readFileSync('fakulteti-online.html', 'utf8');
  const appSource = html.slice(html.indexOf('function App() {'), html.indexOf('\nReactDOM.createRoot', html.indexOf('function App() {')));
  function appFixture(rooms = false) {
    const hooks = harness(), storage = new Map(Object.entries({u_name: rooms ? 'Bujar Hoti' : 'Arta Hoxha', u_real_name: rooms ? 'Bujar Hoti' : 'Arta Hoxha', u_branch: 'psychology', u_faculty: 'philosophy', u_year: '1', u_semester: '1'}));
    const doc = events({hidden: false, documentElement: {classList: {toggle() {}}}});
    const root = events({document: doc, history: {}, scrollTo() {}, navigator: {standalone: true}, matchMedia: () => ({matches: true}), FakultetiLocalAccounts: {current: () => ({id: 'account'})}});
    const c = vm.createContext({...hooks.hooks, React: hooks.hooks, window: root, document: doc, navigator: root.navigator, activeUiLanguage: 'sq', unitStorage: {getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v))},
      isValidStudentFullName: v => v.includes(' '), normalizeStudentName: v => v, getStudentFacultyContext: () => ({hasFreeRooms: true, faculty: {id: 'philosophy'}, branch: {years: [{id: 1}, {id: 2}]}}), prefersFreeRoomsHome: name => name === 'Bujar Hoti', UnitInstallState: {prepare() {}}, getInitialAcademyView: () => 'home', AcademyApp: 'AcademyApp', BujarRoomsApp: 'BujarRoomsApp', Onboarding: 'Onboarding'});
    vm.runInContext(appSource, c);
    return {root, doc, storage, render: () => hooks.render(() => c.App()), unmount: hooks.unmount};
  }
  const r = appFixture(true); tree = r.render(); ok(tree.type === 'BujarRoomsApp', 'cold launch keeps the rooms account default'); tree.props.onOpenApp(); tree = r.render(); const roomKey = tree.props.key;
  for (const event of ['visibilitychange', 'pageshow']) { (event === 'visibilitychange' ? r.doc : r.root).dispatchEvent(new Event(event, {persisted: true})); tree = r.render(); ok(tree.type === 'AcademyApp' && tree.props.key === roomKey, event + ' no longer sends an expanded rooms account back home'); }
  tree.props.onRoomsHome(); ok(r.render().type === 'BujarRoomsApp', 'explicit logo/home action still returns to rooms'); r.unmount();
  const a = appFixture(); tree = a.render(); const academicKey = tree.props.key;
  a.storage.set('u_name', 'Arta student'); a.root.dispatchEvent(new Event('fakulteti:profile', {detail: {accountId: 'other'}})); ok(a.render().props.studentName === 'Arta Hoxha', 'profile events cannot update another account');
  a.root.dispatchEvent(new Event('fakulteti:profile', {detail: {accountId: 'account'}})); tree = a.render(); ok(tree.props.studentName === 'Arta student' && tree.props.key === academicKey, 'remote name refresh updates header without losing the open course');
  a.storage.set('u_year', '2'); a.root.dispatchEvent(new Event('fakulteti:profile', {detail: {accountId: 'account'}})); tree = a.render(); ok(tree.props.initialYear === 2 && tree.props.key !== academicKey, 'actual academic context change uses the new curriculum'); a.unmount();
  for (const file of ['github-publish/index.html', 'github-publish/fakulteti-online.html']) ok(fs.readFileSync(file, 'utf8') === html, 'HTML mirror remains identical');
  console.log(`PASS: ${checks} launch logo, foreground preservation, profile refresh and access security checks`);
})().catch(error => { console.error(error); process.exitCode = 1; });
