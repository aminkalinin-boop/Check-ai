'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const addon = fs.readFileSync(path.join(__dirname, '..', 'online', 'online_addon.js'), 'utf8');
const config = fs.readFileSync(path.join(__dirname, '..', 'online', 'site_config.js'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'online', 'server.mjs'), 'utf8');
test('End-user UI cannot ask for an API URL or model access token', () => {
  assert.ok(!addon.includes('createElement(\'input\')'));
  assert.ok(!addon.includes('Code доступа'));
  assert.ok(!addon.includes('endpoint.value'));
  assert.ok(!addon.includes('api.openai.com'));
  assert.match(addon, /mode = 'offline'/);
  assert.match(addon, /offline\.textContent = 'Офлайн'/);
  assert.match(addon, /online\.textContent = 'Онлайн'/);
});
test('Online additions start only from same local analysis-ready event', () => {
  assert.match(ui, /await analyzeFile\(file, setStatus\)/);
  assert.match(ui, /render\(RES\)/);
  assert.match(ui, /check-ai:analysis-ready/);
  assert.match(addon, /check-ai:analysis-ready/);
  assert.match(addon, /check-ai:analysis-started/);
  assert.match(addon, /window\.confirm\(/);
  assert.match(addon, /await Promise\.all/);
  assert.match(addon, /verifySources/);
  assert.match(addon, /reviewLogic/);
});
test('Deployment address is configured by the developer and no secrets are in public JS', () => {
  assert.match(config, /apiBase: ''/);
  assert.ok(!/sk-[A-Za-z0-9]{10,}/.test(addon + config));
  assert.match(server, /CHECK_AI_GATEWAY_SECRET/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /authorized\(req\)/);
});
