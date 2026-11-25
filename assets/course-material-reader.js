/* Native, lazy document reader. Source material is never embedded from Drive. */
(function (global) {
  'use strict';
  const React = global.React, h = React.createElement;
  const base = new URL('.', document.currentScript.src), READING_KEY = 'u_course_material_reading_v1';
  const pdfBase = base.protocol === 'file:' ? new URL('https://grenthoxha.github.io/fakulteti-online/assets/vendor/pdfjs/') : new URL('vendor/pdfjs/', base);
  const safePreview = file => /^[a-f0-9]{32}\.(?:pdf|jpg|json)$/.test(file?.preview?.path || '') ? 'https://fakulteti-aprovimet.personalebuds.chatgpt.site/api/materials/' + file.preview.path : '';
  let pdfLibrary, sharedWorker;
  const loadPdf = () => pdfLibrary || (pdfLibrary = import(new URL('pdf.mjs', pdfBase).href).then(lib => {
    lib.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.mjs', pdfBase).href; return lib;
  }).catch(error => { pdfLibrary = null; throw error; }));
  // Warm the module and worker while the material list is open; never download a book here.
  const preparePdf = () => loadPdf().then(async lib => {
    if (!sharedWorker) sharedWorker = new lib.PDFWorker();
    try { await sharedWorker.promise; } catch (error) { sharedWorker.destroy(); sharedWorker = null; throw error; }
    return { lib, worker: sharedWorker };
  });
  const readPosition = (storage, id) => { try { return Math.max(1, Number(JSON.parse(storage?.getItem(READING_KEY) || '{}')[id]) || 1); } catch { return 1; } };
  const savePosition = (storage, id, page) => { try { const saved = JSON.parse(storage?.getItem(READING_KEY) || '{}'); storage?.setItem(READING_KEY, JSON.stringify({ ...saved, [id]: page })); } catch {} };
  const button = (label, child, props) => h('button', { type: 'button', 'aria-label': label, title: label, ...props }, child);
  const clampZoom = value => Math.min(4, Math.max(.7, Number(value) || 1));
  // Resize the document, not the app viewport. Keep the touched point under the fingers.
  function bindZoom(node, content, commit = () => {}, initial = 1) {
    let zoom = clampZoom(initial), pinch = null, tap = null, start = null, wheelTimer, suppressTap = 0;
    const stop = event => { if (event.cancelable) event.preventDefault(); event.stopPropagation(); };
    const point = event => { const rect = node.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
    const middle = touches => point({ clientX: (touches[0].clientX + touches[1].clientX) / 2, clientY: (touches[0].clientY + touches[1].clientY) / 2 });
    const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const apply = (value, at = { x: node.clientWidth / 2, y: node.clientHeight / 2 }, anchor) => {
      const next = clampZoom(value);
      anchor ||= { x: (node.scrollLeft + at.x - content.offsetLeft) / zoom, y: (node.scrollTop + at.y - content.offsetTop) / zoom };
      zoom = next; content.style.setProperty('--cm-zoom', String(zoom));
      node.scrollLeft = Math.max(0, content.offsetLeft + anchor.x * zoom - at.x);
      node.scrollTop = Math.max(0, content.offsetTop + anchor.y * zoom - at.y);
    };
    const zoomAt = (value, at) => { apply(value, at); commit(zoom); };
    const touchStart = event => {
      if (event.touches.length === 2) {
        stop(event); start = null; tap = null;
        const at = middle(event.touches);
        pinch = { distance: Math.max(1, distance(event.touches)), zoom, anchor: { x: (node.scrollLeft + at.x - content.offsetLeft) / zoom, y: (node.scrollTop + at.y - content.offsetTop) / zoom } };
      } else if (event.touches.length === 1) start = { ...point(event.touches[0]), time: Date.now(), moved: false };
    };
    const touchMove = event => {
      if (pinch && event.touches.length >= 2) { stop(event); apply(pinch.zoom * distance(event.touches) / pinch.distance, middle(event.touches), pinch.anchor); }
      else if (start && event.touches.length) { const at = point(event.touches[0]); if (Math.hypot(at.x - start.x, at.y - start.y) > 8) start.moved = true; }
    };
    const touchEnd = event => {
      if (pinch) { stop(event); if (event.touches.length < 2) { pinch = null; start = null; suppressTap = Date.now() + 450; commit(zoom); } return; }
      if (!start || start.moved || event.touches.length || Date.now() - start.time > 300 || Date.now() < suppressTap) { start = null; return; }
      const at = start; start = null;
      if (tap && Date.now() - tap.time < 320 && Math.hypot(at.x - tap.x, at.y - tap.y) < 32) { stop(event); tap = null; zoomAt(zoom > 1.05 ? 1 : 2.3, at); }
      else tap = { ...at, time: Date.now() };
    };
    const cancel = () => { if (pinch) commit(zoom); pinch = null; start = null; tap = null; };
    const doubleClick = event => { stop(event); zoomAt(zoom > 1.05 ? 1 : 2.3, point(event)); };
    const wheel = event => { if (!event.ctrlKey) return; stop(event); apply(zoom * Math.exp(-event.deltaY * .008), point(event)); clearTimeout(wheelTimer); wheelTimer = setTimeout(() => commit(zoom), 140); };
    const key = event => { if (event.target !== node || !['+', '=', '-', '0'].includes(event.key)) return; stop(event); zoomAt(event.key === '0' ? 1 : zoom * (event.key === '-' ? 1 / 1.2 : 1.2)); };
    const options = { passive: false }, listeners = { touchstart: touchStart, touchmove: touchMove, touchend: touchEnd, touchcancel: cancel, dblclick: doubleClick, wheel, keydown: key };
    for (const [name, fn] of Object.entries(listeners)) node.addEventListener(name, fn, options);
    return () => { clearTimeout(wheelTimer); for (const [name, fn] of Object.entries(listeners)) node.removeEventListener(name, fn); };
  }
  function useDocumentZoom(holder, stack, onCommit) {
    React.useEffect(() => { if (holder.current && stack.current) return bindZoom(holder.current, stack.current, onCommit); }, []);
  }
  const frame = fn => global.requestAnimationFrame(fn);
  // Page shells retain scroll geometry; canvases/images exist only near the viewport.
  function ContinuousPages({ count, start = 1, ratio = .7071, rotation = 0, zoom, onZoom, onPage, renderPage, textMode = false, jumpToken = 0 }) {
    const holder = React.useRef(null), stack = React.useRef(null), state = React.useRef({ current: start, restored: false, update: null, anchor: null, width: 320 });
    const [width, setWidth] = React.useState(320), [ratios, setRatios] = React.useState({}), [range, setRange] = React.useState([start, start]);
    useDocumentZoom(holder, stack, onZoom);
    const changeRatio = React.useCallback((number, value) => {
      if (!(value > 0)) return;
      setRatios(previous => {
        if (Math.abs((previous[number] || ratio) - value) < .0001) return previous;
        const node = holder.current, page = stack.current?.children[state.current.current - 1];
        if (node && page) state.current.anchor = { page: state.current.current, offset: node.scrollTop - page.offsetTop };
        return { ...previous, [number]: value };
      });
    }, [ratio]);
    React.useLayoutEffect(() => {
      const node = holder.current, content = stack.current;
      if (!node || !content) return;
      let scheduled = 0, observer;
      const find = y => { let a = 0, b = count - 1; while (a < b) { const m = (a + b) >> 1, el = content.children[m]; if (content.offsetTop + el.offsetTop + el.offsetHeight < y) a = m + 1; else b = m; } return a + 1; };
      const update = () => {
        scheduled = 0;
        const current = find(node.scrollTop + Math.min(120, node.clientHeight * .2));
        state.current.current = current; onPage(current);
        let first = find(Math.max(0, node.scrollTop - node.clientHeight * .7)), last = find(node.scrollTop + node.clientHeight * 1.7);
        if (last - first > 7) { first = Math.max(first, current - 2); last = Math.min(count, first + 7); }
        setRange(previous => previous[0] === first && previous[1] === last ? previous : [first, last]);
      };
      const schedule = () => { if (!scheduled) scheduled = frame(update); };
      const measure = () => {
        const next = Math.max(100, node.clientWidth - 24);
        if (next !== state.current.width) {
          const page = content.children[state.current.current - 1];
          state.current.anchor = { page: state.current.current, offset: node.scrollTop - page.offsetTop, width: next };
          state.current.width = next; setWidth(next);
        }
        schedule();
      };
      state.current.update = schedule;
      if (!state.current.restored) { node.scrollTop = Math.max(0, content.offsetTop + content.children[start - 1].offsetTop - 12); state.current.restored = true; }
      measure();
      if (global.ResizeObserver) { observer = new global.ResizeObserver(measure); observer.observe(node); observer.observe(content); }
      node.addEventListener('scroll', schedule, { passive: true }); global.addEventListener('resize', measure);
      return () => { observer?.disconnect(); if (scheduled) global.cancelAnimationFrame(scheduled); node.removeEventListener('scroll', schedule); global.removeEventListener('resize', measure); state.current.update = null; };
    }, [count, onPage]);
    React.useLayoutEffect(() => {
      const pending = state.current.anchor;
      if (pending?.width && pending.width !== width) return;
      state.current.anchor = null;
      if (pending && holder.current && stack.current?.children[pending.page - 1]) holder.current.scrollTop = stack.current.children[pending.page - 1].offsetTop + pending.offset;
      state.current.update?.();
    }, [ratios, rotation, width, zoom]);
    const view = React.useRef({ rotation, textMode });
    React.useLayoutEffect(() => {
      if (view.current.rotation === rotation && view.current.textMode === textMode) return;
      view.current = { rotation, textMode };
      const content = stack.current, node = holder.current, page = content?.children[state.current.current - 1];
      if (node && page) { node.scrollTop = Math.max(0, content.offsetTop + page.offsetTop - 12); state.current.update?.(); }
    }, [rotation, textMode]);
    React.useLayoutEffect(() => {
      const content = stack.current, node = holder.current;
      if (content && node && start !== state.current.current) { node.scrollTop = Math.max(0, content.offsetTop + content.children[start - 1].offsetTop - 12); state.current.update?.(); }
    }, [start, jumpToken]);
    return h('div', { className: 'cm-document-scroll', ref: holder, tabIndex: 0, 'aria-label': 'Materiali: rrëshqit për të lexuar; përdor dy gishta ose dy prekje për zmadhim' },
      h('div', { className: 'cm-page-stack' + (textMode ? ' cm-text-flow' : ''), ref: stack, style: { '--cm-base-width': width + 'px', '--cm-zoom': zoom } },
        Array.from({ length: count }, (_, i) => {
          const number = i + 1, natural = ratios[number] || ratio, aspect = rotation % 180 ? 1 / natural : natural;
          return h('div', { key: number, className: 'cm-page-frame', style: { aspectRatio: aspect }, role: 'group', 'aria-label': 'Faqja ' + number },
            number >= range[0] && number <= range[1] ? renderPage(number, width * zoom, changeRatio) : h('span', { className: 'cm-page-placeholder', 'aria-hidden': true }, number));
        })));
  }
  function PdfPage({ pdf, number, width, rotation, textMode, onRatio }) {
    const paper = React.useRef(null), canvas = React.useRef(null), layer = React.useRef(null), [busy, setBusy] = React.useState(true), [error, setError] = React.useState(false), [text, setText] = React.useState(''), [retry, setRetry] = React.useState(0);
    React.useEffect(() => {
      let active = true, rendering, textLayer, textTimer;
      setBusy(true); setError(false);
      pdf.getPage(number).then(async page => {
        if (!active) return;
        const natural = page.getViewport({ scale: 1, rotation: page.rotate }), viewport = page.getViewport({ scale: width / (rotation % 180 ? natural.height : natural.width), rotation: (page.rotate + rotation) % 360 });
        onRatio(number, natural.width / natural.height);
        if (textMode) {
          const value = await page.getTextContent(); if (active) { setText(value.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('')); setBusy(false); } return;
        }
        const node = canvas.current, ratio = Math.min(global.devicePixelRatio || 1, 1.8, Math.sqrt(3500000 / (viewport.width * viewport.height)));
        node.width = Math.max(1, Math.floor(viewport.width * ratio)); node.height = Math.max(1, Math.floor(viewport.height * ratio));
        paper.current.style.setProperty('--scale-factor', viewport.scale); paper.current.style.setProperty('--total-scale-factor', viewport.scale);
        rendering = page.render({ canvasContext: node.getContext('2d', { alpha: false }), canvas: node, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        await rendering.promise; if (!active) return; setBusy(false);
        // Show the page first; selectable text must not delay the first paint.
        textTimer = setTimeout(async () => {
          try { const value = await page.getTextContent(); if (!active || !layer.current) return;
            const lib = await loadPdf(); if (!active) return;
            layer.current.replaceChildren(); textLayer = new lib.TextLayer({ textContentSource: value, container: layer.current, viewport }); await textLayer.render();
          } catch { if (active) layer.current?.replaceChildren(); }
        }, 180);
      }).catch(value => { if (active && value.name !== 'RenderingCancelledException' && value.name !== 'AbortException') { setError(true); setBusy(false); } });
      return () => { active = false; clearTimeout(textTimer); rendering?.cancel(); textLayer?.cancel(); const node = canvas.current; if (node) { node.width = 0; node.height = 0; } };
    }, [pdf, number, width, rotation, textMode, retry, onRatio]);
    return h('div', { className: 'cm-pdf-paper' + (textMode ? ' is-text' : ''), ref: paper, 'aria-busy': busy },
      busy && h('div', { className: 'cm-reader-status', role: 'status' }, 'Duke hapur faqen…'),
      error ? h('div', { className: 'cm-reader-error', role: 'alert' }, 'Faqja nuk u shfaq.', button('Provo përsëri', 'Provo përsëri', { onClick: () => setRetry(value => value + 1) }))
        : textMode ? h('article', { className: 'cm-reading-text' }, text || (!busy && 'Kjo faqe është fotografi e skanuar. Përdor pamjen e faqes për ta lexuar.'))
          : h(React.Fragment, null, h('canvas', { ref: canvas, draggable: false, 'aria-label': 'Faqja ' + number }), h('div', { ref: layer, className: 'cm-text-layer textLayer' })));
  }
  function PdfReader({ file, storage }) {
    const [loaded, setLoaded] = React.useState(null), [page, setPage] = React.useState(() => readPosition(storage, file.id)), [jump, setJump] = React.useState(() => ({ page, token: 0 }));
    const [zoom, setZoom] = React.useState(1), [rotation, setRotation] = React.useState(0), [textMode, setTextMode] = React.useState(false), [error, setError] = React.useState(false), [retry, setRetry] = React.useState(0);
    React.useEffect(() => {
      let active = true, task;
      setError(false); setLoaded(null);
      preparePdf().then(({ lib, worker }) => {
        if (!active) return;
        task = lib.getDocument({ url: safePreview(file), worker, isEvalSupported: false, enableXfa: false, cMapUrl: new URL('cmaps/', pdfBase).href, cMapPacked: true, standardFontDataUrl: new URL('standard_fonts/', pdfBase).href, wasmUrl: new URL('wasm/', pdfBase).href, disableStream: true, disableAutoFetch: true, rangeChunkSize: 262144 });
        return task.promise;
      }).then(async doc => {
        if (!active || !doc) return;
        const first = Math.min(readPosition(storage, file.id), doc.numPages), current = await doc.getPage(first); if (!active) return;
        const natural = current.getViewport({ scale: 1 }); setPage(first); setJump({ page: first, token: 0 }); setLoaded({ pdf: doc, ratio: natural.width / natural.height });
      }).catch(() => { if (active) setError(true); });
      return () => { active = false; task?.destroy().catch(() => {}); };
    }, [file.id, retry]);
    const currentPage = React.useRef(null);
    const visible = React.useCallback(value => { if (currentPage.current !== value) { currentPage.current = value; setPage(value); savePosition(storage, file.id, value); } }, [file.id, storage]);
    const go = value => { if (loaded) setJump(previous => ({ page: Math.min(loaded.pdf.numPages, Math.max(1, Math.round(Number(value) || 1))), token: previous.token + 1 })); };
    return h('div', { className: 'cm-reader' },
      h('div', { className: 'cm-reader-tools', role: 'toolbar', 'aria-label': 'Leximi i dokumentit' },
        h('label', { className: 'cm-page-number' }, h('span', { className: 'sr-only' }, 'Shko te faqja'), h('input', { key: page, type: 'number', inputMode: 'numeric', min: 1, max: loaded?.pdf.numPages || 1, defaultValue: page, onBlur: event => go(event.target.value), onKeyDown: event => { if (event.key === 'Enter') { go(event.target.value); event.target.blur(); } }, disabled: !loaded }), h('span', null, '/ ' + (loaded?.pdf.numPages || file.preview.pages || '…'))),
        h('span', { className: 'cm-tool-spacer' }),
        button('Rrotullo faqet', '↻', { disabled: textMode || !loaded, onClick: () => setRotation(value => (value + 90) % 360) }),
        button('Lexo tekstin', 'Aa', { 'aria-pressed': textMode, disabled: !loaded, onClick: () => setTextMode(value => !value) })),
      error ? h('div', { className: 'cm-reader-error', role: 'alert' }, 'Materiali nuk u hap. Kontrollo lidhjen.', button('Provo përsëri', 'Provo përsëri', { onClick: () => setRetry(value => value + 1) }))
        : !loaded ? h('div', { className: 'cm-reader-status', role: 'status' }, 'Duke hapur materialin…')
          : h(ContinuousPages, { key: file.id + ':' + retry, count: loaded.pdf.numPages, start: jump.page, jumpToken: jump.token, ratio: loaded.ratio, rotation, textMode, zoom, onZoom: setZoom, onPage: visible, renderPage: (number, width, onRatio) => h(PdfPage, { key: number, pdf: loaded.pdf, number, width, rotation, textMode, onRatio }) }));
  }
  function PhotoPage({ file, number, onRatio }) {
    const [loaded, setLoaded] = React.useState(false), [error, setError] = React.useState(false), [retry, setRetry] = React.useState(0);
    return h('div', { className: 'cm-photo-page' },
      !loaded && !error && h('div', { className: 'cm-reader-status', role: 'status' }, 'Duke hapur fotografinë…'),
      error ? h('div', { className: 'cm-reader-error', role: 'alert' }, 'Fotoja nuk u hap.', button('Provo përsëri', 'Provo përsëri', { onClick: () => { setError(false); setLoaded(false); setRetry(value => value + 1); } }))
        : h('img', { key: retry, src: safePreview(file), alt: file.title, decoding: 'async', onLoad: event => { onRatio(number, event.target.naturalWidth / event.target.naturalHeight); setLoaded(true); }, onError: () => setError(true), draggable: false }));
  }
  function PhotoReader({ files, start = 0, onPosition }) {
    const [zoom, setZoom] = React.useState(1), visible = React.useCallback(number => onPosition?.(number - 1), [onPosition]);
    return h(ContinuousPages, { count: files.length, start: start + 1, zoom, onZoom: setZoom, onPage: visible, renderPage: (number, width, onRatio) => h(PhotoPage, { key: files[number - 1].id, file: files[number - 1], number, onRatio }) });
  }
  function DataSurface({ children }) {
    const holder = React.useRef(null), content = React.useRef(null);
    React.useEffect(() => { if (holder.current && content.current) return bindZoom(holder.current, content.current); }, []);
    return h('div', { className: 'cm-data-scroll', ref: holder, tabIndex: 0, 'aria-label': 'Materiali: rrëshqit dhe zmadho me dy gishta' }, h('div', { className: 'cm-data-content', ref: content }, children));
  }
  function DataReader({ file }) {
    const [data, setData] = React.useState(null), [error, setError] = React.useState(false), [retry, setRetry] = React.useState(0);
    React.useEffect(() => { const controller = new AbortController(); setData(null); setError(false); fetch(safePreview(file), { signal: controller.signal }).then(response => { if (!response.ok) throw Error('unavailable'); return response.json(); }).then(setData).catch(error => { if (error.name !== 'AbortError') setError(true); }); return () => controller.abort(); }, [file.id, retry]);
    if (error) return h('div', { className: 'cm-reader-error' }, 'Materiali nuk u hap.', button('Provo përsëri', 'Provo përsëri', { onClick: () => setRetry(value => value + 1) }));
    if (!data) return h('div', { className: 'cm-reader-status', role: 'status' }, 'Duke hapur materialin…');
    let body;
    if (file.preview.type === 'text') body = h('pre', { className: 'cm-code-text' }, data.text);
    else if (file.preview.type === 'table') body = h('div', { className: 'cm-data-reader' },
      h('p', { className: 'cm-data-caption' }, `${data.rows.length} rreshta · ${data.columns.length} variabla`),
      h('table', null,
        h('thead', null, h('tr', null, data.columns.map(column => h('th', { key: column, title: data.labels?.[column] || column }, column)))),
        h('tbody', null, data.rows.map((row, i) => h('tr', { key: i }, row.map((value, j) => h('td', { key: j }, value == null ? '—' : String(value))))))));
    else body = h('div', { className: 'cm-archive-list' }, h('p', null, 'Përmbajtja e skedarit SPSS'), data.entries.map((entry, i) => h('div', { key: i }, h('span', null, entry.name), h('small', null, Math.ceil(entry.size / 1024) + ' KB'))), h('p', null, 'Analizat interaktive të këtij formati hapen në SPSS.'));
    return h(DataSurface, null, body);
  }
  function Reader({ file, files, start, onPosition, storage }) {
    if (!safePreview(file)) return h('div', { className: 'cm-reader-error', role: 'alert' }, 'Pamja e materialit nuk është në dispozicion.');
    if (file.preview.type === 'pdf') return h(PdfReader, { key: file.id, file, storage });
    if (file.preview.type === 'image') return h(PhotoReader, { files: files || [file], start: start || 0, onPosition });
    return h(DataReader, { key: file.id, file });
  }
  global.FakultetiMaterialReader = { Reader, PdfReader, PdfPage, PhotoReader, PhotoPage, ContinuousPages, DataReader, DataSurface, safePreview, readPosition, savePosition, bindZoom, clampZoom, warm: () => preparePdf().catch(() => {}) };
})(window);
