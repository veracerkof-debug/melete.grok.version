// Связь телефона и компьютера: синхронизация в своей сети Wi-Fi. Компьютер (Windows) — сервер (посредник в Rust:
// src-tauri/src/sync.rs, порт 53319, у DEV — 53329), телефон — клиент. Сопряжение один раз: на компьютере включается «Связь с
// телефоном» — виден адрес и код из 6 цифр; на телефоне вводятся адрес и код, компьютер выдаёт ключ. Дальше —
// кнопка «Синхронизировать» на телефоне (сеть — только по нажатию).
// Что синхронизируется: песни с метками и проекты студии, занятия и профиль, чтение, календарь — части резервной копии
// (backupparts.js: слияние по записям, побеждает более свежая, ничего не теряется); файлы песен и медиатеки —
// записи, табы, ноты, MIDI, дорожки разделения и очищенные записи (без модулей Библии). Дорожки одной записи, посчитанные
// на обоих устройствах, не задваиваются (ключ «запись + часть + режим + версия»). Сведения о записи, посчитанные позже
// (тональность, доли и аккорды rec.ana, текст rec.lyr, отсутствующие части, песни), сливаются, даже если сам файл уже на обоих.
// Удаление файла переносится: телефон помнит, какие файлы были на обоих после прошлой синхронизации (3-стороннее
// сравнение). Настройки и оформление у каждого устройства свои. Ключи сопряжения — не в резервной копии.
// «Считать на компьютере» (settings.pcWork, вкл): телефон не считает дорожки и разбор записей, которые посчитает
// компьютер (он сообщает, что умеет), а сам синхронизируется в фоне (settings.syncAuto, вкл) — только в тишине;
// компьютер берёт записи телефона в свою фоновую очередь (autostems.js, режим — как просил телефон: rec.want) и
// результаты приходят при следующей синхронизации. Компьютера нет дольше суток — телефон считает сам.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { pickParts, applyParts } from './backupparts.js';
import { stripDemo, isDemoFile } from './demo.js';
import { CORE_DICTS, loadAllLangs, t as i18nT } from '../i18n/index.js';
import { log } from './log.js';
import { isDesktop } from './desktop.js';

// Melete DEV — свой порт (src-tauri/src/sync.rs): обе версии на одном компьютере не мешают друг другу
export const PORT_PRE = 53319, PORT_DEV = 53329;
export const PORT = typeof __CHANNEL__ !== 'undefined' && __CHANNEL__ === 'pre' ? PORT_PRE : PORT_DEV;
export const SYNC_PARTS = ['songs', 'profile', 'reading', 'calendar'];
export const CHUNK = 2 << 20; // кусок файла — 2 МБ (в base64 ~2,7 МБ на запрос)
const LS_KEY = 'melete.sync'; // { peers: { ключ: { name, at } } } на компьютере; { pc: { addr, key, name, last, ids } } на телефоне

/* ---------- чистые функции ---------- */

// Файлы, которые синхронизируются: с содержимым, не модули Библии
export const syncable = (r) => !!r && !!r.id && r.kind !== 'bible' && (r.blob || r.size);
// Ключ производного файла: два устройства посчитали одно и то же — второй экземпляр не переносится
export function derivedKey(r) {
  if (r.stem) return 's:' + r.stem.src + ':' + r.stem.part + ':' + (r.stem.mode || '4') + ':' + (r.stem.hq ? 1 : 0);
  if (r.trans) return 'n:' + r.trans.src;
  if (r.dn) return 'd:' + r.dn.src;
  return '';
}
// Сведения записи, которые сливаются между устройствами
const sortObj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.keys(o).sort().map((k) => [k, o[k]]) : o || 0);
function hashStr(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
export const metaHash = (r) => hashStr(JSON.stringify([r.ana ? [r.ana.v || 1, r.ana.at || 0] : 0, r.lyr ? r.lyr.at || 1 : 0, sortObj(r.stemsAbsent), [...(r.songs || [])].sort(), r.want ? [r.want.stems, !!r.want.hq] : 0]));
// Что взять записи a от записи b → изменения или null. Слияние одинаково на обеих сторонах, поэтому сходится:
// разбор — новее по версии и времени, текст — новее, отсутствующие части и песни — объединение, пожелание — если своего нет
export function mergeMeta(a, b) {
  if (!a || !b) return null;
  const p = {}, A = a.ana, B = b.ana;
  if (B && (!A || (B.v || 1) > (A.v || 1) || ((B.v || 1) === (A.v || 1) && (B.at || 0) > (A.at || 0)))) p.ana = B;
  if (b.lyr && (!a.lyr || (b.lyr.at || 0) > (a.lyr.at || 0))) p.lyr = b.lyr;
  const sa = a.stemsAbsent && !Array.isArray(a.stemsAbsent) ? a.stemsAbsent : {}, sb = b.stemsAbsent && !Array.isArray(b.stemsAbsent) ? b.stemsAbsent : {};
  if (Object.keys(sb).some((k) => !(k in sa))) p.stemsAbsent = { ...sb, ...sa };
  const songs = new Set(a.songs || []);
  if ((b.songs || []).some((x) => !songs.has(x))) p.songs = [...songs, ...(b.songs || []).filter((x) => !songs.has(x))];
  if (b.want && !a.want) p.want = b.want;
  return Object.keys(p).length ? p : null;
}
const metaFields = (r) => { const o = { id: r.id }; ['ana', 'lyr', 'stemsAbsent', 'songs', 'want'].forEach((k) => { if (r[k] != null) o[k] = r[k]; }); return o; };
export const manifestOf = (list) => list.filter(syncable).map((r) => { const k = derivedKey(r); return { id: r.id, size: r.size || (r.blob && r.blob.size) || 0, name: r.name || '', h: metaHash(r), ...(k ? { k } : {}) }; });
// Без содержимого и служебного — то, что уходит вместе с файлом
export function metaOf(r) { const m = { ...r }; delete m.blob; delete m._busy; return m; }

// План обмена файлами. mine, theirs — манифесты; last — id, которые были на обоих после прошлой синхронизации.
// Нет у них, но было у обоих — там удалили: удалить у себя. Нет у меня, но было у обоих — я удалил: удалить у них.
// Производный файл (дорожка, ноты), у которого на другой стороне есть свой с тем же ключом, не переносится; ключи
// считаются по тому, что останется после удалений (пересчитанные дорожки заменяют старые). meta — файлы на обоих с разными сведениями
export function planFiles(mine, theirs, last = []) {
  const A = new Set(mine.map((x) => x.id)), B = new Set(theirs.map((x) => x.id)), L = new Set(last);
  const out = { upload: [], download: [], delMine: [], delTheirs: [], meta: [] };
  mine.forEach((x) => { if (!B.has(x.id) && L.has(x.id)) out.delMine.push(x.id); });
  theirs.forEach((x) => { if (!A.has(x.id) && L.has(x.id)) out.delTheirs.push(x.id); });
  const dm = new Set(out.delMine), dt = new Set(out.delTheirs);
  const kA = new Set(mine.filter((x) => x.k && !dm.has(x.id)).map((x) => x.k)), kB = new Set(theirs.filter((x) => x.k && !dt.has(x.id)).map((x) => x.k));
  mine.forEach((x) => { if (!B.has(x.id) && !L.has(x.id) && !(x.k && kB.has(x.k))) out.upload.push(x.id); });
  theirs.forEach((x) => { if (!A.has(x.id) && !L.has(x.id) && !(x.k && kA.has(x.k))) out.download.push(x.id); });
  const hB = new Map(theirs.map((x) => [x.id, x.h]));
  mine.forEach((x) => { if (hB.has(x.id) && x.h && hB.get(x.id) && hB.get(x.id) !== x.h) out.meta.push(x.id); });
  return out;
}
// Адрес «192.168.1.5» / «192.168.1.5:53319» / с запятыми → https://192.168.1.5:53319 (компьютер говорит только по TLS)
export function baseOf(addr) {
  let s = String(addr || '').trim().replace(/\s+/g, '').replace(/,/g, '.').replace(/\/+$/, '');
  if (!s) return null;
  s = s.replace(/^http:\/\//i, 'https://');
  if (!/^https:\/\//i.test(s)) s = 'https://' + s;
  try { const u = new URL(s); if (!u.port) u.port = String(PORT); return u.origin; } catch { return null; }
}
export const newCode = (rnd = Math.random) => String(Math.floor(rnd() * 900000) + 100000);
export function newKey(rnd = Math.random) { let s = ''; while (s.length < 32) s += Math.floor(rnd() * 16).toString(16); return s; }

const b64 = {
  from(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
  to(str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; },
};
export { b64 };

// Проверочный код отпечатка — первые 8 знаков группами: одинаковый на экранах компьютера и телефона
export const fpCheck = (fp) => (fp ? String(fp).slice(0, 8).toUpperCase().replace(/(.{4})/, '$1 ') : '');
const readLS = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } };
const writeLS = (v) => { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch (e) { log('sync', 'состояние связи не сохранено (нет места?): ' + (e && e.name), 'w'); } };

/* ---------- компьютер: обработка запросов телефона ---------- */

// Обработать запрос. req: { method, path, query, key, json, bytes }; → { status, json } | { status, bytes }.
// ctx: { app, mem, code, name } — mem: { peers }, code — текущий код сопряжения; incoming — недокачанные файлы
// Подбор кода: после PAIR_TRIES неверных попыток — пауза PAIR_LOCK мс (шесть цифр иначе перебираются за минуты)
export const PAIR_TRIES = 5, PAIR_LOCK = 60000;
const pairGuard = { fails: 0, until: 0 };
export const resetPairGuard = () => { pairGuard.fails = 0; pairGuard.until = 0; };
export async function handleRequest(ctx, req, incoming = new Map()) {
  if (req.path === '/melete/v1/sync') await loadAllLangs(); // демо-файлы на любом языке — мимо обмена; опрос ансамбля не ждёт
  const { app, mem } = ctx;
  if (req.path === '/melete/v1/pair') {
    const t = (ctx.now || Date.now)();
    if (t < pairGuard.until) return { status: 429, json: { error: 'wait' } };
    const code = String((req.json && req.json.code) || '').replace(/\D/g, '');
    if (!ctx.code || code !== ctx.code) {
      if (++pairGuard.fails >= PAIR_TRIES) { pairGuard.fails = 0; pairGuard.until = t + PAIR_LOCK; log('sync', 'неверный код ' + PAIR_TRIES + ' раз — пауза', 'w'); }
      return { status: 403, json: { error: 'code' } };
    }
    pairGuard.fails = 0;
    const key = newKey();
    mem.peers = { ...(mem.peers || {}), [key]: { name: String((req.json && req.json.name) || 'Телефон').slice(0, 60), at: Date.now() } };
    log('sync', 'сопряжение: устройство ' + String(key).slice(0, 6));
    return { status: 200, json: { key, name: ctx.name || 'PC' } };
  }
  const peer = mem.peers && mem.peers[req.key];
  if (!peer) return { status: 401, json: { error: 'key' } };
  // фоновая синхронизация телефона ждёт, пока на компьютере звучит музыка или идёт занятие: приём файлов нагружает окно
  if ((req.query.auto || (req.json && req.json.auto)) && ctx.busy && ctx.busy()) return { status: 503, json: { error: 'busy' } };
  const F = app.files;
  // ансамбль (ensemble.js): опрос участника и сверка часов — без ожидания тишины
  // пульт с сопряжённого устройства (netctl.js) — без ожидания тишины
  if (req.path.startsWith('/melete/v1/rc/')) return ctx.rc ? ctx.rc(req.path, req.json, { key: req.key, name: peer.name }) : { status: 404, json: {} };
  if (req.path === '/melete/v1/ens') return ctx.ens ? ctx.ens.poll(req.key, peer.name, req.json || {}) : { status: 409, json: { error: 'off' } };
  if (req.path === '/melete/v1/sync') {
    const p = req.json && req.json.data;
    if (p) app.store.replaceState(applyParts(app.store.state, stripDemo(p), SYNC_PARTS));
    peer.at = Date.now();
    return { status: 200, json: { data: pickParts(stripDemo(app.store.state), SYNC_PARTS), files: manifestOf(allFiles(F)), work: ctx.work ? ctx.work() : null } };
  }
  if (req.path === '/melete/v1/setmeta') {
    const m = (req.json && req.json.meta) || {}, r = F && F.get(m.id);
    if (!r) return { status: 404, json: {} };
    const p = mergeMeta(r, m);
    if (p) { Object.assign(r, p); await F.save(r); }
    return { status: 200, json: { h: metaHash(r) } };
  }
  if (req.path === '/melete/v1/delete') {
    let n = 0;
    for (const id of (req.json && req.json.ids) || []) { const r = F && F.get(id); if (r && syncable(r)) { await F.remove(id); n++; } }
    return { status: 200, json: { removed: n } };
  }
  if (req.path === '/melete/v1/meta') {
    const r = F && F.get(req.query.id);
    return r ? { status: 200, json: metaOf(r) } : { status: 404, json: {} };
  }
  if (req.path === '/melete/v1/get') {
    const r = F && F.get(req.query.id);
    if (!r || !r.blob) return { status: 404, json: {} };
    const off = +req.query.off || 0, len = Math.min(+req.query.len || CHUNK, CHUNK);
    return { status: 200, bytes: new Uint8Array(await r.blob.slice(off, off + len).arrayBuffer()) };
  }
  if (req.path === '/melete/v1/put') {
    const j = req.json || {}, meta = j.meta || {};
    if (!meta.id || !syncable({ ...meta, size: meta.size || 1 })) return { status: 400, json: {} };
    if (F.get(meta.id)) { if (meta.ens && ctx.ens) ctx.ens.gotFile(req.key, meta); return { status: 200, json: { done: true, have: true } }; }
    const cur = incoming.get(meta.id) || { meta, parts: [], got: 0 };
    if ((+j.off || 0) !== cur.got) return { status: 200, json: { got: cur.got } }; // кусок не по порядку (прерванная передача) — с какого продолжить
    const u8 = b64.to(j.b64 || '');
    cur.parts.push(u8); cur.got += u8.length;
    incoming.set(meta.id, cur);
    if (cur.got >= (meta.size || 0)) {
      incoming.delete(meta.id);
      await F.add({ ...meta, blob: new Blob(cur.parts, { type: meta.type || '' }) });
      if (meta.ens && ctx.ens) ctx.ens.gotFile(req.key, meta);
      if (meta.sent && ctx.got) ctx.got(meta, peer); // отправили именно сюда — сказать
      return { status: 200, json: { done: true } };
    }
    return { status: 200, json: { got: cur.got } };
  }
  return { status: 404, json: {} };
}
// демо-набор между устройствами не ходит (demo.js)
const allFiles = (F) => (F ? ['audio', 'tab', 'midi', 'daw'].flatMap((k) => F.list(k)).filter((r) => !isDemoFile(r, CORE_DICTS)) : []);

// Связь всех со всеми (Melete DEV, слово автора 07.11.2026): телефон тоже принимает подключения — плагин Mesh
// (MeshServer.java: TLS, свой сертификат), тот же протокол и обработчик, что у компьютера. В pre — только компьютер.
// Подключаться к другим устройствам как к «Моим устройствам»: телефон DEV и компьютер DEV
export const meshClient = () => typeof __CHANNEL__ !== 'undefined' && __CHANNEL__ === 'dev' && (Capacitor.getPlatform() === 'android' || isDesktop());
export const meshAvail = () => Capacitor.getPlatform() === 'android' && typeof __CHANNEL__ !== 'undefined' && __CHANNEL__ === 'dev';
// Сервер ↔ этот обработчик: компьютер — Rust (sync.rs, события Tauri), телефон DEV — плагин Mesh (transport: 'mesh').
// → { start, stop, state, forget(key), subscribe }
export function createSyncServer(app, { isDesktop, transport = 'tauri' }) {
  const mesh = transport === 'mesh', avail = mesh ? meshAvail() : isDesktop(), onKey = mesh ? 'meshOn' : 'on';
  const subs = new Set(), emit = () => subs.forEach((fn) => { try { fn(); } catch (e) { (globalThis.reportError || console.error)(e); } });
  let state = { on: false, ips: [], name: '', code: '', port: PORT, err: '' }, un = null, unErr = null, M = null;
  const mem = readLS(), incoming = new Map();
  const save = () => writeLS({ ...readLS(), peers: mem.peers, [onKey]: mem[onKey] }); // у телефона там же его собственные подключения
  const core = () => import('@tauri-apps/api/core');
  const plugin = () => (M ??= registerPlugin('Mesh'));
  // запрос → ответ; r: { rid, method, url, key, raw }
  async function handle(r) {
    let res;
    try {
      const u = new URL(r.url, 'http://x'), raw = r.raw;
      let json = null;
      if (raw.length) { try { json = JSON.parse(new TextDecoder().decode(raw)); } catch { json = null; } }
      res = await handleRequest({ app, mem, got: (meta, peer) => import('../ui/index.js').then((U) => U.toast(i18nT('net.got', { name: meta.name || '', from: peer.name || '' }))), rc: async (path, j, peer) => (await import('./netctl.js')).rcHandle(app, path, j, peer, (k) => { if (mem.peers) { delete mem.peers[k]; save(); emit(); } }), ens: !mesh && app.ens && app.ens.active ? app.ens : null, code: state.on ? state.code : '', name: state.name, busy: () => !!(app.auto && app.auto.playing && app.auto.playing()), work: () => (!mesh && app.auto && app.auto.caps ? app.auto.caps() : null) }, { method: r.method, path: u.pathname, query: Object.fromEntries(u.searchParams), key: r.key, json }, incoming);
      if (!u.pathname.startsWith('/melete/v1/rc/')) save(); // пульт опрашивает раз в секунду — хранить нечего
      if (u.pathname === '/melete/v1/sync' || u.pathname === '/melete/v1/put' || u.pathname === '/melete/v1/setmeta' || u.pathname === '/melete/v1/pair') { if (app.render && u.pathname !== '/melete/v1/pair') app.render(); emit(); }
    } catch (err) { log('sync', 'ошибка: ' + (err && err.message), 'w'); res = { status: 500, json: { error: String(err && err.message) } }; }
    return res;
  }
  async function onReq(e) {
    const r = e.payload || {}, { invoke } = await core();
    const raw = r.len ? new Uint8Array(await invoke('sync_body', { rid: r.rid })) : new Uint8Array();
    const res = await handle({ ...r, raw });
    const body = res.bytes || new TextEncoder().encode(JSON.stringify(res.json || {}));
    await invoke('sync_reply', body, { headers: { rid: String(r.rid), status: String(res.status), ctype: res.bytes ? 'application/octet-stream' : 'application/json' } }).catch(() => {});
  }
  async function onMesh(r) {
    const res = await handle({ ...r, raw: r.b64 ? b64.to(r.b64) : new Uint8Array() });
    const body = res.bytes || new TextEncoder().encode(JSON.stringify(res.json || {}));
    await plugin().reply({ rid: r.rid, status: res.status, ctype: res.bytes ? 'application/octet-stream' : 'application/json', b64: b64.from(body) }).catch(() => {});
  }
  return {
    avail,
    mesh,
    get state() { return state; },
    get peers() { return Object.entries(mem.peers || {}).map(([key, p]) => ({ key, ...p })); },
    wasOn: () => !!mem[onKey],
    async start() {
      if (!avail) return state;
      if (mesh) {
        if (!un) un = await plugin().addListener('req', onMesh);
        let r;
        try { r = await plugin().start({ port: PORT }); } catch (e) { state = { ...state, on: false, code: '', err: 'port' }; emit(); throw e; }
        state = { on: !!r.on, ips: r.ips || [], name: r.name || '', code: newCode(), port: PORT, err: '', fp: r.fp || '' };
      } else {
        const { invoke } = await core();
        if (!un) { const { listen } = await import('@tauri-apps/api/event'); un = await listen('sync-req', onReq); }
        // порт занят (открыто другое окно Melete с «Принимать телефон»): раньше молчали и показывали «вкл», а телефону
        // отвечало другое приложение — «компьютер забыл этот телефон»
        if (!unErr) {
          const { listen } = await import('@tauri-apps/api/event');
          unErr = await listen('sync-error', (e) => { log('sync', 'порт занят: ' + e.payload, 'w'); state = { ...state, on: false, code: '', err: 'port' }; mem[onKey] = false; save(); emit(); });
        }
        const r = await invoke('sync_start');
        state = { on: !!r.on, ips: r.ips || [], name: r.name || '', code: newCode(), port: r.port || PORT, err: '', fp: r.fp || '' };
      }
      mem[onKey] = true; save();
      log('sync', (mesh ? 'приём подключений включён: ' : 'связь с телефоном включена: ') + state.ips.join(', '));
      emit();
      return state;
    },
    async stop() {
      if (!avail) return;
      if (mesh) await plugin().stop().catch(() => {});
      else { const { invoke } = await core(); await invoke('sync_stop').catch(() => {}); }
      state = { ...state, on: false, code: '' };
      mem[onKey] = false; save();
      emit();
    },
    forget(key) { if (mem.peers) { delete mem.peers[key]; save(); emit(); } },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

/* ---------- телефон: клиент ---------- */

// HTTP: на телефоне — нативный TLS с закреплённым отпечатком компьютера (SyncHttpPlugin.java), в браузере — fetch.
// pin: отпечаток, которому верить; '' — любой (только при сопряжении); не задан — отпечаток подключённого компьютера.
// withFp — вернуть { data, fp }: отпечаток, который предъявил компьютер
let SyncHttp = null;
export async function http(method, url, { key = '', json = null, bin = false, timeout = 60000, pin, withFp = false } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(key ? { 'X-Melete-Key': key } : {}) };
  if (Capacitor.isNativePlatform()) {
    if (pin === undefined) { const m = readLS(), pc = m.pc, dv = Object.values(m.devs || {}).find((d) => d.fp && url.startsWith(d.addr)); pin = pc && pc.fp && url.startsWith(pc.addr) ? pc.fp : dv ? dv.fp : null; }
    if (pin == null) throw Object.assign(new Error('pin'), { reason: 'repair' }); // нет отпечатка — не слать ключ кому попало
    SyncHttp ??= registerPlugin('SyncHttp');
    let r;
    try { r = await SyncHttp.request({ method, url, headers, body: json ? JSON.stringify(json) : null, bin, pin, connectTimeout: 6000, readTimeout: timeout }); }
    catch (e) { throw Object.assign(new Error(String(e && e.message)), e && (e.code === 'pin' || e.code === 'tls') ? { reason: e.code } : {}); }
    if (r.status >= 400) throw Object.assign(new Error('http ' + r.status), { status: r.status });
    const data = bin ? b64.to(r.data || '') : JSON.parse(r.data || '{}');
    return withFp ? { data, fp: r.fp || '' } : data;
  }
  // компьютер (Melete DEV) — к телефону: TLS с закреплённым отпечатком в Rust (src-tauri/src/netcli.rs, команда net_http)
  if (isDesktop() && meshClient()) {
    if (pin === undefined) { const dv = Object.values(readLS().devs || {}).find((d) => d.fp && url.startsWith(d.addr)); pin = dv ? dv.fp : null; }
    if (pin == null) throw Object.assign(new Error('pin'), { reason: 'repair' });
    const { invoke } = await import('@tauri-apps/api/core');
    let r;
    try { r = await invoke('net_http', { method, url, key, body: json ? JSON.stringify(json) : null, bin, pin, timeout }); }
    catch (e) { const m = String(e && e.message || e); throw Object.assign(new Error(m), m === 'pin' ? { reason: 'pin' } : {}); }
    if (r.status >= 400) throw Object.assign(new Error('http ' + r.status), { status: r.status });
    const data = bin ? b64.to(r.data || '') : JSON.parse(r.data || '{}');
    return withFp ? { data, fp: r.fp || '' } : data;
  }
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { method, headers, body: json ? JSON.stringify(json) : undefined, signal: ctl.signal });
    if (r.status >= 400) throw Object.assign(new Error('http ' + r.status), { status: r.status });
    return bin ? new Uint8Array(await r.arrayBuffer()) : r.json();
  } finally { clearTimeout(tm); }
}

// Сопряжение до 30.10 у Melete DEV шло на общий порт 53319 — теперь у DEV свой; запись переезжает один раз.
// С 02.11 связь — по TLS с отпечатком (v: 3): прежнее сопряжение без отпечатка на телефоне не годится — один раз
// подключиться заново (адрес остаётся в форме, нужен только код; oldPc)
export const pcOf = () => {
  const m = readLS(), pc = m.pc || null;
  if (pc && !pc.v) {
    if (PORT === PORT_DEV && /:53319$/.test(pc.addr || '')) pc.addr = pc.addr.replace(/:53319$/, ':' + PORT_DEV);
    pc.v = 2; writeLS(m);
  }
  if (pc && (pc.v || 0) < 3 && Capacitor.isNativePlatform()) {
    m.old = { addr: pc.addr, name: pc.name }; delete m.pc; writeLS(m);
    log('sync', 'связь стала защищённой — нужно подключиться заново');
    return null;
  }
  return pc;
};
// Прежнее сопряжение без TLS (pcOf его снял): адрес для формы → «192.168.1.5» или ''
export const oldPc = () => { const o = readLS().old; return o && o.addr ? String(o.addr).replace(/^https?:\/\//, '').replace(':' + PORT, '') : ''; };
export const forgetPc = () => { const m = readLS(); delete m.pc; writeLS(m); };
// Другие устройства (Melete DEV): { addr, key, name, fp, last, ids, phone }
export const devsOf = () => Object.values(readLS().devs || {});
export const forgetDev = (addr) => { const m = readLS(); if (m.devs) { delete m.devs[addr]; writeLS(m); } };

// Сопряжение: адрес и код с экрана компьютера → ключ. → { name }
export async function pair(addr, code, myName = 'Телефон', H = http) {
  const base = baseOf(addr);
  if (!base) throw Object.assign(new Error('addr'), { reason: 'addr' });
  let hello;
  try { hello = await H('GET', base + '/melete/v1/hello', { timeout: 6000, pin: '' }); } catch (e) { throw Object.assign(new Error('unreachable'), { reason: e && e.reason === 'tls' ? 'tls' : 'unreachable' }); }
  if (!hello || hello.app !== 'melete') throw Object.assign(new Error('not melete'), { reason: 'unreachable' });
  // отпечаток — того сертификата, через который выдан ключ: дальше телефон верит только ему
  let r, fp = '';
  try { const x = await H('POST', base + '/melete/v1/pair', { json: { code: String(code).replace(/\D/g, ''), name: myName }, pin: '', withFp: true }); r = x && x.data && 'fp' in x ? x.data : x; fp = (x && x.fp) || ''; } catch (e) { throw Object.assign(new Error('pair'), { reason: e.status === 403 ? 'code' : e.status === 429 ? 'wait' : 'off' }); }
  if (Capacitor.isNativePlatform() && !/^[0-9a-f]{64}$/.test(fp)) throw Object.assign(new Error('no fp'), { reason: 'unreachable' });
  const m = readLS();
  delete m.old;
  const rec = { addr: base, key: r.key, name: r.name || hello.name || 'PC', last: 0, ids: [], v: 3, fp };
  // другой телефон (Melete DEV: связь всех со всеми) — в список устройств; компьютер — как раньше, один
  // компьютер подключается только к другим устройствам — всё в список
  if (hello.kind === 'phone' || isDesktop()) { m.devs = { ...(m.devs || {}), [base]: { ...rec, phone: true } }; writeLS(m); log('sync', 'сопряжено с устройством'); return m.devs[base]; }
  m.pc = rec;
  writeLS(m);
  log('sync', 'сопряжено с компьютером');
  return m.pc;
}

// Синхронизировать с сопряжённым компьютером. onStep({ stage, done, total }) — ход. opts: auto — фоновая (компьютер
// может отказать, если у него звучит музыка), stop() — прервать между кусками (у телефона зазвучало), want — какие
// дорожки нужны телефону (уходит с записью). → итог { songs, sessions, up, down, removed, meta }
export async function syncNow(app, onStep = () => {}, H = http, opts = {}) {
  await loadAllLangs(); // демо-файлы на любом языке не синхронизируются
  pcOf(); // переезд адреса DEV (выше)
  const m = readLS(), dev = opts.dev ? (m.devs || {})[opts.dev] : null, pc = opts.dev ? dev : m.pc;
  if (!pc) throw Object.assign(new Error('no pc'), { reason: 'nopc' });
  const put = (o) => { const mm = readLS(); if (opts.dev) mm.devs = { ...(mm.devs || {}), [opts.dev]: o }; else mm.pc = o; writeLS(mm); };
  const cur = () => { const mm = readLS(); return opts.dev ? (mm.devs || {})[opts.dev] : mm.pc; };
  const base = pc.addr, key = pc.key, F = app.files, auto = !!opts.auto, q = auto ? '&auto=1' : '';
  const halt = () => { if (opts.stop && opts.stop()) throw Object.assign(new Error('stopped'), { reason: 'stopped' }); };
  const fail = (e) => Object.assign(new Error('sync'), { reason: e.status === 401 ? 'key' : e.status === 503 ? 'busy' : e.status ? 'off' : 'unreachable' });
  const call = (method, path, o = {}) => H(method, base + path, { key, ...o }).catch((e) => { throw e.reason ? e : fail(e); });
  const before = { songs: app.store.songs().length, sessions: app.store.allSessions().length };
  onStep({ stage: 'data' });
  const r = await call('POST', '/melete/v1/sync', { json: { data: pickParts(stripDemo(app.store.state), SYNC_PARTS), auto }, timeout: 120000 });
  app.store.replaceState(applyParts(app.store.state, stripDemo(r.data), SYNC_PARTS));
  if (!opts.dev) { pc.work = r.work || null; put({ ...pc }); } // что компьютер считает сам — для «Считать на компьютере»
  const mine = manifestOf(allFiles(F)), plan = planFiles(mine, (r.files || []).filter((f) => !isDemoFile(f, CORE_DICTS)), pc.ids || []);
  const out = { songs: app.store.songs().length - before.songs, sessions: app.store.allSessions().length - before.sessions, up: 0, down: 0, removed: 0, meta: 0 };
  // удаления в обе стороны
  for (const id of plan.delMine) { if (F.get(id)) { await F.remove(id); out.removed++; } }
  if (plan.delTheirs.length) { await call('POST', '/melete/v1/delete', { json: { ids: plan.delTheirs, auto } }); out.removed += plan.delTheirs.length; }
  // сведения файлов, которые уже на обоих: разбор, текст, песни — в обе стороны
  for (const id of plan.meta) {
    halt();
    const rec = F.get(id);
    if (!rec) continue;
    const theirs = await call('GET', '/melete/v1/meta?id=' + encodeURIComponent(id) + q);
    const p = mergeMeta(rec, theirs);
    if (p) { Object.assign(rec, p); await F.save(rec); }
    if (metaHash(rec) !== metaHash(theirs)) await call('POST', '/melete/v1/setmeta', { json: { meta: metaFields(rec), auto } });
    out.meta++;
  }
  const total = plan.upload.length + plan.download.length;
  let done = 0;
  // на компьютер — кусками; запись без дорожек уходит с пожеланием, какие дорожки нужны
  for (const id of plan.upload) {
    halt();
    const rec = F.get(id);
    onStep({ stage: 'up', name: rec && rec.name, done, total });
    if (!rec || !rec.blob) { done++; continue; }
    const meta = { ...metaOf(rec), size: rec.blob.size, ...(opts.want && !rec.stem && rec.kind !== 'midi' && rec.kind !== 'tab' && rec.kind !== 'daw' && !rec.want ? { want: opts.want } : {}) };
    let off = 0;
    do {
      halt();
      const u8 = new Uint8Array(await rec.blob.slice(off, off + CHUNK).arrayBuffer());
      const res = await call('POST', '/melete/v1/put', { json: { meta, off, b64: b64.from(u8), auto }, timeout: 120000 });
      if (res.done) break;
      off = res.got != null ? res.got : off + u8.length;
    } while (off < meta.size);
    out.up++; done++;
  }
  // с компьютера — кусками
  for (const id of plan.download) {
    halt();
    const meta = await call('GET', '/melete/v1/meta?id=' + encodeURIComponent(id) + q);
    onStep({ stage: 'down', name: meta && meta.name, done, total });
    const parts = [];
    for (let off = 0; off < (meta.size || 0); off += CHUNK) { halt(); parts.push(await call('GET', '/melete/v1/get?id=' + encodeURIComponent(id) + '&off=' + off + '&len=' + CHUNK + q, { bin: true, timeout: 120000 })); }
    await F.add({ ...meta, blob: new Blob(parts, { type: meta.type || '' }) });
    out.down++; done++;
  }
  // что теперь на обоих — для следующего раза (удаление переносится)
  const now = new Set(manifestOf(allFiles(F)).map((x) => x.id)), theirs = new Set((r.files || []).map((x) => x.id));
  plan.upload.forEach((id) => theirs.add(id)); plan.download.forEach((id) => theirs.add(id)); plan.delTheirs.forEach((id) => theirs.delete(id));
  put({ ...cur(), last: Date.now(), ids: [...now].filter((id) => theirs.has(id)) });
  if (out.songs || out.sessions || out.up || out.down || out.removed || out.meta || !auto) log('sync', (auto ? 'фоновая ' : '') + 'синхронизация: песен +' + out.songs + ', занятий +' + out.sessions + ', на компьютер ' + out.up + ', с компьютера ' + out.down + ', сведений ' + out.meta + ', удалено ' + out.removed);
  if (app.render && (out.songs || out.sessions || out.down || out.removed || out.meta)) app.render();
  return out;
}

// Отправить файл на устройство (Melete DEV): тем же путём, что синхронизация, кусками; там он появляется в медиатеке.
// opts.dev — адрес из «Моих устройств», иначе компьютер. onStep(доля 0…1). → { have } — уже было там
export async function sendFile(app, rec, onStep = () => {}, H = http, opts = {}) {
  const m = readLS(), d = opts.dev ? (m.devs || {})[opts.dev] : m.pc;
  if (!d) throw Object.assign(new Error('no dev'), { reason: 'nopc' });
  if (!rec || !rec.blob) throw Object.assign(new Error('no file'), { reason: 'file' });
  const meta = { ...metaOf(rec), size: rec.blob.size, sent: true };
  let off = 0;
  do {
    const u8 = new Uint8Array(await rec.blob.slice(off, off + CHUNK).arrayBuffer());
    const res = await H('POST', d.addr + '/melete/v1/put', { key: d.key, json: { meta, off, b64: b64.from(u8) }, timeout: 120000 }).catch((e) => { throw e.reason ? e : Object.assign(new Error('send'), { reason: e.status === 401 ? 'key' : e.status ? 'off' : 'unreachable' }); });
    if (res.done) { onStep(1); log('sync', 'файл отправлен на устройство'); return { have: !!res.have }; }
    off = res.got != null ? res.got : off + u8.length;
    onStep(Math.min(1, off / meta.size));
  } while (off < meta.size);
  return { have: false };
}

const DAY = 86400000, MIN = 60000;
// Телефон: «Считать на компьютере» и фоновая синхронизация. Раз в минуту — проверка: есть сопряжённый компьютер, тихо
// (ничего не звучит, нет занятия и записи, человек не трогает экран — autostems.quiet), пора? Пора: новые записи на
// телефоне — через минуту, ждём результатов от компьютера — раз в 5 минут, иначе — раз в 30; неудачи — реже (до 30 мин).
// Зазвучало — синхронизация прерывается между кусками и продолжится позже. Ручная кнопка — через run (одна за раз).
export function createSyncClient(app, { H = http, now = () => Date.now() } = {}) {
  const S = () => app.store.state.settings, subs = new Set();
  const emit = () => subs.forEach((fn) => { try { fn(); } catch (e) { (globalThis.reportError || console.error)(e); } });
  let busy = false, lastTry = 0, fails = 0, last = null, timer = 0, first = 0;
  const pcWork = () => S().pcWork !== false, syncAuto = () => S().syncAuto !== false;
  const quiet = () => !app.auto || !app.auto.quiet || app.auto.quiet();
  // компьютер «рядом»: синхронизировались за последние трое суток
  const near = () => { const pc = pcOf(); return !!pc && !!pc.last && now() - pc.last < 3 * DAY; };
  // Ждать ли компьютер для записи r: kind — 'stems' | 'ana'. Свежая запись (сутки) или уже на компьютере (трое суток)
  function waits(r, kind) {
    if (!pcWork() || !near()) return false;
    const pc = pcOf(), w = pc.work || {};
    if (kind === 'stems' && (!w.stems || w.stems === 'off')) return false;
    if (kind === 'ana' && !w.ana) return false;
    const age = now() - (r.created || 0);
    return age < DAY || ((pc.ids || []).includes(r.id) && age < 3 * DAY);
  }
  const fresh = () => { const pc = pcOf(), ids = new Set((pc && pc.ids) || []); return manifestOf(allFiles(app.files)).some((x) => !ids.has(x.id)); };
  // записей, которые ждут результатов от компьютера
  const waiting = () => (app.files ? app.files.list('audio').filter((r) => !r.stem && !r.dn && !r.noAuto && ((waits(r, 'stems') && !hasAnyStems(app.files, r.id)) || (waits(r, 'ana') && !r.ana))).length : 0);
  const interval = () => (fails ? Math.min(30 * MIN, 2 * MIN * 2 ** (fails - 1)) : fresh() ? MIN : waiting() ? 5 * MIN : 30 * MIN);
  async function run(onStep = () => {}, opts = {}) {
    if (busy) throw Object.assign(new Error('busy'), { reason: 'running' });
    busy = true; lastTry = now(); emit();
    try {
      const r = await syncNow(app, onStep, H, { want: app.auto && app.auto.want ? app.auto.want() : null, ...opts });
      fails = 0; last = { at: now(), ok: true, r };
      if (app.auto && app.auto.kick) app.auto.kick();
      return r;
    } catch (e) {
      if (e.reason !== 'stopped' && e.reason !== 'busy') fails++;
      last = { at: now(), ok: false, reason: e.reason };
      throw e;
    } finally { busy = false; emit(); }
  }
  async function tick() {
    if (busy || !pcOf() || !syncAuto() || !quiet()) return;
    if (now() - lastTry < interval()) return;
    // не вышло — повторится позже (реже); первая неудача подряд — в журнал, чтобы отчёт показал причину
    try { await run(() => {}, { auto: true, stop: () => !quiet() }); } catch (e) { if (fails === 1) log('sync', 'фоновая синхронизация не удалась: ' + (e.reason || e.message || e), 'w'); }
  }
  return {
    waits, run, tick, quiet,
    get busy() { return busy; },
    get last() { return last; },
    waiting,
    start() { if (!timer) timer = setInterval(tick, MIN); if (!first) first = setTimeout(tick, 20000); },
    stop() { clearInterval(timer); timer = 0; clearTimeout(first); first = 0; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
const hasAnyStems = (F, id) => F.list('audio').some((x) => x.stem && x.stem.src === id);
