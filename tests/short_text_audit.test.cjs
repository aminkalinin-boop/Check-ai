'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'short_text_audit.js'), 'utf8');
const box = { addFinding: (r, f) => { r.findings.push(f); return f; } };
vm.runInNewContext(src + '\nthis.audit = shortTextAudit;', box);
function make(texts) {
  const paras = texts.map((text, i) => ({
    i, text, words: (text.match(/[\p{L}\p{N}]+/gu) || []).length,
    heading: false, bib: false, toc: false, inTable: false, inBox: false, flags: []
  }));
  const r = { paras, findings: [], stats: {} };
  const before = JSON.stringify(paras.map(x => x.text));
  const result = box.audit(r, paras);
  assert.equal(JSON.stringify(paras.map(x => x.text)), before);
  assert.ok(r.findings.every(f => f.level === 'info'), 'No punitive AI score from short academic prose');
  assert.ok(paras.every(p => p.flags.every(f => f.level === 'info')));
  return { r, result };
}
test('Short 350-word scientific method prose receives a separate, reviewable descriptive profile', () => {
  const paragraphs = [
    'Исследовательский вопрос предполагает сопоставление показателей инвестиций, запасов и технических затрат. Прибыль и денежные потоки отсутствуют; поэтому причинный вывод не установлен. '.repeat(4),
    'В качестве методики рассматривается анализ данных предприятий. Расчет изменения срока оборота не позволяет оценить прибыль. Данные по предприятиям неизвестны и не представлены. '.repeat(4),
    'Показатели выборки определены условно. Метод сравнения инвестиционных затрат опирается на агрегированные величины; поэтому индивидуальные результаты не установлены. '.repeat(4),
    'Исследование рассматривает данные о затратах, инвестициях и показателях оборота. Недостаточно исходных наблюдений для оценки эффективности. Результат расчета не доказывает причинную связь. '.repeat(4)
  ];
  const { r, result } = make(paragraphs);
  assert.ok(result.words >= 150 && result.words < 600);
  assert.ok(result.caveatPhrases > 0, 'Cyrillic word boundaries must work');
  assert.ok(result.methodTerms > 0);
  assert.ok(result.caveatParagraphs >= 3);
  assert.ok(r.findings.some(f => f.id === 'short:argument'));
});
test('Very short fragment is not scored or treated as a full research paper', () => {
  const { r, result } = make(['В качестве примера используется короткая научная фраза.']);
  assert.equal(result, null);
  assert.equal(r.findings.length, 0);
});
test('Length 600+ is reserved for existing long-form stylometry', () => {
  const { result } = make(['Данные научного исследования уточняют показатели и результаты. '.repeat(120)]);
  assert.equal(result, null);
});
