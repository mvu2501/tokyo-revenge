import gsap from 'gsap';
import { Container, Sprite, Texture, Ticker } from 'pixi.js';

export const wait = (s: number) => new Promise<void>(r => gsap.delayedCall(s, r));
export const tw = (target: any, vars: gsap.TweenVars) => new Promise<void>(res => { gsap.to(target, { ...vars, onComplete: res }); });

let slowId = 0;
/** Người chơi bấm quay khi đang trả thưởng: tua nhanh phần còn lại. */
export const hurry = { on: false };
export function setHurry(on: boolean) { hurry.on = on; slowId++; gsap.globalTimeline.timeScale(on ? 4 : 1); }
/** Slow motion kiểu hitstop: làm chậm toàn bộ animation rồi hồi dần về tốc độ thường (đo bằng thời gian thật). */
export function slowMo(scale = 0.22, holdMs = 380, rampMs = 380) {
  if (hurry.on) return;
  const tl = gsap.globalTimeline; const id = ++slowId; tl.timeScale(scale); const t0 = performance.now();
  const step = () => {
    if (id !== slowId) return; const e = performance.now() - t0 - holdMs;
    if (e < 0) { requestAnimationFrame(step); return; }
    const k = Math.min(1, e / rampMs); tl.timeScale(scale + (1 - scale) * k * k);
    if (k < 1) requestAnimationFrame(step); else tl.timeScale(1);
  };
  requestAnimationFrame(step);
}

export function shake(c: Container, amp: number, dur = 0.5) {
  const o = { a: amp, x: c.x, y: c.y };
  const base = { x: 0, y: 0 };
  gsap.killTweensOf(o);
  gsap.to(o, { a: 0, duration: dur, ease: 'power2.out', onUpdate: () => { c.position.set(base.x + (Math.random() - 0.5) * 2 * o.a, base.y + (Math.random() - 0.5) * 2 * o.a); }, onComplete: () => c.position.set(base.x, base.y) });
}

interface P { s: Sprite; vx: number; vy: number; vr: number; g: number; life: number; max: number; fade: boolean; scale0: number; grow: number }
export class Particles extends Container {
  list: P[] = [];
  constructor(ticker: Ticker) { super(); ticker.add(t => this.update(t.deltaMS / 1000 * gsap.globalTimeline.timeScale())); }
  burst(tex: Texture[], x: number, y: number, n: number, opt: { speed?: number; spread?: number; angle?: number; g?: number; size?: number; life?: number; blend?: 'add' | 'normal'; tint?: number; fade?: boolean } = {}) {
    for (let i = 0; i < n; i++) {
      const s = new Sprite(tex[Math.floor(Math.random() * tex.length)]); s.anchor.set(0.5);
      const a = (opt.angle ?? -Math.PI / 2) + (Math.random() - 0.5) * (opt.spread ?? Math.PI * 2);
      const sp = (opt.speed ?? 700) * (0.4 + Math.random() * 0.8);
      const size = (opt.size ?? 60) * (0.6 + Math.random() * 0.7);
      s.width = size; s.scale.y = s.scale.x; s.position.set(x, y); s.rotation = Math.random() * 6;
      if (opt.tint !== undefined) s.tint = opt.tint; if (opt.blend === 'add') s.blendMode = 'add';
      this.addChild(s);
      const max = (opt.life ?? 1.3) * (0.7 + Math.random() * 0.6);
      this.list.push({ s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vr: (Math.random() - 0.5) * 12, g: opt.g ?? 1500, life: max, max, fade: opt.fade ?? true, scale0: s.scale.x, grow: 0 });
    }
  }
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]; p.life -= dt;
      if (p.life <= 0) { p.s.destroy(); this.list.splice(i, 1); continue; }
      p.vy += p.g * dt; p.s.x += p.vx * dt; p.s.y += p.vy * dt; p.s.rotation += p.vr * dt;
      if (p.fade) p.s.alpha = Math.min(1, (p.life / p.max) * 2);
    }
  }
}
