/* Optional online review add-on. No changes to the shared Check-AI analyzer or report. */
'use strict';
(function () {
  function initOnlineReview() {
    const results = document.getElementById('results');
    const actions = results && results.querySelector('.actions');
    if (!actions) return;
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'ИИ-экспертиза (онлайн, дополнительно)';
    actions.appendChild(open);

    const panel = document.createElement('section');
    panel.className = 'card';
    panel.hidden = true;
    const heading = document.createElement('h3');
    heading.textContent = 'Дополнительная онлайн-проверка';
    const explanation = document.createElement('p');
    explanation.textContent = 'Основной анализ Check-AI уже выполнен локально. Здесь модель может прокомментировать выбранные фрагменты, не меняя исходный отчёт. Отправка текста происходит только после вашего согласия.';
    const preview = document.createElement('pre');
    preview.style.whiteSpace = 'pre-wrap';
    preview.style.maxHeight = '220px';
    preview.style.overflow = 'auto';
    preview.style.fontSize = '12px';
    preview.style.padding = '10px';
    preview.style.background = 'var(--surface2)';
    const consent = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    consent.append(check, document.createTextNode(' Разрешаю отправить показанные ниже фрагменты серверу и в API модели для дополнительного анализа.'));
    const token = document.createElement('input');
    token.type = 'password';
    token.autocomplete = 'off';
    token.placeholder = 'Код доступа к онлайн-сервису';
    token.setAttribute('aria-label', 'Код доступа к онлайн-сервису');
    token.style.display = 'block';
    token.style.width = 'min(100%, 380px)';
    token.style.margin = '12px 0';
    const run = document.createElement('button');
    run.type = 'button';
    run.className = 'primary';
    run.textContent = 'Проверить выбранные фрагменты';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const output = document.createElement('div');
    panel.append(heading, explanation, preview, consent, token, run, status, output);
    const verdict = document.getElementById('verdict');
    if (verdict) verdict.parentNode.insertBefore(panel, verdict);

    function select() {
      if (typeof RES === 'undefined' || !RES) return [];
      const paras = (RES.paras || []).filter(p => p.words >= 8 && !p.toc && !p.bib && !p.inBox);
      const marked = paras.filter(p => (p.flags || []).some(f => f.level === 'strong' || f.level === 'medium' || f.level === 'weak'));
      const selected = marked.length ? marked.slice(0, 24) : paras.slice(0, 12);
      return selected.map(p => ({
        paragraph: p.i + 1,
        text: p.text.slice(0, 1000),
        markers: [...new Set((p.flags || []).map(f => f.label))].slice(0, 8)
      }));
    }

    open.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      check.checked = false;
      status.textContent = '';
      output.replaceChildren();
      const parts = select();
      preview.textContent = parts.length
        ? parts.map(p => 'Абзац ' + p.paragraph + ': ' + p.text + (p.markers.length ? '\nПризнаки: ' + p.markers.join('; ') : '')).join('\n\n')
        : 'Подходящих текстовых фрагментов не обнаружено.';
    });
    run.addEventListener('click', async () => {
      const parts = select();
      if (!parts.length) { status.textContent = 'Нет фрагментов для проверки.'; return; }
      if (!check.checked) { status.textContent = 'Требуется согласие на передачу показанных фрагментов.'; return; }
      if (!token.value.trim()) { status.textContent = 'Укажите код доступа к серверу.'; return; }
      run.disabled = true; status.textContent = 'Дополнительная экспертиза выполняется…'; output.replaceChildren();
      try {
        const response = await fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token.value.trim() },
          body: JSON.stringify({ paragraphs: parts })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Ошибка сервера ' + response.status);
        const title = document.createElement('h3'); title.textContent = 'Дополнительные замечания модели';
        const summary = document.createElement('p'); summary.textContent = data.assessment;
        output.append(title, summary);
        for (const issue of data.issues || []) {
          const el = document.createElement('p');
          el.textContent = 'Абзац ' + issue.paragraph + '. ' + issue.issue + '. Основание: ' + issue.reason + '. Рекомендация: ' + issue.suggestion;
          output.append(el);
        }
        const limits = document.createElement('p');
        limits.className = 'muted small';
        limits.textContent = data.limitations || 'Это дополнительная оценка, а не доказательство авторства.';
        output.append(limits);
        status.textContent = 'Анализ получен. Основной отчёт Check-AI не изменён.';
      } catch (err) {
        status.textContent = 'Не удалось получить онлайн-анализ: ' + err.message;
      } finally { run.disabled = false; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initOnlineReview);
  else initOnlineReview();
})();
