/* Additive local student services. Existing schedule/course/progress data is read-only. */
(function () {
  'use strict';
  const h = React.createElement;
  const { useState, useEffect } = React;
  const tr = language => (sq, en) => language === 'en' ? en : sq;
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && localDate(new Date(`${value}T12:00:00`)) === value;
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
  const dateText = (value, language, short = false) => {
    if (!validDate(value)) return tr(language)('Pa datë','No date');
    const date = new Date(`${value}T12:00:00`);
    const months = language === 'en' ? ['January','February','March','April','May','June','July','August','September','October','November','December'] : ['janar','shkurt','mars','prill','maj','qershor','korrik','gusht','shtator','tetor','nëntor','dhjetor'];
    const month = months[date.getMonth()];
    return `${date.getDate()} ${short ? month.slice(0,3) : month} ${date.getFullYear()}`;
  };
  const safeUrl = value => {
    try { const url = new URL(String(value || '').trim()); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
  };
  const contactUrl = (kind, value) => {
    const clean = String(value || '').trim();
    if (kind === 'email' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(clean) && !/[\r\n?#]/.test(clean)) return `mailto:${encodeURIComponent(clean).replace(/%40/g, '@')}`;
    if (kind === 'phone' && /^\+?[\d ()-]{6,24}$/.test(clean) && clean.replace(/\D/g, '').length >= 6) return `tel:${clean.replace(/[ ()-]/g, '')}`;
    return '';
  };
  const lines = value => String(value || '').split('\n').map(x => x.trim()).filter(Boolean);
  const uid = () => window.crypto?.randomUUID ? window.crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const serviceDefinitions = [
    { id:'tutoring', icon:'★', title:['Mësim shtesë (Tutoring · Max 7)','Extra course tutoring (Max 7)'], description:['Mësim shtesë për një lëndë me pagesë të ndarë ngapak nga studentët (max 7 persona) dhe reviews nga ata që kanë paguar.','Course tutoring with incremental shared student payments (max 7 seats) and verified reviews from paid attendees.'] },
    { id:'applications', icon:'↗', title:['Aplikime & dokumente','Applications & documents'], description:['Dokumentet, kushtet dhe afati, para se ta hapësh linkun.','Documents, criteria and deadlines before opening the link.'] },
    { id:'feedback', icon:'✓', title:['Komentet e profesorit','Professor feedback'], description:['Gabimet që përsëriten: kontrolloji para punimit tjetër.','Recurring mistakes: check them before your next paper.'] },
    { id:'work', icon:'◷', title:['Puna & fakulteti','Work & university'], description:['Krahaso ndërrimet e punës me orarin dhe obligimet akademike.','Compare work shifts with your timetable and academic obligations.'] },
    { id:'spaces', icon:'⌂', title:['Hapësira studimi','Study spaces'], description:['Zgjidh sipas qetësisë, prizave, internetit dhe qasjes.','Choose by quietness, sockets, internet and accessibility.'] },
    { id:'lostfound', icon:'⌕', title:['Humbur / Gjetur','Lost / Found'], description:['Publiko një njoftim dhe kontakto publikuesin, pa bisedë grupi.','Post a notice and contact its publisher, without a group chat.'] },
    { id:'donations', icon:'♡', title:['Dhuro & Shit lirë','Donate & sell affordably'], description:['Dhuro, shit lirë, ndërro ose kërko një send që të nevojitet.','Donate, sell affordably, swap or request an item you need.'] }
  ];
  const schemas = {
    applications:['id','title','source','url','deadline','requirements','criteria','checkedOn'],
    feedback:['id','courseId','paper','comment','action','checked','history'],
    shifts:['id','title','date','start','end'],
    spaces:['id','name','location','quiet','sockets','internet','access','notes','checkedOn'],
    notices:['id','owner','publisher','kind','title','date','location','description','contactKind','contact','resolved'],
    gifts:['id','owner','publisher','mode','price','exchangeFor','category','title','condition','location','description','contactKind','contact','claimed','createdAt'],
    giftReplies:['id','replyTo','owner','publisher','availability','mode','price','exchangeFor','description','contactKind','contact','createdAt']
  };
  function normalizeStore(raw) {
    const result = {};
    Object.entries(schemas).forEach(([key, fields]) => {
      const ids = new Set();
      result[key] = (Array.isArray(raw?.[key]) ? raw[key] : []).slice(0, 200).filter(item => item && typeof item === 'object' && typeof item.id === 'string' && item.id.length <= 150 && !ids.has(item.id) && ids.add(item.id)).map(item => {
        const clean = {};
        fields.forEach(field => {
          if (field === 'checked' || field === 'resolved' || field === 'claimed') clean[field] = item[field] === true;
          else if (field === 'history') clean[field] = (Array.isArray(item[field]) ? item[field] : []).filter(validDate).slice(-50);
          else clean[field] = typeof item[field] === 'string' ? item[field].slice(0, ['requirements','criteria','description','comment','action','notes'].includes(field) ? 4000 : 1000) : '';
        });
        return clean;
      });
    });
    return result;
  }
  function defaultStoreData() {
    const todayStr = localDate();
    const dPlus14 = new Date(); dPlus14.setDate(dPlus14.getDate() + 14);
    const dPlus25 = new Date(); dPlus25.setDate(dPlus25.getDate() + 25);
    const dPlus1 = new Date(); dPlus1.setDate(dPlus1.getDate() + 1);
    const dPlus3 = new Date(); dPlus3.setDate(dPlus3.getDate() + 3);
    return {
      applications: [
        {
          id: 'seed_app_1',
          title: 'Konkursi për Bursën Universitare të Ekselencës',
          source: 'Rektorati i Universitetit / MASHTI',
          url: 'https://uni-pr.edu',
          deadline: localDate(dPlus14),
          checkedOn: todayStr,
          requirements: 'Vërtetimi i statusit të studentit të rregullt\nTranskripta e notave e vulaosur nga dekanati\nKopja e letërnjoftimit dhe llogaria bankare aktive',
          criteria: 'Studentët e rregullt nga viti II e lart me notë mesatare mbi 8.50 dhe pa vite të përsëritura.'
        },
        {
          id: 'seed_app_2',
          title: 'Thirrje për Mobilitet Studentor Erasmus+ (Semestri pasues)',
          source: 'Zyra për Marrëdhënie me Jashtë',
          url: 'https://erasmus-plus.ec.europa.eu',
          deadline: localDate(dPlus25),
          checkedOn: todayStr,
          requirements: 'Certifikata e notave në gjuhën angleze\nLetër motivimi (1 faqe A4)\nMarrëveshja e studimit (Learning Agreement)\nDëshmia e njohjes së gjuhës angleze (B2)',
          criteria: 'Studentët që kanë përfunduar së paku 60 ECTS me sukses në drejtimin përkatës.'
        }
      ],
      feedback: [
        {
          id: 'seed_fb_1',
          courseId: '',
          paper: 'Punimi Seminarik I',
          comment: 'Burimet shkencore duhet të citohen sipas standardit APA 7 në çdo paragraf ku përmenden të dhëna empirike, dhe përfundimi duhet të lidhet drejtpërdrejt me hipotezën.',
          action: 'Kontrollo çdo citim në tekst të ketë vitin e botimit dhe krahasoje me listën përfundimtare të literaturës.',
          checked: true,
          history: [todayStr]
        },
        {
          id: 'seed_fb_2',
          courseId: '',
          paper: 'Raporti i Ushtrimeve Praktike',
          comment: 'Grafikët dhe tabelat duhet të kenë emërtim të qartë dhe njësi matëse para se të interpretohen në tekst.',
          action: 'Vendos numrin dhe titullin mbi çdo tabelë dhe shto 2 fjali shpjeguese poshtë saj.',
          checked: false,
          history: []
        }
      ],
      shifts: [
        {
          id: 'seed_shift_1',
          title: 'Asistent IT / Mbështetje Teknike (Gjysmë orari)',
          date: localDate(dPlus1),
          start: '15:00',
          end: '19:00'
        },
        {
          id: 'seed_shift_2',
          title: 'Praktikë Profesionale',
          date: localDate(dPlus3),
          start: '13:30',
          end: '17:30'
        }
      ],
      spaces: [
        {
          id: 'seed_space_1',
          name: 'Salla e Leximit — Kati II (Biblioteka Qendrore)',
          location: 'Kampusi Universitar, Qendër',
          quiet: 'quiet',
          sockets: 'yes',
          internet: 'yes',
          access: 'accessible',
          notes: 'Tavolina individuale me ndriçim të mirë dhe priza në çdo rresht të dytë. Rekomandohet të shkosh para orës 10:00.',
          checkedOn: todayStr
        },
        {
          id: 'seed_space_2',
          name: 'Këndi i Studimit Grupor — Qendra Studentore',
          location: 'Afër Mensës së Studentëve',
          quiet: 'moderate',
          sockets: 'yes',
          internet: 'yes',
          access: 'accessible',
          notes: 'E përshtatshme për diskutime në grup dhe përsëritje para kolokfiumit.',
          checkedOn: todayStr
        }
      ],
      notices: [
        {
          id: 'seed_notice_1',
          owner: 'peer_1',
          publisher: 'Arbër K.',
          kind: 'found',
          title: 'Kalkulator shkencor Casio fx-991EX',
          date: todayStr,
          location: 'Amfiteatri 2 (pas përfundimit të ushtrimeve)',
          description: 'U gjet në rreshtin e tretë me kapak të zi mbrojtës. E kam lënë te portieri i fakultetit ose më kontaktoni.',
          contactKind: 'phone',
          contact: '+383 44 210 340',
          resolved: false
        },
        {
          id: 'seed_notice_2',
          owner: 'peer_2',
          publisher: 'Elira M.',
          kind: 'lost',
          title: 'Fletore shënimesh me kopertinë blu + USB 32GB',
          date: todayStr,
          location: 'Biblioteka Kombëtare, Salla e Madhe',
          description: 'Ka shënime të lëndëve të semestrit aktual dhe një USB gri të bashkëngjitur në rripin e fletores.',
          contactKind: 'email',
          contact: 'elira.m@student.edu',
          resolved: false
        }
      ],
      gifts: [
        {
          id: 'seed_gift_1',
          owner: 'peer_3',
          publisher: 'Besnik H.',
          mode: 'free',
          price: '',
          exchangeFor: '',
          category: 'materials',
          title: 'Komplet skriptash dhe përmbledhje provimesh (Viti I & II)',
          condition: 'good',
          location: 'Kampusi Universitar / Biblioteka',
          description: 'Të gjitha materialet janë të renditura në dosje, me pyetje të zgjidhura nga afatet e kaluara.',
          contactKind: 'phone',
          contact: '+383 49 412 510',
          claimed: false,
          createdAt: todayStr
        },
        {
          id: 'seed_gift_2',
          owner: 'peer_4',
          publisher: 'Rina D.',
          mode: 'sale',
          price: '8.00',
          exchangeFor: '',
          category: 'furniture',
          title: 'Llambë tavoline LED me 3 nivele ndriçimi',
          condition: 'new',
          location: 'Bregu i Diellit / Konviktet',
          description: 'Punon me kabllo USB dhe ka bateri të brendshme, shumë praktike për lexim natën.',
          contactKind: 'email',
          contact: 'rina.d@student.edu',
          claimed: false,
          createdAt: todayStr
        },
        {
          id: 'seed_gift_3',
          owner: 'peer_5',
          publisher: 'Gentian S.',
          mode: 'wanted',
          price: '',
          exchangeFor: '',
          category: 'electronics',
          title: 'Adapter USB-C në HDMI për prezantime seminarike',
          condition: 'good',
          location: 'Fakultet (çdo ditë 10:00–15:00)',
          description: 'Më nevojitet për prezantimet e javës së ardhshme, me çmim simbolik ose me ndërrim.',
          contactKind: 'phone',
          contact: '+383 45 620 710',
          claimed: false,
          createdAt: todayStr
        }
      ],
      giftReplies: [
        {
          id: 'seed_reply_1',
          replyTo: 'seed_gift_3',
          owner: 'peer_6',
          publisher: 'Driton B.',
          availability: 'yes',
          mode: 'free',
          price: '',
          exchangeFor: '',
          description: 'Kam një adapter rezervë në gjendje shumë të mirë, mund ta marrësh te holli i fakultetit nesër në ora 12:00.',
          contactKind: 'phone',
          contact: '+383 44 890 120',
          createdAt: todayStr
        }
      ]
    };
  }
  function readStore(key) {
    try {
      const rawStr = localStorage.getItem(key);
      if (rawStr === null) return { data:normalizeStore(defaultStoreData()), error:'' };
      return { data:normalizeStore(JSON.parse(rawStr || '{}')), error:'' };
    }
    catch { return { data:normalizeStore(defaultStoreData()), error:'read' }; }
  }
  function useLocalStore(key) {
    const [state, setState] = useState(() => readStore(key));
    useEffect(() => {
      const receive = event => { if (event.key === key) setState(readStore(key)); };
      window.addEventListener('storage', receive);
      return () => window.removeEventListener('storage', receive);
    }, [key]);
    // Write only on deliberate actions, never overwrite corrupt data on mount.
    const update = action => {
      const latest = readStore(key);
      if (latest.error) { setState(previous => ({ ...previous, error:'read' })); return false; }
      const next = normalizeStore(action(latest.data));
      try { localStorage.setItem(key, JSON.stringify(next)); setState({ data:next, error:'' }); return true; }
      catch { setState(previous => ({ ...previous, error:'write' })); return false; }
    };
    return [state.data, update, state.error];
  }
  function timeRange(date, start, end) {
    if (!validDate(date) || !validTime(start) || !validTime(end) || start === end) return null;
    const from = new Date(`${date}T${start}:00`);
    const to = new Date(`${date}T${end}:00`);
    if (to <= from) to.setDate(to.getDate() + 1);
    return { from, to };
  }
  const overlaps = (a, b) => a && b && a.from < b.to && b.from < a.to;
  function conflictsForShift(shift, schedule, obligations) {
    const range = timeRange(shift.date, shift.start, shift.end);
    if (!range) return { conflicts:[], reminders:[] };
    // Include the previous day for academic sessions that cross midnight.
    const dates = [-1,0,1].map(offset => { const date = new Date(`${shift.date}T12:00:00`); date.setDate(date.getDate() + offset); return date; });
    const conflicts = [];
    dates.forEach(date => {
      schedule.filter(session => Number(session.dayOfWeek) === (date.getDay() || 7)).forEach(session => {
        const academicRange = timeRange(localDate(date), session.start, session.end);
        if (overlaps(range, academicRange)) conflicts.push({ ...session, date:localDate(date), source:'schedule' });
      });
    });
    const reminders = obligations.filter(item => validDate(item.date) && new Date(`${item.date}T00:00:00`) < range.to && new Date(`${item.date}T23:59:59`) >= range.from);
    // A deadline/exam date alone is not an exact interval. Do not invent its duration.
    return { conflicts, reminders };
  }
  function matchesSpace(space, filters) {
    return (!filters.search || `${space.name} ${space.location}`.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase())) &&
      ['quiet','sockets','internet','access'].every(key => !filters[key] || space[key] === filters[key]);
  }
  function giftPrice(item) {
    if (item.mode === 'free') return 0;
    const value = String(item.price || '').trim().replace(',', '.');
    if (item.mode !== 'sale' || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 && number <= Number.MAX_SAFE_INTEGER / 100 ? number : null;
  }
  function matchesGift(item, filters) {
    const price = giftPrice(item);
    const valid = ['swap','wanted'].includes(item.mode) || price !== null;
    return !item.claimed && valid && (!filters.mode || item.mode === filters.mode) &&
      (!filters.category || item.category === filters.category) &&
      (!filters.maxPrice || price !== null && price <= Number(filters.maxPrice)) &&
      (!filters.search || `${item.title} ${item.location} ${item.description}`.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()));
  }
  function DateOnly({ language }) {
    const [day, setDay] = useState(localDate);
    useEffect(() => {
      const refresh = () => setDay(localDate());
      const timer = setInterval(refresh, 30000);
      document.addEventListener('visibilitychange', refresh);
      return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
    }, []);
    return h('time', { dateTime:day }, dateText(day,language));
  }
  function ServicesCards({ language, onOpen }) {
    const t = tr(language);
    return h(React.Fragment, null, serviceDefinitions.map(service => h('section', { key:service.id, className:'profile-service-card student-support-service-card card-surface' },
      h('span', { className:'student-support-service-icon', 'aria-hidden':true }, service.icon),
      h('h2', null, t(...service.title)),
      h('p', { className:'student-support-note' }, t(...service.description)),
      h('button', { type:'button', className:'student-support-button primary', onClick:() => onOpen(service.id), 'aria-label':`${t('Hap','Open')} ${t(...service.title)}` }, t('Hap shërbimin →','Open service →')))));
  }
  function SupportPage({ service, language, scope, studentName, courses = [], schedule = [], obligations = [], campusSpots = [], onBack }) {
    const t = tr(language);
    const [data, save, storeError] = useLocalStore(`unit_student_support_v1:${encodeURIComponent(scope)}`);
    const [board, saveBoard, boardError] = useLocalStore(`unit_student_notices_v1:${encodeURIComponent(scope.split('|')[0])}`);
    const [exchange, saveExchange, exchangeError] = useLocalStore(`unit_student_exchange_v1:${encodeURIComponent(scope.split('|')[0])}`);
    const [draft, setDraft] = useState(null);
    const [notice, setNotice] = useState('');
    const [filter, setFilter] = useState('');
    const [search, setSearch] = useState('');
    const [spaceFilters, setSpaceFilters] = useState({ search:'', quiet:'', sockets:'', internet:'', access:'' });
    const [giftFilters, setGiftFilters] = useState({ search:'', mode:'', category:'', maxPrice:'' });
    const definition = serviceDefinitions.find(item => item.id === service);
    if (!definition) return null;
    const formatDate = value => dateText(value,language,true);
    const courseName = id => courses.find(course => String(course.id) === id)?.title || t('Pa lëndë të lidhur','No linked course');
    const button = (label, onClick, primary = false, props = {}) => h('button', { type:'button', className:`student-support-button${primary ? ' primary' : ''}`, onClick, ...props }, label);
    const options = entries => entries.map(([value,label]) => h('option', { key:value, value }, label));
    const field = (key, label, type = 'text', required = false, wide = false, choices = null) => h('label', { className:`student-support-field${wide ? ' wide' : ''}`, key }, label,
      h(choices ? 'select' : type === 'textarea' ? 'textarea' : 'input', {
        ...(choices || type === 'textarea' ? {} : { type }),
        value:draft?.[key] ?? '', required, 'aria-label':label,
        ...(type === 'textarea' ? { rows:3, maxLength:4000 } : choices ? {} : type === 'number' ? { min:'0.01', step:'0.01', inputMode:'decimal' } : { maxLength:1000 }),
        onChange:event => setDraft(previous => ({ ...previous, [key]:event.target.value, ...(key==='availability'&&event.target.value==='yes'?{mode:previous.mode||'free',contactKind:previous.contactKind||'email'}:{}) }))
      }, choices ? options(choices) : undefined));
    const courseOptions = [['',t('Pa lëndë të lidhur','No linked course')], ...courses.map(course => [String(course.id),course.title])];
    const yesNo = [['unknown',t('Nuk dihet','Unknown')],['yes',t('Po','Yes')],['no',t('Jo','No')]];
    const quietOptions = [['unknown',t('Nuk dihet','Unknown')],['quiet',t('E qetë','Quiet')],['moderate',t('Mesatare','Moderate')],['lively',t('Me zhurmë','Lively')]];
    const accessOptions = [['unknown',t('Nuk dihet','Unknown')],['accessible',t('Qasje pa shkallë','Step-free access')],['limited',t('Qasje e kufizuar','Limited access')]];
    const giftCategories = [['materials',t('Materiale & mjete studimi','Study materials & supplies')],['electronics',t('Pajisje elektronike','Electronics')],['furniture',t('Sende për banesë','Household items')],['clothing',t('Veshje','Clothing')],['other',t('Të tjera','Other')]];
    const giftConditions = [['new',t('E re / e papërdorur','New / unused')],['good',t('E përdorur, në gjendje të mirë','Used, in good condition')],['worn',t('E përdorur, me shenja përdorimi','Used, with wear')]];
    const selectFilter = (label, value, entries, change, props = {}) => h('label', { className:'student-support-field' }, label, h('select', { className:'student-support-filter', value, 'aria-label':label, onChange:event => change(event.target.value), ...props }, options(entries)));
    const empty = message => h('div', { className:'student-support-panel student-support-empty' }, h('p', { className:'student-support-text' }, message));
    const mutate = (collection, transform) => save(previous => ({ ...previous, [collection]:transform(previous[collection]) }));
    const remove = (collection, id, shared = false) => {
      if (!window.confirm(t('Ta fshij këtë shënim?','Delete this entry?'))) return;
      const write = previous => ({ ...previous, [collection]:previous[collection].filter(item => item.id !== id), ...(collection==='gifts'?{giftReplies:previous.giftReplies.filter(item=>item.replyTo!==id)}:{}) });
      const ok = shared ? (['gifts','giftReplies'].includes(collection) ? saveExchange(write) : saveBoard(write)) : save(write);
      if (ok) setNotice(t('U fshi.','Deleted.'));
    };
    const editActions = (collection, item, shared = false) => h('div', { className:'student-support-toolbar' },
      button(t('Ndrysho','Edit'), () => { setDraft({ ...item }); setNotice(''); window.scrollTo({ top:0, behavior:'smooth' }); }),
      button(t('Fshi','Delete'), () => remove(collection, item.id, shared), false, { className:'student-support-button danger', 'aria-label':`${t('Fshi','Delete')} ${item.title || item.name || item.comment || item.publisher}` }));
    const startNew = () => {
      setNotice('');
      const defaults = {
        applications:{ title:'', source:'', url:'', deadline:'', requirements:'', criteria:'', checkedOn:localDate() },
        feedback:{ courseId:'', paper:'', comment:'', action:'', checked:false, history:[] },
        work:{ title:'', date:localDate(), start:'09:00', end:'17:00' },
        spaces:{ name:'', location:'', quiet:'unknown', sockets:'unknown', internet:'unknown', access:'unknown', notes:'', checkedOn:localDate() },
        lostfound:{ owner:scope, publisher:studentName, kind:'lost', title:'', date:localDate(), location:'', description:'', contactKind:'email', contact:'', resolved:false },
        donations:{ owner:scope, publisher:studentName, mode:'free', price:'', exchangeFor:'', category:'materials', title:'', condition:'good', location:'', description:'', contactKind:'email', contact:'', claimed:false, createdAt:localDate() }
      };
      setDraft(defaults[service]);
    };
    const submit = event => {
      event.preventDefault();
      const next = { ...draft };
      Object.keys(next).forEach(key => { if (typeof next[key] === 'string') next[key] = next[key].trim(); });
      if (service === 'donations' && next.replyTo) {
        const target = exchange.gifts.find(item=>item.id===next.replyTo&&item.mode==='wanted'&&!item.claimed);
        const offered = next.availability === 'yes';
        if (!target || target.owner===scope || !next.publisher || !['yes','no'].includes(next.availability) || offered && (!['free','sale','swap'].includes(next.mode) || next.mode==='sale'&&giftPrice(next)===null || next.mode==='swap'&&!next.exchangeFor || !contactUrl(next.contactKind,next.contact))) {
          setNotice(t('Kontrollo kërkesën dhe plotëso mënyrën e ofertës e kontaktin. Nuk mund t’i përgjigjesh kërkesës tënde ose një kërkese të mbyllur.','Check the request and complete the offer and contact. You cannot respond to your own or a closed request.')); return;
        }
        const previousReply = exchange.giftReplies.find(item=>item.replyTo===next.replyTo&&item.owner===scope);
        const reply = {...next,id:previousReply?.id||uid(),owner:scope,createdAt:previousReply?.createdAt||localDate(),price:offered&&next.mode==='sale'?giftPrice(next).toFixed(2):'',exchangeFor:offered&&next.mode==='swap'?next.exchangeFor:'',description:offered?next.description:'',mode:offered?next.mode:'',contact:offered?next.contact:'',contactKind:offered?next.contactKind:''};
        if (!previousReply && exchange.giftReplies.length>=200) { setNotice(t('Arrite kufirin prej 200 përgjigjesh.','You reached the limit of 200 responses.')); return; }
        if (saveExchange(previous=>({...previous,giftReplies:[reply,...previous.giftReplies.filter(item=>!(item.replyTo===reply.replyTo&&item.owner===scope))]}))) { setDraft(null); setNotice(t('Përgjigjja u publikua në tabelë.','Response published on the board.')); }
        return;
      }
      let error = '';
      if (service === 'applications' && (!next.title || !next.source || !safeUrl(next.url) || !lines(next.requirements).length || !next.criteria || (next.deadline && !validDate(next.deadline)) || !validDate(next.checkedOn) || next.checkedOn > localDate())) error = t('Plotëso dokumentet, kushtet, burimin dhe një link HTTP/HTTPS të vlefshëm. Kontrollo datat.','Fill in documents, criteria, source and a valid HTTP/HTTPS link. Check the dates.');
      if (service === 'feedback' && (!next.comment || !next.action)) error = t('Shkruaj komentin dhe çfarë do të kontrollosh.','Enter the feedback and what you will check.');
      if (service === 'work' && (!next.title || !timeRange(next.date,next.start,next.end))) error = t('Plotëso ndërrimin me datë dhe orë të vlefshme. Fillimi dhe fundi nuk mund të jenë njësoj.','Enter a valid shift date and times. Start and end cannot be identical.');
      if (service === 'spaces' && (!next.name || !next.location || !validDate(next.checkedOn) || next.checkedOn > localDate())) error = t('Shkruaj emrin, vendndodhjen dhe një datë kontrolli të vlefshme.','Enter the name, location and a valid check date.');
      if (service === 'lostfound' && (!next.title || !next.location || !next.publisher || !validDate(next.date) || next.date > localDate() || !contactUrl(next.contactKind,next.contact))) error = t('Plotëso njoftimin, datën, vendin dhe emailin ose telefonin e vlefshëm të kontaktit.','Complete the notice, date, location and a valid contact email or phone.');
      if (service === 'donations') {
        if (!next.title || !next.location || !next.publisher || !giftCategories.some(([value])=>value===next.category) || !giftConditions.some(([value])=>value===next.condition) || !['free','sale','swap','wanted'].includes(next.mode) || next.mode==='sale'&&giftPrice(next)===null || next.mode==='swap'&&!next.exchangeFor || !contactUrl(next.contactKind,next.contact)) error = t('Plotëso sendin, gjendjen, vendin dhe kontaktin. Për shitje vendos çmimin; për ndërrim trego çfarë kërkon në këmbim.','Complete the item, condition, location and contact. For a sale enter the price; for a swap specify what you want in exchange.');
        else { next.price = next.mode === 'sale' ? giftPrice(next).toFixed(2) : ''; next.exchangeFor = next.mode==='swap'?next.exchangeFor:''; next.owner = scope; }
      }
      if (error) { setNotice(error); return; }
      next.id = next.id || uid();
      const collection = { applications:'applications', feedback:'feedback', work:'shifts', spaces:'spaces', lostfound:'notices', donations:'gifts' }[service];
      const source = service === 'lostfound' ? board : service === 'donations' ? exchange : data;
      if (!source[collection].some(item => item.id === next.id) && source[collection].length >= 200) { setNotice(t('Arrite kufirin prej 200 shënimesh.','You reached the limit of 200 entries.')); return; }
      const write = previous => ({ ...previous, [collection]:[next, ...previous[collection].filter(item => item.id !== next.id)] });
      const ok = service === 'lostfound' ? saveBoard(write) : service === 'donations' ? saveExchange(write) : save(write);
      if (ok) { setDraft(null); setNotice(t('U ruajt në këtë pajisje.','Saved on this device.')); }
    };
    const forms = () => {
      if (!draft) return null;
      let fields;
      if (service === 'applications') fields = [field('title',t('Titulli i aplikimit','Application title'),'text',true),field('source',t('Institucioni / burimi','Institution / source'),'text',true),field('url',t('Linku zyrtar','Official link'),'url',true,true),field('deadline',t('Afati (nëse dihet)','Deadline (if known)'),'date'),field('checkedOn',t('Kërkesat u kontrolluan më','Requirements checked on'),'date',true),field('requirements',t('Dokumentet që duhen — një në çdo rresht','Required documents — one per line'),'textarea',true,true),field('criteria',t('Kush mund të aplikojë / kushte të tjera','Who can apply / other criteria'),'textarea',true,true)];
      if (service === 'feedback') fields = [field('courseId',t('Lënda','Course'),'text',false,false,courseOptions),field('paper',t('Punimi ku mora komentin (opsional)','Paper where I received feedback (optional)')),field('comment',t('Komenti i profesorit','Professor feedback'),'textarea',true,true),field('action',t('Çfarë të kontrolloj në punimin tjetër?','What should I check in my next paper?'),'textarea',true,true)];
      if (service === 'work') fields = [field('title',t('Emri i ndërrimit / puna','Shift / job name'),'text',true),field('date',t('Data e fillimit','Start date'),'date',true),field('start',t('Fillon në','Starts at'),'time',true),field('end',t('Mbaron në','Ends at'),'time',true),h('p',{key:'hint',className:'student-support-note'},t('Kur ora e fundit është më e hershme, ndërrimi mbaron ditën tjetër.','When the end time is earlier, the shift ends the next day.'))];
      if (service === 'spaces') fields = [field('name',t('Emri i hapësirës','Space name'),'text',true),field('location',t('Vendndodhja','Location'),'text',true),field('quiet',t('Qetësia','Quietness'),'text',true,false,quietOptions),field('sockets',t('Priza','Sockets'),'text',true,false,yesNo),field('internet',t('Internet','Internet'),'text',true,false,yesNo),field('access',t('Qasja','Accessibility'),'text',true,false,accessOptions),field('checkedOn',t('Shënimi u përditësua më','Note updated on'),'date',true),field('notes',t('Sqarime për qasjen / kushte të tjera','Access details / other conditions'),'textarea',false,true)];
      if (service === 'lostfound') fields = [field('kind',t('Lloji i njoftimit','Notice type'),'text',true,false,[['lost',t('Humbur','Lost')],['found',t('Gjetur','Found')]]),field('title',t('Sendi','Item'),'text',true),field('date',t('Data kur humbi / u gjet','Date lost / found'),'date',true),field('location',t('Ku?','Where?'),'text',true),field('description',t('Përshkrim i shkurtër, pa të dhëna të ndjeshme','Short description, without sensitive details'),'textarea',false,true),field('publisher',t('Emri i publikuesit','Publisher name'),'text',true),field('contactKind',t('Mënyra e kontaktit','Contact method'),'text',true,false,[['email',t('Email','Email')],['phone',t('Telefon','Phone')]]),field('contact',t('Kontakti që pranoj të shfaqet','Contact I agree to display'),'text',true),h('p',{key:'privacy',className:'student-support-note'},t('Mos publiko numra personalë, dokumente identifikimi ose fotografi me të dhëna private. Kontakti shfaqet në njoftim me zgjedhjen tënde.','Do not post identity numbers, ID documents or photos containing private data. Your chosen contact is displayed in the notice.'))];
      const contactFields = () => [field('publisher',t('Emri i publikuesit','Publisher name'),'text',true),field('contactKind',t('Mënyra e kontaktit','Contact method'),'text',true,false,[['email','Email'],['phone',t('Telefon','Phone')]]),field('contact',t('Kontakti që pranoj të shfaqet','Contact I agree to display'),'text',true)];
      if (service === 'donations' && !draft.replyTo) fields = [
        field('mode',t('Si dëshiron ta ofrosh?','How would you like to offer it?'),'text',true,false,[['free',t('Dhurim falas','Free donation')],['sale',t('Shitje me çmim simbolik','Sale at a small price')],['swap',t('Ndërrim','Swap')],['wanted',t('Po kërkoj','Wanted')]]),
        field('title',draft.mode==='wanted'?t('Çfarë po kërkon?','What are you looking for?'):t('Çfarë po ofron?','What are you offering?'),'text',true),
        ...(draft.mode==='sale'?[field('price',t('Çmimi simbolik (€)','Small price (€)'),'number',true)]:[]),
        ...(draft.mode==='swap'?[field('exchangeFor',t('Çfarë kërkon në këmbim?','What would you like in exchange?'),'text',true,true)]:[]),
        field('category',t('Kategoria','Category'),'text',true,false,giftCategories),field('condition',t('Gjendja e sendit','Item condition'),'text',true,false,giftConditions),
        field('location',draft.mode==='wanted'?t('Ku të përshtatet ta marrësh?','Where could you collect it?'):t('Ku mund të merret?','Where can it be collected?'),'text',true),
        field('description',t('Përshkrimi dhe çfarë duhet ditur','Description and anything to know'),'textarea',false,true),...contactFields(),
        h('p',{key:'privacy',className:'student-support-note wide'},t('Përshkruaje sendin saktë. Mbaje çmimin të ulët dhe dorëzoje në vend publik. Mos publiko adresën e shtëpisë ose të dhëna të ndjeshme. Kontakti shfaqet me zgjedhjen tënde.','Describe the item accurately. Keep the price low and use a public collection point. Do not post a home address or sensitive details. Your contact is displayed by your choice.'))];
      if (service === 'donations' && draft.replyTo) fields = [
        h('p',{key:'target',className:'student-support-note wide'},exchange.gifts.find(item=>item.id===draft.replyTo)?.title),
        field('availability',t('A e ke sendin?','Do you have the item?'),'text',true,false,[['yes',t('Po, e kam','Yes, I have it')],['no',t('Jo, nuk e kam','No, I do not')]]),
        ...(draft.availability==='yes' ? [field('mode',t('Si mund ta japësh?','How can you offer it?'),'text',true,false,[['free',t('Falas','Free')],['sale',t('Me çmim simbolik','At a small price')],['swap',t('Me ndërrim','As a swap')]]),...(draft.mode==='sale'?[field('price',t('Çmimi simbolik (€)','Small price (€)'),'number',true)]:[]),...(draft.mode==='swap'?[field('exchangeFor',t('Çfarë kërkon në këmbim?','What would you like in exchange?'),'text',true,true)]:[]),field('description',t('Gjendja dhe detajet e ofertës','Condition and offer details'),'textarea',false,true),...contactFields()] : [field('publisher',t('Emri i publikuesit','Publisher name'),'text',true)]),
        h('p',{key:'public',className:'student-support-note wide'},t('Përgjigjja shfaqet drejtpërdrejt nën shpallje. Vendos vetëm të dhënat e kontaktit që dëshiron të jenë publike.','Your response appears directly under the listing. Include only the contact details you wish to share.'))];
      return h('section', { className:'student-support-panel' },h('h2',null,draft.replyTo?t('Përgjigje kërkesës','Respond to request'):draft.id ? t('Ndrysho shënimin','Edit entry') : t('Shënim i ri','New entry')),h('form',{ className:'student-support-form',onSubmit:submit },...fields,h('div',{className:'student-support-toolbar'},h('button',{type:'submit',className:'student-support-button primary'},t('Ruaj','Save')),button(t('Anulo','Cancel'),()=>{setDraft(null);setNotice('');}))));
    };
    function applicationsView() {
      const records = data.applications.filter(item => `${item.title} ${item.source}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
      return h(React.Fragment,null,
        h('label',{className:'student-support-field'},t('Kërko aplikime','Search applications'),h('input',{className:'student-support-filter',value:search,onChange:event=>setSearch(event.target.value),type:'search'})),
        h('p',{className:'student-support-note'},t('Kërkesat merren nga burimi dhe futen këtu. Ky version nuk tërheq automatikisht thirrje zyrtare; para dërgimit kontrollo edhe burimin për ndryshime.','Requirements are copied from the source into this view. This version does not automatically fetch official calls; check the source again for changes before submitting.')),
        h('div',{className:'student-support-grid'},records.map(item=>h('article',{className:'student-support-panel',key:item.id},
          h('h2',null,item.title),h('p',{className:'student-support-note'},item.source),
          h('div',{className:'student-support-toolbar'},h('span',{className:'student-support-badge'},item.deadline ? `${t('Afati','Deadline')}: ${formatDate(item.deadline)}` : t('Afati nuk dihet','Deadline unknown')),validDate(item.deadline)&&item.deadline<localDate()&&h('span',{className:'student-support-badge'},t('Afati ka kaluar','Deadline passed'))),
          h('h3',null,t('Çfarë dokumentesh të nevojiten?','What documents do you need?')),
          h('ul',null,lines(item.requirements).map((line,index)=>h('li',{className:'student-support-text',key:index},`• ${line}`))),
          h('h3',null,t('Kush mund të aplikojë?','Who can apply?')),h('p',{className:'student-support-text'},item.criteria),
          h('p',{className:'student-support-note'},`${t('Kontrolluar më','Checked on')}: ${formatDate(item.checkedOn)} · ${t('Konfirmuar nga komuniteti studentor','Confirmed by the student community')}`),
          safeUrl(item.url)&&h('a',{className:'student-support-button primary',href:safeUrl(item.url),target:'_blank',rel:'noopener noreferrer'},t('Hap aplikimin ↗','Open application ↗')),editActions('applications',item)))),
        !records.length&&empty(t('Ende nuk ka aplikime. Shto një thirrje dhe kërkesat e saj që të jenë të dukshme para linkut.','No applications yet. Add a call and its requirements so they are visible before the link.')));
    }
    function feedbackView() {
      const entries = data.feedback.filter(item=>!filter||item.courseId===filter);
      const checked = entries.filter(item=>item.checked).length;
      const newPaper = () => {
        if (!checked || !window.confirm(t('Të nisë kontrolli për punimin tjetër? Komentet dhe historia ruhen.','Start checking your next paper? Feedback and history are kept.'))) return;
        if (mutate('feedback',items=>items.map(item=>entries.some(entry=>entry.id===item.id)&&item.checked ? {...item,checked:false,history:[...(item.history||[]),localDate()].slice(-50)} : item))) setNotice(t('Lista është gati për punimin tjetër; historia u ruajt.','The checklist is ready for your next paper; history was saved.'));
      };
      return h(React.Fragment,null,
        h('div',{className:'student-support-filters'},selectFilter(t('Filtro sipas lëndës','Filter by course'),filter,[['',t('Të gjitha lëndët','All courses')],...courseOptions.slice(1)],setFilter)),
        h('div',{className:'student-support-toolbar'},h('span',{className:'student-support-badge'},`${checked}/${entries.length} ${t('të kontrolluara','checked')}`),button(t('Nis punimin tjetër','Start next paper'),newPaper,false,{disabled:!checked})),
        entries.map(item=>h('article',{className:'student-support-panel',key:item.id},
          h('p',{className:'student-support-note'},`${courseName(item.courseId)}${item.paper ? ` · ${item.paper}` : ''}`),
          h('h3',null,t('Komenti i profesorit','Professor feedback')),h('p',{className:'student-support-text'},item.comment),
          h('label',{className:`student-support-check${item.checked?' is-checked':''}`},h('input',{type:'checkbox',checked:item.checked,onChange:event=>mutate('feedback',items=>items.map(entry=>entry.id===item.id?{...entry,checked:event.target.checked}:entry))}),h('span',null,item.action)),
          item.history.length>0&&h('details',null,h('summary',{className:'student-support-note'},`${item.history.length} ${t('kontrolle në punime të mëparshme','previous paper checks')}`),h('p',{className:'student-support-note'},item.history.map(formatDate).join(' · '))),editActions('feedback',item))),
        !entries.length&&empty(t('Shto një koment të profesorit dhe ktheje në një kontroll konkret për punimin tjetër.','Add professor feedback and turn it into a concrete check for your next paper.')));
    }
    function workView() {
      return h(React.Fragment,null,
        h('p',{className:'student-support-note'},t('Krahasohen seancat nga orari yt aktual dhe afatet akademike. Ndërrimet ruhen veçmas dhe nuk e ndryshojnë orarin e fakultetit. Orari javor zbatohet në datën e ndërrimit; kontrollo anulimet, pushimet dhe ndryshimet zyrtare.','Uses your current timetable and academic deadlines. Shifts are stored separately and do not change the university timetable. The weekly timetable is projected onto the shift date; check cancellations, holidays and official changes.')),
        !schedule.length&&h('p',{className:'student-support-alert'},t('Nuk ka seanca në orarin aktual. Shto orarin te Orari për krahasim të plotë.','No sessions in the current timetable. Add your timetable under Schedule for a full comparison.')),
        data.shifts.slice().sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)).map(shift=>{
          const result=conflictsForShift(shift,schedule,obligations);
          return h('article',{key:shift.id,className:'student-support-panel'},h('h2',null,shift.title),h('p',{className:'student-support-note'},`${formatDate(shift.date)} · ${shift.start}–${shift.end}${shift.end<shift.start?` (${t('dita tjetër','next day')})`:''}`),
            result.conflicts.map((item,index)=>h('p',{className:'student-support-alert conflict',key:`c${index}`},`${t('Përplasje me orarin','Timetable conflict')}: ${courseName(String(item.courseId))} · ${formatDate(item.date)} · ${item.start}–${item.end}`)),
            result.reminders.map((item,index)=>h('p',{className:'student-support-alert',key:`r${index}`},`${t('Kontrollo obligimin akademik','Check academic obligation')}: ${item.title||courseName(String(item.courseId))} · ${formatDate(item.date)}. ${t('Afati nuk ka interval të plotë; përplasja kërkon kontroll manual.','No complete time interval; a clash needs manual checking.')}`)),
            !result.conflicts.length&&h('p',{className:'student-support-note'},t('Nuk u gjet përplasje me seancat e regjistruara. Kjo nuk përfshin obligime që mungojnë në app.','No conflict with registered sessions. This does not include obligations missing from the app.')),editActions('shifts',shift));
        }),!data.shifts.length&&empty(t('Shto një ndërrim pune për të parë nëse përplaset me fakultetin.','Add a work shift to check for university conflicts.')));
    }
    function spacesView() {
      const savedIds = new Set(data.spaces.map(item=>item.id));
      const existing = campusSpots.filter(item=>item.category==='study'&&!savedIds.has(`campus:${item.id}`)).map(item=>({id:`campus:${item.id}`,name:item.name,location:item.location,quiet:'unknown',sockets:'unknown',internet:'unknown',access:'unknown',notes:'',checkedOn:'', imported:true}));
      const spaces=[...data.spaces,...existing].filter(item=>matchesSpace(item,spaceFilters));
      const filterSetter=key=>value=>setSpaceFilters(previous=>({...previous,[key]:value}));
      const labelOf=(entries,value)=>entries.find(entry=>entry[0]===value)?.[1]||t('Nuk dihet','Unknown');
      return h(React.Fragment,null,
        h('p',{className:'student-support-note'},t('Emrat nga harta ekzistuese janë vetëm pika nisjeje. Kushtet mbeten “Nuk dihet” derisa t’i plotësosh; nuk premtohet qasje ose pajisje pa kontroll në vend.','Names from the existing map are starting points only. Conditions stay “Unknown” until you fill them in; access and amenities are not promised without an on-site check.')),
        h('div',{className:'student-support-filters'},h('label',{className:'student-support-field'},t('Kërko vend','Search location'),h('input',{type:'search',className:'student-support-filter',value:spaceFilters.search,onChange:event=>filterSetter('search')(event.target.value)})),
          selectFilter(t('Qetësia','Quietness'),spaceFilters.quiet,[['',t('Çfarëdo','Any')],...quietOptions],filterSetter('quiet')),
          selectFilter(t('Priza','Sockets'),spaceFilters.sockets,[['',t('Çfarëdo','Any')],...yesNo],filterSetter('sockets')),
          selectFilter(t('Internet','Internet'),spaceFilters.internet,[['',t('Çfarëdo','Any')],...yesNo],filterSetter('internet')),
          selectFilter(t('Qasja','Accessibility'),spaceFilters.access,[['',t('Çfarëdo','Any')],...accessOptions],filterSetter('access'))),
        h('div',{className:'student-support-grid'},spaces.map(space=>h('article',{className:'student-support-panel',key:space.id},h('h2',null,space.name),h('p',{className:'student-support-note'},space.location),
          h('dl',{className:'student-support-specs'},[['Qetësia','Quietness',quietOptions,space.quiet],['Priza','Sockets',yesNo,space.sockets],['Internet','Internet',yesNo,space.internet],['Qasja','Accessibility',accessOptions,space.access]].map(([sq,en,entries,value])=>h('div',{key:en},h('dt',null,t(sq,en)),h('dd',null,labelOf(entries,value))))),
          space.notes&&h('p',{className:'student-support-text'},space.notes),h('p',{className:'student-support-note'},space.checkedOn?`${t('Sipas shënimit tënd','Based on your note')} · ${formatDate(space.checkedOn)}`:t('Kushtet ende nuk janë plotësuar.','Conditions have not been added yet.')),
          h('a',{className:'student-support-button',href:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${space.name} ${space.location}`)}`,target:'_blank',rel:'noopener noreferrer'},t('Shiko vendndodhjen ↗','View location ↗')),
          space.imported?button(t('Plotëso kushtet','Add conditions'),()=>setDraft({...space,checkedOn:localDate()})):editActions('spaces',space)))),
        !spaces.length&&empty(t('Nuk ka hapësira me këto kushte. Kushtet e panjohura nuk numërohen si të konfirmuara.','No spaces match these conditions. Unknown amenities are not counted as confirmed.')));
    }
    function lostFoundView() {
      const records=board.notices.filter(item=>(!filter||item.kind===filter)&&!item.resolved&&`${item.title} ${item.location} ${item.description}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
      const resolved=board.notices.filter(item=>item.resolved&&item.owner===scope);
      return h(React.Fragment,null,
        h('div',{className:'student-support-filters'},selectFilter(t('Shfaq','Show'),filter,[['',t('Humbur dhe Gjetur','Lost and Found')],['lost',t('Humbur','Lost')],['found',t('Gjetur','Found')]],setFilter),h('label',{className:'student-support-field'},t('Kërko send ose vend','Search item or location'),h('input',{className:'student-support-filter',type:'search',value:search,onChange:event=>setSearch(event.target.value)}))),
        h('p',{className:'student-support-alert'},t('Tabela e komunitetit për drejtimin tënd: kontakto publikuesin drejtpërdrejt përmes emailit ose telefonit të shënuar në njoftim.','Department community board: contact the publisher directly via the email or phone listed on the post.')),
        h('div',{className:'student-support-grid'},records.map(item=>h('article',{className:'student-support-panel',key:item.id},h('span',{className:'student-support-badge'},item.kind==='found'?t('Gjetur','Found'):t('Humbur','Lost')),h('h2',null,item.title),h('p',{className:'student-support-note'},`${item.location} · ${formatDate(item.date)}`),h('p',{className:'student-support-text'},item.description),h('p',{className:'student-support-note'},`${t('Publikoi','Posted by')}: ${item.publisher}`),
          contactUrl(item.contactKind,item.contact)&&h('a',{className:'student-support-button primary',href:contactUrl(item.contactKind,item.contact)},t('Kontakto publikuesin','Contact publisher')),
          h('p',{className:'student-support-note'},item.contact),
          item.owner===scope&&h(React.Fragment,null,button(t('Shëno të zgjidhur','Mark resolved'),()=>saveBoard(previous=>({...previous,notices:previous.notices.map(entry=>entry.id===item.id?{...entry,resolved:true}:entry)}))),editActions('notices',item,true))))),
        !records.length&&empty(t('Nuk ka njoftime aktive. Shto sendin e humbur ose të gjetur dhe kontaktin e publikuesit.','No active notices. Add a lost or found item and the publisher contact.')),
        resolved.length>0&&h('details',{className:'student-support-panel'},h('summary',null,`${t('Njoftimet e mia të zgjidhura','My resolved notices')} (${resolved.length})`),resolved.map(item=>h('div',{key:item.id,className:'student-support-toolbar'},h('span',{className:'student-support-text'},item.title),button(t('Rihap','Reopen'),()=>saveBoard(previous=>({...previous,notices:previous.notices.map(entry=>entry.id===item.id?{...entry,resolved:false}:entry)}))),button(t('Fshi','Delete'),()=>remove('notices',item.id,true))))));
    }
    function donationsView() {
      const records = exchange.gifts.filter(item=>matchesGift(item,giftFilters));
      const archived = exchange.gifts.filter(item=>item.claimed&&item.owner===scope);
      const setGiftFilter = key => value => setGiftFilters(previous=>({...previous,[key]:value}));
      const labelOf = (entries,value) => entries.find(entry=>entry[0]===value)?.[1] || t('Të tjera','Other');
      const markClaimed = (id,claimed) => saveExchange(previous=>({...previous,gifts:previous.gifts.map(item=>item.id===id&&item.owner===scope?{...item,claimed}:item)}));
      const modeLabel = item => item.mode==='free'?t('Falas','Free'):item.mode==='swap'?t('Ndërrim','Swap'):item.mode==='wanted'?t('Po kërkoj','Wanted'):`${giftPrice(item).toFixed(2)} €`;
      const respond = item => {
        const existing = exchange.giftReplies.find(reply=>reply.replyTo===item.id&&reply.owner===scope);
        setDraft(existing?{...existing}:{replyTo:item.id,owner:scope,publisher:studentName,availability:'yes',mode:'free',price:'',exchangeFor:'',description:'',contactKind:'email',contact:''});
        setNotice(''); window.scrollTo({top:0,behavior:'smooth'});
      };
      const responseList = item => {
        const replies = exchange.giftReplies.filter(reply=>reply.replyTo===item.id);
        return h('div',{className:'student-exchange-responses'},
          item.owner!==scope&&button(exchange.giftReplies.some(reply=>reply.replyTo===item.id&&reply.owner===scope)?t('Ndrysho përgjigjen time','Edit my response'):t('Përgjigju kërkesës','Respond to request'),()=>respond(item)),
          replies.length>0&&h('details',null,h('summary',null,`${t('Përgjigjet','Responses')} (${replies.length})`),replies.map(reply=>h('section',{className:'student-exchange-response',key:reply.id},
            h('strong',null,reply.availability==='yes'?`${t('E kam','I have it')} · ${modeLabel(reply)}`:t('Nuk e kam','I do not have it')),
            reply.mode==='swap'&&h('p',{className:'student-support-text'},`${t('Në këmbim','In exchange')}: ${reply.exchangeFor}`),
            reply.description&&h('p',{className:'student-support-text'},reply.description),h('p',{className:'student-support-note'},reply.publisher),
            reply.availability==='yes'&&contactUrl(reply.contactKind,reply.contact)&&h('a',{className:'student-support-button',href:contactUrl(reply.contactKind,reply.contact)},t('Kontakto për ofertën','Contact about offer')),
            reply.owner===scope&&editActions('giftReplies',reply,true)))),
          item.owner===scope&&!replies.length&&h('p',{className:'student-support-note'},t('Ende pa përgjigje. Studentët e tjerë mund të tregojnë nëse e kanë dhe si mund ta ofrojnë.','No responses yet. Other students can indicate whether they have it and how they can offer it.')));
      };
      return h(React.Fragment,null,
        h('p',{className:'student-support-alert'},t('Tabelë lokale demonstrimi për këtë drejtim: shpalljet ruhen vetëm në këtë shfletues, jo në pajisjet e studentëve të tjerë. Nuk ka pagesa ose chat brenda app-it. Kontakti hap emailin/telefonin e zgjedhur nga publikuesi.','Local demonstration board for this department: listings are saved only in this browser, not on other students’ devices. No in-app payments or chat. Contact opens the email/phone chosen by the publisher.')),
        h('div',{className:'student-support-filters'},
          h('label',{className:'student-support-field'},t('Kërko send ose vend','Search item or location'),h('input',{type:'search',className:'student-support-filter','aria-label':t('Kërko send ose vend','Search item or location'),value:giftFilters.search,onChange:event=>setGiftFilter('search')(event.target.value)})),
          selectFilter(t('Oferta','Offer'),giftFilters.mode,[['',t('Të gjitha','All')],['free',t('Falas','Free')],['sale',t('Me çmim simbolik','At a small price')],['swap',t('Ndërrim','Swap')],['wanted',t('Po kërkoj','Wanted')]],value=>setGiftFilters(previous=>({...previous,mode:value,maxPrice:['swap','wanted'].includes(value)?'':previous.maxPrice}))),
          selectFilter(t('Kategoria','Category'),giftFilters.category,[['',t('Të gjitha','All')],...giftCategories],setGiftFilter('category')),
          selectFilter(t('Buxheti maksimal','Maximum budget'),giftFilters.maxPrice,[['',t('Çfarëdo','Any')],['5','5 €'],['10','10 €'],['20','20 €']],setGiftFilter('maxPrice'),{disabled:['swap','wanted'].includes(giftFilters.mode),title:['swap','wanted'].includes(giftFilters.mode)?t('Buxheti nuk zbatohet për ndërrime dhe kërkesa.','Budget does not apply to swaps and requests.'):undefined})),
        h('div',{className:'student-support-grid'},records.map(item=>h('article',{className:'student-support-panel student-exchange-card',key:item.id},
          h('div',{className:'student-exchange-card-heading'},h('span',{className:'student-support-badge'},labelOf(giftCategories,item.category)),h('strong',{className:'student-exchange-price'},modeLabel(item))),
          h('h2',null,item.title),h('p',{className:'student-support-note'},`${labelOf(giftConditions,item.condition)} · ${item.location}`),
          item.description&&h('p',{className:'student-support-text'},item.description),
          item.mode==='swap'&&h('p',{className:'student-exchange-swap'},`${t('Në këmbim kërkoj','Looking for in exchange')}: ${item.exchangeFor}`),
          h('p',{className:'student-support-note'},`${t('Publikoi','Posted by')}: ${item.publisher} · ${formatDate(item.createdAt)}`),
          contactUrl(item.contactKind,item.contact)&&h('a',{className:'student-support-button primary',href:contactUrl(item.contactKind,item.contact)},t('Kontakto publikuesin','Contact publisher')),
          h('p',{className:'student-support-note'},item.contact),
          item.mode==='wanted'&&responseList(item),
          item.owner===scope&&h(React.Fragment,null,button(item.mode==='wanted'?t('Kërkesa u plotësua','Request fulfilled'):t('Sendi është marrë','Item collected'),()=>markClaimed(item.id,true)),editActions('gifts',item,true))))),
        !records.length&&empty(exchange.gifts.some(item=>!item.claimed)?t('Nuk ka sende me këta filtra. Provo një kategori ose buxhet tjetër.','No items match these filters. Try another category or budget.'):t('Ende nuk ka sende aktive. Dhuro diçka të dobishme ose ofroje me çmim simbolik.','No active items yet. Donate something useful or offer it at a small price.')),
        archived.length>0&&h('details',{className:'student-support-panel'},h('summary',null,`${t('Sendet e mia të dhëna','My collected items')} (${archived.length})`),archived.map(item=>h('div',{key:item.id,className:'student-support-toolbar'},h('span',{className:'student-support-text'},item.title),button(t('Rihap','Reopen'),()=>markClaimed(item.id,false)),button(t('Fshi','Delete'),()=>remove('gifts',item.id,true))))));
    }
    const views={applications:applicationsView,feedback:feedbackView,work:workView,spaces:spacesView,lostfound:lostFoundView,donations:donationsView};
    const error = service==='lostfound'?boardError:service==='donations'?exchangeError:storeError;
    return h('div',{className:'student-support-page'},
      h('header',{className:'student-support-header'},button('←',onBack,false,{'aria-label':t('Kthehu te Shërbimet studentore','Back to Student Services')}),h('h1',null,t(...definition.title))),
      h('section',{className:'student-support-panel'},h('p',{className:'student-support-text'},t(...definition.description)),h('p',{className:'student-support-note'},service==='donations'?t('Oferta dhe përgjigje të strukturuara, pa pagesa dhe pa chat privat në app.','Listings and structured responses, without in-app payments or private chat.'):service==='lostfound'?t('Njoftime lokale, jo biseda private ose grupi.','Local notices, not private or group chats.'):t('Shënimet dhe lista e kontrollit ruhen në profilin tënd të studimit.','Notes and checklist progress are saved in your study profile.')),
        h('div',{className:'student-support-toolbar'},button(t('+ Shto','+ Add'),startNew,true),h('span',{className:'student-support-badge'},t('Në këtë pajisje','On this device')))),
      error&&h('p',{className:'student-support-alert',role:'alert'},error==='read'?t('Të dhënat nuk mund të lexoheshin. Kontrollo ruajtjen para se të shtosh shënime.','Stored data could not be read. Check your storage before adding entries.'):t('Ruajtja dështoi; ndryshimi nuk u aplikua. Provo sërish ose liro hapësirë në shfletues.','Save failed; the change was not applied. Retry or free browser storage.')),
      notice&&h('p',{className:'student-support-status',role:'status','aria-live':'polite'},notice),forms(),views[service]());
  }
  window.UnitStudentSupport = { ServicesCards, SupportPage, DateOnly, serviceDefinitions,
    // Pure helpers exported for focused regression tests, without touching existing app state.
    helpers:{ localDate,validDate,validTime,dateText,safeUrl,contactUrl,normalizeStore,timeRange,conflictsForShift,matchesSpace,giftPrice,matchesGift } };
})();
