const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync('fakulteti-online.html', 'utf8');
const take = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
const plain = value => JSON.parse(JSON.stringify(value));
let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const eq = (value, expected, message) => { assert.deepEqual(plain(value), expected, message); checks++; };
const registry = take('const BRANCHES =', '/* End faculty context helpers. */');
const globals = {OFFICIAL_CATALOG_SOURCES: {psikologji: {}, kompjuterike: {}, mjekesi: {}}};
for (const key of new Set(registry.match(/\bOFFICIAL_[A-Z_]+_YEARS\b/g))) globals[key] = [{id: 1, semesters: [{id: 1, courses: []}]}];
const c = vm.createContext(globals);
vm.runInContext(registry + ';this.masters=FILOZOFIKU_MASTER_PROGRAMMES;this.program=getFacultyScheduleProgram;', c);
vm.runInContext(take('const prefersFreeRoomsHome =', 'const UNIT_INSTALL_URL =') + ';this.initial=getInitialScheduleProgram;', c);
vm.runInContext(take('function getFilozofikuDateForDay(', 'function searchFilozofikuProfessors(') + ';this.sessions=getFilozofikuProgramSessions;this.roomEvents=getFilozofikuRoomEvents;', c);
const fallback = JSON.parse(html.match(/const FILOZOFIKU_ROOMS_FALLBACK = (.*);/)[1]);
for (const master of c.masters) {
  const program = c.program(master.id, 1);
  ok(program.studyLevel === 'master' && program.label.includes('Master'), master.id + ': timetable retains degree and programme identity');
  const all = [1,2,3,4,5].flatMap(day => c.sessions(fallback, program, day, '2026-11-' + (22 + day)));
  ok(all.length > 0, master.id + ': matches actual faculty room groups');
  ok(all.every(event => /1ma\b/i.test(event.g)), master.id + ': cannot show a BA or another-year-only class');
  ok(c.initial('Arta Hoxha',master.id,1,true) === 'faculty-program', master.id + ': official timetable opens by default after programme selection');
}
ok(c.initial('Grent Hoxha','master-sociologji',1,true) === 'faculty-program', 'an explicit master selection overrides the legacy personal BA preference');
ok(c.program('master-histori-koha-e-re', 1).groupName === 'Koha e Re', 'history uses the actual room-source programme name');
ok(c.program('master-arkivistike', 2) === null, 'a nonexistent master year cannot acquire a timetable');
const degreeData = {times: ['08:00','08:15'], rooms: [{n:'Salla 02', e: [
  {d:0,s:0,e:1,t:'BA',g:'Sociologji-1BA'}, {d:0,s:0,e:1,t:'MA',g:'Sociologji-1MA'},
  {d:0,s:0,e:1,t:'Viti II',g:'Sociologji-2MA'}, {d:0,s:0,e:1,t:'Tjetër',g:'Psikologji-1MA'},
  {d:0,s:0,e:1,t:'E përbashkët',g:'Psikologji-1BA · Sociologji - 1 MA-Zgjedhore 1'}
]}]};
eq(c.sessions(degreeData, c.program('master-sociologji',1), 1).map(e=>e.t).sort(), ['E përbashkët','MA'], 'master matching handles shared booking groups and whitespace without mixing BA/years');
eq(c.sessions(degreeData, c.program('sociologji',1), 1).map(e=>e.t), ['BA'], 'existing Bachelor matching remains isolated');
eq(c.sessions(degreeData, c.program('master-sociologji',2), 1).map(e=>e.t), ['Viti II'], 'second-year master schedule excludes first-year shared classes');

// Use the real booking reader, real shared store and real mounted schedule subscription.
const days = ['E hënë','E martë','E mërkurë','E enjte','E premte'];
const times = Array.from({length:54},(_,i)=>`${String(Math.floor((480+i*15)/60)).padStart(2,'0')}:${String((480+i*15)%60).padStart(2,'0')}`);
let base = {days,times,rooms:[{n:'Salla 02',l:'Salla 02',e:[{d:0,s:0,e:2,t:'Ligjërata bazë',p:'Prof. Fillestar',g:'Sociologji-1MA'}]}, {n:'Salla 106',l:'Salla 106',e:[]}]};
let now = Date.parse('2026-11-23T07:00:00Z'), failed = false, bookingRows = [{id:'booking', date:'2026-11-23', roomId:'02', title:'Zëvendësimi', eventType:'Zëvendësim', groupIds:['other','ma'], teacherIds:['teacher'], periodIds:['p1','p2'], status:'confirmed'}], teacher = 'Prof. Fillestar';
const encode = value => typeof value === 'string' ? {stringValue:value} : Array.isArray(value) ? {arrayValue:{values:value.map(encode)}} : {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))}};
const doc = value => ({name:'documents/'+value.id, fields:Object.fromEntries(Object.entries(value).filter(([k])=>k!=='id').map(([k,v])=>[k,encode(v)]))});
const storage = new Map(), hooks = [], effects = [], cleanups = []; let cursor = 0;
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
const fetch = async url => {
  if (failed) throw Error('offline');
  if (url.endsWith('.html')) return {ok:true,text:async()=>JSON.stringify(base)};
  const result = url.includes(':runQuery') ? bookingRows.map(row=>({document:doc(row)}))
    : url.includes('/rooms?') ? {documents:[doc({id:'02',name:'Salla 02'}),doc({id:'106',name:'Salla 106'})]}
    : url.includes('/periods?') ? {documents:[doc({id:'p1',start:'09:00',end:'09:15'}),doc({id:'p2',start:'09:15',end:'09:30'}),doc({id:'p3',start:'10:00',end:'10:15'}),doc({id:'p4',start:'10:15',end:'10:30'})]}
    : doc({id:'current',groups:{other:'Psikologji-1BA',ma:'Sociologji-1MA'},teachers:{teacher}});
  return {ok:true,json:async()=>result};
};
Object.assign(c, {Date:Clock, Intl, AbortController, fetch, setTimeout:()=>1, clearTimeout(){}, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}, unitStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  window:{addEventListener(){}}, document:{hidden:false,addEventListener(){}}, FILOZOFIKU_ROOMS_FALLBACK:base, FILOZOFIKU_DAILY_SYNC_KEY:'room-sync', FILOZOFIKU_REFRESH_MS:8*3600000, FILOZOFIKU_SOURCE_URL:'https://filozofiku.github.io/WinterF_rooms_days_vertical.html', parseFilozofikuRoomsTimeOnly:JSON.parse, isValidFilozofikuRoomsData:()=>true});
vm.runInContext(fs.readFileSync('assets/official-room-bookings.js','utf8'),c);
c.FilozofikuBookings = c.window.FilozofikuBookings;
vm.runInContext(take('const FilozofikuDailyStore =', 'function getFilozofikuFloorMeta(') + ';this.store=FilozofikuDailyStore;',c);
Object.assign(c, {view:'week',branchId:'master-sociologji',facultyContext:{hasFreeRooms:true},facultyScheduleProgram:c.program('master-sociologji',1),scheduleProgramFilter:'faculty-program',
  useState: init => {const i=cursor++;if(!(i in hooks))hooks[i]=init();return[hooks[i],value=>hooks[i]=value];},
  useEffect: effect => {const i=cursor++;if(!effects[i]) {effects[i]=true;cleanups.push(effect());}}});
vm.runInContext('function renderSchedule(){'+take('  const [scheduleProgramData,', '  const [scheduleScope,')+'return {data:scheduleProgramData,sessions:programScheduleSessions};}this.renderSchedule=renderSchedule;',c);
const render = () => {cursor=0;return c.renderSchedule();};
const schedule = () => render().sessions(1,'2026-11-23');
const parity = () => {const data=render().data;for(const session of schedule()) { const room=data.rooms.find(r=>(r.l||r.n)===session.room);ok(c.roomEvents(data,room,0,'2026-11-23').some(e=>e.t===session.t&&e.s===session.s&&e.e===session.e&&e.p===session.p),'schedule and free rooms show identical event details'); }};
(async()=>{
  render(); await c.store.refresh();
  eq(schedule().map(e=>[e.t,e.room,e.start,e.end]), [['Ligjërata bazë','Salla 02','08:00','08:30'],['Zëvendësimi','Salla 02','09:00','09:30']], 'initial mounted master schedule includes its recurring class and shared-group dated replacement');parity();
  now+=10000; teacher='Prof. I ri';bookingRows=[{...bookingRows[0],roomId:'106',title:'Zëvendësimi i ndryshuar',periodIds:['p3','p4']}];
  base={...base,rooms:[{...base.rooms[0],e:[]},{...base.rooms[1],e:[{d:0,s:1,e:3,t:'Ligjërata e ndryshuar',p:'Prof. I ri',g:'Sociologji-1MA'}]}]};
  await c.store.refresh({force:true});
  eq(schedule().map(e=>[e.t,e.room,e.start,e.end,e.p]), [['Ligjërata e ndryshuar','Salla 106','08:15','08:45','Prof. I ri'],['Zëvendësimi i ndryshuar','Salla 106','10:00','10:30','Prof. I ri']], 'room refresh immediately replaces old room, time, title and teacher in the already-mounted schedule');parity();
  ok(render().sessions(1,'2026-11-30').every(e=>!e.booking),'dated replacement never leaks into the following week');
  const current=plain(schedule());failed=true;await c.store.refresh({force:true});eq(schedule(),current,'offline refresh retains the same last-known official data');failed=false;
  now+=10000;bookingRows=[];base={...base,rooms:base.rooms.map(r=>({...r,e:[]}))};await c.store.refresh({force:true});
  eq(schedule(),[],'removed recurring classes and cancelled public bookings disappear from the mounted schedule');
  cleanups.forEach(fn=>fn?.());
  now+=10000;base={...base,rooms:[{...base.rooms[0],e:[{d:0,s:0,e:1,t:'Pas daljes',g:'Sociologji-1MA'}]},base.rooms[1]]};await c.store.refresh({force:true});
  eq(schedule(),[],'unmounted schedule unsubscribes from the shared room store');
  console.log(`PASS: ${checks} official faculty timetable checks — all master programmes, BA isolation, room changes, replacements, cancellations and live subscriptions.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
