/* Дополнительная комплексная экспертиза. Не изменяет findings, verdict, confidence или counts. */
'use strict';
async function expertCrossAudit(res) {
  const checks=[], technical=[], linguistic=[], academic=[], cross=[];
  const push=(group,title,detail,evidence,limit,alternatives)=>{
    const item={group,title,detail,evidence,limit,alternatives};
    checks.push(item); ({technical,linguistic,academic,cross}[group]||academic).push(item);
  };
  const ps=(res.paras||[]).filter(p=>p && p.words>=20 && !p.bib && !p.toc && !p.heading && !p.inTable && !p.inBox);
  const total=ps.reduce((a,p)=>a+p.words,0);
  const countPattern=(re)=>ps.reduce((n,p)=>n+[...p.text.matchAll(re)].length,0);
  const examples=(re,max=4)=>ps.flatMap(p=>[...p.text.matchAll(re)].map(m=>({para:p.i+1,text:p.text.slice(Math.max(0,m.index-45),Math.min(p.text.length,m.index+m[0].length+65))}))).slice(0,max);
  const caution='Не является доказательством генерации ИИ.';
  let technicalOverlap=false, stylisticOverlap=false;
  if(res.kind==='docx' && res._buf) {
    try {
      const zip=await JSZip.loadAsync(res._buf);
      const read=async name=>{const f=zip.file(name); return f?f.async('string'):'';};
      const [xml,core,app]=await Promise.all([read('word/document.xml'),read('docProps/core.xml'),read('docProps/app.xml')]);
      const doc=new DOMParser().parseFromString(xml,'application/xml');
      const nodes=[...doc.getElementsByTagNameNS(W_NS,'p')].filter(p=>{let n=p.parentNode;while(n){if(n.localName==='tbl'&&n.namespaceURI===W_NS)return false;n=n.parentNode;}return true;});
      const distribution={};
      let eligible=0;
      for(const p of nodes){
        const content=[...p.getElementsByTagNameNS(W_NS,'t')].map(x=>x.textContent||'').join('');
        if(content.trim().split(/\s+/u).length<20)continue;
        eligible++;
        const id=p.getAttributeNS(W_NS,'rsidR')||'отсутствует';
        distribution[id]=(distribution[id]||0)+1;
      }
      const ranked=Object.entries(distribution).sort((a,b)=>b[1]-a[1]);
      const leading=ranked[0]||['—',0],share=eligible?leading[1]/eligible:0;
      if(eligible>=8&&share>=0.6){
        technicalOverlap=true;
        push('technical','Повторяющийся идентификатор редакции Word',
          'У значительной части содержательных XML-абзацев совпадает w:rsidR.',
          leading[1]+' из '+eligible+' абзацев ('+Math.round(share*100)+'%), идентификатор '+leading[0]+'.',
          'rsid не определяет время или число операций вставки; возможны копирование, шаблон и обычная работа Word.',caution);
      }
      const nonBreaking=(xml.match(/\u2011/gu)||[]).length;
      if(nonBreaking)push('technical','Неразрывный дефис U+2011','В тексте документа присутствует Unicode U+2011.',
        'Совпадений: '+nonBreaking+'.','Символ встречается в редакторах, переводах и обычных веб-страницах.',caution);
      const parse=new DOMParser();
      const coreDoc=parse.parseFromString(core,'application/xml');
      const get=(tag)=>{let els=coreDoc.getElementsByTagName(tag);if(!els.length)els=coreDoc.getElementsByTagNameNS('*',tag);return els[0]?.textContent?.trim()||'';};
      const title=get('dc:title')||get('title'),subject=get('dc:subject')||get('subject'),keywords=get('cp:keywords')||get('keywords');
      const firstTitle=(res.paras||[]).find(p=>p.words>=3&&!p.inTable&&!p.bib&&!p.toc && p.text.length>35)?.text||'';
      if(title&&firstTitle && title.toLowerCase().replace(/\s+/g,' ')!==firstTitle.toLowerCase().replace(/\s+/g,' ')) {
        push('technical','Служебное название отличается от текста',
          'Название в свойствах DOCX не совпадает с первым содержательным заголовком/абзацем. Сверьте название вручную.',
          'Свойство title: «'+title.slice(0,150)+'».','Эвристика определения заголовка неточна; метаданные могут устареть после обычной редактуры.',caution);
      }
      if(subject||keywords)push('technical','Заполнены дополнительные свойства файла',
        'Свойства subject и/или keywords непустые.',
        'Тема: '+(subject?'заполнена':'не заполнена')+'; ключевые слова: '+(keywords?'заполнены':'не заполнены')+'.',
        'Эти поля заполняются вручную, Word, шаблонами и скриптами; способ их заполнения неизвестен.',caution);
      const tm=(app.match(/<TotalTime>(\d+)<\/TotalTime>/)||[])[1];
      if(tm)push('technical','Служебное время редактирования',
        'Показано записанное в свойствах документа значение, без выводов о времени написания текста.',
        'TotalTime: '+tm+' мин.; слов в содержательных абзацах: '+total+'.',
        'TotalTime не измеряет подготовку текста вне файла, может сбрасываться или изменяться.',caution);
    } catch(e) {
      push('technical','Технические свойства недоступны','Не удалось завершить дополнительный разбор OOXML.',
        String(e.message||e).slice(0,180),'Исходная проверка Check AI продолжает работать независимо.',caution);
    }
  }
  const cautions=/\bне\s+(?:означа\p{L}*|подменя\p{L}*|изменя\p{L}*|требу\p{L}*)/giu;
  const nCaution=countPattern(cautions);
  if(total>=600&&nCaution>=3){
    stylisticOverlap=true;
    push('linguistic','Повторяющиеся отрицательные разграничения',
      'Встречаются конструкции «не означает», «не подменяет», «не изменяет», «не требует».',
      nCaution+' в '+total+' словах. Примеры: '+examples(cautions).map(x=>'абз. '+x.para+': «'+x.text.trim()+'»').join(' | '),
      'Разграничения могут быть необходимы для юридического и методического текста.',caution);
  }
  const starters=/^\s*противоречие\s+между\s+/iu;
  const repeated=ps.filter(p=>starters.test(p.text));
  if(repeated.length>=3){
    stylisticOverlap=true;
    push('linguistic','Однотипное начало абзацев',
      'Несколько самостоятельных абзацев начинаются одной формулой.',
      repeated.length+' абзацев: '+repeated.slice(0,8).map(p=>p.i+1).join(', ')+'.',
      'Может быть сознательной структурой типологии, особенно в научной статье.',caution);
  }
  const lengths=ps.flatMap(p=>p.text.split(/(?<=[.!?…])\s+(?=[А-ЯЁA-Z«])/u).map(s=>s.trim().split(/\s+/u).filter(Boolean).length)).filter(n=>n>=4);
  if(lengths.length>=20) {
    const sorted=[...lengths].sort((a,b)=>a-b);
    push('linguistic','Профиль длины предложений',
      'Описательная статистика; без независимого корпуса не классифицирует авторство.',
      'Предложений '+lengths.length+'; медиана '+sorted[Math.floor(sorted.length/2)]+' слов; максимум '+sorted[sorted.length-1]+'.',
      'Для жанра и автора допустимы разные распределения длины.',caution);
  }
  const all=ps.map(p=>p.text).join(' ');
  if(/\b(?:цель исследования|сравнительн\p{L}* анализ|структурно-функциональн\p{L}* анализ)/iu.test(all)) {
    push('academic','Соответствие заявленных методов результатам',
      'Требуется экспертная проверка цепочки «метод → операция → данные → результат → вывод».',
      'В тексте найдена методологическая формулировка. Автоматическая проверка фактического выполнения метода не проводилась.',
      'Краткая теоретическая статья может не содержать отдельных расчётов и таблиц.',caution);
  }
  const citations=[...all.matchAll(/\[(\d{1,3})\]/gu)].map(m=>m[1]);
  if(citations.length)push('academic','Содержательная проверка ссылок',
    'Проверить, действительно ли цитируемые публикации подтверждают утверждения в местах ссылок.',
    'В основном тексте обнаружено '+citations.length+' ссылок на '+new Set(citations).size+' записей.',
    'Само наличие ссылок и различия в их оформлении не устанавливают генерацию.',caution);
  if(technicalOverlap&&stylisticOverlap)push('cross','Совпадение технического и языкового наблюдений',
    'Одновременно найдены признаки однородной редакционной истории и повторяющиеся речевые структуры.',
    'Сопоставлены разные группы наблюдений, без добавления баллов в старую классификацию.',
    'Причины могут быть независимыми; единый источник генерации не установлен.',caution);
  res.expertAudit={version:'1.0',checks,byGroup:{technical:technical.length,linguistic:linguistic.length,academic:academic.length,cross:cross.length},
    disclaimer:'Дополнительный аудит. Наблюдения не оценивают вероятность машинного авторства и не изменяют исходный вердикт Check AI.'};
  return res.expertAudit;
}
