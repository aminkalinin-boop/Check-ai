/* ===================================================================
   Платформа: сохранение файлов и хранение базы тем
   В опубликованной версии: downloads (окно подтверждения), assets + db
   (база тем хранится вместе с приложением и доступна с любого устройства).
   В локальном файле: обычная загрузка ссылкой и память браузера.
   =================================================================== */
'use strict';

const cap = name => (window.claude && typeof window.claude.use === 'function') ? window.claude.use(name).catch(() => null) : Promise.resolve(null);
let LAST_FILE = null;

async function saveFile(blob, filename) {
  const dl = await cap('downloads');
  if (dl) {
    try { await dl.save({ filename, data: blob }); return 'saved'; }
    catch (e) {
      if (e && e.code === 'declined') return 'declined';
      if (e && e.code === 'rate_limited') throw new Error('Окно сохранения уже открыто. Завершите его и повторите.');
      if (!e || !['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code)) throw new Error('Не удалось сохранить файл: ' + ((e && e.message) || 'ошибка'));
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'saved';
}

