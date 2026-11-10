// Проверка словарей и строк интерфейса (npm run check:i18n).
// Правила проекта: все строки интерфейса — через t('key'); языки ru (основной), uz, en; ключи в трёх словарях
// должны совпадать. Скрипт ловит три класса дефектов:
//   1. ключ есть в одном словаре, но нет в другом — в интерфейсе появится сырой ключ;
//   2. в en/uz осталась кириллица — строка не переведена;
//   3. в коде вызывается t('ключ'), которого нет ни в словаре модуля, ни в ядре — будет показан сам ключ.
//
// Запуск: node build/check-i18n.mjs
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const LANGS = ['ru', 'uz', 'en'];
const problems = [];
const note = (kind, where, text) => problems.push({ kind, where, text });

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const flat = (o, pre = '') => {
  const out = [];
  for (const [k, v] of Object.entries(o || {})) {
    const key = pre ? pre + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flat(v, key));
    else out.push(key);
  }
  return out;
};
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

// --- 1. словари: ядро и модули ---
const dicts = []; // { id, dir, keys: { lang: Set } }
const coreRu = flat(readJSON(join(ROOT, 'src/i18n/ru.json')));
dicts.push({ id: 'ядро', dir: 'src/i18n', keys: { ru: new Set(coreRu) } });
for (const l of LANGS.slice(1)) {
  const p = join(ROOT, 'src/i18n', l + '.json');
  if (existsSync(p)) dicts[0].keys[l] = new Set(flat(readJSON(p)));
}
const modsDir = join(ROOT, 'src/modules');
const modDirs = existsSync(modsDir) ? readdirSync(modsDir).filter((d) => statSync(join(modsDir, d)).isDirectory() && existsSync(join(modsDir, d, 'i18n'))) : [];
for (const m of modDirs) {
  const dir = join(modsDir, m, 'i18n'), keys = {};
  for (const l of LANGS) {
    const p = join(dir, l + '.json');
    if (existsSync(p)) keys[l] = new Set(flat(readJSON(p)));
  }
  dicts.push({ id: 'модуль ' + m, dir: relative(ROOT, dir), keys });
}

for (const d of dicts) {
  if (!d.keys.ru) { note('словарь', d.dir, 'нет ru.json'); continue; }
  for (const l of LANGS.slice(1)) {
    if (!d.keys[l]) { note('словарь', d.dir, 'нет ' + l + '.json'); continue; }
    const missing = [...d.keys.ru].filter((k) => !d.keys[l].has(k));
    const extra = [...d.keys[l]].filter((k) => !d.keys.ru.has(k));
    if (missing.length) note('ключи', d.dir, 'нет в ' + l + ': ' + missing.slice(0, 8).join(', ') + (missing.length > 8 ? ' … (всего ' + missing.length + ')' : ''));
    if (extra.length) note('ключи', d.dir, 'лишние в ' + l + ': ' + extra.slice(0, 8).join(', ') + (extra.length > 8 ? ' … (всего ' + extra.length + ')' : ''));
  }
}

// --- 2. кириллица в en/uz ---
const cyr = /[А-Яа-яЁё]/;
for (const d of dicts) {
  for (const l of ['uz', 'en']) {
    const p = join(ROOT, d.dir, l + '.json');
    if (!existsSync(p)) continue;
    const obj = readJSON(p), bad = [];
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && cyr.test(v)) bad.push(k);
      else if (Array.isArray(v) && v.some((x) => typeof x === 'string' && cyr.test(x))) bad.push(k);
    }
    if (bad.length) note('перевод', d.dir + '/' + l + '.json', 'кириллица в ' + bad.length + ' строках: ' + bad.slice(0, 8).join(', '));
  }
}

// --- 3. ключи, которых нет в словарях ---
const coreKeys = dicts[0].keys.ru || new Set();
const modKeys = new Map(); // id → Set
for (const d of dicts.slice(1)) modKeys.set(d.id.replace('модуль ', ''), d.keys.ru || new Set());

// Вызовы перевода — только с литералом: t('a.b'), ctx.t('a.b'), mt('a.b'), ct('a.b'), coreT('a.b')
// Другие функции с похожим именем (emit, begin, postMessage) — не переводы, поэтому имя сверяется со списком.
const T_FN = new Set(['t', 'tn', 'mt', 'mtn', 'ct', 'ctn', 'coreT', 'i18nT', 'uiT']);
const CALL = /((?:ctx\.|core\.)?([A-Za-z0-9_$]+))\(\s*'([a-zA-Z0-9_.$]+)'\s*\)/g; // только целый литерал: t('a.b') — склейка ключа ('a.' + k) не проверяется
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'legacy', '.git', 'public', 'docs']);

const moduleOf = (file) => {
  const rel = relative(ROOT, file);
  const m = rel.match(/^src\/modules\/([^/]+)\//);
  return m ? m[1] : null;
};

for (const file of walk(join(ROOT, 'src'))) {
  if (!file.endsWith('.js')) continue;
  const rel = relative(ROOT, file);
  if (rel.startsWith('src/i18n/') || rel.startsWith('src/launcher/')) continue; // лаунчер — свой словарь
  const code = readFileSync(file, 'utf8');
  const mod = moduleOf(file);
  const allowed = new Set(coreKeys);
  if (mod && modKeys.has(mod)) for (const k of modKeys.get(mod)) allowed.add(k);
  CALL.lastIndex = 0;
  let m;
  const seen = new Set();
  while ((m = CALL.exec(code))) {
    if (!T_FN.has(m[2])) continue;
    const key = m[3];
    if (!key.includes('.')) continue; // короткие служебные ключи — не словарные
    if (seen.has(key)) continue;
    seen.add(key);
    if (!allowed.has(key)) {
      const line = code.slice(0, m.index).split('\n').length;
      note('нет ключа', rel + ':' + line, key);
    }
  }
}

// --- итог ---
if (!problems.length) {
  console.log('i18n: всё в порядке — словари совпадают, ключи на месте, кириллицы в en/uz нет.');
  process.exit(0);
}
for (const p of problems) console.log('[' + p.kind + '] ' + p.where + ' — ' + p.text);
console.log('\ni18n: ' + problems.length + ' замечаний.');
process.exit(1);
