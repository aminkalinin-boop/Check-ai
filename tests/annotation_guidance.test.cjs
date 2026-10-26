'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const helper = fs.readFileSync(path.join(root, 'src', 'annotation_guidance.js'), 'utf8');
const mark = fs.readFileSync(path.join(root, 'src', 'annotate.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src', 'ui.js'), 'utf8');
const box = {};
vm.runInNewContext(helper + '\nthis.advice = annotationAdvice;', box);
test('Every visible flag is explained with a concrete action', () => {
  const inputs = [
    { type: 'stylo', key: 'styloA', level: 'weak', label: 'Концентрация ИИ-лексики' },
    { type: 'md', key: 'markdown', level: 'medium', label: 'Остатки Markdown' },
    { type: 'src', key: 'fn', level: 'weak', label: 'Неверная ссылка' },
    { type: 'char', key: 'zw', level: 'medium', label: 'U+200B' },
    { type: 'short', key: 'argument', level: 'info', label: 'Шаблонная логика', observation: 'Три повторных вывода', action: 'Сверить данные с вычислением.' },
    { type: 'nonstandard', key: 'unknown', level: 'weak', label: 'Неизвестный сигнал' }
  ];
  for (const f of inputs) {
    const a = box.advice(f, { text: 'Тестовый абзац о фактических затратах и выводах.' });
    assert.ok(a.issue.length >= 4);
    assert.ok(a.action.length >= 15);
    assert.match(a.disclaimer, /не доказательство/);
  }
  assert.match(box.advice(inputs[4], {}).action, /вычислением/);
});
test('Annotated DOCX comments say Problem and Action and distinguish informational highlights', () => {
  assert.match(mark, /Проблема /);
  assert.match(mark, /Действие по исправлению /);
  assert.match(mark, /annotationAdvice\(f, para\)/);
  assert.match(mark, /f\.type === 'short'/);
  assert.match(mark, /info: 'E8EDF4'/);
  assert.match(ui, /_проблемы_и_действия\.docx/);
});
