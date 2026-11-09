// Медиатека: минусы, партии, уроки и записи (аудио и видео) — только на устройстве. Плеер с волной или винилом,
// замедление без изменения высоты, повтор A–B, тренер темпа (+5 % с каждым повтором), тайм-коды, привязка к песням.
// Перенесено из legacy/practice.html (AU, auLoad, audioHTML, wformHTML, medLibHTML, trackSheet, mlMenu, vinylHTML, VIN).
import './audio.css';
import './media.css';
import ru from './i18n/ru.json';
import uz from './i18n/uz.json';
import en from './i18n/en.json';
import el from './i18n/el.json';
import { fileSongs, inSong, linkSong } from '../../core/files.js';
import { foldQ } from '../../core/library.js';
import { SH, FL } from '../../music/notes.js';
import { onHold } from '../../ui/hold.js';
import { parseChord } from '../../audio/mirpost.js';
import { shapeFor, diagramSVG, degreeOf } from './chordview.js';
import { pitchShifter } from '../../audio/pitchshift.js';
import { createStretchPlayer, stretchAvailable } from '../../audio/stretchplayer.js';
import { createBufferPlayer } from '../../audio/bufferplayer.js';
import { modesHere, estimateSec, hqVocalsModel } from '../../audio/stems.js';
import { estimateLyricsSec, lineAt, lyricsText, toLrc } from '../../audio/lyrics.js';
import { stemsOf, notesOf, denoisedOf } from '../../core/jobs.js';
import { estimateDenoiseSec } from '../../audio/denoise.js';
import { estimateYmtSec } from '../../audio/ymt.js';
import { projectFromSong, isEmptyProject } from '../../music/project.js';
import { readMidiSong } from '../../music/daw.js';
import { after, cancel } from '../../audio/clock.js';
import { voice } from '../../audio/metronome.js';
import { fmtDur } from '../../core/format.js';
import { isVideo, VIDEO_EXT, addMark, markSpan, nearMark, currentMark } from './marks.js';

import meta, { ICON } from './meta.js';
const I = {
  stems: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/><path d="M8 5v4M14 10v4M11 15v4" style="stroke-width:3"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.3-7.2c.6-.4.6-1.4 0-1.8L8.6 3.9C7.9 3.5 7 4 7 4.8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/></svg>',
  back5: '<svg viewBox="0 0 24 24"><path d="M12 4.5a7.5 7.5 0 1 1-7.5 7.5M12 4.5 9 2M12 4.5 9 7"/><text x="12.5" y="15.5" text-anchor="middle" style="font:700 7.5px var(--font);fill:currentColor;stroke:none">5</text></svg>',
  fwd5: '<svg viewBox="0 0 24 24"><path d="M12 4.5a7.5 7.5 0 1 0 7.5 7.5M12 4.5 15 2M12 4.5 15 7"/><text x="11.5" y="15.5" text-anchor="middle" style="font:700 7.5px var(--font);fill:currentColor;stroke:none">5</text></svg>',
  more: '<svg viewBox="0 0 24 24" class="f"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  disc: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/></svg>',
  search: '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="5"/><path d="m11 11 3.5 3.5"/></svg>',
  film: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3M10 9.5l4.5 2.5-4.5 2.5z"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M6 21V4M6 4h10l-2 3.5 2 3.5H6"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  sel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.8 2.7L16.2 9.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 12.5h9l1-12.5"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M3 12h2l2-5 3 10 3-7 2 4 2-2h4"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 11h12M4 16h16M4 21h8"/></svg>',
  chords: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14M15 5v14M3 12h18"/></svg>',
  click: '<svg viewBox="0 0 24 24"><path d="M9 3h6l3 16H6z"/><path d="M12 14 17 6M5 19h14"/><circle cx="12" cy="14" r="1.6" fill="currentColor"/></svg>',
};
const MB = 1048576;

/* ---------- плеер (один на приложение, играет и при закрытом окне) ---------- */

const AU = { el: null, cur: null, url: null, rate: 1, a: null, b: null, loop: false, step: false, raf: 0, eng: null, engP: null, engOn: false, engFor: null, partsFor: null, loadP: null, loadKey: '', noEngine: false, engLite: false };
// Дорожки записи (src/core/jobs.js: файлы с stem.src — эта запись); набор — выбранный режим (st().pmode[id]),
// иначе режим с наибольшим числом дорожек; версия — выбранная (st().pver[id]: 'hq' | 'std'), иначе улучшенная, если есть
const PART_ORDER = ['vocals', 'inst', 'drums', 'bass', 'guitar', 'piano', 'other'];
const byPart = (a, b) => PART_ORDER.indexOf(a.stem.part) - PART_ORDER.indexOf(b.stem.part);
const stemSets = (t) => { const by = {}; (t && ctx ? stemsOf(ctx.files, t.id) : []).forEach((r) => { (by[(r.stem.mode || '4') + (r.stem.hq ? 'hq' : '')] ??= []).push(r); }); return by; };
const verOf = (t) => ((st().pver || {})[t.id] === 'std' ? 'std' : 'hq');
function stemsFor(t, mode = null, ver = null) {
  if (!t || !ctx) return [];
  const by = stemSets(t), want = mode || (st().pmode || {})[t.id], v = ver || verOf(t);
  const pick = (m) => (v === 'hq' ? by[m + 'hq'] || by[m] : by[m] || by[m + 'hq']);
  const best = (want && pick(want)) || Object.values(by).sort((a, b) => b.length - a.length)[0] || [];
  return best.sort(byPart);
}
const hasVer = (t, mode, hq) => !!stemSets(t)[mode + (hq ? 'hq' : '')];
const mixOf = (t) => ((st().pmix || {})[t.id]) || {};
const mixActive = (t) => Object.values(mixOf(t)).some((v) => v !== 1);
const blobsOf = (list) => { const o = {}; list.forEach((r) => { o[r.stem.part] = r.blob; }); return o; };
// Громкости дорожек (st().pmix[id][part], 0…1,5; 1 — не хранится): правка, применение в движок, строки микшера —
// одни и те же для шторки и для вида «Дорожки» в плеере
const MIX_PREV = {};
let mixTm = 0;
const mixVal = (t, k) => { const g = mixOf(t); return g[k] == null ? 1 : g[k]; };
function mixSet(t, k, v) { const all = st().pmix || (st().pmix = {}), mx = all[t.id] || (all[t.id] = {}); mx[k] = Math.max(0, Math.min(1.5, Math.round(v * 20) / 20)); if (mx[k] === 1) delete mx[k]; if (!Object.keys(mx).length) delete all[t.id]; }
function mixToggle(t, k) { const was = mixVal(t, k); if (was === 0) mixSet(t, k, (MIX_PREV[t.id] || {})[k] || 1); else { (MIX_PREV[t.id] ??= {})[k] = was; mixSet(t, k, 0); } }
// в движок: на ходу — setMix (пересведение без разрыва); исходник ↔ дорожки — перезагрузка с того же места
function mixApply(t) {
  ctx.store.save();
  clearTimeout(mixTm);
  mixTm = setTimeout(async () => {
    if (AU.cur !== t) return;
    if (AU.engOn && AU.partsFor === t && mixActive(t)) { AU.eng.setMix(mixOf(t)); return; }
    const at = pl().currentTime, was = !pl().paused;
    if (await engineLoad(t)) { AU.eng.currentTime = at; if (was) AU.eng.play().catch(() => {}); }
    render();
  }, 200);
}
const PART_ICON = {
  vocals: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg>',
  inst: '<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
  drums: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8M3 3l6 4M21 3l-6 4"/></svg>',
  bass: '<svg viewBox="0 0 24 24"><path d="M15 3l6 6-9 9a4 4 0 1 1-5.7-5.7z"/><path d="M14 7l3 3"/></svg>',
  guitar: '<svg viewBox="0 0 24 24"><path d="M19 3l2 2-7 7"/><path d="M12 10a4 4 0 0 0-5.5 1.5A3.5 3.5 0 0 0 4 15a4 4 0 1 0 6 4 3.5 3.5 0 0 0 3.5-2.5A4 4 0 0 0 15 11z"/></svg>',
  piano: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v8M12 5v8M16 5v8M8 19v-6M12 19v-6M16 19v-6"/></svg>',
  other: '<svg viewBox="0 0 24 24"><path d="M4 12h3l2-5 3 10 3-7 2 4h3"/></svg>',
};
// строки микшера дорожек: значок, название, ползунок, выкл
function stemRowsHTML(t, set) {
  const { ui } = ctx, tr = ctx.t;
  return set.map((r) => { const k = r.stem.part, v = mixVal(t, k), mu = v === 0; return '<div class="cellcol stemrow' + (mu ? ' mu' : '') + '" data-srow="' + k + '"><div class="row"><span class="pic">' + (PART_ICON[k] || PART_ICON.other) + '</span><span class="grow">' + ui.esc(tr('part.' + k)) + '</span><b class="num" data-sv="' + k + '">' + Math.round(v * 100) + ' %</b>' +
    '<button class="ic sm plain" data-smute="' + k + '" aria-pressed="' + mu + '" aria-label="' + ui.esc(tr(mu ? 'stems.unmute' : 'stems.mute', { name: tr('part.' + k) })) + '">' + (mu ? I.mute : I.vol) + '</button></div>' +
    '<input type="range" min="0" max="150" step="5" value="' + Math.round(v * 100) + '" data-sg="' + k + '" aria-label="' + ui.esc(tr('part.' + k)) + '"></div>'; }).join('');
}
// обновить строки по текущим громкостям (без перерисовки)
function refreshStemRows(root, t) {
  root.querySelectorAll('[data-srow]').forEach((row) => {
    const k = row.dataset.srow, v = mixVal(t, k), b = row.querySelector('[data-sv]'), mu = row.querySelector('[data-smute]'), i = row.querySelector('[data-sg]');
    if (b) b.textContent = Math.round(v * 100) + ' %';
    if (i && document.activeElement !== i) i.value = Math.round(v * 100);
    if (mu) { mu.setAttribute('aria-pressed', v === 0); mu.innerHTML = v === 0 ? I.mute : I.vol; }
    row.classList.toggle('mu', v === 0);
  });
}
// Что играет сейчас: звук — движок Signalsmith (src/audio/stretchplayer.js: скорость и тональность одним алгоритмом,
// без <audio>-элемента), видео — элемент. Интерфейс у обоих как у медиа-элемента
const pl = () => (AU.engOn ? AU.eng : AU.el);
const ML = { q: '', sort: 'date', f: 'all', view: 'lib', sel: null }; // sel — выбранные файлы (Set id) в режиме выбора
let dropped = null; // файлы, перетащенные в окно до того, как модуль открылся (src/core/drop.js)
let host = null, ctx = null, size = 'full', input = null, uiTimer = 0, offs = [], app = null;

const fmtT = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const st = () => ctx.store.all();
// записи медиатеки — без дорожек разделения: они живут внутри своей записи (панель «Дорожки», шторка), в списке их нет
const tracks = () => ctx.files.list('audio').filter((x) => !x.stem);
// удалить запись вместе с её дорожками
async function removeWithStems(id) { for (const r of stemsOf(ctx.files, id)) await ctx.files.remove(r.id); await ctx.files.remove(id); }
const curSong = () => (ctx.session && ctx.session.songId) || null;
const audKey = () => (curSong() ? 'song:' + curSong() : 'free');
const style = () => (st().style === 'vinyl' && !ctx.mono ? 'vinyl' : 'wave'); // «Минимал» — волна
// Тональность записи (src/audio/pitchshift.js): у каждой записи своя — settings.pitch[id] = [полутоны, центы]
const pitchOf = (t) => (t && (st().pitch || {})[t.id]) || [0, 0];
// Аккорды записи (rec.ana.chords: [{ t, d, c }], подписи ChordMini вида «A:min») с учётом сдвига высоты плеера;
// корни — бемолями в бемольных тональностях. Доли (rec.ana.beats) — для притяжения A и B
const QUAL_TXT = { '': '', min: 'm', dim: 'dim', aug: 'aug', min6: 'm6', maj6: '6', min7: 'm7', minmaj7: 'mMaj7', maj7: 'maj7', 7: '7', dim7: 'dim7', hdim7: 'm7♭5', sus2: 'sus2', sus4: 'sus4' };
const FLAT_KEYS = [5, 10, 3, 8, 1];
function chordTxt(c, t) {
  const p = parseChord(c);
  if (!p) return '';
  const a = t.ana || {}, [semi] = pitchOf(t), keyPc = a.pc == null ? 0 : (((a.minor ? a.pc + 3 : a.pc) + semi) % 12 + 12) % 12;
  return (FLAT_KEYS.includes(keyPc) ? FL : SH)[((p.pc + semi) % 12 + 12) % 12] + (QUAL_TXT[p.q] ?? p.q);
}
const chordsOf = (t) => (t && t.ana && Array.isArray(t.ana.chords) ? t.ana.chords : []);
const chordAt = (t, sec) => { const L = chordsOf(t); let i = -1; for (let k = 0; k < L.length; k++) { if (L[k].t <= sec) i = k; else break; } return i; };
// ближайшая доля не дальше 0,3 с — иначе время как есть
function snapBeat(t, sec) {
  const B = t && t.ana && Array.isArray(t.ana.beats) ? t.ana.beats : [];
  if (!B.length) return sec;
  let lo = 0, hi = B.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (B[m] < sec) lo = m + 1; else hi = m; }
  const c = [B[lo], B[lo - 1]].filter((x) => x != null).sort((x, y) => Math.abs(x - sec) - Math.abs(y - sec))[0];
  return Math.abs(c - sec) <= 0.3 ? c : sec;
}
const keyTxt = () => { const [p, c] = pitchOf(AU.cur); return p || c ? (p > 0 ? '+' : p < 0 ? '−' : '±') + Math.abs(p) + (c ? (c > 0 ? ' +' : ' −') + Math.abs(c) + '¢' : '') : '0'; };
const formantOn = () => !!st().formant; // сохранять форманты (голос) — по умолчанию нет: на музыке слышен «призрак» оригинала
let liteTold = false;
async function applyPitch() {
  const [p, c] = pitchOf(AU.cur);
  if (AU.engOn) { if (AU.eng.lite) { if ((p || c) && !liteTold) { liteTold = true; ctx.ui.toast(ctx.t('key.lite')); } return; } AU.eng.setPitch(p, c, formantOn()); return; }
  if (!AU.shift && !p && !c) return; // пока сдвига не было — звук идёт напрямую, без Web Audio
  if (!ctx.audio.unlock()) return;
  const dest = ctx.audio.bus('media');
  if (!AU.shift) { AU.shift = await pitchShifter(AU.el, dest); AU.el.volume = 1; } // громкость — у шины медиатеки
  try { if (dest.context.state !== 'running') await dest.context.resume(); } catch { /* по жесту */ }
  await AU.shift.set(p, c, { formant: formantOn() });
}
function setPitch(p, c) {
  if (!AU.cur) return;
  const all = st().pitch || (st().pitch = {});
  p = Math.max(-12, Math.min(12, Math.round(p))); c = Math.max(-50, Math.min(50, Math.round(c)));
  if (p || c) all[AU.cur.id] = [p, c]; else delete all[AU.cur.id];
  ctx.store.save();
  applyPitch().catch((e) => ctx.logErr(e));
  const kv = host && host.querySelector('#keyv'); if (kv) kv.textContent = keyTxt();
  // аккорды на волне и в строке — с новым сдвигом
  if (host) { const L = chordsOf(AU.cur); host.querySelectorAll('#wfch i').forEach((el) => { const sp = el.querySelector('span'), c = L[+el.dataset.ci]; if (sp && c) sp.textContent = chordTxt(c.c, AU.cur); }); const ac = host.querySelector('#achord'); if (ac) delete ac.dataset.i; }
}
// Шторка тональности: линейка полутонов (−12…+12, текущий — по центру), центы ползунком (по 1), тональность и строй
// записи (определяются по самой записи на устройстве, запоминаются), «как в тексте песни», сброс
const NOTE_M = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'], NOTE_m = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
const keyName = (pc, minor) => (minor ? NOTE_m : NOTE_M)[((pc % 12) + 12) % 12] + (minor ? 'm' : '');
const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
/* ---------- панель плеера: волна, дорожки, текст, аккорды ---------- */
const PVIEWS = ['wave', 'stems', 'text', 'chords'];
const pview = () => (PVIEWS.includes(st().pview) ? st().pview : 'wave');
const PV = { cells: [], bars: [] }; // сетка аккордов: времена ячеек и номер такта каждой
// Такты и доли записи: по сильным долям (rec.ana.downbeats), доли между ними — ячейки; без разбора — пусто
function chordGrid(t) {
  const a = t.ana || {}, D = Array.isArray(a.downbeats) ? a.downbeats : [], B = Array.isArray(a.beats) ? a.beats : [], dur = t.dur || pl().duration || 0;
  if (D.length < 2 || !B.length) return [];
  const bars = [];
  let bi = 0;
  for (let i = 0; i < D.length && bars.length < 600; i++) {
    const s0 = D[i], s1 = i + 1 < D.length ? D[i + 1] : dur || s0 + (D[i] - D[i - 1]);
    while (bi < B.length && B[bi] < s0 - 0.02) bi++;
    const cells = [];
    for (let k = bi; k < B.length && B[k] < s1 - 0.02 && cells.length < 12; k++) cells.push(B[k]);
    if (!cells.length) cells.push(s0);
    bars.push({ t: s0, cells });
  }
  return bars;
}
// Вид «Аккорды»: сверху — «сейчас» (аккорд крупно, ступень в тональности, схема на грифе; следующий — и через сколько
// долей), ниже — такты по сильным долям записи, по четыре в ряд (на компьютере — больше): аккорды внутри такта — по
// долям, цвет — функция (тоника, субдоминанта, доминанта), в текущем такте — полоса хода. Касание такта — перемотка.
// Аккорды считает компьютер (ансамбль моделей, src/audio/mir.worker.js); со сдвигом высоты всё пересчитывается.
function chordInfo(t, c) {
  const p = parseChord(c);
  if (!p) return null;
  const a = t.ana || {}, [semi] = pitchOf(t), pc = (((p.pc + semi) % 12) + 12) % 12, sh = shapeFor(pc, p.q), dg = degreeOf(p.pc, p.q, a.pc ?? null, !!a.minor);
  return { txt: chordTxt(c, t), deg: dg.deg, fn: dg.fn, frets: sh ? sh.frets : null, barre: sh ? sh.barre : null };
}
const nowHTML = () => '<div class="chnow" id="chnow" aria-live="polite"><div class="chcur"><b id="chn">—</b><span class="chdeg num" id="chdeg"></span></div><div class="chdg" id="chdg"></div>' +
  '<div class="chnx"><span class="l2">→</span><b id="chx"></b><span class="chin num" id="chin"></span></div></div>';
function chordsViewHTML(t) {
  const { ui } = ctx, tr = ctx.t, bars = chordGrid(t), L = chordsOf(t);
  PV.cells = []; PV.bars = []; PV.barT = [];
  if (!L.length) return '<div class="pview pempty"><span>' + ui.esc(tr(t.anaTried ? 'pv.noChords' : ctx.jobs && ctx.jobs.notesSupported() ? 'pv.waitChords' : 'pv.chordsPc')) + '</span></div>';
  if (!bars.length) // аккорды без долей — лентой
    return '<div class="pview pchords flat" id="pchords">' + nowHTML() + '<div class="chflat">' + L.map((c, i) => { const inf = chordInfo(t, c.c); return '<button class="chc fn-' + ((inf && inf.fn) || 'x') + (c.c ? '' : ' no') + '" data-ci="' + i + '" data-bt="' + c.t + '"><b>' + (inf ? ui.esc(inf.txt) : '·') + '</b><span class="num">' + fmtT(c.t) + '</span></button>'; }).join('') + '</div></div>';
  let h = '<div class="pview pchords" id="pchords">' + nowHTML() + '<div class="chgrid">', last = '';
  bars.forEach((b, bi) => {
    const t1 = bi + 1 < bars.length ? bars[bi + 1].t : b.t + (b.cells.length ? (b.cells[b.cells.length - 1] - b.t) * (b.cells.length / Math.max(1, b.cells.length - 1)) : 2), len = Math.max(0.01, t1 - b.t);
    const parts = [];
    for (let i = Math.max(0, chordAt(t, b.t + 0.02)); i < L.length && L[i].t < t1 - 0.05; i++) {
      const a0 = Math.max(b.t, L[i].t), a1 = Math.min(t1, L[i].t + L[i].d);
      if (a1 - a0 < len * 0.12 && parts.length) continue; // короче полудоли — не дробить такт
      parts.push({ c: L[i].c, f: Math.max(0.15, (a1 - a0) / len) });
    }
    if (!parts.length) parts.push({ c: null, f: 1 });
    const fn0 = (chordInfo(t, parts[0].c) || {}).fn || 'x';
    h += '<button class="chb fn-' + fn0 + '" data-bt="' + b.t + '" data-bar="' + bi + '" aria-label="' + ui.esc(tr('pv.bar', { n: bi + 1 })) + '"><span class="chbn num">' + (bi + 1) + '</span><span class="chps">' +
      parts.map((p) => { const inf = chordInfo(t, p.c), txt = inf ? inf.txt : '·', rep = parts.length === 1 && txt === last; if (inf) last = txt; return '<i class="fn-' + ((inf && inf.fn) || 'x') + (rep ? ' rep' : '') + '" style="flex:' + p.f.toFixed(2) + '">' + ui.esc(txt) + '</i>'; }).join('') +
      '</span><i class="chpg"></i></button>';
    PV.barT.push(b.t);
  });
  return h + '</div></div>';
}
function lyricsViewHTML(t) {
  const { ui } = ctx, tr = ctx.t, L = t.lyr && Array.isArray(t.lyr.lines) ? t.lyr.lines : [];
  if (!L.length) return '<div class="pview pempty"><span>' + ui.esc(tr(ctx.jobs && ctx.jobs.lyricsSupported() ? 'pv.noText' : 'lyr.pc')) + '</span>' + (ctx.jobs && ctx.jobs.lyricsSupported() ? '<button class="btn sm" data-x="astems">' + ui.esc(tr('lyr.go', { t: fmtT(estimateLyricsSec(t.dur || 60)) })) + '</button>' : '') + '</div>';
  return '<div class="pview plyr" id="plyr">' + L.map((l, i) => '<p data-li="' + i + '" data-bt="' + l.t + '">' + ui.esc(l.text) + '</p>').join('') + '</div>';
}
function stemsViewHTML(t) {
  const { ui } = ctx, tr = ctx.t, set = stemsFor(t);
  if (!set.length) {
    const j = ctx.jobs && ctx.jobs.current && ctx.jobs.current.id === t.id && ctx.jobs.current.kind === 'stems' ? ctx.jobs.current : null;
    return '<div class="pview pempty"><span>' + ui.esc(j ? tr('job.' + j.stage) + (j.frac ? ' · ' + Math.round(j.frac * 100) + ' %' : '') : tr(ctx.auto && ctx.auto.waitsPc && ctx.auto.waitsPc(t) ? 'pv.pcWait' : ctx.jobs && ctx.jobs.supported() ? 'pv.noStems' : ctx.jobs && ctx.jobs.pack && ctx.jobs.pack() ? 'stems.packHint' : 'stems.web')) + '</span>' + (ctx.jobs && ctx.jobs.supported() && !j ? '<button class="btn sm" data-x="astems">' + ui.esc(tr('stems.go', { t: fmtT(estimateSec(t.dur || 60, (ctx.auto && ctx.auto.mode()) || '4', !!(ctx.auto && ctx.auto.hq()))) })) + '</button>' : ctx.jobs && ctx.jobs.pack && ctx.jobs.pack() ? '<button class="btn sm" data-x="astems">' + ui.esc(tr('pack.get')) + '</button>' : '') + '</div>';
  }
  return '<div class="pview pstems">' + stemRowsHTML(t, set) + '<div class="row pstbtns"><button class="btn sm" data-x="astems">' + ui.esc(tr('stems.btn')) + '</button>' + (mixActive(t) ? '<button class="btn sm" data-x="asreset">' + ui.esc(tr('stems.reset')) + '</button>' : '') + '</div></div>';
}
// переключатель видов — одной полосой над транспортом
function pswHTML() {
  const tr = ctx.t, v = pview(), ic = { wave: I.wave, stems: I.stems, text: I.text, chords: I.chords };
  return '<div class="pvsw" role="tablist">' + PVIEWS.map((k) => '<button class="pvb' + (k === v ? ' on' : '') + '" role="tab" aria-selected="' + (k === v) + '" data-x="apv" data-v="' + k + '" aria-label="' + ctx.ui.esc(tr('pv.' + k)) + '">' + ic[k] + '<span>' + ctx.ui.esc(tr('pv.' + k)) + '</span></button>').join('') + '</div>';
}
// тело панели по виду (full и half); волна — как раньше
function pviewHTML(c, d, half) {
  const t = AU.cur, v = pview();
  if (v === 'stems') return stemsViewHTML(t) + atimes(c, d, anaTxt(t));
  if (v === 'text') return lyricsViewHTML(t) + atimes(c, d, anaTxt(t));
  if (v === 'chords') return chordsViewHTML(t) + atimes({ ...c, chord: '' }, d, anaTxt(t)); // «сейчас» — в самом виде, строка под ним не нужна
  return half ? '<div class="wfbox">' + wformHTML('h2') + '<span class="wft num">' + c.time + '</span></div>' + c.lyr + marksHTML() : wformHTML('f') + atimes(c, d) + c.lyr + marksHTML();
}

/* ---------- щелчки по долям записи (метроном по разбору: rec.ana.beats, сильные — downbeats) ---------- */
const CL = { timer: 0, last: -1, downs: null, downFor: null };
const clickOn = () => !!st().pclick && !!(AU.cur && AU.cur.ana && Array.isArray(AU.cur.ana.beats) && AU.cur.ana.beats.length);
function clickTick() {
  if (!clickOn() || !AU.cur || pl().paused) { clearInterval(CL.timer); CL.timer = 0; CL.last = -1; return; }
  const bus = ctx.audio.bus('metro'), ac = bus.context, B = AU.cur.ana.beats, pos = pl().currentTime, rate = AU.rate || 1;
  if (CL.downFor !== AU.cur) { CL.downFor = AU.cur; CL.downs = new Set((AU.cur.ana.downbeats || []).map((x) => Math.round(x * 100))); }
  if (CL.last < 0 || CL.last > pos + 0.05 || CL.last < pos - 1.5) CL.last = pos; // старт или перемотка
  const ahead = pos + 0.35 * rate;
  let lo = 0, hi = B.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (B[m] <= CL.last) lo = m + 1; else hi = m; }
  for (let i = lo; i < B.length && B[i] <= ahead; i++) {
    const at = ac.currentTime + Math.max(0, (B[i] - pos) / rate);
    voice(ac, bus, at, CL.downs.has(Math.round(B[i] * 100)) ? 2 : 1, 'beep', null);
    CL.last = B[i];
  }
}
function clickStart() { if (!clickOn() || CL.timer) return; CL.last = -1; CL.timer = setInterval(clickTick, 100); clickTick(); }

function keySheet() {
  const { t, ui } = ctx, song = ctx.song(curSong()), tr = AU.cur;
  const ana = () => (tr.ana && tr.ana.pc != null ? tr.ana : (st().pana || {})[tr.id]);
  const body = () => {
    const [p, c] = pitchOf(tr), a = ana();
    const ruler = '<div class="hscroll kruler" id="kruler">' + Array.from({ length: 25 }, (_, i) => i - 12).map((v) =>
      '<button type="button" class="pill num' + (v ? '' : ' k0') + '" data-ks="' + v + '" aria-pressed="' + (v === p) + '">' + sgn(v) + '</button>').join('') + '</div>';
    const cents = '<div class="kcents">' + ui.icb('data-kcs="-1"', '−', t('key.centsDown'), 'sm txt') +
      '<input type="range" min="-50" max="50" step="1" value="' + c + '" data-kc aria-label="' + t('key.cents') + '"><b class="num" id="kcv">' + sgn(c) + '¢</b>' + ui.icb('data-kcs="1"', '+', t('key.centsUp'), 'sm txt') + '</div>';
    const det = a ? '<div class="kdet"><span>' + t('key.orig') + ' <b>' + keyName(a.pc, a.minor) + '</b>' + (p ? ' → <b>' + keyName(a.pc + p, a.minor) + '</b>' : '') + '</span>' +
      (a.cents != null ? '<span>' + t('key.tuning') + ' <b class="num">' + sgn(a.cents) + '¢</b></span>' : '') + '</div>' +
      (Math.abs(a.cents || 0) >= 3 ? '<button class="cell act" data-ktune>' + t('key.tuneTo', { n: sgn(-a.cents) }) + '</button>' : '')
      : '<div class="kdet l2" id="kdet">' + t('key.detecting') + '</div>';
    return ui.snav(t('key.title')) + '<div class="group"><div class="cellcol"><span>' + t('key.semi') + '</span>' + ruler + '</div>' +
      '<div class="cellcol"><span>' + t('key.cents') + '</span>' + cents + '</div></div>' +
      '<div class="hdr">' + t('key.byRec') + '</div><div class="group"><div class="cellcol">' + det + '</div>' +
      (song && song.tr ? '<button class="cell act" data-ktr>' + t('key.fromSong', { n: sgn(song.tr) }) + '</button>' : '') +
      '<button class="cell act" data-k0>' + t('key.reset') + '</button></div>' +
      '<div class="group"><button class="cell act" data-kform aria-pressed="' + formantOn() + '"><span class="grow">' + t('key.formant') + '<span class="bksub">' + t('key.formantHint') + '</span></span><span class="val">' + (formantOn() ? '✓' : '') + '</span></button></div>' +
      '<p class="ftr">' + t('key.hint') + '</p>';
  };
  const center = (el) => { const r = el.querySelector('#kruler'), on = r && r.querySelector('[aria-pressed="true"]'); if (on) r.scrollLeft += on.getBoundingClientRect().left - r.getBoundingClientRect().left - (r.clientWidth - on.offsetWidth) / 2; };
  ui.sheet(body, (el, sh) => {
    requestAnimationFrame(() => center(el)); setTimeout(() => center(el), 320); // и после того, как шторка выехала
    const upd = () => { sh.update(); requestAnimationFrame(() => center(el)); };
    // тональность и строй записи — один раз на запись
    if (!ana()) import('../../core/songanalyze.js').then((m) => m.analyzeAudio(tr.blob)).then((r) => {
      const all = st().pana || (st().pana = {});
      all[tr.id] = { pc: r.key ? r.key.pc : 0, minor: !!(r.key && r.key.minor), cents: r.tuning ? r.tuning.cents : null };
      ctx.store.save();
      if (el.isConnected) upd();
    }).catch(() => { const d = el.querySelector('#kdet'); if (d) d.textContent = t('key.detectFail'); });
    el.addEventListener('input', (e) => {
      if (!e.target.matches('[data-kc]')) return;
      const [p] = pitchOf(tr), v = +e.target.value;
      setPitch(p, v);
      const kv = el.querySelector('#kcv'); if (kv) kv.textContent = sgn(v) + '¢';
    });
    el.addEventListener('click', (e) => {
      const [p, c] = pitchOf(tr), b = e.target.closest('[data-ks], [data-kcs], [data-ktr], [data-k0], [data-ktune], [data-kform]');
      if (!b) return;
      if (b.hasAttribute('data-kform')) { st().formant = !formantOn(); ctx.store.save(); applyPitch().catch(() => {}); upd(); return; }
      if (b.dataset.ks != null) setPitch(+b.dataset.ks, c);
      else if (b.dataset.kcs != null) setPitch(p, c + +b.dataset.kcs);
      else if (b.hasAttribute('data-ktr')) setPitch(song.tr, c);
      else if (b.hasAttribute('data-ktune')) setPitch(p, -ana().cents);
      else setPitch(0, 0);
      upd();
    });
  });
}

// Шторка «Дорожки и ноты» записи (обработки — src/core/jobs.js). Дорожки: режим 2 / 4 / 6; есть набор — микшер,
// громкость каждой дорожки (0…150 %) и выключение, действует вместе с тональностью и скоростью, «В студии» — проект
// из дорожек; набора нет — «Разделить» (ход и «Прервать»; в фоне то же делает src/core/autostems.js).
// Ноты (Basic Pitch, src/audio/transcribe.js): снять, послушать, открыть в «Табах» или в студии.
// Все дорожки на 100 % — играет исходная запись; иначе звук собирается из дорожек в движке (loadParts/setMix)
let LN = null; // прослушивание нот: таймеры звука
function listenNotes(rec) {
  if (LN) { LN.forEach(cancel); LN = null; return false; }
  const ev = (rec.take && rec.take.ev) || [], on = new Map();
  ev.forEach((e) => { if (e.k === 'on') on.set(e.id, e); });
  if (!pl().paused) pl().pause();
  LN = [];
  ev.forEach((e) => { if (e.k !== 'off') return; const s = on.get(e.id); if (!s) return; LN.push(after(s.t * 1000, () => ctx.audio.playNote(Math.round(s.m), { dur: Math.max(0.08, e.t - s.t), preset: 'piano' }))); });
  const end = ev.length ? ev[ev.length - 1].t : 0;
  LN.push(after(end * 1000 + 300, () => { LN = null; }));
  return true;
}
const jobErr = (e) => { const { t } = ctx; if (e && e.message === 'cancel') ctx.ui.toast(t('job.cancelled')); else if (e && e.message === 'busy') ctx.ui.toast(t('job.busy')); else { ctx.logErr(e); ctx.ui.toast(t('job.fail')); } };
// Текст из записи → текст песни, к которой она привязана; песни нет — шторка привязки (меню записи)
function lyricsToSong(tr, sh) {
  const { t, ui } = ctx, lines = (tr.lyr && tr.lyr.lines) || [], sid = (tr.songs || [])[0], song = sid && ctx.songs().find((s) => s.id === sid);
  if (!lines.length) return;
  if (!song) { ui.toast(t('lyr.noSong')); sh.close(); menuSheet(tr.id); return; }
  const write = () => { if (ctx.songText(song.id, lyricsText(lines))) ui.toast(t('lyr.toSongDone', { name: song.title })); };
  if (song.text) ui.confirm(t('lyr.replaceTitle'), t('lyr.replaceText', { name: song.title }), write); else write();
}

function stemsSheet() {
  const { t, ui } = ctx, tr = AU.cur, jobs = ctx.jobs;
  if (!tr || !jobs) return;
  const hq = () => !!(ctx.auto && ctx.auto.hq());
  let can = jobs.supported('2');
  const job = () => (jobs.current && jobs.current.id === tr.id ? jobs.current : null);
  const first = stemsFor(tr)[0];
  let m = (first && first.stem.mode) || (ctx.auto && ctx.auto.mode()) || '4';
  // телефон — только вокал и инструментал, компьютер — 2 / 4 / 6; уже посчитанные на телефоне 4 и 6 дорожек — видны
  const MODES = [...new Set([...modesHere(), ...(first ? [first.stem.mode || '4'] : [])])].sort();
  if (!MODES.includes(m)) m = MODES.includes('4') ? '4' : '2';
  const progress = (j, sel) => {
    const pct = Math.round((j.frac || 0) * 100), run = j.stage === 'separate' || j.stage === 'run' || j.stage === 'lyr' || (j.kind === 'denoise' && j.stage === 'run'), gone = (Date.now() - (j.stageAt || j.t0)) / 1000;
    const left = run && j.frac > 0.02 ? Math.max(0, gone / j.frac - gone) : 0;
    return '<div class="cellcol sjob"><span class="grow">' + ui.esc(t('job.' + j.stage)) + (j.hq ? ' · ' + ui.esc(t('stems.verHq').toLowerCase()) : '') + (run ? ' · <b class="num">' + pct + ' %</b>' + (left ? ' · ' + ui.esc(t('job.left', { t: fmtT(left) })) : '') : '') + '</span><div class="sbar"><b style="width:' + pct + '%"></b></div></div>' +
      '<button class="cell act center" ' + sel + '>' + ui.esc(t('job.cancel')) + '</button>';
  };
  const body = () => {
    const j = job(), set = stemsFor(tr, m), notes = notesOf(ctx.files, tr.id), absent = ((tr.stemsAbsent && tr.stemsAbsent[m]) || []);
    can = jobs.supported(m); // телефон DEV: 4 и 6 дорожек — из пакета «Полное разделение»
    let h = ui.snav(t('stems.title')) + '<div class="group"><div class="cellcol">' + (MODES.length > 1 ? ui.seg('smode', MODES.map((k) => [k, k]), m, t('stems.modeTitle')) : '') + '<div class="segcap">' + ui.esc(t('stems.mode.' + m)) + '</div></div>';
    if (j && j.kind === 'stems') h += progress(j, 'data-sjcancel');
    else if (set.length) {
      h += stemRowsHTML(tr, set) +
        '<button class="cell act" data-sreset>' + ui.esc(t('stems.reset')) + '</button>' + (ctx.hasTool('looper') ? '<button class="cell act" data-sstudio>' + ui.esc(t('stems.toStudio')) + '</button>' : '');
    } else if (can) h += '<button class="cell act center b" data-sgo>' + ui.esc(t('stems.go', { t: fmtT(estimateSec(tr.dur || 60, m, hq())) })) + '</button>' + (jobs.busy() ? '<div class="cellcol"><span class="l2">' + ui.esc(t('job.busy')) + '</span></div>' : '');
    else if (jobs.pack && jobs.pack(m) && ctx.packs) h += ctx.packs.row(jobs.pack(m)); // модель — в пакете, ещё не скачана
    else h += '<div class="cellcol"><span class="l2">' + ui.esc(t('stems.web')) + '</span></div>';
    // «ночное» качество — один переключатель с настройкой «Дорожки автоматически»: в фоне пересчитает и готовые наборы
    if (can && !(j && j.kind === 'stems')) {
      // обе версии есть — выбор; улучшенное включено, а есть только обычная — «Улучшить»
      if (set.length && hasVer(tr, m, true) && hasVer(tr, m, false)) h += '<div class="cellcol"><span>' + ui.esc(t('stems.ver')) + '</span>' + ui.seg('sver', [['std', t('stems.verStd')], ['hq', t('stems.verHq')]], verOf(tr), t('stems.ver')) + '</div>';
      h += '<button class="cell act" data-shq aria-pressed="' + hq() + '"><span class="grow">' + ui.esc(t('stems.hq')) + '<span class="bksub">' + ui.esc(t(hqVocalsModel() ? 'stems.hqHintPc' : 'stems.hqHint')) + '</span></span><span class="val">' + (hq() ? '✓' : '') + '</span></button>' +
        (hq() && jobs.hqPack && jobs.hqPack() && ctx.packs ? ctx.packs.row(jobs.hqPack()) + '<div class="cellcol"><span class="l2">' + ui.esc(t('stems.hqPackHint')) + '</span></div>' : '') + // телефон DEV: улучшенный вокал — пакетом
        (set.length && hq() && !hasVer(tr, m, true) ? '<button class="cell act center" data-sgo>' + ui.esc(t('stems.improve', { t: fmtT(estimateSec(tr.dur || 60, m, true)) })) + '</button>' : '');
    }
    h += '</div>';
    if (set.length && absent.length) h += '<p class="ftr">' + ui.esc(t('stems.absent', { list: absent.map((p) => t('part.' + p)).join(', ') })) + '</p>';
    else h += '<p class="ftr">' + ui.esc(t(set.length ? 'stems.hint' : can ? 'stems.goHint' : jobs.pack && jobs.pack(m) ? (m === '2' ? 'stems.packHint' : 'stems.packHintFull') : 'stems.webHint')) + '</p>';
    // ноты
    h += '<div class="hdr">' + ui.esc(t('notes.hdr')) + '</div><div class="group">';
    if (j && j.kind === 'notes') h += progress(j, 'data-njcancel');
    else if (notes) h += '<button class="cell act" data-nlisten aria-pressed="' + !!LN + '"><span class="grow">' + ui.esc(t('notes.n', { n: notes.notes || 0 })) + (notes.score && notes.score.parts ? '<span class="bksub">' + ui.esc(notes.score.parts.map((p) => t('ymt.part.' + p.key)).join(' · ')) + '</span>' : '') + '</span><span class="val">' + ui.esc(t(LN ? 'notes.stop' : 'notes.listen')) + '</span></button>' +
      '<button class="cell act" data-ntabs>' + ui.esc(t('notes.toTabs')) + '</button>' + (ctx.hasTool('looper') ? '<button class="cell act" data-nstudio>' + ui.esc(t('notes.toStudio')) + '</button>' : '') + (jobs.notesSupported() ? '<button class="cell act" data-ngo>' + ui.esc(t('notes.redo')) + '</button>' : '');
    else if (!jobs.notesSupported()) h += '<div class="cellcol"><span class="l2">' + ui.esc(t('notes.pcOnly')) + '</span></div>'; // телефон: ноты снимает компьютер
    else if (jobs.notesPro && jobs.notesPro()) h += '<div class="cellcol"><span class="l2">' + ui.esc(t('notes.proHint')) + '</span></div>' +
      '<button class="cell act center b" data-ngo>' + ui.esc(t('notes.goPro', { t: fmtT(estimateYmtSec(tr.dur || 60)) })) + '</button>' + (jobs.busy() ? '<div class="cellcol"><span class="l2">' + ui.esc(t('job.busy')) + '</span></div>' : '');
    else h += '<div class="cellcol"><span>' + ui.esc(t('notes.sens')) + '</span>' + ui.seg('nsens', [['normal', t('notes.sensNormal')], ['high', t('notes.sensHigh')]], st().nsens || 'normal', t('notes.sens')) + '</div>' +
      '<button class="cell act" data-nbends aria-pressed="' + !!st().nbends + '"><span class="grow">' + ui.esc(t('notes.bends')) + '<span class="bksub">' + ui.esc(t('notes.bendsHint')) + '</span></span><span class="val">' + (st().nbends ? '✓' : '') + '</span></button>' +
      '<button class="cell act center b" data-ngo>' + ui.esc(t('notes.go')) + '</button>' + (jobs.busy() ? '<div class="cellcol"><span class="l2">' + ui.esc(t('job.busy')) + '</span></div>' : '');
    h += '</div><p class="ftr">' + ui.esc(t(notes ? 'notes.doneHint' : 'notes.hint')) + '</p>';
    // текст песни — whisper на компьютере (Windows); на телефоне — строка о том, где он есть
    const lyr = tr.lyr && Array.isArray(tr.lyr.lines) ? tr.lyr : null, canLyr = jobs.lyricsSupported();
    h += '<div class="hdr">' + ui.esc(t('lyr.hdr')) + '</div><div class="group">';
    if (j && j.kind === 'lyrics') h += progress(j, 'data-ljcancel');
    else if (lyr) h += '<div class="cellcol"><span>' + ui.esc(t('lyr.n', { n: lyr.lines.length })) + (lyr.lang ? ' · ' + ui.esc(lyr.lang.toUpperCase()) : '') + '</span><div class="lyrprev">' + lyr.lines.slice(0, 3).map((l) => ui.esc(l.text)).join('<br>') + (lyr.lines.length > 3 ? '<br>…' : '') + '</div></div>' +
      '<button class="cell act" data-lsong>' + ui.esc(t('lyr.toSong')) + '</button><button class="cell act" data-llrc>' + ui.esc(t('lyr.lrc')) + '</button>' + (canLyr ? '<button class="cell act" data-lgo>' + ui.esc(t('lyr.redo')) + '</button>' : '');
    else if (canLyr) h += '<button class="cell act center b" data-lgo>' + ui.esc(t('lyr.go', { t: fmtT(estimateLyricsSec(tr.dur || 60)) })) + '</button>' + (jobs.busy() ? '<div class="cellcol"><span class="l2">' + ui.esc(t('job.busy')) + '</span></div>' : '');
    else h += '<div class="cellcol"><span class="l2">' + ui.esc(t('lyr.pc')) + '</span></div>';
    h += '</div><p class="ftr">' + ui.esc(t(lyr ? 'lyr.doneHint' : canLyr ? 'lyr.hint' : 'lyr.pcHint')) + '</p>';
    // шум — DeepFilterNet на компьютере (Windows); результат — новый файл рядом
    if (jobs.denoiseSupported() && !tr.dn) {
      const dn = denoisedOf(ctx.files, tr.id);
      h += '<div class="hdr">' + ui.esc(t('dn.hdr')) + '</div><div class="group">';
      if (j && j.kind === 'denoise') h += progress(j, 'data-djcancel');
      else h += (dn ? '<button class="cell act" data-dplay="' + ui.esc(dn.id) + '"><span class="grow">' + ui.esc(dn.name) + '</span><span class="val">' + ui.esc(t('dn.play')) + '</span></button>' : '') +
        '<div class="cellcol"><span>' + ui.esc(t('dn.level')) + '</span>' + ui.seg('dnlvl', [['full', t('dn.full')], ['soft', t('dn.soft')]], st().dnlvl || 'full', t('dn.level')) + '</div>' +
        '<button class="cell act center b" data-dgo>' + ui.esc(t(dn ? 'dn.redo' : 'dn.go', { t: fmtT(estimateDenoiseSec(tr.dur || 60)) })) + '</button>' + (jobs.busy() ? '<div class="cellcol"><span class="l2">' + ui.esc(t('job.busy')) + '</span></div>' : '');
      h += '</div><p class="ftr">' + ui.esc(t('dn.hint')) + '</p>';
    }
    return h;
  };
  const apply = () => mixApply(tr);
  const setMode = (v) => { m = v; (st().pmode ??= {})[tr.id] = v; ctx.store.save(); if (mixActive(tr)) apply(null); };
  let un = null, tick = 0;
  ui.sheet(body, (el, sh) => {
    sh.el = el;
    un = jobs.subscribe(() => { if (el.isConnected) sh.update(); });
    const unp = ctx.packs ? ctx.packs.onChange(() => { if (el.isConnected) sh.update(); else unp(); }) : null;
    tick = setInterval(() => { if (job() && el.isConnected) sh.update(); }, 1000);
    el.addEventListener('input', (e) => { const i = e.target.closest('[data-sg]'); if (!i) return; mixSet(tr, i.dataset.sg, +i.value / 100); mixApply(tr); refreshStemRows(el, tr); });
    el.addEventListener('click', async (e) => {
      const pk = e.target.closest('[data-pkget], [data-pkcancel]');
      if (pk && ctx.packs) { if (pk.dataset.pkget) ctx.packs.ask(pk.dataset.pkget); else ctx.packs.cancel(pk.dataset.pkcancel); return; }
      const b = e.target.closest('[data-smute], [data-sreset], [data-sstudio], [data-sgo], [data-shq], [data-sjcancel], [data-njcancel], [data-ngo], [data-nlisten], [data-ntabs], [data-nstudio], [data-nbends], [data-lgo], [data-lsong], [data-llrc], [data-ljcancel], [data-dgo], [data-dplay], [data-djcancel], [data-seg="dnlvl"] [data-v], [data-seg="smode"] [data-v], [data-seg="sver"] [data-v], [data-seg="nsens"] [data-v]');
      if (!b) return;
      const d = b.dataset;
      if (d.smute != null) { mixToggle(tr, d.smute); mixApply(tr); refreshStemRows(el, tr); return; }
      if (b.hasAttribute('data-sreset')) { const all = st().pmix || {}; delete all[tr.id]; mixApply(tr); refreshStemRows(el, tr); return; }
      if (b.closest('[data-seg="smode"]')) { setMode(d.v); sh.update(); return; }
      if (b.closest('[data-seg="sver"]')) { (st().pver ??= {})[tr.id] = d.v; ctx.store.save(); if (mixActive(tr)) apply(null); sh.update(); return; }
      if (b.closest('[data-seg="nsens"]')) { st().nsens = d.v; ctx.store.save(); sh.update(); return; }
      if (b.hasAttribute('data-nbends')) { st().nbends = !st().nbends; ctx.store.save(); sh.update(); return; }
      if (b.hasAttribute('data-sjcancel') || b.hasAttribute('data-njcancel') || b.hasAttribute('data-ljcancel') || b.hasAttribute('data-djcancel')) { jobs.cancel(); return; }
      if (b.closest('[data-seg="dnlvl"]')) { st().dnlvl = d.v; ctx.store.save(); sh.update(); return; }
      if (b.hasAttribute('data-dgo')) { jobs.denoise(tr, { atten: st().dnlvl === 'soft' ? 18 : null }).then((r) => { ctx.ui.toast(t('dn.saved', { name: r.name })); render(); }).catch(jobErr); sh.update(); return; }
      if (d.dplay) { const x = ctx.files.get(d.dplay); if (x) { sh.close(); load(x); playEl(); render(); } return; }
      if (b.hasAttribute('data-lgo')) { jobs.lyrics(tr).then((r) => { ctx.ui.toast(r.lines.length ? t('lyr.saved', { n: r.lines.length }) : t('lyr.none')); render(); }).catch(jobErr); sh.update(); return; }
      if (b.hasAttribute('data-lsong')) { lyricsToSong(tr, sh); return; }
      if (b.hasAttribute('data-llrc')) { const name = tr.name.replace(/\.[a-z0-9]+$/i, '') + '.lrc'; ctx.sendFile(new TextEncoder().encode(toLrc(tr.lyr.lines, { title: tr.name.replace(/\.[a-z0-9]+$/i, '') })), name, name, 'text/plain').catch(jobErr); return; }
      if (b.hasAttribute('data-shq')) { if (ctx.auto) ctx.auto.setHq(!hq()); sh.update(); return; }
      if (b.hasAttribute('data-sgo')) { setMode(m); jobs.separate(tr, m, { hq: hq() }).then((r) => { ctx.ui.toast(t(r.stems.length ? 'stems.saved' : 'stems.none')); }).catch(jobErr); sh.update(); return; }
      if (b.hasAttribute('data-ngo')) { jobs.notes(tr, { sens: st().nsens || 'normal', bends: !!st().nbends }).then((r) => { ctx.ui.toast(r.notes ? t('notes.saved', { n: r.notes }) : t('notes.none')); }).catch(jobErr); sh.update(); return; }
      if (b.hasAttribute('data-sstudio')) { // «В лупер»: дорожки — слоями петли с первой сильной доли, длина — по темпу записи
        const set = stemsFor(tr, m), a = tr.ana || {};
        sh.close(); ctx.openIn('looper', { inbox: { kind: 'stems', ids: set.map((r) => r.id), bpm: a.bpm || 0, off: (a.downbeats && a.downbeats[0]) || 0 } }); return;
      }
      const notes = notesOf(ctx.files, tr.id);
      if (!notes) return;
      if (b.hasAttribute('data-nlisten')) { listenNotes(notes); sh.update(); return; }
      if (b.hasAttribute('data-ntabs')) { sh.close(); ctx.openIn('notes', { lastTab: notes.id, sec: 'midi' }); return; }
      if (b.hasAttribute('data-nstudio')) {
        try {
          const song = readMidiSong(new Uint8Array(await notes.blob.arrayBuffer()));
          song.name = tr.name.replace(/\.[a-z0-9]+$/i, '');
          if (tr.ana && tr.ana.bpm) song.bpm = tr.ana.bpm;
          const p = projectFromSong(song);
          if (isEmptyProject(p)) { ctx.ui.toast(t('notes.none')); return; }
          if (notes.score && notes.score.inst) p.tracks.forEach((x) => { if (x.kind === 'notes') x.inst = notes.score.inst; }); // звук по характеру нот (долгие — пэд, низкие — бас)
          ctx.projects.save(p); sh.close(); ctx.openIn('looper', { inbox: { kind: 'proj', pid: p.id, temp: true } }); // партиями в лупер
        } catch (err) { jobErr(err); }
      }
    });
  }, { onClose: () => { if (un) un(); clearInterval(tick); if (LN) listenNotes(); render(); } });
}

// Подпись записи в списке: тональность и темп (rec.ana — src/core/autostems.js) и сколько дорожек
const anaTxt = (x) => { const a = x.ana; if (!a) return ''; return [a.pc != null ? keyName(a.pc, a.minor) : '', a.bpm ? '♩ ' + a.bpm + (a.bpb ? ' · ' + a.bpb + '/4' : '') : ''].filter(Boolean).join(' '); };
const stemsTxt = (x) => { if (x.stem) return ''; const n = stemsFor(x).length; return n ? ctx.tn('stemsN', n) : ''; };
const rateTxt = () => ctx.num(AU.rate, AU.rate * 100 % 10 ? 2 : AU.rate % 1 ? 1 : 0) + '×';
// Ступени скорости (разбор отрезка: 50 → 75 → 90 → 100 %): четыре значения на устройстве; касание значения скорости — следующая ступень по кругу
const RATES_DEF = [0.5, 0.75, 0.9, 1];
const rates = () => { const r = st().rates; return Array.isArray(r) && r.length === 4 ? r.map((x) => Math.max(0.5, Math.min(1.5, +x || 1))) : RATES_DEF.slice(); };
function nextRate() { const R = rates(), i = R.findIndex((x) => Math.abs(x - AU.rate) < 0.001); return R[(i + 1) % R.length]; }
const sizeMb = (r) => ctx.t('mb', { n: ctx.num((r.size || 0) / MB, 1) });

// Один элемент на всё: <video> играет и аудио. Он всегда в документе — в окне плеера или в скрытом
// хранилище: браузер ставит на паузу медиа, вынутое из документа, а музыка должна идти и при закрытом окне.
function holder() {
  let h = document.getElementById('medHold');
  if (!h) { h = document.createElement('div'); h.id = 'medHold'; h.hidden = true; document.body.appendChild(h); }
  return h;
}
const park = () => { if (AU.el && AU.el.parentNode !== holder()) holder().appendChild(AU.el); };

// Одни обработчики на элемент и на движок
const PLAY_EV = {
  play: () => { loopStart(); if (document.querySelector('.mlist') && !document.activeElement?.hasAttribute?.('data-mlq')) render(); },
  pause: () => { if (document.querySelector('.mlist') && !document.activeElement?.hasAttribute?.('data-mlq')) render(); },
  ended: () => { if (host && host.querySelector('#vdisc') && !AU.loop) { try { pl().currentTime = 0; } catch { /* ignore */ } } },
};
// Движок звука: создаётся один раз, когда есть контекст (после первого жеста); запись t загружается в него.
// Не вышло (нет AudioWorklet, не раскодировалось) — запись идёт элементом
async function engineLoad(t) {
  if (!stretchAvailable() || AU.noEngine || !ctx.audio.unlock()) return false;
  try {
    // Движок создаётся один раз, даже если выбор записи и нажатие «играть» пришли одновременно (иначе два движка
    // на одной шине и гонка загрузок — на телефоне кончалась тишиной)
    if (!AU.eng) {
      AU.engP ??= (async () => {
        const dest = ctx.audio.bus('media');
        const wire = (eng) => {
          ['play', 'pause', 'ended'].forEach((k) => eng.addEventListener(k, PLAY_EV[k]));
          eng.addEventListener('loadedmetadata', () => { const x = AU.cur; if (x && !x.dur && eng.duration) { x.dur = eng.duration; ctx.files.save(x); } render(); });
          // ошибка в потоке звука — процессор узла мёртв, дальше он молчит: сразу запасной движок с того же места,
          // не дожидаясь сторожа (он работает только после «играть» из приложения)
          eng.addEventListener('procerror', (e) => {
            ctx.log('движок: ошибка в потоке звука: ' + (e.detail || '?'), 'w');
            const t = AU.cur;
            if (t && AU.eng === eng && !AU.engLite && !AU.noEngine) engineFallback(t, 'ошибка в потоке звука');
          });
          return eng;
        };
        // запасной движок на обычных узлах (bufferplayer.js): когда AudioWorklet Signalsmith на устройстве молчит —
        // дорожки, перемотка и громкости работают, тональность — нет
        if (AU.engLite || globalThis.__liteEngine) { AU.engLite = true; return wire(await createBufferPlayer(dest.context, dest)); }
        const eng = wire(await createStretchPlayer(dest.context, dest));
        // самопроверка: короткий тон через узел при нулевой громкости — молчит ли движок на этом устройстве
        try {
          const r = await eng.selfTest();
          if (r) {
            const info = Math.round(r.db) + ' дБ, ' + r.sampleRate + ' Гц, ' + r.state + ', задержка ' + Math.round(r.lat * 1000) + ' мс, каналов ' + r.channels + (r.err ? ', ошибка: ' + r.err : '');
            if (r.db < -60) { AU.engLite = true; ctx.log('движок не прошёл самопроверку — запасной движок без тональности (' + info + ')', 'w'); return wire(await createBufferPlayer(dest.context, dest)); }
            ctx.log('движок: самопроверка ' + info);
          }
        } catch (e) { ctx.logErr(e); }
        return eng;
      })();
      AU.eng = await AU.engP;
    }
    const set = mixActive(t) ? stemsFor(t) : [], key = t.id + ':' + set.map((r) => r.id).join(',');
    if (AU.loadP && AU.loadKey === key) return AU.loadP; // та же запись уже грузится — одна загрузка на всех
    AU.engFor = t; AU.loadKey = key;
    AU.loadP = (async () => {
      try {
        // волна — из того же раскодированного звука, что идёт в движок (второй раз файл не раскодируется)
        AU.eng.onPcm = set.length || isVideo(t) ? null : (L, R, sr) => { if (t.pkv !== PKV) { setPeaks(t, peaksOf([L, R], L.length, 32768), L.length / sr); if (AU.cur === t) repaintWave(); } };
        if (set.length) { AU.partsFor = t; await AU.eng.loadParts(blobsOf(set), mixOf(t)); } else { AU.partsFor = null; await AU.eng.load(t.blob); }
        AU.eng.onPcm = null;
        if (needPeaks(t)) computePeaks(t); // дорожки или движок не отдал звук — посчитать отдельно
        if (AU.engFor !== t || AU.cur !== t) return false; // пока грузили — выбрали другое
        ctx.log('движок: файл ' + t.id + (set.length ? ' (дорожки ' + set.length + ')' : '') + ', ' + Math.round(AU.eng.duration) + ' с');
        AU.eng.playbackRate = AU.rate;
        AU.engOn = true;
        try { if (!AU.el.paused) AU.el.pause(); AU.el.removeAttribute('src'); AU.el.load(); } catch { /* */ }
        applyPitch().catch(() => {});
        return true;
      } finally { if (AU.loadKey === key) AU.loadP = null; }
    })();
    return await AU.loadP;
  } catch (e) { ctx.logErr(e); return false; }
}
// Звук — в движок (сразу или при первом воспроизведении, когда появится контекст); видео — элемент
async function routeTrack(t) {
  if (!isVideo(t) && stretchAvailable() && !AU.noEngine && await engineLoad(t)) return true;
  // запасной путь — элемент: движка нет или он молчит на этом устройстве; элементу — эта запись, не прежняя
  if (AU.cur === t && AU.el.src !== AU.url) { AU.el.src = AU.url; AU.el.playbackRate = AU.rate; }
  return false;
}

function ensureEl(c) {
  if (AU.el) return;
  AU.el = document.createElement('video');
  AU.el.playsInline = true;
  AU.el.setAttribute('playsinline', '');
  AU.el.preload = 'auto';
  holder().appendChild(AU.el);
  ['preservesPitch', 'webkitPreservesPitch', 'mozPreservesPitch'].forEach((k) => { try { AU.el[k] = true; } catch { /* ignore */ } });
  AU.el.addEventListener('loadedmetadata', () => {
    AU.el.playbackRate = AU.rate;
    const t = AU.cur;
    // Длительность и вид файла уточняем по самому файлу (mp4 бывает и без картинки)
    if (t) {
      const v = AU.el.videoWidth > 0, d = AU.el.duration;
      if (t.video !== v || (!t.dur && Number.isFinite(d))) { t.video = v; if (!t.dur && Number.isFinite(d)) t.dur = d; ctx.files.save(t); }
    }
    render();
  });
  // Во весь экран — со стандартными кнопками браузера; пока так, окно не перерисовываем
  AU.el.addEventListener('fullscreenchange', () => { AU.el.controls = document.fullscreenElement === AU.el; if (!AU.el.controls) render(); });
  AU.el.addEventListener('webkitendfullscreen', () => render());
  AU.el.addEventListener('error', () => { if (AU.cur && ctx) ctx.ui.toast(ctx.t('cantPlay')); });
  ['play', 'pause', 'ended'].forEach((k) => AU.el.addEventListener(k, PLAY_EV[k]));
  const vol = () => { AU.el.volume = AU.shift ? 1 : c.audio.mixer.elementVolume('media'); };
  vol();
  c.audio.mixer.subscribe(vol);
  c.audio.mixer.probe('media', () => !!(AU.cur && !pl().paused));
}

// Повтор A–B и тренер темпа, пока идёт воспроизведение
function loopStart() {
  if (AU.raf) return;
  const tick = () => {
    if (pl().paused) { AU.raf = 0; return; }
    if (AU.loop && AU.b != null && pl().currentTime >= AU.b) {
      pl().currentTime = AU.a || 0;
      if (AU.step && AU.rate < 1) {
        setRate(Math.min(1, AU.rate + 0.05));
        const rv = host && host.querySelector('#ratev');
        if (rv) rv.textContent = rateTxt();
        if (ctx) ctx.ui.toast(ctx.t('rateToast', { rate: rateTxt() }));
      }
    }
    AU.raf = requestAnimationFrame(tick);
  };
  AU.raf = requestAnimationFrame(tick);
}

function load(t) {
  st().last = st().last || {};
  st().last[audKey()] = t.id;
  (st().used ??= {})[t.id] = Date.now(); // недавние — первыми в фоновой очереди (src/core/autostems.js)
  ctx.store.save();
  if (AU.url) URL.revokeObjectURL(AU.url);
  AU.cur = t;
  AU.url = URL.createObjectURL(t.blob);
  if (AU.engOn) { AU.engOn = false; try { AU.eng.pause(); } catch { /* */ } }
  AU.partsFor = null;
  AU.el.defaultPlaybackRate = AU.rate;
  AU.el.playbackRate = AU.rate;
  AU.a = AU.b = null;
  AU.loop = false;
  const viaEngine = !isVideo(t) && stretchAvailable() && !AU.noEngine && ctx.audio.ready();
  if (!viaEngine) AU.el.src = AU.url; // видео, нет движка (или он молчит) или контекста ещё нет (до первого жеста): элемент, движок — при первом воспроизведении
  if (!isVideo(t) && stretchAvailable() && !AU.noEngine) routeTrack(t).then(() => render()).catch(() => {});
  else applyPitch().catch(() => {});
}

// Шторка одной ступени скорости (удержание кнопки): ползунок 50…150 %, «Как было» — заводские 50/75/90/100
function rateSheet(i) {
  const { t, ui } = ctx; if (i < 0) return;
  const R = rates();
  ui.sheet(() => ui.snav(t('rpre.title')) + '<div class="group"><div class="cellcol"><span>' + t('rpre.step', { n: i + 1 }) + ' · <b class="num" id="rpv">' + Math.round(R[i] * 100) + ' %</b></span>' +
    '<input type="range" min="50" max="150" step="5" value="' + Math.round(R[i] * 100) + '" data-rpv aria-label="' + t('rpre.step', { n: i + 1 }) + '"></div></div>' +
    '<div class="group" style="margin-top:12px"><button class="cell center" data-rpdef>' + t('rpre.def') + '</button></div>',
  (el, sh) => {
    el.addEventListener('input', (e) => { if (!e.target.hasAttribute('data-rpv')) return; R[i] = +e.target.value / 100; const v = el.querySelector('#rpv'); if (v) v.textContent = e.target.value + ' %'; st().rates = R.slice().sort((a, b) => a - b); ctx.store.save(); render(); });
    el.addEventListener('click', (e) => { if (!e.target.closest('[data-rpdef]')) return; delete st().rates; ctx.store.save(); sh.close(); render(); });
  });
}

function setRate(r) {
  AU.rate = Math.max(0.5, Math.min(1.5, Math.round(r * 100) / 100));
  AU.el.defaultPlaybackRate = AU.rate;
  AU.el.playbackRate = AU.rate;
  if (AU.eng) AU.eng.playbackRate = AU.rate;
}

const playEl = async () => {
  const t = AU.cur;
  ctx.audio.release(); // «играть» снимает паузу из шторки уведомлений
  if (t && !AU.engOn && !isVideo(t) && stretchAvailable() && AU.engFor !== t) { // контекста не было при выборе — теперь жест есть
    const at = AU.el.currentTime || 0;
    if (await routeTrack(t)) { if (at) AU.eng.currentTime = at; }
  }
  if (AU.shift && !AU.engOn) applyPitch().catch(() => {});
  const r = pl().play().catch(() => ctx.ui.toast(ctx.t('cantPlay')));
  soundCheck(t);
  return r;
};
// Движок молчит (сторож ниже) — дальше в этом запуске звук идёт медиа-элементом с того же места; сдвиг высоты —
// прежним путём (pitchShifter). В журнал — предупреждение: по отчёту видно, что на устройстве движок не звучит
function engineFallback(t, why) {
  const at = pl().currentTime, was = !pl().paused;
  try { AU.eng.pause(); } catch { /* */ }
  AU.engOn = false; AU.engFor = null; AU.partsFor = null;
  if (!AU.engLite) { // первый раз — запасной движок на обычных узлах, с того же места
    AU.engLite = true; AU.engP = null; AU.eng = null; AU.loadP = null; AU.loadKey = '';
    ctx.log('движок молчит (' + why + ') — запасной движок без тональности', 'w');
    engineLoad(t).then((ok) => { if (!ok) { engineFallback(t, why); return; } AU.eng.currentTime = at; if (was) AU.eng.play().catch(() => {}); soundCheck(t); render(); });
    return;
  }
  AU.noEngine = true;
  try { AU.el.src = AU.url; AU.el.playbackRate = AU.rate; AU.el.currentTime = at; } catch { /* */ }
  if (was) AU.el.play().catch(() => {});
  if (AU.shift) applyPitch().catch(() => {});
  ctx.log('движок молчит (' + why + ') — звук через элемент', 'w');
  render();
}
// Сторож тишины — в журнал: через 2,5 с игры замеряется уровень на выходе приложения (после компрессора); тишина при
// играющем плеере — предупреждение с подробностями (путь, контекст, шина) — для отчёта о проблеме
let SC = { an: null, buf: null, id: '' };
function soundCheck(t) {
  const key = t && t.id + (AU.engLite ? ':lite' : '');
  if (!t || SC.id === key) return;
  SC.id = key;
  // анализатор подключается сейчас, замер — позже: сразу после подключения в нём ещё нули
  if (!SC.an) { const tp = ctx.audio.tap(); if (!tp) { ctx.log('играет ' + t.id + ': контекста звука нет', 'w'); return; } SC.an = tp.ctx.createAnalyser(); SC.an.fftSize = 2048; SC.an.smoothingTimeConstant = 0; SC.buf = new Float32Array(2048); tp.into(SC.an); }
  setTimeout(() => {
    try {
      if (AU.cur !== t || pl().paused) return;
      const tp = ctx.audio.tap(); if (!tp) return;
      SC.an.getFloatTimeDomainData(SC.buf);
      let e = 0, bad = 0; for (const v of SC.buf) { if (!Number.isFinite(v)) bad++; e += v * v; }
      const db = Math.round(20 * Math.log10(Math.sqrt(e / SC.buf.length) + 1e-9));
      const info = (AU.engOn ? 'движок' : 'элемент') + ', ' + tp.ctx.state + ', шина ' + ctx.audio.mixer.value('media') + ', ' + Math.round(pl().currentTime * 10) / 10 + ' с, ' + (t.type || '?');
      if (db < -60 || bad) {
        ctx.log('играет ' + t.id + ', а на выходе тишина (' + db + ' дБ' + (bad ? ', NaN' : '') + '): ' + info, 'w');
        if (AU.engOn && !AU.noEngine) engineFallback(t, db + ' дБ'); // движок молчит на этом устройстве — звук элементом, до перезапуска
      }
      else ctx.log('играет ' + t.id + ': ' + db + ' дБ, ' + info);
    } catch (e) { ctx.logErr(e); }
  }, 2500);
}

// Выбранный в этом месте файл (свободная практика или песня) ждёт готовым
function autoAudio() {
  const sid = curSong();
  if (AU.cur && (!sid || inSong(AU.cur, sid))) return;
  const lid = (st().last || {})[audKey()], list = tracks();
  let t = list.find((x) => x.id === lid && (!sid || inSong(x, sid)));
  if (!t && sid) t = list.find((x) => inSong(x, sid));
  if (t && t !== AU.cur) { try { if (!pl().paused) pl().pause(); } catch { /* ignore */ } load(t); }
}

/* ---------- волна ---------- */

// Волна — средняя громкость (RMS) столбика в децибелах, 36 дБ ниже самого громкого — пусто: тихое и громкое
// различимы. По пикам длинная запись выглядела сплошной стеной: в каждый столбик (секунды звука) попадает
// громкий пик. PKV — версия расчёта: волны, посчитанные по-старому, пересчитываются.
const PKV = 2, NPK = 480, RANGE = 36;
function peaksOf(ch, len, full = 1) {
  const step = Math.max(1, Math.floor(len / NPK)), hop = Math.max(1, Math.floor(step / 512)), out = new Float32Array(NPK);
  let mx = 0;
  for (let i = 0; i < NPK; i++) {
    const s = i * step, e = Math.min(len, s + step);
    let sum = 0, n = 0;
    for (let j = s; j < e; j += hop) for (const d of ch) { const v = d[j] / full; sum += v * v; n++; }
    const r = n ? Math.sqrt(sum / n) : 0;
    out[i] = r; if (r > mx) mx = r;
  }
  if (!mx) return Array(NPK).fill(0);
  return Array.from(out, (r) => { const db = 20 * Math.log10(r / mx + 1e-9); return Math.round(Math.max(0, Math.min(1, (db + RANGE) / RANGE)) * 100) / 100; });
}
function setPeaks(t, pk, dur) { t.peaks = pk; t.pkv = PKV; if (dur) t.dur = dur; t._busy = false; ctx.files.save(t); }
// перерисовать только волну (кнопки и остальное не трогать)
function repaintWave() { const w = host && host.querySelector('#wform'); if (!w) { render(); return; } const tmp = document.createElement('div'); tmp.innerHTML = wformHTML(wfCls(w)); w.replaceWith(tmp.firstChild); }
const needPeaks = (t) => !t.peaks || (t.peaks.length && t.pkv !== PKV);

async function computePeaks(t) {
  if (!needPeaks(t) || t._busy) return;
  // У видео волну не строим: файл большой, а целиком декодировать звук ради картинки дорого — вместо волны шкала
  if (isVideo(t)) { t.peaks = []; t.pkv = PKV; ctx.files.save(t); return; }
  // открытую запись раскодирует движок плеера — волна придёт оттуда (onPcm), второй раз не раскодируем
  if (t === AU.cur && AU.loadP && AU.engFor === t) return;
  t._busy = true;
  try {
    const C = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext, oc = new C(1, 8000, 8000);
    const buf = await oc.decodeAudioData(await t.blob.arrayBuffer());
    const ch = [];
    for (let c = 0; c < buf.numberOfChannels; c++) ch.push(buf.getChannelData(c));
    setPeaks(t, peaksOf(ch, ch[0].length), buf.duration);
  } catch { t.peaks = []; t.pkv = PKV; t._busy = false; }
  if (t === AU.cur) repaintWave(); else render();
}

let queueBusy = false;
async function queuePeaks() {
  if (queueBusy) return;
  queueBusy = true;
  try { for (const t of tracks().slice()) if (needPeaks(t) && !t._busy) await computePeaks(t); } catch { /* ignore */ }
  queueBusy = false;
}

function wformHTML(cls) {
  const t = AU.cur, d = pl().duration || 0, { t: tr } = ctx;
  if (!t.peaks) { computePeaks(t); return '<div class="wform ' + cls + ' wait" id="wform"><span class="l2">' + tr('waveWait') + '</span><i class="wfhead" id="wfhead"></i></div>'; }
  if (t.pkv !== PKV && t.peaks.length) computePeaks(t); // старая волна видна, пока считается новая
  const flat = !t.peaks.length, pk = flat ? Array(120).fill(0.15) : t.peaks, N = pk.length;
  let p = '';
  pk.forEach((v, i) => { const hh = Math.max(1.5, v * 46); p += 'M' + (i + 0.5) + ' ' + (50 - hh) + 'V' + (50 + hh); });
  const ax = d && AU.a != null ? (AU.a / d) * N : null, bx = d && AU.b != null ? (AU.b / d) * N : null;
  const mk = d ? (t.marks || []).map((m, i) => '<i class="wfm" style="left:' + (m.t / d) * 100 + '%"><b>' + (i + 1) + '</b></i>').join('') : '';
  // такты (сильные доли) — штрихи, аккорды — полоса внизу волны (подпись видна, если отрезок достаточно широк)
  const db = d && t.ana && Array.isArray(t.ana.downbeats) && t.ana.downbeats.length <= 600 ? t.ana.downbeats.map((x) => '<i class="wfdb" style="left:' + (x / d) * 100 + '%"></i>').join('') : '';
  const CH = chordsOf(t), ch = d && CH.length ? '<div class="wfch" id="wfch">' + CH.map((c, i) => '<i data-ci="' + i + '" style="left:' + (c.t / d) * 100 + '%;width:' + (c.d / d) * 100 + '%"' + (c.c ? '' : ' class="no"') + '><span>' + chordTxt(c.c, t) + '</span></i>').join('') + '</div>' : '';
  return '<div class="wform ' + cls + (flat ? ' flat' : '') + '" id="wform" role="slider" tabindex="0" aria-label="' + tr('waveAria') + '" aria-valuemin="0" aria-valuemax="' + Math.round(d) +
    '" aria-valuenow="' + Math.round(pl().currentTime) + '"><svg viewBox="0 0 ' + N + ' 100" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="wfc"><rect id="wfclip" x="0" y="0" width="' +
    (d ? (pl().currentTime / d) * N : 0) + '" height="100"/></clipPath></defs>' +
    (ax != null ? '<rect class="wfloop" x="' + ax + '" y="0" width="' + ((bx != null ? bx : ax + 0.6) - ax) + '" height="100"/>' : '') +
    '<path class="wfbase" d="' + p + '"/><path class="wfplayed" d="' + p + '" clip-path="url(#wfc)"/></svg>' +
    (ax != null ? '<i class="wfh a" data-h="a" style="left:' + (ax / N) * 100 + '%"><b>A</b></i>' : '') +
    (bx != null ? '<i class="wfh b" data-h="b" style="left:' + (bx / N) * 100 + '%"><b>B</b></i>' : '') + mk +
    db + ch + '<i class="wfhead" id="wfhead" style="left:' + (d ? (pl().currentTime / d) * 100 : 0) + '%"></i></div>';
}

// Класс размера волны (f, h2, s, q) — чтобы перерисовать её на том же месте
const wfCls = (w) => [...w.classList].find((c) => !['wform', 'wait', 'flat'].includes(c)) || 's';

/* ---------- разметка ---------- */

const icb = (...a) => ctx.ui.icb(...a);
const esc = (s) => ctx.ui.esc(s);
const hueOf = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };

function artHTML(t, cls) {
  const pk = t.peaks && t.peaks.length ? t.peaks : null;
  let p = '';
  if (pk) {
    const N = 28, s = pk.length / N;
    for (let i = 0; i < N; i++) { const v = pk[Math.floor(i * s)] || 0, hh = Math.max(1, v * 12); p += 'M' + (4 + i * 1.15).toFixed(2) + ' ' + (20 - hh).toFixed(1) + 'V' + (20 + hh).toFixed(1); }
  }
  return '<span class="mlart ' + (cls || '') + '" style="--h:' + hueOf(t.name) + '">' + (isVideo(t) ? I.film : pk ? '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="' + p + '"/></svg>' : ICON) +
    (AU.cur && AU.cur.id === t.id && !pl().paused ? '<i class="eq"><b></b><b></b><b></b></i>' : '') + '</span>';
}

// Окно видео: сам элемент вставляется после перерисовки (place). Нажатие — играть или пауза
const vidbox = (cls) => '<div class="vidbox ' + cls + '" data-x="aplay" aria-label="' + ctx.t('playPause') + '" role="button" tabindex="0">' +
  (cls === 'f' || cls === 'h' ? '<button class="ic sm vfs" data-x="afs" aria-label="' + ctx.t('fullscreen') + '">' + I.full + '</button>' : '') + '</div>';

// Тайм-коды: «+ метка», метки (нажать — перейти), «все» — список с названиями и повтором
function marksHTML() {
  const { t } = ctx, ms = AU.cur.marks || [], k = currentMark(ms, pl().currentTime);
  return '<div class="chips nowrap amarks" role="group" aria-label="' + t('marks') + '"><button class="chip amadd" data-x="amadd" aria-label="' + t('markAdd') + '">' + I.flag + t('mark') + '</button>' +
    ms.map((m, i) => '<button class="chip amk' + (i === k ? ' on' : '') + '" data-x="amj" data-i="' + i + '" aria-label="' + esc(t('markGo', { n: i + 1, time: fmtT(m.t) })) + '"><b>' + (i + 1) + '</b>' +
      esc(m.name || fmtT(m.t)) + '</button>').join('') +
    (ms.length ? '<button class="chip amall" data-x="amlist" aria-label="' + t('marksAll') + '">' + I.list + '</button>' : '') + '</div>';
}

function songTitles(t, except) {
  const all = ctx.songs();
  return fileSongs(t).map((id) => all.find((s) => s.id === id)).filter(Boolean).filter((s) => s.id !== except).map((s) => esc(s.title));
}

// Соседняя запись в том же порядке, что в списке медиатеки (сортировка и поиск), по кругу; играет сразу.
// Метроном и пэды не трогаются — идут дальше вместе с записью
function remoteStep(d) {
  let list = tracks().slice();
  if (ML.q) { const q = foldQ(ML.q); list = list.filter((x) => foldQ(x.name).includes(q)); }
  const so = { date: (a, b) => (b.created || 0) - (a.created || 0), name: (a, b) => a.name.localeCompare(b.name, ctx.lang()), size: (a, b) => (b.size || 0) - (a.size || 0), dur: (a, b) => (b.dur || 0) - (a.dur || 0) };
  list.sort(so[ML.sort] || so.date);
  if (!list.length) return;
  const i = AU.cur ? list.findIndex((x) => x.id === AU.cur.id) : -1, x = list[(i + d + list.length) % list.length];
  load(x); playEl();
  if (host) render();
}

// Пульт с другого устройства (Melete DEV, шаг 2): что звучит, дорожки с громкостью — и команды
const netRemote = {
  state() {
    const x = AU.cur, p = AU.el ? pl() : null;
    return { id: x ? x.id : null, name: x ? x.name || '' : '', dur: (p && p.duration) || (x && x.dur) || 0, pos: (p && p.currentTime) || 0, playing: !!(x && p && !p.paused), rate: AU.rate,
      key: x ? pitchOf(x)[0] : 0, stems: x ? stemsFor(x).map((r) => ({ part: r.stem.part, v: mixVal(x, r.stem.part) })) : [] };
  },
  async cmd(c) {
    const x = AU.cur;
    if (c.a === 'open') { const r = ctx.files.get(c.id); if (r && !r.stem) { load(r); await playEl(); } }
    else if (c.a === 'play' && x) { if (pl().paused) await playEl(); else pl().pause(); }
    else if (c.a === 'seek' && x) pl().currentTime = Math.max(0, Math.min(pl().duration || x.dur || 0, +c.t || 0));
    else if (c.a === 'step') remoteStep(c.d < 0 ? -1 : 1);
    else if (c.a === 'stem' && x && c.part) { mixSet(x, c.part, +c.v); mixApply(x); }
    else if (c.a === 'rate') setRate(+c.r || 1);
    else if (c.a === 'key' && x) setPitch(+c.p || 0, pitchOf(x)[1]);
    if (host) render();
  },
};
function libHTML() {
  const { t, tn } = ctx;
  let list = tracks().slice();
  queuePeaks();
  if (ML.q) { const q = foldQ(ML.q); list = list.filter((x) => foldQ(x.name).includes(q)); }
  if (ML.f === 'songs') list = list.filter((x) => fileSongs(x).length);
  else if (ML.f === 'free') list = list.filter((x) => !fileSongs(x).length);
  const so = { date: (a, b) => (b.created || 0) - (a.created || 0), name: (a, b) => a.name.localeCompare(b.name, ctx.lang()), size: (a, b) => (b.size || 0) - (a.size || 0), dur: (a, b) => (b.dur || 0) - (a.dur || 0) };
  list.sort(so[ML.sort] || so.date);
  const all = tracks(), tot = all.reduce((s, x) => s + (x.size || 0), 0), totd = all.reduce((s, x) => s + (x.dur || 0), 0), sel = ML.sel;
  if (sel) [...sel].forEach((id) => { if (!ctx.files.get(id)) sel.delete(id); });
  const allOn = sel && list.length && list.every((x) => sel.has(x.id));
  let h = '<div class="medlib"><div class="mlhead">' + (sel
    ? '<button class="link mlsall" data-x="mlsall">' + t(allOn ? 'selNone' : 'selAll') + '</button><b class="mlselt" aria-live="polite">' + t('selN', { n: sel.size }) + '</b><button class="link b" data-x="mlseloff">' + t('done') + '</button>'
    : '<label class="mlsearch">' + I.search + '<input type="search" data-mlq placeholder="' + t('search') + '" aria-label="' + t('search') + '" value="' + esc(ML.q) + '"></label>' +
      (all.length ? '<button class="link mlselon" data-x="mlselon">' + t('select') + '</button>' : '') + icb('data-x="aadd"', I.plus, t('addFile'), 'sm')) + '</div>' +
    '<div class="mlbar"><div class="mlfil" role="group">' + [['all', t('f.all')], ['songs', t('f.songs')], ['free', t('f.free')]].map(([k, n]) => '<button class="' + (ML.f === k ? 'on' : '') +
      '" data-x="mlf" data-v="' + k + '" aria-pressed="' + (ML.f === k) + '">' + n + '</button>').join('') + '</div><select class="sortsel" data-mls aria-label="' + t('sort') + '">' +
    [['date', t('s.date')], ['name', t('s.name')], ['dur', t('s.dur')], ['size', t('s.size')]].map(([v, l]) => '<option value="' + v + '"' + (ML.sort === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>';
  // записи MIDI (игра в пианино, глайдере, терменвоксе): касание — открыть инструмент и проиграть
  const midis = ML.f === 'songs' ? [] : ctx.files.list('midi').filter((x) => !ML.q || foldQ(x.name).includes(foldQ(ML.q))).sort((a, b) => (b.created || 0) - (a.created || 0));
  const midiHTML = midis.length && !sel ? '<div class="mlmh2">MIDI</div><div class="mlist">' + midis.map((x) => {
    const tl = ctx.midi.tool(x.tool), nm = x.name.replace(/\.midi?$/i, '');
    return '<div class="mlrow"><button class="mlmain" data-x="mmplay" data-id="' + x.id + '" aria-label="' + esc(t('playX', { name: nm })) + '"><span class="mlart midi" style="--mc:' + (tl ? tl.color : 'var(--tint)') + '">' + (tl ? tl.icon : ICON) + '</span>' +
      '<span class="mltxt"><b>' + esc(nm) + '</b><small>' + [tl ? esc(tl.name) : '', x.dur ? fmtT(x.dur) : ''].filter(Boolean).join(' · ') + '</small></span></button>' +
      '<button class="ic sm plain mlmore" data-x="mmmenu" data-id="' + x.id + '" aria-label="' + esc(t('fileActions', { name: nm })) + '">' + I.more + '</button></div>';
  }).join('') + '</div>' : '';
  if (!all.length && midiHTML) h += midiHTML;
  else if (!all.length) h += '<div class="aempty"><div class="aeico">' + ICON + '</div><div class="aet">' + t('emptyLib') + '</div><div class="ael">' + t('emptyLibText') + '</div><div class="group aeg"><button class="cell act" data-x="aadd">' + t('upload') + '</button></div></div>';
  else if (!list.length) h += '<div class="aempty"><div class="ael">' + t('notFound') + '</div></div>';
  else {
    h += '<div class="mlist">' + list.map((x) => {
      const sn = songTitles(x), cur = AU.cur && AU.cur.id === x.id, mk = (x.marks || []).length;
      const info = [x.dur ? fmtT(x.dur) : '', anaTxt(x), stemsTxt(x), sizeMb(x), mk ? t('marksN', { n: mk }) : '', sn.join(', ')].filter(Boolean).join(' · ');
      if (sel) {
        const on = sel.has(x.id);
        return '<div class="mlrow' + (on ? ' cur' : '') + '"><button class="mlmain" data-x="mlsel" data-id="' + x.id + '" role="checkbox" aria-checked="' + on + '"><span class="mlchk' + (on ? ' on' : '') + '">' +
          (on ? ctx.ui.icons.check : '') + '</span>' + artHTML(x) + '<span class="mltxt"><b>' + esc(x.name) + '</b><small>' + info + '</small></span></button></div>';
      }
      return '<div class="mlrow' + (cur ? ' cur' : '') + '"><button class="mlmain" data-x="mlplay" data-id="' + x.id + '" aria-label="' + t(cur && !pl().paused ? 'pauseX' : 'playX', { name: x.name }) +
        '">' + artHTML(x) + '<span class="mltxt"><b>' + esc(x.name) + '</b><small>' + info +
        '</small></span></button><button class="ic sm plain mlmore" data-x="mlmenu" data-id="' + x.id + '" aria-label="' + t('fileActions', { name: x.name }) + '">' + I.more + '</button></div>';
    }).join('') + '</div>';
    h += midiHTML;
  }
  if (all.length) h += '<p class="ftr" style="text-align:center">' + tn('files', all.length) + (totd ? ' · ' + fmtDur(totd) : '') + ' · ' + t('onDevice', { mb: ctx.num(tot / MB, 1) }) + (all.length > 1 && !sel ? '<br>' + t('holdSelect') : '') + '</p>';
  h += '</div>';
  if (sel) {
    const n = sel.size ? '' : ' disabled';
    h += '<div class="mlselbar"><button class="cell act" data-x="mlsong"' + n + '>' + t('toSongs') + '</button>' +
      '<button class="cell act" data-x="mlsend"' + n + '>' + t('selSend') + '</button><button class="cell act" data-x="mlconv"' + n + '>' + t('selConv') + '</button>' +
      '<button class="ic sm mldel" data-x="mldel" aria-label="' + t('delSel') + '"' + n + '>' + I.trash + '</button></div>';
  } else if (AU.cur) {
    h += '<div class="mlmini"><button class="mlmmain" data-x="mlopen" aria-label="' + t('openPlayer') + '">' + (isVideo(AU.cur) ? '<span class="vidbox mini"></span>' : artHTML(AU.cur, 'sm')) + '<span class="mltxt"><b>' + esc(AU.cur.name) +
      '</b><small><span id="acur" class="num">' + fmtT(pl().currentTime) + '</span>' + (AU.rate !== 1 ? ' · ' + rateTxt() : '') + '</small></span></button><button class="bigplay mlpl" data-x="aplay" id="aplay" aria-label="' +
      t('playPause') + '">' + (pl().paused ? I.play : I.pause) + '</button><i class="mlprog"><b id="mlprog" style="width:' + (pl().duration ? (pl().currentTime / pl().duration) * 100 : 0) + '%"></b></i></div>';
  }
  return '<div class="mlwrap">' + h + '</div>';
}

function controls() {
  const { t } = ctx, ab = AU.b != null ? 'on' : AU.a != null ? 'a' : '';
  return {
    play: '<button class="bigplay" data-x="aplay" id="aplay" aria-label="' + t('playPause') + '">' + (pl().paused ? I.play : I.pause) + '</button>',
    rate: icb('data-step="arate" data-d="-1"', I.minus, t('slower'), 'sm') + '<button class="ratev num" id="ratev" data-x="arate1" aria-label="' + t('rate1') + '">' + rateTxt() + '</button>' +
      icb('data-step="arate" data-d="1"', I.plus, t('faster'), 'sm'),
    // ступени скорости: касание — поставить, удержание — изменить значение ступени
    rpre: '<span class="rpres" role="group" aria-label="' + t('rpre.title') + '">' + rates().map((r) => '<button class="rpre num' + (Math.abs(r - AU.rate) < 0.001 ? ' act' : '') + '" data-rpre="' + r + '" aria-label="' +
      t('rpre.aria', { p: Math.round(r * 100) }) + '">' + Math.round(r * 100) + '</button>').join('') + '</span>',
    // тональность без изменения скорости: ♭/♯ — полутон, нажатие на значение — шторка (полутоны, центы, сброс)
    key: '<span class="vrow tight akey">' + icb('data-step="akey" data-d="-1"', '♭', t('key.down'), 'sm txt') + '<button class="ratev num" id="keyv" data-x="akeysheet" aria-label="' + t('key.title') + '">' + keyTxt() + '</button>' +
      icb('data-step="akey" data-d="1"', '♯', t('key.up'), 'sm txt') + '</span>',
    stems: ctx.jobs ? icb('data-x="astems"', I.stems, t('stems.btn'), 'sm' + (mixActive(AU.cur) ? ' act' : '')) : '',
    // щелчки по долям записи (есть разбор) — кнопка-переключатель
    click: AU.cur.ana && Array.isArray(AU.cur.ana.beats) && AU.cur.ana.beats.length ? '<button class="ic sm' + (st().pclick ? ' act' : '') + '" data-x="aclick" aria-pressed="' + !!st().pclick + '" aria-label="' + t('pv.click') + '">' + I.click + '</button>' : '',
    back: icb('data-x="aback"', I.back5, t('back5')),
    fwd: icb('data-x="afwd"', I.fwd5, t('fwd5')),
    abb: '<button class="ic txt' + (ab === 'on' ? ' act' : '') + '" data-x="aab" aria-pressed="' + (ab === 'on') + '" aria-label="' + t('ab') + '">' + (ab === 'a' ? 'B?' : 'A–B') + '</button>',
    stepb: '<button class="ic txt sm' + (AU.step ? ' act' : '') + '" data-x="astep" aria-pressed="' + AU.step + '" aria-label="' + t('stepUp') + '">+5%↻</button>',
    list: icb('data-x="alist"', I.list, t('files.btn')),
    time: '<span id="acur" class="num">' + fmtT(pl().currentTime) + '</span>',
    chord: chordsOf(AU.cur).length ? '<b class="achord" id="achord"></b>' : '', // текущий и следующий аккорд (uiTick)
    lyr: AU.cur.lyr && Array.isArray(AU.cur.lyr.lines) && AU.cur.lyr.lines.length ? '<div class="alyr" id="alyr"><span></span></div>' : '', // текущая строка текста (uiTick)
    sty: (cls) => (ctx.mono ? '' : icb('data-x="astyle"', I.disc, t('styleBtn'), cls)), // в «Минимале» вид закреплён
    back2: !curSong() && ML.view === 'player' ? '<button class="mlback" data-x="mllib">' + t('backLib') + '</button>' : '',
  };
}

function vinylHTML() {
  const { t } = ctx, tr = AU.cur, d = pl().duration || 0, fr = d ? pl().currentTime / d : 0, R = 46, C = 2 * Math.PI * R, c = controls();
  setTimeout(vinStart, 0);
  const disc = '<div class="vdisc" id="vdisc" style="--h:' + hueOf(tr.name) + '" role="group" aria-label="' + t('discAria') + '"><svg viewBox="0 0 100 100" class="vring" aria-hidden="true"><circle cx="50" cy="50" r="' + R +
    '" class="vtrk"/><path id="vab" class="vab" d=""/><g id="vabm"></g><circle cx="50" cy="50" r="' + R + '" class="vprog" id="vprog" stroke-dasharray="' + (C * fr).toFixed(1) + ' ' + C.toFixed(1) +
    '" transform="rotate(-90 50 50)"/></svg><span class="vrec"><i class="vgr"></i><span class="vlab"><b>' + esc(tr.name.slice(0, 18)) + '</b></span><i class="vhole"></i></span><span class="varm" style="transition:none;transform:rotate(' +
    (!pl().paused || pl().currentTime > 0.05 ? 5 + 27 * fr : -6).toFixed(2) + 'deg)" aria-label="' + t('armAria') + '"></span><button class="vstate" data-x="aplay" aria-label="' + t('playPause') + '">' +
    (!pl().paused ? I.pause : I.play) + '</button></div>';
  const time = '<div class="vtime num"><span id="acur">' + fmtT(pl().currentTime) + '</span> / ' + fmtT(d) + '</div>';
  if (size === 'strip') return '<div class="srow2 vstrip">' + disc + '<div class="sgrow" style="min-width:0;text-align:left"><div class="aname">' + esc(tr.name) + '</div>' + time + '</div><div class="vrow tight">' + c.rate + '</div></div>';
  if (size === 'quarter') return '<div class="vq vqv">' + disc + time + '<div class="vrow tight">' + c.rate + '</div></div>';
  return '<div class="vwrap ' + size + '">' + c.back2 + '<div class="vtop"><div class="aname sgrow" style="text-align:left">' + esc(tr.name) + '</div>' + c.sty('sm') + '</div><div class="vbody">' + disc +
    '<div class="vside">' + time + wformHTML('s') + marksHTML() + '<div class="vrow tight vrate">' + c.rate + '</div><div class="vrow tight vrate">' + c.key + '</div><div class="ctrl5 vctl">' + c.list + c.back + c.fwd + c.abb + '</div></div></div></div>';
}

function playerHTML() {
  const { t } = ctx, sid = curSong();
  autoAudio();
  if (!sid && (size === 'full' || size === 'half') && !(ML.view === 'player' && AU.cur)) return libHTML();
  const all = tracks();
  if (!AU.cur) {
    const add = icb('data-x="aadd"', I.plus, t('addAudio')), list = icb('data-x="alist"', I.list, t('files.btn'));
    if (size === 'quarter' || size === 'strip') {
      return '<div class="' + (size === 'strip' ? 'srow2' : 'vq') + '"><span class="aeico sm">' + ICON + '</span><span class="bpmlbl sgrow">' + t(sid ? 'noSongAudio' : 'name') + '</span>' +
        (all.length && sid ? icb('data-x="apick"', I.list, t('pickFromLib')) : all.length ? list : '') + add + '</div>';
    }
    return '<div class="aempty"><div class="aeico">' + ICON + '</div><div class="aet">' + t(sid ? 'songEmpty' : 'emptyLib') + '</div><div class="ael">' + t('emptyText') + '</div><div class="group aeg">' +
      '<button class="cell act" data-x="aadd">' + t('upload') + '</button>' + (all.length && sid ? '<button class="cell act" data-x="apick">' + t('pickFromLib') + '</button>' : '') + '</div></div>';
  }
  const c = controls(), d = pl().duration || 0, name = '<div class="aname">' + esc(AU.cur.name) + '</div>';
  if (isVideo(AU.cur)) return videoHTML(c, name, all, sid);
  if (size === 'quarter') return '<div class="vq">' + name + wformHTML('q') + '<div class="l2" style="font-size:12px">' + c.time + '</div>' + c.play + '<div class="vrow tight">' + c.rate + '</div></div>';
  if (size === 'strip') {
    return '<div class="vs"><div class="srow2" style="flex:none">' + name + '<span class="sgrow"></span><span class="l2" style="font-size:12px">' + c.time + '</span></div>' + wformHTML('s') +
      '<div class="srow2" style="flex:none">' + c.back + c.play + c.fwd + '<span class="sgrow"></span><div class="vrow tight">' + c.rate + '</div></div></div>';
  }
  if (style() === 'vinyl') return vinylHTML();
  const sf = sid ? all.filter((x) => inSong(x, sid)) : [];
  const chips = (cls) => '<div class="chips nowrap afiles' + cls + '">' + sf.map((x) => '<button class="chip' + (x.id === AU.cur.id ? ' on' : '') + '" data-x="aload2" data-id="' + x.id + '">' + esc(x.name) + '</button>').join('') + '</div>';
  if (size === 'half') {
    return '<div class="ah2">' + c.back2 + '<div class="arow3">' + (sf.length > 1 ? chips(' sgrow') : '<div class="aname sgrow" style="text-align:left">' + esc(AU.cur.name) + '</div>') +
      '<div class="vrow tight">' + c.rate + c.key + c.click + c.stems + c.sty('sm') + '</div></div>' + pviewHTML(c, d, true) + pswHTML() + '<div class="ctrl5">' +
      c.list + c.back + c.play + c.fwd + c.abb + '</div></div>';
  }
  return '<div class="mcard av pv" data-swtabs style="position:relative">' + c.sty('corner') + c.back2 + (sf.length > 1 ? chips('') : name) + pviewHTML(c, d, false) +
    '<div class="vrow tight arow2">' + c.rate + c.rpre + c.stepb + '</div><div class="vrow tight arow2">' + c.key + c.click + c.stems + '</div>' + pswHTML() + '<div class="ctrl5">' + c.list + c.back + c.play + c.fwd + c.abb + '</div></div>';
}

// строка времени: аккорд, положение, посередине — A–B, иначе подсказка волны (на волне) или тональность и темп (в других видах)
const atimes = (c, d, mid = null) => '<div class="num l2 atimes">' + c.chord + c.time + '<span>' + (AU.a != null ? 'A ' + fmtT(AU.a) + (AU.b != null ? ' – B ' + fmtT(AU.b) : '') : mid != null ? esc(mid) : ctx.t('dragHint')) +
  '</span><span id="adur">' + fmtT(d) + '</span></div>';

// Видео: картинка вместо волны и винила, под ней — шкала с A–B и метками
function videoHTML(c, name, all, sid) {
  const d = pl().duration || 0, sf = sid ? all.filter((x) => inSong(x, sid)) : [];
  const head = sf.length > 1 ? '<div class="chips nowrap afiles">' + sf.map((x) => '<button class="chip' + (x.id === AU.cur.id ? ' on' : '') + '" data-x="aload2" data-id="' + x.id + '">' + esc(x.name) + '</button>').join('') + '</div>' : name;
  if (size === 'strip') return '<div class="srow2 vidstrip">' + vidbox('s') + '<div class="sgrow" style="min-width:0;text-align:left">' + name + '<div class="l2 num vst">' + c.time + ' / ' + fmtT(d) + '</div></div>' + c.back + c.play + '</div>';
  if (size === 'quarter') return '<div class="vq vidq">' + vidbox('q') + wformHTML('s') + '<div class="srow2" style="flex:none">' + c.play + '<span class="l2 num" style="font-size:12px">' + c.time + '</span></div></div>';
  if (size === 'half') {
    return '<div class="ah2 vidh">' + c.back2 + '<div class="arow3"><div class="sgrow" style="min-width:0">' + head + '</div><div class="vrow tight">' + c.rate + c.key + '</div></div>' + vidbox('h') +
      '<div class="wfbox vt">' + wformHTML('s') + '<span class="wft num">' + c.chord + c.time + '</span></div>' + marksHTML() + '<div class="ctrl5">' + c.list + c.back + c.play + c.fwd + c.abb + '</div></div>';
  }
  return '<div class="mcard av vidf">' + c.back2 + head + vidbox('f') + wformHTML('s') + atimes(c, d) + c.lyr + marksHTML() + '<div class="vrow tight arow2">' + c.rate + c.rpre + c.stepb + '</div><div class="vrow tight arow2">' + c.key + c.stems + '</div><div class="ctrl5">' +
    c.list + c.back + c.play + c.fwd + c.abb + '</div></div>';
}

function render() {
  if (!host || !ctx) return;
  // Во весь экран — элемент не трогаем, перерисуем по выходу
  if (AU.el && document.fullscreenElement === AU.el) return;
  host.innerHTML = playerHTML();
  place();
}

// Видео — в окно плеера (или в мини-плеер медиатеки), иначе — обратно в скрытое хранилище
function place() {
  const box = host && AU.cur && isVideo(AU.cur) && host.querySelector('.vidbox');
  if (box) box.prepend(AU.el); else park();
}

/* ---------- обновление по ходу воспроизведения ---------- */

function uiTick() {
  if (!host || !AU.cur) return;
  const q = (s) => host.querySelector(s), d = pl().duration;
  const mp = q('#mlprog');
  if (mp && d) mp.style.width = (pl().currentTime / d) * 100 + '%';
  const wh = q('#wfhead');
  if (wh && d) {
    const fr = pl().currentTime / d;
    wh.style.left = fr * 100 + '%';
    const cl = q('#wfclip');
    if (cl) cl.setAttribute('width', fr * ((AU.cur.peaks || []).length || 120));
    const wf = q('#wform');
    if (wf) wf.setAttribute('aria-valuenow', Math.round(pl().currentTime));
  }
  const c1 = q('#acur');
  if (c1) c1.textContent = fmtT(pl().currentTime);
  const ac = q('#achord');
  if (ac) {
    const L = chordsOf(AU.cur), i = chordAt(AU.cur, pl().currentTime);
    if (ac.dataset.i !== String(i)) {
      ac.dataset.i = i;
      const now = i >= 0 ? chordTxt(L[i].c, AU.cur) : '', nxt = L.slice(i + 1).find((c) => c.c);
      ac.textContent = now ? now + (nxt ? ' → ' + chordTxt(nxt.c, AU.cur) : '') : (nxt ? '→ ' + chordTxt(nxt.c, AU.cur) : '');
      const strip = q('#wfch'); if (strip) { const on = strip.querySelector('.on'); if (on) on.classList.remove('on'); const el = strip.querySelector('[data-ci="' + i + '"]'); if (el) el.classList.add('on'); }
    }
  }
  const ly = q('#alyr');
  if (ly) {
    const L = AU.cur.lyr.lines, i = lineAt(L, pl().currentTime);
    if (ly.dataset.i !== String(i)) { ly.dataset.i = i; const nx = i < 0 ? L.find((l) => l.t > pl().currentTime) : null; ly.firstChild.textContent = i >= 0 ? L[i].text : nx ? '… ' + nx.text : ''; ly.classList.toggle('next', i < 0 && !!nx); }
  }
  const mks = host.querySelectorAll('.amk');
  if (mks.length) { const k = currentMark(AU.cur.marks, pl().currentTime); mks.forEach((b, i) => b.classList.toggle('on', i === k)); }
  // вид «Текст»: текущая строка подсвечена и в поле зрения
  const pl2 = q('#plyr');
  if (pl2) {
    const i = lineAt(AU.cur.lyr.lines, pl().currentTime);
    if (pl2.dataset.i !== String(i)) { pl2.dataset.i = i; const on = pl2.querySelector('.on'); if (on) on.classList.remove('on'); const el = pl2.querySelector('[data-li="' + i + '"]'); if (el) { el.classList.add('on'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
  }
  // вид «Аккорды»: «сейчас» (аккорд, ступень, схема; следующий и через сколько долей) и текущий такт с полосой хода
  const pc = q('#pchords');
  if (pc) {
    const now = pl().currentTime, L = chordsOf(AU.cur), i = chordAt(AU.cur, now + 0.03);
    if (pc.dataset.i !== String(i)) {
      pc.dataset.i = i;
      const inf = i >= 0 ? chordInfo(AU.cur, L[i].c) : null, nx = L.slice(i + 1).find((c) => c.c), ninf = nx ? chordInfo(AU.cur, nx.c) : null;
      const set = (id, v) => { const el = q('#' + id); if (el) el.textContent = v; };
      set('chn', inf ? inf.txt : '—'); set('chdeg', inf ? inf.deg : ''); set('chx', ninf ? ninf.txt : '');
      const cn = q('#chnow'); if (cn) cn.dataset.fn = (inf && inf.fn) || 'x';
      const dg = q('#chdg'); if (dg) dg.innerHTML = inf && inf.frets ? diagramSVG(inf.frets, { barre: inf.barre }) : '';
      const fc = pc.querySelector('.chc.on'); if (fc) fc.classList.remove('on');
      const ff = pc.querySelector('.chc[data-ci="' + i + '"]'); if (ff) { ff.classList.add('on'); ff.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }
    }
    // через сколько долей смена (по долям записи), иначе — секунды
    const nx = L.slice(i + 1).find((c) => c.c), inn = q('#chin');
    if (inn) { const B = (AU.cur.ana && AU.cur.ana.beats) || []; let txt = ''; if (nx) { const n = B.filter((b) => b > now + 0.02 && b <= nx.t + 0.02).length; txt = B.length ? ctx.tn('pv.inBeats', n) : Math.max(0, Math.round(nx.t - now)) + ' ' + ctx.t('pv.sec'); } if (inn.textContent !== txt) inn.textContent = txt; }
    if (PV.barT && PV.barT.length) {
      let lo = 0, hi = PV.barT.length - 1, k = -1;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (PV.barT[m] <= now + 0.03) { k = m; lo = m + 1; } else hi = m - 1; }
      const cur = pc.querySelector('.chb.on');
      if (pc.dataset.k !== String(k)) { pc.dataset.k = k; if (cur) { cur.classList.remove('on'); cur.style.removeProperty('--p'); } const el = pc.querySelector('.chb[data-bar="' + k + '"]'); if (el) { el.classList.add('on'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
      const on = pc.querySelector('.chb.on');
      if (on && k >= 0) { const t1 = PV.barT[k + 1] ?? (k > 0 ? PV.barT[k] + (PV.barT[k] - PV.barT[k - 1]) : PV.barT[k] + 2); on.style.setProperty('--p', Math.max(0, Math.min(1, (now - PV.barT[k]) / Math.max(0.01, t1 - PV.barT[k]))).toFixed(3)); }
    }
  }
  if (!pl().paused && clickOn() && !CL.timer) clickStart();
  const c2 = q('#adur');
  if (c2) c2.textContent = fmtT(d);
  const ap = q('#aplay');
  if (ap) { const w = pl().paused ? 'p' : 's'; if (ap.dataset.st !== w) { ap.dataset.st = w; ap.innerHTML = pl().paused ? I.play : I.pause; } }
}

/* ---------- винил ---------- */

const VIN = { ang: 0, t: 0, drag: null, arm: null, raf: 0 };
const arcD = (cx, cy, r, a0, a1) => {
  const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)], [x0, y0] = p(a0), [x1, y1] = p(a1);
  return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
};

function vinLoop() {
  const d = host && host.querySelector('#vdisc');
  if (!d) { VIN.raf = 0; return; }
  const now = performance.now(), dt = VIN.t ? (now - VIN.t) / 1000 : 0;
  VIN.t = now;
  const rec = d.querySelector('.vrec'), arm = d.querySelector('.varm'), dur = pl().duration || 0, fr = dur ? pl().currentTime / dur : 0, ct = pl().currentTime;
  // перемотка назад (повтор A–B) — пластинка быстро крутится обратно
  if (!VIN.drag && VIN.lt != null && ct < VIN.lt - 0.25) {
    VIN.rw = (VIN.rw || 0) - Math.min(420, ((VIN.lt - ct) / 1.8) * 360);
    d.classList.remove('rew'); void d.offsetWidth; d.classList.add('rew');
  }
  VIN.lt = ct;
  if (VIN.rw) { const s = VIN.rw * Math.min(1, dt * 3.2); VIN.ang = (VIN.ang + s + 3600) % 360; VIN.rw -= s; if (Math.abs(VIN.rw) < 1) VIN.rw = 0; }
  // 33⅓ оборота: один оборот за 1,8 с, с учётом скорости
  const target = !VIN.drag && AU.cur && !pl().paused ? 360 / (1.8 / AU.rate) : 0;
  VIN.w = (VIN.w || 0) + (target - (VIN.w || 0)) * Math.min(1, dt * (target ? 2.2 : 3.2));
  if (!VIN.drag) VIN.ang = (VIN.ang + dt * VIN.w) % 360;
  d.classList.toggle('playing', !pl().paused);
  const key = (AU.a == null ? '-' : AU.a.toFixed(2)) + '|' + (AU.b == null ? '-' : AU.b.toFixed(2)) + '|' + dur.toFixed(1);
  if (d.dataset.abk !== key && dur) {
    d.dataset.abk = key;
    const ab = d.querySelector('#vab'), mk = d.querySelector('#vabm'), ang = (f) => -90 + f * 359.9, hasB = AU.a != null && AU.b != null, prevB = VIN.hadB;
    VIN.hadB = hasB;
    if (ab) {
      if (hasB) {
        ab.setAttribute('pathLength', '100');
        ab.setAttribute('d', arcD(50, 50, 46, ang(AU.a / dur), ang(Math.max(AU.a, AU.b) / dur)));
        ab.classList.remove('out');
        if (!prevB) { ab.classList.remove('in'); void ab.getBoundingClientRect(); ab.classList.add('in'); }
      } else if (prevB && ab.getAttribute('d')) {
        ab.classList.add('out');
        setTimeout(() => { if (!VIN.hadB) ab.setAttribute('d', ''); }, 420);
      } else ab.setAttribute('d', '');
    }
    const newA = AU.a != null && VIN.hadA !== true;
    VIN.hadA = AU.a != null;
    if (mk) {
      mk.innerHTML = [['A', AU.a], ['B', AU.b]].filter((x) => x[1] != null).map(([l, v]) => {
        const a = (ang(v / dur) * Math.PI) / 180, x = 50 + 46 * Math.cos(a), y = 50 + 46 * Math.sin(a);
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.2" class="vabd' + ((l === 'A' && newA) || (l === 'B' && hasB && !prevB) ? ' pop' : '') + '" style="transform-origin:' +
          x.toFixed(1) + 'px ' + y.toFixed(1) + 'px"/><text x="' + x.toFixed(1) + '" y="' + (y + 2).toFixed(1) + '" text-anchor="middle" class="vabt">' + l + '</text>';
      }).join('');
    }
    d.classList.toggle('loop', AU.b != null);
  }
  const pg = d.querySelector('#vprog');
  if (pg && dur) { const C = 2 * Math.PI * 46; pg.setAttribute('stroke-dasharray', (C * fr).toFixed(1) + ' ' + C.toFixed(1)); }
  if (rec) rec.style.transform = 'rotate(' + VIN.ang.toFixed(2) + 'deg)';
  if (arm && arm.style.transition === 'none') { if (arm.dataset.f) arm.style.transition = ''; else arm.dataset.f = 1; }
  if (arm && !VIN.arm) { const on = !pl().paused || pl().currentTime > 0.05; arm.style.transform = 'rotate(' + (on ? 5 + 27 * fr : -6) + 'deg)'; }
  const sb = d.querySelector('.vstate');
  if (sb) { const p = !pl().paused; if (sb.dataset.p !== String(p)) { sb.dataset.p = String(p); sb.innerHTML = p ? I.pause : I.play; } }
  VIN.raf = requestAnimationFrame(vinLoop);
}
function vinStart() { if (!VIN.raf) { VIN.t = 0; VIN.raf = requestAnimationFrame(vinLoop); } }

/* ---------- шторки ---------- */

function trackRow(x, sid, mode) {
  const { t } = ctx, sn = songTitles(x, sid);
  return '<div class="cell"><button class="grow" data-tl="' + x.id + '" style="text-align:left;min-width:0"><div class="ttl' + (AU.cur && AU.cur.id === x.id ? ' tintc' : '') + '">' + esc(x.name) +
    '</div><div class="st">' + sizeMb(x) + (sn.length ? ' · ' + sn.join(', ') : '') + '</div></button>' +
    (mode === 'song' ? '<button class="link" data-tu="' + x.id + '" style="font-size:14px;color:var(--l2)">' + t('unlink') + '</button>'
      : mode === 'pick' ? icb('data-tp="' + x.id + '"', I.plus, t('addToSong'), 'sm')
        : '<button class="ic sm" data-td="' + x.id + '" aria-label="' + esc(t('deleteX', { name: x.name })) + '" style="color:var(--red)">' + I.minus + '</button>') + '</div>';
}

async function removeTrack(x) {
  const { t, ui } = ctx;
  if (!(await ui.confirm(t('delTitle', { name: x.name }), t('delText'), t('delete')))) return;
  if (AU.cur && AU.cur.id === x.id) { pl().pause(); AU.cur = null; }
  await removeWithStems(x.id);
  render();
}

function trackSheet() {
  const { t, tn, ui } = ctx, sid = curSong();
  const body = () => {
    const all = tracks(), mine = sid ? all.filter((x) => inSong(x, sid)) : [], tot = all.reduce((s, x) => s + (x.size || 0), 0);
    return ui.snav(t(sid ? 'songAudio' : 'name')) + (sid
      ? '<div class="group">' + mine.map((x) => trackRow(x, sid, 'song')).join('') + '<button class="cell act" data-tpick>' + t('pickFromLib') + '</button><button class="cell act" data-tadd>' +
        t('uploadNew') + '</button></div><p class="ftr">' + t('newGoesBoth') + '</p>'
      : '<div class="group">' + all.map((x) => trackRow(x, null, 'lib')).join('') + '<button class="cell act" data-tadd>' + t('upload') + '</button></div>') +
      '<p class="ftr">' + (ctx.files.noDb ? t('noDb') : t('libInfo', { files: tn('files', all.length), mb: ctx.num(tot / MB, 1) })) + '</p>';
  };
  ui.sheet(body, (el, sh) => el.addEventListener('click', (e) => {
    const g = (s) => e.target.closest(s);
    let b;
    if (g('[data-tadd]')) { sh.close(); addFile(); return; }
    if (g('[data-tpick]')) { sh.close(); pickSheet(sid); return; }
    if ((b = g('[data-tl]'))) { const x = ctx.files.get(b.dataset.tl); if (x) load(x); sh.close(); render(); return; }
    if ((b = g('[data-tu]'))) { const x = ctx.files.get(b.dataset.tu); linkSong(x, sid, false); ctx.files.save(x); sh.update(); render(); return; }
    if ((b = g('[data-td]'))) { const x = ctx.files.get(b.dataset.td); sh.close(); removeTrack(x); }
  }));
}

function pickSheet(sid) {
  const { t, ui } = ctx;
  const body = () => {
    const rest = tracks().filter((x) => !inSong(x, sid));
    return ui.snav(t('fromLib'), { left: '<button class="ic sm plain" data-back aria-label="' + t('back') + '">' + ui.icons.back + '</button>', right: '<span></span>' }) + '<div class="group">' +
      (rest.length ? rest.map((x) => trackRow(x, sid, 'pick')).join('') : '<div class="cell l2">' + t('allInSong') + '</div>') + '</div>';
  };
  ui.sheet(body, (el, sh) => el.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { sh.close(); trackSheet(); return; }
    const p = e.target.closest('[data-tp]');
    if (!p) return;
    const x = ctx.files.get(p.dataset.tp);
    linkSong(x, sid, true);
    ctx.files.save(x);
    ui.toast(t('addedToSong'));
    sh.update();
    render();
  }));
}

function menuSheet(id) {
  const { t, ui } = ctx, x = ctx.files.get(id);
  if (!x) return;
  const body = () => {
    const songs = ctx.songs();
    return ui.snav(x.name) + '<div class="mlmh">' + artHTML(x, 'big') + '<div><b>' + esc(x.name) + '</b><div class="l2" style="font-size:13px">' + [x.dur ? fmtT(x.dur) : '', sizeMb(x)].filter(Boolean).join(' · ') +
      '</div></div></div><div class="group"><button class="cell act" data-m="play">' + t('play') + '</button><button class="cell act" data-m="send">' + t('shareRec') + '</button>' +
      // конвертер (src/modules/convert): «Поделиться как …» — в нужном формате одним касанием, «Конвертировать…» — с настройкой
      '<button class="cell act" data-m="shareAs">' + t('shareAs') + '</button><button class="cell act" data-m="conv">' + t('convertTo') + '</button>' +
      (isVideo(x) ? '<button class="cell act" data-m="vaudio">' + t('videoAudio') + '</button>' : '') +
      (ctx.canSendTo && ctx.canSendTo() ? '<button class="cell act" data-m="todev">' + t('toDevice') + '</button>' : '') + // на сопряжённое устройство (Melete DEV)
      '<button class="cell act" data-m="ren">' + t('rename') + '</button></div>' +
      '<div class="hdr">' + t('addToSongs') + '</div><div class="group">' + (songs.length ? songs.map((s) => '<button class="cell" data-m="song" data-sg="' + s.id + '" aria-pressed="' + inSong(x, s.id) +
        '"><span class="grow">' + esc(s.title) + '</span>' + (inSong(x, s.id) ? ui.icons.check : '') + '</button>').join('') : '<div class="cell l2">' + t('noSongs') + '</div>') + '</div>' +
      '<div class="group" style="margin-top:16px"><button class="cell danger center" data-m="del">' + t('delFromLib') + '</button></div>';
  };
  ui.sheet(body, (el, sh) => el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    const m = b.dataset.m;
    if (m === 'play') { load(x); playEl(); sh.close(); render(); }
    else if (m === 'song') { linkSong(x, b.dataset.sg, !inSong(x, b.dataset.sg)); ctx.files.save(x); sh.update(); render(); }
    else if (m === 'ren') renameSheet(x, () => sh.update());
    else if (m === 'send') shareRec(x, b);
    else if (m === 'todev') { sh.close(); ctx.sendTo(x); }
    else if (m === 'conv') { sh.close(); convSheet([x.id]); }
    else if (m === 'vaudio') { sh.close(); convSheet([x.id], { fmt: 'm4a' }); }
    else if (m === 'shareAs') shareAsSheet(x, sh);
    else if (m === 'del') { sh.close(); removeTrack(x); }
  }));
}

// Конвертер — часть медиатеки (слово автора 06.11.2026): шторка с тем же экраном конвертера; ids — файлы,
// fmt — сразу формат, share — сразу отдать «Поделиться»
function convSheet(ids, { fmt = null, share = false } = {}) {
  let h = null;
  ctx.ui.sheet(() => ctx.ui.snav(ctx.t('convertTo')) + '<div class="mlconv"></div>', (el) => {
    h = ctx.mountTool('convert', el.querySelector('.mlconv'), 'full', { inbox: { ids, ...(fmt ? { fmt } : {}), ...(share ? { share: true } : {}) } });
    if (!h) ctx.ui.toast(ctx.t('convert.fail'));
  }, { tall: true, onClose: () => { if (h) { try { h.unmount(); } catch (e) { ctx.logErr(e); } } render(); } });
}
// Отправить несколько файлов как есть (по одному через «Поделиться»); сбой — сказать, а не молчать
async function shareMany(xs) {
  let bad = 0;
  for (const x of xs) {
    try { const b = x.blob; if (!b) throw new Error('nofile'); await ctx.sendFile(new Uint8Array(await b.arrayBuffer()), x.name, x.name, x.type || b.type || (x.video ? 'video/mp4' : 'audio/wav')); }
    catch (e) { bad++; ctx.logErr(e); }
  }
  if (bad) ctx.ui.toast(ctx.t('shareFail'));
}

// Поделиться как MP3 / M4A / OGG / WAV / FLAC: конвертер делает файл (он же — в медиатеке) и сразу отдаёт «Поделиться»
function shareAsSheet(x, parent) {
  const { t, ui } = ctx, F = [['mp3', 'MP3'], ['m4a', 'M4A'], ['opus', 'OGG (Opus)'], ['wav', 'WAV'], ['flac', 'FLAC']];
  ui.sheet(() => ui.snav(t('shareAs')) + '<div class="group">' + F.map(([k, l]) => '<button class="cell act" data-sf="' + k + '">' + l + '</button>').join('') + '</div><p class="ftr">' + t('shareAsHint') + '</p>',
    (el, sh) => el.addEventListener('click', (e) => { const b = e.target.closest('[data-sf]'); if (!b) return; sh.close(); if (parent) parent.close(); convSheet([x.id], { fmt: b.dataset.sf, share: true }); }));
}

// Поделиться записью (Telegram, почта, другое приложение — системный выбор; на компьютере — «Сохранить как»): файл как есть
async function shareRec(x, btn) {
  if (!x.blob) return;
  btn.disabled = true;
  try {
    const type = x.type || (x.video ? 'video/mp4' : 'audio/wav');
    await ctx.sendFile(new Uint8Array(await x.blob.arrayBuffer()), x.name, x.name, type);
  } catch (e) { ctx.logErr(e); ctx.ui.toast(ctx.t('shareFail')); } finally { btn.disabled = false; }
}

// Запись MIDI: проиграть в инструменте, отправить файлом .mid, переименовать, удалить
function midiMenu(id) {
  const { t, ui } = ctx, x = ctx.files.get(id);
  if (!x) return;
  const nm = () => x.name.replace(/\.midi?$/i, '');
  ui.sheet(() => ui.snav(nm()) + '<div class="group"><button class="cell act" data-m="play">' + t('play') + '</button><button class="cell act" data-m="share">' + t('midiShare') + '</button>' +
    '<button class="cell act" data-m="ren">' + t('rename') + '</button></div><div class="group" style="margin-top:16px"><button class="cell danger center" data-m="del">' + t('delFromLib') + '</button></div>',
  (el, sh) => el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    const m = b.dataset.m;
    if (m === 'play') { sh.close(); ctx.midi.play(x); }
    else if (m === 'share') { try { await ctx.midi.share(x); } catch { ui.toast(t('midiFail')); } }
    else if (m === 'ren') renameSheet(x, () => { if (!/\.midi?$/i.test(x.name)) { x.name += '.mid'; ctx.files.save(x); } sh.update(); render(); });
    else if (m === 'del') {
      sh.close();
      if (await ui.confirm(t('midiDelTitle'), nm(), t('delFromLib'))) { await ctx.files.remove(x.id); render(); }
    }
  }));
}

// Тайм-коды текущего файла: добавить на текущее место, перейти, назвать, повторять отрезок до следующей, удалить
function marksSheet() {
  const { t, ui } = ctx, x = AU.cur;
  if (!x) return;
  const body = () => {
    const ms = x.marks || [];
    return ui.snav(t('marks')) + '<div class="group"><button class="cell act" data-mk="add">' + t('markAddAt', { time: fmtT(pl().currentTime) }) + '</button></div>' +
      (ms.length ? '<div class="group">' + ms.map((m, i) => '<div class="cell mkrow"><button class="mkt num" data-mk="go" data-i="' + i + '" aria-label="' + esc(t('markGo', { n: i + 1, time: fmtT(m.t) })) + '"><b>' + (i + 1) +
        '</b>' + fmtT(m.t) + '</button><input class="inp left grow" data-mn="' + i + '" maxlength="40" placeholder="' + esc(t('markName')) + '" aria-label="' + esc(t('markNameN', { n: i + 1 })) + '" value="' + esc(m.name || '') + '">' +
        '<button class="ic txt sm" data-mk="loop" data-i="' + i + '" aria-label="' + t('markLoop') + '">A–B</button><button class="ic sm" data-mk="del" data-i="' + i + '" aria-label="' + t('markDel') + '" style="color:var(--red)">' + I.minus + '</button></div>').join('') + '</div>' : '') +
      '<p class="ftr">' + t('marksInfo') + '</p>';
  };
  ui.sheet(body, (el, sh) => {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mk]');
      if (!b) return;
      const i = +b.dataset.i, ms = x.marks || [];
      if (b.dataset.mk === 'add') { markAdd(); sh.update(); return; }
      if (b.dataset.mk === 'go') { seekMark(i); sh.close(); return; }
      if (b.dataset.mk === 'loop') { loopMark(i); sh.close(); return; }
      if (b.dataset.mk === 'del') { x.marks = ms.filter((_, k) => k !== i); ctx.files.save(x); sh.update(); }
    });
    el.addEventListener('change', (e) => {
      const n = e.target.closest('[data-mn]');
      if (!n || !x.marks || !x.marks[+n.dataset.mn]) return;
      x.marks[+n.dataset.mn].name = n.value.trim();
      ctx.files.save(x);
    });
  }, { onClose: () => render() });
}

function markAdd() {
  const x = AU.cur;
  if (!x) return;
  const r = addMark(x.marks, pl().currentTime);
  x.marks = r.marks;
  if (r.added) ctx.files.save(x); else render();
  ctx.ui.toast(ctx.t(r.added ? 'markAdded' : 'markExists', { n: r.i + 1, time: fmtT(x.marks[r.i].t) }));
}
function seekMark(i) {
  const m = AU.cur && (AU.cur.marks || [])[i];
  if (!m) return;
  pl().currentTime = m.t;
  render();
}
function loopMark(i) {
  if (!AU.cur || !AU.cur.marks || !AU.cur.marks[i]) return;
  const [a, b] = markSpan(AU.cur.marks, i, pl().duration || AU.cur.dur || 0);
  if (!(b > a)) return;
  AU.a = a; AU.b = b; AU.loop = true;
  pl().currentTime = a;
  if (pl().paused) playEl();
  render();
}

// Выбранные файлы — в песни: песня отмечена, если в ней все выбранные; нажатие добавляет все или убирает все
function selSongsSheet() {
  const { t, ui } = ctx, picked = () => [...ML.sel].map((id) => ctx.files.get(id)).filter(Boolean);
  const body = () => {
    const songs = ctx.songs(), xs = picked();
    return ui.snav(t('toSongsN', { n: xs.length })) + '<div class="group">' + (songs.length ? songs.map((s) => {
      const on = xs.length && xs.every((x) => inSong(x, s.id)), some = !on && xs.some((x) => inSong(x, s.id));
      return '<button class="cell" data-sg="' + s.id + '" aria-pressed="' + !!on + '"><span class="grow">' + esc(s.title) + '</span>' + (some ? '<span class="l2" style="font-size:13px">' + t('some') + '</span>' : '') + (on ? ui.icons.check : '') + '</button>';
    }).join('') : '<div class="cell l2">' + t('noSongs') + '</div>') + '</div><p class="ftr">' + t('toSongsInfo') + '</p>';
  };
  ui.sheet(body, (el, sh) => el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sg]');
    if (!b) return;
    const xs = picked(), sid = b.dataset.sg, on = !xs.every((x) => inSong(x, sid));
    xs.forEach((x) => { linkSong(x, sid, on); ctx.files.save(x); });
    sh.update();
  }), { onClose: () => render() });
}

async function removeSelected() {
  const { t, ui, tn } = ctx, xs = [...ML.sel].map((id) => ctx.files.get(id)).filter(Boolean);
  if (!xs.length || !(await ui.confirm(t('delSelTitle', { files: tn('files', xs.length) }), t('delText'), t('delete')))) return;
  for (const x of xs) {
    if (AU.cur && AU.cur.id === x.id) { pl().pause(); AU.cur = null; }
    await removeWithStems(x.id);
  }
  ML.sel = null;
  render();
}

function renameSheet(x, after) {
  const { t, ui } = ctx;
  ui.sheet(() => ui.snav(t('nameTitle'), { left: '<button class="link l" data-close>' + t('cancel') + '</button>', right: '<button class="link b r" id="rnok">' + t('save') + '</button>' }) +
    '<div class="group"><label class="cell"><input class="inp left" id="rnv" maxlength="80" aria-label="' + t('nameTitle') + '" value="' + esc(x.name) + '"></label></div>',
  (el, sh) => {
    const i = el.querySelector('#rnv');
    setTimeout(() => { i.focus(); i.select(); }, 80);
    const ok = () => { const v = i.value.trim(); if (!v) return; x.name = v; ctx.files.save(x); sh.close(); render(); if (after) after(); };
    el.querySelector('#rnok').addEventListener('click', ok);
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
  });
}

function styleSheet() {
  const { t, ui } = ctx;
  ui.sheet(() => ui.snav(t('player')) + '<div class="hdr">' + t('view') + '</div><div class="stycards" role="group" aria-label="' + t('view') + '">' + ['wave', 'vinyl'].map((k) => '<button class="stycard' +
    (style() === k ? ' on' : '') + '" data-sty="' + k + '" aria-pressed="' + (style() === k) + '"><span class="sprev ' + k + '"><i></i><i></i><i></i><i></i></span><b>' + t('style.' + k) + '</b></button>').join('') +
    '</div><p class="ftr">' + t('vinylHint') + '</p>',
  (el, sh) => el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sty]');
    if (!b) return;
    st().style = b.dataset.sty;
    ctx.store.save();
    sh.update();
    render();
  }));
}

async function addFile() {
  if (ctx.uploadOk && ctx.uploadOk()) { input.click(); return; } // в том же нажатии: Safari открывает выбор файла только так
  if (await ctx.confirmUpload()) input.click();
}

// Длительность и есть ли картинка — по самому файлу (без загрузки целиком); не вышло — по типу и расширению
function probe(f) {
  return new Promise((res) => {
    const v = document.createElement('video'), url = URL.createObjectURL(f);
    let done = false;
    const end = (r) => { if (done) return; done = true; clearTimeout(tm); URL.revokeObjectURL(url); v.removeAttribute('src'); res(r); };
    const tm = setTimeout(() => end(null), 6000);
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => end({ dur: Number.isFinite(v.duration) ? v.duration : null, video: v.videoWidth > 0 });
    v.onerror = () => end(null);
    v.src = url;
  });
}

// Можно выбрать сразу много файлов — аудио и видео вперемешку
async function onFile(e) {
  const fs = [...e.target.files];
  e.target.value = '';
  if (!fs.length) return;
  const sid = curSong(), ids = [];
  let lost = false, first = null;
  for (const f of fs) {
    if (!/^(audio|video)\//.test(f.type) && !VIDEO_EXT.test(f.name) && !/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i.test(f.name)) continue;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8), p = await probe(f);
    const rec = { id, name: f.name.replace(/\.[^.]+$/, ''), size: f.size, type: f.type, songs: sid ? [sid] : [], created: Date.now(), blob: f,
      video: p ? p.video : /^video\//.test(f.type) || VIDEO_EXT.test(f.name) };
    if (p && p.dur) rec.dur = p.dur;
    if (!(await ctx.files.add(rec))) lost = true;
    ids.push(id);
    first = first || rec;
  }
  if (!first) { ctx.ui.toast(ctx.t('notMedia')); return; }
  if (lost) ctx.ui.toast(ctx.t('notSaved'));
  else if (ids.length > 1) ctx.ui.toast(ctx.t('addedN', { files: ctx.tn('files', ids.length) }));
  if (!AU.cur || ids.length === 1 || sid) load(first);
  // Много файлов в медиатеку — сразу режим выбора с ними: удобно разложить по песням
  if (ids.length > 1 && !sid) { ML.sel = new Set(ids); ML.view = 'lib'; ML.f = 'all'; ML.q = ''; }
  render();
}

/* ---------- жесты ---------- */

function act(a, el) {
  const { t, ui } = ctx;
  switch (a) {
    case 'aplay': if (pl().paused) playEl(); else pl().pause(); break;
    case 'aback': pl().currentTime = Math.max(0, pl().currentTime - 5); break;
    case 'afwd': pl().currentTime = Math.min(pl().duration || 0, pl().currentTime + 5); break;
    case 'aab': // A — B — сброс
      if (AU.b != null) { AU.a = AU.b = null; AU.loop = false; }
      else if (AU.a == null) AU.a = snapBeat(AU.cur, pl().currentTime);
      else if (pl().currentTime > AU.a) { AU.b = snapBeat(AU.cur, pl().currentTime); AU.loop = true; }
      else AU.a = snapBeat(AU.cur, pl().currentTime);
      if (host.querySelector('#vdisc')) {
        // Пластинку не перерисовываем (она крутится), но волну под ней — да: иначе на ней остаются старые A и B
        const ab = AU.b != null ? 'on' : AU.a != null ? 'a' : '';
        el.classList.toggle('act', ab === 'on');
        el.textContent = ab === 'a' ? 'B?' : 'A–B';
        const wf = host.querySelector('#wform');
        if (wf) wf.outerHTML = wformHTML(wfCls(wf));
      } else render();
      break;
    case 'astep': AU.step = !AU.step; if (AU.step && AU.b == null) ui.toast(t('stepHint')); render(); break;
    case 'arate1': setRate(nextRate()); render(); break; // следующая ступень по кругу (…→ 100 % → первая)
    case 'alist': trackSheet(); break;
    case 'aadd': addFile(); break;
    case 'apick': pickSheet(curSong()); break;
    case 'aload2': { const x = ctx.files.get(el.dataset.id); if (x) { load(x); render(); } break; }
    case 'astyle': styleSheet(); break;
    case 'mlplay': {
      const x = ctx.files.get(el.dataset.id);
      if (!x) break;
      if (AU.cur && AU.cur.id === x.id) pl().paused ? playEl() : pl().pause();
      else { load(x); playEl(); }
      render();
      break;
    }
    case 'mlopen': ML.view = 'player'; render(); break;
    case 'mllib': ML.view = 'lib'; render(); break;
    case 'mlmenu': menuSheet(el.dataset.id); break;
    case 'mmplay': { const x = ctx.files.get(el.dataset.id); if (x) ctx.midi.play(x); break; }
    case 'mmmenu': midiMenu(el.dataset.id); break;
    case 'mlf': ML.f = el.dataset.v; render(); break;
    case 'mlseloff': ML.sel = null; render(); break;
    case 'mlsel': { const id = el.dataset.id; ML.sel.has(id) ? ML.sel.delete(id) : ML.sel.add(id); render(); break; }
    case 'mlsall': {
      const vis = [...host.querySelectorAll('[data-x="mlsel"]')].map((b) => b.dataset.id), on = !vis.every((id) => ML.sel.has(id));
      vis.forEach((id) => (on ? ML.sel.add(id) : ML.sel.delete(id)));
      render();
      break;
    }
    case 'mlsong': if (ML.sel && ML.sel.size) selSongsSheet(); break;
    case 'mldel': if (ML.sel && ML.sel.size) removeSelected(); break;
    case 'mlsend': if (ML.sel && ML.sel.size) shareMany([...ML.sel].map((id) => ctx.files.get(id)).filter(Boolean)); break;
    case 'mlconv': if (ML.sel && ML.sel.size) convSheet([...ML.sel]); break;
    case 'mlselon': ML.sel = new Set(); render(); break;
    case 'amadd': markAdd(); break;
    case 'amj': seekMark(+el.dataset.i); break;
    case 'amlist': marksSheet(); break;
    case 'akeysheet': keySheet(); break;
    case 'astems': stemsSheet(); break;
    case 'apv': st().pview = el.dataset.v; ctx.store.save(); render(); break;
    case 'aclick': st().pclick = !st().pclick; ctx.store.save(); if (st().pclick) clickStart(); render(); break;
    case 'asreset': { const all = st().pmix || {}; delete all[AU.cur.id]; mixApply(AU.cur); render(); break; }
    case 'apbt': { const bt = +el.dataset.bt; if (Number.isFinite(bt)) { pl().currentTime = bt; CL.last = -1; uiTick(); } break; }
    case 'afs': {
      const v = AU.el, rq = v.requestFullscreen || v.webkitRequestFullscreen;
      if (rq) { v.controls = true; Promise.resolve(rq.call(v)).catch(() => { v.controls = false; }); }
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      break;
    }
  }
}

function bind() {
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
  // удержание строки — выбор нескольких файлов (вместо отдельной кнопки); дальше — касания по строкам
  onHold(host, '.mlmain[data-x="mlplay"], .mlmain[data-x="mlsel"]', (el) => { if (!ML.sel) ML.sel = new Set(); ML.sel.add(el.dataset.id); render(); });
  onHold(host, '.rpre', (el) => rateSheet(rates().findIndex((x) => Math.abs(x - +el.dataset.rpre) < 0.001)));
  on(host, 'click', (e) => {
    const s = e.target.closest('[data-step="arate"]');
    if (s) { setRate(AU.rate + +s.dataset.d * 0.05); const rv = host.querySelector('#ratev'); if (rv) rv.textContent = rateTxt(); host.querySelectorAll('.rpre').forEach((b) => b.classList.toggle('act', Math.abs(+b.dataset.rpre - AU.rate) < 0.001)); return; }
    const rp = e.target.closest('[data-rpre]');
    if (rp) { setRate(+rp.dataset.rpre); render(); return; }
    const k = e.target.closest('[data-step="akey"]');
    if (k) { const [p, c] = pitchOf(AU.cur); setPitch(p + +k.dataset.d, c); return; }
    const x = e.target.closest('[data-x]');
    if (x) { act(x.dataset.x, x); return; }
    // панель плеера: выкл дорожки, ячейка аккорда или строка текста — перемотка
    const mu = e.target.closest('[data-smute]');
    if (mu && AU.cur) { mixToggle(AU.cur, mu.dataset.smute); mixApply(AU.cur); refreshStemRows(host, AU.cur); return; }
    const bt = e.target.closest('[data-bt]');
    if (bt && AU.cur) act('apbt', bt);
  });
  on(host, 'input', (e) => {
    const sg = e.target.closest('[data-sg]');
    if (sg && AU.cur) { mixSet(AU.cur, sg.dataset.sg, +sg.value / 100); mixApply(AU.cur); refreshStemRows(host, AU.cur); return; }
    if (!e.target.hasAttribute('data-mlq')) return;
    ML.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const s = host.querySelector('[data-mlq]');
    if (s) { s.focus(); try { s.setSelectionRange(pos, pos); } catch { /* ignore */ } }
  });
  on(host, 'change', (e) => { if (e.target.hasAttribute('data-mls')) { ML.sort = e.target.value; render(); } });
  // Волна: нажать — перемотать, тянуть A или B — сдвинуть фрагмент
  let wf = null;
  on(host, 'pointerdown', (e) => {
    const w = e.target.closest('#wform');
    if (!w || !AU.cur) return;
    const r = w.getBoundingClientRect(), d = pl().duration || 0;
    if (!d) return;
    e.preventDefault();
    const x = e.clientX - r.left, near = (k) => AU[k] != null && Math.abs((AU[k] / d) * r.width - x) < 18, h = near('b') ? 'b' : near('a') ? 'a' : null;
    wf = { pid: e.pointerId, r, d, h };
    // Нажатие рядом с меткой — точно на метку
    const mi = h ? -1 : nearMark(AU.cur.marks, (x / r.width) * d, (12 / r.width) * d);
    if (mi >= 0) { pl().currentTime = AU.cur.marks[mi].t; wf = null; }
    else if (!h) pl().currentTime = Math.max(0, Math.min(d, (x / r.width) * d));
  }, true);
  on(window, 'pointermove', (e) => {
    if (!wf || e.pointerId !== wf.pid) return;
    const tt = Math.max(0, Math.min(wf.d, ((e.clientX - wf.r.left) / wf.r.width) * wf.d));
    if (wf.h === 'a') AU.a = Math.min(snapBeat(AU.cur, tt), AU.b != null ? AU.b - 0.2 : tt);
    else if (wf.h === 'b') AU.b = Math.max(snapBeat(AU.cur, tt), (AU.a || 0) + 0.2);
    else pl().currentTime = tt;
    if (wf.h) { const w = host.querySelector('#wform'); if (w) w.outerHTML = wformHTML(wfCls(w)); }
  }, { passive: true });
  const wfUp = (e) => { if (wf && e.pointerId === wf.pid) wf = null; };
  on(window, 'pointerup', wfUp, true);
  on(window, 'pointercancel', wfUp, true);
  // Волна с клавиатуры: стрелки — ±5 с
  on(host, 'keydown', (e) => {
    if (e.target.classList.contains('vidbox') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); act('aplay', e.target); return; }
    if (e.target.id !== 'wform') return;
    if (e.key === 'ArrowRight') { pl().currentTime = Math.min(pl().duration || 0, pl().currentTime + 5); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { pl().currentTime = Math.max(0, pl().currentTime - 5); e.preventDefault(); }
  });
  // Винил: нажать — играть/пауза, крутить — перемотка; тонарм — выбрать место
  on(host, 'pointerdown', (e) => {
    const d = e.target.closest('#vdisc');
    if (!d || e.target.closest('.vstate')) return;
    e.preventDefault();
    const r = d.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (e.target.closest('.varm')) { VIN.arm = { id: e.pointerId, r }; return; }
    VIN.drag = { id: e.pointerId, cx, cy, rad: r.width / 2, x0: e.clientX, y0: e.clientY, a: Math.atan2(e.clientY - cy, e.clientX - cx), was: !pl().paused, px: 0, seek: 0, started: false };
  }, true);
  on(window, 'pointermove', (e) => {
    if (VIN.drag && e.pointerId === VIN.drag.id) {
      const g = VIN.drag;
      g.px = Math.max(g.px, Math.hypot(e.clientX - g.x0, e.clientY - g.y0));
      const a = Math.atan2(e.clientY - g.cy, e.clientX - g.cx), dist = Math.hypot(e.clientX - g.cx, e.clientY - g.cy);
      let da = a - g.a;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      g.a = a;
      if (g.px < 8 || dist < g.rad * 0.18) return;
      if (!g.started) { g.started = true; VIN.w = 0; if (g.was) pl().pause(); }
      const deg = (da * 180) / Math.PI;
      VIN.ang = (VIN.ang + deg + 360) % 360;
      g.seek += (deg / 360) * 1.8;
      const now = performance.now();
      if (AU.cur && pl().duration && (!g.ts || now - g.ts > 40)) { g.ts = now; pl().currentTime = Math.max(0, Math.min(pl().duration - 0.05, pl().currentTime + g.seek)); g.seek = 0; }
    } else if (VIN.arm && e.pointerId === VIN.arm.id && pl().duration) {
      const r = VIN.arm.r, px = r.left + r.width * 0.94, py = r.top + r.height * 0.051, ang = (Math.atan2(e.clientX - px, e.clientY - py) * -180) / Math.PI, fr = Math.max(0, Math.min(1, (ang - 5) / 27));
      pl().currentTime = fr * pl().duration;
      const arm = host.querySelector('#vdisc .varm');
      if (arm) arm.style.transform = 'rotate(' + (5 + 27 * fr) + 'deg)';
    }
  }, { passive: true });
  const vinUp = (e) => {
    if (VIN.drag && e.pointerId === VIN.drag.id) {
      const g = VIN.drag;
      VIN.drag = null;
      if (!g.started) g.was ? pl().pause() : playEl();
      else {
        if (g.seek && pl().duration) pl().currentTime = Math.max(0, Math.min(pl().duration - 0.05, pl().currentTime + g.seek));
        if (g.was) playEl();
      }
    }
    if (VIN.arm && e.pointerId === VIN.arm.id) VIN.arm = null;
  };
  on(window, 'pointerup', vinUp, true);
  on(window, 'pointercancel', vinUp, true);
}

export default {
  ...meta,
  status(c) {
    const list = c.files.list('audio'), td = list.reduce((s, x) => s + (x.dur || 0), 0);
    return list.length ? c.tn('files', list.length) + (td ? ' · ' + fmtDur(td) : '') : c.t('empty');
  },
  drop(fs) { if (host) onFile({ target: { files: fs } }); else dropped = fs; },
  mount(el, c, sz = 'full') {
    host = el; ctx = c; size = sz;
    // пульт снаружи (браслет, часы, наушники — core/player.js): название записи и соседняя запись в порядке списка
    if (c.remote) c.remote({ title: () => (AU.cur && !pl().paused ? String(AU.cur.name || '').replace(/\.[a-z0-9]{2,5}$/i, '') : null), next: () => remoteStep(1), prev: () => remoteStep(-1) });
    if (c.net) c.net(netRemote); // пульт с другого устройства (src/core/netctl.js)
    { const a = c.store.all(); if (a.sortOnce) { ML.sort = a.sortOnce; delete a.sortOnce; c.store.save(); } } // «Освободить место» — крупные сверху
    ensureEl(c);
    input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,video/*';
    input.multiple = true;
    input.hidden = true;
    input.addEventListener('change', onFile);
    document.body.appendChild(input);
    if (dropped) { const fs = dropped; dropped = null; c.files.ready.then(() => { if (host) onFile({ target: { files: fs } }); }); }
    render();
    bind();
    offs.push(c.files.subscribe(() => { if (!document.activeElement?.hasAttribute?.('data-mlq')) render(); }));
    if (c.jobs) offs.push(c.jobs.subscribe((j) => { if (!j) render(); }));
    c.files.ready.then(render);
    uiTimer = setInterval(uiTick, 200);
  },
  resize(sz) { size = sz; render(); },
  // Окно закрыто: вне сессии музыка останавливается (как в прототипе)
  unmount() {
    if (ctx && ctx.net) ctx.net(null);
    clearInterval(uiTimer);
    offs.splice(0).forEach((f) => (typeof f === 'function' ? f() : null));
    if (input) { input.remove(); input = null; }
    if (AU.el && !ctx.session) pl().pause();
    park();
    cancelAnimationFrame(VIN.raf);
    VIN.raf = 0;
    host = null;
  },
};
