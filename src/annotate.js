/* ===================================================================
   Копия документа с подсветкой абзацев-признаков и комментариями Word
   =================================================================== */
'use strict';

const RPR_AFTER_SHD = ['fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'];
const FILL = { strong: 'F9C9C3', medium: 'FCE3B0', weak: 'D5E6F7', info: 'E8EDF4' };
const LVL_ORDER = { strong: 3, medium: 2, weak: 1, info: 0 };

function shadeRun(doc, r, fill) {
  let rPr = null;
  for (const c of r.children) if (c.localName === 'rPr' && c.namespaceURI === W_NS) { rPr = c; break; }
  if (!rPr) { rPr = doc.createElementNS(W_NS, 'w:rPr'); r.insertBefore(rPr, r.firstChild); }
  for (const c of [...rPr.children]) if (c.localName === 'shd' || c.localName === 'highlight') rPr.removeChild(c);
  const shd = doc.createElementNS(W_NS, 'w:shd');
  shd.setAttributeNS(W_NS, 'w:val', 'clear'); shd.setAttributeNS(W_NS, 'w:color', 'auto'); shd.setAttributeNS(W_NS, 'w:fill', fill);
  let before = null;
  for (const c of rPr.children) if (RPR_AFTER_SHD.includes(c.localName)) { before = c; break; }
  rPr.insertBefore(shd, before);
}

function ownRuns(p) {
  const out = [];
  const walk = n => { for (const c of n.children) {
    if (c.namespaceURI === MC_NS && c.localName === 'Fallback') continue;
    if (c.namespaceURI === W_NS && c.localName === 'p') continue;
    if (c.namespaceURI === W_NS && c.localName === 'r') { out.push(c); continue; }
    if (c.children.length) walk(c);
  } };
  walk(p);
  return out;
}

function commentXml(id, lines, date) {
  const ps = lines.map((l, k) => `<w:p>${k === 0 ? '<w:pPr><w:pStyle w:val="CommentText"/></w:pPr><w:r><w:annotationRef/></w:r>' : ''}<w:r>${k === 0 ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${X(l)}</w:t></w:r></w:p>`).join('');
  return `<w:comment w:id="${id}" w:author="Проверка ИИ" w:initials="ИИ" w:date="${date}">${ps}</w:comment>`;
}

async function buildAnnotatedDocx(res) {
  if (res.kind !== 'docx' || !res._buf) throw new Error('Подсветка доступна только для файлов .docx');
  const zip = await JSZip.loadAsync(res._buf);
  const doc = parseXml(await zip.file('word/document.xml').async('string'));
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
  const all = [...body.getElementsByTagNameNS(W_NS, 'p')].filter(p => !hasAncestor(p, MC_NS, 'Fallback', body));
  if (all.length !== res.paras.length) console.warn('Число абзацев не совпало', all.length, res.paras.length);

  // существующие комментарии
  let commentsDoc = null, nextId = 0;
  const cf = zip.file('word/comments.xml');
  if (cf) {
    commentsDoc = await cf.async('string');
    for (const m of commentsDoc.matchAll(/<w:comment\b[^>]*w:id="(\d+)"/g)) nextId = Math.max(nextId, +m[1] + 1);
  }
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const newComments = [];
  let marked = 0;

  const addComment = (p, lines) => {
    const id = nextId++;
    const start = doc.createElementNS(W_NS, 'w:commentRangeStart'); start.setAttributeNS(W_NS, 'w:id', id);
    const end = doc.createElementNS(W_NS, 'w:commentRangeEnd'); end.setAttributeNS(W_NS, 'w:id', id);
    let pPr = null; for (const c of p.children) if (c.localName === 'pPr') { pPr = c; break; }
    p.insertBefore(start, pPr ? pPr.nextSibling : p.firstChild);
    p.appendChild(end);
    const r = doc.createElementNS(W_NS, 'w:r');
    const ref = doc.createElementNS(W_NS, 'w:commentReference'); ref.setAttributeNS(W_NS, 'w:id', id);
    r.appendChild(ref); p.appendChild(r);
    newComments.push(commentXml(id, lines, date));
  };

  // сводный комментарий к первому непустому абзацу
  const firstIdx = res.paras.findIndex(p => p.words > 0 && !p.inBox && !p.inTable);
  const v = res.verdict, s = res.stats;
  if (firstIdx >= 0 && all[firstIdx]) addComment(all[firstIdx], [
    'Проверка на признаки ИИ: ' + v.text,
    v.mainSource ? `Вероятный источник: ${v.mainSource}; разметка веб-интерфейса в ${fmtPct(s.markedShare)} связного текста.` : 'Разметки веб-интерфейсов нейросетей не найдено.',
    `Признаков: сильных ${s.counts.strong}, средних ${s.counts.medium}, слабых ${s.counts.weak}.`,
    'Цвета: розовый — сильный признак, жёлтый — средний, голубой — слабый, серо-голубой — справочный показатель краткого текста.',
    'У каждого выделенного абзаца: «Проблема», наблюдение и «Действие по исправлению». Это научная редактура, а не гарантия изменения результатов другого детектора.',
    'Технические метаданные о программной сборке DOCX не доказывают генерацию текста. Сведения о происхождении научного содержания требуют самостоятельного подтверждения.',
    'Это копия для анализа; исходный файл не изменён.',
  ]);

  const manualByPara = new Map();
  if (res.reference) for (const fragment of res.reference.fragments) {
    if (!manualByPara.has(fragment.para)) manualByPara.set(fragment.para, []);
    manualByPara.get(fragment.para).push(fragment);
  }
  res.paras.forEach((para, i) => {
    const flags = para.flags.filter(f => f.level !== 'info' || f.type === 'short');
    const reference = manualByPara.get(i) || [];
    if ((!flags.length && !reference.length) || !all[i]) return;
    const top = flags.reduce((m, f) => LVL_ORDER[f.level] > LVL_ORDER[m] ? f.level : m, 'info');
    const runs = ownRuns(all[i]);
    if (!runs.length) return;
    if (flags.length) {
      runs.forEach(r => {
        // Do not erase colors copied from the source/vendor report.
        if (res.reference) {
          const p = childW(r, 'rPr');
          if (childW(p, 'highlight') || childW(p, 'shd')) return;
        }
        shadeRun(doc, r, FILL[top]);
      });
    }
    marked++;
    if (!para.inBox) {
      const uniq = [...new Map(flags.map(f => [f.label, f])).values()].sort((a, b) => LVL_ORDER[b.level] - LVL_ORDER[a.level]);
      const tasks = uniq.slice(0, 8).flatMap((f, k) => {
        const g = annotationAdvice(f, para);
        return [
          'Проблема ' + (k + 1) + ' [' + (LEVELS[f.level] || 'справочно') + ']: ' + g.issue,
          'Действие по исправлению ' + (k + 1) + ': ' + g.action
        ];
      });
      if (uniq.length > 8) tasks.push('Дополнительных признаков: ' + (uniq.length - 8) + '. Проверьте их в основном заключении.');
      addComment(all[i], [
        'Абзац №' + (i + 1) + ': научная редакторская проверка',
        'Начало: «' + para.text.trim().slice(0, 125) + '»',
        ...tasks,
        ...reference.slice(0, 10).flatMap((f, k) => [
          'Внешнее выделение №' + f.id + ' (' + f.category + '): «' + f.text.slice(0, 380) + '»',
          'Проблема внешнего выделения ' + (k + 1) + ': ' + f.problem,
          'Действие по проверке внешнего выделения ' + (k + 1) + ': ' + f.action,
          'Собственные признаки в этом абзаце: ' +
            (f.flags.filter(z => ['strong','medium','weak'].includes(z.level)).map(z => z.label).join('; ') || 'не найдены')
        ]),
        ...(reference.length > 10 ? ['Остальные внешние выделения в этом абзаце см. в приложении к заключению.'] : []),
        'Ограничение: внешняя подсветка — не подтверждённое авторство; исправления не гарантируют изменение оценки другого детектора.'
      ]);
    }
  });

  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));

  const ns = `xmlns:w="${W_NS}"`;
  if (commentsDoc) zip.file('word/comments.xml', commentsDoc.replace(/<\/w:comments>\s*$/, newComments.join('') + '</w:comments>'));
  else zip.file('word/comments.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments ${ns}>${newComments.join('')}</w:comments>`);

  if (!commentsDoc) {
    const relsPath = 'word/_rels/document.xml.rels';
    let rels = await zip.file(relsPath).async('string');
    if (!/relationships\/comments"/.test(rels)) {
      rels = rels.replace('</Relationships>', '<Relationship Id="rIdAiCheckComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>');
      zip.file(relsPath, rels);
    }
    let ct = await zip.file('[Content_Types].xml').async('string');
    if (!/PartName="\/word\/comments\.xml"/.test(ct)) {
      ct = ct.replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>');
      zip.file('[Content_Types].xml', ct);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return { blob, marked, comments: newComments.length };
}
