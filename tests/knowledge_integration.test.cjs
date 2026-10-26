'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const kb=JSON.parse(fs.readFileSync(path.join(root,'data/marker_evidence.json'),'utf8'));
const src=fs.readFileSync(path.join(root,'src/linguistic_diagnostics.js'),'utf8')+'\n'+
  fs.readFileSync(path.join(root,'src/knowledge_integration.js'),'utf8');
const human=JSON.parse(fs.readFileSync(path.join(root,'data/human_baseline.json'),'utf8'));
const ctx={};
vm.runInNewContext('const HUMAN_BASELINE='+JSON.stringify(human)+';\nconst CHECK_AI_MARKER_KB='+JSON.stringify(kb)+';\n'+src+
 '\nthis.fn={knowledgeAudit,knowledgeBaselineComparison,exportKnowledgeProfile,knowledgeSourceEntry,knowledgeSourceNames};',ctx);
test('All hypotheses and public sources have stable IDs, evidence limits and provenance',()=>{
  assert.ok(kb.entries.length>=20);assert.ok(kb.sources.length>=8);
  const sourceIDs=new Set(kb.sources.map(s=>s.id));
  assert.equal(new Set(kb.entries.map(x=>x.id)).size,kb.entries.length);
  for (const m of kb.entries){
    assert.ok(m.title.length>=8 && m.interpretation.length>=25 && m.action.length>=20);
    assert.ok(m.evidence_status && m.changes_verdict===false);
    assert.ok(m.source_ids.length);
    assert.ok(m.source_ids.every(x=>sourceIDs.has(x)));
  }
  assert.equal(kb.entries.find(x=>x.id==='fourth-word').evidence_status,'unsupported_quantitative_claim');
  assert.equal(kb.entries.find(x=>x.id==='watermark-providers').evidence_status,'provider_verifier_required');
});
test('Source lookup maps exact signal IDs without guessing model identity',()=>{
  const m=ctx.fn.knowledgeSourceEntry('contrast');
  assert.equal(m.id,'style-contrast');
  assert.equal(ctx.fn.knowledgeSourceEntry('unknown-ai-model'),null);
  const names=ctx.fn.knowledgeSourceNames(m.source_ids);
  assert.ok(names.some(s=>s.type==='single_author_statistics'));
});
test('62-paper aggregate reference comparison is descriptive, document-wide and bounded',()=>{
  const res={stats:{stylometry:{rows:[
    {id:'netolko',label:'парные конструкции',value:2.5},
    {id:'commas',label:'запятые на предложение',value:1.6},
    {id:'sentcv',label:'ритм',value:0.1},
    {id:'nonexistent',label:'unknown',value:100}
  ]}}};
  const c=ctx.fn.knowledgeBaselineComparison(res);
  assert.equal(c.status,'computed');assert.equal(c.sampleSize,62);
  assert.equal(c.features.length,3);
  assert.equal(c.features.find(x=>x.id==='netolko').status,'above_p90');
  assert.equal(c.features.find(x=>x.id==='sentcv').status,'below_p10');
  assert.equal(c.scope,'single-author');
});
test('KnowledgeAudit keeps original findings and verdict unchanged, including table paragraphs',()=>{
  const para=(text,i,inTable=false)=>({text,words:text.split(/\s+/).length,i,inTable,flags:[],
    heading:false,toc:false,bib:false,inBox:false});
  const r={kind:'docx',file:{name:'секрет_имя.docx',sha256:'sensitivehash'},
    paras:[para('Следует отметить, что инвестиции имеют значение. Таким образом, метод анализа не подтверждает вывод исследования.',0),
      para('Данные испытаний показывают динамику результата по категориям предприятий и отдельным показателям группы.',1,true)],
    verdict:{text:'Исходный вывод'},findings:[{level:'strong',title:'Существующий маркер'}],
    stats:{counts:{strong:1,medium:0,weak:0},stylometry:null}};
  const oldVerdict=JSON.stringify(r.verdict),oldFindings=JSON.stringify(r.findings);
  const k=ctx.fn.knowledgeAudit(r);
  assert.equal(JSON.stringify(r.verdict),oldVerdict);
  assert.equal(JSON.stringify(r.findings),oldFindings);
  assert.equal(k.paragraphsReviewed,2);
  assert.ok(k.paragraphsWithMappedMarkers>=1);
  assert.equal(k.historicalReference.status,'not_applicable');
  assert.ok(r.paras[0].knowledgeIds.length);
  const out=ctx.fn.exportKnowledgeProfile(r,'machine');
  assert.equal(out.known_origin,'machine');
  const serialized=JSON.stringify(out);
  assert.ok(!serialized.includes('секрет_имя'));
  assert.ok(!serialized.includes('sensitivehash'));
  assert.ok(!serialized.includes('Следует отметить'));
  assert.ok(!serialized.includes('Исходный вывод'));
  assert.ok(!serialized.includes('Существующий маркер'));
  assert.ok(!serialized.includes('документ.docx'));
});
test('Unknown origin stays unknown, with no synthetic probability',()=>{
 const r={kind:'text',stats:{counts:{strong:0,medium:0,weak:0}},paras:[]};
 ctx.fn.knowledgeAudit(r);
 const p=ctx.fn.exportKnowledgeProfile(r,'nonsense');
 assert.equal(p.known_origin,'unknown');assert.equal(p.origin_basis,'user_reported_not_verified');
 assert.ok(!JSON.stringify(p).includes('probability'));
});
