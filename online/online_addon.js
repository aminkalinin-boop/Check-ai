/* Unified Check-AI interface: local baseline in BOTH modes.
   Online extensions run automatically after the same local analysis, with
   explicit disclosure before sending selected excerpts or references.
   No user-configured URL, token, extra tab or alternative analyzer. */
'use strict';
(function () {
  function installModes() {
    const drop = document.getElementById('drop');
    const results = document.getElementById('results');
    const area = document.getElementById('findings');
    if (!drop || !results || !area) return;
    const cfg = typeof CHECK_AI_ONLINE_CONFIGURATION === 'undefined'
      ? { apiBase: '' } : CHECK_AI_ONLINE_CONFIGURATION;
    const holder = document.createElement('section');
    holder.className = 'card';
    holder.setAttribute('aria-label', 'Режим проверки');
    holder.style.marginTop = '16px';
    const top = document.createElement('div');
    top.style.display = 'flex';
    top.style.flexWrap = 'wrap';
    top.style.gap = '8px';
    top.style.alignItems = 'center';
    const caption = document.createElement('strong');
    caption.textContent = 'Режим проверки';
    caption.style.marginRight = '8px';
    const offline = document.createElement('button');
    offline.type = 'button';
    offline.textContent = 'Офлайн';
    const online = document.createElement('button');
    online.type = 'button';
    online.textContent = 'Онлайн';
    const status = document.createElement('p');
    status.className = 'muted small';
    status.setAttribute('role', 'status');
    status.style.marginTop = '8px';
    top.append(caption, offline, online);
    holder.append(top, status);
    drop.parentNode.insertBefore(holder, drop);
    let mode = 'offline';
    let consentGiven = false;
    let generation = 0;
    let lastResult = null;
    const onlineSectionId = 'check-ai-online-findings';

    function updateMode() {
      offline.className = mode === 'offline' ? 'primary' : '';
      online.className = mode === 'online' ? 'primary' : '';
      offline.setAttribute('aria-pressed', String(mode === 'offline'));
      online.setAttribute('aria-pressed', String(mode === 'online'));
      if (mode === 'offline') {
        status.textContent = 'Все этапы, справочники и заключение работают на устройстве. Нет запросов к сети.';
      } else {
        status.textContent = 'Основная проверка локальная; онлайн-дополнения запускаются автоматически после неё. ' +
          (cfg.apiBase ? 'Экспертиза логики доступна через подключённый API.' : 'ИИ-анализ логики пока не подключён; доступна независимая сверка источников Crossref.');
      }
    }
    function removeOnlineOutput() {
      const node = document.getElementById(onlineSectionId);
      if (node) node.remove();
    }
    function outputContainer() {
      let out = document.getElementById(onlineSectionId);
      if (!out) {
        out = document.createElement('section');
        out.id = onlineSectionId;
        out.className = 'group';
        out.setAttribute('aria-label', 'Онлайн проверки');
        area.appendChild(out);
      }
      return out;
    }
    function para(text, parent, muted = false) {
      const item = document.createElement('p');
      item.textContent = text;
      if (muted) item.className = 'muted small';
      parent.append(item);
      return item;
    }
    function safeLink(url, title, parent) {
      if (!/^https:\/\/[^\s]+$/i.test(url)) return;
      const a = document.createElement('a');
      a.href = url;
      a.textContent = title || url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      parent.append(a);
    }
    function collect(r) {
      if (!r || !Array.isArray(r.paras)) return { paragraphs: [], bibliography: [] };
      const paragraphs = r.paras.filter(p => p && p.words >= 8 && !p.toc && !p.bib && !p.inBox);
      const marked = paragraphs.filter(p => (p.flags || []).some(f => ['strong', 'medium', 'weak'].includes(f.level)));
      // Stable selection of flagged excerpts first, or representative excerpt fallback.
      const chosen = (marked.length ? marked : paragraphs).slice(0, 24);
      return {
        paragraphs: chosen.map(p => ({
          paragraph: p.i + 1,
          text: p.text.slice(0, 1000),
          markers: [...new Set((p.flags || []).map(f => f.label).filter(x => typeof x === 'string'))].slice(0, 8)
        })),
        bibliography: r.paras.filter(p => p && p.bib && p.text.trim()).slice(0, 16)
          .map(p => ({ paragraph: p.i + 1, text: p.text.slice(0, 500) }))
      };
    }
    async function verifySources(bibliography, container, serial) {
      const head = document.createElement('h4');
      head.textContent = 'Сверка научных источников (Crossref)';
      container.append(head);
      const entries = bibliography.slice(0, 5);
      if (!entries.length) {
        para('Размеченный список литературы не найден. Внешние запросы не выполнялись.', container, true);
        return;
      }
      para('Проверяются первые ' + entries.length + ' записи. Совпадение — кандидат на ручную сверку; отсутствие записи не является доказательством выдуманного источника.', container, true);
      for (const item of entries) {
        if (serial !== generation || mode !== 'online') return;
        const row = document.createElement('p');
        row.className = 'small';
        row.textContent = 'Источник, абзац ' + item.paragraph + ': ';
        container.append(row);
        try {
          const doiMatch = item.text.match(/10\.\d{4,9}\/[^\s;,)}\]]+/i);
          const doi = doiMatch ? doiMatch[0].replace(/[.,;]+$/, '') : null;
          const reqUrl = doi
            ? 'https://api.crossref.org/works/' + encodeURIComponent(doi)
            : 'https://api.crossref.org/works?rows=1&query.bibliographic=' + encodeURIComponent(item.text.slice(0, 340));
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          let response;
          try { response = await fetch(reqUrl, { signal: controller.signal }); }
          finally { clearTimeout(timeout); }
          if (serial !== generation || mode !== 'online') return;
          if (!response.ok) {
            row.append(document.createTextNode(response.status === 404
              ? 'DOI отсутствует в Crossref; это не подтверждает его вымышленность.'
              : 'Crossref ответил HTTP ' + response.status + '. Результат не установлен.'));
          } else {
            const json = await response.json();
            if (serial !== generation || mode !== 'online') return;
            const found = doi ? json.message : json.message?.items?.[0];
            if (!found) row.append(document.createTextNode('Подтверждённого совпадения нет.'));
            else {
              const name = found.title?.[0] || 'название отсутствует';
              const year = found.published?.['date-parts']?.[0]?.[0] || found.issued?.['date-parts']?.[0]?.[0] || 'год не указан';
              row.append(document.createTextNode((doi ? 'DOI зарегистрирован: ' : 'Возможный кандидат: ') +
                String(name).slice(0, 170) + ' (' + year + '). '));
              if (typeof found.URL === 'string') safeLink(found.URL, 'Карточка источника', row);
            }
          }
        } catch (_err) {
          if (serial !== generation || mode !== 'online') return;
          row.append(document.createTextNode('Сетевая проверка недоступна; нельзя делать вывод о подлинности.'));
        }
      }
    }
    function gatewayOrigin() {
      if (!cfg.apiBase) return '';
      try {
        const parsed = new URL(cfg.apiBase);
        if (parsed.protocol !== 'https:' ||
            parsed.username || parsed.password || parsed.search || parsed.hash ||
            parsed.pathname !== '/') return '';
        return parsed.origin;
      } catch (_) { return ''; }
    }
    async function reviewLogic(selected, container, serial) {
      const head = document.createElement('h4');
      head.textContent = 'Логика научного рассуждения и проверка фактов';
      container.append(head);
      const base = gatewayOrigin();
      if (!base) {
        para('Дополнительная экспертиза языковой моделью пока не подключена к этому сайту. ' +
          'Она требует отдельного защищённого API-сервера, который настраивает разработчик; вводить адрес или ключ пользователю не нужно.', container, true);
        return;
      }
      if (!selected.paragraphs.length) {
        para('Нет достаточного текстового материала для дополнительной проверки.', container, true);
        return;
      }
      para('Запрос модели по выбранным фрагментам…', container, true);
      try {
        const response = await fetch(base + '/api/review', {
          method: 'POST', mode: 'cors', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selected)
        });
        if (serial !== generation || mode !== 'online') return;
        let data;
        try { data = await response.json(); } catch (_) { throw Error('ответ сервера не является JSON'); }
        if (!response.ok) throw Error(data.error || 'HTTP ' + response.status);
        para('Дополнительная экспертная оценка: ' + String(data.assessment || 'нет резюме'), container);
        for (const item of (Array.isArray(data.issues) ? data.issues : []).slice(0, 30)) {
          const n = Number(item.paragraph);
          para('Абзац ' + (Number.isInteger(n) ? n : '—') + ': ' + String(item.issue || '') +
            '. Основание: ' + String(item.reason || '') +
            '. Проверить: ' + String(item.suggestion || ''), container);
        }
        if (Array.isArray(data.sources) && data.sources.length) {
          const links = document.createElement('p'); links.className = 'small';
          links.textContent = 'Источники: ';
          data.sources.slice(0, 10).forEach(src => {
            if (typeof src.url === 'string') {
              safeLink(src.url, src.title || src.url, links);
              links.append(document.createTextNode(' · '));
            }
          });
          container.append(links);
        }
        para(String(data.limitations || 'Выводы модели требуют проверки по первичным документам; это не измерение авторства.'), container, true);
      } catch (err) {
        if (serial !== generation || mode !== 'online') return;
        para('Смысловая онлайн-проверка не выполнена: ' + err.message + '. Локальный анализ и Word-отчёт остаются действительными.', container, true);
      }
    }
    async function startOnline(r) {
      if (mode !== 'online' || !consentGiven || !r) return;
      const serial = ++generation;
      removeOnlineOutput();
      const out = outputContainer();
      const heading = document.createElement('h3');
      heading.textContent = 'Дополнительные онлайн-проверки';
      out.append(heading);
      para('Локальный анализ уже завершён. Сетевые результаты независимы от исходных уровней и не меняют оценку использования ИИ.', out, true);
      const selected = collect(r);
      status.textContent = 'Онлайн: сверка библиографии и научной логики…';
      // Both online steps run automatically after the exact same local analyzer.
      await Promise.all([
        verifySources(selected.bibliography, out, serial),
        reviewLogic(selected, out, serial)
      ]);
      if (serial === generation && mode === 'online')
        status.textContent = 'Проверка завершена: локальное ядро + доступные онлайн-модули. Отчёт DOCX содержит исходную локальную экспертизу.';
    }
    offline.addEventListener('click', () => {
      generation++;
      mode = 'offline';
      consentGiven = false;
      removeOnlineOutput();
      updateMode();
    });
    online.addEventListener('click', () => {
      if (mode === 'online') return;
      // A single explicit decision at mode selection; no token/endpoint form.
      const allowed = window.confirm(
        'ОНЛАЙН-ПРОВЕРКА\n\nОсновной файл остаётся на вашем устройстве. ' +
        'После анализа в интернет могут отправляться до 5 библиографических записей в Crossref ' +
        'и (если подключён защищённый сервер) до 24 выбранных абзацев и 16 записей в API модели. ' +
        'Эти данные могут содержать конфиденциальную информацию.\n\nРазрешаете отправку указанных фрагментов?'
      );
      if (!allowed) return;
      mode = 'online';
      consentGiven = true;
      updateMode();
      if (lastResult && !results.hidden) startOnline(lastResult);
    });
    window.addEventListener('check-ai:analysis-started', () => {
      generation++;
      lastResult = null;
      removeOnlineOutput();
    });
    window.addEventListener('check-ai:analysis-ready', event => {
      lastResult = event.detail?.result || null;
      if (mode === 'online') startOnline(lastResult);
    });
    updateMode();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', installModes);
  else installModes();
})();
