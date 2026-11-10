// Лупер: петля из слоёв с микрофона. Одна большая кнопка — всё по кругу: запись → петля → наложение → петля;
// удержание кнопки — отменить последний слой. По метроному — отсчёт такта и длина петли в целых тактах.
// Четыре петли (слота), у каждой свои слои; громкость и тишина слоя; сохранение сведения в медиатеку.
// Педаль Bluetooth (клавиши: пробел, PageDown — кнопка; PageUp — стоп; стрелки — отмена). Движок — src/audio/looper.js.
import './looper.css';
import ru from './i18n/ru.json';
import uz from './i18n/uz.json';
import en from './i18n/en.json';
import el from './i18n/el.json';
import { createLooper, SLOTS, MAX_SEC } from '../../audio/looper.js';
import { encodeWav } from '../../audio/voicefx.js';
import { onHold, holdMenu, holdRepeat } from '../../ui/hold.js';
import { swipe } from '../../ui/gestures.js';
import { createParts, BARS, PIECES, PLACES } from './parts.js';
import { after, cancel } from '../../audio/clock.js';

import meta, { ICON } from './meta.js';
const I = {
  rec: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" style="fill:currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2" style="fill:currentColor"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M8 7H4v4"/><path d="M4.5 11A8 8 0 1 1 7 18"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M12 4v11M8 11l4 4 4-4M5 19h14"/></svg>',
  metro: '<svg viewBox="0 0 24 24"><path d="M9 4h6l3 16H6zM12 17V8M12 8l5-3"/></svg>',
  ear: '<svg viewBox="0 0 24 24"><path d="M6 10a6 6 0 0 1 12 0c0 3-2 4-2 7a3 3 0 0 1-6 0"/><path d="M9.5 10a2.5 2.5 0 0 1 5 0"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  reels: '<svg viewBox="0 0 24 24"><circle cx="7.5" cy="12" r="4"/><circle cx="16.5" cy="12" r="4"/><path d="M7.5 16h9"/></svg>',
  ring: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" style="fill:currentColor"/></svg>',
  tracks: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/><path d="M8 5v4M13 10v4M17 15v4" style="stroke-width:3"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg>',
  parts: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="3.5" rx="1.5"/><rect x="4" y="10.3" width="10" height="3.5" rx="1.5"/><rect x="4" y="15.5" width="13" height="3.5" rx="1.5"/></svg>',
  drums: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="7.5" ry="3"/><path d="M4.5 9v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V9"/></svg>',
  notes: '<svg viewBox="0 0 24 24"><path d="M9 17V6l10-2v11"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></svg>',
  chords: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 9h7M8.5 12h7M8.5 15h4"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M7 3.5h7l4 4V20.5H7z"/><path d="M14 3.5V8h4"/><path d="M10 16v-4l4-1v4" style="stroke-width:1.6"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M5 19l1-4 9.5-9.5 3 3L9 18z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/></svg>',
  keys: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M8 5v9M12 5v9M16 5v9M8 14v5M12 14v5M16 14v5"/></svg>',
};
const REELS = 4, NUDGE = 1; // катушек на экране; шаг точной донастройки сдвига, мс (удержание — автоповтор)
const VIEWS = ['ring', 'reels', 'parts']; // «Дорожки» (до 30.10.2026) заменены «Партиями» — студия стала частью лупера
const R = 46, C = 2 * Math.PI * R;

let host = null, ctx = null, size = 'full', lp = null, raf = 0, offs = [], arm = null, offBeat = null, parts = null;
const peaksCache = new Map(); // слой (номер:версия:точек) → огибающая
const curView = () => (size === 'strip' ? 'ring' : st().view === 'tracks' ? 'parts' : VIEWS.includes(st().view) ? st().view : 'ring');
const reelsView = () => curView() === 'reels';
const partsView = () => curView() === 'parts';
const tracksView = () => false; // прежний вид «Дорожки» — теперь «Партии»
let live = null, unswipe = null, frame = 0, followN = 0; // ведение слоя пальцем: { i, shift } — живой показ до отпускания
const st = () => ctx.store.all();
const metro = () => ctx.audio.metro;
const barSec = () => { const m = metro().cfg; return (60 / m.bpm) * Math.max(1, m.num); };
const withMetro = () => !!st().metro;

/* ---------- разметка ---------- */

const fmt = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + String(x).padStart(2, '0'); };

function view() {
  const { t, ui } = ctx, S = lp ? lp.state : { state: 'idle', layers: [], slots: [0, 0, 0, 0], slot: 0, len: 0, pos: 0 }, s = S.state;
  const small = size === 'quarter' || size === 'strip', lab = arm ? 'cancel' : s === 'idle' && S.len ? 'resume' : s === 'dub' && S.replace ? 'replace' : s; // пауза: петля есть — «Играть»; замена — своя подпись
  const main = '<button class="lpbtn ' + s + (arm ? ' arm' : '') + '" data-x="main" aria-label="' + ui.esc(t('do.' + lab)) + '">' +
    '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="lptrack" cx="50" cy="50" r="' + R + '"/><circle class="lpring" cx="50" cy="50" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - (S.pos || 0))).toFixed(1) + '"/></svg>' +
    '<span class="lpic">' + (arm ? '<b class="lpcount">' + (arm.n + 1) + '</b>' : lab === 'resume' ? ui.icons.play : s === 'idle' ? I.rec : s === 'rec' ? I.stop : s === 'play' ? I.plus : I.stop) + '</span>' +
    '<span class="lplab">' + ui.esc(t('do.' + lab)) + '</span></button>';
  const time = '<div class="lptime num">' + (s === 'rec' ? fmt(S.recSec) + ' / ' + fmt(MAX_SEC) : S.len ? fmt(S.len) + (withMetro() ? ' · ' + ctx.tn('bars', Math.round(S.len / barSec())) : '') : '') + '</div>';
  if (size === 'strip') return '<div class="lpstrip">' + main + time + (S.layers.length ? '<span class="lpn num">' + ctx.tn('layers', S.layers.length) + '</span>' : '') + '</div>';
  const layers = S.layers.length ? '<div class="lplayers">' + S.layers.map((L, i) => '<div class="lplayer' + (L.mute ? ' muted' : '') + '" data-li="' + i + '"><button class="lpm" data-x="mute" data-i="' + i + '" aria-label="' + ui.esc(t(L.mute ? 'unmute' : 'mute')) + '" aria-pressed="' + L.mute + '">' + (L.mute ? I.mute : I.vol) + '</button>' +
    '<span class="lpnum num">' + (i + 1) + '</span><input type="range" class="lpvol" min="0" max="1.5" step="0.01" value="' + L.gain + '" data-vol="' + i + '" aria-label="' + ui.esc(t('layerVol', { n: i + 1 })) + '"></div>').join('') + '</div>'
    : '<div class="lphint l2">' + ui.esc(t(small ? 'hintShort' : s === 'idle' ? 'hint' : 'hintMore')) + '</div>';
  const slots = '<div class="lpslots" role="group" aria-label="' + ui.esc(t('loops')) + '">' + Array.from({ length: SLOTS }, (_, i) => '<button class="lpslot' + (i === S.slot ? ' on' : '') + (S.slots[i] ? ' has' : '') + '" data-x="slot" data-i="' + i + '" aria-pressed="' + (i === S.slot) + '" aria-label="' + ui.esc(t('loopN', { n: i + 1 })) + '">' + (i + 1) + '</button>').join('') + '</div>';
  const bar = '<div class="lpbar">' +
    ui.icb('data-x="view"', reelsView() ? I.parts : partsView() ? I.ring : I.reels, t(reelsView() ? 'viewParts' : partsView() ? 'viewRing' : 'viewReels'), 'sm') +
    ui.icb('data-x="metro"', I.metro, t('metro'), 'sm' + (withMetro() ? ' on' : '')) +
    ui.icb('data-x="mon"', I.ear, t('mon'), 'sm' + (S.mon ? ' on' : '')) +
    ui.icb('data-x="undo"', I.undo, t('undo'), 'sm') +
    ui.icb('data-x="stop"', I.stop, t('stop'), 'sm') +
    ui.icb('data-x="save"', I.save, t('save'), 'sm') + '</div>';
  // точная донастройка: ‹ ±1 мс › с автоповтором при удержании; число — сдвиг, касание — в ноль
  const nudge = (L, i, cls = '') => '<span class="lpnudge' + cls + '">' + ui.icb('data-nd="-' + NUDGE + '" data-i="' + i + '"', I.left, t('earlier1'), 'sm plain') +
    '<button class="lpshv num" data-nd="0" data-i="' + i + '" aria-label="' + ui.esc(t('shiftReset')) + '">' + (L.shift > 0 ? '+' : '') + L.shift + '</button>' + ui.icb('data-nd="' + NUDGE + '" data-i="' + i + '"', I.right, t('later1'), 'sm plain') + '</span>';
  if (reelsView()) {
    // «Катушки»: четыре кругляша с волной по кругу, крутятся при игре. Вести кругляш — сдвиг слоя, касание — окно слоя
    const reels = '<div class="lpreels">' + Array.from({ length: REELS }, (_, i) => { const L = S.layers[i]; return '<div class="lpreelw"><div class="lpreel' + (L ? (L.mute ? ' muted' : '') : ' lpnone') + '" data-li="' + i + '"' + (L ? ' data-x="edit" data-i="' + i + '" data-drag="' + i + '" role="button" tabindex="0" aria-label="' + ui.esc(t('layerDrag', { n: i + 1 })) + '"' : '') + '><canvas class="lpreelcv"></canvas><span class="lpreeln num">' + (i + 1) + '</span><span class="lpbadge num" hidden></span></div>' + (L ? nudge(L, i) : '') + '</div>'; }).join('') + '</div>' +
      (S.layers.length ? '' : '<div class="lphint l2">' + ui.esc(t(s === 'idle' ? 'hint' : 'hintMore')) + '</div>');
    return '<div class="lpwrap reels ' + size + '">' + reels + '<div class="lpmain row">' + main + time + slots + '</div>' + bar + '</div>';
  }
  if (partsView()) return partsHTML(S, main, time, slots, bar);
  if (tracksView()) {
    // «Дорожки»: четыре слоя волной слева направо во всё окно. Вести дорожку — сдвиг, касание — окно слоя, стрелки — по миллисекунде
    const lanes = '<div class="lplanes big">' + Array.from({ length: REELS }, (_, i) => { const L = S.layers[i]; return '<div class="lplane' + (L ? (L.mute ? ' muted' : '') : ' lpnone') + '" data-li="' + i + '"><span class="lpnum num">' + (i + 1) + '</span><div class="lplanebox"><canvas class="lplanecv"' + (L ? ' data-x="edit" data-i="' + i + '" data-drag="' + i + '" role="button" tabindex="0" aria-label="' + ui.esc(t('layerDrag', { n: i + 1 })) + '"' : '') + '></canvas><span class="lpbadge num" hidden></span></div>' + (L ? nudge(L, i, ' col') : '') + '</div>'; }).join('') +
      (S.layers.length ? '' : '<div class="lphint l2">' + ui.esc(t(s === 'idle' ? 'hint' : 'hintMore')) + '</div>') + '</div>';
    return '<div class="lpwrap tracks ' + size + '">' + lanes + '<div class="lpmain row">' + main + time + slots + '</div>' + bar + '</div>';
  }
  return '<div class="lpwrap ' + size + '"><div class="lpmain">' + main + time + '</div>' + layers + slots + bar + '</div>';
}

/* ---------- вид «Партии»: партии студии и слои одной петли ---------- */

// Строка: значок вида, название, рисунок (ноты или волна) с ходом петли, громкость. Касание — вкл/выкл с начала такта
function partsHTML(S, main, time, slots, bar) {
  const { t, ui } = ctx, P = parts, p = P.proj(), m = metro().cfg;
  const tempo = (p && p.spb ? Math.round(600 / p.spb) / 10 : m.bpm) + ' · ' + m.num + '/' + m.den;
  const row = (cls, attrs, ic, name, cv, vol) => '<div class="lprow' + cls + '" ' + attrs + ' role="button" tabindex="0"><span class="lpric">' + ic + '</span><span class="lprn"><b>' + ui.esc(name) + '</b></span>' + cv + vol + '</div>';
  const rows = [];
  (p ? p.tracks : []).forEach((tr) => rows.push(row((tr.mute ? ' off' : '') + (P.pending(tr.id) ? ' pend' : ''), 'data-tr="' + tr.id + '" style="--c:' + tr.color + '" aria-pressed="' + !tr.mute + '" aria-label="' + ui.esc(t('rowTap', { name: P.name(tr) })) + '"',
    I[tr.kind] || I.notes, P.name(tr), '<canvas class="lprowcv" data-pv="t" data-id="' + tr.id + '"></canvas>',
    '<input type="range" class="lprvol" min="0" max="1.5" step="0.01" value="' + (tr.vol == null ? 1 : tr.vol) + '" data-tvol="' + tr.id + '" aria-label="' + ui.esc(t('partVol', { name: P.name(tr) })) + '">')));
  S.layers.forEach((L, i) => rows.push(row(' layer' + (L.mute ? ' off' : '') + (L.pend ? ' pend' : ''), 'data-li="' + i + '" aria-pressed="' + !L.mute + '" aria-label="' + ui.esc(t('rowTap', { name: L.name || t('layerN', { n: i + 1 }) })) + '"',
    L.src === 'file' ? I.file : I.mic, L.name || t('layerN', { n: i + 1 }),
    // дубли: номер поверх волны — касание или смахивание по строке — следующий дубль (сравнить на ходу)
    '<span class="lpcvw"><canvas class="lprowcv lplanecv" data-pv="l" data-i="' + i + '"></canvas>' + (L.takes > 1 ? '<button class="lptkb num" data-tk="1" data-i="' + i + '" aria-label="' + ui.esc(t('takeNext') + ' · ' + (L.take + 1) + '/' + L.takes) + '">' + (L.take + 1) + '/' + L.takes + '</button>' : '') + '</span>',
    '<input type="range" class="lprvol" min="0" max="1.5" step="0.01" value="' + L.gain + '" data-vol="' + i + '" aria-label="' + ui.esc(t('layerVol', { n: i + 1 })) + '">')));
  const top = '<div class="lpptop">' + ui.seg('lpbars', [...BARS.map((b) => [String(b), String(b)]), ['rec', t('lenRec')]], P.byRec() ? 'rec' : String(P.loopBars()), t('loopLen')) +
    (P.cap ? '<button class="lpcap' + (P.cap.wait ? ' wait' : '') + '" data-x="capstop" aria-label="' + ui.esc(t('capStop')) + '">● ' + ui.esc(t(P.cap.wait ? 'capWait' : 'capRec')) + '</button>' : '<span class="lptempo num" title="' + ui.esc(t('tempoHint')) + '">' + ui.esc(tempo) + '</span>') + ui.icb('data-x="padd"', I.plus, t('add'), 'sm') + '</div>';
  const list = rows.length ? '<div class="lprows">' + rows.join('') + '</div>' : '<div class="lprows empty"><div class="lphint l2">' + ui.esc(t('partsHint')) + '</div></div>';
  return '<div class="lpwrap parts ' + size + '">' + top + list + '<div class="lpmain row">' + main + time + slots + '</div>' + bar + '</div>';
}
// Рисунок партии: ноты (или удары по рядам) в долях петли — готовой картинкой, в кадре — копия и линия хода
function drawPart(cv, tr, pos) {
  const [w, h] = fit(cv), g = cv.getContext('2d'), C = colors(), p = parts.proj();
  if (!p) return;
  const beats = (p.region && p.region.b) || p.num * 4;
  const img = staticImg('p:' + tr.id + ':' + p.updatedAt + ':' + w + ':' + h + ':' + !!tr.mute, w, h, (q) => {
    const ns = parts.notesOf(tr); if (!ns.length) return;
    const drums = tr.kind === 'drums', lanes = ['kick', 'snare', 'hat', 'ohat', 'clap'];
    let lo = 127, hi = 0; if (!drums) ns.forEach((n) => { lo = Math.min(lo, n.m); hi = Math.max(hi, n.m); });
    const rows = drums ? lanes.length : Math.max(6, hi - lo + 1), rh = h / rows;
    q.fillStyle = tr.color || C.tint; q.globalAlpha = tr.mute ? 0.3 : 0.9;
    ns.forEach((n) => { const r = drums ? Math.max(0, lanes.indexOf(n.drum)) : hi - n.m + Math.floor((rows - (hi - lo + 1)) / 2); const x = (n.t / beats) * w; q.fillRect(x, r * rh + rh * 0.15, Math.max(2, (n.d / beats) * w - 1), Math.max(2, rh * 0.7)); });
  });
  g.clearRect(0, 0, w, h); g.drawImage(img, 0, 0);
  if (pos >= 0) { g.fillStyle = C.ink; g.fillRect(pos * w - 1, 0, 2, h); }
}

/* ---------- катушки и дорожки: рисунок ---------- */

const peaks = (i, L, n) => { const k = i + ':' + L.ver + ':' + n; let p = peaksCache.get(k); if (!p) { p = lp.peaks(i, n); if (p) { if (peaksCache.size > 64) peaksCache.clear(); peaksCache.set(k, p); } } return p; };
// Размер холста: getBoundingClientRect на каждом кадре для каждого слоя заставлял браузер пересчитывать раскладку — измеряем раз в 30 кадров
const fitCache = new WeakMap();
const fit = (cv) => {
  let f = fitCache.get(cv);
  if (!f || ++f.n >= 30) { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); f = { n: 0, w: Math.max(1, Math.round(r.width * d)), h: Math.max(1, Math.round(r.height * d)), d }; fitCache.set(cv, f); }
  if (cv.width !== f.w || cv.height !== f.h) { cv.width = f.w; cv.height = f.h; }
  return [f.w, f.h, f.d];
};
// Готовая картинка волны слоя (кольцо или полоса) — рисуется один раз на версию слоя и размер, в кадре только копируется:
// четыре слоя по 96 отрезков на каждом кадре лагали на телефоне
const imgCache = new Map();
function staticImg(key, w, h, draw) {
  let e = imgCache.get(key);
  if (!e) { if (imgCache.size > 32) imgCache.clear(); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')); e = cv; imgCache.set(key, e); }
  return e;
}
let css = null;
const colors = () => css || (css = (() => { const s = getComputedStyle(host); return { tint: s.getPropertyValue('--tint').trim(), fill: s.getPropertyValue('--fill').trim(), ink: s.getPropertyValue('--ink').trim(), l2: s.getPropertyValue('--l2').trim(), red: '#D9534F' }; })());

// Катушка: кольцо волны (отрезки по кругу) крутится с петлёй, головка — неподвижная метка сверху
// d — живой сдвиг при ведении (мс относительно текущего): раньше → плёнка к головке
const liveDelta = (i, L, S) => (live && live.i === i ? (live.shift - L.shift) / Math.max(1, S.len * 1000) : 0);
function drawReel(cv, i, L, pos, S) {
  const [w, h] = fit(cv), g = cv.getContext('2d'), C = colors(), cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, r0 = R * 0.5, r1 = R * 0.92;
  g.clearRect(0, 0, w, h);
  g.beginPath(); g.arc(cx, cy, R * 0.98, 0, Math.PI * 2); g.fillStyle = C.fill; g.fill();
  if (!L) { g.beginPath(); g.arc(cx, cy, r0, 0, Math.PI * 2); g.strokeStyle = C.l2; g.globalAlpha = 0.35; g.setLineDash([4, 6]); g.lineWidth = 2; g.stroke(); g.setLineDash([]); g.globalAlpha = 1; return; }
  const N = 96, rot = -(pos + liveDelta(i, L, S)) * Math.PI * 2; // плёнка идёт мимо головки
  const color = L.mute ? C.l2 : S.state === 'dub' && i === S.layers.length - 1 ? C.red : C.tint;
  const ring = staticImg('r:' + i + ':' + L.ver + ':' + w + ':' + h + ':' + color + ':' + !!L.mute, w, h, (q) => {
    const pk = peaks(i, L, N);
    q.lineWidth = Math.max(1.5, (Math.PI * 2 * r0) / N * 0.6); q.lineCap = 'round'; q.strokeStyle = color; q.globalAlpha = L.mute ? 0.35 : 0.9;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2 - Math.PI / 2, len = r0 + (r1 - r0) * (0.08 + 0.92 * (pk ? pk[k] : 0));
      q.beginPath(); q.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); q.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); q.stroke();
    }
  });
  g.save(); g.translate(cx, cy); g.rotate(rot); g.drawImage(ring, -cx, -cy); g.restore();
  // ось и головка
  g.beginPath(); g.arc(cx, cy, r0 * 0.5, 0, Math.PI * 2); g.fillStyle = C.ink; g.globalAlpha = L.mute ? 0.25 : 0.85; g.fill(); g.globalAlpha = 1;
  g.beginPath(); g.moveTo(cx - 5, cy - R); g.lineTo(cx + 5, cy - R); g.lineTo(cx, cy - R + 9); g.closePath(); g.fillStyle = C.ink; g.fill();
}
// Дорожка: волна слева направо, ход — линия
function drawLane(cv, i, L, pos, S) {
  const [w, h] = fit(cv), g = cv.getContext('2d'), C = colors(), N = Math.max(24, Math.floor(w / 3)), off = -liveDelta(i, L, S) * w;
  g.clearRect(0, 0, w, h);
  const bars = staticImg('l:' + i + ':' + L.ver + ':' + w + ':' + h + ':' + !!L.mute, w, h, (q) => {
    const pk = peaks(i, L, N), bw = w / N;
    q.fillStyle = L.mute ? C.l2 : C.tint; q.globalAlpha = L.mute ? 0.35 : 0.85;
    for (let k = 0; k < N; k++) { const v = pk ? pk[k] : 0, bh = Math.max(2, v * (h - 4)); q.fillRect(k * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh); }
  });
  if (off) { const o = ((off % w) + w) % w; g.drawImage(bars, o, 0); g.drawImage(bars, o - w, 0); } else g.drawImage(bars, 0, 0); // сдвиг при ведении — картинка по кругу
  if (pos >= 0) { g.fillStyle = C.ink; g.fillRect(pos * w - 1, 0, 2, h); }
}
function drawAll() {
  const S = lp.state, pos = S.state === 'play' || S.state === 'dub' ? S.pos : -1;
  host.querySelectorAll('.lpreel').forEach((el, i) => drawReel(el.querySelector('canvas'), i, S.layers[i], Math.max(0, pos), S));
  host.querySelectorAll('.lplanecv').forEach((cv) => { const i = +cv.dataset.i; if (S.layers[i]) drawLane(cv, i, S.layers[i], pos, S); });
  if (parts) { const p = parts.proj(); host.querySelectorAll('.lprowcv[data-pv="t"]').forEach((cv) => { const tr = p && p.tracks.find((x) => x.id === cv.dataset.id); if (tr) drawPart(cv, tr, pos); }); }
}

function render() {
  if (!host) return;
  const act = document.activeElement, keep = act && host.contains(act) && act.dataset.vol;
  host.innerHTML = view();
  if (keep) { const r = host.querySelector('[data-vol="' + keep + '"]'); if (r) r.focus(); }
  if (partsView()) drawAll(); // на паузе — один раз (ход рисует tick)
  tick();
}
// кольцо хода петли — без перерисовки
function tick() {
  cancelAnimationFrame(raf);
  if (!host || !lp) return;
  const S = lp.state, ring = host.querySelector('.lpring'), tm = host.querySelector('.lptime');
  if (ring) ring.setAttribute('stroke-dashoffset', (C * (1 - S.pos)).toFixed(1));
  // лампочка темпа: вспышка кольца на каждую долю петли, первая доля такта — ярче (держать темп глазами)
  const btn = host.querySelector('.lpbtn');
  if (btn) { let v = '0'; if ((S.state === 'play' || S.state === 'dub') && parts) { const b = parts.beat(); if (b) { const x = (b.now - b.t0) / b.spb, f = x - Math.floor(x); if (f >= 0 && f < 0.14) v = ((Math.floor(x) % b.num) + b.num) % b.num === 0 ? '2' : '1'; } } if (btn.dataset.beat !== v) btn.dataset.beat = v; }
  if (tm && S.state === 'rec') tm.textContent = fmt(S.recSec) + ' / ' + fmt(MAX_SEC);
  if ((reelsView() || tracksView() || partsView()) && ((frame++ & 1) === 0 || live)) drawAll(); // волны — через кадр (30 в секунду хватает глазу); при ведении — каждый
  if (parts && (++followN & 31) === 0) parts.follow(); // сменили темп метронома — петля тактами следом
  if (S.state !== 'idle' || live) raf = requestAnimationFrame(tick);
}

/* ---------- жесты: вести слой — сдвиг; кнопки ±1 мс с автоповтором ---------- */

// Катушка: 1 px = 3 мс (ширина экрана ≈ весь ход ±1 с); дорожка — в масштабе петли (вся ширина = длина петли).
// До 6 px — касание (откроет окно слоя), дальше — ведение: живой показ, сдвиг применяется при отпускании
function bindDrag(root) {
  let d = null, moved = false;
  const msPerPx = (el) => (el.classList.contains('lplanecv') ? (lp.state.len * 1000) / Math.max(1, el.getBoundingClientRect().width) : 3);
  const badge = (el, ms) => { const b = el.parentElement.querySelector('.lpbadge'); if (!b) return; if (ms == null) { b.hidden = true; return; } b.hidden = false; b.textContent = (ms > 0 ? '+' : '') + ms + ' ms'; };
  root.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-drag]'); if (!el || e.button > 0) return;
    const i = +el.dataset.drag, L = lp.state.layers[i]; if (!L) return;
    d = { id: e.pointerId, el, i, x0: e.clientX, y0: e.clientY, shift: L.shift, k: msPerPx(el), lim: L.margin }; moved = false;
  });
  root.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    if (!moved) { if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(e.clientY - d.y0)) return; moved = true; try { d.el.setPointerCapture(d.id); } catch { /* */ } }
    e.preventDefault();
    live = { i: d.i, shift: Math.max(-d.lim, Math.min(d.lim, Math.round(d.shift - dx * d.k))) }; // палец вправо — слой позже (сдвиг < 0): волна и плёнка идут за пальцем
    badge(d.el, live.shift);
    tick();
  });
  const end = (e) => {
    if (!d || e.pointerId !== d.id) return;
    const was = d, v = live; d = null; live = null;
    badge(was.el, null);
    if (!moved) return;
    was.el.dataset.swallow = '1'; // click после ведения — не открывать окно
    if (v && e.type !== 'pointercancel') lp.shiftLayer(was.i, v.shift);
    render();
  };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  root.addEventListener('click', (e) => { const el = e.target.closest('[data-drag]'); if (el && el.dataset.swallow) { delete el.dataset.swallow; e.stopPropagation(); e.preventDefault(); } }, true);
}
const nudgeAct = (el) => { const i = +el.dataset.i, d = +el.dataset.nd, L = lp.state.layers[i]; if (!L) return; lp.shiftLayer(i, d === 0 ? 0 : L.shift + d); const v = host && host.querySelector('.lpshv[data-i="' + i + '"]'); if (v) { const s = lp.state.layers[i].shift; v.textContent = (s > 0 ? '+' : '') + s; } };

/* ---------- окно слоя: границы и сдвиг рукой, эквалайзер, компрессия, реверберация ---------- */

// Вся запись слоя (с хвостом) лентой; окно петли на ней — вести за середину: сдвиг (мс), за края — обрезка.
// Ручки ниже: ±1 и ±10 мс; ползунки — низ, середина, верх (дБ), сжатие и реверберация (0…100 %)
function layerSheet(i) {
  const { t, ui } = ctx, S0 = lp.state, L0 = S0.layers[i];
  if (!L0) return;
  // эффекты слоя — общая панель приложения (ctx.fxPanel): эквалайзер, сжатие, драйв, тремоло, задержка, хор, реверберация
  const pm = ctx.fxPanel({ get: () => (lp.state.layers[i] || {}).fx, set: (fx) => lp.setFx(i, fx) });
  let pmb = null;
  ui.sheet(() => { const L = lp.state.layers[i]; if (!L) return ui.snav(''); return ui.snav(t('layerN', { n: i + 1 })) +
    '<div class="lpedit"><canvas class="lpeditcv" aria-label="' + ui.esc(t('editHint')) + '"></canvas><p class="ftr" style="margin:4px 0 0">' + ui.esc(t('editHint')) + '</p>' +
    '<div class="lpnudge">' + ui.icb('data-nd="-10" data-i="' + i + '"', I.left, t('earlier'), 'sm plain') + ui.icb('data-nd="-1" data-i="' + i + '"', '−1', t('earlier1'), 'sm plain txt') + '<button class="lpshv num" data-nd="0" data-i="' + i + '" aria-label="' + ui.esc(t('shiftReset')) + '">' + (L.shift > 0 ? '+' : '') + L.shift + ' ms</button>' + ui.icb('data-nd="1" data-i="' + i + '"', '+1', t('later1'), 'sm plain txt') + ui.icb('data-nd="10" data-i="' + i + '"', I.right, t('later'), 'sm plain') + '</div></div>' +
    '<div class="hdr">' + ui.esc(t('fx')) + '</div>' + pm.html() +
    '<div class="group" style="margin-top:12px"><button class="cell" data-lmute><span class="grow">' + ui.esc(t(L.mute ? 'unmute' : 'mute')) + '</span></button><button class="cell danger center" data-lrm>' + ui.esc(t('removeLayer')) + '</button></div>'; },
  (el, sh) => {
    // холст пересоздаётся при каждом sh.update() — берём текущий, слушатели — на шторке
    const cvNow = () => el.querySelector('.lpeditcv'), C = colors();
    let drag = null, live = null; // live: { shift, a, b } во время ведения
    const geom = (cv) => { const S = lp.state, L = S.layers[i], [w, h] = fit(cv), lenMs = S.len * 1000, mg = L ? L.margin : 0, span = lenMs + 2 * mg; return { S, L, w, h, lenMs, mg, span, x: (ms) => ((ms + mg) / span) * w }; };
    function draw() {
      const cv = cvNow(); if (!cv) return;
      const G = geom(cv); if (!G.L) return;
      const { L, w, h, lenMs, mg, x } = G, g = cv.getContext('2d'), sh0 = live ? live.shift : L.shift, a = live ? live.a : L.trim.a, b = live ? live.b : L.trim.b;
      g.clearRect(0, 0, w, h);
      g.fillStyle = C.fill; g.fillRect(0, 0, w, h);
      // запись: от 0 до len+хвост (отрицательный сдвиг берёт конец петли — слева пусто)
      const N = Math.max(48, Math.floor(w / 3)), pk = lp.fullPeaks(i, N), x0 = x(0), x1 = x(lenMs + mg), bw = (x1 - x0) / N;
      g.fillStyle = C.l2; g.globalAlpha = 0.5;
      for (let k = 0; k < N; k++) { const v = pk ? pk[k] : 0, bh = Math.max(2, v * (h - 10)); g.fillRect(x0 + k * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh); }
      g.globalAlpha = 1;
      // окно петли: [сдвиг, сдвиг + len]; внутри — обрезка a…b
      const wx0 = x(sh0), wx1 = x(sh0 + lenMs), ta = wx0 + (wx1 - wx0) * a, tb = wx0 + (wx1 - wx0) * b;
      g.fillStyle = C.tint; g.globalAlpha = 0.18; g.fillRect(wx0, 0, wx1 - wx0, h); g.globalAlpha = 0.32; g.fillRect(ta, 0, tb - ta, h); g.globalAlpha = 1;
      g.strokeStyle = C.tint; g.lineWidth = 2; g.strokeRect(wx0 + 1, 1, wx1 - wx0 - 2, h - 2);
      g.fillStyle = C.ink; [ta, tb].forEach((tx, k) => { g.beginPath(); g.moveTo(tx, h); g.lineTo(tx + (k ? -10 : 10), h); g.lineTo(tx, h - 12); g.closePath(); g.fill(); g.fillRect(tx - 1, 0, 2, h); });
      // ход
      if (G.S.state === 'play' || G.S.state === 'dub') { const px = wx0 + (wx1 - wx0) * G.S.pos; g.fillStyle = C.red; g.fillRect(px - 1, 0, 2, h); }
    }
    const pt = (cv, e) => { const r = cv.getBoundingClientRect(), d = cv.width / r.width; return (e.clientX - r.left) * d; };
    el.addEventListener('pointerdown', (e) => {
      const cv = e.target.closest('.lpeditcv'); if (!cv) return;
      const G = geom(cv); if (!G.L) return;
      const { L, w, lenMs, span, x } = G, px = pt(cv, e), wx0 = x(L.shift), wx1 = x(L.shift + lenMs), ta = wx0 + (wx1 - wx0) * L.trim.a, tb = wx0 + (wx1 - wx0) * L.trim.b;
      const near = (v) => Math.abs(px - v) < 18 * (cv.width / cv.getBoundingClientRect().width);
      drag = { id: e.pointerId, cv, x0: px, kind: near(ta) ? 'a' : near(tb) ? 'b' : px >= wx0 && px <= wx1 ? 'shift' : null, shift: L.shift, a: L.trim.a, b: L.trim.b, msPx: span / w, win: wx1 - wx0 };
      if (!drag.kind) { drag = null; return; }
      cv.setPointerCapture(e.pointerId); e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = pt(drag.cv, e) - drag.x0, L = lp.state.layers[i], lim = L.margin;
      if (drag.kind === 'shift') live = { shift: Math.max(-lim, Math.min(lim, Math.round(drag.shift + dx * drag.msPx))), a: drag.a, b: drag.b };
      else if (drag.kind === 'a') live = { shift: drag.shift, a: Math.max(0, Math.min(drag.b - 0.02, drag.a + dx / drag.win)), b: drag.b };
      else live = { shift: drag.shift, a: drag.a, b: Math.max(drag.a + 0.02, Math.min(1, drag.b + dx / drag.win)) };
      draw();
    });
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag, v = live; drag = null; live = null;
      if (!v) return;
      if (d.kind === 'shift') lp.shiftLayer(i, v.shift); else lp.trimLayer(i, v.a, v.b);
      sh.update(); pmb && pmb.mount();
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    pmb = pm.bind(el, sh);
    holdRepeat(el, '[data-nd]', (b) => { const d = +b.dataset.nd, L = lp.state.layers[i]; if (!L) return; lp.shiftLayer(i, d === 0 ? 0 : L.shift + d); const v = el.querySelector('.lpshv'); if (v) { const s2 = lp.state.layers[i].shift; v.textContent = (s2 > 0 ? '+' : '') + s2 + ' ms'; } });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-lmute]')) { lp.toggleMute(i); sh.update(); pmb && pmb.mount(); }
      else if (e.target.closest('[data-lrm]')) { lp.removeLayer(i); sh.close(); }
    });
    let r = 0;
    const loop = () => { if (!el.isConnected) { cancelAnimationFrame(r); return; } draw(); r = requestAnimationFrame(loop); };
    loop();
  }, { onClose: render });
}

/* ---------- действия ---------- */

const fail = (e) => {
  const r = e && e.reason;
  ctx.ui.toast(ctx.t(r === 'denied' ? 'err.denied' : r === 'unavailable' ? 'err.mic' : r === 'layers' ? 'err.layers' : e && e.message === 'nosound' ? 'err.sound' : 'err.fail'));
  if (!r) ctx.logErr(e);
};

// Главная кнопка. По метроному и без петли: отсчёт одного такта, запись — с начала следующего
async function main() {
  if (!ctx.audio.unlock()) { fail(new Error('nosound')); return; }
  const S = lp.state;
  if (arm) { disarm(); render(); return; }
  // «Партии»: петля тактами — первое касание запускает её (партии в такт), дальше — слои поверх, как обычно
  if (partsView() && S.state === 'idle' && !S.len && !parts.byRec()) { lp.setLoop(parts.planSec()); lp.play(); render(); return; }
  if (S.state === 'idle' && withMetro() && !S.len) {
    try { await lp.openMic(); } catch (e) { fail(e); return; }
    const m = metro();
    arm = { n: m.running ? 0 : 1 }; // метроном уже идёт — с ближайшего такта, иначе один такт отсчёта
    if (!m.running) m.start();
    offBeat = m.onBeat(({ b, ms }) => {
      if (!arm || b !== 0) return;
      if (arm.n > 0) { arm.n--; render(); return; }
      const at = ctx.audio.now() + ms / 1000;
      disarm();
      lp.startRec(at).then(render).catch(fail);
    });
    render();
    return;
  }
  if (S.state === 'idle' && S.len) { lp.play(); render(); return; }
  try { await lp.tap(withMetro() ? barSec() : 0, null, { takes: partsView() }); } catch (e) { fail(e); }
  render();
}
// Касание кнопки: как раньше; второе касание сразу следом во время петли — наложение становится заменой
// (старое под рукой стирается, как replace на педалях)
let lastTap = 0;
async function mainTap() {
  const now = performance.now(), S = lp.state;
  if (S.state === 'dub' && !S.replace && now - lastTap < 400) { lastTap = 0; if (lp.toReplace()) { ctx.ui.toast(ctx.t('replaceOn')); render(); } return; }
  lastTap = now;
  await main();
}
function disarm() { arm = null; if (offBeat) { offBeat(); offBeat = null; } }
function stopAll() { disarm(); lp.stop(); if (withMetro() && metro().running) metro().stop(); render(); }

async function save() {
  const m = lp && lp.mix();
  if (!m) { ctx.ui.toast(ctx.t('err.empty')); return; }
  // партии петли — в сведение вместе со слоями (стерео); не вышло — сохраняются хотя бы слои
  let chans = [m.data];
  try { const r = parts && await parts.renderLoop(m.data.length, m.sr); if (r) chans = r.map((ch) => { for (let i = 0; i < ch.length; i++) { const x = ch[i] + m.data[i]; ch[i] = Math.abs(x) > 0.95 ? Math.tanh(x) : x; } return ch; }); }
  catch (e) { ctx.logErr(e); }
  const wav = encodeWav(chans, m.sr), at = Date.now(), song = ctx.session && ctx.session.songId;
  let d;
  try { d = new Date(at).toLocaleString(ctx.lang() === 'uz' ? 'uz-Latn' : ctx.lang(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { d = new Date(at).toISOString().slice(0, 16); }
  try {
    await ctx.files.add({ id: 'lp' + at.toString(36), name: ctx.t('fileName', { when: d }), size: wav.length, type: 'audio/wav', kind: 'audio', songs: song ? [song] : [], created: at,
      blob: new Blob([wav], { type: 'audio/wav' }), dur: m.data.length / m.sr });
    ctx.ui.toast(ctx.t('saved'));
  } catch (e) { fail(e); }
}

function act(x, el) {
  const i = el && el.dataset.i != null ? +el.dataset.i : -1;
  switch (x) {
    case 'main': mainTap(); break;
    case 'redo': ctx.ui.toast(ctx.t(lp.redo() ? 'redone' : 'noRedo')); render(); break;
    case 'multiply': if (lp.multiply(2)) { ctx.ui.toast(ctx.t('multiplied', { n: ctx.tn('bars', Math.max(1, Math.round(lp.state.len / barSec()))) })); render(); } break;
    case 'stop': stopAll(); break;
    case 'undo': if (arm) { disarm(); render(); } else { ctx.ui.toast(ctx.t(lp.undo() ? 'undone' : 'nothing')); render(); } break;
    case 'save': save(); break;
    case 'metro': st().metro = !withMetro(); ctx.store.save(); render(); break;
    case 'mon': lp.setMonitor(!lp.state.mon); if (lp.state.mon) ctx.ui.toast(ctx.t('monOn')); render(); break;
    case 'mute': lp.toggleMute(i); render(); break;
    case 'slot': if (arm) disarm(); lp.select(i); render(); break;
    case 'view': st().view = VIEWS[(VIEWS.indexOf(curView()) + 1) % VIEWS.length]; ctx.store.save(); render(); break;
    case 'edit': layerSheet(i); break;
    case 'padd': addMenu(el); break;
    case 'capstop': parts.capDone(); render(); break;
  }
}

// Клик в левом ухе (по желанию): пока петля играет, метроном только слева — в наушниках слышен лишь музыканту
// и не мешает петле; петля встала — клик снова посередине. В «В медиатеку» клик не идёт никогда (сводятся слои и партии)
let panNow = 0;
function clickPan() {
  const S = lp.state, want = st().clickLeft && (S.state === 'play' || S.state === 'dub' || S.state === 'rec') ? -1 : 0;
  if (want !== panNow) { panNow = want; ctx.audio.mixer.setMetroPan(want); }
}
let swallowRow = 0;
function takeStep(row, d) {
  const i = row ? +row.dataset.li : -1, L = lp.state.layers[i];
  if (!L || L.takes < 2) return;
  swallowRow = performance.now();
  lp.setTake(i, (L.take + d + L.takes) % L.takes); render();
}
function metroMenu(anchor) {
  const { t } = ctx;
  holdMenu(anchor, [
    { icon: I.metro, label: t(withMetro() ? 'metroOff' : 'metroOn'), run: () => act('metro') },
    { icon: I.ear, label: t(st().clickLeft ? 'clickMid' : 'clickLeft'), run: () => { st().clickLeft = !st().clickLeft; ctx.store.save(); clickPan(); ctx.ui.toast(t(st().clickLeft ? 'clickLeftOn' : 'clickMidOn')); } },
  ], t('metro'));
}

/* ---------- «Партии»: добавить, меню строки, длина петли ---------- */

// «+»: партия (ударные, ноты, аккорды) или запись из медиатеки
function addMenu(anchor) {
  const { t } = ctx;
  holdMenu(anchor, [
    ...parts.kinds.map((k) => ({ icon: I[k], label: t('part.' + k), run: () => {
      const tr = parts.addPart(k);
      if (!lp.state.len && !parts.byRec()) lp.setLoop(parts.planSec());
      render(); parts.follow(); parts.edit(tr.id);
    } })),
    { icon: I.keys, label: t('part.play'), run: () => toolSheet() },
    { icon: I.file, label: t('part.file'), run: () => filePicker() },
    ...(parts.oldProjects().length ? [{ icon: I.parts, label: t('part.proj'), run: () => projPicker() }] : []),
  ], t('add'));
}
// «Сыграть на инструменте» (слово автора 05.11.2026): инструмент приложения в шторке, петля играет; «Записать круг» —
// с начала следующего круга звук инструмента ложится слоем, ноты — выключенной партией рядом. Окно инструмента —
// то же, что во вкладке (ctx.mountTool): его звук, настройки и эффекты. MIDI-клавиатура пишется так же
const PLAY_TOOLS = ['piano', 'drone', 'glider', 'theremin'];
function toolSheet() {
  const { t, ui } = ctx;
  if (!ctx.audio.unlock()) { fail(new Error('nosound')); return; }
  const list = PLAY_TOOLS.filter((id) => ctx.hasTool(id));
  if (!list.length) { ctx.ui.toast(t('err.fail')); return; }
  let cur = list.includes(st().playTool) ? st().playTool : list[0], h = null, tm = 0;
  // вкладки — значок и название инструмента (слово автора 05.11.2026: и значки, и надписи)
  const tabs = () => list.map((id) => { const x = ctx.midi.tool(id) || { name: id, icon: '' }; return '<button class="lptt' + (id === cur ? ' on' : '') + '" data-tt="' + id + '" aria-pressed="' + (id === cur) + '" aria-label="' + ui.esc(x.name) + '">' + (x.icon || '') + '<span>' + ui.esc(x.name) + '</span></button>'; }).join('');
  const recBtn = () => { const s = parts.capState(); return '<span class="lprdot' + (s ? ' ' + s : '') + '"></span>' + ui.esc(t(s === 'wait' ? 'cap.wait' : s === 'rec' ? 'cap.stop' : 'cap.go')); };
  const mount = (el) => {
    const box = el.querySelector('.lptool');
    if (h) { try { h.unmount(); } catch (e) { ctx.logErr(e); } h = null; }
    box.innerHTML = '';
    h = ctx.mountTool(cur, box, 'half');
  };
  ui.sheet(() => ui.snav(t('play.title')) + '<div class="lptop"><div class="lptabs hscroll" role="group" aria-label="' + ui.esc(t('play.title')) + '">' + tabs() + '</div>' +
    '<button class="lprecb" data-x="cap" aria-live="polite" title="' + ui.esc(t('play.hint')) + '">' + recBtn() + '</button></div><div class="lptool"></div>', (el) => {
    mount(el);
    const btn = el.querySelector('[data-x="cap"]');
    const tick = () => { const s = parts.capState() || ''; if (btn.dataset.s !== s) { btn.dataset.s = s; btn.innerHTML = recBtn(); btn.classList.toggle('on', !!s); } tm = after(150, tick); };
    tick();
    el.addEventListener('click', (e) => {
      const tb = e.target.closest('[data-tt]');
      if (tb) {
        if (parts.capState()) return; // во время записи инструмент не меняется
        cur = tb.dataset.tt; st().playTool = cur; ctx.store.save();
        el.querySelectorAll('[data-tt]').forEach((b) => { const on = b.dataset.tt === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
        mount(el);
        return;
      }
      if (e.target.closest('[data-x="cap"]')) {
        if (parts.capState()) { parts.capDone(); return; }
        if (parts.capArm({ tool: cur })) render();
      }
    });
  }, { tall: true, onClose: () => { cancel(tm); if (h) { try { h.unmount(); } catch (e) { ctx.logErr(e); } h = null; } render(); } });
}
// Проекты прежней студии и ансамбля — петлёй в свободную петлю
function projPicker() {
  const { t, ui } = ctx, L = parts.oldProjects();
  ui.sheet(() => ui.snav(t('part.proj')) + '<div class="group">' + L.slice(0, 100).map((p) => '<button class="cell" data-pid="' + p.id + '"><span class="grow">' + ui.esc(p.name || t('untitled')) + '<span class="bksub">' + ui.esc(p.bpm + ' bpm · ' + ctx.tn('parts', p.tracks.filter((x) => x.kind !== 'audio').length)) + '</span></span>' + ui.icons.chev + '</button>').join('') + '</div><p class="ftr">' + ui.esc(t('projHint')) + '</p>',
    (el, sh) => el.addEventListener('click', (e) => { const b = e.target.closest('[data-pid]'); if (!b) return; sh.close(); takeInbox({ kind: 'proj', pid: b.dataset.pid }); }));
}
// Принять присланное (плеер, «Табы», ноты с игры, старые проекты): в свободную петлю, вид «Партии»
async function takeInbox(box) {
  const { t } = ctx;
  let r;
  try { r = await parts.inbox(box); } catch (e) { fail(e); return; }
  if (!r) return;
  if (r.err) { ctx.ui.toast(t(r.err === 'full' ? 'inFull' : 'inEmpty')); return; }
  ctx.ui.toast(t('inDone', { n: r.slot + 1, what: r.parts != null ? ctx.tn('parts', r.parts) : ctx.tn('layers', r.layers) }));
  render();
}

// Запись из медиатеки: выбрать файл → кусок (длиной в петлю, такт, долю или весь звук), откуда, повтор или один раз
function filePicker() {
  const { t, ui } = ctx, L = ctx.files.list('audio').filter((r) => r.blob || r.size).sort((a, b) => (b.created || 0) - (a.created || 0));
  if (!L.length) { ui.toast(t('noFiles')); return; }
  ui.sheet(() => ui.snav(t('part.file')) + '<div class="group">' + L.slice(0, 200).map((r) => '<button class="cell" data-fid="' + r.id + '"><span class="grow">' + ui.esc(r.name || '') + '<span class="bksub">' + (r.dur ? fmt(r.dur) : '') + '</span></span>' + ui.icons.chev + '</button>').join('') + '</div>',
    (el, sh) => el.addEventListener('click', (e) => { const b = e.target.closest('[data-fid]'); if (!b) return; sh.close(); setTimeout(() => pieceSheet(ctx.files.get(b.dataset.fid)), 200); }));
}
function pieceSheet(rec) {
  if (!rec) return;
  const { t, ui } = ctx, o = { start: 0, piece: st().piece && PIECES.includes(st().piece) ? st().piece : 'loop', place: st().place === 'once' ? 'once' : 'repeat' }, dur = rec.dur || 0;
  ui.sheet(() => ui.snav(rec.name || t('part.file')) +
    '<div class="hdr">' + ui.esc(t('piece')) + '</div><div class="group"><div class="cellcol">' + ui.seg('lppiece', PIECES.map((k) => [k, t('piece.' + k)]), o.piece, t('piece')) + '</div></div>' +
    '<div class="hdr">' + ui.esc(t('place')) + '</div><div class="group"><div class="cellcol">' + ui.seg('lpplace', PLACES.map((k) => [k, t('place.' + k)]), o.place, t('place')) + '</div></div>' +
    (dur > 0.2 ? '<div class="hdr">' + ui.esc(t('pieceFrom')) + ' <b class="num" data-fromv>' + fmtS(o.start) + '</b></div><div class="group"><div class="cell"><input type="range" class="strange" min="0" max="' + Math.max(0, dur - 0.05).toFixed(2) + '" step="0.01" value="' + o.start + '" data-from aria-label="' + ui.esc(t('pieceFrom')) + '"></div></div>' : '') +
    '<p class="ftr">' + ui.esc(t('pieceHint')) + '</p><button class="btn fill block" data-addpiece>' + ui.esc(t('add')) + '</button>',
  (el, sh) => {
    el.addEventListener('input', (e) => { if (e.target.matches('[data-from]')) { o.start = +e.target.value; const v = el.querySelector('[data-fromv]'); if (v) v.textContent = fmtS(o.start); } });
    el.addEventListener('click', (e) => {
      let b;
      if ((b = e.target.closest('[data-seg="lppiece"] [data-v]'))) { o.piece = b.dataset.v; st().piece = o.piece; ctx.store.save(); el.querySelectorAll('[data-seg="lppiece"] [data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b)); return; }
      if ((b = e.target.closest('[data-seg="lpplace"] [data-v]'))) { o.place = b.dataset.v; st().place = o.place; ctx.store.save(); el.querySelectorAll('[data-seg="lpplace"] [data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b)); return; }
      if (e.target.closest('[data-addpiece]')) {
        if (!ctx.audio.unlock()) { fail(new Error('nosound')); return; }
        sh.close();
        parts.addFile(rec, o).then(() => { render(); parts.follow(); }).catch((er) => { if (er && er.message === 'loop') ctx.ui.toast(t('err.lenLayers')); else fail(er); });
      }
    });
  });
}
const fmtS = (x) => { const m = Math.floor(x / 60), s = x - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
// Удержание строки: партия — править, копия, убрать; слой — окно слоя, убрать
function rowMenu(row) {
  const { t } = ctx;
  if (row.dataset.tr) {
    const id = row.dataset.tr, p = parts.proj(), tr = p && p.tracks.find((x) => x.id === id); if (!tr) return;
    holdMenu(row, [
      { icon: I.pen, label: t('part.edit'), run: () => parts.edit(id) },
      { icon: I.copy, label: t('part.dup'), run: () => { parts.dupPart(id); render(); parts.follow(); } },
      { icon: I.x, label: t('part.remove'), danger: true, run: () => { parts.removePart(id); render(); } },
    ], parts.name(tr));
    return;
  }
  const i = +row.dataset.li, L = lp.state.layers[i];
  holdMenu(row, [
    ...(L && L.takes > 1 ? [{ icon: I.x, label: t('takeDrop', { n: L.take + 1 }), danger: true, run: () => { lp.dropTake(i, L.take); render(); } }] : []),
    { icon: I.wave, label: t('layerEdit', { n: i + 1 }), run: () => layerSheet(i) },
    { icon: I.x, label: t('removeLayer'), danger: true, run: () => { lp.removeLayer(i); render(); } },
  ], t('layerN', { n: i + 1 }));
}
// Длина петли: такты (по метроному) или по первой записи
function setLen(v) {
  if (v === 'rec') { st().lenMode = 'rec'; ctx.store.save(); if (!lp.state.layers.length) { lp.unfix(); } render(); return; }
  const was = { mode: st().lenMode, bars: st().bars };
  st().lenMode = 'bars'; st().bars = +v; ctx.store.save();
  const S = lp.state;
  if ((S.len || S.state !== 'idle') && !lp.setLoop(parts.planSec())) { st().lenMode = was.mode; st().bars = was.bars; ctx.store.save(); ctx.ui.toast(ctx.t('err.lenLayers')); }
  parts.follow(); render();
}

// Педаль Bluetooth (как для перелистывания): пробел, Enter, PageDown — кнопка; PageUp — стоп; стрелки — отмена
function onKey(e) {
  if (!host || e.target.matches('input, textarea, select')) return;
  const k = e.key;
  if (k === ' ' || k === 'Enter' || k === 'PageDown') { e.preventDefault(); main(); }
  else if (k === 'PageUp') { e.preventDefault(); stopAll(); }
  else if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); act('undo'); }
  else if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); act('redo'); }
}

export default {
  ...meta,
  status(c) { return c.t(c.store.get('metro') ? 'st.metro' : 'st.free'); },
  mount(el, c, sz = 'full') {
    host = el; ctx = c; size = sz;
    if (!lp) lp = createLooper({ mixer: c.audio.mixer, onChange: () => { tick(); if (parts) parts.follow(); clickPan(); }, log: c.log });
    if (!parts) parts = createParts(c, lp, { render: () => render(), barSec: () => barSec(), play: () => { if (lp.state.state === 'idle') main(); } });
    // присланное другим модулем (ctx.openIn('looper', { inbox })) — один раз
    const box = st().inbox; if (box) { delete st().inbox; c.store.save(); setTimeout(() => takeInbox(box), 0); }
    lp.setShift(st().shift || 0);
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    on(host, 'click', (e) => {
      const b = e.target.closest('[data-x]'); if (b) { act(b.dataset.x, b); return; }
      const sg = e.target.closest('[data-seg="lpbars"] [data-v]'); if (sg) { setLen(sg.dataset.v); return; }
      const tk = e.target.closest('[data-tk]'); // дубли слоя: ‹ › — сравнить на ходу
      if (tk) { const i = +tk.dataset.i, L = lp.state.layers[i]; if (L && L.takes) { lp.setTake(i, (L.take + +tk.dataset.tk + L.takes) % L.takes); render(); } return; }
      const row = e.target.closest('.lprow'); // касание строки — вкл/выкл с начала такта
      if (row && !e.target.closest('input, button') && performance.now() - swallowRow > 400) { if (row.dataset.tr) parts.toggleTrack(row.dataset.tr); else parts.toggleLayer(+row.dataset.li); render(); }
    });
    on(host, 'input', (e) => {
      if (e.target.dataset.vol != null) lp.setGain(+e.target.dataset.vol, +e.target.value);
      else if (e.target.dataset.tvol != null) { const p = parts.proj(), tr = p && p.tracks.find((x) => x.id === e.target.dataset.tvol); if (tr) parts.seq.setTrackVol(tr, +e.target.value); }
    });
    on(host, 'change', (e) => { if (e.target.dataset.tvol != null) { const p = parts.proj(); if (p) c.projects.save(p); } });
    on(window, 'keydown', onKey);
    bindDrag(host); // вести катушку или дорожку — сдвиг слоя
    holdRepeat(host, '.lpwrap [data-nd]', nudgeAct);
    // удержание кнопки — отмена последнего слоя; удержание слоя — убрать его
    // удержание кнопки: петля играет — удлинить вдвое (multiply), иначе — отменить (как было)
    onHold(host, '[data-x="main"]', () => { const S = lp.state; if (S.state === 'play' && S.len) act('multiply'); else act('undo'); });
    // смахивание по кнопке: влево — отменить слой, вправо — вернуть снятый
    unswipe = swipe(host, { min: 50, left: () => act('undo'), right: () => act('redo'), ok: (ev) => !!ev.target.closest('[data-x="main"]') });
    // смахнуть строку слоя с дублями — соседний дубль
    let swRow = null;
    const unsw2 = swipe(host, { min: 50, ok: (ev) => { swRow = ev.target.closest('.lprow.layer'); return !!swRow && !ev.target.closest('input'); },
      left: () => takeStep(swRow, 1), right: () => takeStep(swRow, -1) });
    offs.push(unsw2);
    onHold(host, '.lprow', rowMenu);
    onHold(host, '[data-x="metro"]', (b) => metroMenu(b));
    onHold(host, '.lplayer, .lplane:not(.lpnone), .lpreel:not(.lpnone)', (row) => holdMenu(row, [{ icon: I.x, label: c.t('removeLayer'), danger: true, run: () => { lp.removeLayer(+row.dataset.li); render(); } }], c.t('layerN', { n: +row.dataset.li + 1 })));
    render();
  },
  resize(sz) { size = sz; render(); },
  // MIDI-клавиатура: в лупере звучит пианино; при «С игры» — пишется в партию
  midiIn(e) { if (parts) parts.midi(e); },
  midiStop() { if (parts) parts.midi({ k: 'off', id: '*' }); },
  // Окно закрыто: петля звучит дальше (как Hold у пианино), пока не остановят — удобно играть под неё в другом инструменте
  unmount() {
    if (unswipe) { unswipe(); unswipe = null; }
    cancelAnimationFrame(raf);
    disarm();
    offs.splice(0).forEach((f) => f());
    if (lp && lp.state.state === 'rec') lp.stop();
    if (lp && lp.state.state === 'dub') lp.stopDub();
    if (lp && !lp.hasAny && lp.state.state === 'idle') { lp.close(); }
    host = null;
  },
};
