/* ===================================================================
   Стилометрический профиль текста: лексика LLM и шаблонность
   Источники признаков: Wikipedia: Signs of AI writing; Kobak et al. 2024/2025
   (excess vocabulary, arXiv:2406.07016); Reinhart et al. (CMU, PNAS 2025,
   признаки Бибера); Juzek 2025 (34 языка, «важно отметить», «подчеркнуть»);
   обзоры русскоязычных признаков (Т—Ж, «Грамота»).
   Пороги откалиброваны на небольшом наборе: тексты DeepSeek и ИИ-агентов
   против текстов с ручной правкой. Это ориентиры, а не доказательные нормы.
   =================================================================== */
'use strict';
// Эталон: обезличенный корпус научного автора-экономиста, статьи 2016–2022 гг. (до ChatGPT), процентили на 1000 слов
const HUMAN_BASELINE = {"n_human": 62, "n_post": 17, "features": {"evaluative": {"p10": 1.175, "p50": 4.727, "p90": 10.675, "post_p50": 5.495, "post_share_over_p90": 0.235, "human_share_over_p90": 0.113}, "excess": {"p10": 0.0, "p50": 0.0, "p90": 0.662, "post_p50": 0.0, "post_share_over_p90": 0.118, "human_share_over_p90": 0.113}, "netolko": {"p10": 0.0, "p50": 0.0, "p90": 1.032, "post_p50": 0.861, "post_share_over_p90": 0.294, "human_share_over_p90": 0.113}, "neprosto": {"p10": 0.0, "p50": 0.0, "p90": 0.0, "post_p50": 0.0, "post_share_over_p90": 0.059, "human_share_over_p90": 0.065}, "tail": {"p10": 0.0, "p50": 0.0, "p90": 0.0, "post_p50": 0.0, "post_share_over_p90": 0.176, "human_share_over_p90": 0.097}, "etodash": {"p10": 0.0, "p50": 0.0, "p90": 0.661, "post_p50": 0.0, "post_share_over_p90": 0.294, "human_share_over_p90": 0.113}, "dash": {"p10": 1.136, "p50": 5.212, "p90": 9.728, "post_p50": 7.053, "post_share_over_p90": 0.235, "human_share_over_p90": 0.113}, "colon": {"p10": 0.978, "p50": 2.837, "p90": 7.439, "post_p50": 4.955, "post_share_over_p90": 0.353, "human_share_over_p90": 0.113}, "meta": {"p10": 0.0, "p50": 1.327, "p90": 3.257, "post_p50": 0.245, "post_share_over_p90": 0.0, "human_share_over_p90": 0.113}, "ramki": {"p10": 0.0, "p50": 0.996, "p90": 3.289, "post_p50": 0.735, "post_share_over_p90": 0.118, "human_share_over_p90": 0.113}, "intens": {"p10": 0.0, "p50": 0.0, "p90": 0.662, "post_p50": 0.0, "post_share_over_p90": 0.118, "human_share_over_p90": 0.113}, "links": {"p10": 1.047, "p50": 3.426, "p90": 5.184, "post_p50": 3.567, "post_share_over_p90": 0.235, "human_share_over_p90": 0.113}, "summary": {"p10": 0.0, "p50": 0.0, "p90": 0.0, "post_p50": 0.0, "post_share_over_p90": 0.118, "human_share_over_p90": 0.081}, "commas": {"p10": 1.135, "p50": 1.506, "p90": 2.171, "post_p50": 2.047, "post_share_over_p90": 0.471, "human_share_over_p90": 0.113}, "constart": {"p10": 2.745, "p50": 8.488, "p90": 13.63, "post_p50": 9.091, "post_share_over_p90": 0.059, "human_share_over_p90": 0.113}, "sentcv": {"p10": 0.45, "p50": 0.636, "p90": 0.877, "post_p50": 0.65, "post_share_over_p90": 0.176, "human_share_over_p90": 0.113}}};

const RX = (s) => new RegExp(s, 'giu');
const NB = '(?<!\\p{L})', NA = '(?!\\p{L})';
// группа A — лексика и конструкции, типичные для ответов LLM
const STYLO_A = [
  { id: 'evaluative', label: 'Оценочно-усилительная лексика («ключевой», «значимый», «комплексный», «эффективный», «неотъемлемый»…)', re: RX(NB + '(ключев|важнейш|значим|комплексн|всесторонн|целостн|уникальн|эффективн|актуальн|неотъемлем|фундаментальн|стратегически\\p{L}*\\s+важн|инновационн|многогранн)\\p{L}*'), thr: 10, dir: '>' },
  { id: 'excess', label: 'Избыточная «ИИ-лексика» (аналоги delve/underscore/showcase: «подчёркивает», «демонстрирует», «играет ключевую роль», «открывает возможности»…)', re: RX(NB + '(подчеркива\\p{L}*|подчёркива\\p{L}*|демонстриру\\p{L}*|тщательн\\p{L}*|примечательн\\p{L}*|играет\\s+(важную|ключевую|значимую|решающую)\\s+роль|открыва\\p{L}*\\s+(новые\\s+)?(возможност|перспектив)\\p{L}*|в\\s+современном\\s+мире|в\\s+эпоху\\s+\\p{L}+|служит\\s+(ярким\\s+)?примером|является\\s+свидетельством)'), thr: 1.0, dir: '>' },
  { id: 'netolko', label: 'Конструкция «не только…, но и»', re: RX(NB + 'не\\s+только' + NA), thr: 1.0, dir: '>' },
  { id: 'neprosto', label: 'Отрицательный параллелизм («не просто…, а», «это не…, а», «не столько…, сколько»)', re: RX(NB + '(не\\s+просто|не\\s+столько|это\\s+не\\s+\\p{L}+(\\s+\\p{L}+)?,\\s*а)' + NA), thr: 0.25, dir: '>' },
  { id: 'tail', label: 'Деепричастные «хвосты» с общей оценкой («…, обеспечивая / подчёркивая / способствуя…»)', re: RX(',\\s+(отражая|подчеркивая|подчёркивая|демонстрируя|обеспечивая|способствуя|формируя|позволяя|создавая|открывая|усиливая|определяя|выступая|закладывая)' + NA), thr: 0.5, dir: '>' },
  { id: 'etodash', label: 'Определения через тире «X — это Y»', re: RX('\\s[—–]\\s+это' + NA), thr: 0.7, dir: '>' },
];
// группа B — шаблонность и однообразие (неспецифично: бывает и у людей)
const STYLO_B = [
  { id: 'meta', label: 'Метадискурсивные формулы («стоит / следует / важно отметить», «подчеркнём», «немаловажно»)', re: RX(NB + '((стоит|следует|важно|необходимо|нужно)\\s+(отметить|подчеркнуть|выделить|указать)|отметим|подчеркнем|подчеркнём|немаловажно)' + NA), thr: 3.3, dir: '>' },
  { id: 'ramki', label: '«В рамках»', re: RX(NB + 'в\\s+рамках' + NA), thr: 3.3, dir: '>' },
  { id: 'intens', label: 'Усилители и модальные оценки («весьма», «несомненно», «безусловно», «крайне»)', re: RX(NB + '(весьма|несомненно|безусловно|крайне|действительно|бесспорно)' + NA), thr: 0.7, dir: '>' },
  { id: 'links', label: 'Логические связки («таким образом», «при этом», «в целом», «в свою очередь», «соответственно»…)', re: RX(NB + '(таким\\s+образом|кроме\\s+того|более\\s+того|при\\s+этом|в\\s+целом|в\\s+свою\\s+очередь|соответственно|вместе\\s+с\\s+тем|помимо\\s+этого|следовательно|тем\\s+самым)' + NA), thr: 5.2, dir: '>' },
  { id: 'summary', label: 'Итоговые формулы («в заключение», «подводя итог», «можно прийти к выводу», «можно резюмировать»)', re: RX(NB + '(в\\s+заключение|подводя\\s+итог|обобщая|резюмируя|можно\\s+(сделать\\s+вывод|резюмировать|заключить|прийти\\s+к\\s+выводу|констатировать))' + NA), thr: 1.0, dir: '>' },
  { id: 'vague', label: 'Размытые атрибуции без ссылки («ряд исследователей», «некоторые авторы», «эксперты отмечают»)', re: null, thr: 0.4, dir: '>' },
];

function stylometry(res) {
  const body = res.paras.filter(p => !p.toc && !p.heading && !p.bib && !p.inTable && !p.inBox && p.words >= 8)
    .filter(p => { const lat = (p.text.match(/[A-Za-z]/g) || []).length, cyr = (p.text.match(/[А-Яа-яЁё]/g) || []).length; return cyr > lat * 2; });
  const text = body.map(p => p.text).join('\n');
  const W = (text.toLowerCase().replace(/ё/g, 'е').match(/\p{L}+(?:-\p{L}+)*/gu) || []);
  const n = W.length;
  if (n < 600) { res.stats.stylometry = null; return; }
  const per = c => 1000 * c / n;
  const rows = [];
  const count = (re) => { re.lastIndex = 0; return (text.match(re) || []).length; };
  for (const m of STYLO_A) { const c = count(m.re); rows.push({ group: 'A', ...m, count: c, value: per(c) }); }
  // запятые на предложение: усложнение синтаксиса при правке ИИ (эталон автора 2016–2022: P90 = 2,17; статьи 2023+ выше P90 в 47%)
  const sentsA = body.flatMap(p => p.text.split(/(?<![\s(][А-ЯЁA-Z])(?<=[.!?])\s+(?=[А-ЯЁ«])/)).filter(s => countWords(s) >= 4);
  rows.push({ group: 'A', id: 'commas', label: 'Запятых на предложение (сложность синтаксиса)', value: (text.match(/,/g) || []).length / Math.max(1, sentsA.length), count: null, thr: 2.17, dir: '>' });
  // справочно, без влияния на итог
  for (const [id, label, re] of [['dash', 'Тире (— и –) в связном тексте', /\s[—–]\s/g], ['colon', 'Двоеточия в связном тексте', /:/g]]) { const c = count(re); rows.push({ group: 'C', id, label, count: c, value: per(c), thr: null, dir: null }); }
  // размытые атрибуции — только в предложениях без [ссылки] и сноски
  const vagueRe = RX(NB + '((ряд|многие|некоторые|большинство|отдельные)\\s+(исследовател|автор|ученых|учёных|эксперт|специалист)\\p{L}*|исследования\\s+показывают|эксперты\\s+(отмечают|считают|полагают)|по\\s+мнению\\s+(экспертов|специалистов|ученых|учёных)|принято\\s+считать)');
  let vague = 0; const vagueEx = [];
  for (const p of body) for (const s of p.text.split(/(?<![\s(][А-ЯЁA-Z])(?<=[.!?])\s+(?=[А-ЯЁ«])/)) { vagueRe.lastIndex = 0; if (vagueRe.test(s) && !/\[\s*\d/.test(s)) { vague++; if (vagueEx.length < 4) vagueEx.push({ p, s }); } }
  for (const m of STYLO_B) { const c = m.id === 'vague' ? vague : count(m.re); rows.push({ group: 'B', ...m, count: c, value: per(c) }); }
  // лексическое разнообразие MATTR (окно 400)
  const win = 400; let mattr;
  if (n >= win * 2) { let sum = 0, k = 0; for (let i = 0; i + win <= n; i += 50) { sum += new Set(W.slice(i, i + win)).size / win; k++; } mattr = sum / k; }
  if (mattr != null) rows.push({ group: 'B', id: 'mattr', label: 'Лексическое разнообразие MATTR (доля разных слов в окне 400 слов)', value: mattr, count: null, thr: 0.6, dir: '<' });
  // начала предложений со связки
  const sents = body.flatMap(p => p.text.split(/(?<![\s(][А-ЯЁA-Z])(?<=[.!?])\s+(?=[А-ЯЁ«])/)).filter(s => countWords(s) >= 4);
  const conStart = sents.filter(s => /^\s*«?(Таким образом|Кроме того|Более того|При этом|В целом|В свою очередь|Соответственно|В частности|Вместе с тем|Также|Однако|Следовательно|Помимо этого|Тем самым|Стоит|Следует|Важно|Необходимо отметить)(?!\p{L})/u.test(s)).length;
  rows.push({ group: 'B', id: 'constart', label: 'Доля предложений, начинающихся со связки или «стоит / следует…», %', value: 100 * conStart / Math.max(1, sents.length), count: conStart, thr: 13.6, dir: '>' });
  // повтор начала абзацев
  const starts = {}; body.filter(p => p.words >= 25).forEach(p => { const w = (p.text.match(/\p{L}+/u) || [''])[0].toLowerCase(); starts[w] = (starts[w] || 0) + 1; });
  const bp = body.filter(p => p.words >= 25).length; const top = Object.entries(starts).sort((a, b) => b[1] - a[1])[0];
  if (bp >= 8 && top) rows.push({ group: 'B', id: 'pstart', label: `Абзацы, начинающиеся одним словом («${top[0]}»), %`, value: 100 * top[1] / bp, count: top[1], thr: 30, dir: '>' });
  rows.forEach(r => { const b = HUMAN_BASELINE.features[r.id]; if (b) r.range = [b.p10, b.p90]; if (r.thr == null) { r.exceeded = false; r.ratio = 0; return; } r.exceeded = r.dir === '>' ? r.value > r.thr : r.value < r.thr; r.ratio = r.dir === '>' ? (r.thr ? r.value / r.thr : 0) : (r.value ? r.thr / r.value : 0); });
  const A = rows.filter(r => r.group === 'A'), B = rows.filter(r => r.group === 'B');
  const aHit = A.filter(r => r.exceeded).length, bHit = B.filter(r => r.exceeded).length;
  res.stats.stylometry = { words: n, sentences: sents.length, rows, aHit, aTotal: A.length, bHit, bTotal: B.length };

  // абзацы с наибольшей плотностью ИИ-лексики
  const paraScore = body.filter(p => p.words >= 40).map(p => {
    let a = 0; for (const m of STYLO_A.slice(0, 6)) { m.re.lastIndex = 0; a += (p.text.match(m.re) || []).length; }
    let b = 0; for (const m of STYLO_B) { if (!m.re) continue; m.re.lastIndex = 0; b += (p.text.match(m.re) || []).length; }
    return { p, a, b, aD: 1000 * a / p.words, bD: 1000 * b / p.words };
  });
  const topA = paraScore.filter(x => x.a >= 4 && x.aD >= 35).sort((x, y) => y.aD - x.aD);
  const topB = paraScore.filter(x => x.b >= 4 && x.bD >= 30).sort((x, y) => y.bD - x.bD);
  topA.slice(0, 40).forEach(x => x.p.flags.push({ type: 'stylo', key: 'styloA', level: 'weak', label: `Концентрация ИИ-лексики: ${x.a} на ${x.p.words} сл.` }));
  topB.slice(0, 40).forEach(x => x.p.flags.push({ type: 'stylo', key: 'styloB', level: 'info', label: `Шаблонные формулы: ${x.b} на ${x.p.words} сл.` }));
  res.stats.stylometry.topA = topA.length; res.stats.stylometry.topB = topB.length;

  const fmt = r => `${r.label.replace(/\s*\(.*$/, '')}: ${r.id === 'mattr' ? r.value.toFixed(2) : r.value.toFixed(r.value < 10 ? 2 : 1)}${r.id === 'constart' || r.id === 'pstart' ? '%' : r.id === 'mattr' ? '' : ' на 1000 сл.'} (ориентир ${r.dir} ${r.thr})`;
  const lvlA = aHit >= 4 ? 'medium' : aHit >= 2 ? 'weak' : 'info';
  addFinding(res, { id: 'styloA', group: 'style', title: `Лексический профиль LLM: ${aHit} из ${A.length} маркеров выше ориентира`, level: lvlA, value: aHit,
    detail: `Связный текст: ${fmtNum(n)} слов. ` + (aHit ? 'Превышены: ' + A.filter(r => r.exceeded).map(fmt).join('; ') + '. ' : 'Ни один маркер не превышает ориентир. ') + `В норме: ${A.filter(r => !r.exceeded).map(r => r.label.replace(/\s*\(.*$/, '') + ' ' + r.value.toFixed(2)).join('; ')}. Абзацев с концентрацией ИИ-лексики: ${topA.length}.`,
    note: 'Набор слов и конструкций, частота которых резко выросла в текстах после появления ChatGPT (Kobak et al.; Juzek; Wikipedia: Signs of AI writing). Ориентиры сверены с эталонным корпусом научного автора-экономиста (62 статьи 2016–2022 гг., написанные до появления ChatGPT): у этих статей превышено в среднем менее одного ориентира; тексты DeepSeek превышают 5–6. Это вероятностный признак: его нельзя использовать как доказательство.',
    examples: topA.slice(0, 4).map(x => ({ para: x.p.i, text: `${pg(x.p) || 'абз. ' + (x.p.i + 1)}: ${x.a} маркеров на ${x.p.words} сл. — «${snippet(x.p.text, null, 150)}»` })) });
  const lvlB = bHit >= 6 ? 'weak' : 'info';
  addFinding(res, { id: 'styloB', group: 'style', title: `Шаблонность и однообразие: ${bHit} из ${B.length} показателей выше ориентира`, level: lvlB, value: bHit,
    detail: (bHit ? 'Превышены: ' + B.filter(r => r.exceeded).map(fmt).join('; ') + '. ' : 'Показатели в пределах ориентиров. ') + `Предложений: ${fmtNum(sents.length)}.` + (vagueEx.length ? ` Размытые атрибуции: ${vagueEx.slice(0, 3).map(v => `${pg(v.p)} «${snippet(v.s, null, 90)}»`).join('; ')}.` : ''),
    note: 'Повторяющиеся формулы, связки в начале предложений и бедный словарь характерны для сгенерированного текста, но так же типичны для канцелярского авторского стиля и для текста, прогнанного через перефразировщик. Сами по себе на ИИ не указывают; учитываются только вместе с лексическим профилем LLM и техническими следами.',
    examples: topB.slice(0, 3).map(x => ({ para: x.p.i, text: `${pg(x.p) || 'абз. ' + (x.p.i + 1)}: ${x.b} шаблонных формул на ${x.p.words} сл. — «${snippet(x.p.text, null, 140)}»` })) });
}
