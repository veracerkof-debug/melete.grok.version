// Изучение по логике MyBible — только в виде «Минимал» (ctx.mono). Подключённые модули словарей, комментариев,
// перекрёстных ссылок и подзаголовков (файлы *.dictionary/.commentaries/.crossreferences/.subheadings.SQLite3).
// Жесты как в MyBible: двойное касание слова или номера Стронга — статья лексикона (у слова без номера — словари);
// касание метки — комментарий, перекрёстные ссылки, сноска; ссылки в статьях (B:, S:, C:@) — переходы.
// Плюс: смахивание влево-вправо — соседняя глава, щипок — размер шрифта, долгое касание стиха — меню стиха.
import { renderVerse, sanitizeHTML, parseBRef, parseCRef, subheadingHTML, strongPrefix } from '../../core/mybible-study.js';

const PREF = { strong: true, comm: true, xref: true, subs: true };
export const prefs = (ctx) => ({ ...PREF, ...(ctx.store.get('study') || {}) });

// Открытые вспомогательные модули: { dict: [], comm: [], xref: [], subs: [] } — открываются при первом обращении
let aux = null, auxP = null;
export function auxModules(ctx) {
  if (aux) return Promise.resolve(aux);
  if (!auxP) {
    auxP = (async () => {
      const { openModule } = await import('../../core/mybible-study.js');
      const out = { dict: [], comm: [], xref: [], subs: [] }, key = { dictionary: 'dict', commentaries: 'comm', crossreferences: 'xref', subheadings: 'subs' };
      for (const r of ctx.files.list('bible').filter((x) => x.meta && key[x.meta.type])) {
        try { out[key[r.meta.type]].push(await openModule(new Uint8Array(await r.blob.arrayBuffer()), r.meta.file || r.name)); }
        catch (e) { ctx.logErr(e); }
      }
      aux = out;
      return out;
    })().finally(() => { auxP = null; });
  }
  return auxP;
}
export function closeAux() { if (aux) Object.values(aux).flat().forEach((m) => m.close()); aux = null; }
export const auxCount = (ctx) => ctx.files.list('bible').filter((x) => x.meta && x.meta.type && x.meta.type !== 'bible').length;

/* ---------- текст главы ---------- */
// rows — [{ v, t }] (t — с тегами MyBible) или стихи строками (Синодальный); x — метки главы
export function chapterHTML(ctx, P, cur, rows, x) {
  const { ui } = ctx, pf = prefs(ctx), prefix = strongPrefix(cur.code, P.prefix);
  const head = (v) => (pf.subs ? [...(x.stories.get(v) || []), ...(x.subs.get(v) || [])].map((s) => '<div class="bsub">' + subheadingHTML(s) + '</div>').join('') : '');
  const marks = (v, pre) => {
    let m = '';
    if (pf.comm && x.comm.some((c) => c.at === v && !!c.pre === pre)) m += '<sup class="bcm" data-cv="' + v + '" role="button" tabindex="0" aria-label="' + ui.esc(ctx.t('st.comm')) + '">◆</sup>';
    if (!pre && pf.xref && x.xref.has(v)) m += '<sup class="bxr" data-xv="' + v + '" role="button" tabindex="0" aria-label="' + ui.esc(ctx.t('st.xref')) + '">↗</sup>';
    return m;
  };
  return rows.map((r, i) => {
    const v = r.v ?? i + 1, body = r.t != null ? renderVerse(r.t, { prefix, strong: pf.strong && P.strong }) : ui.esc(r);
    return head(v) + '<span class="bv" data-v="' + v + '">' + marks(v, true) + '<sup>' + v + '</sup>' + body + marks(v, false) + ' </span>';
  }).join('');
}

// Метки главы из всех модулей: комментарии (к какому стиху), ссылки, подзаголовки
export async function chapterMarks(ctx, P, code, ch) {
  const a = await auxModules(ctx), comm = [], xref = new Map(), subs = new Map();
  a.comm.filter((m) => !m.footnotes).forEach((m) => m.chapter(code, ch).forEach((c) => comm.push({ at: c.at, pre: false })));
  a.xref.forEach((m) => m.chapter(code, ch).forEach((l, v) => xref.set(v, [...(xref.get(v) || []), ...l])));
  a.subs.forEach((m) => m.chapter(code, ch).forEach((l, v) => subs.set(v, [...(subs.get(v) || []), ...l])));
  return { comm, xref, subs, stories: P.stories ? P.stories(code, ch) : new Map() };
}

/* ---------- шторки ---------- */
function articleSheet(ctx, title, sections, nav) {
  const { ui } = ctx;
  const api = ui.sheet(() => ui.snav(title) + sections.map((s) => '<div class="bart">' + (s.head ? '<div class="barth">' + s.head + '</div>' : '') + '<div class="bartb">' + s.html + '</div></div>').join(''), (el) => {
    el.addEventListener('click', (e) => { const a = e.target.closest('a.blink'); if (a) { e.preventDefault(); follow(ctx, a.dataset.href, nav, api); } });
  });
  return api;
}

// Статья лексикона Стронга: слово оригинала, транслитерация, произношение, краткое значение и статья
export async function lexicon(ctx, topic, nav) {
  const a = await auxModules(ctx), t = String(topic).toUpperCase();
  const found = a.dict.map((d) => ({ d, r: d.get(t) })).filter((x) => x.r);
  if (!found.length) { ctx.ui.toast(ctx.t(a.dict.some((d) => d.strong) ? 'st.noTopic' : 'st.noLex', { t })); return; }
  ctx.log('Стронг ' + t);
  articleSheet(ctx, t, found.map(({ d, r }) => ({
    head: ctx.ui.esc(d.title),
    html: (r.lexeme ? '<div class="blex" lang="' + (t[0] === 'G' ? 'el' : 'he') + '">' + ctx.ui.esc(r.lexeme) + '</div>' : '') +
      ([r.transliteration, r.pronunciation].filter(Boolean).length ? '<div class="btr2">' + ctx.ui.esc([r.transliteration, r.pronunciation].filter(Boolean).join(' · ')) + '</div>' : '') +
      (r.short_definition ? '<div class="bshort">' + ctx.ui.esc(r.short_definition) + '</div>' : '') + sanitizeHTML(r.definition) + cognatesHTML(ctx, d, t),
  })), nav);
}
// Однокоренные (таблица cognate_strong_numbers лексикона) — ссылками на свои статьи
function cognatesHTML(ctx, d, t) {
  const list = d.cognates ? d.cognates(t).slice(0, 40) : [];
  return list.length ? '<div class="bcog"><span class="bdf">' + ctx.t('st.cognates') + ':</span> ' + list.map((x) => '<a class="blink" data-href="S:' + ctx.ui.esc(x) + '">' + ctx.ui.esc(x) + '</a>').join(', ') + '</div>' : '';
}

// Морфология (код после слова, например «V-PAI-3S»): расшифровка по лексикону с таблицей морфологии
export async function morph(ctx, code, nav) {
  const a = await auxModules(ctx), d = a.dict.find((x) => x.hasMorph);
  if (!d) { ctx.ui.toast(ctx.t('st.noMorph', { m: code })); return; }
  const r = d.morph(code);
  ctx.log('морфология ' + code);
  articleSheet(ctx, code, [{ head: ctx.ui.esc(d.title), html: '<div class="bshort">' + r.parts.map((x) => ctx.ui.esc(x)).join(' · ') + '</div>' +
    (r.topic ? '<a class="blink" data-href="S:' + ctx.ui.esc(r.topic) + '">' + ctx.ui.esc(ctx.t('st.morphMore')) + '</a>' : '') }], nav);
}

// Слово без номера Стронга — по словарям
export async function dictWord(ctx, word, nav) {
  const a = await auxModules(ctx), w = String(word || '').replace(/[^\p{L}\p{M}'’-]/gu, '');
  if (!w) return;
  const found = a.dict.filter((d) => !d.strong).flatMap((d) => d.find(w).map((r) => ({ d, r })));
  if (!found.length) { ctx.ui.toast(ctx.t(a.dict.length ? 'st.noWord' : 'st.noDict', { w })); return; }
  articleSheet(ctx, w, found.map(({ d, r }) => ({ head: ctx.ui.esc(d.title + ' · ' + r.topic), html: sanitizeHTML(r.definition) })), nav);
}

// Комментарии к стиху — все модули (сравнение)
export async function commentary(ctx, P, code, ch, v, nav) {
  const a = await auxModules(ctx);
  const list = a.comm.filter((m) => !m.footnotes).flatMap((m) => m.verse(code, ch, v).map((r) => ({ head: ctx.ui.esc(m.title + ' · ' + P.abbr(code) + ' ' + r.from), html: sanitizeHTML(r.text) })));
  if (!list.length) { ctx.ui.toast(ctx.t(a.comm.length ? 'st.noComm' : 'st.noCommMod')); return; }
  articleSheet(ctx, P.abbr(code) + ' ' + ch + ':' + v, list, nav);
}

// Сноска: модуль сносок с тем же сокращением, что у перевода, и та же метка
export async function footnote(ctx, P, code, ch, v, marker, nav) {
  const a = await auxModules(ctx);
  const list = a.comm.filter((m) => m.footnotes && (!P.abbr0 || m.abbr === P.abbr0)).flatMap((m) => m.verse(code, ch, v).filter((r) => !r.marker || r.marker === marker).map((r) => ({ head: ctx.ui.esc(marker), html: sanitizeHTML(r.text) })));
  if (!list.length) { ctx.ui.toast(ctx.t('st.noFoot')); return; }
  articleSheet(ctx, P.abbr(code) + ' ' + ch + ':' + v, list, nav);
}

// Перекрёстные ссылки стиха: список мест, касание — переход
export function xrefs(ctx, P, code, ch, v, list, nav) {
  const { ui } = ctx;
  const api = ui.sheet(() => ui.snav(P.abbr(code) + ' ' + ch + ':' + v) + '<div class="group">' + list.map((r, i) =>
    '<button class="cell act" data-xi="' + i + '">' + ui.esc(P.abbr(r.code) + ' ' + r.ch + ':' + r.v1 + (r.v2 && r.v2 !== r.v1 ? '–' + r.v2 : '')) + '</button>').join('') + '</div>', (el) => {
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-xi]'); if (b) { const r = list[+b.dataset.xi]; api.close(); nav(r.code, r.ch, r.v1); } });
  });
}

// Ссылка в статье или подзаголовке: S: — лексикон или словарь, B: — место Писания, C:@ — комментарий к месту
export function follow(ctx, href, nav, api = null) {
  href = String(href || '');
  if (href.startsWith('S:')) { lexiconOrDict(ctx, href.slice(2), nav); return; }
  const b = parseBRef(href), c = !b && parseCRef(href);
  if (b || c) { if (api) api.close(); nav(b ? b.code : c.code, b ? b.ch : c.ch, b ? b.v : c.v, b ? null : 'comm'); }
}
async function lexiconOrDict(ctx, topic, nav) {
  if (/^[HG]\d+$/i.test(topic)) return lexicon(ctx, topic, nav);
  const a = await auxModules(ctx), found = a.dict.map((d) => ({ d, r: d.get(topic) })).filter((x) => x.r);
  if (found.length) articleSheet(ctx, topic, found.map(({ d, r }) => ({ head: ctx.ui.esc(d.title), html: sanitizeHTML(r.definition) })), nav);
  else ctx.ui.toast(ctx.t('st.noWord', { w: topic }));
}

// Меню стиха (долгое касание): копировать и отправить с ссылкой и переводом, выбрать несколько; комментарии, ссылки.
// act — { copy, share, select } от модуля (формат цитаты — quote.js)
export function verseMenu(ctx, P, cur, v, text, x, nav, act) {
  const { t, ui } = ctx, xl = x.xref.get(v) || [];
  const api = ui.sheet(() => ui.snav(P.abbr(cur.code) + ' ' + cur.ch + ':' + v) + '<p class="bmtext">' + ui.esc(text) + '</p><div class="group">' +
    '<button class="cell act" data-vm="copy">' + t('st.copy') + '</button>' +
    '<button class="cell act" data-vm="share">' + t('share') + '</button>' +
    '<button class="cell act" data-vm="select">' + t('selMany') + '</button></div><div class="group">' +
    '<button class="cell act" data-vm="comm">' + t('st.comm') + '</button>' +
    (xl.length ? '<button class="cell act" data-vm="xref">' + t('st.xref') + ' · ' + xl.length + '</button>' : '') + '</div>', (el) => {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-vm]');
      if (!b) return;
      api.close();
      const k = b.dataset.vm;
      if (k === 'comm') commentary(ctx, P, cur.code, cur.ch, v, nav);
      else if (k === 'xref') xrefs(ctx, P, cur.code, cur.ch, v, xl, nav);
      else if (act && act[k]) act[k]();
    });
  });
}

/* ---------- жесты ---------- */
// Слово под пальцем и номер Стронга сразу после него (как в MyBible: номер стоит за словом)
function wordAt(x, y) {
  const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
  if (!r || r.startContainer.nodeType !== 3) return null;
  const node = r.startContainer, s = node.textContent, i = r.startOffset;
  let a = i, b = i;
  while (a > 0 && /[\p{L}\p{M}'’-]/u.test(s[a - 1])) a--;
  while (b < s.length && /[\p{L}\p{M}'’-]/u.test(s[b])) b++;
  const word = s.slice(a, b);
  // номер Стронга: следующий элемент после текста слова, если между ними нет других букв
  let strong = null;
  if (!/\p{L}/u.test(s.slice(b))) {
    let n = node.nextSibling;
    while (n && !strong) {
      if (n.nodeType === 1 && n.classList.contains('bs')) strong = n.dataset.s;
      else if (n.nodeType === 1 && n.classList.contains('bmo')) { /* морфология — дальше */ }
      else if (/\p{L}/u.test(n.textContent || '')) break;
      n = n.nextSibling;
    }
  }
  return { word, strong };
}

// Подключить жесты к тексту главы. h — { lexicon(topic), dict(word), comm(v), xref(v), foot(v, marker), menu(v), step(d), font(px), pure(on) }
const SLOW = 280; // мс: дольше — масштаб шрифта, быстрее — полный экран
export function bindGestures(el, h) {
  let down = null, lastTap = 0, lastXY = null, press = 0, pinch = null;
  const clear = () => { clearTimeout(press); press = 0; };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button > 0) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    const vEl = e.target.closest('.bv');
    clear();
    if (vEl) press = setTimeout(() => { press = 0; if (down && !down.moved) { down.long = true; h.menu(+vEl.dataset.v); } }, 520);
  });
  el.addEventListener('pointermove', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down.moved = true; clear(); } });
  el.addEventListener('pointerup', (e) => {
    clear();
    if (!down) return;
    const d = down;
    down = null;
    if (d.long || pinch) return;
    if (h.tap && !d.moved && h.tap(e)) { lastTap = 0; return; } // выбор стихов: касание — отметить
    const dx = e.clientX - d.x, dy = e.clientY - d.y, dt = performance.now() - d.t;
    // смахивание: соседняя глава
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && dt < 700) { h.step(dx < 0 ? 1 : -1); lastTap = 0; return; }
    if (d.moved) return;
    // метки: касание
    const m = e.target.closest('.bs, .bmo, .bfn, .bcm, .bxr, a.blink');
    if (m) {
      const v = +(m.closest('.bv') || {}).dataset?.v || 0;
      if (m.classList.contains('bs')) h.lexicon(m.dataset.s);
      else if (m.classList.contains('bmo')) { if (h.morph) h.morph(m.dataset.m); }
      else if (m.classList.contains('bfn')) h.foot(v, m.dataset.fn);
      else if (m.classList.contains('bcm')) h.comm(+m.dataset.cv);
      else if (m.classList.contains('bxr')) h.xref(+m.dataset.xv);
      else h.link(m.dataset.href);
      lastTap = 0;
      return;
    }
    // двойное касание слова
    const now = performance.now();
    if (now - lastTap < 320 && lastXY && Math.hypot(e.clientX - lastXY.x, e.clientY - lastXY.y) < 30) {
      lastTap = 0;
      const w = wordAt(e.clientX, e.clientY);
      if (w && w.strong) h.lexicon(w.strong);
      else if (w && w.word) h.dict(w.word);
      return;
    }
    lastTap = now;
    lastXY = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener('pointercancel', () => { clear(); down = null; });
  // два пальца (слово автора 06.11.2026): быстрый щипок — полный экран (развести) или обратно (свести);
  // поставил пальцы и повёл медленно — размер шрифта. Решается по первым 280 мс: успели разойтись заметно — «быстрый»
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  el.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { clear(); pinch = { d: dist(e.touches), fs: h.fs(), t: performance.now(), r: 1, mode: null }; } }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const p = pinch, now = performance.now(), dd = dist(e.touches);
    p.r = dd / p.d;
    if (!p.mode) {
      if (now - p.t < SLOW && (p.r >= 1.3 || p.r <= 1 / 1.3)) p.mode = 'fast';
      else if (now - p.t >= SLOW) { p.mode = 'zoom'; p.d = dd; p.fs = h.fs(); p.r = 1; }
    }
    if (p.mode === 'zoom') h.font(p.fs * p.r, false);
  }, { passive: false });
  el.addEventListener('touchend', (e) => {
    if (!pinch || e.touches.length >= 2) return;
    const p = pinch;
    if (p.mode === 'zoom') h.font(null, true);
    else if (h.pure && p.r >= 1.4) h.pure(true);
    else if (h.pure && p.r <= 1 / 1.4) h.pure(false);
    setTimeout(() => { pinch = null; }, 50);
  });
  el.addEventListener('touchcancel', () => { pinch = null; });
}
