'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src','linguistic_diagnostics.js'),'utf8');
const ctx={};
vm.runInNewContext(source+'\nthis.diagnose=scientificParagraphDiagnosis;',ctx);
const diagnose=(t,selected='',context={})=>ctx.diagnose(t,selected,context);
const ids=d=>Array.from(d.signals,x=>x.id);
test('Specific boilerplate, contrast and conclusion are grounded in exact matches',()=>{
  const t='Следует отметить, что инвестиции играют ключевую роль. Это не только финансовая мера, но и организационная мера. Таким образом, вывод необходимо подтвердить.';
  const d=diagnose(t);
  assert.ok(ids(d).includes('preamble'));
  assert.ok(ids(d).includes('contrast'));
  assert.ok(ids(d).includes('significance'));
  assert.ok(ids(d).includes('inference'));
  for(const x of d.signals){ assert.ok(x.evidence.length>10);assert.ok(x.action.length>25); assert.ok(x.interpretation.length>25);}
});
test('Difference between lexical entropy and language-model perplexity is explicit',()=>{
  const d=diagnose('Данные исследования описывают показатели. Данные сравнения описывают объём. Научный результат требует подтверждения.');
  assert.ok(d.metric.lexicalEntropyBits>0);
  assert.match(d.metric.entropyMeaning,/не перплексия модели/);
  assert.equal(d.metric.sentenceCount,3);
});
test('Sentence-length regularity is not invented for too few observations',()=>{
  const d=diagnose('Первый абзац. Второй абзац.');
  assert.ok(!ids(d).includes('low-variance'));
  assert.ok(!ids(d).includes('periodic'));
  assert.equal(d.metric.lag2SentenceLengthCorrelation,undefined);
});
test('Genuinely regular scientific example reports CV and an actionable observation',()=>{
  const s=['Данные отражают оборот запасов предприятия',
           'Расчёт подтверждает изменение затрат предприятия',
           'Выборка охватывает отдельные компании региона',
           'Показатель характеризует продолжительность оборота материалов',
           'Программа предусматривает обновление техники предприятия',
           'Анализ отмечает ограничения доступной выборки'];
  const d=diagnose(s.map(x=>x+'.').join(' '));
  assert.ok(ids(d).includes('low-variance'));
  assert.ok(d.metric.sentenceLengthCV<=0.24);
});
test('Standard bibliography gets context protection, not an AI accusation',()=>{
 const d=diagnose('ГОСТ Р 7.0.5-2008, Москва, 2020.','',{bib:true});
 assert.equal(ids(d)[0],'bibliography');
 assert.match(d.originClaim,/не установлен/);
});
test('Highlighted words drive quoted pattern evidence, not arbitrary surrounding phrase',()=>{
 const para='Следует отметить, что отношение показателей изменилось. Таким образом, это показывает результат.';
 const d=diagnose(para,'Таким образом,');
 assert.ok(ids(d).includes('inference'));
 assert.ok(!ids(d).includes('preamble'));
});
test('Causal claim provides scientific verification, not automatic synonymic changes',()=>{
 const d=diagnose('Доказано, что увеличение инвестиций гарантирует рост рентабельности на 12%.');
 assert.ok(ids(d).includes('causality'));
 assert.ok(ids(d).includes('quantitative'));
 const action=d.signals.find(x=>x.id==='causality').action;
 assert.match(action,/дизайн исследования/);
});
test('No arbitrary every-fourth-word substitutions or fake calibrated AI odds',()=>{
 const d=diagnose('Оборачиваемость запасов изменилась за четыре года.');
 assert.ok(!ids(d).includes('contrast'));
 assert.ok(!d.signals.some(x=>/каждое четвёртое слово|вероятность ИИ\s*\d+%/i.test(x.action)));
});
test('Annotated outputs use observations and actions, not a copy of marked passages',()=>{
 const anno=fs.readFileSync(path.join(root,'src','annotate.js'),'utf8');
 const report=fs.readFileSync(path.join(root,'src','report2.js'),'utf8');
 const ui=fs.readFileSync(path.join(root,'src','ui.js'),'utf8');
 assert.ok(!anno.includes("f.text.slice(0, 380)"));
 assert.ok(!anno.includes("para.text.trim().slice(0, 125)"));
 assert.ok(!report.includes("fragment.text.slice(0, 3500)"));
 assert.ok(!ui.includes("f.text.slice(0,2200)"));
 assert.match(report,/Диагностические карточки Check-AI/);
 assert.match(anno,/Измеримый признак/);
});


test('Repeated scientific trigrams are reported with counts but no authorship verdict',()=>{
 const paragraph=('Управление запасами предприятий предполагает системный анализ данных. '+
 'При этом управление запасами предприятий требует учёта затрат. ').repeat(5);
 const d=diagnose(paragraph);
 assert.ok(ids(d).includes('ngram-repeat'));
 assert.ok(d.metric.repeatedTrigramTypes>0);
 assert.match(d.signals.find(x=>x.id==='ngram-repeat').action,/Сохраняйте устойчивый экономический термин/);
});
