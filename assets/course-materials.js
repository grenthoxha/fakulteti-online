/* Audited materials: app-native previews and original downloads from GitHub Releases. */
(function (global) {
  'use strict';
  const React = global.React, h = React.createElement;
  const source = global.FakultetiCourseMaterialsIndex || { courses: {}, version: '1' };
  const base = new URL('.', document.currentScript.src);
  const catalogues = new Map(), pending = new Map();
  const EXCLUDED_IDS = new Set(['1rbGp6CTqMxiUh7qr9f0kzxm7FbfPwe1f', '1GDTnz13y77y-qgRzMkBVTaiEQs5NSNYp', '1jQo78-Iu58tb9dcyM5-xOl2NIwXpLpo7']);
  const EXCLUDED_HASHES = new Set(['6a8627e4461c0fb909b3a5b0c97411ea6ee150b191942f17e6404bf05d4178f8']);
  const CATEGORIES = { literature: 'Literaturë', slides: 'Slajde', notes: 'Shënime', tests: 'Teste', practice: 'Ushtrime', datasets: 'Të dhëna', other: 'Të tjera' };
  const ORDER = Object.keys(CATEGORIES), RECENT_KEY = 'u_course_materials_recent_v1';
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sq');
  const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(id);
  const safeReleaseUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.hash && ((url.hostname === 'github.com' && /^\/grenthoxha\/fakulteti-online\/releases\/download\/materiale-psikologji-2026-s[1-6]\/[A-Za-z0-9_.-]+$/.test(url.pathname) && !url.search) || (url.hostname === 'fakulteti-aprovimet.personalebuds.chatgpt.site' && /^\/api\/materials\/[a-f0-9]{32}\.[a-z0-9]{1,8}$/.test(url.pathname) && url.search === '?download=1')) ? url.href : ''; } catch { return ''; } };
  const previewUrl = file => validId(file?.id) ? global.FakultetiMaterialReader?.safePreview(file) || '' : '';
  const hasCourse = id => !!source.courses[id]?.count;
  function register(data) {
    if (!source.courses[data?.courseId] || !Array.isArray(data.files)) return;
    const clean = { ...data, files: data.files.filter(file => validId(file.id) && !EXCLUDED_IDS.has(file.id) && !EXCLUDED_HASHES.has(file.sha256) && typeof file.title === 'string' && safeReleaseUrl(file.url) && previewUrl(file)) };
    catalogues.set(data.courseId, clean);
    pending.get(data.courseId)?.resolve(clean);
  }
  function load(id) {
    if (!hasCourse(id)) return Promise.resolve(null);
    if (catalogues.has(id)) return Promise.resolve(catalogues.get(id));
    if (pending.has(id)) return pending.get(id).promise;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const script = document.createElement('script');
    const cleanup = () => { clearTimeout(timeout); script.remove(); pending.delete(id); };
    const fail = () => { cleanup(); reject(new Error('catalogue unavailable')); };
    const timeout = setTimeout(fail, 20000);
    pending.set(id, { promise, resolve: data => { cleanup(); resolve(data); } });
    script.src = new URL('course-materials/' + encodeURIComponent(id) + '.js?v=' + encodeURIComponent(source.version), base).href;
    script.async = true; script.onerror = fail;
    script.onload = () => { if (!catalogues.has(id)) fail(); };
    document.head.appendChild(script);
    return promise;
  }
  const labelOf = file => String(file.title || '').replace(/[ÂÃÄÅ][\u0080-\u00bf]/g, pair => String.fromCharCode(((pair.charCodeAt(0) & 31) << 6) | (pair.charCodeAt(1) & 63))).replace(/\.(?:pdf|docx?|pptx?|jpe?g|png|xlsx?|zip|sav|spv|r)$/i, '').replace(/(?:\s*\(\d+\))+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const formatOf = file => /\.spv$/i.test(file.title) ? 'Raport SPSS' : /\.sav$/i.test(file.title) ? 'SPSS' : /\.r$/i.test(file.title) ? 'R' : ({ 'application/pdf': 'PDF', 'application/msword': 'Word', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word', 'application/vnd.ms-powerpoint': 'PowerPoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel', 'image/jpeg': 'Foto', 'image/png': 'Foto', 'application/x-zip': 'ZIP' })[file.mime] || (file.title.split('.').at(-1) || 'Skedar').toUpperCase();
  const sizeOf = bytes => bytes >= 1048576 ? (bytes / 1048576).toLocaleString('sq', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  function buildEntries(files) {
    const imageGroups = new Map(), entries = [];
    for (const file of files) {
      if (file.mime?.startsWith('image/')) {
        const key = file.category + ':' + file.folder;
        if (!imageGroups.has(key)) imageGroups.set(key, []);
        imageGroups.get(key).push(file);
      } else entries.push({ id: file.id, title: labelOf(file), category: file.category, files: [file], kind: 'file' });
    }
    for (const [key, images] of imageGroups) {
      images.sort((a, b) => a.title.localeCompare(b.title, 'sq', { numeric: true, sensitivity: 'base' }));
      if (images.length >= 3) {
        const folder = images[0].folder.split(' / ').at(-1);
        const title = /^(?:sll?ajde?t?|teste|shenime)$/i.test(fold(folder)) ? CATEGORIES[images[0].category] : labelOf({ title: folder });
        entries.push({ id: 'gallery:' + key, title: title || 'Fotografitë e materialit', category: images[0].category, files: images, kind: 'gallery' });
      } else for (const file of images) entries.push({ id: file.id, title: labelOf(file), category: file.category, files: [file], kind: 'file' });
    }
    return entries.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.title.localeCompare(b.title, 'sq', { numeric: true, sensitivity: 'base' }));
  }
  const filterEntries = (entries, category, query) => {
    const words = fold(query).trim().split(/\s+/).filter(Boolean);
    return entries.filter(entry => (category === 'all' || entry.category === category) && words.every(word => fold(entry.title + ' ' + entry.files.map(file => file.title + ' ' + file.folder).join(' ')).includes(word)));
  };
  const PATHS = { book: 'M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z', file: 'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6', photos: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 8h.01', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5', back: 'M15 18l-6-6 6-6', next: 'M9 6l6 6-6 6', external: 'M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7', close: 'M6 6l12 12M18 6L6 18', folder: 'M3 6h7l2 2h9v12H3z' };
  const icon = name => h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: PATHS[name] || PATHS.file }));
  function Viewer({ selection, onClose, onVisit, Portal, storage }) {
    const [position, setPosition] = React.useState(selection.start || 0);
    const file = selection.files[position], gallery = selection.files.length > 1;
    const [online, setOnline] = React.useState(() => global.navigator?.onLine !== false);
    const title = selection.kind === 'gallery' ? selection.title : labelOf(file);
    React.useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, []);
    React.useEffect(() => { const update = () => setOnline(global.navigator?.onLine !== false); global.addEventListener('online', update); global.addEventListener('offline', update); return () => { global.removeEventListener('online', update); global.removeEventListener('offline', update); }; }, []);
    React.useEffect(() => { onVisit(file); }, [file.id]);
    const move = delta => setPosition(value => Math.max(0, Math.min(selection.files.length - 1, value + delta)));
    const panel = h('section', { className: 'cl-viewer', onClick: event => { if (event.target === event.currentTarget) onClose(); }, role: 'dialog', 'aria-modal': true, 'aria-label': title },
      h('header', { className: 'cl-viewer-heading' },
        h('button', { type: 'button', className: 'cl-icon-button', onClick: onClose, 'aria-label': 'Mbyll materialin' }, icon('back')),
        h('div', { className: 'cl-viewer-title' }, h('h2', null, title), h('p', null, gallery ? `Foto ${position + 1} nga ${selection.files.length}` : formatOf(file) + ' · ' + sizeOf(file.size))),
        h('a', { href: safeReleaseUrl(file.url), target: '_blank', rel: 'noopener noreferrer', className: 'cl-download', 'aria-label': 'Shkarko origjinalin: ' + file.title, title: 'Shkarko origjinalin' }, h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('path', { d: 'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5' })))),
      h('div', { className: 'cl-viewer-stage' },
        !online ? h('div', { className: 'cl-viewer-note', role: 'status' }, 'Për ta hapur materialin nevojitet internet.')
          : h(global.FakultetiMaterialReader.Reader, { key: file.id, file, storage })),
      gallery && h('footer', { className: 'cl-viewer-footer' },
        gallery && h('div', { className: 'cl-gallery-controls' },
          h('button', { type: 'button', onClick: () => move(-1), disabled: position === 0, 'aria-label': 'Fotoja paraprake' }, icon('back')),
          h('label', { className: 'cl-gallery-position' }, h('span', { className: 'sr-only' }, 'Zgjidh fotografinë'), h('select', { value: position, onChange: event => setPosition(Number(event.target.value)) }, selection.files.map((item, i) => h('option', { key: item.id, value: i }, `${i + 1} / ${selection.files.length}`)))),
          h('button', { type: 'button', onClick: () => move(1), disabled: position === selection.files.length - 1, 'aria-label': 'Fotoja tjetër' }, icon('next')))));
    return Portal ? h(Portal, null, panel) : global.ReactDOM.createPortal(panel, document.body);
  }
  function Section({ courseId, storage, Portal }) {
    const info = source.courses[courseId];
    const [expanded, setExpanded] = React.useState(false);
    const [data, setData] = React.useState(() => catalogues.get(courseId) || null);
    const [error, setError] = React.useState(false), [retry, setRetry] = React.useState(0);
    const [category, setCategory] = React.useState('all'), [query, setQuery] = React.useState(''), [limit, setLimit] = React.useState(5), [selection, setSelection] = React.useState(null), [recent, setRecent] = React.useState(null);
    React.useEffect(() => { if (!expanded) return; let alive = true; setError(false); setData(catalogues.get(courseId) || null); load(courseId).then(value => { if (alive) setData(value); }).catch(() => { if (alive) setError(true); }); return () => { alive = false; }; }, [courseId, retry, expanded]);
    React.useEffect(() => { try { setRecent(JSON.parse(storage?.getItem(RECENT_KEY) || '{}')[courseId] || null); } catch { setRecent(null); } }, [courseId, storage]);
    const entries = React.useMemo(() => buildEntries(data?.files || []), [data]);
    const shown = React.useMemo(() => filterEntries(entries, category, query), [entries, category, query]);
    if (!info?.count) return null;
    const visit = file => { setRecent(file.id); try { const saved = JSON.parse(storage?.getItem(RECENT_KEY) || '{}'); storage?.setItem(RECENT_KEY, JSON.stringify({ ...saved, [courseId]: file.id })); } catch {} };
    const open = (entry, start = 0) => setSelection({ ...entry, start });
    const recentFile = data?.files.find(file => file.id === recent);
    return h('section', { className: 'course-library', 'aria-label': 'Everything for Psychology' },
      h('button', { type: 'button', className: 'cl-library-toggle', 'aria-expanded': expanded, 'aria-controls': 'course-library-' + courseId, onClick: () => setExpanded(value => !value) },
        h('span', { className: 'cl-file-icon' }, icon('book')),
        h('span', { className: 'cl-library-title' }, h('strong', null, 'Everything for Psychology'), h('small', null, `${info.count} ${info.count === 1 ? 'material' : 'materiale'}`)), icon('next')),
      expanded && h('div', { id: 'course-library-' + courseId, className: 'cl-library-content' },
      h('label', { className: 'cl-search' }, icon('search'), h('span', { className: 'sr-only' }, 'Kërko material në këtë lëndë'), h('input', { type: 'search', value: query, placeholder: 'Kërko material', onChange: event => { setQuery(event.target.value); setLimit(5); } })),
      h('div', { className: 'cl-filters', role: 'group', 'aria-label': 'Lloji i materialit' }, [['all', 'Të gjitha'], ...ORDER.filter(id => info.categories[id]).map(id => [id, CATEGORIES[id]])].map(([id, label]) => h('button', { key: id, type: 'button', 'aria-pressed': category === id, className: category === id ? 'is-active' : '', onClick: () => { setCategory(id); setLimit(5); } }, label))),
      error ? h('div', { className: 'cl-status', role: 'alert' }, h('p', null, 'Lista e materialeve nuk u hap.'), h('button', { type: 'button', onClick: () => setRetry(value => value + 1) }, 'Provo përsëri'))
        : !data ? h('div', { className: 'cl-status', role: 'status' }, 'Duke hapur materialet…')
          : h(React.Fragment, null,
            recentFile && !query && category === 'all' && h('button', { type: 'button', className: 'cl-recent', onClick: () => { const entry = entries.find(entry => entry.files.some(file => file.id === recentFile.id)); open(entry, entry.files.findIndex(file => file.id === recentFile.id)); } }, icon('book'), h('span', null, h('small', null, 'Hapur së fundi'), h('strong', null, labelOf(recentFile))), icon('next')),
            h('div', { className: 'cl-list' }, shown.slice(0, limit).map(entry => h('button', { key: entry.id, type: 'button', className: 'cl-row', onClick: () => open(entry) },
              h('span', { className: 'cl-file-icon' }, icon(entry.kind === 'gallery' ? 'photos' : entry.category === 'literature' ? 'book' : 'file')),
              h('span', { className: 'cl-file-copy' }, h('strong', null, entry.title), h('small', null, entry.kind === 'gallery' ? `${entry.files.length} foto · ${CATEGORIES[entry.category]}` : `${formatOf(entry.files[0])} · ${sizeOf(entry.files[0].size)} · ${CATEGORIES[entry.category]}`)), icon('next')))),
            !shown.length && h('p', { className: 'cl-status', role: 'status' }, 'Asnjë material nuk përputhet me kërkimin.'),
            shown.length > limit && h('button', { type: 'button', className: 'cl-more', onClick: () => setLimit(value => value + 12) }, `Shiko më shumë (${shown.length - limit})`))),
      selection && h(Viewer, { key: selection.id, selection, onClose: () => setSelection(null), onVisit: visit, Portal, storage }));
  }
  global.FakultetiCourseMaterials = { hasCourse, register, load, buildEntries, filterEntries, previewUrl, Section, Viewer, categories: CATEGORIES };
})(window);
