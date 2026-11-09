// Диктофон: запись с выбранного входа (микрофон телефона, гарнитура, Bluetooth, USB — и приёмники петличек
// Hollyland, DJI и других; в браузере и на компьютере — и звук экрана или вкладки), воспроизведение на выбранный выход,
// обработка режимами (src/audio/vocal.js: «Как есть», «Музыка», «Речь», «Вокал», «Эфир», «Репетиция»; цепочка
// срез → экспандер → де-эссер → тембр → компрессор → эффекты → лимитер, громкость файла по EBU R128; любая правка —
// «Свой»), общая цепочка эффектов приложения (ctx.fxPanel), обрезка. Готовая запись — в медиатеку (WAV 16/24/32).
// Надёжность: исходник пишется как есть и хранится отдельно (после сохранения — ещё 14 дней), обработка — отдельно;
// не удалась обработка — можно сохранить исходник; вход пропал — запись продолжается со встроенного микрофона или
// бережно заканчивается.
// До записи: вход слушается сразу — мини-окно спектра и уровня, цепочка эффектов и усиление звучат вживую в наушниках
// теми же узлами, что и при обработке записи; в файл пишется исходник, обработка с теми же настройками применяется
// при сохранении. Кнопка записи — внизу, под рукой.
// Звук не покидает устройство. Движок — src/audio/voiceengine.js, обработка — src/audio/voicefx.js и livefx.js.
import ru from './i18n/ru.json';
import uz from './i18n/uz.json';
import en from './i18n/en.json';
import el from './i18n/el.json';
import './voice.css';
import { engine, isLav, KIND, devKind } from '../../audio/voiceengine.js';
import { decodeWav, encodeWav, processVoice, peaks, spectrumDb, migrateVoiceFx, withCue } from '../../audio/voicefx.js';
import { BUILTIN, isUser, isDirty, applyPreset, saveAs, overwrite, rename, remove as removePreset, migratePresets, normalizePresets } from '../../audio/voicepresets.js';
import { MODE_IDS, LEVELS, normalizeVoiceSet, editVoiceSet, modeParams, modeLevel } from '../../audio/vocal.js';
import { normalizeFx } from '../../audio/fx.js';
import { createLiveFx, openInput, setOutput, levelOf } from '../../audio/livefx.js';

import meta, { ICON } from './meta.js';
const I = {
  rec: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="currentColor" stroke="none"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="currentColor" stroke="none"/></svg>',
  tune: '<svg viewBox="0 0 24 24"><path d="M5 4v6M5 14v6M12 4v2M12 10v10M19 4v10M19 18v2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="16" r="2"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.3-7.2c.6-.4.6-1.4 0-1.8L8.6 3.9C7.9 3.5 7 4 7 4.8z" fill="currentColor" stroke="none"/></svg>',
  ear: '<svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4.5" height="7" rx="1.8"/><rect x="16.5" y="13.5" width="4.5" height="7" rx="1.8"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/></svg>',
  mark: '<svg viewBox="0 0 24 24"><path d="M7 3.5h10a1 1 0 0 1 1 1V20l-6-4-6 4V4.5a1 1 0 0 1 1-1z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
  inp: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
};
// Вид входа — значок на плашке входа
const KI = {
  phone: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M11 18.5h2"/></svg>',
  wired: '<svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4.5" height="7" rx="1.8"/><rect x="16.5" y="13.5" width="4.5" height="7" rx="1.8"/></svg>',
  bt: '<svg viewBox="0 0 24 24"><path d="m7 7.5 10 9-5 4.5V3l5 4.5-10 9"/></svg>',
  usb: '<svg viewBox="0 0 24 24"><path d="M12 21V4M9 6.5 12 3.5l3 3M12 15l-4.5-3V9.5M12 13l4.5-3V8"/><circle cx="7.5" cy="8.5" r="1.3"/><rect x="15.3" y="6" width="2.4" height="2.4"/><circle cx="12" cy="20" r="1.6"/></svg>',
  lav: '<svg viewBox="0 0 24 24"><rect x="9.5" y="3" width="5" height="9" rx="2.5"/><path d="M12 12v4M8 21c0-3 2-5 4-5s4 2 4 5"/></svg>',
  display: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/></svg>',
  hdmi: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/></svg>',
  other: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  speaker: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  earpiece: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M10 5.5h4"/></svg>',
  tech: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></svg>',
};
const FX_DEF = { denoise: 0, gate: -90, gain: 0, normalize: true }; // своё у диктофона; остальное — общая цепочка (s.chain)
const RAW_KEEP_DAYS = 14, RAW_KEEP_MIN = 10; // исходники сохранённых записей: не меньше 10 последних и не старше 14 дней
// Окно уровня: что показывать (настраивается — шестерёнка в окне)
const METER_DEF = { spec: true, style: 'bars', mode: 'both', clip: -0.3, hold: 2, range: 60, smooth: 'mid' };

let host = null, ctx = null, size = 'full', offs = [], onClick = null, onChange = null, onPtr = null, onInput = null;
const S = { marks: [], warned: {}, recDev: null, liveDev: null, inWarn: '', gr: null, phase: 'idle', sec: 0, peak: 0, rms: 0, paused: false, clip: 0, take: null, sel: [0, 1], playing: false, pos: 0, mode: 'proc', busy: false, devs: { inputs: [], outputs: [] }, err: null, proc: null, kept: [] };

const st = () => {
  const s = ctx.store.all();
  s.fx = { ...FX_DEF, ...(s.fx || {}) };
  if (!s.chain) { s.chain = normalizeFx(migrateVoiceFx(s.fx)); ['lowcut', 'eq', 'comp', 'reverb'].forEach((k) => delete s.fx[k]); ctx.store.save(); } // настройки до 2026-10 — перенос один раз
  if (!s.voice) { s.voice = migrateVoice(s.fx); ctx.store.save(); } // режимы обработки (2026-11) — из прежних настроек один раз
  s.voice = normalizeVoiceSet(s.voice);
  s.meter = { ...METER_DEF, ...(s.meter || {}) }; s.in ??= null; s.out ??= null; if (!Array.isArray(s.outs)) s.outs = s.out ? [s.out] : []; /* выходы — несколько сразу (07.11.2026) */ s.stereo ??= false; s.raw ??= true; s.live ??= true; s.hear ??= false;
  s.bits ??= 24; s.keepRaw ??= false; s.pick ??= 'mix'; if (!Array.isArray(s.savedRaw)) s.savedRaw = [];
  // пресеты (02.11.2026): свой режим или настроенные эффекты становятся своим пресетом «Мой» — звук не меняется
  if (migratePresets(s, t('preset.mine'))) ctx.store.save();
  s.presets = normalizePresets(s.presets);
  if (!s.marksBy || typeof s.marksBy !== 'object') s.marksBy = {}; // метки записей в памяти: путь исходника → [{ t, name }]
  return s; };
// Прежние ручки (шумоподавление, гейт, нормализация) → режим: не трогали — «Музыка», трогали — «Свой» с ними
function migrateVoice(fx = {}) {
  const custom = fx.denoise > 0 || (fx.gate != null && fx.gate > -90) || fx.normalize === false;
  if (!custom) return { mode: 'music' };
  const p = { ...modeParams('music'), denoise: +fx.denoise || 0 };
  if (fx.gate > -90) Object.assign(p, { expThr: fx.gate, expRatio: 4, expRange: 40 });
  return { mode: 'own', base: 'music', p, level: fx.normalize === false ? 'off' : 'peak' };
}
const big = () => size === 'full' || size === 'half';
const esc = (s) => ctx.ui.esc(s);
const t = (k, v) => ctx.t(k, v);
const fmt = (sec) => { sec = Math.max(0, sec || 0); const m = Math.floor(sec / 60), s = sec - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };

/* ---------- устройства ---------- */

// Встроенный микрофон: где стоит — по адресу устройства или по координатам из описания системы (getMicrophones)
function micPlace(d) {
  const a = String(d.address || '') + ' ' + String((d.mic && d.mic.desc) || '');
  if (/bottom|низ/i.test(a)) return t('mic.bottom');
  if (/back|rear|camera|cam/i.test(a)) return t('mic.back');
  if (/top|верх/i.test(a)) return t('mic.top');
  if (/front/i.test(a)) return t('mic.front');
  const all = S.devs.inputs.filter((x) => x.type === 'builtin_mic');
  if (all.length < 2) return '';
  const ys = all.filter((x) => x.mic && x.mic.y != null);
  if (d.mic && d.mic.y != null && ys.length === all.length) {
    const lo = Math.min(...ys.map((x) => x.mic.y)), hi = Math.max(...ys.map((x) => x.mic.y));
    if (d.mic.y === lo && lo !== hi) return t('mic.bottom');
    if (d.mic.y === hi && lo !== hi) return t('mic.top');
    if (d.mic.z != null && d.mic.z > Math.min(...ys.map((x) => x.mic.z ?? 0))) return t('mic.back');
  }
  return t('mic.n', { n: all.indexOf(d) + 1 });
}
function devName(d) {
  if (d.type === 'display') return t('dev.display');
  const nm = d.name && d.name !== 'null' ? d.name : '';
  if (d.tech) return t('dev.t.' + d.type) !== 'dev.t.' + d.type ? t('dev.t.' + d.type) + (nm ? ': ' + nm : '') : t('dev.tech', { type: d.type }) + (nm ? ': ' + nm : '');
  if (d.type === 'builtin_mic') { const p = micPlace(d); return t('dev.phone') + (p ? ' · ' + p : ''); }
  if (d.type === 'wired_headset' || d.type === 'wired_headphones') return t(d.type === 'wired_headset' ? 'dev.jackMic' : 'dev.jack') + (nm && !/^(null|h2w|headset)$/i.test(nm) ? ': ' + nm : '');
  if (d.type === 'line') return t('dev.line') + (nm ? ': ' + nm : '');
  const k = KIND[d.type] || 'other', base = t('dev.' + k);
  if (k === 'phone' || k === 'speaker' || k === 'earpiece') return base + ((d.isOut ? S.devs.outputs : S.devs.inputs).filter((x) => x.type === d.type).length > 1 && nm ? ' · ' + nm : '');
  return base + (nm ? ': ' + nm : '');
}
// Все входы и выходы, что видит система (слово автора 07.11.2026: «если в телефоне 10 микрофонов — все 10»):
// встроенные микрофоны — каждый отдельно, служебные — в конце списка
async function loadDevices() {
  try { S.devs = await engine().devices(); } catch { S.devs = { inputs: [], outputs: [] }; }
  const order = (l) => l.filter((d) => !d.tech).concat(l.filter((d) => d.tech));
  S.devs.inputs = order(S.devs.inputs);
  S.devs.outputs = order(S.devs.outputs.map((d) => ({ ...d, isOut: true })));
  render();
}
const curOuts = () => st().outs.map((id) => S.devs.outputs.find((d) => String(d.id) === String(id))).filter(Boolean);
const curIn = () => S.devs.inputs.find((d) => String(d.id) === String(st().in)) || null;

const sw = (k, on) => '<label class="sw"><input type="checkbox" role="switch" aria-label="' + esc(t(k)) + '" data-v="' + k + '"' + (on ? ' checked' : '') + '><i></i></label>';

/* ---------- запись ---------- */

// Вход до записи: слушать и обрабатывать вживую (livefx) — мини-окно спектра и уровня после обработки,
// в наушниках (если включено) — звук с обработкой. Ничего не пишется. Android: вход направляется маршрутом.
let L = null; // { c, inp, fx, an, mon, raf, buf }
async function liveStart() {
  if (L || !host || !big() || S.phase !== 'idle') return;
  const s = st(), dev = curIn(), E = engine();
  if (dev && dev.type === 'display') return; // звук экрана — окно выбора только при записи
  L = { pending: true };
  let c = null, inp = null;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    c = new C({ latencyHint: 'interactive' });
    if (E.native) await E.route(dev ? dev.id : -1);
    inp = await openInput(c, !E.native && dev ? dev.id : null);
    const fx = await createLiveFx(c, { chain: s.chain, gain: s.fx.gain, voice: s.voice });
    if (!L || !L.pending) { fx.disconnect(); inp.stop(); c.close(); if (E.native) E.unroute(); return; } // успели закрыть
    const an = c.createAnalyser(), mon = c.createGain();
    an.fftSize = 2048;
    inp.src.connect(fx.input); fx.output.connect(an); fx.output.connect(mon).connect(c.destination);
    mon.gain.value = s.hear ? 1 : 0;
    if (!E.native && s.outs.length) setOutput(c, s.outs[0]);
    L = { c, inp, fx, an, mon, buf: new Float32Array(an.fftSize), raf: 0 };
    resetMeter(c.sampleRate);
    // какой вход открыт на самом деле (браузер и компьютер: имя и частота дорожки)
    const tr = inp.stream && inp.stream.getAudioTracks()[0], ts = (tr && tr.getSettings && tr.getSettings()) || {};
    S.liveDev = tr && !E.native ? { id: ts.deviceId || '', name: tr.label || '', rate: ts.sampleRate || c.sampleRate, channels: ts.channelCount || 0 } : null;
    S.err = null;
    const loop = () => { if (!L || !L.an) return; L.raf = requestAnimationFrame(loop); meterUpdate(levelOf(L.an, L.buf)); grUpdate(L.fx.gr()); };
    loop();
  } catch (e) {
    L = null;
    // Контекст и вход освобождаем: «микрофон не дали» — частый случай, а контекстов у браузера мало
    // (шесть — и звук в приложении перестаёт работать совсем)
    try { inp && inp.stop(); } catch { /* ignore */ }
    try { c && c.close(); } catch { /* ignore */ }
    S.err = e && (e.reason === 'denied' || e.reason === 'nomic') ? e.reason : 'unavailable';
    if (E.native) E.unroute();
  }
  render();
}
async function liveStop() {
  const l = L; L = null;
  if (!l || l.pending) return;
  cancelAnimationFrame(l.raf);
  l.fx.disconnect(); l.inp.stop();
  try { await l.c.close(); } catch { /* уже */ }
  if (engine().native) await engine().unroute();
}
const liveFx = () => { if (L && L.fx) L.fx.update({ chain: st().chain, gain: st().fx.gain, voice: st().voice }); };
const liveHear = () => { if (L && L.mon) L.mon.gain.setTargetAtTime(st().hear ? 1 : 0, L.c.currentTime, 0.03); };
const liveRestart = async () => { await liveStop(); if (st().live) liveStart(); };
async function startRec() {
  await liveStop();
  if (S.take && !S.take.saved && !(await ctx.ui.confirm(t('discardTitle'), t('discardText'), t('discardYes')))) return;
  await dropTake();
  const s = st(), dev = curIn();
  try {
    const r = await engine().start({ deviceId: dev ? dev.id : -1, stereo: s.stereo || s.pick !== 'mix', raw: s.raw });
    Object.assign(S, { phase: 'rec', sec: 0, peak: 0, rms: 0, paused: false, clip: 0, err: null, rate: r.rate, recCh: r.channels, bt: r.bt, marks: [], t0: Date.now(), inWarn: '', warned: {}, recDev: r.dev ? { ...r.dev, rate: r.dev.rate || r.rate } : null });
    s.liveMarks = { t0: S.t0, marks: [] }; ctx.store.save();
    resetMeter(r.rate || 48000);
    ctx.log('запись: вход ' + (dev ? dev.type : 'авто') + (r.dev ? ' (пишет: ' + (r.dev.type || '') + ' «' + r.dev.name + '»)' : '') + ', ' + r.rate + ' Гц, каналов ' + r.channels + (r.raw === false ? ', с обработкой системы' : ''));
  } catch (e) {
    const m = String(e && e.message);
    S.err = m === 'denied' || m === 'space' || m === 'noaudio' || m === 'nomic' ? m : 'unavailable';
    ctx.log('запись не началась: ' + S.err, 'w');
  }
  render();
}
async function stopRec() {
  try {
    const r = await engine().stop();
    const s = st();
    if (S.marks.length) s.marksBy[r.path] = S.marks.slice(); // метки — к исходнику (до чтения: чтение может не удаться)
    delete s.liveMarks; ctx.store.save();
    S.take = await loadTake(r.path);
    Object.assign(S, { phase: 'take', sel: [0, 1], pos: 0, mode: 'proc', proc: null, marks: [], inWarn: '' });
    ctx.log('записано ' + S.take.sec.toFixed(1) + ' с' + (r.reason ? ' (остановлено: ' + r.reason + ')' : ''));
  } catch (e) { ctx.logErr(e); S.phase = 'idle'; ctx.ui.toast(t('recFail')); loadKept(); }
  render();
}
// Исходник → дубль: каналы, волна. Вход с двумя каналами, а нужен один (петличка в канале 1 звуковой карты) —
// взять его; в файле исходника остаются оба
async function loadTake(path) {
  const u8 = await engine().read(path), w = u8 && decodeWav(u8);
  if (!w || !w.ch[0].length) throw new Error('empty');
  const pk = st().pick, ch = w.ch.length === 2 && !st().stereo ? (pk === 'l' ? [w.ch[0]] : pk === 'r' ? [w.ch[1]] : [w.ch[0].map((v, i) => (v + w.ch[1][i]) / 2)]) : w.ch;
  const s = st();
  // метки: свои у исходника; запись оборвалась (сбой, закрыли окно) — метки той записи из liveMarks
  let marks = s.marksBy[path];
  if (!marks && s.liveMarks && s.liveMarks.marks && s.liveMarks.marks.length) { marks = s.liveMarks.marks; s.marksBy[path] = marks; delete s.liveMarks; ctx.store.save(); }
  return { path, ch, sr: w.sr, sec: ch[0].length / w.sr, peaks: peaks(ch, 600), saved: false, marks: (marks || []).slice() };
}
// Исходники прошлых записей в памяти диктофона: после сбоя, закрытия или неудачного чтения запись не теряется —
// её можно открыть снова и сохранить. Исходники сохранённых записей хранятся RAW_KEEP_DAYS дней (не меньше
// RAW_KEEP_MIN последних) — можно обработать заново; несохранённые сами не удаляются никогда
async function loadKept() {
  const fs = engine().list ? await engine().list() : [], s = st(), now = Date.now();
  const saved = new Map(s.savedRaw.map((x) => [x.path, x.at]));
  const old = fs.filter((f) => saved.has(f.path)).sort((a, b) => b.at - a.at).slice(RAW_KEEP_MIN).filter((f) => now - saved.get(f.path) > RAW_KEEP_DAYS * 864e5);
  old.forEach((f) => engine().remove(f.path));
  const gone = new Set(old.map((f) => f.path)), have = new Set(fs.map((f) => f.path));
  const keep = s.savedRaw.filter((x) => !gone.has(x.path) && have.has(x.path));
  if (keep.length !== s.savedRaw.length) { s.savedRaw = keep; ctx.store.save(); }
  const mk = Object.keys(s.marksBy).filter((k) => !have.has(k) || gone.has(k));
  if (mk.length && fs.length) { mk.forEach((k) => delete s.marksBy[k]); ctx.store.save(); }
  S.kept = fs.filter((f) => !gone.has(f.path) && (!S.take || f.path !== S.take.path)).map((f) => ({ ...f, saved: saved.has(f.path) })).sort((a, b) => b.at - a.at);
  render();
}
async function openKept(path) {
  if (S.phase !== 'idle') return;
  try {
    await liveStop();
    S.take = await loadTake(path);
    Object.assign(S, { phase: 'take', sel: [0, 1], pos: 0, mode: 'proc', proc: null, kept: S.kept.filter((f) => f.path !== path) });
    ctx.log('открыта запись из памяти: ' + S.take.sec.toFixed(1) + ' с');
  } catch (e) { ctx.logErr(e); ctx.ui.toast(t('recFail')); }
  render();
}
// Убрать дубль с экрана: несохранённый — удалить (после подтверждения), сохранённый — исходник остаётся в памяти
async function dropTake() {
  await stopPlay();
  if (S.take) { if (!S.take.saved) { engine().remove(S.take.path); delete st().marksBy[S.take.path]; ctx.store.save(); } if (S.proc) engine().remove(S.proc.path); }
  S.take = null; S.proc = null; S.phase = 'idle';
  loadKept();
}

/* ---------- обработка и воспроизведение ---------- */

const selSec = () => [S.sel[0] * S.take.sec, S.sel[1] * S.take.sec];
const fxKey = () => JSON.stringify([st().fx.gain, st().voice, st().chain, S.sel]);
async function processed() {
  if (S.proc && S.proc.key === fxKey()) return S.proc;
  S.busy = true; render();
  await new Promise((r) => setTimeout(r, 30)); // дать экрану обновиться
  let out;
  try { out = await processVoice(S.take.ch, S.take.sr, { gain: st().fx.gain, voice: st().voice, chain: st().chain, trim: selSec() }); }
  finally { S.busy = false; }
  const path = 'proc-' + Date.now() + '.wav';
  if (S.proc) engine().remove(S.proc.path);
  await engine().write(path, encodeWav(out, S.take.sr));
  S.proc = { path, key: fxKey(), ch: out, sec: out[0].length / S.take.sr };
  return S.proc;
}
async function play() {
  if (S.playing) { await stopPlay(); render(); return; }
  try {
    const outs = curOuts().map((d) => d.id), out = outs.length ? outs : -1; // несколько выходов — звук во все сразу
    if (S.mode === 'proc') { const p = await processed(); S.offset = selSec()[0]; await engine().play(p.path, out, 0); }
    else { S.offset = 0; await engine().play(S.take.path, out, selSec()[0]); }
    S.playing = true;
  } catch (e) { ctx.logErr(e); S.busy = false; ctx.ui.toast(t('playFail')); }
  render();
}
async function stopPlay() { if (S.playing) { S.playing = false; try { await engine().stopPlay(); } catch { /* уже */ } } }

const stamp = () => { const d = new Date(), pad = (n) => String(n).padStart(2, '0'); return { d: pad(d.getDate()) + '.' + pad(d.getMonth() + 1), t: pad(d.getHours()) + '-' + pad(d.getMinutes()) }; };
// Метки — и в запись медиатеки (плеер показывает их на волне), и в сам WAV (cue: видят Reaper, Audition, Audacity)
async function addFile(name, wav, dur, marks = []) {
  const song = ctx.session && ctx.session.songId;
  await ctx.files.add({ id: 'vc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, size: wav.length, type: 'audio/wav', kind: 'audio', songs: song ? [song] : [], created: Date.now(), blob: new Blob([wav], { type: 'audio/wav' }), dur, ...(marks.length ? { marks } : {}) });
}
// Исходник в медиатеку как есть (звук байт в байт; метки — блоком после звука, только у целого файла)
async function saveRaw() {
  const u8 = await engine().read(S.take.path), marks = S.take.marks || [];
  await addFile(t('fileName', stamp()) + ' · ' + t('rawSfx') + '.wav', withCue(u8, marks, S.take.sr), S.take.sec, marks);
}
function markSaved() {
  const s = st();
  S.take.saved = true;
  if (!s.savedRaw.some((x) => x.path === S.take.path)) { s.savedRaw.push({ path: S.take.path, at: Date.now() }); ctx.store.save(); }
}
async function save() {
  let p;
  try { p = await processed(); } catch (e) {
    // обработка не удалась (не хватило памяти на длинной записи и т. п.) — запись не теряется: сохранить исходник
    ctx.logErr(e); render();
    if (await ctx.ui.confirm(t('procFail'), t('procFailText'), t('saveRaw'))) {
      try { await saveRaw(); markSaved(); ctx.ui.toast(t('saved')); } catch (e2) { ctx.logErr(e2); ctx.ui.toast(t('saveFail')); }
    }
    render(); return;
  }
  try {
    const [a, b] = selSec(), marks = marksIn(S.take.marks, a, b);
    const wav = withCue(encodeWav(p.ch, S.take.sr, st().bits), marks, S.take.sr);
    await addFile(t('fileName', stamp()) + '.wav', wav, p.sec, marks);
    if (st().keepRaw) await saveRaw();
    markSaved();
    ctx.ui.toast(t('saved'));
    ctx.log('сохранено в медиатеку: ' + p.sec.toFixed(1) + ' с, ' + st().bits + ' бит, пресет ' + (isUser(st().cur) ? 'свой' : st().cur) + (isDirty(st()) ? ' (изменён)' : '') + ', меток ' + marks.length);
  } catch (e) { ctx.logErr(e); ctx.ui.toast(t('saveFail')); }
  render();
}

/* ---------- экран ---------- */
// Один экран (DECISIONS 2026-11-02): сверху — плашка входа (откуда и как пишется) и лампочка состояния; посередине —
// спектр и полоска уровня на всё свободное место; под ним — пресеты строкой; внизу — одна полоса кнопок:
// вход · метка · запись · настройка пресета · ещё. Цифры, работа обработки, эффекты и эквалайзер — по кнопкам и касанию.

// Уровень и лампочка: «жду сигнал» → «в норме» / «тихо» / «нет сигнала»; перегруз горит, пока его не коснутся
const M = { hold: -120, holdAt: 0, clip: false, spec: null, rate: 48000, t0: 0, sigAt: 0, loudAt: 0, lamp: 'wait', db: -120, rms: -120 };
let detailEl = null; // открытая шторка с цифрами — обновляется вместе с экраном
const resetMeter = (rate) => Object.assign(M, { hold: -120, holdAt: 0, clip: false, spec: null, rate: rate || M.rate, t0: 0, sigAt: 0, loudAt: 0, lamp: 'wait' });
const pctOf = (db) => Math.max(0, Math.min(100, ((db + st().meter.range) / st().meter.range) * 100));
const dbOf = (x) => (x > 1e-6 ? 20 * Math.log10(x) : -120);
const fmtDb = (d) => (d <= -90 ? '−∞' : (d > -0.05 ? '0.0' : d.toFixed(1)).replace('-', '−'));
function lampOf(now) {
  if (M.clip) return 'clip';
  if (!M.sigAt) return now - M.t0 > 3000 ? 'none' : 'wait';
  if (now - M.sigAt > 3000) return 'none';
  return now - M.loudAt > 5000 ? 'low' : 'ok';
}
function meterUpdate(e) {
  if (!host) return;
  const m = st().meter, now = performance.now(), q = (sel) => host.querySelector(sel);
  const pk = dbOf(e.peak), rm = dbOf(e.rms);
  if (!M.t0) M.t0 = now;
  if (pk >= m.clip) M.clip = true;
  if (pk > -90) M.sigAt = now;
  if (pk > -40) M.loudAt = now;
  if (pk > M.hold || (m.hold > 0 && now - M.holdAt > m.hold * 1000) || m.hold === 0) { M.hold = pk; M.holdAt = now; }
  M.db = pk; M.rms = rm;
  const cut = (x) => 'inset(0 ' + (100 - x).toFixed(1) + '% 0 0)';
  const r = q('#vc-barr'); if (r) r.style.clipPath = cut(pctOf(rm));
  const p = q('#vc-barp'); if (p) p.style.clipPath = cut(pctOf(pk));
  const h = q('#vc-hold'); if (h) h.style.left = pctOf(M.hold) + '%';
  const lamp = lampOf(now);
  if (lamp !== M.lamp) {
    M.lamp = lamp; const l = q('#vc-lamp'); if (l) { l.className = 'vc-lamp ' + lamp; l.querySelector('em').textContent = t('lamp.' + lamp); }
    // при записи — сказать один раз: молчащий внешний микрофон легко не заметить (кабель, фантомное питание, канал)
    if (S.phase === 'rec' && (lamp === 'none' || lamp === 'clip') && !S.warned[lamp]) {
      S.warned[lamp] = true; ctx.log('запись: ' + (lamp === 'none' ? 'нет сигнала со входа' : 'перегруз входа'), 'w');
      if (lamp === 'none') ctx.ui.toast(t('lamp.noneHint'));
    }
  }
  if (detailEl) {
    const a = detailEl.querySelector('#vcd-pk'); if (a) { a.textContent = fmtDb(pk); a.classList.toggle('hot', pk >= m.clip); }
    const b = detailEl.querySelector('#vcd-rms'); if (b) b.textContent = fmtDb(rm);
    const c = detailEl.querySelector('#vcd-hold'); if (c) c.textContent = fmtDb(M.hold);
  }
  if (e.samples && m.spec) drawSpec(e.samples, e.rate || M.rate);
}
// Спектр: логарифмическая шкала 40 Гц…16 кГц, столбики или линия, сглаживание по времени
function drawSpec(x, rate) {
  const cv = host && host.querySelector('#vc-spec');
  if (!cv) return;
  const m = st().meter, dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const s = spectrumDb(x, 1024), NB = m.style === 'bars' ? 40 : 96, lo = Math.log10(40), hi = Math.log10(Math.min(16000, rate / 2));
  const bands = new Float32Array(NB);
  for (let b = 0; b < NB; b++) {
    const f0 = Math.pow(10, lo + ((hi - lo) * b) / NB), f1 = Math.pow(10, lo + ((hi - lo) * (b + 1)) / NB);
    let k0 = Math.floor((f0 * 1024) / rate), k1 = Math.max(k0 + 1, Math.ceil((f1 * 1024) / rate)), v = -120;
    for (let k = k0; k < k1 && k < s.length; k++) v = Math.max(v, s[k]);
    bands[b] = v;
  }
  const a = { fast: 0.7, mid: 0.4, slow: 0.18 }[m.smooth] || 0.4;
  if (!M.spec || M.spec.length !== NB) M.spec = bands; else for (let b = 0; b < NB; b++) M.spec[b] = bands[b] > M.spec[b] ? bands[b] : M.spec[b] + (bands[b] - M.spec[b]) * a;
  const g = cv.getContext('2d'), cs = getComputedStyle(host), tint = cs.getPropertyValue('--tint').trim() || '#9C7242', l3 = cs.getPropertyValue('--l3').trim() || '#ccc';
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const y = (d) => H - (Math.max(0, Math.min(1, (d + 90) / 90)) * (H - 2));
  // сетка: 100 Гц, 1 кГц, 10 кГц
  // линии — ниже времени записи (оно лежит поверх спектра) и проявляются плавно, не перечёркивая цифры
  const gy = Math.min(H * 0.45, 84), gr = g.createLinearGradient(0, gy, 0, gy + 48);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, l3);
  g.fillStyle = l3; g.save(); g.fillStyle = gr;
  [100, 1000, 10000].forEach((f) => { const xx = ((Math.log10(f) - lo) / (hi - lo)) * W; if (xx > 0 && xx < W) g.fillRect(xx, gy, 1, H - gy); });
  g.restore();
  if (m.style === 'bars') {
    const bw = W / NB;
    for (let b = 0; b < NB; b++) { const yy = y(M.spec[b]); g.fillStyle = M.spec[b] > -6 ? '#D2463F' : tint; g.fillRect(b * bw + 1, yy, Math.max(1, bw - 2), H - yy); }
  } else {
    g.beginPath(); for (let b = 0; b < NB; b++) { const xx = (b + 0.5) * (W / NB); b ? g.lineTo(xx, y(M.spec[b])) : g.moveTo(xx, y(M.spec[b])); }
    g.strokeStyle = tint; g.lineWidth = 1.8; g.stroke(); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.globalAlpha = 0.18; g.fillStyle = tint; g.fill(); g.globalAlpha = 1;
  }
}
// Настройки окна уровня
function meterSheet() {
  const { ui } = ctx, m = () => st().meter;
  const row = (k, opts, label) => '<div class="hdr">' + label + '</div><div class="group"><div class="cellcol">' + ui.seg('m-' + k, opts, String(m()[k]), label) + '</div></div>';
  ui.sheet(() => ui.snav(t('m.set')) +
    row('mode', [['both', t('m.both')], ['peak', t('m.peak')], ['rms', 'RMS']], t('m.mode')) +
    row('spec', [['true', t('m.on')], ['false', t('m.off')]], t('m.spec')) +
    row('style', [['bars', t('m.bars')], ['line', t('m.line')]], t('m.style')) +
    row('smooth', [['fast', t('m.fast')], ['mid', t('m.mid')], ['slow', t('m.slow')]], t('m.smooth')) +
    row('clip', [['-0.3', '−0,3'], ['-1', '−1'], ['-3', '−3'], ['-6', '−6']], t('m.clip')) +
    row('hold', [['0', t('m.off')], ['1', '1 ' + t('m.s')], ['2', '2 ' + t('m.s')], ['5', '5 ' + t('m.s')], ['-1', '∞']], t('m.hold')) +
    row('range', [['48', '48'], ['60', '60'], ['90', '90']], t('m.range')) +
    '<p class="ftr">' + t('m.hint') + '</p>',
  (el, sh) => el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg] [data-v]');
    if (!b) return;
    const k = b.closest('[data-seg]').dataset.seg.slice(2), v = b.dataset.v;
    st().meter[k] = k === 'style' || k === 'mode' || k === 'smooth' ? v : v === 'true' ? true : v === 'false' ? false : +v;
    ctx.store.save(); sh.update(); render();
  }));
}
// Шторка с цифрами: пик, RMS, удержание, работа обработки по ступеням (живой вход); оттуда — спектр на весь экран
function detailSheet() {
  const { ui } = ctx, live = S.phase === 'idle' && L && L.fx && L.fx.live;
  ui.sheet(() => ui.snav(t('det.title')) +
    '<div class="vcd"><div><b class="num" id="vcd-pk">' + fmtDb(M.db) + '</b><span class="l2">' + t('m.peakU') + '</span></div>' +
    '<div><b class="num" id="vcd-rms">' + fmtDb(M.rms) + '</b><span class="l2">' + t('m.rmsU') + '</span></div>' +
    '<div><b class="num" id="vcd-hold">' + fmtDb(M.hold) + '</b><span class="l2">' + t('det.hold') + '</span></div></div>' +
    (live ? '<div class="hdr">' + t('det.gr') + '</div>' + grHTML() : '') +
    '<div class="group"><button class="cell act" data-d="spec">' + t('det.full') + '</button><button class="cell act" data-d="mset">' + t('m.set') + '</button></div>' +
    '<p class="ftr">' + t('m.hint') + '</p>',
  (el, sh) => {
    detailEl = el;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-d]');
      if (!b) return;
      if (b.dataset.d === 'spec') { sh.close(); stopPlay(); ctx.openTool('spectrum'); } else meterSheet();
    });
  }, { onClose: () => { detailEl = null; } });
}
// Сокращение усиления ступенями (живой вход): экспандер, де-эссер, компрессор, лимитер — в шторке с цифрами
function grHTML() {
  return '<div class="vc-gr" id="vc-gr" aria-hidden="true">' + ['exp', 'ds', 'comp', 'lim'].map((k) =>
    '<span data-g="' + k + '"><em>' + t('gr.' + k) + '</em><i><b></b></i><s class="num">0</s></span>').join('') + '</div>';
}
function grUpdate(g) {
  const box = detailEl && detailEl.querySelector('#vc-gr');
  if (!box || !g) return;
  ['exp', 'ds', 'comp', 'lim'].forEach((k) => {
    const el = box.querySelector('[data-g="' + k + '"]'), v = Math.max(0, g[k] || 0);
    if (!el) return;
    el.querySelector('b').style.width = Math.min(100, (v / 12) * 100) + '%';
    el.querySelector('s').textContent = v >= 0.5 ? '−' + Math.round(v) : '0';
    el.classList.toggle('on', v >= 0.5);
  });
}

/* ---------- вход ---------- */

// Плашка входа: вид (значком), имя, частота и каналы; если система пишет не с выбранного входа — сказать это
const kindOf = (d) => (!d ? 'phone' : d.type === 'display' ? 'display' : isLav(d) ? 'lav' : devKind(d));
function actualDev() { return S.phase === 'rec' ? S.recDev : S.liveDev; }
function inHTML() {
  const s = st(), d = curIn(), act = actualDev();
  const name = d ? devName(d) : act && act.name ? (act.type ? devName(act) : act.name) : t('auto');
  const kind = d ? kindOf(d) : act && act.type ? kindOf(act) : 'phone';
  const rate = (act && act.rate) || (S.phase === 'rec' ? S.rate : M.rate);
  const ch = S.phase === 'rec' && S.recCh ? S.recCh : s.stereo ? 2 : 1;
  const sub = [rate ? (rate / 1000).toString().replace('.', ',') + ' ' + t('khz') : '', t(ch === 2 ? 'in.stereo' : 'in.mono'), s.raw && d && d.type !== 'display' ? t('in.clean') : ''].filter(Boolean).join(' · ');
  // выбран один вход, а пишет другой (система не послушалась или переключила)
  const other = d && act && act.name && (act.id != null && String(act.id) !== '' ? String(act.id) !== String(d.id) : false);
  const warn = S.inWarn || (other ? t('in.actual', { name: act.type ? devName(act) : act.name }) : '');
  return '<div class="vc-inrow"><button class="vc-in" data-x="insheet" aria-label="' + esc(t('in') + ': ' + name) + '"><span class="vc-ink">' + (KI[kind] || KI.other) + '</span>' +
    '<span class="vc-int"><span class="l2">' + esc([t('in'), sub].filter(Boolean).join(' · ')) + '</span><b>' + esc(name) + '</b>' + (warn ? '<span class="vc-warn">' + esc(warn) + '</span>' : '') + '</span></button>' +
    outHTML() +
    '<button class="vc-lamp ' + M.lamp + '" id="vc-lamp" data-x="lamp" aria-label="' + esc(t('lamp.aria')) + '"><i></i><em>' + t('lamp.' + M.lamp) + '</em></button></div>';
}
// Плашка выхода — рядом с плашкой входа: куда звучит запись (один или несколько выходов сразу)
const outKind = (d) => (!d ? 'speaker' : d.tech ? 'tech' : d.type === 'speaker' ? 'speaker' : d.type === 'earpiece' ? 'earpiece' : devKind(d));
function outHTML() {
  const L = curOuts(), name = !L.length ? t('out.sys') : devName(L[0]) + (L.length > 1 ? ' + ' + (L.length - 1) : '');
  return '<button class="vc-in vc-out" data-x="outsheet" aria-label="' + esc(t('out') + ': ' + name) + '"><span class="vc-ink">' + (KI[outKind(L[0])] || KI.other) + (L.length > 1 ? '<i class="vc-n num">' + L.length + '</i>' : '') + '</span>' +
    '<span class="vc-int"><span class="l2">' + esc(t('out')) + '</span><b>' + esc(name) + '</b></span></button>';
}
// Шторка выхода: все выходы, служебные ниже; касание — добавить или убрать (несколько — звук во все сразу)
function outSheet() {
  const { ui } = ctx;
  ui.sheet(() => {
    const s = st(), on = (d) => s.outs.some((x) => String(x) === String(d.id));
    const row = (d) => '<button class="cell act vc-irow' + (on(d) ? ' on' : '') + '" data-out="' + esc(d.id) + '" aria-pressed="' + on(d) + '"><span class="vc-ink">' + (KI[outKind(d)] || KI.other) + '</span><span class="grow">' + esc(devName(d)) + (d.channels > 1 ? '<span class="st l2">' + esc(t('in.chN', { n: d.channels })) + '</span>' : '') + '</span>' + (on(d) ? '<span class="vc-chk" aria-hidden="true">✓</span>' : '') + '</button>';
    const main = S.devs.outputs.filter((d) => !d.tech), tech = S.devs.outputs.filter((d) => d.tech);
    return ui.snav(t('out')) + '<div class="vcsh"><div class="group"><button class="cell act vc-irow' + (!s.outs.length ? ' on' : '') + '" data-out="" aria-pressed="' + !s.outs.length + '"><span class="vc-ink">' + KI.speaker + '</span><span class="grow">' + esc(t('auto')) + '<span class="st l2">' + esc(t('outAuto')) + '</span></span>' + (!s.outs.length ? '<span class="vc-chk" aria-hidden="true">✓</span>' : '') + '</button>' +
      main.map(row).join('') + '</div>' +
      (tech.length ? '<div class="hdr">' + t('dev.techHdr') + '</div><div class="group">' + tech.map(row).join('') + '</div>' : '') +
      '<p class="ftr">' + t(engine().native ? 'out.hint' : 'out.hintWeb') + '</p></div>';
  }, (el, sh) => {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-out]');
      if (!b) return;
      const s = st(), id = b.dataset.out;
      if (!id) s.outs = [];
      else s.outs = s.outs.some((x) => String(x) === id) ? s.outs.filter((x) => String(x) !== id) : [...s.outs, id];
      s.out = s.outs[0] || null; // прежние версии и запись в инструментах — первый выход
      ctx.store.save();
      sh.update(); render();
      if (S.playing) { stopPlay().then(play); } // идёт прослушивание — сразу на новые выходы
      else if (S.phase === 'idle' && !engine().native) liveRestart();
    });
  });
}
// Шторка входа: все входы строками со значками (служебные ниже), стерео и канал, обработка телефона, слушать вход и себя
function inSheet() {
  const { ui } = ctx, rec = S.phase === 'rec';
  ui.sheet(() => {
    const s = st(), row = (id, kind, name, on, extra) => '<button class="cell act vc-irow' + (on ? ' on' : '') + '" data-in="' + esc(id) + '"' + (rec ? ' disabled' : '') + ' aria-pressed="' + on + '"><span class="vc-ink">' + (KI[kind] || KI.other) + '</span><span class="grow">' + esc(name) + (extra ? '<span class="st l2">' + esc(extra) + '</span>' : '') + '</span>' + (on ? '<span class="vc-chk" aria-hidden="true">✓</span>' : '') + '</button>';
    const lav = curIn() && isLav(curIn());
    const irow = (d) => row(d.id, d.tech ? 'tech' : kindOf(d), devName(d), String(d.id) === String(s.in), [isLav(d) ? t('lav') : '', d.channels > 1 ? t('in.chN', { n: d.channels }) : '', d.mic && d.mic.desc && d.mic.desc !== 'null' && !d.tech ? d.mic.desc : ''].filter(Boolean).join(' · '));
    return ui.snav(t('in')) + '<div class="vcsh">' + (rec ? '<p class="ftr">' + t('in.recLock') + '</p>' : '') +
      '<div class="group">' + row('', 'other', t('auto'), !s.in, '') + S.devs.inputs.filter((d) => !d.tech).map(irow).join('') + '</div>' +
      (S.devs.inputs.some((d) => d.tech) ? '<div class="hdr">' + t('dev.techHdr') + '</div><div class="group">' + S.devs.inputs.filter((d) => d.tech).map(irow).join('') + '</div><p class="ftr">' + t('dev.techHint') + '</p>' : '') +
      (lav ? '<p class="ftr">' + t('lavHint') + '</p>' : curIn() && KIND[curIn().type] === 'bt' ? '<p class="ftr">' + t('btHint') + '</p>' : '<p class="ftr">' + t(engine().native ? 'devHint' : 'devHintWeb') + '</p>') +
      '<div class="hdr">' + t('in.how') + '</div><div class="group">' +
      '<div class="cell"><span class="grow">' + t('stereo') + '</span>' + sw('stereo', s.stereo) + '</div>' +
      (!s.stereo ? '<div class="cellcol"><span class="vc-lbl">' + t('pick') + '</span>' + ui.seg('vpick', [['mix', t('pick.mix')], ['l', t('pick.l')], ['r', t('pick.r')]], s.pick, t('pick')) + '</div>' : '') +
      '<div class="cell"><span class="grow"><span>' + t('raw') + '</span><span class="st l2">' + t('rawHint') + '</span></span>' + sw('raw', s.raw) + '</div></div>' +
      '<div class="hdr">' + t('in.mon') + '</div><div class="group">' +
      '<div class="cell"><span class="grow">' + t('live.on') + '</span>' + sw('live', s.live) + '</div>' +
      '<div class="cell"><span class="grow">' + t('live.hear') + '</span>' + sw('hear', s.hear) + '</div>' +
      '<button class="cell act" data-x2="outsheet"><span class="grow">' + t('out') + '</span><span class="l2">' + esc(curOuts().length ? curOuts().map(devName).join(' + ') : t('auto')) + '</span></button></div></div>';
  }, (el, sh) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-x2="outsheet"]')) { sh.close(); outSheet(); return; }
      const b = e.target.closest('[data-in]');
      if (b && !rec) { const s = st(); s.in = b.dataset.in || null; ctx.store.save(); S.err = null; S.inWarn = ''; S.liveDev = null; sh.update(); render(); if (S.phase === 'idle') liveRestart(); return; }
      const sg = e.target.closest('[data-seg] [data-v]');
      if (sg && sg.closest('[data-seg]').dataset.seg === 'vpick') { st().pick = sg.dataset.v; ctx.store.save(); S.proc = null; sh.update(); }
    });
    el.addEventListener('change', (e) => {
      const d = e.target.dataset, s = st();
      if (!['stereo', 'raw', 'live', 'hear'].includes(d.v)) return;
      s[d.v] = e.target.checked; ctx.store.save();
      if (d.v === 'hear') liveHear();
      else if (d.v === 'live') { if (s.live) liveStart(); else liveStop().then(render); }
      else if (S.phase === 'idle') liveRestart();
      if (d.v === 'stereo') sh.update();
      render();
    });
  });
}

/* ---------- пресеты ---------- */

const levelTxt = (l) => (l === 'off' ? t('lvl.off') : l === 'peak' ? t('lvl.peak') : String(l).replace('-', '−') + ' LUFS');
const presetName = (id) => (isUser(id) ? ((st().presets.find((p) => p.id === id) || {}).name || '—') : t('mode.' + id));
function presetsHTML() {
  const s = st(), dirty = isDirty(s), list = BUILTIN.concat(s.presets.map((p) => p.id));
  return '<div class="vc-pre" role="group" aria-label="' + esc(t('preset.title')) + '">' + list.map((id) => {
    const on = id === s.cur;
    return '<button type="button" class="vc-pc' + (on ? ' on' : '') + (on && dirty ? ' dirty' : '') + '" data-preset="' + esc(id) + '" aria-pressed="' + on + '"' + (on ? ' aria-label="' + esc(presetName(id) + (dirty ? ', ' + t('preset.changed') : '') + '. ' + t('preset.tapEdit')) + '"' : '') + '>' + esc(presetName(id)) + '</button>';
  }).join('') + '</div>';
}
function pickPreset(id) {
  const s = st();
  if (id === s.cur) { presetSheet(); return; } // касание выбранного — настроить его
  applyPreset(s, id); ctx.store.save(); liveFx(); S.proc = null; render();
}
// Шторка пресета: имя и действия сверху; ниже — «Голос» (обработка), «Эффекты» (общая панель приложения), «Файл».
// Правка звучит сразу (вход слушается; у записи — «С обработкой»); пресет меняется только по «Сохранить»
let ptab = 'voice';
function presetSheet() {
  const { ui } = ctx;
  let pm2 = null, b2 = null, naming = null; // naming: 'new' | 'rename'
  const panel = () => pm2 || (pm2 = ctx.fxPanel({ get: () => st().chain, set: (fx) => { st().chain = normalizeFx(fx); ctx.store.save(); liveFx(); S.proc = null; head(); syncRow(); return st().chain; } }));
  const v = () => st().voice;
  const sl = (k, min, max, step, label) => '<label class="cellcol vc-fx"><span class="vc-fxh"><span>' + label + '</span><b class="num" id="vs-' + k + '">' + VS[k](v().p[k]) + '</b></span>' +
    '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v().p[k] + '" data-vp="' + k + '" aria-label="' + esc(label) + '"></label>';
  const grp = (title, hint, body) => '<div class="hdr">' + title + '</div><div class="group">' + body + '</div>' + (hint ? '<p class="ftr">' + hint + '</p>' : '');
  const headHTML = () => {
    const s = st(), dirty = isDirty(s), user = isUser(s.cur);
    const nameInp = (val) => '<div class="cell vc-pname"><input class="inp" data-pname maxlength="40" value="' + esc(val) + '" placeholder="' + esc(t('preset.namePh')) + '" aria-label="' + esc(t('preset.name')) + '"><button class="link b" data-pa="' + naming + '">' + t('preset.ok') + '</button></div>';
    return '<div class="group"><div class="cell"><span class="grow"><b>' + esc(presetName(s.cur)) + '</b><span class="st l2">' + (dirty ? t('preset.changed') : user ? t('preset.mineH') : t('modeh.' + s.cur)) + '</span></span></div>' +
      (naming ? nameInp(naming === 'rename' ? presetName(s.cur) : '') :
        '<div class="cell vc-pacts">' + (user && dirty ? '<button class="link b" data-pa="save">' + t('preset.save') + '</button>' : '') +
        '<button class="link" data-pa="new">' + t('preset.saveAs') + '</button>' +
        (dirty ? '<button class="link" data-pa="revert">' + t('preset.revert') + '</button>' : '') +
        (user ? '<button class="link" data-pa="rename">' + t('preset.rename') + '</button><button class="link danger" data-pa="del">' + t('preset.del') + '</button>' : '') + '</div>') + '</div>';
  };
  const voiceHTML = () => '<div class="vcs">' +
    grp(t('vs.hp'), t('vsh.hp'), sl('hp', 0, 300, 5, t('vs.freq')) + '<div class="cellcol"><span class="vc-lbl">' + t('vs.slope') + '</span>' + ui.seg('vslope', [['12', '12 ' + t('dbo')], ['24', '24 ' + t('dbo')]], String(v().p.hpSlope), t('vs.slope')) + '</div>') +
    grp(t('vs.exp'), t('vsh.exp'), sl('expThr', -90, -20, 1, t('vs.thr')) + sl('expRatio', 1, 8, 0.1, t('vs.ratio')) + sl('expRange', 0, 60, 1, t('vs.range'))) +
    grp(t('vs.ds'), t('vsh.ds'), sl('dsAmt', 0, 1, 0.05, t('vs.amt')) + sl('dsFreq', 3000, 10000, 100, t('vs.freq'))) +
    grp(t('vs.tone'), t('vsh.tone'), sl('eqLow', -12, 12, 0.5, t('vs.low')) + sl('eqMud', -12, 12, 0.5, t('vs.mud')) + sl('eqPres', -12, 12, 0.5, t('vs.pres')) + sl('eqAir', -12, 12, 0.5, t('vs.air'))) +
    grp(t('vs.comp'), t('vsh.comp'), sl('compRatio', 1, 10, 0.1, t('vs.ratio')) + sl('compThr', -50, 0, 1, t('vs.thr')) + sl('compAtt', 0.5, 80, 0.5, t('vs.att')) + sl('compRel', 20, 800, 10, t('vs.rel'))) +
    grp(t('vs.lim'), t('vsh.lim'), '<div class="cell"><span class="grow">' + t('vs.limOn') + '</span><label class="sw"><input type="checkbox" data-vp="limOn"' + (v().p.limOn ? ' checked' : '') + ' aria-label="' + esc(t('vs.limOn')) + '"><i></i></label></div>' + sl('lim', -12, 0, 0.1, t('vs.ceil'))) +
    grp(t('vs.level'), t('vsh.level'), '<div class="cellcol">' + ui.seg('vlevel', LEVELS.map((l) => [String(l), l === 'off' ? t('lvl.off') : l === 'peak' ? t('lvl.peak') : String(l).replace('-', '−')]), String(v().level), t('vs.level')) + '</div>') +
    grp(t('vs.dn'), t('vsh.dn'), sl('denoise', 0, 1, 0.05, t('vs.amt'))) + '</div>';
  const fileHTML = () => {
    const f = st().fx, s = st();
    return '<div class="group"><label class="cellcol vc-fx"><span class="vc-fxh"><span>' + t('fx.gain') + '</span><b class="num" id="vfx-gain">' + fxTxt('gain', f.gain) + '</b></span><input type="range" min="-12" max="18" step="1" value="' + f.gain + '" data-fx="gain" aria-label="' + esc(t('fx.gain')) + '"></label>' +
      '<div class="cellcol"><span class="vc-lbl">' + t('bits') + '</span>' + ui.seg('vbits', [['16', '16 ' + t('bit')], ['24', '24 ' + t('bit')], ['32', '32 float']], String(s.bits), t('bits')) + '</div>' +
      '<div class="cell"><span class="grow"><span>' + t('keepRaw') + '</span><span class="st l2">' + t('keepRawHint') + '</span></span>' + sw('keepRaw', s.keepRaw) + '</div></div><p class="ftr">' + t('fxHint') + '</p>';
  };
  let sh = null;
  const head = () => { const h = sh && sh.el.querySelector('#vps-head'); if (h) h.innerHTML = headHTML(); };
  const syncRow = () => { const r = host && host.querySelector('.vc-pre'); if (r) { const tmp = document.createElement('div'); tmp.innerHTML = presetsHTML(); r.replaceWith(tmp.firstChild); } };
  const changed = () => { ctx.store.save(); liveFx(); S.proc = null; head(); syncRow(); };
  const full = () => { sh.update(); if (b2 && b2.mount) b2.mount(); render(); };
  sh = ui.sheet(() => ui.snav(t('preset.title')) + '<div class="vcsh"><div id="vps-head">' + headHTML() + '</div>' +
    '<div class="vc-ptabs">' + ui.seg('ptab', [['voice', t('ptab.voice')], ['fx', t('ptab.fx')], ['file', t('ptab.file')]], ptab, t('preset.title')) + '</div>' +
    (ptab === 'voice' ? voiceHTML() : ptab === 'fx' ? panel().html() : fileHTML()) + '</div>',
  (el, api) => {
    b2 = panel().bind(el, { update: full });
    const apply = (k, val, redraw) => {
      st().voice = editVoiceSet(st().voice, k, val); changed();
      const b = el.querySelector('#vs-' + k); if (b && VS[k]) b.textContent = VS[k](st().voice.p[k]);
      if (redraw) full();
    };
    el.addEventListener('input', (e) => {
      const d = e.target.dataset;
      if (d.vp && e.target.type === 'range') apply(d.vp, +e.target.value, false);
      else if (d.fx === 'gain') { st().fx.gain = +e.target.value; changed(); const lb = el.querySelector('#vfx-gain'); if (lb) lb.textContent = fxTxt('gain', +e.target.value); }
    });
    el.addEventListener('change', (e) => {
      const d = e.target.dataset;
      if (d.vp) apply(d.vp, e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : +e.target.value, true);
      else if (d.v === 'keepRaw') { st().keepRaw = e.target.checked; ctx.store.save(); }
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-pname]')) { e.preventDefault(); el.querySelector('[data-pa="' + naming + '"]')?.click(); } });
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-pa]');
      if (a) {
        const s = st(), k = a.dataset.pa, inp = el.querySelector('[data-pname]');
        if ((k === 'new' || k === 'rename') && !inp) { naming = k; head(); setTimeout(() => el.querySelector('[data-pname]')?.focus(), 30); return; }
        if (k === 'new') { const nm = inp.value.trim(); if (!nm) { inp.focus(); return; } saveAs(s, nm); naming = null; ctx.store.save(); ctx.ui.toast(t('preset.savedAs', { name: nm })); full(); return; }
        if (k === 'rename') { if (!inp.value.trim()) { inp.focus(); return; } rename(s, s.cur, inp.value); naming = null; ctx.store.save(); full(); return; }
        if (k === 'save') { overwrite(s); ctx.store.save(); ctx.ui.toast(t('preset.saved')); head(); syncRow(); return; }
        if (k === 'revert') { applyPreset(s, s.cur); changed(); full(); return; }
        if (k === 'del') { ctx.ui.confirm(t('preset.delTitle', { name: presetName(s.cur) }), '', t('preset.del')).then((ok) => { if (!ok) return; removePreset(s, s.cur); ctx.store.save(); full(); }); return; }
        return;
      }
      const b = e.target.closest('[data-seg] [data-v]');
      if (!b) return;
      const k = b.closest('[data-seg]').dataset.seg;
      if (k === 'ptab') { ptab = b.dataset.v; naming = null; full(); }
      else if (k === 'vslope') apply('hpSlope', +b.dataset.v, true);
      else if (k === 'vlevel') apply('level', b.dataset.v === 'off' || b.dataset.v === 'peak' ? b.dataset.v : +b.dataset.v, true);
      else if (k === 'vbits') { st().bits = +b.dataset.v; ctx.store.save(); full(); }
    });
    sh = api;
  }, { onClose: () => { pm2 = null; b2 = null; render(); } });
}
function fxTxt(k, v) {
  if (k === 'gate') return v <= -90 ? t('off') : v + ' ' + t('db');
  if (k === 'gain') return (v > 0 ? '+' : '') + v + ' ' + t('db');
  return v > 0 ? Math.round(v * 100) + '%' : t('off');
}
// Подписи значений настройки
const num = (v, d = 0) => (Math.round(v * 10 ** d) / 10 ** d).toString().replace('-', '−').replace('.', ',');
const VS = {
  hp: (v) => (v > 0 ? num(v) + ' ' + t('hz') : t('off')),
  expThr: (v) => (v <= -90 ? t('off') : num(v) + ' ' + t('db')), expRatio: (v) => '1:' + num(v, 1), expRange: (v) => num(v) + ' ' + t('db'),
  dsAmt: (v) => (v > 0 ? Math.round(v * 100) + '%' : t('off')), dsFreq: (v) => num(v / 1000, 1) + ' ' + t('khz'),
  eqLow: (v) => (v > 0 ? '+' : '') + num(v, 1) + ' ' + t('db'), compRatio: (v) => (v <= 1 ? t('off') : num(v, 1) + ':1'), compThr: (v) => num(v) + ' ' + t('db'),
  compAtt: (v) => num(v, v < 10 ? 1 : 0) + ' ' + t('ms'), compRel: (v) => num(v) + ' ' + t('ms'), lim: (v) => num(v, 1) + ' ' + t('db'),
  denoise: (v) => (v > 0 ? Math.round(v * 100) + '%' : t('off')),
};
VS.eqMud = VS.eqPres = VS.eqAir = VS.eqLow;
/* ---------- метки ---------- */

// Метка одним касанием: время записи (или прослушивания), без повторов ближе полсекунды. Метки записи сразу
// сохраняются в настройки (liveMarks) — сбой или закрытие окна их не теряет; к записи они переходят по её пути
function markAt(list, sec) {
  const tm = Math.max(0, Math.round(sec * 10) / 10);
  if (list.some((m) => Math.abs(m.t - tm) < 0.5)) return false;
  list.push({ t: tm, name: '' }); list.sort((a, b) => a.t - b.t);
  return true;
}
function addMark() {
  let ok = false, n = 0, tm = 0;
  if (S.phase === 'rec') {
    tm = S.sec; ok = markAt(S.marks, tm); n = S.marks.length;
    if (ok) { st().liveMarks = { t0: S.t0, marks: S.marks }; ctx.store.save(); }
  } else if (S.phase === 'take' && S.take && S.playing) {
    tm = (S.offset || 0) + (S.pos || 0); S.take.marks = S.take.marks || []; ok = markAt(S.take.marks, tm); n = S.take.marks.length;
    if (ok) { st().marksBy[S.take.path] = S.take.marks; ctx.store.save(); drawWave(); }
  } else { ctx.ui.toast(t('mark.when')); return; }
  if (!ok) return;
  try { navigator.vibrate && navigator.vibrate(12); } catch { /* нет */ }
  const b = host && host.querySelector('[data-x="mark"]');
  if (b) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); const c = b.querySelector('.vc-mn'); if (c) c.textContent = n; else b.insertAdjacentHTML('beforeend', '<span class="vc-mn num">' + n + '</span>'); }
  ctx.log('метка ' + n + ' на ' + fmt(tm));
}
// Метки для сохранённого файла: внутри выделения, от его начала
const marksIn = (marks, a, b) => (marks || []).filter((m) => m.t >= a && m.t <= b).map((m) => ({ ...m, t: Math.round((m.t - a) * 10) / 10 }));

/* ---------- ещё ---------- */

function moreSheet() {
  const { ui } = ctx;
  ui.sheet(() => ui.snav(t('more')) + '<div class="group">' +
    (S.phase === 'take' ? '<button class="cell act" data-m="preset">' + t('preset.title') + '</button>' : '') +
    '<button class="cell act" data-m="det">' + t('det.title') + '</button>' +
    '<button class="cell act" data-m="spec">' + t('det.full') + '</button>' +
    '<button class="cell act" data-m="mset">' + t('m.set') + '</button>' +
    (S.phase === 'take' ? '<button class="cell act danger" data-m="drop">' + t('drop') + '</button>' : '') + '</div>' +
    (S.phase === 'idle' ? keptHTML() : ''),
  (el, sh) => el.addEventListener('click', (e) => {
    const ko = e.target.closest('[data-kopen]'), kd = e.target.closest('[data-kdel]');
    if (ko) { sh.close(); openKept(ko.dataset.kopen); return; }
    if (kd) { ctx.ui.confirm(t('kept.delTitle'), '', t('discardYes')).then((ok) => { if (!ok) return; engine().remove(kd.dataset.kdel); delete st().marksBy[kd.dataset.kdel]; ctx.store.save(); S.kept = S.kept.filter((f) => f.path !== kd.dataset.kdel); sh.update(); }); return; }
    const b = e.target.closest('[data-m]');
    if (!b) return;
    const k = b.dataset.m;
    if (k === 'spec') { sh.close(); stopPlay(); ctx.openTool('spectrum'); }
    else if (k === 'mset') meterSheet();
    else if (k === 'det') { sh.close(); detailSheet(); }
    else if (k === 'preset') { sh.close(); presetSheet(); }
    else if (k === 'drop') { sh.close(); ctx.ui.confirm(t('discardTitle'), t('discardText'), t('discardYes')).then((ok) => ok && dropTake().then(render)); }
  }));
}

/* ---------- разметка ---------- */

const bottom = (inner) => '<div class="vc-bot">' + inner + '</div>';
const bt = (x, icon, label, cls = '', extra = '') => '<button class="vc-btn sec' + (cls ? ' ' + cls : '') + '" data-x="' + x + '" aria-label="' + esc(label) + '"' + extra + '>' + icon + '</button>';
const markBtn = (n, dis) => '<button class="vc-btn sec vc-mk" data-x="mark" aria-label="' + esc(t('mark.add')) + '"' + (dis ? ' disabled' : '') + '>' + I.mark + (n ? '<span class="vc-mn num">' + n + '</span>' : '') + '</button>';
function stageHTML() {
  const m = st().meter, s = st();
  const off = S.phase === 'idle' && !s.live;
  return '<div class="vc-stage" data-x="det" role="button" tabindex="0" aria-label="' + esc(t('det.title')) + '">' +
    (m.spec ? '<canvas id="vc-spec" class="vc-spec" aria-hidden="true"></canvas>' : '<div class="vc-spec"></div>') +
    (off ? '<p class="vc-off l2">' + t('live.off') + '</p>' : '') +
    '<div class="vc-time num' + (S.phase === 'rec' ? '' : ' dim') + '" id="vc-time">' + fmt(S.phase === 'rec' ? S.sec : 0) + '</div>' +
    (S.phase === 'rec' && S.paused ? '<p class="vc-state l2">' + t('paused') + '</p>' : '') +
    '<div class="vc-bar vcled" aria-hidden="true"><i id="vc-barr"></i><i id="vc-barp"></i><b id="vc-hold"></b></div></div>';
}
function html() {
  const err = S.err ? '<p class="ftr vc-err">' + t({ denied: 'micDenied', space: 'noSpace', noaudio: 'noAudio', nomic: 'micMissing' }[S.err] || 'micNone') + '</p>' : '';
  if (S.phase === 'rec') {
    if (!big()) return '<div class="vc-rec ' + size + '"><div class="vc-time num" id="vc-time">' + fmt(S.sec) + '</div><div class="vc-bar vcled mini" aria-hidden="true"><i id="vc-barr"></i><i id="vc-barp"></i><b id="vc-hold"></b></div>' +
      '<div class="vc-btns">' + markBtn(S.marks.length) + '<button class="vc-btn main stop" data-x="stop" aria-label="' + t('stop') + '">' + I.stop + '</button></div></div>';
    return inHTML() + stageHTML() + presetsHTML() +
      bottom(bt('pause', S.paused ? I.rec : I.pause, t(S.paused ? 'resume' : 'pause')) + markBtn(S.marks.length) +
        '<button class="vc-btn main stop" data-x="stop" aria-label="' + t('stop') + '">' + I.stop + '</button>' +
        bt('preset', I.tune, t('preset.title')) + bt('more', I.more, t('more')));
  }
  if (S.phase === 'take' && S.take) {
    const [a, b] = selSec();
    if (!big()) return '<div class="vc-rec ' + size + '"><div class="vc-time num">' + fmt(b - a) + '</div><div class="vc-btns"><button class="vc-btn sec" data-x="play" aria-label="' + t(S.playing ? 'stop' : 'play') + '">' + (S.playing ? I.stop : I.play) + '</button><button class="vc-btn main" data-x="rec" aria-label="' + t('record') + '">' + I.rec + '</button></div></div>';
    return '<div class="vc-take"><canvas id="vc-wave" class="vc-wave" aria-label="' + esc(t('waveAria')) + '"></canvas>' +
      '<div class="vc-sel num"><span>' + fmt(a) + '</span><b>' + fmt(b - a) + '</b><span>' + fmt(b) + '</span></div>' +
      '<div class="vc-tools">' + ctx.ui.seg('vmode', [['orig', t('orig')], ['proc', t('proc')]], S.mode, t('listen')) + '</div></div>' +
      presetsHTML() +
      bottom('<button class="vc-btn sec" data-x="play" aria-label="' + t(S.playing ? 'stop' : 'play') + '">' + (S.busy ? '…' : S.playing ? I.stop : I.play) + '</button>' +
        markBtn((S.take.marks || []).length, !S.playing) +
        '<button class="vc-btn main" data-x="rec" aria-label="' + t('newRec') + '">' + I.rec + '</button>' +
        '<button class="vc-btn sec' + (S.take.saved ? ' done' : '') + '" data-x="save"' + (S.busy ? ' disabled' : '') + ' aria-label="' + t(S.take.saved ? 'savedAgain' : 'save') + '">' + I.save + '</button>' +
        bt('more', I.more, t('more')));
  }
  if (!big()) return '<div class="vc-rec ' + size + '"><div class="vc-btns"><button class="vc-btn main" data-x="rec" aria-label="' + t('record') + '">' + I.rec + '</button></div>' + err + '</div>';
  return inHTML() + err + stageHTML() + presetsHTML() +
    bottom(bt('insheet', I.inp, t('in')) + markBtn(0, true) +
      '<button class="vc-btn main" data-x="rec" aria-label="' + t('record') + '">' + I.rec + '</button>' +
      bt('preset', I.tune, t('preset.title')) + bt('more', I.more, t('more')));
}

function keptHTML() {
  if (!S.kept.length) return '';
  const d = (ms) => { const x = new Date(ms), p = (n) => String(n).padStart(2, '0'); return p(x.getDate()) + '.' + p(x.getMonth() + 1) + ' ' + p(x.getHours()) + ':' + p(x.getMinutes()); };
  return '<div class="hdr">' + t('kept.title') + '</div><div class="group">' + S.kept.slice(0, 8).map((f) =>
    '<div class="cell"><span class="grow"><span class="num">' + d(f.at) + ' · ' + (f.size / 1048576).toFixed(1) + ' ' + t('mb') + '</span>' + (f.saved ? '<span class="st l2">' + t('kept.saved') + '</span>' : f.cut ? '<span class="st l2">' + t('kept.cut') + '</span>' : '') + '</span>' +
    '<button class="link" data-kopen="' + esc(f.path) + '">' + t('kept.open') + '</button>' +
    '<button class="link danger" data-kdel="' + esc(f.path) + '" aria-label="' + esc(t('kept.del')) + '">' + t('kept.del') + '</button></div>').join('') +
    '</div><p class="ftr">' + t('kept.hint') + '</p>';
}

function render() {
  if (!host) return;
  host.innerHTML = '<div class="voice ' + size + (big() ? ' big' : '') + '">' + html() + '</div>';
  // вход до записи слушается только в ожидании и в большом окне (ошибка — до явного нажатия)
  if (S.phase === 'idle' && big() && st().live && !L && !S.err) liveStart();
  else if (L && (S.phase !== 'idle' || !big())) liveStop();
  drawWave();
}

function drawWave() {
  const cv = host && host.querySelector('#vc-wave');
  if (!cv || !S.take) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d'), cs = getComputedStyle(host), tint = cs.getPropertyValue('--tint').trim() || '#946B3E', l3 = cs.getPropertyValue('--l3').trim() || '#ccc', ink = cs.getPropertyValue('--ink').trim();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const p = S.take.peaks, n = p.length, bw = W / n, [a, b] = S.sel;
  for (let i = 0; i < n; i++) {
    const x = i * bw, f = i / n, h = Math.max(1, p[i] * (H - 8));
    g.fillStyle = f >= a && f <= b ? tint : l3;
    g.fillRect(x, (H - h) / 2, Math.max(1, bw - 0.6), h);
  }
  // метки: тонкая линия и номер сверху
  g.font = '600 10px system-ui, sans-serif'; g.textAlign = 'center';
  (S.take.marks || []).forEach((m, i) => { const x = (m.t / S.take.sec) * W; g.fillStyle = ink; g.globalAlpha = 0.55; g.fillRect(x - 0.5, 12, 1, H - 12); g.globalAlpha = 1; g.fillText(String(i + 1), Math.max(6, Math.min(W - 6, x)), 10); });
  // ручки обрезки
  g.fillStyle = tint;
  [a, b].forEach((f) => { const x = f * W; g.fillRect(x - 1.5, 0, 3, H); g.beginPath(); g.arc(x, H / 2, 7, 0, 2 * Math.PI); g.fill(); });
  // где играет
  if (S.playing) { const x = ((S.offset + S.pos) / S.take.sec) * W; g.fillStyle = ink; g.fillRect(x - 1, 0, 2, H); }
}

// Обновление без перерисовки: время и уровень при записи, позиция при воспроизведении
function onLevel(e) {
  if (e.rate) M.rate = e.rate;
  if (S.phase !== 'rec' || !host) return;
  meterUpdate(e);
  S.sec = e.sec; S.paused = !!e.paused;
  const tm = host.querySelector('#vc-time'); if (tm) tm.textContent = fmt(e.sec);
}
function onPos(e) {
  if (!S.playing || !S.take) return;
  S.pos = S.mode === 'orig' ? e.sec - S.offset : e.sec;
  if (S.mode === 'orig' && e.sec >= selSec()[1]) { stopPlay().then(render); return; }
  drawWave();
}
function onEnd() { if (S.playing) { S.playing = false; render(); } }
// Вход пропал во время записи: переключились на встроенный микрофон — запись идёт дальше, на плашке видно, откуда
// теперь пишется; иначе (или кончилось место) — бережно остановить, всё записанное остаётся
function onLost(e) {
  if (S.phase !== 'rec') return;
  ctx.log('запись: вход пропал (' + (e && e.reason) + (e && e.switched ? ', дальше со встроенного микрофона' : e && e.soft ? '' : ', остановлено') + ')', 'w');
  if (e && e.soft) { S.inWarn = t('lost.sleep'); render(); return; }
  if (e && e.switched) { S.recDev = e.dev || null; S.inWarn = t('lost.switched'); ctx.ui.toast(t('lost.switch')); render(); return; }
  ctx.ui.toast(t(e && e.reason === 'space' ? 'lost.space' : 'lost.stop'));
  stopRec();
}
// Android сменил вход сам (или не послушался выбора) — показать фактический
function onRoute(e) {
  if (S.phase !== 'rec' || !e || !e.dev) return;
  S.recDev = e.dev; ctx.log('запись: звук идёт с ' + e.dev.type + ' «' + e.dev.name + '»', 'w');
  const row = host && host.querySelector('.vc-inrow');
  if (row) { const tmp = document.createElement('div'); tmp.innerHTML = inHTML(); row.replaceWith(tmp.firstChild); }
}

/* ---------- модуль ---------- */

export default {
  ...meta,
  status: (c) => c.t(S.phase === 'rec' ? 'st.rec' : S.take && !S.take.saved ? 'st.take' : 'st.idle'),
  mount(el, c, sz = 'full') {
    host = el; ctx = c; size = sz;
    S.mode = c.store.get('vmode', S.mode);
    const E = engine();
    offs = [E.on('level', onLevel), E.on('pos', onPos), E.on('end', onEnd), E.on('devices', loadDevices), E.on('lost', onLost), E.on('route', onRoute)];
    onClick = (e) => {
      const sg = e.target.closest('[data-seg] [data-v]');
      if (sg) {
        const k = sg.closest('[data-seg]').dataset.seg;
        if (k === 'vmode') { stopPlay(); S.mode = sg.dataset.v; ctx.store.set('vmode', S.mode); render(); } // как слушать — помнится
        return;
      }
      const pr = e.target.closest('[data-preset]');
      if (pr) { pickPreset(pr.dataset.preset); return; }
      const x = e.target.closest('[data-x]');
      if (!x || (S.busy && x.dataset.x !== 'lamp')) return;
      const a = x.dataset.x;
      if (a === 'rec') startRec();
      else if (a === 'stop') stopRec();
      else if (a === 'pause') { S.paused = !S.paused; engine().pause(S.paused); render(); }
      else if (a === 'play') play();
      else if (a === 'save') save();
      else if (a === 'mark') addMark();
      else if (a === 'insheet') inSheet();
      else if (a === 'outsheet') outSheet();
      else if (a === 'preset') presetSheet();
      else if (a === 'more') moreSheet();
      else if (a === 'det') { if (S.phase === 'idle' && !st().live) { st().live = true; ctx.store.save(); liveStart(); return; } detailSheet(); }
      else if (a === 'lamp') { M.clip = false; M.hold = -120; M.lamp = lampOf(performance.now()); const l = host.querySelector('#vc-lamp'); if (l) { l.className = 'vc-lamp ' + M.lamp; l.querySelector('em').textContent = t('lamp.' + M.lamp); } }
    };
    onChange = () => {};
    // ручки обрезки: перетаскивание ближайшей
    onPtr = (e) => {
      const cv = e.target.closest('#vc-wave');
      if (!cv || !S.take) return;
      stopPlay();
      const r = cv.getBoundingClientRect(), f = (ev) => Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      const k = Math.abs(f(e) - S.sel[0]) < Math.abs(f(e) - S.sel[1]) ? 0 : 1;
      const move = (ev) => { const v = f(ev); S.sel[k] = k ? Math.max(v, S.sel[0] + 0.01) : Math.min(v, S.sel[1] - 0.01); drawWave(); const sel = host.querySelector('.vc-sel'); if (sel) { const [a, b] = selSec(); sel.innerHTML = '<span>' + fmt(a) + '</span><b>' + fmt(b - a) + '</b><span>' + fmt(b) + '</span>'; } };
      const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
      move(e);
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    };
    // клавиатура: окно с цифрами по Enter/пробелу на полотне
    onInput = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.vc-stage')) { e.preventDefault(); e.target.click(); } };
    host.addEventListener('click', onClick);
    host.addEventListener('pointerdown', onPtr);
    host.addEventListener('keydown', onInput);
    render();
    loadDevices();
    loadKept();
  },
  resize(sz) { size = sz; render(); },
  unmount() {
    offs.forEach((f) => f()); offs = [];
    if (host) { host.removeEventListener('click', onClick); host.removeEventListener('pointerdown', onPtr); host.removeEventListener('keydown', onInput); }
    liveStop();
    stopPlay();
    // запись не прерывается молча: остановить и оставить дубль до следующего открытия
    if (S.phase === 'rec') stopRec();
    host = null;
  },
};
