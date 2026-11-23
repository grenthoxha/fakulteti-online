const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('fakulteti-online.html','utf8');
const start=html.indexOf('function readPersonalExamRecords('),end=html.indexOf('const COURSE_LEARNING_EXAMPLE_KEY',start);
const saved=new Map(),storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v))};
const context=vm.createContext({unitStorage:storage});vm.runInContext(html.slice(start,end),context);
const read=key=>JSON.parse(JSON.stringify(context.readPersonalExamRecords(key)));
assert.deepEqual(read('u_deadlines'),[]);assert.deepEqual(read('u_exam_clash_list'),[]);assert.deepEqual(read('u_group_colloquiums_v1'),[]);
const personal=[{id:'exam_123',type:'exam',date:'2027-01-12',title:'My exam'},{id:'seed_exam_psych_2_1',type:'exam',source:'manual',date:'2027-02-01'},{id:'task_1',type:'task',title:'Read'},{id:'seed_exam_task',type:'task'}];
saved.set('u_deadlines',JSON.stringify([...personal,{id:'seed_exam_psych_2_2',type:'exam'},{id:'deadline_col_seed_1',type:'exam',source:'kryetar'}]));
saved.set('u_student_grades',JSON.stringify({course1:8,course2:10}));
saved.set('u_notes','private notes');
assert.deepEqual(read('u_deadlines'),personal);assert.deepEqual(JSON.parse(saved.get('u_deadlines')),personal);
assert.deepEqual(read('u_deadlines'),personal); // Reopening never recreates examples.
saved.set('u_group_colloquiums_v1',JSON.stringify([{id:'col_seed_1'},{id:'col_seed_past'},{id:'col_123',date:'2027-01-12'}]));
assert.deepEqual(read('u_group_colloquiums_v1'),[{id:'col_123',date:'2027-01-12'}]);
saved.set('u_exam_clash_list',JSON.stringify([{id:'clash-1'},{id:'clash-5'},{id:'clash-123',status:'ready'}]));
assert.deepEqual(read('u_exam_clash_list'),[{id:'clash-123',status:'ready'}]);
assert.deepEqual(JSON.parse(saved.get('u_student_grades')),{course1:8,course2:10});assert.equal(saved.get('u_notes'),'private notes');
assert(!html.includes('setDeadlines(prev => [...prev, ...sampleExams])'));assert(!html.includes('setGroupColloquiums(seededCols)'));
assert(!/studentGrades\[c.id\]\s*\|\|\s*9|simulatedGrades\[c.id\]\s*\|\|\s*9/.test(html));
const a=html.indexOf('    const relevantCourses =',html.indexOf('  const renderScholarshipView ='));
const b=html.indexOf('    const gap =',a);
function averages(done,studentGrades,simulatedGrades){const c=vm.createContext({enrolledCourses:[{id:'a',ects:6},{id:'b',ects:6}],allCourses:[],done,studentGrades,simulatedGrades});return JSON.parse(JSON.stringify(vm.runInContext(html.slice(a,b)+'({currentGpa,projectedGpa,projectedEcts})',c)));}
assert.deepEqual(averages([],{},{}),{currentGpa:0,projectedGpa:0,projectedEcts:0});
assert.deepEqual(averages(['a','b'],{a:8},{}),{currentGpa:8,projectedGpa:8,projectedEcts:6});
assert.deepEqual(averages(['a'],{a:8},{b:10}),{currentGpa:8,projectedGpa:9,projectedEcts:12});
console.log('PASS: empty defaults, existing demo cleanup, preserved personal exams/grades/notes and averages using entered grades only.');
