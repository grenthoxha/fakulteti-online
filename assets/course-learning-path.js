/* Account-local learning progression. Timetable availability never marks reading or attendance. */
(function (global) {
  'use strict';
  const React = global.React, h = React.createElement;
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const integer = value => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 60 ? Number(value) : 0;
  const keyOf = (course, chapter, index) => `${course.id}_${chapter?.id || index}`;
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function monday(value) {
    const date = new Date(value); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + 1 - (date.getDay() || 7)); return dateKey(date);
  }
  function addDays(key, days) { const date = new Date(key + 'T12:00:00'); date.setDate(date.getDate() + days); return dateKey(date); }
  function sessionEnd(session) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date || '') || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(session.end || '')) return NaN;
    if (!session.timeZone) return new Date(session.date + 'T' + session.end + ':00').getTime();
    const [year, month, day] = session.date.split('-').map(Number), [hour, minute] = session.end.split(':').map(Number), utc = Date.UTC(year, month - 1, day, hour, minute);
    let instant = utc;
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: session.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      for (let i = 0; i < 2; i++) { const p = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value])); instant = utc - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - instant); }
      return instant;
    } catch { return NaN; }
  }
  function groupChapters(course, topics = []) {
    topics = Array.isArray(topics) ? topics.filter(item => item && typeof item === 'object') : [];
    const groups = [], byId = new Map();
    (course?.chapters || []).forEach((chapter, index) => {
      const topic = topics.find(item => item.id && chapter?.id && item.id === chapter.id) || topics.find(item => fold(item.title) && fold(item.title) === fold(chapter?.title));
      const week = integer(chapter?.week || chapter?.weekNumber || chapter?.lecture?.week || topic?.week) || index + 1;
      const id = String(chapter?.lectureId || chapter?.lecture?.id || topic?.lectureId || 'week-' + week);
      let group = byId.get(id);
      if (!group) { group = { id, number: groups.length + 1, week, title: chapter?.lectureTitle || chapter?.lecture?.title || topic?.lectureTitle || '', chapters: [] }; groups.push(group); byId.set(id, group); }
      group.chapters.push({ index, key: keyOf(course, chapter, index), title: typeof chapter === 'string' ? chapter : chapter?.title || `Kapitulli ${index + 1}`, time: chapter?.time || '', materialIds: chapter?.materialIds || topic?.materialIds || [], resourceTitles: chapter?.resourceTitles || topic?.resourceTitles || [] });
    });
    groups.sort((a, b) => a.week - b.week || a.number - b.number); groups.forEach((group, index) => { group.number = index + 1; });
    return groups;
  }
  function build({ course, topics = [], plan = {}, read = {}, activities = {}, now = Date.now(), sessionsForWeek = () => [], preview = false }) {
    const savedStart = Number(plan.startedAt), startedAt = savedStart > 0 && Number.isFinite(savedStart) ? savedStart : now;
    const anchor = monday(startedAt), saved = new Set(Array.isArray(plan.unlocked) ? plan.unlocked : []), unlocked = new Set(saved), groups = groupChapters(course, topics);
    let previous;
    for (const group of groups) {
      group.start = addDays(anchor, (group.week - 1) * 7); group.end = addDays(group.start, 6);
      const sessions = sessionsForWeek(group.start, group.end).filter(item => item.date >= group.start && item.date <= group.end && !item.cancelled && !['cancelled', 'canceled'].includes(item.status) && item.type === 'lecture');
      const ended = sessions.filter(item => sessionEnd(item) <= now), upcoming = sessions.filter(item => sessionEnd(item) > now).sort((a, b) => sessionEnd(a) - sessionEnd(b));
      group.scheduled = upcoming[0] || sessions.slice().sort((a, b) => sessionEnd(a) - sessionEnd(b))[0] || null;
      const previousRead = !!previous && previous.chapters.every(item => item.done);
      const released = preview || !previous || ended.length > 0 || previousRead;
      group.reason = preview ? 'preview' : !previous ? 'first' : previousRead ? 'reading' : ended.length ? 'schedule' : 'locked';
      group.chapters.forEach((item, index) => {
        item.done = Boolean(read[item.key]);
        item.readStatus = item.done ? 'done' : activityStatus(activities[item.key + ':read']) === 'in-progress' ? 'in-progress' : 'not-started';
        item.lessonStatus = activityStatus(activities[item.key + ':lesson']);
        item.available = item.done || saved.has(item.key) || (released && (preview || index === 0 || group.chapters[index - 1].done));
        item.reason = item.available ? group.reason : index > 0 ? 'chapter' : 'locked';
        if (item.available) unlocked.add(item.key);
      });
      group.done = group.chapters.every(item => item.done); group.available = group.chapters.some(item => item.available); if (group.available && !released) group.reason = 'saved'; previous = group;
    }
    const chapters = groups.flatMap(group => group.chapters.map(item => ({ ...item, lectureId: group.id, lecture: group.number, week: group.week })));
    const next = chapters.find(item => item.available && !item.done) || null;
    return { courseId: course.id, title: course.title, startedAt, groups, chapters, next, completed: chapters.filter(item => item.done).length, total: chapters.length, unlocked: [...unlocked], allDone: chapters.length > 0 && chapters.every(item => item.done), needsSave: savedStart !== startedAt || [...unlocked].some(key => !saved.has(key)) };
  }
  function pickSessions({ course, courses = [course], branchId, yearId, groupId = '', programName = '', date, personal = [], official = [], score }) {
    const groupNumber = String(groupId).match(/\d+/)?.[0];
    const matchesGroup = value => !groupNumber || !/grupi\s*\d/i.test(value || '') || new RegExp('grupi\\s*' + groupNumber + '(?!\\d)', 'i').test(value);
    const personalLectures = personal.filter(item => !item.starter && item.courseId === course.id && item.branchId === branchId && String(item.yearId) === String(yearId) && item.type === 'lecture' && Number(item.dayOfWeek) === (new Date(date + 'T12:00:00').getDay() || 7) && matchesGroup(item.group || item.groupId)).map(item => ({ ...item, date }));
    if (!official.length || !score) return personalLectures;
    const suffix = title => fold(title).match(/\b([ivx]+|\d+)\s*(?:\(|$)/)?.[1] || '';
    const sameCourse = title => {
      const ranked = courses.map(item => ({ id: item.id, value: Math.max(...[item.title, ...(item.scheduleAliases || [])].map(alias => suffix(title) === suffix(alias) ? score(title, alias) : 0)) })).sort((a, b) => b.value - a.value);
      return ranked[0]?.id === course.id && ranked[0].value >= .62 && (!ranked[1] || ranked[0].value > ranked[1].value);
    };
    const selected = official.filter(item => {
      const groups = String(item.g || '').split(/[,;]/), scoped = groups.some(value => { const m = fold(value).match(/^(.*?)\s*-\s*(\d)ba\b/); return m && programName && fold(m[1]) === fold(programName) && Number(m[2]) === Number(yearId) && matchesGroup(value); });
      return scoped && /ligjerat|zevendes/.test(fold(item.a)) && !/ushtrim/.test(fold(item.a)) && sameCourse(item.t);
    }).map(item => ({ ...item, date, type: 'lecture', timeZone: 'Europe/Tirane' }));
    return selected.length ? selected : personalLectures;
  }
  function activityStatus(record) {
    if (Number(record?.completedAt || (typeof record === 'number' ? record : 0)) > 0) return 'done';
    return Number(record?.startedAt) > 0 ? 'in-progress' : 'not-started';
  }
  function updateActivity(records, key, complete, now = Date.now(), details = {}) {
    const previous = records[key], old = previous && typeof previous === 'object' ? previous : {};
    const step = Number.isInteger(details.step) && details.step >= 0 ? { step: details.step } : {};
    return { ...records, [key]: { ...old, ...step, startedAt: Number(old.startedAt) > 0 ? old.startedAt : now,
      completedAt: Number(old.completedAt || (typeof previous === 'number' ? previous : 0)) || (complete ? now : undefined) } };
  }
  function resumeActivity(item) {
    return item?.lessonStatus === 'in-progress' ? 'lesson' : 'read';
  }
  function Navigation({ active, hasLearning, hasMaterials, onNavigate }) {
    const selected = ['path', 'materials', 'notes'].includes(active) ? active : 'study';
    const tabs = [{ id: 'path', label: 'Lënda' }, ...(hasLearning ? [{ id: 'study', label: 'Modulet' }] : []), ...(hasMaterials ? [{ id: 'materials', label: 'Materialet' }] : []), { id: 'notes', label: 'Shënimet' }];
    return h('nav', { className: 'lms-course-navigation', 'aria-label': 'Navigimi i lëndës' }, tabs.map(tab => h('button', { key: tab.id, type: 'button', 'aria-current': selected === tab.id ? 'page' : undefined, onClick: () => onNavigate(tab.id) }, tab.label)));
  }
  function loadPlan(storage, scope) {
    try { const value = JSON.parse(storage?.getItem('u_course_learning_v1:' + scope) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
  }
  function usePlan({ course, scope = '', storage, active, topics = [], read = {}, activities = {}, sessionsForWeek, preview = false }) {
    const [saved, setSaved] = React.useState(() => ({ scope, value: loadPlan(storage, scope) }));
    const [now, setNow] = React.useState(Date.now);
    React.useEffect(() => {
      if (!active) return;
      const refresh = () => { if (!global.document?.hidden) setNow(Date.now()); }; refresh();
      const timer = global.setInterval(refresh, 30000);
      global.addEventListener('focus', refresh); global.document?.addEventListener('visibilitychange', refresh);
      return () => { global.clearInterval(timer); global.removeEventListener('focus', refresh); global.document?.removeEventListener('visibilitychange', refresh); };
    }, [active, scope]);
    const plan = saved.scope === scope ? saved.value : loadPlan(storage, scope);
    const model = course ? build({ course, plan, topics, read, activities, now: Math.max(now, Date.now()), sessionsForWeek, preview }) : null;
    const unlockKey = JSON.stringify(model?.unlocked || []);
    React.useEffect(() => {
      if (!active || !scope || !model?.needsSave) return;
      const existing = loadPlan(storage, scope), unlocked = [...new Set([...(Array.isArray(existing.unlocked) ? existing.unlocked : []), ...model.unlocked])];
      const value = { ...existing, startedAt: Number(existing.startedAt) > 0 ? Number(existing.startedAt) : model.startedAt, unlocked };
      try { storage?.setItem('u_course_learning_v1:' + scope, JSON.stringify(value)); } catch {}
      setSaved({ scope, value });
    }, [active, scope, model?.startedAt, unlockKey]);
    return model;
  }
  const pathIcon = (type, size = 18) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: ({ check: 'M5 12l5 5L20 7', lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z', next: 'M9 6l6 6-6 6', book: 'M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z' })[type] || 'M9 6l6 6-6 6' }));
  const shortDate = key => new Date(key + 'T12:00:00').toLocaleDateString('sq', { day: 'numeric', month: 'short' });
  function View({ model, onChapter, onContinue, onRead, onLesson, renderResources, book, onBook, onUpload, busy }) {
    const activeId = model.next?.lectureId || model.groups.find(group => !group.done)?.id || model.groups[0]?.id;
    const [expanded, setExpanded] = React.useState(activeId);
    React.useEffect(() => { setExpanded(activeId); }, [activeId]);
    const continueMode = resumeActivity(model.next);
    const openActivity = (item, mode) => (mode === 'lesson' ? onLesson || onContinue : onRead || onChapter || onContinue)?.(item.index);
    const statusLabel = status => status === 'done' ? 'Përfunduar' : status === 'in-progress' ? 'Në vazhdim' : 'Pa nisur';
    const activity = (item, mode, title, icon, status) => h('button', { key: mode, type: 'button', className: 'learning-path-activity' + (mode === 'read' ? ' learning-path-chapter' : ''), disabled: !item.available, onClick: () => openActivity(item, mode) },
      h('span', { className: 'learning-path-chapter-mark' }, pathIcon(!item.available ? 'lock' : icon, 17)), h('span', { className: 'learning-path-activity-copy' }, h('strong', null, title), h('small', { className: 'sr-only' }, mode === 'read' ? item.time || 'Teksti i kapitullit' : 'Mëso me hapa të shkurtër')),
      h('span', { className: 'learning-path-activity-status is-' + status }, status === 'done' && pathIcon('check', 15), h('span', { className: status === 'done' || status === 'not-started' ? 'sr-only' : undefined }, statusLabel(status))), item.available && pathIcon('next', 13));
    return h('div', { className: 'learning-path anim-fade-up' },
      h('header', { className: 'learning-path-heading' }, h('h1', { tabIndex: -1 }, 'Përmbajtja e lëndës'), h('p', null, model.title), h('p', { className: 'learning-path-requirement sr-only' }, 'Përfundo leximin ose mësimin e çdo kapitulli.'),
        h('div', { className: 'learning-path-progress' }, h('span', null, `${model.completed} nga ${model.total} kapituj`), h('span', null, `${Math.round(model.completed / Math.max(1, model.total) * 100)}%`)),
        h('div', { className: 'learning-path-track', role: 'progressbar', 'aria-label': 'Kapitujt e përfunduar', 'aria-valuemin': 0, 'aria-valuemax': model.total, 'aria-valuenow': model.completed }, h('span', { style: { width: model.completed / Math.max(1, model.total) * 100 + '%' } }))),
      model.next && h('section', { className: 'learning-path-next' }, h('div', null, h('small', null, `Java ${model.next.week} · Ligjërata ${model.next.lecture}`), h('strong', null, model.next.title)), h('button', { type: 'button', onClick: () => openActivity(model.next, continueMode) }, model.next.readStatus === 'in-progress' || model.next.lessonStatus === 'in-progress' ? 'Vazhdo' : 'Fillo', pathIcon('next', 16))),
      model.allDone && h('p', { className: 'learning-path-complete', role: 'status' }, pathIcon('check'), 'I ke përfunduar të gjithë kapitujt. Mund t’i rilexosh kur të duash.'),
      h('div', { className: 'learning-path-weeks' }, model.groups.map(group => {
        const open = expanded === group.id, sectionId = `learning-${encodeURIComponent(model.courseId)}-${encodeURIComponent(group.id)}`;
        const message = group.reason === 'preview' ? 'Pamje e plotë e lëndës' : group.reason === 'saved' ? 'Hapur më parë · progresi yt ruhet' : group.reason === 'reading' ? 'Hapur nga leximi paraprak' : group.reason === 'schedule' ? 'Hapur sipas orarit të përfunduar' : group.reason === 'first' ? 'Hapi i parë' : group.scheduled ? `Hapet më ${shortDate(group.scheduled.date)}, ${group.scheduled.end}, ose pas leximit paraprak.` : 'Përfundo ligjëratën paraprake për ta hapur.';
        return h('section', { key: group.id, className: 'learning-path-week' + (group.done ? ' is-done' : !group.available ? ' is-locked' : '') },
          h('button', { type: 'button', className: 'learning-path-week-toggle', 'aria-expanded': open, 'aria-controls': sectionId, onClick: () => setExpanded(open ? null : group.id) },
            h('span', { className: 'learning-path-marker' }, group.done ? pathIcon('check') : !group.available ? pathIcon('lock', 15) : pathIcon('book', 16)),
            h('span', { className: 'learning-path-week-copy' }, h('strong', null, group.title || (model.groups.filter(item => item.week === group.week).length > 1 ? `Java ${group.week} · Ligjërata ${group.number}` : `Java ${group.week}`)), h('small', null, `${group.title ? 'Java ' + group.week + ' · ' : ''}${shortDate(group.start)}–${shortDate(group.end)}`)),
            h('span', { className: 'learning-path-week-status' }, group.done ? 'Kryer' : `${group.chapters.filter(item => item.done).length}/${group.chapters.length}`), pathIcon('next', 15)),
          open && h('div', { id: sectionId, className: 'learning-path-week-body' },
            !group.available && h('p', { className: 'learning-path-release' }, message),
            group.chapters.map((item, index) => h('section', { key: item.key, className: 'learning-path-topic' },
              h('div', { className: 'learning-path-topic-heading' }, h('strong', null, item.title), h('small', { className: 'sr-only' }, item.done ? 'Kryer' : !item.available ? 'I mbyllur' : `Kapitulli ${item.index + 1}`)),
              !item.available && item.reason === 'chapter' && h('p', { className: 'learning-path-release' }, 'Përfundo kapitullin paraprak.'),
              activity(item, 'read', 'Lexim', 'book', item.readStatus),
              activity(item, 'lesson', 'Mësim', 'next', item.lessonStatus),
              item.available && renderResources?.(item)))));

      })),
      (book || onUpload) && h('div', { className: 'learning-path-book' }, h('button', { type: 'button', disabled: busy, onClick: book ? onBook : onUpload }, pathIcon('book'), h('span', null, book ? book.name : busy ? 'Duke ngarkuar librin…' : 'Shto librin tënd (PDF)'), pathIcon('next', 15))));
  }
  global.FakultetiLearningPath = { build, groupChapters, keyOf, monday, addDays, sessionEnd, pickSessions, loadPlan, usePlan, activityStatus, updateActivity, resumeActivity, Navigation, View };
})(window);
