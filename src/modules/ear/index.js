// Тренажёр слуха: два режима — «Тренажёр» (7 упражнений по своим настройкам: интервалы, аккорды, гаммы и лады,
// ступени, абсолютный слух, диктант, пение; счёт — за неделю, без серий) и «Уроки» (путь из глав, src/modules/ear/course.js;
// сдача, повторение, проверка уровня — src/music/course.js, вид — src/ui/course.js). Логика упражнений — src/music/ear.js.
// Перенесено из legacy/practice.html (earHome, earHTML, earSettings, earStatsSheet, earGoalSheet, nt*, earPitch).
import './ear.css';
import ru from './i18n/ru.json';
import uz from './i18n/uz.json';
import en from './i18n/en.json';
import el from './i18n/el.json';
import { SH, MAJI, MAJ_NAMES, MIN_NAMES, spell, mName } from '../../music/notes.js';
import { SCALES } from '../../music/theory.js';
import {
  DRILLS, EIV, ECH, EDG, RANGES, NT_COLORS, NT_TIMBRES, NT_GOAL, LEVELS, TEMPOS, EAR_TIMBRES, normalizeEar, setLevel, toggleInSet, ntSet, generate, playPlan, comparePlan,
  normalizeEarData, record, accuracy, ntProgress, dictationStep, pitchCents, pitchTol, DG_KINDS, DG_MODES, romanOf, dgScale,
} from '../../music/ear.js';
import { swipe } from '../../ui/gestures.js';
import { yin, refinePitch, createPitchSmoother } from '../../audio/pitch.js';
import { noiseBuf } from '../../audio/waves.js';
import { EAR_COURSE, lessonConf, lessonN } from './course.js';
import { normalizeProg, findLesson, chapterOf, nextLesson, dueReviews, recordLesson, recordReview, placementPlan, applyPlacement } from '../../music/course.js';
import { courseHTML, lessonBarHTML, resultHTML, modeSeg } from '../../ui/course.js';

import meta, { ICON } from './meta.js';
const DICON = {
  iv: '<svg viewBox="0 0 24 24"><circle cx="7" cy="17" r="2.6"/><circle cx="16" cy="9" r="2.6"/><path d="M9.6 17V5M18.6 9V3"/></svg>',
  ch: '<svg viewBox="0 0 24 24"><ellipse cx="10" cy="18" rx="3" ry="2.2"/><ellipse cx="10" cy="12.5" rx="3" ry="2.2"/><ellipse cx="10" cy="7" rx="3" ry="2.2"/><path d="M13 18V3"/></svg>',
  sc: '<svg viewBox="0 0 24 24"><path d="M3 20h4v-4h4v-4h4V8h4V4"/></svg>',
  dg: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9v6M12.5 9h3l-2.5 6"/></svg>',
  nt: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M13 5v14M10.5 5v8M15.5 5v8"/></svg>',
  dc: '<svg viewBox="0 0 24 24"><path d="M4 17c2-6 4-6 6 0s4 6 6 0 2-4 4-4"/></svg>',
  pt: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
};
const I = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.3-7.2c.6-.4.6-1.4 0-1.8L8.6 3.9C7.9 3.5 7 4 7 4.8z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" class="f"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/></svg>',
  stats: '<svg viewBox="0 0 24 24"><path d="M5 20v-6M10 20V9M15 20v-8M20 20V5"/></svg>',
};

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const DAY = 86400000;

// Состояние занятия (не сохраняется): вопросы, ответы, серии, таймеры звука
const EAR = { q: {}, res: {}, sess: {}, timers: [], playing: false, hold: 0, reveal: false, ntPlayed: false, listen: false, mixTim: 'piano', chain: [] };
// Идущий урок, проверка уровня или повторение: { kind: 'lesson'|'place'|'review', id, q: [{ lid, rev, conf, ans }], i, done }
let L = null;
let host = null, ctx = null, size = 'full', onClick = null, onDown = null, unswipe = null;
let mic = null, micTimer = 0, smooth = null, lastT = 0;

const EC = () => (L && L.cur) || normalizeEar(ctx.store.all());
const EST = () => normalizeEarData(ctx.data());
const esc = (s) => ctx.ui.esc(s);
const drill = (id) => DRILLS.find((d) => d[0] === id);

/* ---------- звук ---------- */

function clearTimers() { EAR.timers.forEach(clearTimeout); EAR.timers = []; EAR.playing = false; }
function at(ms, fn) { EAR.timers.push(setTimeout(fn, ms)); }
function pulse(on) { const b = host && host.querySelector('#eplay'); if (b) b.classList.toggle('playing', on); }
const note = (m, dur, tim) => ctx.audio.playNote(m, { bus: 'theory', dur, preset: tim || 'piano' });

// «Сброс слуха»: шум с плывущим фильтром и россыпь коротких нот
function mask() {
  const bus = ctx.audio.bus('theory');
  if (!bus) return;
  const c = bus.context, t = c.currentTime + 0.02, n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  n.buffer = noiseBuf(c);
  n.loop = true;
  bp.type = 'bandpass';
  bp.Q.value = 0.7;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(3000, t + 0.7);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.08);
  g.gain.linearRampToValueAtTime(0.0001, t + 0.75);
  n.connect(bp).connect(g).connect(bus);
  n.start(t);
  n.stop(t + 0.8);
  const base = 48 + Math.floor(Math.random() * 25);
  [0, 1, 2, 3, 5].map((x) => base + x + Math.floor(Math.random() * 7)).forEach((m, i) => setTimeout(() => note(m, 0.18, 'sine'), i * 90));
}

function runEvent(x) {
  const A = ctx.audio;
  if (x.mask) mask();
  // тембр: 'mix' — случайный встроенный звук на каждый вопрос (EAR.mixTim), иначе — выбранный
  const tim = x.tim === 'mix' ? EAR.mixTim : x.tim;
  if (x.seq) A.playSeq(x.seq, { step: x.step, preset: tim });
  else if (x.chord) A.playChord(x.chord, { preset: tim });
  else if (x.note != null) note(x.note, x.dur, tim);
}

function gen(sec) {
  const q = generate(sec, EC(), Math.random, sec === 'nt' ? EAR.q.nt : null);
  EAR.q[sec] = q;
  EAR.res[sec] = null;
  EAR.chain = [];
  EAR.hold = 0;
  EAR.mixTim = NT_TIMBRES[Math.floor(Math.random() * NT_TIMBRES.length)];
  EAR.listen = sec === 'nt' && EC().listen; // новый вопрос «Нот» — сначала можно послушать клавиши (если так настроено)
  return q;
}

function play(sec) {
  ctx.audio.unlock();
  const q = EAR.q[sec] || gen(sec), e = EC();
  clearTimers();
  EAR.playing = true;
  pulse(true);
  const plan = playPlan(sec, q, e, { masked: EAR.ntPlayed });
  if (sec === 'nt') EAR.ntPlayed = true;
  plan.ev.forEach((x) => (x.at ? at(x.at, () => runEvent(x)) : runEvent(x)));
  at(plan.end, () => { EAR.playing = false; pulse(false); });
}

function compare(sec, v) {
  clearTimers();
  const c = comparePlan(sec, EAR.q[sec], v);
  if (c) runEvent(c);
}

/* ---------- ответы ---------- */

// Что с чем путается: E.cf[упражнение]['верный>выбранный'] — для статистики «Часто путается»
function confuse(sec, ans, v) {
  if (!['iv', 'ch', 'sc', 'dg'].includes(sec) || String(ans).includes(',')) return;
  const E = EST(), cf = E.cf || (E.cf = {}), m = cf[sec] || (cf[sec] = {}), k = ans + '>' + v;
  m[k] = (m[k] || 0) + 1;
  ctx.saveData();
}

function rec(sec, key, ok) {
  record(EST(), EAR.sess, sec, key, ok, dayKey(Date.now()));
  ctx.saveData();
}

// После верного ответа — следующий вопрос сам (если включено)
function autoNext(sec, delay = 950, gap = 250) {
  if (!EC().auto) return;
  if (L) { at(delay, advance); return; }
  at(delay, () => { gen(sec); render(); at(gap, () => play(sec)); });
}

function answer(sec, v) {
  const q = EAR.q[sec];
  if (!q) return;
  if (EAR.res[sec]) { compare(sec, v); return; }
  if (q.degs) {
    // цепочка ступеней: ответы копятся по порядку, каждая ступень — в статистику отдельно
    EAR.chain.push(String(v));
    if (EAR.chain.length < q.degs.length) return;
    let all = true;
    q.degs.forEach((d, i) => { const o = EAR.chain[i] === String(d); if (!o) all = false; rec(sec, d, o); });
    EAR.res[sec] = { ok: all, picked: EAR.chain.join(',') };
    lt(all);
    if (all) autoNext(sec);
    return;
  }
  const ok = String(v) === String(q.ans);
  EAR.res[sec] = { ok, picked: String(v) };
  rec(sec, q.ans, ok);
  lt(ok);
  if (!ok) confuse(sec, q.ans, v);
  if (ok) autoNext(sec);
}

function ntAnswer(m) {
  const q = EAR.q.nt, e = EC(), { t } = ctx;
  if (!q || EAR.res.nt) return;
  const pc = m % 12, ok = pc === q.ans;
  EAR.res.nt = { ok, picked: String(pc) };
  lt(ok);
  rec('nt', SH[q.ans], ok);
  if (!ok) {
    const E = EST();
    E.ntc = E.ntc || {};
    const k = SH[q.ans] + '→' + SH[pc];
    E.ntc[k] = (E.ntc[k] || 0) + 1;
    ctx.saveData();
    // правильная нота и та, что выбрана, — для сравнения
    at(500, () => note(q.m, 0.9, q.tim));
    at(1600, () => note(q.m - (q.m % 12) + pc, 0.9, q.tim));
  }
  const nn = ntProgress(e, ok);
  ctx.store.save();
  if (nn != null) at(ok ? 1000 : 2600, () => ctx.ui.toast(t('ntNew', { note: SH[nn], n: ntSet(e).length })));
  if (ok) autoNext('nt', 1000, 200);
  render();
}

function dcKey(m) {
  const q = EAR.q.dc;
  if (!q || EAR.res.dc) return;
  const r = dictationStep(q, m), key = q.notes.length + ' ноты'; // ключ статистики — как в прототипе
  if (r === 'wrong') {
    EAR.res.dc = { ok: false };
    rec('dc', key, false);
    lt(false);
    at(500, () => ctx.audio.playSeq(q.notes, { step: 0.45 }));
  } else if (r === 'done') {
    EAR.res.dc = { ok: true };
    rec('dc', key, true);
    lt(true);
    autoNext('dc', 1100, 250);
  }
  render();
}

/* ---------- пение (микрофон) ---------- */

function pitch(f) {
  const q = EAR.q.pt, e = EC(), { t } = ctx, live = host && host.querySelector('#eneedle');
  if (!q || EAR.res.pt || !host) return;
  const hint = host.querySelector('#ehint'), val = host.querySelector('#ecents'), hb = host.querySelector('#ehold');
  if (!f) {
    if (hint) hint.textContent = t(mic ? 'sing' : 'micOff');
    if (live) live.style.left = '50%';
    EAR.hold = 0;
    return;
  }
  const c = pitchCents(f, q.m, ctx.peek('tuner').a4 || 440, e.oct), tol = pitchTol(e);
  if (live) { live.style.left = 50 + Math.max(-100, Math.min(100, c)) / 2 + '%'; live.classList.toggle('ok', Math.abs(c) <= tol); }
  if (val) val.textContent = t('cents', { c: (c > 0 ? '+' : '') + c });
  if (hint) hint.textContent = t(Math.abs(c) <= tol ? 'hold' : c < 0 ? 'higher' : 'lower');
  if (Math.abs(c) <= tol) {
    if (!EAR.hold) EAR.hold = Date.now();
    const pr = Math.min(1, (Date.now() - EAR.hold) / 800);
    if (hb) hb.style.width = pr * 100 + '%';
    if (pr >= 1) { // держал ноту 0,8 с
      EAR.res.pt = { ok: true, picked: String(q.m) };
      rec('pt', mName(q.m).replace(/\d/, ''), true);
      lt(true);
      render();
      autoNext('pt', 1000, 200);
    }
  } else {
    EAR.hold = 0;
    if (hb) hb.style.width = '0%';
  }
}

async function micStart() {
  const { t, ui } = ctx;
  try { mic = await ctx.mic.request(); } catch (err) { ui.toast(t(err.reason === 'denied' ? 'micDenied' : 'micNone')); return; }
  if (!host) { micStop(); return; }
  smooth = createPitchSmoother();
  micTimer = setInterval(() => {
    const buf = mic.read();
    let f = yin(buf, mic.sampleRate);
    if (f) f = refinePitch(buf, f, mic.sampleRate);
    if (f && (f < 25 || f > 4200)) f = 0;
    if (!f) { if (Date.now() - lastT > 1400) pitch(0); return; }
    lastT = Date.now();
    pitch(smooth(f));
  }, 70);
  render();
}

function micStop() {
  clearInterval(micTimer);
  micTimer = 0;
  if (mic) mic.stop();
  mic = null;
}

/* ---------- подписи ---------- */

function label(sec, key) {
  const { t, tn } = ctx;
  if (sec === 'iv') return EIV.includes(+key) ? t('iv.' + key) : key;
  if (sec === 'ch') return ECH.some((c) => c[0] === key) ? t('ch.' + key) : key;
  if (sec === 'sc') return SCALES[key] ? t('scale.' + key).replace(/^./, (c) => c.toUpperCase()) : key;
  if (sec === 'dg') {
    if (String(key).includes(',')) return String(key).split(',').map((k) => { const x = EDG.find((d) => d[0] === +k); return x ? x[1] : k; }).join(' → ');
    if (isNaN(+key)) return String(key); // аккорд ступени — римская цифра
    const x = EDG.find((d) => d[0] === +key); return x ? t('st.degree', { d: x[1] }) : key;
  }
  if (sec === 'nt') return SH[+key] ?? key;
  if (sec === 'dc') { const n = parseInt(key, 10); return n ? tn('st.dcLen', n) : key; }
  return isNaN(+key) ? key : mName(+key);
}

/* ---------- уроки ---------- */

function prog() { const E = EST(); return normalizeProg(E.course || (E.course = {})); }
const lname = (id) => ctx.t('ls.' + id), cname = (id) => ctx.t('lch.' + id);

// Ответ на вопрос урока (один раз на вопрос)
function lt(ok) { if (!L || L.done) return; const x = L.q[L.i]; if (x && x.ans == null) x.ans = !!ok; }

// Вопрос i: свои настройки, новый вопрос, звучание
function setQ() {
  const x = L.q[L.i];
  L.cur = x.conf;
  const sec = x.conf.sec;
  EAR.q[sec] = null; EAR.res[sec] = null; EAR.reveal = false;
  if (sec !== 'pt') micStop();
  gen(sec);
  render();
  at(300, () => play(sec));
}

function begin(kind, id, q) {
  clearTimers(); micStop();
  L = { kind, id, q, i: 0, done: null };
  setQ();
}

// Урок: до двух вопросов повторения из уроков, которым пора, затем вопросы урока
function startLesson(id) {
  const l = findLesson(EAR_COURSE, id);
  if (!l) return;
  const base = normalizeEar(ctx.store.all()), conf = lessonConf(base, l), q = [];
  dueReviews(EAR_COURSE, prog(), Date.now(), id).filter((r) => r.sec !== 'pt').slice(0, 2).forEach((r) => q.push({ lid: r.id, rev: true, conf: lessonConf(base, r) }));
  for (let k = 0; k < lessonN(l); k++) q.push({ lid: id, conf });
  begin('lesson', id, q);
}

// Повторение: по два вопроса из уроков, которым пора (до пяти уроков)
function startReview() {
  const base = normalizeEar(ctx.store.all()), q = [];
  dueReviews(EAR_COURSE, prog(), Date.now()).filter((r) => r.sec !== 'pt').slice(0, 5).forEach((r) => { const c = lessonConf(base, r); q.push({ lid: r.id, rev: true, conf: c }, { lid: r.id, rev: true, conf: c }); });
  if (q.length) begin('review', null, q);
}

// Проверка уровня: первый, средний и последний урок каждой главы по два вопроса (без пения — нужен микрофон)
function startPlacement() {
  const base = normalizeEar(ctx.store.all()), course = EAR_COURSE.filter((c) => c.id !== 'pt');
  begin('place', null, placementPlan(course, 2).map((x) => ({ lid: x.id, conf: lessonConf(base, findLesson(EAR_COURSE, x.id)) })));
}

function advance() {
  if (!L || L.done) return;
  const x = L.q[L.i];
  if (x && x.ans == null) x.ans = false; // пропущенный вопрос — не засчитан
  if (L.i + 1 < L.q.length) { L.i++; setQ(); return; }
  finishL();
}

function finishL() {
  clearTimers(); micStop();
  const p = prog(), now = Date.now();
  const by = {};
  L.q.forEach((x) => { (by[x.lid] = by[x.lid] || []).push(!!x.ans); });
  if (L.kind === 'place') {
    const marked = applyPlacement(EAR_COURSE, p, by, now);
    L.done = { placement: { n: marked.length } };
  } else {
    Object.entries(by).forEach(([id, oks]) => { if (L.kind === 'review' || id !== L.id) recordReview(p, id, oks.every(Boolean), now); });
    const own = L.q.filter((x) => !x.rev), all = L.kind === 'review' ? L.q : own;
    const score = all.length ? all.filter((x) => x.ans).length / all.length : 0;
    if (L.kind === 'lesson') recordLesson(p, L.id, score, now);
    L.done = { score };
    if (L.kind === 'lesson' && ctx.studyOffer) ctx.studyOffer('ear'); // программа на главной — один раз
  }
  ctx.saveData();
  render();
}

function lessonResult() {
  const { t } = ctx, nx = nextLesson(EAR_COURSE, prog()), ch = L.id ? chapterOf(EAR_COURSE, L.id) : null;
  return '<div class="ewrap">' + resultHTML({ t, esc, name: L.kind === 'review' ? t('crs.review') : lname(L.id), score: L.done.score ?? 1, next: nx && nx.id, nextName: nx ? lname(nx.id) : '',
    book: ch && ch.book, placement: L.done.placement }) + '</div>';
}

function stopLesson() {
  clearTimers(); micStop();
  L = null;
  const e = normalizeEar(ctx.store.all());
  e.sec = 'home'; e.view = 'course';
  ctx.store.save();
  render();
}

/* ---------- главный экран ---------- */

function miniRing(p, col) {
  const r = 15, C = 2 * Math.PI * r;
  return '<svg viewBox="0 0 36 36" class="mring2" aria-hidden="true"><circle cx="18" cy="18" r="' + r + '" stroke="var(--fill)"/><circle cx="18" cy="18" r="' + r +
    '" stroke="' + col + '" stroke-dasharray="' + C * p + ' ' + C + '" transform="rotate(-90 18 18)"/></svg>';
}

const weekDays = () => Array.from({ length: 7 }, (_, i) => dayKey(Date.now() - (6 - i) * DAY));
function weekOf(E, keys) { let c = 0, t = 0; keys.forEach((k) => { const d = E.days[k]; if (d) { c += d.c; t += d.t; } }); return { c, t }; }

function homeHTML() {
  const { t, tn, ui } = ctx, e = EC(), E = EST(), view = e.view === 'course' ? 'course' : 'free';
  const top = '<div class="ehtop">' + modeSeg(t, view) + '</div>';
  if (view === 'course') {
    return '<div class="ewrap ehome">' + top + courseHTML({ course: EAR_COURSE, p: prog(), t, esc, title: lname, chTitle: cname, now: Date.now() }) + '</div>';
  }
  // неделя: ответы, точность и столбики по дням — без цели на день и без серий
  const days = weekDays(), w = weekOf(E, days), mx = Math.max(1, ...days.map((k) => (E.days[k] || { t: 0 }).t));
  const bars = '<div class="ewbars" aria-hidden="true">' + days.map((k) => { const d = E.days[k] || { c: 0, t: 0 }; return '<i style="--h:' + (d.t / mx) + ';--q:' + (d.t ? d.c / d.t : 0) + '"></i>'; }).join('') + '</div>';
  return '<div class="ewrap ehome">' + top + '<div class="edash"><div class="edtxt"><div class="l2" style="font-size:14px">' + t('week') + '</div><div class="big num">' + w.t + ' <small class="l2">' + tn('answersN', w.t) +
    '</small></div><div class="l2" style="font-size:14px">' + (w.t ? t('accWeek', { p: Math.round((w.c / w.t) * 100) }) : t('noAnswers')) + '</div></div>' + bars +
    '<div class="edbtns">' + ui.icb('data-x="estats"', I.stats, t('statsBtn'), 'sm') + '</div></div>' +
    '<div class="edgrid">' + DRILLS.map(([id, c]) => {
      const a = accuracy(E, id);
      return '<button class="edcard" data-x="esec" data-v="' + id + '" style="--c:' + c + '"><span class="edic">' + DICON[id] + '</span><span class="edr">' + miniRing(a.p, c) +
        '<b class="num">' + (a.t ? Math.round(a.p * 100) + '%' : '') + '</b></span><span class="edn">' + t('sec.' + id) + '</span><span class="eds">' + t('sub.' + id) + '</span></button>';
    }).join('') + '</div></div>';
}

/* ---------- упражнение ---------- */

// Клавиатура с отметками (верно/ошибка) для диктанта
function ekbHTML(m0, nw, marks) {
  let ws = '', bs = '', wi = 0, m = m0;
  while (wi < nw) {
    const pc = m % 12, mk = marks && marks[pc] ? ' ' + marks[pc] : '';
    if (MAJI.includes(pc)) { ws += '<div class="w' + mk + '" data-m="' + m + '" role="button" tabindex="0" aria-label="' + SH[pc] + '"><span>' + SH[pc] + '</span></div>'; wi++; }
    else if (wi > 0) bs += '<div class="b' + mk + '" data-m="' + m + '" role="button" tabindex="0" aria-label="' + SH[pc] + '" style="left:' + (wi * 100) / nw + '%"></div>';
    m++;
  }
  return '<div class="kbwrap ekb"><div class="kb" style="--n:' + nw + '">' + ws + bs + '</div></div>';
}

// Клавиатура абсолютного слуха: ноты вне набора приглушены, по желанию — цвета нот
function ntKB(mk) {
  const e = EC(), set = new Set(ntSet(e));
  let ws = '', bs = '', wi = 0;
  for (let m = 60; wi < 7; m++) {
    const pc = m % 12, cls = (mk && mk[pc] ? ' ' + mk[pc] : '') + (set.has(pc) ? '' : ' off'), col = e.ntColors ? ' style="--nc:' + NT_COLORS[pc] + '"' : '';
    if (MAJI.includes(pc)) {
      ws += '<div class="w' + cls + (e.ntColors ? ' col' : '') + '" data-m="' + m + '"' + col + ' role="button" tabindex="0" aria-label="' + SH[pc] + '"><span>' + SH[pc] + '</span></div>';
      wi++;
    } else {
      bs += '<div class="b' + cls + (e.ntColors ? ' col' : '') + '" data-m="' + m + '" role="button" tabindex="0" aria-label="' + SH[pc] + '" style="left:' + (wi * 100) / 7 + '%' +
        (e.ntColors ? ';--nc:' + NT_COLORS[pc] : '') + '"></div>';
    }
  }
  return '<div class="kbwrap ekb ntkb"><div class="kb" style="--n:7">' + ws + bs + '</div></div>';
}

function drillHTML(sec) {
  const { t, tn, ui } = ctx, e = EC(), [, color] = drill(sec), q = EAR.q[sec] || gen(sec), res = EAR.res[sec], ss = EAR.sess[sec] || { c: 0, t: 0, st: 0 };
  const head = L ? lessonBarHTML({ t, esc, name: L.kind === 'place' ? t('crs.place') : L.kind === 'review' ? t('crs.review') : lname(L.id), i: L.i, n: L.q.length, review: L.kind === 'lesson' && L.q[L.i].rev }) :
    '<div class="ehead" style="--c:' + color + '"><button class="mlback" data-x="esec" data-v="home" aria-label="' + t('backAria') + '">' + t('back') + '</button><b class="ehn">' +
    t('sec.' + sec) + '</b><span class="estat num" aria-label="' + t('sessCorrect', { c: ss.c, t: ss.t }) + '"><b>' + ss.c + '</b>/' + ss.t + '</span>' + ui.icb('data-x="eset"', ui.icons.gear, t('settings'), 'sm') + '</div>';
  const lvl = L ? '' : t('lvl.' + e.level);
  const playBtn = (lab) => '<button class="eplay" id="eplay" data-x="eplay" aria-label="' + (lab || t('replay')) + '" style="--c:' + color + '">' + (sec === 'pt' ? I.speaker : I.play) + '<i></i><i></i></button>';
  // «Дальше» — всегда после ответа: сравнение вариантов на слух отменяет автопереход (на телефоне упражнение застревало)
  const next = res ? '<button class="btn fill block enext" data-x="enext">' + t('next') + '</button>' : '';
  const fb = () => (res ? '<div class="efb ' + (res.ok ? 'ok' : 'bad') + '" aria-live="polite">' + t(res.ok ? 'right' : 'answer') + '<b>' + esc(label(sec, q.ans)) + '</b>' +
    (sec === 'dg' && q.m != null ? ' — ' + spell((q.minor ? MIN_NAMES : MAJ_NAMES)[q.pc], [q.ans], [EDG.find((d) => d[0] === q.ans)[3]])[0] : '') + '</div>' : '<div class="efb" aria-live="polite"></div>');

  if (sec === 'pt') {
    return '<div class="ewrap">' + head + '<div class="ecard pt" style="--c:' + color + '"><div class="eq2">' + t('rng.' + e.rng) + (e.oct ? t('anyOct') : '') + '</div><div class="etarget num">' +
      (res || EAR.reveal ? mName(q.m) : '?') + '</div>' + playBtn(t('playNote')) +
      '<div class="emeter" aria-hidden="true"><i class="ezone"></i><i class="ecenter"></i><i id="eneedle" class="eneedle"></i></div><div class="ehold" aria-hidden="true"><b id="ehold"></b></div>' +
      '<div class="evals"><span id="ehint" aria-live="polite">' + (res ? t('hit') : t(mic ? 'sing' : 'micOff')) + '</span><span id="ecents" class="num"></span></div>' +
      (res ? '<div class="efb ok">' + t('hitNote', { note: mName(q.m) }) + '</div>' : '') + '</div>' +
      '<div class="ebtns"><button class="btn ebtn" data-x="eskip">' + t(res ? 'next' : 'skip') + '</button><button class="bigplay" data-x="tmic" aria-pressed="' + !!mic + '" aria-label="' +
      t(mic ? 'micStop' : 'micOn') + '">' + (mic ? I.stop : ctx.ui.icons.mic) + '</button><button class="btn ebtn" data-x="ereveal">' + t(EAR.reveal ? 'hide' : 'show') + '</button></div></div>';
  }

  const prompts = {
    iv: [t('q.iv'), t('dir.' + q.dir)], ch: [t('q.ch'), t(e.arp ? 'p.arp' : 'p.chord')], sc: [t('q.sc'), t(e.scDir === 'both' ? 'p.both' : 'p.up')],
    dg: [t(q.chord ? 'q.dgch' : q.degs ? 'q.dgchain' : 'q.dg'), q.mode && q.mode !== 'major' && q.mode !== 'minor' ? t('p.dgMode', { mode: t('md.' + q.mode) }) : t('p.dg')], nt: [t('q.nt'), t('p.nt', { range: t(e.ntRange === '1' ? 'oct1' : 'oct3'), timbre: t(e.ntTimbre === 'mix' ? 'tim.mix' : 'tim.piano') })],
    dc: [t('q.dc'), t('p.dc')],
  };
  const [pq, ps] = prompts[sec];
  const card = '<div class="ecard" style="--c:' + color + '">' + playBtn() + '<div class="eq1">' + pq + '</div><div class="eq2">' + ps + (lvl ? ' · ' + lvl : '') +
    (sec === 'dg' && res ? ' · ' + (q.mode && q.mode !== 'major' && q.mode !== 'minor' ? MAJ_NAMES[q.pc] + ' ' + t('md.' + q.mode) : t(q.minor ? 'key.min' : 'key.maj', { root: (q.minor ? MIN_NAMES : MAJ_NAMES)[q.pc] })) : '') + '</div>' + (sec === 'dc' ? '' : fb()) + '</div>';

  if (sec === 'nt') {
    const mk = {};
    if (res) { mk[q.ans] = 'eok'; if (!res.ok) mk[+res.picked] = 'ebad'; }
    const set = ntSet(e), hist = e.ntHist || [];
    return '<div class="ewrap">' + head + card + '<div class="ntinfo"><span>' + (e.ntMode !== 'custom' ? t('ntProg', { n: set.length, k: Math.max(0, NT_GOAL - hist.reduce((a, b) => a + b, 0)) })
      : tn('ntCustom', set.length)) + '</span><span class="ntlearn" id="ntlearn" aria-live="polite"></span><button class="btn sm" data-x="ntlearn">' + t('ntLearn') + '</button></div>' +
      // до ответа клавиши можно послушать: «Слушать» — нажатие только звучит, «Ответить» — нажатие засчитывается
      (res ? '' : '<div class="ntmode">' + ui.seg('ntlisten', [['listen', t('ntListen')], ['answer', t('ntAnswer')]], EAR.listen ? 'listen' : 'answer', t('ntListen')) + '</div>') +
      '<div class="ekeys">' + ntKB(mk) + '</div>' + next + '</div>';
  }
  if (sec === 'dc') {
    const slots = q.notes.map((m, i) => {
      const got = i === 0 ? m : q.prog[i - 1], ok = i === 0 || (got != null && got % 12 === m % 12);
      return '<span class="eslot' + (i === 0 ? ' given' : got != null ? (ok ? ' ok' : ' bad') : '') + '">' + (i === 0 || got != null ? SH[(got != null ? got : m) % 12] : '?') +
        (res && !res.ok && i > 0 ? '<small>' + SH[m % 12] + '</small>' : '') + '</span>';
    }).join('');
    return '<div class="ewrap">' + head + card + '<div class="eslots">' + slots + '</div><div class="efb ' + (res ? (res.ok ? 'ok' : 'bad') : '') + '" style="text-align:center" aria-live="polite">' +
      (res ? t(res.ok ? 'dcOk' : 'dcBad') : '') + '</div><div class="ekeys">' + ekbHTML(60, 8, null) + '</div>' + next + '</div>';
  }

  let opts = [];
  if (sec === 'iv') opts = EIV.filter((i) => e.ivSet.includes(i)).map((i) => [i, t('ivs.' + i), t('iv.' + i)]);
  else if (sec === 'ch') opts = ECH.filter((c) => e.chSet.includes(c[0])).map((c) => [c[0], c[1] || 'maj', t('ch.' + c[0])]);
  else if (sec === 'sc') opts = e.scSet.filter((k) => SCALES[k]).map((k) => [k, label('sc', k), '']);
  else if (sec === 'dg' && q.chord) { const sc = dgScale(q.mode); opts = [0, 1, 2, 3, 4, 5, 6].map((d) => [romanOf(sc, d), romanOf(sc, d), d === 0 ? t('fn.tonic') : d === 3 ? t('fn.subdom') : d === 4 ? t('fn.dom') : '']); }
  else if (sec === 'dg') opts = EDG.filter((d) => e.dgSet.includes(d[0])).map((d) => [d[0], d[1], d[2] ? t('fn.' + d[2]) : '']);
  // цепочка ступеней: ячейки ответов над кнопками — «?» до ответа, затем верно/ошибка с подсказкой
  const chain = sec === 'dg' && q.degs ? '<div class="eslots">' + q.degs.map((d, i) => { const got = res ? res.picked.split(',')[i] : EAR.chain[i], ok = got != null && String(got) === String(d), dl = (k) => (EDG.find((x) => x[0] === +k) || [0, k])[1];
    return '<span class="eslot' + (got != null ? (ok ? ' ok' : ' bad') : i === EAR.chain.length && !res ? ' cur' : '') + '">' + (got != null ? dl(got) : '?') + (res && !ok ? '<small>' + dl(d) + '</small>' : '') + '</span>'; }).join('') + '</div>' : '';
  const cols = sec === 'sc' ? 2 : opts.length <= 4 ? 2 : opts.length <= 9 ? 3 : 4;
  return '<div class="ewrap">' + head + card + chain + '<div class="egrid' + (sec === 'sc' ? ' esc' : '') + (opts.length <= 4 ? ' few' : '') + '" style="--cols:' + cols + ';--c:' + color + '">' + opts.map(([v, s, l]) => {
    const st = res ? (String(v) === String(q.ans) ? ' ok' : res.picked === String(v) ? ' bad' : ' dim') : '';
    return '<button class="eopt' + st + '" data-x="eans" data-v="' + v + '" aria-label="' + esc(l || s) + '"><b>' + esc(s) + '</b>' + (l ? '<small>' + esc(l) + '</small>' : '') + '</button>';
  }).join('') + '</div>' + next + (res ? '<p class="ftr" style="text-align:center;margin-top:2px">' + t('compare') + '</p>' : '') + '</div>';
}

function render() {
  if (!host) return;
  const sec = EC().sec;
  host.innerHTML = L && L.done ? lessonResult() : L ? drillHTML(L.cur.sec) : sec === 'home' || !drill(sec) ? homeHTML() : drillHTML(sec);
}

/* ---------- шторки ---------- */

function settingsSheet() {
  const { t, ui } = ctx, e = EC();
  const seg = (attr, list, cur, lab) => '<div class="seg" role="group" aria-label="' + lab + '">' + list.map(([k, n]) => '<button data-' + attr + '="' + k + '" aria-pressed="' + (cur === k) + '">' + n + '</button>').join('') + '</div>';
  const items = (sec) => (sec === 'sc' ? LEVELS.sc.hard.map((k) => [k, label('sc', k)]) : sec === 'nt' ? LEVELS.nt.hard.map((pc) => [pc, SH[pc]])
    : sec === 'iv' ? EIV.map((i) => [i, t('ivs.' + i) + ' · ' + t('iv.' + i)]) : sec === 'ch' ? ECH.map((c) => [c[0], (c[1] || 'maj') + ' · ' + t('ch.' + c[0])])
      : EDG.map((d) => [d[0], d[1] + (d[2] ? ' · ' + t('fn.' + d[2]) : '')]));
  const body = () => {
    const sec = e.sec, setK = sec + 'Set';
    return ui.snav(t('set.title')) +
      '<div class="hdr" style="margin-top:4px">' + t('set.level') + '</div><div class="group"><div class="cellcol">' + seg('lv', ['easy', 'mid', 'hard'].map((k) => [k, t('lv.' + k)]), e.level, t('set.level')) + (e.level === 'custom' ? '<div class="segcap">' + t('lv.customNow') + '</div>' : '') + '</div></div>' +
      (sec === 'iv' ? '<div class="hdr">' + t('set.dir') + '</div><div class="group"><div class="cellcol">' + seg('dir', ['up', 'down', 'harm', 'mix'].map((k) => [k, t('d.' + k)]), e.dir, t('set.dir')) + '</div></div>' : '') +
      (sec === 'ch' ? '<div class="group" style="margin-top:12px"><div class="cell"><span class="grow">' + t('set.arp') + '</span>' + ui.sw('earp', e.arp, t('set.arp')) + '</div></div>' : '') +
      (sec === 'dg' ? '<div class="hdr">' + t('set.kind') + '</div><div class="group"><div class="cellcol">' + seg('kd', DG_KINDS.map((k) => [k, t('kd.' + k)]), e.dgKind, t('set.kind')) + '</div></div><p class="ftr">' + t('ftr.kind') + '</p>' +
        '<div class="hdr">' + t('set.mode') + '</div><div class="group"><div class="cellcol">' + seg('md', DG_MODES.slice(0, 3).map((k) => [k, t('md.' + k)]), e.mode, t('set.mode')) + '</div><div class="cellcol">' + seg('md', DG_MODES.slice(3).map((k) => [k, t('md.' + k)]), e.mode, t('set.mode')) + '</div></div>' : '') +
      (sec === 'pt' ? '<div class="hdr">' + t('set.range') + '</div><div class="group">' + Object.entries(RANGES).map(([k, v]) => '<button class="cell" data-rg="' + k + '" aria-pressed="' + (e.rng === k) +
        '"><span class="grow">' + t('rng.' + k) + '</span><span class="val">' + mName(v[0]) + '–' + mName(v[1]) + '</span>' + (e.rng === k ? ui.icons.check : '') + '</button>').join('') +
        '</div><div class="group" style="margin-top:12px"><div class="cell"><span class="grow">' + t('set.anyOct') + '</span>' + ui.sw('eoct', e.oct, t('set.anyOctShort')) + '</div></div>' : '') +
      (sec === 'nt' ? '<div class="hdr">' + t('set.method') + '</div><div class="group"><div class="cellcol">' + seg('ntm', [['prog', t('m.prog')], ['custom', t('m.custom')]], e.ntMode, t('set.method')) +
        '</div></div><p class="ftr">' + (e.ntMode === 'prog' ? t('ftr.prog', { n: ntSet(e).length }) : t('ftr.custom')) + '</p>' +
        '<div class="hdr">' + t('set.rt') + '</div><div class="group"><div class="cellcol">' + seg('ntr', [['1', t('oct1')], ['3', t('oct3')]], e.ntRange, t('set.rt')) + '</div><div class="cellcol">' +
        seg('ntt', [['piano', t('t.piano')], ['mix', t('t.mix')]], e.ntTimbre, t('set.rt')) + '</div></div><p class="ftr">' + t('ftr.timbre') + '</p>' +
        '<div class="group"><div class="cell"><span class="grow">' + t('set.mask') + '</span>' + ui.sw('ntmask', e.ntMask, t('set.maskShort')) + '</div><div class="cell"><span class="grow">' +
        t('set.colors') + '</span>' + ui.sw('ntcol', e.ntColors, t('set.colorsShort')) + '</div></div><p class="ftr">' + t('ftr.mask') + '</p>' +
        (e.ntMode === 'prog' ? '<div class="group" style="margin-top:12px"><button class="cell danger center" data-ntreset>' + t('set.restart') + '</button></div>' : '') : '') +
      (sec === 'sc' ? '<div class="hdr">' + t('set.play') + '</div><div class="group"><div class="cellcol">' + seg('sd', [['up', t('sd.up')], ['both', t('sd.both')]], e.scDir, t('set.play')) + '</div></div>' : '') +
      (sec !== 'pt' && sec !== 'dc' && !(sec === 'nt' && e.ntMode !== 'custom') ? '<div class="hdr">' + t('set.set') + '</div><div class="group"><div class="cellcol"><div class="pickrow">' +
        items(sec).map(([v, l]) => '<button type="button" class="lchip pick' + (e[setK].map(String).includes(String(v)) ? ' on' : '') + '" data-it="' + v + '" aria-pressed="' +
          e[setK].map(String).includes(String(v)) + '" style="--c:var(--tint);--t:var(--on-tint)">' + esc(l) + '</button>').join('') + '</div></div></div><p class="ftr">' + t('ftr.set') + '</p>' : '') +
      // звучание — для всех упражнений
      '<div class="hdr">' + t('set.sound') + '</div><div class="group"><div class="cellcol">' + seg('tempo', Object.keys(TEMPOS).map((k) => [k, t('tempo.' + k)]), e.tempo, t('set.tempo')) +
      '</div><div class="cellcol"><div class="pickrow">' + EAR_TIMBRES.map((k) => '<button type="button" class="lchip pick' + (e.timbre === k ? ' on' : '') + '" data-tim="' + k + '" aria-pressed="' + (e.timbre === k) +
        '" style="--c:var(--tint);--t:var(--on-tint)">' + t('tim2.' + k) + '</button>').join('') + '</div></div></div>' + (sec === 'nt' ? '<p class="ftr">' + t('ftr.timbreNt') + '</p>' : '') +
      (sec === 'nt' ? '<div class="group" style="margin-top:12px"><div class="cell"><span class="grow">' + t('set.listen') + '</span>' + ui.sw('elisten', e.listen, t('set.listen')) + '</div></div>' : '') +
      '<div class="group" style="margin-top:12px"><div class="cell"><span class="grow">' + t('set.auto') + '</span>' + ui.sw('eauto', e.auto, t('set.autoShort')) + '</div></div>';
  };
  ui.sheet(body, (el, sh) => {
    const re = () => { ctx.store.save(); sh.update(); gen(e.sec); render(); };
    el.addEventListener('click', (ev) => {
      const g = (s) => ev.target.closest(s);
      let b;
      if ((b = g('[data-lv]'))) setLevel(e, b.dataset.lv);
      else if ((b = g('[data-dir]'))) e.dir = b.dataset.dir;
      else if ((b = g('[data-ntm]'))) e.ntMode = b.dataset.ntm;
      else if ((b = g('[data-ntr]'))) e.ntRange = b.dataset.ntr;
      else if ((b = g('[data-ntt]'))) e.ntTimbre = b.dataset.ntt;
      else if (g('[data-ntreset]')) { e.ntLvl = 0; e.ntHist = []; ui.toast(t('restarted')); }
      else if ((b = g('[data-sd]'))) e.scDir = b.dataset.sd;
      else if ((b = g('[data-md]'))) e.mode = b.dataset.md;
      else if ((b = g('[data-kd]'))) e.dgKind = b.dataset.kd;
      else if ((b = g('[data-rg]'))) e.rng = b.dataset.rg;
      else if ((b = g('[data-tempo]'))) e.tempo = b.dataset.tempo;
      else if ((b = g('[data-tim]'))) e.timbre = b.dataset.tim;
      else if ((b = g('[data-it]'))) { if (!toggleInSet(e, e.sec, b.dataset.it)) { ui.toast(t('needTwo')); return; } }
      else return;
      re();
    });
    el.addEventListener('change', (ev) => {
      const k = ev.target.dataset.sw, v = ev.target.checked;
      const map = { earp: 'arp', eauto: 'auto', eoct: 'oct', ntmask: 'ntMask', ntcol: 'ntColors', elisten: 'listen' };
      if (!map[k]) return;
      e[map[k]] = v;
      re();
    });
  });
}

function statsSheet() {
  const { t, ui } = ctx, E = EST();
  const days = Object.entries(E.days).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7);
  const tc = days.reduce((s, [, v]) => s + v.c, 0), tt = days.reduce((s, [, v]) => s + v.t, 0);
  const best = Math.max(0, ...Object.values(EAR.sess).map((s) => s.best || 0));
  const sect = (sec) => {
    const arr = Object.entries(E.stats[sec] || {}).map(([k, v]) => ({ k, v })).sort((a, b) => a.v.c / a.v.t - b.v.c / b.v.t);
    if (!arr.length) return '';
    return '<div class="card"><div class="ch"><span>' + t('sec.' + sec) + '</span><span>' + t('st.weak') + '</span></div>' + arr.map(({ k, v }) => {
      const p = Math.round((v.c / v.t) * 100);
      return '<div class="hrow"><span class="n">' + esc(sec === 'pt' ? k : label(sec, k)) + '</span><span class="hb"><i style="width:' + p + '%;background:' +
        (p >= 80 ? '#34C759' : p >= 50 ? 'var(--tint)' : '#FF3B30') + '"></i></span><span class="num l2" style="font-size:13px">' + p + '% · ' + v.t + '</span></div>';
    }).join('') + '</div>';
  };
  const conf = Object.entries(E.ntc || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  // часто путается: пары «верный → выбранный» по всем упражнениям
  const cfs = Object.entries(E.cf || {}).flatMap(([sec, m]) => Object.entries(m).map(([k, n]) => { const [a, b] = k.split('>'); return { sec, a, b, n }; }))
    .filter((x) => x.n >= 2).sort((x, y) => y.n - x.n).slice(0, 6);
  // точность по неделям: четыре последние недели
  const weeks = [3, 2, 1, 0].map((w) => weekOf(E, Array.from({ length: 7 }, (_, i) => dayKey(Date.now() - (w * 7 + i) * DAY))));
  ui.sheet(() => ui.snav(t('st.title')) +
    '<div class="tiles num"><div class="tile"><b>' + tt + '</b><span>' + t('st.week') + '</span></div><div class="tile"><b>' + (tt ? Math.round((tc / tt) * 100) + '%' : '—') +
    '</b><span>' + t('st.acc') + '</span></div><div class="tile"><b>' + best + '</b><span>' + t('st.best') + '</span></div></div>' +
    (weeks.some((w) => w.t) ? '<div class="card"><div class="ch"><span>' + t('st.weeks') + '</span><span></span></div><div class="ewk">' + weeks.map((w, i) =>
      '<div><b class="num">' + (w.t ? Math.round((w.c / w.t) * 100) + '%' : '—') + '</b><span>' + t(i === 3 ? 'st.thisWeek' : 'st.weeksAgo', { n: 3 - i }) + '</span></div>').join('') + '</div></div>' : '') +
    (cfs.length ? '<div class="card"><div class="ch"><span>' + t('st.mixups') + '</span><span></span></div>' + cfs.map((x) => '<div class="hrow"><span class="n">' + esc(label(x.sec, x.a)) + ' → ' + esc(label(x.sec, x.b)) +
      '</span><span class="hb"></span><span class="num l2" style="font-size:13px">' + x.n + '×</span></div>').join('') + '</div>' : '') +
    DRILLS.map((d) => sect(d[0])).join('') +
    (conf.length ? '<div class="card"><div class="ch"><span>' + t('st.confused') + '</span><span>' + t('st.notes') + '</span></div>' + conf.map(([k, v]) => '<div class="hrow"><span class="n">' + esc(k) +
      '</span><span class="hb"></span><span class="num l2" style="font-size:13px">' + v + '×</span></div>').join('') + '</div>' : '') +
    '<p class="ftr">' + t('st.ftr') + '</p>');
}

// Послушать все ноты набора по очереди с подсветкой клавиш
function ntLearn() {
  const e = EC(), set = ntSet(e).slice().sort(() => Math.random() - 0.5);
  clearTimers();
  set.forEach((pc, i) => at(i * 1500, () => {
    const opts = [48, 60, 72].map((b) => b + pc).filter((x) => (e.ntRange === '1' ? x >= 60 && x < 72 : true));
    note(opts[Math.floor(Math.random() * opts.length)], 1, e.ntTimbre === 'mix' ? NT_TIMBRES[Math.floor(Math.random() * NT_TIMBRES.length)] : 'piano');
    host.querySelectorAll('.ekb [data-m]').forEach((k) => k.classList.toggle('learn', +k.dataset.m % 12 === pc));
    const lt = host.querySelector('#ntlearn');
    if (lt) lt.textContent = SH[pc];
  }));
  at(set.length * 1500 + 300, () => {
    if (!host) return;
    host.querySelectorAll('.ekb .learn').forEach((k) => k.classList.remove('learn'));
    const lt = host.querySelector('#ntlearn');
    if (lt) lt.textContent = '';
  });
}

/* ---------- жесты ---------- */

function act(a, el) {
  const e = EC(), sec = e.sec;
  switch (a) {
    case 'esec': e.sec = el.dataset.v; ctx.store.save(); clearTimers(); if (e.sec !== 'pt') micStop(); render(); break;
    case 'eplay': if (!EAR.q[sec]) gen(sec); play(sec); break;
    case 'eans': answer(sec, el.dataset.v); render(); break;
    case 'enext': if (L) { advance(); break; } gen(sec); render(); at(150, () => play(sec)); break;
    case 'eskip':
      if (!EAR.res.pt && EAR.q.pt) { rec('pt', mName(EAR.q.pt.m).replace(/\d/, ''), false); lt(false); }
      if (L) { advance(); break; }
      EAR.reveal = false; gen('pt'); render(); at(150, () => play('pt'));
      break;
    case 'lgo': startLesson(el.dataset.v); break;
    case 'lagain': if (L && L.kind === 'lesson') startLesson(L.id); else if (L && L.kind === 'review') startReview(); break;
    case 'lhome': stopLesson(); break;
    case 'lplace': startPlacement(); break;
    case 'lskip': { const p = prog(); p.pl = -1; ctx.saveData(); render(); break; }
    case 'lrev': startReview(); break;
    case 'lbook': ctx.openIn('book', { book: { ch: el.dataset.v, sec: 'school' } }); break;
    case 'ereveal': EAR.reveal = !EAR.reveal; render(); break;
    case 'tmic': if (mic) { micStop(); render(); } else micStart(); break;
    case 'eset': settingsSheet(); break;
    case 'estats': statsSheet(); break;
    case 'ntlearn': ntLearn(); break;
  }
}

function bind() {
  onClick = (ev) => {
    const k = ev.target.closest('.ekb [data-m]');
    if (k) { const sec = EC().sec; if (sec === 'nt') { if (!EAR.listen) ntAnswer(+k.dataset.m); } else if (sec === 'dc') dcKey(+k.dataset.m); return; }
    const md = ev.target.closest('[data-seg="xmode"] [data-v]');
    if (md) { const e = normalizeEar(ctx.store.all()); e.view = md.dataset.v; ctx.store.save(); render(); return; }
    const lb = ev.target.closest('[data-seg="ntlisten"] [data-v]');
    if (lb) { EAR.listen = lb.dataset.v === 'listen'; render(); return; }
    const x = ev.target.closest('[data-x]');
    if (x) act(x.dataset.x, x);
  };
  // Нажатая клавиша звучит (как в прототипе)
  onDown = (ev) => {
    const k = ev.target.closest('.ekb [data-m]');
    if (!k) return;
    ctx.audio.unlock();
    ctx.audio.playNote(+k.dataset.m, { bus: 'piano', dur: 0.5 });
  };
  host.addEventListener('click', onClick);
  host.addEventListener('pointerdown', onDown);
  // «Ступени»: смахивание по карточке или кнопкам влево — следующий вид вопроса (нота → аккорд → цепочка), вправо — предыдущий
  const kindStep = (d) => { const e = EC(); if (L || e.sec !== 'dg') return; const i = DG_KINDS.indexOf(e.dgKind); e.dgKind = DG_KINDS[(i + d + DG_KINDS.length) % DG_KINDS.length]; ctx.store.save(); clearTimers(); gen('dg'); render(); ctx.ui.toast(ctx.t('kd.' + e.dgKind)); };
  unswipe = swipe(host, { left: () => kindStep(1), right: () => kindStep(-1), ok: (ev) => EC().sec === 'dg' && !!ev.target.closest('.ecard, .egrid, .eslots') });
}

export default {
  ...meta,
  status(c) {
    const E = normalizeEarData(c.data()), w = weekOf(E, Array.from({ length: 7 }, (_, i) => dayKey(Date.now() - i * DAY)));
    return w.t ? c.tn('statusWeek', w.t, { p: Math.round((w.c / w.t) * 100) }) : c.t('statusIdle');
  },
  mount(el, c, sz = 'full') {
    host = el; ctx = c; size = sz;
    render();
    bind();
  },
  resize(sz) { size = sz; render(); },
  unmount() {
    clearTimers();
    micStop();
    L = null;
    if (host) { host.removeEventListener('click', onClick); host.removeEventListener('pointerdown', onDown); }
    if (unswipe) { unswipe(); unswipe = null; }
    host = null;
  },
};
