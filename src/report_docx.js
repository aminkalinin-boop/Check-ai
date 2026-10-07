/* ===================================================================
   Формирование экспертного заключения в формате DOCX (OOXML вручную)
   =================================================================== */
'use strict';

const X = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');

function run(text, o = {}) {
  const rPr = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.color ? `<w:color w:val="${o.color}"/>` : '') + (o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : '') + (o.mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : '');
  return `<w:r>${rPr ? '<w:rPr>' + rPr + '</w:rPr>' : ''}<w:t xml:space="preserve">${X(text)}</w:t></w:r>`;
}
function para(content, o = {}) {
  const runs = Array.isArray(content) ? content.map(c => typeof c === 'string' ? run(c) : run(c.t, c)).join('') : run(content, o);
  const pPr = (o.style ? `<w:pStyle w:val="${o.style}"/>` : '') + (o.keep ? '<w:keepNext/>' : '') + (o.num ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : '') + (o.spacingAfter != null ? `<w:spacing w:after="${o.spacingAfter}"/>` : '') + (o.indent === false ? '<w:ind w:firstLine="0"/>' : '') + (o.align ? `<w:jc w:val="${o.align}"/>` : '');
  return `<w:p>${pPr ? '<w:pPr>' + pPr + '</w:pPr>' : ''}${runs}</w:p>`;
}
function table(rows, widths, o = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const grid = widths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  const trs = rows.map((r, ri) => {
    const head = o.header && ri === 0;
    return '<w:tr>' + (head ? '<w:trPr><w:tblHeader/></w:trPr>' : '') + r.map((c, ci) => {
      const cell = typeof c === 'object' && c !== null && !Array.isArray(c) ? c : { t: c };
      const shade = head ? '<w:shd w:val="clear" w:color="auto" w:fill="E7EAF0"/>' : (cell.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${cell.fill}"/>` : '');
      const lines = String(cell.t ?? '').split('\n');
      const ps = lines.map(l => `<w:p><w:pPr><w:pStyle w:val="TableText"/></w:pPr>${run(l, { b: head || cell.b, mono: cell.mono, color: cell.color })}</w:p>`).join('');
      return `<w:tc><w:tcPr><w:tcW w:w="${widths[ci]}" w:type="dxa"/>${shade}</w:tcPr>${ps}</w:tc>`;
    }).join('') + '</w:tr>';
  }).join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/><w:tblW w:w="${total}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${trs}</w:tbl>` + para('', { spacingAfter: 0 });
}
function box(title, lines, fill = 'EEF3FB') {
  const inner = `<w:p><w:pPr><w:pStyle w:val="TableText"/><w:keepNext/></w:pPr>${run(title, { b: true })}</w:p>` + lines.map(l => `<w:p><w:pPr><w:pStyle w:val="TableText"/><w:jc w:val="both"/></w:pPr>${run(l)}</w:p>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="9355" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="8FA6C9"/><w:left w:val="single" w:sz="18" w:color="3B5B92"/><w:bottom w:val="single" w:sz="4" w:color="8FA6C9"/><w:right w:val="single" w:sz="4" w:color="8FA6C9"/></w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="9355"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="9355" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/></w:tcPr>${inner}</w:tc></w:tr></w:tbl>` + para('', { spacingAfter: 0 });
}
const H1 = t => para(t, { style: 'H1', keep: true });
const H2 = t => para(t, { style: 'H2', keep: true });
const P = t => para(t);
const B = t => para(t, { style: 'Bullet' });

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:ind w:firstLine="567"/><w:jc w:val="both"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caps"><w:name w:val="Caps"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:caps/><w:spacing w:val="20"/><w:color w:val="555555"/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="H1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="140"/><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3763"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="H2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Bullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="60"/><w:ind w:left="709" w:hanging="284"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Num"><w:name w:val="Numbered"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:ind w:left="567" w:hanging="340" w:firstLine="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Small"><w:name w:val="Small"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40"/><w:ind w:left="567" w:firstLine="0"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="Grid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="A6AEBB"/><w:left w:val="single" w:sz="4" w:color="A6AEBB"/><w:bottom w:val="single" w:sz="4" w:color="A6AEBB"/><w:right w:val="single" w:sz="4" w:color="A6AEBB"/><w:insideH w:val="single" w:sz="4" w:color="A6AEBB"/><w:insideV w:val="single" w:sz="4" w:color="A6AEBB"/></w:tblBorders></w:tblPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;
}
function numberingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W_NS}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="709" w:hanging="284"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
}

function levelFill(l) { return { strong: 'F8D7D3', medium: 'FCEBC8', weak: 'E4EEF9', info: 'EFEFEF' }[l] || 'FFFFFF'; }

