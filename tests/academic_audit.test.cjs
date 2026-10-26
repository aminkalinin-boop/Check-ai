'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'academic_audit.js'), 'utf8');
const context = { addFinding: (r, f) => { r.findings.push(f); return f; } };
vm.runInNewContext(script + '\nthis.audit = academicAuditChecks;', context);
const audit = context.audit;
function p(text, extra = {}) {
  return { text, words: (text.match(/[\p{L}\p{N}]+/gu) || []).length,
    i: 0, inTable: false, inBox: false, heading: false, toc: false, bib: false,
    flags: [], section: 'Методы', ...extra };
}
function inspect(inputs) {
  const paras = inputs.map((v, i) => ({ ...(typeof v === 'string' ? p(v) : v), i }));
  const res = { paras, tables: paras.some(x => x.inTable) ? [{ n: 0 }] : [], stats: {}, findings: [] };
  const flagsBefore = JSON.stringify(paras.map(x => x.flags));
  audit(res);
  assert.equal(JSON.stringify(paras.map(x => x.flags)), flagsBefore, 'must not modify original paragraph flags');
  assert.ok(res.findings.every(x => x.level === 'info'), 'all new findings must be informational');
  return res;
}
test('Word table text is accounted separately without implying concealment', () => {
  const row = 'В таблице представлены расчеты показателей экономической безопасности организаций за пять периодов и результаты опроса работников.';
  const result = inspect([p(row.repeat(12), { inTable: true }), p('Основной раздел статьи содержит описание наблюдений и эмпирическую интерпретацию полученных результатов.')]);
  assert.ok(result.stats.academicAudit.tableWords >= 80);
  assert.ok(result.stats.academicAudit.tableShare > 50);
  assert.ok(result.findings.some(x => x.id === 'academic:tables'));
  assert.ok(!result.findings.some(x => /маскировк/i.test(x.title)));
});
test('Mixed script inside Russian word is localized', () => {
  const r = inspect(['В этом предложении встречается термин мeтодика и нормально написанные кириллические слова.']);
  assert.equal(r.stats.academicAudit.mixedScriptWords, 1);
  assert.ok(r.findings.some(x => x.id === 'academic:mixed-script'));
});
test('Ordinary mixed scientific text with English abbreviations remains harmless', () => {
  const r = inspect(['Для расчета показателя применены критерии OR и SD, а также N = 514 респондентов.']);
  assert.equal(r.stats.academicAudit.mixedScriptWords, 0);
  assert.equal(r.findings.filter(x => x.level !== 'info').length, 0);
});
test('Invisible char between Cyrillic letters is pinpointed but original remains unchanged', () => {
  const text = 'В тексте присутствует невидимый знак в слове науч\u200bный, который следует проверить.';
  const r = inspect([text]);
  assert.equal(r.stats.academicAudit.invisibleInsideWord, 1);
  assert.equal(r.paras[0].text, text);
  assert.ok(r.findings.some(x => x.id === 'academic:inside-word'));
});
test('Methodology and statistical reporting are contextual, not AI classification', () => {
  const r = inspect([
    'Выборка составила N = 514 респондентов, для оценки зависимостей применялся odds ratio.',
    'Среднее значение составило 17.9 года, SD = 10.7, а доверительный интервал рассчитывался отдельно.'
  ]);
  assert.equal(r.stats.academicAudit.empiricalParagraphs, 2);
  assert.ok(r.findings.some(x => x.id === 'academic:empirical'));
});
test('English academic openers are not automatically treated as AI translation', () => {
  const r = inspect([
    'Importantly, the study demonstrates that measured outcomes may change depending on the sampling approach.',
    'In this context, the findings highlight the need to publish the full empirical methodology.',
    'First, the results are described. Second, other factors are considered. Finally, the limitations are reported.'
  ]);
  assert.equal(r.stats.academicAudit.paragraphsInEnglish, 3);
  assert.ok(r.stats.academicAudit.englishAcademicConnectors >= 4);
  assert.ok(r.findings.some(x => x.id === 'academic:english'));
});
test('Long scientific document gets independent descriptive segments, not fatigue diagnosis', () => {
  const part = 'Исследование дает информацию о роли рынка и развитии современной экономики. ';
  const r = inspect(Array.from({ length: 26 }, () => part.repeat(14)));
  assert.ok(r.stats.academicAudit.sectionProfiles.length >= 4);
  assert.ok(r.findings.some(x => x.id === 'academic:segments'));
  assert.ok(r.findings.every(x => !/утомлени|доказан.*ИИ/i.test(x.title)));
});
