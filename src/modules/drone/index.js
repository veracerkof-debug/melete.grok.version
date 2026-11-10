// Пэды и дрон: 12 нот, слои по октавам, тембры, созвучия, характер звука, плавная смена нот, пресеты.
// Перенесено из legacy/practice.html (droneHTML, droneSheet, обработчики dpad/dstop/dlayer).
// Два вида (решение автора 29.10.2026): сетка — плитка звучит созвучием, жест по плитке выбирает его (05.11.2026: касание —
// тоника с квинтой, влево — мажор, вправо — минор, вверх — sus4+2, вниз — гармонический минор; жесты выключаются,
// чувствительность — в настройках), звучащая плитка «дышит»; «пиано» — одна октава крупно, клавиша звучит
// всеми включёнными слоями, «Играть» — пока держат (аккорды несколькими пальцами), «Держать» — касание вкл/выкл.
import './drone.css';
import ru from './i18n/ru.json';
import uz from './i18n/uz.json';
import en from './i18n/en.json';
import el from './i18n/el.json';
import { SOUNDS, CHORD_SET, LAYERS, DIRS, SENS, normalizeDrone } from '../../audio/drone.js';
import { TREM_DIV_ORDER } from '../../audio/fx.js';
import { presetRow, promptName, presetManager } from '../../ui/presets.js';

import { arpSheet } from './arpsheet.js';
import meta, { ICON } from './meta.js';
const GRID_ICON = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>';
const CIRCLE_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.2"/><path d="M12 3.5v4.3M12 16.2v4.3M3.5 12h4.3M16.2 12h4.3"/></svg>';
const WAVE_ICON = '<svg viewBox="0 0 24 24"><path d="M3 12c1.5-5 3-5 4.5 0s3 5 4.5 0 3-5 4.5 0 3 5 4.5 0"/></svg>';
const KEYS_ICON = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M12 5v14M16 5v14"/><path d="M8 5v8M12 5v8M16 5v8" stroke-width="3.2"/></svg>';
const SH = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
// Подпись созвучия на плитке (автор 05.11.2026): нота — просто C, D, E; мажор и минор — словом под нотой
const WORD = { maj: 'lab.maj', min: 'lab.min', hmin: 'lab.hmin' };
const SYM = { sus42: 'sus4+2', sus4: 'sus4', dim: '°' };
const sufOf = (ch) => (WORD[ch] ? ctx.t(WORD[ch]) : SYM[ch] || '');
// Круг — символами аккордов (как подписи секторов): C, Cm, C°
const CSUF = { maj: '', min: 'm', dim: '°' };
// Волна громкости пэдов — эффекты шины пэдов микшера (fx.js): включить — сила из настроек пэдов
const FX = () => ctx.audio.mixer.fx('drone');
const setFx = (patch) => ctx.audio.mixer.setFx('drone', patch);
const WHITE = [0, 2, 4, 5, 7, 9, 11], BLACK = [[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]]; // чёрная — после белой №
// Что сохраняется в пресет пэдов
const PRESET_KEYS = ['sound', 'chord', 'bright', 'move', 'width', 'fade', 'rev', 'hall', 'air', 'vol', 'layers', 'xfade'];

let host = null, ctx = null, size = 'full';
let onClick = null, onDown = null, onMove = null, onUp = null, offs = [], raf = 0;
let drag = null, lastPtr = 0; // ведение по плитке сетки; время последнего касания (клик после него — не клавиатура)
const fingers = new Map(); // «пиано», «Играть»: палец → клавиша

const D = () => normalizeDrone(ctx.store.all());
const DR = () => ctx.audio.drone;

/* ---------- разметка ---------- */

const viewOf = () => normalizeDrone(ctx.store.all()).view;
const keysView = () => viewOf() === 'keys';
const NEXT_VIEW = { grid: 'circle', circle: 'keys', keys: 'grid' };
const VIEW_ICON = { grid: GRID_ICON, circle: CIRCLE_ICON, keys: KEYS_ICON };
const noteHTML = (n) => n.replace('♯', '<span class="acc">♯</span>');
const tileLabel = (i, ch) => '<span class="dn">' + noteHTML(SH[i]) + '</span>' + (sufOf(ch) ? '<span class="csf">' + sufOf(ch) + '</span>' : '');

function gridHTML(cls) {
  const { t } = ctx, d = D(), on = DR().on, cur = DR().chord;
  return '<div class="dgrid ' + cls + '" role="group" aria-label="' + t('notes') + '">' + SH.map((n, i) => {
    const act = on && d.pc === i;
    return '<button class="dtile' + (n.length > 1 ? ' sh' : '') + (act ? ' on' : '') + '" data-x="dpad" data-v="' + i + '" aria-pressed="' + act + '" aria-label="' +
      t('pad', { n }) + '"><span class="dlab">' + tileLabel(i, act ? cur : d.chord) + '</span></button>';
  }).join('') + '</div>';
}

// Одна октава: семь белых во всю ширину, пять чёрных поверх
function keysHTML() {
  const { t } = ctx, held = DR().held;
  const key = (pc, cls, style) => '<button class="dkey ' + cls + (held.has(pc) ? ' on' : '') + '" data-dk="' + pc + '" style="' + style + '" aria-pressed="' + held.has(pc) +
    '" aria-label="' + t('pad', { n: SH[pc] }) + '"><span>' + noteHTML(SH[pc]) + '</span></button>';
  return '<div class="dkeys" role="group" aria-label="' + t('notes') + '">' + WHITE.map((pc, i) => key(pc, 'w', '--i:' + i)).join('') +
    BLACK.map(([pc, after]) => key(pc, 'b', '--i:' + after)).join('') + '</div>';
}

/* ---------- квинтовый круг (решение автора 29.10.2026): мажоры снаружи, параллельные миноры, уменьшённые внутри;
   касание — аккорд, ведение пальцем по кругу — поворот (тональность наверху, её аккорды подсвечены, ступени подписаны) ---------- */

const C_MAJ = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
const C_MIN = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'D♯m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];
const C_DIM = ['B°', 'F♯°', 'C♯°', 'G♯°', 'D♯°', 'A♯°', 'F°', 'C°', 'G°', 'D°', 'A°', 'E°'];
const RINGS = [['maj', 97, 66, 0, C_MAJ], ['min', 64, 44, 9, C_MIN], ['dim', 42, 27, 11, C_DIM]]; // вид, внешний и внутренний радиус, сдвиг основного тона, подписи
const ROMAN = { maj: { '-1': 'IV', 0: 'I', 1: 'V' }, min: { '-1': 'ii', 0: 'vi', 1: 'iii' }, dim: { 0: 'vii°' } };
const rootOf = (ring, i) => (i * 7 + RINGS.find((r) => r[0] === ring)[3]) % 12;
let rot = null; // поворот круга в градусах во время ведения (null — по тональности)
const pt = (r, a) => { const x = (a - 90) * Math.PI / 180; return [Math.round(r * Math.cos(x) * 100) / 100, Math.round(r * Math.sin(x) * 100) / 100]; };
function seg(r1, r0, a0, a1) {
  const [x1, y1] = pt(r1, a0), [x2, y2] = pt(r1, a1), [x3, y3] = pt(r0, a1), [x4, y4] = pt(r0, a0);
  return 'M' + x1 + ' ' + y1 + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + x2 + ' ' + y2 + 'L' + x3 + ' ' + y3 + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + x4 + ' ' + y4 + 'Z';
}
// Раскладка: у тональности наверху (IV, I, V и их миноры, vii°) сектор втрое шире остальных; ширина плавно перетекает
// при повороте — kf (дробная тональность наверху) двигается вместе с пальцем, ничего не прыгает
const W_DIA = 3;
function layout(kf) {
  const w = [];
  for (let i = 0; i < 12; i++) { const dd = Math.abs((((i - kf) % 12) + 18) % 12 - 6); w.push(1 + (W_DIA - 1) * Math.max(0, Math.min(1, 2 - dd))); }
  const sum = w.reduce((x, y) => x + y, 0), span = w.map((x) => (x / sum) * 360), c = new Array(12);
  const kk = ((Math.round(kf) % 12) + 12) % 12;
  c[kk] = -(kf - Math.round(kf)) * span[kk];
  for (let j = 1; j <= 6; j++) { const i = (kk + j) % 12, q = (kk + j - 1) % 12; c[i] = c[q] + (span[q] + span[i]) / 2; }
  for (let j = 1; j <= 5; j++) { const i = (kk - j + 12) % 12, q = (kk - j + 13) % 12; c[i] = c[q] - (span[q] + span[i]) / 2; }
  return { c, span, w };
}
function circleSVG() {
  const { t } = ctx, d = D(), R = rot == null ? -d.ckey * 30 : rot, on = DR().on, cur = DR().chord;
  const kf = -R / 30, k = ((Math.round(kf) % 12) + 12) % 12, L = layout(kf);
  let out = '';
  RINGS.forEach(([ring, r1, r0, , names]) => {
    for (let i = 0; i < 12; i++) {
      const rel = ((i - k + 18) % 12) - 6; // −6…5 от тональности наверху
      const deg = ROMAN[ring][rel], a = L.c[i], h = L.span[i] / 2, act = on && cur === ring && d.pc === rootOf(ring, i);
      const big = ring === 'dim' && !deg ? 0 : (L.w[i] - 1) / (W_DIA - 1); // 0 — сжатый, 1 — аккорд тональности (из уменьшённых крупный — только vii°)
      const fs = ({ maj: 9, min: 7, dim: 5.6 })[ring] * (1 + big * ({ maj: 0.75, min: 0.7, dim: 0.75 })[ring]);
      // название и ступень — столбиком по вертикали экрана (по радиусу у боковых секторов встали бы рядом)
      const [cx, cy] = pt((r1 + r0) / 2, a), ny = deg ? cy - fs * 0.22 : cy, dy = cy + fs * 0.62;
      out += '<g class="dseg ' + ring + (deg ? ' dia' : '') + (act ? ' on' : '') + '" data-ring="' + ring + '" data-i="' + i + '" role="button" tabindex="0" aria-label="' + names[i] + '">' +
        '<path d="' + seg(r1, r0, a - h, a + h) + '"/><text x="' + cx + '" y="' + ny.toFixed(2) + '" font-size="' + fs.toFixed(1) + '">' + names[i] + '</text>' +
        (deg ? '<text class="deg" x="' + cx + '" y="' + dy.toFixed(2) + '" font-size="' + (fs * 0.48).toFixed(1) + '">' + deg + '</text>' : '') + '</g>';
    }
  });
  const label = on ? SH[d.pc] + (CSUF[cur] || '') : C_MAJ[k];
  return '<div class="dcirc" role="group" aria-label="' + t('circle') + '"><svg viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid meet">' + out +
    '<g class="dctr' + (on ? ' on' : '') + '" data-x="dctr" role="button" tabindex="0" aria-label="' + (on ? t('stop') : t('circle.key', { k: C_MAJ[k] })) + '"><circle r="24"/><text y="1">' + label + '</text></g></svg></div>';
}
// Аккорд круга: касание — звучит (плавный переход с прошлого), звучащий — стоп
function playRing(ring, i) {
  const pc = rootOf(ring, i), d = D();
  if (DR().on && d.pc === pc && DR().chord === ring) { if (isHeld()) unlocked(); else DR().stop(); render(); return; }
  if (!unlocked()) return;
  d.pc = pc;
  ctx.store.save();
  DR().on ? DR().swap({ chord: ring }) : DR().start({ chord: ring });
  render();
}

function view() {
  const { t, ui } = ctx, d = D(), on = DR().sounding, kv = keysView(), v = viewOf();
  const stop = '<button class="dstop' + (on ? ' live' : '') + '" data-x="dstop" aria-label="' + t('stop') + '"' + (on ? '' : ' disabled') + '><span></span></button>';
  const layers = '<div class="layers" role="group" aria-label="' + t('layers') + '">' + LAYERS.map((o) => '<button class="lay' + (d.layers[o] ? ' on' : '') +
    '" data-x="dlayer" data-v="' + o + '" aria-pressed="' + !!d.layers[o] + '" aria-label="' + t('layer.' + o + '.full') + '">' + t('layer.' + o) + '</button>').join('') + '</div>';
  const mode = ui.icb('data-x="dmode"', VIEW_ICON[NEXT_VIEW[v]], t('mode.' + NEXT_VIEW[v]), 'plain');
  const wv = FX().trem > 0;
  const wave = '<button class="dwv' + (wv ? ' on' : '') + '" data-x="dwave" aria-pressed="' + wv + '" aria-label="' + t('wave') + '">' + WAVE_ICON + '</button>';
  // арпеджиатор (вместо тампуры): касание — вкл/выкл, удержание — настройки
  const ao = !!(d.arp && d.arp.on), arp = '<button class="darp' + (ao ? ' on' : '') + '" data-x="darp" aria-pressed="' + ao + '" aria-label="' + t('arp.title') + '" title="' + t('arp.title') + '">' + ARP_ICON + '</button>';
  const latch = kv ? '<button class="dlatch' + (d.latch ? ' on' : '') + '" data-x="dlatch" aria-pressed="' + !!d.latch + '">' + t(d.latch ? 'latch.on' : 'latch.off') + '</button>' : '';
  const surf = (g) => (kv ? keysHTML() : v === 'circle' && size !== 'strip' ? circleSVG() : gridHTML(g));
  if (size === 'quarter') return '<div class="dwrap">' + surf('g3') + '<div class="dbar q">' + stop + '</div></div>';
  if (size === 'strip') return '<div class="srow2 dstrip">' + surf('g6') + stop + '</div>';
  return '<div class="dwrap' + (kv ? ' kv' : '') + (isHeld() ? ' held' : '') + '">' + surf(size === 'half' ? 'g4' : 'g3') + '<div class="dbar">' + ui.icb('data-x="dset"', ui.icons.gear, t('settings'), 'plain') + layers + latch + arp + wave + stop + mode + '</div></div>';
}

function render() {
  if (host) host.innerHTML = view();
}

/* ---------- настройки пэдов ---------- */

function droneSheet() {
  const { t, ui } = ctx, d = D(), api = ctx.presets('drone');
  const P = (v) => Math.round(v * 100) + '%', SF = (v) => t('u.s', { n: ctx.num(+v, 1) });
  const sl = (k, min, max, step, f) => '<div class="sslider"><div class="ssl"><span>' + t('k.' + k) + '</span><b class="num" id="dv-' + k + '">' + f(d[k]) +
    '</b></div><input type="range" class="range" data-dk="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + d[k] + '" aria-label="' + t('k.' + k) + '"></div>';
  const body = () => ui.snav(t('set.title')) + presetRow(api, d.preset, []) +
    '<div class="hdr" style="margin-top:4px">' + t('timbre') + '</div><div class="dsnd" role="group" aria-label="' + t('timbre') + '">' + Object.keys(SOUNDS).map((k) => '<button class="dsb' +
      (d.sound === k ? ' on' : '') + '" data-ds="' + k + '" aria-pressed="' + (d.sound === k) + '"><b>' + t('snd.' + k) + '</b><span>' + t('snd.' + k + '.d') + '</span></button>').join('') + '</div>' +
    '<div class="hdr">' + t('chord') + '</div><div class="dchs" role="group" aria-label="' + t('chord') + '">' + CHORD_SET.map((k) => '<button class="dch' + (d.chord === k ? ' on' : '') +
      '" data-dch="' + k + '" aria-pressed="' + (d.chord === k) + '">' + t('ch.' + k) + '</button>').join('') + '</div>' +
    '<div class="group" style="margin-top:10px"><div class="cell"><span class="grow">' + t('gest') + '</span>' + ui.sw('dgest', d.gest, t('gest')) + '</div>' +
      (d.gest ? '<div class="cellcol"><span>' + t('sens') + '</span><div style="margin-top:8px">' + ui.seg('dsens', Object.keys(SENS).map((k) => [k, t('sens.' + k)]), d.sens, t('sens')) + '</div></div>' : '') +
    '</div><p class="ftr">' + t(d.gest ? 'chord.ftr' : 'chord.ftrOff') + '</p>' +
    waveHTML() +
    '<div class="hdr">' + t('character') + '</div><div class="group sgroup">' + sl('bright', 0, 1, 0.01, P) + sl('move', 0, 1, 0.01, P) + sl('width', 0, 1, 0.01, P) + '</div>' +
    '<div class="hdr">' + t('space') + '</div><div class="group sgroup">' + sl('fade', 0.2, 6, 0.1, SF) + sl('rev', 0, 1, 0.01, P) + sl('vol', 0, 1, 0.01, P) + '</div>' +
    // поклонение: длинный зал (отдельная реверберация ~7 с) и «Air» — тихий шум, настроенный по нотам созвучия
    '<div class="hdr">' + t('worship') + '</div><div class="group sgroup">' + sl('hall', 0, 1, 0.01, P) + sl('air', 0, 1, 0.01, P) + '</div><p class="ftr">' + t('worship.ftr') + '</p>' +
    '<div class="group" style="margin-top:12px"><div class="cell"><span class="grow">' + t('xfade') + '</span>' + ui.sw('dxf', d.xfade, t('xfade')) + '</div></div>' +
    '<div class="group" style="margin-top:12px"><button class="cell" data-darpset><span class="grow">' + t('arp.title') + '<span class="st l2" style="display:block;font-size:13px">' + t('arp.onHint') + '</span></span>' + (d.arp && d.arp.on ? '<span class="val">' + t('arp.isOn') + '</span>' : '') + '</button></div>';
  // Волна громкости («мягкий выключатель»): вкл, сила, форма (волна / пульс), мягкость краёв пульса, частота — свободно или
  // в такт метронома. Звук — тремоло шины пэдов (fx.js), то же видно в эффектах микшера
  function waveHTML() {
    const f = FX(), on = f.trem > 0, HZ = (v) => t('u.hz', { n: ctx.num(+v, 1) });
    const wsl = (k, lab, v, min, max, step, txt) => '<div class="sslider"><div class="ssl"><span>' + lab + '</span><b class="num" id="dw-' + k + '">' + txt +
      '</b></div><input type="range" class="range" data-dw="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '" aria-label="' + lab + '"></div>';
    return '<div class="hdr">' + t('wave') + '</div><div class="group"><div class="cell"><span class="grow">' + t('wave.on') + '</span>' + ui.sw('dwave', on, t('wave.on')) + '</div></div>' +
      (on ? '<div class="group sgroup">' + wsl('trem', t('wave.depth'), f.trem, 0.05, 1, 0.05, P(f.trem)) +
        (f.tremShape === 'pulse' ? wsl('tremSoft', t('wave.soft'), f.tremSoft, 0, 1, 0.05, P(f.tremSoft)) : '') +
        (f.tremDiv === 'free' ? wsl('tremRate', t('wave.rate'), f.tremRate, 0.5, 12, 0.1, HZ(f.tremRate)) : '') + '</div>' +
        '<div class="group"><div class="cellcol"><span>' + t('wave.shape') + '</span><div style="margin-top:8px">' + ui.seg('dwshape', [['wave', t('wave.s.wave')], ['pulse', t('wave.s.pulse')]], f.tremShape, t('wave.shape')) + '</div></div>' +
        '<div class="cellcol"><span>' + t('wave.div') + '</span><div style="margin-top:8px">' + ui.seg('dwdiv', TREM_DIV_ORDER.map((k) => [k, t('wave.d.' + k)]), f.tremDiv, t('wave.div')) + '</div></div></div>' : '') +
      '<p class="ftr">' + t('wave.ftr') + '</p>';
  }
  ui.sheet(body, (el, sh) => {
    let rt = 0;
    const later = () => { clearTimeout(rt); rt = setTimeout(() => DR().retune(), 350); };
    const changed = () => { ctx.store.save(); sh.update(); render(); };
    el.addEventListener('click', (e) => {
      const g = (s) => e.target.closest(s);
      let b;
      if (g('[data-psave]')) {
        promptName(t('pre.new'), d.pname ? d.pname + ' 2' : t('pre.default'), (v) => {
          const id = api.add(v, PRESET_KEYS.reduce((o, k) => ((o[k] = d[k]), o), {}));
          d.preset = id;
          d.pname = v;
          changed();
          ui.toast(t('preset.saved'));
        });
        return;
      }
      if (g('[data-pman]')) { presetManager(api, () => sh.update()); return; }
      if (g('[data-darpset]')) { arpSheet(ctx, render); return; }
      if ((b = g('[data-upre]'))) {
        const p = api.get(b.dataset.upre);
        if (p) { Object.assign(d, JSON.parse(JSON.stringify(p.data)), { preset: p.id, pname: p.name }); changed(); DR().retune(); }
        return;
      }
      if ((b = g('[data-ds]'))) { d.preset = null; d.sound = b.dataset.ds; d.bright = SOUNDS[d.sound]; changed(); DR().retune(); }
      else if ((b = g('[data-dch]'))) { d.chord = b.dataset.dch; d.fifth = d.chord !== 'root'; changed(); if (DR().on) DR().swap(); }
      else if ((b = g('[data-seg="dsens"] [data-v]'))) { d.sens = b.dataset.v; changed(); }
      else if ((b = g('[data-seg="dwshape"] [data-v]'))) { setFx({ tremShape: b.dataset.v }); changed(); }
      else if ((b = g('[data-seg="dwdiv"] [data-v]'))) { setFx({ tremDiv: b.dataset.v }); changed(); }
    });
    el.addEventListener('input', (e) => {
      const wk = e.target.dataset.dw;
      if (wk) { // волна: сила, мягкость, частота — сразу в звук, подпись рядом
        const v = +e.target.value, lab = el.querySelector('#dw-' + wk);
        if (wk === 'trem') { d.wave = v; ctx.store.save(); }
        setFx({ [wk]: v });
        if (lab) lab.textContent = wk === 'tremRate' ? t('u.hz', { n: ctx.num(v, 1) }) : P(v);
        return;
      }
      const k = e.target.dataset.dk;
      if (!k) return;
      d[k] = +e.target.value;
      const v = el.querySelector('#dv-' + k);
      if (v) v.textContent = (k === 'fade' ? SF : P)(d[k]);
      ctx.store.save();
      if (k === 'vol') DR().vol();
      else if (k === 'rev') DR().setReverb(d.rev);
      else if (k === 'hall') DR().setHall(d.hall);
      else if (k !== 'fade') later();
    });
    el.addEventListener('change', (e) => {
      const k = e.target.dataset.sw;
      if (k === 'dxf') { d.xfade = e.target.checked; ctx.store.save(); }
      else if (k === 'dgest') { d.gest = e.target.checked; changed(); }
      else if (k === 'dwave') { setFx({ trem: e.target.checked ? d.wave : 0 }); changed(); }
    });
  });
}

/* ---------- жесты ---------- */

// Звук разрешён; пауза из шторки снимается касанием пэда — человек взялся играть
const unlocked = () => { if (ctx.audio.unlock()) { ctx.audio.release(); return true; } ctx.ui.toast(ctx.t('noAudio')); return false; };
const isHeld = () => !!(ctx.audio.held && ctx.audio.held());
const dirOf = (dx, dy) => (!D().gest || Math.hypot(dx, dy) < SENS[D().sens] ? null : Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'up' : 'down') : dx < 0 ? 'left' : 'right');

// Сетка: касание — нота созвучием из настроек (звучащая — стоп); ведение по плитке — созвучие жестом, слышно сразу
function padDown(e, tile) {
  // на паузе из шторки касание звучащей плитки — «продолжить», а не «стоп»
  const i = +tile.dataset.v, d = D(), held = isHeld(), was = DR().on && d.pc === i && !held;
  if (held && DR().on && d.pc === i) { unlocked(); drag = { i, tile, id: e.pointerId, x: e.clientX, y: e.clientY, was: false, ch: DR().chord }; tile.classList.add('down'); return; }
  try { tile.setPointerCapture(e.pointerId); } catch { /* */ }
  drag = { i, tile, id: e.pointerId, x: e.clientX, y: e.clientY, was, ch: was ? DR().chord : d.chord };
  tile.classList.add('down');
  if (was || !unlocked()) return;
  d.pc = i;
  ctx.store.save();
  DR().on ? DR().swap() : DR().start();
  mark();
}
function padMove(e) {
  const dir = dirOf(e.clientX - drag.x, e.clientY - drag.y);
  if (!dir) return;
  const ch = DIRS[dir];
  drag.moved = true;
  if (ch === drag.ch && DR().on && D().pc === drag.i) return;
  if (!unlocked()) return;
  drag.ch = ch;
  const d = D();
  d.pc = drag.i;
  ctx.store.save();
  DR().on ? DR().swap({ chord: ch }) : DR().start({ chord: ch });
  mark();
}
function padUp() {
  const g = drag;
  drag = null;
  g.tile.classList.remove('down');
  if (g.was && !g.moved) DR().stop();
  render();
}
// Без перерисовки во время жеста: звучащая плитка и её подпись
function mark() {
  const d = D(), cur = DR().chord;
  host.querySelectorAll('.dtile').forEach((b) => {
    const i = +b.dataset.v, on = DR().on && d.pc === i;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
    b.querySelector('.dlab').innerHTML = tileLabel(i, on ? cur : d.chord);
  });
  const st = host.querySelector('.dstop');
  if (st) { st.disabled = !DR().sounding; st.classList.toggle('live', DR().sounding); }
}

// «Пиано»: «Играть» — звучит, пока держат, пальцем можно вести по клавишам; «Держать» — касание вкл/выкл
const keyAt = (x, y) => { const el = document.elementFromPoint(x, y); const k = el && el.closest('.dkey'); return k && host.contains(k) ? +k.dataset.dk : null; };
const heldBy = (pc) => [...fingers.values()].includes(pc);
function keyMark() {
  const held = DR().held;
  host.querySelectorAll('.dkey').forEach((k) => { const on = held.has(+k.dataset.dk); k.classList.toggle('on', on); k.setAttribute('aria-pressed', on); });
  const st = host.querySelector('.dstop');
  if (st) { st.disabled = !DR().sounding; st.classList.toggle('live', DR().sounding); }
}
function keyDown(e, k) {
  const paused = isHeld();
  if (!unlocked()) return;
  const pc = +k.dataset.dk;
  if (D().latch) { if (paused && DR().held.has(pc)) { keyMark(); return; } DR().held.has(pc) ? DR().keyOff(pc) : DR().keyOn(pc); keyMark(); return; }
  try { host.setPointerCapture(e.pointerId); } catch { /* */ }
  fingers.set(e.pointerId, pc);
  if (!DR().held.has(pc)) DR().keyOn(pc);
  keyMark();
}
function keyMove(e) {
  const old = fingers.get(e.pointerId), pc = keyAt(e.clientX, e.clientY);
  if (pc == null || pc === old) return;
  fingers.set(e.pointerId, pc);
  if (!heldBy(old)) DR().keyOff(old);
  if (!DR().held.has(pc)) DR().keyOn(pc);
  keyMark();
}
function keyUp(e) {
  const pc = fingers.get(e.pointerId);
  fingers.delete(e.pointerId);
  if (pc != null && !heldBy(pc)) DR().keyOff(pc);
  keyMark();
}

function stopAll() { DR().stop(); DR().keysOff(); fingers.clear(); }

// Круг: точка касания → кольцо и место; ведение по дуге — поворот, отпустили — к ближайшей тональности
let spin = null;
function polar(e, svg) {
  const r = svg.getBoundingClientRect(), s = Math.min(r.width, r.height) / 200;
  const x = (e.clientX - (r.left + r.width / 2)) / s, y = (e.clientY - (r.top + r.height / 2)) / s;
  return { r: Math.hypot(x, y), a: (Math.atan2(y, x) * 180) / Math.PI + 90 };
}
function circDown(e, svg) {
  const p = polar(e, svg);
  if (p.r > 100 || snapAnim) return;
  try { svg.setPointerCapture(e.pointerId); } catch { /* */ }
  spin = { id: e.pointerId, svg, last: p.a, total: 0, r0: p.r, rot0: -D().ckey * 30, moved: false, g: e.target.closest('.dseg, .dctr') };
}
const redraw = () => { const c = host && host.querySelector('.dcirc svg'); if (!c) return; const tmp = document.createElement('div'); tmp.innerHTML = circleSVG(); c.innerHTML = tmp.querySelector('svg').innerHTML; };
// Поворот: угол копится по шагам (можно крутить сколько угодно оборотов), у самого центра — не крутит
function circMove(e) {
  const p = polar(e, spin.svg);
  if (p.r < 18) return;
  const da = ((p.a - spin.last + 540) % 360) - 180;
  spin.last = p.a;
  spin.total += da;
  if (!spin.moved && (Math.abs(spin.total) < 8 || spin.r0 < 26)) return;
  spin.moved = true;
  rot = spin.rot0 + spin.total;
  if (!spin.raf) spin.raf = requestAnimationFrame(() => { if (spin) spin.raf = 0; redraw(); });
}
// Отпустили — круг мягко доворачивается до ближайшей тональности
let snapAnim = 0;
function circUp() {
  const s = spin;
  spin = null;
  if (s.raf) cancelAnimationFrame(s.raf);
  if (s.moved) {
    const from = rot, to = Math.round(rot / 30) * 30, t0 = performance.now(), dur = 160;
    const step = (now) => {
      const x = Math.min(1, (now - t0) / dur), e2 = 1 - (1 - x) * (1 - x);
      rot = from + (to - from) * e2;
      redraw();
      if (x < 1) { snapAnim = requestAnimationFrame(step); return; }
      snapAnim = 0;
      D().ckey = ((Math.round(-to / 30) % 12) + 12) % 12;
      rot = null;
      ctx.store.save();
      render();
    };
    snapAnim = requestAnimationFrame(step);
    return;
  }
  const g = s.g;
  if (!g) return;
  if (g.classList.contains('dctr')) { if (DR().on) { DR().stop(); render(); } return; }
  playRing(g.dataset.ring, +g.dataset.i);
}

function bind() {
  onDown = (e) => {
    if (e.button > 0) return;
    const tile = e.target.closest('.dtile');
    if (tile) { e.preventDefault(); lastPtr = performance.now(); padDown(e, tile); return; }
    const k = e.target.closest('.dkey');
    if (k) { e.preventDefault(); keyDown(e, k); return; }
    const svg = e.target.closest('.dcirc svg');
    if (svg) { e.preventDefault(); circDown(e, svg); }
  };
  onMove = (e) => {
    if (drag && e.pointerId === drag.id) padMove(e);
    else if (fingers.has(e.pointerId)) keyMove(e);
    else if (spin && e.pointerId === spin.id) circMove(e);
  };
  onUp = (e) => {
    if (drag && e.pointerId === drag.id) padUp();
    else if (fingers.has(e.pointerId)) keyUp(e);
    else if (spin && e.pointerId === spin.id) circUp();
  };
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  host.addEventListener('contextmenu', (e) => { if (e.target.closest('.dtile,.dkey')) e.preventDefault(); });
  onClick = (e) => {
    const x = e.target.closest('[data-x]');
    if (!x) return;
    const d = D(), a = x.dataset.x;
    if (a === 'dpad') {
      if (performance.now() - lastPtr < 1500) return; // касание — в pointerdown; здесь — только клавиатура (Enter, пробел)
      const i = +x.dataset.v;
      if (DR().on && d.pc === i && isHeld()) unlocked();
      else if (DR().on && d.pc === i) DR().stop();
      else {
        if (!unlocked()) return;
        d.pc = i;
        ctx.store.save();
        DR().on ? DR().swap() : DR().start();
      }
      render();
    } else if (a === 'dstop') { stopAll(); render(); }
    else if (a === 'dlayer') {
      const o = +x.dataset.v, L = d.layers;
      if (L[o] && LAYERS.filter((y) => L[y]).length === 1) { ctx.ui.toast(ctx.t('needLayer')); return; }
      L[o] = !L[o];
      ctx.store.save();
      DR().retune();
      render();
    } else if (a === 'dmode') { stopAll(); d.view = NEXT_VIEW[viewOf()]; ctx.store.save(); render(); }
    else if (a === 'dlatch') { d.latch = !d.latch; DR().keysOff(); fingers.clear(); ctx.store.save(); render(); }
    else if (a === 'dset') droneSheet();
    else if (a === 'darp') {
      if (performance.now() - arpHeld < 600) return; // удержание уже открыло настройки
      const A = (d.arp = { ...(d.arp || {}), on: !(d.arp && d.arp.on) });
      ctx.store.save(); ctx.audio.arp.sync(); render();
      if (A.on && !DR().on) ctx.ui.toast(ctx.t('arp.needPad'));
    }
    else if (a === 'dwave') { setFx({ trem: FX().trem > 0 ? 0 : d.wave }); render(); }
  };
  host.addEventListener('click', onClick);
  // удержание кнопки арпеджиатора — его настройки
  let arpT = 0;
  host.addEventListener('pointerdown', (e) => { if (!e.target.closest('[data-x="darp"]')) return; clearTimeout(arpT); arpT = setTimeout(() => { arpHeld = performance.now(); arpSheet(ctx, render); }, 480); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((k) => host.addEventListener(k, () => clearTimeout(arpT)));
}
let arpHeld = 0;
const ARP_ICON = '<svg viewBox="0 0 24 24"><path d="M4 18l4-4 4 4 4-8 4 4"/><circle cx="4" cy="18" r="1.3"/><circle cx="8" cy="14" r="1.3"/><circle cx="12" cy="18" r="1.3"/><circle cx="16" cy="10" r="1.3"/><circle cx="20" cy="14" r="1.3"/></svg>';

export default {
  ...meta,
  status: (c) => { const d = c.store.all(); return c.t('status', { note: SH[d.pc], sound: c.t('snd.' + (SOUNDS[d.sound] != null ? d.sound : 'soft') + '.s') }); },
  mount(el, c, sz = 'full') {
    host = el; ctx = c; size = sz;
    render();
    bind();
    // звук сменили не отсюда (часы, пульт, сцена), пауза из шторки, возврат из фона — окно показывает то, что на самом деле
    const later = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (host && !drag && !fingers.size && !spin && !snapAnim) render(); }); };
    const onVis = () => { if (!document.hidden) later(); };
    document.addEventListener('visibilitychange', onVis);
    offs = [DR().subscribe(later), ctx.audio.onHold ? ctx.audio.onHold(later) : () => {}, () => document.removeEventListener('visibilitychange', onVis)];
  },
  resize(sz) { size = sz; render(); },
  unmount() {
    offs.forEach((f) => f()); offs = [];
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (host && onClick) {
      host.removeEventListener('click', onClick);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
    }
    drag = null;
    if (!ctx.session) stopAll();
    else if (!D().latch) { DR().keysOff(); fingers.clear(); } // «Играть»: окно закрыли — пальцев на клавишах нет
    host = null;
  },
};
