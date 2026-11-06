/* Read-only public bookings used by the faculty's official timetable. */
(function (root) {
  'use strict';
  const BASE = 'https://firestore.googleapis.com/v1/projects/filozofiku/databases/(default)/documents';
  const KEY = 'u_filozofiku_bookings_v1', TTL = 8 * 60 * 60 * 1000;
  const listeners = new Set(), pending = new Map();
  let weeks = {};
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  function localDate(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Tirane', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function weekDates(date) {
    if (!validDate(date)) throw Error('Data e pavlefshme.');
    const monday = new Date(date + 'T12:00:00Z');
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    return Array.from({ length: 7 }, (_, index) => { const d = new Date(monday); d.setUTCDate(d.getUTCDate() + index); return d.toISOString().slice(0, 10); });
  }
  const text = value => typeof value === 'string' ? value.trim().slice(0, 1000) : '';
  function decode(value) {
    if ('stringValue' in value) return value.stringValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
    if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]));
    return null;
  }
  function documentData(document) {
    if (!document || !document.fields || typeof document.name !== 'string') throw Error('Dokument zyrtar i pavlefshëm.');
    return { ...Object.fromEntries(Object.entries(document.fields).map(([k, v]) => [k, decode(v)])), id: document.name.split('/').pop() };
  }
  async function request(url, body) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw Error('Rezervimet zyrtare nuk u rifreskuan.');
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  async function collection(name) {
    const documents = []; let token = '';
    do {
      const result = await request(`${BASE}/${name}?pageSize=1000${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
      if (result.error || (result.documents && !Array.isArray(result.documents))) throw Error('Lista zyrtare e pavlefshme.');
      documents.push(...(result.documents || []).map(documentData)); token = result.nextPageToken || '';
    } while (token);
    return documents;
  }
  function normalizeBookings(bookings, rooms, periods, catalog, dates) {
    return bookings.flatMap(booking => {
      // publicBookings is the faculty's confirmed projection; cancelled entries disappear from it.
      if (booking.status && !['confirmed', 'approved', 'konfirmuar', 'e konfirmuar'].includes(String(booking.status).toLowerCase())) return [];
      if (!validDate(booking.date) || (dates && !dates.includes(booking.date)) || !text(booking.title)) throw Error('Rezervim zyrtar i pavlefshëm.');
      const room = rooms.find(r => r.id === booking.roomId);
      if (booking.roomId && !room) throw Error('Salla e rezervimit nuk u gjet.');
      const slots = booking.periodIds?.map(id => periods.find(p => p.id === id));
      if (!slots?.length || slots.some(slot => !slot || !validTime(slot.start) || !validTime(slot.end) || slot.end <= slot.start)) throw Error('Orët e rezervimit nuk u gjetën.');
      const names = (ids, map) => (ids || []).map(id => { if (!text(map?.[id])) throw Error('Grupi ose mësimdhënësi nuk u gjet.'); return text(map[id]); });
      const runs = [];
      for (const slot of [...slots].sort((a, b) => a.start.localeCompare(b.start))) {
        const previous = runs[runs.length - 1];
        if (previous && slot.start <= previous.end) previous.end = previous.end > slot.end ? previous.end : slot.end;
        else runs.push({ start: slot.start, end: slot.end });
      }
      return [{ id: text(booking.id), date: booking.date, room: text(room?.name) || (booking.mode === 'online' ? 'Online' : 'Pa sallë'), title: text(booking.title), type: text(booking.eventType) || 'Rezervim', groups: names(booking.groupIds, catalog.groups), teachers: names(booking.teacherIds, catalog.teachers), slots: runs }];
    });
  }
  function validRows(rows, dates) {
    return Array.isArray(rows) && rows.every(row => row && validDate(row.date) && (!dates || dates.includes(row.date)) && text(row.id) && text(row.room) && text(row.title) && Array.isArray(row.groups) && row.groups.every(x => typeof x === 'string') && Array.isArray(row.teachers) && row.teachers.every(x => typeof x === 'string') && Array.isArray(row.slots) && row.slots.length && row.slots.every(s => validTime(s.start) && validTime(s.end) && s.end > s.start));
  }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const [key, entry] of Object.entries(saved)) if ((key === 'all' || validDate(key)) && entry && Number.isFinite(entry.checkedAt) && entry.checkedAt <= Date.now() + 60000 && validRows(entry.rows, key === 'all' ? null : weekDates(key))) weeks[key] = entry;
  } catch {}
  function isFresh(date = localDate()) {
    const checkedAt = date === 'all' ? weeks.all?.checkedAt : Math.max(weeks.all?.checkedAt || 0, weeks[weekDates(date)[0]]?.checkedAt || 0);
    return !!checkedAt && Date.now() >= checkedAt && Date.now() - checkedAt < TTL;
  }
  function refreshWeek(date = localDate(), { force = false } = {}) {
    const dates = date === 'all' ? null : weekDates(date), key = dates ? dates[0] : 'all';
    if (key !== 'all' && pending.has('all')) return pending.get('all');
    if (pending.has(key)) return pending.get(key);
    if (!force && isFresh(date)) return Promise.resolve({ ok: true, skipped: true });
    const task = (async () => {
      try {
        const query = { structuredQuery: { from: [{ collectionId: 'publicBookings' }] } };
        if (dates) query.structuredQuery.where = { compositeFilter: { op: 'AND', filters: [
          { fieldFilter: { field: { fieldPath: 'date' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: dates[0] } } },
          { fieldFilter: { field: { fieldPath: 'date' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: dates[6] } } }
        ] } };
        const [rooms, periods, catalog, result] = await Promise.all([collection('rooms'), collection('periods'), request(BASE + '/resourceCatalog/current').then(documentData), request(BASE + ':runQuery', query)]);
        if (!Array.isArray(result) || result.some(item => item.error)) throw Error('Përgjigjja e rezervimeve është e pavlefshme.');
        const rows = normalizeBookings(result.filter(item => item.document).map(item => documentData(item.document)), rooms, periods, catalog, dates);
        weeks = { ...weeks, [key]: { checkedAt: Date.now(), rows } };
        const recent = Object.entries(weeks).sort((a, b) => b[1].checkedAt - a[1].checkedAt).slice(0, 12);
        weeks = Object.fromEntries(recent);
        try { localStorage.setItem(KEY, JSON.stringify(weeks)); } catch {}
        listeners.forEach(fn => { try { fn(); } catch {} });
        return { ok: true };
      } catch { return { ok: false }; }
      finally { pending.delete(key); }
    })();
    pending.set(key, task); return task;
  }
  function events(data, date) {
    if (!validDate(date)) return [];
    const days = ['e diel', 'e hene', 'e marte', 'e merkure', 'e enjte', 'e premte', 'e shtune'];
    const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const d = data.days.findIndex(day => normalize(day) === days[new Date(date + 'T12:00:00Z').getUTCDay()]);
    const specific = data.bookingWeeks?.[weekDates(date)[0]], all = data.bookingWeeks?.all;
    const snapshot = all && (!specific || all.checkedAt >= specific.checkedAt) ? all : specific;
    return (snapshot?.rows || []).filter(row => row.date === date).flatMap(row => row.slots.map(slot => {
      const s = data.times.indexOf(slot.start), e = data.times.indexOf(slot.end);
      if (s < 0 || e <= s) return null;
      return { id: row.id, booking: true, date, d, s, e, t: row.title, a: row.type, g: row.groups.join(' · '), p: row.teachers.join(' · '), room: row.room };
    }).filter(Boolean));
  }
  function allEvents(data) {
    const all = data.bookingWeeks?.all;
    if (!all) return [];
    const snapshot = { ...data, bookingWeeks: { all } };
    return [...new Set(all.rows.map(row => row.date))].flatMap(date => events(snapshot, date));
  }
  root.FilozofikuBookings = { localDate, weekDates, events, allEvents, refreshWeek, refreshAll: options => refreshWeek('all', options), isFresh,
    enrich: data => ({ ...data, bookingWeeks: weeks }),
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
})(window);
