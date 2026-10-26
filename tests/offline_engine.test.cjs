'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'offline_engine.js'), 'utf8');
const ctx = { STYLE_SIGNATURES: [{}, {}], CHATBOT_PHRASES: [{}], CLICHES: [{}, {}, {}], ECON_GLOSSARY_TERMS: ['доход', 'затраты'] };
vm.runInNewContext(src + '\nthis.audit = recordOfflineAudit; this.registry = CHECK_AI_OFFLINE_REGISTRY;', ctx);
function verify(kind) {
  const res = { kind, file: { md5: 'hash1', sha256: 'hash2' },
    paras: [], stats: {}, findings: [{ group: 'tech', level: 'info' }], verdict: { text: 'Тест' } };
  ctx.audit(res);
  return res;
}
test('Offline engine has embedded stages, cases, definitions and glossary counts', () => {
  const r = verify('docx');
  assert.equal(r.stats.offlineEngine.offlineComplete, true);
  assert.equal(r.stats.offlineEngine.stages.length, 8);
  assert.equal(r.stats.offlineEngine.locallyBundled.economyGlossary, 2);
  assert.equal(r.stats.offlineEngine.locallyBundled.detectorGroups, 8);
  assert.ok(r.stats.offlineEngine.locallyBundled.scenarios >= 8);
  assert.equal(r.stats.offlineEngine.byGroup.tech, 1);
});
test('Text mode omits unavailable OOXML stages instead of pretending to run them', () => {
  const r = verify('text');
  const stages = r.stats.offlineEngine.stages;
  assert.equal(stages.find(x => x.id === 'metadata').status, 'неприменимо к текстовому файлу');
  assert.equal(stages.find(x => x.id === 'sources').status, 'неприменимо к текстовому файлу');
});
test('Registry never claims a 100 percent detection guarantee', () => {
  const r = verify('docx');
  assert.match(r.stats.offlineEngine.limitations, /не гарантирует 100%/);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].level, 'info');
});
