import gsap from 'gsap';
import { Container, Sprite, Text, Graphics, Texture } from 'pixi.js';
import { W, H, TIERS } from './config';
import { tex, radialVignette, makeBloodTextures } from './assets';
import { wait, tw, shake, Particles, slowMo } from './fx';
import { sfx } from './audio';
import { Payout, type Group } from './payout';
import type { Reels } from './reels';
import type { ControlBar } from './ui';
import type { Application } from 'pixi.js';

export type Tier = 'quiet' | 'normal' | 'big' | 'mega' | 'epic';
export const tierOf = (total: number, bet: number): Tier => {
  const m = total / bet; return m >= TIERS.epic ? 'epic' : m >= TIERS.mega ? 'mega' : m >= TIERS.big ? 'big' : m >= 1 ? 'normal' : 'quiet';
};
const LABEL: Record<string, string> = { big: 'BIG WIN', mega: 'MEGA WIN', epic: 'EPIC WIN' };
const TAGCOL: Record<string, number> = { big: 0xf2f2f0, mega: 0xf5b82e, epic: 0xffffff };
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Big Win hiện thẳng trên màn hình: không popup, không che màn hình, bấm để đếm nhanh */
export class BigWin extends Container {
  fx = new Container(); particles: Particles;
  num: Text; tag = new Container(); tagText: Text;
  slash: Sprite; red: Sprite; white = new Graphics();
  blood: Texture[]; payout: Payout; onCredit?: (n: number) => void;
  skipping = false; private counter?: gsap.core.Tween;
  constructor(private app: Application, private world: Container, private reels: Reels, private bar: ControlBar, private bgs: { base: Sprite; bonus: Sprite }) {
    super();
    this.blood = makeBloodTextures(8);
    this.red = new Sprite(radialVignette()); this.red.width = W; this.red.height = H; this.red.alpha = 0; this.addChild(this.red);
    this.slash = new Sprite(tex('fx_slash')); this.slash.anchor.set(0.5); this.slash.blendMode = 'screen'; this.slash.alpha = 0; this.slash.position.set(W / 2, 450); this.addChild(this.slash);
    this.particles = new Particles(app.ticker); this.addChild(this.particles);
    this.payout = new Payout(app, world, reels, bar, this.blood); this.payout.onCredit = n => this.onCredit?.(n); this.addChild(this.payout);
    this.tagText = new Text({ text: '', style: { fontFamily: 'Bangers', fontSize: 120, fill: 0xffffff, stroke: { color: 0x000000, width: 14, join: 'round' }, letterSpacing: 4 } });
    this.tagText.anchor.set(0.5); this.tagText.rotation = 0; this.tag.addChild(this.tagText); this.tag.rotation = -8 * Math.PI / 180; this.tag.position.set(W / 2, 250); this.tag.visible = false; this.addChild(this.tag);
    this.num = new Text({ text: '0', style: { fontFamily: 'Bangers', fontSize: 240, fill: 0xf2f2f0, stroke: { color: 0x000000, width: 22, join: 'round' }, dropShadow: { color: 0xe8261b, alpha: 1, angle: Math.PI / 2.4, distance: 14, blur: 0 }, letterSpacing: 4 } });
    this.num.anchor.set(0.5); this.num.position.set(W / 2, 470); this.num.visible = false; this.addChild(this.num);
    this.white.rect(0, 0, W, H).fill(0xffffff); this.white.alpha = 0; this.white.eventMode = 'none'; this.addChild(this.white);
    this.eventMode = 'none';
    app.stage.on('pointerdown', () => { if (this.counter && !this.skipping) { this.skipping = true; this.counter.timeScale(10); } });
  }
  winBase = 0; private setW(v: number) { this.bar.setWin(this.winBase + v); }
  flash(a = 0.8, d = 0.35) { this.white.alpha = a; gsap.to(this.white, { alpha: 0, duration: d, ease: 'power2.out' }); }
  private bgBeat(amp: number) { for (const b of [this.bgs.base, this.bgs.bonus]) { const k = (b as any).baseK ?? b.scale.x; gsap.fromTo(b.scale, { x: k * (1 + amp), y: k * (1 + amp) }, { x: k, y: k, duration: 0.5, ease: 'power2.out', overwrite: true }); } }
  private burst(cx: number, cy: number, n: number, tier: Tier) {
    this.particles.burst(this.blood, cx, cy, n, { speed: 1100, spread: Math.PI * 2, g: 1100, size: 90, life: 1.1 });
    sfx.hit(tier === 'epic' ? 3 : tier === 'mega' ? 2 : 1);
  }
  private slashSweep() {
    sfx.slash(); this.slash.alpha = 1; this.slash.scale.set(1.5); this.slash.x = W / 2 - 220; gsap.to(this.slash, { x: W / 2 + 220, duration: 0.45, ease: 'power3.out' }); gsap.to(this.slash, { alpha: 0, duration: 0.5, delay: 0.1 });
  }

  private col: { tw: gsap.core.Tween; prev: number } | null = null;
  /** Cuối lượt: tiền ở ô WIN chảy về BALANCE (chạy nền, không khoá người chơi). */
  collect(amount: number): void {
    if (amount <= 0) return; this.finishCollect();
    const src = this.payout.toLocal(this.bar.winT.getGlobalPosition());
    this.payout.flow([{ x: src.x, y: src.y, pay: amount }], 8, 'balance', false, 1.5);
    const st = { v: amount }; const col = { prev: amount, tw: null as any };
    const dur = 0.55 + Math.min(0.45, Math.log10(amount + 1) * 0.08);
    col.tw = gsap.to(st, { v: 0, duration: dur, delay: 0.1, ease: 'power1.in',
      onUpdate: () => { const cur = Math.round(st.v); const d = col.prev - cur; if (d > 0) { col.prev = cur; this.onCredit?.(d); this.bar.setWin(cur); } },
      onComplete: () => { if (col.prev > 0) this.onCredit?.(col.prev); col.prev = 0; this.bar.setWin(0); this.bar.bounceBalance(); this.col = null; } });
    this.col = col;
  }
  /** Chốt ngay phần chưa trả (khi người chơi quay tiếp). */
  finishCollect() {
    const c = this.col; if (!c) return; c.tw.kill(); this.col = null;
    if (c.prev > 0) this.onCredit?.(c.prev); this.bar.setWin(0); this.bar.bounceBalance();
  }

  /** Trình bày kết quả thắng. Trả về khi hiệu ứng kết thúc. */
  async present(total: number, bet: number, winCells: Set<string>, tier: Tier, titleOverride?: string, groupsIn?: Group[]): Promise<void> {
    this.skipping = false; this.setW(0); this.payout.credited = 0;
    sfx.win();
    this.reels.highlight(winCells, true);
    const groups: Group[] = groupsIn && groupsIn.length ? groupsIn : [{ cells: [...winCells].map(k => k.split(',').map(Number) as [number, number]), pay: total }];
    const big0 = tier === 'big' || tier === 'mega' || tier === 'epic';
    // 1) vệt kiếm chém qua các ô thắng, hiện điểm từng nhóm
    const pops = await this.payout.cutPhase(groups, tier === 'quiet' ? 0.7 : 1, sum => { if (!big0) this.setW(sum); });
    if (!big0) { // thắng thường: điểm chảy thẳng về balance
      this.setW(total); this.bar.bounceWin();
      this.payout.dismiss(pops); await wait(0.2);
      await wait(0.1); this.reels.resetLook(); return;
    }
    this.payout.dismiss(pops);
    const big = tier === 'big' || tier === 'mega' || tier === 'epic';
    const dur = tier === 'big' ? 2.7 : tier === 'mega' ? 3.9 : 5.3;
    const o = { v: 0 }; const centerX = W / 2, centerY = 470;
    if (big) {
      this.tagText.text = titleOverride ?? LABEL[tier]; this.tagText.style.fill = TAGCOL[tier];
      this.tagText.style.stroke = { color: tier === 'epic' ? 0xe8261b : 0x000000, width: 14, join: 'round' };
      this.tag.visible = true; this.tag.scale.set(2.6); this.tag.alpha = 0; this.tag.rotation = -8 * Math.PI / 180;
      gsap.to(this.tag, { alpha: 1, duration: 0.12 }); gsap.to(this.tag.scale, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2.2)' });
      this.num.visible = true; this.num.scale.set(0.3); gsap.to(this.num.scale, { x: 1, y: 1, duration: 0.45, ease: 'back.out(2.5)' });
      this.num.style.fill = tier === 'epic' ? 0xffffff : 0xf2f2f0;
      this.flash(tier === 'big' ? 0.35 : 0.6, 0.3);
      shake(this.world, tier === 'epic' ? 26 : tier === 'mega' ? 16 : 9, 0.6);
      this.burst(centerX, centerY, tier === 'epic' ? 48 : tier === 'mega' ? 34 : 22, tier);
      this.bgBeat(tier === 'epic' ? 0.06 : 0.035);
      if (tier !== 'big') { await wait(0.12); this.slashSweep(); }
      if (tier === 'epic') { gsap.fromTo(this.red, { alpha: 0 }, { alpha: 1, duration: 0.18, yoyo: true, repeat: 5 }); }
      sfx.riser(dur);
    } else { this.bgBeat(0.015); }
    // đếm số; có nhịp nhảy/rung chữ và đợt xu thứ hai
    let lastBeat = 0; const beats = tier === 'epic' ? 5 : tier === 'mega' ? 3 : tier === 'big' ? 2 : 0; let beat = 0;
    this.counter = gsap.to(o, { v: total, duration: dur, ease: 'power1.inOut', onUpdate: () => {
      this.setW(o.v); if (big) this.num.text = fmt(o.v);
      if (big && Math.floor(o.v / total * (beats + 1)) > lastBeat && beat < beats) { lastBeat++; beat++; this.bgBeat(0.025); sfx.drum(2, 0.09); gsap.fromTo(this.num.scale, { x: 1.12, y: 1.12 }, { x: 1, y: 1, duration: 0.25, ease: 'back.out(3)' }); }
    } });
    await new Promise<void>(res => this.counter!.eventCallback('onComplete', res)); this.counter = undefined; this.setW(total); this.bar.bounceWin();
    if (big) {
      this.num.text = fmt(total); sfx.fanfare(); shake(this.world, 8, 0.3);
      await wait(this.skipping ? 0.35 : 0.8);
      await Promise.all([tw(this.num, { alpha: 0, duration: 0.45 }), tw(this.tag, { alpha: 0, duration: 0.45 })]);
      this.num.visible = false; this.tag.visible = false; this.num.alpha = 1; this.tag.alpha = 1; gsap.killTweensOf(this.red); this.red.alpha = 0;
    }
    this.reels.resetLook();
  }

  /** Cut-in Final Slash: tranh chiến binh nằm trong một dải ngang kéo hết chiều rộng màn hình (giống dải Free Spins), trượt vào với cú giật rồi trượt ra */
  viewW = W;
  private async cutIn() {
    const c = new Container(); c.alpha = 0; c.eventMode = 'none';
    const B = 560, top = (x: number) => 200 - (30 / W) * x, X0 = -3000, X1 = W + 3000; // dải nghiêng nhẹ như banner Free Spins
    const band = [X0, top(X0), X1, top(X1), X1, top(X1) + B, X0, top(X0) + B];
    const bg = new Graphics(); bg.poly(band).fill(0x000000); c.addChild(bg);
    const art = new Sprite(tex('fx_cutin')); art.anchor.set(0.5, 0.42); art.position.set(W / 2, top(W / 2) + B / 2);
    const k = Math.max(W, this.viewW) / art.texture.width; art.scale.set(k * 1.25); c.addChild(art);
    const mask = new Graphics(); mask.poly(band).fill(0xffffff); c.addChild(mask); art.mask = mask;
    const edge = new Graphics(); edge.poly(band).stroke({ width: 8, color: 0xe8261b }); c.addChild(edge);
    this.addChild(c); sfx.hit(3); sfx.finalSlash(); this.flash(0.8, 0.35); shake(this.world, 22, 0.5);
    gsap.fromTo(c, { x: -260 }, { x: 0, duration: 0.3, ease: 'power4.out' }); gsap.to(c, { alpha: 1, duration: 0.1 });
    gsap.to(art.scale, { x: k, y: k, duration: 0.5, ease: 'power3.out' });
    await wait(0.55); gsap.to(art.scale, { x: k * 1.05, y: k * 1.05, duration: 1, ease: 'none' });
    await wait(0.9); gsap.to(c, { x: 320, duration: 0.25, ease: 'power2.in' });
    await tw(c, { alpha: 0, duration: 0.25 }); c.destroy({ children: true });
  }
  /** Chiêu cuối: cut-in nhân vật, vệt chém, rồi trao Epic Win cố định */
  async finalSlash(prize: number, bet: number, cb: { dim: (a: number) => void; resetMeter: () => Promise<void>; heroSlash: (onImpact: () => void) => Promise<void> }): Promise<void> {
    await this.cutIn();
    cb.dim(0.6); sfx.hit(3); this.flash(0.8, 0.4); shake(this.world, 14, 0.5);
    const title = new Text({ text: 'FINAL SLASH', style: { fontFamily: 'Bangers', fontSize: 200, fill: 0xe8261b, stroke: { color: 0xffffff, width: 16, join: 'round' }, dropShadow: { color: 0x000000, alpha: 0.9, blur: 8, distance: 10, angle: 1.2 }, letterSpacing: 6 } });
    title.anchor.set(0.5); title.rotation = -7 * Math.PI / 180; title.position.set(W / 2 + 60, 500); title.alpha = 0; this.addChild(title);
    gsap.to(title, { alpha: 1, duration: 0.15 }); gsap.fromTo(title.scale, { x: 2.4, y: 2.4 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2)' });
    this.reels.highlight(new Set(), false);
    let hit: Promise<void> = Promise.resolve();
    const done = cb.heroSlash(() => { // khung hình chém: một đường kiếm đi xuyên qua chữ FINAL SLASH
      hit = (async () => {
        sfx.slash(); sfx.hit(3); this.flash(1, 0.4); shake(this.world, 32, 0.8); slowMo(0.2, 520, 420);
        gsap.fromTo(title, { x: title.x - 26 }, { x: title.x, duration: 0.6, ease: 'elastic.out(1,0.3)' });
        this.particles.burst(this.blood, W / 2, 500, 26, { speed: 1300, spread: Math.PI * 2, g: 1100, size: 90, life: 1.1 });
        await this.payout.slash(260, 1000, 1660, 90, 82, 0.55, 38, 0.1);
      })();
    });
    await done; await hit; await tw(title, { alpha: 0, duration: 0.25 }); title.destroy();
    cb.dim(0);
    await this.present(prize, bet, new Set(Array.from({ length: 20 }, (_, i) => `${Math.floor(i / 4)},${i % 4}`)), 'epic', 'FINAL SLASH');
    await cb.resetMeter();
  }
}

