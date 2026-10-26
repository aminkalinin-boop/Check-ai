/* Check-AI: descriptive discourse and academic-context audit (video 06).
   The existing detection tiers, scoring thresholds and Word report remain intact.
   These signals are informational and are not reliable authorship evidence. */
'use strict';
function discourseAuditChecks(res) {
  const ps = (res.paras || []).filter(p => p && !p.toc && !p.bib && !p.inTable && !p.inBox && !p.heading && p.words >= 5);
  const totalWords = ps.reduce((n, p) => n + p.words, 0);
  const examples = [];
  const contrastPatterns = [
    /не\s+только[^.!?;\n]{1,170}?\s+но\s+и/giu,
    /не\s+столько[^.!?;\n]{1,170}?\s+сколько/giu,
    /не\s+просто[^.!?;\n]{1,170}?\s+а\s+/giu,
    /хотя[^.!?;\n]{1,170}?(?:однако|тем\s+не\s+менее)/giu,
    /дело\s+не\s+в[^.!?;\n]{1,170}?\s+а\s+в/giu,
    /речь\s+ид[её]т\s+не\s+о[^.!?;\n]{1,170}?\s+а\s+о/giu
  ];
  let contrastCount = 0;
  const contrastBySection = {};
  for (const p of ps) {
    const candidates = [];
    for (const re of contrastPatterns) {
      re.lastIndex = 0;
      for (const m of p.text.matchAll(re)) candidates.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    candidates.sort((a, b) => a.start - b.start || b.end - a.end);
    let lastEnd = -1;
    for (const m of candidates) {
      if (m.start < lastEnd) continue; // avoid counting overlapping patterns twice
      lastEnd = m.end;
      contrastCount++;
      const section = p.section || 'Без раздела';
      contrastBySection[section] = (contrastBySection[section] || 0) + 1;
      if (examples.length < 6) examples.push({ para: p.i, text: '«' + m.text.slice(0, 155) + '»' });
    }
  }
  const contrastDensity = totalWords ? contrastCount * 1000 / totalWords : 0;
  if (totalWords >= 1200) addFinding(res, {
    id: 'discourse:contrast', group: 'style', title: 'Парные противопоставительные конструкции: частотный профиль',
    level: 'info', value: contrastCount,
    detail: 'Конструкций: ' + contrastCount + ' (' + contrastDensity.toFixed(2) +
      ' на 1000 слов), объём ' + totalWords + ' слов. По разделам: ' +
      (Object.entries(contrastBySection).slice(0, 5).map(([s, n]) => s.slice(0, 45) + ' — ' + n).join('; ') || 'не обнаружены') + '.',
    note: 'И наличие, и отсутствие таких оборотов допустимы в авторском академическом тексте. Численные нормы и связь с негативными промптами не проверены на репрезентативном корпусе. Признак не подтверждает создание или сокрытие текста ИИ.',
    examples
  });

  const stop = new Set([
    'который','которые','которая','которого','которых','этого','этому','также','однако','таким',
    'образом','данные','такие','таким','этот','может','могут','между','более','менее',
    'поскольку','отмечено','исследовании','исследования','следует','необходимо',
    'которой','такая','показано','сделать','результаты','результатов','было','были',
    'является','являются','имеется','части','данной','сведения','проведения'
  ]);
  const terms = text => new Set((text.toLowerCase().replace(/ё/gu, 'е').match(/[\p{L}]{4,}/gu) || [])
    .filter(w => !stop.has(w)));
  const tailExamples = [];
  let eligibleTails = 0, repeatedTails = 0;
  for (const p of ps) {
    const sent = p.text.split(/(?<=[.!?…])\s+(?=[А-ЯЁA-Z«“])/u).map(x => x.trim()).filter(Boolean);
    if (sent.length < 3 || p.words < 25) continue;
    const first = sent.slice(0, -1).join(' '), tail = sent[sent.length - 1];
    if (tail.length < 25) continue;
    eligibleTails++;
    const a = terms(first), b = terms(tail);
    if (a.size < 5 || b.size < 4) continue;
    let shared = 0;
    for (const w of b) if (a.has(w)) shared++;
    const overlap = shared / b.size;
    if (shared >= 4 && overlap >= 0.65) {
      repeatedTails++;
      if (tailExamples.length < 6) tailExamples.push({
        para: p.i, text: 'Лексическое пересечение ' + Math.round(overlap * 100) +
          '%. Последнее предложение: «' + tail.slice(0, 175) + '»'
      });
    }
  }
  if (repeatedTails >= 2) addFinding(res, {
    id: 'discourse:tail', group: 'content', title: 'Повторение терминов в заключительных предложениях абзацев',
    level: 'info', value: repeatedTails,
    detail: 'Из ' + eligibleTails + ' подходящих абзацев ' + repeatedTails +
      ' имеют значительное пересечение ключевых слов в конце и начале/середине абзаца.',
    note: 'Это поверхностная лексическая эвристика, а не ROUGE-L, BERTScore и не семантический анализ. Выводы и резюме в конце абзаца — нормальный приём научного письма. Не доказывает машинного авторства.',
    examples: tailExamples
  });

  // Narrowly scoped scientific terminology comparison: exact phrase pairs,
  // not a claim that one is always invalid, and not generalized to authorship.
  const termPairs = [
    ['человеческий капитал', 'людской капитал', /человеческ[\p{L}]*\s+капитал[\p{L}]*/giu, /людск[\p{L}]*\s+капитал[\p{L}]*/giu],
    ['методология исследования', 'методика исследования', /методологи[\p{L}]*\s+исследовани[\p{L}]*/giu, /методик[\p{L}]*\s+исследовани[\p{L}]*/giu],
    ['компетенция', 'компетентность', /компетенци[\p{L}]*/giu, /компетентност[\p{L}]*/giu]
  ];
  const termsToReview = [];
  for (const [first, second, reA, reB] of termPairs) {
    const a = [], b = [];
    for (const p of ps) {
      if (reA.test(p.text)) a.push(p.i);
      reA.lastIndex = 0;
      if (reB.test(p.text)) b.push(p.i);
      reB.lastIndex = 0;
    }
    if (a.length && b.length) termsToReview.push({ first, second, a, b });
  }
  if (termsToReview.length) addFinding(res, {
    id: 'discourse:terms', group: 'content', title: 'Близкие научные термины: проверить согласованность определений',
    level: 'info', value: termsToReview.length,
    detail: 'В документе обнаружены пары близких терминов: ' +
      termsToReview.map(x => '«' + x.first + '» и «' + x.second + '»').join('; ') + '.',
    note: 'Пара терминов не обязательно ошибочна: понятия могут осознанно различаться. Для проверки нужны определения и научный контекст. Это не подтверждает рерайт ИИ.',
    examples: termsToReview.flatMap(x => [
      { para: x.a[0], text: 'Употребление «' + x.first + '»' },
      { para: x.b[0], text: 'Употребление «' + x.second + '»' }
    ]).slice(0, 6)
  });

  const standardRe = /(?<![\p{L}\p{N}])(?:ЦУР|SDG)[-\s№]*(?:\d{1,2})?\b|(?:Цел[иь]\s+устойчивого\s+развития)|(?<![\p{L}\p{N}])ГОСТ(?:\s+[Рr])?\s*[\d][\d.\-–]*|(?<![\p{L}\p{N}])ISO\s*\d{3,6}\b|(?<![\p{L}\p{N}])ФГОС(?![\p{L}\p{N}])/giu;
  let standardCount = 0;
  const standardsExamples = [];
  for (const p of ps) {
    const found = [...p.text.matchAll(standardRe)];
    standardCount += found.length;
    if (found.length && standardsExamples.length < 5) standardsExamples.push({
      para: p.i, text: found.slice(0, 4).map(x => x[0]).join(', ')
    });
  }
  if (standardCount >= 3) addFinding(res, {
    id: 'discourse:standards', group: 'style',
    title: 'Нормативные и стандартизированные обозначения: контекст для стилометрии',
    level: 'info', value: standardCount,
    detail: 'Упоминаний ГОСТ, ISO, ФГОС или целей устойчивого развития: ' + standardCount + '.',
    note: 'Устойчивые нормативные названия естественны для научной работы и требуют осторожности при интерпретации шаблонного стиля. Мы не исключаем их автоматически из исходного скоринга, пока такое исключение не прошло независимую проверку.',
    examples: standardsExamples
  });

  res.stats.discourseAudit = {
    bodyWords: totalWords, contrastCount, contrastPer1000: +contrastDensity.toFixed(2),
    contrastBySection, eligibleTails, repeatedTails, pairsOfTerms: termsToReview.length,
    standardsMentions: standardCount
  };
}
