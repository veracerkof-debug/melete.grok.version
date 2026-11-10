import { t } from '../i18n/index.js';
// Клавиатура пианино (разметка): пианино, гаммы и аккорды на клавишах. Перенесено из legacy/practice.html (kbHTML).
import './keyboard.css';
import { mName } from '../music/notes.js';

const WHITE = [0, 2, 4, 5, 7, 9, 11];

// MIDI n-й белой клавиши, начиная с m
export function lastWhite(m, n) {
  let wi = 0;
  for (;;) { if (WHITE.includes(m % 12)) { wi++; if (wi === n) return m; } m++; }
}

// nw белых клавиш от m0; hl — подсвеченные ступени (Set), root — тоника; keys(m) — подпись клавиши компьютера (или '')
export function kbHTML(m0, nw, hl, root, keys = null) {
  let ws = '', bs = '', wi = 0, m = m0;
  const kq = (n) => { const s = keys ? keys(n) : ''; return s ? '<i class="kq" aria-hidden="true">' + s + '</i>' : ''; };
  while (wi < nw) {
    const pc = m % 12, h = hl && hl.has(pc) ? ' hl' + (root === pc ? ' root' : '') : '', nm = mName(m);
    if (WHITE.includes(pc)) {
      ws += '<div class="w' + h + '" data-m="' + m + '" role="button" tabindex="0" aria-label="' + nm + '"><span>' + (pc === 0 ? 'C' + (Math.floor(m / 12) - 1) : '') + '</span>' + kq(m) + '</div>';
      wi++;
    } else if (wi > 0) bs += '<div class="b' + h + '" data-m="' + m + '" role="button" tabindex="0" aria-label="' + nm + '" style="left:' + (wi * 100) / nw + '%">' + kq(m) + '</div>';
    m++;
  }
  // прокручиваемая клавиатура доступна и с клавиатуры компьютера (Tab → стрелки прокручивают)
  return '<div class="kbwrap" tabindex="0" role="group" aria-label="' + t('kb.aria') + '"><div class="kb" style="--n:' + nw + '">' + ws + bs + '</div></div>';
}
