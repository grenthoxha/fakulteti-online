// Generate the approval service's academic options from the app's own registry.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function academicCatalog(root = path.resolve(__dirname, '..')) {
  const html = fs.readFileSync(path.join(root, 'fakulteti-online.html'), 'utf8');
  const slice = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
  const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  const psychology = JSON.parse(fs.readFileSync(path.join(root,'assets/psychology-programme-2026.json'),'utf8'));
  const c = vm.createContext({window: {}, OFFICIAL_CATALOG_SOURCES: new Proxy({}, {get: () => ({})}),
    officialSemester: (_, id) => ({id, label: 'Semestri ' + roman[id - 1], courses: []}),
    officialYear: (id, _, semesters) => ({id, label: 'Viti ' + roman[id - 1], semesters}),
    OFFICIAL_PSYCHOLOGY_YEARS: [...new Set(psychology.semesters.map(s=>Math.ceil(s.id/2)))].map(id => ({id,label:'Viti '+roman[id-1],semesters:psychology.semesters.filter(s=>Math.ceil(s.id/2)===id).map(s=>({id:s.id,label:'Semestri '+roman[s.id-1],courses:[]}))})),
    FILOZOFIKU_SOURCE_URL: 'https://filozofiku.github.io/WinterF_rooms_days_vertical.html'});
  for (const match of html.matchAll(/^const OFFICIAL_[A-Z_]+_YEARS = \[\r?\n[\s\S]*?^\];/gm)) vm.runInContext(match[0], c);
  vm.runInContext(slice('const BRANCHES =', '/* End faculty context helpers. */'), c);
  const fallback = html.match(/^const FILOZOFIKU_ROOMS_FALLBACK = (.+);$/m);
  c.FILOZOFIKU_ROOMS_FALLBACK = JSON.parse(fallback[1]);
  vm.runInContext(slice('function installFilozofikuScheduleDirections(data)', 'function getCourseTeachingStaff'), c);
  return JSON.parse(vm.runInContext(`JSON.stringify(UNIT_FACULTIES.map(f => ({id:f.id,label:f.label,programmes:getFacultyBranches(f.id).map(b => ({id:b.id,label:b.label,level:getBranchStudyLevel(b),years:b.years.map(y => ({id:String(y.id),label:y.label,semesters:y.semesters.map(s => ({id:String(s.id),label:s.label}))}))}))})).filter(f=>f.programmes.length))`, c));
}
module.exports = academicCatalog;
if (require.main === module) {
  const result = academicCatalog();
  const output = path.resolve(__dirname, '../server/account-approvals/lib/academic-catalog.json');
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(`Academic catalogue: ${result.length} faculties, ${result.reduce((n,f)=>n+f.programmes.length,0)} programmes.`);
}
