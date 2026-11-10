// Теория: квинтовый круг, гаммы, аккорды, интервалы; гриф и клавиши; дрон на тонике и подсветка на пианино.
// Перенесено из legacy/practice.html (theoryHTML, circleHTML, circleSVG, scalesHTML, chordsHTML, intervalsHTML, fretHTML, typeSheet).
import './theory.css';
import ru from './i18n/ru.json';
import uz from './i18n/uz.json';
import en from './i18n/en.json';
import el from './i18n/el.json';
import { SH, FL, MAJ_NAMES, MIN_NAMES, enh } from '../../music/notes.js';
import { CIRC, keyInfo, circleStep, SCALES, SCALE_TYPES, scaleInfo, CHORDS, chordLabel, chordInfo, INTERVALS, intervalNote, intervalBase } from '../../music/theory.js';
import { curTuning } from '../../music/tuning.js';
import { kbHTML } from '../../ui/keyboard.js';
import { chordsOf, familiesOf, ladderOf, degreesOf, colorNote, familyOfType, parentOf, rotateMode, modeChords, onFifths, FIFTHS, FAMILIES, LADDER } from '../../music/identify.js';
import { chroma } from '../../music/analyze.js';
import { keyShift, keyTo, diatonic, transposeLine, capoOptions } from '../../music/keycalc.js';
import { tonicName, keyLabel } from '../../music/transpose.js';
import { chromaSVG, chordSteps } from '../../ui/chroma.js';

import meta, { ICON } from './meta.js';
const SECS = ['circle', 'scales', 'chords', 'keys', 'intervals'];
// Определитель — выключен по умолчанию везде, включается в «Модулях и функциях» (слово автора 06.11.2026: вкладка
// портит вид; settings.theory.find)
const findOn = () => ctx.data().find === true;
const secs = () => (findOn() ? [...SECS, 'find'] : SECS);
const curSec = () => { const s = TH().sec || 'circle'; return secs().includes(s) ? s : 'circle'; }; // «Учебник» и «Джаз» теперь — отдельный инструмент
const I = {
  play: '<svg viewBox="0 0 24 24" class="f" style="width:18px"><path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.3-7.2c.6-.4.6-1.4 0-1.8L8.6 3.9C7.9 3.5 7 4 7 4.8z"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M3 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0"/></svg>',
  piano: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M13 5v14M10.5 5v8M15.5 5v8"/></svg>',
  drone: '<svg viewBox="0 0 24 24"><path d="M3 12h3l2-5 3 10 3-8 2 5 2-2h3"/></svg>',
  scales: '<svg viewBox="0 0 24 24"><path d="M4 19h4v-4h4v-4h4V7h4"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  fret: '<svg viewBox="0 0 24 24"><path d="M3 6h18M3 10h18M3 14h18M3 18h18M8 4v16M14 4v16"/></svg>',
};

/* ---------- учебник — отдельный инструмент «Учебник» (src/modules/book) ---------- */

// Ссылка из раздела в главу учебника (если «Учебник» включён)
const BOOKI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5v13c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z"/><path d="M12 6v13.5"/></svg>';
const bookLink = (ch) => !ctx.hasTool('book') ? '' : '<button class="bklink" data-x="bookgo" data-v="' + ch + '">' + BOOKI + '<span>' + ctx.t('bookMore') + '</span><b>›</b></button>';

let host = null, ctx = null, size = 'full', onClick = null, onKey = null, onDown = null, onInput = null, lis = null;

// Настройки: device.theory (+ scale: тоника и тип гаммы)
function TH() {
  const th = ctx.store.all();
  th.pc ??= 0; th.minor ??= false; th.sev ??= false;
  th.scale ??= { pc: 9, type: 'minor' };
  return th;
}
const keyTitle = (k) => ctx.t(k.minor ? 'key.min' : 'key.maj', { root: k.root });
const sigText = (k) => (k.sharps ? ctx.tn('sharps', k.sharps) : k.flats ? ctx.tn('flats', k.flats) : ctx.t('noSigns'));
const stepTxt = (s) => (s <= 3 ? ctx.t('step.' + s) : ctx.t('step.n', { n: s }));
const scaleName = (type) => ctx.t('scale.' + type);
const icb = (attrs, icon, label, cls) => ctx.ui.icb(attrs, icon, label, cls);

/* ---------- гриф ---------- */

function fretHTML(pcs, root, frets) {
  const tn = curTuning(ctx.peek('tuner'));
  let strings = tn && tn.midis.length >= 4 && tn.midis.length <= 8 ? tn.midis.slice() : [40, 45, 50, 55, 59, 64];
  strings = strings.slice().reverse();
  const S = strings.length, F = frets || 12, W = 40 + F * 44, H = S * 22 + 26, y = (i) => 14 + i * 22, x = (f) => (f === 0 ? 18 : 40 + (f - 0.5) * 44);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="fret" role="group" aria-label="' + ctx.t('fret') + '">';
  s += '<rect x="40" y="' + (y(0) - 1) + '" width="' + F * 44 + '" height="' + ((S - 1) * 22 + 2) + '" class="fbg"/>';
  [3, 5, 7, 9, 15].forEach((f) => { if (f <= F) s += '<circle cx="' + (40 + (f - 0.5) * 44) + '" cy="' + (y(0) + (S - 1) * 11) + '" r="4" class="fdot"/>'; });
  if (F >= 12) s += '<circle cx="' + (40 + 11.5 * 44) + '" cy="' + (y(0) + (S - 1) * 5.5) + '" r="4" class="fdot"/><circle cx="' + (40 + 11.5 * 44) + '" cy="' + (y(0) + (S - 1) * 16.5) + '" r="4" class="fdot"/>';
  for (let f = 0; f <= F; f++) s += '<line x1="' + (40 + f * 44) + '" y1="' + y(0) + '" x2="' + (40 + f * 44) + '" y2="' + y(S - 1) + '" class="' + (f === 0 ? 'fnut' : 'ffret') + '"/>';
  strings.forEach((m, i) => { s += '<line x1="40" y1="' + y(i) + '" x2="' + (40 + F * 44) + '" y2="' + y(i) + '" class="fstr" stroke-width="' + (0.8 + (i / (S - 1)) * 1.4).toFixed(2) + '"/>'; });
  strings.forEach((m, i) => {
    for (let f = 0; f <= F; f++) {
      const pc = (m + f) % 12;
      if (!pcs.has(pc)) continue;
      s += '<g class="fn' + (pc === root ? ' r' : '') + '" data-x="fplay" data-m="' + (m + f) + '" role="button" tabindex="0" aria-label="' + SH[pc] + '"><circle cx="' + x(f) + '" cy="' + y(i) +
        '" r="9"/><text x="' + x(f) + '" y="' + (y(i) + 3.4) + '" text-anchor="middle">' + SH[pc].replace('♯', '#') + '</text></g>';
    }
  });
  for (let f = 1; f <= F; f++) if ([3, 5, 7, 9, 12, 15].includes(f)) s += '<text x="' + (40 + (f - 0.5) * 44) + '" y="' + (H - 3) + '" text-anchor="middle" class="fnum">' + f + '</text>';
  return '<div class="fretwrap">' + s + '</svg></div>';
}

/* ---------- круг ---------- */

function circleSVG(k) {
  const th = TH(), cx = 160, cy = 160, sel = th.minor ? (th.pc + 3) % 12 : th.pc, sp = CIRC.indexOf(sel), { t } = ctx;
  const P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const arc = (r1, r2, a0, a1) => {
    const [x1, y1] = P(r1, a0), [x2, y2] = P(r1, a1), [x3, y3] = P(r2, a1), [x4, y4] = P(r2, a0);
    return 'M' + x1.toFixed(2) + ' ' + y1.toFixed(2) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + 'L' + x3.toFixed(2) + ' ' + y3.toFixed(2) +
      'A' + r2 + ' ' + r2 + ' 0 0 0 ' + x4.toFixed(2) + ' ' + y4.toFixed(2) + 'Z';
  };
  let s = '<svg viewBox="0 0 320 320" class="circle" role="group" aria-label="' + ctx.ui.esc(t('circleAria', { key: keyTitle(k) })) + '">';
  CIRC.forEach((mp, i) => {
    const a = ((i * 30 - 90) * Math.PI) / 180, a0 = a - Math.PI / 12 + 0.008, a1 = a + Math.PI / 12 - 0.008, near = i === (sp + 1) % 12 || i === (sp + 11) % 12;
    [[false, 156, 108, mp, i === 6 ? 'F♯/G♭' : MAJ_NAMES[mp], 17], [true, 106, 66, (mp + 9) % 12, MIN_NAMES[(mp + 9) % 12] + 'm', 13]].forEach(([mn, r1, r2, pc, lab, fs]) => {
      const isSel = i === sp && mn === th.minor, rel = i === sp && mn !== th.minor;
      const fill = isSel ? 'var(--tint)' : near || rel ? 'color-mix(in srgb,var(--tint) 24%,var(--cell))' : mn ? 'var(--fill)' : 'var(--cell)';
      const [tx, ty] = P((r1 + r2) / 2, a), aria = t(mn ? 'key.min' : 'key.maj', { root: mn ? lab.slice(0, -1) : lab });
      s += '<g class="sec" data-x="key" data-pc="' + pc + '" data-minor="' + (mn ? 1 : 0) + '" role="button" tabindex="0" aria-pressed="' + isSel + '" aria-label="' + aria +
        '"><path d="' + arc(r1, r2, a0, a1) + '" fill="' + fill + '"/><text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) +
        '" text-anchor="middle" dominant-baseline="central" style="font:' + (isSel ? 700 : 500) + ' ' + (i === 6 && !mn ? 12.5 : fs) + 'px var(--font);fill:' +
        (isSel ? 'var(--on-tint)' : 'var(--ink)') + '">' + lab + '</text></g>';
    });
  });
  return s + '<text x="160" y="150" text-anchor="middle" style="font:700 19px var(--font);fill:var(--ink)">' + keyTitle(k) +
    '</text><text x="160" y="174" text-anchor="middle" style="font:400 13px var(--font);fill:var(--l2)">' + sigText(k) + '</text></svg>';
}

/* ---------- транспонирование: из какой тональности в какую, аккорды по ступеням, своя строка, каподастр ---------- */

function KC() {
  const th = TH(), k = (th.kc ||= {});
  k.from ??= { pc: th.pc, minor: !!th.minor }; k.to ??= (k.from.pc + 2) % 12; k.text ??= '';
  return k;
}
function keysHTML() {
  const { t, ui } = ctx, k = KC(), from = { ...k.from, sharp: null }, n = keyShift(from, k.to), to = keyTo(from, k.to);
  const pills = (x, cur, minor) => '<div class="hscroll kcrow">' + Array.from({ length: 12 }, (_, pc) => '<button class="pill sm" data-x="' + x + '" data-v="' + pc + '" aria-pressed="' + (pc === cur) + '">' +
    tonicName(pc, minor) + (minor ? 'm' : '') + '</button>').join('') + '</div>';
  const A = diatonic(from), B = diatonic(to);
  const shift = n === 0 ? t('kc.same') : ctx.tn(n > 0 ? 'kc.up' : 'kc.down', Math.abs(n));
  const res = (txt) => (txt.trim() ? ui.esc(transposeLine(txt, from, n)) : '<span class="l2">' + t('kc.textHint') + '</span>');
  const capo = capoOptions(to);
  if (size === 'quarter' || size === 'strip') return '<div class="vq"><div class="fbig sm">' + ui.esc(keyLabel(from)) + ' → ' + ui.esc(keyLabel(to)) + '</div><div class="l2">' + ui.esc(shift) + '</div></div>';
  return '<div class="swrap kc">' +
    '<div class="kclab"><span>' + t('kc.from') + '</span>' + ui.seg('kcmin', [['0', t('kc.maj')], ['1', t('kc.min')]], k.from.minor ? '1' : '0', t('kc.mode')) + '</div>' + pills('kcfrom', k.from.pc, k.from.minor) +
    '<div class="kclab"><span>' + t('kc.to') + '</span></div>' + pills('kcto', k.to, k.from.minor) +
    '<div class="kcres"><b>' + ui.esc(keyLabel(from)) + ' → ' + ui.esc(keyLabel(to)) + '</b><span>' + ui.esc(shift) + '</span></div>' +
    '<div class="kctab" role="table">' + A.map((c, i) => '<div class="kccol" role="row"><span class="kcrn">' + c.rn + '</span>' +
      '<button data-x="kcplay" data-k="a" data-i="' + i + '">' + ui.esc(c.name) + '</button><button class="b" data-x="kcplay" data-k="b" data-i="' + i + '">' + ui.esc(B[i].name) + '</button></div>').join('') + '</div>' +
    '<div class="hdr">' + t('kc.yours') + '</div><input class="inp left kcinp" data-kctext value="' + ui.esc(k.text) + '" placeholder="G C D Em" aria-label="' + ui.esc(t('kc.yours')) + '" autocomplete="off" autocapitalize="characters" spellcheck="false">' +
    '<div class="kcout num" id="kcout">' + res(k.text) + '</div>' +
    '<div class="hdr">' + t('kc.capo', { key: keyLabel(to) }) + '</div><div class="group">' + capo.map((c) => '<div class="cell"><span class="grow">' + (c.capo ? ctx.tn('kc.fret', c.capo) : t('kc.noCapo')) + '</span><b>' + ui.esc(t('kc.shape', { shape: c.shape })) + '</b></div>').join('') + '</div>' + bookLink('mod') + '</div>';
}

function circleHTML() {
  const th = TH(), k = keyInfo(th.pc, th.minor, th.sev), { t } = ctx;
  if (size === 'quarter') return '<div class="cwrap q">' + circleSVG(k) + '</div>';
  const modes = '<div class="seg" style="width:auto" data-seg="kmode" role="group" aria-label="' + t('modeToggle') + '"><button data-v="0" aria-pressed="' + !th.minor +
    '" style="min-width:66px;flex:none;padding:0 12px">' + t('major') + '</button><button data-v="1" aria-pressed="' + th.minor + '" style="min-width:66px;flex:none;padding:0 12px">' + t('minor') + '</button></div>' +
    '<button class="ic txt sm' + (th.sev ? ' act' : '') + '" data-x="sevt" aria-pressed="' + th.sev + '" aria-label="' + t('sevenths') + '">7</button>';
  const cgrid = '<div class="cgrid">' + k.chords.map((c, i) => '<button class="cbtn" data-x="chord" data-i="' + i + '"><span class="fnb f' + c.f + '">' + c.rn + '</span><b>' + c.name + '</b></button>').join('') + '</div>';
  if (size === 'strip') {
    return '<div class="srow2">' + icb('data-x="kprev"', '‹', t('ccw'), 'sm txt') + '<button class="ktitle" data-x="kmodet" aria-label="' + t('modeToggle') + '">' + keyTitle(k) +
      '<span class="l2">' + sigText(k) + '</span></button>' + icb('data-x="knext"', '›', t('cw'), 'sm txt') + '<div class="chips nowrap sgrow">' +
      k.chords.map((c, i) => '<button class="chip" data-x="chord" data-i="' + i + '"><span class="fnb f' + c.f + '">' + c.rn + '</span>' + c.name + '</button>').join('') + '</div></div>';
  }
  if (size === 'half') return '<div class="cwrap h"><div class="csvg">' + circleSVG(k) + '</div><div class="cside"><div class="vrow tight">' + modes + '</div>' + cgrid + '</div></div>';
  const rel = t(k.relMinor ? 'key.min' : 'key.maj', { root: k.relRoot });
  return '<div class="cwrap f"><div class="csvg">' + circleSVG(k) + '</div><div class="prow" style="margin:8px 0 4px;justify-content:center">' + modes + '</div>' + cgrid +
    '<p class="ftr">' + (k.signs.length ? k.signs.join(' ') : t('noSignsCap')) + ' · ' + t('rel', { key: rel }) + (th.minor ? ' · ' + t('harmV', { note: k.notes[4] }) : '') + '</p>' +
    '<div class="ctrl4">' + icb('data-x="kscale"', I.play, t('playScale')) + icb('data-x="kdrone"', I.drone, t('droneTonic')) + icb('data-x="kpiano"', I.piano, t('pianoHl')) +
    icb('data-x="kscales"', I.scales, t('openScales')) + '</div>' + modesCircleHTML() + bookLink('key') + '</div>';
}

/* ---------- гаммы ---------- */

function scalesHTML() {
  const th = TH(), sc = th.scale, k = scaleInfo(sc.pc, sc.type), { t, ui } = ctx;
  const notes = '<div class="scnotes">' + k.notes.map((n, i) => '<div><b>' + n + '</b><span>' + k.degs[i] + '</span></div>').join('') + '</div>';
  const root = '<div class="vrow tight">' + icb('data-x="srootp"', '‹', t('rootDown'), 'sm txt') + '<b class="sroot">' + k.root + '</b>' + icb('data-x="srootn"', '›', t('rootUp'), 'sm txt') + '</div>';
  const type = '<button class="ic txt sm stype" data-x="stypenext" aria-label="' + t('nextScale') + '">' + scaleName(sc.type) + '</button>';
  const play = icb('data-x="splay"', I.play, t('play'));
  if (size === 'quarter') return '<div class="vq">' + root + type + notes + play + '</div>';
  if (size === 'strip') return '<div class="vs"><div class="srow2" style="flex:none">' + root + type + '<span class="sgrow"></span>' + play + '</div>' + notes + '</div>';
  const vw = th.view || 'fret', title = k.root + ' ' + scaleName(sc.type);
  if (size === 'half') {
    const vb = icb('data-x="tview" data-v="' + (vw === 'fret' ? 'keys' : 'fret') + '"', vw === 'fret' ? I.piano : I.fret, t(vw === 'fret' ? 'showKeys' : 'showFret'), 'sm');
    return '<div class="swrap h2"><div class="shead2">' + root + '<button class="tpbtn" data-x="stypesheet" aria-label="' + t('pickScale') + '">' + ui.esc(scaleName(sc.type)) +
      ' <span>▾</span></button>' + vb + icb('data-x="splay"', I.play, t('play'), 'sm') + '</div>' + notes + '<div class="sviz">' +
      (vw === 'fret' ? fretHTML(new Set(k.pcs), k.rootPc, 12) : kbHTML(60, 15, new Set(k.pcs), k.rootPc)) + '</div></div>';
  }
  const head = '<div class="hscroll">' + SH.map((n, i) => '<button class="pill" data-x="sroot" data-v="' + i + '" aria-pressed="' + (sc.pc === i) + '">' + enh(i) + '</button>').join('') +
    '</div><div class="hscroll">' + SCALE_TYPES.map((x) => '<button class="pill" data-x="stype" data-v="' + x + '" aria-pressed="' + (sc.type === x) + '">' + scaleName(x) + '</button>').join('') + '</div>';
  const acts = '<div class="ctrl4">' + play + icb('data-x="sdrone"', I.drone, t('droneTonic')) + icb('data-x="spiano"', I.piano, t('onPiano')) + '<span></span></div>';
  const tog = '<div class="vtog"><div class="seg" style="width:auto"><button data-x="tview" data-v="fret" aria-pressed="' + (vw === 'fret') + '">' + t('fret') +
    '</button><button data-x="tview" data-v="keys" aria-pressed="' + (vw === 'keys') + '">' + t('keys') + '</button></div></div>';
  return '<div class="swrap">' + head + '<div class="ch2"><b>' + ui.esc(title) + '</b><span class="num l2">' + k.steps.map(stepTxt).join(' ') + '</span></div>' + notes + tog +
    (vw === 'fret' ? fretHTML(new Set(k.pcs), k.rootPc, 15) : '<div style="margin-top:8px">' + kbHTML(60, 15, new Set(k.pcs), k.rootPc) + '</div>') + acts + schemeHTML(sc) + bookLink('scales') + '</div>';
}

/* ---------- как устроена гамма: круг из 12 нот, повороты лада, лестница, семья ---------- */

const STEP_SHORT = { 1: 'stp.1', 2: 'stp.2', 3: 'stp.3', 4: 'stp.4' };
// Круг из 12 нот (до сверху, по часовой — на полутон вверх): ноты гаммы — точки, связанные многоугольником;
// между соседними — шаг (п, т, 1½); тоника — крупнее; нота, отличающая лад от мажора или минора, — в кольце.
// Касание ноты гаммы — лад от этой ноты (те же ноты, другой центр)
function ringSVG(sc, k) {
  // тот же хроматический круг, что у аккордов (ui/chroma.js): фигура гаммы, шаги внутри, ступени в кружках
  const name = (p) => { const i = k.pcs.indexOf(p); return i >= 0 ? k.notes[i] : SH[p]; }, c = colorNote(sc.type);
  const mark = new Set(c ? k.pcs.filter((p, i) => c.notes.includes(k.degs[i])) : []);
  return '<div class="srwrap">' + chromaSVG({ pcs: k.pcs, name, mark, sub: (p) => k.degs[k.pcs.indexOf(p)], steps: 'scale', stepTxt: (st) => ctx.t(STEP_SHORT[st] || 'stp.2'),
    center: [k.root, ctx.ui.esc(scaleName(sc.type))], label: ctx.ui.esc(k.root + ' ' + scaleName(sc.type)), cls: 'sring' }) + '</div>';
}
function schemeHTML(sc) {
  const { t, ui } = ctx, th = TH(), k = scaleInfo(sc.pc, sc.type), fam = familyOfType(sc.type), vw = th.sview || 'rel';
  const parent = fam ? parentOf(sc.pc, sc.type) : null, F = fam && FAMILIES[fam.fam];
  const parentTitle = fam ? (fam.fam === 'major' ? MAJ_NAMES : MIN_NAMES)[parent] + ' ' + scaleName(F.modes[0]) : '';
  const li = LADDER.indexOf(sc.type), lowered = ['', '4', '7', '3', '6', '2', '5'];
  // подпись: в «Те же ноты» — от какой ступени какой гаммы; в «Та же тоника» — что изменилось по лестнице
  const cap = vw === 'rel'
    ? (fam ? t('sch.rel', { mode: k.root + ' ' + scaleName(sc.type), parent: parentTitle, deg: fam.deg + 1 }) : t('sch.noFam'))
    : (li > 0 ? t('sch.par', { d: lowered[li], prev: scaleName(LADDER[li - 1]) }) : li === 0 ? t('sch.parTop') : t('sch.parOut'));
  const c = colorNote(sc.type);
  const side = '<div class="sside">' + ui.seg('sview', [['rel', t('sch.same')], ['par', t('sch.tonic')]], vw, t('sch.view')) +
    '<div class="srot">' + icb('data-x="smrot" data-d="-1"', '‹', t(vw === 'rel' ? 'sch.prevMode' : 'sch.brighter'), 'sm txt') +
    '<b>' + ui.esc(k.root + ' ' + scaleName(sc.type)) + '</b>' + icb('data-x="smrot" data-d="1"', '›', t(vw === 'rel' ? 'sch.nextMode' : 'sch.darker'), 'sm txt') + '</div>' +
    '<p class="scap">' + ui.esc(cap) + '</p>' +
    '<p class="scap l2">' + k.steps.map(stepTxt).join(' · ') + (c ? '<br>' + ui.esc(t('find.color.' + c.base, { notes: c.notes.join(' ') })) : '') + '</p></div>';
  const famRow = fam ? '<div class="hdr">' + ui.esc(t('sch.family', { parent: parentTitle })) + '</div><div class="chips fmodes">' + F.modes.map((id, d) => {
    const pc = (parent + F.ivs[d]) % 12, name = (fam.fam === 'major' ? (id === 'minor' || id === 'dorian' || id === 'phrygian' || id === 'locrian' ? MIN_NAMES : MAJ_NAMES) : MIN_NAMES)[pc];
    return '<button class="chip' + (id === sc.type ? ' on' : '') + '" data-x="fmode" data-pc="' + pc + '" data-id="' + id + '"><span class="fnb fS">' + (d + 1) + '</span>' + name + ' ' + ui.esc(scaleName(id)) + '</button>';
  }).join('') + '</div>' : '';
  return '<div class="hdr">' + t('sch.title') + '</div><div class="sscheme">' + ringSVG(sc, k) + side + '</div>' + famRow +
    ladderHTML(sc.pc, [], sc.type) + '<div class="philo">' + t('sch.philo').split('\n').map((x) => '<p>' + ui.esc(x) + '</p>').join('') + '</div>';
}

/* ---------- лады на квинтовом круге: дуга, тоника, аккорды ступеней ---------- */

const CMODES = ['lydian', 'major', 'mixo', 'dorian', 'minor', 'phrygian', 'locrian', 'harm', 'phrygdom', 'mel', 'lyddom', 'pmaj', 'pmin'];
function fifthsSVG(tn, id, k, on, chords) {
  const C = 130, R = 96, ang = (i) => ((i * 30 - 90) * Math.PI) / 180, P = (r, i) => [C + r * Math.cos(ang(i)), C + r * Math.sin(ang(i))], f = (n) => n.toFixed(1);
  const arcPath = (r, i0, n) => { const a0 = ang(i0 - 0.42), a1 = ang(i0 + n - 1 + 0.42), [x0, y0] = [C + r * Math.cos(a0), C + r * Math.sin(a0)], [x1, y1] = [C + r * Math.cos(a1), C + r * Math.sin(a1)];
    return 'M' + f(x0) + ' ' + f(y0) + 'A' + r + ' ' + r + ' 0 ' + ((n - 1 + 0.84) * 30 > 180 ? 1 : 0) + ' 1 ' + f(x1) + ' ' + f(y1); };
  const acc = k.notes.some((n) => n.includes('♭')) ? FL : SH, name = (p) => { const i = k.pcs.indexOf(p); return i >= 0 ? k.notes[i] : acc[p]; }, set = new Set(k.pcs);
  let s = '<svg viewBox="0 0 260 260" class="fring" role="img" aria-label="' + ctx.ui.esc(k.root + ' ' + scaleName(id)) + '">';
  s += '<circle cx="' + C + '" cy="' + C + '" r="' + R + '" class="fr-base"/>';
  s += '<path d="' + arcPath(R, on.start, on.len) + '" class="fr-arc"/>';
  // повышенная нота вне дуги — пунктиром к той, которую заменила
  on.outside.forEach((p) => on.missing.forEach((m) => { const [x1, y1] = P(R, FIFTHS.indexOf(p)), [x2, y2] = P(R, FIFTHS.indexOf(m)); s += '<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '" class="fr-alt"/>'; }));
  FIFTHS.forEach((p, i) => {
    const inS = set.has(p), [x, y] = P(R, i), [lx, ly] = P(R + 22, i), [cx2, cy2] = P(R - 25, i), ch = chords.find((c) => c.pc === p);
    s += '<g class="fr-n' + (inS ? ' on' : '') + (p === tn ? ' r' : '') + (on.outside.includes(p) ? ' out' : '') + (on.missing.includes(p) ? ' miss' : '') + (ch && ch.color ? ' c' : '') + '">' +
      '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + (p === tn ? 12 : inS ? 9 : 4) + '"/>' +
      '<text x="' + f(lx) + '" y="' + f(ly) + '" text-anchor="middle" dominant-baseline="central" class="fr-l">' + name(p) + '</text>' +
      (ch ? '<text x="' + f(cx2) + '" y="' + f(cy2) + '" text-anchor="middle" dominant-baseline="central" class="fr-rn">' + ch.rn + '</text>' : '') + '</g>';
  });
  return s + '<text x="' + C + '" y="' + (C - 6) + '" text-anchor="middle" class="sr-c1">' + k.root + '</text><text x="' + C + '" y="' + (C + 13) + '" text-anchor="middle" class="sr-c2">' + scaleName(id) + '</text></svg>';
}
function modesCircleHTML() {
  const th = TH(), { t, ui } = ctx, id = CMODES.includes(th.cmode) ? th.cmode : 'dorian', tn = th.pc, k = scaleInfo(tn, id), on = onFifths(tn, k.pcs), chords = modeChords(tn, id, th.sev);
  const chips = '<div class="hscroll">' + CMODES.map((m) => '<button class="pill" data-x="cmode" data-v="' + m + '" aria-pressed="' + (m === id) + '">' + ui.esc(scaleName(m)) + '</button>').join('') + '</div>';
  const nm = (c) => k.notes[c.deg] + c.suf;
  const chordRow = chords.length ? '<div class="chips cmch">' + chords.map((c, i) => '<button class="chip' + (c.color ? ' on' : '') + '" data-x="cmchord" data-i="' + i + '"><span class="fnb fS">' + c.rn + '</span>' + ui.esc(nm(c)) + '</button>').join('') + '</div>' : '';
  const names = (a) => a.map((p) => { const i = k.pcs.indexOf(p); return i >= 0 ? k.notes[i] : SH[p]; }).join(', ');
  const pos = on.outside.length ? t('cm.out', { out: names(on.outside), miss: on.missing.map((p) => (k.notes.some((n) => n.includes('♭')) ? FL : SH)[p]).join(', ') })
    : on.len === 7 ? t('cm.pos', { n: on.tonicPos + 1 }) : t('cm.penta');
  const colors = chords.filter((c) => c.color).map(nm);
  return '<div class="hdr">' + t('cm.title') + '</div>' + chips + '<div class="cmode">' + fifthsSVG(tn, id, k, on, chords) +
    '<div class="cmtext"><p><b>' + ui.esc(k.root + ' ' + scaleName(id)) + '</b> — ' + ui.esc(t('cm.d.' + id)) + '</p><p class="l2">' + ui.esc(pos) + '</p>' +
    (colors.length ? '<p class="l2">' + ui.esc(t('cm.color', { list: colors.join(', ') })) + '</p>' : '') +
    '<div class="vrow tight">' + icb('data-x="cmplay"', I.play, t('playScale'), 'sm') + icb('data-x="cmopen"', I.scales, t('openScales'), 'sm') + '</div></div></div>' + chordRow +
    '<p class="ftr">' + t('cm.ftr') + '</p>';
}

/* ---------- аккорды ---------- */

function chordsHTML() {
  const th = TH(), k = chordInfo(th.croot || 0, th.ctype), { t, ui } = ctx, lab = chordLabel(k.id), desc = t('chord.' + k.id);
  const notes = '<div class="scnotes">' + k.notes.map((n, i) => '<div><b>' + n + '</b><span>' + k.form[i] + '</span></div>').join('') + '</div>';
  const root = '<div class="vrow tight">' + icb('data-x="crootp"', '‹', t('rootDown'), 'sm txt') + '<b class="sroot">' + k.root + '</b>' + icb('data-x="crootn"', '›', t('rootUp'), 'sm txt') + '</div>';
  const type = '<button class="ic txt sm stype" data-x="ctypenext" aria-label="' + t('nextChord') + '">' + lab + '</button>';
  const play = icb('data-x="cplay"', I.play, t('playChord'));
  if (size === 'quarter') return '<div class="vq"><div class="cname">' + k.name + '</div>' + root + type + notes + play + '</div>';
  if (size === 'strip') return '<div class="vs"><div class="srow2" style="flex:none">' + root + type + '<b class="cname sm">' + k.name + '</b><span class="sgrow"></span>' + play + '</div>' + notes + '</div>';
  if (size === 'half') {
    return '<div class="swrap h2"><div class="shead2">' + root + '<button class="tpbtn" data-x="ctypesheet" aria-label="' + t('pickChord') + '"><b>' + ui.esc(k.name) + '</b> <span>▾</span></button>' +
      icb('data-x="carp"', I.wave, t('arp'), 'sm') + icb('data-x="cplay"', I.play, t('playChord'), 'sm') + '</div>' + notes + '<div class="sviz">' + fretHTML(new Set(k.pcs), k.pc, 12) + '</div></div>';
  }
  return '<div class="swrap"><div class="hscroll">' + SH.map((n, i) => '<button class="pill" data-x="croot" data-v="' + i + '" aria-pressed="' + (k.pc === i) + '">' + enh(i) + '</button>').join('') + '</div>' +
    '<div class="hscroll">' + CHORDS.map((c) => '<button class="pill" data-x="ctype" data-v="' + c[0] + '" aria-pressed="' + (c[0] === k.id) + '" aria-label="' + ui.esc(t('chord.' + c[0])) + '">' + (c[1] || 'maj') + '</button>').join('') + '</div>' +
    '<div class="ch2"><b class="cname">' + k.name + '</b><span class="l2">' + ui.esc(desc) + '</span></div>' + notes + chordCircle(k, desc) + fretHTML(new Set(k.pcs), k.pc, 15) +
    '<div class="ctrl4" style="margin-top:10px">' + play + icb('data-x="carp"', I.wave, t('arp')) + icb('data-x="cpiano"', I.piano, t('onPiano')) + icb('data-x="cdrone"', I.drone, t('droneTonic')) + '</div>' + bookLink('chords') + '</div>';
}

// Аккорд на хроматическом круге: фигура, шаги дугами («+4», «+3»), формула «4 + 3 = мажорное трезвучие»; касание
// ноты — звук ноты, середины круга — аккорд (слово автора 05.11.2026)
function chordCircle(k, desc) {
  const nameOf = (p) => { const i = k.pcs.indexOf(p); return i >= 0 ? k.notes[i] : SH[p]; }, sub = (p) => k.form[k.pcs.indexOf(p)];
  const st = chordSteps(k.pcs);
  return '<div class="crwrap" data-x="cplay">' + chromaSVG({ pcs: k.pcs, name: nameOf, sub, steps: 'chord', center: [k.name, ''], label: k.name }) + '</div>' +
    '<div class="crform"><span>' + st.join(' + ') + ' = ' + ctx.ui.esc(desc) + '</span></div>';
}

/* ---------- интервалы ---------- */

function intervalsHTML() {
  const pc = TH().croot || 0, root = MAJ_NAMES[pc], { t } = ctx, nt = (i) => intervalNote(pc, i);
  const rootc = '<div class="vrow tight">' + icb('data-x="crootp"', '‹', t('noteDown'), 'sm txt') + '<b class="sroot">' + root + '</b>' + icb('data-x="crootn"', '›', t('noteUp'), 'sm txt') + '</div>';
  const list = INTERVALS.map((_, i) => i).slice(1);
  if (size === 'quarter') return '<div class="vq">' + rootc + '<div class="igrid">' + list.map((i) => '<button class="ibtn" data-x="iplay" data-i="' + i + '" aria-label="' + t('iv.' + i) + '">' + t('ivs.' + i) + '</button>').join('') + '</div></div>';
  if (size === 'strip') return '<div class="srow2">' + rootc + '<div class="chips nowrap sgrow">' + list.map((i) => '<button class="chip" data-x="iplay" data-i="' + i + '" aria-label="' + t('iv.' + i) + '"><span class="fnb fS">' + t('ivs.' + i) + '</span>' + nt(i) + '</button>').join('') + '</div></div>';
  if (size === 'half') {
    return '<div class="swrap h2"><div class="shead2">' + rootc + '<span class="l2" style="font-size:13px">' + t('tapToHear') + '</span></div><div class="igrid2">' +
      list.map((i) => '<button class="ib2" data-x="iplay" data-i="' + i + '"><b>' + t('ivs.' + i) + '</b><span>' + nt(i) + '</span><small>' + t('iv.' + i) + '</small></button>').join('') + '</div></div>';
  }
  return '<div class="swrap"><div class="hscroll">' + SH.map((n, i) => '<button class="pill" data-x="croot" data-v="' + i + '" aria-pressed="' + (pc === i) + '">' + enh(i) + '</button>').join('') + '</div>' +
    '<div class="group" style="margin-top:6px">' + INTERVALS.map((iv, i) => '<button class="cell" data-x="iplay" data-i="' + i + '"><span class="fnb fS" style="width:34px">' + t('ivs.' + i) +
      '</span><span class="grow">' + t('iv.' + i) + '</span><span class="val num">' + t('ivSemis', { n: iv[0], a: root, b: nt(i) }) + '</span></button>').join('') + '</div>' +
    '<p class="ftr">' + t('ivFtr') + '</p>' + bookLink('iv') + '</div>';
}

/* ---------- определитель: аккорд и гамма по нотам, лады как одна семья ---------- */

const NN = (pc) => SH[pc];
const parentName = (f) => (f.fam === 'major' ? MAJ_NAMES : MIN_NAMES)[f.parent] + ' ' + scaleName(f.fam === 'major' ? 'major' : f.fam);
function findHTML() {
  const th = TH(), { t, ui } = ctx, notes = (th.fnotes ||= []), tonic = notes.includes(th.ftonic) ? th.ftonic : notes[0];
  const picker = '<div class="hscroll fpick">' + SH.map((n, i) => '<button class="pill' + (i === tonic ? ' ftonic' : '') + '" data-x="fnote" data-v="' + i + '" aria-pressed="' + notes.includes(i) + '">' + n + '</button>').join('') + '</div>';
  const acts = '<div class="vrow tight fact">' + icb('data-x="flisten"', lis ? '…' : I.mic, t(lis ? 'find.listening' : 'find.listen'), 'sm' + (lis ? ' on' : '')) +
    icb('data-x="fplay"', I.play, t('find.play'), 'sm') + icb('data-x="fclear"', '×', t('find.clear'), 'sm txt') + '</div>';
  const ch = notes.length > 1 ? chordsOf(notes, tonic) : [], fams = notes.length ? familiesOf(notes, tonic) : [];
  const chordCard = ch.length ? '<div class="fcard"><span class="fhd">' + t('find.chord') + '</span><b class="fbig">' + ui.esc(ch[0].name) + '</b>' +
    (ch.length > 1 ? '<span class="l2 fsub">' + t('find.also') + ' ' + ch.slice(1, 4).map((c) => ui.esc(c.name)).join(' · ') + '</span>' : '') + '</div>'
    : notes.length > 1 && notes.length < 6 ? '<div class="fcard"><span class="fhd">' + t('find.chord') + '</span><span class="l2">' + t('find.noChord') + '</span></div>' : '';
  const famHTML = (f) => '<div class="ffam"><div class="ffh"><b>' + ui.esc(parentName(f)) + '</b><span class="l2">' + t('find.fam.' + f.fam) + (f.extra ? ' · ' + ctx.tn('find.extra', f.extra) : '') + '</span></div>' +
    '<div class="chips fmodes">' + f.modes.map((m) => '<button class="chip' + (m.pc === tonic ? ' on' : '') + '" data-x="fmode" data-pc="' + m.pc + '" data-id="' + m.id + '"><span class="fnb fS">' + (m.deg + 1) + '</span>' +
      NN(m.pc) + ' ' + ui.esc(scaleName(m.id)) + '</button>').join('') + '</div>' +
    (f.at ? '<p class="fsame">' + ui.esc(t('find.same', { mode: NN(f.at.pc) + ' ' + scaleName(f.at.id), parent: parentName(f), deg: f.at.deg + 1 })) + '</p>' : '') + '</div>';
  if (size === 'quarter' || size === 'strip') {
    return '<div class="vq">' + picker + '<div class="fbig sm">' + (ch.length ? ui.esc(ch[0].name) : '—') + '</div><div class="l2">' +
      (fams[0] && fams[0].at ? ui.esc(NN(fams[0].at.pc) + ' ' + scaleName(fams[0].at.id)) : '') + '</div></div>';
  }
  const more = '<button class="cell act fmore" data-x="tsec" data-v="scales">' + t('find.toScales') + '</button>';
  if (!notes.length) return '<div class="swrap">' + picker + acts + '<p class="ftr">' + t('find.hint') + '</p><div class="group">' + more + '</div></div>';
  const tonicRow = notes.length > 1 ? '<div class="frow"><span class="l2">' + t('find.tonic') + '</span>' + notes.map((pc) => '<button class="pill sm" data-x="ftonic" data-v="' + pc + '" aria-pressed="' + (pc === tonic) + '">' + NN(pc) + '</button>').join('') + '</div>' : '';
  return '<div class="swrap">' + picker + tonicRow + acts + '<div style="margin-top:6px">' + kbHTML(60, 15, new Set(notes), tonic) + '</div>' + chordCard +
    '<div class="hdr">' + t('find.scales') + '</div>' + (fams.length ? fams.slice(0, 4).map(famHTML).join('') + (fams.length > 4 ? '<p class="ftr">' + ctx.tn('find.more', fams.length - 4) + '</p>' : '')
      : '<p class="ftr">' + t('find.noScale') + '</p>') +
    '<div class="group">' + more + '</div></div>';
}
// Лестница ладов от одной тоники: от светлого к тёмному, соседние — на одну ноту; cur — текущий лад
function ladderHTML(tonic, notes, cur = null) {
  const { t, ui } = ctx;
  return '<div class="hdr">' + ui.esc(t('find.ladder', { note: NN(tonic) })) + '</div><div class="group fladder">' + ladderOf(tonic, notes).map((r) => {
    const c = colorNote(r.id);
    return '<button class="cell' + (r.id === cur ? ' on' : '') + '" data-x="fmode" data-pc="' + tonic + '" data-id="' + r.id + '" aria-pressed="' + (r.id === cur) + '"><span class="fnb fS" style="width:34px">' + (r.lowered ? '↓' + r.lowered : '·') + '</span>' +
      '<span class="grow"><b style="font-weight:600">' + ui.esc(NN(tonic) + ' ' + scaleName(r.id)) + '</b><span class="st l2" style="display:block;font-size:12.5px">' + degreesOf(r.id).join(' ') +
      (c ? ' · ' + ui.esc(t('find.color.' + c.base, { notes: c.notes.join(' ') })) : '') + '</span></span>' + (r.fits || r.id === cur ? ui.icons.check : '') + '</button>';
  }).join('') + '</div>';
}

// Слушать: ~2,5 с с микрофона → энергия по 12 нотам → самые сильные ноты (до шести), тоника — самая громкая
async function listen() {
  if (lis) return;
  const { t, ui } = ctx;
  try {
    const m = await ctx.mic.request();
    if (!host) { m.stop(); return; }
    lis = { m, chunks: [], t0: performance.now() };
    render();
    const step = () => {
      if (!lis) return;
      lis.chunks.push(Float32Array.from(lis.m.read()));
      if (performance.now() - lis.t0 < 2600) lis.timer = setTimeout(step, 80); else heard();
    };
    step();
  } catch (e) { ui.toast(t(e && e.reason === 'denied' ? 'find.micDenied' : 'find.micFail')); }
}
function heard() {
  const { m, chunks } = lis, th = TH();
  m.stop(); lis = null;
  const n = chunks[0] ? chunks[0].length : 0, x = new Float32Array(chunks.length * n);
  chunks.forEach((c, i) => x.set(c, i * n));
  const rms = Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length));
  if (rms < 0.004) { ctx.ui.toast(ctx.t('find.quiet')); render(); return; }
  const c = chroma(x, m.sampleRate), mx = Math.max(...c);
  const pcs = [...c.keys()].filter((i) => c[i] >= mx * 0.55).sort((a, b) => c[b] - c[a]).slice(0, 6);
  th.fnotes = pcs; th.ftonic = pcs[0];
  ctx.log('определитель: по микрофону ' + pcs.length + ' нот');
  ctx.store.save(); render();
}
function stopListen() { if (lis) { clearTimeout(lis.timer); lis.m.stop(); lis = null; } }

/* ---------- окно ---------- */

function view() {
  const s = curSec(), big = size === 'full' || size === 'half', { t } = ctx;
  const sw = big ? '<div class="tswrow"><div class="tsw" role="tablist">' + secs().map((k) => '<button class="tswb' + (k === s ? ' on' : '') + '" data-x="tsec" data-v="' + k + '" role="tab" aria-selected="' + (k === s) + '">' +
    t('sec.' + k) + '</button>').join('') + '</div></div>'
    : '<div class="csw"><button class="cswb on txt" data-x="tsecnext" aria-label="' + t('secNext') + '">' + t('sec.' + s) + ' ›</button></div>';
  const body = s === 'circle' ? circleHTML() : s === 'keys' ? keysHTML() : s === 'scales' ? scalesHTML() : s === 'chords' ? chordsHTML() : s === 'find' ? findHTML() : intervalsHTML();
  return '<div class="comp ' + size + '"' + (sw ? ' data-swtabs' : '') + '>' + sw + '<div class="cbody">' + body + '</div></div>';
}

let lastSec = null;
function render() {
  if (!host) return;
  // в том же разделе прокрутка остаётся на месте (переключение лада, тоники, вида — без прыжка наверх)
  const sec = curSec(), box = host.querySelector('.swrap, .cwrap.f'), y = box && lastSec === sec ? box.scrollTop : 0, hy = lastSec === sec ? host.scrollTop : 0;
  // горизонтальные полосы выбора (подразделы «Джаза», тональности, семьи…) не прыгают в начало
  const hs = [...host.querySelectorAll('.hscroll')].map((x) => x.scrollLeft);
  host.innerHTML = view();
  if (lastSec === sec) host.querySelectorAll('.hscroll').forEach((x, i) => {
    if (hs[i]) x.scrollLeft = hs[i];
    const on = x.querySelector('[aria-pressed="true"]');
    if (!on) return;
    const l = on.getBoundingClientRect().left - x.getBoundingClientRect().left; // от края полосы (offsetLeft считается от другого предка)
    if (l < 0 || l + on.offsetWidth > x.clientWidth) x.scrollLeft += l - (x.clientWidth - on.offsetWidth) / 2;
  });
  lastSec = sec;
  const nb = host.querySelector('.swrap, .cwrap.f');
  if (nb && y) nb.scrollTop = y;
  if (hy) host.scrollTop = hy;
  // выбранная вкладка не уходит за край полосы (вкладок пять — «Определитель» последний)
  const on = host.querySelector('.tswb.on'), bar = on && on.parentElement;
  if (bar && on.offsetLeft + on.offsetWidth > bar.clientWidth) bar.scrollLeft = on.offsetLeft + on.offsetWidth - bar.clientWidth + 4;
}

// Шторка выбора гаммы или аккорда
function typeSheet(kind) {
  const { t, ui } = ctx, th = TH();
  const list = kind === 'sc' ? SCALE_TYPES.map((k) => [k, scaleName(k).replace(/^./, (c) => c.toUpperCase()), ''])
    : CHORDS.map((c) => [c[0], c[1] || 'maj', t('chord.' + c[0])]);
  const cur = kind === 'sc' ? th.scale.type : th.ctype || 'maj';
  ui.sheet(() => ui.snav(t(kind === 'sc' ? 'sheet.scale' : 'sheet.chord')) + '<div class="group">' + list.map(([v, n, d]) => '<button class="cell" data-tp="' + v + '" aria-pressed="' + (v === cur) +
    '"><span class="grow"><b style="font-weight:600">' + ui.esc(n) + '</b>' + (d ? ' <span class="l2" style="font-size:14px">' + ui.esc(d) + '</span>' : '') + '</span>' + (v === cur ? ui.icons.check : '') + '</button>').join('') + '</div>',
  (el, sh) => el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tp]');
    if (!b) return;
    if (kind === 'sc') th.scale.type = b.dataset.tp;
    else th.ctype = b.dataset.tp;
    ctx.store.save();
    sh.close();
    render();
  }));
}

function highlight(pcs, root, label) {
  ctx.shared.set('highlight', { pcs: new Set(pcs), root, label });
  ctx.openTool('piano');
}

function droneOn(pc, note) {
  if (!ctx.audio.unlock()) return;
  ctx.audio.drone.tonic(pc);
  ctx.ui.toast(ctx.t('droneToast', { note }));
}

function act(a, el) {
  const th = TH(), A = ctx.audio, save = () => { ctx.store.save(); render(); };
  switch (a) {
    case 'bookgo': ctx.openIn('book', { book: { ch: el.dataset.v, sec: 'school' } }); break; // раздел уточнит сам учебник по главе
    case 'tsec': th.sec = el.dataset.v; save(); break;
    case 'kcfrom': KC().from.pc = +el.dataset.v; save(); break;
    case 'kcto': KC().to = +el.dataset.v; save(); break;
    case 'kcplay': { const k = KC(), from = { ...k.from, sharp: null }, list = el.dataset.k === 'a' ? diatonic(from) : diatonic(keyTo(from, k.to)), c = list[+el.dataset.i];
      if (c && A.unlock()) A.playChord(c.midis); break; }
    case 'tsecnext': th.sec = secs()[(secs().indexOf(curSec()) + 1) % secs().length]; save(); break;
    case 'fnote': {
      const pc = +el.dataset.v, n = (th.fnotes ||= []);
      if (n.includes(pc)) { th.fnotes = n.filter((x) => x !== pc); if (th.ftonic === pc) th.ftonic = th.fnotes[0]; }
      else { n.push(pc); if (th.ftonic == null || !n.includes(th.ftonic)) th.ftonic = pc; if (A.unlock()) A.playNote(60 + pc, { bus: 'theory', dur: 0.5 }); }
      save(); break;
    }
    case 'ftonic': th.ftonic = +el.dataset.v; save(); break;
    case 'fclear': th.fnotes = []; th.ftonic = null; save(); break;
    case 'flisten': if (lis) { stopListen(); render(); } else listen(); break;
    case 'fplay': { const n = th.fnotes || [], tn = n.includes(th.ftonic) ? th.ftonic : n[0]; if (n.length) A.playChord(n.map((pc) => 48 + tn + ((pc - tn + 12) % 12)).sort((a, b) => a - b)); break; }
    case 'fmode': th.scale = { pc: +el.dataset.pc, type: el.dataset.id }; th.sec = 'scales'; save(); break;
    case 'sring': {
      const p = +el.dataset.pc, k = scaleInfo(th.scale.pc, th.scale.type);
      if (A.unlock()) A.playNote(60 + p, { bus: 'theory', dur: 0.5 });
      // нота гаммы — лад от неё: те же ноты, другой центр
      if (k.pcs.includes(p) && p !== th.scale.pc && familyOfType(th.scale.type)) {
        let r = { pc: th.scale.pc, id: th.scale.type };
        for (let i = 0; i < 7 && r.pc !== p; i++) r = rotateMode(r.pc, r.id, 1);
        th.scale = { pc: r.pc, type: r.id }; save();
      }
      break;
    }
    case 'smrot': {
      const d = +el.dataset.d;
      if ((th.sview || 'rel') === 'rel') { const r = rotateMode(th.scale.pc, th.scale.type, d); if (r) th.scale = { pc: r.pc, type: r.id }; }
      else { const i = LADDER.indexOf(th.scale.type), j = i < 0 ? 1 : Math.max(0, Math.min(LADDER.length - 1, i + d)); th.scale.type = LADDER[j]; }
      save(); A.playSeq(scaleInfo(th.scale.pc, th.scale.type).seq.slice(0, 8), { step: 0.2 }); break;
    }
    case 'cmode': th.cmode = el.dataset.v; save(); break;
    case 'cmchord': { const id = CMODES.includes(th.cmode) ? th.cmode : 'dorian', c = modeChords(th.pc, id, th.sev)[+el.dataset.i]; if (c) A.playChord(c.rel.map((x) => intervalBase(th.pc) + x)); break; }
    case 'cmplay': A.playSeq(scaleInfo(th.pc, CMODES.includes(th.cmode) ? th.cmode : 'dorian').seq, { step: 0.26 }); break;
    case 'cmopen': th.scale = { pc: th.pc, type: CMODES.includes(th.cmode) ? th.cmode : 'dorian' }; th.sec = 'scales'; save(); break;
    case 'key': th.pc = +el.dataset.pc; th.minor = el.dataset.minor === '1'; save(); break;
    case 'sevt': th.sev = !th.sev; save(); break;
    case 'kprev': case 'knext': th.pc = circleStep(th.pc, th.minor, a === 'knext' ? 1 : -1); save(); break;
    case 'kmodet': th.minor = !th.minor; save(); break;
    case 'chord': A.playChord(keyInfo(th.pc, th.minor, th.sev).chords[+el.dataset.i].midis); break;
    case 'kscale': A.playSeq(keyInfo(th.pc, th.minor).scaleMidis, { step: 0.28 }); break;
    case 'kdrone': { const k = keyInfo(th.pc, th.minor); droneOn(k.rootPc, k.root); break; }
    case 'kpiano': { const k = keyInfo(th.pc, th.minor); highlight(k.pcs, k.rootPc, keyTitle(k)); break; }
    case 'kscales': th.scale = { pc: th.pc, type: th.minor ? 'minor' : 'major' }; th.sec = 'scales'; save(); break;
    case 'stypesheet': typeSheet('sc'); break;
    case 'ctypesheet': typeSheet('ch'); break;
    case 'sroot': th.scale.pc = +el.dataset.v; save(); break;
    case 'srootp': case 'srootn': th.scale.pc = (th.scale.pc + (a === 'srootn' ? 1 : 11)) % 12; save(); break;
    case 'stype': th.scale.type = el.dataset.v; save(); break;
    case 'stypenext': th.scale.type = SCALE_TYPES[(SCALE_TYPES.indexOf(th.scale.type) + 1) % SCALE_TYPES.length]; save(); break;
    case 'splay': A.playSeq(scaleInfo(th.scale.pc, th.scale.type).seq, { step: 0.28 }); break;
    case 'sdrone': { const k = scaleInfo(th.scale.pc, th.scale.type); droneOn(k.rootPc, k.root); break; }
    case 'spiano': { const k = scaleInfo(th.scale.pc, th.scale.type); highlight(k.pcs, k.rootPc, k.root + ' ' + scaleName(th.scale.type)); break; }
    case 'tview': th.view = el.dataset.v; save(); break;
    case 'croot': th.croot = +el.dataset.v; save(); break;
    case 'crootp': case 'crootn': th.croot = ((th.croot || 0) + (a === 'crootn' ? 1 : 11)) % 12; save(); break;
    case 'ctype': th.ctype = el.dataset.v; save(); break;
    case 'ctypenext': { const k = CHORDS.map((c) => c[0]); th.ctype = k[(k.indexOf(th.ctype || 'maj') + 1) % k.length]; save(); break; }
    case 'cplay': A.playChord(chordInfo(th.croot || 0, th.ctype).midis); break;
    case 'carp': { const m = chordInfo(th.croot || 0, th.ctype).midis; A.playSeq(m.concat(m.slice(0, -1).reverse()), { step: 0.22 }); break; }
    case 'cpiano': { const k = chordInfo(th.croot || 0, th.ctype); highlight(k.pcs, k.pc, k.name); break; }
    case 'cdrone': { const k = chordInfo(th.croot || 0, th.ctype); droneOn(k.pc, k.root); break; }
    case 'iplay': {
      const pc = th.croot || 0, m = intervalBase(pc), iv = INTERVALS[+el.dataset.i][0];
      A.playSeq([m, m + iv], { step: 0.5 });
      setTimeout(() => A.playChord([m, m + iv]), 1100);
      break;
    }
    case 'fplay': A.playSeq([+el.dataset.m], { step: 0.6 }); break;
  }
}

function bind() {
  onClick = (e) => {
    const sg = e.target.closest('[data-seg="kmode"] [data-v]');
    if (sg) { TH().minor = sg.dataset.v === '1'; ctx.store.save(); render(); return; }
    const km = e.target.closest('[data-seg="kcmin"] [data-v]');
    if (km) { KC().from.minor = km.dataset.v === '1'; ctx.store.save(); render(); return; }
    const sv = e.target.closest('[data-seg="sview"] [data-v]');
    if (sv) { TH().sview = sv.dataset.v; ctx.store.save(); render(); return; }
    // нота аккорда на хроматическом круге — её звук (середина круга — весь аккорд, data-x="cplay" обёртки)
    const sn = e.target.closest('.srwrap [data-cpc]');
    if (sn) { act('sring', { dataset: { pc: sn.dataset.cpc } }); return; }
    const cn = e.target.closest('.crwrap [data-cpc]');
    if (cn) { const th = TH(), k = chordInfo(th.croot || 0, th.ctype), i = k.pcs.indexOf(+cn.dataset.cpc); if (i >= 0 && ctx.audio.unlock()) ctx.audio.playSeq([k.midis[i]], { step: 0.6 }); return; }
    const x = e.target.closest('[data-x]');
    if (x) act(x.dataset.x, x);
  };
  // Сектора круга — с клавиатуры
  onKey = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.sec[data-x="key"]')) { e.preventDefault(); act('key', e.target); }
  };
  // Клавиши в гаммах — сыграть ноту
  onDown = (e) => {
    const k = e.target.closest('.kb [data-m]');
    if (!k) return;
    e.preventDefault();
    // в определителе клавиша добавляет или убирает ноту
    if (curSec() === 'find') { act('fnote', { dataset: { v: String(+k.dataset.m % 12) } }); return; }
    if (ctx.audio.unlock()) ctx.audio.playNote(+k.dataset.m, { bus: 'theory', dur: 0.6 });
  };
  // своя строка аккордов: пересчёт сразу, без перерисовки (поле не теряет курсор)
  onInput = (e) => {
    if (!e.target.matches('[data-kctext]')) return;
    const k = KC(), from = { ...k.from, sharp: null }, o = host.querySelector('#kcout');
    k.text = e.target.value.slice(0, 300);
    ctx.store.save();
    if (o) o.textContent = k.text.trim() ? transposeLine(k.text, from, keyShift(from, k.to)) : '';
  };
  host.addEventListener('input', onInput);
  host.addEventListener('click', onClick);
  host.addEventListener('keydown', onKey);
  host.addEventListener('pointerdown', onDown);
}

export default {
  ...meta,
  status(c) {
    const th = c.store.all(), k = keyInfo(th.pc || 0, !!th.minor);
    return c.t(k.minor ? 'key.min' : 'key.maj', { root: k.root });
  },
  mount(el, c, sz = 'full') {
    host = el; ctx = c; size = sz;
    render();
    bind();
  },
  resize(sz) { size = sz; render(); },
  unmount() {
    stopListen();
    if (host) {
      host.removeEventListener('input', onInput);
      host.removeEventListener('click', onClick);
      host.removeEventListener('keydown', onKey);
      host.removeEventListener('pointerdown', onDown);
    }
    host = null;
  },
};
