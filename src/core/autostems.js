// Разделение на дорожки само, в фоне: каждая запись медиатеки (звук, не видео, не дорожка, до 20 минут) разделяется
// в режиме из настройки (settings.autoStems: 'off' | '2' | '4' | '6', по умолчанию '4'), а ещё у неё определяются
// тональность и темп (settings.autoAna, по умолчанию включено; результат — rec.ana). Порядок — от недавних: сначала
// то, что недавно слушали (device.audio.used) или добавили. Две очереди: сперва все записи получают обычное разделение,
// и только когда оно есть у всех — «улучшенное разделение» (settings.autoHq, выкл: три прохода, ×4,5 времени), первая
// версия при этом остаётся — в плеере можно вернуться к ней. На Windows между ними — текст песни (settings.autoLyr,
// по умолчанию включено; whisper по отделённому вокалу, поэтому после дорожек; результат — rec.lyr).
// Когда считать: только в тишине (ничего не звучит, нет занятия и записи — счёт берёт все ядра и помешал бы живому
// звуку) и, по умолчанию, только на зарядке (settings.autoPower: 'charge' | 'always') — обычно это ночь, за ночь
// 10–20 песен; зазвучало — текущее разделение прерывается между сегментами и повторится позже.
// Связь с компьютером (sync.js): на телефоне запись, которую посчитает компьютер (app.syncCli.waits), здесь не
// считается — результаты придут с синхронизацией; на компьютере запись телефона делится в режиме, который просил
// телефон (rec.want: { stems, hq }), если своё разделение не выключено. Ход виден в плеере
// и в уведомлении (background.js). Очередь переживает закрытие окон, но не приложения: после запуска встанет снова.
import { time as dTime, gauge as dGauge } from './diag.js';
import { hasStems } from './jobs.js';
import { isDesktop } from './desktop.js';
import { fullStems } from '../audio/stems.js';
import { log } from './log.js';

export const AUTO_MODES = ['off', '2', '4', '6'];
// Телефон — только вокал и инструментал (MDX-Net): прежние «4» и «6» становятся «2»; компьютер — все режимы, по умолчанию 4.
// Телефон Melete DEV с полным разделением (fullStems) — тоже все, по умолчанию 2
export const autoMode = (settings, desk = isDesktop()) => { const m = AUTO_MODES.includes(settings.autoStems) ? settings.autoStems : desk ? '4' : '2'; return !desk && !fullStems() && m !== 'off' ? '2' : m; };
export const autoAna = (settings) => settings.autoAna !== false;
export const autoHq = (settings) => settings.autoHq === true; // улучшенное разделение (вторая очередь)
export const autoLyr = (settings) => settings.autoLyr !== false; // текст песни (только где есть whisper — Windows)
export const AUTO_POWER = ['charge', 'always'];
export const autoPower = (settings) => (AUTO_POWER.includes(settings.autoPower) ? settings.autoPower : 'charge');
const MAX_SEC = 20 * 60, DELAY_MS = 15000, RETRY_MS = 60000;
// Тишина — это ещё и «человек отошёл»: без касаний, мыши и клавиш IDLE_MS. Открытый инструмент без звука — не тишина:
// человек читает ноты или вот-вот заиграет, а счёт на всех ядрах дал бы треск на первых нотах (автор, 22.10)
export const IDLE_MS = 90000;

export function createAutoStems(app) {
  const { files, jobs } = app;
  const desk = app.isDesk ?? isDesktop();
  let timer = 0, running = false, failed = new Map(); // id → когда можно пробовать снова
  let started = false, poll = 0, offs = [];
  const settings = () => app.store.state.settings;
  let lastInput = Date.now();
  const idle = () => Date.now() - lastInput >= IDLE_MS;
  const playing = () => !!app.active || app.soundingAudio() || !!(app.rec && app.rec.active) || !!(app.audio.metro && app.audio.metro.running);
  const quiet = () => idle() && !app.active && !app.soundingAudio() && !(app.rec && app.rec.active) && !(app.ens && app.ens.recording) && !(app.ensCli && app.ensCli.S.recording) && !jobs.busy() && !(app.audio.metro && app.audio.metro.running);
  // Зарядка: Battery Status API (Chrome, Android WebView); где его нет (Windows, другие браузеры) — считается, что питание есть
  let bat = null, charging = true;
  if (typeof navigator !== 'undefined' && navigator.getBattery) navigator.getBattery().then((b) => { bat = b; charging = b.charging; b.addEventListener('chargingchange', () => { charging = b.charging; schedule(1000); }); }).catch(() => {});
  const powered = () => autoPower(settings()) === 'always' || !bat || charging;
  const candidate = (r) => r.kind === 'audio' && !r.stem && r.blob && !(r.type || '').startsWith('video/') && !r.noAuto && (!r.dur || r.dur <= MAX_SEC);
  // v < 2 — старый разбор (без долей и аккордов): пересчитать моделями, когда они есть
  const pcWaits = (r, kind) => !!(app.syncCli && app.syncCli.waits(r, kind)); // посчитает компьютер — не тратить телефон
  // компьютер: v < 3 — аккорды прежней моделью или их нет — пересчитать ансамблем аккордов компьютера (mir.worker.js: chordsPc)
  const ANA_V = desk ? 3 : 2;
  const needsAna = (r) => autoAna(settings()) && !r.anaTried && (!r.ana || (!(r.ana.v >= ANA_V) && mirOk)) && !pcWaits(r, 'ana');
  let mirOk = false; import('../audio/mir.js').then((m) => { mirOk = m.mirSupported(); schedule(); }).catch(() => {});
  const ok = (r) => !(failed.get(r.id) > Date.now());
  // Отметка «не посчиталось»: срок истёк — запись убирается, карта не растёт (мелочь, но память на телефоне)
  const fail = (r, ms) => { const t = Date.now(); failed.set(r.id, t + ms); for (const [k, v] of failed) if (v < t) failed.delete(k); };
  // режим записи: свой, а запись с телефона — как просил телефон (rec.want); своё выключено — не считаем
  const modeOf = (r) => { const m = autoMode(settings(), desk); return m !== 'off' && r.want && ['2', '4', '6'].includes(r.want.stems) ? r.want.stems : m; };
  const hqOf = (r) => autoHq(settings()) || !!(r.want && r.want.hq && autoMode(settings(), desk) !== 'off');
  const needsStems = (r) => { const m = modeOf(r); return m !== 'off' && jobs.supported(m) && !hasStems(files, r.id, m) && ok(r) && !pcWaits(r, 'stems'); };
  // текст — после дорожек (по вокалу точнее); дорожки выключены — по записи целиком
  const needsLyr = (r) => { const m = modeOf(r); return autoLyr(settings()) && jobs.lyricsSupported() && !r.lyr && !r.lyrTried && ok(r) && (m === 'off' || !jobs.supported(m) || hasStems(files, r.id, m)); };
  const needsHq = (r) => { const m = modeOf(r); return hqOf(r) && m !== 'off' && jobs.supported(m) && !hasStems(files, r.id, m, true) && ok(r) && !pcWaits(r, 'stems'); };
  const usedAt = (r) => Math.max(r.created || 0, ((app.device.audio || {}).used || {})[r.id] || 0);
  const recent = () => files.list('audio').filter(candidate).sort((a, b) => usedAt(b) - usedAt(a));
  // первая очередь — тональность и обычное разделение у всех; вторая — улучшенное, когда первая пуста
  const next = () => { const L = recent(); return L.find((r) => needsAna(r) || needsStems(r)) || L.find(needsLyr) || L.find(needsHq) || null; };

  // Разбор: моделями (src/audio/mir.js — тональность, доли и темп, аккорды; APK и Windows), иначе — своя хрома и
  // огибающая (songanalyze.js). rec.ana: { pc, minor, cents, bpm, bpb, beats, downbeats, chords, v, at }
  let ana = null; // идущий разбор — чтобы прервать, когда зазвучало
  async function analyze(r) {
    const t0 = Date.now();
    try {
      const { mirSupported, analyzeMir } = await import('../audio/mir.js');
      if (mirSupported()) {
        // телефон — тональность, доли и темп; аккорды — только компьютер (тяжёлые модели, точнее)
        ana = analyzeMir(r.blob, { what: desk ? ['key', 'beats', 'chords'] : ['key', 'beats'] });
        const a = await ana.promise;
        r.ana = { pc: a.key.pc, minor: a.key.minor, conf: a.key.conf, cents: a.key.cents ?? null, bpm: a.beats.bpm || null, bpb: a.beats.beatsPerBar || null, beats: a.beats.beats, downbeats: a.beats.downbeats, ...(a.chords ? { chords: a.chords } : {}), v: ANA_V, at: Date.now() };
      } else {
        const { analyzeAudio } = await import('./songanalyze.js');
        const a = await analyzeAudio(r.blob);
        r.ana = { pc: a.key ? a.key.pc : null, minor: !!(a.key && a.key.minor), cents: a.tuning ? a.tuning.cents : null, bpm: a.tempo ? Math.round(a.tempo.bpm) : null, v: 1, at: Date.now() };
      }
    } catch (e) {
      if (e && e.message === 'cancel') { ana = null; return; } // повторится позже
      r.anaTried = true; log('auto', 'разбор записи не удался: ' + (e && e.message), 'w');
    }
    ana = null;
    if (r.ana && r.dur > 1) { dTime('ana', Date.now() - t0); dGauge('ana.x', (Date.now() - t0) / 1000 / r.dur); } // разбор: сколько и во сколько раз дольше записи
    await files.save(r);
  }
  async function tick() {
    timer = 0;
    if (running) return;
    const r = next();
    if (!r) return;
    if (!quiet() || !powered()) { schedule(RETRY_MS); return; }
    running = true;
    try {
      if (needsAna(r)) await analyze(r);
      else if (needsLyr(r)) {
        log('auto', 'текст в фоне: ' + r.id);
        try { await jobs.lyrics(r, { auto: true }); } catch (e) { if (e && e.message === 'cancel') fail(r, RETRY_MS); else { r.lyrTried = true; await files.save(r); } }
      } else {
        const m = modeOf(r), hq = !needsStems(r);
        log('auto', 'дорожки в фоне: ' + r.id + ' (' + m + (hq ? ', hq' : '') + ')');
        try { await jobs.separate(r, m, { auto: true, hq }); } catch (e) { if (e && e.message === 'cancel') fail(r, RETRY_MS); else fail(r, 6 * 3600000); }
      }
    } finally { running = false; }
    schedule(2000);
  }
  function schedule(ms = DELAY_MS) { if (timer) return; timer = setTimeout(tick, ms); }
  // зазвучало — прервать фоновое разделение (между сегментами), доделает позже
  const onSound = () => { const c = jobs.current; if (c && c.auto) jobs.cancel(); if (ana) ana.cancel(); };
  const api = {
    start() {
      if (started) return; // повторный запуск не должен удваивать ни таймер, ни слушатели
      started = true;
      files.subscribe(() => schedule()); schedule(DELAY_MS);
      poll = setInterval(() => { if (!quiet()) onSound(); else schedule(); }, 5000);
      // касание, мышь, клавиша — сразу прервать фоновый счёт (не ждать проверки раз в 5 с) и отложить следующий
      if (typeof window !== 'undefined') {
        const onIn = () => { lastInput = Date.now(); onSound(); };
        ['pointerdown', 'keydown', 'wheel'].forEach((k) => window.addEventListener(k, onIn, { capture: true, passive: true }));
        offs.push(() => ['pointerdown', 'keydown', 'wheel'].forEach((k) => window.removeEventListener(k, onIn, { capture: true })));
      }
    },
    // Фоновый счёт останавливается: таймер и слушатели снимаются (правило: таймер без остановки — дефект)
    stop() {
      if (!started) return;
      started = false;
      clearInterval(poll); poll = 0;
      offs.splice(0).forEach((f) => f());
      clearTimeout(timer); timer = 0;
    },
    kick: () => schedule(1000),
    waitsPc: (r) => pcWaits(r, 'stems') && !hasStems(files, r.id), // плеер: «посчитает компьютер»
    quiet, playing, // для связи с компьютером: фоновая синхронизация — только в тишине, приём — не во время музыки
    want: () => ({ stems: autoMode(settings(), desk), hq: autoHq(settings()) }), // какие дорожки нужны этому устройству
    // что это устройство считает само (компьютер сообщает телефону)
    caps: () => ({ stems: jobs.supported() ? autoMode(settings(), desk) : 'off', ana: autoAna(settings()) && mirOk, lyr: autoLyr(settings()) && jobs.lyricsSupported() }),
    power: () => autoPower(settings()),
    setPower(v) { settings().autoPower = v; app.store.settingsChanged(); schedule(1000); },
    mode: () => autoMode(settings(), desk), // режим из настройки — умолчание и для разделения по кнопке
    hq: () => autoHq(settings()),
    setHq(v) { settings().autoHq = !!v; app.store.settingsChanged(); schedule(1000); }, // переключатель и в плеере, и в настройках — один
    lyr: () => autoLyr(settings()),
    setLyr(v) { settings().autoLyr = !!v; app.store.settingsChanged(); schedule(1000); },
    get pending() { return files.list('audio').filter((r) => candidate(r) && (needsAna(r) || needsStems(r) || needsLyr(r) || needsHq(r))).length; },
  };
  return api;
}
