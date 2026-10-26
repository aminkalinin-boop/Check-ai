/* ===================================================================
   Дополнительный академический аудит Check-AI: справочные проверки.
   Не меняет оригинальную модель оценки, стили, выводы и экспорт DOCX.
   =================================================================== */
'use strict';

function academicAuditChecks(res) {
  const ps = (res.paras || []).filter(p => p && p.words > 0 && !p.toc && !p.bib && !p.inBox);
  const body = ps.filter(p => !p.inTable && !p.heading);
  const table = ps.filter(p => p.inTable);
  const sumWords = a => a.reduce((n, p) => n + p.words, 0);
  const bodyWords = sumWords(body), tableWords = sumWords(table);
  const denominator = bodyWords + tableWords;
  const tableShare = denominator ? 100 * tableWords / denominator : 0;
  const summary = {
    bodyWords, tableWords, tableParagraphs: table.length,
    tableShare: Number(tableShare.toFixed(1)), totalTables: (res.tables || []).length,
    mixedScriptWords: 0, invisibleInsideWord: 0,
    empiricalParagraphs: 0, englishAcademicConnectors: 0,
    paragraphsInEnglish: 0, sectionProfiles: [], uniformParagraphBlocks: null
  };
  res.stats.academicAudit = summary;

  /* Table content is already read by the original DOCX parser. The goal is to
     show its coverage, not to reclassify or presume concealment. */
  if (tableWords >= 80) {
    addFinding(res, {
      id: 'academic:tables', group: 'content',
      title: 'Полнота охвата текста таблиц (справочно)', level: 'info',
      value: summary.tableShare,
      detail: 'Извлечено ' + tableWords + ' слов в ' + table.length +
        ' абзацах/ячейках таблиц и ' + bodyWords +
        ' слов вне таблиц. Доля табличного текста: ' + summary.tableShare.toFixed(1) +
        '%. Обнаружено таблиц Word: ' + summary.totalTables + '.',
      note: 'Исходный парсер Check-AI извлекает текст ячеек DOCX. Наличие большого объёма текста в таблицах само по себе не означает сокрытия генерации или плагиата. Следует сопоставлять расчёты и выводы с текстом работы.'
    });
  }

  /* Inside-word Latin/Cyrillic substitution is mechanically testable, unlike
     the supposed attribution to a specific chat model. Keep raw bytes intact. */
  const mixed = [];
  const invis = [];
  const wordRe = /[\p{Script=Cyrillic}\p{Script=Latin}]{4,}/gu;
  const withinRe = /[\p{Script=Cyrillic}\p{Script=Latin}][\u200B-\u200D\u2060\uFEFF]+[\p{Script=Cyrillic}\p{Script=Latin}]/gu;
  for (const p of ps) {
    for (const word of p.text.match(wordRe) || []) {
      if (/[\p{Script=Cyrillic}]/u.test(word) && /[\p{Script=Latin}]/u.test(word)) {
        summary.mixedScriptWords++;
        if (mixed.length < 6) mixed.push({ para: p.i, text: '«' + word.slice(0, 75) + '» — ' + (p.section || 'фрагмент') });
      }
    }
    for (const word of p.text.match(withinRe) || []) {
      summary.invisibleInsideWord++;
      if (invis.length < 6) invis.push({ para: p.i, text: '«' + word.replace(/[\u200B-\u200D\u2060\uFEFF]/gu, '⟦невидимый знак⟧').slice(0, 100) + '»' });
    }
  }
  if (summary.mixedScriptWords) addFinding(res, {
    id: 'academic:mixed-script', group: 'chars',
    title: 'Латинские и кириллические буквы внутри одного слова',
    level: 'info', value: summary.mixedScriptWords,
    detail: 'Найдено слов со смешением алфавитов: ' + summary.mixedScriptWords +
      '. Возможны ошибки вставки, раскладки или визуально похожие буквы.',
    note: 'Это техническая неоднородность, а не доказательство обфускации или работы ИИ. Встречается и в обозначениях, торговых названиях и вручную набранном тексте. Оригинал не исправляется.',
    examples: mixed
  });
  if (summary.invisibleInsideWord) addFinding(res, {
    id: 'academic:inside-word', group: 'chars',
    title: 'Невидимые разделители внутри слов (локализация)',
    level: 'info', value: summary.invisibleInsideWord,
    detail: 'Невидимых разделителей между буквами: ' + summary.invisibleInsideWord +
      '. Основная проверка невидимых символов уже присутствует в анализаторе.',
    note: 'Это дополнительная локализация для ручной проверки. Автоматическая очистка исходного файла не производится.',
    examples: invis
  });

  /* Empirical reporting is a genre convention, not an independent LLM cue.
     No changes to the existing stylometry scores or thresholds. */
  const empiricalRe = /(?:\bN\s*=\s*\d{1,6}\b|\b(?:SD|SE|CI|OR|RR)\s*[=:]\s*\d|(?:p|р)\s*[<>=]\s*0[.,]\d+|(?:выборк|респондент|доверительн\w*\s+интервал|средн\w*\s+значени|критери[йя]|оддс)|(?:sample\s+size|confidence\s+interval|standard\s+deviation|odds\s+ratio))/iu;
  const empirical = body.filter(p => empiricalRe.test(p.text));
  summary.empiricalParagraphs = empirical.length;
  if (empirical.length >= 2) addFinding(res, {
    id: 'academic:empirical', group: 'style',
    title: 'Стандартизированные фрагменты эмпирического исследования',
    level: 'info', value: empirical.length,
    detail: 'Найдено абзацев с формулами, статистическими обозначениями или лексикой эмпирических методов: ' + empirical.length + '.',
    note: 'Методология, описание выборок, p-values, OR, SD и доверительных интервалов обычно оформляются по устойчивым научным шаблонам. Лексическая гладкость этих фрагментов не должна рассматриваться сама по себе как доказательство генерации. Исходные пороги не изменены.',
    examples: empirical.slice(0, 5).map(p => ({ para: p.i, text: p.text.slice(0, 150) }))
  });

  /* Language-matched counts only; familiar English connectors are NOT
     fingerprints of GPT, nor proof of translation. */
  const english = body.filter(p => {
    const en = (p.text.match(/[A-Za-z]/g) || []).length;
    const ru = (p.text.match(/[А-Яа-яЁё]/g) || []).length;
    return en >= 35 && en > ru * 3;
  });
  summary.paragraphsInEnglish = english.length;
  const englishIntro = /(?:^|[.!?]\s+)(?:Importantly|Notably|Crucially|In this context|Overall|First|Second|Third|Finally)\s*[,.:]?/gi;
  for (const p of english) summary.englishAcademicConnectors += (p.text.match(englishIntro) || []).length;
  if (english.length >= 3 && summary.englishAcademicConnectors >= 4) addFinding(res, {
    id: 'academic:english', group: 'style',
    title: 'Стандартные связки англоязычного научного текста',
    level: 'info', value: summary.englishAcademicConnectors,
    detail: 'В ' + english.length + ' преимущественно англоязычных абзацах обнаружено вводных академических связок: ' + summary.englishAcademicConnectors + '.',
    note: 'Такие связки типичны для написанных человеком и переведённых научных статей. Без параллельного оригинала и контрольного корпуса способ перевода определить нельзя.'
  });

  /* Compare local portions instead of one whole-document average.
     Differences can reflect authors, disciplines, quotes, sections or editing. */
  const usable = body.filter(p => p.words >= 8);
  let group = [], count = 0;
  const segments = [];
  function finish() {
    if (count < 170) { group = []; count = 0; return; }
    const text = group.map(p => p.text).join(' ');
    const all = (text.toLowerCase().match(/\p{L}+/gu) || []);
    const sentences = text.split(/(?<=[.!?])\s+(?=[\p{Lu}«])/u).filter(x => x.trim());
    const lengths = sentences.map(x => (x.match(/\p{L}+/gu) || []).length).filter(x => x >= 3);
    const mean = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
    const distinct = all.length ? new Set(all).size / all.length : 0;
    segments.push({
      start: group[0].i + 1, end: group[group.length - 1].i + 1,
      words: count, meanSentenceWords: +mean.toFixed(1), lexicalVariety: +distinct.toFixed(3)
    });
    group = []; count = 0;
  }
  for (const p of usable) {
    group.push(p); count += p.words;
    if (count >= 420) finish();
  }
  if (count >= 170) finish();
  summary.sectionProfiles = segments.slice(0, 80);
  if (segments.length >= 4) addFinding(res, {
    id: 'academic:segments', group: 'style', title: 'Локальные профили больших фрагментов',
    level: 'info', value: segments.length,
    detail: 'Документ разбит на ' + segments.length +
      ' последовательных текстовых сегментов; для каждого посчитаны средняя длина предложения и лексическое разнообразие. Результаты доступны для сравнительного анализа.',
    note: 'Ровный или изменчивый профиль не устанавливает «когнитивную усталость», авторство либо применение Deep Research. Метрики чувствительны к разделам, цитатам, языку и научному жанру.'
  });

  /* Repetitive 2–3 sentence paragraph structure is worth displaying in
     controlled circumstances, but never attributed to a prompt. */
  const regular = usable.filter(p => p.words >= 20);
  if (regular.length >= 16) {
    let hits = 0;
    for (const p of regular) {
      const n = p.text.split(/[.!?]+(?=\s|$)/u).filter(t => t.trim()).length;
      if (n === 2 || n === 3) hits++;
    }
    const share = hits / regular.length;
    summary.uniformParagraphBlocks = { examined: regular.length, twoOrThree: hits, share: +share.toFixed(3) };
    if (share >= 0.9) addFinding(res, {
      id: 'academic:block-uniformity', group: 'style',
      title: 'Единообразное число предложений в абзацах',
      level: 'info', value: hits,
      detail: 'Из ' + regular.length + ' связных абзацев ' + hits + ' содержат по 2–3 предложения.',
      note: 'Повторяемость может отражать требования жанра, шаблон, редактирование или форматирование. Она не определяет наличие промпта и не подтверждает генерацию.'
    });
  }
}
