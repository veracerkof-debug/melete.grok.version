// Ядро: песни, сессии, статистика, цели, ударный режим, хранение.
import { initTama } from '../ui/tama.js';
import { webIcon, iconOf, setAppIcon, ICON_BY_MASCOT } from './appicon.js';
import { Capacitor } from '@capacitor/core';
import { t, initI18n, getLang, CORE_DICTS, loadAllLangs } from '../i18n/index.js';
import { modules } from '../modules/index.js';
import { createStore } from './store.js';
import { loadActive, saveActive, recoverToolView, addBpmTime } from './session.js';
import { loadDevice, saveDevice, onDeviceWriteFail } from './device.js';
import { createAudio } from '../audio/index.js';
import { ensureLib } from './library.js';
import { applyTheme, tabsMigrate, trainMigrate, calmMigrate, mascotOf } from './settings.js';
import { registerTools } from './palettes.js';
import { dropTestMode } from './cleanup.js';
import { removeDemoFiles, cleanDemoCopies } from './demo.js';
import { createShell } from './screens/shell.js';
import { initBack } from './back.js';
import { createSessionScreen } from './screens/session.js';
import { createMixerDrawer } from './screens/mixer.js';
import { createShared } from './modules.js';
import { createPomodoro, pomoDefaults, POMO_LIMITS } from './pomodoro.js';
import { pause as pauseActive, resume as resumeActive, awayStart, awayEnd, countsWhileHidden } from './session.js';
import { createStopwatch } from './stopwatch.js';
import { createActivity } from './activity.js';
import { initNoSound } from './nosound.js';
import { createPulse } from './pulse.js';
import { initBackground } from './background.js';
import { initPlayer } from './player.js';
import { initGuard } from './guard.js';
import { initDrop } from './drop.js';
import { initWebMemory } from './webmemory.js';
import { initScreenOn } from './screenon.js';
import { createClock } from './clock.js';
import { clockNotice } from './screens/clock.js';
import { BUSES } from '../audio/mixer.js';
import { toast, confirm, agree } from '../ui/index.js';
import { startEdgeFade } from '../ui/edgefade.js';
import { initBridge } from './bridge.js';
import { startLog, log } from './log.js';
import { startDiag, provide as dProvide, count as dCount, gauge as dGauge, time as dTime, event as dEvent } from './diag.js';
import { createBible } from './reading.js';
import { APP_VERSION } from './report.js';
import { crashOffer } from './screens/report.js';
import { bindVerses } from './screens/verses.js';
import { createFiles } from './files.js';
import { createRecorder } from './recorder.js';
import { createJobs } from './jobs.js';
import { packsReady } from './packs.js';
import { packsApi } from './screens/packs.js';
import { createAutoStems } from './autostems.js';
import { createMidi } from './midi.js';
import { createSyncServer, createSyncClient } from './sync.js';
import { createGuestServer } from './guest.js';
import { isDesktop } from './desktop.js';
import { reschedule, rescheduleEvents } from './reminders.js';
import { ensureCal, eventReminders, liveEvents, kindOf } from './calendar.js';
import { remindText, remindCtx } from './remindtexts.js';
import { initShareIn } from './screens/share.js';
import { initFolder } from './foldersync.js';
import { initLocalSend } from './localsend.js';
import { initDesktop } from './desktop.js';
import { createUpdater } from './update.js';
import { createSnapshots } from './snapshots.js';
import { applyVariants } from './variants.js';
import { mountUpdateBar } from './screens/update.js';
import { initWhatsNew } from './screens/whatsnew.js';

export function boot(root) {
  // журнал — первым: ошибки запуска тоже попадут в него
  try { startEdgeFade(); } catch { /* не страшно */ }
  startLog(APP_VERSION + ' · ' + (navigator.userAgent.match(/Android [\d.]+|Chrome\/[\d.]+/g) || []).join(' · '));
  startDiag(); // диагностика (diag.js): приложение само считает, как работает — экран «Диагностика»
  // Часы устройства: пока сбиты, новые записи о занятиях не подтверждаются
  let clock = null;
  // коды и проверка создателем убраны: если проверка шла — настоящие данные возвращаются из копии (до чтения данных)
  const { restored } = dropTestMode();
  // Запись в хранилище не прошла (нет места) — в журнал и сообщение не чаще раза в минуту: потеря не бывает молчаливой
  let writeFailAt = 0;
  const writeFail = (where) => (e) => {
    const n = Date.now(); if (n - writeFailAt < 60000) return; writeFailAt = n;
    try { log('store', 'запись не прошла (' + where + '): ' + (e && (e.name || e.message)), 'e'); } catch { /* */ }
    // «Освободить место» — медиатека, крупные файлы сверху
    setTimeout(() => { try { toast(t('data.noSpace'), { action: t('data.free'), onAction: () => { device.audio = { ...(device.audio || {}), sortOnce: 'size' }; import('./screens/tools.js').then((m) => m.openToolView(app, 'audio')); } }); } catch { /* */ } }, 0);
  };
  onDeviceWriteFail(writeFail('настройки'));
  const store = createStore({ clockBad: () => !!(clock && clock.bad), onWriteFail: writeFail('данные') });
  // Язык из настроек (выбран в «Оформлении»), иначе — язык системы
  const st0 = store.state.settings;
  if (tabsMigrate(st0)) store.settingsChanged();
  if (trainMigrate(st0)) store.settingsChanged(); // «Слух» и «Ритм» → «Слух и ритм»
  if (calmMigrate(store.state)) store.settingsChanged(); // прежние яркие цвета меток и событий — спокойнее
  initI18n(st0.uiStyle === 'mono' && st0.monoLang !== false ? 'el' : st0.lang);
  ensureLib(store.state, t);
  registerTools(modules); // цвет инструментов — от палитры
  applyTheme(store.state.settings);
  recoverToolView(store);
  let active = loadActive();
  let activity = { hiddenAt: null, heard: 0 };
  const device = loadDevice();
  // Способ регулировки темпа в прототипе хранился в общих настройках — теперь в настройках модуля
  device.metro ??= { adj: store.state.settings.metroAdj || 'wheel' };
  // Гамма в прототипе хранилась отдельно (tools.scale) — теперь в настройках теории
  device.theory.scale ??= device.scale || { pc: 9, type: 'minor' };
  // Помодоро: настройки прототипа (tools.pomo) и вид (tools.ui.pomo) — в настройки модуля timer
  device.timer ??= { ...pomoDefaults(), ...device.pomo, style: device.ui?.pomo === 'flip' ? 'flip' : 'ring' };
  // Недостающие длительности (старые или неполные настройки) — по умолчанию, иначе часы показывают NaN
  device.timer = { ...pomoDefaults(), ...device.timer };
  // испорченные числа — к умолчаниям и в пределы (иначе NaN:NaN на экране)
  Object.entries(POMO_LIMITS).forEach(([k, [lo, hi]]) => { const v = +device.timer[k]; device.timer[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : pomoDefaults()[k]; });
  device.notes ??= { ...device.tab };
  device.audio ??= { last: device.lastAudio || {}, style: device.ui?.audio === 'vinyl' ? 'vinyl' : 'wave' };

  // Звук создаётся сразу, но AudioContext — только на первом жесте пользователя
  const audio = createAudio({
    device,
    metroCfg: store.state.settings.metro,
    save: () => saveDevice(device),
    onTempo: (bpm, sec) => {
      if (!active || active.pausedAt || active.awaySince) return;
      addBpmTime(active, bpm, sec);
      saveActive(active);
    },
    onBpmChange: () => store.persist(),
    // Копия настроек песни сохраняется в песню при завершении сессии; общие — сразу
    saveMetro: (cfg) => { if (cfg === store.state.settings.metro) store.persist(); },
  });
  addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true });

  // Помодоро идёт в фоне; перерыв ставит сессию на паузу (прототип: sessPause)
  const pomoSubs = new Set();
  const pomodoro = createPomodoro(device.timer, {
    onEnd: (phase) => { audio.chime(); toast(t(phase === 'work' ? 'pomo.breakOver' : 'pomo.breakTime')); },
    pauseSession: (on) => {
      if (!active || !device.timer.pauseSession) return;
      if (on && !active.pausedAt) { audio.metro.flush(); pauseActive(active); active.pomoPaused = true; saveActive(active); }
      // время паузы на темп не засчитываем: сначала сбросить отсчёт, потом снять паузу
      else if (!on && active.pomoPaused && active.pausedAt) { audio.metro.flush(); resumeActive(active); saveActive(active); }
    },
    onChange: () => pomoSubs.forEach((fn) => fn()),
  });
  pomodoro.subscribe = (fn) => { pomoSubs.add(fn); return () => pomoSubs.delete(fn); };
  setInterval(() => pomodoro.tick(), 500);

  // Секундомер «сколько я играю» — в ядре: идёт и при закрытом окне, переживает перезагрузку
  device.watch ??= {};
  const watchSubs = new Set();
  const stopwatch = createStopwatch(device.watch, { onChange: () => { saveDevice(device); watchSubs.forEach((fn) => fn()); } });
  stopwatch.subscribe = (fn) => { watchSubs.add(fn); return () => watchSubs.delete(fn); };

  // Звучит ли приложение (метроном, пианино, пэды, медиа, теория) с ненулевой громкостью в микшере.
  // В обычном режиме учёта время при погасшем экране или в фоне идёт только тогда: помодоро и секундомер без звука
  // не считаются — в фоне без звука никто не занимается
  // звучит ли приложение (игра продлевает учёт); воспроизведение своей MIDI-записи игрой не считается
  let midiRef = null;
  const soundingAudio = () => !(midiRef && midiRef.playing) && BUSES.some((b) => audio.mixer.isActive(b) && audio.mixer.value(b) > 0);

  // Экран погас или вкладка скрыта: по режиму учёта сессии время «вдали» засчитывается или нет.
  // Если звук затих, пока приложение было в фоне, — «вдали» с момента, когда звук слышали последний раз
  const awayCheck = () => {
    if (!active || active.pausedAt) return;
    const counts = document.visibilityState === 'visible' || countsWhileHidden(active.mode, soundingAudio());
    const now = Date.now(), at = Math.min(now, Math.max(activity.hiddenAt || now, activity.heard || 0));
    if (!counts && !active.awaySince) { audio.metro.flush(); awayStart(active, at); saveActive(active); }
    else if (counts && active.awaySince) { audio.metro.flush(); awayEnd(active); saveActive(active); }
  };
  document.addEventListener('visibilitychange', () => awayCheck());
  // Клавиатура: элементы с role="button" tabindex="0" (значки, плитки, крестики) — без этого они недостижимы с клавиатуры:
  // ни Tab, ни Enter. Enter и пробел нажимают их, как настоящая кнопка.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const el = e.target && e.target.closest ? e.target.closest('[role="button" tabindex="0"]') : null;
    if (!el || el.tagName === 'BUTTON' || el.tagName === 'A') return;
    e.preventDefault();
    try { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch { /* ignore */ }
  });
  // Всё, что меняли в инструментах (пресеты, звуки, ручки), — на диск при уходе в фон и закрытии, даже если модуль
  // правил настройки напрямую и сам не сохранил (решение автора 28.10.2026: вернулся через неделю — всё как было)
  const persistAll = () => { try { audio.metro.flush(); } catch { /* */ } saveDevice(device, undefined, { soft: true }); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') persistAll(); });
  addEventListener('pagehide', persistAll);
  setInterval(awayCheck, 15000);
  // после перезагрузки: «вдали», начатое при закрытии страницы, заканчивается сразу
  setTimeout(awayCheck, 0);

  const files = createFiles({
    onWriteFail: writeFail('файлы'),
    // Сбой базы без нехватки места — не «нет места», а другая беда: она тоже попадает в журнал
    onError: (e, rec) => { try { log('files', 'файл не сохранён: ' + (e && (e.name || e.message)) + (rec && rec.id ? ' (' + rec.id + ')' : ''), 'e'); } catch { /* */ } },
  });

  // Перед первой загрузкой файла — предупреждение о правах (прототип: uploadGuard)
  async function confirmUpload() {
    // 2 — согласие с ответственностью (галочка, 05.11.2026); прежнее «Понятно» (1) спрашивается один раз заново
    if (store.state.settings.upOk >= 2) return true;
    await agree(t('upload.title'), t('upload.text'), t('upload.agree'), t('upload.ok'));
    store.state.settings.upOk = 2;
    store.settingsChanged();
    return true;
  }

  // Выход звука (Android): Bluetooth — буфер побольше (context.js: setOutKind). Подключили, когда звук уже создан, —
  // буфер прежний: сказать один раз, что поможет перезапуск
  if (Capacitor.isNativePlatform()) {
    let told = false;
    import('../audio/voiceengine.js').then(async (V) => {
      const C = await import('../audio/context.js'), eng = V.engine();
      const check = async () => {
        let outs = [];
        try { outs = (await eng.devices()).outputs || []; } catch { return; }
        const bt = outs.some((o) => V.devKind(o) === 'bt');
        C.setOutKind(bt ? 'bt' : 'phone');
        const made = C.ctxOutKind();
        if (bt && made && made !== 'bt' && !told) { told = true; log('audio', 'Bluetooth подключён после запуска звука: буфер малый — нужен перезапуск', 'w'); toast(t('snd.btRestart')); }
        else if (made === null) log('audio', 'выход: ' + (bt ? 'Bluetooth — буфер 100 мс' : 'телефон'));
      };
      check();
      eng.on('devices', check);
    }).catch(() => {});
  } else import('../audio/context.js').then((C) => C.outUnknown());
  audio.onLoadLog = (m) => { log('audio', m, 'w'); if (/ужатие \d/.test(m) && /меньше/.test(m)) dCount('audio.squeeze'); };
  // нагрузка звука — в диагностику: средняя, секунды выше 70 и 90 %, доля пропусков; перегрузка — событие с обстановкой
  audio.onLoadSample = (st, m) => {
    dGauge('audio.load', m.load);
    if (m.load >= 0.7) dCount('audio.s70');
    if (m.load >= 0.9) dCount('audio.s90');
    if (m.underrun != null) dGauge('audio.underrun', m.underrun);
    if (st.over === 2) dEvent('overload', { load: Math.round(m.load * 100) });
  };
  const app = {
    store, device, audio, modules, pomodoro, stopwatch, sounding: soundingAudio, soundingAudio, files, confirmUpload,
    shared: createShared(),
    rec: null, // запись в инструментах (recorder.js) — ниже, когда app уже есть
    saveDevice: () => saveDevice(device),
    saveDeviceSoft: () => saveDevice(device, undefined, { soft: true }), // страховка: внешнюю запись не затирает
    get active() { return active; },
    set active(a) { active = a; saveActive(a); },
  };
  app.rec = createRecorder(app);
  app.jobs = createJobs(files); // долгие обработки записей: дорожки, ноты (jobs.js)
  app.packs = packsApi; packsReady(); // пакеты моделей: что скачано (packs.js)
  app.auto = createAutoStems(app); // дорожки и тональность с темпом — сами, в тишине (autostems.js)
  app.midi = midiRef = createMidi(app);
  app.midi.input.resume();
  // ↑ ↓ на клавиатуре компьютера — октава: короткая подсказка, какой ноте отвечает Z
  app.midi.qwerty.onBase = (b) => { toast(t('qw.octave', { n: 'C' + (Math.floor(b / 12) - 1) })); window.dispatchEvent(new Event('melete:qwerty')); };
  // напоминания о практике: расписание на неделю — при запуске, смене настроек и после занятий (с задержкой)
  let remT = 0;
  const remSync = () => { clearTimeout(remT); remT = setTimeout(() => reschedule(store.state, (x) => remindText(x, remindCtx(store.state.settings))), 1500); };
  store.subscribe(remSync);
  remSync();
  // напоминания о событиях календаря (у события — «Напомнить»): ближайшие две недели, пересчёт при изменениях
  let evT = 0, evSig = '';
  const evSync = () => {
    clearTimeout(evT);
    evT = setTimeout(() => {
      const c = ensureCal(store.state, t), lang = getLang() === 'uz' ? 'uz-Latn' : getLang();
      const list = eventReminders(liveEvents(store.state), Date.now()).map(({ ts, ev, start }) => {
        const m = +ev.remind || 0, hm = new Date(start).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
        const lead = ev.allDay || m >= 1440 ? t(m >= 1440 ? 'cal.rem.tomorrow' : 'cal.rem.today') : !m ? t('cal.rem.now') : m < 60 ? t('cal.rem.inMin', { n: m }) : t('cal.rem.inH', { n: m / 60 });
        return { ts, title: ev.title || (kindOf(c, ev.kind) || {}).name || t('cal.event'), body: [lead, ev.allDay ? '' : hm, ev.place || ''].filter(Boolean).join(' · ') };
      });
      const sig = JSON.stringify(list);
      if (sig === evSig) return; // ничего не поменялось — не трогать расписание
      evSig = sig;
      rescheduleEvents(list);
    }, 2000);
  };
  store.subscribe(evSync);
  evSync();
  // Церковный режим: чтение Библии — план, отметки, место (src/core/reading.js)
  app.bible = createBible(store);
  // Вспышка, фонарик и вибрация в такт метронома
  app.pulse = createPulse(app);
  // Часы перевели или они сбиты: идущая сессия и секундомер не подтверждаются; окно с проверкой по интернету
  clock = app.clock = createClock({
    onChange: (c) => {
      if (!c.bad) return;
      if (active && !active.clk) { active.clk = c.reason; saveActive(active); }
      if (stopwatch.running && !device.watch.clk) { device.watch.clk = c.reason; saveDevice(device); }
      clockNotice(app);
    },
  });
  setTimeout(() => clockNotice(app), 1500);
  const session = createSessionScreen(app);
  app.session = session;
  // Признаки занятия: касания, звук, микрофон — и проверки бездействия сессии и секундомера
  activity = app.activity = createActivity(app, { soundingAudio });
  // Мелета-тамагочи: по желанию рядом на занятии, слушает (если разрешено) и говорит, как идёт
  initTama(app);
  // иконка приложения: значок вкладки в браузере (на Android — выбранный alias уже включён)
  // Иконка следует за маскотом (по умолчанию — Мелетий), пока её не выбрали сами в «Оформлении». Один раз — и у тех,
  // кто ставил ранние сборки, где по умолчанию была Мелета (на Android переключается ярлык запуска)
  const sti = store.state.settings, wantIcon = ICON_BY_MASCOT[mascotOf(sti)];
  if (!sti.appIconOwn && (sti.appIcon !== wantIcon || sti.iconSync !== 1)) { sti.iconSync = 1; setAppIcon(sti, wantIcon).then(() => store.settingsChanged()); }
  webIcon(iconOf(sti));
  app.startSession = (type, songId, tool) => session.start(type, songId, tool);
  // Язык и вид поменялись (Оформление, доступ к «Минимал»): строки и стили — на месте, без перезапуска и без ухода с экрана
  app.relang = () => {
    const st = store.state.settings;
    initI18n(st.uiStyle === 'mono' && st.monoLang !== false ? 'el' : st.lang);
    applyTheme(st);
    if (app.render) app.render();
  };
  createShell(app, root);
  // Работа в фоне на Android: пока что-то идёт — служба с уведомлением, приложение не замораживается
  initBackground(app);
  app.auto.start();
  initPlayer(app); // шторка, плавающая кнопка, всплывающее окно (Android)
  initBridge(app); // мост с главным экраном Ἐλάχιστον (Android): состояние, переходы, ▶/❚❚
  // веб-версия: один раз — что это знакомство, а полная версия — приложение для Android
  // (после регистрации: на стартовом экране не мешает выбору языка)
  const webHello = () => {
    const st = store.state.settings;
    if (Capacitor.isNativePlatform() || st.webHello) return;
    if (!st.configured || document.querySelector('#onboard, .askname, .ask, #sheetLayer .sheet')) { setTimeout(webHello, 4000); return; }
    toast(t('web.hello')); st.webHello = true; store.settingsChanged();
  };
  setTimeout(webHello, 2500);
  // Данные при запуске не прочитались: строка сохранена отдельно (store.js), вернуть — из копий на устройстве
  if (store.broken) { log('store', 'данные не прочитались при запуске — строка сохранена в practice.v1.broken', 'e'); setTimeout(() => toast(t('data.broken')), 1500); }
  initGuard(app);
  initDrop(app); // файлы, перетащенные в окно
  initWebMemory(app); // веб-версия: постоянное хранилище и работа без сети (service worker)
  initScreenOn(app); // экран не гаснет, пока приложение открыто
  // после возврата из копии — файлы демо-набора, которые добавила проверка, убрать (если набора не было)
  if (restored && !store.state.settings.demo) removeDemoFiles(app).catch(() => {});
  // копии демо, вернувшиеся из папки или с другого устройства, — убрать (и из папки)
  app.files.ready.then(() => loadAllLangs()).then(() => cleanDemoCopies(app, CORE_DICTS)).then((n) => { if (n) { log('demo', 'убраны копии демо: ' + n); if (app.render) app.render(); } }).catch(() => {});
  createMixerDrawer(app);
  // Играет, но не слышно (микшер, громкость устройства) — уведомление внизу
  initNoSound(app);
  // Сессия, начатая до перезагрузки страницы, продолжается
  session.resume();
  // Сцена, открытая до сбоя или перезапуска, — снова на той же песне (файлы минусовок читаются из базы)
  if (localStorage.getItem('melete.stage')) files.ready.then(() => import('./screens/stage.js')).then((m) => m.resumeStage(app)).catch(() => {});
  // «Назад» на Android закрывает открытое по очереди, а не всё приложение
  initBack(app);
  // Статус медиатеки и табов зависит от файлов, которые читаются из базы асинхронно
  files.ready.then(() => { if (!app.openTool) app.render(); });
  // файл .melete от команды, открытый в Melete
  initShareIn(app);
  // папка Melete на устройстве: данные, медиа, табы, PDF, тексты — синхронизация в обе стороны
  app.folder = initFolder(app);
  // компьютер (Tauri): файлы, открытые двойным щелчком, F11
  initDesktop(app);
  // приём файлов с телефона по протоколу LocalSend (Windows, по переключателю в настройках)
  app.localSend = initLocalSend(app);
  // связь с телефоном (sync.js): на компьютере — сервер в своей сети по переключателю; был включён — включается снова
  app.syncSrv = createSyncServer(app, { isDesktop });
  if (app.syncSrv.avail && app.syncSrv.wasOn()) app.syncSrv.start().catch(() => {});
  // связь всех со всеми (Melete DEV): телефон тоже принимает подключения — по переключателю; был включён — снова
  app.mesh = createSyncServer(app, { isDesktop, transport: 'mesh' });
  // сервер разработки (vite dev, проверки в браузере): доступ к приложению для пульта и связи; в сборки не попадает
  if (import.meta.env && import.meta.env.DEV && typeof window !== 'undefined') window.__melete = app;
  if (app.mesh.avail && app.mesh.wasOn()) app.mesh.start().catch(() => {});
  // телефон: фоновая синхронизация и «Считать на компьютере» (sync.js); компьютер сам — сервер
  app.syncCli = createSyncClient(app);
  if (!app.syncSrv.avail) app.syncCli.start();
  // ансамбль (ensemble.js): компьютер ведёт дубль и собирает записи, телефон пишет свою партию; модули — по требованию
  app.ensemble = async () => {
    const E = await import('./ensemble.js');
    if (app.syncSrv.avail) {
      if (!app.ens) { const C = await import('../audio/context.js'); app.ens = E.createEnsembleHost(app, { sound: E.hostSound(() => C.getContext(), C.directOut) }); }
    } else if (!app.ensCli) { const V = await import('../audio/voiceengine.js'); app.ensCli = E.createEnsembleClient(app, { rec: V.engine() }); }
    const S = await import('./screens/ensemble.js');
    return S.ensembleSheet(app);
  };
  // раздача в своей сети: гости открывают песни в браузере (guest.js, только Windows)
  app.guest = createGuestServer(app, { isDesktop });
  if (app.guest.avail && app.guest.wasOn()) app.guest.start().catch(() => {});
  // закрытая раздача: гость просится — спросить хозяина, где бы он ни был (отказ — кнопкой в списке гостей)
  app.guest.onJoin((id) => { const g = app.guest.guests().find((x) => x.id === id); if (g) confirm(t('gs.askTitle'), t('gs.askText', { name: g.name }), t('gs.allow')).then((ok) => { if (ok) app.guest.approve(id, true); }); });
  app.localSend.init();
  // обновление из GitHub (update.js): свой канал — dev или pre; раз в сутки при запуске, полоса «есть новая версия»
  // копии на устройстве (snapshots.js): раз в сутки и перед обновлением
  app.snapshots = createSnapshots(app);
  app.snapshots.auto();
  // варианты (variants.js): в dev — выбранные в профиле, в pre — решение автора
  applyVariants(app);
  app.updater = createUpdater(app);
  mountUpdateBar(app);
  app.updater.auto();
  initWhatsNew(app); // после обновления — «Что нового» один раз
  // прошлый запуск закрылся неожиданно — предложить отправить отчёт
  crashOffer(app);
  // касание названия раздела — его стих (в обоих видах)
  bindVerses(app);
  // диагностика: обстановка для событий (что открыто, как звучит), запуск — сколько длился, нагрузка — замеряется,
  // как только есть звук (измеритель создаётся по первому обращению)
  dProvide('audio', () => audio.state());
  dProvide('open', () => [...(app.openNow || [])].join(','));
  dProvide('screen', () => document.visibilityState + ' ' + innerWidth + '×' + innerHeight);
  requestAnimationFrame(() => dTime('app.start', performance.now()));
  setInterval(() => { if (document.visibilityState === 'visible' && audio.state()) void audio.load; }, 10000);
  return app;
}

