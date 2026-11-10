// Шторки резервной копии: «Что сохранить» и «Что загрузить» — части по выбору (src/core/backupparts.js).
// Песни — по желанию с файлами (записи, табы, ноты). Загрузка ничего не удаляет.
import { t, tn, getLang } from '../../i18n/index.js';
import { esc, sw, sheet, snav, toast } from '../../ui/index.js';
import { PARTS, partCounts, partsOf } from '../backupparts.js';
import { saveBackup, restoreParts, songFiles, filesSize, infoOf, FILES_LIMIT } from '../backup.js';

const MB = (n) => (n / 1048576 < 10 ? (n / 1048576).toFixed(1) : Math.round(n / 1048576)).toString().replace('.', getLang() === 'en' ? '.' : ',');
const BIG = FILES_LIMIT; // больше — файлы не берём: в копии они вчетверо тяжелее, телефон такой объём не переваривает

function rows(list, sel, sub) {
  return '<div class="group">' + list.map((k) => '<label class="cell"><span class="grow">' + esc(t('bkp.' + k)) + '<span class="bksub">' + esc(sub(k)) + '</span></span>' +
    sw('bkp:' + k, sel.has(k), t('bkp.' + k)) + '</label>').join('') + '</div>';
}

// Сохранить копию: выбор частей и файлов. done(r) — после сохранения ({ where, name })
export function exportSheet(app, done = () => {}) {
  const st = app.store.state, n = partCounts(st), files = songFiles(app), size = filesSize(files);
  // «План чтения» — в церковном режиме или если уже что-то прочитано
  const list = PARTS.filter((k) => k !== 'reading' || n.reading || st.settings.church);
  const sel = new Set(list);
  let withFiles = files.length > 0 && size <= BIG, busy = false;
  const sub = (k) => (k === 'songs' ? tn('bkp.songsN', n.songs) : k === 'profile' ? tn('bkp.profileN', n.profile) : k === 'reading' ? tn('bkp.readingN', n.reading) :
    k === 'calendar' ? tn('bkp.calendarN', n.calendar) : t('bkp.settingsSub'));
  const body = () => snav(t('bkp.saveTitle')) + rows(list, sel, sub) +
    (files.length && sel.has('songs') ? '<div class="group"><label class="cell"><span class="grow">' + esc(t('bkp.files')) + '<span class="bksub">' + esc(tn('bkp.filesN', files.length) + ' · ' + MB(size) + ' ' + t('bkp.mb')) + '</span></span>' +
      (size > BIG ? '' : sw('bkpfiles', withFiles, t('bkp.files'))) + '</label></div>' +
      (size > BIG ? '<p class="ftr">' + esc(t('bkp.tooBig', { mb: MB(BIG) })) + '</p>' : (withFiles && size > 10 * 1048576 ? '<p class="ftr">' + esc(t('bkp.big')) + '</p>' : '')) : '') +
    '<div class="group" style="margin-top:16px"><button class="cell center b" data-bksave' + (sel.size ? '' : ' disabled') + '>' + esc(t(busy ? 'bkp.saving' : 'bkp.save')) + '</button></div>';
  sheet(body, (el, sh) => {
    el.addEventListener('change', (e) => {
      const k = e.target.dataset.sw;
      if (!k) return;
      if (k === 'bkpfiles') withFiles = e.target.checked && size <= BIG;
      else if (k.startsWith('bkp:')) { const p = k.slice(4); if (e.target.checked) sel.add(p); else sel.delete(p); }
      sh.update();
    });
    el.addEventListener('click', (e) => {
      if (!e.target.closest('[data-bksave]') || busy || !sel.size) return;
      busy = true; sh.update();
      saveBackup(app, { parts: list.filter((k) => sel.has(k)), files: withFiles && sel.has('songs') })
        .then((r) => { sh.close(); done(r); })
        .catch(() => { busy = false; sh.update(); toast(t('bk.fail')); });
    });
  });
}

// Загрузить копию p: выбор частей. done(r) — после загрузки ({ sessions, files, tools })
export function importSheet(app, p, done = () => {}) {
  const list = PARTS.filter((k) => partsOf(p).includes(k)), sel = new Set(list), n = partCounts({ settings: {}, ...p }), inf = infoOf(p);
  const nf = Array.isArray(p.files) ? p.files.length : 0;
  let busy = false;
  const sub = (k) => (k === 'songs' ? tn('bkp.songsN', n.songs) + (nf ? ' · ' + tn('bkp.filesN', nf) : '') : k === 'profile' ? tn('bkp.profileN', n.profile) :
    k === 'reading' ? tn('bkp.readingN', n.reading) : k === 'calendar' ? tn('bkp.calendarN', n.calendar) : t('bkp.settingsSub'));
  const when = inf && inf.at ? t('bk.from', { by: inf.by || t('bk.noName'), when: new Date(inf.at).toLocaleDateString(getLang() === 'uz' ? 'uz-Latn' : getLang()) }) : '';
  const body = () => snav(t('bkp.loadTitle')) + (when ? '<p class="ftr" style="margin-top:0">' + esc(when) + '</p>' : '') + rows(list, sel, sub) +
    '<p class="ftr">' + esc(t('bkp.loadHint')) + '</p>' +
    '<div class="group" style="margin-top:12px"><button class="cell center b" data-bkload' + (sel.size ? '' : ' disabled') + '>' + esc(t(busy ? 'bkp.loading' : 'bkp.load')) + '</button></div>';
  if (!list.length) { toast(t('data.notBackup')); return; }
  sheet(body, (el, sh) => {
    el.addEventListener('change', (e) => {
      const k = e.target.dataset.sw;
      if (!k || !k.startsWith('bkp:')) return;
      const q = k.slice(4);
      if (e.target.checked) sel.add(q); else sel.delete(q);
      sh.update();
    });
    el.addEventListener('click', (e) => {
      if (!e.target.closest('[data-bkload]') || busy || !sel.size) return;
      busy = true; sh.update();
      restoreParts(app, p, list.filter((k) => sel.has(k)))
        .then((r) => {
          sh.close();
          toast(tn('data.imported', r.sessions) + (r.files ? ' · ' + tn('bkp.filesN', r.files) : '') + (r.tools ? ' · ' + t('bkp.reload') : ''));
          done(r);
          if (r.tools) setTimeout(() => location.reload(), 1600); // настройки инструментов читаются при запуске
        })
        .catch(() => { busy = false; sh.update(); toast(t('data.notBackup')); });
    });
  });
}
