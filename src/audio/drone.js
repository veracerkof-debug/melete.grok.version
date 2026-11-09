// Пэды и дрон: тёплый, смычок, хор, стекло (и воздушные); тампура заменена арпеджиатором (arp.js, 06.11.2026). Слои по октавам, созвучия, плавная смена нот.
// Настройки — объект device.drone (как в прототипе).
import { holdAt } from './param.js';
import { getContext, masterNode, sendToReverb, sendToHall, midiFreq } from './context.js';
import { wave, pinkNoise } from './waves.js';
import { airVoice, sideInto } from './airsound.js';
import { cancel, after } from './clock.js';

// Тембры: id → яркость по умолчанию. Названия — ключи i18n drone.sound.<id>
// Первыми — воздушные для поклонения (airsound.js): воздух, свет, тепло, хор
// «Пэд» (пила) убран по слову автора 05.11.2026 — сохранённый «pad» становится «Тёплым» (normalizeDrone)
export const SOUNDS = { wair: 0.5, wlight: 0.5, wwarm: 0.5, wchoir: 0.5, soft: 0.7, bow: 0.85, choir: 0.5, glass: 0.9 };
const AIRS = { wair: 'air', wlight: 'light', wwarm: 'warm', wchoir: 'choir' };
// Созвучия: интервалы от нажатой ноты
// sus42 — тоника, секунда, кварта, квинта; hmin — «гармонический минор» в понимании автора (05.11.2026): тоника и квинта,
// повышенная на полтона. sus4 остаётся для старых пресетов, dim — из квинтового круга
export const CHORDS = { root: [0], fifth: [0, 7], maj: [0, 4, 7], min: [0, 3, 7], sus42: [0, 2, 5, 7], hmin: [0, 8], sus4: [0, 5, 7], dim: [0, 3, 6] };
export const CHORD_SET = ['fifth', 'root', 'maj', 'min', 'sus42', 'hmin']; // созвучие касания (в настройках)
// Жесты по плитке (автор 05.11.2026): влево — мажор, вправо — минор, вверх — sus4+2, вниз — гармонический минор
export const DIRS = { left: 'maj', right: 'min', up: 'sus42', down: 'hmin' };
// Чувствительность жеста: сколько пикселей провести, чтобы сменилось созвучие
export const SENS = { low: 40, mid: 24, high: 12 };
export const LAYERS = [2, 3, 4]; // октавы слоёв: низкий, средний, высокий

// Дополняет настройки значениями по умолчанию (прототип: DC())
export function normalizeDrone(d) {
  if (!d.chord || !CHORDS[d.chord]) d.chord = d.fifth === false ? 'root' : 'fifth';
  // тампура (до 06.11.2026) → мягкий пэд и арпеджиатор (он даёт движение вместо щипков)
  if (d.sound === 'tanpura') { d.sound = 'soft'; d.arp = { ...(d.arp || {}), on: true }; }
  if (d.sound === 'pad' || !(d.sound in SOUNDS)) d.sound = 'soft';
  if (d.gest == null) d.gest = true;      // созвучия жестом по плитке; выкл — только касание
  if (!SENS[d.sens]) d.sens = 'mid';
  if (d.wave == null) d.wave = 0.7;       // сила «волны громкости» при включении (сама волна — эффекты шины пэдов, fx.js)
  if (d.bright == null) d.bright = SOUNDS[d.sound] ?? 0.7;
  if (d.move == null) d.move = 0.5;
  if (d.width == null) d.width = 0.5;
  if (d.fade == null) d.fade = 1.8;
  if (d.rev == null) d.rev = 0.45;
  if (d.xfade == null) d.xfade = true;
  if (d.hall == null) d.hall = 0;   // длинный зал (поклонение), 0…1
  if (d.air == null) d.air = 0;     // «Air» — тихая шумовая подложка по нотам созвучия, 0…1
  if (d.view !== 'keys' && d.view !== 'circle') d.view = 'grid'; // вид: сетка, квинтовый круг или «пиано»
  if (d.ckey == null) d.ckey = 0; // круг: какая тональность наверху (шаг круга от до мажора)
  if (d.latch == null) d.latch = false;   // «пиано»: false — звучит, пока держат; true — касание вкл/выкл
  return d;
}

// Ноты [midi, уровень] для текущих слоёв и созвучия
export function droneNotes(d) {
  const offs = CHORDS[d.chord] || CHORDS.fifth, notes = [];
  LAYERS.filter((o) => d.layers[o]).forEach((o) => {
    const b = 12 * (o + 1) + d.pc, lv = o === 2 ? 1 : o === 3 ? 0.8 : 0.6;
    offs.forEach((x, i) => notes.push([b + x, lv * (i ? 0.55 : 1)]));
  });
  return notes;
}


export function createDrone({ mixer, getSettings, getA4 = () => 440 }) {
  // nodes — пэд сетки (одна нота с созвучием); keys — голоса режима «пиано» (нота → голос, все слои, без созвучия)
  let nodes = null, over = {};
  const keys = new Map();
  const mf = (m) => midiFreq(m, getA4());
  // Шина пэдов микшера: громкость и выключение шины, её эффекты (волна громкости, эквалайзер…). Посылы в пространства —
  // через пост-фейдерные точки шины: ползунок и выключение глушат и хвост
  const level = () => getSettings().vol;
  const out = () => mixer.bus('drone') || masterNode();
  const wet = (type) => (mixer.wet ? mixer.wet('drone', type) : null);
  const KEY_K = 0.7; // несколько клавиш сразу — каждая тише, сумма не перегружает



  // Воздушный пэд: каждая нота созвучия — голос airsound.js; «Движение» — дыхание громкости, «Ширина» — расстройка,
  // «Яркость» — фильтр. В высоких слоях и на неосновных нотах голосов в унисоне меньше (легче для телефона)
  function startAir(c, d, master, t, os, att) {
    const amp = c.createGain(), breath = c.createOscillator(), bgn = c.createGain();
    amp.gain.value = 1;
    amp.connect(master);
    breath.frequency.value = 0.09;
    bgn.gain.value = 0.12 * d.move;
    breath.connect(bgn).connect(amp.gain);
    breath.start(t);
    os.push(breath);
    droneNotes(d).forEach(([m, lvl], i) => {
      const g = c.createGain();
      g.gain.value = lvl * 0.16;
      g.connect(amp);
      const a = airVoice(c, g, AIRS[d.sound], mf(m), t, { width: 0.3 + d.width * 1.4, bright: 0.45 + d.bright * 1.1, fade: att ?? Math.max(2, d.fade * 1.6), uni: i === 0 ? 3 : 2 });
      os.push(...a.srcs);
    });
    if (d.air > 0.01) addAir(c, master, droneNotes(d).map(([m, lvl]) => [mf(m), lvl]), d.air, t, os);
  }

  // Голос: d — настройки с нотой и созвучием; att — нарастание (клавиши — быстрее), k — доля громкости
  function voice(c, d, att, k = 1) {
    const t = c.currentTime, master = c.createGain();
    master.connect(out());
    // воздушным пэдам зал нужен всегда, хотя бы немного
    const hall = AIRS[d.sound] ? Math.max(0.45, d.hall) : d.hall;
    const send = sendToReverb(master, d.rev, wet('hall')), hallS = hall > 0 ? sendToHall(master, hall, wet('cathedral')) : null;
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(level() * k, t + Math.max(0.05, att));
    const os = [], v = { g: master, os, send, hallS, k, timer: null };
    if (AIRS[d.sound]) { startAir(c, d, master, t, os, att < 1 ? Math.max(0.12, att) : undefined); return v; }
    const base = 250 * Math.pow(20, d.bright), lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = base;
    lp.Q.value = 0.5;
    lp.connect(master);
    const amp = c.createGain();
    amp.gain.value = 1;
    if (d.sound === 'choir') { // форманты гласной «а»
      const mix = c.createGain();
      mix.gain.value = 1.4;
      [[800, 6, 1], [1150, 7, 0.7], [2900, 9, 0.25]].forEach(([fq, q, g0]) => {
        const bp = c.createBiquadFilter(), bg = c.createGain();
        bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q; bg.gain.value = g0;
        amp.connect(bp).connect(bg).connect(mix);
      });
      mix.connect(lp);
    } else amp.connect(lp);
    // «дыхание» — медленная модуляция громкости
    const breath = c.createOscillator(), bgn = c.createGain();
    breath.frequency.value = d.sound === 'glass' ? 0.35 : 0.11;
    bgn.gain.value = (d.sound === 'glass' ? 0.22 : 0.1) * d.move;
    breath.connect(bgn).connect(amp.gain);
    breath.start(t);
    os.push(breath);
    let vibG = null;
    if (d.sound === 'bow' || d.sound === 'choir') {
      const vib = c.createOscillator();
      vibG = c.createGain();
      vib.frequency.value = d.sound === 'bow' ? 4.8 : 5.3;
      vibG.gain.value = d.sound === 'bow' ? 5 : 7;
      vib.connect(vibG);
      vib.start(t);
      os.push(vib);
    }
    // Каждая нота — середина без расстройки и пара ±расстройка только в разности каналов (sideInto): в стерео — ширина,
    // в моно (маленькая Bluetooth-колонка, телефон, зал) пара исчезает и громкость не «качает» — раньше две
    // расстроенные копии, сложенные в один канал, раз в секунду гасили друг друга
    const det = 2 + d.width * 16, sideK = Math.min(0.6, d.width * 1.1);
    const lvlK = { bow: 0.07, choir: 0.045, glass: 0.12 }[d.sound] || 0.11;
    const side = sideK > 0.01 ? sideInto(c, amp) : null;
    droneNotes(d).forEach(([m, lvl]) => {
      const f = mf(m);
      [[0, 1.4], ...(side ? [[det, sideK], [-det, -sideK]] : [])].forEach(([dt, k], i) => {
        const o = c.createOscillator();
        if (d.sound === 'choir') o.type = 'sawtooth';
        else if (d.sound === 'glass') o.type = 'sine';
        else o.setPeriodicWave(wave(c, d.sound === 'bow' ? 'bow' : 'warm'));
        o.frequency.value = f;
        o.detune.value = dt;
        if (vibG) vibG.connect(o.detune);
        const g = c.createGain();
        g.gain.value = lvl * lvlK * k;
        o.connect(g).connect(i ? side : amp);
        o.start(t);
        os.push(o);
      });
      if (d.sound === 'glass') { // октава сверху
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f * 2; g.gain.value = lvl * 0.04;
        o.connect(g).connect(amp);
        o.start(t);
        os.push(o);
      }
    });
    // «Air»: розовый шум через узкие полосы на нотах созвучия (и октавой выше) — дыхание пространства, очень тихо
    if (d.air > 0.01) addAir(c, master, droneNotes(d).map(([m, lvl]) => [mf(m), lvl]), d.air, t, os);
    if (d.move > 0.02 && d.sound !== 'glass') { // движение фильтра
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 0.05 + d.move * 0.1;
      lg.gain.value = base * 0.55 * d.move;
      l.connect(lg).connect(lp.frequency);
      l.start(t);
      os.push(l);
    }
    return v;
  }

  function release(v, fade) {
    cancel(v.timer);
    const { g, os } = v, t = g.context.currentTime;
    holdAt(g.gain, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    os.forEach((o) => { try { o.stop(t + fade + 0.1); } catch { /* ignore */ } });
    // Голос отпускается целиком: гейн остаётся подключённым к шине, и без разрыва связи голос живёт до конца
    // сессии — каждая нажатая клавиша добавляла бы свой узел (третий принцип: ошибка стоит денег)
    after((fade + 0.3) * 1000, () => {
      try { g.disconnect(); } catch { /* ignore */ }
      [v.send, v.hallS].forEach((s) => { try { s && s.disconnect(); } catch { /* ignore */ } });
    });
  }
  // Клавиши: нарастание и затухание короче, чем у пэда, — клавиша отвечает пальцу
  const keyAtt = (d) => Math.min(d.fade, 0.3), keyRel = (d) => Math.max(0.5, Math.min(d.fade, 2));
  const keySet = (pc) => ({ ...normalizeDrone(getSettings()), pc, chord: 'root' });

  // Подписчики: что-то включили, выключили или сменили не из окна пэдов (пульт, часы, сцена) — окно перерисуется
  const subs = new Set();
  const changed = () => subs.forEach((fn) => { try { fn(); } catch (e) { (globalThis.reportError || console.error)(e); } });
  const dr = {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    get on() { return !!nodes; },
    // звучит ли хоть что-то: пэд или клавиши
    get sounding() { return !!nodes || keys.size > 0; },
    // созвучие, которое звучит сейчас (жест на плитке может отличаться от настройки)
    get chord() { return over.chord || normalizeDrone(getSettings()).chord; },

    // o: { chord } — созвучие на этот раз (жест на плитке); без o — из настроек
    start(o) {
      const c = getContext(mixer.state.mode);
      if (!c) return;
      over = o ? { ...o } : {};
      const d = { ...normalizeDrone(getSettings()), ...over };
      nodes = voice(c, d, d.fade);
      changed();
    },

    // Затухание за fade секунд (по умолчанию 1,2 с)
    stop(fade = 1.2) {
      if (!nodes) return;
      release(nodes, fade);
      nodes = null;
      changed();
    },

    // Тональность пэда (пульт, часы: «вперёд/назад» — полутон): то же созвучие, плавный переход
    tonic(pc) {
      const d = getSettings();
      d.pc = ((Math.round(pc) % 12) + 12) % 12;
      if (nodes) dr.swap(over); else changed();
    },

    retune() {
      if (nodes) { const o = over; dr.stop(); dr.start(o); }
      if (keys.size) { const d = normalizeDrone(getSettings()), on = [...keys.keys()]; dr.keysOff(0.4); on.forEach((pc) => dr.keyOn(pc, d.fade)); }
    },

    // Сменить ноту или созвучие: плавный переход (если включён) или перезапуск
    swap(o) {
      over = o ? { ...o } : {};
      if (!nodes) { dr.start(over); return; }
      const d = normalizeDrone(getSettings());
      if (!d.xfade) { dr.retune(); return; }
      const x = Math.max(0.4, Math.min(2.5, d.fade));
      dr.stop(x);
      const f0 = d.fade;
      d.fade = x;
      dr.start(over);
      d.fade = f0;
    },

    // Режим «пиано»: клавиша pc звучит всеми включёнными слоями
    keyOn(pc, att) {
      const c = getContext(mixer.state.mode);
      if (!c) return;
      const d = keySet(pc);
      if (keys.has(pc)) release(keys.get(pc), 0.15);
      keys.set(pc, voice(c, d, att ?? keyAtt(d), KEY_K));
      changed();
    },
    keyOff(pc, fade) {
      const v = keys.get(pc);
      if (!v) return;
      release(v, fade ?? keyRel(normalizeDrone(getSettings())));
      keys.delete(pc);
      changed();
    },
    keysOff(fade) { [...keys.keys()].forEach((pc) => dr.keyOff(pc, fade)); },
    get held() { return new Set(keys.keys()); },

    // Громкость (настройка пэдов × микшер)
    vol() { [nodes, ...keys.values()].forEach((v) => { if (v) v.g.gain.setTargetAtTime(level() * v.k, v.g.context.currentTime, 0.05); }); },
    setReverb(x) { [nodes, ...keys.values()].forEach((v) => { if (v && v.send) v.send.gain.setTargetAtTime(x, v.send.context.currentTime, 0.05); }); },
    // длинный зал: если посыла ещё нет — пэд перезапускается плавно (swap)
    setHall(x) {
      if (keys.size) dr.retune();
      if (!nodes) return;
      if (nodes.hallS) nodes.hallS.gain.setTargetAtTime(x, nodes.hallS.context.currentTime, 0.1); else if (x > 0) dr.swap();
    },
  };
  return dr;
}

// Розовый шум → полосы на частотах нот (Q ~ 18) → тихий уровень. Узлы-источники — в os (остановка)
export function addAir(c, dest, notes, amount, t, os) {
  const src = c.createBufferSource(), g = c.createGain(), sway = c.createOscillator(), sg = c.createGain();
  src.buffer = pinkNoise(c); src.loop = true;
  g.gain.value = 0;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amount * 0.9, t + 3); // вступает медленно
  // медленное «дыхание» громкости
  sway.frequency.value = 0.07; sg.gain.value = amount * 0.25;
  sway.connect(sg).connect(g.gain);
  g.connect(dest);
  notes.forEach(([f, lvl]) => [[f, 1], [f * 2, 0.55]].forEach(([fq, k]) => {
    if (fq > 9000) return;
    const bp = c.createBiquadFilter(), bg = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 18;
    bg.gain.value = lvl * k * 1.6;
    src.connect(bp).connect(bg).connect(g);
  }));
  src.start(t); sway.start(t);
  os.push(src, sway);
}
