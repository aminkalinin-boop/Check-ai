'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'discourse_audit.js'), 'utf8');
const sandbox = { addFinding: (r, f) => { r.findings.push(f); return f; } };
vm.runInNewContext(script + '\nthis.inspect = discourseAuditChecks;', sandbox);

function run(texts, section = 'Результаты') {
  const paras = texts.map((text, i) => ({
    i, text, section, words: (text.match(/[\p{L}\p{N}]+/gu) || []).length,
    toc: false, bib: false, inTable: false, inBox: false, heading: false, flags: []
  }));
  const res = { paras, findings: [], stats: {} };
  const initial = JSON.stringify(paras);
  sandbox.inspect(res);
  assert.equal(JSON.stringify(paras), initial, 'No paragraph content or flags should be changed');
  assert.ok(res.findings.every(f => f.level === 'info'), 'All new results should be informational');
  return res;
}

test('Both contrastive expressions and their absence are only descriptive', () => {
  const sentence = 'В исследовании рассмотрены различные направления развития системы образования и механизмы реализации программы. ';
  const result = run([sentence.repeat(100)]);
  assert.equal(result.stats.discourseAudit.contrastCount, 0);
  const finding = result.findings.find(f => f.id === 'discourse:contrast');
  assert.ok(finding);
  assert.match(finding.note, /не подтверждает/);
});
test('Paired contrastives are counted without double-counting overlapping matches', () => {
  const result = run(['Решение не только повышает точность, но и снижает расходы на обучение персонала. Это не просто методика, а технология совместного действия.']);
  assert.equal(result.stats.discourseAudit.contrastCount, 2);
});
test('Real repeated closing sentence is flagged as an editorial review item', () => {
  const first = 'Экономическая безопасность требует эффективного управления производственными ресурсами и анализа хозяйственных показателей. ';
  const second = 'Управление ресурсами включает оценку затрат и учет доходов предприятий лесной отрасли. ';
  const tail = 'Экономическая безопасность требует анализа хозяйственных показателей и эффективного управления производственными ресурсами.';
  const doc = [first+second+tail, first+second+tail];
  const result = run(doc);
  assert.equal(result.stats.discourseAudit.repeatedTails, 2);
  assert.ok(result.findings.some(f => f.id === 'discourse:tail'));
});
test('Terminological alternatives receive a non-accusatory context check', () => {
  const result = run(['Человеческий капитал отражает долгосрочные характеристики работников.',
    'Людской капитал иногда применяется как термин при анализе подготовки кадров.']);
  assert.equal(result.stats.discourseAudit.pairsOfTerms, 1);
  assert.ok(result.findings.find(f => f.id === 'discourse:terms'));
});
test('Normative names do not enter original verdict scoring', () => {
  const result = run(['ЦУР-1 и ЦУР-2 регулируются системой показателей ООН.',
    'ГОСТ Р 7.0.5–2008 задает правила оформления библиографических ссылок.',
    'В стандарте ISO 9001 описана система менеджмента качества.']);
  assert.ok(result.stats.discourseAudit.standardsMentions >= 3);
  assert.ok(result.findings.some(f => f.id === 'discourse:standards'));
  assert.ok(!result.findings.some(f => f.level !== 'info'));
});
test('Ordinary scientific statements without features produce no claims of AI use', () => {
  const result = run(['Экономическое исследование описывает развитие организации и её показатели.',
    'Дискуссия рассматривает различные подходы к управлению ресурсами.']);
  assert.equal(result.stats.discourseAudit.repeatedTails, 0);
  assert.equal(result.findings.filter(f => f.level !== 'info').length, 0);
});
