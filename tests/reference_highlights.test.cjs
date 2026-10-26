'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
function el(name, children=[], attrs={}, content='') {
  const node = { localName:name, namespaceURI:W, children:[], attrs,
    textContent: content, parentNode:null };
  for (const c of children) { c.parentNode=node; node.children.push(c); }
  node.getElementsByTagNameNS=(ns,n)=>{
    const arr=[];const scan=x=>{for(const c of x.children){if(c.namespaceURI===ns&&c.localName===n)arr.push(c);scan(c);}};scan(node);return arr;
  };
  return node;
}
function run(text, highlight, fill) {
  const props = [];
  if (highlight) props.push(el('highlight', [], {val: highlight}));
  if (fill) props.push(el('shd', [], {fill}));
  return el('r', [...(props.length?[el('rPr',props)]:[]), el('t',[],{},text)]);
}
function p(...runs) { return el('p',runs); }
function makeRes(paras) {
  return { paras:paras.map((text,i)=>({
    text, words:text.split(/\s+/).length, i, page:i+1,
    section:'Глава 1', flags:[], toc:false, heading:false, bib:false, inTable:i===1
  })) };
}
function sourceWithMocks() {
  const script=fs.readFileSync(path.join(__dirname,'..','src','reference_highlights.js'),'utf8');
  const ctx={ W_NS:W, MC_NS:MC, childW:(node,name)=>(node?.children||[]).find(x=>x.localName===name&&x.namespaceURI===W)||null,
    wAttr:(node,name)=>node?.attrs?.[name]||null,
    hasAncestor:(node,ns,name,stop)=>{let x=node.parentNode;while(x&&x!==stop){if(x.namespaceURI===ns&&x.localName===name)return true;x=x.parentNode;}return false;}
  };
  vm.runInNewContext(script+'\nthis.review=collectReferenceHighlights; this.color=referenceColor;',ctx);
  return ctx;
}
const ctx=sourceWithMocks();

test('Magenta highlight selects EXACT run text without neighboring words',()=>{
  const body=el('body',[p(run('До '),run('Таким образом, ','magenta'),run('результат проверяется.')),
    p(run('Данные ','','7030A0'),run('неполны.')),
    p(run('Не относится.','yellow'))]);
  const res=makeRes(['До Таким образом, результат проверяется.','Данные неполны.','Не относится.']);
  res.paras[0].flags=[{level:'weak',label:'Справочный стиль',type:'stylo'}];
  const before=JSON.stringify(res);
  const out=ctx.review(res,{getElementsByTagNameNS:(ns,name)=>[body,...body.children].filter(x=>x.namespaceURI===ns&&x.localName===name)},'purple');
  assert.equal(out.fragments.length,2);
  assert.equal(out.fragments[0].text,'Таким образом,');
  assert.equal(out.fragments[0].start,3);
  assert.equal(out.fragments[0].paragraph,1);
  assert.equal(out.fragments[0].category,'Заключительная конструкция');
  assert.equal(out.fragments[0].flags[0].level,'weak');
  assert.equal(out.fragments[1].inTable,true);
  assert.equal(out.fragments[1].text,'Данные');
  assert.equal(out.markedParagraphs,2);
  assert.equal(out.contiguousAreas,1);
  assert.equal(JSON.stringify(res),before,'External highlights must not change native verdict or flags');
});
test('Color picker selects one kind or all without assuming AI authorship',()=>{
  assert.equal(ctx.color('highlight','magenta','purple'),true);
  assert.equal(ctx.color('fill','#7030A0','purple'),true);
  assert.equal(ctx.color('highlight','yellow','purple'),false);
  assert.equal(ctx.color('highlight','yellow','yellow'),true);
  assert.equal(ctx.color('fill','000000','all'),true);
  assert.equal(ctx.color('highlight','none','all'),false);
});
test('No selection is a valid result, no invented machine origin',()=>{
  const body=el('body',[p(run('Рукописный текст с выводом.'))]);
  const res=makeRes(['Рукописный текст с выводом.']);
  const out=ctx.review(res,{getElementsByTagNameNS:(ns,name)=>[body,...body.children].filter(x=>x.namespaceURI===ns&&x.localName===name)},'purple');
  assert.equal(out.fragments.length,0);
  assert.equal(out.selectedChars,0);
  assert.match(out.notice,/не является доказанным авторством/);
});
test('Multiple separated highlights in same paragraph remain independent',()=>{
  const body=el('body',[p(run('Первое','magenta'),run(' без выделения '),run('второе','magenta'))]);
  const res=makeRes(['Первое без выделения второе']);
  const out=ctx.review(res,{getElementsByTagNameNS:(ns,name)=>[body,...body.children].filter(x=>x.namespaceURI===ns&&x.localName===name)},'purple');
  assert.deepEqual(Array.from(out.fragments,x=>x.text),['Первое','второе']);
  assert.equal(out.markedParagraphs,1);
  assert.equal(out.contiguousAreas,1);
});
test('Manual markup report and DOCX comments are independent extensions',()=>{
  const anno=fs.readFileSync(path.join(__dirname,'..','src','annotate.js'),'utf8');
  const report=fs.readFileSync(path.join(__dirname,'..','src','report2.js'),'utf8');
  const analyzer=fs.readFileSync(path.join(__dirname,'..','src','analyzer.js'),'utf8');
  assert.match(analyzer,/collectReferenceHighlights\(res, doc,/);
  assert.match(report,/Приложение В\. Ручные выделения/);
  assert.match(anno,/manualByPara/);
  assert.match(anno,/Действие по проверке внешнего выделения/);
  assert.match(anno,/Do not erase colors/);
});
