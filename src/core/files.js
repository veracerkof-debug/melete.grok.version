// Файлы пользователя (аудио, табулатуры) — только на этом устройстве, в IndexedDB.
// База и формат записей — как в прототипе: practice-audio / tracks, { id, name, size, type, songs[], created, blob, kind?, peaks?, dur? }.
// kind: 'tab' — табулатура, 'bible' — модуль Библии (MyBible, SQLite), 'midi' — игра в инструменте (.mid; tool, take),
// 'daw' — проект чужой студии (.als, .rpp, .flp; fmt), иначе аудио.

const DB = 'practice-audio', STORE = 'tracks';

// onWriteFail(e, rec) — файл не лёг в базу (нет места): сказать человеку, файл живёт только до закрытия
// Нет места: имя ошибки по стандарту и старое имя Firefox (коды 22 / 1014)
export const isQuota = (e) => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);

export function createFiles({ indexedDB = globalThis.indexedDB, onWriteFail = () => {}, onError = () => {} } = {}) {
  let dbP = null;
  const all = [], subs = new Set();
  const emit = () => subs.forEach((fn) => fn());

  const open = () => dbP || (dbP = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  }));

  const tx = (mode, op) => open().then((d) => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), rq = op(t.objectStore(STORE));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));

  // Поля, которые не сохраняем (служебные, на время работы)
  const clean = (r) => { const c = { ...r }; delete c._busy; delete c.unsaved; return c; };

  const files = {
    noDb: false, // хранилище недоступно — файлы живут до перезагрузки
    ready: tx('readonly', (st) => st.getAll())
      .then((r) => { all.push(...(r || [])); emit(); })
      .catch(() => { files.noDb = true; }),

    // kind: 'audio' | 'tab' | 'bible' (модули Библии MyBible) | 'midi' | 'daw'; у аудио в старых записях вида нет
    list: (kind) => all.filter((r) => (kind === 'tab' || kind === 'bible' || kind === 'midi' || kind === 'daw' ? r.kind === kind : !r.kind || r.kind === 'audio')),
    get: (id) => all.find((r) => r.id === id),

    async add(rec) {
      all.push(rec);
      emit();
      try { await tx('readwrite', (st) => st.put(clean(rec))); return true; }
      catch (e) { const full = isQuota(e); if (full) { rec.unsaved = true; onWriteFail(e, rec); } else { files.noDb = true; onError(e, rec); } return false; }
    },
    // Перечитать файл из базы: выбранный на Android файл (content://) часто нельзя читать с середины,
    // а сохранённая копия — обычный файл на диске; true — получилось
    async reread(rec) {
      try {
        const r = await tx('readonly', (st) => st.get(rec.id));
        if (r && r.blob && r.blob.size === rec.blob.size) { rec.blob = r.blob; return true; }
      } catch { /* остаётся исходный */ }
      return false;
    },
    // Сохранить изменения записи (имя, привязки к песням, волна)
    // Ошибка не теряется: без неё разбор записи (тональность, темп, дорожки, текст) молча пропадал бы
    save(rec) { emit(); return tx('readwrite', (st) => st.put(clean(rec))).catch((e) => { if (isQuota(e)) onWriteFail(e, rec); else onError(e, rec); }); },
    remove(id) {
      const i = all.findIndex((r) => r.id === id);
      if (i >= 0) all.splice(i, 1);
      emit();
      // Не удалось — файл может вернуться после перезапуска: об этом нужно знать, а не молчать
      return tx('readwrite', (st) => st.delete(id)).catch((e) => { onError(e, { id }); });
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  return files;
}

// Песни, к которым привязан файл (в старых записях — одно поле songId)
export const fileSongs = (r) => r.songs || (r.songId ? [r.songId] : []);
export const inSong = (r, sid) => fileSongs(r).includes(sid);

export function linkSong(r, sid, on) {
  const s = new Set(fileSongs(r));
  on ? s.add(sid) : s.delete(sid);
  r.songs = [...s];
  delete r.songId;
}
