/* Additional robustness diagnostics motivated by editing and prompt-steering patterns.
   These diagnostics are deliberately NON-ATTRIBUTIONAL. Their thresholds have not
   been externally validated: they inform review, never establish AI authorship. */
'use strict';

function robustnessChecks(res) {
  const paras = res.paras.filter(p => !p.heading && !p.toc && !p.bib && !p.inTable && !p.inBox && p.words >= 5);
  const joined = paras.map(p => p.text).join('\n');
  const cyr = (joined.match(/[А-Яа-яЁё]/g) || []).length;
  const yo = (joined.match(/[Ёё]/g) || []).length;
  const dashes = {
    em: (joined.match(/—/g) || []).length,
    en: (joined.match(/–/g) || []).length,
    hyphen: (joined.match(/(?<=\s)-(?!-)(?=\s)/g) || []).length
  };
  const quotes = {
    angle: (joined.match(/[«»]/g) || []).length,
    curly: (joined.match(/[“”]/g) || []).length,
    straight: (joined.match(/"/g) || []).length
  };
  const sentences = paras.flatMap(p => p.text.split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z«])/u))
    .map(x => countWords(x)).filter(n => n >= 3 && n <= 130);
  const n = sentences.length;
  let rhythm = null;
  if (n >= 60) {
    const mean = sentences.reduce((a, b) => a + b, 0) / n;
    const variance = sentences.reduce((a, x) => a + (x - mean) ** 2, 0) / n;
    const acf = {};
    if (variance > 0.001) {
      for (let lag = 1; lag <= 4; lag++) {
        let numerator = 0;
        for (let i = lag; i < n; i++) numerator += (sentences[i] - mean) * (sentences[i - lag] - mean);
        acf[lag] = numerator / (n * variance);
      }
    }
    const candidates = Object.entries(acf).filter(([lag]) => +lag >= 2)
      .sort((a, b) => b[1] - a[1]);
    const best = candidates[0] || null;
    rhythm = { sentences: n, acf, lag: best ? Number(best[0]) : null, coefficient: best ? best[1] : null };
    // Periodicity is interesting for the editor but cannot identify its cause.
    if (best && best[1] >= 0.6) {
      addFinding(res, {
        id: 'robust:rhythm', group: 'style', title: 'Повторяющийся ритм длины предложений (проверить вручную)',
        level: 'info', value: Math.round(best[1] * 100) / 100,
        detail: 'На ' + n + ' предложениях обнаружена автокорреляция с шагом ' + best[0] +
          ': ' + best[1].toFixed(2) + '. Это может быть результатом осознанной редакторской стратегии, жанрового шаблона или случайной структуры.',
        note: 'Исследовательский показатель, не валидирован на независимых русскоязычных корпусах. Не означает, что автор обходил детектор или использовал ИИ.'
      });
    }
  }

  // A high number of percentages without local attribution may warrant fact
  // checking. Statistical tests are NOT universally required for percentages.
  const percentRe = /\b\d{1,3}(?:[.,]\d{1,2})?\s*%/g;
  const contextRe = /(по\s+данным|по\s+результатам|источник|согласно|таблиц|рисунк|обследован|респондент|выборк|наблюден|эксперимент|статистик|расч[её]т|опрос|период|\bN\s*=|\[[0-9]{1,3}(?:[,;\s][0-9]{1,3})*\])/iu;
  const percentLocations = [];
  const unattested = [];
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    const hits = p.text.match(percentRe) || [];
    if (!hits.length) continue;
    percentLocations.push({ paragraph: p.i, count: hits.length });
    const context = [paras[i - 1]?.text || '', p.text, paras[i + 1]?.text || ''].join(' ').slice(0, 3500);
    if (!contextRe.test(context)) unattested.push({ para: p, matches: hits.slice(0, 6) });
  }
  if (unattested.length >= 2) {
    addFinding(res, {
      id: 'robust:percent', group: 'content',
      title: 'Числовые утверждения без явной ближайшей атрибуции',
      level: 'info', value: unattested.length,
      detail: 'Фрагментов с процентами без обнаруженного рядом указания источника, расчёта или выборки: ' + unattested.length +
        '. Проверьте источники и методику независимо от предположения об ИИ.',
      note: 'Поиск ближайших слов-сигналов не проверяет достоверность чисел. В иных жанрах проценты могут быть общепринятыми справочными фактами или объясняться в другом разделе. Отсутствие p-value или доверительного интервала само по себе не ошибка.',
      examples: unattested.slice(0, 8).map(x => ({ para: x.para.i, text: 'Абзац ' + (x.para.i + 1) + ': ' + x.matches.join(', ') + ' — ' + x.para.text.slice(0, 130) }))
    });
  }
  const stats = { cyrillicLetters: cyr, yoLetters: yo, yoPer10000: cyr ? Math.round(10000 * yo / cyr * 100) / 100 : 0,
    dashes, quotes, percentages: percentLocations.length, percentNoLocalAttribution: unattested.length, rhythm };
  res.stats.robustness = stats;

  // "ё" and punctuation normalization are common human editorial choices.
  // Report counts as neutral data. Never turn their absence into an AI flag.
  if (cyr >= 8000) {
    addFinding(res, {
      id: 'robust:typography', group: 'chars', title: 'Типографический профиль (справочно)',
      level: 'info', value: yo,
      detail: 'В основном тексте букв «ё»: ' + yo + ' на ' + cyr + ' кириллических букв; тире —: ' +
        dashes.em + ', тире –: ' + dashes.en + ', дефис с пробелами: ' + dashes.hyphen +
        '; кавычки «»: ' + quotes.angle + ', “”:' + quotes.curly + '.',
      note: 'Единообразное использование «е» вместо «ё», кавычек и тире — нормальная редакторская практика. Эти наблюдения не следует трактовать как маскировку ИИ.'
    });
  }
}
