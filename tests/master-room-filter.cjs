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
console.log(`PASS: ${checks} master room filter checks — Grent visibility, degree matching, day scope and search.`);
