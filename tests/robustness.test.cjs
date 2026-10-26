'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'robustness.js'), 'utf8');
const sandbox = {
  addFinding: (res, finding) => { res.findings.push(finding); return finding; },
  countWords: text => (text.match(/[\p{L}\p{N}]+/gu) || []).length
};
vm.runInNewContext(script + '\nthis.check = robustnessChecks;', sandbox);
function parse(strings) {
  const paras = strings.map((text, i) => ({ i, text, words: sandbox.countWords(text),
    heading: false, toc: false, bib: false, inTable: false, inBox: false, flags: [] }));
  const result = { paras, findings: [], stats: {} };
  sandbox.check(result);
  return result;
}
test('Ordinary Russian text without ё is not labelled masking or AI', () => {
  const long = Array.from({ length: 300 }, () => 'Исследование описывает особенности развития экономической модели общества и рынка.').join(' ');
  const result = parse([long]);
  assert.equal(result.stats.robustness.yoLetters, 0);
  assert.ok(result.findings.every(x => x.level === 'info'));
  assert.ok(result.findings.every(x => !/маскировк|написан.*ИИ/u.test(x.title)));
});
test('Periodic sentence lengths are a manual-review diagnostic, not proof', () => {
  const sent = n => Array.from({ length: n }, (_, i) => i ? 'слово' : 'Начало').join(' ') + '.';
  const repeated = Array.from({ length: 48 }, () => [sent(5), sent(18), sent(9)]).flat().join(' ');
  const result = parse([repeated]);
  assert.ok(result.stats.robustness.rhythm);
  assert.ok(result.stats.robustness.rhythm.acf[3] > 0.7);
  assert.ok(result.findings.some(x => x.id === 'robust:rhythm'));
  assert.ok(result.findings.every(x => x.level === 'info'));
});
test('Percentages without nearby attribution only produce informational finding', () => {
  const result = parse([
    'В первой группе получено 78% ответов и отмечены некоторые тенденции развития.',
    'В другой группе зафиксировано 62% результатов при анализе отраслевых показателей.'
  ]);
  assert.equal(result.stats.robustness.percentNoLocalAttribution, 2);
  assert.ok(result.findings.some(x => x.id === 'robust:percent' && x.level === 'info'));
});
test('Visible methodology and source prevent missing-attribution finding', () => {
  const result = parse([
    'По данным обследования выборки в таблице 1 доля участников составила 78%.',
    'По результатам опроса респондентов следующая величина составила 62%.'
  ]);
  assert.equal(result.stats.robustness.percentNoLocalAttribution, 0);
});
