// Запись в инструментах. Два источника, каждый можно выключить и сделать громче или тише прямо во время записи:
// звук приложения (всё, что звучит, после компрессора и прямой выход метронома; баланс инструментов — в микшере)
// и микрофон (живой инструмент или голос). Мониторинг — микрофон в наушники, через гейт: звук проходит, только
// когда он громче порога (тихий шум и случайные звуки не слышны), и сам выключается, если громкость резко растёт
// и держится (обратная связь «динамик → микрофон»). Видео — от модуля (терменвокс: камера и рисунок поверх).
// Вход (микрофон телефона, гарнитура, USB, Bluetooth) и выход мониторинга выбираются, как в диктофоне: та же
// система (src/audio/voiceengine.js) — на Android вход направляется маршрутом, в браузере — deviceId и setSinkId.
// Готовая запись сохраняется в медиатеку (files.js) — на устройстве, никуда не отправляется.
// MIDI (пианино, глайдер, терменвокс): не звук, а сама игра — события модуля (src/music/midi.js); сохраняется
// файлом .mid (kind: 'midi', tool — модуль) вместе с точной записью для воспроизведения в самом инструменте (take).
import { engine } from '../audio/voiceengine.js';
import { setOutput } from '../audio/livefx.js';
import { writeMidi, takeDur } from '../music/midi.js';

const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];
const VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm'];
export const VOL_MAX = 2;               // громкость источника в записи: 0…200 %
export const GATE_MIN = -70, GATE_MAX = -20; // порог гейта, дБ
const GATE_HOLD = 180;                  // гейт держится открытым после звука, мс
const HOWL_DB = -4, HOWL_MS = 450;      // так громко и так долго — похоже на обратную связь

export const DEFAULT_PREFS = { app: true, appVol: 1, mic: false, micVol: 1, mon: false, monVol: 0.8, gate: -50, video: false, in: null, out: null };

export function pickType(list, can = (t) => globalThis.MediaRecorder && MediaRecorder.isTypeSupported(t)) {
  return list.find((t) => { try { return can(t); } catch { return false; } }) || '';
}
export const extOf = (type) => (type.includes('mp4') ? (type.startsWith('video') ? 'mp4' : 'm4a') : type.includes('ogg') ? 'ogg' : 'webm');
export const canRecord = () => !!(globalThis.MediaRecorder && globalThis.MediaStream);
export const dbOf = (rms) => (rms > 1e-6 ? 20 * Math.log10(rms) : -120);

// Имя файла: «Инструмент — 9 окт., 18:42»
export function recName(tool, at, locale = 'ru') {
  let d;
  try { d = new Date(at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { d = new Date(at).toISOString().slice(0, 16).replace('T', ' '); }
  return tool + ' — ' + d;
}

// Гейт: открыт, пока уровень выше порога, и ещё hold мс после; howl — громко дольше HOWL_MS (без времени — false)
export function createGate() {
  let openUntil = -1, loudSince = null;
  return {
    step(db, thr, t) {
      if (db >= thr) openUntil = t + GATE_HOLD;
      loudSince = db >= HOWL_DB ? loudSince ?? t : null;
      return { open: t < openUntil, howl: loudSince != null && t - loudSince >= HOWL_MS };
    },
    reset() { openUntil = -1; loudSince = null; },
  };
}

// app.audio.tap() — отвод звука, app.files — медиатека, app.store.state.settings.rec — настройки. Одна запись за раз.
export function createRecorder(app) {
  let cur = null, chain = null;
  const subs = new Set();
  const emit = () => subs.forEach((fn) => fn(cur));
  const prefs = () => {
    const st = app.store.state.settings, p = (st.rec = { ...DEFAULT_PREFS, ...(st.rec || {}) });
    return p;
  };
  const meter = { db: -120, open: false, howl: null }; // уровень микрофона для листа записи

  // Цепочка: приложение → appGain → dest; микрофон → micGain → dest, → анализатор, → monGain → gateGain → динамики
  function build() {
    if (chain) return chain;
    const tap = app.audio.tap();
    if (!tap) return null;
    // отвод приложения → громкость записи → dest
    const c = tap.ctx, appGain = c.createGain(), dest = c.createMediaStreamDestination(), offApp = tap.into(appGain);
    appGain.connect(dest);
    chain = { c, dest, appGain, offApp, mic: null };
    // выход мониторинга (и всего звука приложения, пока открыта запись) — где браузер умеет выбирать
    if (prefs().out) setOutput(c, prefs().out);
    apply();
    return chain;
  }
  async function openMic() {
    const ch = build();
    if (!ch) return 'nosound';
    if (ch.mic) return 'ok';
    let stream;
    const p0 = prefs(), E = engine(), want = p0.in;
    // выбранный вход: Android — маршрут (микрофон страницы берёт звук с него), браузер — deviceId
    if (E.native) await E.route(want);
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, ...(!E.native && want ? { deviceId: { exact: want } } : {}) };
    try { stream = await navigator.mediaDevices.getUserMedia({ audio }); } catch {
      // выбранного входа нет (отключили) — по умолчанию
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); } catch { if (E.native) E.unroute(); return 'mic'; }
    }
    const c = ch.c, src = c.createMediaStreamSource(stream), micGain = c.createGain(), an = c.createAnalyser(), monGain = c.createGain(), gateGain = c.createGain();
    an.fftSize = 1024;
    src.connect(micGain).connect(ch.dest);
    src.connect(an);
    src.connect(monGain).connect(gateGain).connect(c.destination); // только в динамики: в запись мониторинг не попадает
    gateGain.gain.value = 0;
    const buf = new Float32Array(an.fftSize), gate = createGate();
    const timer = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const p = prefs(), db = dbOf(Math.sqrt(s / buf.length)), g = gate.step(db, p.gate, performance.now());
      meter.db = db; meter.open = g.open;
      if (g.howl && p.mon) { p.mon = false; apply(); if (meter.howl) meter.howl(); }
      gateGain.gain.setTargetAtTime(p.mon && g.open ? 1 : 0, c.currentTime, g.open ? 0.004 : 0.06);
    }, 20);
    const mic = { stream, src, micGain, an, monGain, gateGain, timer };
    // Пока шёл запрос разрешения, лист записи могли закрыть (disarm → teardown) — цепочка уже не та.
    // Микрофон отпускаем сразу: иначе он остаётся писать комнату, а таймер живёт до перезапуска приложения.
    if (chain !== ch) { stopMic(mic); if (E.native) E.unroute(); return 'mic'; }
    ch.mic = mic;
    apply();
    return 'ok';
  }
  // Отпустить микрофон: поток, таймер и узлы
  function stopMic(m) {
    if (!m) return;
    clearInterval(m.timer);
    try { m.stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    [m.src, m.micGain, m.monGain, m.gateGain].forEach((n) => { try { n.disconnect(); } catch { /* ignore */ } });
  }
  function closeMic() {
    const m = chain && chain.mic;
    if (!m) return;
    stopMic(m);
    chain.mic = null;
    meter.db = -120; meter.open = false;
    const E = engine();
    if (E.native) E.unroute();
  }
  function teardown() {
    if (!chain) return;
    closeMic();
    chain.offApp();
    try { chain.appGain.disconnect(); } catch { /* ignore */ }
    if (prefs().out) setOutput(chain.c, '');
    chain = null;
  }
  // Громкости — сразу, без щелчков
  function apply() {
    if (!chain) return;
    const p = prefs(), t = chain.c.currentTime, set = (g, v) => g.gain.setTargetAtTime(v, t, 0.03);
    set(chain.appGain, p.app ? p.appVol : 0);
    if (chain.mic) { set(chain.mic.micGain, p.mic ? p.micVol : 0); set(chain.mic.monGain, p.mon ? p.monVol : 0); }
  }

  // MIDI-запись → медиатека: файл .mid и точная запись (take) для воспроизведения в инструменте
  async function saveMidi(r) {
    const ev = r.midi;
    if (!ev.some((e) => e.k === 'on')) return null;
    const blob = new Blob([writeMidi(ev, { name: r.tool })], { type: 'audio/midi' });
    const rec = { id: 'm' + Date.now().toString(36), name: recName(r.tool, r.t0) + '.mid', size: blob.size, type: 'audio/midi', songs: r.songs,
      created: Date.now(), blob, kind: 'midi', tool: r.mod, take: { v: 1, ev }, dur: takeDur(ev) };
    try { await app.files.add(rec); return rec; } catch { return null; }
  }

  return {
    get active() { return !!cur; },
    get state() { return cur && { tool: cur.tool, t0: cur.t0, video: !!cur.video, midi: cur.midi ? cur.mod : null }; },
    // Событие игры модуля mod (во время MIDI-записи этого модуля — в запись; иначе ничего)
    midiEv(mod, e) {
      if (!cur || !cur.midi || cur.mod !== mod) return;
      const t = (performance.now() - cur.p0) / 1000, L = cur.midi;
      // движение голоса — не чаще ~40 раз в секунду: частые соседние движения сливаются в одно (последние значения)
      if (e.k === 'mv') {
        const j = cur.mvAt.get(e.id), o = j != null && L[j];
        if (o && o.k === 'mv' && t - o.t < 0.025) {
          if (e.m != null) o.m = e.m;
          if (e.y != null) o.y = e.y;
          if (e.x) o.x = { ...o.x, ...e.x };
          return;
        }
        cur.mvAt.set(e.id, L.length);
      }
      L.push({ ...e, t });
    },
    get prefs() { return prefs(); },
    meter,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    apply,
    // Входы и выходы для выбора (как в диктофоне); { inputs, outputs, native }
    async devices() { try { const d = await engine().devices(); return { ...d, native: engine().native }; } catch { return { inputs: [], outputs: [], native: engine().native }; } },
    // Вход поменяли — микрофон открывается заново; выход — сразу
    async reopen() { if (chain && chain.mic) { closeMic(); return openMic(); } return 'ok'; },
    setOut(id) { if (chain) setOutput(chain.c, id || ''); },
    // Лист записи открыт: микрофон (если включён) — для уровня и мониторинга ещё до начала. → 'ok' | 'mic' | 'nosound'
    async arm() { const p = prefs(); if (!build()) return 'nosound'; if (p.mic) return openMic(); closeMic(); return 'ok'; },
    // Лист закрыт без записи — микрофон отпускается
    disarm() { if (!cur) teardown(); },

    // opts: { tool (название), songs ([id]), video ({ stream, stop } от модуля или null) }
    // → 'ok' | 'nosound' | 'unsupported' | 'empty' (оба источника выключены) | 'mic' (микрофон не дали — без него)
    async start({ tool, songs = [], video = null, midi = null } = {}) {
      if (cur) return 'ok';
      if (midi) { cur = { midi: [], mod: midi, mvAt: new Map(), tool, songs, t0: Date.now(), p0: performance.now() }; emit(); return 'ok'; }
      if (!canRecord()) return 'unsupported';
      const p = prefs();
      if (!p.app && !p.mic) return 'empty';
      if (!build()) return 'nosound';
      let res = 'ok';
      if (p.mic) res = await openMic();
      const tracks = [...chain.dest.stream.getAudioTracks(), ...(video ? video.stream.getVideoTracks() : [])];
      const stream = new MediaStream(tracks), type = pickType(video ? VIDEO_TYPES : AUDIO_TYPES);
      let mr;
      try { mr = type ? new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 160000 }) : new MediaRecorder(stream); } catch {
        if (video) video.stop();
        teardown();
        return 'unsupported';
      }
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      cur = { mr, chunks, video, tool, songs, t0: Date.now(), type: mr.mimeType || type || (video ? 'video/webm' : 'audio/webm') };
      mr.start(1000);
      emit();
      return res === 'ok' ? 'ok' : res;
    },

    // Остановить и сохранить в медиатеку. → запись файла или null (слишком коротко или не вышло)
    stop() {
      const r = cur;
      if (!r) return Promise.resolve(null);
      cur = null;
      emit();
      if (r.midi) return saveMidi(r);
      return new Promise((done) => {
        r.mr.onstop = async () => {
          teardown();
          if (r.video) r.video.stop();
          const dur = (Date.now() - r.t0) / 1000;
          if (dur < 1 || !r.chunks.length) { done(null); return; }
          const blob = new Blob(r.chunks, { type: r.type.split(';')[0] });
          const rec = { id: 'r' + Date.now().toString(36), name: recName(r.tool, r.t0) + '.' + extOf(r.type), size: blob.size, type: blob.type, songs: r.songs,
            created: Date.now(), blob, kind: 'audio', dur, ...(r.video ? { video: true } : {}) };
          try { await app.files.add(rec); done(rec); } catch { done(null); }
        };
        try { r.mr.stop(); } catch { done(null); }
      });
    },
  };
}
