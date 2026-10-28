/* Semester-bound physical-material catalogue. No purchase or QR is fabricated. */
(function () {
  'use strict';
  const h = React.createElement;
  function SemesterMaterials({ semester, courses, language, children }) {
    const [open, setOpen] = React.useState(false);
    const [format, setFormat] = React.useState('volume');
    const [courseId, setCourseId] = React.useState(courses[0]?.id || '');
    const cardRef = React.useRef(null);
    const panelRef = React.useRef(null);
    const previousOpen = React.useRef(false);
    React.useEffect(() => {
      if (open) {
        panelRef.current?.scrollIntoView({ block:'start', behavior:'auto' });
        panelRef.current?.focus({ preventScroll:true });
      } else if (previousOpen.current) {
        cardRef.current?.focus({ preventScroll:true });
        cardRef.current?.scrollIntoView({ block:'nearest', behavior:'auto' });
      }
      previousOpen.current = open;
    }, [open]);
    const t = (sq,en) => language === 'en' ? en : sq;
    const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][Number(semester.id)-1] || String(semester.id);
    const volume = `${t('Vëllimi','Volume')} ${roman} · ${t('Semestri','Semester')} ${roman}`;
    const panelId = `semester-materials-${semester.yearId}-${semester.id}`;
    const selected = courses.find(course=>course.id===courseId) || courses[0];
    const included = format === 'volume' ? courses : selected ? [selected] : [];
    return h(React.Fragment,null,
      !open && children,
      h('button',{ref:cardRef,type:'button',className:'semester-materials-card card-surface p-3.5 sm:p-5','aria-expanded':open,'aria-controls':panelId,onClick:()=>setOpen(previous=>!previous)},
        h('span',{className:'semester-materials-mini-book','aria-hidden':true},h('span',null,'MENTALIST ACADEMY'),h('strong',null,roman),h('span',null,t('Vëllimi','Volume'))),
        h('span',{className:'semester-materials-card-copy'},h('strong',null,t('Materialet fizike të semestrit','Printed semester materials')),h('span',null,`${volume} · ${t('Shënime, pyetje & përgjigje','Notes, questions & answers')}`)),
        h('span',{className:'semester-materials-card-footer'},
          h('span',{className:'semester-materials-status'},t('Në përgatitje','In preparation')),
          h('span',{className:'semester-materials-card-cta'},t(open?'Mbyll':'Shiko librin',open?'Close':'Preview book'),h('span',{'aria-hidden':true},open?'−':'→')))),
      open&&h('section',{ref:panelRef,tabIndex:-1,id:panelId,className:'semester-materials-panel','aria-label':t('Katalogu i materialeve fizike','Printed materials catalogue')},
        h('div',{className:'semester-materials-showcase'},
          h('div',{className:'semester-materials-book-scene'},
            h('div',{className:'semester-materials-book','aria-label':t('Kopertina e vëllimit të semestrit','Semester volume cover')},
              h('span',{className:'semester-materials-book-brand'},'MENTALIST ACADEMY'),
              h('strong',{className:'semester-materials-book-name'},format==='volume'?t('Shënimet e semestrit','Semester notes'):selected?.title),
              h('span',{className:'semester-materials-book-topic'},t('Shënime\nPyetje për ushtrim\nPërgjigje në fund','Notes\nPractice questions\nAnswers at the back')),
              h('span',{className:'semester-materials-book-volume'},volume)),
            h('span',{className:'semester-materials-book-caption'},t('Botim akademik · Mentalist Academy','Academic edition · Mentalist Academy'))),
          h('div',{className:'semester-materials-pitch'},
            h('span',null,t('Koleksioni i semestrit','Semester collection')),
            h('h2',null,format==='volume'?t('Semestri yt, në një vëllim.','Your semester, in one volume.'):t('Fokus te lënda që të duhet.','Focus on the course you need.')),
            h('p',null,t('Planifikuar që shënimet e ndara sipas lëndëve, pyetjet për ushtrim dhe përgjigjet në fund të jenë bashkë — për një përgatitje më të organizuar.','Planned to bring course-by-course notes, practice questions and answers at the back together — for more organised preparation.')),
            h('div',{className:'semester-materials-benefits'},h('span',null,t('Lëndë të ndara qartë','Clear course sections')),h('span',null,t('Pyetje & përgjigje','Questions & answers')),h('span',null,t('Format fizik','Printed format'))))),
        h('h2',null,t('Zgjidh formatin e materialit','Choose your material format')),
        h('div',{className:'semester-materials-formats',role:'group','aria-label':t('Formati','Format')},[['volume',t('Vëllimi i plotë','Complete volume')],['course',t('Lëndë veçmas','Individual course')]].map(([id,label])=>h('button',{key:id,type:'button','aria-pressed':format===id,onClick:()=>setFormat(id)},label))),
        format==='course'&&h('label',{className:'semester-materials-course'},t('Lënda','Course'),h('select',{value:selected?.id||'','aria-label':t('Lënda e materialit fizik','Printed material course'),onChange:event=>setCourseId(event.target.value)},courses.map(course=>h('option',{key:course.id,value:course.id},course.title)))),
        h('h3',null,format==='volume'?volume:selected?.title),
        h('p',{className:'semester-materials-note'},t('Struktura e planifikuar për këtë semestër; materiali fizik ende është duke u përgatitur.','Planned structure for this semester; printed material is still being prepared.')),
        h('ul',{className:'semester-materials-contents'},
          h('li',null,t('Shënime të ndara për çdo lëndë.','Notes separated by course.')),
          h('li',null,t('Pyetje për ushtrim dhe vetëtestim.','Practice and self-test questions.')),
          h('li',null,t('Përgjigjet në fund, të ndara nga pyetjet.','Answers at the back, separate from the questions.')),
          h('li',null,t('QR për provimin përkatës, kur të jetë gati linku publik.','A QR for the corresponding exam once its public link is ready.'))),
        format==='volume'&&h('details',null,h('summary',null,`${included.length} ${t('lëndë të përfshira sipas regjistrimit tënd','courses included based on your enrolment')}`),h('ul',null,included.map(course=>h('li',{key:course.id},course.title)))),
        h('p',{className:'semester-materials-availability',role:'status'},t('Çmimi dhe porosia nuk janë hapur ende. QR-ja do të aktivizohet vetëm me linkun real të provimit.','Price and ordering are not available yet. The QR will be activated only with the real exam link.')),
        h('button',{type:'button',className:'semester-materials-close',onClick:()=>setOpen(false)},t('Mbyll katalogun','Close catalogue'))));
  }
  window.UnitSemesterMaterials = { SemesterMaterials };
})();
