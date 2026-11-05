// Память веб-версии. Данные и так живут в браузере (localStorage, IndexedDB), но браузер может стереть их сам:
// Safari на iPhone — через 7 дней без посещений, любой — при нехватке места. Поэтому: просим постоянное хранилище
// (navigator.storage.persist — после него браузер не трогает данные без спроса человека) и ставим service worker
// (public/sw.js): приложение открывается без сети, а установленное на главный экран Safari не чистит.
// На Android и Windows не нужно (своё хранилище). Никаких серверов: память — только на устройстве, по философии.
import { Capacitor } from '@capacitor/core';
import { isDesktop } from './desktop.js';

export const isWebOnly = () => typeof window !== 'undefined' && !Capacitor.isNativePlatform() && !isDesktop();

export function initWebMemory(app) {
  const mem = { persisted: null, sw: false };
  app.webMemory = mem;
  if (!isWebOnly()) return mem;
  // только собранная версия по https (или localhost): при разработке кэш оболочки мешал бы живой перезагрузке
  if ('serviceWorker' in navigator && !import.meta.env.DEV && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    try { navigator.serviceWorker.register('./sw.js', { scope: './' }).then(() => { mem.sw = true; }).catch(() => {}); } catch { /* нет */ }
  }
  // постоянное хранилище — когда человек уже свой (после регистрации), чтобы не спрашивать мимоходом
  const ask = () => {
    if (!navigator.storage || !navigator.storage.persist) return;
    navigator.storage.persisted().then((p) => (p ? true : navigator.storage.persist())).then((p) => { mem.persisted = !!p; }).catch(() => {});
  };
  if (app.store.state.settings.configured) {
    ask();
  } else if (app.store.subscribe) {
    // Подписка вместо опроса каждые 5 секунд
    const unsub = app.store.subscribe(() => {
      if (app.store.state.settings.configured) {
        unsub();
        ask();
      }
    });
  }
  return mem;
}
