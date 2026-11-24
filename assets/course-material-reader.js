/* Native, lazy document reader. Source material is never embedded from Drive. */
(function (global) {
  'use strict';
  const React = global.React, h = React.createElement;
  const base = new URL('.', document.currentScript.src), READING_KEY = 'u_course_material_reading_v1';
  const pdfBase = base.protocol === 'file:' ? new URL('https://grenthoxha.github.io/fakulteti-online/assets/vendor/pdfjs/') : new URL('vendor/pdfjs/', base);
  const safePreview = file => /^[a-f0-9]{32}\.(?:pdf|jpg|json)$/.test(file?.preview?.path || '') ? 'https://fakulteti-aprovimet.personalebuds.chatgpt.site/api/materials/' + file.preview.path : '';
  let pdfLibrary;
  const loadPdf = () => pdfLibrary || (pdfLibrary = import(new URL('pdf.mjs', pdfBase).href).then(lib => {
    lib.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.mjs', pdfBase).href; return lib;
  }).catch(error => { pdfLibrary = null; throw error; }));
  const readPosition = (storage, id) => { try { return Math.max(1, Number(JSON.parse(storage?.getItem(READING_KEY) || '{}')[id]) || 1); } catch { return 1; } };
  const savePosition = (storage, id, page) => { try { const saved = JSON.parse(storage?.getItem(READING_KEY) || '{}'); storage?.setItem(READING_KEY, JSON.stringify({ ...saved, [id]: page })); } catch {} };
  const button = (label, child, props) => h('button', { type: 'button', 'aria-label': label, title: label, ...props }, child);
  function PdfReader({ file, storage }) {
    const [pdf, setPdf] = React.useState(null), [page, setPage] = React.useState(() => readPosition(storage, file.id));
    const [fit, setFit] = React.useState('width'), [zoom, setZoom] = React.useState(1), [rotation, setRotation] = React.useState(0);
    const [width, setWidth] = React.useState(320), [height, setHeight] = React.useState(400), [busy, setBusy] = React.useState(true), [error, setError] = React.useState('');
    const [textMode, setTextMode] = React.useState(false), [pageText, setPageText] = React.useState(''), [retry, setRetry] = React.useState(0);
    const holder = React.useRef(null), canvas = React.useRef(null), paper = React.useRef(null), layer = React.useRef(null), library = React.useRef(null);
    React.useEffect(() => {
      let active = true, task;
      setBusy(true); setError(''); setPdf(null);
      loadPdf().then(lib => {
        if (!active) return; library.current = lib;
        task = lib.getDocument({ url: safePreview(file), isEvalSupported: false, enableXfa: false, cMapUrl: new URL('cmaps/', pdfBase).href, cMapPacked: true, standardFontDataUrl: new URL('standard_fonts/', pdfBase).href, wasmUrl: new URL('wasm/', pdfBase).href, disableStream: true, disableAutoFetch: true, rangeChunkSize: 262144 });
        return task.promise;
      }).then(doc => { if (active && doc) { setPdf(doc); setPage(value => Math.min(value, doc.numPages)); } }).catch(() => { if (active) { setError('Materiali nuk u hap. Kontrollo lidhjen dhe provo përsëri.'); setBusy(false); } });
      return () => { active = false; task?.destroy().catch(() => {}); };
    }, [file.id, retry]);
    React.useEffect(() => {
      const node = holder.current; if (!node) return;
      const measure = () => { setWidth(Math.max(100, node.clientWidth - 24)); setHeight(Math.max(100, node.clientHeight - 24)); };
      measure(); const observer = global.ResizeObserver ? new ResizeObserver(measure) : null;
      observer?.observe(node); global.addEventListener('resize', measure); return () => { observer?.disconnect(); global.removeEventListener('resize', measure); };
    }, []);
    React.useEffect(() => {
      if (!pdf || !canvas.current) return;
      let active = true, rendering, textLayer;
      setBusy(true); setError(''); setPageText('');
      pdf.getPage(page).then(async current => {
        if (!active) return;
        const pageRotation = (current.rotate + rotation) % 360;
        const natural = current.getViewport({ scale: 1, rotation: pageRotation });
        const scale = (fit === 'page' ? Math.min(width / natural.width, height / natural.height) : width / natural.width) * zoom;
        const viewport = current.getViewport({ scale, rotation: pageRotation }), ratio = Math.min(global.devicePixelRatio || 1, 2, Math.sqrt(12000000 / (viewport.width * viewport.height)));
        const node = canvas.current;
        node.width = Math.floor(viewport.width * ratio); node.height = Math.floor(viewport.height * ratio);
        node.style.width = viewport.width + 'px'; node.style.height = viewport.height + 'px';
        paper.current.style.width = viewport.width + 'px'; paper.current.style.height = viewport.height + 'px';
        paper.current.style.setProperty('--scale-factor', scale); paper.current.style.setProperty('--total-scale-factor', scale);
        rendering = current.render({ canvasContext: node.getContext('2d', { alpha: false }), canvas: node, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        await rendering.promise;
        try {
          const text = await current.getTextContent(); if (!active) return;
          setPageText(text.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join(''));
          layer.current.replaceChildren();
          textLayer = new library.current.TextLayer({ textContentSource: text, container: layer.current, viewport });
          await textLayer.render();
        } catch { if (active) { layer.current?.replaceChildren(); setPageText(''); } }
        if (active) { setBusy(false); savePosition(storage, file.id, page); }
      }).catch(error => { if (active && error.name !== 'RenderingCancelledException' && error.name !== 'AbortException') { setError('Faqja nuk u shfaq. Provo përsëri.'); setBusy(false); } });
      return () => { active = false; rendering?.cancel(); textLayer?.cancel(); };
    }, [pdf, page, width, height, fit, zoom, rotation, retry]);
    const go = value => { if (pdf) { setPage(Math.min(pdf.numPages, Math.max(1, Math.round(Number(value) || 1)))); holder.current?.scrollTo(0, 0); } };
    return h('div', { className: 'cm-reader' },
      h('div', { className: 'cm-reader-tools', role: 'toolbar', 'aria-label': 'Leximi i dokumentit' },
        button('Faqja paraprake', '‹', { disabled: !pdf || page === 1, onClick: () => go(page - 1) }),
        h('label', { className: 'cm-page-number' }, h('span', { className: 'sr-only' }, 'Faqja'), h('input', { key: page, type: 'number', inputMode: 'numeric', min: 1, max: pdf?.numPages || 1, defaultValue: page, onBlur: event => go(Number(event.target.value) || page), onKeyDown: event => { if (event.key === 'Enter') { go(Number(event.target.value) || page); event.target.blur(); } }, disabled: !pdf }), h('span', null, '/ ' + (pdf?.numPages || file.preview.pages || '…'))),
        button('Faqja tjetër', '›', { disabled: !pdf || page === pdf.numPages, onClick: () => go(page + 1) }),
        h('span', { className: 'cm-tool-spacer' }),
        button('Zvogëlo', '−', { disabled: zoom <= .65, onClick: () => setZoom(value => Math.max(.65, value - .25)) }),
        button(fit === 'width' ? 'Përshtat faqen' : 'Përshtat gjerësinë', fit === 'width' ? '↔' : '▣', { disabled: textMode, onClick: () => { setFit(value => value === 'width' ? 'page' : 'width'); setZoom(1); } }),
        button('Zmadho', '+', { disabled: zoom >= 2.5, onClick: () => setZoom(value => Math.min(2.5, value + .25)) }),
        button('Rrotullo faqen', '↻', { disabled: textMode, onClick: () => setRotation(value => (value + 90) % 360) }),
        button('Lexo tekstin', 'Aa', { 'aria-pressed': textMode, onClick: () => setTextMode(value => !value) })),
      h('div', { className: 'cm-document-scroll', ref: holder, 'aria-busy': busy },
        busy && h('div', { className: 'cm-reader-status', role: 'status' }, 'Duke hapur faqen…'),
        error && h('div', { className: 'cm-reader-error', role: 'alert' }, h('p', null, error), button('Provo përsëri', 'Provo përsëri', { onClick: () => setRetry(value => value + 1) })),
        h('div', { className: 'cm-pdf-paper', ref: paper, style: { display: textMode || error ? 'none' : undefined } }, h('canvas', { ref: canvas, 'aria-label': 'Faqja ' + page }), h('div', { ref: layer, className: 'cm-text-layer textLayer' })),
        textMode && !busy && !error && h('article', { className: 'cm-reading-text', style: { fontSize: 17 * zoom + 'px' } }, pageText || 'Kjo faqe është fotografi e skanuar. Përdor pamjen e faqes për ta lexuar.')));
  }
  function DataReader({ file }) {
    const [data, setData] = React.useState(null), [error, setError] = React.useState(false), [page, setPage] = React.useState(0), [retry, setRetry] = React.useState(0);
    React.useEffect(() => { const controller = new AbortController(); setData(null); setError(false); fetch(safePreview(file), { signal: controller.signal }).then(response => { if (!response.ok) throw Error('unavailable'); return response.json(); }).then(setData).catch(error => { if (error.name !== 'AbortError') setError(true); }); return () => controller.abort(); }, [file.id, retry]);
    if (error) return h('div', { className: 'cm-reader-error' }, 'Materiali nuk u hap.', button('Provo përsëri', 'Provo përsëri', { onClick: () => setRetry(value => value + 1) }));
    if (!data) return h('div', { className: 'cm-reader-status', role: 'status' }, 'Duke hapur materialin…');
    if (file.preview.type === 'text') return h('pre', { className: 'cm-code-text' }, data.text);
    if (file.preview.type === 'table') return h('div', { className: 'cm-data-reader' }, h('p', { className: 'cm-data-caption' }, `${data.rows.length} rreshta · ${data.columns.length} variabla`), h('div', { className: 'cm-table-scroll' }, h('table', null, h('thead', null, h('tr', null, data.columns.map(column => h('th', { key: column, title: data.labels?.[column] || column }, column)))), h('tbody', null, data.rows.slice(page * 50, (page + 1) * 50).map((row, i) => h('tr', { key: i }, row.map((value, j) => h('td', { key: j }, value == null ? '—' : String(value)))))))), h('div', { className: 'cm-data-paging' }, button('Rreshtat paraprakë', '‹', { disabled: page === 0, onClick: () => setPage(value => value - 1) }), `${page * 50 + 1}–${Math.min((page + 1) * 50, data.rows.length)}`, button('Rreshtat e tjerë', '›', { disabled: (page + 1) * 50 >= data.rows.length, onClick: () => setPage(value => value + 1) })));
    return h('div', { className: 'cm-archive-list' }, h('p', null, 'Përmbajtja e skedarit SPSS'), data.entries.map((entry, i) => h('div', { key: i }, h('span', null, entry.name), h('small', null, Math.ceil(entry.size / 1024) + ' KB'))), h('p', null, 'Analizat interaktive të këtij formati hapen në SPSS. Origjinali mund të shkarkohet.'));
  }
  function Reader({ file, storage }) {
    const [zoom, setZoom] = React.useState(false), [failed, setFailed] = React.useState(false), [loaded, setLoaded] = React.useState(false);
    const url = safePreview(file);
    if (!url) return h('div', { className: 'cm-reader-error', role: 'alert' }, 'Pamja e materialit nuk është në dispozicion.');
    if (file.preview.type === 'pdf') return h(PdfReader, { key: file.id, file, storage });
    if (file.preview.type === 'image') return h('div', { className: 'cm-photo-reader' + (zoom ? ' is-zoomed' : '') }, !loaded && !failed && h('div', { className: 'cm-reader-status', role: 'status' }, 'Duke hapur fotografinë…'), failed ? h('div', { className: 'cm-reader-error', role: 'alert' }, 'Fotoja nuk u hap. Kontrollo lidhjen.', button('Provo përsëri', 'Provo përsëri', { onClick: () => { setLoaded(false); setFailed(false); } })) : h('div', { className: 'cm-photo-scroll' }, h('img', { src: url, alt: file.title, decoding: 'async', onLoad: () => setLoaded(true), onDoubleClick: () => setZoom(value => !value), onError: () => setFailed(true), draggable: false })), button(zoom ? 'Përshtat fotografinë' : 'Zmadho fotografinë', zoom ? '−' : '+', { className: 'cm-photo-zoom', onClick: () => setZoom(value => !value) }));
    return h(DataReader, { key: file.id, file });
  }
  global.FakultetiMaterialReader = { Reader, PdfReader, DataReader, safePreview, readPosition, savePosition };
})(window);
