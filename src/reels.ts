import gsap from 'gsap';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { COLS, ROWS, CELL_W, CELL_H, SYMBOL_SIZE } from './config';
import { Grid, randSym } from './logic';
import { sfx } from './audio';

export class Reels extends Container {
  cells: Sprite[][] = [];
  grid: Grid;
  strips: Container[] = [];
  active: gsap.core.Tween[] = []; fast = 1; // 1 = bình thường, <1 = turbo
  constructor(private texOf: (id: number) => Texture, init: Grid) {
    super();
    this.grid = init;
    const mask = new Graphics(); mask.rect(-14, -6, CELL_W * COLS + 28, CELL_H * ROWS + 12).fill(0xffffff);
    this.addChild(mask); this.mask = mask;
    for (let c = 0; c < COLS; c++) {
      const strip = new Container(); strip.x = c * CELL_W; this.addChild(strip); this.strips.push(strip);
      this.cells[c] = [];
    }
    this.place();
  }
  private mk(id: number): Sprite {
    const s = new Sprite(this.texOf(id)); s.anchor.set(0.5);
    const special = id === 10 || id === 11; const hero = id === 8 || id === 9;
    const k = special ? Math.min((CELL_W * 0.98) / s.texture.width, (CELL_H * 0.93) / s.texture.height) : (SYMBOL_SIZE * (hero ? 1.1 : 1)) / 384;
    s.scale.set(k); (s as any).baseScale = k; (s as any).sym = id; return s;
  }
  place() {
    for (let c = 0; c < COLS; c++) {
      const strip = this.strips[c]; strip.removeChildren().forEach(ch => ch.destroy()); strip.y = 0;
      for (let r = 0; r < ROWS; r++) {
        const s = this.mk(this.grid[c][r]); s.position.set(CELL_W / 2, (r + 0.5) * CELL_H); strip.addChild(s); this.cells[c][r] = s;
      }
    }
  }
  setGrid(g: Grid) { this.grid = g; this.place(); }

  async spin(final: Grid): Promise<void> {
    sfx.spinStart();
    const jobs: Promise<void>[] = [];
    for (let c = 0; c < COLS; c++) {
      jobs.push(new Promise<void>(resolve => {
        const strip = this.strips[c]; const cur = this.grid[c];
        const nRand = Math.max(6, Math.round((21 + c * 4) * this.fast));
        const seq: number[] = [...final[c], ...Array.from({ length: nRand }, () => randSym(c)), ...cur];
        strip.removeChildren().forEach(ch => ch.destroy());
        const L = seq.length;
        seq.forEach((id, i) => { const s = this.mk(id); s.position.set(CELL_W / 2, (i - (L - ROWS) + 0.5) * CELL_H); strip.addChild(s); });
        strip.y = 0;
        const dist = (L - ROWS) * CELL_H;
        const dur = (0.7 + c * 0.2) * this.fast + nRand * 0.016;
        const tl = gsap.timeline({ delay: c * 0.05 * this.fast });
        tl.to(strip, { y: -34, duration: 0.16, ease: 'sine.out' });
        // chạy đều tới gần đích rồi hạ cánh nhanh có nảy nhẹ (không giảm tốc kéo dài ở cuối)
        const land = CELL_H * 0.8; const landT = 0.26;
        tl.to(strip, { y: dist - land, duration: dur - 0.3, ease: 'none' });
        tl.call(() => sfx.reelStop());
        tl.to(strip, { y: dist, duration: landT, ease: 'back.out(1.6)', onComplete: () => {
          this.grid[c] = [...final[c]];
          strip.removeChildren().forEach(ch => ch.destroy()); strip.y = 0;
          for (let r = 0; r < ROWS; r++) { const s = this.mk(final[c][r]); s.position.set(CELL_W / 2, (r + 0.5) * CELL_H); strip.addChild(s); this.cells[c][r] = s; }
          resolve();
        } });
        this.active.push(tl as any);
      }));
    }
    await Promise.all(jobs);
    this.active = [];
  }

  /** Cascade: ô thắng biến mất, ô phía trên rơi xuống, ô mới rơi thêm vào. */
  async cascade(remove: Set<string>, fill: (col: number) => number, onRemove?: (x: number, y: number) => void): Promise<void> {
    sfx.reelStop();
    const jobs: Promise<void>[] = [];
    for (let c = 0; c < COLS; c++) {
      const strip = this.strips[c]; const keep: { s: Sprite; id: number }[] = []; let k = 0;
      for (let r = 0; r < ROWS; r++) {
        const s = this.cells[c][r];
        if (remove.has(`${c},${r}`)) {
          k++; const p = this.cellCenter(c, r); onRemove?.(p.x, p.y); gsap.killTweensOf(s); gsap.killTweensOf(s.scale);
          gsap.to(s.scale, { x: 0.1, y: 0.1, duration: 0.2, ease: 'power2.in' });
          gsap.to(s, { alpha: 0, rotation: (Math.random() - 0.5) * 1.2, duration: 0.2, onComplete: () => { s.destroy(); } });
        } else keep.push({ s, id: this.grid[c][r] });
      }
      if (!k) continue;
      const news: { s: Sprite; id: number }[] = [];
      for (let i = 0; i < k; i++) { const id = fill(c); const s = this.mk(id); s.position.set(CELL_W / 2, (i - k + 0.5) * CELL_H); strip.addChild(s); news.push({ s, id }); }
      const all = [...news, ...keep]; this.cells[c] = all.map(a => a.s); this.grid[c] = all.map(a => a.id);
      jobs.push(new Promise<void>(res => {
        let left = all.length;
        all.forEach((a, i) => {
          const ty = (i + 0.5) * CELL_H; if (Math.abs(a.s.y - ty) < 1) { if (--left === 0) res(); return; }
          gsap.to(a.s, { y: ty, duration: (0.34 + 0.05 * k) * (this.fast < 1 ? 0.65 : 1), delay: (0.2 + c * 0.04 + (all.length - i) * 0.02) * (this.fast < 1 ? 0.5 : 1), ease: 'bounce.out', onComplete: () => { if (--left === 0) res(); } });
        });
      }));
    }
    await Promise.all(jobs); await new Promise(r2 => setTimeout(r2, 60));
  }
  quickStop() { this.active.forEach(t => (t as any).timeScale(3.5)); }

  resetLook() {
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const s = this.cells[c][r]; gsap.killTweensOf(s); gsap.killTweensOf(s.scale);
      s.tint = 0xffffff; s.alpha = 1; s.scale.set((s as any).baseScale); s.rotation = 0;
    }
  }
  /** Làm tối các ô không thắng, phóng nhấp nháy ô thắng */
  highlight(win: Set<string>, dim = true) {
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const s = this.cells[c][r]; const k = (s as any).baseScale as number;
      if (win.has(`${c},${r}`)) {
        gsap.to(s.scale, { x: k * 1.14, y: k * 1.14, duration: 0.28, ease: 'back.out(3)', yoyo: true, repeat: -1, repeatDelay: 0.25 });
      } else if (dim) { gsap.to(s, { alpha: 0.32, duration: 0.2 }); s.tint = 0x777777; }
    }
  }
  cellCenter(c: number, r: number) { return { x: this.x + c * CELL_W + CELL_W / 2, y: this.y + (r + 0.5) * CELL_H }; }
}
