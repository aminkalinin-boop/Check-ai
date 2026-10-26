/* Check-AI: two modes on the SAME page. This UI is an optional addition.
   It never replaces the original analyzer, tabs or report. */
'use strict';
(function () {
  function installModes() {
    const drop = document.getElementById('drop');
    const results = document.getElementById('results');
    if (!drop || !results) return;

    const modeBox = document.createElement('section');
    modeBox.className = 'card';
    modeBox.style.marginTop = '20px';
    const title = document.createElement('h3');
    title.textContent = 'Режим проверки документа';
    const modes = document.createElement('div');
    modes.style.display = 'flex';
    modes.style.flexWrap = 'wrap';
    modes.style.gap = '8px';
    const offlineBtn = document.createElement('button');
    const onlineBtn = document.createElement('button');
    offlineBtn.textContent = 'Офлайн · на устройстве';
    onlineBtn.textContent = 'Онлайн · с ИИ и интернетом';
    offlineBtn.type = onlineBtn.type = 'button';
    const info = document.createElement('p');
    info.className = 'muted small';
    const settings = document.createElement('div');
    settings.hidden = true;
    const endpoint = document.createElement('input');
    endpoint.type = 'url';
    endpoint.autocomplete = 'url';
    endpoint.placeholder = 'https://адрес-сервера-экспертизы.example';
    endpoint.setAttribute('aria-label', 'Адрес сервера онлайн-экспертизы');
    endpoint.value = window.CHECK_AI_API_URL || '';
    endpoint.style.width = 'min(100%, 470px)';
    endpoint.style.padding = '9px';
    endpoint.style.border = '1px solid var(--line)';
    endpoint.style.borderRadius = '8px';
    endpoint.style.background = 'var(--surface)';
    endpoint.style.color = 'var(--text)';
    const endpointTip = document.createElement('p');
    endpointTip.className = 'muted small';
    endpointTip.textContent = 'Онлайн-анализ требует отдельного защищённого сервера OpenAI API. GitHub Pages не может выполнять такие запросы самостоятельно. Адрес сервера можно указать здесь; API-ключ модели должен храниться только на сервере.';
    settings.append(endpointTip, endpoint);
    modes.append(offlineBtn, onlineBtn);
    modeBox.append(title, modes, info, settings);
    drop.parentNode.insertBefore(modeBox, drop);

    const panel = document.createElement('section');
    panel.className = 'card';
    panel.hidden = true;
    const heading = document.createElement('h3');
    heading.textContent = 'Дополнительная экспертная проверка моделью';
    const explanation = document.createElement('p');
    explanation.className = 'muted small';
    explanation.textContent = 'Check-AI уже выполнил обычный анализ на вашем устройстве. В онлайн-режиме модель может дополнительно проверить выбранные фрагменты, библиографию и фактические утверждения, используя веб-поиск. Это отдельный результат, который не заменяет заключение Check-AI.';
    const preview = document.createElement('pre');
    preview.style.whiteSpace = 'pre-wrap';
    preview.style.maxHeight = '190px';
    preview.style.overflow = 'auto';
    preview.style.fontSize = '12px';
    preview.style.padding = '10px';
    preview.style.background = 'var(--surface2)';
    preview.style.borderRadius = '8px';
    const consent = document.createElement('label');
    consent.style.display = 'block';
    const agree = document.createElement('input');
    agree.type = 'checkbox';
    consent.append(agree, document.createTextNode(' Разрешаю передавать показанные фрагменты выбранному онлайн-сервису: API модели либо библиографические записи в Crossref.'));
    const token = document.createElement('input');
    token.type = 'password';
    token.autocomplete = 'off';
    token.placeholder = 'Код доступа к серверу (если требуется)';
    token.setAttribute('aria-label', 'Код доступа к серверу онлайн-экспертизы');
    token.style.display = 'block';
    token.style.width = 'min(100%, 430px)';
    token.style.margin = '12px 0';
    token.style.padding = '8px';
    token.style.border = '1px solid var(--line)';
    token.style.background = 'var(--surface)';
    token.style.color = 'var(--text)';
    const run = document.createElement('button');
    run.type = 'button';
    run.className = 'primary';
    run.textContent = 'Запустить дополнительный ИИ-анализ';
    const crossref = document.createElement('button');
    crossref.type = 'button';
    crossref.textContent = 'Сверить список литературы с Crossref';
    crossref.style.marginLeft = '8px';
    const manual = document.createElement('button');
    manual.type = 'button';
    manual.style.marginLeft = '8px';
    manual.textContent = 'Перенести фрагменты в ChatGPT вручную';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const output = document.createElement('div');
    const crossrefOutput = document.createElement('div');
    panel.append(heading, explanation, preview, consent, token, run, crossref, manual, status, output, crossrefOutput);
    const verdict = document.getElementById('verdict');
    verdict.parentNode.insertBefore(panel, verdict);

    let currentMode = 'offline';
    function chosen() {
      if (typeof RES === 'undefined' || !RES || !Array.isArray(RES.paras)) return { paragraphs: [], bibliography: [] };
      const paras = RES.paras.filter(p => p.words >= 8 && !p.toc && !p.bib && !p.inBox);
      const flagged = paras.filter(p => (p.flags || []).some(f => f.level === 'strong' || f.level === 'medium' || f.level === 'weak'));
      const selected = (flagged.length ? flagged : paras).slice(0, 24);
      const paragraphs = selected.map(p => ({
        paragraph: p.i + 1,
        text: p.text.slice(0, 1000),
        markers: [...new Set((p.flags || []).map(f => f.label))].slice(0, 8)
      }));
      const bibliography = RES.paras.filter(p => p.bib && p.text.trim()).slice(0, 16).map(p => ({
        paragraph: p.i + 1,
        text: p.text.slice(0, 500)
      }));
      return { paragraphs, bibliography };
    }
    function toPreview(data) {
      const body = data.paragraphs.map(p => 'Абзац ' + p.paragraph + ': ' + p.text + (p.markers.length ? '\nПризнаки: ' + p.markers.join('; ') : '')).join('\n\n');
      const bib = data.bibliography.map(p => 'Источник, абзац ' + p.paragraph + ': ' + p.text).join('\n\n');
      return [body, bib ? 'БИБЛИОГРАФИЯ ДЛЯ ПРОВЕРКИ\n' + bib : ''].filter(Boolean).join('\n\n') || 'Фрагменты для онлайн-проверки не найдены.';
    }
    function paint() {
      offlineBtn.className = currentMode === 'offline' ? 'primary' : '';
      onlineBtn.className = currentMode === 'online' ? 'primary' : '';
      offlineBtn.setAttribute('aria-pressed', currentMode === 'offline' ? 'true' : 'false');
      onlineBtn.setAttribute('aria-pressed', currentMode === 'online' ? 'true' : 'false');
      settings.hidden = currentMode !== 'online';
      panel.hidden = currentMode !== 'online' || results.hidden;
      if (currentMode === 'offline') {
        info.textContent = 'Полный исходный анализ и отчёт DOCX выполняются локально. Документ не передаётся на сервер.';
      } else {
        info.textContent = 'Исходный анализ остаётся локальным; ИИ и веб-проверки включаются отдельно, после согласия. Без подключённого сервера онлайн-вызов недоступен.';
        preview.textContent = toPreview(chosen());
        agree.checked = false;
        status.textContent = endpoint.value.trim() ? 'Онлайн-режим выбран. Загрузите документ и разрешите отправку выбранных фрагментов.' : 'Адрес сервера не настроен: дополнительная ИИ-проверка пока недоступна.';
      }
    }
    offlineBtn.addEventListener('click', () => { currentMode = 'offline'; paint(); });
    onlineBtn.addEventListener('click', () => { currentMode = 'online'; paint(); });
    endpoint.addEventListener('change', () => { agree.checked = false; paint(); });
    document.getElementById('file').addEventListener('change', () => { if (currentMode === 'online') { agree.checked = false; output.replaceChildren(); } });
    const observer = new MutationObserver(() => {
      if (currentMode === 'online') {
        panel.hidden = results.hidden;
        if (!results.hidden) { preview.textContent = toPreview(chosen()); agree.checked = false; }
      }
    });
    observer.observe(results, { attributes: true, attributeFilter: ['hidden'] });
    function urlOfServer() {
      const val = endpoint.value.trim().replace(/\/+$/, '');
      if (!val) throw new Error('Укажите адрес сервера онлайн-экспертизы.');
      const parsed = new URL(val);
      if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))
        throw new Error('Сервер должен использовать HTTPS (кроме localhost).');
      if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/')
        throw new Error('Укажите только базовый адрес сервера, без пути, параметров и пароля.');
      return parsed.origin;
    }
    run.addEventListener('click', async () => {
      if (currentMode !== 'online') return;
      const selected = chosen();
      if (!selected.paragraphs.length) { status.textContent = 'Сначала загрузите документ с текстом.'; return; }
      if (!agree.checked) { status.textContent = 'Подтвердите отправку показанных фрагментов.'; return; }
      let host;
      try { host = urlOfServer(); } catch (e) { status.textContent = e.message; return; }
      if (!token.value.trim()) { status.textContent = 'Введите код доступа к серверу.'; return; }
      run.disabled = true;
      status.textContent = 'Дополнительный онлайн-анализ выполняется…';
      output.replaceChildren();
      try {
        const resp = await fetch(host + '/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token.value.trim() },
          body: JSON.stringify(selected)
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Ошибка HTTP ' + resp.status);
        const h = document.createElement('h3'); h.textContent = 'Дополнительный анализ (не заменяет основной отчёт)';
        const p = document.createElement('p'); p.textContent = data.assessment || 'Без общего резюме.';
        output.append(h, p);
        for (const item of data.issues || []) {
          const x = document.createElement('p');
          x.textContent = 'Абзац ' + item.paragraph + ': ' + item.issue + '. Основание: ' + item.reason + '. Рекомендация: ' + item.suggestion;
          output.append(x);
        }
        if (data.sources && data.sources.length) {
          const h4 = document.createElement('h3'); h4.textContent = 'Веб-источники, использованные моделью';
          output.append(h4);
          const ul = document.createElement('ul');
          data.sources.forEach(src => {
            if (typeof src.url !== 'string' || !/^https:\/\//.test(src.url)) return;
            const li = document.createElement('li'); const link = document.createElement('a');
            link.href = src.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.textContent = src.title || src.url; li.append(link); ul.append(li);
          });
          output.append(ul);
        }
        const limit = document.createElement('p'); limit.className = 'muted small';
        limit.textContent = data.limitations || 'Внешний анализ ограничен доступными источниками и требует проверки специалистом.';
        output.append(limit);
        status.textContent = 'Онлайн-анализ получен. Исходное заключение Check-AI не изменено.';
      } catch (e) {
        status.textContent = 'Ошибка онлайн-анализа: ' + e.message;
      } finally { run.disabled = false; }
    });
    crossref.addEventListener('click', async () => {
      if (currentMode !== 'online') return;
      const entries = chosen().bibliography.slice(0, 6);
      if (!entries.length) { status.textContent = 'В документе не найден размеченный список литературы для проверки.'; return; }
      if (!agree.checked) { status.textContent = 'Подтвердите согласие на запросы к Crossref (передаются библиографические записи).'; return; }
      crossref.disabled = true;
      crossrefOutput.replaceChildren();
      const head = document.createElement('h3');
      head.textContent = 'Сверка библиографии в Crossref (справочно)';
      crossrefOutput.append(head);
      const note = document.createElement('p');
      note.className = 'muted small';
      note.textContent = 'Сверяются первые ' + entries.length + ' записей. Не все публикации и российские журналы присутствуют в Crossref. Отсутствие совпадения не означает выдуманную публикацию; найденное совпадение требуется проверить.';
      crossrefOutput.append(note);
      let checked = 0;
      for (const entry of entries) {
        status.textContent = 'Сверка Crossref: ' + (checked + 1) + ' из ' + entries.length + '…';
        const row = document.createElement('p');
        row.className = 'small';
        row.textContent = 'Запись №' + entry.paragraph + ': ';
        try {
          const doiMatch = entry.text.match(/10\.\d{4,9}\/[^\s;,)}\]]+/i);
          const doi = doiMatch ? doiMatch[0].replace(/[.,;]+$/, '') : '';
          const url = doi
            ? 'https://api.crossref.org/works/' + encodeURIComponent(doi)
            : 'https://api.crossref.org/works?rows=1&query.bibliographic=' + encodeURIComponent(entry.text.slice(0, 350));
          const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
          if (!resp.ok) {
            row.textContent += resp.status === 404 ? 'DOI не найден в Crossref (не доказательство ошибки).' : 'Ответ Crossref HTTP ' + resp.status + '; проверка не завершена.';
          } else {
            const json = await resp.json();
            const found = doi ? json.message : json.message?.items?.[0];
            if (!found) {
              row.textContent += 'В Crossref нет доступного совпадения. Требуется проверка по другим базам.';
            } else {
              row.textContent += (doi ? 'DOI зарегистрирован в Crossref. ' : 'Найден возможный кандидат. ') +
                'Название: ' + (found.title?.[0] || 'не указано') +
                '; год: ' + (found.published?.['date-parts']?.[0]?.[0] || found.issued?.['date-parts']?.[0]?.[0] || '—') + '. ';
              if (typeof found.URL === 'string' && /^https:\/\//.test(found.URL)) {
                const a = document.createElement('a'); a.href = found.URL; a.rel = 'noopener noreferrer';
                a.target = '_blank'; a.textContent = 'Открыть карточку DOI'; row.append(a);
              }
            }
          }
        } catch (error) {
          row.textContent += 'Не удалось обратиться к Crossref (' + error.message + '). Это не является признаком фальсификации.';
        }
        crossrefOutput.append(row);
        checked++;
        if (checked < entries.length) await new Promise(resolve => setTimeout(resolve, 1100));
      }
      crossref.disabled = false;
      status.textContent = 'Сверка Crossref завершена. Результаты носят справочный характер.';
    });
    manual.addEventListener('click', async () => {
      const selected = chosen();
      if (!selected.paragraphs.length) { status.textContent = 'Сначала загрузите документ.'; return; }
      if (!agree.checked) { status.textContent = 'Подтвердите согласие перед копированием фрагментов.'; return; }
      const query = 'Проведи независимую научную редакторскую проверку фрагментов ниже. Проверь факты и библиографию через интернет при наличии доступа. Не утверждай авторство ИИ. Указывай абзацы и проверяемые источники.\n\n' + toPreview(selected);
      try {
        await navigator.clipboard.writeText(query);
        window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
        status.textContent = 'Фрагменты скопированы. Вставьте их в открывшийся чат ChatGPT вручную.';
      } catch {
        status.textContent = 'Автокопирование недоступно. Выделите показанные фрагменты и перенесите в ChatGPT самостоятельно.';
      }
    });
    paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installModes);
  else installModes();
})();
