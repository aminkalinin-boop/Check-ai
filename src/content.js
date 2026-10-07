/* ===================================================================
   Углублённые проверки: структура файла, ссылки, локализация признаков,
   содержательные и языковые аномалии
   =================================================================== */
'use strict';

const pg = p => (p && p.page ? `с. ${p.page}` : '');
const where = p => [pg(p), p && p.table != null ? tableLabel(p._res, p.table) : null].filter(Boolean).join(', ');
function tableLabel(res, n) { const t = res.tables && res.tables[n]; if (!t) return 'таблица'; const m = t.caption && t.caption.match(/^Таблица\s*([А-ЯA-Z]?\.?\d+(?:\.\d+)*)/); return m ? 'табл. ' + m[1] : 'таблица без подписи'; }

/* ---------- 3.1. структура пакета ---------- */
async function readStructure(res, zip, doc, docXml) {
  const m = res.meta, body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
  const cnt = re => (docXml.match(re) || []).length;
  m.topTables = [...body.children].filter(c => c.localName === 'tbl').length;
  m.sections = cnt(/<w:sectPr\b/g);
  m.drawingML = cnt(/<w:drawing\b/g);
  m.vml = cnt(/<w:pict\b/g) + cnt(/<w:object\b/g);
  m.inlineImages = cnt(/<wp:inline\b/g);
  m.anchored = cnt(/<wp:anchor\b/g);
  m.formulas = cnt(/<m:oMath\b(?!Para)/g);
  m.paragraphsTotal = res.paras.length;
  m.bookmarks = cnt(/<w:bookmarkStart\b/g);
  m.fieldsTotal = cnt(/w:fldCharType="begin"/g) + cnt(/<w:fldSimple\b/g);
  m.headers = res.parts.filter(p => /^word\/header\d*\.xml$/.test(p)).length;
  m.footers = res.parts.filter(p => /^word\/footer\d*\.xml$/.test(p)).length;
  m.endnotes = 0;
  const en = zip.file('word/endnotes.xml'); if (en) m.endnotes = Math.max(0, ((await en.async('string')).match(/<w:endnote\b/g) || []).length - 2);
  m.captionsFig = res.paras.filter(p => /^\s*(Рисунок|Рис\.)\s*\d/i.test(p.text)).length;
  m.captionsTab = res.paras.filter(p => /^\s*Таблица\s*[А-ЯA-Z]?\.?\d/.test(p.text)).length;
  m.appendices = res.paras.filter(p => !p.toc && /^\s*ПРИЛОЖЕНИ[ЕЯ]\s+[А-ЯA-Z0-9]/.test(p.text)).length;
  // внешние связи (не гиперссылки)
  const ext = [];
  for (const p of res.parts.filter(p => /\.rels$/.test(p))) {
    const x = await zip.file(p).async('string');
    for (const mm of x.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      const a = mm[1]; if (!/TargetMode="External"/.test(a) || /relationships\/hyperlink"/.test(a)) continue;
      const tg = ((a.match(/Target="([^"]*)"/) || [])[1] || '').replace(/&amp;/g, '&');
      const type = ((a.match(/Type="[^"]*\/([^"/]+)"/) || [])[1] || '');
      ext.push({ part: p, type, target: tg });
    }
  }
  m.externalLinks = ext;
  m.cloud = [...new Set(ext.map(e => /d\.docs\.live\.net|onedrive|1drv/i.test(e.target) ? 'OneDrive' : /sharepoint/i.test(e.target) ? 'SharePoint' : /drive\.google|docs\.google/i.test(e.target) ? 'Google Drive' : /^file:|^[a-z]:\\/i.test(e.target) ? 'локальный диск' : null).filter(Boolean))];
  m.oleExternal = ext.filter(e => /oleObject|package|externalLinkPath|oleExternal/i.test(e.type) || /\.xlsx?$/i.test(e.target)).length;
  m.xlsxTargets = [...new Set(ext.filter(e => /\.xls[xm]?$/i.test(e.target)).map(e => decodeURIComponent(e.target.split(/[\\/]/).pop())))];
}

/* ---------- 3.3. разбор ссылок по доменам ---------- */
function linkStats(res) {
  if (!res.links) return;
  const decode = u => { const q = u.match(/^https?:\/\/(?:www\.)?google\.[a-z.]+\/url\?.*?[?&](?:q|url)=([^&]+)/i); if (q) { try { return decodeURIComponent(q[1]); } catch (e) { return q[1]; } } return u; };
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return '—'; } };
  const rel = res.links.rel.map(l => ({ ...l, real: decode(l.url), redirect: decode(l.url) !== l.url }));
  const dom = {};
  for (const l of rel) { const h = host(l.real); dom[h] = (dom[h] || 0) + 1; }
  res.stats.links = { total: rel.length, redirect: rel.filter(l => l.redirect).length, direct: rel.filter(l => !l.redirect).length, textUrls: res.links.text.length,
    domains: Object.entries(dom).sort((a, b) => b[1] - a[1]), utm: rel.filter(l => /utm_source=/i.test(l.real)).length };
}

/* ---------- лексические справочники ---------- */
const FORMULA_LEXICON = [
  ['позволяет / позволяют / позволит', /(?<!\p{L})позвол\p{L}*/giu], ['в условиях', /(?<!\p{L})в\s+условиях(?!\p{L})/giu], ['в рамках', /(?<!\p{L})в\s+рамках(?!\p{L})/giu],
  ['обеспечивает / обеспечение', /(?<!\p{L})обеспеч\p{L}*/giu], ['систематизация', /(?<!\p{L})систематиз\p{L}*/giu], ['синтез', /(?<!\p{L})синтез\p{L}*/giu],
  ['верификация / верифицировать', /(?<!\p{L})верифи\p{L}*/giu], ['превентивный', /(?<!\p{L})превентивн\p{L}*/giu], ['проактивный', /(?<!\p{L})проактивн\p{L}*/giu],
  ['детерминация / детерминанта', /(?<!\p{L})детермин\p{L}*/giu], ['дифференциация', /(?<!\p{L})дифференци\p{L}*/giu], ['имплементация', /(?<!\p{L})имплемент\p{L}*/giu],
  ['институциональный', /(?<!\p{L})институциональн\p{L}*/giu], ['трансформация', /(?<!\p{L})трансформ\p{L}*/giu], ['интеграция', /(?<!\p{L})интегр\p{L}*/giu],
  ['комплексный', /(?<!\p{L})комплексн\p{L}*/giu], ['ключевой', /(?<!\p{L})ключев\p{L}*/giu], ['синергия', /(?<!\p{L})синерг\p{L}*/giu],
  ['экосистема', /(?<!\p{L})экосистем\p{L}*/giu], ['драйвер', /(?<!\p{L})драйвер\p{L}*/giu], ['императив', /(?<!\p{L})императив\p{L}*/giu],
  ['парадигма', /(?<!\p{L})парадигм\p{L}*/giu], ['контур (управления и т. п.)', /(?<!\p{L})контур\p{L}*/giu], ['таким образом', /таким\s+образом/giu],
  ['важно / следует отметить', /(важно|стоит|следует|необходимо)\s+(отметить|подчеркнуть)/giu], ['не только … но и', /не\s+только/giu], ['в свою очередь', /в\s+свою\s+очередь/giu],
  ['играет ключевую / важную роль', /игра\p{L}*\s+(ключев|важн|решающ)\p{L}*\s+рол/giu], ['многоаспектный / многогранный', /(?<!\p{L})(многогранн|многоаспектн)\p{L}*/giu],
];
// «ожидаемая частота» в академических текстах (на 1000 слов), грубая ориентировочная база
const DOMAIN_LEXICONS = {
  'медицина и здравоохранение': ['медицин', 'лекарств', 'фармацевт', 'пациент', 'клиническ', 'больниц', 'терапевт', 'заболеван', 'здравоохранен', 'врач', 'хирург', 'вакцин', 'амбулатор', 'эпидеми', 'онколог', 'стоматолог', 'медикамент', 'госпитал'],
  'военное дело и оборона': ['боеприпас', 'вооружен', 'воинск', 'боев', 'военн', 'оборонн', 'армейск', 'ракет', 'беспилот', 'фортифик', 'маскировк', 'артиллер'],
  'образование': ['школьник', 'учащ', 'педагог', 'абитуриент', 'учител', 'урок', 'дошкольн'],
  'ИТ и цифровые платформы': ['смартфон', 'блокчейн', 'криптовалют', 'нейросет', 'маркетплейс', 'стартап', 'мобильн прилож', 'кибератак', 'искусственн интеллект'],
  'туризм и гостеприимство': ['туризм', 'туристическ', 'гостиниц', 'отел', 'турист'],
  'нефтегазовая отрасль': ['нефтедобыв', 'нефтепереработ', 'газодобыв', 'скважин', 'месторожден', 'нефтегаз'],
  'розничная торговля и общепит': ['ритейл', 'супермаркет', 'общепит', 'ресторан', 'гипермаркет'],
  'банковские продукты': ['ипотек', 'пластиков карт', 'банковск карт', 'депозит', 'кредитн карт'],
  'автомобилестроение': ['автомобил', 'автопром', 'автодилер'],
  'авиация и космос': ['авиац', 'авиакомпан', 'космическ', 'спутник', 'аэропорт'],
  'спорт': ['спортсмен', 'спортивн', 'олимпийск', 'фитнес'],
  'культура и медиа': ['музе', 'театр', 'кинематограф', 'телеканал', 'шоу-бизнес'],
  'энергетика': ['электроэнерг', 'энергосистем', 'атомн электростанц', 'возобновляем источник энерг'],
  'сельское хозяйство': ['урожа', 'зернов', 'животновод', 'растениевод', 'агрохолдинг', 'агропромышлен', 'сельскохозяйствен'],
  'лесное хозяйство и деревообработка': ['лесопромышлен', 'древесин', 'пиломатериал', 'лесозаготов', 'деревообраб', 'лесн'],
  'уголовно-исполнительная система': ['осужденн', 'уголовно-исполнител', 'исправительн', 'фсин', 'колони'],
};
const CATEGORICAL = [
  [/математически\s+(точно|неизбежн\p{L}*|доказ\p{L}*|гарантир\p{L}*)/giu, 'weak'], [/(?<!\p{L})неизбежн\p{L}*/giu, 'info'], [/(?<!\p{L})гарантир\p{L}*/giu, 'info'],
  [/(?<!\p{L})абсолютн\p{L}*/giu, 'info'], [/(?<!\p{L})однозначн\p{L}*/giu, 'info'], [/(?<!\p{L})безусловн\p{L}*/giu, 'info'], [/точно\s+предсказ\p{L}*/giu, 'weak'],
  [/полностью\s+(исключ|устран|предотвра|нивелир)\p{L}*/giu, 'info'], [/(?<!\p{L})(всегда|никогда)(?!\p{L})/giu, 'info'], [/доказывает,?\s+что/giu, 'info'],
];

/* ---------- основная функция ---------- */
function contentChecks(res) {
  res.paras.forEach(p => { p._res = res; });
  const paras = res.paras.filter(p => !p.toc && p.text.trim());
  const body = paras.filter(p => !p.heading && !p.bib);
  const bodyText = body.filter(p => !p.inTable).map(p => p.text).join('\n');
  const bw = countWords(bodyText) || 1;
  const add = f => addFinding(res, f);
  linkStats(res);

  /* 4.1 локализация технических маркеров по таблицам и страницам */
  const loc = [];
  const webStyles = res.styles.filter(s => s.category === 'webui' && (s.paras + s.runs) > 0);
  for (const s of webStyles) {
    const hits = res.paras.filter(p => p.flags.some(f => f.key === s.id));
    const groups = new Map();
    for (const p of hits) {
      const key = p.table != null ? 't' + p.table : 's' + p.section;
      if (!groups.has(key)) groups.set(key, { style: s.name, table: p.table, section: p.section, pages: new Set(), paras: 0, words: 0, sample: [] });
      const g = groups.get(key); g.pages.add(p.page); g.paras++; g.words += p.webRuns.length ? countWords(p.webRuns.join(' ')) : p.words;
      if (g.sample.length < 4) { const t = (p.webRuns.length ? p.webRuns.join(' ') : p.text).trim(); if (t.length > 3) g.sample.push(t.slice(0, 90)); }
    }
    for (const g of groups.values()) {
      const pages = [...g.pages].filter(Boolean).sort((a, b) => a - b);
      const cap = g.table != null ? (res.tables[g.table].caption || '') : '';
      loc.push({ style: g.style, where: (g.table != null ? tableLabel(res, g.table) + (/продолжение/.test(cap) ? ' (продолжение)' : cap ? ' — ' + cap.replace(/^Таблица\s*[\d.А-ЯA-Z]+\s*[–—-]?\s*/, '') : '') : 'текст раздела «' + g.section.slice(0, 80) + '»'),
        pages: pages.length ? (pages[0] === pages[pages.length - 1] ? `с. ${pages[0]}` : `с. ${pages[0]}–${pages[pages.length - 1]}`) : '', paras: g.paras, words: g.words, sample: g.sample.join(' | '), inTable: g.table != null });
    }
  }
  loc.sort((a, b) => b.words - a.words);
  res.stats.localization = loc;
  if (loc.length) {
    const inTables = loc.filter(l => l.inTable).length;
    add({ id: 'loc', group: 'content', title: 'Локализация веб-разметки по таблицам и разделам', level: 'info', value: loc.length,
      detail: `Зон с сохранившейся веб-разметкой: ${loc.length}, из них в таблицах: ${inTables}. Крупнейшие: ${loc.slice(0, 4).map(l => `${l.where.slice(0, 70)} (${l.pages}; ${l.words} сл.)`).join('; ')}.`,
      note: 'Показывает, в каких содержательных блоках сохранился след переноса из веб-интерфейса. Если это авторские классификации, принципы, выводы — использование ИИ затрагивает содержательное ядро работы.' });
  }

  /* 4.2 формульно-аналитический стиль */
  const lex = FORMULA_LEXICON.map(([label, re]) => { const n = (bodyText.match(re) || []).length; return { label, n, per1000: 1000 * n / bw }; }).filter(x => x.n).sort((a, b) => b.n - a.n);
  res.stats.lexicon = lex;
  const chains = [];
  for (const p of body) for (const mm of p.text.matchAll(/(?:\p{L}{4,}(?:ция|ние|ость|изм)\s*[—–-]\s*){2,}\p{L}{4,}(?:ция|ние|ость|изм)/gu)) chains.push({ p, t: mm[0] });
  res.stats.nominalChains = chains.length;
  const dens = lex.reduce((a, x) => a + x.n, 0) * 1000 / bw;
  add({ id: 'lexicon', group: 'content', title: 'Формульно-аналитический стиль (частотный профиль)', level: dens > 25 ? 'weak' : 'info', value: Math.round(dens * 10) / 10,
    detail: `Плотность: ${dens.toFixed(1)} на 1000 слов связного текста (${fmtNum(bw)} сл.). ${lex.slice(0, 10).map(x => `«${x.label}» — ${x.n}`).join('; ')}. Цепочек отглагольных существительных через тире: ${chains.length}.`,
    note: 'Сама по себе такая лексика допустима в экономической диссертации и не доказывает ИИ. Поддерживающий признак: учитывается только в совокупности с техническими следами.',
    examples: chains.slice(0, 3).map(c => ({ para: c.p.i, text: `${pg(c.p)}: «${c.t}»` })) });

  /* 4.4 предметно-чужеродные фрагменты */
  const alien = alienCheck(res, paras);
  if (alien.length) {
    alien.forEach(a => a.p.flags.push({ type: 'content', key: 'alien', level: 'weak', label: `Чужеродная тематика: «${a.word}» (${a.domain})` }));
    add({ id: 'alien', group: 'content', title: 'Предметно-чужеродные фрагменты', level: 'weak', value: alien.length,
      detail: `Найдено: ${alien.length} ${alien.length === 1 ? 'упоминание' : 'упоминаний'} тематики, не связанной с работой: ${[...new Set(alien.map(a => a.domain))].join('; ')}. Основная тематика работы по словарям: ${res.stats.domains.own.slice(0, 4).map(d => d.domain + ' (' + d.hits + ')').join(', ') || 'не определена'}. Проверено основ: ${fmtNum(res.stats.domains.stems)}${res.stats.domains.user ? `, в т. ч. из загруженной базы «${res.stats.domains.user.name}» (${res.stats.domains.user.count} тем)` : ''}.`,
      note: 'Отдельные термины из посторонней предметной области (например, «медицинская продукция» в работе о лесопромышленном комплексе) — типичный остаток текста, сгенерированного для другой отрасли либо недостаточно адаптированного при перефразировании. Допускает и человеческое объяснение (копирование из иного источника).',
      examples: alien.slice(0, 6).map(a => ({ para: a.p.i, text: `${where(a.p)}: «${snippet(a.p.text, a.p.text.toLowerCase().replace(/ё/g, 'е').indexOf(a.word), 170)}»` })) });
  }

  /* 4.5 повтор числовых структур и дословные повторы */
  const numRe = /(?<![\d.,])\d{1,4}[.,]\d{2,4}(?![\d])/g;
  const tnums = (res.tables || []).map(t => { const all = []; t.paras.forEach(i => { const m = res.paras[i].text.match(numRe); if (m) all.push(...m.map(x => x.replace('.', ','))); }); return all; });
  const dupTables = [];
  for (let a = 0; a < tnums.length; a++) for (let b = a + 1; b < tnums.length; b++) {
    if (tnums[a].length < 5 || tnums[b].length < 5) continue;
    const A = new Set(tnums[a]), B = new Set(tnums[b]);
    let inter = 0; for (const x of A) if (B.has(x)) inter++;
    const j = inter / (A.size + B.size - inter);
    if (j >= 0.6 && inter >= 5) dupTables.push({ a, b, j, inter });
  }
  // повторяющиеся «редкие» числа вне таблиц
  const numPlaces = {};
  for (const p of paras) { const m = p.text.match(/(?<![\d.,])\d{1,3}[.,]\d{3}(?!\d)/g); if (m) new Set(m).forEach(x => (numPlaces[x] = numPlaces[x] || []).push(p)); }
  const repNums = Object.entries(numPlaces).filter(([k, v]) => v.length >= 2 && new Set(v.map(p => p.table ?? ('s' + p.i))).size >= 2).sort((a, b) => b[1].length - a[1].length);
  // дословно повторяющиеся предложения
  const sentMap = {};
  for (const p of body) for (const s of p.text.split(/(?<=[.!?])\s+/)) { const k = s.toLowerCase().replace(/[^\p{L}\d ]/gu, '').replace(/\s+/g, ' ').trim(); if (countWords(k) >= 12) (sentMap[k] = sentMap[k] || []).push({ p, s }); }
  const dupSent = Object.values(sentMap).filter(v => v.length >= 2);
  dupTables.sort((x, y) => y.j - x.j || y.inter - x.inter);
  res.stats.numeric = { dupTables, repNums: repNums.slice(0, 15).map(([k, v]) => ({ n: k, places: v.map(p => where(p) || `абз. ${p.i + 1}`) })), dupSent: dupSent.length };
  if (dupTables.length || repNums.length || dupSent.length) {
    const ex = [
      ...dupTables.slice(0, 5).map(d => ({ para: res.tables[d.a].firstPara, text: `${tableLabel(res, d.a)} (с. ${res.tables[d.a].page}) и ${tableLabel(res, d.b)} (с. ${res.tables[d.b].page}): совпадают ${d.inter} числовых значений, сходство ${Math.round(d.j * 100)}%` })),
      ...dupSent.slice(0, 3).map(v => ({ para: v[0].p.i, text: `Предложение повторено ${v.length} раза (${v.map(x => pg(x.p)).join(', ')}): «${snippet(v[0].s, null, 140)}»` })),
    ];
    add({ id: 'numdup', group: 'content', title: 'Повтор числовых структур и дословные повторы', level: dupTables.length ? 'weak' : 'info', value: dupTables.length + repNums.length + dupSent.length,
      detail: `Пар таблиц с совпадающими наборами чисел (сходство от 60%, не менее 5 общих значений): ${dupTables.length}${dupTables.filter(d => d.j === 1).length ? `, из них полностью идентичных: ${dupTables.filter(d => d.j === 1).length}` : ''}; дословно повторённых предложений (от 12 слов): ${dupSent.length}.`,
      note: 'Полное совпадение числовой структуры разных расчётов требует подтверждения первичными данными: без него нельзя исключить тиражирование шаблона с заменой названий. Совместимо и с использованием ИИ, и с ручным копированием.', examples: ex });
    dupTables.forEach(d => res.tables[d.a].paras.concat(res.tables[d.b].paras).slice(0, 1).forEach(i => res.paras[i].flags.push({ type: 'content', key: 'numdup', level: 'weak', label: 'Совпадающая числовая структура таблиц' })));
  }

  /* 4.6 категоричные выводы */
  const cat = [];
  for (const p of body) for (const [re, lvl] of CATEGORICAL) { re.lastIndex = 0; for (const mm of p.text.matchAll(re)) cat.push({ p, w: mm[0], lvl, idx: mm.index }); }
  res.stats.categorical = cat.length;
  if (cat.length) {
    const strongCat = cat.filter(c => c.lvl === 'weak');
    strongCat.forEach(c => c.p.flags.push({ type: 'content', key: 'cat', level: 'weak', label: `Категоричная формулировка: «${c.w}»` }));
    const byW = {}; cat.forEach(c => { const k = c.w.toLowerCase(); byW[k] = (byW[k] || 0) + 1; });
    add({ id: 'categorical', group: 'content', title: 'Категоричные выводы и детерминистские формулировки', level: strongCat.length ? 'weak' : 'info', value: cat.length,
      detail: `Всего: ${cat.length}; наиболее сильных («математически точно/неизбежно», «точно предсказать»): ${strongCat.length}. Частота: ${Object.entries(byW).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `«${k}» — ${v}`).join('; ')}.`,
      note: 'Переход от вероятностной диагностики к категоричной причинности характерен для убедительно звучащего, но недостаточно ограниченного аналитического текста. Требует смягчения формулировок или статистического обоснования.',
      examples: (strongCat.length ? strongCat : cat).slice(0, 5).map(c => ({ para: c.p.i, text: `${where(c.p)}: «${snippet(c.p.text, c.idx, 170)}»` })) });
  }

  /* 4.7 ссылки на источники и список литературы */
  citationChecks(res, body);

  /* 4.8 языковые и терминологические несогласованности */
  languageChecks(res, body);
  /* стилометрический профиль */
  stylometry(res);
}

function citationChecks(res, body) {
  const bib = res.stats.bibItems || [];
  const N = bib.length;
  const cites = [];
  for (const p of body) for (const mm of p.text.matchAll(/\[([^\[\]]{1,80})\]/g)) {
    if (/\d[.,]\d/.test(mm[1]) && !/с\.\s*\d/.test(mm[1])) continue;
    for (const part of mm[1].split(/;/)) {
      const t = part.trim(); const r = t.match(/^(\d{1,4})\s*[–-]\s*(\d{1,4})(?!\s*[,.]?\s*с)/); const s = t.match(/^(\d{1,4})(?![\d.,]*\d{4})/);
      if (r && +r[2] > +r[1] && +r[2] - +r[1] < 30) { for (let k = +r[1]; k <= +r[2]; k++) cites.push({ n: k, p, idx: mm.index }); }
      else if (s && +s[1] > 0 && !/^\d{4}$/.test(t)) cites.push({ n: +s[1], p, idx: mm.index, raw: mm[0] });
    }
  }
  const cs = { total: cites.length, unique: new Set(cites.map(c => c.n)).size, bib: N };
  res.stats.citations = cs;
  if (!cites.length) return;
  const out = N ? cites.filter(c => c.n < 1 || c.n > N) : [];
  const cited = new Set(cites.map(c => c.n));
  const uncited = N ? [...Array(N).keys()].map(k => k + 1).filter(k => !cited.has(k)) : [];
  const freq = {}; cites.forEach(c => freq[c.n] = (freq[c.n] || 0) + 1);
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  // автор в тексте ≠ источник
  const surA = /(?:^|[^\p{L}])([А-ЯЁ])\.\s?([А-ЯЁ])\.\s?([А-ЯЁ][а-яё]{2,}(?:-[А-ЯЁ][а-яё]+)?)/gu;
  const surB = /([А-ЯЁ][а-яё]{2,}(?:-[А-ЯЁ][а-яё]+)?)\s([А-ЯЁ])\.\s?([А-ЯЁ])\./gu;
  const mism = [];
  if (N) for (const c of cites) {
    if (!c.raw || c.n > N) continue;
    const before = c.p.text.slice(Math.max(0, c.idx - 220), c.idx);
    const sent = before.split(/(?<=[.!?])\s+(?=[А-ЯЁ])/).pop();
    const names = new Set(); for (const m of sent.matchAll(surA)) names.add(m[3]); for (const m of sent.matchAll(surB)) names.add(m[1]);
    if (!names.size) continue;
    const bt = bib[c.n - 1].toLowerCase().replace(/ё/g, 'е');
    if (![...names].some(n => bt.includes(stem(n)) || bt.includes(translit(stem(n))))) mism.push({ c, names: [...names] });
  }
  // широкая атрибуция: длинный абзац с единственной ссылкой
  const broad = [];
  for (const p of body) {
    if (p.inTable || p.words < 70) continue;
    const ms = [...p.text.matchAll(/\[\s*\d[^\[\]]{0,80}\]/g)]; if (!ms.length) continue;
    const last = ms[ms.length - 1]; const tail = p.text.slice(last.index + last[0].length);
    const tailSent = tail.split(/(?<=[.!?])\s+(?=[А-ЯЁ«])/).filter(s => countWords(s) >= 4).length;
    if (tailSent >= 3 && countWords(tail) >= 45) broad.push({ p, ref: last[0], tailWords: countWords(tail), tailSent });
  }
  const lvl = out.length || mism.length ? 'medium' : 'info';
  const ex = [
    ...out.slice(0, 3).map(c => ({ para: c.p.i, text: `${where(c.p)}: ссылка [${c.n}] при ${N} записях в списке литературы` })),
    ...mism.slice(0, 5).map(x => ({ para: x.c.p.i, text: `${where(x.c.p)}: в тексте ${x.names.join(', ')}, а источник [${x.c.n}] — «${snippet(bib[x.c.n - 1], null, 120)}»` })),
    ...broad.sort((a, b) => b.tailWords - a.tailWords).slice(0, 5).map(b => ({ para: b.p.i, text: `${where(b.p)}: после ссылки ${b.ref} следуют ещё ${b.tailSent} предложений (${b.tailWords} сл.) без ссылки — «${snippet(b.p.text, b.p.text.lastIndexOf(b.ref), 150)}»` })),
  ];
  broad.forEach(b => b.p.flags.push({ type: 'src', key: 'broad', level: 'info', label: `Утверждения после ссылки ${b.ref} без источника (${b.tailSent} предл.)` }));
  mism.forEach(x => x.c.p.flags.push({ type: 'src', key: 'citemism', level: 'weak', label: `Автор(ы) ${x.names.join(', ')} не совпадают с источником [${x.c.n}]` }));
  addFinding(res, { id: 'citations', group: 'src', title: 'Соответствие ссылок в тексте и списка литературы', level: lvl, value: cites.length,
    detail: `Ссылок в квадратных скобках: ${cites.length} (на ${cs.unique} разных источников); записей в списке: ${N || 'не определено'}. Ссылки на несуществующие номера: ${out.length}. Источники без ссылок в тексте: ${uncited.length}${uncited.length ? ' (№ ' + uncited.slice(0, 15).join(', ') + (uncited.length > 15 ? '…' : '') + ')' : ''}. Названный автор не совпадает с источником: ${mism.length}. Абзацев, где после последней ссылки идут 3 и более предложения без источника: ${broad.length}. Чаще всего цитируются: ${top.map(([k, v]) => `[${k}] — ${v}`).join(', ')}.`,
    note: 'Для генеративных моделей типичен риск расширения содержания источника за пределы реально изложенного и раздельного формирования утверждения и ссылки. Перечисленные места — зоны обязательной постраничной сверки с первоисточником, а не самостоятельные доказательства.', examples: ex });
}

function languageChecks(res, body) {
  const words = {};
  const tokens = [];
  for (const p of body) for (const mm of p.text.matchAll(/\p{L}+(?:-\p{L}+)*/gu)) { const w = mm[0].toLowerCase().replace(/ё/g, 'е'); words[w] = (words[w] || 0) + 1; tokens.push({ w, p, idx: mm.index, orig: mm[0] }); }
  // индекс удалений для частых слов
  const idx = new Map();
  const dels = w => { const s = new Set(); for (let i = 0; i < w.length; i++) s.add(w.slice(0, i) + w.slice(i + 1)); return s; };
  for (const [w, c] of Object.entries(words)) { if (c < 3 || w.length < 5 || w.includes('-')) continue; for (const d of [w, ...dels(w)]) { if (!idx.has(d)) idx.set(d, []); idx.get(d).push(w); } }
  const typos = [];
  const seen = new Set();
  for (const tk of tokens) {
    const w = tk.w; if (words[w] !== 1 || w.length < 5 || w.includes('-') || seen.has(w) || /^\p{Lu}/u.test(tk.orig) || !/^[а-я]+$/.test(w)) continue;
    const cands = new Set();
    for (const d of [w, ...dels(w)]) for (const c of (idx.get(d) || [])) if (c !== w) cands.add(c);
    for (const c of cands) {
      if (Math.abs(c.length - w.length) !== 1) continue;
      if (c.slice(-3) !== w.slice(-3)) continue; // различие не в окончании
      let i = 0; while (i < Math.min(c.length, w.length) && c[i] === w[i]) i++;
      if (i < 2) continue;
      typos.push({ tk, fix: c, count: words[c] }); seen.add(w); break;
    }
  }
  // термины через дефис с редким вариантом
  const hy = {};
  for (const [w, c] of Object.entries(words)) if (w.includes('-')) { const [a, ...b] = w.split('-'); (hy[a] = hy[a] || []).push({ w, c, rest: b.join('-') }); }
  const term = [];
  for (const [a, vs] of Object.entries(hy)) for (const r of vs.filter(v => v.c === 1)) for (const f of vs.filter(v => v.c >= 2 && v !== r)) {
    let k = 0; while (k < Math.min(r.rest.length, f.rest.length) && r.rest[k] === f.rest[k]) k++;
    if (k >= 4 && r.rest.slice(0, 5) !== f.rest.slice(0, 5) || (k >= 4 && Math.abs(r.rest.length - f.rest.length) >= 2 && r.rest.slice(-2) === f.rest.slice(-2))) { term.push({ rare: r.w, freq: f.w, n: f.c }); break; }
  }
  // сдвоенные слова
  const dbl = [];
  for (const p of body) for (const mm of p.text.matchAll(/(?<!\p{L})(\p{L}{1,})\s+\1(?!\p{L})/giu)) if (!/^(так|еще|ещё|да|нет|очень|все|кое)$/i.test(mm[1])) dbl.push({ p, t: mm[0], idx: mm.index });
  res.stats.language = { typos: typos.length, term: term.length, dbl: dbl.length };
  const total = typos.length + term.length + dbl.length;
  if (!total) return;
  typos.forEach(t => t.tk.p.flags.push({ type: 'lang', key: 'typo', level: 'info', label: `Вероятная опечатка: «${t.tk.orig}» → «${t.fix}»` }));
  addFinding(res, { id: 'language', group: 'content', title: 'Языковые и терминологические несогласованности', level: 'info', value: total,
    detail: `Вероятных опечаток (однократное слово, отличающееся одной буквой от частого слова документа): ${typos.length}; терминологических расхождений в составных терминах: ${term.length}; сдвоенных слов: ${dbl.length}.${term.length ? ' Термины: ' + term.slice(0, 5).map(t => `«${t.rare}» при «${t.freq}» (${t.n})`).join('; ') + '.' : ''}`,
    note: 'Такие ошибки могут принадлежать любому автору и не являются «почерком ИИ»; они показывают отсутствие окончательной вычитки после компоновки текста. Согласование слов (род, число, падеж) программа не проверяет.',
    examples: [...typos.slice(0, 8).map(t => ({ para: t.tk.p.i, text: `${where(t.tk.p)}: «${t.tk.orig}» — возможно, «${t.fix}» (встречается ${t.count} раз): …${snippet(t.tk.p.text, t.tk.idx, 110)}` })),
      ...dbl.slice(0, 4).map(d => ({ para: d.p.i, text: `${where(d.p)}: сдвоенное слово «${d.t}»` }))] });
}
