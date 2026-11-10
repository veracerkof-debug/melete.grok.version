// Метроном: колесо темпа, акценты по долям, дробления, тап, тренер ускорения, тихие такты.
// Перенесено из legacy/practice.html (metroHTML, wheelHTML, drawBeats, meterSheet, moreSheet).
import './metro.css';
import ru from './i18n/ru.json';
import uz from './i18n/uz.json';
import en from './i18n/en.json';
import el from './i18n/el.json';
import { defaultAccents, tempoName, GROUPINGS, accentsOfGroups, groupsLabel } from '../../audio/metronome.js';

import meta, { ICON } from './meta.js';
import { createSetlistBar, SL_ICON } from './setlist.js';

// Ноты дробления
const SUBICON = (() => {
  const head = (x, y, r) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 0.74) + '" transform="rotate(-22 ' + x + ' ' + y + ')"/>';
  const stem = (x, y1, y2) => '<rect x="' + (x - 0.75) + '" y="' + y2 + '" width="1.5" height="' + (y1 - y2) + '"/>';
  const beam = (x1, y1, x2, y2) => '<polygon points="' + x1 + ',' + y1 + ' ' + x2 + ',' + y2 + ' ' + x2 + ',' + (y2 + 2.4) + ' ' + x1 + ',' + (y1 + 2.4) + '"/>';
  const g = (s) => '<svg viewBox="0 0 24 24" class="f">' + s + '</svg>';
  return {
    1: g(head(10, 18, 3.4) + stem(13, 17.4, 3.5)),
    2: g(head(5.5, 18.5, 3) + stem(8.2, 18, 5) + head(16, 17, 3) + stem(18.7, 16.5, 3.5) + beam(7.45, 5, 19.45, 3.5)),
    3: g(head(3.6, 19, 2.4) + stem(5.7, 18.6, 7.5) + head(11.2, 18.3, 2.4) + stem(13.3, 17.9, 6.6) + head(18.8, 17.6, 2.4) + stem(20.9, 17.2, 5.7) +
      beam(4.95, 7.5, 21.65, 5.7) + '<text x="13.3" y="4.6" text-anchor="middle" style="font:700 5.5px var(--font)">3</text>'),
    4: g(head(2.9, 19, 2) + stem(4.6, 18.6, 6.4) + head(8.6, 18.5, 2) + stem(10.3, 18.1, 6) + head(14.3, 18, 2) + stem(16, 17.6, 5.6) + head(20, 17.5, 2) +
      stem(21.7, 17.1, 5.2) + '<polygon points="3.85,6.4 22.45,5.2 22.45,7.2 3.85,8.4"/><polygon points="3.85,9.6 22.45,8.4 22.45,10.4 3.85,11.6"/>'),
  };
})();

const METERS = [[2, 4], [3, 4], [4, 4], [5, 4], [6, 8], [7, 8], [9, 8], [12, 8], [5, 8], [7, 4], [2, 2], [3, 8]];
// Пределы в настройках: [мин, макс, раздел, поле, шаг]
const LIM = { tstep: [1, 20, 'trainer', 'step', 1], tevery: [1, 32, 'trainer', 'every', 1], tmax: [30, 300, 'trainer', 'max', 5],
  gplay: [1, 16, 'gap', 'play', 1], gmute: [1, 16, 'gap', 'mute', 1] };
// Цикл акцента по нажатию на долю: сильный → средний → обычный → без звука → сильный
const NEXT_ACC = { 3: 2, 2: 1, 1: 0, 0: 3 };

function arcD(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
}

// Кольцевой сектор — невидимая зона нажатия доли (сама полоска тонкая, попасть в неё пальцем трудно)
function sectorD(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => (cx + r * Math.cos((a * Math.PI) / 180)).toFixed(2) + ' ' + (cy + r * Math.sin((a * Math.PI) / 180)).toFixed(2);
  const big = a1 - a0 > 180 ? 1 : 0;
  return 'M' + p(r1, a0) + 'A' + r1 + ' ' + r1 + ' 0 ' + big + ' 1 ' + p(r1, a1) + 'L' + p(r0, a1) + 'A' + r0 + ' ' + r0 + ' 0 ' + big + ' 0 ' + p(r0, a0) + 'Z';
}

// Начала групп (доли со средним или сильным акцентом, кроме первой) — отступ в полоске долей
const groupsOf = (c) => new Set(c.accents.map((a, i) => (i > 0 && a >= 2 ? i : -1)).filter((i) => i >= 0));

let host = null, ctx = null, size = 'full', raf = 0, lit = -1;
let rot = 0, wheelMovedAt = 0, taps = [];
const offs = [];

// Сигналы без звука (src/core/pulse.js): настройки на устройстве — ctx.store 'sig'
const SIG_DEF = { flash: false, strong: '#A75750', other: '#FFFFFF', torch: false, vibe: false };
const FLASH_COLORS = ['#FFFFFF', '#A75750', '#9C7242', '#AE934D', '#5F8568', '#567198', '#866B9D'];
const sig = () => ({ ...SIG_DEF, ...(ctx.store.get('sig', {}) || {}) });
const SIG_IC = {
  flash: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 7v2M12 15v2M7.5 12h2M14.5 12h2"/></svg>',
  torch: '<svg viewBox="0 0 24 24"><path d="M8 3h8l-1 6H9zM9 9h6v11a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/><path d="M12 13v3"/></svg>',
  vibe: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="18" rx="2"/><path d="M4.5 8v8M19.5 8v8M2 10v4M22 10v4"/></svg>',
};
// Включённые сигналы — значками под колесом; нажатие открывает настройки
function sigHTML() {
  const s = sig(), on = ['flash', 'torch', 'vibe'].filter((k) => s[k]);
  if (!on.length) return '';
  return '<button class="msig" data-s="more" aria-label="' + ctx.ui.esc(ctx.t('sig.on', { list: on.map((k) => ctx.t('sig.' + k)).join(', ') })) + '">' +
    on.map((k) => '<span class="msi" title="' + ctx.ui.esc(ctx.t('sig.' + k)) + '">' + SIG_IC[k] + '<i>' + ctx.t('sig.' + k + '.short') + '</i></span>').join('') + '</button>';
}

const M = () => ctx.audio.metro;
const cfg = () => ctx.audio.metro.cfg;
// Сет-лист (setlist.js): полоса песен, открыта до закрытия; создаётся при монтировании
let SL = null;
// Песня сет-листа: темп и размер сразу, без остановки (размер — с начала такта)
function applySong({ bpm, num, den }) {
  const c = cfg();
  if (bpm) M().setBpm(bpm);
  if (num && den && (c.num !== num || c.den !== den)) { c.num = num; c.den = den; c.accents = defaultAccents(num, den); M().restartBeat({ bar: true }); }
  M().save();
}
const adj = () => (ctx.mono ? 'both' : ctx.store.get('adj', 'wheel')); // «Минимал» — колесо и стрелки

/* ---------- разметка ---------- */

function bpmButton(c) {
  const { t, ui } = ctx;
  return '<button class="bpm num bpmb" data-x="bpmin" id="bpm" aria-label="' + ui.esc(t('tempoBtn', { bpm: c.bpm })) + '">' + c.bpm + '</button>';
}

function playButton() {
  const { t, ui } = ctx, on = M().running;
  return '<button class="bigplay" data-s="metro" id="mbtn" aria-label="' + t(on ? 'stop' : 'start') + '">' + (on ? ui.icons.stop : ui.icons.play) + '</button>';
}

function wheelHTML() {
  const c = cfg(), { t, ui } = ctx, mode = adj(), arrows = mode !== 'wheel';
  let ticks = '';
  for (let i = 0; i < 72; i++) {
    const a = (i * 5 * Math.PI) / 180, big = i % 6 === 0, r1 = big ? 78 : 81.5;
    ticks += '<line x1="' + (100 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (100 + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (100 + 90 * Math.cos(a)).toFixed(1) +
      '" y2="' + (100 + 90 * Math.sin(a)).toFixed(1) + '"' + (big ? ' class="big"' : '') + '/>';
  }
  return '<div class="mwheel' + (mode === 'arrows' ? ' nowheel' : '') + '" id="mwheel"><svg viewBox="0 0 200 200" id="mwsl" role="slider" tabindex="0" focusable="true" aria-label="' + t('tempo') +
    '" aria-valuemin="20" aria-valuemax="300" aria-valuenow="' + c.bpm + '"><circle cx="100" cy="100" r="84" class="wband"/>' +
    (mode === 'arrows' ? '' : '<g id="wticks" class="wticks" style="transform:rotate(' + rot + 'deg)">' + ticks + '</g>') + '<g id="wbeats"></g></svg>' +
    '<div class="wcenter">' + (arrows ? '<div class="wrow">' + ui.icb('data-hold="-1"', ui.icons.left, t('slower'), 'warr') + bpmButton(c) +
      ui.icb('data-hold="1"', ui.icons.right, t('faster'), 'warr') + '</div>' : bpmButton(c)) +
    '<div class="bpmlbl" id="tname">' + tempoName(c.bpm) + '</div>' + playButton() + '</div></div>';
}

function view() {
  const c = cfg(), { t, ui } = ctx, meterTxt = c.num + '/' + c.den;
  const tile = (attrs, inner, lab) => '<button class="mtile" ' + attrs + ' aria-label="' + ui.esc(lab) + '" title="' + ui.esc(lab) + '">' + inner + '</button>';
  const gl = groupsLabel(c.accents); // 7/8 · 3+2+2
  const meter = tile('data-s="meter"', '<b class="num">' + meterTxt + (gl ? '<small class="mgrp"> ' + gl + '</small>' : '') + '</b>', t('meterBtn', { meter: meterTxt + (gl ? ' ' + gl : '') }));
  const sub = tile('data-x="msub"', SUBICON[c.sub], t('subBtn', { sub: t('sub.' + c.sub) }));
  if (size === 'strip') {
    return '<div class="vs"><div class="beats mini" id="beats"></div>' + sigHTML() + '<div class="srow2">' + meter + ui.icb('data-hold="-1"', ui.icons.left, t('slower'), 'round') +
      '<div class="bpmbox">' + bpmButton(c) + '<div class="bpmlbl" id="tname">' + tempoName(c.bpm) + '</div></div>' +
      ui.icb('data-hold="1"', ui.icons.right, t('faster'), 'round') + playButton() + '</div></div>';
  }
  const tags = [c.sub === 2 && c.swing ? t('tag.swing') : '', c.trainer.on ? t('tag.trainer', { step: c.trainer.step, every: c.trainer.every }) : '',
    c.gap.on ? t('tag.gap', { play: c.gap.play, mute: c.gap.mute }) : ''].filter(Boolean);
  const ctl = size === 'quarter' ? [meter, sub]
    : [meter, tile('data-s="sl" aria-pressed="' + !!(SL && SL.open) + '"', SL_ICON, t('sl.title')), tile('data-s="tap"', '<i class="bareic" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" style="fill:currentColor"/><circle cx="12" cy="12" r="7.5" style="fill:none;stroke:currentColor;stroke-width:1.6"/></svg></i><b class="tapt bt">TAP</b>', t('tap')), sub, tile('data-s="more"', ui.icons.gear, t('settings'))];
  const mv = '<div class="mv ' + size + '">' + wheelHTML() + '<div class="mside"><div class="mctl n' + ctl.length + '">' + ctl.join('') +
    '</div><div class="barct num" id="barct" aria-live="off">' + tags.join(' · ') + '</div>' + sigHTML() + '</div></div>';
  const bar = size !== 'quarter' && SL ? SL.html() : '';
  return bar ? '<div class="mwrap sl">' + mv + bar + '</div>' : mv;
}

function drawBeats() {
  const c = cfg(), { t } = ctx, wb = host.querySelector('#wbeats');
  if (wb) {
    const n = c.num, gap = n > 1 ? (n > 8 ? 5 : 9) : 0, seg = 360 / n;
    let s = '';
    // зоны нажатия: весь сектор доли от центрального круга до делений колеса
    for (let i = 0; i < n; i++) {
      const h0 = -90 + i * seg + (n > 1 ? 0.5 : 0), h1 = -90 + (i + 1) * seg - (n > 1 ? 0.5 : 0.01);
      s += '<path class="whit" data-beat="' + i + '" aria-hidden="true" d="' + sectorD(100, 100, 46, 77, h0, h1) + '"/>';
    }
    for (let i = 0; i < n; i++) {
      const a0 = -90 + i * seg + gap / 2, a1 = -90 + (i + 1) * seg - gap / 2 - (n === 1 ? 0.01 : 0), l = c.accents[i];
      s += '<path class="wseg l' + l + '" data-beat="' + i + '" data-l="' + l + '" d="' + arcD(100, 100, 64, a0, a1) + '" role="button" tabindex="0" aria-label="' +
        t('beatLevel', { n: i + 1, level: t('level.' + l) }) + '"/>';
      if (l >= 2) {
        const am = (((a0 + a1) / 2) * Math.PI) / 180;
        s += '<circle class="wacc a' + l + '" cx="' + (100 + 53 * Math.cos(am)).toFixed(1) + '" cy="' + (100 + 53 * Math.sin(am)).toFixed(1) + '" r="' + (l === 3 ? 2.2 : 1.6) + '"/>';
      }
    }
    // полиритм — точки внутри кольца долей: N на такт или N на каждую долю, первая в группе крупнее
    const pn = Math.round(c.poly || 0);
    if (pn >= 2) { const tot = c.polyPer === 'beat' ? pn * n : pn; for (let k = 0; k < tot; k++) { const a = ((-90 + (360 * k) / tot) * Math.PI) / 180; s += '<circle class="wpoly' + (k % pn ? '' : ' a') + '" cx="' + (100 + 40 * Math.cos(a)).toFixed(1) + '" cy="' + (100 + 40 * Math.sin(a)).toFixed(1) + '" r="' + (k % pn ? 1.4 : 2.2) + '"/>'; } }
    wb.innerHTML = s;
  }
  const b = host.querySelector('#beats');
  if (!b) return;
  const g = groupsOf(c);
  // в полоске доли только показываются: точки 12 px — не цель для пальца; акценты — в окне побольше
  if (size === 'strip') { b.setAttribute('aria-hidden', 'true'); b.innerHTML = c.accents.map((a, i) => '<span class="beat' + (g.has(i) && c.num > 4 ? ' grp' : '') + '" data-beat="' + i + '" data-l="' + a + '"><i></i></span>').join(''); return; }
  b.innerHTML = c.accents.map((a, i) => '<button class="beat' + (g.has(i) && c.num > 4 ? ' grp' : '') + '" data-beat="' + i + '" data-l="' + a +
    '" aria-label="' + t('beatLevel', { n: i + 1, level: t('level.' + a) }) + '"><i></i></button>').join('');
}

function render() {
  if (!host) return;
  host.innerHTML = view();
  lit = -1;
  drawBeats();
}

// Обновить только число темпа (без перерисовки — не сбивать жест)
function updBpm() {
  const c = cfg(), q = (s) => host && host.querySelector(s);
  const e = q('#bpm');
  if (e) { e.textContent = c.bpm; e.setAttribute('aria-label', ctx.t('tempoBtn', { bpm: c.bpm })); }
  const tn = q('#tname');
  if (tn) tn.textContent = tempoName(c.bpm);
  const w = q('#mwsl');
  if (w) w.setAttribute('aria-valuenow', c.bpm);
}

function setBpm(v) {
  M().setBpm(v);
  updBpm();
}

/* ---------- анимация долей ---------- */

function loop() {
  const m = M();
  if (m.running) {
    let q = null;
    for (const ev of m.due()) q = ev;
    if (q && q.s === 0) {
      const bp = host.querySelector('#bpm');
      if (bp) { bp.classList.remove('tick'); void bp.offsetWidth; bp.classList.add('tick'); }
      host.querySelectorAll('#beats .beat, #wbeats .wseg').forEach((d) => d.classList.toggle('lit', +d.dataset.beat === q.b));
      lit = q.b;
      const bc = host.querySelector('#barct');
      if (bc) bc.textContent = ctx.t(q.silent ? 'barSilent' : 'bar', { n: q.bar + 1 });
    }
    // тренер поднял темп
    const bp = host.querySelector('#bpm');
    if (bp && +bp.textContent !== m.cfg.bpm) updBpm();
  } else if (lit >= 0) {
    host.querySelectorAll('#beats .beat, #wbeats .wseg').forEach((d) => d.classList.remove('lit'));
    lit = -1;
  }
  raf = requestAnimationFrame(loop);
}

/* ---------- действия ---------- */

function toggle(btn) {
  const m = M(), { t, ui } = ctx;
  if (m.running) m.stop();
  else if (!m.start()) { ui.toast(t('noAudio')); return; }
  btn.innerHTML = m.running ? ui.icons.stop : ui.icons.play;
  btn.setAttribute('aria-label', t(m.running ? 'stop' : 'start'));
  if (!m.running) render(); // вернуть подписи вместо «Такт N»
}

function tap() {
  const n = performance.now();
  taps = taps.filter((x) => n - x < 2500);
  taps.push(n);
  if (taps.length >= 2) {
    const iv = [];
    for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
    const r = iv.slice(-4);
    setBpm(60000 / (r.reduce((x, y) => x + y, 0) / r.length));
    M().save();
  }
}

function bpmInput() {
  const { t, ui } = ctx;
  ui.sheet(() => ui.snav(t('in.title'), { left: '<button class="link l" data-close>' + t('cancel') + '</button>', right: '<button class="link b r" id="bpmok">' + t('done') + '</button>' }) +
    '<div class="bpmin"><input id="bpmv" type="number" inputmode="numeric" min="20" max="300" value="' + cfg().bpm + '" class="num" aria-label="' + t('in.label') + '"><span>bpm</span></div>' +
    '<div class="pickrow" style="justify-content:center">' + [60, 72, 80, 90, 100, 110, 120, 140, 160, 180].map((v) => '<button class="lchip off" data-bq="' + v + '">' + v + '</button>').join('') +
    '</div><p class="ftr" style="text-align:center">' + t('in.range') + '</p>',
  (el, sh) => {
    const i = el.querySelector('#bpmv');
    setTimeout(() => { i.focus(); i.select(); }, 80);
    const ok = () => {
      const v = parseInt(i.value, 10);
      if (!(v >= 20 && v <= 300)) { ui.toast(t('in.rangeToast')); return; }
      setBpm(v);
      M().save();
      sh.close();
    };
    el.addEventListener('click', (e) => {
      if (e.target.closest('#bpmok')) ok();
      const b = e.target.closest('[data-bq]');
      if (b) { i.value = b.dataset.bq; ok(); }
    });
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
  });
}

function meterSheet() {
  const { t, ui } = ctx, c = cfg();
  let num = c.num, den = c.den;
  ui.sheet(() => ui.snav(t('meter.title'), { left: '<button class="link l" data-close>' + t('cancel') + '</button>', right: '<button class="link b r" id="ok">' + t('done') + '</button>' }) +
    '<div style="text-align:center;font-size:56px;font-weight:300;letter-spacing:-.03em;margin:4px 0 8px" class="num" id="mview">' + num + '/' + den + '</div>' +
    '<div class="group"><div class="cell"><span class="grow">' + t('meter.beats') + '</span><span class="val num" style="color:var(--ink);margin-right:6px" id="nv">' + num + '</span>' +
    ui.stepper('num', t('meter.beats')) + '</div><div class="cellcol"><div style="margin-bottom:8px">' + t('meter.den') + '</div>' +
    ui.seg('den', [[2, '1/2'], [4, '1/4'], [8, '1/8'], [16, '1/16']], den, t('meter.den')) + '</div></div>' +
    '<div class="hdr">' + t('meter.common') + '</div><div class="group"><div class="cellcol" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' +
    METERS.map(([n, d]) => '<button class="pill num" data-pre="' + n + '/' + d + '" aria-pressed="' + (n === num && d === den) + '">' + n + '/' + d + '</button>').join('') +
    '</div></div><div class="hdr">' + t('meter.groups') + '</div><div class="group"><div class="cellcol" id="grpbox"></div></div><p class="ftr">' + t('meter.ftr') + '</p>',
  (el, sh) => {
    let groups = groupsLabel(c.accents);
    setTimeout(() => { const box = el.querySelector('#grpbox'); if (box && !box.innerHTML) grpRef(); }, 0);
    const grpRef = () => { const box = el.querySelector('#grpbox'), list = GROUPINGS[num] || []; if (!box) return; box.innerHTML = list.length ? '<div class="pickrow">' + [['', t('meter.even')], ...list.map((g) => [g, g])].map(([g, l]) => '<button type="button" class="lchip pick num' + ((groups || '') === g ? ' on' : '') + '" data-grp="' + g + '" aria-pressed="' + ((groups || '') === g) + '" style="--c:var(--tint);--t:var(--on-tint)">' + l + '</button>').join('') + '</div>' : '<span class="l2" style="font-size:14px">' + t('meter.noGroups') + '</span>'; };
    const ref = () => {
      if (!(GROUPINGS[num] || []).includes(groups)) groups = '';
      grpRef();
      el.querySelector('#mview').textContent = num + '/' + den;
      el.querySelector('#nv').textContent = num;
      el.querySelectorAll('[data-pre]').forEach((p) => p.setAttribute('aria-pressed', p.dataset.pre === num + '/' + den));
      el.querySelectorAll('[data-seg="den"] button').forEach((x) => x.setAttribute('aria-pressed', +x.dataset.v === den));
    };
    el.addEventListener('click', (e) => {
      const st = e.target.closest('[data-step]');
      if (st) { num = Math.max(1, Math.min(16, num + +st.dataset.d)); ref(); return; }
      const sg = e.target.closest('[data-seg="den"] [data-v]');
      if (sg) { den = +sg.dataset.v; ref(); return; }
      const pr = e.target.closest('[data-pre]');
      if (pr) { [num, den] = pr.dataset.pre.split('/').map(Number); ref(); return; }
      const gp = e.target.closest('[data-grp]');
      if (gp) { groups = gp.dataset.grp; grpRef(); return; }
      if (e.target.closest('#ok')) {
        c.num = num; c.den = den; c.accents = groups && GROUPINGS[num] && GROUPINGS[num].includes(groups) ? accentsOfGroups(groups) : defaultAccents(num, den);
        M().restartBeat({ bar: true });
        M().save();
        sh.close();
        render();
      }
    });
  });
}

async function moreSheet() {
  const { t, tn, ui } = ctx, c = cfg();
  const caps = ctx.pulse ? await ctx.pulse.info() : { vibrate: false, torch: false };
  const sw = (k, s, extra = '') => '<div class="cell"><span class="grow">' + t('sig.' + k) + extra + '</span>' + ui.sw('sig_' + k, s[k], t('sig.' + k)) + '</div>';
  const colors = (k, cur) => '<div class="cellcol"><div style="margin-bottom:8px">' + t('sig.' + k) + '</div><div class="sigcols">' +
    FLASH_COLORS.map((col) => '<button type="button" class="sigc' + (cur === col ? ' on' : '') + '" data-sigc="' + k + '" data-col="' + col + '" style="background:' + col + '" aria-pressed="' + (cur === col) + '" aria-label="' + ui.esc(t('sig.color', { c: col })) + '"></button>').join('') + '</div></div>';
  const sigGroup = () => {
    const s = sig();
    return '<div class="hdr">' + t('sig.title') + '</div><div class="group">' + sw('flash', s) +
      (s.flash ? colors('strong', s.strong) + colors('other', s.other) : '') +
      (caps.torch ? sw('torch', s) : '') + (caps.vibrate ? sw('vibe', s) : '') + '</div>' +
      '<p class="ftr">' + t('sig.ftr') + (caps.torch && caps.vibrate ? '' : ' ' + t('sig.android')) + '</p>';
  };
  const val = (s) => '<span class="val num" style="color:var(--ink);margin-right:6px">' + s + '</span>';
  const body = () => ui.snav(t('more.title')) +
    '<div class="hdr" style="margin-top:4px">' + t('adj') + '</div><div class="group"><div class="cellcol">' +
    (ctx.mono ? t('monoFixed', { v: t('adj.both') }) : ui.seg('adj', [['wheel', t('adj.wheel')], ['arrows', t('adj.arrows')], ['both', t('adj.both')]], adj(), t('adj'))) + '</div></div><p class="ftr">' + t('adj.ftr') + '</p>' +
    '<div class="hdr">' + t('sound') + '</div><div class="group"><div class="cellcol">' +
    ui.seg('sound', [['click', t('sound.click')], ['wood', t('sound.wood')], ['beep', t('sound.beep')]], c.sound, t('sound')) + '</div></div>' +
    sigGroup() +
    '<div class="hdr">' + t('subdiv') + '</div><div class="group"><div class="cellcol">' +
    ui.seg('sub2', [1, 2, 3, 4].map((n) => [n, t('subdiv.' + n)]), c.sub, t('subdiv')) + '</div>' +
    (c.sub === 2 ? '<div class="cell"><span class="grow">' + t('swing') + '</span>' + ui.sw('swing', c.swing, t('swing')) + '</div>' : '') + '</div>' +
    '<div class="hdr">' + t('poly') + '</div><div class="group"><div class="cellcol">' +
    ui.seg('poly', [[0, t('poly.off')], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7']], c.poly || 0, t('poly')) + '</div>' +
    (c.poly >= 2 ? '<div class="cellcol">' + ui.seg('polyper', [['bar', t('poly.bar')], ['beat', t('poly.beat')]], c.polyPer === 'beat' ? 'beat' : 'bar', t('poly')) + '</div>' : '') + '</div>' +
    '<p class="ftr">' + (c.polyPer === 'beat' && c.poly >= 2 ? t('poly.ftrBeat', { n: c.poly }) : t('poly.ftr', { n: c.poly || 3, num: c.num })) + '</p>' +
    '<div class="hdr">' + t('trainer') + '</div><div class="group"><div class="cell"><span class="grow">' + t('on') + '</span>' + ui.sw('tr', c.trainer.on, t('trainer')) + '</div>' +
    (c.trainer.on ? '<div class="cell"><span class="grow">' + t('tr.step') + '</span>' + val(t('tr.stepVal', { n: c.trainer.step })) + ui.stepper('tstep', t('tr.stepLbl')) + '</div>' +
      '<div class="cell"><span class="grow">' + t('tr.every') + '</span>' + val(tn('tr.everyVal', c.trainer.every)) + ui.stepper('tevery', t('tr.everyLbl')) + '</div>' +
      '<div class="cell"><span class="grow">' + t('tr.max') + '</span>' + val(t('tr.maxVal', { n: c.trainer.max })) + ui.stepper('tmax', t('tr.maxLbl')) + '</div>' : '') + '</div>' +
    '<p class="ftr">' + t('tr.ftr') + '</p>' +
    '<div class="hdr">' + t('gap') + '</div><div class="group"><div class="cell"><span class="grow">' + t('on') + '</span>' + ui.sw('gap', c.gap.on, t('gap')) + '</div>' +
    (c.gap.on ? '<div class="cell"><span class="grow">' + t('gap.play') + '</span>' + val(c.gap.play) + ui.stepper('gplay', t('gap.playLbl')) + '</div>' +
      '<div class="cell"><span class="grow">' + t('gap.mute') + '</span>' + val(c.gap.mute) + ui.stepper('gmute', t('gap.muteLbl')) + '</div>' : '') + '</div>' +
    '<p class="ftr">' + t('gap.ftr') + '</p>' +
    '<div class="group" style="margin-top:24px"><button class="cell act center" id="rst">' + t('resetAcc') + '</button></div>';
  ui.sheet(body, (el, sh) => {
    const changed = () => { M().save(); sh.update(); render(); };
    const setSig = (k, v) => { ctx.store.set('sig', { ...sig(), [k]: v }); sh.update(); render(); };
    el.addEventListener('click', (e) => {
      const sc = e.target.closest('[data-sigc]');
      if (sc) { setSig(sc.dataset.sigc, sc.dataset.col); return; }
      const sg = e.target.closest('[data-seg] [data-v]');
      if (sg) {
        const k = sg.closest('[data-seg]').dataset.seg, v = sg.dataset.v;
        if (k === 'adj') { ctx.store.set('adj', v); sh.update(); render(); return; }
        if (k === 'sound') c.sound = v;
        else if (k === 'poly') c.poly = +v;
        else if (k === 'polyper') c.polyPer = v === 'beat' ? 'beat' : 'bar';
        else { c.sub = +v; M().restartBeat(); }
        changed();
        return;
      }
      const st = e.target.closest('[data-step]');
      if (st) {
        const [lo, hi, o, f, step] = LIM[st.dataset.step];
        c[o][f] = Math.max(lo, Math.min(hi, c[o][f] + +st.dataset.d * step));
        changed();
        return;
      }
      if (e.target.closest('#rst')) {
        c.accents = defaultAccents(c.num, c.den);
        M().save();
        drawBeats();
        ui.toast(t('resetAccDone'));
      }
    });
    el.addEventListener('change', (e) => {
      const k = e.target.dataset.sw;
      if (!k) return;
      if (k.startsWith('sig_')) { setSig(k.slice(4), e.target.checked); return; }
      if (k === 'swing') c.swing = e.target.checked;
      if (k === 'tr') { c.trainer.on = e.target.checked; if (c.trainer.max <= c.bpm) c.trainer.max = Math.min(300, c.bpm + 20); }
      if (k === 'gap') c.gap.on = e.target.checked;
      changed();
    });
  });
}

/* ---------- жесты ---------- */

function bind() {
  const on = (el, ev, fn, opts) => { el.addEventListener(ev, fn, opts); offs.push(() => el.removeEventListener(ev, fn, opts)); };

  on(host, 'pointerdown', (e) => SL.onDown(e));
  on(host, 'pointermove', (e) => SL.onMove(e));
  on(host, 'pointerup', () => SL.onUp());
  on(host, 'pointercancel', () => SL.onUp());
  on(host, 'click', (e) => {
    if (SL.onClick(e)) return;
    const bt = e.target.closest('[data-beat]');
    if (bt) {
      if (Date.now() - wheelMovedAt < 400) return;
      const i = +bt.dataset.beat, c = cfg();
      c.accents[i] = NEXT_ACC[c.accents[i]];
      M().save();
      drawBeats();
      return;
    }
    const x = e.target.closest('[data-x]');
    if (x) {
      if (x.dataset.x === 'bpmin') bpmInput();
      if (x.dataset.x === 'msub') { const c = cfg(); c.sub = (c.sub % 4) + 1; M().restartBeat(); M().save(); render(); }
      return;
    }
    const s = e.target.closest('[data-s]');
    if (!s) return;
    const a = s.dataset.s;
    if (a === 'metro') toggle(s);
    else if (a === 'tap') tap();
    else if (a === 'meter') meterSheet();
    else if (a === 'sl') SL.toggle();
    else if (a === 'more') moreSheet();
  });

  // Колесо: поворот на 4° — 1 bpm
  let wh = null;
  on(host, 'pointerdown', (e) => {
    const w = e.target.closest('.mwheel');
    if (!w || e.target.closest('.bigplay,.bpmb,.warr') || adj() === 'arrows') return;
    const r = w.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy;
    if (Math.hypot(dx, dy) < r.width * 0.3) return;
    wh = { pid: e.pointerId, cx, cy, a: Math.atan2(dy, dx), acc: 0, moved: 0 };
  }, true);
  on(window, 'pointermove', (e) => {
    if (!wh || e.pointerId !== wh.pid) return;
    const a = Math.atan2(e.clientY - wh.cy, e.clientX - wh.cx);
    let d = a - wh.a;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    wh.a = a;
    const deg = (d * 180) / Math.PI;
    wh.moved += Math.abs(deg);
    wh.acc += deg;
    rot += deg;
    const tk = host.querySelector('#wticks');
    if (tk) tk.style.transform = 'rotate(' + rot + 'deg)';
    const st = Math.trunc(wh.acc / 4);
    if (st) { setBpm(cfg().bpm + st); wh.acc -= st * 4; }
    if (wh.moved > 8) wheelMovedAt = Date.now(); // небольшое дрожание пальца при нажатии на долю — не поворот
  }, { passive: true });
  const wheelUp = (e) => { if (wh && e.pointerId === wh.pid) { if (wh.moved > 6) M().save(); wh = null; } };
  on(window, 'pointerup', wheelUp, true);
  on(window, 'pointercancel', wheelUp, true);

  on(host, 'keydown', (e) => {
    if (e.target.id !== 'mwsl') return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { setBpm(cfg().bpm + 1); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { setBpm(cfg().bpm - 1); e.preventDefault(); }
  });
  on(host, 'keyup', (e) => { if (e.target.id === 'mwsl' && e.key.startsWith('Arrow')) M().save(); });

  // Стрелки: нажатие — ±1, удержание — быстрее по 2
  let t0 = null, iv = null;
  const holdStop = () => { clearTimeout(t0); clearInterval(iv); const was = t0 || iv; t0 = iv = null; if (was) M().save(); };
  on(host, 'pointerdown', (e) => {
    const b = e.target.closest('[data-hold]');
    if (!b) return;
    e.preventDefault();
    const d = +b.dataset.hold;
    setBpm(cfg().bpm + d);
    t0 = setTimeout(() => { iv = setInterval(() => setBpm(cfg().bpm + d * 2), 70); }, 400);
  });
  on(window, 'pointerup', holdStop);
  on(window, 'pointercancel', holdStop);
}

export default {
  ...meta,
  status: (c) => c.t('status', { bpm: c.audio.metro.cfg.bpm, meter: c.audio.metro.cfg.num + '/' + c.audio.metro.cfg.den }) + (c.audio.metro.cfg.poly >= 2 ? ' · ' + c.audio.metro.cfg.poly + ':' + c.audio.metro.cfg.num : ''),
  mount(el, c, sz = 'full') {
    host = el; ctx = c; size = sz;
    SL = createSetlistBar(c, { M, cfg, apply: applySong, rerender: () => render() });
    // пульт и часы: «вперёд/назад» — соседняя песня сет-листа (если полоса открыта), название — песня
    if (c.remote) c.remote({ title: () => (SL && SL.open ? SL.now() : ''), next: () => SL && SL.open && SL.step(1), prev: () => SL && SL.open && SL.step(-1) });
    render();
    bind();
    raf = requestAnimationFrame(loop);
  },
  resize(sz) { size = sz; render(); },
  unmount() {
    cancelAnimationFrame(raf);
    offs.splice(0).forEach((f) => f());
    // В сессии окно могут перестроить или свернуть — метроном продолжает играть
    if (M().running && !ctx.session) M().stop();
    host = null;
  },
};

