// Звук глайдера: голос (на каждый палец) и общая шина эффектов (эхо, реверберация).
// Тембр — как у пианино приложения (те же таблицы волн и огибающая), высота меняется плавно.
// Эффекты управляются значением 0…1: внизу поверхности — 0 (эффекта нет совсем), вверху — максимум.
import { holdAt } from '../../audio/param.js';
import { synWave } from '../../audio/waves.js';
import { reverbNode, sendToHall } from '../../audio/context.js';
import { airVoice } from '../../audio/airsound.js';
import { after } from '../../audio/clock.js';

// На голос: яркость (фильтр с резонансом), вибрато, тремоло, громкость, перегруз, фузз. На шину: эхо, реверберация
export const FX = ['bright', 'vib', 'trem', 'vol', 'drive', 'fuzz', 'echo', 'verb'];
export const BUS_FX = ['echo', 'verb'];
export const CURVES = { soft: 2, even: 1, sharp: 0.5 };

// Значение эффекта для положения пальца y (0 — низ, 1 — верх)
export function fxValue(e, y) {
  if (!e || !e.on) return 0;
  const a = Math.max(0, Math.min(1, e.amt ?? 1));
  if (e.mode === 'fixed') return a;
  return a * Math.pow(Math.max(0, Math.min(1, y)), CURVES[e.curve] ?? 1);
}

// Кривые искажения: перегруз — мягкое насыщение, фузз — почти прямоугольник
const curves = new WeakMap();
function shaper(c, kind) {
  let m = curves.get(c);
  if (!m) curves.set(c, (m = {}));
  if (m[kind]) return m[kind];
  const n = 2048, a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    a[i] = kind === 'fuzz' ? Math.sign(x) * (1 - Math.exp(-Math.abs(x) * 6)) : Math.tanh(x * 1.6) / Math.tanh(1.6);
  }
  return (m[kind] = a);
}

// Ступень искажения: сухой и «грязный» сигнал смешиваются по w (0 — только сухой)
function driveStage(c, kind) {
  const input = c.createGain(), output = c.createGain(), dry = c.createGain(), pre = c.createGain(), ws = c.createWaveShaper(), post = c.createGain(), wet = c.createGain();
  ws.curve = shaper(c, kind);
  ws.oversample = '2x';
  input.connect(dry).connect(output);
  input.connect(pre).connect(ws).connect(post).connect(wet).connect(output);
  wet.gain.value = 0;
  return {
    input, output,
    set(w, tau) {
      const t = c.currentTime;
      dry.gain.setTargetAtTime(1 - w, t, tau);
      wet.gain.setTargetAtTime(w, t, tau);
      pre.gain.setTargetAtTime(kind === 'fuzz' ? 3 + w * 60 : 1 + w * 14, t, tau);
      post.gain.setTargetAtTime(kind === 'fuzz' ? 0.45 : 0.75 - w * 0.2, t, tau);
    },
  };
}

// Общая шина глайдера: вход → эхо → выход в шину микшера; отдельно — посыл в общую реверберацию
// revVia — пост-фейдерная точка посыла в реверберацию (mixer.wet(bus)); без неё хвост шёл мимо микшера
export function createFxBus(c, dest, revVia = null) {
  const input = c.createGain(), out = c.createGain(), delay = c.createDelay(2), fb = c.createGain(), wet = c.createGain(), send = c.createGain();
  input.connect(out);
  input.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(out);
  out.connect(dest);
  fb.gain.value = 0; wet.gain.value = 0; send.gain.value = 0;
  const rv = reverbNode();
  if (revVia || rv) out.connect(send).connect(revVia || rv);
  delay.delayTime.value = 0.32;
  return {
    input,
    set({ echo = 0, verb = 0, time = 320 }) {
      const t = c.currentTime;
      delay.delayTime.setTargetAtTime(Math.max(0.06, Math.min(1.5, time / 1000)), t, 0.05);
      wet.gain.setTargetAtTime(echo * 0.75, t, 0.04);
      fb.gain.setTargetAtTime(echo ? 0.2 + echo * 0.45 : 0, t, 0.04);
      send.gain.setTargetAtTime(verb * 1.3, t, 0.05);
    },
    disconnect() { try { out.disconnect(); } catch { /* ignore */ } },
  };
}

// Голос: c — AudioContext, dest — вход шины, patch — звук (как у пианино), hold — держать звук, пока палец на месте
// hallVia — пост-фейдерная точка посыла в длинный зал (mixer.wet(bus, 'cathedral'))
export function createGlideVoice(c, dest, patch, { hold = true, a4 = 440, hallVia = null } = {}) {
  const s = patch, kind = s.kind || 'soft', t0 = c.currentTime + 0.003;
  const lp = c.createBiquadFilter(), amp = c.createGain(), vol = c.createGain(), out = c.createGain();
  const od = driveStage(c, 'drive'), fz = driveStage(c, 'fuzz');
  lp.type = 'lowpass';
  lp.Q.value = kind === 'saw' ? 1 : 0.4;
  lp.connect(amp).connect(vol).connect(out).connect(od.input);
  od.output.connect(fz.input);
  fz.output.connect(dest);
  const vibLfo = c.createOscillator(), vibG = c.createGain(), trLfo = c.createOscillator(), trG = c.createGain();
  vibLfo.frequency.value = 5.6;
  vibG.gain.value = 0;
  vibLfo.connect(vibG);
  trLfo.frequency.value = 6;
  trG.gain.value = 0;
  trLfo.connect(trG).connect(out.gain);
  // воздушный звук (airsound.js) собирается в start(): там уже известна нота
  const os = [], dets = s.air ? [] : s.cho > 0.04 ? [-(4 + s.cho * 10), 4 + s.cho * 10] : [0];
  let air = null;
  // Посыл в зал держит цепочку живой: без разрыва связи весь голос остаётся подключённым к звуковому потоку
  // и живёт до конца сессии (третий принцип: ошибка стоит денег) — голос отпускается целиком, см. release()
  const hallSend = s.hall ? sendToHall(out, s.hall, hallVia) : null;
  dets.forEach((d) => {
    const o = c.createOscillator(), g = c.createGain();
    o.setPeriodicWave(synWave(c, kind, s.tone));
    o.detune.value = d;
    vibG.connect(o.detune);
    g.gain.value = dets.length > 1 ? 0.55 : 1;
    o.connect(g).connect(lp);
    os.push(o);
  });
  const freq = (m) => a4 * Math.pow(2, (m - 69) / 12);
  let m0 = 60, bright = 0, dead = false;

  // Фильтр следует за высотой; яркость открывает его вверх и добавляет резонанс («вау»)
  const filter = (tau) => {
    const f = freq(m0), t = c.currentTime, base = f * (1.2 + s.bright * 22);
    lp.frequency.setTargetAtTime(Math.max(120, Math.min(18000, base * (1 + bright * bright * 30))), t, tau);
    lp.Q.setTargetAtTime((kind === 'saw' ? 1 : 0.4) + bright * 9, t, 0.03);
  };

  const v = {
    start(m, fx) {
      m0 = m;
      const f = freq(m), att = Math.max(0.006, s.att / 1000), dec = Math.max(0.05, s.dec * 3), peak = kind === 'saw' ? 0.16 : 0.3;
      const su = hold ? Math.max(s.sus, 0.55) : s.sus;
      os.forEach((o) => { o.frequency.setValueAtTime(f, t0); o.start(t0); });
      if (s.air) air = airVoice(c, lp, s.air, f, t0, { width: 0.4 + s.cho, bright: 0.6 + s.bright * 0.8, fade: att * 1.5 + 0.8, vibIn: vibG });
      vibLfo.start(t0);
      trLfo.start(t0);
      amp.gain.setValueAtTime(0.0001, t0);
      if (s.air && att > 0.1) amp.gain.setTargetAtTime(peak, t0, att / 3);
      else amp.gain.linearRampToValueAtTime(peak, t0 + att);
      if (su < 0.999) amp.gain.setTargetAtTime(Math.max(0.0001, peak * su), t0 + att, dec / 3);
      v.fx(fx, true);
    },
    pitch(m, tau = 0.012) {
      if (dead) return;
      m0 = m;
      const f = freq(m), t = c.currentTime;
      os.forEach((o) => o.frequency.setTargetAtTime(f, t, tau));
      if (air) air.set(f, tau);
      filter(Math.max(tau, 0.01));
    },
    // fx — значения эффектов 0…1 для этого пальца: { bright, vib, trem, vol, drive, fuzz }
    fx(fx, now = false) {
      if (dead) return;
      const t = c.currentTime, tau = now ? 0.001 : 0.025;
      bright = fx.bright || 0;
      vibG.gain.setTargetAtTime((fx.vib || 0) * 100, t, tau);
      vibLfo.frequency.setTargetAtTime(5.2 + (fx.vib || 0) * 1.6, t, tau);
      vol.gain.setTargetAtTime(fx.volGain ?? 1, t, tau);
      const td = (fx.trem || 0) * 0.95;
      out.gain.setTargetAtTime(1 - td / 2, t, tau);
      trG.gain.setTargetAtTime(td / 2, t, tau);
      trLfo.frequency.setTargetAtTime(4 + (fx.trem || 0) * 6, t, tau);
      od.set(fx.drive || 0, tau);
      fz.set(fx.fuzz || 0, tau);
      filter(tau);
    },
    release() {
      if (dead) return;
      dead = true;
      const t = c.currentTime, r = Math.max(0.04, s.rel);
      holdAt(amp.gain, t);
      amp.gain.setTargetAtTime(0.0001, t, r / 4);
      const end = t + r * 1.4 + 0.05;
      [...os, ...(air ? air.srcs : []), vibLfo, trLfo].forEach((o) => { try { o.stop(end); } catch { /* ignore */ } });
      // Отпустить голос целиком: разорвать обе дороги к звуковому потоку — к шине (fz.output) и к залу (посыл
      // от out). Иначе цепочка остаётся подключённой к потоку и живёт до конца сессии: за вечер игры
      // накапливаются сотни мёртвых голосов — и звук, и телефон сдают.
      after((end - t + 0.2) * 1000, () => {
        [lp, amp, vol, out, vibG, trG, vibLfo, trLfo, od.input, od.output, fz.input, fz.output, hallSend, air && air.out]
          .forEach((n) => { try { n && n.disconnect(); } catch { /* ignore */ } });
      });
    },
    get dead() { return dead; },
  };
  return v;
}
