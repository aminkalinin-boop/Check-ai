'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const analyzer = fs.readFileSync(path.join(__dirname, '..', 'src', 'analyzer.js'), 'utf8');
const sandbox = { module: { exports: {} }, console };
vm.runInNewContext(analyzer + '\nmodule.exports.testFinalize = finalize;', sandbox, { filename: 'analyzer.js' });
const finalize = sandbox.module.exports.testFinalize;

function inspect(findings = [], stats = {}) {
  const res = {
    findings: findings.map(f => ({ ...f })),
    stats: { markedShare: 0, runMarkedParas: 0, runMarkedWords: 0, ...stats },
    paras: [],
    styles: [],
    media: [],
    footnotes: [],
    meta: { tables: 0, charts: 0, shapes: 0, comments: 0, insertions: 0, deletions: 0, distinctRsids: 0, addins: [] },
  };
  finalize(res);
  return res;
}

test('No markers does not certify human authorship', () => {
  const r = inspect();
  assert.match(r.verdict.text, /происхождение текста не установлено/);
  assert.equal(r.verdict.evidence, 'не выявлены');
  assert.ok(!('confidence' in r.verdict));
});
test('Specific web style is evidence of markup, not AI authorship', () => {
  const r = inspect([{
    id: 'style:ds', group: 'tech', level: 'strong', title: 'Стиль ds-markdown',
    value: 1, style: { category: 'webui', source: 'DeepSeek', words: 50, runWords: 0 },
  }], { markedShare: 28 });
  assert.match(r.verdict.text, /технические маркеры/);
  assert.equal(r.verdict.evidence, 'специфические технические');
  assert.match(r.verdict.scale, /28/);
  assert.equal(r.verdict.mainSource, 'DeepSeek');
  assert.doesNotMatch(r.verdict.text, /факт применения|прямые признаки применения|написан.*ИИ/);
});
test('Multiple generic technical marks remain indirect', () => {
  const r = inspect([
    { id: 'a', group: 'tech', level: 'medium' },
    { id: 'b', group: 'meta', level: 'medium' },
  ]);
  assert.match(r.verdict.text, /косвенных технических/);
  assert.equal(r.verdict.evidence, 'косвенные технические');
});
test('Stylistic features alone are not reported as proof', () => {
  const r = inspect([{ id: 'styloA', group: 'style', level: 'medium' }]);
  assert.match(r.verdict.text, /технического подтверждения нет/);
  assert.equal(r.verdict.evidence, 'стилометрические, неспецифичные');
});
test('Bibliography problems remain quality issues rather than AI attribution', () => {
  const r = inspect([{ id: 'citations', group: 'src', level: 'weak' }]);
  assert.match(r.verdict.text, /замечания к структуре документа и ссылкам/);
  assert.doesNotMatch(r.verdict.text, /использован.*ИИ|генеративн.*ИИ/);
});
test('Structure and revision markers do not establish human authorship', () => {
  const r = inspect([], { markedShare: 0 });
  assert.equal(r.human.length, 0);
  assert.equal(r.verdict.evidence, 'не выявлены');
});
