const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('fakulteti-online.html','utf8');
const source=html.slice(html.indexOf('function getFilozofikuDateForDay('),html.indexOf('function searchFilozofikuProfessors('));
const c=vm.createContext({});vm.runInContext(source+'this.allowed=canFilterMasterRooms;this.master=getFilozofikuMasterSessions;',c);
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
for(const name of ['Grent Hoxha','Grenti Hoxha',' Grent Hoxha '])ok(c.allowed(name),'Grent receives the additional MA filter');
for(const name of ['Agron Miftari','Bujar Hoti','Arta Hoxha','Grenta',''])ok(!c.allowed(name),'other names do not receive the additional filter');
const data=JSON.parse(html.match(/const FILOZOFIKU_ROOMS_FALLBACK = (.*);/)[1]);const before=JSON.stringify(data);
let total=0;for(let day=0;day<5;day++) {
 const sessions=c.master(data,day);total+=sessions.length;
 ok(sessions.every(e=>e.d===day&&/-\s*\d+\s*ma\b/i.test(e.g)&&e.room&&e.date),'filter includes the selected day and actual MA groups only');
 const searched=c.master(data,day,'Sociologji');ok(searched.every(e=>/sociologji/i.test(e.g)),'search filters the MA list by programme');
}
ok(total>0&&JSON.stringify(data)===before,'MA filtering retains all original BA room occupancy data');
// Execute the same room filter used by All, Free, Occupied and Master.
const filterSource=html.slice(html.indexOf('  const filteredRooms = useMemo('),html.indexOf('  const professorsEvaluated =',html.indexOf('  const filteredRooms = useMemo(')));
const room={n:'Salla 02',l:'Salla 02',floor:{id:'ground',label:'Përdhesa'},isFree:false,smartboard:true,dayEvents:[{p:'Bachelor Teacher',t:'BA subject',g:'Psikologji-1BA'}]};
Object.assign(c,{useMemo:fn=>fn(),roomsEvaluated:[room,{...room,n:'Salla 03',l:'Salla 03',isFree:true}],statusFilter:'master',showMasterRoomFilter:true,masterRoomNames:new Set(['Salla 02']),masterSearchRoomNames:new Set(['Salla 02']),searchQuery:'',floorFilter:'all',onlySmartboard:false});
vm.runInContext('function filterCards(){'+filterSource+'return filteredRooms;}this.filterCards=filterCards;',c);
let cards=c.filterCards();ok(cards.length===1&&cards[0]===room&&!cards[0].isFree,'Master reuses the original room object and its real occupied status, even when the current class is Bachelor');
c.statusFilter='all';ok(c.filterCards().length===2,'All continues to display every room');c.statusFilter='master';
c.searchQuery='Bachelor Teacher';c.masterSearchRoomNames=new Set();ok(c.filterCards().length===0,'Master search cannot match a BA-only teacher in a shared room');
c.searchQuery='Master Teacher';c.masterSearchRoomNames=new Set(['Salla 02']);ok(c.filterCards()[0]===room,'Master search selects matching rooms without replacing room cards with professor cards');
c.searchQuery='Salla 02';c.masterSearchRoomNames=new Set();ok(c.filterCards()[0]===room,'room-name search works within Master');
c.searchQuery='';c.floorFilter='floor1';ok(c.filterCards().length===0,'Master preserves the existing floor filter');
c.floorFilter='all';c.showMasterRoomFilter=false;ok(c.filterCards().length===0,'a hidden Master filter does not expose its room subset');
console.log(`PASS: ${checks} master room filter checks — Grent visibility, degree matching, day scope and search.`);
