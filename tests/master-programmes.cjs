const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync('fakulteti-online.html', 'utf8');
const take = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
const h = (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity).filter(v => v != null && v !== false)});
const nodes = n => n && typeof n === 'object' ? [n, ...n.children.flatMap(nodes)] : [];
const text = n => n && typeof n === 'object' ? n.children.map(text).join('') : String(n ?? '');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };
const registry = take('const BRANCHES =', '/* End faculty context helpers. */');
const globals = {React: {createElement: h}, OFFICIAL_CATALOG_SOURCES: {psikologji: {url: 'psychology'}, kompjuterike: {}, mjekesi: {}}};
for (const name of new Set(registry.match(/\bOFFICIAL_[A-Z_]+_YEARS\b/g))) globals[name] = [{id: 1, semesters: [{id: 1, courses: [{id: name, title: name, status: 'O'}]}]}];
const c = vm.createContext(globals);
vm.runInContext(registry + ';this.branches=BRANCHES;this.programmes=FILOZOFIKU_MASTER_PROGRAMMES;this.find=getFacultyBranches;this.context=getStudentFacultyContext;this.schedule=getFacultyScheduleProgram;', c);
const masters = c.find('filozofik', '', 'master');
ok(masters.length === 8 && new Set(c.branches.map(b => b.id)).size === c.branches.length, 'eight current MA programmes have distinct stable IDs');
for (const branch of masters) {
  const count = branch.id === 'master-arkivistike' ? 1 : 2;
  ok(branch.years.length === count && branch.years.at(-1).semesters.at(-1).id === count * 2, branch.id + ': correct years and semesters');
  ok(c.context(branch.id).faculty.id === 'filozofik' && c.context(branch.id).hasFreeRooms, branch.id + ': correct faculty membership');
  ok(branch.years.every(y => y.full === 'Master' && y.semesters.every(s => s.courses.length === 0)) && c.schedule(branch.id, 1)?.studyLevel === 'master', branch.id + ': keeps MA timetable identity without inheriting BA subjects or materials');
  ok(branch.source.url.startsWith('https://filozofiku.uni-pr.edu/'), branch.id + ': official source retained');
}
ok(c.find('filozofik', '', 'bachelor').some(b => b.id === 'psikologji') && !c.find('filozofik', '', 'bachelor').some(b => b.studyLevel === 'master'), 'existing BA programmes stay separate');
ok(c.find('filozofik', 'klinike', 'master')[0].id === 'master-psikologji-klinike' && c.find('filozofik', 'Trashegimi', 'master').length === 1, 'search works for master titles and unaccented phone input');
ok(c.find('fiek', '', 'master').length === 0, 'MA programmes do not leak into another faculty');

// Execute the real onboarding component, including the level and year callbacks.
function onboarding() {
  const values = [], calls = [], ref = {current: 0}; let cursor = 0;
  const storage = new Map([['u_gender', 'female'], ['u_role', 'student']]);
  Object.assign(c, {useState: initial => { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial; return [values[i], value => values[i] = typeof value === 'function' ? value(values[i]) : value]; }, useRef: () => ref,
    unitStorage: {getItem: key => storage.get(key) || null}, getStoredStudentIdentity: () => ({firstName: 'Arta', lastName: 'Hoxha'}), getAskStudentNameError: () => '', normalizeStudentName: s => s.trim(), validateAskStudentIdentity: async () => ({ok: true}),
    LanguageSwitch: 'LanguageSwitch', UnitInstallButton: 'UnitInstallButton', Logo: 'Logo', alert: message => { throw Error(message); }});
  vm.runInContext(take('function Onboarding({', '/* ──── Toast Notification System'), c);
  return {calls, render: () => { cursor = 0; return c.Onboarding({uiLanguage: 'sq', onSelect: async (...args) => { calls.push(args); }}); }};
}
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && text(n).includes(label));
(async () => {
  const f = onboarding();
  button(f.render(), 'Fakulteti Filozofik').props.onClick();
  let tree = f.render();
  ok(nodes(tree).find(n => n.type === 'button' && text(n) === 'Bachelor').props['aria-pressed'] === true, 'Bachelor remains the default');
  nodes(tree).find(n => n.type === 'button' && text(n) === 'Master').props.onClick();
  tree = f.render();
  ok(nodes(tree).find(n => n.type === 'button' && text(n) === 'Master').props['aria-pressed'] === true && !button(tree, 'Studio mendjen'), 'Master switches the list without mixing BA cards');
  button(tree, 'Psikologji Klinike dhe Komuniteti').props.onClick();
  tree = f.render();
  ok(button(tree, 'Viti II') && !button(tree, 'Viti III') && text(tree).includes('Master'), 'master onboarding exposes the correct year choices');
  await button(tree, 'Viti II').props.onClick();
  await new Promise(setImmediate);
  ok(f.calls[0][1] === 'master-psikologji-klinike' && f.calls[0][2] === 2 && f.calls[0][8] === 'filozofik', 'onboarding submits the master identity and actual year/faculty');
  button(tree, 'Kthehu te zgjedhja e drejtimit').props.onClick();
  button(f.render(), 'Arkivistikë').props.onClick();
  ok(button(f.render(), 'Viti I') && !button(f.render(), 'Viti II'), 'one-year Arkivistika does not expose a nonexistent second year');

  // Execute the real application save handler and card data function.
  const saved = new Map();
  Object.assign(c, {window: {}, unitStorage: {getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, String(v)), removeItem: k => saved.delete(k)}, choosingAcademics: false});
  for (const setter of ['setStudentFullName', 'setSelectedSemester', 'setActualRole', 'setStudentName', 'setChoosingAcademics', 'setSelectedBranch', 'setSelectedYear']) c[setter] = () => {};
  vm.runInContext(take('  const handleSelect = async (n, bId, yId, r, taughtArr, semId, gender, identity, facultyId)', '  const handleLogout =') + ';this.save=handleSelect;', c);
  await c.save('Arta Hoxha', 'master-sociologji', 2, 'student', [], undefined, 'female', {firstName: 'Arta', lastName: 'Hoxha'}, 'filozofik');
  ok(saved.get('u_branch') === 'master-sociologji' && saved.get('u_year') === '2' && saved.get('u_semester') === '3', 'master year two persists with semester three for subsequent launches');
  ok(JSON.parse(saved.get('u_unlocked')).join() === '1,2', 'valid master years unlock without adding bachelor years');
  const before = JSON.stringify([...saved]);
  ok(await c.save('Arta Hoxha', 'master-arkivistike', 2, 'student', [], undefined, 'female', {firstName: 'Arta', lastName: 'Hoxha'}, 'filozofik'), 'invalid master year is rejected');
  ok(JSON.stringify([...saved]) === before, 'invalid selection cannot overwrite the account');
  Object.assign(c, {branchId: 'master-sociologji', studentFullName: 'Arta Hoxha', studentName: 'Arta', unitFold: v => v.toLowerCase(), profilePhoto: '', profileInitials: 'AH'});
  vm.runInContext(take('  const getStudentCardData =', '  const renderStudentCardFace =') + ';this.card=getStudentCardData;', c);
  ok(c.card().programme === 'Sociologji · Master', 'student card identifies MA rather than Bachelor');
  c.branchId = 'psikologji'; ok(c.card().programme === 'Psikologji · Bachelor', 'Bachelor card remains unchanged');
  const {cleanProfile} = await import('../server/account-approvals/lib/cloud-accounts.mjs');
  const profile = cleanProfile({firstName: 'Arta', lastName: 'Hoxha', requestedRole: 'student', faculty: 'filozofik', branch: 'master-sociologji', year: '2', semester: '3'});
  ok(profile.branch === 'master-sociologji' && profile.year === '2', 'online profile accepts master programme identity');
  console.log(`PASS: ${checks} master programme checks — selection, years, persistence, faculty isolation and degree labels.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
