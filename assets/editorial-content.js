/* Përmbajtja editoriale publikohet bashkë me aplikacionin.
 * Artikulli: { id, title, summary, body: ['Paragrafi…'], image: './assets/foto.jpg',
 *              author, date: '2026-11-04', minutes: 4, published: true }
 * Artikujt e publikuar me fotografi shfaqen edhe si stories te Kreu.
 * Provimi: { courseId: 'ID ekzistuese e lëndës', questions: [
 *   { type: 'mcq', prompt: 'Pyetja…', options: ['A', 'B'], correct: 0 },
 *   { type: 'recall', prompt: 'Pyetja…', expected: 'Përgjigjja…' }
 * ] }
 * Listat mbeten bosh derisa të jenë gati artikujt dhe provimet reale.
 */
window.FAKULTETI_EDITORIAL = {
  articles: [],
  archiveExams: []
};

window.getPublishedEditorialArticles = function (catalog) {
  const seen = new Set();
  return (Array.isArray(catalog) ? catalog : []).flatMap(item => {
    if (!item || item.published !== true || typeof item.id !== 'string' || !item.id.trim() || seen.has(item.id)) return [];
    if (typeof item.title !== 'string' || !item.title.trim() || !Array.isArray(item.body)) return [];
    const body = item.body.filter(paragraph => typeof paragraph === 'string' && paragraph.trim()).map(paragraph => paragraph.trim());
    if (!body.length) return [];
    const image = typeof item.image === 'string' && /^(https:\/\/|\.?\/?assets\/)/i.test(item.image.trim()) ? item.image.trim() : '';
    seen.add(item.id);
    return [{
      id: item.id, title: item.title.trim(), summary: typeof item.summary === 'string' ? item.summary.trim() : '', body, image,
      author: typeof item.author === 'string' ? item.author.trim() : '',
      date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') && !Number.isNaN(Date.parse(item.date)) ? item.date : '',
      minutes: Number.isFinite(Number(item.minutes)) && Number(item.minutes) > 0 ? Math.ceil(Number(item.minutes)) : Math.max(1, Math.ceil(body.join(' ').split(/\s+/).length / 200))
    }];
  }).sort((a, b) => b.date.localeCompare(a.date));
};
