/* ===================== Интерфейс ===================== */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let RES = null;

const GROUPS = { tech: 'Технические следы: стили, HTML, изображения', meta: 'Метаданные файла', chars: 'Невидимые и нестандартные символы', text: 'Остатки ответов чат-ботов и разметки', content: 'Содержательный и языковой анализ', comp: 'Следы компиляции и повторы', style: 'Стилистические показатели', src: 'Источники и ссылочный аппарат' };

function badge(l) { return `<span class="badge b-${l}">${LEVELS[l]}</span>`; }

function setStatus(t) { $('#status').textContent = t; }

async function handleFile(file) {
  if (!file) return;
  LAST_FILE = file; const sm = document.getElementById('saveMsg'); if (sm) sm.textContent = '';
  $('#results').hidden = true; $('#error').hidden = true;
  $('#progress').hidden = false; setStatus('Чтение файла…');
  try {
    RES = await analyzeFile(file, setStatus);
    render(RES);
  } catch (e) {
    console.error(e);
    $('#error').hidden = false; $('#error').textContent = 'Ошибка: ' + e.message;
  } finally { $('#progress').hidden = true; }
}

function render(r) {
  const s = r.stats, v = r.verdict;
  const vClass = s.counts.strong ? 'v-strong' : s.counts.medium >= 2 ? 'v-medium' : (s.counts.medium || s.counts.weak >= 3) ? 'v-weak' : 'v-none';
  $('#verdict').className = 'verdict ' + vClass;
  $('#verdict').innerHTML = `
    <div class="v-head"><div><div class="eyebrow">Итоговая оценка</div><h2>${esc(v.text)}</h2></div>
      ${v.confidence !== '—' ? `<div class="conf">уверенность<br><b>${esc(v.confidence)}</b></div>` : ''}</div>
    <p>${v.mainSource ? `Наиболее вероятный источник по техническим следам: <b>${esc(v.mainSource)}</b>. Характер использования: ${esc(v.scale)}.` : 'Разметки веб-интерфейсов нейросетей в тексте не найдено.'}</p>
    ${r.human.length ? `<p class="muted">Признаки самостоятельной работы: ${esc(r.human.join(', '))}.</p>` : ''}
    <p class="muted small">Файл: ${esc(r.file.name)} · ${fmtNum(r.file.size)} байт · SHA-256 <code>${r.file.sha256}</code></p>`;

  $('#kpis').innerHTML = [
    ['Текст с разметкой веб-интерфейса', r.kind === 'docx' ? fmtPct(s.markedShare || 0) : '—', r.kind === 'docx' ? `${fmtNum(s.markedBodyWords || 0)} из ${fmtNum(s.bodyWords)} слов основного текста` : 'для .txt не определяется'],
    ['Сильные признаки', s.counts.strong, 'прямые следы ИИ'],
    ['Средние признаки', s.counts.medium, 'косвенные технические'],
    ['Слабые признаки', s.counts.weak, 'статистические, неспецифичные'],
  ].map(([t, n, d]) => `<div class="kpi"><div class="kpi-t">${t}</div><div class="kpi-n">${n}</div><div class="kpi-d">${esc(d)}</div></div>`).join('');

  // карта документа
  const cells = r.paras.filter(p => p.words > 0 && !p.toc);
  const lvlOf = p => { const o = { strong: 3, medium: 2, weak: 1, info: 0 }; let m = -1; for (const f of p.flags) m = Math.max(m, o[f.level] ?? -1); return m; };
  $('#map').innerHTML = cells.map(p => { const l = lvlOf(p); const cls = l === 3 ? 'm-strong' : l === 2 ? 'm-medium' : l === 1 ? 'm-weak' : ''; return `<span class="cell ${cls}${p.heading ? ' m-h' : ''}" data-i="${p.i}" title="Абзац №${p.i + 1}${p.page ? ', с. ' + p.page : ''}${p.heading ? ' (заголовок)' : ''}: ${esc(p.text.slice(0, 80))}"></span>`; }).join('');

  // признаки по группам
  let html = '';
  const ord = { strong: 0, medium: 1, weak: 2, info: 3 };
  for (const [g, title] of Object.entries(GROUPS)) {
    const ff = r.findings.filter(f => f.group === g).sort((a, b) => ord[a.level] - ord[b.level]);
    html += `<section class="group"><h3>${title} <span class="cnt">${ff.length}</span></h3>`;
    if (!ff.length) html += `<p class="muted small none">Не обнаружено.</p>`;
    for (const f of ff) {
      html += `<details class="finding" ${f.level === 'strong' ? 'open' : ''}><summary>${badge(f.level)}<span class="f-title">${esc(f.title)}</span></summary>
        <div class="f-body"><p>${esc(f.detail)}</p>${f.note ? `<p class="muted">${esc(f.note)}</p>` : ''}
        ${(f.examples || []).length ? '<ol class="ex">' + f.examples.map(e => `<li>${e.para != null ? `<a href="#" class="goto" data-i="${e.para}">абз. №${e.para + 1}</a> ` : ''}${esc(e.text)}</li>`).join('') + '</ol>' : ''}</div></details>`;
    }
    html += '</section>';
  }
  $('#findings').innerHTML = html;

  // локализация
  const L = r.stats.localization || [];
  $('#loc').innerHTML = L.length ? `<p class="muted small">Где в документе сохранилась разметка веб-интерфейсов: таблицы и разделы, страницы, текст внутри разметки.</p><table><thead><tr><th>Место</th><th>Стр.</th><th class="num">Слов</th><th>Текст в веб-разметке</th></tr></thead><tbody>${L.map(l => `<tr><td>${esc(l.where)}</td><td class="num">${esc(l.pages.replace('с. ', ''))}</td><td class="num">${l.words}</td><td class="small">${esc(l.sample.slice(0, 220))}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Веб-разметка к тексту не применена.</p>';
  // стилометрия
  const S = r.stats.stylometry;
  $('#stylo').innerHTML = S ? `<p class="muted small">Связный текст: ${fmtNum(S.words)} слов. Группа А (лексика LLM): превышено ${S.aHit} из ${S.aTotal}. Группа Б (шаблонность, неспецифично): ${S.bHit} из ${S.bTotal}. Значения — на 1000 слов, кроме MATTR и процентов.</p><table><thead><tr><th>Гр.</th><th>Показатель</th><th class="num">Значение</th><th class="num">Ориентир</th><th>Превышение</th></tr></thead><tbody>${S.rows.map(x => `<tr><td>${x.group === 'A' ? 'А' : 'Б'}</td><td>${esc(x.label)}</td><td class="num">${x.value.toFixed(2)}</td><td class="num">${x.dir} ${x.thr}</td><td>${x.exceeded ? `<span class="badge ${x.group === 'A' ? 'b-medium' : 'b-weak'}">×${x.ratio.toFixed(1)}</span>` : '<span class="muted">нет</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Текста недостаточно для стилометрии (нужно от 600 слов связного текста).</p>';
  // разделы
  const secs = r.sections.filter(x => x.words >= 30);
  $('#sections').innerHTML = secs.length ? `<table><thead><tr><th>Раздел</th><th class="num">Слов</th><th>Доля с разметкой веб-интерфейса</th></tr></thead><tbody>${secs.map(x => { const p = pct(x.marked, x.words); return `<tr><td>${esc(x.title)}</td><td class="num">${fmtNum(x.words)}</td><td><div class="bar"><span style="width:${p.toFixed(1)}%"></span></div><span class="num">${fmtPct(p)}</span></td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">Разделы не выделены.</p>';

  // стили
  const st = r.styles.filter(x => !['builtin', 'linked'].includes(x.category));
  $('#styles').innerHTML = st.length ? `<table><thead><tr><th>Имя стиля</th><th>Распознан как</th><th class="num">Абзацев</th><th class="num">Слов</th><th>Уровень</th></tr></thead><tbody>${st.map(x => `<tr><td><code>${esc(x.name)}</code></td><td>${esc(x.source || 'пользовательский стиль')}</td><td class="num">${fmtNum(x.paras + x.runs)}</td><td class="num">${fmtNum(x.words + x.runWords)}</td><td>${x.level ? badge(x.paras + x.runs || x.level === 'info' ? x.level : (x.level === 'strong' ? 'medium' : 'weak')) : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Пользовательских стилей нет.</p>';

  // метаданные
  const m = r.meta;
  const rows = [['Автор', m.creator], ['Последний редактор', m.lastModifiedBy], ['Создан', m.created], ['Изменён', m.modified], ['Ревизия', m.revision], ['Время правки, мин', m.totalTime], ['Приложение', [m.application, m.appVersion].filter(Boolean).join(' ')], ['Страниц / слов (метаданные)', [m.pages, m.metaWords].filter(Boolean).join(' / ')], ['Сеансов правки (rsid)', m.rsids], ['Название', m.title], ['Тема', m.subject], ['Ключевые слова', m.keywords], ['Описание', m.description], ['Таблиц / диаграмм / изображений', r.kind === 'docx' ? `${m.tables} / ${m.charts} / ${r.media.length}` : null], ['Сносок', r.footnotes.length], ['Комментарии / исправления', r.kind === 'docx' ? `${m.comments} / ${m.insertions + m.deletions}` : null], ['Таблиц (верхнего уровня / всего)', r.kind === 'docx' ? `${m.topTables} / ${m.tables}` : null], ['Секций / DrawingML / VML', r.kind === 'docx' ? `${m.sections} / ${m.drawingML} / ${m.vml}` : null], ['Формул / подписей таблиц / рисунков / приложений', r.kind === 'docx' ? `${m.formulas} / ${m.captionsTab} / ${m.captionsFig} / ${m.appendices}` : null], ['Уникальных rsid в тексте', m.distinctRsids], ['Менеджеры библиографии', (m.addins || []).join(', ')], ['Внешние связи объектов', m.externalLinks ? `${m.externalLinks.length}${m.cloud && m.cloud.length ? ' (' + m.cloud.join(', ') + ')' : ''}` : null], ['Гиперссылок / через Google', r.stats.links ? `${r.stats.links.total} / ${r.stats.links.redirect}` : null], ['Домены ссылок', r.stats.links ? r.stats.links.domains.slice(0, 10).map(([d, n]) => `${d} (${n})`).join(', ') : null], ['Ссылок на источники в тексте', r.stats.citations ? `${r.stats.citations.total} (на ${r.stats.citations.unique} источников из ${r.stats.citations.bib})` : null], ['Страницы определены', m.pageSource === 'rendered' ? 'по последней разметке Word' : m.pageSource ? 'по явным разрывам (приблизительно)' : null], ['Шрифты', (m.fonts || []).join(', ')], ['MD5', r.file.md5], ['SHA-256', r.file.sha256]];
  $('#meta').innerHTML = `<table><tbody>${rows.filter(x => x[1] != null && x[1] !== '').map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;

  // фильтр абзацев
  const types = new Map();
  r.paras.forEach(p => p.flags.forEach(f => { const k = f.label.replace(/«[^»]*»$/, '').replace(/№\d+/, '').replace(/сноске \d+/, 'сноске').trim(); types.set(k, (types.get(k) || 0) + 1); }));
  $('#pfilter').innerHTML = '<option value="">Все абзацы с признаками</option>' + [...types.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `<option value="${esc(k)}">${esc(k)} (${n})</option>`).join('');
  renderParas();

  $('#annot').hidden = r.kind !== 'docx';
  $('#results').hidden = false;
  $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderParas(focus) {
  const r = RES; if (!r) return;
  const flt = $('#pfilter').value;
  let list = r.paras.filter(p => p.flags.length && p.words > 0 && (!flt || p.flags.some(f => f.label.startsWith(flt) || f.label.replace(/«[^»]*»$/, '').replace(/№\d+/, '').replace(/сноске \d+/, 'сноске').trim() === flt)));
  if (focus != null && !list.some(p => p.i === focus)) list = [r.paras[focus], ...list];
  const shown = list.slice(0, 400);
  $('#pcount').textContent = `Показано ${shown.length} из ${list.length}`;
  const hl = (t) => {
    let h = esc(t);
    h = h.replace(/(\[\s*\])/g, '<mark>$1</mark>').replace(/([​‌‍⁠﻿­])/g, '<mark class="inv">⟦·⟧</mark>').replace(/(\*\*[^*]+\*\*)/g, '<mark>$1</mark>');
    for (const re of CHATBOT_PHRASES) h = h.replace(new RegExp(re.source, re.flags.replace('g', '') + 'g'), m => `<mark>${m}</mark>`);
    return h;
  };
  $('#paras').innerHTML = shown.map(p => `<div class="para${p.i === focus ? ' focus' : ''}" id="p${p.i}">
    <div class="p-head"><b>№${p.i + 1}</b>${p.page ? `<b>с. ${p.page}</b>` : ''}<span class="muted">${p.table != null && RES.tables[p.table] ? esc(tableLabel(RES, p.table)) + ' · ' : ''}${esc(p.section.slice(0, 70))}${p.inTable ? ' · в таблице' : ''}${p.inBox ? ' · в надписи' : ''} · стиль «${esc(p.styleName || 'Normal')}» · ${p.words} сл.</span></div>
    <div class="p-flags">${[...new Map(p.flags.map(f => [f.label, f])).values()].map(f => `<span class="chip c-${f.level}">${esc(f.label)}</span>`).join('')}</div>
    <div class="p-text">${hl(p.text.length > 1400 ? p.text.slice(0, 1400) + '…' : p.text)}</div></div>`).join('') || '<p class="muted">Нет абзацев.</p>';
  if (focus != null) { const el = document.getElementById('p' + focus); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.pane').forEach(p => p.hidden = p.id !== 'pane-' + name);
}

function initApp() {
  const inp = $('#file'), dz = $('#drop');
  inp.addEventListener('change', () => handleFile(inp.files[0]));
  dz.addEventListener('click', () => inp.click());
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $('#pfilter').addEventListener('change', () => renderParas());
  document.body.addEventListener('click', e => {
    const a = e.target.closest('.goto, .cell');
    if (a) { e.preventDefault(); const i = +a.dataset.i; showTab('paras'); $('#pfilter').value = ''; renderParas(i); }
  });
  $('#export').addEventListener('click', async () => {
    if (!RES) return;
    const btn = $('#export'); btn.disabled = true; btn.textContent = 'Формирование…';
    try {
      const blob = await buildReportDocx(RES);
      const st = await saveFile(blob, 'Заключение_ИИ_' + RES.file.name.replace(/\.[^.]+$/, '') + '.docx');
      $('#saveMsg').textContent = st === 'declined' ? 'Сохранение отменено.' : 'Заключение сохранено.';
    } catch (e) { $('#saveMsg').textContent = 'Не удалось сформировать заключение: ' + e.message; console.error(e); }
    finally { btn.disabled = false; btn.textContent = 'Скачать заключение .docx'; }
  });
  $('#annot').addEventListener('click', async () => {
    if (!RES) return;
    const btn = $('#annot'); btn.disabled = true; btn.textContent = 'Формирование…';
    try {
      const { blob } = await buildAnnotatedDocx(RES);
      const st = await saveFile(blob, RES.file.name.replace(/\.[^.]+$/, '') + '_подсветка_ИИ.docx');
      $('#saveMsg').textContent = st === 'declined' ? 'Сохранение отменено.' : 'Документ с подсветкой сохранён.';
    } catch (e) { $('#saveMsg').textContent = 'Не удалось сформировать документ: ' + e.message; console.error(e); }
    finally { btn.disabled = false; btn.textContent = 'Скачать документ с подсветкой'; }
  });
  $('#again').addEventListener('click', () => { $('#results').hidden = true; inp.value = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp); else initApp();
