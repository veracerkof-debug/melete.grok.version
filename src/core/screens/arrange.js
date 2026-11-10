// Правка вкладок и «Инструментов», как рабочий стол телефона (решение автора 28.10.2026: «кастомизация полная, жестом;
// доступ к правке — долгим нажатием»). Удержание вкладки или карточки в «Инструментах» — режим правки: значки
// покачиваются, сверху над вкладками — «Готово». В режиме правки вещь ведётся пальцем сразу: по полосе вкладок —
// порядок, с полосы вверх — в «Инструменты», из «Инструментов» на полосу — вкладкой. Для тех, кто жест не знает, —
// значки «−» (в инструменты) и «+» (вкладкой); касание карточки — её меню. Главная и «Инструменты» остаются внизу.
// В «Минимале» правки вкладок нет: там их две (главная и «Песни»).
import { t } from '../../i18n/index.js';
import { toast, esc } from '../../ui/index.js';
import { buzz } from '../../ui/hold.js';
import { tabIds, isPage } from './common.js';
import { visibleTabs, orderTabs, placeTab, tabToTools, FIXED_TABS, TABS_MAX, setFeature } from '../settings.js';
import { toolsTab, setToolsTab } from './tools.js';

const HOLD_MS = 450, SLOP = 8;

export function createArrange(app, { root, bar, main, render, cardMenu }) {
  const html = document.documentElement, st = () => app.store.state.settings;
  const known = () => tabIds(st());
  let P = null, D = null, tm = 0, eatClick = false, eatTm = 0;
  // клик сразу после удержания или ведения гасится; если его не было (палец ушёл далеко) — следующий уже живой
  const eat = () => { eatClick = true; clearTimeout(eatTm); eatTm = setTimeout(() => { eatClick = false; }, 450); };
  const on = () => html.classList.contains('arrange');
  const enabled = () => st().uiStyle !== 'mono';
  const set = (v) => {
    if (on() === v) return;
    html.classList.toggle('arrange', v);
    render();
  };
  // что под пальцем: вкладка на полосе или карточка в сетке «Инструментов»
  const itemOf = (e) => {
    const tab = e.target.closest && e.target.closest('.tab');
    if (tab && bar.contains(tab)) return { el: tab, kind: 'tab', id: tab.dataset.tab };
    const card = e.target.closest && e.target.closest('.tgrid [data-open-tool]');
    if (card && main.contains(card)) return { el: card, kind: 'card', id: card.dataset.openTool };
    return null;
  };
  const find = (kind, id) => (kind === 'tab' ? bar.querySelector('.tab[data-tab="' + id + '"]') : main.querySelector('.tgrid [data-open-tool="' + id + '"]'));

  root.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !enabled() || e.target.closest('[data-arr]')) return;
    const it = itemOf(e);
    if (!it) return;
    P = { ...it, x: e.clientX, y: e.clientY, pid: e.pointerId };
    clearTimeout(tm);
    if (!on()) tm = setTimeout(() => {
      if (!P) return;
      buzz(); eat();
      set(true); // перерисовка — элемент под пальцем новый
      P.el = find(P.kind, P.id) || P.el;
    }, HOLD_MS);
  });
  document.addEventListener('pointermove', (e) => {
    if (D && e.pointerId === D.pid) { e.preventDefault(); drag(e); return; }
    if (!P || e.pointerId !== P.pid) return;
    if (Math.hypot(e.clientX - P.x, e.clientY - P.y) <= SLOP) return;
    if (on()) { start(e); return; }
    clearTimeout(tm); P = null; // до удержания — обычная прокрутка
  }, { passive: false });
  const up = (e) => {
    clearTimeout(tm);
    if (D && e.pointerId === D.pid) { drop(); eat(); }
    P = null;
  };
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);

  // Касания в режиме правки: «−», «+», «Готово»; карточка — меню; после удержания или ведения клик гасится
  root.addEventListener('click', (e) => {
    if (eatClick) { eatClick = false; e.preventDefault(); e.stopPropagation(); return; }
    const a = e.target.closest('[data-arr]');
    if (a) { e.preventDefault(); e.stopPropagation(); act(a.dataset.arr); return; }
    if (!on()) return;
    const card = e.target.closest('.tgrid [data-open-tool]');
    if (card) { e.preventDefault(); e.stopPropagation(); cardMenu(card); }
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && on() && !document.querySelector('#sheetLayer .scrim, .hmenu')) set(false); });

  function act(a) {
    const [op, id] = a.split(':');
    if (op === 'done') { set(false); return; }
    if (op === 'out') { if (tabToTools(app.store, known(), id)) { toast(t('tabs.toToolsDone')); render(); } return; }
    if (op === 'in') { if (placeTab(app.store, known(), id) === 'max') toast(t('tabs.max', { max: TABS_MAX })); else render(); }
    // «−» на карточке инструмента: выключить, как в «Модулях и функциях» (слово автора 06.11.2026); вернуть — там же или «Отменить»
    if (op === 'off') { setFeature(app.store, id, false); render(); toast(t('tools.offToast'), { action: t('ui.undo'), onAction: () => { setFeature(app.store, id, true); render(); } }); }
  }

  // Ведение: призрак под пальцем, исходный — бледный; метка — куда встанет
  function start(e) {
    const el = find(P.kind, P.id) || P.el, r = el.getBoundingClientRect();
    const g = el.cloneNode(true);
    g.classList.add('arrghost');
    Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    // призрак — в той же цепочке классов, что и оригинал (обёртки display: contents): стили вида «.tgrid .tcard2»,
    // «.tabbar .tab», «Минимала» действуют и на него — под пальцем он выглядит так же (слово автора 06.11.2026)
    let host = document.body;
    const chain = [];
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) chain.unshift(p);
    chain.forEach((p) => { const w = document.createElement(p.tagName === 'NAV' ? 'nav' : 'div'); w.className = p.className; w.style.display = 'contents'; host.appendChild(w); host = w; });
    host.appendChild(g);
    g._wrap = chain.length ? document.body.lastElementChild : null;
    el.classList.add('arrsrc');
    D = { ...P, el, g, x0: e.clientX, y0: e.clientY, zone: null, idx: -1 };
    P = null;
    drag(e);
  }
  const clearMarks = () => document.querySelectorAll('.arrins,.arrafter,.arrend,.arrout').forEach((x) => x.classList.remove('arrins', 'arrafter', 'arrend', 'arrout'));
  function drag(e) {
    const { g, x0, y0 } = D, x = e.clientX, y = e.clientY;
    g.style.transform = 'translate(' + (x - x0) + 'px,' + (y - y0) + 'px) scale(1.06)';
    clearMarks();
    const br = bar.getBoundingClientRect(), vert = br.height > br.width;
    if (x >= br.left - 12 && x <= br.right + 12 && y >= br.top - 12 && y <= br.bottom + 12) {
      const items = [...bar.querySelectorAll('.tab')].filter((b) => b !== D.el);
      const idx = items.filter((b) => { const r = b.getBoundingClientRect(); return vert ? r.top + r.height / 2 < y : r.left + r.width / 2 < x; }).length;
      D.zone = 'bar'; D.idx = idx;
      if (items[idx]) items[idx].classList.add('arrins'); else bar.classList.add('arrend');
      return;
    }
    const cards = [...main.querySelectorAll('.tgrid [data-open-tool]')].filter((c) => c !== D.el);
    if (cards.length) {
      let best = null, bd = Infinity;
      cards.forEach((c) => { const r = c.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y); if (d < bd) { bd = d; best = c; } });
      const r = best.getBoundingClientRect(), after = x > r.left + r.width / 2;
      D.zone = 'grid'; D.target = best.dataset.openTool; D.after = after;
      best.classList.add(after ? 'arrafter' : 'arrins');
      return;
    }
    D.zone = D.kind === 'tab' ? 'out' : null; // вкладка поднята над полосой — уйдёт в «Инструменты»
    if (D.zone) bar.classList.add('arrout');
  }
  function drop() {
    const d = D; D = null;
    clearMarks();
    if (d.g._wrap) d.g._wrap.remove(); else d.g.remove();
    d.el.classList.remove('arrsrc');
    const s = st(), K = known();
    if (d.kind === 'tab' && d.zone === 'bar') {
      const vis = visibleTabs(s, K).filter((k) => k !== d.id);
      vis.splice(d.idx, 0, d.id);
      orderTabs(app.store, K, vis);
    } else if (d.kind === 'tab' && (d.zone === 'grid' || d.zone === 'out')) {
      if (FIXED_TABS.includes(d.id)) { toast(t('arr.fixed')); render(); return; }
      if (!tabToTools(app.store, K, d.id)) { render(); return; }
      if (d.zone === 'grid') moveInTools(d.id, d.target, d.after);
      toast(t('tabs.toToolsDone'));
    } else if (d.kind === 'card' && d.zone === 'bar') {
      if (placeTab(app.store, K, d.id, d.idx, isPage(d.id)) === 'max') toast(t('tabs.max', { max: TABS_MAX }));
    } else if (d.kind === 'card' && d.zone === 'grid') moveInTools(d.id, d.target, d.after);
    render();
  }
  // Порядок в «Инструментах»: id — перед (или после) target
  function moveInTools(id, target, after) {
    const s = st(), T = toolsTab(s), o = T.order.filter((k) => k !== id);
    let i = o.indexOf(target);
    if (i < 0) i = o.length; else if (after) i++;
    o.splice(i, 0, id);
    T.order = o;
    setToolsTab(s, T);
    app.store.settingsChanged();
  }

  return {
    on, set,
    // значок на вкладке и карточке в режиме правки
    tabBadge: (id) => (on() && enabled() && !FIXED_TABS.includes(id) ? '<i class="arrb out" data-arr="out:' + id + '" role="button" tabindex="0" aria-label="' + esc(t('tabs.toTools')) + '">−</i>' : ''),
    barHTML: () => '<div class="arrbar" role="toolbar"><span>' + esc(t('arr.hint')) + '</span><button class="btn sm fill" data-arr="done">' + esc(t('hb.done')) + '</button></div>',
  };
}
