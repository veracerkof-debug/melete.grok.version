// Раздача в своей сети (docs/guest-web.md): гости в той же сети Wi-Fi открывают в браузере адрес компьютера или QR-код
// и видят песни, тексты, аккорды и сет-лист, слушают записи (по одной песне) — только чтение. Сервер — src-tauri/src/guest.rs
// (порт 53320; страница гостя — guest.html, src/guest/), решает всё здесь.
// Настройки — на устройстве (melete.guest, не в резервной копии): режим «открытый» (вбил адрес — внутри) или «закрытый»
// (только по QR-коду с токеном и с подтверждением хозяина), что раздавать (все песни или один сет-лист), записи вкл/выкл.
// Лидер один — хозяин; ведение можно передать гостю и забрать. Ведущий открывает песню — у всех, кто «следует», она
// открывается сама (поток — guest_live в Rust, долгий опрос). Личное (занятия, статистика, профиль, календарь) не раздаётся.
import { liveEvents } from './calendar.js';
import { songKey } from './stage.js';
import { fileSongs } from './files.js';
import { keyLabel } from '../music/transpose.js';
import { log } from './log.js';

export const GUEST_PORT = 53320;
const LS_KEY = 'melete.guest';
export const GUEST_DEF = { on: false, mode: 'open', scope: 'all', set: '', audio: true };
const readLS = () => { try { return { ...GUEST_DEF, ...(JSON.parse(localStorage.getItem(LS_KEY)) || {}) }; } catch { return { ...GUEST_DEF }; } };
const writeLS = (v) => { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch { /* нет места */ } };
const rnd = (n) => { let s = ''; while (s.length < n) s += Math.floor(Math.random() * 16).toString(16); return s; };

/* ---------- что раздаётся ---------- */

// Сет-листы — события календаря с песнями: ближайшие и недавние сверху
export function setlistsOf(state, now = Date.now()) {
  return liveEvents(state).filter((e) => (e.songs || []).length).map((e) => ({ id: e.id, title: e.title || '', at: +new Date(e.start || e.date || 0) || 0, n: e.songs.length }))
    .sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now));
}
const audioOf = (files, songId) => (files ? files.list('audio').filter((r) => !r.stem && !r.dn && r.blob && !(r.type || '').startsWith('video/') && fileSongs(r).includes(songId)) : []);
// Песни, которые видит гость (по настройке «что раздавать»)
export function sharedSongs(state, cfg) {
  const all = (state.songs || []).filter((s) => !s.deleted);
  if (cfg.scope !== 'set') return all.slice().sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  const ev = liveEvents(state).find((e) => e.id === cfg.set);
  return ev ? (ev.songs || []).map((id) => all.find((s) => s.id === id)).filter(Boolean) : [];
}
const songCard = (s, files, cfg) => { const k = songKey(s); return { id: s.id, title: s.title || '', artist: s.artist || '', key: k ? keyLabel(k) : '', bpm: +s.targetBpm || +s.currentBpm || 0, audio: cfg.audio ? audioOf(files, s.id).length : 0, text: !!s.notes }; };

/* ---------- запросы гостей ---------- */

// Обработать запрос гостя. req: { method, path, q, body }; ctx: { app, cfg, rt, name } — rt: состояние раздачи
// (token, guests: Map gid → { name, ok, at }, leader: 'host' | gid, live). → { status, json } | { status, bytes, ctype, cache }
export async function handleGuest(ctx, req) {
  const { app, cfg, rt } = ctx, st = app.store.state, q = req.q || {};
  const body = (() => { try { return req.body ? JSON.parse(req.body) : {}; } catch { return {}; } })();
  if (req.path === '/g/v1/hello') return { status: 200, json: { app: 'melete', v: 1, name: ctx.name || 'Melete', mode: cfg.mode, audio: !!cfg.audio } };
  if (req.path === '/g/v1/join') {
    if (cfg.mode === 'closed' && String(body.t || '') !== rt.token) return { status: 403, json: { error: 'token' } };
    const gid = rnd(20), name = String(body.name || '').trim().slice(0, 40) || '—';
    rt.guests.set(gid, { name, ok: cfg.mode !== 'closed', at: Date.now(), seen: Date.now() });
    log('guest', (cfg.mode === 'closed' ? 'просится: ' : 'подключился: ') + name);
    if (ctx.onChange) ctx.onChange({ join: gid });
    return { status: 200, json: { gid, state: cfg.mode === 'closed' ? 'wait' : 'ok' } };
  }
  const g = rt.guests.get(q.g || '');
  if (req.path === '/g/v1/me') {
    if (!g) return { status: 200, json: { state: 'no' } };
    g.seen = Date.now();
    return { status: 200, json: { state: g.ok ? 'ok' : 'wait', lead: rt.leader === q.g } };
  }
  if (!g || !g.ok) return { status: 401, json: { error: 'guest' } };
  g.seen = Date.now();
  const songs = sharedSongs(st, cfg);
  if (req.path === '/g/v1/songs') return { status: 200, json: { songs: songs.map((s) => songCard(s, app.files, cfg)) } };
  if (req.path === '/g/v1/set') {
    const ev = cfg.scope === 'set' ? liveEvents(st).find((e) => e.id === cfg.set) : null;
    return { status: 200, json: ev ? { id: ev.id, title: ev.title || '', items: songs.map((s) => ({ id: s.id, tr: +(((ev.stage || {})[s.id] || {}).tr) || 0, capo: +(((ev.stage || {})[s.id] || {}).capo) || 0 })) } : null };
  }
  if (req.path === '/g/v1/song') {
    const s = songs.find((x) => x.id === q.id);
    if (!s) return { status: 404, json: {} };
    const k = songKey(s);
    return { status: 200, json: { ...songCard(s, app.files, cfg), notes: s.notes || '', capo: +s.capo || 0, k: k ? { pc: k.pc, minor: !!k.minor, sharp: k.sharp ?? null } : null,
      files: cfg.audio ? audioOf(app.files, s.id).map((r) => ({ id: r.id, name: r.name || '', dur: r.dur || 0 })) : [] } };
  }
  if (req.path === '/g/v1/audio') {
    // только запись раздаваемой песни; отдаётся целиком в кэш сервера, перемотку тот делает сам
    if (!cfg.audio) return { status: 403, json: {} };
    const r = app.files && app.files.get(q.id);
    if (!r || !r.blob || !songs.some((s) => fileSongs(r).includes(s.id))) return { status: 404, json: {} };
    return { status: 200, bytes: new Uint8Array(await r.blob.arrayBuffer()), ctype: r.type || 'audio/mpeg', cache: true };
  }
  if (req.path === '/g/v1/lead') {
    if (rt.leader !== q.g) return { status: 403, json: { error: 'lead' } };
    if (!songs.some((s) => s.id === body.song)) return { status: 404, json: {} };
    setLive(rt, { song: body.song, tr: +body.tr || 0 }, g.name);
    if (ctx.onChange) ctx.onChange({ live: true });
    return { status: 200, json: { ok: true } };
  }
  return { status: 404, json: {} };
}
// Что на экранах: песня, сдвиг ведущего, кто ведёт (имя)
export function setLive(rt, { song, tr = 0 }, by) {
  rt.live = { song, tr, by: by || '', leader: rt.leader === 'host' ? '' : (rt.guests.get(rt.leader) || {}).name || '', at: Date.now() };
  return rt.live;
}
export const allowedOf = (rt) => [...rt.guests].filter(([, g]) => g.ok).map(([id]) => id);

/* ---------- компьютер: связь с сервером в Rust ---------- */

export function createGuestServer(app, { isDesktop }) {
  const avail = isDesktop();
  const subs = new Set(), emit = () => subs.forEach((fn) => { try { fn(); } catch { /* */ } });
  let cfg = readLS(), status = { on: false, ips: [], name: '', port: GUEST_PORT }, un = null;
  const rt = { token: rnd(12), guests: new Map(), leader: 'host', live: null };
  const core = () => import('@tauri-apps/api/core');
  const push = async () => { const { invoke } = await core(); await invoke('guest_allow', { gids: allowedOf(rt) }).catch(() => {}); };
  const pushLive = async () => { const { invoke } = await core(); await invoke('guest_live', { json: JSON.stringify(rt.live || null) }).catch(() => {}); };
  let onJoin = null; // экран подтверждения (панель задаёт)
  const changed = (e = {}) => { push(); if (e.live) pushLive(); if (e.join && onJoin && cfg.mode === 'closed') onJoin(e.join); emit(); };
  async function onReq(e) {
    const r = e.payload || {}, { invoke } = await core();
    let res;
    try {
      res = await handleGuest({ app, cfg, rt, name: status.name, onChange: changed }, { method: r.method, path: r.path, q: Object.fromEntries(new URLSearchParams(r.query || '')), body: r.body });
    } catch (err) { log('guest', 'ошибка: ' + (err && err.message), 'w'); res = { status: 500, json: {} }; }
    const body = res.bytes || new TextEncoder().encode(JSON.stringify(res.json ?? null));
    await invoke('guest_reply', body, { headers: { rid: String(r.rid), status: String(res.status), ctype: res.bytes ? res.ctype : 'application/json', cache: res.cache ? '1' : '0' } }).catch(() => {});
  }
  // гость не появлялся дольше 2 минут — из списка (страница гостя спрашивает раз в 25 с)
  setInterval(() => {
    if (!rt.guests.size) return;
    let n = 0;
    rt.guests.forEach((g, id) => { if (Date.now() - g.seen > 120000) { rt.guests.delete(id); if (rt.leader === id) rt.leader = 'host'; n++; } });
    if (n) changed({ live: true });
  }, 30000);
  const api = {
    avail,
    get cfg() { return cfg; },
    get status() { return status; },
    get token() { return rt.token; },
    get leader() { return rt.leader; },
    get live() { return rt.live; },
    guests: () => [...rt.guests].map(([id, g]) => ({ id, ...g, lead: rt.leader === id })),
    url(withToken) { const ip = status.ips[0] || 'localhost'; return 'http://' + ip + ':' + GUEST_PORT + '/' + (withToken ? '?t=' + rt.token : ''); },
    set(patch) {
      cfg = { ...cfg, ...patch }; writeLS(cfg);
      if ('audio' in patch && !cfg.audio) core().then(({ invoke }) => invoke('guest_drop_audio')).catch(() => {});
      if ('mode' in patch) { rt.token = rnd(12); } // смена режима — старые QR-коды не действуют
      emit();
    },
    async start() {
      if (!avail) return;
      const { invoke } = await core();
      if (!un) { const { listen } = await import('@tauri-apps/api/event'); un = await listen('guest-req', onReq); }
      status = await invoke('guest_start');
      cfg = { ...cfg, on: true }; writeLS(cfg);
      rt.token = rnd(12); rt.leader = 'host';
      await push(); await pushLive();
      log('guest', 'раздача включена: ' + (status.ips || []).join(', ') + ', ' + cfg.mode);
      emit();
    },
    async stop() {
      if (!avail) return;
      const { invoke } = await core();
      await invoke('guest_stop').catch(() => {});
      rt.guests.clear(); rt.leader = 'host'; rt.live = null;
      status = { ...status, on: false }; cfg = { ...cfg, on: false }; writeLS(cfg);
      emit();
    },
    approve(id, ok) { const g = rt.guests.get(id); if (!g) return; if (ok) g.ok = true; else rt.guests.delete(id); changed(); },
    kick(id) { rt.guests.delete(id); if (rt.leader === id) { rt.leader = 'host'; if (rt.live) setLive(rt, rt.live, ''); changed({ live: true }); } else changed(); },
    // ведение: 'host' — вернуть себе
    lead(id) { rt.leader = rt.guests.has(id) ? id : 'host'; if (rt.live) setLive(rt, rt.live, rt.live.by); changed({ live: true }); },
    // хозяин открыл песню (страница песни, пункт сцены) — если ведёт он и песня раздаётся, у гостей она тоже
    hostAt(songId, tr = 0) {
      if (!status.on || rt.leader !== 'host' || !songId) return;
      if (rt.live && rt.live.song === songId && rt.live.tr === tr) return;
      if (!sharedSongs(app.store.state, cfg).some((s) => s.id === songId)) return;
      setLive(rt, { song: songId, tr }, ''); pushLive(); emit();
    },
    onJoin(fn) { onJoin = fn; },
    wasOn: () => !!cfg.on,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  return api;
}
