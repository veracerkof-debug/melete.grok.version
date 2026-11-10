// Экран «Инструменты»: карточки модулей и окно отдельного инструмента (время идёт в статистику).
// Перенесено из legacy/practice.html (toolsHTML, openToolView).
import '../../ui/screens.css';
import { t } from '../../i18n/index.js';
import { ui, esc, icons } from '../../ui/index.js';
import { isOn } from '../settings.js';
import { mountModule, makeCtx, moduleName, trackToolTime, fmtDur, heavyStub } from '../modules.js';
import { modules, moduleById } from '../../modules/index.js';
import { IC, tabModsInTools, pagesInTools, isPage, pageName, TAB_ICONS } from './common.js';
import { showHelp } from '../help.js';
import { recButtonHTML, bindRec } from './rec.js';
import { canRecord } from '../recorder.js';
import { pureEnter, pureLeave } from '../pure.js';
import { spread, NOSPREAD } from '../../ui/gestures.js';
import { bareScope } from '../../i18n/index.js';

const NOSPREAD_IDS = ['piano', 'glider']; // двумя пальцами там играют — окном управляют кнопки

// Строка на карточке — только последнее состояние (темп, строй, звук, тональность); описания и счётчики — нет
const NO_STATUS = ['train', 'ear', 'looper', 'audio', 'notes', 'voice', 'studio'];
export const renderTools = (app, root) => bareScope(() => renderToolsNow(app, root));
// Порядок и убранные во вкладке (settings.toolsTab: { order, off }): удержание карточки — меню (левее, правее, убрать);
// убранные остаются включёнными (быстрый доступ, сессия) — вернуть кнопкой внизу вкладки
export function toolsTab(st) {
  const extra = tabModsInTools(st); // «Студия», «Библия», убранные с нижней панели, — здесь
  const all = pagesInTools(st).concat(modules.filter((m) => (!m.tab || extra.includes(m.id)) && !m.inner && isOn(st, m.id) && !(st.tabMods || []).includes(m.id)).map((m) => m.id)), tt = st.toolsTab || {}; // ставшие вкладками — не здесь; страницы ядра, убранные снизу, — здесь
  const order = (tt.order || []).filter((id) => all.includes(id));
  all.forEach((id) => { if (!order.includes(id)) order.push(id); });
  const off = new Set((tt.off || []).filter((id) => all.includes(id)));
  return { order, off, shown: order.filter((id) => !off.has(id)) };
}
// Страница ядра («Песни», «Календарь») карточкой в «Инструментах»
export const pageCard = (id) => ({ id, page: true, icon: TAB_ICONS[id], name: pageName(id), color: 'var(--tint)' });
export function setToolsTab(st, T) { st.toolsTab = { order: T.order.slice(), off: [...T.off] }; }
function renderToolsNow(app, root) {
  const st = app.store.state.settings, T = toolsTab(st), list = T.shown.map((id) => (isPage(id) ? pageCard(id) : moduleById(id))); // Библия — своя вкладка
  // режим правки (arrange.js): у карточки — «+», вниз вкладкой
  const arr = document.documentElement.classList.contains('arrange') && st.uiStyle !== 'mono';
  const badge = (id) => (arr ? '<i class="arrb in" data-arr="in:' + id + '" role="button" tabindex="0" aria-label="' + esc(t('hold.makeTab')) + '">+</i>' +
    (isPage(id) ? '' : '<i class="arrb off" data-arr="off:' + id + '" role="button" tabindex="0" aria-label="' + esc(t('tools.offBtn')) + '">−</i>') : '');
  root.innerHTML = '<h1 class="vh">' + t('tools.title') + '</h1><div class="tgrid tgtop">' + list.map((m) => {
    if (m.page) return '<button class="tcard2 tpage" data-open-tool="' + m.id + '" style="--c:var(--tint);--on:var(--on-tint)">' + badge(m.id) + '<span class="tci2">' + m.icon + '</span><span class="tcb"><span class="tcn2">' + esc(m.name) + '</span><span class="tcs2"></span></span></button>';
    let s2 = '';
    if (st.uiStyle !== 'mono' && !NO_STATUS.includes(m.id)) { try { s2 = m.status ? m.status(makeCtx(app, m)) : ''; } catch { /* статус необязателен */ } } // «Минимал» — без строк состояния
    if (heavyStub(m)) s2 = t('heavy.short');
    return '<button class="tcard2" data-open-tool="' + m.id + '" style="--c:' + m.color + ';--on:' + (m.on || '#fff') + '">' + badge(m.id) + '<span class="tci2">' + m.icon + '</span><span class="tcb"><span class="tcn2">' +
      esc(moduleName(m)) + '</span><span class="tcs2">' + esc(s2) + '</span></span></button>';
  }).join('') + '</div>' +
    (T.off.size ? '<div class="group" style="margin-top:16px"><button class="cell act" data-tools-hidden>' + esc(t('tools.hidden', { n: T.off.size })) + '</button></div>' : '') +
    ''; // подсказок нет: удержание — правка (arrange.js)
  if (st.uiStyle !== 'mono') idleStatus(app, root, list.filter((m) => !m.page && !m.loaded && !heavyStub(m) && !NO_STATUS.includes(m.id)));
  root.onclick = (e) => {
    const b = e.target.closest('[data-open-tool]');
    if (b && document.documentElement.classList.contains('arrange')) return; // режим правки: касание — меню (shell.js)
    if (b && isPage(b.dataset.openTool)) app.go(b.dataset.openTool);
    else if (b) openToolView(app, b.dataset.openTool, () => renderTools(app, root));
    if (e.target.closest('[data-tools-hidden]')) hiddenSheet(app, () => renderTools(app, root));
  };
}
// Строка состояния — у загруженного модуля (src/modules/index.js): остальные догружаются по одному, когда экран свободен,
// и строка дописывается в свою карточку (окно уже могли закрыть — тогда ничего)
function idleStatus(app, root, todo) {
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 120));
  const next = () => {
    const m = todo.shift();
    if (!m || !root.isConnected) return;
    m.load().then(() => {
      const el = root.querySelector('[data-open-tool="' + m.id + '"] .tcs2');
      if (el && m.status) { try { el.textContent = m.status(makeCtx(app, m)) || ''; } catch { /* статус необязателен */ } }
    }).catch(() => {}).finally(() => idle(next));
  };
  idle(next);
}
// Убранные из вкладки — вернуть
function hiddenSheet(app, rerender) {
  const st = app.store.state.settings;
  ui.sheet(() => { const T = toolsTab(st); return ui.snav(t('tools.hiddenTitle')) + '<div class="group">' + [...T.off].map((id) => { const m = moduleById(id);
    if (!m) { const p = pageCard(id); return '<div class="cell"><span class="ticon" style="--tc:var(--tint)">' + p.icon + '</span><span class="grow">' + esc(p.name) + '</span><button class="ic sm plain" data-tback="' + id + '" aria-label="' + esc(t('tools.back')) + '" style="color:#5F8568">' + IC.plus + '</button></div>'; }
    return '<div class="cell"><span class="ticon" style="--tc:' + m.color + ';--on:' + (m.on || '#fff') + '">' + m.icon + '</span><span class="grow">' + esc(moduleName(m)) + '</span><button class="ic sm plain" data-tback="' + id + '" aria-label="' + esc(t('tools.back')) + '" style="color:#5F8568">' + IC.plus + '</button></div>'; }).join('') + '</div>'; },
  (el, sh) => el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tback]');
    if (!b) return;
    const T = toolsTab(st); T.off.delete(b.dataset.tback); setToolsTab(st, T); app.store.settingsChanged(); rerender();
    if (!T.off.size) sh.close(); else sh.update();
  }));
}

const EXPAND = '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

export const openToolView = (app, id, onClose) => bareScope(() => openToolViewNow(app, id, onClose));
function openToolViewNow(app, id, onClose) {
  const mod = moduleById(id), name = moduleName(mod);
  // полный экран (manifest.pure): кнопка — рядом с «?», выход — «Назад», Esc
  const pureBtn = ui.icb('data-tv="pure"', EXPAND, t('tools.pure'), 'sm' + (mod.immersive ? ' tvpure' : '')); // любой инструмент
  const layer = document.createElement('div');
  // запись — во всех инструментах (звук приложения, по желанию микрофон; у терменвокса — и видео)
  const rec = canRecord() && mod.record !== false;
  // immersive — модуль на весь экран без шапки: кнопка «назад» плавает поверх (глайдер)
  layer.innerHTML = mod.immersive
    ? '<div class="tview imm" role="dialog" aria-modal="true" aria-label="' + esc(name) + '">' + ui.icb('data-tv="close"', icons.back, t('ui.back'), 'sm tvback') +
      ui.icb('data-tv="help"', icons.help, t('help.open'), 'sm tvhelp') + pureBtn + (rec ? recButtonHTML('tvrecf') : '') +
      '<div class="tvbody"><div class="toolhost tvhost"></div></div></div>'
    : '<div class="tview" role="dialog" aria-modal="true" aria-label="' + esc(name) + '"><div class="tvhd">' +
      ui.icb('data-tv="close"', icons.back, t('ui.back'), 'sm') + '<div class="stitle2">' + esc(name) + '</div>' + (rec ? recButtonHTML() : '') + pureBtn + ui.icb('data-tv="help"', icons.help, t('help.open'), 'sm') + '</div>' +
      '<div class="tvbody"><div class="toolhost tvhost"></div></div></div>';
  document.body.appendChild(layer);
  let track = mod.stats === false ? { stop: () => 0 } : trackToolTime(app, id), trackSec = 0;
  // главы («Слух и ритм»): время — под именем главы; прежний отрезок сохраняется
  app.retrack = (from, to) => { if (from !== id || mod.stats === false) return; trackSec += track.stop(); track = trackToolTime(app, to); };
  const inst = mountModule(app, mod, layer.querySelector('.tvhost'), 'full');
  const recOff = rec ? bindRec(app, layer, mod, layer.querySelector('.tvhost'), name) : () => {};
  // Поворот всего окна с надписями (пианино: телефон держат горизонтально); сторону задаёт модуль
  const rotCheck = () => {
    const tv = layer.querySelector('.tview');
    if (!tv) return;
    const dir = mod.rotate ? mod.rotate(inst.ctx) : null;
    tv.classList.toggle('rot', !!dir);
    tv.classList.toggle('rotl', dir === 'l');
    tv.style.width = dir ? innerHeight + 'px' : '';
    tv.style.height = dir ? innerWidth + 'px' : '';
  };
  const onRot = () => requestAnimationFrame(rotCheck);
  // поворот задаёт загруженный модуль: пока он грузится — проверить и после загрузки (melete:modloaded)
  const rotOn = !!mod.rotate || !mod.loaded;
  if (rotOn) { addEventListener('melete:rot', onRot); addEventListener('resize', onRot); addEventListener('melete:modloaded', onRot); rotCheck(); }
  // Рабочие инструменты (stats: false, например шумомер) в статистику не пишут

  // Полный экран: окно без шапки и кнопок, модуль убирает свои (класс .pure у окна), размер — заново
  let pure = false;
  const setPure = (on) => {
    const tv = layer.querySelector('.tview');
    if (!tv || pure === on) return;
    pure = on;
    tv.classList.toggle('pure', on);
    if (on) { pureEnter(() => setPure(false)); ui.toast(t('tools.pureHint')); } else pureLeave();
    if (mod.onPure) { try { mod.onPure(on, inst.ctx); } catch { /* модуль перерисуется по размеру */ } }
    requestAnimationFrame(rotCheck);
  };
  layer.pureExit = () => (pure ? (setPure(false), true) : false);

  const close = (next) => {
    if (pure) setPure(false);
    app.openTool = null;
    document.removeEventListener('keydown', onKey);
    recOff(); // идёт запись — сохраняется до того, как модуль отключит камеру и звук
    if (rotOn) { removeEventListener('melete:rot', onRot); removeEventListener('resize', onRot); removeEventListener('melete:modloaded', onRot); }
    inst.unmount();
    ui.leave(layer.firstElementChild || layer, 260);
    setTimeout(() => layer.remove(), 280);
    const sec = trackSec + track.stop();
    app.retrack = null;
    if (sec) ui.toast(t('tools.recorded', { tool: name, dur: fmtDur(sec) }));
    if (next) openToolView(app, next, onClose);
    else if (onClose) onClose();
  };
  // Переход из модуля в другой инструмент: это окно закрывается, открывается новое
  app.openTool = (id) => { if (moduleById(id)) close(id); };
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('#sheetLayer .scrim')) { if (pure) setPure(false); else close(); } };
  document.addEventListener('keydown', onKey);
  layer.addEventListener('click', (e) => {
    if (e.target.closest('[data-tv="close"]')) close();
    else if (e.target.closest('[data-tv="help"]')) showHelp(app, mod, layer.querySelector('.tvhost'));
    else if (e.target.closest('[data-tv="pure"]')) setPure(true);
  });
  // два пальца: развести — во весь экран, свести — обратно (не в пианино и глайдере — там только кнопки)
  if (!NOSPREAD_IDS.includes(mod.id)) spread(layer, { ok: (e) => !e.target.closest(NOSPREAD), out: () => setPure(true), inn: () => setPure(false) });
  return close;
}
