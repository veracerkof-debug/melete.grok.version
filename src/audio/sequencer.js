// Проигрыватель проекта студии: ноты клипов — синтезатором пианино (свой звук у дорожки) или сэмплером (запись из
// медиатеки по нотам — скорость воспроизведения от ноты root; записи раскодируются заранее), ударные — drums.js,
// клипы-записи — записью из медиатеки с нужной секунды. Режимы: песня по кругу (вся или петля region), один клип по
// кругу (правка в редакторе), один проход (сведение). Планировщик как у метронома: просыпается каждые 25 мс и
// выставляет всё, что начнётся в ближайшие 300 мс, точно по времени контекста. Свинг — задержка слабых восьмых.
// Отсчёт перед стартом (такты клика), уровни дорожек для микшера (анализаторы только пока микшер открыт). Без DOM.
import * as CLOCK from './clock.js';
import { getContext } from './context.js';
import { presetOf } from './synth.js';
import { songNotes, secPerBeat, clipById, trackOf, loopOf, autoAt, instOfProgram } from '../music/project.js';
import { createGM, loadGM, gmReady, DRUM_NOTES } from './gm.js';
import { clickVoice, clickNoise } from './metronome.js';
import { drumHit } from './drums.js';
import { createFxChain } from './fx.js';
import { grandPrepare } from './grand.js';

const TICK = 25, AHEAD = 0.3, AHEAD_HIDDEN = 1.6; // 0,3 с — запас на задержки главного потока под нагрузкой; свёрнуто: таймеры будят редко — планируем дальше вперёд
const ahead = () => (typeof document !== 'undefined' && document.visibilityState === 'hidden' ? AHEAD_HIDDEN : AHEAD);
const PASSES = 4; // записи планируются на столько кругов вперёд, дальше — перезапуск по кругу

// getFile(id) → запись медиатеки с blob (клипы-записи) или null
// context и clock — сведение «на бумаге» (render.js): свой OfflineAudioContext и часы по нему; без них — живой звук
// onLate(s) — нота спланирована позже своего времени на s секунд (главный поток не успел; для диагностики)
export function createSequencer({ mixer, synth, getProject, getFile = () => null, onBeat = () => {}, onLate = () => {}, context = null, clock = null }) {
  const { after, every, cancel } = clock || CLOCK;
  const ctxOf = () => context || getContext(mixer.state.mode);
  let c = null, timer = null, t0 = 0, nextBeat = 0, playing = false, noise = null, click = false, seq = 0, focus = null;
  let mode = { once: false, whole: false, from: 0, onEnd: null, endTm: 0 }, lead = 0; // lead — отсчёт перед стартом, в долях
  const live = new Map(); // ключ голоса → таймер выключения
  // Вкл/выкл дорожки с начала такта (лупер, вид «Партии»): trId → { mute, at, tm } — до at дорожка звучит как была
  const pend = new Map();
  const gm = createGM({ after, cancel }); // звуки General MIDI (банк SONiVOX): ноты дорожек 'gm' и наборы ударных
  const usesGM = (p) => p.tracks.some((tr) => tr.inst === 'gm' || tr.gmKit != null);
  // звук дорожки синтезатором: свой пресет; 'gm', пока банк не загрузился, — похожий звук приложения
  const patchOf = (tr) => presetOf(tr.inst === 'gm' ? instOfProgram(tr.gm) : tr.inst) || presetOf('piano');
  const cache = { key: '', notes: [], loop: { a: 0, b: 1 } };
  const bufs = new Map(); // fileId → AudioBuffer | Promise
  let audioSrcs = [];
  // Запись из медиатеки — буфером (один раз); сразу — если уже раскодирована, иначе обещание
  const bufOf = (fileId) => {
    let b = bufs.get(fileId);
    if (b === undefined) { const r = getFile(fileId); if (!r || !r.blob) return null; b = r.blob.arrayBuffer().then((ab) => c.decodeAudioData(ab)).then((ab) => { bufs.set(fileId, ab); return ab; }).catch(() => null); bufs.set(fileId, b); }
    return b;
  };
  const readyBuf = (fileId) => { const b = bufOf(fileId); return b && !(b instanceof Promise) ? b : null; };
  // Сэмплер: нота — запись со скоростью по высоте; огибающая 5 мс / 30 мс; стоп в конце ноты (или в конце записи)
  function sampleNote(buf, out, tr, m, at, dur, v) {
    const src = c.createBufferSource(), g = c.createGain(), root = (tr.sample && tr.sample.root) || 60;
    src.buffer = buf; src.playbackRate.value = Math.pow(2, (m - root) / 12);
    const end = at + Math.min(dur, buf.duration / src.playbackRate.value);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + 0.005);
    g.gain.setValueAtTime(v, Math.max(at + 0.005, end - 0.03)); g.gain.linearRampToValueAtTime(0, end);
    src.connect(g).connect(out);
    src.start(at); src.stop(end + 0.01);
    audioSrcs.push(src);
    return src;
  }
  // Записи сэмплеров проекта — раскодировать заранее (к старту и к пробе)
  const prime = (p) => { if (usesGM(p)) loadGM().catch(() => {}); p.tracks.forEach((tr) => { if (tr.inst === 'sample' && tr.sample && tr.sample.fileId) bufOf(tr.sample.fileId); if (tr.kit) Object.values(tr.kit).forEach(bufOf); }); };
  // Удар: своя запись ряда (как есть, до 4 с), набор ударных GM или синтез
  const hit = (tr, lane, out, at, v) => {
    const id = tr.kit && tr.kit[lane], buf = id && readyBuf(id);
    if (buf) { sampleNote(buf, out, { sample: { root: 60 } }, 60, at, 4, v); return; }
    if (tr.gmKit != null && gmReady() && gm.on(c, DRUM_NOTES[lane], 'gd' + seq++, { drums: tr.gmKit, out, vel: Math.min(1, v), at })) return;
    drumHit(c, out, lane, at, v);
  };
  // Цепочка эффектов и панорама на каждую дорожку (fx.js): создаются один раз и живут, пока дорожка есть в проекте;
  // ноты и удары дорожки идут в цепочку, она — в панораму — в шину теории (записи — в шину медиа)
  const chains = new Map(); // trackId → { chain, fx, pan, an, c }
  let chainsFor = null, metersOn = false;
  function trackOut(p, tr) {
    if (chainsFor !== p.id) { // другой проект — старые цепочки освобождаем
      chains.forEach((x) => x.chain.dispose()); chains.clear(); chainsFor = p.id;
    }
    let x = chains.get(tr.id);
    if (!x || x.c !== c) {
      if (x) x.chain.dispose();
      // громкость дорожки — отдельным узлом (vol): фейдер микшера действует сразу и на уже звучащие ноты и записи
      const chain = createFxChain(c, tr.fx), pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain(), auto = c.createGain(), vol = c.createGain();
      if (pan.pan) pan.pan.value = tr.pan || 0;
      vol.gain.value = tr.vol == null ? 1 : tr.vol;
      chain.output.connect(vol).connect(auto).connect(pan).connect(mixer.bus(tr.kind === 'audio' ? 'media' : 'theory'));
      chains.set(tr.id, (x = { chain, fx: tr.fx, pan, auto, vol, an: null, c }));
      if (metersOn) meterOn(x);
    } else if (x.fx !== tr.fx) { x.fx = tr.fx; x.chain.set(tr.fx); } // правка в шторке дорожки — новый объект
    const v = gainOf(p, tr);
    if (Math.abs(x.vol.gain.value - v) > 1e-4) x.vol.gain.setTargetAtTime(v, c.currentTime, 0.02);
    return x.chain.input;
  }
  // громкость дорожки с учётом выключения и соло: выключенная (или не соло при чьём-то соло) — 0 на узле vol, записи и
  // уже звучащие ноты глохнут сразу, а при включении звучат с того же места — без перезапуска
  const gainOf = (p, tr) => (tr.mute || (p.tracks.some((t) => t.solo) && !tr.solo) ? 0 : tr.vol == null ? 1 : tr.vol);
  const refreshGains = (p) => p.tracks.forEach((tr) => { const x = chains.get(tr.id); if (x) x.vol.gain.setTargetAtTime(gainOf(p, tr), x.c.currentTime, 0.02); });
  const meterOn = (x) => { if (x.an) return; const an = x.c.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.5; x.pan.connect(an); x.an = an; x.buf = new Float32Array(an.fftSize); };
  const meterOff = (x) => { if (!x.an) return; try { x.pan.disconnect(x.an); } catch { /* */ } x.an = null; };

  // что играть: песня (или петля) либо клип; соло — только оно; пересчёт при правке проекта
  const focusClip = (p) => (focus ? clipById(p, focus) : null);
  const plan = (p) => {
    const fc = focusClip(p), key = [p.updatedAt, fc ? fc.id : 'song', p.region && !mode.whole ? p.region.a + '-' + p.region.b : ''].join('|');
    if (cache.key === key) return cache;
    const solo = p.tracks.some((t) => t.solo);
    cache.key = key;
    cache.notes = songNotes(p, fc).filter((n) => !n.tr.mute && (!solo || n.tr.solo));
    cache.loop = mode.whole && !fc ? loopOf({ ...p, region: null }) : loopOf(p, fc);
    return cache;
  };
  const swingOf = (p, t) => (Math.abs(t % 1 - 0.5) < 1e-6 ? p.swing * (1 / 3) : 0); // слабая восьмая — позже, до триольной
  // Счётчик долей от старта → доля песни: до петли — как есть, дальше — по кругу петли
  const songBeat = (n, { a, b }) => { const L = b - a; return n < a ? n : a + (((n - a) % L) + L) % L; };

  function sched() {
    const p = getProject();
    if (!p || !playing) return;
    // свёрнуто → развёрнуто: планировать сразу (таймер мог проспать)
    if (!sched.vis && !context) {
      sched.vis = true;
      sched.onVis = () => { if (playing && document.visibilityState === 'visible') sched(); };
      document.addEventListener('visibilitychange', sched.onVis);
    }
    const spb = secPerBeat(p), { notes, loop } = plan(p), until = c.currentTime + (context ? AHEAD : ahead());
    while (t0 + nextBeat * spb < until) {
      if (mode.once && nextBeat >= loop.b) { // один проход: конец петли — хвост и стоп
        if (!mode.endTm) { const end = t0 + nextBeat * spb + 2.5; mode.endTm = after(Math.max(0, (end - c.currentTime) * 1000), () => { const fn = mode.onEnd; api.stop(); if (fn) fn(); }); }
        return;
      }
      const beatT = t0 + nextBeat * spb, inLoop = songBeat(nextBeat, loop);
      if (click) clickVoice(c, mixer.bus('metro'), beatT, inLoop % p.num === 0 ? 3 : 1, 'click', noise || (noise = clickNoise(c)));
      onBeat({ beat: inLoop, bar: Math.floor(inLoop / p.num), ms: (beatT - c.currentTime + (c.outputLatency || 0)) * 1000 });
      for (const n of notes) {
        if (n.t < inLoop) continue;
        if (n.t >= inLoop + 1 || n.t >= loop.b) break;
        const at = beatT + (n.t - inLoop + swingOf(p, n.t)) * spb, g = n.gain || 1, pd = pend.get(n.tr.id);
        if (pd && (pd.mute ? at >= pd.at - 1e-4 : at < pd.at - 1e-4)) continue;
        const out = trackOut(p, n.tr);
        if (!context && at < c.currentTime - 0.003) onLate(c.currentTime - at); // громкость дорожки — узел vol в trackOut
        if (n.drum) { hit(n.tr, n.drum, out, at, n.v * g); continue; }
        if (n.tr.inst === 'sample') { const buf = n.tr.sample && n.tr.sample.fileId && readyBuf(n.tr.sample.fileId); if (buf) sampleNote(buf, out, n.tr, n.m, at, n.d * spb, n.v * g); continue; }
        if (n.tr.inst === 'gm' && gmReady()) { gm.on(c, n.m, 'sg' + seq++, { program: n.tr.gm || 0, out, vel: Math.min(1, n.v * g), at, dur: n.d * spb }); continue; } // отпускание — точно по длине ноты
        const key = 'sq' + seq++, patch = patchOf(n.tr);
        synth.on(n.m, key, { bus: 'theory', out, patch: { ...patch, gain: (patch.gain || 1) * g }, vel: n.v, at });
        live.set(key, after(Math.max(0, (at + n.d * spb - c.currentTime) * 1000 - 60), () => { live.delete(key); synth.off(key, false, at + n.d * spb); }));
      }
      nextBeat++;
    }
  }

  // Клипы-записи: запись раскодируется один раз; клип звучит с секунды off один раз (loop — по кругу) длиной клипа, в такт нотам.
  // Окна проигрывания: до петли (если старт раньше неё) и круги петли; в каждом окне — кусок клипа, что в него попал
  function windows(p) {
    const { loop } = plan(p), fc = focusClip(p), out = [];
    const from = mode.from;
    if (!fc && from < loop.a) out.push({ s0: from, s1: loop.a, at: from });
    for (let k = 0; k < (mode.once ? 1 : PASSES); k++) out.push({ s0: fc ? fc.at : loop.a, s1: fc ? fc.at + fc.len : loop.b, at: loop.a + k * (loop.b - loop.a) });
    return out;
  }
  async function startAudio(p) {
    const fc = focusClip(p), spb = secPerBeat(p), myT0 = t0;
    const clips = (fc ? [fc] : p.clips).filter((cl) => { const tr = trackOf(p, cl); return tr && tr.kind === 'audio' && cl.data.fileId && (!cl.mute || fc); }); // mute/solo дорожки — узлом vol
    for (const cl of clips) {
      const tr = trackOf(p, cl);
      let b = bufOf(cl.data.fileId);
      if (!b) continue;
      b = await b;
      if (!b || !playing || t0 !== myT0) continue;
      const out = trackOut(p, tr), off = Math.min(cl.data.off || 0, b.duration - 0.01), span = Math.max(0.01, b.duration - off), vol = cl.gain == null ? 1 : cl.gain;
      for (const w of windows(p)) {
        const s0 = Math.max(cl.at, w.s0), s1 = Math.min(cl.at + cl.len, w.s1);
        if (s1 - s0 < 1e-6) continue;
        const start = t0 + (w.at + (s0 - w.s0)) * spb, end = start + (s1 - s0) * spb;
        if (end <= c.currentTime) continue;
        const now = c.currentTime, late = Math.max(0, now - start), t1 = Math.max(now, start);
        // с какого места файла: один раз — дальше по записи (за её концом — тишина), по кругу — как раньше
        const into = (s0 - cl.at) * spb + late, pos = cl.loop ? off + (into % span) : off + into;
        if (!cl.loop && pos >= b.duration - 0.005) continue;
        const src = c.createBufferSource(), g = c.createGain();
        src.buffer = b; if (cl.loop) { src.loop = true; src.loopStart = off; src.loopEnd = b.duration; }
        // затухания клипа (в долях): в начале и в конце клипа, если это окно их захватывает
        const fi = (cl.data.fadeIn || 0) * spb, fo = (cl.data.fadeOut || 0) * spb;
        g.gain.setValueAtTime(vol, t1);
        if (fi > 0 && s0 === cl.at) { g.gain.setValueAtTime(0, t1); g.gain.linearRampToValueAtTime(vol, Math.max(t1 + 0.005, start + fi)); }
        if (fo > 0 && Math.abs(s1 - (cl.at + cl.len)) < 1e-6 && end - fo > t1) { g.gain.setValueAtTime(vol, end - fo); g.gain.linearRampToValueAtTime(0, end); }
        src.connect(g).connect(out);
        src.start(t1, pos);
        src.stop(cl.loop ? end : Math.min(end, t1 + (b.duration - pos)));
        audioSrcs.push(src);
      }
    }
  }
  const stopAudio = () => { audioSrcs.forEach((s) => { try { s.stop(); s.disconnect(); } catch { /* */ } }); audioSrcs = []; };
  // Автоматизация: огибающие громкости (множитель) и панорамы дорожки — прямыми между точками, по окнам петли;
  // от текущего места — значение сейчас, дальше — точки. Без точек — как ручки
  function scheduleAuto(p) {
    const spb = secPerBeat(p), now = c.currentTime, b0 = Math.max(0, (now - t0) / spb), ws = windows(p);
    p.tracks.forEach((tr) => {
      const x = chains.get(tr.id) || (trackOut(p, tr), chains.get(tr.id)), a = tr.auto || {};
      [['vol', x.auto.gain, 1], ['pan', x.pan.pan, tr.pan || 0]].forEach(([k, param, def]) => {
        if (!param) return;
        param.cancelScheduledValues(now);
        const pts = a[k];
        if (!pts || !pts.length) { param.setValueAtTime(def, now); return; }
        param.setValueAtTime(autoAt(pts, songBeat(b0, plan(p).loop), def), now);
        ws.forEach((w) => {
          const tw = (sb) => t0 + (w.at + (sb - w.s0)) * spb; // время доли песни sb в этом окне
          if (tw(w.s0) > now) param.setValueAtTime(autoAt(pts, w.s0, def), tw(w.s0));
          pts.forEach((q) => { if (q.t > w.s0 && q.t < w.s1 && tw(q.t) > now) param.linearRampToValueAtTime(q.v, tw(q.t)); });
          if (tw(w.s1) > now) param.linearRampToValueAtTime(autoAt(pts, w.s1, def), tw(w.s1));
        });
      });
    });
  }
  const resetAuto = () => chains.forEach((x) => { const now = x.c.currentTime; x.auto.gain.cancelScheduledValues(now); x.auto.gain.setValueAtTime(1, now); if (x.pan.pan) { x.pan.pan.cancelScheduledValues(now); } });
  // записи спланированы на несколько кругов: по истечении — заново (таймер по кругу)
  let audioTm = 0;
  const loopSec = (p) => { const { loop } = plan(p); return (loop.b - loop.a) * secPerBeat(p); };
  const scheduleAudio = (p) => { cancel(audioTm); startAudio(p); scheduleAuto(p); if (mode.once) return; const ms = loopSec(p) * 1000; audioTm = after(ms * (PASSES - 1), () => { if (playing) { stopAudioLater(); mode.from = plan(p).loop.a; scheduleAudio(p); } }); };
  const stopAudioLater = () => { const old = audioSrcs; audioSrcs = []; old.forEach((s) => { try { s.stop(c.currentTime + loopSec(getProject())); } catch { /* */ } }); };

  const api = {
    get playing() { return playing; },
    // что по кругу: id клипа (редактор) или null — вся песня
    get focus() { return focus; },
    set focus(id) { id = id || null; if (id === focus) return; const was = playing; if (was) api.stop(); focus = id; if (was) api.start(); }, // тот же — без перезапуска (render() ставит его при каждой перерисовке)
    set click(v) { click = !!v; },
    get click() { return click; },
    get context() { return c; },
    // время старта (часы контекста) — доля 0 песни; до него идёт отсчёт
    get t0() { return t0; },
    // где сейчас: доля от начала (песни или клипа) или -1; во время отсчёта — отрицательная доля (−4 … 0)
    pos() {
      const p = getProject(); if (!playing || !p) return -1;
      const b = (c.currentTime - t0) / secPerBeat(p);
      if (b < mode.from) return Math.max(-lead, b - mode.from) - (b < mode.from - 1e-3 ? 0 : 0);
      return songBeat(b, plan(p).loop);
    },
    // opts: countIn — тактов отсчёта кликом до старта; once — один проход до конца петли (сведение), onEnd — по концу;
    //       whole — вся песня, петля не в счёт (сведение)
    // t0 — начало доли 0 по часам контекста (лупер: начало круга петли, может быть в прошлом); с ним — без отсчёта
    start(fromBeat = 0, { countIn = 0, once = false, whole = false, onEnd = null, t0: at0 = null } = {}) {
      c = ctxOf();
      if (!c) return false;
      api.stop();
      const p = getProject();
      if (!p) return false;
      mode = { once: !!once, whole: !!whole, from: 0, onEnd, endTm: 0 };
      cache.key = '';
      const spb = secPerBeat(p), { loop } = plan(p);
      let from = Math.max(0, fromBeat);
      if (!focusClip(p) && from >= loop.b) from = loop.a;
      lead = Math.max(0, Math.round(countIn)) * p.num;
      mode.from = from;
      t0 = c.currentTime + 0.05 + lead * spb - from * spb;
      nextBeat = Math.floor(from);
      if (at0 != null) { lead = 0; mode.from = 0; t0 = at0; nextBeat = Math.max(0, Math.ceil((c.currentTime + 0.01 - t0) / spb - 1e-6)); }
      playing = true;
      prime(p);
      if (lead) for (let i = 0; i < lead; i++) clickVoice(c, mixer.bus('metro'), t0 + (from - lead + i) * spb, i % p.num === 0 ? 3 : 1, 'click', noise || (noise = clickNoise(c)));
      sched();
      timer = every(TICK, sched);
      scheduleAudio(p);
      return true;
    },
    stop() {
      pend.forEach((d, id) => { cancel(d.tm); const p = getProject(), tr = p && p.tracks.find((x) => x.id === id); if (tr) tr.mute = d.mute; }); pend.clear();
      cancel(timer); timer = null; cancel(audioTm); cancel(mode.endTm); mode.endTm = 0;
      if (mode.whole) { mode.whole = false; cache.key = ''; }
      playing = false;
      stopAudio();
      resetAuto();
      { const p = getProject(); if (p) p.tracks.forEach((tr) => { const x = chains.get(tr.id); if (x && x.pan.pan) x.pan.pan.setValueAtTime(tr.pan || 0, x.c.currentTime); }); }
      live.forEach((tm, key) => { if (tm && tm.stop) { try { tm.stop(); } catch { /* */ } } else { cancel(tm); synth.off(key, true); } });
      live.clear();
      gm.all();
    },
    toggle(fromBeat = 0) { return playing ? (api.stop(), false) : api.start(fromBeat); },
    // Одна нота или удар сразу (правка — услышать, что поставили); hold — держать, пока не отпустят (клавиши, пэды)
    audition(tr, m, { hold = false, vel = 0.7 } = {}) {
      c = ctxOf();
      if (!c) return null;
      const p = getProject(), out = p ? trackOut(p, tr) : mixer.bus('theory');
      if (tr.kind === 'drums' && tr.gmKit != null && !gmReady()) { loadGM().then(() => hit(tr, m, out, c.currentTime, vel + 0.1)).catch(() => {}); return null; }
      if (tr.kind === 'drums') { const id = tr.kit && tr.kit[m]; if (id && !readyBuf(id)) { const b = bufOf(id); if (b instanceof Promise) b.then(() => hit(tr, m, out, c.currentTime, vel + 0.1)); } else hit(tr, m, out, c.currentTime, vel + 0.1); return null; }
      if (tr.inst === 'sample') { // сэмплер: сразу, если запись готова; иначе раскодировать и сыграть, когда будет
        const id = tr.sample && tr.sample.fileId; if (!id) return null;
        const play = (buf) => { if (!buf) return; const src = sampleNote(buf, out, tr, m, c.currentTime, hold ? 60 : 0.6, vel); if (hold) { const k = 'sqs' + seq++; live.set(k, src); return k; } };
        const b = bufOf(id);
        if (!b) return null;
        if (b instanceof Promise) { b.then(play); return null; }
        return play(b);
      }
      if (tr.inst === 'gm') { // General MIDI: сразу, если банк есть; иначе — загрузить и сыграть
        const k = 'sqg' + seq++, go = () => { gm.on(c, m, k, { program: tr.gm || 0, out, vel }); if (!hold) after(350, () => gm.off(k)); };
        if (gmReady()) go(); else loadGM().then(go).catch(() => {});
        return k;
      }
      const key = 'sqa' + seq++, patch = patchOf(tr);
      synth.on(m, key, { bus: 'theory', out, patch, vel });
      if (!hold) after(350, () => synth.off(key));
      return key;
    },
    release(key) {
      if (!key) return;
      const src = live.get(key);
      if (src && src.stop) { live.delete(key); try { src.stop(c.currentTime + 0.03); } catch { /* */ } return; } // нота сэмплера
      if (key.startsWith('sqg')) { gm.off(key); return; }
      synth.off(key);
    },
    // Эффекты и панорама дорожки изменены (шторка, микшер): применить к живой цепочке сразу
    setTrackFx(tr, fx) { tr.fx = fx; const x = chains.get(tr.id); if (x) { x.fx = fx; x.chain.set(fx); } },
    // громкость дорожки — сразу, на ходу (узел vol), и в проект
    setTrackVol(tr, v) { tr.vol = v; const p = getProject(); const x = chains.get(tr.id); if (x && p) x.vol.gain.setTargetAtTime(gainOf(p, tr), x.c.currentTime, 0.02); },
    // выключение и соло — на ходу: громкости всех дорожек узлами, новые ноты выключенных не планируются
    setTrackMute(tr, on, at = 0) {
      const old = pend.get(tr.id); if (old) { cancel(old.tm); pend.delete(tr.id); }
      const p = getProject();
      if (!at || !c || !playing || at <= c.currentTime + 0.02) { tr.mute = !!on; cache.key = ''; if (p && c) refreshGains(p); return; }
      // с начала такта: включение — ноты раньше at пропускаются; выключение — до at звучит, тишина с at
      const x = chains.get(tr.id), d = { mute: !!on, at, tm: 0 };
      pend.set(tr.id, d);
      if (on) { if (x) x.vol.gain.setTargetAtTime(0, at, 0.006); }
      else { tr.mute = false; cache.key = ''; if (p) refreshGains(p); }
      d.tm = after(Math.max(0, (at - c.currentTime) * 1000 + 20), () => { if (pend.get(tr.id) !== d) return; pend.delete(tr.id); tr.mute = d.mute; cache.key = ''; const q = getProject(); if (q) refreshGains(q); });
    },
    pending: (trId) => pend.has(trId),
    setTrackSolo(tr, on) { tr.solo = !!on; cache.key = ''; const p = getProject(); if (p && c) refreshGains(p); },
    // клипы-записи изменились (выключение клипа, громкость, затухания, файл): перепланировать записи с того же места
    audioChanged() { const p = getProject(); if (!playing || !p) return; cache.key = ''; cancel(audioTm); stopAudio(); scheduleAudio(p); },
    setTrackPan(tr, v) { tr.pan = v; const x = chains.get(tr.id); if (x && x.pan.pan && !(playing && tr.auto && tr.auto.pan)) x.pan.pan.setTargetAtTime(v, x.c.currentTime, 0.02); },
    // Точки автоматизации изменились (плейлист): пересчитать огибающие на ходу
    autoChanged() { if (playing) scheduleAuto(getProject()); },
    // Уровни дорожек для микшера: включить анализаторы (только пока микшер открыт), level(trId) → 0…1 (пик)
    meters(on) { metersOn = !!on; chains.forEach((x) => (on ? meterOn(x) : meterOff(x))); },
    level(trId) {
      const x = chains.get(trId); if (!x || !x.an) return 0;
      x.an.getFloatTimeDomainData(x.buf);
      let m = 0; for (let i = 0; i < x.buf.length; i++) { const v = Math.abs(x.buf[i]); if (v > m) m = v; }
      return Math.min(1, m);
    },
    // Сведение «на бумаге»: всё, что понадобится песне, — заранее (банк GM, записи клипов, сэмплера и ударных, записи
    // рояля для её нот): в офлайн-расчёте подождать нельзя, а «пока не загрузилось» звучало бы иначе, чем вживую
    async prepare() {
      c = ctxOf();
      const p = getProject();
      if (!c || !p) return;
      if (usesGM(p)) await loadGM().catch(() => {});
      const ids = new Set();
      p.clips.forEach((cl) => { if (cl.data && cl.data.fileId) ids.add(cl.data.fileId); });
      p.tracks.forEach((tr) => { if (tr.inst === 'sample' && tr.sample && tr.sample.fileId) ids.add(tr.sample.fileId); if (tr.kit) Object.values(tr.kit).forEach((id) => ids.add(id)); });
      await Promise.all([...ids].map((id) => bufOf(id)));
      const grand = songNotes(p, null).filter((n) => !n.drum && n.tr.inst !== 'sample' && !(n.tr.inst === 'gm' && gmReady()) && patchOf(n.tr).kind === 'grand').map((n) => ({ m: n.m, vel: n.v }));
      if (grand.length) await grandPrepare(c, grand);
    },
    dispose() {
      api.stop();
      chains.forEach((x) => x.chain.dispose()); chains.clear(); chainsFor = null;
      // Слушатель видимости снимается: иначе он живёт и после закрытия студии (правило: слушатель без снятия — дефект)
      try { if (sched.onVis) document.removeEventListener('visibilitychange', sched.onVis); } catch { /* ignore */ }
      sched.onVis = null; sched.vis = false;
    },
  };
  return api;
}
