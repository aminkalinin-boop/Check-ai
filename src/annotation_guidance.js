/* Independent per-paragraph editorial guidance. These are instructions for
   verifying the scientific content, NOT recipes to spoof vendor detectors. */
'use strict';
function annotationAdvice(flag, para) {
  const label = String(flag.label || 'Признак требует проверки');
  const observed = flag.observation || label;
  const key = String(flag.key || '').toLowerCase();
  const type = String(flag.type || '').toLowerCase();
  const rules = [
    [/^(style|rstyle)$/, 'Проверьте происхождение форматирования: сравните стиль абзаца со стилями исходного файла. Если оформление случайно перенесено из веб-интерфейса, примените стиль документа, не меняя содержание.'],
    [/^(md|emoji|phrase)$/, 'Определите, относится ли обнаруженный текст к содержанию исследования или к служебной реплике/разметке. Удаляйте только посторонние элементы; утверждения сверяйте с первоисточниками.'],
    [/^(char|unicode)$/, 'Проверьте обнаруженную кодовую точку в указанном слове и её назначение. Исправьте случайные скрытые вставки в рабочей копии, сохранив значимые символы формул и единиц измерения.'],
    [/^(stylo|short)$/, 'Для каждого обобщения укажите конкретный исследовательский объект, показатель, период и подтверждающий источник. Проверьте причинный переход и оправданность повторных оговорок; корректные научные ограничения сохраните.'],
    [/^(content|lang)$/, 'Сверьте термин с определением в работе и научным источником, а количественное либо категоричное утверждение — с исходной таблицей и расчётом. Уточните область применимости вывода.'],
    [/^(rep|comp)$/, 'Сравните отмеченный фрагмент с указанными соседними абзацами. Устраните смысловой дубль, если он не несёт самостоятельного аргумента; сохраните значимые данные и ссылки.'],
    [/^(src)$/, 'Откройте названный первоисточник, проверьте автора, год, страницу и соответствие тезису. Исправьте неверный адрес или номер; при недоступности источника отметьте необходимость ручной проверки.']
  ];
  let action = flag.action || null;
  if (!action) {
    const match = rules.find(([pattern]) => pattern.test(type));
    action = match ? match[1] : (key.includes('bib') || key.includes('cite')
      ? 'Сверьте автора, год, библиографическую запись, цитату и номер страницы по самому источнику. Недоступная ссылка не равна вымышленной.'
      : 'Проверьте отмеченное утверждение по первичному материалу и его связи с соседними абзацами. Запишите исходный фрагмент, произведённую редакционную правку и её научное обоснование.');
  }
  const d = scientificParagraphDiagnosis(para?.text || '', '', para || {});
  const matching = d.signals.filter(x => x.id !== 'not-identified');
  const primary = bestScientificSignal(d);
  // Technical flags remain technical. Linguistic flags can be explained by
  // local, measured constructions instead of repeating the entire paragraph.
  const linguistic = ['stylo','short','content','lang','rep','comp'].includes(type);
  const exact = linguistic && matching.length ? primary : null;
  const kb = exact ? knowledgeSourceEntry(exact.id) : null;
  const kbNote = kb ? ' База знаний: ' + kb.title + '; статус ' + kb.evidence_status + '; источник(и): ' + kb.source_ids.join(', ') + '. ' + kb.interpretation : '';
  const authorNotes=authorGuidelineMatches(para?.text||'',3).map(m=>({
    title:m.title,quote:m.quote,section:m.section,action:m.action,
    explanation:'Индивидуальное редакционное правило, не свидетельство ИИ-авторства.'
  }));
  return {
    authorNotes,
    issue: exact ? exact.title + '. ' + exact.evidence : observed,
    action: exact ? exact.action : action,
    reason: (exact ? exact.interpretation : 'Собственное правило Check-AI отметило: «' + label + '». Этого недостаточно для установления авторства.') + kbNote,
    observation: exact ? exact.evidence : (flag.observation || label),
    metrics: d.metric,
    signalId: exact?.id || null,
    disclaimer: 'Замечание описывает наблюдаемый признак, а не доказательство ИИ-авторства; цель — проверяемая научная редактура.'
  };
}
