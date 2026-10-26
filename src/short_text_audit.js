/* Short academic text profile — honest exploratory diagnostics.
   Full human/LLM stylometry remains restricted to >=600 words.
   For shorter samples we expose repeatable, paragraph-based observations,
   never invent calibrated AI probabilities or new strong signals. */
'use strict';
function shortTextAudit(res, body) {
  const words = body.reduce((n, p) => n + p.words, 0);
  if (words < 150 || words >= 600) return null;
  const blocks = body.filter(p => p.words >= 20);
  const content = blocks.map(p => p.text).join(' ');
  // Narrowly anchored language patterns; this is NOT a machine-specific watermark.
  const hedges = /(?<!\p{L})(?:неизвестн|отсутству|недостаточн|невозможн|не\s+установлен|не\s+позволя|не\s+подтвержден|не\s+доказан|не\s+представлен|не\s+задан|не\s+раскрыв|нельзя\s+определить)\p{L}*(?!\p{L})/giu;
  const method = /(?<!\p{L})(?:метод(?:ик|ическ)?|исследовательск|расч[её]т|сопоставлени|показател|интерпретаци|выборк|инвестиц|анализ)\p{L}*(?!\p{L})/giu;
  const quantified = /(?<!\d)\d+(?:[.,]\d+)?\s*(?:%|процент|млн|тыс|дн[яей]|года?|лет)(?!\p{L})/giu;
  const wordTokens = (t) => (t.toLowerCase().match(/\p{L}{5,}/gu) || []);
  const paraProfiles = blocks.map(p => {
    const words = wordTokens(p.text);
    const repeated = words.filter(w => /(?:анализ|данн|результ|показател|инвестиц|исследован)/iu.test(w));
    const methodMatches = (p.text.match(method) || []).length;
    const constraints = (p.text.match(hedges) || []).length;
    const numbers = (p.text.match(quantified) || []).length;
    return { p, methodMatches, constraints, numbers, repeated: repeated.length };
  });
  const count = (re) => (content.match(re) || []).length;
  const totalHedges = count(hedges), totalMethod = count(method), totalNumbers = count(quantified);
  // Distinct sequences are reported; avoid treating a known academic template as authorship.
  const limitedParas = paraProfiles.filter(x => x.constraints > 0).length;
  const methodParas = paraProfiles.filter(x => x.methodMatches >= 2).length;
  const shortMarkers = { words, paragraphs: blocks.length, methodologicalParagraphs: methodParas,
    caveatParagraphs: limitedParas, caveatPhrases: totalHedges,
    quantitativePhrases: totalNumbers, methodTerms: totalMethod,
    minForFullStylometry: 600,
    diagnosticClass: 'descriptive-only' };
  res.stats.shortTextProfile = shortMarkers;

  // Each finding describes exactly why it appeared. For short academic
  // texts, aggressive weighting of these commonplace patterns is unsound.
  if (blocks.length >= 3 && limitedParas >= 3 && methodParas >= 2) {
    addFinding(res, {
      id: 'short:argument', group: 'style', level: 'info', value: limitedParas,
      title: 'Краткий академический текст: повторяющаяся структура обоснования и ограничений',
      detail: 'В ' + limitedParas + ' из ' + blocks.length + ' абзацев присутствуют оговорки о пределах вывода; ' +
        methodParas + ' абзацев содержат несколько методических терминов. ' +
        'Упоминаний условий/ограничений: ' + totalHedges + '.',
      note: 'Композиция «метод → показатели → ограничения» встречается и в самостоятельно написанных статьях. ' +
        'Этот показатель пригоден для сравнения контролируемых текстов, но сам по себе не доказывает ИИ.',
      examples: paraProfiles.filter(x => x.constraints > 0).slice(0, 4)
        .map(x => ({ para: x.p.i, text: x.p.text.slice(0, 160) }))
    });
    // Show specific source paragraphs in the existing annotated copy with
    // clearly labeled INFORMATIONAL context; no punitive AI-risk flag.
    paraProfiles.filter(x => x.constraints >= 2 && x.methodMatches >= 2).slice(0, 6)
      .forEach(x => x.p.flags.push({
        type: 'short', key: 'argument', level: 'info',
        label: 'Академические оговорки и методические формулы (справочно)',
        observation: 'В абзаце ' + x.constraints + ' оговорки и ' + x.methodMatches + ' методических выражений.',
        action: 'Сверьте каждую оговорку с конкретным показателем, исходными данными и недоказанными причинными переходами; удалять корректные ограничения ради снижения ИИ-метки нельзя.'
      }));
  }
  return shortMarkers;
}
