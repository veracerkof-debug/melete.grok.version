// Профиль и настройки (полноэкранная панель): статистика, неделя и цель, оформление, данные, функции;
// чат в Telegram, правовые тексты, соглашение при первом запуске.
// Перенесено из legacy/practice.html (panelRoot, renderPanel, PPAGES, weekHTML, lookHTML, dataHTML, featHTML, statsHTML,
// barsSVG, hbars, legalSheet, doExport, импорт копии).
import { Capacitor } from '@capacitor/core';
import { isDesktop } from '../desktop.js';
import { logErr } from '../log.js';
import { updateSheet, variantsSheet } from './update.js';
import { DEV, VARIANTS } from '../variants.js';
import { t, tn, getLang, LANGS, LANG_NAMES, loadLang } from '../../i18n/index.js';
import { esc, seg, sheet, snav, toast, confirm, leave, icons } from '../../ui/index.js';
import { autoMode, autoAna, autoHq, autoPower, autoLyr } from '../autostems.js';
import { fullStems } from '../../audio/stems.js';
import { sortable } from '../../ui/hold.js';
import { isDesk } from '../../ui/desk.js';
import { goalRing, FLAME } from '../../ui/cards.js';
import { fmtDur } from '../format.js';
import { dayKey, weekday, weekStart } from '../time.js';
import {
  weekData, goalProgress, goalPerDay, streakInfo, heatmap, weeklyTotals, monthSplit, totalTime, byTool, bySong, bySongField, byFreeTag, strictTime,
} from '../stats.js';
import { CORE_FEATURES, CHURCH_MODULES, isOn, setFeature, changeGoal, toggleDay, ACCENTS, accentColor, applyTheme, applyScale, uiScale, autoScale, screenShort, layoutWidth, SCALE_MIN, SCALE_MAX, SCALE_STEP, visibleTabs, hiddenTabs, editTabs, orderTabs, makeTab, unmakeTab, TABS_MAX, FIXED_TABS } from '../settings.js';
import { scaleOf } from '../library.js';
import { demoLeft, addDemo, removeDemo } from '../demo.js';
import { isBackup } from '../store.js';
import { exportSheet, importSheet } from './backupsheet.js';
import { playerAvailable, bgCtl, canOverlay, askOverlay } from '../player.js';
import { meleteHTML, bindMelete, mountMelete } from './melete.js';
import { remindViewHTML, bindRemindView } from './remindview.js';
import { setsOf, QSETS, qsetsFor } from '../quotes.js';
const QUOTE_IC = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M10 7H6a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v1.5A1.5 1.5 0 0 1 6.5 18H6v2h.5A3.5 3.5 0 0 0 10 16.5zm10 0h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v1.5a1.5 1.5 0 0 1-1.5 1.5H16v2h.5a3.5 3.5 0 0 0 3.5-3.5z"/></svg>';
import { PALETTE_IDS, PALETTES, SPECIAL_PALETTES, ownPalette, OWN_DEFAULT, isHex, hueColor, onColor, TEXT_MODES } from '../palettes.js';
import { modules, moduleById, skippedModules } from '../../modules/index.js';
import { packsHTML, bindPacks } from './packs.js';
import { moduleName } from '../modules.js';
import { AVATAR, CHEV, IC, tabIds, TAB_ICONS, TAB_MODULES, tabIcon, weekdays, mBadge } from './common.js';
import { TOS_VER, TOS_HTML, PRIV_HTML, OFL_TEXT } from '../legal.js';
import { bgAvailable, bgStatus, bgRows, bindBg } from '../background.js';
import { guardAvailable } from '../guard.js';
import { helpOf, showHelp, resetHelp, coreHelp, coreTopic, CORE_TOPICS } from '../help.js';
import { freeTagName, trackMode } from '../session.js';
import { dockGroups } from './session.js';
import { INSTRUMENTS, PRIOR_MAX, gemSec, saveProfile, newProfile } from '../profile.js';
import { APP_ICON_IDS, appIconSVG } from '../../ui/appicons.js';
import { iconOf, setAppIcon } from '../appicon.js';
import { mountStones } from './home.js';
import { problemOf } from '../integrity.js';
import { APP_VERSION } from '../report.js';
import { PLAN_IDS, dayKeyOf } from '../reading.js';
import { planSheet } from './bibleplan.js';
import { pcOf, pair, syncNow, forgetPc, oldPc, fpCheck, PORT, devsOf, forgetDev, meshClient } from '../sync.js';
import { setlistsOf } from '../guest.js';
import { scanQR, parsePair, pairPayload } from './qrscan.js';

// Значки страниц — оттенки палитры (settings.palette)
const iconBg = (st, hue) => '--tc:' + hueColor(st, hue);
const PAGES = {
  me: ['orange', '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.6"/><path d="M5 19.5c1.4-3.2 4-4.6 7-4.6s5.6 1.4 7 4.6"/></svg>'],
  feat: ['green', '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="6"/><circle cx="15" cy="12" r="3.5"/></svg>'],
  homes: ['teal', '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="5" rx="1.6"/><rect x="4" y="11" width="7" height="9" rx="1.6"/><rect x="13" y="11" width="7" height="9" rx="1.6"/></svg>'],
  tabs: ['graphite', '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 15.5h17M9.2 15.5v4M14.8 15.5v4"/></svg>'],
  stats: ['blue', '<svg viewBox="0 0 24 24"><path d="M5 20v-6M10 20V9M15 20v-8M20 20V5"/></svg>'],
  week: ['orange', '<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/></svg>'],
  mascot: ['indigo', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M7.5 10q2.2-2.6 4.5 0q2.3-2.6 4.5 0M10.6 11.6v2.4q1.4 1 2.8 0v-2.4M12 15v1.6M9.5 17.2q2.5 1.4 5 0"/></svg>'],
  notif: ['red', '<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>'],
  look: ['indigo', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" style="fill:var(--on,#fff)"/></svg>'],
  help: ['blue', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6M12 16.8v.2"/></svg>'],
  link: ['teal', '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="13" height="9.5" rx="1.6"/><path d="M6 18h6M9 14.5V18"/><rect x="16.5" y="8" width="5" height="10" rx="1.4"/></svg>'],
  sound: ['pink', '<svg viewBox="0 0 24 24"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>'],
  bible: ['brown', '<svg viewBox="0 0 24 24"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19M12 6.5v6M9.5 8.8h5"/></svg>'],
  data: ['green', '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/></svg>'],
};
// Страницы группами: я и практика, экран, инструменты и подсказки, помощь и данные
// Карта настроек (решение автора 06.11.2026): практика · экран · звук, маскот, Библия · связь · помощь
const PAGE_GROUPS = [['me', ['me', 'week', 'notif', 'stats', 'data']], ['screen', ['look', 'tabs', 'feat']], ['more', ['sound', 'mascot', 'bible']], ['link', ['link']], ['help', ['help']]]; // главная правится на самой главной (удержание блока)
// Страницы, которых нет в режиме «Только инструменты»
const PLAIN_HIDE = ['stats', 'notif', 'mascot'];
// «Сообщить о проблеме» — лист со строчками журнала
const BUG = '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 14h7M9 17h4"/></svg>';
// Чат тестеров и обсуждения (Telegram) — открывается только по нажатию, в браузере или приложении Telegram
const STONE_IC = '<svg viewBox="0 0 24 24"><path d="M5 15.5c-.6-3.4 1.6-7 5.2-8.2 3.7-1.2 7.6.3 8.6 3.4 1 3.2-1.2 6.6-4.9 7.7-3.8 1.1-8.3.4-8.9-2.9z"/></svg>';
const VAR_IC = '<svg viewBox="0 0 24 24"><path d="M6 4v6M6 14v6M12 4v2M12 10v10M18 4v10M18 18v2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="18" cy="16" r="2"/></svg>';
const UPD_IC = '<svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/></svg>';
const PLANE = '<svg viewBox="0 0 24 24"><path d="M21 4 3 11.2l6.3 2.3L18 7.5l-6.8 7.4V20l3.4-3.6 4 3L21 4z"/></svg>';
const VERSION = APP_VERSION;

/* ---------- статистика ---------- */

function barsSVG(vals, labels, goalLine, hl, aria) {
  const W = 320, H = 120, n = vals.length, bw = Math.min(30, (W - 8 * (n - 1)) / n), gap = (W - n * bw) / (n - 1);
  const top = Math.max(...vals, goalLine || 0, 1);
  let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + 18) + '" role="img" aria-label="' + esc(aria) + '">';
  for (let i = 0; i <= 2; i++) { const y = H - ((H - 6) * i) / 2; s += '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="var(--sep)"/>'; }
  if (goalLine) { const gy = H - (goalLine / top) * (H - 6); s += '<line x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '" stroke="var(--l2)" stroke-dasharray="3 4"/>'; }
  vals.forEach((v, i) => {
    const bh = v ? Math.max(4, (v / top) * (H - 6)) : 0, x = i * (bw + gap);
    s += '<rect x="' + x + '" y="' + (H - bh) + '" width="' + bw + '" height="' + bh + '" rx="' + Math.min(5, bw / 2) + '" fill="' + (hl === undefined || hl === i ? 'var(--tint)' : 'var(--l3)') + '"/><text x="' + (x + bw / 2) + '" y="' + (H + 15) + '" text-anchor="middle">' + esc(labels[i]) + '</text>';
  });
  return s + '</svg>';
}

const hbars = (arr) => {
  const mx = Math.max(...arr.map((x) => x.v), 1);
  return '<div style="margin-top:6px">' + arr.map((x) => '<div class="hrow"><span class="n">' + esc(x.n) + '</span><span class="hb"><i style="width:' + (x.v / mx) * 100 + '%"></i></span><span class="num l2" style="font-size:14px">' + fmtDur(x.v) + '</span></div>').join('') + '</div>';
};
const card = (title, right, body) => '<div class="card"><div class="ch"><span>' + title + '</span><span>' + right + '</span></div>' + body + '</div>';
const ddmm = (ts) => { const d = new Date(ts); return d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0'); };

function statsHTML(app) {
  const all = app.store.sessions(), st = app.store.state.settings, now = Date.now();
  let h = '<div class="large">' + t('stats.title') + '</div>';
  if (!all.length) return h + unverCard(app) + '<div class="empty"><b>' + t('stats.emptyTitle') + '</b>' + t('stats.emptyText') + '<br><button class="btn fill" data-go="home">' + t('stats.toPractice') + '</button></div>';
  const w = weekData(all, now), m = monthSplit(all, now), goal = st.goalMin * 60, pw = goalProgress(w.total, st), sk = streakInfo(all, st, now);
  h += '<div class="tiles num"><div class="tile"><b>' + fmtDur(w.total) + '</b><span>' + t('stats.week') + '</span></div><div class="tile"><b>' + fmtDur(m.total) + '</b><span>' + t('stats.month') +
    '</span></div><div class="tile"><b>' + fmtDur(totalTime(all)) + '</b><span>' + t('stats.total') + '</span></div></div><div class="sgrid">';
  h += card(t('stats.thisWeek'), t('streak.goal', { goal: fmtDur(goal) }), '<div class="wkhead">' + goalRing(pw, true, t('home.ringAria', { p: Math.round(pw * 100) })) + '<div><div class="cv num" style="margin:0">' + fmtDur(w.total) +
    '</div><div class="l2" style="font-size:14px">' + (pw > 1 ? t('stats.over', { p: Math.round((pw - 1) * 100) }) : pw >= 1 ? t('stats.met') : t('stats.left', { d: fmtDur(goal - w.total) })) + '</div>' +
    (isOn(st, 'streak') ? '<button class="spill" data-act="streak" style="margin-top:6px">' + FLAME + '<b class="num">' + sk.weeks + '</b><span>' + esc(t('streak.inRowShort', { w: tn('streak.weeksWord', sk.weeks) })) + '</span></button>' : '') +
    '</div></div>' + barsSVG(w.per, weekdays(), goalPerDay(st), weekday(now), t('stats.byDayAria')));
  // Строгие часы — только при включённом экране; всегда золотые
  const sAll = strictTime(all), sWeek = strictTime(all, weekStart(now)), tot = totalTime(all);
  if (sAll || trackMode(st) === 'strict') {
    h += card('<span class="gold">' + t('track.strictCard') + '</span>', t('track.mode.' + trackMode(st)),
      '<div class="cv num gold">' + fmtDur(sAll) + '</div><div class="l2" style="font-size:14px">' + t('track.strictWeek', { d: fmtDur(sWeek), p: tot ? Math.round((sAll / tot) * 100) : 0 }) + '</div>' +
      '<div class="split"><i style="width:' + (tot ? (sAll / tot) * 100 : 0) + '%;background:var(--gold)"></i><i style="flex:1;background:var(--l3)"></i></div>' +
      '<div class="legend"><span><i style="background:var(--gold)"></i>' + t('track.strict', { d: fmtDur(sAll) }) + '</span><span><i style="background:var(--l3)"></i>' + t('track.normal', { d: fmtDur(tot - sAll) }) + '</span></div>');
  }
  const hm = heatmap(all, now), loc = getLang() === 'en' ? 'en-GB' : getLang() === 'uz' ? 'uz-Latn' : 'ru-RU';
  h += card(t('stats.12w'), tn('stats.activeDays', hm.active), '<div class="heat" role="img" aria-label="' + t('stats.heatAria') + '">' + hm.cells.map((c) =>
    '<i title="' + esc(new Date(c.t).toLocaleDateString(loc) + ': ' + (c.v ? fmtDur(c.v) : t('stats.none'))) + '" style="' + (c.future ? 'opacity:.35;' : '') +
    (c.v ? 'background:color-mix(in srgb,var(--tint) ' + Math.round(c.level * 100) + '%,var(--fill))' : '') + '"></i>').join('') + '</div>');
  const wk = weeklyTotals(all, now);
  h += card(t('stats.byWeek'), t('stats.avg', { d: fmtDur(wk.avg) }), barsSVG(wk.weeks.map((x) => x.v), wk.weeks.map((x) => ddmm(x.a)), goal, 7, t('stats.byWeekAria')));
  const pc = (v) => (m.total ? (v / m.total) * 100 : 0);
  h += card(t('stats.thisMonth'), fmtDur(m.total), '<div class="split"><i style="width:' + pc(m.free) + '%;background:var(--ink)"></i><i style="width:' + pc(m.songs) + '%;background:var(--tint)"></i><i style="flex:1;background:#646493"></i></div>' +
    '<div class="legend"><span><i style="background:var(--ink)"></i>' + t('stats.free', { d: fmtDur(m.free) }) + '</span><span><i style="background:var(--tint)"></i>' + t('stats.songs', { d: fmtDur(m.songs) }) +
    '</span><span><i style="background:#646493"></i>' + t('stats.tools', { d: fmtDur(m.tool) }) + '</span></div>');
  // Модуль могли выключить или убрать — тогда название из строк ядра (tool.<id>), иначе id
  const toolName = (id) => (moduleById(id) ? moduleName(moduleById(id)) : t('tool.' + id) !== 'tool.' + id ? t('tool.' + id) : id);
  const tools = byTool(all).map((x) => ({ n: toolName(x.n), v: x.v }));
  if (tools.length) h += card(t('stats.toolsTitle'), t('stats.total'), hbars(tools));
  const songs = app.store.songs(), byS = bySong(all, songs).map((x) => ({ n: songs.find((s) => s.id === x.n).title, v: x.v }));
  if (byS.length) h += card(t('stats.songsTitle'), t('stats.byTime'), hbars(byS));
  const g = bySongField(all, songs, 'genre').map((x) => ({ n: x.n || t('stats.noGenre'), v: x.v }));
  if (g.length) h += card(t('stats.genres'), '', hbars(g));
  const d = bySongField(all, songs, 'difficulty').map((x) => ({ n: x.n ? t('diff.' + x.n) : '—', v: x.v }));
  if (d.length) h += card(t('stats.difficulty'), '', hbars(d));
  const tags = byFreeTag(all).map((x) => ({ n: x.n ? freeTagName(x.n) : t('stats.noTag'), v: x.v }));
  if (tags.length) h += card(t('stats.freeTitle'), t('stats.byTag'), hbars(tags));
  return h + '</div>' + unverCard(app);
}

// Неподтверждённые записи (src/core/integrity.js): в статистику не идут, видны только здесь
function unverCard(app) {
  const bad = app.store.unverified();
  if (!bad.length) return '';
  return '<button class="group" data-act="unver" style="display:block;width:100%;text-align:left;margin-top:14px"><div class="cell"><span class="grow">' + t('unver.title') +
    '</span><span class="val num">' + bad.length + ' · ' + fmtDur(totalTime(bad)) + '</span>' + CHEV + '</div></button><p class="ftr">' + t('unver.hint') + '</p>';
}

export function unverifiedSheet(app) {
  const bad = app.store.unverified().slice().sort((a, b) => b.start - a.start), songs = app.store.songs();
  const loc = getLang() === 'en' ? 'en-GB' : getLang() === 'uz' ? 'uz-Latn' : 'ru-RU';
  const what = (r) => (r.songId && songs.find((s) => s.id === r.songId) ? songs.find((s) => s.id === r.songId).title
    : r.tool ? (moduleById(r.tool) ? moduleName(moduleById(r.tool)) : r.tool) : t('ses.free'));
  const when = (r) => { try { return new Date(r.start).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return '—'; } };
  sheet(() => snav(t('unver.title')) + '<p class="ftr" style="margin-top:0">' + t('unver.text') + '</p>' +
    '<div class="group">' + bad.slice(0, 300).map((r) => '<div class="cell"><span class="grow"><b style="font-weight:500">' + esc(what(r)) + '</b><br><span class="l2" style="font-size:13px">' +
      esc(when(r)) + ' · ' + t('unver.why.' + (problemOf(r) || 'day')) + '</span></span><span class="val num">' + fmtDur(r.dur || 0) + '</span></div>').join('') + '</div>');
}

export { freeTagName };

/* ---------- страницы настроек ---------- */

const psw = (key, on, label) => '<label class="sw"><input type="checkbox" data-psw="' + key + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(label) + '"><i></i></label>';

// Обо мне: имя, инструменты, уровень, опыт до приложения (то же, что при регистрации)
function meHTML(app) {
  const p = { ...newProfile(), ...(app.store.state.settings.profile || {}) };
  const chip = (attr, on, label) => '<button class="lchip pick mech' + (on ? ' on' : '') + '" ' + attr + ' aria-pressed="' + on + '" style="--c:var(--tint);--t:var(--on-tint)">' + esc(label) + '</button>';
  return '<div class="large">' + t('page.me') + '</div>' +
    '<div class="group"><label class="cell"><span class="grow">' + t('ob.name') + '</span><input class="inp" data-me="name" maxlength="40" placeholder="' + t('ob.namePh') + '" aria-label="' + t('ob.name') + '" value="' + esc(p.name) + '"></label></div>' +
    '<div class="hdr">' + t('ob.instTitle') + '</div><div class="group"><div class="cellcol"><div class="pickrow">' + INSTRUMENTS.map((k) => chip('data-meinst="' + k + '"', p.instruments.includes(k), t('inst.' + k))).join('') + '</div></div></div>' +
    // уровень — только при регистрации: он настраивает инструменты, а не значится в профиле (решение автора)
    '<div class="hdr">' + t('ob.expTitle') + '</div><div class="group"><label class="cell"><span class="grow">' + t('ob.hours') + '</span><input class="inp num" data-me="priorHours" type="number" inputmode="numeric" min="0" max="' + PRIOR_MAX + '" placeholder="0" aria-label="' + t('ob.hours') + '" value="' + (p.priorHours || '') + '"></label></div>' +
    '<p class="ftr">' + t('me.hint') + '</p>' +
    // свои песни, сборники цитат, профиль — файлом (его может собрать нейросеть по инструкции)
    '<div class="hdr">' + t('me.own') + '</div><div class="group"><button class="cell act" data-aidoc>' + t('ai.title') + '</button>' +
    '<button class="cell act" data-loadfile>' + t('ai.load') + '</button></div><p class="ftr">' + t('me.ownHint') + '</p>';
}

function weekHTML(app) {
  const st = app.store.state.settings, WD = weekdays();
  return '<div class="large">' + t('week.title') + '</div>' +
    '<div class="group"><div class="cell"><span class="grow">' + t('feat.toolsOnly') + '</span>' + psw('toolsOnly', !!st.toolsOnly, t('feat.toolsOnly')) + '</div></div>' +
    '<p class="ftr">' + t('feat.toolsOnly.hint') + '</p>' +
    '<div class="group"><div class="cell"><span class="grow">' + t('week.autoTrack') + '</span>' + psw('autoTrack', st.autoTrack !== false, t('week.autoTrack')) + '</div>' +
    '<div class="cell"><span class="grow">' + t('week.showClock') + '</span>' + psw('showClock', st.showClock !== false, t('week.showClock')) + '</div></div>' +
    '<p class="ftr">' + t('week.autoHint') + '</p>' +
    '<div class="hdr">' + t('track.title') + '</div><div class="group"><div class="cellcol">' + seg('track', [['normal', t('track.mode.normal')], ['strict', t('track.mode.strict')]], trackMode(st), t('track.title')) +
    '<div class="segcap">' + t('track.hint.' + trackMode(st)) + '</div></div></div><p class="ftr">' + t('track.hint') + '</p>' +
    '<div class="group"><div class="cell"><span class="grow">' + t('presence.title') + '</span>' + psw('micPresence', !!st.micPresence, t('presence.title')) + '</div></div>' +
    '<p class="ftr">' + t('presence.hint') + '</p>' +
    // в режиме «Только инструменты» функции ядра (ударный режим, значок) и так выключены — переключатели не нужны
    (st.toolsOnly ? '' : '<div class="hdr">' + t('feat.core') + '</div><div class="group">' + CORE_FEATURES.map((k) => featRow(st, k, k === 'mastery' ? STONE_IC : k === 'quote' ? QUOTE_IC : FLAME, k === 'mastery' ? '#646493' : k === 'quote' ? '#5E7E6A' : '#9C7242', t('feat.' + k), t('feat.about.' + k))).join('') + '</div>') +
    '<div class="hdr">' + t('week.days') + '</div><div class="group"><div class="cellcol"><div class="seg" role="group" aria-label="' + t('week.days') + '">' +
    WD.map((d, i) => '<button data-day="' + i + '" aria-pressed="' + !!st.days[i] + '">' + d + '</button>').join('') + '</div></div></div>' +
    '<p class="ftr">' + t('week.restHint') + '</p>' +
    '<div class="hdr">' + t('week.goal') + '</div><div class="group"><div class="cell"><span class="grow">' + t('week.perWeek') + '</span><span class="val num" style="color:var(--ink);margin-right:6px">' + fmtDur(st.goalMin * 60) +
    '</span><span class="stepper"><button data-goal="-30" aria-label="' + t('week.minus30') + '">−</button><button data-goal="30" aria-label="' + t('week.plus30') + '">+</button></span></div></div>';
}

// Звук (своя страница по карте 06.11.2026): буфер, ресурсы, движок, реверберация, нагрузка; дорожки и разбор записей
function soundHTML(app) {
  const st = app.store.state.settings;
  return '<div class="large">' + t('page.sound') + '</div>' +
    // медиатека: дорожки и тональность с темпом — сами, в фоне (src/core/autostems.js)
    '<div class="hdr">' + t('auto.title') + '</div><div class="group">' + (app.jobs && app.jobs.supported() ? '<div class="cellcol">' + seg('autostems', (fullStems() ? [['off', t('auto.off')], ['2', '2'], ['4', '4'], ['6', '6']] : [['off', t('auto.off')], ['2', t('auto.vocInst')]]), autoMode(st), t('auto.stems')) + '<div class="segcap">' + t(isDesktop() ? 'auto.stemsHint' : fullStems() ? 'auto.stemsHintDev' : 'auto.stemsHintPhone') + '</div></div><div class="cell"><span class="grow">' + t('auto.hq') + '<span class="bksub">' + t(isDesktop() ? 'auto.hqHintPc' : fullStems() ? 'auto.hqHintDev' : 'auto.hqHint') + '</span></span>' + psw('autoHq', autoHq(st), t('auto.hq')) + '</div>' +
      '<div class="cellcol">' + seg('autopower', [['charge', t('auto.powerCharge')], ['always', t('auto.powerAlways')]], autoPower(st), t('auto.power')) + '<div class="segcap">' + t('auto.powerHint') + '</div></div>' : '') +
    '<div class="cell"><span class="grow">' + t('auto.ana') + '</span>' + psw('autoAna', autoAna(st), t('auto.ana')) + '</div>' +
    (app.jobs && app.jobs.lyricsSupported() ? '<div class="cell"><span class="grow">' + t('auto.lyr') + '<span class="bksub">' + t('auto.lyrHint') + '</span></span>' + psw('autoLyr', autoLyr(st), t('auto.lyr')) + '</div>' : '') + '</div><p class="ftr">' + t('auto.anaHint') + '</p>' +
    // звук: буфер (задержка против треска) и режим ресурсов (полный / экономный для слабых телефонов) — src/audio/perf.js
    '<div class="hdr">' + t('snd.title') + '</div><div class="group"><div class="cellcol">' + seg('sndmode', [['fast', t('snd.fast')], ['bal', t('snd.bal')], ['smooth', t('snd.smooth')]], app.audio.mixer.state.mode, t('snd.mode')) + '</div>' +
    '<div class="cellcol">' + seg('sndperf', [['full', t('snd.full')], ['eco', t('snd.eco')]], app.audio.mixer.state.perf, t('snd.perf')) + '</div>' +
    '<div class="cellcol">' + seg('sndengine', [['wl', t('snd.wl')], ['nodes', t('snd.nodes')]], app.audio.mixer.engine, t('snd.engine')) + '<div class="segcap">' + t('snd.engineHint') + '</div></div>' +
    '<div class="cellcol">' + seg('sndverb', [['light', t('snd.verbLight')], ['conv', t('snd.verbConv')]], app.audio.mixer.verb, t('snd.verb')) + '<div class="segcap">' + t('snd.verbHint') + '</div></div>' +
    '<div class="cellcol">' + seg('sndalgo', [['melete', 'Melete'], ['galactic', 'Galactic'], ['verbity', 'Verbity']], app.audio.mixer.verbAlgo, t('snd.algo')) + '<div class="segcap">' + t('snd.algoHint') + '</div></div></div>' +
    '<p class="ftr">' + t('snd.hint') + '</p>' +
    '<div class="group"><div class="cell"><span class="grow">' + t('snd.load') + '</span><span class="val num" data-sndload style="color:var(--ink)">' + (app.audio.load && app.audio.load.ready ? Math.round(app.audio.load.value * 100) + ' %' : '–') + '</span></div></div>' +
    '<p class="ftr">' + t('snd.loadHint') + '</p>' +
    '';
}

// Строка функции с переключателем (data-feat) — «Неделя и цель», «Модули и функции»
function featRow(st, id, icon, color, name, about) {
  return '<div class="cell"><span class="ticon" style="--tc:' + color + ';--on:' + onColor(color) + '">' + icon + '</span><span class="grow"><span>' + esc(name) + '</span>' +
    (about ? '<span class="st l2" style="display:block;font-size:13px">' + esc(about) + '</span>' : '') + '</span>' +
    '<label class="sw"><input type="checkbox" data-feat="' + id + '"' + (isOn(st, id) ? ' checked' : '') + ' aria-label="' + esc(name) + '"><i></i></label></div>';
}

// «Библия» (церковный режим): план чтения, кнопки вверху или внизу; переводы — в самой Библии
function bibleHTML(app) {
  const st = app.store.state.settings, top = !!((app.device.bible || {}).barTop);
  return '<div class="large">' + t('page.bible') + '</div>' +
    '<div class="group"><label class="cellcol"><span>' + t('church.plan') + '</span><select class="sortsel" data-bplan style="width:100%;margin-top:8px;text-align:left" aria-label="' + esc(t('church.plan')) + '">' +
      ['none', ...PLAN_IDS].map((k) => '<option value="' + k + '"' + (((st.bible && st.bible.plan) || 'none') === k ? ' selected' : '') + '>' + t('plan.' + k) + '</option>').join('') +
      // свои планы — тем же списком
      ((st.bible && st.bible.custom) || []).map((c) => '<option value="' + esc(c.id) + '"' + (st.bible.plan === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label>' +
      (st.bible && st.bible.plan ? '<button class="cell act" data-brestart>' + t('church.restart') + '</button>' : '') +
      (st.bible && st.bible.plan && String(st.bible.plan).startsWith('c') ? '<button class="cell act" data-bplanedit>' + t('bplan.edit') + '</button>' : '') +
      '<button class="cell act" data-bplannew>' + t('bplan.new') + '</button>' + '</div>' +
    '<p class="ftr">' + t('church.hintOn') + (st.bible && st.bible.start ? ' ' + t('church.since', { d: st.bible.start.split('-').reverse().join('.') }) : '') + '</p>' +
    '<div class="hdr">' + t('bset.view') + '</div><div class="group"><div class="cell"><span class="grow">' + t('bset.barTop') + '</span><label class="sw"><input type="checkbox" data-bbartop' + (top ? ' checked' : '') + ' aria-label="' + esc(t('bset.barTop')) + '"><i></i></label></div></div>' +
    '<p class="ftr">' + t('bset.hint') + '</p>';
}

// Уведомления: каждое выключается раз и навсегда
// Маскот (Мелетий, Мелета или без маскота): характер, напоминания, тамагочи, слова дня — свой раздел (решение автора)
function mascotHTML(app) {
  const st = app.store.state.settings;
  const row = (k, on) => '<div class="group"><div class="cell"><span class="grow">' + t('notif.' + k) + '</span>' + psw(k, on, t('notif.' + k)) + '</div></div><p class="ftr">' + t('notif.' + k + '.hint') + '</p>';
  return '<div class="large">' + t('page.mascot') + '</div>' + meleteHTML(st, { remind: false }) +
    // наборы слов Мелеты (слово дня и напоминания)
    (!st.toolsOnly && isOn(st, 'quote') ? '<div class="hdr">' + t('qset.title') + '</div><div class="group">' + qsetsFor(st).map((k) => '<label class="cell"><span class="grow">' + t('qset.' + k) + '</span>' +
      '<input type="checkbox" data-qset="' + k + '"' + (setsOf(st).includes(k) ? ' checked' : '') + ' style="width:22px;height:22px"></label>').join('') +
      // свои сборники (из файла): включить, удалить
      (st.quoteBooks || []).map((b) => '<div class="cell"><span class="grow"><span>' + esc(b.title) + '</span><span class="st l2" style="display:block;font-size:13px">' + tn('share.nq', b.items.length) + '</span></span>' +
        '<button class="ic sm" data-qdel="' + esc(b.id) + '" aria-label="' + esc(t('qset.del') + ': ' + b.title) + '">' + IC.minus + '</button>' +
        '<input type="checkbox" data-qset="own:' + esc(b.id) + '"' + (setsOf(st).includes('own:' + b.id) ? ' checked' : '') + ' style="width:22px;height:22px;margin-left:10px" aria-label="' + esc(b.title) + '"></div>').join('') +
      '<button class="cell act" data-aidoc>' + t('qset.make') + '</button></div><p class="ftr">' + t('qset.hint') + '</p>' : '') +
    '<div class="hdr">' + t('rem.inApp') + '</div>' +
    row('askIdle', st.askIdle !== false) + row('noSoundNote', st.noSoundNote !== false) + row('rankNote', st.rankNote !== false);
}

function notifHTML(app) {
  const st = app.store.state.settings;
  return '<div class="large">' + t('page.notif') + '</div>' + remindViewHTML(app) + meleteHTML(st, { test: true, who: false, tama: false });
}

// Размер интерфейса: «Авто» или −/+ с шагом 5 %; предпросмотр главной и инструментов — телефон или планшет
function sizeHTML(app) {
  const st = app.store.state.settings, s = uiScale(st), auto = !(+st.uiScale), pct = Math.round(s * 100);
  // предпросмотр — этого устройства (выбора «телефон / планшет» нет: всё подстраивается само, слово автора 06.11.2026)
  const dev = screenShort() < 600 ? 'phone' : 'tablet';
  return '<div class="hdr">' + t('look.size') + '</div><div class="group"><div class="cellcol">' +
    '<div class="szrow"><button class="ic sm" data-uisz="-1" aria-label="' + esc(t('look.smaller')) + '"' + (s <= SCALE_MIN + 1e-6 ? ' disabled' : '') + '>' + IC.minus + '</button>' +
    '<b class="num szval">' + pct + '%</b>' +
    '<button class="ic sm" data-uisz="1" aria-label="' + esc(t('look.bigger')) + '"' + (s >= SCALE_MAX - 1e-6 ? ' disabled' : '') + '>' + IC.plus + '</button>' +
    '<button class="pill szauto" data-uisz="auto" aria-pressed="' + auto + '">' + t('look.sizeAuto') + (auto ? '' : ' · ' + Math.round(autoScale(screenShort()) * 100) + '%') + '</button></div>' +
    '<div class="szprev" data-szprev="' + dev + '"><figure><div class="szfr"></div><figcaption>' + t('look.prevHome') + '</figcaption></figure>' +
    '<figure><div class="szfr"></div><figcaption>' + t('look.prevTools') + '</figcaption></figure></div></div></div>' +
    '<p class="ftr">' + t('look.sizeHint') + '</p>';
}
// Нарисовать предпросмотр: раскладка шириной (ширина экрана / масштаб), уменьшенная до рамки
function mountSizePreview(app, root) {
  const box = root.querySelector('[data-szprev]');
  if (!box || !app.preview) return;
  const dev = box.dataset.szprev, short = screenShort(), base = dev === 'tablet' ? 820 : (short < 600 ? short : 390), h = dev === 'tablet' ? 1180 : base * 2.1;
  const st = app.store.state.settings, s = +st.uiScale ? uiScale(st) : autoScale(base), L = layoutWidth(base, s), tabsH = app.preview.tabs();
  box.querySelectorAll('.szfr').forEach((fr, i) => {
    const W = fr.clientWidth || 140, k = W / L, H = Math.round(h / s);
    fr.style.height = Math.round(H * k) + 'px';
    fr.innerHTML = '<div class="szin" style="width:' + L + 'px;height:' + H + 'px;transform:scale(' + k + ')"><main class="wrap"></main>' +
      '<nav class="tabbar"><div class="in" style="grid-template-columns:repeat(' + ((tabsH.match(/class="tab"/g) || [1]).length) + ',1fr)">' + tabsH + '</div></nav></div>';
    try { (i ? app.preview.tools : app.preview.home)(fr.querySelector('main')); } catch { /* предпросмотр необязателен */ }
  });
}

// Палитры: полоска оттенков (как будут выглядеть инструменты) и название
const PAL_SHOW = ['orange', 'red', 'yellow', 'green', 'mint', 'cyan', 'blue', 'indigo', 'purple', 'pink'];
function paletteHTML(st) {
  const cur = st.palette === 'own' ? 'own' : PALETTES[st.palette] ? st.palette : 'classic';
  const sw = (P) => '<span class="palrow">' + PAL_SHOW.map((h) => '<i style="background:' + P[h] + '"></i>').join('') + '</span>';
  const tile = (k, P, name) => '<button class="pal' + (cur === k ? ' on' : '') + '" data-pal="' + k + '" aria-pressed="' + (cur === k) + '">' + sw(P) + '<span class="paln">' + esc(name) + '</span></button>';
  const main = isHex(st.ownMain) ? st.ownMain : OWN_DEFAULT, bg = isHex(st.ownBg) ? st.ownBg : null;
  // все палитры — одной сеткой (и «Лунный свет»); свой цвет — широкая плитка с двумя кружками: основной и фон
  return '<div class="hdr">' + t('pal.title') + '</div><div class="pals" role="group" aria-label="' + esc(t('pal.title')) + '">' +
    [...PALETTE_IDS, ...SPECIAL_PALETTES].map((k) => tile(k, PALETTES[k], t('pal.' + k))).join('') +
    '<div class="pal wide ownp' + (cur === 'own' ? ' on' : '') + '" data-pal="own" role="button" tabindex="0" aria-pressed="' + (cur === 'own') + '">' + sw(ownPalette(main)) +
    '<span class="ownrow"><span class="paln">' + t('pal.own') + '</span>' +
    '<label class="owsw"><input type="color" class="owncol" data-owncolor="main" value="' + main.toLowerCase() + '" aria-label="' + esc(t('own.main')) + '"><span>' + t('own.main') + '</span></label>' +
    '<label class="owsw"><input type="color" class="owncol" data-owncolor="bg" value="' + (bg || '#f3f2ee').toLowerCase() + '" aria-label="' + esc(t('own.bg')) + '"><span>' + t('own.bg') + '</span></label>' +
    (bg ? '<button class="owx" data-ownbgreset aria-label="' + esc(t('own.bgReset')) + '">✕</button>' : '') + '</span></div>' +
    '</div><p class="ftr">' + t('own.hint') + '</p>' +
    // цвет текста и значков на цветных кнопках, метках, событиях
    '<div class="hdr">' + t('ontext.title') + '</div><div class="group"><div class="cellcol">' +
    seg('ontext', TEXT_MODES.map((k) => [k, t('ontext.' + k)]), TEXT_MODES.includes(st.onText) ? st.onText : 'auto', t('ontext.title')) +
    '<div class="segcap">' + t('ontext.hint') + '</div></div></div>';
}

function lookHTML(app) {
  const st = app.store.state.settings;
  const monoLang = st.uiStyle === 'mono' && st.monoLang !== false;
  return '<div class="large">' + t('look.title') + '</div>' + (monoLang ? '' :
    '<div class="hdr">' + t('look.lang') + '</div><div class="group"><div class="cellcol"><div class="seg uc" role="group" aria-label="' + t('look.lang') + '">' +
    LANGS.map((k) => '<button data-lang="' + k + '" lang="' + k + '" aria-pressed="' + (getLang() === k) + '">' + LANG_NAMES[k] + '</button>').join('') + '</div></div></div>') +
    sizeHTML(app) +
    '<div class="hdr">' + t('look.theme') + '</div><div class="group"><div class="cellcol">' + seg('theme', [['system', t('look.auto')], ['light', t('look.light')], ['dark', t('look.dark')]], st.theme, t('look.theme')) + '</div></div>' +
    ('<div class="hdr">' + t('mono.title') + '</div><div class="group"><div class="cellcol">' + seg('uistyle', [['default', t('mono.default')], ['mono', t('mono.name')]], st.uiStyle === 'mono' ? 'mono' : 'default', t('mono.title')) +
    '<div class="segcap">' + t('mono.hint') + '</div></div></div>') +
    (st.uiStyle === 'mono' ? '<div class="group" style="margin-top:10px"><div class="cell"><span class="grow">' + t('mono.lang') + '</span>' + psw('monoLang', st.monoLang !== false, t('mono.lang')) + '</div></div><p class="ftr">' + t('mono.langHint') + '</p>' +
      // без текста: значки, графика и цифры на рабочих экранах; настройки и диалоги — с текстом
      '<div class="group"><div class="cell"><span class="grow">' + t('mono.bare') + '</span>' + psw('monoBare', !!st.monoBare, t('mono.bare')) + '</div></div><p class="ftr">' + t('mono.bareHint') + '</p>' : '') +
    // иконка приложения: Мелета, Мелетий, музыкальные значки
    '<div class="hdr">' + t('icon.title') + '</div><div class="icgrid" role="group" aria-label="' + esc(t('icon.title')) + '">' + APP_ICON_IDS.map((k) => '<button type="button" class="icopt' + (iconOf(st) === k ? ' on' : '') + '" data-appicon="' + k + '" aria-pressed="' + (iconOf(st) === k) + '" aria-label="' + esc(t('icon.' + k)) + '">' +
      appIconSVG(k, { size: 54 }) + '<span>' + t('icon.' + k) + '</span></button>').join('') + '</div><p class="ftr">' + t('icon.hint') + '</p>' +
    // стихи разделов — в обоих видах, только в церковном режиме
    (st.church ? '<div class="group" style="margin-top:16px"><button class="cell act" data-verses>' + t('verses.title') + '</button></div><p class="ftr">' + t('verses.hint') + '</p>' : '') +
    (st.uiStyle === 'mono' ? '' : '<div class="hdr">' + t('look.style') + '</div><div class="skins">' + [['paper', t('look.paper'), '#F4EFE6', '#2B2620'], ['oled', 'OLED', '#000', '#fff']].map(([k, n, bg, fg]) =>
      '<button class="skin' + (st.theme === k ? ' on' : '') + '" data-skin="' + k + '" aria-pressed="' + (st.theme === k) + '" style="background:' + bg + ';color:' + fg + '">' + n + '</button>').join('') + '</div>') +
    (st.uiStyle === 'mono' ? '' : paletteHTML(st) +
    '<div class="hdr">' + t('look.accent') + '</div><div class="group"><div class="cellcol"><div class="swgrid">' + ACCENTS.map(([k]) =>
      '<button class="swc' + ((st.accent || 'orange') === k ? ' on' : '') + '" data-acc="' + k + '" aria-pressed="' + ((st.accent || 'orange') === k) + '" style="background:' + accentColor(st, k) + '" aria-label="' + esc(t('look.accentAria', { c: t('accent.' + k) })) + '"></button>').join('') + '</div></div></div>') +
    '<div class="hdr">' + t('look.scale') + '</div><div class="group"><div class="cellcol">' + seg('scale', [['5', '1–5'], ['10', '1–10'], ['100', '%']], String(scaleOf(st)), t('look.scale')) + '</div><div class="cell center" style="gap:12px">' +
    [20, 60, 100].map((p) => mBadge(p, st)).join('') + '</div></div><p class="ftr">' + t('look.scaleHint') + '</p>';
}

// Папка Melete (Android): выбрать, синхронизировать, восстановить данные из папки
function folderHTML(app) {
  const F = app.folder;
  if (!F || !F.available) return '<div class="hdr">' + t('fold.title') + '</div><p class="ftr" style="margin-top:0">' + t('fold.webOnly') + '</p>';
  const s = F.state;
  return '<div class="hdr">' + t('fold.title') + '</div><div class="group">' +
    '<div class="cell"><span class="grow"><span>' + (s.ok ? esc(s.name || t('fold.chosen')) : t('fold.none')) + '</span>' +
    (s.ok ? '<span class="st l2" style="display:block;font-size:13px">' + (F.busy ? t('fold.busy') : F.last ? t('fold.last', { t: new Date(F.last).toLocaleTimeString(getLang(), { hour: '2-digit', minute: '2-digit' }) }) : t('fold.ready')) + '</span>' : '') + '</span></div>' +
    '<button class="cell act" data-fold="pick">' + t(s.ok ? 'fold.change' : 'fold.pick') + '</button>' +
    (s.ok ? '<button class="cell act" data-fold="sync">' + t('fold.sync') + '</button><button class="cell act" data-fold="restore">' + t('fold.restore') + '</button><button class="cell act danger" data-fold="forget">' + t('fold.forget') + '</button>' : '') +
    '</div><p class="ftr">' + t('fold.hint') + '</p>' + (s.ok ? copiesHTML() : '');
}
// Приём файлов с телефона по протоколу LocalSend (Windows): переключатель, адреса компьютера, как слать с телефона
function localSendHTML(app) {
  const L = app.localSend;
  if (!L || !L.available) return '';
  if (!(app.folder && app.folder.state.ok)) return '<div class="hdr">' + t('ls.title') + '</div><p class="ftr" style="margin-top:0">' + t('ls.needFolder') + '</p>';
  const on = L.enabled() && L.state.on;
  return '<div class="hdr">' + t('ls.title') + '</div><div class="group"><div class="cell"><span class="grow">' + t('ls.sw') + (on ? '<span class="bksub">' + esc(L.state.alias) + ' · ' + esc(L.state.ips.join(', ')) + ':53317</span>' : '') + '</span>' + psw('localSend', L.enabled(), t('ls.sw')) + '</div></div><p class="ftr">' + t('ls.hint') + '</p>';
}

// Копии с подписью в папке (Data/Backups): дата, время и кто сохранил; касание — загрузить (слиянием)
let copies = null;
const loadCopies = (app, done) => { const F = app.folder; if (!F || !F.state.ok || !F.backups) return; F.backups().then((l) => { copies = l; done(); }).catch(() => {}); };
function copiesHTML() {
  if (!copies) return '';
  const row = (f) => { const m = /^Melete (\d{4})-(\d\d)-(\d\d) (\d\d)-(\d\d)(?: — (.*?))?(?: \(\d+\))?\.json$/i.exec(f.name);
    const when = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toLocaleString(getLang() === 'uz' ? 'uz-Latn' : getLang(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : f.name;
    return '<button class="cell" data-bk="' + esc(f.name) + '"><span class="grow"><span>' + esc(when) + '</span><span class="st l2" style="display:block;font-size:13px">' + esc(m && m[6] ? m[6] : t('bk.noName')) +
      ' · ' + Math.max(1, Math.round((f.size || 0) / 1024)) + ' KB</span></span>' + icons.chev + '</button>'; };
  return '<div class="hdr">' + t('bk.title') + '</div><div class="group">' + (copies.length ? copies.map(row).join('') : '<div class="cell"><span class="grow l2">' + t('bk.none') + '</span></div>') + '</div><p class="ftr">' + t('bk.hint') + '</p>';
}

// Копии на устройстве (snapshots.js): суточные и перед обновлением; касание — загрузить (выбор частей)
let snaps = null;
const loadSnaps = (app, done) => { if (!app.snapshots) return; app.snapshots.list().then((l) => { snaps = l; done(); }).catch(() => { snaps = []; }); };
function snapsHTML() {
  if (!snaps || !snaps.length) return '';
  const fmt = (at) => new Date(at).toLocaleString(getLang() === 'uz' ? 'uz-Latn' : getLang(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return '<div class="hdr">' + t('snap.title') + '</div><div class="group">' + snaps.map((x) => '<button class="cell" data-snap="' + esc(x.id) + '"><span class="grow"><span>' + esc(fmt(x.at)) + '</span><span class="st l2" style="display:block;font-size:13px">' +
    esc(x.kind === 'update' ? t('snap.update') : t('snap.day')) + ' · ' + Math.max(1, Math.round((x.size || 0) / 1024)) + ' KB</span></span>' + icons.chev + '</button>').join('') + '</div><p class="ftr">' + t('snap.hint') + '</p>';
}

function dataHTML(app) {
  const demo = demoLeft(app);
  return '<div class="large">' + t('data.title') + '</div><div class="group"><button class="cell act" data-act="export">' + t('data.export') + '</button><button class="cell act" data-act="import">' + t('data.import') + '</button></div>' +
    '<p class="ftr">' + t('data.hint') + '</p>' +
    folderHTML(app) +
    snapsHTML() +
    // демо-набор: песни, табулатуры, ноты, записи и события — показать, как всё устроено; убирается одной кнопкой
    // демо-набор ставится при регистрации; здесь — только убрать (решение автора)
    (demo ? '<div class="hdr">' + t('demo.title') + '</div><div class="group"><button class="cell act danger" data-act="demo">' + t('demo.remove') + '</button></div>' +
    '<p class="ftr">' + t('demo.hint') + '</p>' : '') +
    '<div class="group" style="margin-top:28px"><button class="cell danger center" data-act="reset">' + t('data.reset') + '</button></div>';
}

// «Телефон и компьютер» — всё, что их связывает, в одном месте: подключение и синхронизация, ансамбль, раздача песен
// в сети и приём файлов (LocalSend)
const linkAvail = (app) => !!((app.syncSrv && app.syncSrv.avail) || Capacitor.isNativePlatform());
function linkHTML(app) {
  return '<div class="large">' + t('page.link') + '</div><p class="ftr" style="margin-top:0">' + t(isDesktop() ? 'link.howPc' : 'link.howPh') + '</p>' +
    meshHTML(app) + syncHTML(app) + guestHTML(app) + localSendHTML(app);
}

// Связь с компьютером (src/core/sync.js): на компьютере — включить и показать адрес с кодом, на телефоне — ввести их
// и синхронизировать по кнопке. Ход синхронизации на телефоне — строкой под кнопкой
let syncMsg = '', syncBusy = false, syncAddr = '';
// адрес компьютера: порт виден, если он не тот, что телефон подставит сам (у DEV и обычной версии порты разные)
const hostPort = (st) => (st.port && st.port !== PORT ? ':' + st.port : '');
// «Компьютер забыл этот телефон»: старый ключ не поможет — сразу форма подключения с прежним адресом, нужен только код
function onSyncErr(e) {
  if (e && (e.reason === 'key' || e.reason === 'pin')) { const pc = pcOf(); if (pc) { syncAddr = (pc.addr || '').replace(/^https?:\/\//, '').replace(':' + PORT, ''); forgetPc(); } }
  return syncErr(e);
}
const ago = (ts) => { if (!ts) return t('sy.never'); const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? t('sy.just') : m < 60 ? t('sy.min', { n: m }) : new Date(ts).toLocaleString(); };
function syncHTML(app) {
  const S = app.syncSrv;
  if (S && S.avail) {
    const st = S.state, peers = S.peers;
    return '<div class="hdr">' + t('sy.pcTitle') + '</div><div class="group"><div class="cell"><span class="grow">' + t('sy.pcSw') + '</span>' + psw('syncSrv', st.on, t('sy.pcSw')) + '</div>' +
      (st.on ? '<div class="cellcol sypair"><span class="l2">' + t('sy.addr') + '</span><b class="num sybig">' + esc((st.ips[0] || '—')) + '</b>' + (st.ips.length > 1 ? '<span class="l2">' + esc(st.ips.slice(1).join(', ')) + '</span>' : '') +
        '<span class="l2" style="margin-top:8px">' + t('sy.code') + '</span><b class="num sybig">' + esc(st.code.slice(0, 3) + ' ' + st.code.slice(3)) + '</b>' +
        (st.fp ? '<span class="l2" style="margin-top:8px">' + t('sy.check') + ' <b class="num">' + esc(fpCheck(st.fp)) + '</b></span>' : '') +
        // QR (слово автора 06.11.2026): телефон наводит камеру — адрес, код и отпечаток без ввода
        (st.ips[0] ? '<div class="syqr" data-qr="' + esc(pairPayload(st.ips[0], st.code, st.fp || '')) + '">' + qrHTML(pairPayload(st.ips[0], st.code, st.fp || '')) + '</div><span class="l2">' + t('qr.pcHint') + '</span>' : '') + '</div>' : '') +
      peers.map((x) => '<div class="cell"><span class="grow">' + esc(x.name) + '<span class="psub">' + t('sy.last', { when: ago(x.at) }) + '</span></span><button class="link danger" data-act="syforget" data-k="' + esc(x.key) + '">' + t('sy.forget') + '</button></div>').join('') +
      '<button class="cell act" data-act="ens">' + t('ens.open') + '</button>' +
      '</div><p class="ftr">' + (st.err === 'port' && !st.on ? '<b class="danger">' + t('sy.err.port2') + '</b><br>' : '') + t('sy.pcHint') + '</p>';
  }
  if (!Capacitor.isNativePlatform()) return '';
  const pc = pcOf();
  if (!pc && !syncAddr && oldPc()) { syncAddr = oldPc(); if (!syncMsg) syncMsg = t('sy.err.repair'); } // связь стала защищённой — один раз заново
  if (!pc) return '<div class="hdr">' + t('sy.phTitle') + '</div><div class="group">' +
    '<label class="cell"><span>' + t('sy.addr') + '</span><input class="inp" data-sy="addr" inputmode="decimal" placeholder="192.168.1.23" value="' + esc(syncAddr) + '" aria-label="' + esc(t('sy.addr')) + '"></label>' +
    '<label class="cell"><span>' + t('sy.code') + '</span><input class="inp" data-sy="code" inputmode="numeric" maxlength="7" placeholder="000 000" aria-label="' + esc(t('sy.code')) + '"></label>' +
    '<button class="cell act" data-act="sypair"' + (syncBusy ? ' disabled' : '') + '>' + t('sy.pair') + '</button>' +
    '<button class="cell act" data-act="syscan"' + (syncBusy ? ' disabled' : '') + '>' + t('qr.scan') + '</button></div>' + (syncMsg ? '<p class="ftr">' + esc(syncMsg) + '</p>' : ''); // как подключить — вверху раздела (link.howPh)
  const C = app.syncCli, busy = syncBusy || !!(C && C.busy), st = app.store.state.settings, wait = C ? C.waiting() : 0;
  return '<div class="hdr">' + t('sy.phTitle') + '</div><div class="group"><div class="cell"><span class="grow">' + esc(pc.name) + '<span class="psub">' + t('sy.last', { when: ago(pc.last) }) + (wait ? ' · ' + t('sy.waiting', { n: wait }) : '') + (pc.fp ? ' · ' + t('sy.check') + ' ' + esc(fpCheck(pc.fp)) : '') + '</span></span></div>' +
    '<button class="cell act" data-act="synow"' + (busy ? ' disabled' : '') + '>' + t(busy ? 'sy.busy' : 'sy.now') + '</button>' +
    (app.mesh && app.mesh.avail ? '<button class="cell act" data-act="pcrc">' + t('rc.open') + '</button>' : '') + // пульт компьютера (Melete DEV)
    '<button class="cell act" data-act="ens">' + t('ens.open') + '</button>' +
    '<div class="cell"><span class="grow">' + t('sy.pcWork') + '</span>' + psw('pcWork', st.pcWork !== false, t('sy.pcWork')) + '</div>' +
    '<div class="cell"><span class="grow">' + t('sy.auto') + '</span>' + psw('syncAuto', st.syncAuto !== false, t('sy.auto')) + '</div>' +
    '<button class="cell act danger" data-act="sypcforget">' + t('sy.forgetPc') + '</button></div><p class="ftr">' + (syncMsg ? esc(syncMsg) + '<br>' : '') + t('sy.what') + ' ' + t('sy.pcWorkHint') + '</p>';
}
// Связь всех со всеми (Melete DEV, слово автора 07.11.2026): телефон принимает подключения других устройств (QR, адрес и
// код — как у компьютера), сопряжённые устройства — списком: синхронизировать каждое, забыть. Компьютер — в разделе ниже
function meshHTML(app) {
  const S = app.mesh, srv = !!(S && S.avail), desk = isDesktop() && meshClient();
  if (!srv && !desk) return '';
  let h = '';
  if (srv) {
    const st = S.state, peers = S.peers, payload = st.ips[0] ? pairPayload(st.ips[0] + hostPort(st), st.code, st.fp || '') : '';
    h += '<div class="hdr">' + t('mesh.title') + '</div><div class="group"><div class="cell"><span class="grow">' + t('mesh.sw') + '</span>' + psw('meshOn', st.on, t('mesh.sw')) + '</div>' +
      (st.on ? '<div class="cellcol sypair"><span class="l2">' + t('sy.addr') + '</span><b class="num sybig">' + esc(st.ips[0] || '—') + '</b>' +
        '<span class="l2" style="margin-top:8px">' + t('sy.code') + '</span><b class="num sybig">' + esc(st.code.slice(0, 3) + ' ' + st.code.slice(3)) + '</b>' +
        (st.fp ? '<span class="l2" style="margin-top:8px">' + t('sy.check') + ' <b class="num">' + esc(fpCheck(st.fp)) + '</b></span>' : '') +
        (payload ? '<div class="syqr" data-qr="' + esc(payload) + '">' + qrHTML(payload) + '</div><span class="l2">' + t('mesh.qrHint') + '</span>' : '') + '</div>' : '') +
      peers.map((x) => '<div class="cell"><span class="grow">' + esc(x.name) + '<span class="psub">' + t('mesh.in') + ' · ' + t('sy.last', { when: ago(x.at) }) + '</span></span><button class="link danger" data-act="meshforget" data-k="' + esc(x.key) + '">' + t('sy.forget') + '</button></div>').join('') +
      '</div>';
  }
  const devs = devsOf();
  h += '<div class="hdr">' + t('mesh.devs') + '</div><div class="group">' +
    devs.map((d) => '<div class="cell"><span class="grow">' + esc(d.name) + '<span class="psub">' + t('sy.last', { when: ago(d.last) }) + (d.fp ? ' · ' + t('sy.check') + ' ' + esc(fpCheck(d.fp)) : '') + '</span></span>' +
      '<button class="link" data-act="devrc" data-a="' + esc(d.addr) + '">' + t('rc.open') + '</button><button class="link" data-act="devsync" data-a="' + esc(d.addr) + '"' + (syncBusy ? ' disabled' : '') + '>' + t('sy.now') + '</button><button class="link danger" data-act="devforget" data-a="' + esc(d.addr) + '">' + t('sy.forget') + '</button></div>').join('') +
    // подключить: телефон — QR камерой; везде — адрес и код с экрана того устройства
    (srv ? '<button class="cell act" data-act="syscan"' + (syncBusy ? ' disabled' : '') + '>' + t('mesh.add') + '</button>' : '') +
    '<label class="cell"><span>' + t('sy.addr') + '</span><input class="inp" data-mesh="addr" inputmode="decimal" placeholder="192.168.1.23" aria-label="' + esc(t('sy.addr')) + '"></label>' +
    '<label class="cell"><span>' + t('sy.code') + '</span><input class="inp" data-mesh="code" inputmode="numeric" maxlength="7" placeholder="000 000" aria-label="' + esc(t('sy.code')) + '"></label>' +
    '<button class="cell act" data-act="meshpair"' + (syncBusy ? ' disabled' : '') + '>' + t('mesh.pair') + '</button></div>' +
    '<p class="ftr">' + (syncMsg ? esc(syncMsg) + '<br>' : '') + t(desk ? 'mesh.hintPc' : 'mesh.hint') + '</p>';
  return h;
}
// Раздача в своей сети (src/core/guest.js, docs/guest-web.md): гости открывают песни в браузере телефона.
// Открытая — вбил адрес, и внутри; закрытая — только по QR-коду и с подтверждением здесь. Ведёт хозяин, можно передать гостю
let qrSvg = null; // генератор QR-кода — по требованию (лёгкий, MIT)
function qrHTML(text) {
  if (!qrSvg) { import('qrcode-generator').then((m) => { qrSvg = m.default || m; document.querySelectorAll('[data-qr]').forEach((el) => { el.innerHTML = qrHTML(el.dataset.qr); }); }); return ''; }
  const q = qrSvg(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), c = 6, m = 4 * c, W = n * c + 2 * m;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += 'M' + (m + x * c) + ' ' + (m + y * c) + 'h' + c + 'v' + c + 'h-' + c + 'z';
  return '<svg viewBox="0 0 ' + W + ' ' + W + '" role="img" aria-label="QR"><rect width="' + W + '" height="' + W + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}
function guestHTML(app) {
  const G = app.guest;
  if (!G || !G.avail) return '';
  const c = G.cfg, on = G.status.on, sets = setlistsOf(app.store.state), url = G.url(c.mode === 'closed');
  const guests = on ? G.guests() : [];
  return '<div class="hdr">' + t('gs.title') + '</div><div class="group"><div class="cell"><span class="grow">' + t('gs.on') + '</span>' + psw('guestOn', on, t('gs.on')) + '</div>' +
    '<div class="cellcol">' + seg('gmode', [['open', t('gs.open')], ['closed', t('gs.closed')]], c.mode, t('gs.mode')) + '<div class="segcap">' + t(c.mode === 'closed' ? 'gs.closedHint' : 'gs.openHint') + '</div></div>' +
    '<div class="cellcol">' + seg('gscope', [['all', t('gs.all')], ['set', t('gs.set')]], c.scope, t('gs.what')) +
      (c.scope === 'set' ? (sets.length ? '<select class="inp" data-gset aria-label="' + esc(t('gs.set')) + '">' + sets.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === c.set ? ' selected' : '') + '>' + esc((x.title || t('gs.set')) + (x.at ? ' · ' + new Date(x.at).toLocaleDateString() : '') + ' · ' + x.n) + '</option>').join('') + '</select>' : '<div class="segcap">' + t('gs.noSets') + '</div>') : '') + '</div>' +
    '<div class="cell"><span class="grow">' + t('gs.audio') + '<span class="bksub">' + t('gs.audioHint') + '</span></span>' + psw('guestAudio', c.audio, t('gs.audio')) + '</div>' +
    (on ? '<div class="cellcol gsqr"><div class="gsqrimg" data-qr="' + esc(url) + '">' + qrHTML(url) + '</div><b class="num sybig">' + esc(url.replace(/\?t=.*$/, '').replace(/\/$/, '')) + '</b><span class="l2">' + t(c.mode === 'closed' ? 'gs.qrOnly' : 'gs.addr') + '</span></div>' +
      '<div class="cell"><span class="grow">' + t('gs.leader') + '<span class="psub">' + esc(G.leader === 'host' ? t('gs.host') : ((guests.find((x) => x.lead) || {}).name || '')) + '</span></span>' + (G.leader !== 'host' ? '<button class="link" data-act="glead" data-k="host">' + t('gs.takeBack') + '</button>' : '') + '</div>' +
      guests.map((x) => '<div class="cell"><span class="grow">' + esc(x.name) + '<span class="psub">' + t(x.ok ? (x.lead ? 'gs.leading' : 'gs.in') : 'gs.asks') + '</span></span>' +
        (x.ok ? (x.lead ? '' : '<button class="link" data-act="glead" data-k="' + esc(x.id) + '">' + t('gs.giveLead') + '</button>') + '<button class="link danger" data-act="gkick" data-k="' + esc(x.id) + '">' + t('gs.kick') + '</button>'
          : '<button class="link" data-act="gok" data-k="' + esc(x.id) + '">' + t('gs.allow') + '</button><button class="link danger" data-act="gno" data-k="' + esc(x.id) + '">' + t('gs.deny') + '</button>') + '</div>').join('') : '') +
    '</div><p class="ftr">' + t('gs.hint') + '</p>';
}
const syncErr = (e) => t('sy.err.' + ((e && e.reason) || 'unreachable'));

// Все инструкции: механизмы приложения и инструменты; «Показывать все снова»
function helpHTML(app) {
  const st = app.store.state.settings, never = st.helpSeen || {};
  const row = (key, icon, color, name, id) => '<button class="cell" data-hshow="' + esc(key) + '"><span class="ticon" style="--tc:' + color + ';--on:' + onColor(color) + '">' + icon + '</span><span class="grow">' + esc(name) +
    (never[id] ? '<span class="psub">' + t('help.never') + '</span>' : '') + '</span>' + CHEV + '</button>';
  const core = CORE_TOPICS.filter((k) => !st.toolsOnly || ['folder', 'share', 'owndata'].includes(k)).map((k) => { const tp = coreTopic(k); return row('core:' + k, tp.icon, tp.color, tp.name, tp.id); });
  const mods = modules.filter((m) => !m.tab && helpOf(m) && (!CHURCH_MODULES.includes(m.id) || st.church)).map((m) => row(m.id, m.icon, m.color || '#8E8E93', moduleName(m), m.id));
  return '<div class="large">' + t('page.help') + '</div><p class="sub" style="margin:0 4px 12px">' + t('help.listHint') + '</p>' +
    '<div class="group"><div class="cell"><span class="grow">' + t('help.offTitle') + '</span>' + psw('helpOn', !st.helpOff, t('help.offTitle')) + '</div></div><p class="ftr">' + t('help.offHint') + '</p>' +
    '<div class="hdr">' + t('help.listCore') + '</div><div class="group">' + core.join('') + '</div>' +
    '<div class="hdr">' + t('help.listTools') + '</div><div class="group">' + mods.join('') + '</div>' +
    '<div class="group" style="margin-top:12px"><button class="cell act" data-helpreset>' + t('help.all') + '</button></div>';
}

// Модули (встроенные и личные из src/modules-local) и функции ядра: включить и выключить
const theoryFind = (st) => (st.theory || {}).find === true;
function featHTML(app) {
  const st = app.store.state.settings, lang = getLang();
  const row = (id, icon, color, name, about, extra = '', help = false) => '<div class="cell"><span class="ticon" style="--tc:' + color + ';--on:' + onColor(color) + '">' + icon + '</span><span class="grow"><span>' + esc(name) + extra +
    '</span>' + (about ? '<span class="st l2" style="display:block;font-size:13px">' + esc(about) + '</span>' : '') + '</span>' +
    (help ? '<button class="ic sm" data-help="' + id + '" aria-label="' + esc(t('help.open') + ': ' + name) + '">' + icons.help + '</button>' : '') +
    '<label class="sw"><input type="checkbox" data-feat="' + id + '"' + (isOn(st, id) ? ' checked' : '') + ' aria-label="' + esc(name) + '"><i></i></label></div>';
  const aboutOf = (m) => (m.i18n?.[lang]?.about ?? m.i18n?.ru?.about ?? (m.about && (m.about[lang] || m.about.ru)) ?? '');
  return '<div class="large">' + t('feat.title') + '</div><p class="sub" style="margin:0 4px 12px">' + t('feat.hint') + '</p>' +
    // церковный режим: Библия и чтения дня
    '<div class="group"><div class="cell"><span class="grow">' + t('church.title') + '</span>' + psw('church', !!st.church, t('church.title')) + '</div>' +
'</div>' +
    '<p class="ftr">' + t(st.church ? 'church.hintOn' : 'church.hint') + (st.church && st.bible && st.bible.start ? ' ' + t('church.since', { d: st.bible.start.split('-').reverse().join('.') }) : '') + '</p>' +
    '<div class="hdr">' + t('feat.modules') + '</div><div class="group">' +
    modules.filter((m) => (!CHURCH_MODULES.includes(m.id) || st.church) && !m.partOf).map((m) => row(m.id, m.icon, m.color || '#8E8E93', moduleName(m), aboutOf(m), m.local ? ' <span class="lchip sm off">' + t('feat.local') + '</span>' : '', !!helpOf(m))).join('') + '</div>' +
    // пакеты моделей (полный рояль, вокал телефона): скачать один раз, удалить (src/core/packs.js)
    // определитель аккордов и гамм в «Теории»: выключен по умолчанию (слово автора 06.11.2026)
    (isOn(st, 'theory') ? '<div class="group" style="margin-top:12px"><div class="cell"><span class="grow"><span>' + t('feat.theoryFind') + '</span><span class="st l2" style="display:block;font-size:13px">' +
      t('feat.theoryFind.about') + '</span></span><label class="sw"><input type="checkbox" data-thfind' + (theoryFind(st) ? ' checked' : '') + ' aria-label="' + esc(t('feat.theoryFind')) + '"><i></i></label></div></div>' : '') +
    packsHTML() +
    // работа в фоне (Android): разрешения — батарея, уведомления, настройки приложения
    (bgAvailable() ? '<div class="hdr">' + t('bg.feat') + '</div><div data-bgbox><p class="ftr" style="margin-top:0">' + t('bg.featHint') + '</p>' + bgRows(null) + '</div>' : '') +
    // управление звуком вне приложения: шторка, плавающая кнопка, всплывающее окно (Android, src/core/player.js)
    (playerAvailable() ? (() => { const c = bgCtl(st), row = (k) => '<div class="cell"><span class="grow"><span>' + t('pl.' + k) + '</span><span class="st l2" style="display:block;font-size:13px">' + t('pl.' + k + '.about') + '</span></span>' +
      '<label class="sw"><input type="checkbox" data-bgctl="' + k + '"' + (c[k] ? ' checked' : '') + ' aria-label="' + esc(t('pl.' + k)) + '"><i></i></label></div>';
      return '<div class="hdr">' + t('pl.hdr') + '</div><div class="group">' + ['notify', 'float', 'pip'].map(row).join('') + '</div><p class="ftr">' + t('pl.hint') + '</p>'; })() : '') +
    // экран не гаснет, пока приложение открыто (src/core/screenon.js), — по умолчанию включено
    '<div class="hdr">' + t('scr.hdr') + '</div><div class="group"><div class="cell"><span class="grow">' + t('scr.on') + '</span><label class="sw"><input type="checkbox" data-psw="screenOn"' + (st.screenOn !== false ? ' checked' : '') + ' aria-label="' + esc(t('scr.on')) + '"><i></i></label></div></div><p class="ftr">' + t('scr.hint') + '</p>' +
    // защита игры от снимка экрана тремя пальцами (Android)
    (guardAvailable() ? '<div class="hdr">' + t('guard.hdr') + '</div><div class="group"><div class="cell"><span class="grow">' + t('guard.on') + '</span><label class="sw"><input type="checkbox" data-psw="guardShots"' + (st.guardShots !== false ? ' checked' : '') + ' aria-label="' + esc(t('guard.on')) + '"><i></i></label></div></div><p class="ftr">' + t('guard.hint') + '</p>' : '') +
    '<p class="ftr">' + t('feat.own') + '</p>' +
    (skippedModules.length ? '<p class="ftr" style="color:var(--red)">' + esc(t('feat.skipped', { list: skippedModules.map((x) => x.path.split('/').slice(-2, -1)[0] + ' (' + x.err + ')').join(', ') })) + '</p>' : '');
}

// Вкладки внизу: порядок и состав

const GRIP_IC = '<svg viewBox="0 0 24 24"><path d="M5 9h14M5 15h14"/></svg>';
function tabsHTML(app) {
  const st = app.store.state.settings, vis = visibleTabs(st, tabIds(st)), hid = hiddenTabs(st, tabIds(st));
  const nameOf = (k) => (TAB_ICONS[k] && !TAB_MODULES[k] ? t('nav.' + k) : moduleById(k) ? moduleName(moduleById(k)) : t('nav.' + k));
  const mod = (k) => (st.tabMods || []).includes(k); // инструмент, ставший вкладкой
  const tool = (k) => mod(k) || !!TAB_MODULES[k]; // убрать — значит в «Инструменты», а не спрятать
  const color = (k) => (TAB_ICONS[k] && !TAB_MODULES[k] ? 'var(--tint)' : (moduleById(k) || {}).color || 'var(--tint)');
  const row = (k, on, i) => '<div class="cell"' + (on ? ' data-tab-row="' + k + '"' : '') + '><span class="ticon" style="--tc:' + color(k) + '">' + tabIcon(k) + '</span><span class="grow">' + esc(nameOf(k)) +
    (on && tool(k) ? '<span class="st l2" style="display:block;font-size:13px">' + t('tabs.fromTools') + '</span>' : '') + '</span>' +
    // порядок — жестом: удержать строку и вести (слово автора 06.11.2026: без стрелок)
    (on ? '<span class="rgrip" aria-hidden="true">' + GRIP_IC + '</span>' +
      (vis.length > 1 && !FIXED_TABS.includes(k) ? (mod(k) ? '<button class="ic sm plain" data-tabun="' + k + '" aria-label="' + esc(t('tabs.toTools') + ': ' + nameOf(k)) + '" style="color:var(--red)">' + IC.minus + '</button>'
        : '<button class="ic sm plain" data-tabmv="off" data-tab-id="' + k + '" aria-label="' + esc(t('tabs.off', { name: nameOf(k) })) + '" style="color:var(--red)">' + IC.minus + '</button>') : '')
      : '<button class="ic sm plain" data-tabmv="on" data-tab-id="' + k + '" aria-label="' + esc(t('tabs.on', { name: nameOf(k) })) + '" style="color:#5F8568">' + IC.plus + '</button>') + '</div>';
  // любой включённый инструмент — вниз одним касанием (решение автора 28.10.2026)
  const cand = modules.filter((m) => !m.tab && !m.inner && isOn(st, m.id) && !mod(m.id) && !CHURCH_MODULES.includes(m.id));
  const candRow = (m) => '<div class="cell"><span class="ticon" style="--tc:' + (m.color || 'var(--tint)') + ';--on:' + (m.on || '#fff') + '">' + m.icon + '</span><span class="grow">' + esc(moduleName(m)) + '</span>' +
    '<button class="ic sm plain" data-tabmk="' + m.id + '" aria-label="' + esc(t('hold.makeTab') + ': ' + moduleName(m)) + '" style="color:#5F8568"' + (vis.length >= TABS_MAX ? ' disabled' : '') + '>' + IC.plus + '</button></div>';
  return '<div class="large">' + t('tabs.title') + '</div>' +
    '<div class="hdr">' + t('tabs.shown') + '</div><div class="group">' + vis.map((k, i) => row(k, true, i)).join('') + '</div>' +
    (hid.length ? '<div class="hdr">' + t('tabs.hidden') + '</div><div class="group">' + hid.map((k) => row(k, false)).join('') + '</div>' : '') +
    '<p class="ftr">' + t('tabs.hint') + '</p>' +
    (cand.length ? '<div class="hdr">' + t('tabs.addTool') + '</div><div class="group">' + cand.map(candRow).join('') + '</div><p class="ftr">' + t('tabs.addToolHint', { max: TABS_MAX }) + '</p>' : '') +
    dockHTML(st);
}

// Порядок значков нижней панели занятия по умолчанию (у песни может быть свой — удержание значка на панели)
function dockHTML(st) {
  const list = dockGroups(st);
  return '<div class="hdr">' + t('dock.title') + '</div><div class="group">' + list.map((g, i) => { const m = moduleById(g), n = m ? moduleName(m) : g;
    return '<div class="cell" data-dock-row="' + g + '"><span class="ticon" style="--tc:' + ((m && m.color) || 'var(--tint)') + ';--on:' + ((m && m.on) || '#fff') + '">' + (m ? m.icon : '') + '</span><span class="grow">' + esc(n) + '</span>' +
      '<span class="rgrip" aria-hidden="true">' + GRIP_IC + '</span>' + '</div>'; }).join('') +
    (st.dockOrder ? '<button class="cell act center" data-dockreset>' + t('dock.resetDef') + '</button>' : '') + '</div><p class="ftr">' + t('dock.ftr') + '</p>';
}

function rootHTML(app) {
  const cellA = (act, hue, ic, name, sub) => '<button class="cell" data-act="' + act + '"><span class="ticon" style="' + iconBg(app.store.state.settings, hue) + '">' + ic + '</span><span class="grow">' + name + '<span class="psub">' + sub + '</span></span>' + CHEV + '</button>';
  const all = app.store.sessions(), n = app.store.songs().length, weeks = streakInfo(all, app.store.state.settings).weeks;
  const pr = app.store.state.settings.profile || {}, sub = (pr.instruments || []).map((k) => t('inst.' + k)).join(', ');
  // Вместо аватара — лига (самоцвет по часам практики в приложении); нажатие — подробности. Званий и уровня нет.
  // «Только инструменты»: ни лиги, ни итогов — обычный аватар, и в списке нет статистики, недели, уведомлений
  const plain = !!app.store.state.settings.toolsOnly;
  return '<div class="phero">' + (plain ? '<div class="pav">' + AVATAR + '</div>' : '<canvas class="pstone" data-stone="home" role="button" tabindex="0" aria-label="' + esc(t('stone.title')) + '"></canvas>') +
    // компактно (слово автора 06.11.2026: камень меньше, настройки выше): камень слева, имя и лига справа
    '<div class="phtxt"><div class="large" style="margin:0">' + esc(pr.name || t('panel.title')) + '</div>' +
    (plain ? '' : '<button class="prname" data-act="gem">' + esc(t('stone.title')) + '</button>') +
    (sub ? '<div class="l2" style="font-size:15px">' + esc(sub) + '</div>' : '') + '</div></div>' +
    // всего — только практика в приложении: часы «до приложения» воображаемые и в итоги не идут
    (plain ? '' : '<div class="tiles num"><div class="tile"><b>' + fmtDur(gemSec(all)) + '</b><span>' + t('panel.total') + '</span></div><div class="tile"><b>' + n + '</b><span>' + tn('panel.songsWord', n) + '</span></div>' +
    '<button class="tile stile" data-act="streak"><b>' + FLAME + weeks + '</b><span>' + esc(t('streak.inRowShort', { w: tn('streak.weeksWord', weeks) })) + '</span></button></div>') +
    PAGE_GROUPS.map(([g, ks]) => {
      const list = ks.filter((k) => (!plain || !PLAIN_HIDE.includes(k)) && (k !== 'link' || linkAvail(app)) && (k !== 'bible' || !!app.store.state.settings.church));
      const extra = g === 'help' ? cellA('diag', 'graphite', BUG, t('report.title'), t('report.sub2')) + cellA('idea', 'blue', PLANE, t('contact.title'), t('contact.sub')) : '';
      return list.length ? (g === 'more' ? '<div style="height:18px"></div>' : '<div class="hdr">' + t('pg.' + g) + '</div>') + '<div class="group">' + list.map((k) => { const [c, ic] = PAGES[k]; return '<button class="cell" data-pp="' + k + '"><span class="ticon" style="' + iconBg(app.store.state.settings, c) + '">' + ic + '</span><span class="grow">' + t('page.' + k) + '<span class="psub">' + t(k === 'link' && !isDesktop() ? 'page.link.subPh' : 'page.' + k + '.sub') + '</span></span>' + CHEV + '</button>'; }).join('') + extra + '</div>' : '';
    }).join('') +
    ((DEV && VARIANTS.length) || (app.updater && app.updater.platform) ? '<div class="group" style="margin-top:20px">' +
      (DEV && VARIANTS.length ? '<button class="cell" data-act="variants"><span class="ticon" style="' + iconBg(app.store.state.settings, 'indigo') + '">' + VAR_IC + '</span><span class="grow">' + t('variant.title') + '<span class="psub">' + t('variant.sub') + '</span></span>' + CHEV + '</button>' : '') +
      (app.updater && app.updater.platform ? '<button class="cell" data-act="upd"><span class="ticon" style="' + iconBg(app.store.state.settings, 'teal') + '">' + UPD_IC + '</span><span class="grow">' + t('upd.title') + '<span class="psub">' + t('upd.sub', { b: app.updater.build || '—', ch: t(app.updater.channel === 'dev' ? 'upd.dev' : 'upd.pre') }) + '</span></span>' + CHEV + '</button>' : '') +
      '</div>' : '') +
    '<div class="group" style="margin-top:12px">' + ['about', 'tos', 'priv', 'lic'].map((k) => '<button class="cell" data-act="legal" data-v="' + k + '"><span class="grow">' + t('legal.' + k) + '</span>' + CHEV + '</button>').join('') + '</div>' +
    '<div class="about"><b>Melete</b> · ' + t('panel.version', { v: VERSION }) + ' · ' + t(Capacitor.isNativePlatform() ? 'panel.kindApk' : isDesktop() ? 'panel.kindWin' : import.meta.env.MODE === 'showcase' ? 'panel.kindShow' : 'panel.kindWeb') + '<br>' + t('panel.author') + '<br>' + t('panel.madeWith') + '</div>';
}

/* ---------- панель ---------- */

// Полноэкранная панель профиля; page — 'root' или ключ PAGES
export function createPanel(app, onChange) {
  // нагрузка звука в настройках — живая строка, пока она на экране
  setInterval(() => { const el = document.querySelector('[data-sndload]'); if (!el) return; const m = app.audio.load; if (m && m.ready) el.textContent = Math.round(m.value * 100) + ' %'; }, 1000);
  let page = null, layer = null, input = null, lastPage = null;
  // Смена языка или вида: строки и стили меняются на месте — настройки остаются открытыми на той же странице
  const relang = () => { const st = app.store.state.settings; loadLang(st.lang).then(() => { app.relang(); render(); onChange(); }); };
  const render = () => {
    if (!page) { if (layer) { leave(layer, 260); layer = null; } lastPage = null; return; }
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'panelLayer';
      layer.className = 'panel';
      layer.setAttribute('role', 'dialog');
      layer.setAttribute('aria-modal', 'true');
      layer.setAttribute('aria-label', t('panel.aria'));
      document.body.appendChild(layer);
      bind();
    }
    const sub = page !== 'root', y = layer.scrollTop;
    const PAGE_HTML = { root: rootHTML, me: meHTML, stats: statsHTML, week: weekHTML, sound: soundHTML, bible: bibleHTML, look: lookHTML, notif: notifHTML, mascot: mascotHTML, data: dataHTML, link: linkHTML, feat: featHTML, tabs: tabsHTML, help: helpHTML };
    // Компьютер (ui/desk.js): две колонки, как настройки системы — слева профиль и разделы, справа выбранный раздел
    const desk = isDesk(), shown = desk && page === 'root' ? 'me' : page;
    const body = desk ? '<div class="pdesk"><aside class="pdnav">' + rootHTML(app) + '</aside><section class="pdpage" data-shown="' + shown + '">' + PAGE_HTML[shown](app) + '</section></div>' : PAGE_HTML[page](app);
    layer.innerHTML = '<div class="wrap" style="padding-bottom:40px"><div class="navrow">' + (sub && !desk ? '<button class="ic sm plain" data-pp="root" aria-label="' + esc(t('panel.back')) + '">' + icons.back + '</button>' : '<span></span>') +
      '<button class="link b" data-act="pclose">' + t('ui.done') + '</button></div>' + body + '</div>';
    if (desk) { const cur = layer.querySelector('.pdnav [data-pp="' + shown + '"]'); if (cur) cur.setAttribute('aria-current', 'page'); }
    // переход между страницами: вперёд — справа, назад в корень — слева; перерисовка той же страницы — без движения
    if (lastPage && lastPage !== page && !desk) layer.firstChild.classList.add(page === 'root' ? 'pback' : 'pfwd');
    layer.scrollTop = lastPage && lastPage !== page ? 0 : y;
    lastPage = page;
    if (page === 'look') mountSizePreview(app, layer);
    if (page === 'root' || desk) mountStones(app, layer);
    // инструкции к разделам: папка Melete — на «Данных», характер Мелеты — на «Уведомлениях»
    if (page === 'data') { coreHelp(app, 'folder'); if (copies === null) loadCopies(app, () => { if (page === 'data') render(); }); if (snaps === null) loadSnaps(app, () => { if (page === 'data') render(); }); }
    if (page === 'mascot') coreHelp(app, 'melete');
    if (page === 'notif') mountMelete(layer);
    // работа в фоне: отметки ✓ у выданных разрешений — после ответа системы
    const bb = page === 'feat' && layer.querySelector('[data-bgbox]');
    if (bb) {
      bgStatus().then((st) => { if (st && bb.isConnected) bb.innerHTML = '<p class="ftr" style="margin-top:0">' + t('bg.featHint') + '</p>' + bgRows(st); });
      bindBg(bb, () => setTimeout(render, 1500));
    }
  };
  const changed = () => { app.store.settingsChanged(); render(); onChange(); };
  let offPacks = null;
  function bind() {
    if (offPacks) offPacks();
    offPacks = bindPacks(layer);
    // папка Melete: состояние синхронизации — на странице «Данные и копии»
    if (app.folder) app.folder.subscribe(() => { if ((page === 'data' || page === 'link') && layer && layer.isConnected) render(); });
    if (app.localSend) app.localSend.subscribe(() => { if ((page === 'data' || page === 'link') && layer && layer.isConnected) render(); });
    if (app.mesh) app.mesh.subscribe(() => { if (page === 'link' && layer && layer.isConnected && !syncBusy) render(); });
    if (app.syncSrv) app.syncSrv.subscribe(() => { if ((page === 'data' || page === 'link') && layer && layer.isConnected) render(); });
    if (app.guest) app.guest.subscribe(() => { if ((page === 'data' || page === 'link') && layer && layer.isConnected) render(); });
    if (app.syncCli) app.syncCli.subscribe(() => { if ((page === 'data' || page === 'link') && layer && layer.isConnected && !syncBusy) render(); });
    // характер Мелеты (страница «Уведомления»)
    bindRemindView(layer, app, (ch) => (ch ? changed() : render()));
    bindMelete(layer, () => app.store.state.settings, { save: () => { app.store.settingsChanged(); onChange(); }, rerender: () => render() });
    // свои цвета: при выборе — сразу на экране, сохраняется по закрытию палитры (change)
    const ownSet = (el) => { const st = app.store.state.settings, v = el.value.toUpperCase(); if (el.dataset.owncolor === 'main') { st.ownMain = v; st.palette = 'own'; } else st.ownBg = v; applyTheme(st); };
    layer.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.owncolor) ownSet(e.target); });
    layer.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.owncolor) { ownSet(e.target); changed(); } });
    // «Вкладки»: удержать вкладку и вести вверх-вниз — новый порядок
    sortable(layer, '[data-tab-row]', 'data-tab-row', (ids) => { if (orderTabs(app.store, tabIds(app.store.state.settings), ids)) { render(); onChange(); } });
    // порядок значков панели занятия — тоже жестом
    sortable(layer, '[data-dock-row]', 'data-dock-row', (ids) => { const st = app.store.state.settings; st.dockOrder = ids; app.store.settingsChanged(); render(); });
    layer.addEventListener('click', (e) => {
      const g = (s) => e.target.closest(s);
      let b;
      if ((b = g('[data-pp]'))) { page = b.dataset.pp; render(); layer.scrollTop = 0; return; }
      if (g('[data-act="pclose"]')) { panel.close(); return; }
      if ((b = g('[data-dockup]'))) { const st = app.store.state.settings, l = dockGroups(st), i = l.indexOf(b.dataset.dockup); if (i > 0) { [l[i - 1], l[i]] = [l[i], l[i - 1]]; st.dockOrder = l; app.store.settingsChanged(); render(); } return; }
      if (g('[data-dockreset]')) { delete app.store.state.settings.dockOrder; app.store.settingsChanged(); render(); return; }
      if ((b = g('[data-tabmv]'))) { if (editTabs(app.store, tabIds(app.store.state.settings), b.dataset.tabId, b.dataset.tabmv)) { render(); onChange(); } return; }
      if ((b = g('[data-tabmk]'))) { if (makeTab(app.store, b.dataset.tabmk, tabIds(app.store.state.settings)) === 'max') toast(t('tabs.max', { max: TABS_MAX })); render(); onChange(); return; }
      if ((b = g('[data-tabun]'))) { if (unmakeTab(app.store, b.dataset.tabun)) { render(); onChange(); } return; }
      if ((b = g('[data-day]'))) { toggleDay(app.store, +b.dataset.day); render(); onChange(); return; }
      if ((b = g('[data-help]'))) { const m = moduleById(b.dataset.help); if (m) showHelp(app, m); return; }
      if (g('[data-helpreset]')) { resetHelp(app); toast(t('help.againDone')); render(); return; }
      if ((b = g('[data-hshow]'))) { const k = b.dataset.hshow, m = k.startsWith('core:') ? coreTopic(k.slice(5)) : moduleById(k); if (m) showHelp(app, m); return; }
      if (g('[data-bbartop]')) { const d = (app.device.bible ??= {}); d.barTop = g('[data-bbartop]').checked; app.saveDevice(); return; }
      if (g('[data-bplannew]')) { planSheet(app, () => { render(); onChange(); }); return; }
      if (g('[data-bplanedit]')) { planSheet(app, () => { render(); onChange(); }, app.bible.st().plan); return; }
      if (g('[data-brestart]')) { app.bible.setPlan(app.bible.st().plan, dayKeyOf(Date.now())); toast(t('church.restarted')); render(); onChange(); return; }
      if ((b = g('[data-goal]'))) { changeGoal(app.store, +b.dataset.goal); render(); onChange(); return; }
      if ((b = g('[data-appicon]'))) { app.store.state.settings.appIconOwn = true; setAppIcon(app.store.state.settings, b.dataset.appicon).then((ok) => { app.store.settingsChanged(); render(); toast(t(ok ? 'icon.done' : 'icon.fail')); }); return; }
      if ((b = g('[data-seg="theme"] [data-v]'))) { app.store.state.settings.theme = b.dataset.v; applyTheme(app.store.state.settings); changed(); return; }
      if ((b = g('[data-seg="uistyle"] [data-v]'))) {
        const st = app.store.state.settings, was = st.uiStyle === 'mono' && st.monoLang !== false;
        st.uiStyle = b.dataset.v === 'mono' ? 'mono' : 'default';
        applyTheme(st); changed();
        // у «Минимала» свой язык (русский с греческими названиями) — строки меняются на месте
        if (was !== (st.uiStyle === 'mono' && st.monoLang !== false)) relang();
        return;
      }
      if ((b = g('[data-uisz]'))) {
        const st = app.store.state.settings, v = b.dataset.uisz;
        st.uiScale = v === 'auto' ? null : Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, uiScale(st) + +v * SCALE_STEP)) * 100) / 100;
        applyScale(st); changed(); return;
      }
      if ((b = g('[data-skin]'))) { const st = app.store.state.settings; st.theme = st.theme === b.dataset.skin ? 'system' : b.dataset.skin; applyTheme(st); changed(); return; }
      if ((b = g('[data-seg="ontext"] [data-v]'))) { app.store.state.settings.onText = b.dataset.v; applyTheme(app.store.state.settings); changed(); return; }
      if (g('[data-ownbgreset]')) { delete app.store.state.settings.ownBg; applyTheme(app.store.state.settings); changed(); return; }
      if (g('.owsw')) return; // кружок своего цвета — открывает выбор цвета, а не палитру
      if ((b = g('[data-pal]'))) { app.store.state.settings.palette = b.dataset.pal; applyTheme(app.store.state.settings); changed(); return; }
      if ((b = g('[data-acc]'))) { app.store.state.settings.accent = b.dataset.acc; applyTheme(app.store.state.settings); changed(); return; }
      if ((b = g('[data-meinst]'))) {
        const p = { ...newProfile(), ...(app.store.state.settings.profile || {}) }, k = b.dataset.meinst;
        p.instruments = p.instruments.includes(k) ? p.instruments.filter((x) => x !== k) : [...p.instruments, k];
        saveProfile(app.store, p); render(); onChange(); return;
      }
      if ((b = g('[data-seg="track"] [data-v]'))) { app.store.state.settings.trackMode = b.dataset.v; changed(); return; }
      if ((b = g('[data-seg="autostems"] [data-v]'))) { app.store.state.settings.autoStems = b.dataset.v; changed(); if (app.auto) app.auto.kick(); return; }
      if ((b = g('[data-seg="autopower"] [data-v]'))) { app.store.state.settings.autoPower = b.dataset.v; changed(); if (app.auto) app.auto.kick(); return; }
      if ((b = g('[data-seg="sndmode"] [data-v]'))) { app.audio.mixer.setMode(b.dataset.v); toast(t('snd.later')); render(); return; }
      if ((b = g('[data-seg="sndperf"] [data-v]'))) { app.audio.mixer.setPerf(b.dataset.v); toast(t('snd.later')); render(); return; }
      if ((b = g('[data-seg="sndengine"] [data-v]'))) { app.audio.mixer.setEngine(b.dataset.v); render(); return; }
      if ((b = g('[data-seg="sndverb"] [data-v]'))) { app.audio.mixer.setVerb(b.dataset.v); render(); return; }
      if ((b = g('[data-seg="sndalgo"] [data-v]'))) { app.audio.mixer.setVerbAlgo(b.dataset.v); render(); return; }
      if ((b = g('[data-seg="scale"] [data-v]'))) { app.store.state.settings.scale = b.dataset.v; changed(); return; }
      if ((b = g('[data-lang]'))) { app.store.state.settings.lang = b.dataset.lang; app.store.settingsChanged(); relang(); return; }
      if (g('[data-act="demo"]')) {
        if (demoLeft(app)) {
          confirm(t('demo.removeTitle'), t('demo.removeText'), t('demo.removeYes')).then((ok) => {
            if (!ok) return;
            removeDemo(app).then(() => { render(); onChange(); toast(t('demo.removed')); });
          });
        } else {
          toast(t('demo.adding'));
          addDemo(app, t).then(() => { render(); onChange(); toast(t('demo.added')); });
        }
        return;
      }
      if ((b = g('[data-seg="gmode"] [data-v]'))) { app.guest.set({ mode: b.dataset.v }); return; }
      if ((b = g('[data-seg="gscope"] [data-v]'))) { const c = app.guest.cfg; app.guest.set({ scope: b.dataset.v, set: c.set || ((setlistsOf(app.store.state)[0] || {}).id || '') }); return; }
      if ((b = g('[data-act="gok"]'))) { app.guest.approve(b.dataset.k, true); return; }
      if ((b = g('[data-act="gno"]'))) { app.guest.approve(b.dataset.k, false); return; }
      if ((b = g('[data-act="gkick"]'))) { app.guest.kick(b.dataset.k); return; }
      if ((b = g('[data-act="glead"]'))) { app.guest.lead(b.dataset.k); return; }
      if (g('[data-act="ens"]')) { app.ensemble(); return; }
      if (g('[data-act="upd"]')) { updateSheet(app); return; }
      if (g('[data-act="variants"]')) { variantsSheet(app); return; }
      if (g('[data-act="syforget"]')) { app.syncSrv.forget(g('[data-act="syforget"]').dataset.k); render(); return; }
      if (g('[data-act="meshforget"]')) { app.mesh.forget(g('[data-act="meshforget"]').dataset.k); render(); return; }
      if (g('[data-act="devrc"]')) { const dv = devsOf().find((x) => x.addr === g('[data-act="devrc"]').dataset.a); if (dv) import('./remote.js').then((m) => m.remoteSheet(app, dv)); return; }
      if (g('[data-act="pcrc"]')) { const pc = pcOf(); if (pc) import('./remote.js').then((m) => m.remoteSheet(app, pc)); return; }
      if (g('[data-act="meshpair"]') && !syncBusy) {
        const addr = layer.querySelector('[data-mesh="addr"]').value, code = layer.querySelector('[data-mesh="code"]').value;
        syncBusy = true; syncMsg = t('sy.pairing'); render();
        pair(addr, code, t(isDesktop() ? 'sy.pcName' : 'sy.phoneName'))
          .then((d) => { syncMsg = t('sy.paired', { name: d.name }) + (d.fp ? ' · ' + t('sy.check') + ' ' + fpCheck(d.fp) : ''); if (d.phone) return syncNow(app, () => {}, undefined, { dev: d.addr }).then(() => onChange()).catch(() => {}); if (app.syncCli) app.syncCli.run().then(() => onChange()).catch(() => {}); return null; })
          .catch((e) => { syncMsg = syncErr(e); })
          .finally(() => { syncBusy = false; render(); });
        return;
      }
      if (g('[data-act="devforget"]')) { forgetDev(g('[data-act="devforget"]').dataset.a); syncMsg = ''; render(); return; }
      if (g('[data-act="devsync"]') && !syncBusy) {
        const a = g('[data-act="devsync"]').dataset.a;
        syncBusy = true; syncMsg = t('sy.step.data'); render();
        const setMsg = (x) => { syncMsg = x.stage === 'data' ? t('sy.step.data') : t('sy.step.' + x.stage, { n: x.done + 1, total: x.total, name: x.name || '' }); render(); };
        syncNow(app, setMsg, undefined, { dev: a })
          .then((r) => { syncMsg = t('sy.done', { songs: r.songs, sessions: r.sessions, up: r.up, down: r.down }); toast(syncMsg); onChange(); })
          .catch((e) => { syncMsg = syncErr(e); if (e && (e.reason === 'key' || e.reason === 'pin')) forgetDev(a); toast(syncMsg); })
          .finally(() => { syncBusy = false; render(); });
        return;
      }
      if (g('[data-act="sypcforget"]')) { forgetPc(); syncMsg = ''; render(); return; }
      if (g('[data-act="syscan"]') && !syncBusy) {
        scanQR((x) => !!parsePair(x)).then((x) => {
          const q = parsePair(x);
          if (!q) return;
          syncAddr = q.addr; syncBusy = true; syncMsg = t('sy.pairing'); render();
          pair(q.addr, q.code, t('sy.phoneName'))
            .then((pc) => {
              // отпечаток из QR не совпал — это не тот компьютер: связь не сохраняется
              if (q.fp && pc.fp && !pc.fp.startsWith(q.fp)) { if (pc.phone) forgetDev(pc.addr); else forgetPc(); throw Object.assign(new Error('fp'), { reason: 'tls' }); }
              syncMsg = t('sy.paired', { name: pc.name }) + (pc.fp ? ' · ' + t('sy.check') + ' ' + fpCheck(pc.fp) : '');
              if (pc.phone) syncNow(app, () => {}, undefined, { dev: pc.addr }).then(() => { onChange(); render(); }).catch(() => {});
              else if (app.syncCli) app.syncCli.run().then(() => { onChange(); render(); }).catch(() => {});
            })
            .catch((e) => { syncMsg = syncErr(e); })
            .finally(() => { syncBusy = false; render(); });
        });
        return;
      }
      if (g('[data-act="sypair"]') && !syncBusy) {
        const addr = layer.querySelector('[data-sy="addr"]').value, code = layer.querySelector('[data-sy="code"]').value;
        syncBusy = true; syncMsg = t('sy.pairing'); render();
        pair(addr, code, t('sy.phoneName'))
          .then((pc) => { syncMsg = t('sy.paired', { name: pc.name }) + (pc.fp ? ' · ' + t('sy.check') + ' ' + fpCheck(pc.fp) : ''); if (pc.phone) syncNow(app, () => {}, undefined, { dev: pc.addr }).then(() => { onChange(); render(); }).catch(() => {}); else if (app.syncCli) app.syncCli.run().then(() => { onChange(); render(); }).catch(() => {}); })
          .catch((e) => { syncMsg = syncErr(e); })
          .finally(() => { syncBusy = false; render(); });
        return;
      }
      if (g('[data-act="synow"]') && !syncBusy) {
        syncBusy = true; syncMsg = t('sy.step.data'); render();
        const setMsg = (s) => { syncMsg = s.stage === 'data' ? t('sy.step.data') : t('sy.step.' + s.stage, { n: s.done + 1, total: s.total, name: s.name || '' }); render(); };
        (app.syncCli ? app.syncCli.run(setMsg) : syncNow(app, setMsg))
          .then((r) => { syncMsg = t('sy.done', { songs: r.songs, sessions: r.sessions, up: r.up, down: r.down }); toast(syncMsg); onChange(); })
          .catch((e) => { syncMsg = onSyncErr(e); toast(syncMsg); })
          .finally(() => { syncBusy = false; render(); });
        return;
      }
      if (g('[data-act="export"]')) {
        exportSheet(app, (r) => {
          if (r.where === 'folder') { toast(t('bk.savedFolder', { name: r.name.replace(/\.json$/, '') })); copies = null; loadCopies(app, render); }
          else if (r.where === 'saved') toast(t('data.saved'));
          if (r.skipped) toast(t('bk.filesSkipped', { n: r.skipped }));
        });
        return;
      }
      // копия из папки — сначала выбрать, что из неё загрузить
      if ((b = g('[data-snap]'))) {
        app.snapshots.read(b.dataset.snap).then((p) => { if (isBackup(p)) importSheet(app, p, () => { applyTheme(app.store.state.settings); onChange(); render(); }); else toast(t('data.notBackup')); }).catch(() => toast(t('data.notBackup')));
        return;
      }
      if ((b = g('[data-bk]'))) {
        app.folder.readFile(b.dataset.bk).then((p) => { if (isBackup(p)) importSheet(app, p, () => { applyTheme(app.store.state.settings); onChange(); render(); }); else toast(t('fold.noData')); })
          .catch(() => toast(t('data.notBackup')));
        return;
      }
      if ((b = g('[data-fold]'))) {
        const F = app.folder, a = b.dataset.fold;
        if (a === 'pick') F.pick().then((ok) => { render(); if (ok) toast(t('fold.done')); });
        else if (a === 'sync') { toast(t('fold.busy')); F.sync().then((r) => { render(); toast(r ? t('fold.synced', { w: r.wrote, r: r.read + r.songs + r.texts }) : t('fold.fail')); }); }
        else if (a === 'restore') confirm(t('fold.restoreTitle'), t('fold.restoreText'), t('fold.restoreYes')).then((ok) => ok && F.restore().then((n) => { toast(n == null ? t('fold.noData') : tn('data.imported', n)); onChange(); render(); }).catch(() => toast(t('data.notBackup'))));
        else if (a === 'forget') confirm(t('fold.forgetTitle'), t('fold.forgetText'), t('fold.forget')).then((ok) => ok && F.forget().then(render));
        return;
      }
      if (g('[data-act="import"]')) { input.click(); return; }
      if (g('[data-act="reset"]')) {
        confirm(t('data.resetTitle'), t('data.resetText'), t('data.resetYes')).then((ok) => {
          if (!ok) return;
          app.store.reset();
          applyTheme(app.store.state.settings);
          render();
          onChange();
          toast(t('data.resetDone'));
        });
        return;
      }
      if ((b = g('[data-go]'))) { panel.close(); app.go(b.dataset.go); return; }
      if (g('[data-aidoc]')) { import('./share.js').then((m) => m.aiDocSheet(app)); return; }
      if (g('[data-loadfile]')) { import('./share.js').then((m) => m.pickFile(app)); return; }
      if ((b = g('[data-qdel]'))) {
        const st = app.store.state.settings, id = b.dataset.qdel, bk = (st.quoteBooks || []).find((x) => x.id === id);
        if (!bk) return;
        confirm(t('qset.delTitle', { title: bk.title }), t('qset.delText'), t('qset.del')).then((ok) => {
          if (!ok) return;
          st.quoteBooks = st.quoteBooks.filter((x) => x.id !== id);
          if (Array.isArray(st.qsets)) st.qsets = st.qsets.filter((k) => k !== 'own:' + id);
          app.store.settingsChanged(); onChange(); render();
        });
        return;
      }
      app.shellAct(e); // общие действия: ударный режим, правовые тексты
    });
    layer.addEventListener('change', (e) => {
      const d = e.target.dataset;
      if (d.feat) { setFeature(app.store, d.feat, e.target.checked); onChange(); if (d.feat === 'quote') render(); return; }
      // наборы слов Мелеты: хотя бы один остаётся
      if (d.qset) {
        const st = app.store.state.settings, s = new Set(setsOf(st));
        if (e.target.checked) s.add(d.qset); else if (s.size > 1) s.delete(d.qset); else { e.target.checked = true; return; }
        st.qsets = [...QSETS, ...(st.quoteBooks || []).map((x) => 'own:' + x.id)].filter((k) => s.has(k)); app.store.settingsChanged(); onChange(); return;
      }
      if (e.target.hasAttribute('data-thfind')) { const st = app.store.state.settings; (st.theory ??= {}).find = e.target.checked; app.store.settingsChanged(); return; }
      if (e.target.hasAttribute('data-bplan')) { const v = e.target.value; app.bible.setPlan(v === 'none' ? null : v, dayKeyOf(Date.now())); render(); onChange(); return; }
      if (d.bgctl) {
        const st = app.store.state.settings, k = d.bgctl, on = e.target.checked;
        st.bgCtl = { ...bgCtl(st), ...(k === 'pip' ? { pipOn: on } : { [k]: on }) };
        app.store.settingsChanged();
        if (app.player) app.player.sync(true);
        // плавающей кнопке нужно разрешение «Поверх других приложений» — системный экран, если его ещё нет
        if (k === 'float' && on) canOverlay().then((ok) => { if (!ok) { toast(t('pl.askOverlay')); askOverlay(); } });
        return;
      }
      if (d.psw === 'localSend') { app.localSend.set(e.target.checked).then(() => render()); return; }
      if (d.psw === 'guestOn') { (e.target.checked ? app.guest.start() : app.guest.stop()).then(() => render()).catch((er) => { logErr('sync', er); toast(t('sy.err.port')); render(); }); return; }
      if (d.psw === 'guestAudio') { app.guest.set({ audio: e.target.checked }); return; }
      if (e.target.matches('[data-gset]')) { app.guest.set({ set: e.target.value }); return; }
      if (d.psw === 'helpOn') { app.store.state.settings.helpOff = !e.target.checked; app.store.settingsChanged(); return; }
      if (d.psw === 'meshOn') { (e.target.checked ? app.mesh.start() : app.mesh.stop()).then(() => render()).catch((er) => { logErr('sync', er); toast(t('sy.err.port')); render(); }); return; }
      if (d.psw === 'syncSrv') { (e.target.checked ? app.syncSrv.start() : app.syncSrv.stop()).then(() => render()).catch((er) => { logErr('sync', er); toast(t('sy.err.port')); render(); }); return; }
      if (d.psw) { app.store.state.settings[d.psw] = e.target.checked; app.store.settingsChanged(); if ((d.psw === 'autoAna' || d.psw === 'autoHq' || d.psw === 'autoLyr' || d.psw === 'pcWork') && app.auto) app.auto.kick(); if (d.psw === 'toolsOnly' || d.psw === 'church') { render(); onChange(); } if (d.psw === 'monoLang') relang(); if (d.psw === 'monoBare') { applyTheme(app.store.state.settings); relang(); } }
      if (d.me) {
        const r = saveProfile(app.store, { ...newProfile(), ...(app.store.state.settings.profile || {}), [d.me]: e.target.value });
        onChange();
      }
    });
  }
  // Выбор файла копии живёт вне панели: панель перерисовывается целиком
  input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.hidden = true;
  input.addEventListener('change', () => importBackup(app, input, () => { applyTheme(app.store.state.settings); render(); onChange(); }));
  document.body.appendChild(input);
  const onKey = (e) => { if (e.key === 'Escape' && page && !document.querySelector('#sheetLayer .scrim:not(.leaving), .ask:not(.leaving)')) panel.close(); };
  document.addEventListener('keydown', onKey);
  const panel = {
    open(p = 'root') { page = p; render(); if (layer) layer.scrollTop = 0; },
    close() { page = null; render(); },
    // после перезапуска приложения — вернуть открытую страницу (если она была запомнена)
    reopen() {
      let r = null;
      try { r = JSON.parse(sessionStorage.getItem('melete.reopen') || 'null'); sessionStorage.removeItem('melete.reopen'); } catch { r = null; }
      if (!r || !r.page) return false;
      page = r.page; render();
      if (layer) layer.scrollTop = r.y || 0;
      return true;
    },
    refresh() { if (page) render(); },
    get page() { return page; },
  };
  return panel;
}

/* ---------- резервная копия ---------- */

// Файл копии → выбор частей → загрузка
function importBackup(app, input, done) {
  const f = input.files[0];
  input.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let p = null;
    try { p = JSON.parse(r.result); } catch { p = null; }
    if (!isBackup(p)) { toast(t('data.notBackup')); return; }
    importSheet(app, p, done); // что загрузить — выбор частей
  };
  r.readAsText(f);
}

/* ---------- правовые тексты, соглашение ---------- */


const ruOnly = () => (getLang() === 'ru' ? '' : '<p class="ftr">' + t('legal.ruOnly') + '</p>');

export function legalSheet(kind) {
  let body;
  // «О Melete» — тот же текст, что на первом экране: видение, философия, «как есть»
  if (kind === 'about') { import('./onboard.js').then((m) => sheet(() => snav(t('wel.about')) + m.welcomeHTML(), (el) => el.addEventListener('click', (e) => { const d = e.target.closest('[data-wldoc]'); if (d) legalSheet(d.dataset.wldoc); }))); return; }
  if (kind === 'priv') body = snav(t('legal.privShort')) + ruOnly() + '<div class="legal" lang="ru"><h2>Политика конфиденциальности</h2>' + PRIV_HTML + '</div>';
  else if (kind === 'tos') body = snav(t('legal.tosShort')) + ruOnly() + '<div class="legal" lang="ru"><h2>Пользовательское соглашение</h2>' + TOS_HTML + '</div>';
  else {
    const lic = (title, sub, text) => '<div class="lic"><h3>' + title + '</h3><p class="l2">' + sub + '</p>' + text + '</div>';
    body = snav(t('legal.lic')) + '<div class="legal"><p>' + t('lic.intro') + '</p>' +
      lic('alphaTab', t('lic.at.sub'), '<p>© CoderLine (Daniel Kuschny) ' + t('lic.andContrib') + '</p><p>' + t('lic.at.text') + '</p><p>' + t('lic.at.inner') + '</p>') +
      lic('Bravura', t('lic.brav.sub'), '<p>Copyright © 2013, Steinberg Media Technologies GmbH (http://www.steinberg.net/), with Reserved Font Name "Bravura".</p><p>This Font Software is licensed under the SIL Open Font License, Version 1.1.</p><pre>' + esc(OFL_TEXT) + '</pre>') +
      lic('SONiVOX EAS', t('lic.sv.sub'), '<p>' + t('lic.sv.text') + '</p>') +
      lic('Salamander Grand Piano V3', t('lic.sal.sub'), '<p>© Alexander Holm.</p><p>' + t('lic.sal.text') + '</p>') +
      lic('Comfortaa', t('lic.cg.sub'), '<p>Copyright 2011 The Comfortaa Project Authors (github.com/alexeiva/comfortaa), with Reserved Font Name "Comfortaa".</p><p>' + t('lic.cg.text') + '</p>') +
      lic('GFS Didot', t('lic.didot.sub'), '<p>Copyright © Greek Font Society (greekfontsociety-gfs.gr).</p><p>' + t('lic.cg.text') + '</p>') +
      lic('Ponomar', t('lic.pon.sub'), '<p>Copyright 2025 The Ponomar Project Authors (github.com/slavonic/Ponomar).</p><p>' + t('lic.pon.text') + '</p>') +
      lic('Onest', t('lic.onest.sub'), '<p>Copyright 2023 The Onest Project Authors (github.com/simpals/onest).</p><p>' + t('lic.cg.text') + '</p>') +
      lic('pdf.js', t('lic.pdf.sub'), '<p>© Mozilla Foundation ' + t('lic.andContrib') + '</p><p>' + t('lic.pdf.text') + '</p>') +
      lic('MediaPipe', t('lic.mp.sub'), '<p>© Google LLC</p><p>' + t('lic.mp.text') + '</p>') +
      lic(t('lic.bible.title'), t('lic.bible.sub'), '<p>' + t('lic.bible.text') + '</p>') +
      lic(t('lic.verses.title'), t('lic.verses.sub'), '<p>' + t('lic.verses.text') + '</p>') +
      lic('fflate', t('lic.fflate.sub'), '<p>© Arjun Barrett</p><p>' + t('lic.mit') + '</p>') +
      lic('jsQR', t('lic.jsqr.sub'), '<p>© Cosmo Wolfe</p><p>' + t('lic.jsqr.text') + '</p>') +
      lic('qrcode-generator', t('lic.qr.sub'), '<p>© Kazuhiko Arase</p><p>' + t('lic.mit') + '</p><p>' + t('lic.qr.tm') + '</p>') +
      lic('Signalsmith Stretch', t('lic.stretch.sub'), '<p>© Signalsmith Audio Ltd</p><p>' + t('lic.mit') + '</p>') +
      lic('ONNX Runtime', t('lic.ort.sub'), '<p>© Microsoft Corporation</p><p>' + t('lic.mit') + '</p>') +
      lic('HTDemucs', t('lic.dm.sub'), '<p>© Meta Platforms, Inc. ' + t('lic.andContrib') + '</p><p>' + t('lic.dm.text') + '</p>') +
      lic('Basic Pitch', t('lic.bp.sub'), '<p>© Spotify AB</p><p>' + t('lic.bp.text') + '</p>') +
      lic('S-KEY', t('lic.skey.sub'), '<p>© Deezer SA</p><p>' + t('lic.mit') + '</p>') +
      lic('Beat This!', t('lic.bt.sub'), '<p>© Francesco Foscarin, Jan Schlüter, Gerhard Widmer (CPJKU)</p><p>' + t('lic.mit') + '</p>') +
      lic('ChordMini', t('lic.cm.sub'), '<p>© ChordMini authors</p><p>' + t('lic.mit') + '</p>') +
      lic('UVR MDX-Net', t('lic.mdx.sub'), '<p>© Anjok07, Kimberley Jensen (Ultimate Vocal Remover); © KUIELab</p><p>' + t('lic.mit') + '</p>') +
      lic('YourMT3+', t('lic.ymt.sub'), '<p>© Sungkyun Chang, Emmanouil Benetos, Holger Kirchhoff, Simon Dixon</p><p>' + t('lic.ymt.text') + '</p>') +
      lic('Mel-Band RoFormer', t('lic.mr.sub'), '<p>© Kimberley Jensen; © Phil Wang, Roman Solovyev</p><p>' + t('lic.mit') + '</p><p>' + t('lic.mr.text') + '</p>') +
      lic('DeepFilterNet · tract', t('lic.df.sub'), '<p>© Hendrik Schröter; © Sonos, Inc.</p><p>' + t('lic.df.text') + '</p>') +
      lic('Airwindows', t('lic.aw.sub'), '<p>© Chris Johnson (Airwindows)</p><p>' + t('lic.mit') + '</p>') +
      lic('ureq', t('lic.ureq.sub'), '<p>© Martin Algesten ' + t('lic.andContrib') + '</p><p>' + t('lic.ureq.text') + '</p>') +
      lic('rustls · rcgen · RustCrypto sha2', t('lic.tls.sub'), '<p>© rustls, rcgen, RustCrypto ' + t('lic.andContrib') + '</p><p>' + t('lic.tls.text') + '</p>') +
      lic('FFmpeg · ffmpeg.wasm', t('lic.ff.sub'), '<p>© FFmpeg developers; © Jerome Wu (ffmpeg.wasm)</p><p>' + t('lic.ff.text') + '</p>') +
      lic('lamejs · mp4-muxer', t('lic.lame.sub'), '<p>© LAME developers, Alex Zhukov; © Vanilagy</p><p>' + t('lic.lame.text') + '</p>') +
      lic('whisper.cpp · Whisper', t('lic.wc.sub'), '<p>© Georgi Gerganov; © OpenAI</p><p>' + t('lic.mit') + '</p><p>' + t('lic.wh.text') + '</p>') +
      lic('TensorFlow.js', t('lic.tf.sub'), '<p>© Google LLC</p><p>' + t('lic.tf.text') + '</p>') +
      lic('@tonejs/midi', t('lic.tm.sub'), '<p>© Yotam Mann</p><p>' + t('lic.mit') + '</p>') +
      lic('sql.js', t('lic.sqljs.sub'), '<p>© sql.js authors; SQLite — public domain</p><p>' + t('lic.mit') + '</p>') +
      lic('Capacitor', t('lic.cap.sub'), '<p>© Ionic ' + t('lic.andContrib') + '</p><p>' + t('lic.cap.text') + '</p>') +
      lic('Tauri', t('lic.tauri.sub'), '<p>© Tauri Programme within The Commons Conservancy</p><p>' + t('lic.tauri.text') + '</p>') +
      '<div class="lic"><h3>' + t('lic.snd.title') + '</h3><p>' + t('lic.snd.text') + '</p></div></div>';
  }
  sheet(() => body);
}
