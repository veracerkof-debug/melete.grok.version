// Хроматический круг (слово автора 05.11.2026: «эта красота — в учебник и теорию, везде, где помогает объяснить аккорды
// и гаммы»): 12 нот по кругу через полутон, до сверху. Ноты аккорда или гаммы — светящиеся кружки, связанные фигурой;
// шаги между соседними — снаружи дугами с отметкой на каждом полутоне и числом «+4», «+3» (аккорд) или внутри —
// тон/полутон (гамма). Видно, почему мажор и минор — зеркальные треугольники, а увеличенный — правильный.
// Чистая функция: SVG-строка, цвета — токены темы (работает в каждом стиле). Касания — у того, кто вставляет
// (data-cpc у кружка ноты).
import './chroma.css';

const SH = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const f = (n) => n.toFixed(1);

// o: { pcs — ноты по порядку (первая — основной тон), name(p) — подпись ноты, sub(p) — мелкая подпись под ней (ступень),
//      steps: 'chord' | 'scale' | null, stepTxt(n) — подпись шага гаммы, center: [крупно, мелко], label — для чтения с экрана,
//      mark — Set нот в кольце (нота, отличающая лад), tap — касаемы все 12 нот (набор аккорда), close — замкнуть дугу шага к основному тону (аккорд) }
export function chromaSVG(o) {
  const pcs = o.pcs || [], set = new Set(pcs), root = pcs.length ? pcs[0] : null;
  const name = o.name || ((p) => SH[p]);
  const C = 150, R = 100, RA = 128, ang = (x) => ((x * 30 - 90) * Math.PI) / 180, P = (r, x) => [C + r * Math.cos(ang(x)), C + r * Math.sin(ang(x))];
  let s = '<svg viewBox="0 0 300 300" class="chroma' + (o.cls ? ' ' + o.cls : '') + '" role="group" aria-label="' + (o.label || '') + '">';
  s += '<circle cx="' + C + '" cy="' + C + '" r="' + R + '" class="cr-base"/>';
  // фигура
  // фигура — по кругу от основного тона (порядок касаний не важен: стороны не перекрещиваются)
  const around = pcs.slice().sort((a, b) => ((a - root + 12) % 12) - ((b - root + 12) % 12));
  if (pcs.length > 1) s += '<polygon class="cr-poly" points="' + around.map((p) => P(R, p).map(f).join(',')).join(' ') + '"/>';
  // шаги: аккорд — дуги снаружи по часовой от ноты к ноте (порядок — по высоте от основного тона), гамма — подписи внутри
  if (o.steps && pcs.length > 1) {
    const up = pcs.map((p) => ((p - root) % 12 + 12) % 12).map((d, i) => [d, pcs[i]]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const n = up.length, last = o.steps === 'scale' || o.close ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = up[i], b = up[(i + 1) % n], st = ((b - a) % 12 + 12) % 12 || 12;
      if (o.steps === 'scale') {
        const [x, y] = P(R - 24, a + st / 2);
        s += '<text x="' + f(x) + '" y="' + f(y) + '" class="cr-sstep' + (st === 1 ? ' h' : st >= 3 ? ' w' : '') + '" text-anchor="middle" dominant-baseline="central">' + (o.stepTxt ? o.stepTxt(st) : st) + '</text>';
        continue;
      }
      const r = RA + (i % 2) * 9, a0 = ang(a + 0.32), a1 = ang(a + st - 0.32), big = (st - 0.64) * 30 > 180 ? 1 : 0;
      const [x0, y0] = [C + r * Math.cos(a0), C + r * Math.sin(a0)], [x1, y1] = [C + r * Math.cos(a1), C + r * Math.sin(a1)];
      s += '<g class="cr-arc k' + (i % 3) + (i === n - 1 ? ' close' : '') + '"><path d="M' + f(x0) + ' ' + f(y0) + 'A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + f(x1) + ' ' + f(y1) + '"/>';
      for (let k = 1; k < st; k++) { const [dx, dy] = P(r, a + k); s += '<circle cx="' + f(dx) + '" cy="' + f(dy) + '" r="2.2"/>'; }
      const [bx, by] = P(r + 13, a + st / 2), w = st >= 10 ? 30 : 24;
      s += '<rect x="' + f(bx - w / 2) + '" y="' + f(by - 9) + '" width="' + w + '" height="18" rx="9"/><text x="' + f(bx) + '" y="' + f(by) + '" text-anchor="middle" dominant-baseline="central">+' + st + '</text></g>';
    }
  }
  // ноты
  for (let p = 0; p < 12; p++) {
    const on = set.has(p), r0 = p === root, [x, y] = P(R, p), sub = on && o.sub ? o.sub(p) : '';
    s += '<g class="cr-n' + (on ? ' on' : '') + (r0 ? ' r' : '') + (o.mark && o.mark.has(p) ? ' c' : '') + '"' + (on || o.tap ? ' data-cpc="' + p + '" role="button" tabindex="0"' : '') + ' aria-label="' + name(p) + '">' +
      '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + (on ? (r0 ? 17 : 15) : 12) + '"/>' +
      '<text x="' + f(x) + '" y="' + f(sub ? y - 3.5 : y) + '" text-anchor="middle" dominant-baseline="central" class="cr-l">' + name(p) + '</text>' +
      (sub ? '<text x="' + f(x) + '" y="' + f(y + 8) + '" text-anchor="middle" dominant-baseline="central" class="cr-d">' + sub + '</text>' : '') + '</g>';
  }
  if (o.center) s += '<text x="' + C + '" y="' + (C - 7) + '" text-anchor="middle" class="cr-c1">' + o.center[0] + '</text>' + (o.center[1] ? '<text x="' + C + '" y="' + (C + 15) + '" text-anchor="middle" class="cr-c2">' + o.center[1] + '</text>' : '');
  return s + '</svg>';
}

// Шаги аккорда от основного тона вверх: [4, 3] — мажор; для подписи «4 + 3 = мажор»
export function chordSteps(pcs) {
  if (pcs.length < 2) return [];
  const r = pcs[0], d = [...new Set(pcs.map((p) => ((p - r) % 12 + 12) % 12))].sort((a, b) => a - b);
  return d.slice(1).map((x, i) => x - d[i]);
}
