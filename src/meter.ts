import gsap from 'gsap';
import { Container, Sprite, Graphics } from 'pixi.js';
import { METER } from './config';
import { tex } from './assets';

/** Thanh Revenge: ảnh kiếm rỗng (M1) + ảnh kiếm đầy (M3) bị cắt theo đường xiên cho tới ô thứ N */
export class Meter extends Container {
  level = 0; // số ô đã nạp (0..10)
  private shown = { v: 0 };
  baseScale = 1; private full: Sprite; private maskG: Graphics; private glow: Sprite; private bolts: Graphics; private zapT = 0; private zapPower = 0; private acc = 0;
  constructor() {
    super();
    const k = METER.scale;
    const empty = new Sprite(tex('meter_empty')); empty.scale.set(k);
    this.full = new Sprite(tex('meter_full')); this.full.scale.set(k);
    this.maskG = new Graphics(); this.maskG.scale.set(k);
    this.glow = new Sprite(tex('meter_full')); this.glow.scale.set(k); this.glow.blendMode = 'add'; this.glow.alpha = 0; this.glow.visible = false;
    this.bolts = new Graphics(); this.bolts.scale.set(k); this.bolts.blendMode = 'add';
    this.addChild(empty, this.full, this.maskG, this.glow, this.bolts); this.full.mask = this.maskG;
    gsap.ticker.add(() => this.zapTick());
    this.position.set(METER.x, METER.y); this.draw();
  }
  private draw() {
    const v = this.shown.v; const g = this.maskG; g.clear();
    if (v <= 0.01) return;
    if (v >= 9.99) { g.rect(-100, -100, METER.w + 200, METER.h + 200).fill(0xffffff); return; }
    const xb = METER.xb1 + (v - 1) * METER.pitch;
    const top = -100, bot = 600;
    const xt = xb + METER.slant * (METER.yRef - top), xbm = xb + METER.slant * (METER.yRef - bot);
    g.poly([-100, top, xt, top, xbm, bot, -100, bot]).fill(0xffffff);
  }
  setLevel(n: number, animate = true) {
    const target = Math.max(0, Math.min(10, n)); const up = target > this.level; this.level = target;
    gsap.killTweensOf(this.shown);
    const done = () => { this.draw(); };
    if (!animate) { this.shown.v = target; done(); return Promise.resolve(); }
    return new Promise<void>(res => {
      gsap.to(this.shown, { v: target, duration: up ? 0.6 : 0.9, ease: up ? 'power2.out' : 'power2.inOut', onUpdate: () => this.draw(), onComplete: () => { this.draw(); res(); } });
      if (up) this.pulse();
    });
  }
  pulse() {
    this.glow.visible = true; this.glow.alpha = 0.9; gsap.to(this.glow, { alpha: 0, duration: 0.6, ease: 'power2.out' });
    const b = this.baseScale; gsap.fromTo(this.scale, { x: b * 1.06, y: b * 1.06 }, { x: b, y: b, duration: 0.4, ease: 'back.out(3)' });
    this.zap(0.9, 1);
  }
  /** Khi đầy: nhấp nháy hiệu ứng trước khi Final Slash */
  charged() { this.glow.visible = true; gsap.to(this.glow, { alpha: 0.7, duration: 0.18, yoyo: true, repeat: 7 }); this.zap(1.6, 2.2); }

  /** Sét chạy dọc phần lưỡi đã nạp, màu cam đỏ + lõi trắng (cùng màu thanh kiếm) */
  zap(seconds: number, power: number) { this.zapT = Math.max(this.zapT, seconds); this.zapPower = Math.max(this.zapPower, power); }
  private bolt(g: Graphics, x0: number, x1: number, yc: (x: number) => number, amp: number, w: number) {
    const pts: number[] = []; const n = 7;
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; pts.push(x, yc(x) + (i === 0 || i === n ? 0 : (Math.random() - 0.5) * 2 * amp)); }
    g.poly(pts, false).stroke({ width: w * 2.6, color: 0xff3a14, alpha: 0.55, cap: 'round', join: 'round' });
    g.poly(pts, false).stroke({ width: w * 1.2, color: 0xffa33a, alpha: 0.9, cap: 'round', join: 'round' });
    g.poly(pts, false).stroke({ width: w * 0.5, color: 0xffffff, alpha: 1, cap: 'round', join: 'round' });
  }
  private zapTick() {
    const dt = gsap.ticker.deltaRatio(60) / 60; const g = this.bolts;
    this.acc += dt; if (this.acc < 0.045) return; this.acc = 0;
    const idle = this.level >= 1 && Math.random() < 0.05;     // thỉnh thoảng 1 tia nhỏ khi đã có năng lượng
    if (this.zapT <= 0 && !idle) { g.clear(); return; }
    this.zapT -= 0.045; if (this.zapT <= 0) this.zapPower = 0;
    g.clear();
    const v = Math.max(this.shown.v, 0.001); if (v < 0.5) return;
    const xe = v >= 9.99 ? METER.xLast : METER.xb1 + (v - 1) * METER.pitch;
    const yc = (_x: number) => METER.yRef;
    const p = this.zapT > 0 ? this.zapPower : 0.5; const cnt = Math.ceil(1 + p * 1.4);
    for (let i = 0; i < cnt; i++) {
      const a = METER.xFirst + Math.random() * Math.max(40, xe - METER.xFirst - 60); const len = 90 + Math.random() * 150 * Math.min(p, 2);
      this.bolt(g, a, Math.min(a + len, xe + 14), yc, 30 + 8 * p, 3.4 + p);
    }
    if (this.zapT > 0) { // tia bắn ra ở đầu vạch nạp
      const y0 = yc(xe);
      for (let i = 0; i < 2; i++) { const ang = (Math.random() - 0.5) * 2.2; const L = 40 + Math.random() * 70 * p;
        g.poly([xe, y0, xe + Math.cos(ang) * L * 0.5 + (Math.random() - 0.5) * 12, y0 + Math.sin(ang) * L * 0.5, xe + Math.cos(ang) * L, y0 + Math.sin(ang) * L], false).stroke({ width: 4, color: 0xffd9a0, alpha: 0.95, cap: 'round' }); }
      g.circle(xe, y0, 16 + 8 * p).fill({ color: 0xff7a2a, alpha: 0.5 });
    }
  }
}
