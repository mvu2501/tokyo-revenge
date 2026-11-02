import gsap from 'gsap';
import { Container, Graphics, Sprite, Text, Texture, Application } from 'pixi.js';
import { CELL_W, CELL_H, COLS, ROWS } from './config';
import { Particles, wait, shake, slowMo } from './fx';
import { sfx } from './audio';
import type { Reels } from './reels';
import type { ControlBar } from './ui';

export interface Group { cells: [number, number][]; pay: number }
export interface Pop { t: Text; x: number; y: number; pay: number }
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Hiệu ứng ăn điểm: vệt kiếm samurai chém qua các ô thắng -> số điểm nổi lên -> điểm chảy về BALANCE */
export class Payout extends Container {
  private layer = new Container(); particles: Particles; sparkTex: Texture; orbTex: Texture;
  credited = 0; onCredit: (n: number) => void = () => {};
  constructor(app: Application, private world: Container, private reels: Reels, private bar: ControlBar, private blood: Texture[]) {
    super(); this.eventMode = 'none';
    const sp = new Graphics(); sp.poly([0, -18, 9, 0, 0, 18, -9, 0]).fill(0xffffff); this.sparkTex = app.renderer.generateTexture(sp);
    const ob = new Graphics(); ob.circle(0, 0, 18).fill({ color: 0xff4a2b, alpha: 0.3 }); ob.circle(0, 0, 10).fill({ color: 0xffa33a, alpha: 0.8 }); ob.circle(0, 0, 5).fill(0xffffff);
    this.orbTex = app.renderer.generateTexture(ob);
    this.particles = new Particles(app.ticker); this.addChild(this.layer, this.particles);
  }

  /** Một nhát chém: đầu vệt lao qua rất nhanh rồi mỏng dần. Trả về khi đầu vệt tới cuối. */
  slash(x0: number, y0: number, x1: number, y1: number, w = 38, life = 0.4, bow = 18, headT = 0.09): Promise<void> {
    const g = new Graphics(); g.blendMode = 'add'; this.layer.addChild(g);
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1; const nx = -dy / len, ny = dx / len;
    const st = { head: 0, k: 1 };
    const draw = () => {
      g.clear(); const t1 = st.head; if (t1 <= 0.002 || st.k <= 0.01) return;
      const t0 = Math.max(0, t1 - 0.92); const N = 24; const C: number[][] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N; const t = t0 + (t1 - t0) * u; const b = bow * Math.sin(Math.PI * t);
        const half = w * 0.5 * st.k * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0.02, t))), 0.5) * Math.min(1, u * 6) * Math.min(1, (1 - u) * 5 + 0.04);
        C.push([x0 + dx * t + nx * b, y0 + dy * t + ny * b, half]);
      }
      const poly = (m: number, color: number, alpha: number, ox = 0, oy = 0) => {
        const pts: number[] = [];
        for (const [x, y, h] of C) pts.push(x + nx * h * m + ox, y + ny * h * m + oy);
        for (let i = C.length - 1; i >= 0; i--) { const [x, y, h] = C[i]; pts.push(x - nx * h * m + ox, y - ny * h * m + oy); }
        g.poly(pts).fill({ color, alpha });
      };
      poly(1.2, 0x19e3ff, 0.5 * st.k, -3, -2);
      poly(2.4, 0xff2a14, 0.38 * st.k);
      poly(1.3, 0xff6a3a, 0.75 * st.k);
      poly(0.55, 0xffffff, 1);
    };
    return new Promise<void>(res => {
      const tl = gsap.timeline({ onComplete: () => g.destroy() });
      tl.to(st, { head: 1, duration: headT, ease: 'power1.in', onUpdate: draw, onComplete: res });
      tl.to(st, { k: 0, duration: life, ease: 'power2.in', onUpdate: draw });
    });
  }


  /** Chém liên hoàn nối các điểm (vd. 3 scatter) thành một vòng khép kín: mỗi nhát đi thẳng từ điểm này sang điểm kia, các vệt cùng hiện một lúc */
  async chain(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return;
    const loop = pts.length > 2 ? [...pts, pts[0]] : pts;
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < loop.length - 1; i++) {
      const a = loop[i], b = loop[i + 1];
      jobs.push(new Promise<void>(res => gsap.delayedCall(i * 0.2, () => {
        sfx.slash(); shake(this.world, 8, 0.25);
        this.slash(a.x, a.y, b.x, b.y, 30, 0.95, 0, 0.1).then(() => {
          sfx.hit(1);
          this.particles.burst([this.sparkTex], b.x, b.y, 12, { speed: 800, spread: Math.PI * 2, g: 900, size: 17, life: 0.5, blend: 'add', tint: 0xffb070 });
          res();
        });
      })));
    }
    await Promise.all(jobs); await wait(0.7);
  }

  private hit(c: number, r: number, ang: number, delay: number) {
    gsap.delayedCall(delay, () => {
      const s = this.reels.cells[c]?.[r]; if (!s || s.destroyed) return;
      const p = this.reels.cellCenter(c, r);
      this.particles.burst([this.sparkTex], p.x, p.y, 8, { speed: 760, spread: Math.PI * 2, g: 900, size: 15, life: 0.45, blend: 'add', tint: 0xffb070 });
      this.particles.burst(this.blood, p.x, p.y, 4, { speed: 520, spread: Math.PI * 2, g: 1000, size: 42, life: 0.7 });
      const nx = -Math.sin(ang), ny = Math.cos(ang); const bx = CELL_W / 2, by = (r + 0.5) * CELL_H;
      gsap.killTweensOf(s, 'x,y');
      gsap.fromTo(s, { x: bx + nx * 15, y: by + ny * 15 }, { x: bx, y: by, duration: 0.42, ease: 'elastic.out(1,0.35)' });
    });
  }

  private async doGroup(g: Group, idx: number, speed: number, pops: Pop[], flip: boolean): Promise<void> {
    sfx.slash(); sfx.hit(1); shake(this.world, 6, 0.25);
    const cells = g.cells; const rx = this.reels.x, ry = this.reels.y; const rw = COLS * CELL_W, rh = ROWS * CELL_H;
    let cx = 0, cy = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    const pts = cells.map(([c, r]) => this.reels.cellCenter(c, r));
    for (const p of pts) { cx += p.x; cy += p.y; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    cx /= pts.length; cy /= pts.length;
    let main: Promise<void>;
    if (cells.length > 9) { // thắng cực lớn: ba nhát chém xuyên cả bảng
      const a = [[rx - 90, ry + rh * 0.05, rx + rw + 90, ry + rh * 0.95], [rx + rw + 90, ry + rh * 0.08, rx - 90, ry + rh * 0.92], [rx - 90, ry + rh * 0.5, rx + rw + 90, ry + rh * 0.42]];
      main = Promise.resolve();
      a.forEach((s, i) => { gsap.delayedCall(i * 0.13 * speed, () => { sfx.slash(); this.slash(s[0], s[1], s[2], s[3], 54, 0.45, 26); }); });
      cells.forEach(([c, r]) => this.hit(c, r, 0.6, Math.random() * 0.3 * speed));
      gsap.delayedCall(0.4 * speed, () => slowMo()); await wait(0.42 * speed);
    } else {
      let sx = 0, sxy = 0; for (const p of pts) { sx += (p.x - cx) ** 2; sxy += (p.x - cx) * (p.y - cy); }
      let ang = sx > 1 ? Math.atan2(sxy, sx) : 0; ang = Math.max(-0.6, Math.min(0.6, ang));
      if (Math.abs(ang) < 0.22) ang = (idx % 2 === 0 ? 1 : -1) * 0.3;
      const half = (maxX - minX) / 2 + 150; const hl = half / Math.cos(ang);
      const dx = Math.cos(ang), dy = Math.sin(ang); const nx = -dy, ny = dx;
      let p0 = [cx - dx * hl, cy - dy * hl], p1 = [cx + dx * hl, cy + dy * hl];
      if (flip) { const t = p0; p0 = p1; p1 = t; }
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); const ux = (p1[0] - p0[0]) / L, uy = (p1[1] - p0[1]) / L;
      main = this.slash(p0[0], p0[1], p1[0], p1[1], 40, 0.42, 20 * (flip ? -1 : 1), 0.1 * speed);
      cells.forEach(([c, r], i) => {
        const p = pts[i]; const d = Math.abs((p.x - cx) * nx + (p.y - cy) * ny); const t = ((p.x - p0[0]) * ux + (p.y - p0[1]) * uy) / L;
        const delay = Math.max(0, t) * 0.1 * speed;
        this.hit(c, r, ang, delay);
        if (d > CELL_H * 0.55) { // ô nằm xa đường chém chính: thêm một nhát ngắn xuyên ô đó
          gsap.delayedCall(delay, () => this.slash(p.x - dx * CELL_W * 0.75, p.y - dy * CELL_W * 0.75, p.x + dx * CELL_W * 0.75, p.y + dy * CELL_W * 0.75, 22, 0.3, 0, 0.05));
        }
      });
      await main; slowMo();
    }
    // số điểm ăn được
    let px = (minX + maxX) / 2, py = (minY + maxY) / 2 - 10;
    if (cells.length > 9) { px = rx + rw / 2; py = ry + rh / 2; }
    for (const o of pops) if (Math.hypot(o.x - px, o.y - py) < 110) py += 95;
    py = Math.max(ry + 50, Math.min(ry + rh - 50, py));
    const size = cells.length > 9 ? 120 : 76;
    const t = new Text({ text: '+' + fmt(g.pay), style: { fontFamily: 'Bangers', fontSize: size, fill: 0xf2f2f0, stroke: { color: 0x000000, width: 12, join: 'round' }, dropShadow: { color: 0xe8261b, alpha: 1, angle: Math.PI / 2.4, distance: 7, blur: 0 }, letterSpacing: 2 } });
    t.anchor.set(0.5); t.position.set(px, py); t.rotation = (idx % 2 ? 0.07 : -0.07); this.addChild(t);
    gsap.fromTo(t.scale, { x: 1.8, y: 1.8 }, { x: 1, y: 1, duration: 0.28, ease: 'back.out(2.6)' });
    gsap.fromTo(t, { alpha: 0 }, { alpha: 1, duration: 0.08 });
    pops.push({ t, x: px, y: py, pay: g.pay });
  }

  /** Chém lần lượt từng nhóm thắng (tối đa 4 nhóm lớn nhất). */
  async cutPhase(groups: Group[], speed: number, onWin: (sum: number) => void): Promise<Pop[]> {
    const pops: Pop[] = []; let sum = 0;
    const list = [...groups].sort((a, b) => b.pay - a.pay).slice(0, 4);
    for (let i = 0; i < list.length; i++) {
      await this.doGroup(list[i], i, speed, pops, i % 2 === 1);
      sum += list[i].pay; onWin(sum);
      await wait(0.2 * speed);
    }
    return pops;
  }

  dismiss(pops: Pop[]) { for (const p of pops) gsap.to(p.t, { alpha: 0, duration: 0.25, onComplete: () => p.t.destroy() }); }

  /** Điểm hoá thành các hạt sáng bay cong về ô BALANCE; mỗi hạt tới nơi thì cộng một phần vào số dư. */
  async flow(srcs: { x: number; y: number; pay: number; t?: Text }[], orbsPer = 8, to: 'win' | 'balance' = 'balance', credit = true, speed = 1): Promise<void> {
    const target = this.toLocal((to === 'win' ? this.bar.winT : this.bar.balanceT).getGlobalPosition());
    const jobs: Promise<void>[] = [];
    for (const s of srcs) {
      if (s.t) gsap.to(s.t, { alpha: 0, duration: 0.35, delay: 0.12, onComplete: () => s.t!.destroy() });
      if (s.t) gsap.to(s.t.scale, { x: 0.6, y: 0.6, duration: 0.35, delay: 0.1 });
      let left = Math.round(s.pay);
      for (let k = 0; k < orbsPer; k++) {
        const share = k === orbsPer - 1 ? left : Math.floor(s.pay / orbsPer); left -= share;
        const o = new Sprite(this.orbTex); o.anchor.set(0.5); o.blendMode = 'add'; const sc = 0.8 + Math.random() * 0.7; o.scale.set(sc);
        const sx = s.x + (Math.random() - 0.5) * 60, sy = s.y + (Math.random() - 0.5) * 40; o.position.set(sx, sy); o.alpha = 0; this.addChild(o);
        const mx = (sx + target.x) / 2 + (Math.random() - 0.5) * 320, my = Math.min(sy, target.y) - 90 - Math.random() * 160;
        const st = { t: 0 };
        jobs.push(new Promise<void>(res => {
          gsap.to(st, { t: 1, duration: (0.6 + Math.random() * 0.2) / speed, delay: (0.14 + k * 0.05 + Math.random() * 0.05) / speed, ease: 'power2.in',
            onStart: () => { o.alpha = 1; },
            onUpdate: () => {
              const t = st.t, u = 1 - t;
              const x = u * u * sx + 2 * u * t * mx + t * t * target.x, y = u * u * sy + 2 * u * t * my + t * t * target.y;
              const vx = 2 * u * (mx - sx) + 2 * t * (target.x - mx), vy = 2 * u * (my - sy) + 2 * t * (target.y - my);
              o.position.set(x, y); o.rotation = Math.atan2(vy, vx); o.scale.set(sc * (1 + t * 1.6), sc * (1 - t * 0.35));
            },
            onComplete: () => { o.destroy(); this.credited += share; if (to === 'balance') { if (credit) this.onCredit(share); this.bar.bounceBalance(); } else this.bar.bounceWin(); res(); } });
        }));
      }
    }
    await Promise.all(jobs);
  }
}
