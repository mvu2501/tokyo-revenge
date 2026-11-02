import { Container, Graphics, Text } from 'pixi.js';

// Decor kiểu "line sign" bám theo style HUD của game tham chiếu: nét mảnh đều, phẳng, có tách màu RGB (cyan lệch trái-trên, magenta lệch phải-dưới).
// Toàn bộ vẽ bằng code, mỗi khung hình vẽ lại nên animate rất nhẹ và luôn sắc nét ở mọi kích thước.
const MAIN = 0xff4a2b, CYAN = 0x19e3ff, MAG = 0xff2e93, CREAM = 0xfff1d6;
const FONT = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo","Noto Sans CJK JP","Noto Sans JP",sans-serif';

type Layer = { g: Graphics; color: number; dx: number; dy: number; alpha: number; main: boolean };

/** Cắt đoạn thẳng với hình chữ nhật (Liang–Barsky) rồi vẽ */
function clipLine(g: Graphics, x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number) {
  let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy], q = [x1 - rx, rx + rw - x1, y1 - ry, ry + rh - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return; } else { const r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) return; if (r > t0) t0 = r; } else { if (r < t0) return; if (r < t1) t1 = r; } }
  }
  g.moveTo(x1 + t0 * dx, y1 + t0 * dy).lineTo(x1 + t1 * dx, y1 + t1 * dy);
}
/** Gạch chéo trong hình chữ nhật, `phase` làm sọc trôi */
function hatch(g: Graphics, x: number, y: number, w: number, h: number, gap: number, phase: number) {
  const n = Math.ceil((w + h) / gap) + 2;
  for (let i = -1; i < n; i++) { const o = ((i * gap + phase) % ((n) * gap)); clipLine(g, x + o, y + h, x + o + h, y, x, y, w, h); }
}

class Plate extends Container {
  layers: Text[] = [];
  constructor(public w: number, public h: number, text: string, size: number, lh: number) {
    super();
    const mk = (fill: number, dx: number, dy: number) => {
      const t = new Text({ text, style: { fontFamily: FONT, fontWeight: '900', fontSize: size, fill, lineHeight: lh, align: 'center', stroke: { color: fill, width: 2 } } });
      t.anchor.set(0.5); t.position.set(w / 2 + dx, h / 2 + dy); return t;
    };
    this.layers = [mk(CYAN, -2.4, -1.8), mk(MAG, 2.4, 1.8), mk(CREAM, 0, 0)];
    this.layers.forEach(l => this.addChild(l));
    this.layers[0].alpha = 0.8; this.layers[1].alpha = 0.8;
  }
}

export class Decor extends Container {
  private layers: Layer[] = []; private t = 0; private plates: { p: Plate; x: number; y: number }[] = [];
  constructor() {
    super();
    // 3 lớp nét: cyan, magenta, chính (vermilion)
    const defs: [number, number, number, number, boolean][] = [[CYAN, -2.4, -1.8, 0.8, false], [MAG, 2.4, 1.8, 0.8, false], [MAIN, 0, 0, 1, true]];
    for (const [color, dx, dy, alpha, main] of defs) { const g = new Graphics(); g.blendMode = main ? 'normal' : 'add'; this.addChild(g); this.layers.push({ g, color, dx, dy, alpha, main }); }
    const p1 = new Plate(86, 250, '復\n讐', 62, 66), p2 = new Plate(86, 200, '斬', 96, 96);
    this.plates = [{ p: p1, x: 1512, y: 150 }, { p: p2, x: 1512, y: 440 }];
    for (const { p, x, y } of this.plates) { p.position.set(x, y); this.addChild(p); }
    this.eventMode = 'none'; this.alpha = 0.95;
  }
  /** vẽ tấm bảng dọc nghiêng, có khuyết góc trên phải */
  private plate(g: Graphics, x: number, y: number, w: number, h: number, fill: boolean, color: number) {
    const pts = [x + 16, y, x + w - 20, y, x + w, y + 20, x + w - 16, y + h, x, y + h];
    if (fill) g.poly(pts).fill({ color: 0x050508, alpha: 0.86 });
    g.poly(pts).stroke({ width: 3, color });
    return pts;
  }
  update(dt: number) {
    this.t += dt; const t = this.t;
    // nhấp nháy neon: thỉnh thoảng tụt sáng, thỉnh thoảng glitch lệch màu mạnh hơn
    const flick = (Math.sin(t * 41) + Math.sin(t * 13.7) > 1.75) ? 0.45 : 1;
    const glitch = (Math.floor(t * 2.2) % 7 === 3 && (t * 2.2) % 1 < 0.14) ? 2.6 : 1;
    for (const L of this.layers) {
      const g = L.g; g.clear(); g.position.set(L.dx * glitch, L.dy * glitch); g.alpha = L.alpha * (L.main ? flick : 1);
      const c = L.color, sw = (a = 3) => ({ width: a, color: c, cap: 'butt' as const, join: 'miter' as const });
      // 1) ô vuông 4 góc + sọc chéo trượt
      const sx = 1672, sy = 142, S = 72, k = 22;
      if (L.main) g.rect(sx, sy, S, S).fill({ color: 0x050508, alpha: 0.82 });
      for (const [ax, ay, ux, uy] of [[sx, sy, 1, 1], [sx + S, sy, -1, 1], [sx, sy + S, 1, -1], [sx + S, sy + S, -1, -1]] as number[][]) {
        g.moveTo(ax + ux * k, ay).lineTo(ax, ay).lineTo(ax, ay + uy * k); g.stroke(sw(4));
      }
      hatch(g, sx + 14, sy + 14, S - 28, S - 28, 13, (t * 14) % 13); g.stroke(sw(4));
      // 2) tam giác chỉ xuống, nảy nhẹ
      const by = Math.sin(t * 3.2) * 4, tx = 1672, ty = 250 + by;
      if (L.main) g.poly([tx, ty, tx + S, ty, tx + S / 2, ty + 42]).fill({ color: 0x050508, alpha: 0.82 });
      g.poly([tx, ty, tx + S, ty, tx + S / 2, ty + 42]).stroke(sw(3));
      for (let i = 0; i < 4; i++) { const o = 16 + i * 9; g.moveTo(tx + o, ty + 4).lineTo(tx + o - 8, ty + 4 + 12 + i * 0); }
      g.stroke(sw(2));
      // 3) thanh dọc có vạch nhỏ, các vạch sáng lần lượt
      const bx = 1682, byy = 330;
      if (L.main) g.poly([bx + 6, byy, bx + 34, byy, bx + 22, byy + 210, bx - 6, byy + 210]).fill({ color: 0x050508, alpha: 0.82 });
      g.poly([bx + 6, byy, bx + 34, byy, bx + 22, byy + 210, bx - 6, byy + 210]).stroke(sw(3));
      const hot = Math.floor(t * 4) % 8;
      for (let i = 0; i < 8; i++) {
        const yy = byy + 24 + i * 24, a = i === hot || i === (hot + 7) % 8 ? 1 : 0.45;
        g.moveTo(bx + 36 - (yy - byy) * 0.057, yy).lineTo(bx + 54 - (yy - byy) * 0.057, yy - 2); g.stroke({ width: 3, color: c, alpha: a });
      }
      // 4) sọc cảnh báo ngang trôi chậm
      const hx = 1585, hy = 800, hw = 300, hh = 34;
      if (L.main) g.poly([hx + 12, hy, hx + hw, hy, hx + hw - 12, hy + hh, hx, hy + hh]).fill({ color: 0x050508, alpha: 0.82 });
      g.poly([hx + 12, hy, hx + hw, hy, hx + hw - 12, hy + hh, hx, hy + hh]).stroke(sw(3));
      hatch(g, hx + 16, hy + 6, hw - 32, hh - 12, 16, (t * 22) % 16); g.stroke(sw(5));
      // 5,6) khung của 2 bảng chữ
      for (const { p, x, y } of this.plates) this.plate(g, x, y, p.w, p.h, L.main, c);
    }
    // chữ trên bảng: rung lệch RGB cùng nhịp glitch, nhấp nháy theo flick
    for (const { p } of this.plates) {
      p.layers[0].position.set(p.w / 2 - 2.4 * glitch, p.h / 2 - 1.8 * glitch); p.layers[1].position.set(p.w / 2 + 2.4 * glitch, p.h / 2 + 1.8 * glitch);
      p.layers[2].alpha = flick;
    }
  }
}
