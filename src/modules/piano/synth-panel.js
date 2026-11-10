// Панель звука пианино: два слоя («Звук» и «Слой»), пресеты, «ретро-синтезатор» с ручками и осциллограммой,
// режим звука, мини-клавиатура. Касание пресета — звук выбранного слоя, удержание — второй слой (повторное удержание
// того же — убрать слой). Ручки — свои у каждого звука (synth.js: knobsOf), ниже — громкость и эквалайзер слоя.
// Перенесено из legacy/practice.html (synBody, synBind, knobSVG, knobBind, scopeStart, mkbHTML, mkbBind).
import { PRESETS, PATCH_RANGE, KNOB_DEF, MIX_KNOBS, knobsOf, knobVal, presetOf, pianoPatch, pianoLayer, applyPreset } from '../../audio/synth.js';
import { harmAmp } from '../../audio/waves.js';
import { presetRow, promptName, presetManager } from '../../ui/presets.js';

const SH = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const WHITE = [0, 2, 4, 5, 7, 9, 11];

// Подпись значения ручки
function fmt(ctx, k, v) {
  const { t, num } = ctx;
  if (k === 'att') return v >= 1000 ? t('u.s', { n: num(v / 1000, 1) }) : t('u.ms', { n: Math.round(v) });
  if (k === 'dec' || k === 'rel') return t('u.s', { n: num(+v, 2) });
  if (k.startsWith('eq')) return (v > 0.05 ? '+' : '') + num(Math.round(v * 2) / 2, 1) + ' dB';
  if (k === 'fmi' || k === 'res') return num(Math.round(v * 10) / 10, 1);
  return Math.round(v * 100) + '%';
}

// Название ручки: у некоторых звуков та же ручка значит своё (у рояля «яркость» — крышка, у органа «тембр» — регистры)
function labelOf(ctx, s, k) {
  const L = s.kind === 'grand' ? { bright: 'lid', rel: 'damp' } : s.air ? { cho: 'width' } : s.kind === 'organ' ? { tone: 'draw', cho: 'leslie' } :
    s.partials ? { dec: 'ring' } : s.fenv != null ? { bright: 'cutoff' } : {};
  return ctx.t('k.' + (L[k] || k));
}

// Какой слой правит панель: 'main' | 'layer'
let slot = 'main';

const angle = (p) => -225 + p * 270;
const pt = (d, r = 22) => [30 + r * Math.cos((d * Math.PI) / 180), 30 + r * Math.sin((d * Math.PI) / 180)];

function knobSVG(ctx, k, v, lab = ctx.t('k.' + k)) {
  const [min, max] = PATCH_RANGE[k], p = (v - min) / (max - min), a = angle(p);
  const [x0, y0] = pt(-225), [x1, y1] = pt(a), [xe, ye] = pt(45);
  return '<div class="knob" data-kn="' + k + '" data-min="' + min + '" data-max="' + max + '" role="slider" tabindex="0" aria-label="' + lab +
    '" aria-valuemin="' + min + '" aria-valuemax="' + max + '" aria-valuenow="' + v + '" aria-valuetext="' + fmt(ctx, k, v) + '" title="' + ctx.t('k.reset') +
    '"><svg viewBox="0 0 60 60"><path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'A22 22 0 1 1 ' + xe.toFixed(1) + ' ' + ye.toFixed(1) + '" class="kt"/>' +
    (p > 0.005 ? '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'A22 22 0 ' + (a + 225 > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + '" class="kv"/>' : '') +
    '<circle cx="30" cy="30" r="15" class="kc"/><line x1="30" y1="30" x2="' + (30 + 12 * Math.cos((a * Math.PI) / 180)).toFixed(1) + '" y2="' +
    (30 + 12 * Math.sin((a * Math.PI) / 180)).toFixed(1) + '" class="kp"/></svg><b class="kl">' + lab + '</b><span class="kx num">' + fmt(ctx, k, v) + '</span></div>';
}

function knobUpdate(ctx, el, v) {
  const k = el.dataset.kn, min = +el.dataset.min, max = +el.dataset.max, p = (v - min) / (max - min), a = angle(p);
  const [x0, y0] = pt(-225), [x1, y1] = pt(a);
  let kv = el.querySelector('.kv');
  if (p > 0.005) {
    if (!kv) { kv = document.createElementNS('http://www.w3.org/2000/svg', 'path'); kv.setAttribute('class', 'kv'); el.querySelector('.kt').after(kv); }
    kv.setAttribute('d', 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'A22 22 0 ' + (a + 225 > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1));
  } else if (kv) kv.remove();
  const kp = el.querySelector('.kp');
  kp.setAttribute('x2', (30 + 12 * Math.cos((a * Math.PI) / 180)).toFixed(1));
  kp.setAttribute('y2', (30 + 12 * Math.sin((a * Math.PI) / 180)).toFixed(1));
  el.querySelector('.kx').textContent = fmt(ctx, k, v);
  el.setAttribute('aria-valuenow', Math.round(v * 100) / 100);
  el.setAttribute('aria-valuetext', fmt(ctx, k, v));
}

// Ручки: тянуть вверх/вправо, колесо мыши, стрелки; двойное нажатие — значение пресета
function knobBind(ctx, root, get, set, offs) {
  let d = null, lastTap = { k: null, t: 0 };
  const move = (e) => {
    if (!d || e.pointerId !== d.id) return;
    e.preventDefault();
    const delta = d.y - e.clientY + (e.clientX - d.x) * 0.6, range = d.max - d.min;
    const nv = Math.max(d.min, Math.min(d.max, d.v + (delta / (d.fine ? 520 : 200)) * range));
    if (Math.abs(delta) > 3) d.moved = true;
    set(d.key, nv);
    knobUpdate(ctx, d.el, nv);
  };
  const up = (e) => {
    if (!d || e.pointerId !== d.id) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    d.el.classList.remove('drag');
    if (!d.moved) {
      const now = Date.now();
      if (lastTap.k === d.key && now - lastTap.t < 350) { set(d.key, null, true); lastTap = { k: null, t: 0 }; }
      else lastTap = { k: d.key, t: now };
    }
    ctx.store.save();
    d = null;
  };
  const on = (ev, fn, o) => { root.addEventListener(ev, fn, o); offs.push(() => root.removeEventListener(ev, fn, o)); };
  on('pointerdown', (e) => {
    const el = e.target.closest('[data-kn]');
    if (!el) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    d = { el, key: el.dataset.kn, id: e.pointerId, y: e.clientY, x: e.clientX, v: get(el.dataset.kn), min: +el.dataset.min, max: +el.dataset.max, moved: false, fine: e.shiftKey };
    el.classList.add('drag');
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
  let wt = 0;
  on('wheel', (e) => {
    const el = e.target.closest('[data-kn]');
    if (!el) return;
    e.preventDefault();
    const k = el.dataset.kn, min = +el.dataset.min, max = +el.dataset.max, nv = Math.max(min, Math.min(max, get(k) - (e.deltaY / 600) * (max - min)));
    set(k, nv);
    knobUpdate(ctx, el, nv);
    clearTimeout(wt);
    wt = setTimeout(() => ctx.store.save(), 300);
  }, { passive: false });
  on('keydown', (e) => {
    const el = e.target.closest('[data-kn]');
    if (!el) return;
    const k = el.dataset.kn, min = +el.dataset.min, max = +el.dataset.max, st = (max - min) / 50;
    let v = get(k);
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') v += st;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') v -= st;
    else return;
    e.preventDefault();
    v = Math.max(min, Math.min(max, v));
    set(k, v);
    knobUpdate(ctx, el, v);
    ctx.store.save();
  });
}

// Осциллограмма: живой сигнал с общего выхода или форма волны, рассчитанная по настройкам
function scopeStart(ctx, cv, getS) {
  if (!cv) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = (cv.clientWidth || 300) * dpr;
  cv.height = (cv.clientHeight || 110) * dpr;
  const td = new Float32Array(4096), css = getComputedStyle(document.documentElement);
  const tint = css.getPropertyValue('--tint').trim() || '#9C7242', l3 = css.getPropertyValue('--l3').trim() || '#ccc';
  let raf = 0;
  const draw = () => {
    if (!document.contains(cv)) return;
    const s = getS(), x = cv.getContext('2d');
    if (!x) return;
    const W = cv.width, H = cv.height, a = ctx.audio.ready() ? ctx.audio.analyser() : null;
    let live = false;
    if (a) {
      a.getFloatTimeDomainData(td);
      let pk = 0;
      for (let i = 0; i < td.length; i += 8) pk = Math.max(pk, Math.abs(td[i]));
      live = pk > 0.004;
    }
    const lab = cv.parentNode.querySelector('.sclab');
    if (lab) { lab.textContent = ctx.t(live ? 'scope.live' : 'scope.calc'); lab.classList.toggle('on', live); }
    x.clearRect(0, 0, W, H);
    x.strokeStyle = l3; x.globalAlpha = 0.45; x.lineWidth = 1;
    for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo((i * W) / 8, 0); x.lineTo((i * W) / 8, H); x.stroke(); }
    for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, (i * H) / 4); x.lineTo(W, (i * H) / 4); x.stroke(); }
    x.globalAlpha = 1;
    x.lineWidth = 2.2 * dpr; x.strokeStyle = tint; x.shadowColor = tint; x.shadowBlur = 8 * dpr;
    x.beginPath();
    if (live) {
      let z = 0;
      for (let i = 1; i < td.length / 2; i++) if (td[i - 1] < 0 && td[i] >= 0) { z = i; break; }
      const span = Math.min(td.length - z - 1, 1100);
      let mx = 0;
      for (let i = 0; i < span; i++) mx = Math.max(mx, Math.abs(td[z + i]));
      const k = (H * 0.42) / Math.max(0.02, mx);
      for (let i = 0; i < span; i++) { const px = (i / span) * W, py = H / 2 - td[z + i] * k; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    } else {
      const amps = [];
      let n = 0;
      for (let i = 1; i <= 24; i++) {
        let a2 = harmAmp(s.kind || 'soft', s.tone, i);
        const fc = 1.2 + s.bright * 22;
        if (i > fc) a2 *= Math.pow(fc / i, 2);
        amps.push(a2); n += Math.abs(a2);
      }
      for (let px = 0; px <= W; px += 2) {
        const ph = (px / W) * Math.PI * 6;
        let y = 0;
        amps.forEach((a2, i) => (y += a2 * Math.sin((i + 1) * ph)));
        const py = H / 2 - (y / Math.max(1, n * 0.6)) * H * 0.42;
        px ? x.lineTo(px, py) : x.moveTo(px, py);
      }
    }
    x.stroke();
    x.shadowBlur = 0;
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}

/* ---------- мини-клавиатура (в шторке звука) ---------- */

const MK = { oct: 4, latch: false, held: new Set() };

function mkbHTML(ctx) {
  const { t } = ctx;
  let w = '', b = '', wi = 0;
  const m0 = 12 * (MK.oct + 1);
  for (let m = m0; wi < 10; m++) {
    const pc = m % 12, nm = SH[pc] + (Math.floor(m / 12) - 1);
    if (WHITE.includes(pc)) {
      w += '<div class="mw' + (MK.held.has(m) ? ' on' : '') + '" data-mk="' + m + '" role="button" tabindex="0" aria-label="' + nm + '">' +
        (pc === 0 ? '<span>C' + (Math.floor(m / 12) - 1) + '</span>' : pc === 9 ? '<span>A</span>' : '') + '</div>';
      wi++;
    } else b += '<div class="mb' + (MK.held.has(m) ? ' on' : '') + '" data-mk="' + m + '" role="button" tabindex="0" aria-label="' + nm + '" style="left:' + wi * 10 + '%"></div>';
  }
  return '<div class="mkbar"><button class="mko" data-mko="-1" aria-label="' + t('octDown') + '">‹</button><div class="mkb">' + w + b +
    '</div><button class="mko" data-mko="1" aria-label="' + t('octUp') + '">›</button><button class="mkl' + (MK.latch ? ' on' : '') +
    '" data-mkl aria-pressed="' + MK.latch + '" aria-label="' + t('hold') + '" title="' + t('hold') + '">Hold</button></div>';
}

function mkbBind(ctx, root, rerender, offs) {
  const syn = ctx.audio.synth;
  const on = (ev, fn) => { root.addEventListener(ev, fn); offs.push(() => root.removeEventListener(ev, fn)); };
  on('pointerdown', (e) => {
    const k = e.target.closest('[data-mk]');
    if (!k) return;
    e.preventDefault();
    ctx.audio.unlock();
    ctx.audio.analyser();
    const m = +k.dataset.mk, key = 'pmk' + m;
    if (MK.latch && MK.held.has(m)) { syn.off(key); MK.held.delete(m); k.classList.remove('on'); return; }
    syn.on(m, key, MK.latch ? { hold: true } : {});
    MK.held.add(m);
    k.classList.add('on');
    if (!MK.latch) {
      const up = () => { syn.off(key); MK.held.delete(m); k.classList.remove('on'); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    }
  });
  on('click', (e) => {
    const g = (s) => e.target.closest(s);
    let b;
    if ((b = g('[data-mko]'))) { MK.oct = Math.max(1, Math.min(6, MK.oct + +b.dataset.mko)); rerender(); }
    else if (g('[data-mkl]')) {
      MK.latch = !MK.latch;
      if (!MK.latch) { MK.held.forEach((m) => syn.off('pmk' + m)); MK.held.clear(); }
      rerender();
    }
  });
}

/* ---------- панель ---------- */

const store = (ctx) => ctx.store.all();
const activeOf = (ctx) => { const P = store(ctx), L = pianoLayer(P); if (slot === 'layer' && !L) slot = 'main'; return slot === 'layer' ? L : pianoPatch(P); };
const nameOf = (ctx, s) => (s ? s.name || (PRESETS[s.preset] ? ctx.t('pre.' + s.preset) : '') : '');

export function synBody(ctx, inline) {
  const { t, ui } = ctx, P = store(ctx), main = pianoPatch(P), L = pianoLayer(P), s = activeOf(ctx), mode = ctx.audio.mixer.state.mode;
  const kn = (k) => knobSVG(ctx, k, knobVal(s, k), labelOf(ctx, s, k));
  const builtins = Object.keys(PRESETS).map((k) => [k, t('pre.' + k)]);
  const tab = (id, label, on) => '<button class="slt' + (on ? ' on' : '') + '" data-slot="' + id + '" aria-pressed="' + on + '">' + label + '</button>';
  // слои: «Звук · Рояль» и «Слой · Воздух ×» (или «＋ Слой»); удержание пресета — тоже слой
  const slots = '<div class="slots" role="group" aria-label="' + ui.esc(t('slot.hint')) + '">' +
    tab('main', '<small>' + t('slot.main') + '</small>' + ui.esc(nameOf(ctx, main)), slot === 'main') +
    (L ? tab('layer', '<small>' + t('slot.layer') + '</small>' + ui.esc(nameOf(ctx, L)), slot === 'layer') +
      '<button class="sltx" data-slotdel aria-label="' + ui.esc(t('slot.del')) + '" title="' + ui.esc(t('slot.del')) + '">×</button>'
      : '<button class="slt add" data-slotadd title="' + ui.esc(t('slot.hint')) + '">＋ ' + t('slot.layer') + '</button>') + '</div>';
  // ручки и живой сигнал; во встроенной панели — без «корпуса» (слово автора 06.11.2026: только ручки и окно сигнала)
  const knobs = '<div class="retro' + (inline ? ' inl' : '') + '">' + (inline ? '' : '<i class="scr tl"></i><i class="scr tr"></i><i class="scr bl"></i><i class="scr br"></i>' +
    '<div class="rhead"><b>MELETE · SYN-1</b><span class="led"></span></div>') + '<div class="lcd"><canvas class="scopec" aria-hidden="true"></canvas><span class="sclab"></span><span class="lcdn">' +
    ui.esc(nameOf(ctx, s)) + '</span></div>' +
    '<div class="rsec wide"><span class="rt">' + t(slot === 'layer' ? 'sec.layer' : 'sec.sound') + '</span><div class="krow">' + knobsOf(s).map(kn).join('') + '</div></div>' +
    '<div class="rsec wide"><span class="rt">MIX</span><div class="krow">' + MIX_KNOBS.map(kn).join('') + '</div></div></div>';
  const pick = slots + presetRow(ctx.presets('piano'), s.preset, builtins);
  // встроенная панель: сверху ручки, внизу — выбор звука и слоя, ближе к клавишам
  return (inline ? '' : ui.snav(t('syn.title'))) + (inline ? knobs + '<div class="pspick">' + pick + '</div>' : pick + knobs) +
    // полный рояль — пакет (src/core/packs.js): не скачан — строка «Скачать» прямо здесь; пока его нет, звучит облегчённый
    (!inline && s.kind === 'grand' && ctx.packs && !ctx.packs.has('piano') ? '<div class="group">' + ctx.packs.row('piano') + '</div>' : '') +
    (inline ? '' : '<div class="hdr">' + t('mode') + '</div><div class="group"><div class="cellcol">' +
      ui.seg('amode', [['fast', t('mode.fast')], ['bal', t('mode.bal')], ['smooth', t('mode.smooth')]], mode, t('mode')) + '</div></div><p class="ftr">' + t('mode.hint') + '</p>' +
      '<div class="hdr">' + t('perf') + '</div><div class="group"><div class="cellcol">' + ui.seg('aperf', [['full', t('perf.full')], ['eco', t('perf.eco')]], ctx.audio.mixer.state.perf, t('perf')) + '</div></div><p class="ftr">' + t('perf.hint') + ' ' + t('mix.ftr') +
      '</p><div style="height:120px"></div><div class="mkdock">' + mkbHTML(ctx) + '</div>');
}

// Привязать панель к root. rerender() перерисовывает её; onClose — закрыть встроенную панель
export function synBind(ctx, root, inline, { rerender, onClose, onChange = () => {} }) {
  const offs = [], P = store(ctx);
  let stopScope = () => {};
  const startScope = () => { stopScope(); stopScope = scopeStart(ctx, root.querySelector('.scopec'), () => activeOf(ctx)); };
  setTimeout(startScope, 40);
  // звучащие (и удержанные Hold) ноты слышат правку сразу
  const live = () => { if (ctx.audio.synth && ctx.audio.synth.refresh) ctx.audio.synth.refresh(); };
  // перерисовка без прыжков: ряд пресетов и сама панель остаются там, где их прокрутили
  const re = () => {
    const row = root.querySelector('.prow'), x = row ? row.scrollLeft : 0, y = root.scrollTop;
    rerender();
    const r2 = root.querySelector('.prow');
    if (r2) r2.scrollLeft = x;
    root.scrollTop = y;
    startScope(); onChange(); live();
  };
  if (!inline && ctx.packs) {
    offs.push(ctx.packs.onChange(() => { if (root.isConnected) re(); }));
    const pk = (e) => { const b = e.target.closest('[data-pkget], [data-pkcancel]'); if (!b) return; if (b.dataset.pkget) ctx.packs.ask(b.dataset.pkget); else ctx.packs.cancel(b.dataset.pkcancel); };
    root.addEventListener('click', pk);
    offs.push(() => root.removeEventListener('click', pk));
  }
  knobBind(ctx, root, (k) => knobVal(activeOf(ctx), k), (k, v, reset) => {
    const s = activeOf(ctx);
    if (reset) {
      const pre = presetOf(s.preset) || {};
      if (MIX_KNOBS.includes(k)) s[k] = KNOB_DEF[k]; else if (k === 'fmi') delete s.fmi; else s[k] = pre[k] != null ? pre[k] : KNOB_DEF[k];
      re(); ctx.store.save(); return;
    }
    s[k] = v;
    live();
  }, offs);
  if (!inline) mkbBind(ctx, root, () => { const d = root.querySelector('.mkdock'); if (d) d.innerHTML = mkbHTML(ctx); }, offs);
  // звук слоя: встроенный пресет или свой (★)
  const setSound = (target, b) => {
    if (b.dataset.bpre) applyPreset(target, b.dataset.bpre);
    else {
      const p = ctx.presets('piano').get(b.dataset.upre);
      if (!p) return;
      const keep = {};
      MIX_KNOBS.forEach((k) => { if (target[k] != null) keep[k] = target[k]; });
      Object.keys(target).forEach((k) => delete target[k]);
      Object.assign(target, p.data, keep, { preset: p.id, name: p.name });
    }
  };
  const idOf = (b) => b.dataset.bpre || b.dataset.upre;
  // удержание пресета — второй слой; удержание того, что уже слоем, — убрать слой
  let lp = null, longDone = false;
  const holdLayer = (b) => {
    longDone = true;
    if (navigator.vibrate) try { navigator.vibrate(12); } catch { /* нет вибрации */ }
    const L = pianoLayer(P);
    if (L && L.preset === idOf(b)) { P.layer = null; slot = 'main'; ctx.ui.toast(ctx.t('slot.off')); }
    else { P.layer = L || { vol: 0.7 }; setSound(P.layer, b); slot = 'layer'; ctx.ui.toast(ctx.t('slot.on', { name: nameOf(ctx, P.layer) })); }
    ctx.store.save();
    re();
  };
  const onDown = (e) => {
    const b = e.target.closest('[data-bpre], [data-upre]');
    clearTimeout(lp);
    longDone = false;
    if (!b) return;
    const x0 = e.clientX, y0 = e.clientY;
    lp = setTimeout(() => holdLayer(b), 480);
    const cancel = (ev) => { if (ev.type !== 'pointermove' || Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) { clearTimeout(lp); off(); } };
    const off = () => { ['pointermove', 'pointerup', 'pointercancel'].forEach((n) => window.removeEventListener(n, cancel)); };
    ['pointermove', 'pointerup', 'pointercancel'].forEach((n) => window.addEventListener(n, cancel));
  };
  root.addEventListener('pointerdown', onDown);
  offs.push(() => { root.removeEventListener('pointerdown', onDown); clearTimeout(lp); });
  const noMenu = (e) => { if (e.target.closest('[data-bpre], [data-upre]')) e.preventDefault(); };
  root.addEventListener('contextmenu', noMenu);
  offs.push(() => root.removeEventListener('contextmenu', noMenu));
  const onClick = (e) => {
    const g = (x) => e.target.closest(x);
    let b;
    if (longDone && g('[data-bpre], [data-upre]')) { longDone = false; return; } // это было удержание
    if (g('[data-psclose]')) { onClose && onClose(); return; }
    if ((b = g('[data-slot]'))) { slot = b.dataset.slot; re(); return; }
    if (g('[data-slotadd]')) { P.layer = applyPreset({ vol: 0.7 }, 'wair'); slot = 'layer'; ctx.store.save(); re(); ctx.ui.toast(ctx.t('slot.on', { name: nameOf(ctx, P.layer) })); return; }
    if (g('[data-slotdel]')) { P.layer = null; slot = 'main'; ctx.store.save(); re(); ctx.ui.toast(ctx.t('slot.off')); return; }
    if ((b = g('[data-bpre], [data-upre]'))) {
      setSound(activeOf(ctx), b);
      if (slot === 'main') P.sound = 'piano';
      ctx.store.save();
      re();
    } else if (g('[data-psave]')) {
      const s = activeOf(ctx);
      promptName(ctx.t('pre.new'), s.name ? s.name + ' 2' : ctx.t('pre.default'), (v) => {
        const data = {};
        Object.keys(s).forEach((k) => { if (!['preset', 'name', ...MIX_KNOBS].includes(k) && s[k] != null) data[k] = s[k]; });
        const id = ctx.presets('piano').add(v, data);
        s.preset = id;
        s.name = v;
        ctx.store.save();
        re();
        ctx.ui.toast(ctx.t('preset.saved'));
      });
    } else if (g('[data-pman]')) presetManager(ctx.presets('piano'), re);
    else if ((b = g('[data-seg="aperf"] [data-v]'))) { ctx.audio.mixer.setPerf(b.dataset.v); re(); }
    else if ((b = g('[data-seg="amode"] [data-v]'))) {
      ctx.audio.mixer.setMode(b.dataset.v);
      re();
      ctx.ui.toast(ctx.t('mode.later'));
    }
  };
  root.addEventListener('click', onClick);
  offs.push(() => root.removeEventListener('click', onClick));
  return () => { stopScope(); offs.splice(0).forEach((f) => f()); };
}

// Звук пианино в шторке (для маленьких окон и повёрнутой клавиатуры)
export function synthSheet(ctx, onChange) {
  let unbind = () => {};
  const sh = ctx.ui.sheet(() => synBody(ctx, false), (el, api) => {
    el.classList.add('synsheet');
    unbind = synBind(ctx, el, false, { rerender: () => api.update(), onChange });
  });
  const close = sh.close;
  sh.close = () => { unbind(); close(); };
  return sh;
}
