'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'provenance_fairness.js'), 'utf8');
const ctx = { addFinding: (res, f) => { res.findings.push(f); return f; } };
vm.runInNewContext(js + '\nthis.evaluate = provenanceFairnessChecks;', ctx);
function audit(lines, findings = []) {
  const ps = lines.map((text, i) => ({
    i, text, words: (text.match(/[\p{L}\p{N}]+/gu) || []).length,
    toc: false, bib: false, inBox: false, inTable: false, heading: false, flags: []
  }));
  const res = { paras: ps, findings: findings.map(f => ({ ...f })), stats: {} };
  const before = JSON.stringify(ps);
  const originals = JSON.stringify(res.findings);
  ctx.evaluate(res);
  assert.equal(JSON.stringify(ps), before, 'document paragraphs must remain unchanged');
  assert.equal(JSON.stringify(res.findings.slice(0, findings.length)), originals, 'existing findings must remain unchanged');
  assert.ok(res.findings.slice(findings.length).every(x => x.level === 'info'));
  return res;
}
test('Offline analyzer cannot pretend provider watermark was checked', () => {
  const r = audit(['Научная статья посвящена использованию современных подходов к анализу эмпирических данных.']);
  assert.equal(r.stats.provenance.watermark.status, 'not_checked');
  assert.equal(r.stats.provenance.watermark.keyAccess, false);
  assert.equal(r.stats.provenance.watermark.detected, null);
  assert.equal(r.stats.provenance.classes.length, 4);
  assert.ok(r.findings.some(f => f.id === 'provenance:watermark' && f.level === 'info'));
});
test('Technical invisible characters do not turn into statistical watermark evidence', () => {
  const r = audit(['Слово со скрытым знаком\u200b внутри текста.'], [
    { id: 'char:zw', level: 'medium', title: 'Символ нулевой ширины', group: 'chars' }
  ]);
  assert.equal(r.stats.provenance.classes[1].count, 1);
  assert.equal(r.stats.provenance.classes[3].count, null);
  assert.equal(r.stats.provenance.watermark.detected, null);
});
test('English scientific text gets a fairness caveat, not an authorship verdict', () => {
  const text = 'Research teams report that scientific writing can use standard vocabulary even when the analysis is fully original. ';
  const r = audit(Array.from({ length: 7 }, () => text.repeat(7)));
  assert.equal(r.stats.provenance.predominantlyEnglish, true);
  assert.ok(r.findings.some(f => f.id === 'provenance:language' && f.level === 'info'));
  assert.equal(r.stats.provenance.watermark.detectionRun, false);
});
test('Short bilingual example does not infer language background or style classification', () => {
  const r = audit(['Methods and results were analyzed. Методология была выполнена с использованием первичных данных.']);
  assert.equal(r.stats.provenance.predominantlyEnglish, false);
  assert.equal(r.findings.filter(f => f.id === 'provenance:language').length, 0);
});
