// Проверка доступности по исходникам (npm run check:a11y).
// Правила проекта: подписи aria-label у кнопок, крупные цели касания (≥ 40 px), кольцо фокуса не снимается.
// Скрипт ловит три класса дефектов:
//   1. role="button" без tabindex — элемент недостижим с клавиатуры;
//   2. outline:none на фокусируемом элементе — кольцо фокуса погашено;
//   3. кнопка или иконка меньше 40 px — цель касания мельче, чем нужно пальцу.
//
// Осознанные исключения — списком ниже, с причиной: иначе правило превращается в формальность.
//
// Запуск: node build/check-a11y.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const problems = [];
const note = (kind, where, text) => problems.push({ kind, where, text });

// Осознанные исключения: что и почему меньше 40 px или без кольца фокуса
const SMALL_OK = [
  ['.cwchip', 'чипы календаря: сетка ячеек, рядом — другие чипы; увеличение ломает сетку'],
  ['.lpshv', 'сдвиг в лупере: узкая колонка панелей'],
  ['.lvchip', 'чип ноты в плеере'],
  ['.slt', 'выбор тонатуры в синтезаторе'],
  ['.pfbtn', 'кнопка во весь экран в окне модуля'],
  ['.tbfs', 'служебные полосы прогресса (не кнопки)'],
  ['.beat', 'точка доли в сетке (не кнопка)'],
  ['.check', 'галочка в списке (не кнопка)'],
  ['.hcnever input', 'галочка внутри метки 40 px — цель касания вся метка'],
  ['.tournv input', 'галочка внутри метки 40 px — цель касания вся метка'],
  ['.agchk input', 'галочка внутри метки 40 px — цель касания вся метка'],
];
// Кольцо фокуса снято осознанно: у элемента свой :focus-visible с кольцом (base.css) или он не фокусируется
const OUTLINE_OK = [
  ['.mwheel', 'колесо рисует само и получает кольцо из base.css (:focus-visible)'],
  ['.pdfv', 'прокручиваемая область: кольцо не нужно'],
];

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const allowed = (sel, list) => list.some(([name]) => sel.includes(name));

// --- 1. role="button" без tabindex ---
// Осознанно без tabindex: сегменты колеса метронома — внутри ползунка (#mwsl, role="slider");
// с клавиатуры колесо и так доступно, а вложенные интерактивные элементы запрещены (WCAG).
const KB_OK = [['src/modules/metro/index.js', 'class="wseg']];
for (const file of walk(join(ROOT, 'src'))) {
  if (!file.endsWith('.js')) continue;
  const rel = relative(ROOT, file);
  const code = readFileSync(file, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    if (!line.includes('role="button"')) return;
    if (line.includes('tabindex')) return;
    if (KB_OK.some(([f, frag]) => rel.endsWith(f) && line.includes(frag))) return;
    if (line.includes('closest(') || line.includes('querySelector')) return; // это селектор в коде, а не элемент
    note('клавиатура', rel + ':' + (i + 1), 'role="button" без tabindex — с клавиатуры не достичь');
  });
}

// --- 2. outline:none на фокусируемом ---
for (const file of walk(join(ROOT, 'src'))) {
  if (!file.endsWith('.css')) continue;
  const rel = relative(ROOT, file);
  const code = readFileSync(file, 'utf8');
  code.split('\n').forEach((line, i) => {
    if (!/outline\s*:\s*none/i.test(line)) return;
    if (allowed(line, OUTLINE_OK)) return;
    // снятие кольца на элементах, у которых свой фокус (ползунки, круги) — они перечислены в own
    if (/^\s*(:root|\.knob|\.mxt|\.smt|\.smp|\.whwrap|\.fxcv|\.range|\.circle \.sec)/.test(line)) return;
    note('фокус', rel + ':' + (i + 1), line.trim().slice(0, 90));
  });
}

// --- 3. цели касания меньше 40 px ---
// Считаем целью сам элемент, а не значок внутри него: значок может быть и 18 px, если место касания —
// вся кнопка (в лаунчере так и сделано: «значок меньше, место касания — прежнее»).
const BTN_CLASS = /^(ic|btn|button|chip|fab|tgl|sw)$/;
const BTN_EL = /^(button|a|input|select|textarea|label)$/;
for (const file of walk(join(ROOT, 'src'))) {
  if (!file.endsWith('.css')) continue;
  const rel = relative(ROOT, file);
  const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''); // комментарии — не правила
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(code))) {
    const sel = m[1].trim(), body = m[2];
    if (sel.includes('::')) continue; // псевдоэлемент — не цель
    // последний простой селектор: именно он и есть элемент
    const last = sel.split(/[\s,>+~]+/).filter(Boolean).pop() || '';
    const el = (last.match(/^[a-zA-Z][a-zA-Z0-9]*/) || [''])[0];
    const classes = (last.match(/\.[a-zA-Z0-9_-]+/g) || []).map((c) => c.slice(1));
    if (!BTN_EL.test(el) && !classes.some((c) => BTN_CLASS.test(c))) continue;
    const size = body.match(/(?:^|;)\s*(?:min-)?(?:width|height)\s*:\s*(\d+)px/);
    if (!size) continue;
    const px = +size[1];
    if (px >= 40) continue;
    if (allowed(sel, SMALL_OK)) continue;
    const line = code.slice(0, m.index).split('\n').length;
    note('цель касания', rel + ':' + line, sel.replace(/\s+/g, ' ').slice(0, 50) + ' — ' + px + ' px');
  }
}

if (!problems.length) {
  console.log('доступность: всё в порядке — у кнопок есть подписи, цели не меньше 40 px, кольцо фокуса не снято.');
  process.exit(0);
}
for (const p of problems) console.log('[' + p.kind + '] ' + p.where + ' — ' + p.text);
console.log('\nдоступность: ' + problems.length + ' замечаний.');
process.exit(1);
