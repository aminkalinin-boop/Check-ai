/* External/manual DOCX highlights: independent reference annotations.
   A highlight is an external decision, NOT ground truth of AI authorship.
   No changes to Check-AI legacy findings, paragraph flags or verdict.
   The full original DOCX stays in the user's browser. */
'use strict';

const REFERENCE_COLORS = Object.freeze({
  purple: { word: ['magenta', 'darkmagenta', 'violet', 'purple', 'pink'], fills: ['7030A0','800080','9932CC','A020F0','C000C0','E4DFEC','F2CEEF','D8B4FE','DDA0DD','FF00FF'] },
  yellow: { word: ['yellow', 'darkyellow'], fills: ['FFFF00','FFF2CC','FFEB9C','FFFF99'] },
  cyan: { word: ['cyan', 'darkcyan', 'blue', 'lightblue'], fills: ['00FFFF','B4C6E7','DDEBF7','BDD7EE'] },
  green: { word: ['green', 'darkgreen', 'brightgreen'], fills: ['00FF00','C6E0B4','E2F0D9','92D050'] }
});
function referenceColor(kind, color, wanted) {
  const normalized = String(color || '').replace(/^#/, '').replace(/\s/g, '').toUpperCase();
  if (!normalized || normalized === 'AUTO' || normalized === 'NONE') return false;
  if (wanted === 'all') return true;
  const sets = REFERENCE_COLORS[wanted] || REFERENCE_COLORS.purple;
  return kind === 'highlight' ? sets.word.includes(normalized.toLowerCase()) : sets.fills.includes(normalized);
}
function referenceRunText(run) {
  let text = '';
  function walk(el) {
    for (const c of el.children || []) {
      if (c.namespaceURI === MC_NS && c.localName === 'Fallback') continue;
      if (c.namespaceURI === W_NS && c.localName === 'p') continue;
      if (c.namespaceURI === W_NS && c.localName === 't') text += c.textContent;
      else if (c.namespaceURI === W_NS && (c.localName === 'tab' || c.localName === 'br' || c.localName === 'cr')) text += ' ';
      else if (c.namespaceURI === W_NS && c.localName === 'noBreakHyphen') text += '‑';
      else if (c.namespaceURI === W_NS && c.localName === 'softHyphen') text += '­';
      else if (c.namespaceURI === W_NS && ['instrText', 'delText'].includes(c.localName)) continue;
      else walk(c);
    }
  }
  walk(run);
  return text;
}
function referenceRuns(paragraph) {
  const result = [];
  // Word allows direct text highlighting, run shading and whole-paragraph or
  // cell shading. These are recorded as external annotations, never AI proof.
  const paraPr = childW(paragraph, 'pPr');
  const paraShade = childW(paraPr, 'shd');
  let cellShade = null, ancestor = paragraph.parentNode;
  while (ancestor && ancestor.localName !== 'body') {
    if (ancestor.namespaceURI === W_NS && ancestor.localName === 'tc') {
      cellShade = childW(childW(ancestor, 'tcPr'), 'shd');
      break;
    }
    ancestor = ancestor.parentNode;
  }
  const inheritedFill = wAttr(paraShade, 'fill') || wAttr(cellShade, 'fill');
  const walk = parent => {
    for (const ch of parent.children || []) {
      if (ch.namespaceURI === MC_NS && ch.localName === 'Fallback') continue;
      if (ch.namespaceURI === W_NS && ch.localName === 'p') continue;
      if (ch.namespaceURI === W_NS && ch.localName === 'r') {
        const t = referenceRunText(ch);
        if (!t) continue;
        const prop = childW(ch, 'rPr');
        const hi = childW(prop, 'highlight');
        const sh = childW(prop, 'shd');
        const color = hi ? wAttr(hi, 'val') : null;
        const fill = (sh ? wAttr(sh, 'fill') : null) || inheritedFill;
        result.push({ text: t, highlight: color, fill });
      } else walk(ch);
    }
  };
  walk(paragraph);
  return result;
}
function referenceAdvice(p, snippet, ownFlags) {
  const sample = snippet.replace(/\s+/g, ' ').trim();
  if (p.toc || p.heading || /^(?:ВВЕДЕНИЕ|ЗАКЛЮЧЕНИЕ|ГЛАВА|СПИСОК ЛИТЕРАТУРЫ)$/i.test(sample)) {
    return { category: 'Служебная структура',
      problem: 'Отмечен заголовок или элемент оглавления. Сам по себе он не содержит достаточного материала для определения происхождения текста.',
      action: 'Проверьте разметку и границы внешнего фрагмента по оригинальному отчёту. Заголовок сохраняйте; соседний авторский текст рассматривайте отдельно.' };
  }
  if (p.bib) return { category: 'Библиографическая запись',
    problem: 'Выделена стандартизированная библиографическая запись, а не самостоятельное научное рассуждение.',
    action: 'Проверьте по первоисточнику автора, заглавие, год, страницы и DOI; не квалифицируйте запись как ИИ по единообразию оформления.' };
  if (/10\.\d{4,9}\//i.test(sample) || /\[\s*\d+(?:,\s*\d+)*\s*\]/.test(sample))
    return { category: 'Ссылочное утверждение',
      problem: 'Отмеченный фрагмент содержит библиографическую отсылку, достоверность которой не устанавливается по самому тексту.',
      action: 'Найдите первоисточник и сверьте формулировку тезиса, точную страницу и корректность ссылки. Несуществование источника нужно подтверждать отдельно.' };
  if (p.inTable) return { category: 'Табличный текст',
    problem: 'Отмечен текст в таблице; без заголовков граф и исходных расчётов его интерпретация ограничена.',
    action: 'Сверьте строку с заголовками столбцов, единицами измерения, периодом и исходными таблицами расчётов; проверьте соответствие выводу в основном тексте.' };
  if (/\d+(?:[.,]\d+)?\s*(?:%|млн|тыс|год|лет|дн|ед\.|руб)/i.test(sample))
    return { category: 'Числовое обобщение',
      problem: 'Отмечено количественное утверждение. Без данных нельзя проверить вычисление и переход от наблюдения к объяснению.',
      action: 'Проверьте числитель и знаменатель, год, размер выборки, единицы и исходную таблицу; отделите корреляцию от причинного утверждения.' };
  if (/(?:таким образом|следовательно|в целом|это свидетельствует|можно сделать вывод)/iu.test(sample))
    return { category: 'Заключительная конструкция',
      problem: 'Выделен переход от наблюдений к обобщению. Академическая итоговая формула неспецифична для машинного авторства.',
      action: 'Найдите конкретные результаты предыдущих абзацев, проверьте, что заключение вытекает из них и не повторяет их без нового содержания.' };
  if (/(?:ключев\p{L}*|комплексн\p{L}*|значим\p{L}*|эффективн\p{L}*|обеспечива\p{L}*)/iu.test(sample))
    return { category: 'Оценочная научная формулировка',
      problem: 'Отмечено оценочное или обобщающее выражение, возможное и в самостоятельно написанном научном тексте.',
      action: 'Определите конкретный измеряемый показатель или проверяемое основание оценки. Укажите источник и границы интерпретации, если это требуется.' };
  if (ownFlags.length) return { category: 'Совпадение с локальными признаками',
    problem: 'Отмеченный внешний фрагмент находится в абзаце, где Check-AI независимо обнаружил признаки. Области могут не совпадать полностью.',
    action: 'Сравните точное выделение с локализованными признаками Check-AI и проверьте, относятся ли они к тем же словам. Вывод о происхождении не делается автоматически.' };
  return { category: 'Внешняя отметка без локального объяснения',
    problem: 'Фрагмент выделен во внешнем отчёте, но Check-AI не нашёл самостоятельного локального признака в данном абзаце.',
    action: 'Сопоставьте выделение с соседними абзацами, исследовательским вопросом, первичными материалами и научным жанром. Отсутствие локального признака фиксируйте как расхождение детекторов.' };
}
function collectReferenceHighlights(res, doc, mode = 'purple') {
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0] || doc.documentElement;
  const ps = [...body.getElementsByTagNameNS(W_NS, 'p')]
    .filter(p => !hasAncestor(p, MC_NS, 'Fallback', body));
  const fragments = [], colors = {}, hits = new Set();
  let totalHighlighted = 0, totalChars = 0;
  ps.forEach((p, i) => {
    const info = res.paras[i];
    if (!info) return;
    const runs = referenceRuns(p);
    let offset = 0, group = null;
    function flush() {
      if (!group || !group.text.trim()) { group = null; return; }
      const raw = group.text;
      const exact = raw.trim();
      const local = (info.flags || []).filter(f => ['strong', 'medium', 'weak', 'info'].includes(f.level))
        .map(f => ({ level: f.level, label: f.label, type: f.type }));
      const guidance = referenceAdvice(info, exact, local);
      fragments.push({
        id: fragments.length + 1, para: i, paragraph: i + 1,
        page: info.page || null, section: info.section || 'Без раздела',
        inTable: !!info.inTable, toc: !!info.toc, heading: !!info.heading,
        text: exact, start: group.start, end: group.end, color: group.color,
        contextualBefore: info.text.slice(Math.max(0, group.start - 115), group.start).trim(),
        contextualAfter: info.text.slice(group.end, group.end + 115).trim(),
        wholeParagraphWords: info.words, flags: local.slice(0, 12),
        category: guidance.category, problem: guidance.problem, action: guidance.action
      });
      hits.add(i);
      totalHighlighted += exact.length;
      group = null;
    }
    for (const run of runs) {
      const color = run.highlight || run.fill || '';
      if (color) colors[color] = (colors[color] || 0) + run.text.length;
      const matched = (run.highlight && referenceColor('highlight', run.highlight, mode)) ||
        (run.fill && referenceColor('fill', run.fill, mode));
      if (matched) {
        if (!group || group.end !== offset || group.color !== color) { flush(); group = { start: offset, end: offset, text: '', color }; }
        group.text += run.text;
        group.end += run.text.length;
      } else flush();
      offset += run.text.length;
    }
    flush();
    totalChars += offset;
  });
  let blocks = 0, lastPara = -2;
  for (const para of [...hits].sort((a,b) => a-b)) { if (para !== lastPara + 1) blocks++; lastPara = para; }
  return {
    enabled: true, mode, fragments,
    markedParagraphs: hits.size, contiguousAreas: blocks,
    selectedChars: totalHighlighted, totalTextChars: totalChars,
    approxShare: totalChars ? +(100 * totalHighlighted / totalChars).toFixed(2) : 0,
    availableColors: Object.entries(colors).sort((a,b) => b[1] - a[1])
      .map(([color, chars]) => ({ color, chars })),
    notice: 'Это предварительная разметка стороннего детектора. Доля символов рассчитана по Word и не соответствует проценту «ИИ» во внешнем отчёте. Она не является доказанным авторством.'
  };
}
