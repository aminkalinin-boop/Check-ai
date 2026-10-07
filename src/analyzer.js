/* ===================================================================
   Анализатор DOCX на признаки применения генеративного ИИ
   Работает полностью локально в браузере.
   =================================================================== */
'use strict';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const APP_VERSION = '3.2';

/* ---------------- хеши (MD5 / SHA-256) ---------------- */
function md5(buf) {
  const bytes = new Uint8Array(buf);
  const K = new Uint32Array(64), S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  const len = bytes.length, nBlocks = ((len + 8) >>> 6) + 1, words = new Uint32Array(nBlocks * 16);
  for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[len >> 2] |= 0x80 << ((len % 4) * 8);
  const bitLen = len * 8;
  words[nBlocks * 16 - 2] = bitLen >>> 0;
  words[nBlocks * 16 - 1] = Math.floor(bitLen / 4294967296);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let blk = 0; blk < nBlocks; blk++) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + words[blk * 16 + g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  return [a0, b0, c0, d0].map(v => { let s = ''; for (let i = 0; i < 4; i++) s += ((v >>> (i * 8)) & 255).toString(16).padStart(2, '0'); return s; }).join('');
}

function sha256js(buf) {
  const bytes = new Uint8Array(buf);
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const len = bytes.length, nBlocks = ((len + 8) >>> 6) + 1, w = new Uint32Array(nBlocks * 16);
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  w[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  w[nBlocks * 16 - 1] = (len * 8) >>> 0;
  w[nBlocks * 16 - 2] = Math.floor(len * 8 / 4294967296);
  const M = new Uint32Array(64);
  const r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let b = 0; b < nBlocks; b++) {
    for (let t = 0; t < 16; t++) M[t] = w[b * 16 + t];
    for (let t = 16; t < 64; t++) {
      const s0 = r(M[t-15],7) ^ r(M[t-15],18) ^ (M[t-15] >>> 3);
      const s1 = r(M[t-2],17) ^ r(M[t-2],19) ^ (M[t-2] >>> 10);
      M[t] = (M[t-16] + s0 + M[t-7] + s1) >>> 0;
    }
    let [a,bb,c,d,e,f,g,h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = r(e,6) ^ r(e,11) ^ r(e,25), ch = (e & f) ^ (~e & g);
      const T1 = (h + S1 + ch + K[t] + M[t]) >>> 0;
      const S0 = r(a,2) ^ r(a,13) ^ r(a,22), maj = (a & bb) ^ (a & c) ^ (bb & c);
      const T2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + T1) >>> 0; d = c; c = bb; bb = a; a = (T1 + T2) >>> 0;
    }
    H = [(H[0]+a)>>>0,(H[1]+bb)>>>0,(H[2]+c)>>>0,(H[3]+d)>>>0,(H[4]+e)>>>0,(H[5]+f)>>>0,(H[6]+g)>>>0,(H[7]+h)>>>0];
  }
  return H.map(v => v.toString(16).padStart(8, '0')).join('');
}

async function sha256(buf) {
  try {
    if (window.crypto && crypto.subtle) {
      const d = await crypto.subtle.digest('SHA-256', buf);
      return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* file:// в некоторых браузерах */ }
  return sha256js(buf);
}

/* ---------------- справочники признаков ---------------- */

// Сигнатуры стилей/классов, попадающих в Word при копировании из веб-интерфейсов
const STYLE_SIGNATURES = [
  { re: /^ds-|ds-markdown/i, source: 'DeepSeek', level: 'strong',
    note: 'Классы семейства «ds-markdown-*» используются в разметке ответов веб-интерфейса DeepSeek.' },
  { re: /font-claude|standard-markdown|progressive-markdown|claude-message|claude-response/i, source: 'Claude (claude.ai)', level: 'strong',
    note: 'Классы разметки ответов веб-интерфейса Claude.' },
  { re: /markdown-main-panel|model-response|response-container-content|gemini/i, source: 'Google Gemini', level: 'strong',
    note: 'Классы разметки ответов веб-интерфейса Gemini.' },
  { re: /^ng-star-inserted\d*$|^ng-tns-|^_ngcontent|^_nghost|^ng-trigger/i, source: 'Angular-разметка (Google Gemini / AI Studio и др.)', level: 'medium',
    note: 'Служебный класс фреймворка Angular («ng-star-inserted»). На Angular построены веб-интерфейсы Google Gemini и Google AI Studio, но также и множество других сайтов; сам по себе маркер сервис не устанавливает.' },
  { re: /qwen/i, source: 'Qwen (Alibaba)', level: 'strong', note: 'Классы разметки веб-интерфейса Qwen.' },
  { re: /gigachat|giga-chat/i, source: 'GigaChat', level: 'strong', note: 'Классы разметки веб-интерфейса GigaChat.' },
  { re: /perplexity|pplx/i, source: 'Perplexity', level: 'strong', note: 'Классы разметки веб-интерфейса Perplexity.' },
  { re: /yandexgpt|yagpt|alice-|alice_/i, source: 'Алиса / YandexGPT', level: 'medium', note: 'Классы, характерные для веб-интерфейса Яндекса с нейросетью.' },
  { re: /^(markdown|prose|markdown prose|text-message|whitespace-pre-wrap|break-words)$|text-token-text|dark:prose|result-streaming/i, source: 'ChatGPT / чат-интерфейсы на Tailwind', level: 'medium',
    note: 'Имена классов «markdown», «prose» и т. п. используются в разметке ответов ChatGPT и ряда других чат-интерфейсов.' },
  { re: /^(katex|katex-mathml|katex-html|katex-display|mord|mopen|mclose|mrel|mbin|mpunct|minner|mop|mspace|msupsub|mfrac|vlist|vlist-t|vlist-t2|vlist-r|vlist-s|strut|pstrut|base|sizing|reset-size\d*|size\d+|mathnormal|mathrm|mathbf|mtight|frac-line|delimsizing|mult|nulldelimiter)$/i,
    source: 'KaTeX (формулы веб-страницы)', level: 'medium',
    note: 'Служебные классы библиотеки KaTeX. Появляются при копировании формул из чат-ботов (ChatGPT, DeepSeek, Claude и др.) и некоторых сайтов.' },
  { re: /^mjx|mathjax/i, source: 'MathJax (формулы веб-страницы)', level: 'weak',
    note: 'Классы библиотеки MathJax — формулы скопированы с веб-страницы.' },
];
const HTML_STYLE_NAMES = /^(normal \(web\)|html preformatted|html code|html typewriter|html sample|html variable|html keyboard|html cite|html acronym|html address|html definition|html bottom of form|html top of form)$/i;

const CHATBOT_PHRASES = [
  /(^|[\s«"(])Конечно[,!]\s+(вот|давайте|ниже|я\s|сейчас|с\s+удовольствием|помогу|подготовлю|держите)/iu,
  /(?<!\p{L})Вот\s+(переработанн|исправленн|отредактированн|улучшенн|обновл[её]нн|доработанн|примерн|готов|краткий|полный|расширенн|структурированн)\p{L}*/iu,
  /Надеюсь,?\s+(это|эта|этот|данный|такой)\s+\p{L}*\s*помож/iu,
  /Если\s+(вам\s+)?(нужно|понадобится|потребуется|хотите)[^.!?]{0,60}(могу|помогу|подготовлю|сделаю|дополню|перепишу|оформлю)/iu,
  /Хотите,?\s+(я|чтобы\s+я)(?!\p{L})/iu,
  /Дайте\s+(мне\s+)?знать/iu,
  /(?<!\p{L})Могу\s+(также\s+|ещё\s+|еще\s+)?(подготовить|помочь|сделать|дополнить|расширить|переписать|оформить|составить)/iu,
  /как\s+(языковая\s+модель|ИИ-ассистент|искусственный\s+интеллект,?\s+я)/iu,
  /Отличный\s+вопрос/iu,
  /Давайте\s+(разбер[её]м|рассмотрим\s+подробнее|начн[её]м)/iu,
  /Ниже\s+(представлен|приведен|приведён|приведены|представлены)\p{L}*\s+(переработанн|вариант|пример|текст|обновл)/iu,
  /(переработанный|обновл[её]нный|улучшенный)\s+вариант\s+(абзаца|текста|параграфа|раздела)/iu,
  /с\s+уч[её]том\s+(ваших|Ваших)\s+(замечаний|пожеланий|правок)/iu,
  /(?<!\p{L})(Sure|Certainly)[,!]\s/u,
  /\bHere\s+is\s+(the|a|an|your)\b/iu,
  /\bI\s+hope\s+this\s+helps/iu,
  /\bAs\s+an\s+AI\b/iu,
  /\bLet\s+me\s+know\b/iu,
];
const PLACEHOLDER_RE = /\[(вставить|указать|добавить|источник|ссылка|ссылку|ФИО|название|год|автор|цитата|дата|номер)[^\]]{0,40}\]|\bTODO\b|ДОПИСАТЬ|ДОРАБОТАТЬ|\?\?\?|\bXXX\b/i;

const CLICHES = [
  ['таким образом', /таким\s+образом/giu],
  ['важно/стоит/следует отметить', /(важно|стоит|следует|необходимо)\s+(отметить|подчеркнуть)/giu],
  ['играет ключевую роль', /игра\p{L}*\s+(ключев|важн|решающ)\p{L}*\s+рол/giu],
  ['ключевой / ключевым', /(?<!\p{L})ключев\p{L}+/giu],
  ['в современных условиях', /в\s+современных\s+условиях/giu],
  ['комплексный', /(?<!\p{L})комплексн\p{L}+/giu],
  ['не только … но и', /не\s+только/giu],
  ['позволяет', /(?<!\p{L})позволя\p{L}+/giu],
  ['в свою очередь', /в\s+свою\s+очередь/giu],
  ['многогранный / многоаспектный', /(?<!\p{L})(многогранн|многоаспектн)\p{L}*/giu],
  ['синергия / синергетический', /(?<!\p{L})синерги\p{L}*/giu],
  ['трансформация', /(?<!\p{L})трансформаци\p{L}*/giu],
  ['экосистема', /(?<!\p{L})экосистем\p{L}*/giu],
  ['драйвер', /(?<!\p{L})драйвер\p{L}*/giu],
  ['императив', /(?<!\p{L})императив\p{L}*/giu],
  ['фундаментальный', /(?<!\p{L})фундаментальн\p{L}*/giu],
  ['целостный', /(?<!\p{L})целостн\p{L}*/giu],
  ['интеграция', /(?<!\p{L})интеграци\p{L}*/giu],
  ['эффективность', /(?<!\p{L})эффективност\p{L}*/giu],
];

const GENERATOR_MARKERS = [
  { re: /python-docx/i, label: 'python-docx (программная генерация на Python)' },
  { re: /^un-named$/i, label: 'docx.js — «Un-named» (программная генерация на JavaScript)' },
  { re: /docx4j|phpword|aspose|openpyxl|pandoc|officegen|docxtemplater|apache poi/i, label: 'библиотека программной генерации документов' },
];
const LINUX_FONTS = /liberation|dejavu|noto sans|noto serif|carlito|caladea|free(sans|serif|mono)/i;
const IMAGE_AI_TOKENS = ['c2pa', 'jumb', 'trainedAlgorithmicMedia', 'compositeWithTrainedAlgorithmicMedia', 'OpenAI', 'ChatGPT', 'DALL', 'Anthropic', 'Claude', 'Midjourney', 'Stable Diffusion', 'Firefly', 'Imagen', 'Gemini', 'SynthID', 'Kandinsky', 'Шедеврум', 'NovelAI', 'Leonardo'];

const LEVELS = { strong: 'Сильный', medium: 'Средний', weak: 'Слабый', info: 'Справочно' };

/* ---------------- утилиты ---------------- */
const WORD_RE = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;
function countWords(t) { const m = t.match(WORD_RE); return m ? m.length : 0; }
function snippet(t, idx, len = 160) {
  if (idx == null) return t.length > len ? t.slice(0, len) + '…' : t;
  const s = Math.max(0, idx - 60), e = Math.min(t.length, idx + len - 60);
  return (s > 0 ? '…' : '') + t.slice(s, e) + (e < t.length ? '…' : '');
}
function pct(a, b) { return b ? (100 * a / b) : 0; }
function fmtPct(v) { return v.toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '%'; }
function fmtNum(v) { return Number(v).toLocaleString('ru-RU'); }
function hasAncestor(el, ns, name, stop) {
  let p = el.parentNode;
  while (p && p !== stop) { if (p.localName === name && p.namespaceURI === ns) return true; p = p.parentNode; }
  return false;
}
function parseXml(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
function wAttr(el, name) { return el ? (el.getAttributeNS(W_NS, name) ?? el.getAttribute('w:' + name)) : null; }
function childW(el, name) { if (!el) return null; for (const c of el.children) if (c.localName === name) return c; return null; }
function translit(s) { const m = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ы:'y',э:'e',ю:'yu',я:'ya',ь:'',ъ:''}; return s.split('').map(c => m[c] ?? c).join(''); }
function stem(s) { s = s.toLowerCase().replace(/ё/g, 'е'); return s.length > 5 ? s.slice(0, s.length - 2) : s.slice(0, Math.max(3, s.length - 1)); }

/* ---------------- чтение абзацев ---------------- */
function extractParagraphText(p, onFootnote) {
  let text = '';
  const walk = (node) => {
    for (const c of node.children) {
      const ln = c.localName;
      if (c.namespaceURI === MC_NS && ln === 'Fallback') continue;
      if (ln === 'p' && c.namespaceURI === W_NS) continue; // вложенные абзацы (надписи) обрабатываются отдельно
      if (ln === 't') text += c.textContent;
      else if (ln === 'tab') text += ' ';
      else if (ln === 'br' || ln === 'cr') text += ' ';
      else if (ln === 'noBreakHyphen') text += '‑';
      else if (ln === 'softHyphen') text += '­';
      else if (ln === 'delText' || ln === 'instrText') continue;
      else if (ln === 'footnoteReference' || ln === 'endnoteReference') { if (onFootnote) onFootnote(wAttr(c, 'id'), text, ln); }
      else if (c.children.length) walk(c);
    }
  };
  walk(p);
  return text;
}

/* ================= ОСНОВНОЙ АНАЛИЗ ================= */
async function analyzeFile(file, onProgress = () => {}) {
  const buf = await file.arrayBuffer();
  onProgress('Контрольные суммы…');
  const res = {
    tool: APP_VERSION,
    date: new Date(),
    file: { name: file.name, size: file.size, md5: md5(buf), sha256: await sha256(buf) },
    kind: /\.(txt|md)$/i.test(file.name) ? 'text' : 'docx',
    _buf: buf,
    meta: {}, styles: [], paras: [], sections: [], footnotes: [], media: [], findings: [],
    stats: {},
  };
  if (res.kind === 'text') {
    const text = new TextDecoder('utf-8').decode(buf);
    text.split(/\r?\n\s*\r?\n|\r?\n/).forEach((t, i) => { if (t.trim()) res.paras.push(mkPara(res.paras.length, t.trim(), null, null, false, false)); });
    textChecks(res, onProgress);
    contentChecks(res);
    dashChecks(res);
    finalize(res);
    return res;
  }
  onProgress('Распаковка DOCX…');
  let zip;
  try { zip = await JSZip.loadAsync(buf); }
  catch (e) { throw new Error('Файл не является корректным DOCX (не удалось распаковать). Старый формат .doc нужно сначала пересохранить в .docx.'); }
  const read = async (p) => { const f = zip.file(p); return f ? await f.async('string') : null; };
  res.parts = Object.keys(zip.files).filter(n => !zip.files[n].dir);

  const docXml = await read('word/document.xml');
  if (!docXml) throw new Error('В архиве нет word/document.xml — это не документ Word.');

  onProgress('Метаданные…');
  await readMeta(res, zip, read);

  onProgress('Стили…');
  const stylesXml = await read('word/styles.xml');
  const styleMap = readStyles(res, stylesXml);

  const relsXml = (await read('word/_rels/document.xml.rels')) || '';
  res.relsMap = {}; for (const m of relsXml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)) res.relsMap[m[1]] = m[2];
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*\bId="([^"]+)"/g)) res.relsMap[m[2]] = m[1];
  onProgress('Текст документа…');
  const doc = parseXml(docXml);
  const fnRefs = [];
  readParagraphs(res, doc, styleMap, fnRefs);

  onProgress('Сноски…');
  const fnXml = await read('word/footnotes.xml');
  readFootnotes(res, fnXml, fnRefs);

  res.meta.comments = 0;
  const cm = await read('word/comments.xml');
  if (cm) res.meta.comments = (cm.match(/<w:comment\b/g) || []).length;
  res.meta.insertions = (docXml.match(/<w:ins\b/g) || []).length;
  res.meta.deletions = (docXml.match(/<w:del\b/g) || []).length;
  res.meta.tables = doc.getElementsByTagNameNS(W_NS, 'tbl').length;
  res.meta.charts = res.parts.filter(p => /^word\/charts\/chart\d*\.xml$/.test(p)).length;
  res.meta.embeddings = res.parts.filter(p => /^word\/embeddings\//.test(p)).length;
  res.meta.altChunk = (docXml.match(/<w:altChunk\b/g) || []).length;
  res.meta.shapes = (docXml.match(/<w:txbxContent\b/g) || []).length;

  const fontTable = (await read('word/fontTable.xml')) || '';
  const fontNames = new Set([...fontTable.matchAll(/<w:font w:name="([^"]+)"/g)].map(m => m[1]));
  [...docXml.matchAll(/w:ascii="([^"]+)"/g)].forEach(m => fontNames.add(m[1]));
  res.meta.fonts = [...fontNames];

  onProgress('Изображения…');
  await readMedia(res, zip);
  onProgress('Ссылки и поля…');
  await readLinksAndFields(res, zip, doc, docXml);
  await readStructure(res, zip, doc, docXml);

  onProgress('Проверки текста…');
  styleChecks(res);
  metaChecks(res);
  textChecks(res, onProgress);
  onProgress('Содержательный анализ…');
  contentChecks(res);
  figureChecks(res);
  dashChecks(res);
  finalize(res);
  return res;
}

async function readMeta(res, zip, read) {
  const m = res.meta;
  const core = await read('docProps/core.xml');
  const app = await read('docProps/app.xml');
  const settings = await read('word/settings.xml');
  const tag = (x, t) => { if (!x) return null; const r = new RegExp('<(?:[a-z]+:)?' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z]+:)?' + t + '>'); const mm = x.match(r); return mm ? mm[1].replace(/<[^>]+>/g, '').trim() : null; };
  m.hasCore = !!core; m.hasApp = !!app;
  m.creator = tag(core, 'creator'); m.lastModifiedBy = tag(core, 'lastModifiedBy');
  m.title = tag(core, 'title'); m.subject = tag(core, 'subject'); m.keywords = tag(core, 'keywords'); m.description = tag(core, 'description');
  m.revision = tag(core, 'revision'); m.created = tag(core, 'created'); m.modified = tag(core, 'modified');
  m.application = tag(app, 'Application'); m.appVersion = tag(app, 'AppVersion'); m.template = tag(app, 'Template');
  m.totalTime = tag(app, 'TotalTime'); m.pages = tag(app, 'Pages'); m.metaWords = tag(app, 'Words'); m.company = tag(app, 'Company');
  m.rsids = settings ? (settings.match(/<w:rsid\s/g) || []).length : 0;
  const custom = await read('docProps/custom.xml');
  m.customProps = custom ? [...custom.matchAll(/name="([^"]+)"/g)].map(x => x[1]) : [];
}

function readStyles(res, xml) {
  const map = {};
  if (!xml) return map;
  const d = parseXml(xml);
  for (const s of d.getElementsByTagNameNS(W_NS, 'style')) {
    const id = wAttr(s, 'styleId');
    const nameEl = childW(s, 'name');
    const name = nameEl ? wAttr(nameEl, 'val') : id;
    const custom = wAttr(s, 'customStyle') === '1' || wAttr(s, 'customStyle') === 'true';
    const type = wAttr(s, 'type');
    const basedOn = childW(s, 'basedOn');
    const pPr = childW(s, 'pPr');
    const outline = pPr ? childW(pPr, 'outlineLvl') : null;
    const st = { id, name, custom, type, basedOn: basedOn ? wAttr(basedOn, 'val') : null,
      outline: outline ? +wAttr(outline, 'val') : null,
      paras: 0, words: 0, bodyParas: 0, bodyWords: 0, tableParas: 0, runs: 0, runWords: 0 };
    classifyStyle(st);
    map[id] = st;
    res.styles.push(st);
  }
  return map;
}

function classifyStyle(st) {
  const n = (st.name || '').trim(), id = st.id || '';
  for (const sig of STYLE_SIGNATURES) {
    if (sig.re.test(n) || sig.re.test(id)) { st.category = 'webui'; st.source = sig.source; st.level = sig.level; st.note = sig.note; return; }
  }
  if (st.custom && (/[:\/\[]/.test(n) || /^(m|p)[xytblrse]?-\d+(\.\d+)?$|^(whitespace|text|font|leading|tracking|rounded|gap|space-[xy]|border|bg|items|justify|overflow|break|min-w|max-w|line-clamp)-[a-z0-9.-]+$|^(flex|grid|inline-block|relative|absolute|truncate)$/i.test(n))) {
    st.category = 'webui'; st.source = 'Tailwind CSS (ChatGPT, Claude, Perplexity и др. чат-интерфейсы)'; st.level = 'medium';
    st.note = 'Служебные классы CSS-фреймворка Tailwind (например, «my-2», «whitespace-normal», «group-hover/…»). Tailwind используют веб-интерфейсы ChatGPT, Claude, Perplexity и многие другие сайты.'; return;
  }
  if (st.custom && /^xl\d+$/i.test(n)) { st.category = 'excel'; st.source = 'Вставка таблицы из Excel'; st.level = 'info'; st.note = 'Стили «xl63…» появляются при вставке таблиц из Excel — признак работы с собственными расчётами.'; return; }
  if (st.custom && /^msonormal$/i.test(n)) { st.category = 'junk'; st.source = 'Вставка из Outlook / HTML-версии Word'; st.level = 'info'; return; }
  if (HTML_STYLE_NAMES.test(n)) { st.category = 'html'; st.source = 'Вставка HTML из браузера'; st.level = 'weak'; st.note = 'Стиль Word, создаваемый при вставке фрагмента веб-страницы.'; return; }
  if (/знак$|char$/i.test(n)) { st.category = 'linked'; return; }
  if (st.custom && /^[a-z0-9_-]{6,}$/i.test(n) && (n.match(/\d/g) || []).length >= 2 && (n.match(/[a-z]/gi) || []).length >= 2) {
    st.category = 'hash'; st.source = 'Хеш-имя CSS-класса веб-страницы'; st.level = 'medium';
    st.note = 'Автоматически сгенерированное имя класса (так именуют стили современные веб-приложения). Человек такие стили не создаёт.'; return;
  }
  if (st.custom && /^\d+$/.test(n)) { st.category = 'junk'; st.source = 'Служебный стиль при копировании'; st.level = 'info'; return; }
  if (st.custom && /^(обычный|normal|заголовок оглавления|heading)\S*\d$/i.test(n.replace(/\s+/g, ' '))) { st.category = 'junk'; st.source = 'Копия встроенного стиля (перенос между документами)'; st.level = 'info'; return; }
  st.category = st.custom ? 'custom' : 'builtin';
}

function isHeadingStyle(st) {
  if (!st) return false;
  const n = (st.name || '').toLowerCase();
  if (/^toc|оглавлен/.test(n)) return false;
  return /^heading \d|^title$|^заголовок \d|^название$/.test(n) || st.outline != null && st.outline < 9;
}
function isTocStyle(st) { return st && /^toc \d|^оглавление \d|^toc heading|заголовок оглавления/i.test(st.name || ''); }

function mkPara(i, text, styleId, styleName, inTable, inBox) {
  return { i, text, words: countWords(text), styleId, styleName, inTable, inBox, heading: false, toc: false, flags: [], section: '', objects: [], webRuns: [] };
}

function readParagraphs(res, doc, styleMap, fnRefs) {
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0] || doc.documentElement;
  const ps = body.getElementsByTagNameNS(W_NS, 'p');
  let section = 'Начало документа';
  const sectionsMap = new Map();
  const useRendered = body.getElementsByTagNameNS(W_NS, 'lastRenderedPageBreak').length > 0;
  res.meta.pageSource = useRendered ? 'rendered' : 'explicit';
  let page = 1;
  const tblIndex = new Map(); res.tables = [];
  let lastCaption = null, lastCaptionIdx = -99;
  const outerTbl = (el) => { let p = el.parentNode, found = null; while (p && p !== body) { if (p.localName === 'tbl' && p.namespaceURI === W_NS) found = p; p = p.parentNode; } return found; };
  for (const p of ps) {
    if (hasAncestor(p, MC_NS, 'Fallback', body)) continue;
    const inTable = hasAncestor(p, W_NS, 'tbl', body);
    const inBox = hasAncestor(p, W_NS, 'txbxContent', body);
    const pPr = childW(p, 'pPr');
    const ps_ = pPr ? childW(pPr, 'pStyle') : null;
    const styleId = ps_ ? wAttr(ps_, 'val') : null;
    const st = styleId ? styleMap[styleId] : null;
    const idx = res.paras.length;
    const localRefs = [];
    const text = extractParagraphText(p, (id, before, kind) => { if (kind === 'footnoteReference') localRefs.push({ id, before }); });
    const para = mkPara(idx, text, styleId, st ? st.name : (styleId || 'Normal'), inTable, inBox);
    // страница (по последней разметке Word либо по явным разрывам)
    if (pPr && childW(pPr, 'pageBreakBefore') && !useRendered) page++;
    para.page = page;
    let brk = 0;
    if (useRendered) { for (const b of p.getElementsByTagNameNS(W_NS, 'lastRenderedPageBreak')) if (!hasAncestor(b, MC_NS, 'Fallback', p)) brk++; }
    else for (const b of p.getElementsByTagNameNS(W_NS, 'br')) if (wAttr(b, 'type') === 'page') brk++;
    // если разрыв стоит в самом начале абзаца, абзац уже на новой странице
    if (brk && text.trim() === '' ) { page += brk; para.page = page; brk = 0; }
    page += brk;
    // таблица и её подпись
    const capM = !inTable && text.trim().match(/^\s*Таблица\s*([А-ЯA-Z]?\.?\d+(?:\.\d+)*)/);
    const contM = !inTable && text.trim().match(/^\s*(Продолжение|Окончание)\s+табл(?:ицы|\.)\s*([А-ЯA-Z]?\.?\d+(?:\.\d+)*)/i);
    if (capM) { lastCaption = text.trim().replace(/\s+/g, ' ').slice(0, 160); lastCaptionIdx = idx; }
    else if (contM) { lastCaption = 'Таблица ' + contM[2] + ' (продолжение)'; lastCaptionIdx = idx; }
    if (inTable) {
      const tb = outerTbl(p);
      if (!tblIndex.has(tb)) {
        tblIndex.set(tb, res.tables.length);
        res.tables.push({ n: res.tables.length, caption: (idx - lastCaptionIdx <= 6) ? lastCaption : null, page, firstPara: idx, section, paras: [] });
      }
      para.table = tblIndex.get(tb);
      res.tables[para.table].paras.push(idx);
    }
    para.webRuns = [];
    para.objects = paragraphObjects(p, res);
    para.hasNum = !!(pPr && childW(pPr, 'numPr'));
    const outl = pPr ? childW(pPr, 'outlineLvl') : null;
    para.toc = isTocStyle(st) || /^\s*(\S.*?)\s*\.{3,}\s*\d+\s*$/.test(text);
    const t = text.trim();
    const textLooksHeading = t.length > 2 && t.length < 220 && !inTable && !inBox &&
      (/^(ГЛАВА|Глава)\s*\d/.test(t) || /^(ВВЕДЕНИЕ|ЗАКЛЮЧЕНИЕ|СПИСОК\s+(ИСПОЛЬЗОВАННЫХ|ЛИТЕРАТУРЫ)|БИБЛИОГРАФИЧЕСКИЙ СПИСОК|ПРИЛОЖЕНИ[ЕЯ]|Введение|Заключение|Список\s+(использованных|литературы))(?!\p{L})/u.test(t) ||
       /^\d+\.\d+\.?\s+[А-ЯЁA-Z]/.test(t) && !/[.;:]$/.test(t) && countWords(t) < 30);
    para.heading = !para.toc && t.length > 0 && (isHeadingStyle(st) || (outl && +wAttr(outl, 'val') < 9) || textLooksHeading);
    if (para.heading) {
      section = t.replace(/\s+/g, ' ').slice(0, 140);
    }
    para.section = section;
    // стили знаков
    for (const rs of p.getElementsByTagNameNS(W_NS, 'rStyle')) {
      const sid = wAttr(rs, 'val'); const s2 = styleMap[sid];
      if (!s2) continue;
      const run = rs.parentNode && rs.parentNode.parentNode;
      let rt = '';
      if (run) for (const tEl of run.getElementsByTagNameNS(W_NS, 't')) rt += tEl.textContent;
      s2.runs++; s2.runWords += countWords(rt);
      if (rt.trim()) { s2.nonEmptyRuns = (s2.nonEmptyRuns || 0) + 1; s2.runChars = (s2.runChars || 0) + rt.replace(/\s/g, '').length; (s2.runParaSet = s2.runParaSet || new Set()).add(idx); }
      if (s2.category === 'webui' && rt.trim()) para.webRuns.push(rt.trim());
      if (s2.category && !['builtin', 'custom', 'linked', 'excel'].includes(s2.category)) para.flags.push({ type: 'rstyle', key: sid, level: s2.level, label: 'Стиль знаков «' + s2.name + '»' });
    }
    if (st) {
      st.paras++; st.words += para.words;
      if (!inTable && !inBox) { st.bodyParas++; st.bodyWords += para.words; }
      if (inTable) st.tableParas++;
      if (st.category && !['builtin', 'custom', 'linked', 'excel'].includes(st.category)) para.flags.push({ type: 'style', key: styleId, level: st.level, label: 'Стиль «' + st.name + '» (' + st.source + ')' });
    }
    para.flags = [...new Map(para.flags.map(f => [f.type + f.key, f])).values()];
    for (const r of localRefs) fnRefs.push({ id: r.id, para: idx, before: r.before });
    res.paras.push(para);
    if (!para.toc && !para.heading && !inTable && !inBox && para.words) {
      if (!sectionsMap.has(section)) sectionsMap.set(section, { title: section, words: 0, marked: 0, paras: 0 });
    }
  }
}

function readFootnotes(res, xml, fnRefs) {
  if (!xml) return;
  const d = parseXml(xml);
  const byId = {};
  for (const fn of d.getElementsByTagNameNS(W_NS, 'footnote')) {
    const type = wAttr(fn, 'type');
    if (type === 'separator' || type === 'continuationSeparator' || type === 'continuationNotice') continue;
    const id = wAttr(fn, 'id');
    let text = '';
    for (const p of fn.getElementsByTagNameNS(W_NS, 'p')) text += extractParagraphText(p) + ' ';
    text = text.replace(/\s+/g, ' ').trim();
    byId[id] = { id, text, num: 0, para: null, before: '' };
  }
  let num = 0;
  for (const r of fnRefs) {
    const f = byId[r.id]; if (!f) continue;
    f.num = ++num; f.para = r.para; f.before = r.before;
  }
  res.footnotes = Object.values(byId).filter(f => f.num).sort((a, b) => a.num - b.num);
}

async function readMedia(res, zip) {
  const files = res.parts.filter(p => /^word\/media\//.test(p));
  for (const p of files) {
    const u8 = await zip.file(p).async('uint8array');
    const s = new TextDecoder('latin1').decode(u8);
    const hits = IMAGE_AI_TOKENS.filter(t => s.includes(t));
    const sdParams = /tEXtparameters/.test(s) || /Negative prompt:/.test(s);
    if (sdParams) hits.push('Stable Diffusion (параметры генерации в PNG)');
    const c2pa = hits.includes('c2pa') || hits.includes('jumb');
    const aiTokens = hits.filter(h => !['c2pa', 'jumb'].includes(h));
    const dims = imageDims(u8); res.mediaInfo = res.mediaInfo || {}; if (dims) res.mediaInfo[p.replace('word/media/', '')] = dims;
    res.media.push({ path: p.replace('word/media/', ''), size: u8.length, c2pa, aiTokens, dims });
  }
}

async function readLinksAndFields(res, zip, doc, docXml) {
  const links = [];
  for (const p of res.parts.filter(p => /^word\/_rels\/.+\.rels$/.test(p))) {
    const x = await zip.file(p).async('string');
    for (const m of x.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      const a = m[1];
      if (!/TargetMode="External"/.test(a) || !/relationships\/hyperlink"/.test(a)) continue;
      const tg = (a.match(/Target="([^"]*)"/) || [])[1]; if (tg) links.push({ url: tg.replace(/&amp;/g, '&'), part: p });
    }
  }
  const textUrls = [];
  for (const p of res.paras) for (const m of p.text.matchAll(/https?:\/\/[^\s<>«»"')\]]+/g)) textUrls.push({ url: m[0], para: p.i });
  for (const f of res.footnotes) for (const m of f.text.matchAll(/https?:\/\/[^\s<>«»"')\]]+/g)) textUrls.push({ url: m[0], para: f.para, fn: f.num });
  res.links = { rel: links, text: textUrls };
  // внешние связи диаграмм
  let chartExt = 0;
  for (const p of res.parts.filter(p => /^word\/charts\/_rels\//.test(p))) chartExt += ((await zip.file(p).async('string')).match(/TargetMode="External"/g) || []).length;
  res.meta.chartExternal = chartExt;
  // надстройки и менеджеры библиографии
  const addins = new Set();
  for (const p of res.parts.filter(p => /^word\/webextensions\/webextension\d*\.xml$/.test(p))) {
    const x = await zip.file(p).async('string');
    if (/MENDELEY/i.test(x)) addins.add('Mendeley Cite'); else if (/ZOTERO/i.test(x)) addins.add('Zotero'); else addins.add('веб-надстройка Office');
  }
  const fields = docXml.split(/w:fldCharType="begin"/).slice(1).map(ch => [...ch.split(/w:fldCharType="(?:separate|end)"/)[0].matchAll(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/g)].map(m => m[1]).join(''));
  const instr = fields.join(' \n ') + ' \n ' + [...docXml.matchAll(/w:fldSimple w:instr="([^"]*)"/g)].map(m => m[1]).join(' \n ');
  if (/ADDIN\s+ZOTERO/i.test(instr)) addins.add('Zotero');
  if (/ADDIN\s+(CSL_CITATION|Mendeley)/i.test(instr)) addins.add('Mendeley');
  if (/ADDIN\s+EN\.CITE/i.test(instr)) addins.add('EndNote');
  res.meta.addins = [...addins];
  // битые перекрёстные ссылки REF/PAGEREF
  const bms = new Set([...docXml.matchAll(/<w:bookmarkStart\b[^>]*w:name="([^"]+)"/g)].map(m => m[1]));
  const refNames = [...instr.matchAll(/(?:^|\s)(?:PAGE)?REF\s+(\S+)/g)].map(m => m[1]);
  res.meta.refFields = refNames.length;
  res.meta.brokenRefs = refNames.filter(n => !bms.has(n));
  res.meta.distinctRsids = new Set([...docXml.matchAll(/w:rsid(?:R|RPr|P|RDefault)="([0-9A-F]{8})"/g)].map(m => m[1])).size;
}

/* ---------------- проверки ---------------- */
function addFinding(res, f) {
  // f: {id, group, title, level, value, detail, examples:[{para, text}], interp}
  f.examples = f.examples || [];
  res.findings.push(f);
  return f;
}

function styleChecks(res) {
  const body = res.paras.filter(p => !p.toc && !p.heading && !p.inTable && !p.inBox && p.words > 0);
  const bodyWords = body.reduce((s, p) => s + p.words, 0);
  const allWords = res.paras.filter(p => !p.toc).reduce((s, p) => s + p.words, 0);
  res.stats.bodyWords = bodyWords; res.stats.allWords = allWords; res.stats.bodyParas = body.length;
  res.stats.allParas = res.paras.filter(p => p.words > 0 && !p.toc).length;

  const suspicious = res.styles.filter(s => ['webui', 'html', 'hash', 'junk', 'excel'].includes(s.category));
  res.stats.suspiciousStyles = suspicious;
  const webui = suspicious.filter(s => s.category === 'webui');

  // доля текста с признаками веб-разметки (стиль абзаца)
  const markedBody = body.filter(p => p.flags.some(f => f.type === 'style' && f.level !== 'info' && f.level !== 'weak'));
  const markedWords = markedBody.reduce((s, p) => s + p.words, 0);
  res.stats.markedBodyWords = markedWords; res.stats.markedBodyParas = markedBody.length;
  res.stats.markedShare = pct(markedWords, bodyWords);
  const allMarked = res.paras.filter(p => !p.toc && p.flags.some(f => f.type === 'style' && f.level !== 'info' && f.level !== 'weak'));
  res.stats.markedAllWords = allMarked.reduce((s, p) => s + p.words, 0);
  res.stats.markedAllParas = allMarked.length;
  res.stats.markedAllShare = pct(res.stats.markedAllWords, allWords);

  // распределение по разделам
  const secs = new Map();
  for (const p of body) {
    if (!secs.has(p.section)) secs.set(p.section, { title: p.section, words: 0, marked: 0, paras: 0, markedParas: 0 });
    const s = secs.get(p.section); s.words += p.words; s.paras++;
    if (markedBody.includes(p)) { s.marked += p.words; s.markedParas++; }
  }
  res.sections = [...secs.values()].filter(s => s.words >= 30);

  const runMarked = res.paras.filter(p => !p.toc && p.flags.some(f => f.type === 'rstyle' && ['strong', 'medium'].includes(f.level)));
  res.stats.runMarkedParas = runMarked.length;
  res.stats.runMarkedWords = res.styles.filter(s => s.category === 'webui').reduce((a, s) => a + s.runWords, 0);
  const xl = suspicious.filter(s => s.category === 'excel');
  if (xl.length) addFinding(res, { id: 'style:excel', group: 'tech', title: `Стили вставки таблиц из Excel (${xl.length})`, level: 'info', value: xl.length, detail: `Стили «${xl.slice(0, 3).map(s => s.name).join('», «')}»${xl.length > 3 ? '…' : ''}.`, note: 'Появляются при вставке таблиц из Excel; указывают на работу с собственными расчётными таблицами, а не на ИИ.' });
  for (const s of suspicious.filter(s => s.category !== 'excel')) {
    const used = s.paras + s.runs;
    const src = s.source;
    let title, level = s.level;
    if (s.category === 'webui') title = `Стиль веб-интерфейса «${s.name}» — ${src}`;
    else if (s.category === 'hash') title = `Стиль с хеш-именем «${s.name}»`;
    else if (s.category === 'html') title = `HTML-стиль «${s.name}»`;
    else if (s.category === 'excel') title = `Стиль вставки из Excel «${s.name}»`;
    else title = `Служебный стиль «${s.name}»`;
    if (!used && level !== 'info') level = level === 'strong' ? 'medium' : 'weak';
    if (!used && s.category === 'html') level = 'info'; // встроенные стили Word, есть во многих обычных документах
    const detail = used
      ? `Применён: абзацев — ${fmtNum(s.paras)} (в основном тексте ${fmtNum(s.bodyParas)}, в таблицах ${fmtNum(s.tableParas)}), слов в абзацах — ${fmtNum(s.words)}` + (s.runs ? `; фрагментов текста (стиль знаков) — ${fmtNum(s.runs)}, слов — ${fmtNum(s.runWords)}` : '') + '.'
      : (s.category === 'html' ? 'Встроенный стиль Word, к тексту не применён. Удалить его штатными средствами нельзя; такие стили есть во многих обычных документах, поэтому признаком ИИ он не является.' : 'Определение стиля хранится в файле, но к тексту не применено (след прежней вставки, «остаток»).');
    const hitParas = res.paras.filter(p => p.flags.some(f => f.key === s.id));
    const secCount = {}; hitParas.forEach(p => { const k = (p.inTable ? 'таблица в разделе «' : '«') + p.section.slice(0, 60) + '»'; secCount[k] = (secCount[k] || 0) + 1; });
    const where = Object.entries(secCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} — ${v}`).join('; ');
    const ex = res.paras.filter(p => p.words >= 3 && p.flags.some(f => f.key === s.id)).slice(0, 3).map(p => ({ para: p.i, text: snippet(p.text) }));
    addFinding(res, { id: 'style:' + s.id, group: 'tech', title, level, value: used ? (s.words || s.runWords) : 0, detail: detail + (used && where ? ' Где встречается: ' + where + '.' : ''), note: s.note, examples: ex, style: s });
  }
  if (res.meta.altChunk) addFinding(res, { id: 'altchunk', group: 'tech', title: 'Встроенные HTML-фрагменты (altChunk)', level: 'medium', value: res.meta.altChunk, detail: `Найдено ${res.meta.altChunk} вставок HTML «как есть».` });
}

function metaChecks(res) {
  const m = res.meta;
  const gen = [m.creator, m.lastModifiedBy, m.description, m.application].filter(Boolean).join(' | ');
  for (const g of GENERATOR_MARKERS) {
    if (g.re.test(m.creator || '') || g.re.test(m.lastModifiedBy || '') || g.re.test(m.description || '') || g.re.test(m.application || '')) {
      addFinding(res, { id: 'meta:gen', group: 'meta', title: 'Файл сформирован программно', level: 'strong', value: 1,
        detail: `Метаданные указывают на ${g.label}: «${gen}». Так создают файлы ИИ-агенты с доступом к коду (ChatGPT, Claude и др.) и скрипты.` });
      break;
    }
  }
  if (!m.hasApp) addFinding(res, { id: 'meta:noapp', group: 'meta', title: 'Нет сведений о приложении (docProps/app.xml)', level: 'medium', value: 1, detail: 'Word и LibreOffice всегда записывают этот файл; его отсутствие характерно для программной генерации DOCX.' });
  if (m.rsids === 0) addFinding(res, { id: 'meta:norsid', group: 'meta', title: 'Нет идентификаторов сеансов правки (rsid)', level: 'medium', value: 0, detail: 'Документ, набранный и сохранённый в Word, накапливает rsid. Их отсутствие указывает на программное создание файла либо на сохранение не в Word.' });
  else if (res.stats.allWords > 3000 && m.rsids / (res.stats.allWords / 1000) < 2) addFinding(res, { id: 'meta:lowrsid', group: 'meta', title: 'Мало сеансов правки для такого объёма', level: 'weak', value: m.rsids, detail: `rsid: ${m.rsids} на ${fmtNum(res.stats.allWords)} слов. Текст, вероятно, вставлялся крупными блоками, а не набирался постепенно.` });
  const tt = +m.totalTime, words = +(m.metaWords || res.stats.allWords);
  if (m.totalTime != null && words > 1500) {
    const wpm = tt > 0 ? words / tt : Infinity;
    if (wpm > 40) addFinding(res, { id: 'meta:time', group: 'meta', title: 'Время редактирования несоразмерно объёму', level: 'weak', value: tt,
      detail: `Общее время правки ${fmtNum(tt)} мин при ${fmtNum(words)} словах (${tt > 0 ? fmtNum(Math.round(wpm)) + ' слов/мин' : 'время 0'}). Текст в этом файле в основном вставлен, а не написан. Это возможно и при копировании из другого своего файла.` });
  }
  if (m.revision && +m.revision <= 3 && words > 1500) addFinding(res, { id: 'meta:rev', group: 'meta', title: 'Малое число ревизий', level: 'weak', value: +m.revision, detail: `Ревизия ${m.revision}: история работы с файлом почти не сохранена (файл пересохранён/собран заново).` });
  const linux = (m.fonts || []).filter(f => LINUX_FONTS.test(f));
  if (linux.length) addFinding(res, { id: 'meta:fonts', group: 'meta', title: 'Шрифты Linux-среды', level: 'weak', value: linux.length, detail: `Шрифты: ${linux.join(', ')}. Характерны для LibreOffice и серверных «песочниц», в которых ИИ-агенты собирают файлы.` });
  const filled = [m.title, m.subject, m.keywords, m.description].filter(v => v && v.length > 3).length;
  if (filled >= 3) addFinding(res, { id: 'meta:filled', group: 'meta', title: 'Подробно заполнены описательные свойства', level: 'weak', value: filled, detail: `Название: «${m.title || '—'}»; тема: «${m.subject || '—'}»; ключевые слова: «${m.keywords || '—'}». Вручную эти поля заполняют редко; генераторы — часто.` });
  // ссылки
  if (res.links) {
    const all = [...res.links.rel.map(l => l.url), ...res.links.text.map(l => l.url)];
    const uniq = [...new Set(all)];
    const redirect = res.links.rel.filter(l => /^https?:\/\/(www\.)?google\.[a-z.]+\/url\?/i.test(l.url));
    if (redirect.length >= 3 || (redirect.length && redirect.length / Math.max(1, res.links.rel.length) >= 0.3)) {
      const decoded = redirect.slice(0, 3).map(l => { try { return decodeURIComponent((l.url.match(/[?&]q=([^&]+)/) || [])[1] || ''); } catch (e) { return ''; } }).filter(Boolean);
      addFinding(res, { id: 'links:google', group: 'tech', title: 'Ссылки через переадресацию Google (google.com/url?…q=)', level: 'medium', value: redirect.length,
        detail: `${redirect.length} из ${res.links.rel.length} гиперссылок (${fmtPct(pct(redirect.length, res.links.rel.length))}) ведут не на источник, а через «google.com/url?…&q=». Примеры реальных адресов: ${decoded.join('; ')}.`,
        note: 'Такую обёртку ссылок формируют Google Gemini / AI Studio при выдаче ответов; она же возникает при копировании ссылок из поисковой выдачи Google и Google Docs.' });
    }
    const aiTag = all.filter(u => /utm_source=(chatgpt\.com|openai|perplexity|copilot|claude|gemini)/i.test(u));
    if (aiTag.length) {
      const src = [...new Set(aiTag.map(u => (u.match(/utm_source=([^&#]+)/i) || [])[1]))];
      addFinding(res, { id: 'links:utm', group: 'tech', title: 'Ссылки с меткой нейросетевого сервиса (utm_source)', level: 'strong', value: aiTag.length,
        detail: `Ссылок: ${aiTag.length}; метки: ${src.join(', ')}. Пример: ${aiTag[0].slice(0, 160)}`, note: 'ChatGPT и другие сервисы с веб-поиском добавляют к ссылкам на источники параметр utm_source со своим именем. При ручном поиске источника такой метки нет.' });
    }
    const chatLinks = uniq.filter(u => /chatgpt\.com\/(share|c)\/|chat\.openai\.com|claude\.ai\/(chat|share)|gemini\.google\.com|aistudio\.google\.com|chat\.deepseek\.com|perplexity\.ai\/search|gigachat|alice\.yandex/i.test(u));
    if (chatLinks.length) addFinding(res, { id: 'links:chat', group: 'tech', title: 'Ссылки на чаты нейросетей', level: 'strong', value: chatLinks.length, detail: 'Адреса: ' + chatLinks.slice(0, 5).join('; ') });
  }
  if (m.brokenRefs && m.brokenRefs.length) addFinding(res, { id: 'fields:ref', group: 'src', title: 'Перекрёстные ссылки на удалённые закладки', level: 'weak', value: m.brokenRefs.length,
    detail: `Полей REF/PAGEREF без закладки: ${m.brokenRefs.length} (${m.brokenRefs.slice(0, 5).join(', ')}). При обновлении полей Word покажет «Ошибка! Источник ссылки не найден», LibreOffice — «Error: Reference source not found».`, note: 'Возникает при удалении или перемещении фрагментов, на которые ссылается поле; к ИИ отношения не имеет.' });
  // изображения
  for (const im of res.media) {
    if (im.c2pa) addFinding(res, { id: 'img:c2pa:' + im.path, group: 'tech', title: `Изображение ${im.path}: метка происхождения C2PA`, level: im.aiTokens.length ? 'strong' : 'medium', value: 1,
      detail: 'В файле изображения есть манифест Content Credentials (C2PA)' + (im.aiTokens.length ? `, упоминания: ${im.aiTokens.join(', ')}.` : '. Манифест может ставить и камера/графический редактор; требуется проверка на contentcredentials.org.') });
    else if (im.aiTokens.length) addFinding(res, { id: 'img:tok:' + im.path, group: 'tech', title: `Изображение ${im.path}: упоминания генераторов`, level: 'medium', value: im.aiTokens.length, detail: `В метаданных изображения встречаются: ${im.aiTokens.join(', ')}.` });
  }
}

function markBib(res) {
  const starts = res.paras.map((p, k) => k).filter(k => { const p = res.paras[k]; return !p.toc && /^\s*(СПИСОК\s+(ИСПОЛЬЗОВАННЫХ\s+ИСТОЧНИКОВ|ИСПОЛЬЗОВАННОЙ\s+ЛИТЕРАТУРЫ|ЛИТЕРАТУРЫ)|БИБЛИОГРАФИЧЕСКИЙ\s+СПИСОК|Список\s+(использованных\s+источников|литературы))/i.test(p.text) && !/\d+\s*$/.test(p.text.trim()); });
  const s = starts.pop(); if (s == null) return;
  for (let k = s + 1; k < res.paras.length; k++) { if (!res.paras[k].toc && /^\s*ПРИЛОЖЕНИ[ЕЯ]/.test(res.paras[k].text)) break; res.paras[k].bib = true; }
}
function textChecks(res, onProgress) {
  markBib(res);
  const paras = res.paras.filter(p => !p.toc && p.text.trim());
  const nbParas = paras.filter(p => !p.bib);
  if (res.kind === 'text') {
    res.stats.bodyWords = res.stats.allWords = paras.reduce((s, p) => s + p.words, 0);
    res.stats.bodyParas = res.stats.allParas = paras.length;
    res.stats.markedShare = 0; res.stats.suspiciousStyles = [];
  }
  const totalWords = res.stats.allWords || 1;

  /* --- скрытые и необычные символы --- */
  const charCats = [
    { id: 'zw', title: 'Символы нулевой ширины', re: /[​‌‍⁠﻿]/g, level: 'medium', note: 'Невидимые символы (U+200B–U+200D, U+2060, U+FEFF). Попадают из веб-страниц или используются для скрытых меток.' },
    { id: 'tag', title: 'Невидимые теговые символы Unicode', re: /[\u{E0000}-\u{E007F}]/gu, level: 'strong', note: 'Символы U+E0000–E007F не отображаются и используются для скрытого встраивания данных в текст.' },
    { id: 'vs', title: 'Селекторы вариантов вне эмодзи', re: /(?<![\p{Extended_Pictographic}⃣])[︀-︎\u{E0100}-\u{E01EF}]/gu, level: 'medium', note: 'Невидимые селекторы вариантов после обычных букв — возможный способ скрытой маркировки.' },
    { id: 'bidi', title: 'Управляющие символы направления текста', re: /[‎‏‪-‮⁦-⁩]/g, level: 'medium', note: 'Невидимые символы управления направлением письма; в русском научном тексте не нужны.' },
    { id: 'soft', title: 'Мягкие переносы', re: /­/g, level: 'weak', note: 'Мягкие переносы часто приходят с веб-страниц.' },
    { id: 'sp', title: 'Нестандартные пробелы', re: /[ -   　]/g, level: 'weak', note: 'Узкие/типографские пробелы; обычно приходят при копировании из браузера.' },
    { id: 'nbsp', title: 'Неразрывные пробелы', re: / /g, level: 'info', note: 'Обычный элемент типографики; сами по себе ничего не доказывают.' },
    { id: 'pua', title: 'Символы частной зоны Unicode', re: /[-]/g, level: 'info', note: 'Символы из частной зоны (обычно шрифтовые значки).' },
  ];
  const texts = paras.map(p => p.text).concat(res.footnotes.map(f => f.text));
  for (const c of charCats) {
    let n = 0; const ex = [];
    for (const p of paras) {
      c.re.lastIndex = 0;
      const m = p.text.match(c.re);
      if (m) { n += m.length; if (ex.length < 3) { const idx = p.text.search(c.re); ex.push({ para: p.i, text: snippet(p.text, idx).replace(c.re, '⟦·⟧') }); } if (c.level !== 'info') p.flags.push({ type: 'char', key: c.id, level: c.level, label: c.title }); }
    }
    for (const f of res.footnotes) { const m = f.text.match(c.re); if (m) n += m.length; }
    if (n) addFinding(res, { id: 'char:' + c.id, group: 'chars', title: c.title, level: c.level, value: n, detail: `Найдено: ${fmtNum(n)}.`, note: c.note, examples: ex });
  }
  // типографика ответов
  const allText = texts.join('\n');
  const emd = (allText.match(/[—–]/g) || []).length;
  const engQ = (allText.match(/[“”]/g) || []).length;
  const ell = (allText.match(/…/g) || []).length;
  res.stats.typo = { emDash: emd, emDashPer1000: 1000 * emd / totalWords, engQuotes: engQ, ellipsis: ell };
  if (engQ >= 4) addFinding(res, { id: 'typo:q', group: 'chars', title: 'Английские кавычки “…” в русском тексте', level: 'weak', value: engQ, detail: `Найдено ${engQ}. Word по умолчанию ставит «ёлочки»; “лапки” часто приходят из ответов нейросетей и веб-страниц.` });

  /* --- артефакты ответов чат-ботов, Markdown, эмодзи --- */
  const md = [
    { id: 'bold', re: /\*\*[^*\n]{2,}\*\*|__[^_\n]{2,}__/, title: 'Разметка Markdown: **жирный**' },
    { id: 'hdr', re: /^#{1,6}\s+\S/, title: 'Разметка Markdown: заголовки «#»' },
    { id: 'hr', re: /^\s*(-{3,}|\*{3,}|_{3,})\s*$/, title: 'Разметка Markdown: разделитель «---»' },
    { id: 'code', re: /`[^`\n]+`/, title: 'Разметка Markdown: `код`' },
    { id: 'tbl', re: /^\s*\|.*\|\s*$/, title: 'Разметка Markdown: таблица из «|»' },
    { id: 'link', re: /\[[^\]]+\]\((https?:[^)]+)\)/, title: 'Разметка Markdown: ссылка [текст](url)' },
    { id: 'latex', re: /\\\(|\\\[|\$\$|\\frac\b|\\text\{|\\sum\b|\\cdot\b|\\times\b|\\left[(\[]|\\right[)\]]|\\mathrm\{|\\alpha\b|\\beta\b/, title: 'Команды LaTeX в тексте' },
    { id: 'bullet', re: /^\s*[-*•]\s+\S/, title: 'Строки-списки «- …» вне списков Word', cond: p => !p.hasNum && !p.inBox && !p.inTable },
  ];
  for (const r of md) {
    const hits = paras.filter(p => r.re.test(p.text) && (!r.cond || r.cond(p)));
    if (!hits.length) continue;
    const lvl = r.id === 'bullet' ? 'weak' : 'medium';
    hits.forEach(p => p.flags.push({ type: 'md', key: r.id, level: lvl, label: r.title }));
    addFinding(res, { id: 'md:' + r.id, group: 'text', title: r.title, level: lvl, value: hits.length, detail: `Абзацев: ${hits.length}.`, note: 'Нейросети оформляют ответы в Markdown; при копировании текста без обработки символы разметки остаются.', examples: hits.slice(0, 3).map(p => ({ para: p.i, text: snippet(p.text, p.text.search(r.re)) })) });
  }
  const emojiRe = /(?![©®™])\p{Extended_Pictographic}/u;
  const emo = paras.filter(p => emojiRe.test(p.text));
  if (emo.length) { emo.forEach(p => p.flags.push({ type: 'emoji', key: 'emoji', level: 'medium', label: 'Эмодзи' })); addFinding(res, { id: 'emoji', group: 'text', title: 'Эмодзи и пиктограммы (✅, 📌, 🔹…)', level: 'medium', value: emo.length, detail: `Абзацев: ${emo.length}.`, note: 'Типичное оформление ответов чат-ботов; в научном тексте не встречается.', examples: emo.slice(0, 3).map(p => ({ para: p.i, text: snippet(p.text, p.text.search(emojiRe)) })) }); }

  const phraseHits = [];
  for (const p of paras) for (const re of CHATBOT_PHRASES) { const m = p.text.match(re); if (m) { phraseHits.push({ p, m }); p.flags.push({ type: 'phrase', key: 'phrase', level: 'strong', label: 'Фраза из ответа чат-бота: «' + m[0].trim() + '»' }); break; } }
  for (const f of res.footnotes) for (const re of CHATBOT_PHRASES) { const m = f.text.match(re); if (m) { phraseHits.push({ p: { i: null, text: 'Сноска ' + f.num + ': ' + f.text }, m }); break; } }
  if (phraseHits.length) addFinding(res, { id: 'phrase', group: 'text', title: 'Остатки реплик чат-бота', level: 'strong', value: phraseHits.length,
    detail: `Найдено: ${phraseHits.length}. Примеры: ${phraseHits.slice(0, 5).map(h => '«' + h.m[0].trim() + '»').join(', ')}.`, note: 'Обращения к пользователю («Конечно!», «Вот переработанный вариант», «Если нужно, могу…») — прямой след копирования ответа нейросети.',
    examples: phraseHits.slice(0, 4).map(h => ({ para: h.p.i, text: snippet(h.p.text, h.p.text.indexOf(h.m[0])) })) });

  /* --- следы компиляции --- */
  const comp = [
    { id: 'fielderr', re: /Ошибка!\s*(Источник ссылки не найден|Закладка не определена)|Error!\s*(Reference source not found|Bookmark not defined)|Error:\s*Reference source not found/gi, title: 'Видимые ошибки полей Word («Ошибка! Источник ссылки не найден»)', level: 'weak', note: 'Сломанные перекрёстные ссылки после перемещения или удаления фрагментов.' },
    { id: 'emptyref', re: /\[\s*\]|\[\s*…\s*\]|\[\s*\.\.\.\s*\]/g, title: 'Пустые ссылки «[]»', level: 'medium', note: 'Ссылка на источник оставлена незаполненной: текст собран до оформления источников.' },
    { id: 'files', re: /(?<![\w/%.:-])(?<!https?:\/\/\S*)[\wА-Яа-яЁё\-]{1,40}\.(pdf|docx?|xlsx?|pptx?|csv|txt)\b/gi, title: 'Имена файлов в тексте («15.pdf»)', level: 'medium', note: 'Внутренние имена файлов вместо источников — характерно для текста, собранного по пакету загруженных материалов.' },
    { id: 'ph', re: new RegExp(PLACEHOLDER_RE.source, 'gi'), title: 'Заглушки и пометки «вставить/TODO»', level: 'medium', note: 'Незаполненные шаблонные места.' },
    { id: 'composed', re: /Составлено\s+автором\s+(на\s+основе|по)\s*(\[\s*\]|$)/gi, title: 'Подписи «Составлено автором на основе []» без источника', level: 'medium', note: 'Шаблонная подпись без указанного источника.' },
  ];
  for (const c of comp) {
    let n = 0; const ex = [];
    for (const p of nbParas) { c.re.lastIndex = 0; const m = p.text.match(c.re); if (m) { n += m.length; p.flags.push({ type: 'comp', key: c.id, level: c.level, label: c.title }); if (ex.length < 4) ex.push({ para: p.i, text: snippet(p.text, p.text.search(new RegExp(c.re.source, 'i'))) }); } }
    for (const f of res.footnotes) { c.re.lastIndex = 0; const m = f.text.match(c.re); if (m) n += m.length; }
    if (n) addFinding(res, { id: 'comp:' + c.id, group: 'comp', title: c.title, level: c.level, value: n, detail: `Найдено: ${fmtNum(n)}.`, note: c.note, examples: ex });
  }
  // рабочие заметки заглавными
  const notes = paras.filter(p => {
    if (p.heading) return false;
    const t = p.text.trim(); if (countWords(t) < 4 || t.length > 400) return false;
    if (/^(ГЛАВА|ВВЕДЕНИЕ|ЗАКЛЮЧЕНИЕ|СПИСОК|ПРИЛОЖЕНИ|ОГЛАВЛЕНИЕ|СОДЕРЖАНИЕ|ТАБЛИЦА|РИСУНОК|«)/.test(t)) return false;
    const L = t.match(/\p{L}/gu) || []; const U = t.match(/\p{Lu}/gu) || [];
    return L.length >= 15 && U.length / L.length > 0.7 && /(ПРЕДПОЛАГ|ПРЕДПОЛГ|НУЖНО|НАДО|ДОБАВИТЬ|ДОПИСАТЬ|ПЕРЕПИСАТЬ|ПРОВЕРИТЬ|УТОЧНИТЬ|НЕ ХВАТАЕТ|ИСПРАВИТЬ|УБРАТЬ|ЗАМЕНИТЬ|ПЕРЕДЕЛАТЬ|ВОПРОС|\?)/.test(t);
  });
  const shortNotes = paras.filter(p => !p.heading && !p.inTable && !p.inBox && /^(\s*(заново|пересчитать|проверить|добавить|дописать|уточнить|переписать|найти|посчитать|сделать)(?!\p{L}))/iu.test(p.text) && p.words < 25);
  const allNotes = [...new Set([...notes, ...shortNotes])];
  if (allNotes.length) { allNotes.forEach(p => p.flags.push({ type: 'comp', key: 'note', level: 'info', label: 'Рабочая заметка' })); addFinding(res, { id: 'comp:notes', group: 'comp', title: 'Рабочие заметки в тексте', level: 'info', value: allNotes.length, detail: `Найдено: ${allNotes.length}.`, note: 'Не признак ИИ: указывает на незавершённость и ручную сборку.', examples: allNotes.slice(0, 4).map(p => ({ para: p.i, text: snippet(p.text) })) }); }

  /* --- повторы --- */
  onProgress('Поиск повторов…');
  const cand = nbParas.filter(p => p.words >= 30 && !p.inTable && !p.toc);
  const shingles = cand.map(p => {
    const w = (p.text.toLowerCase().replace(/ё/g, 'е').match(/\p{L}+/gu) || []).filter(x => x.length > 3).map(x => x.slice(0, 6));
    const s = new Set(); for (let i = 0; i + 2 < w.length; i++) s.add(w[i] + ' ' + w[i + 1] + ' ' + w[i + 2]);
    const b = new Set(); for (let i = 0; i + 1 < w.length; i++) b.add(w[i] + ' ' + w[i + 1]);
    return { s, b };
  });
  const reps = [];
  for (let a = 0; a < cand.length; a++) for (let b = a + 1; b < cand.length; b++) {
    const A = shingles[a], B = shingles[b];
    const dist = cand[b].i - cand[a].i;
    let inter = 0; for (const x of A.s) if (B.s.has(x)) inter++;
    const j3 = inter / (A.s.size + B.s.size - inter || 1);
    let ib = 0; if (dist <= 12) { for (const x of A.b) if (B.b.has(x)) ib++; }
    const j2 = ib / (A.b.size + B.b.size - ib || 1);
    if (j3 >= 0.5) reps.push({ a: cand[a], b: cand[b], j: j3, kind: 'дубль' });
    else if (dist <= 12 && (j3 >= 0.18 || j2 >= 0.22)) reps.push({ a: cand[a], b: cand[b], j: Math.max(j3, j2), kind: 'повтор тезиса рядом' });
  }
  reps.sort((x, y) => y.j - x.j);
  res.repeats = reps.slice(0, 40);
  if (reps.length) {
    reps.slice(0, 40).forEach(r => { r.a.flags.push({ type: 'rep', key: 'rep', level: 'weak', label: 'Смысловой повтор с абзацем №' + (r.b.i + 1) }); r.b.flags.push({ type: 'rep', key: 'rep', level: 'weak', label: 'Смысловой повтор с абзацем №' + (r.a.i + 1) }); });
    const dup = reps.filter(r => r.kind === 'дубль').length;
    addFinding(res, { id: 'rep', group: 'comp', title: 'Смысловые повторы и дубли абзацев', level: dup ? 'medium' : 'weak', value: reps.length,
      detail: `Пар похожих абзацев: ${reps.length} (почти дословных дублей: ${dup}).`, note: 'Повтор одного тезиса в соседних абзацах с минимальным перефразированием характерен для склейки нескольких сгенерированных вариантов.',
      examples: reps.slice(0, 3).map(r => ({ para: r.a.i, text: `№${r.a.i + 1} ↔ №${r.b.i + 1} (сходство ${Math.round(r.j * 100)}%): ${snippet(r.a.text, null, 110)} ↔ ${snippet(r.b.text, null, 110)}` })) });
  }

  /* --- шаблонные обороты, ритм --- */
  const bodyText = paras.filter(p => !p.inTable && !p.heading).map(p => p.text).join('\n');
  const bw = countWords(bodyText) || 1;
  const cl = CLICHES.map(([label, re]) => { const n = (bodyText.match(re) || []).length; return { label, n, per1000: 1000 * n / bw }; }).filter(x => x.n).sort((a, b) => b.n - a.n);
  res.stats.cliches = cl;
  const clDensity = cl.reduce((s, x) => s + x.n, 0) * 1000 / bw;
  res.stats.clicheDensity = clDensity;
  if (false) addFinding(res, { id: 'cliche', group: 'style', title: 'Частотные «универсальные» обороты', level: clDensity > 18 ? 'weak' : 'info', value: Math.round(clDensity * 10) / 10,
    detail: `Плотность: ${clDensity.toFixed(1)} на 1000 слов. Чаще всего: ${cl.slice(0, 6).map(x => `«${x.label}» — ${x.n}`).join('; ')}.`, note: 'Для научного стиля такие обороты допустимы и сами по себе ничего не доказывают; учитываются только в совокупности с другими признаками.' });
  const sents = bodyText.replace(/((?<!\p{L})[А-ЯЁA-Z]\.)\s?(?=[А-ЯЁA-Z]\.)/gu, '$1').split(/(?<=[.!?…])\s+(?=[А-ЯЁA-Z«"(])/).map(s => countWords(s)).filter(n => n >= 3);
  if (sents.length >= 40) {
    const mean = sents.reduce((a, b) => a + b, 0) / sents.length;
    const sd = Math.sqrt(sents.reduce((a, b) => a + (b - mean) ** 2, 0) / sents.length);
    const cv = sd / mean;
    res.stats.sentences = { n: sents.length, mean, cv };
    const plen = paras.filter(p => !p.inTable && !p.heading && p.words >= 15).map(p => p.words);
    const pm = plen.reduce((a, b) => a + b, 0) / (plen.length || 1);
    const pcv = Math.sqrt(plen.reduce((a, b) => a + (b - pm) ** 2, 0) / (plen.length || 1)) / (pm || 1);
    res.stats.paraLen = { n: plen.length, mean: pm, cv: pcv };
    const uniform = cv < 0.30 || (cv < 0.42 && pcv < 0.45);
    addFinding(res, { id: 'rhythm', group: 'style', title: 'Ритм текста (однородность длины предложений и абзацев)', level: uniform ? 'weak' : 'info', value: Math.round(cv * 100) / 100,
      detail: `Предложений: ${fmtNum(sents.length)}, средняя длина ${mean.toFixed(1)} слова, коэффициент вариации ${cv.toFixed(2)}; абзацев: ${plen.length}, средняя длина ${pm.toFixed(0)} слов, вариация ${pcv.toFixed(2)}. ` + (uniform ? 'Длины необычно однородны — так часто выглядит сгенерированный текст.' : 'Длины варьируют естественно.'),
      note: 'Показатель «взрывности» (burstiness): человек чередует длинные и короткие предложения, модель пишет ровнее. На корпусе AINL-Eval 2025 коэффициент вариации у людей около 0,38, у моделей 0,19–0,23; в эталонных статьях автора-экономиста 2016–2022 гг. ниже 0,45 лишь каждая десятая. Статистический показатель; надёжно отличить ИИ-текст от человеческого по нему одному нельзя.' });
  }

  if (res.kind === 'text') return;

  /* --- сноски и авторы --- */
  const fns = res.footnotes;
  const emptyFn = fns.filter(f => !f.text || f.text.replace(/[\s.\[\]]/g, '').length < 3);
  if (emptyFn.length) addFinding(res, { id: 'fn:empty', group: 'src', title: 'Пустые или незаполненные сноски', level: 'medium', value: emptyFn.length, detail: `Сноски №: ${emptyFn.slice(0, 20).map(f => f.num).join(', ')}${emptyFn.length > 20 ? '…' : ''}.`, examples: emptyFn.slice(0, 3).map(f => ({ para: f.para, text: 'Сноска ' + f.num + ' к тексту: …' + snippet(f.before.slice(-150), null, 150) })) });
  const surA = /(?:^|[^\p{L}])([А-ЯЁ])\.\s?([А-ЯЁ])\.\s?([А-ЯЁ][а-яё]{2,}(?:-[А-ЯЁ][а-яё]+)?)/gu;
  const surB = /([А-ЯЁ][а-яё]{2,}(?:-[А-ЯЁ][а-яё]+)?)\s([А-ЯЁ])\.\s?([А-ЯЁ])\./gu;
  const mism = [];
  const fnByPara = {};
  for (const f of fns) (fnByPara[f.para] = fnByPara[f.para] || []).push(f);
  for (const f of fns) {
    if (!f.text || /^(там\s+же|указ\.?\s*соч|ibid)/i.test(f.text)) continue;
    const prev = (fnByPara[f.para] || []).filter(x => x.num < f.num).pop();
    let win = f.before.slice(prev ? prev.before.length : 0).slice(-260);
    const names = new Set();
    for (const m of win.matchAll(surA)) names.add(m[3]);
    for (const m of win.matchAll(surB)) names.add(m[1]);
    if (!names.size) continue;
    const ft = f.text.toLowerCase().replace(/ё/g, 'е');
    const ok = [...names].some(n => ft.includes(stem(n)) || ft.includes(translit(stem(n))));
    if (!ok) mism.push({ f, names: [...names] });
  }
  res.stats.fnMismatch = mism;
  if (mism.length) {
    mism.forEach(x => { const p = res.paras[x.f.para]; if (p) p.flags.push({ type: 'src', key: 'fn', level: 'weak', label: `Автор(ы) ${x.names.join(', ')} не найдены в сноске ${x.f.num}` }); });
    addFinding(res, { id: 'fn:mism', group: 'src', title: 'Названный в тексте автор отсутствует в сноске', level: 'medium', value: mism.length,
      detail: `Случаев: ${mism.length}.`, note: 'Не уникальный признак ИИ, но типичный риск синтеза обзора литературы нейросетью без сверки с первоисточниками: утверждение и ссылка формируются раздельно.',
      examples: mism.slice(0, 5).map(x => ({ para: x.f.para, text: `В тексте: ${x.names.join(', ')}; сноска ${x.f.num}: «${snippet(x.f.text, null, 150)}»` })) });
  }
  const fnFiles = fns.filter(f => /\.(pdf|docx?|xlsx?)\b/i.test(f.text));
  if (fnFiles.length) addFinding(res, { id: 'fn:files', group: 'src', title: 'Имена файлов в сносках', level: 'medium', value: fnFiles.length, detail: `Сноски №: ${fnFiles.map(f => f.num).slice(0, 20).join(', ')}.` });

  /* --- перекрёстные ссылки на рисунки и таблицы --- */
  const capRe = { fig: /^\s*(Рисунок|Рис\.)\s*(\d+(?:\.\d+)*)/i, tab: /^\s*(Таблица)\s*(\d+(?:\.\d+)*)/i };
  const refRe = { fig: /(рисун[а-яё]*|рис\.)\s*(\d+(?:\.\d+)*)/gi, tab: /(таблиц[а-яё]*|табл\.)\s*(\d+(?:\.\d+)*)/gi };
  const announce = /(представлен|приведен|приведён|отражен|отражён|изображен|изображён|показан|видно|визуализ|иллюстрир|демонстрир|данн(ой|ая|ую)\s+схем)/i;
  const xref = [];
  for (const kind of ['fig', 'tab']) {
    const caps = res.paras.filter(p => capRe[kind].test(p.text)).map(p => ({ p, n: p.text.match(capRe[kind])[2] }));
    const capNums = caps.map(c => c.n);
    const kindName = kind === 'fig' ? 'рисунок' : 'таблицу';
    // дубли и пропуски нумерации
    const seen = {};
    for (const c of caps) { if (seen[c.n]) xref.push({ para: c.p.i, text: `Номер ${kind === 'fig' ? 'рисунка' : 'таблицы'} ${c.n} встречается повторно.` }); seen[c.n] = 1; }
    const byCh = {};
    for (const n of capNums) { const parts = n.split('.'); if (parts.length === 2) (byCh[parts[0]] = byCh[parts[0]] || []).push(+parts[1]); }
    for (const [ch, arr] of Object.entries(byCh)) { const s = [...new Set(arr)].sort((a, b) => a - b); for (let k = 1; k <= s[s.length - 1]; k++) if (!s.includes(k)) xref.push({ para: null, text: `Пропущен номер: ${kind === 'fig' ? 'рисунок' : 'таблица'} ${ch}.${k}.` }); }
    for (const p of res.paras) {
      if (capRe[kind].test(p.text) || p.toc) continue;
      for (const m of p.text.matchAll(refRe[kind])) {
        const n = m[2];
        if (!capNums.includes(n)) { if (caps.length) xref.push({ para: p.i, text: `Ссылка на ${kindName} ${n}, которого нет среди подписей: «${snippet(p.text, m.index, 120)}»` }); continue; }
        const sentence = p.text.slice(Math.max(0, m.index - 120), m.index + 40);
        if (!announce.test(sentence)) continue;
        const near = caps.filter(c => Math.abs(c.p.i - p.i) <= 6).sort((a, b) => Math.abs(a.p.i - p.i) - Math.abs(b.p.i - p.i))[0];
        const prevCap = caps.filter(c => c.p.i < p.i).pop(), nextCap = caps.find(c => c.p.i > p.i);
        if (near && near.n !== n && !(prevCap && prevCap.n === n) && !(nextCap && nextCap.n === n)) {
          const own = caps.find(c => c.n === n);
          if (own && Math.abs(own.p.i - p.i) > Math.abs(near.p.i - p.i) + 2) xref.push({ para: p.i, text: `Текст ссылается на ${kindName} ${n}, а рядом размещён(а) ${kind === 'fig' ? 'рисунок' : 'таблица'} ${near.n}: «${snippet(p.text, m.index, 120)}»` });
        }
      }
    }
  }
  res.stats.xref = xref;
  if (xref.length) {
    xref.forEach(x => { if (x.para != null) res.paras[x.para].flags.push({ type: 'src', key: 'xref', level: 'weak', label: 'Ошибка перекрёстной ссылки' }); });
    addFinding(res, { id: 'xref', group: 'src', title: 'Ошибки нумерации и перекрёстных ссылок', level: 'weak', value: xref.length, detail: `Найдено: ${xref.length}.`, note: 'Указывают на перестановку крупных блоков без сквозной редакции.', examples: xref.slice(0, 6) });
  }

  /* --- ценовая база --- */
  const priceYears = [...new Set([...bodyText.matchAll(/в\s+(?:постоянных\s+|сопоставимых\s+)?ценах\s+(\d{4})/gi)].map(m => m[1]))];
  if (priceYears.length > 1) addFinding(res, { id: 'price', group: 'src', title: 'Разные базовые годы цен', level: 'info', value: priceYears.length, detail: `Упоминаются цены ${priceYears.join(', ')} гг. Проверьте, что расчёты ведутся в единой ценовой базе.` });

  /* --- список литературы --- */
  const bibStart = res.paras.map((p, k) => k).filter(k => { const p = res.paras[k]; return !p.toc && /^\s*(СПИСОК\s+(ИСПОЛЬЗОВАННЫХ\s+ИСТОЧНИКОВ|ИСПОЛЬЗОВАННОЙ\s+ЛИТЕРАТУРЫ|ЛИТЕРАТУРЫ)|БИБЛИОГРАФИЧЕСКИЙ\s+СПИСОК|Список\s+(использованных\s+источников|литературы))/i.test(p.text) && !/\d+\s*$/.test(p.text.trim()); }).pop() ?? -1;
  if (bibStart >= 0) {
    const items = [];
    for (let k = bibStart + 1; k < res.paras.length; k++) { const p = res.paras[k]; if (!p.toc && /^\s*ПРИЛОЖЕНИ[ЕЯ]/.test(p.text)) break; if (p.words >= 4) items.push(p); }
    const yNow = new Date().getFullYear();
    const years = items.map(p => { const ys = [...p.text.matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)].map(m => +m[1]).filter(y => y <= yNow); return ys.length ? Math.max(...ys) : null; }).filter(Boolean);
    const recent = years.filter(y => y >= yNow - 5).length;
    res.stats.bib = { items: items.length, withYear: years.length, recent };
    const numbered = items.filter(p => p.hasNum || /^\s*\d{1,4}[.)]\s/.test(p.text));
    const useItems = numbered.length >= 0.7 * items.length ? numbered : items;
    res.stats.bib.items = useItems.length;
    res.stats.bibItems = useItems.map(p => p.text.replace(/^\s*\d+[.)]?\s*/, ''));
    for (let k = bibStart; k < res.paras.length; k++) { if (k > bibStart && !res.paras[k].toc && /^\s*ПРИЛОЖЕНИ[ЕЯ]/.test(res.paras[k].text)) break; res.paras[k].bib = true; }
    addFinding(res, { id: 'bib', group: 'src', title: 'Список литературы', level: 'info', value: items.length, detail: `Записей: ${items.length}; с годом: ${years.length}; за последние 5 лет: ${recent} (${fmtPct(pct(recent, years.length))}).` });
  }
}

/* ---------------- итоговая оценка ---------------- */
function finalize(res) {
  const F = res.findings;
  const angular = F.find(f => f.style && /^Angular/.test(f.style.source) && f.value > 0);
  const gRedir = F.find(f => f.id === 'links:google');
  if (angular && gRedir) addFinding(res, { id: 'combo:gemini', group: 'tech', title: 'Совокупность признаков Google Gemini / AI Studio', level: 'strong', value: 1,
    detail: 'В одном документе одновременно применена Angular-разметка («' + angular.style.name + '») и единообразная Google-переадресация ссылок. Вместе эти признаки наиболее согласуются с переносом части материалов из Google Gemini или Google AI Studio, хотя каждый по отдельности сервис не устанавливает.' });
  const strong = F.filter(f => f.level === 'strong'), medium = F.filter(f => f.level === 'medium'), weak = F.filter(f => f.level === 'weak');
  res.stats.counts = { strong: strong.length, medium: medium.length, weak: weak.length, info: F.filter(f => f.level === 'info').length };
  const share = res.stats.markedShare || 0;
  const webStyles = F.filter(f => f.style && f.style.category === 'webui' && f.value > 0);
  const sources = {};
  for (const f of webStyles) sources[f.style.source] = (sources[f.style.source] || 0) + (f.style.words + f.style.runWords);
  res.stats.sources = Object.entries(sources).sort((a, b) => b[1] - a[1]);
  const mainSrc = F.some(f => f.id === 'combo:gemini') ? 'Google Gemini / Google AI Studio' : (res.stats.sources[0] ? res.stats.sources[0][0] : null);

  let verdict, conf, scale;
  if (strong.length) {
    verdict = 'Выявлены прямые признаки применения генеративного ИИ';
    conf = (strong.length >= 2 || share >= 20) ? 'высокая' : 'средняя';
  } else if (medium.filter(f => ['tech', 'meta', 'chars', 'text'].includes(f.group)).length >= 2) {
    verdict = 'Выявлены косвенные технические признаки использования нейросетевых сервисов';
    conf = 'средняя';
  } else if (!F.some(f => ['tech', 'meta', 'chars', 'text'].includes(f.group) && ['medium', 'weak'].includes(f.level)) && F.some(f => ['comp', 'src'].includes(f.group) && f.level !== 'info')) {
    verdict = 'Технических следов нейросетевых сервисов не выявлено; есть недоработки ссылочного аппарата и следы черновой компиляции';
    conf = 'низкая';
  } else if (F.some(f => f.id === 'styloA' && f.level === 'medium')) {
    verdict = 'Технических следов ИИ не выявлено; лексический профиль текста близок к текстам LLM';
    conf = 'низкая';
  } else if (F.some(f => f.id === 'styloA' && f.level === 'weak') && !F.some(f => ['tech', 'meta', 'chars', 'text'].includes(f.group) && ['strong', 'medium'].includes(f.level))) {
    verdict = 'Технических следов ИИ не выявлено; есть отдельные стилистические признаки возможной правки текста с помощью ИИ';
    conf = 'низкая';
  } else if (medium.length || weak.length >= 3) {
    verdict = 'Выявлены отдельные слабые признаки; прямых признаков не обнаружено';
    conf = 'низкая';
  } else {
    verdict = 'Признаков применения генеративного ИИ не выявлено';
    conf = '—';
  }
  if (share >= 50) scale = 'системное (признак охватывает большую часть связного текста)';
  else if (share >= 10) scale = 'существенное, фрагментарное';
  else if (share > 0) scale = 'эпизодическое';
  else if (res.stats.runMarkedParas) scale = `фрагментарное: веб-разметка сохранилась внутри ${fmtNum(res.stats.runMarkedParas)} абзацев/ячеек (${fmtNum(res.stats.runMarkedWords)} слов)`;
  else scale = 'не оценивается по стилям (размеченный текст не обнаружен)';
  res.verdict = { text: verdict, confidence: conf, scale, mainSource: mainSrc, share };

  const human = [];
  if (res.meta.tables) human.push(`таблицы (${res.meta.tables})`);
  if (res.meta.charts) human.push(`диаграммы Word (${res.meta.charts})`);
  if (res.media.length) human.push(`изображения (${res.media.length})`);
  if (res.meta.shapes) human.push(`схемы/надписи (${res.meta.shapes})`);
  if (res.footnotes.length) human.push(`сноски (${res.footnotes.length})`);
  if (res.meta.comments) human.push(`комментарии (${res.meta.comments})`);
  if (res.meta.addins && res.meta.addins.length) human.push('менеджер библиографии: ' + res.meta.addins.join(', '));
  if (res.meta.chartExternal) human.push(`диаграммы, связанные с внешними Excel-файлами (${res.meta.chartExternal})`);
  if (res.meta.distinctRsids > 300) human.push(`длительная история правки (${fmtNum(res.meta.distinctRsids)} сеансов rsid)`);
  if (F.some(f => f.id === 'style:excel')) human.push('таблицы, вставленные из Excel');
  const ed = (res.stats.figures || []).filter(f => f.type === 'editable').length; if (ed) human.push(`схемы, собранные из фигур Word (${ed})`);
  if (res.meta.insertions || res.meta.deletions) human.push(`записанные исправления (${res.meta.insertions + res.meta.deletions})`);
  if (F.some(f => f.id === 'comp:notes')) human.push('рабочие заметки автора');
  const usedStyles = new Set(res.paras.map(p => p.styleId)); if (usedStyles.size >= 6) human.push(`неоднородное оформление (${usedStyles.size} стилей абзацев)`);
  res.human = human;
}

/* экспорт для Node-тестов */
if (typeof module !== 'undefined') module.exports = { analyzeFile, LEVELS };
