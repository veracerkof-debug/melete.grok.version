// «Звука нет»: если что-то играет, а слышно не будет — шина выключена в микшере или громкость устройства
// на нуле или почти на нуле, — внизу появляется текстовое уведомление. Громкость устройства читается
// только в приложении для Android (плагин Volume), в браузере её узнать нельзя.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { t } from '../i18n/index.js';
import { esc } from '../ui/index.js';
import { BUSES } from '../audio/mixer.js';

export const LOW_VOLUME = 0.12; // доля от максимума

const Volume = Capacitor.isNativePlatform() ? registerPlugin('Volume') : null;

// Причина тишины: null | { k: 'mixer', bus } | { k: 'mute' } | { k: 'low' }
export function silenceReason(playing, value, device) {
  const off = playing.find((b) => value(b) <= 0);
  if (off) return { k: 'mixer', bus: off };
  if (device && (device.muted || device.level <= 0)) return { k: 'mute' };
  if (device && device.level < LOW_VOLUME) return { k: 'low' };
  return null;
}

export function initNoSound(app) {
  const mixer = app.audio.mixer;
  let el = null, shown = '', dismissed = '';
  const show = (r) => {
    const key = r ? r.k + (r.bus || '') : '';
    if (key === dismissed && key) return;
    if (!key) dismissed = '';
    if (key === shown) return;
    shown = key;
    if (!r) { el?.remove(); el = null; return; }
    const text = r.k === 'mixer' ? t('nosnd.mixer', { bus: t('mix.' + r.bus) }) : t('nosnd.' + r.k);
    if (!el) {
      el = document.createElement('div');
      el.className = 'nosnd';
      el.setAttribute('role', 'status');
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-nosnd="x"]')) { dismissed = shown; shown = ''; el.remove(); el = null; }
        else if (e.target.closest('[data-nosnd="mix"]') && app.openMixer) app.openMixer();
      });
      document.body.appendChild(el);
    }
    el.innerHTML = '<span class="nsi" aria-hidden="true">🔇</span><span class="nst">' + esc(text) + '</span>' +
      (r.k === 'mixer' && app.openMixer ? '<button type="button" class="link" data-nosnd="mix">' + t('nosnd.open') + '</button>' : '') +
      '<button type="button" class="nsx" data-nosnd="x" aria-label="' + esc(t('ui.close')) + '">×</button>';
  };
  let busy = false, lastDev = 0;
  const check = async () => {
    if (busy) return;
    const playing = BUSES.filter((b) => mixer.isActive(b));
    if (!playing.length || document.visibilityState !== 'visible' || app.store.state.settings.noSoundNote === false || app.store.state.settings.toolsOnly) { show(null); return; }
    let dev = null;
    // Громкость устройства спрашиваем не чаще раза в 4 секунды
    if (Volume && Date.now() - lastDev > 4000) {
      busy = true;
      try { dev = await Volume.get(); lastDev = Date.now(); } catch { /* нет данных — проверяем только микшер */ }
      busy = false;
    }
    show(silenceReason(playing, mixer.value, dev));
  };
  setInterval(check, 1500);
  mixer.subscribe(() => check());
}
