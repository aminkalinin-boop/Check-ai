/* Local evidence cards for academic text. Transparent heuristics, no trained
   detector, true perplexity, vendor watermark, or authorship probability.
   Source rule descriptions reflect hypotheses from field tests / transcripts,
   not measured internals of Antiplagiat. */
'use strict';
const CHECK_AI_DISCOURSE_LEXICON = Object.freeze([
  { id:'preamble', name:'Вводная академическая формула',
    re:/(?<!\p{L})(?:следует (?:особо )?отметить(?:,?\s+что)?|важно (?:подчеркнуть|понимать)(?:,?\s+что)?|в данном контексте|на сегодняшний день|актуальность (?:данной )?темы обусловлена|в эпоху цифровизации|в современном мире)(?!\p{L})/giu,
    reason:'В тексте присутствует стандартизированная вводная конструкция; такой оборот встречается и у исследователей, поэтому сам по себе не доказывает использование модели.',
    action:'Проверьте, сообщает ли вводная формула новый факт. Если нет, начните мысль непосредственно с исследуемого показателя, периода или установленного результата; не меняйте термины и цифры ради стилометрии.' },
  { id:'contrast', name:'Парное риторическое противопоставление',
    re:/(?:не\s+только[\s\S]{1,150}?\s+но\s+и|не\s+столько[\s\S]{1,150}?\s+сколько|не\s+просто[\s\S]{1,150}?\s+а\s+|речь\s+ид[её]т\s+не\s+о[\s\S]{1,150}?\s+а\s+о)/giu,
    reason:'Обнаружена парная риторическая конструкция. Частотность таких конструкций может отражать стилистический шаблон, но используется и в обычной научной аргументации.',
    action:'Установите, действительно ли сравниваются две разные научные категории. Если смысл перечислительный, назовите отдельно конкретные эффекты и критерии их оценки; если противопоставление методологически важно, сохраните его и обоснуйте.' },
  { id:'significance', name:'Неопределённая оценка значимости',
    re:/(?<!\p{L})(?:играет\s+ключевую\s+роль|имеет\s+(?:большое|существенное)\s+значение|оказывает\s+существенное\s+влияние|открывает\s+новые\s+горизонты|позволяет\s+выйти\s+на\s+качественно\s+новый\s+уровень|комплексный\s+и\s+многогранный\s+характер)(?!\p{L})/giu,
    reason:'Выделена оценочная конструкция без собственного количественного смысла. Она может быть нормальной авторской формулировкой; проверка требуется только для точности утверждения.',
    action:'Уточните, какой показатель изменяется и за какой период (например, оборачиваемость запасов, издержки, рентабельность, инвестиционный риск). Для причинного «влияния» приведите метод расчёта и источник данных либо обозначьте его как гипотезу.' },
  { id:'inference', name:'Шаблонный переход к выводу',
    re:/(?<!\p{L})(?:таким\s+образом|исходя\s+из\s+вышеизложенного|это\s+свидетельствует\s+о\s+том,\s+что|в\s+целом\s+можно\s+(?:сказать|утверждать),?\s+что|следовательно)(?!\p{L})/giu,
    reason:'Обнаружена стандартная связка вывода. Такие связки обязательны во многих научных жанрах и неспецифичны для генерации.',
    action:'Сопоставьте вывод с ближайшими таблицами, аргументами и исследовательским вопросом. Укажите проверяемый результат, а не повторяйте постановку задачи. Не убирайте корректный вывод только ради изменения внешней отметки.' },
  { id:'enumeration', name:'Стандартизированная последовательность перечислений',
    re:/(?<!\p{L})(?:во[- ]первых|во[- ]вторых|в[- ]третьих|first(?:ly)?|second(?:ly)?|third(?:ly)?|finally)(?!\p{L})/giu,
    reason:'Найдены маркеры перечисления; при многократном повторении они создают жёсткую композицию, но законны для научного текста.',
    action:'Проверьте, что каждый пункт соответствует отдельному этапу методики или самостоятельному аргументу; уберите лишь дублирующие пункты, сохранив порядок реальных операций.' }
]);
function scientificSentenceSplit(text) {
  return String(text || '').replace(/\s+/g,' ').trim()
    .split(/(?<=[.!?…])\s+(?=(?:[«„"(\[])?[А-ЯЁA-Z])/u).map(x=>x.trim()).filter(Boolean);
}
function scientificTokens(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').match(/[\p{L}\p{N}]+(?:[.,][0-9]+)?/gu) || [];
}
function rounded(x, n=2) { return Number(x.toFixed(n)); }
function scientificParagraphDiagnosis(paragraphText, selectedText='', context={}) {
  const source=String(paragraphText||''), excerpt=String(selectedText||'').trim();
  const focus=excerpt || source;
  const tokens=scientificTokens(source), sentences=scientificSentenceSplit(source);
  const lens=sentences.map(s=>scientificTokens(s).length).filter(Boolean);
  const mean=lens.length?lens.reduce((a,b)=>a+b,0)/lens.length:0;
  const variance=lens.length?lens.reduce((s,x)=>s+(x-mean)**2,0)/lens.length:0;
  const sd=Math.sqrt(variance), cv=mean?sd/mean:null;
  const unique=new Set(tokens).size;
  // This is raw lexical Shannon entropy on token frequencies, NOT perplexity
  // of a reference language model; it is strongly length/genre dependent.
  const counts=new Map();
  for(const word of tokens)counts.set(word,(counts.get(word)||0)+1);
  let entropy=0;
  for(const c of counts.values()){const p=c/Math.max(tokens.length,1);entropy-=p*Math.log2(p);}
  const metric={
    words:tokens.length, sentenceCount:lens.length,
    meanSentenceWords:rounded(mean,1), sentenceLengthCV:cv==null?null:rounded(cv,2),
    distinctWordRatio:tokens.length?rounded(unique/tokens.length,3):null,
    lexicalEntropyBits:tokens.length?rounded(entropy,2):null,
    entropyMeaning:'Описательная энтропия слов в битах (не перплексия модели и не индикатор авторства)'
  };
  const signals=[];
  const add=(id,title,evidence,interpretation,action,scope='выделенный фрагмент')=>
    signals.push({id,title,evidence,interpretation,action,scope});
  if(context.toc||context.heading){
    add('structural','Служебный элемент документа','Разметка затрагивает заголовок или оглавление.',
      'Такие участки могут включаться в крупную зону внешнего выделения; самостоятельного стилометрического вывода нет.',
      'Проверьте границы выделения по отчёту и анализируйте следующий содержательный абзац отдельно.');
    return {metric,signals,missing:[],originClaim:'Признак машинного авторства не установлен'};
  }
  if(context.bib){
    add('bibliography','Библиографическая формула','Выделена запись списка литературы.',
      'Стандартизированное библиографическое оформление не доказывает машинную генерацию.',
      'Сверьте существование источника, DOI, год, страницы и точность библиографических данных.');
    return {metric,signals,missing:[],originClaim:'Признак машинного авторства не установлен'};
  }
  for(const rule of CHECK_AI_DISCOURSE_LEXICON){
    const hits=[...focus.matchAll(rule.re)]; rule.re.lastIndex=0;
    if(!hits.length)continue;
    add(rule.id,rule.name,'Найдено '+hits.length+' упоминаний; пример: «'+hits[0][0].replace(/\s+/g,' ').slice(0,65)+'».',
      rule.reason,rule.action);
  }
  // In a long highlighted passage or entirely marked paragraph, quantify
  // structure only when there are enough sentences for a meaningful sample.
  if(lens.length>=5) {
    const lengthPreview=lens.slice(0,12).join(' / ');
    if(cv!==null&&cv<=0.24)
      add('low-variance','Низкая вариативность длины предложений',
        'Длины первых '+Math.min(lens.length,12)+' предложений (в словах): '+lengthPreview+
        '; коэффициент вариации '+rounded(cv,2)+'.',
        'Предложения сходны по длине, но такая равномерность встречается в методических текстах. Порог описательный, без калибровки по корпусу.',
        'Проверьте, обусловлено ли одинаковое строение единым перечислением критериев. Свяжите каждый тезис с конкретными данными, а не вводите искусственные короткие предложения.');
    if(lens.length>=8){
      const first=lens.slice(0,-2),last=lens.slice(2);
      const meanA=first.reduce((a,b)=>a+b,0)/first.length,meanB=last.reduce((a,b)=>a+b,0)/last.length;
      const cov=first.reduce((s,x,i)=>s+(x-meanA)*(last[i]-meanB),0);
      const norm=Math.sqrt(first.reduce((s,x)=>s+(x-meanA)**2,0)*last.reduce((s,x)=>s+(x-meanB)**2,0));
      const corr=norm?cov/norm:null;
      metric.lag2SentenceLengthCorrelation=corr==null?null:rounded(corr,2);
      if(corr!==null&&corr>=0.82)
        add('periodic','Регулярность ритма на шаге двух предложений',
          'Корреляция длин предложений на лаге 2: '+rounded(corr,2)+'; наблюдений: '+lens.length+'.',
          'Такое чередование совместимо с формальным шаблоном. На одном абзаце нельзя установить, было ли оно предписано промптом.',
          'Проверьте, следует ли последовательность из естественных этапов рассуждения; не изменяйте длины механически. Сопоставьте структуру с другими абзацами раздела.');
    }
  }
  if(lens.length>=3) {
    const starts=sentences.map(s=>scientificTokens(s).slice(0,2).join(' ')).filter(s=>s.split(' ').length>=2);
    const histogram=new Map();
    for(const st of starts)histogram.set(st,(histogram.get(st)||0)+1);
    const highest=[...histogram].sort((a,b)=>b[1]-a[1])[0];
    if(highest&&highest[1]>=3)
      add('same-opening','Повтор двухсловного начала предложений',
        'Начало «'+highest[0]+'» повторено '+highest[1]+' раз(а) в '+starts.length+' предложениях.',
        'Повтор начала повышает структурную однообразность; возможно и осознанное параллельное изложение.',
        'Проверьте, являются ли эти предложения независимыми результатами; при дублировании объедините одинаковые аргументы, сохранив фактическое содержание.');
    const wordSet=t=>new Set(scientificTokens(t).filter(w=>w.length>=5&&!/^(?:котор|таким|этого|явля|данно|более)/.test(w)));
    const last=wordSet(sentences[sentences.length-1]),previous=wordSet(sentences.slice(0,-1).join(' '));
    const common=[...last].filter(x=>previous.has(x));
    const overlap=last.size?common.length/last.size:0;
    metric.tailLexicalOverlap=rounded(overlap,2);
    if(last.size>=5&&common.length>=4&&overlap>=0.67)
      add('tail-repeat','Лексическое повторение в конце абзаца',
        'Последняя фраза повторяет '+common.length+' содержательных слов; доля совпадений '+Math.round(overlap*100)+'%.',
        'Это простая доля общих слов, не BERTScore и не оценка смыслового тождества.',
        'Сопоставьте последнее предложение с предыдущими тезисами. Если оно не добавляет вывода из фактов, уточните результат или устраните смысловой дубль; не удаляйте необходимое резюме.');
  }
  if(context.inTable) add('table-context','Фрагмент внутри таблицы',
    'Разметка расположена в ячейке таблицы Word.',
    'Текст ячейки не следует сравнивать с обычными абзацами без её строки, столбца и исходных данных.',
    'Сверьте подпись таблицы, заголовки граф, период, единицы измерения, знаменатели и соответствие выводам текста.');
  const numeric=[...focus.matchAll(/(?<!\d)\d+(?:[.,]\d+)?\s*(?:%|млн|тыс|руб|лет|года|дней|дня)(?!\p{L})/giu)];
  if(numeric.length) add('quantitative','Количественные утверждения',
    'В выделении '+numeric.length+' числовых величин с единицами; пример: «'+numeric[0][0]+'».',
    'Наличие чисел не означает ни реальности, ни вымышленности данных и не указывает на конкретную модель.',
    'Для указанной величины проверьте первичный источник, год и совокупность, исходную таблицу, метод расчёта и обоснованность причинной интерпретации.');
  // Mark unsupported causal moves for editorial review; do not pretend
  // to have checked the actual sources or solved causal inference.
  if(/(?<!\p{L})(?:доказано|установлена причинная связь|является причиной|гарантирует|приводит к росту)(?!\p{L})/iu.test(focus))
    add('causality','Категоричность причинного утверждения',
      'Есть формулировка, указывающая на доказанность либо однозначную причинность.',
      'Для таких выводов требуются данные и исследовательский дизайн; по одной фразе истинность не устанавливается.',
      'Проверьте дизайн исследования, контроль факторов, статистический критерий и исходные расчёты. Если причинность не доказана, точно обозначьте ограничение вывода.');
  if(!signals.length) add('not-identified','Локальный языковой маркер не установлен',
    'В отмеченной области не найдено конкретной конструкции из встроенных правил.',
    'Причина срабатывания закрытого внешнего классификатора неизвестна; не следует придумывать объяснение.',
    'Сопоставьте границы разметки с соседними абзацами и первичными источниками. Проведите ручную научную экспертизу без механического изменения терминов.');
  const evidenceOnly=signals.filter(x=>x.id!=='not-identified');
  return {
    metric,signals,missing:[],originClaim:'Эвристики языка не доказывают создание текста ИИ',
    hasLocalLinguisticEvidence:!!evidenceOnly.filter(x=>!['table-context','quantitative'].includes(x.id)).length
  };
}
function bestScientificSignal(d) {
  const order=['periodic','low-variance','tail-repeat','same-opening','contrast','preamble','inference','significance','causality','enumeration','quantitative','table-context','structural','bibliography','not-identified'];
  return [...d.signals].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id))[0]||null;
}
