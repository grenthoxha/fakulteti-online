const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'fakulteti-online.html'),'utf8');
const programme=JSON.parse(fs.readFileSync(path.join(root,'assets/psychology-programme-2026.json'),'utf8'));
const c=vm.createContext({Map,Set,OFFICIAL_CATALOG_SOURCES:{psikologji:{url:programme.source},psikologjiPrevious:{url:'previous'}},OFFICIAL_COURSE_COLORS:['brand'],ROMAN_SEMESTERS:['I','II','III','IV','V','VI'],
 officialYear:(id,desc,semesters)=>({id,desc,semesters}),
 officialSemester:(program,id,source,specs)=>({id,courses:specs.map((spec,i)=>({id:`up_psi_${String(id).padStart(2,'0')}_${String(i+1).padStart(2,'0')}`,title:spec[0],ects:spec[1]||6,status:spec[2]||'O',chapters:[{id:'saved-chapter'}],cards:[],quiz:[],cases:[]}))})});
vm.runInContext(html.slice(html.indexOf('const LEGACY_PSYCHOLOGY_YEARS ='),html.indexOf('const OFFICIAL_COMPUTER_SCIENCE_YEARS ='))+'this.years=OFFICIAL_PSYCHOLOGY_YEARS;this.previous=LEGACY_PSYCHOLOGY_BY_ID;this.reconcile=reconcilePsychologyEnrollment;this.programme=PSYCHOLOGY_PROGRAMME_2026;',c);
let checks=0;const ok=(value,label)=>{assert(value,label);checks++;};
const plain=v=>JSON.parse(JSON.stringify(v)),courses=c.years.flatMap(y=>y.semesters.flatMap(s=>s.courses));
assert.deepEqual(plain(c.programme),programme);checks++;
ok(courses.length===34&&new Set(courses.map(x=>x.id)).size===34,'34 current subjects have distinct, stable identities');
ok(c.years[0].semesters[0].courses.map(x=>x.title).join('|')==='Psikologji e përgjithshme|Bazat e statistikës|Psikologji zhvillimore I (Fëmijëria & Adoleshenca)|Shkrimi akademik për psikologji|Etika në psikologji','semester one follows the accredited current programme');
for(const [id,semester] of [['up_psi_05_06',1],['up_psi_04_04',3],['up_psi_03_03',4],['up_psi_06_02',5],['up_psi_05_02',6]]){
 const sem=c.years.flatMap(y=>y.semesters).find(s=>s.id===semester),course=sem.courses.find(x=>x.id===id);
 ok(course&&course.chapters===c.previous.get(id).chapters,'moved course retains its reading/progress identity: '+id);
}
for(const id of ['up_psi_01_02','up_psi_01_05','up_psi_04_06','up_psi_05_05'])ok(!courses.some(x=>x.id===id),'previous-programme subject is absent from current list: '+id);
for(const course of courses.filter(x=>x.id.startsWith('up_psi_2026_')))ok(!course.chapters.length&&!course.cards.length&&!course.quiz.length&&!course.cases.length,'new subject never inherits another subject’s study content: '+course.id);
const source={'psikologji:1':['up_psi_01_01','up_psi_01_02','up_psi_01_03','up_psi_01_04','up_psi_01_05'],'psikologji:3':['up_psi_05_01'],'mjekesi:1':['med1']},snapshot=JSON.stringify(source),next=c.reconcile(source);
ok(next['psikologji:1'].includes('up_psi_2026_01_statistics')&&next['psikologji:1'].includes('up_psi_05_06'),'existing first-year account receives newly introduced compulsory subjects');
ok(next['psikologji:3'].includes('up_psi_2026_05_intercultural')&&next['psikologji:3'].includes('up_psi_2026_05_resilience'),'new compulsory third-year subjects are included');
ok(next['psikologji:3'].every(id=>!['up_psi_05_03','up_psi_05_04'].includes(id)),'existing deselection of previous subjects is preserved');
ok(next['psikologji:1'].includes('up_psi_01_02')&&next['mjekesi:1']===source['mjekesi:1']&&JSON.stringify(source)===snapshot,'old enrollment references and other programmes are preserved without mutating the input');
ok(c.reconcile(next)===next,'migration is idempotent');
const empty={'psikologji:1':[]};ok(c.reconcile(empty)===empty,'empty enrollment keeps the complete compulsory default instead of becoming a partial selection');
const unknown={'psikologji:1':['unknown']};ok(c.reconcile(unknown)===unknown,'unrecognized legacy selection retains the complete current default');
const indexContext=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'assets/course-materials-index.js'),'utf8'),indexContext);const index=indexContext.window.FakultetiCourseMaterialsIndex.courses;
for(const course of courses){
 const info=index[course.id];
 if(info)ok(info.title===course.title&&info.semester===c.years.flatMap(y=>y.semesters).find(s=>s.courses.some(x=>x.id===course.id)).id&&info.currentProgramme,'material folder follows the actual course identity and semester: '+course.id);
 else ok(course.id.startsWith('up_psi_2026_'),'only a new subject can lack its previous material folder');
}
console.log(`PASS: ${checks} current psychology programme checks — subjects, semester moves, material identity and account enrollment preservation.`);
