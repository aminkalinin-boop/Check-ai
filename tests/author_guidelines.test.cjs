'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'..','src','author_guidelines.js'),'utf8');
const ctx={};
vm.runInNewContext(script+'\nthis.scan=authorGuidelineMatches;this.audit=authorGuidelineAudit;this.mark=authorMarkedGuidance;this.standard=CHECK_AI_AUTHOR_STANDARD;this.rules=CHECK_AI_AUTHOR_RULES;',ctx);
function inspect(paragraphs){
  const paras=paragraphs.map((text,i)=>({text,i,words:(text.match(/\p{L}+/gu)||[]).length,
    bib:false,toc:false,heading:false,inBox:false,inTable:false,flags:[]}));
  const res={paras,findings:[{id:'existing',level:'medium'}],verdict:{text:'Исходный вывод'},stats:{counts:{strong:0,medium:1,weak:0,info:0}}};
  const before=JSON.stringify({flags:paras.map(x=>x.flags),findings:res.findings,verdict:res.verdict,counts:res.stats.counts});
  ctx.audit(res);
  const after=JSON.stringify({flags:paras.map(x=>x.flags),findings:res.findings,verdict:res.verdict,counts:res.stats.counts});
  assert.equal(before,after,'editorial rules must NEVER affect detection or scoring');
  return res;
}
test('Exact source-backed cliche gives relevant action and no authorship assertion',()=>{
  const found=ctx.scan('Таким образом, стоит отметить ключевую роль закупок.',10);
  assert.ok(found.some(x=>x.id==='generic-openers'));
  assert.ok(found.every(x=>x.action.length>30&&x.section));
  assert.equal(ctx.standard.version,'5.2.3-2026-10-18');
});
test('Economic terminology is matched rather than rewriting whole paragraph',()=>{
  const matches=ctx.scan('Доходность предприятия выросла. ВВП региона увеличился.',20);
  assert.ok(matches.some(x=>x.id==='profitability'));
  assert.ok(matches.some(x=>x.id==='regional-gdp'));
  assert.match(matches.find(x=>x.id==='profitability').action,/рентабельность/);
  assert.match(matches.find(x=>x.id==='regional-gdp').action,/ВРП|валовой региональный/);
});
test('Cyrillic word boundaries detect key-role and avoid a prefixed word',()=>{
  const matches=ctx.scan('Этот фактор играет ключевую роль в оценке.');
  assert.ok(matches.some(x=>x.id==='key-role'));
  assert.ok(!ctx.scan('Контриграет ключевую роль.',12).some(x=>x.id==='key-role'));
});
test('Percent points are marked as contextual checks, not automatically recalculated',()=>{
  const matches=ctx.scan('Доля инвестиций увеличилась на 2 % за исследуемый период.',20);
  assert.ok(matches.some(x=>x.id==='percentage-points'));
  assert.match(matches.find(x=>x.id==='percentage-points').action,/сверьте исходную/i);
});
test('Marked text is checked EXACTLY; neighboring paragraph stays separate',()=>{
  const para={text:'Таким образом, инвестиционная активность выросла при сохранении прочих факторов.'};
  const mark=ctx.mark(para,'инвестиционная активность');
  assert.equal(mark.primary,null);
  assert.ok(mark.paragraphOnly.some(x=>x.id==='generic-openers'));
  assert.match(mark.notice,/Внутри выделения/);
  const exact=ctx.mark(para,'Таким образом');
  assert.equal(exact.primary.id,'generic-openers');
  assert.equal(exact.paragraphOnly.length,0);
});
test('Ordinary economic fact without listed constructions yields no imposed diagnosis',()=>{
  const s='Выручка организаций за 2024 год составила 14 млн руб. по данным бухгалтерской отчетности.';
  assert.equal(ctx.scan(s).length,0);
  const r=inspect([s]);
  assert.equal(r.stats.authorGuidelines.paragraphsWithNotes,0);
});
test('Editorial rules never modify the Check-AI signal counts or paragraph flags',()=>{
  const r=inspect(['Таким образом, рост на 105% был зафиксирован в исследовании.', 'Сектор организаций описывает различные аспекты развития.']);
  assert.equal(r.stats.authorGuidelines.paragraphsWithNotes,2);
  assert.equal(r.stats.authorGuidelines.verdictImpact,'none');
  assert.ok(r.stats.authorGuidelines.matches>=3);
  assert.ok(r.paras[0].authorGuidelineIds.length>0);
});
test('Bibliography and Word tables are excluded from article prose style checks',()=>{
  const r=inspect(['Таким образом, для организации требуется расчет показателя.',
    'Таким образом, критерий теста сформулирован.']);
  r.paras[0].bib=true;r.paras[1].inTable=true;
  const after=ctx.audit(r);
  assert.equal(after.paragraphsReviewed,0);
  assert.equal(after.matches,0);
});
test('Specialized institutional-sector usage is qualified, not a blanket economic correction',()=>{
  const f=ctx.scan('Институциональный сектор нефинансовых корпораций.',5)
    .find(x=>x.id==='sector');
  assert.ok(f);
  assert.match(f.why,/СНС/);
  assert.match(f.action,/сохраните/);
});
