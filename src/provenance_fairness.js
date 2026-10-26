/* Check-AI: provenance classes and fairness context (video 07).
   IMPORTANT: Neither document parsing nor lexical analysis can verify
   provider-keyed statistical text watermarks. NO invented confidence scores,
   calibrated posterior probabilities or claims of the writer's identity. */
'use strict';

function provenanceFairnessChecks(res) {
  const findings = res.findings || [];
  const paragraphs = (res.paras || []).filter(p => p && p.words > 0 && !p.toc && !p.bib && !p.inBox);
  const visibleIds = new Set([
    'typo:q', 'emoji', 'md:bold', 'md:hdr', 'md:hr', 'md:code',
    'md:tbl', 'md:link', 'md:bullet'
  ]);
  const unicodeIds = new Set([
    'char:zw', 'char:tag', 'char:vs', 'char:bidi', 'char:soft', 'char:sp',
    'char:nbsp', 'char:pua', 'academic:mixed-script', 'academic:inside-word'
  ]);
  const visible = findings.filter(f => visibleIds.has(f.id));
  const unicode = findings.filter(f => unicodeIds.has(f.id));
  const stylistic = findings.filter(f =>
    f.group === 'style' || f.id === 'lexicon' || f.id === 'categorical'
  );

  // Labels describe categories of observations, not their authorship value.
  const classes = [
    { id: 'visible', title: 'Визуальные и форматные особенности', count: visible.length,
      status: visible.length ? 'Есть наблюдения' : 'Не зафиксированы перечисленные маркеры',
      detail: 'Тире, кавычки, списки и Markdown могут появиться в обычной редакторской работе.' },
    { id: 'unicode', title: 'Скрытые символы и техническая разметка', count: unicode.length,
      status: unicode.length ? 'Есть наблюдения' : 'Не зафиксированы перечисленные маркеры',
      detail: 'Символы Unicode и HTML-стили не являются статистическими текстовыми водяными знаками моделей.' },
    { id: 'stylometry', title: 'Лексика и стилометрия', count: stylistic.length,
      status: stylistic.length ? 'Есть показатели' : 'Нет выделенных показателей',
      detail: 'Зависит от языка, научного жанра, дисциплины, редакторской обработки и корпуса сравнения.' },
    { id: 'watermark', title: 'Статистический водяной знак модели', count: null,
      status: 'Не проверялся — нет доступа к ключам и верификатору провайдера',
      detail: 'Отсутствие результата означает «не проверено», а не «водяного знака нет».' }
  ];
  const latinBody = paragraphs.filter(p => !p.inTable && !p.heading);
  let latin = 0, cyrillic = 0, latinWords = 0;
  for (const p of latinBody) {
    const a = (p.text.match(/[A-Za-z]/g) || []).length;
    const b = (p.text.match(/[А-ЯЁа-яё]/g) || []).length;
    if (a > b * 2 && a >= 20) latinWords += p.words;
    latin += a; cyrillic += b;
  }
  const predominantlyEnglish = latinWords >= 300 && latin > cyrillic * 2;
  const meta = {
    classes, watermark: {
      status: 'not_checked', keyAccess: false, detectionRun: false,
      vendorIdentity: null, detected: null
    },
    predominantlyEnglish, latinWords,
    limitations: [
      'Статистические знаки Google SynthID-Text, Claude и OpenAI textGrain не определяются по символам, пунктуации или стилометрии.',
      'Анализ языкового стиля не устанавливает автора и не доказывает нарушение требований организации.',
      'Без независимого калибровочного исследования нельзя публиковать вероятность ИИ-авторства и доверительный интервал.'
    ]
  };
  res.stats.provenance = meta;

  if (predominantlyEnglish) {
    addFinding(res, {
      id: 'provenance:language', group: 'style', level: 'info', value: latinWords,
      title: 'Англоязычный текст: защита от ложных срабатываний',
      detail: 'Преимущественно англоязычных слов вне таблиц: около ' + latinWords + '.',
      note: 'Лексика и предсказуемость английских научных текстов зависят от владения языком, перевода, научного жанра и редакторской правки. ' +
        'Нельзя считать простоту языка или грамматическую правильность доказательством ИИ. Авторский языковой профиль не устанавливается автоматически.'
    });
  }

  // This finding gives an explicit auditable "not checked" result in both
  // offline and online baseline; online model review cannot change this flag.
  addFinding(res, {
    id: 'provenance:watermark', group: 'tech', level: 'info', value: 'не проверено',
    title: 'Статистические текстовые водяные знаки: проверка недоступна',
    detail: 'Check-AI не располагает ключами и доверенным API проверки встроенных меток Google SynthID-Text, Claude или OpenAI textGrain.',
    note: 'Скрытые пробелы и символы нулевой ширины — не такие водяные знаки. Их удаление не позволяет установить наличие или отсутствие метки. ' +
      'Для подтверждения происхождения нужны поддерживаемые средства верификации провайдера. Даже подтверждённая метка указывает на возможное участие модели, а не на личность автора, долю генерации или нарушение.'
  });
}
