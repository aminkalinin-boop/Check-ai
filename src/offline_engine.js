/* ===================================================================
   CHECK-AI OFFLINE KNOWLEDGE REGISTRY v1
   Static, bundled with the HTML. No network, storage or model dependency.
   All legacy detectors remain the source of truth; this registry gives
   inspectable explanations, stages and a local processing audit.
   =================================================================== */
'use strict';
const CHECK_AI_OFFLINE_REGISTRY = Object.freeze({
  id: 'check-ai-offline-v1',
  privacy: 'Local processing: no document transfer, no external request',
  formats: ['docx', 'docm', 'txt', 'md'],
  stages: Object.freeze([
    { id: 'hash', title: 'Контрольные суммы', action: 'MD5 и SHA-256 файла', purpose: 'Идентичность проверенной редакции' },
    { id: 'parse', title: 'Извлечение документа', action: 'DOCX / текст, абзацы и таблицы', purpose: 'Полнота наблюдаемых данных' },
    { id: 'metadata', title: 'Метаданные и стили', action: 'OOXML, стили, свойства, история оформления', purpose: 'Технические следы, но не установление авторства' },
    { id: 'sources', title: 'Ссылки, формулы и медиа', action: 'Поля, сноски, изображения, ссылки и структуры', purpose: 'Аудит оформления и проверяемости' },
    { id: 'technical', title: 'Технические маркеры', action: 'Стили чат-интерфейсов, остатки HTML/Markdown и Unicode', purpose: 'Следы копирования и редактирования' },
    { id: 'linguistic', title: 'Языковые и композиционные признаки', action: 'Частотность выражений, структура, контрасты и ритм', purpose: 'Вспомогательные и неспецифичные наблюдения' },
    { id: 'academic', title: 'Научная методология', action: 'Таблицы, статистические формулы, терминология, источники', purpose: 'Контекст и предупреждение ложных срабатываний' },
    { id: 'summary', title: 'Классификация и заключение', action: 'Исходные уровни и объяснения обнаруженных признаков', purpose: 'Независимый воспроизводимый локальный отчёт' }
  ]),
  groups: Object.freeze([
    { id: 'tech', meaning: 'Технический след оформления или внедрения контента', limitation: 'Один CSS-класс может использоваться на разных сайтах' },
    { id: 'meta', meaning: 'Свойства файла или программная обработка Word', limitation: 'Генерация DOCX программой не доказывает генерацию текста' },
    { id: 'chars', meaning: 'Особенности Unicode, пробелов и алфавитов', limitation: 'Невидимый символ не является статистическим водяным знаком' },
    { id: 'text', meaning: 'Остатки ответов сервисов и текстовой разметки', limitation: 'Обязательно сверять контекст цитирования' },
    { id: 'content', meaning: 'Научные утверждения, термины, числа и логика изложения', limitation: 'Не доказывает происхождение научной работы' },
    { id: 'comp', meaning: 'Признаки компиляции разных частей и повторы', limitation: 'Часто возникает при обычной совместной редактуре' },
    { id: 'style', meaning: 'Лексика, ритмика, шаблоны, научный регистр', limitation: 'Очень чувствительно к жанру, языку и дисциплине' },
    { id: 'src', meaning: 'Ссылки, DOI, библиографическое оформление', limitation: 'Недоступная ссылка не тождественна вымышленному источнику' }
  ]),
  levels: Object.freeze([
    { id: 'strong', meaning: 'Сильное совпадение с техническим шаблоном в исходных правилах', limitation: 'Не вероятность ИИ и не юридическое доказательство авторства' },
    { id: 'medium', meaning: 'Косвенный технический признак', limitation: 'Нужна проверка альтернативных причин' },
    { id: 'weak', meaning: 'Неспецифичная языковая/статистическая аномалия', limitation: 'Может возникать в полностью человеческом тексте' },
    { id: 'info', meaning: 'Справочная статистика или редакционное замечание', limitation: 'Не должна трактоваться как обвинение' }
  ]),
  contingencies: Object.freeze([
    { id: 'plain-text', what: 'TXT/MD без OOXML', action: 'Выполнить текстовые проверки и явно не обещать проверку стилей/метаданных' },
    { id: 'docx', what: 'DOCX со стилями, таблицами и сносками', action: 'Запустить полный локальный цикл OOXML' },
    { id: 'broken-docx', what: 'Повреждённый/неподдерживаемый DOCX', action: 'Показать сообщение и не выдавать итог по неполному файлу' },
    { id: 'no-signal', what: 'Технических следов не найдено', action: 'Сообщить о неполноте свидетельств, не объявлять авторство человеческим' },
    { id: 'formulaic', what: 'Нормативный и методологический текст', action: 'Учитывать естественные стандартизированные конструкции' },
    { id: 'bibliography', what: 'Ссылки не подтверждены локально', action: 'Отметить необходимость проверки источников; не объявлять галлюцинацией' },
    { id: 'mixed-language', what: 'Перевод и многоязычие', action: 'Не делать выводов по частоте общеупотребительных связок' },
    { id: 'watermark', what: 'Ключевые водяные знаки разработчиков моделей', action: 'Честно обозначить отсутствие доступа к проверочным ключам' }
  ])
});

function recordOfflineAudit(res) {
  if (!res.stats) res.stats = {};
  const kind = res.kind;
  const isDocx = kind === 'docx';
  const findings = Array.isArray(res.findings) ? res.findings : [];
  const registry = CHECK_AI_OFFLINE_REGISTRY;
  const counts = Object.fromEntries(registry.groups.map(g => [g.id, findings.filter(f => f.group === g.id).length]));
  const actual = {
    hash: !!(res.file && res.file.sha256 && res.file.md5),
    parse: Array.isArray(res.paras),
    metadata: isDocx,
    sources: isDocx,
    technical: true,
    linguistic: true,
    academic: true,
    summary: !!res.verdict
  };
  res.stats.offlineEngine = {
    version: registry.id,
    offlineComplete: !!Object.values(actual).filter((x, i) => i !== 2 && i !== 3).every(Boolean),
    stages: registry.stages.map(stage => ({
      id: stage.id, title: stage.title, purpose: stage.purpose,
      status: actual[stage.id] ? 'выполнено' : (kind === 'text' && ['metadata', 'sources'].includes(stage.id) ? 'неприменимо к текстовому файлу' : 'не выполнено')
    })),
    locallyBundled: {
      webStylePatterns: typeof STYLE_SIGNATURES === 'undefined' ? 0 : STYLE_SIGNATURES.length,
      chatResponsePatterns: typeof CHATBOT_PHRASES === 'undefined' ? 0 : CHATBOT_PHRASES.length,
      academicClichePatterns: typeof CLICHES === 'undefined' ? 0 : CLICHES.length,
      economyGlossary: typeof ECON_GLOSSARY_TERMS === 'undefined' ? 0 : ECON_GLOSSARY_TERMS.length,
      detectorGroups: registry.groups.length,
      scenarios: registry.contingencies.length
    },
    byGroup: counts,
    limitations: 'Полноценная работа без сети означает доступность локальных правил и отчёта, но не гарантирует 100% распознавание происхождения текста. Содержание веб-источников без сети не проверяется.'
  };
  return res.stats.offlineEngine;
}
