/* Përmbajtja editoriale publikohet bashkë me aplikacionin.
 * Artikulli: { id, title, summary, body: ['Paragrafi…'], image: './assets/foto.jpg',
 *              author, date: '2026-11-04', minutes: 4, published: true }
 * Artikujt e publikuar me fotografi shfaqen edhe si stories te Kreu.
 * Provimi: { courseId: 'ID ekzistuese e lëndës', questions: [
 *   { type: 'mcq', prompt: 'Pyetja…', options: ['A', 'B'], correct: 0 },
 *   { type: 'recall', prompt: 'Pyetja…', expected: 'Përgjigjja…' }
 * ] }
 * Përfshihet një artikull shembull; provimet mbeten në përgatitje.
 */
window.FAKULTETI_EDITORIAL = {
  articles: [{
    id: 'shembull-kontrolli-i-punimit',
    title: 'Para se ta dorëzosh punimin: 5 kontrolle të fundit',
    summary: 'Struktura, burimet dhe qartësia: një kontroll i shkurtër para dorëzimit të punimit.',
    image: './assets/article-punimi-preview.svg',
    author: 'Fakulteti Online · Artikull shembull',
    date: '2026-11-04',
    minutes: 3,
    published: true,
    body: [
      'Para se ta dorëzosh punimin, lexoje edhe një herë me pesë pyetje konkrete përpara. Kjo listë është një shembull praktik; përshtate me udhëzimet e profesorit dhe kërkesat e detyrës.',
      '1. A i përgjigjet punimi pyetjes kryesore? Lexo titullin, hyrjen dhe përfundimin njëri pas tjetrit. Shiko nëse trajtojnë të njëjtën çështje dhe nëse përfundimi lidhet me argumentet që ke zhvilluar në tekst.',
      '2. A ka çdo paragraf një ide të qartë? Shëno me pak fjalë çfarë thotë secili paragraf. Nëse dy paragrafë përsërisin të njëjtën ide, bashkoji ose qartëso dallimin. Nëse një paragraf largohet nga tema, rishikoje vendin e tij.',
      '3. A përputhen citimet me bibliografinë? Krahaso burimet që ke përdorur në tekst me listën në fund. Kontrollo autorin, vitin, faqet kur kërkohen dhe formatin e kërkuar nga profesori. Mos përfshi burime që nuk i ke lexuar ose përdorur.',
      '4. A i ke trajtuar komentet e mëparshme? Hap vërejtjet e profesorit nga punimi i fundit. Për secilin koment, gjej një shembull në punimin aktual që tregon se e ke korrigjuar problemin: argumentim, citim, strukturë ose gjuhë.',
      '5. A është skedari gati për dorëzim? Kontrollo emrin e skedarit, formatin, faqet dhe kërkesat teknike të detyrës. Hape versionin që do të dorëzosh dhe sigurohu që figurat, tabelat dhe referencat shfaqen siç duhet.',
      'Në fund, ruaj një kopje të versionit të dorëzuar. Shëno një gjë që dëshiron ta bësh më mirë në punimin tjetër, që komentet e këtij punimi të të ndihmojnë edhe herën e ardhshme.'
    ]
  }],
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
