/* ===================================================================
   Экспертное заключение v2: структура, числовая нумерация, расширенные разделы
   =================================================================== */
const NUM = (items, style = 'Num') => items.filter(Boolean).map((t, i) => Array.isArray(t)
  ? para([{ t: `${i + 1}) ` }, ...t], { style })
  : para(`${i + 1}) ${t}`, { style }));
const SMALLNUM = items => items.filter(Boolean).map((t, i) => para(`${i + 1}. ${t}`, { style: 'Small' }));
const lvlCell = l => ({ t: LEVELS[l], fill: levelFill(l) });
const fN = v => fmtNum(v ?? 0);

async function buildReportDocx(res) {
  const m = res.meta, s = res.stats, v = res.verdict, F = res.findings;
  const byId = id => F.find(f => f.id === id);
  const dt = res.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const docTitle = (() => {
    const p = res.paras.find(p => p.words >= 3 && /^[«"]?[А-ЯЁ\s«»"\-–—,]{15,}$/.test(p.text.trim()) && !/^(ГЛАВА|ВВЕДЕНИЕ|ОГЛАВЛЕНИЕ|СОДЕРЖАНИЕ|МИНИСТЕРСТВО|ФЕДЕРАЛЬН|НА ПРАВАХ|ДИССЕРТАЦИЯ|АКАДЕМИЯ|«АКАДЕМИЯ)/.test(p.text.trim()) && !/[А-ЯЁ]+\s+[А-ЯЁ]+\s+[А-ЯЁ]+ИЧ$|ВНА$/.test(p.text.trim()));
    return p ? p.text.trim().replace(/\s+/g, ' ') : res.file.name;
  })();
  const ord = { strong: 0, medium: 1, weak: 2, info: 3 };
  const sorted = [...F].sort((a, b) => ord[a.level] - ord[b.level]);
  const gf = g => F.filter(f => f.group === g).sort((a, b) => ord[a.level] - ord[b.level]);
  const webStyles = F.filter(f => f.style && f.style.category === 'webui');
  const usedWeb = webStyles.filter(f => f.value > 0 || f.style.runs > 0);
  const L = s.links || { total: 0, redirect: 0, direct: 0, domains: [], utm: 0, textUrls: 0 };
  const out = [];
  const finding = (f, maxEx = 5) => {
    out.push(para([{ t: f.title + '. ', b: true }, { t: `Уровень: ${LEVELS[f.level].toLowerCase()}. `, i: true }, f.detail]));
    if (f.note) out.push(P(f.note));
    if (f.examples && f.examples.length) out.push(...SMALLNUM(f.examples.slice(0, maxEx).map(e => e.text)));
  };

  /* ---------- титул ---------- */
  out.push(para('ВНЕПРОЦЕССУАЛЬНОЕ ИССЛЕДОВАНИЕ', { style: 'Caps' }));
  out.push(para('ОТЧЁТ ПРЕДВАРИТЕЛЬНОГО АУДИТА', { style: 'Title' }));
  out.push(para('о технических, структурных и текстологических признаках в документе (без установления авторства)', { style: 'Subtitle' }));
  out.push(para(docTitle.length > 220 ? docTitle.slice(0, 220) + '…' : docTitle, { style: 'Subtitle' }));
  out.push(para('', { spacingAfter: 0 }));
  out.push(table([
    ['Объект исследования', `электронный файл «${res.file.name}»`],
    ['Формат', res.kind === 'docx' ? 'Microsoft Word Open XML (DOCX)' : 'Текстовый файл'],
    ['Объём', (m.pages ? `${fN(m.pages)} стр.; ` : '') + (m.metaWords ? `${fN(m.metaWords)} слов по метаданным приложения; ` : '') + `${fN(s.allWords)} слов и ${fN(res.paras.length)} абзацев по подсчёту программы`],
    ['MD5', { t: res.file.md5, mono: true }],
    ['SHA-256', { t: res.file.sha256, mono: true }],
    ['Дата исследования', dt],
  ], [2600, 6755]));
  out.push(para('Отчёт сформирован автоматически по электронной копии документа; авторство и факт генерации не устанавливаются', { style: 'Small', align: 'center' }));

  /* ---------- резюме ---------- */
  out.push(H1('Краткое резюме'));
  const summ = [v.text + `. Характер признаков: ${v.evidence}.`];
  if (v.mainSource) summ.push(`Обнаружена разметка, сходная с оформлением: ${v.mainSource}. Охват: ${v.scale}. Это не устанавливает авторство текста.`);
  summ.push(`Выявлено признаков: сильных — ${s.counts.strong}, средних — ${s.counts.medium}, слабых — ${s.counts.weak}, справочных — ${s.counts.info}.`);
  out.push(box('Предварительная оценка обнаруженных признаков', summ));
  const complexes = [];
  if (usedWeb.length) complexes.push(`Пользовательские стили веб-происхождения (${[...new Set(usedWeb.map(f => f.style.source))].join('; ')}): ${usedWeb.map(f => `«${f.style.name}» — ${[f.style.paras ? fN(f.style.paras) + ' абз.' : '', f.style.runs ? fN(f.style.runs) + ' фрагм.' : '', fN((f.style.words || 0) + (f.style.runWords || 0)) + ' сл.'].filter(Boolean).join(', ')}`).join('; ')}.`.replace('..', '.'));
  if (byId('links:google')) complexes.push(`Гиперссылки через переадресацию Google: ${fN(L.redirect)} из ${fN(L.total)} (${fmtPct(pct(L.redirect, L.total))}).`);
  if (byId('links:utm')) complexes.push(`Ссылки с меткой нейросетевого сервиса (utm_source): ${fN(byId('links:utm').value)}.`);
  if (byId('phrase')) complexes.push(`Остатки реплик чат-бота в тексте: ${fN(byId('phrase').value)}.`);
  if (byId('meta:gen')) complexes.push('Метаданные указывают на программную генерацию файла.');
  if (complexes.length) { out.push(P('Установлены следующие технические комплексы признаков:')); out.push(...NUM(complexes)); }
  if (s.localization && s.localization.length) out.push(P(`Технические маркеры распределены по ${s.localization.length} зонам, из них ${s.localization.filter(l => l.inTable).length} — в таблицах: ${s.localization.slice(0, 5).map(l => `${l.where.slice(0, 90)} (${l.pages})`).join('; ')}.`));
  if (res.human.length) out.push(P('Дополнительные особенности структуры и редактирования: ' + res.human.join(', ') + '. Они не подтверждают самостоятельное либо машинное авторство.'));
  const bounds = ['По одному итоговому файлу невозможно установить точную долю первоначально машинного текста, конкретную модель и её версию, содержание запросов, личность пользователя, последовательность редакций и степень переработки каждого фрагмента. Для этого необходимы исходные рабочие файлы, история версий, переписка с моделью, данные браузера и облачных сервисов.'];
  if (usedWeb.some(f => /Angular|Tailwind/.test(f.style.source))) bounds.push('Классы Angular и Tailwind являются маркерами веб-фреймворков, а не уникальными «водяными знаками» генеративной модели; их доказательственное значение возрастает только в совокупности с другими признаками.');
  bounds.push('Не проверялись статистические водяные знаки разработчиков моделей (Anthropic Claude, Google SynthID и др.): их обнаружение возможно только инструментами этих компаний. Заключение сформировано автоматически и подлежит оценке специалистом.');
  out.push(box('Границы вывода', bounds, 'FFF6E5'));

  /* ---------- 1 ---------- */
  out.push(H1('1. Объект, предмет и поставленные вопросы'));
  out.push(P(`Объектом исследования являлся электронный файл «${res.file.name}»` + (docTitle !== res.file.name ? `, содержащий работу «${docTitle.replace(/^[«"]|[»"]$/g, '')}»` : '') + `. В состав документа входят: ${[m.captionsTab ? `${fN(m.captionsTab)} подписанных таблиц` : '', m.captionsFig ? `${fN(m.captionsFig)} рисунков` : '', m.formulas ? `${fN(m.formulas)} формул` : '', m.appendices ? `${fN(m.appendices)} приложений` : '', res.footnotes.length ? `${fN(res.footnotes.length)} сносок` : '', s.bib ? `список литературы из ${fN(s.bib.items)} записей` : ''].filter(Boolean).join(', ') || 'текст без выделенных структурных элементов'}.`));
  out.push(P('Предмет исследования — сохранившиеся в контейнере DOCX технические признаки происхождения и маршрута переноса текста, особенности структуры и редактирования файла, а также текстологические и содержательные признаки, совместимые с применением генеративных языковых моделей.'));
  out.push(P('На разрешение были поставлены следующие вопросы:'));
  out.push(...NUM(['Какие специфические и косвенные технические маркеры присутствуют в файле?',
    'Где расположены выявленные маркеры и каков охват сохранившейся разметки?',
    'С разметкой каких веб-интерфейсов обнаружены совпадения и насколько они специфичны?',
    'Какие сведения об истории редактирования и структуре доступны в итоговом файле?',
    'Какие обстоятельства не могут быть достоверно установлены только по исследованному файлу?']));

  /* ---------- 2 ---------- */
  out.push(H1('2. Методика исследования и ограничения'));
  out.push(P('Исследование проводилось по принципу совокупной оценки независимых групп признаков. Ни один стилистический оборот, единичная ошибка или результат автоматического «детектора ИИ» не рассматривался как достаточное доказательство. Применялись следующие методы:'));
  out.push(...NUM(['структурный анализ ZIP/OOXML-пакета DOCX: document.xml, styles.xml, footnotes.xml, relationships, свойства документа, веб-расширения, поля, встроенные и связанные объекты;',
    'подсчёт и локализация пользовательских стилей абзацев и знаков, сохранённых при вставке HTML-содержимого, с сопоставлением с разметкой веб-интерфейсов DeepSeek, ChatGPT, Claude, Gemini / AI Studio, Qwen, GigaChat, Perplexity, YandexGPT, фреймворков Angular и Tailwind, библиотек формул KaTeX и MathJax;',
    'анализ внешних отношений и реальных адресов гиперссылок, включая декодирование параметров переадресации и метки utm_source;',
    'анализ редакционной истории по метаданным и идентификаторам rsid, наличию исправлений, комментариев, связанных файлов и менеджеров библиографии;',
    'поиск невидимых и нестандартных символов Unicode, остатков Markdown и LaTeX, эмодзи и реплик чат-ботов;',
    'текстологический анализ: частотный профиль формульной лексики, ритм текста и вариативность длины предложений (burstiness), смысловые повторы в соседних абзацах, дословные повторы предложений, предметно-чужеродные термины, стрелки «→» и короткие фразы-перечисления;',
    'стилометрическое сравнение с обезличенным эталоном научного автора-экономиста (62 статьи 2016–2022 гг., до появления ChatGPT) и с размеченным корпусом русскоязычных научных аннотаций AINL-Eval 2025 (тексты людей и моделей GPT-4, Llama 3.3, Gemma 2);',
    'проверка внутренней согласованности: перекрёстные ссылки и поля, нумерация рисунков и таблиц, соответствие авторов в тексте и источников, ссылки на несуществующие номера, утверждения без ссылок, совпадающие числовые структуры таблиц, категоричные формулировки, опечатки и терминологические расхождения;',
    'определение страниц по последней разметке Word, сохранённой в файле' + (m.pageSource === 'rendered' ? '' : ' (в данном файле разметка отсутствует, страницы определены по явным разрывам и могут быть неточны)') + '.']));
  out.push(P('Не проводились: проверка заимствований и плагиата, автороведческая экспертиза, научная рецензия работы, воспроизведение расчётов по первичным данным, исследование компьютера пользователя и журналов ИИ-сервисов, проверка согласования слов в предложении. Не вычислялась перплексия (предсказуемость текста для языковой модели) и не анализировались вероятности токенов: для этого нужна сама языковая модель, а частотная замена без модели на эталонном корпусе зависела от предметной области сильнее, чем от авторства, и не была включена. Каждому признаку присвоен уровень: сильный (прямой технический след), средний (косвенный технический след), слабый (статистический или неспецифичный), справочный.'));

  /* ---------- 3 ---------- */
  out.push(H1('3. Результаты технического исследования файла'));
  out.push(H2('3.1. Идентификационные данные и структура документа'));
  const struct = [
    `${fN(m.topTables)} таблиц верхнего уровня (всего ${fN(m.tables)}); ${fN(m.sections)} секций`,
    `${fN(m.drawingML)} объектов DrawingML; ${fN(m.vml)} VML-объектов; ${fN(res.media.length)} изображений; ${fN(m.charts)} диаграмм Word`,
    `${fN(m.formulas)} формул; ${fN(m.captionsTab)} подписей таблиц; ${fN(m.captionsFig)} подписей рисунков; ${fN(m.appendices)} приложений`,
    `${fN(res.footnotes.length)} сносок; ${fN(m.fieldsTotal)} полей; ${fN(m.bookmarks)} закладок`,
  ].join('\n');
  out.push(table([['Параметр', 'Установленное значение'],
    ['Имя файла', res.file.name], ['Контрольная сумма SHA-256', { t: res.file.sha256, mono: true }],
    ['Автор в свойствах', m.creator || '—'], ['Последний редактор', m.lastModifiedBy || '—'], ['Версия в свойствах', m.revision || '—'],
    ['Создан / изменён', `${m.created || '—'} / ${m.modified || '—'}`],
    ['Метаданные приложения', `${m.pages ? fN(m.pages) + ' стр.; ' : ''}${m.metaWords ? fN(m.metaWords) + ' слов; ' : ''}${fN(res.paras.length)} абзацев; время редактирования — ${m.totalTime ?? '—'} мин; ${m.application || ''} ${m.appVersion || ''}`],
    ['Структурные объекты', struct],
    ['Редакционные следы', `${fN(m.distinctRsids)} различных rsid в тексте (${fN(m.rsids)} в settings.xml); исправлений — ${fN((m.insertions || 0) + (m.deletions || 0))}; комментариев — ${fN(m.comments)}`],
    ['Связанные компоненты', [m.addins && m.addins.length ? m.addins.join(', ') : '', m.chartExternal ? `${fN(m.chartExternal)} внешних связей диаграмм` + (m.xlsxTargets && m.xlsxTargets.length ? ` с Excel-файлами (${m.xlsxTargets.slice(0, 4).join(', ')})` : '') : '', m.cloud && m.cloud.length ? 'облачные хранилища: ' + m.cloud.join(', ') : ''].filter(Boolean).join('; ') || 'не обнаружены'],
  ], [2900, 6455], { header: true }));
  const interp = [];
  if (m.created && m.created === m.modified && (+m.totalTime || 0) <= 1) interp.push('Совпадение времени создания и изменения при нулевом (или минимальном) времени редактирования не позволяет восстановить хронологию работы: эти поля формируются при сохранении копии, экспорте или пересборке документа.');
  if (m.distinctRsids > 300) interp.push(`Напротив, ${fN(m.distinctRsids)} различных rsid и сложная структура файла свидетельствуют о множественных операциях редактирования и компоновки. Эти данные подтверждают длительную либо составную работу с документом, но не определяют, кто выполнял отдельные операции.`);
  else if (m.rsids === 0) interp.push('Отсутствие идентификаторов rsid характерно для файлов, созданных программно, а не набранных в Word.');
  interp.forEach(t => out.push(P(t)));
  gf('meta').forEach(f => finding(f, 2));

  out.push(H2('3.2. Пользовательские стили веб-происхождения'));
  if (webStyles.length || F.some(f => f.style)) {
    out.push(P('В файле styles.xml обнаружены пользовательские стили, имена которых совпадают с классами HTML-разметки веб-приложений. Такие стили создаются Word автоматически при вставке содержимого, скопированного из браузера, с сохранением форматирования.'));
    const styleRows = F.filter(f => f.style && f.style.category !== 'junk').map(f => {
      const st = f.style, locs = (s.localization || []).filter(l => l.style === st.name);
      const use = (st.paras + st.runs) ? [st.paras ? `${fN(st.paras)} абзацев (${fN(st.words)} сл.)` : '', st.runs ? `${fN(st.runs)} элементов разметки, из них непустых ${fN(st.nonEmptyRuns || 0)}; ${fN(st.runChars || 0)} видимых знаков; ${fN(st.runParaSet ? st.runParaSet.size : 0)} абзацев/ячеек` : ''].filter(Boolean).join('; ') : 'определён, но не применён';
      return [{ t: st.name, mono: true }, use, locs.length ? locs.slice(0, 4).map(l => l.where.replace(/ — .*/, '') + (l.pages ? ', ' + l.pages : '')).join('; ') : '—', st.source, lvlCell(f.level)];
    });
    if (styleRows.length) out.push(table([['Стиль', 'Фактическое использование', 'Локализация', 'Происхождение', 'Уровень'], ...styleRows], [1800, 2600, 2100, 1800, 1055], { header: true }));
    if (s.markedBodyWords) {
      out.push(table([['Контур подсчёта', 'Абзацы с признаком', 'Слова с признаком', 'Доля слов'],
        ['Основной связный текст (без таблиц, надписей, заголовков)', `${fN(s.markedBodyParas)} из ${fN(s.bodyParas)}`, `${fN(s.markedBodyWords)} из ${fN(s.bodyWords)}`, fmtPct(s.markedShare)],
        ['Все текстовые элементы, включая таблицы и схемы', `${fN(s.markedAllParas)} из ${fN(s.allParas)}`, `${fN(s.markedAllWords)} из ${fN(s.allWords)}`, fmtPct(s.markedAllShare)]], [3800, 1900, 2000, 1655], { header: true }));
      const secs = res.sections.filter(x => x.words >= 60 && x.marked);
      if (secs.length) out.push(table([['Раздел', 'Слов', 'Доля слов со стилем веб-интерфейса'], ...secs.map(x => [x.title, fN(x.words), fmtPct(pct(x.marked, x.words))])], [6155, 1200, 2000], { header: true }));
    } else if (s.runMarkedWords) {
      out.push(P(`Веб-разметка применена на уровне отдельных фрагментов (стили знаков): ${fN(s.runMarkedWords)} слов внутри ${fN(s.runMarkedParas)} абзацев/ячеек. Это минимальный объём явно сохранившейся веб-разметки, а не процент машинного авторства: после вставки стиль мог быть изменён, текст — скопирован через промежуточный редактор или переработан.`));
    }
    const notes = [...new Map(webStyles.filter(f => f.note).map(f => [f.style.source, `«${f.style.name}»: ${f.note}`])).values()];
    if (notes.length) out.push(...NUM(notes));
  } else out.push(P('Пользовательских стилей веб-происхождения не обнаружено.'));

  out.push(H2('3.3. Гиперссылки и внешние связи'));
  if (res.kind === 'docx') {
    out.push(table([['Показатель', 'Количество', 'Содержание'],
      ['Внешние гиперссылки', fN(L.total), 'Все активные ссылки документа'],
      ['Переадресация Google', `${fN(L.redirect)} из ${fN(L.total)}`, L.total ? `${fmtPct(pct(L.redirect, L.total))} ссылок содержат google.com/url?…&q=` : '—'],
      ['Прямые внешние URL', fN(L.direct), L.redirect && !L.direct ? 'Фактические адреса находятся только внутри параметра q' : '—'],
      ['Метки utm_source нейросетей', fN(byId('links:utm') ? byId('links:utm').value : 0), byId('links:utm') ? byId('links:utm').detail.slice(0, 120) : 'не обнаружены'],
      ['Ссылки на чаты нейросетей', fN(byId('links:chat') ? byId('links:chat').value : 0), byId('links:chat') ? byId('links:chat').detail.slice(0, 120) : 'не обнаружены'],
      ['Адреса в тексте и сносках', fN(L.textUrls), 'URL, набранные текстом'],
      ['Внешние связи объектов', fN((m.externalLinks || []).length), m.chartExternal ? `${fN(m.chartExternal)} диаграмм связаны с внешними Excel-файлами${m.cloud && m.cloud.length ? ' (' + m.cloud.join(', ') + ')' : ''}` : '—'],
    ], [2800, 1500, 5055], { header: true }));
    if (L.domains.length) { out.push(P('Фактические адреса ссылок по доменам (после декодирования переадресации):')); out.push(table([['Домен', 'Ссылок'], ...L.domains.slice(0, 12).map(([d, n]) => [d, fN(n)])], [7000, 2355], { header: true })); }
    ['links:google', 'links:utm', 'links:chat', 'combo:gemini', 'altchunk', 'style:excel'].map(byId).filter(Boolean).forEach(f => finding(f, 3));
  }

  out.push(H2('3.4. Невидимые и нестандартные символы'));
  const cf = gf('chars');
  if (cf.length) out.push(table([['Признак', 'Количество', 'Уровень', 'Пояснение'], ...cf.map(f => [f.title, fN(f.value), lvlCell(f.level), f.note || f.detail])], [2600, 1200, 1200, 4355], { header: true }));
  else out.push(P('Невидимых и нестандартных символов не обнаружено.'));
  if (s.typo) out.push(P(`Справочно: тире «—» и «–» — ${fN(s.typo.emDash)} (${s.typo.emDashPer1000.toFixed(1)} на 1000 слов), многоточий «…» — ${fN(s.typo.ellipsis)}, английских кавычек — ${fN(s.typo.engQuotes)}.`));

  out.push(H2('3.5. Изображения и встроенные объекты'));
  if (res.media.length) out.push(table([['Файл', 'Размер', 'C2PA', 'Упоминания генераторов'], ...res.media.map(im => [im.path, fN(im.size) + ' Б', im.c2pa ? 'есть' : 'нет', im.aiTokens.join(', ') || '—'])], [2800, 1500, 1200, 3855], { header: true }));
  else out.push(P('Изображений в документе нет.'));
  F.filter(f => /^img:/.test(f.id)).forEach(f => finding(f));

  /* ---------- 4 ---------- */
  out.push(H1('4. Распределение технических маркеров, текстологические и содержательные признаки'));
  out.push(H2('4.1. Локализация веб-разметки в содержательных блоках'));
  if (s.localization && s.localization.length) {
    out.push(table([['Локализация', 'Стр.', 'Слов', 'Сохранившийся след (фрагменты текста в веб-разметке)'], ...s.localization.slice(0, 25).map(l => [l.where, l.pages.replace('с. ', ''), fN(l.words), { t: l.sample.slice(0, 260) }])], [3300, 900, 700, 4455], { header: true }));
    const core = s.localization.filter(l => /принцип|инструмент|классифик|систематиз|фактор|угроз|механизм|метод|вывод|модел/i.test(l.where));
    if (core.length) out.push(P(`Такое распределение принципиально важно: маркер охватывает ${core.length} ${core.length === 1 ? 'блок' : 'блоков'}, заявленных как авторские классификации, принципы, факторы или инструменты (${core.slice(0, 4).map(l => l.where.replace(/ — .*/, '')).join(', ')}). Следовательно, технически подтверждённое использование веб-контента затрагивает аналитический и конструктивный аппарат работы, а не только справочные сведения.`));
  } else out.push(P('Веб-разметка к тексту не применена; локализация не проводится.'));

  out.push(H2('4.2. Формульно-аналитический стиль и ритм текста'));
  if (s.lexicon && s.lexicon.length) {
    out.push(table([['Оборот', 'Количество', 'На 1000 слов'], ...s.lexicon.slice(0, 16).map(x => [x.label, fN(x.n), x.per1000.toFixed(2)])], [5355, 2000, 2000], { header: true }));
    [byId('lexicon'), byId('rhythm')].filter(Boolean).forEach(f => finding(f, 3));
  }
  if (s.stylometry) {
    const S = s.stylometry;
    out.push(P(`Стилометрический профиль связного текста (${fN(S.words)} слов, ${fN(S.sentences)} предложений). Группа А — лексика и конструкции, частота которых характерна для ответов LLM: превышено ${S.aHit} из ${S.aTotal}. Группа Б — шаблонность и однообразие (неспецифичные признаки): превышено ${S.bHit} из ${S.bTotal}.`));
    out.push(table([['Гр.', 'Показатель', 'Значение', 'Ориентир', 'Превышение'], ...S.rows.map(x => [x.group === 'A' ? 'А' : 'Б', x.label, x.id === 'mattr' ? x.value.toFixed(2) : x.value.toFixed(2) + (x.id === 'constart' || x.id === 'pstart' ? ' %' : ''), `${x.dir} ${x.thr}`, x.exceeded ? { t: 'да, ×' + x.ratio.toFixed(1), fill: x.group === 'A' ? 'FCE3B0' : 'E4EEF9' } : 'нет'])], [500, 4855, 1300, 1300, 1400], { header: true }));
    out.push(P('Значения групп А и Б, кроме MATTR и долей в процентах, приведены на 1000 слов. Ориентиры получены на калибровочном наборе (тексты DeepSeek и ИИ-агентов, тексты с ручной правкой) и не являются нормативами.'));
    [byId('styloA'), byId('styloB')].filter(Boolean).forEach(f => finding(f, 4));
  }

  const sub = [['4.3. Ошибочные и незавершённые перекрёстные ссылки', ['fields:ref', 'comp:fielderr', 'xref']],
    ['4.4. Предметно-чужеродные фрагменты', ['alien']],
    ['4.5. Шаблонное воспроизведение числовых структур и дословные повторы', ['numdup', 'rep']],
    ['4.6. Необоснованно категоричные выводы', ['categorical']],
    ['4.7. Соответствие содержания и источников', ['citations', 'fn:mism', 'fn:empty', 'fn:files', 'bib', 'price']],
    ['4.8. Языковые и терминологические несогласованности', ['language']]];
  for (const [h, ids] of sub) {
    out.push(H2(h));
    const ff = ids.map(byId).filter(Boolean);
    if (!ff.length) { out.push(P('Признаков не обнаружено.')); continue; }
    ff.forEach(f => finding(f, 6));
  }
  out.push(H2('4.9. Остатки ответов чат-ботов и разметки'));
  const tf = gf('text'); if (tf.length) tf.forEach(f => finding(f, 3)); else out.push(P('Реплик чат-ботов, разметки Markdown/LaTeX и эмодзи не обнаружено.'));
  out.push(H2('4.10. Следы черновой компиляции'));
  const cf2 = gf('comp').filter(f => !['comp:fielderr', 'rep'].includes(f.id)); if (cf2.length) cf2.forEach(f => finding(f, 3)); else out.push(P('Признаков не обнаружено.'));

  /* ---------- 5 ---------- */
  out.push(H1('5. Особенности структуры и редактирования (без вывода об авторстве)'));
  const hrows = [];
  if (m.addins && m.addins.length) hrows.push(['Менеджер библиографии', m.addins.join(', '), 'Наличие программного менеджера ссылок']);
  if (m.chartExternal || m.charts) hrows.push(['Диаграммы и Excel', `${fN(m.charts)} диаграмм Word, ${fN(m.chartExternal)} внешних связей${m.xlsxTargets && m.xlsxTargets.length ? ' (' + m.xlsxTargets.slice(0, 3).join(', ') + ')' : ''}`, 'Наличие отдельного расчётно-графического контура']);
  if (F.some(f => f.id === 'style:excel') && !res.styles.some(x => (x.category === 'webui' || x.category === 'hash') && (x.paras || x.runs))) hrows.push(['Таблицы из Excel', byId('style:excel').detail, 'Вставка данных из Excel; происхождение расчётов неизвестно']);
  hrows.push(['Структура исследования', `${fN(m.captionsTab)} таблиц, ${fN(m.captionsFig)} рисунков, ${fN(m.formulas)} формул, ${fN(m.appendices)} приложений`, 'Наличие структурных элементов без подтверждения автора']);
  if (m.distinctRsids) hrows.push(['rsid', `${fN(m.distinctRsids)} уникальных идентификаторов редактирования`, 'Служебные отметки изменений, не идентифицирующие автора']);
  if (byId('comp:notes')) hrows.push(['Рабочие заметки', `${fN(byId('comp:notes').value)} заметок`, 'Остатки рабочего редактирования']);
  if (m.comments || m.insertions || m.deletions) hrows.push(['Рецензирование', `${fN(m.comments)} комментариев, ${fN((m.insertions || 0) + (m.deletions || 0))} исправлений`, 'Следы комментариев и правок; участники не устанавливаются']);
  out.push(table([['Признак', 'Фактическое содержание', 'Значение'], ...hrows], [2400, 4200, 2755], { header: true }));
  out.push(P('Перечисленные элементы описывают устройство и редактирование файла. Они совместимы как с работой человека, так и с программной сборкой и участием ИИ. Их нельзя использовать для подтверждения самостоятельного авторства или объявлять документ «гибридным» без внешних доказательств.'));


  /* ---------- 6 ---------- */
  out.push(H1('6. Альтернативные объяснения выявленных признаков'));
  const hyp = [
    ['Самостоятельно написанный текст, вставленный через веб-редактор', 'Объясняет веб-стили без машинной генерации содержания', 'Нужны исходные редакции и история создания', 'Не исключено'],
    ['Перенос текста из обычных веб-страниц', 'Может объяснять общие классы HTML, Angular, Tailwind и библиотеки формул', 'Специфичные сигнатуры требуют проверки', 'Не исключено'],
    ['Редактирование с помощью языковой модели', 'Совместимо со стилями чат-интерфейсов и остатками ответов', 'Одна разметка не подтверждает способ создания текста', 'Не установлено'],
  ];
  if (v.mainSource) hyp.push(['Перенос через интерфейс ' + v.mainSource, 'Соответствует части обнаруженных имён стилей', 'Сервис мог использоваться только для просмотра или редактирования', 'Требует проверки']);
  out.push(table([['Объяснение', 'Что согласуется', 'Недостающие данные', 'Статус'], ...hyp], [2300, 2600, 2900, 1555], { header: true }));

  /* ---------- 7 ---------- */
  out.push(H1('7. Сводная оценка и пределы установления'));
  out.push(table([['Обстоятельство', 'Результат', 'Пределы вывода'],
    ['Выявленные маркеры', v.text, v.evidence],
    ['Предполагаемый источник оформления', v.mainSource || 'Не установлен', 'Совпадение классов не идентифицирует автора или модель'],
    ['Охват диагностической разметки', v.scale, 'Не равен доле текста, созданного ИИ'],
    ['Затронутые разделы и таблицы', s.localization && s.localization.length ? s.localization.length + ' зон, в т. ч. ' + s.localization.filter(l => l.inTable).length + ' таблиц' : 'Не установлены', 'Зависит от сохранившейся разметки'],
    ['Авторство и способ создания текста', 'Не устанавливаются по одному DOCX', 'Требуются независимые данные'],
    ['Точная доля текста, созданного ИИ', 'Не определяется', 'Нет валидированного метода для данного файла']], [3000, 4155, 2200], { header: true }));

  /* ---------- 8 ---------- */
  out.push(H1('8. Выводы на поставленные вопросы'));
  const concl = [];
  const strongF = F.filter(f => f.level === 'strong'), medF = F.filter(f => f.level === 'medium');

  concl.push(strongF.length ? 'Обнаружены специфические маркеры (' + strongF.length + '): ' + strongF.map(f => f.title.toLowerCase()).join('; ') + '. Они относятся к файлу и не доказывают машинное авторство.' : medF.length ? 'Обнаружены косвенные маркеры (' + medF.length + '): ' + medF.map(f => f.title.toLowerCase()).join('; ') + '. Они неспецифичны.' : 'Специфических маркеров не выявлено. Отсутствие следов не исключает использования ИИ.');
  if (s.localization && s.localization.length) concl.push('Следы разметки локализованы в ' + s.localization.length + ' зонах. ' + v.scale + '. Это показатель разметки, а не доля машинного текста.');
  if (v.mainSource) concl.push('Часть технических классов сходна с оформлением веб-интерфейса: ' + v.mainSource + '. Сведения об авторстве этим не устанавливаются.');
  const contentIds = ['alien', 'numdup', 'categorical', 'citations', 'language', 'fields:ref'].map(byId).filter(f => f && f.level !== 'info');
  if (contentIds.length) concl.push('Замечания к качеству документа: ' + contentIds.map(f => f.title.toLowerCase() + ' (' + fN(f.value) + ')').join('; ') + '. Они требуют проверки независимо от гипотезы об ИИ.');
  if (res.human.length) concl.push('В файле есть структурные элементы и признаки редактирования; они не подтверждают способ создания содержимого.');
  concl.push('По одному файлу нельзя установить автора, факт генерации, точный процент машинного текста, модель, запросы или последовательность переработки. Отчёт предназначен для предварительной проверки специалистом.');

  out.push(...NUM(concl));

  /* ---------- 9 ---------- */
  out.push(H1('9. Рекомендации'));
  const pagesOf = id => { const f = byId(id); return f ? [...new Set((f.examples || []).map(e => (e.text.match(/^с\. \d+/) || [])[0]).filter(Boolean))].slice(0, 8).join(', ') : ''; };
  out.push(...NUM(['Сохранить исследованный файл без изменений вместе с контрольной суммой; исправления вносить только в копию.',
    s.localization && s.localization.length ? `Проверить происхождение фрагментов с веб-разметкой и корректность ссылок на источники: ${s.localization.slice(0, 6).map(l => l.where.replace(/ — .*/, '') + ' (' + l.pages + ')').join('; ')}.` : null,
    byId('alien') ? `Проверить и адаптировать предметно-чужеродные фрагменты: ${pagesOf('alien')}.` : null,
    byId('citations') ? `Выполнить постраничную сверку с первоисточниками мест, где утверждения идут без ссылки или автор не совпадает с источником: ${pagesOf('citations')}.` : null,
    byId('numdup') ? 'Подтвердить первичными данными (анкетами, расчётными таблицами) совпадающие числовые структуры и независимо воспроизвести расчёты.' : null,
    byId('categorical') ? `Смягчить категоричные формулировки либо подкрепить их статистической моделью: ${pagesOf('categorical')}.` : null,
    byId('fields:ref') || byId('xref') ? 'Обновить поля и исправить перекрёстные ссылки на рисунки и таблицы (выделить всё — F9 в Word).' : null,
    byId('language') ? 'Провести финальную вычитку: исправить опечатки и унифицировать терминологию.' : null,
    'При представлении работы раскрыть характер использования ИИ в соответствии с правилами образовательной или научной организации.']));

  /* ---------- приложения ---------- */
  out.push(H1('Приложение А. Контрольная таблица выявленных признаков'));
  out.push(table([['№', 'Признак', 'Значение', 'Уровень'], ...sorted.map((f, i) => [String(i + 1), f.title, f.detail.slice(0, 400), lvlCell(f.level)])], [500, 3000, 4700, 1155], { header: true }));
  out.push(H1('Приложение Б. Перечень абзацев повышенного контроля'));
  const zone = res.paras.filter(p => p.flags.some(f => ['strong', 'medium', 'weak'].includes(f.level)));
  if (zone.length) {
    out.push(P(`Абзацев с признаками: ${fN(zone.length)}. Приведены первые ${Math.min(zone.length, 200)} в порядке следования.`));
    out.push(table([['Абз.', 'Стр.', 'Место', 'Признаки', 'Начало абзаца'], ...zone.slice(0, 200).map(p => [String(p.i + 1), p.page ? String(p.page) : '', p.table != null ? tableLabel(res, p.table) : p.section.slice(0, 40), [...new Set(p.flags.filter(f => f.level !== 'info').map(f => f.label))].slice(0, 3).join('; '), snippet(p.text, null, 90)])], [650, 650, 1700, 3100, 3255], { header: true }));
  } else out.push(P('Абзацев с признаками нет.'));
  out.push(para(`Отчёт сформирован автоматически программой «Проверка DOCX на признаки ИИ» v${APP_VERSION} ${res.date.toLocaleString('ru-RU')}. Признаки не доказывают авторство или генерацию и требуют независимой экспертной оценки.`, { style: 'Small' }));

  const body = out.join('');
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:footerReference w:type="default" r:id="rIdF"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${W_NS}"><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const z = new JSZip();
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  z.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
  z.file('word/document.xml', docXml);
  z.file('word/styles.xml', stylesXml());
  z.file('word/numbering.xml', numberingXml());
  z.file('word/footer1.xml', footer);
  const iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  z.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Предварительный аудит DOCX — ${X(res.file.name)}</dc:title><dc:creator>Проверка DOCX на признаки ИИ v${APP_VERSION}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`);
  return await z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
