import gsap from 'gsap';
import { Application, Container, Sprite, Text, Graphics, ColorMatrixFilter, Texture, Rectangle } from 'pixi.js';
import { W, H, FRAME, CELL_W, CELL_H, COLS, ROWS, BETS, START_BALANCE, SYM, SCATTER_SPINS, MULT_LADDER } from './config';
import { tex } from './assets';
import { Reels } from './reels';
import { ControlBar } from './ui';
import { Panels, HistoryRow } from './panels';
import { Meter } from './meter';
import { BigWin, tierOf } from './bigwin';
import { randSym, makeGrid, evaluate, craftGrid, noScatter, Force, FORCE_MULT, Grid } from './logic';
import { wait, tw, setHurry } from './fx';
import { sfx, initAudio, music } from './audio';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const CHIP_X = 960, CHIP_Y = 470, CHIP_W = 400;
export class Game {
  root = new Container(); world = new Container();
  bgBase!: Sprite; bgBonus!: Sprite; reels!: Reels; bar!: ControlBar; meter!: Meter; bigwin!: BigWin;
  dimmer = new Graphics(); toastT!: Text; hud!: Text; menu!: Container;
  balance = START_BALANCE; betIdx = 2; busy = false; auto = false; forced: Force | null = null;
  streak = 0; chipM = 0; fsLeft = 0; fsTotal = 0; fsIdx = 0; inFS = false; fxSmoke!: Sprite; smokeK = 0.95; homeBtn?: Sprite; chip!: Sprite;
  get fsMult() { return MULT_LADDER[Math.min(this.fsIdx, MULT_LADDER.length - 1)]; }
  phase: 'idle' | 'spin' | 'pay' = 'idle'; queued = false; panels!: Panels; history: HistoryRow[] = []; onQuit?: () => void; onHome?: () => void; wildTex: any; scatTex: any; hero!: Sprite; mx = 0; my = 0; px = 0; py = 0; areaW = W; areaH = H; heroX = -90;
  constructor(private app: Application, parent: Container) {
    parent.addChild(this.root); this.root.addChild(this.world);
    this.root.eventMode = 'passive';
    const texOf = (() => {
      const wild = tex('sym_WILD'), sc = tex('sym_SCATTER'); this.wildTex = wild; this.scatTex = sc;
      return (id: number) => id === SYM.WILD ? wild : id === SYM.SCATTER ? sc : tex('sym_' + ['L1', 'L2', 'L3', 'L4', 'L5', 'H1', 'H2', 'H3', 'H4', 'H5'][id]);
    })();
    // nền
    this.bgBase = new Sprite(tex('bg_base')); this.bgBonus = new Sprite(tex('bg_bonus'));
    for (const b of [this.bgBase, this.bgBonus]) b.anchor.set(0.5);
    this.bgBonus.alpha = 0; this.world.addChild(this.bgBase, this.bgBonus);
    this.hero = new Sprite(tex('hero')); this.hero.anchor.set(0, 1); this.hero.scale.set(0.74); this.hero.position.set(this.heroX, 1110); this.world.addChild(this.hero);
    this.layoutBg(W, H);
    // khói dính mép phải-dưới của MÀN HÌNH (không phải của khung thiết kế), tràn ra ngoài để parallax không hở viền
    this.fxSmoke = new Sprite(tex('fx_smoke')); this.fxSmoke.anchor.set(1, 1); this.fxSmoke.scale.set(this.smokeK); this.world.addChild(this.fxSmoke);
    window.addEventListener('pointermove', e => { this.mx = (e.clientX / innerWidth - 0.5) * 2; this.my = (e.clientY / innerHeight - 0.5) * 2; });
    app.ticker.add(() => this.parallax());
    // reel + khung
    const pw = COLS * CELL_W, ph = ROWS * CELL_H; const rx = (W - pw) / 2, ry = FRAME.top + FRAME.holeY * FRAME.sy; // lưới nằm giữa màn hình
    const frame = new Sprite(tex('frame')); frame.scale.set(FRAME.sx, FRAME.sy); frame.position.set(rx - FRAME.holeX * FRAME.sx, FRAME.top);
    this.reels = new Reels(texOf, makeGrid()); noScatter(this.reels.grid); this.reels.setGrid(this.reels.grid);
    this.reels.position.set(rx, ry);
    const panel = new Graphics(); panel.position.copyFrom(this.reels.position);
    panel.roundRect(-6, -6, pw + 12, ph + 12, 6).fill({ color: 0x07070c, alpha: 1 });
    for (let c = 1; c < COLS; c++) panel.rect(c * CELL_W - 5, -6, 10, ph + 12).fill({ color: 0x000000, alpha: 1 });
    const neon = new ColorMatrixFilter(); neon.saturate(0.15, true); neon.contrast(0.08, true); neon.brightness(1.04, true); this.reels.filters = [neon];
    this.world.addChild(panel, this.reels, frame);
    // meter
    this.meter = new Meter();
    const home = this.homeBtn = new Sprite(tex('medallion')); home.anchor.set(0.5); home.scale.set(0.4); home.position.set(78, 78); home.eventMode = 'static'; home.cursor = 'pointer';
    home.on('pointerover', () => gsap.to(home.scale, { x: 0.45, y: 0.45, duration: 0.15 })); home.on('pointerout', () => gsap.to(home.scale, { x: 0.4, y: 0.4, duration: 0.15 }));
    home.on('pointerdown', (e: any) => { e.stopPropagation(); if (!this.busy) this.onHome?.(); });
    this.world.addChild(this.meter, home);
    this.chip = new Sprite(tex('mult_2')); this.chip.anchor.set(0.5); this.chip.scale.set(CHIP_W / this.chip.texture.width); this.chip.position.set(CHIP_X, CHIP_Y); this.chip.alpha = 0; this.world.addChild(this.chip);
    app.ticker.add(() => { this.chip.rotation = Math.sin(performance.now() / 700) * 0.03; this.chip.y = CHIP_Y + Math.sin(performance.now() / 900) * 5; });

    // hud free spins
    this.hud = new Text({ text: '', style: { fontFamily: 'Bangers', fontSize: 52, fill: 0xf5b82e, stroke: { color: 0x000000, width: 8, join: 'round' }, letterSpacing: 2 } });
    this.hud.anchor.set(1, 0); this.hud.position.set(W - 40, 24); this.world.addChild(this.hud);
    // thanh điều khiển
    this.bar = new ControlBar(); this.world.addChild(this.bar);
    this.bigwin = new BigWin(app, this.world, this.reels, this.bar, { base: this.bgBase, bonus: this.bgBonus }); this.world.addChild(this.bigwin);
    this.bigwin.onCredit = n => { this.balance += n; this.bar.setBalance(this.balance); };
    this.dimmer.rect(-2000, -1200, W + 4000, H + 2400).fill(0x000000); this.dimmer.alpha = 0; this.dimmer.eventMode = 'none'; this.world.addChild(this.dimmer);
    this.world.addChild(this.bigwin); // đưa chữ Big Win lên trên lớp tối
    this.toastT = new Text({ text: '', style: { fontFamily: 'Bangers', fontSize: 44, fill: 0xffffff, stroke: { color: 0xe8261b, width: 8, join: 'round' } } });
    this.toastT.anchor.set(0.5); this.toastT.position.set(W / 2, 800); this.toastT.alpha = 0; this.root.addChild(this.toastT);
    this.buildMenu(); this.refresh();
    this.bar.onSpin = () => this.startSpin(); this.bar.onStop = () => this.reels.quickStop();
    this.bar.onBet = d => { this.betIdx = Math.max(0, Math.min(BETS.length - 1, this.betIdx + d)); this.refresh(); };
    this.bar.onAuto = on => { this.auto = on; if (on && !this.busy) this.startSpin(); };
    this.panels = new Panels(); this.root.addChild(this.panels);
    this.panels.getHistory = () => this.history; this.panels.getBetIdx = () => this.betIdx;
    this.panels.onQuit = () => this.onQuit?.(); this.panels.onDemo = () => { this.menu.visible = true; };
    this.panels.onPickBet = i => { this.betIdx = i; this.refresh(); };
    this.bar.onMenu = () => this.panels.menu(); this.bar.onBetOpen = () => this.panels.betPicker();
    this.bar.onTurbo = on => { this.reels.fast = on ? 0.4 : 1; };
    window.addEventListener('keydown', e => this.key(e.key));
  }
  layoutBg(aw: number, ah: number) {
    this.areaW = aw; this.areaH = ah; if (this.bigwin) this.bigwin.viewW = aw;
    for (const b of [this.bgBase, this.bgBonus]) { const k = Math.max(aw / b.texture.width, ah / b.texture.height) * 1.07; (b as any).baseK = k; gsap.killTweensOf(b.scale); b.scale.set(k); }
    this.parallax(true);
  }
  parallax(snap = false) {
    const a = snap ? 1 : 0.06; this.px += (this.mx - this.px) * a; this.py += (this.my - this.py) * a;
    for (const b of [this.bgBase, this.bgBonus]) b.position.set(W / 2 - this.px * 16, H / 2 - this.py * 9);
    const offX = (W - this.areaW) / 2, offY = (H - this.areaH) / 2; // góc nhìn thấy thực tế của màn hình trong toạ độ thiết kế
    if (this.fxSmoke) { const t = performance.now() / 1000;
      const k = this.smokeK * (1 + Math.sin(t * 0.6) * 0.012);
      this.fxSmoke.scale.set(k);
      this.fxSmoke.position.set(W - offX + 60 + this.px * 24 + Math.sin(t * 0.4) * 10, H - offY + 40 + this.py * 10 + Math.cos(t * 0.55) * 5);
      this.fxSmoke.alpha = 0.95 + Math.sin(t * 0.8) * 0.04; }
    if (this.homeBtn) this.homeBtn.position.set(78 + offX, 78 + offY);
    this.hero.x = this.heroX + offX + this.px * 26; this.hero.y = 1110 - offY + this.py * 10 + Math.sin(performance.now() / 1400) * 4;
  }
  enter() {
    this.hero.alpha = 0; this.heroX = -330; gsap.to(this, { heroX: -90, duration: 1.3, ease: 'power3.out' }); gsap.to(this.hero, { alpha: 1, duration: 0.9 });
    this.world.alpha = 1;
  }
  async demoJackpot() {
    if (this.busy) return; initAudio(); this.busy = true; this.bar.setBusy(true); this.reels.resetLook(); this.bar.setWin(0);
    await this.meter.setLevel(10); this.meter.charged(); await wait(1.1);
    const prize = 100 * this.bet;
    await this.bigwin.finalSlash(prize, this.bet, this.finalCb()); this.bigwin.collect(prize);
    this.busy = false; this.bar.setBusy(false);
  }
  finalCb() { return { dim: (a: number) => this.dim(a), resetMeter: () => this.meter.setLevel(0), heroSlash: (n: () => void) => this.heroSlash(n) }; }
  /** Nhân vật chính ra chiêu cuối: lao tới, chém ngược lên, rồi lùi về vị trí cũ. */
  async heroSlash(onImpact: () => void) { onImpact(); await wait(0.3); }
  get bet() { return BETS[this.betIdx]; }
  refresh() { this.bar.setBalance(this.balance); this.bar.setBet(this.betIdx); }
  toast(t: string) { this.toastT.text = t; this.toastT.alpha = 1; gsap.to(this.toastT, { alpha: 0, delay: 1.4, duration: 0.5 }); }
  dim(a: number) { gsap.to(this.dimmer, { alpha: a, duration: 0.3 }); }

  key(k: string) {
    if (!this.root.visible) return;
    if (k === ' ' || k === 'Enter') { if (this.busy) this.reels.quickStop(); else this.startSpin(); }
    if (k === '1') this.force('big'); if (k === '2') this.force('mega'); if (k === '3') this.force('epic'); if (k === '4') this.force('fs');
    if (k.toLowerCase() === 'f') this.fillMeter();
  }
  force(f: Force) { if (this.busy) return; this.forced = f; this.menu.visible = false; this.startSpin(); }
  async fillMeter() { if (this.busy) return; await this.meter.setLevel(9); this.toast('METER 9/10 · THẮNG 1 LẦN NỮA ĐỂ FINAL SLASH'); this.menu.visible = false; }

  async startSpin() {
    if (this.busy) { if (this.phase === 'pay' && !this.queued) { this.queued = true; setHurry(true); } return; } // đang trả thưởng: tua nhanh rồi quay tiếp
    initAudio(); this.bigwin.finishCollect();
    if (!this.inFS && this.balance < this.bet && !this.forced) { this.toast('NOT ENOUGH BALANCE'); this.auto = false; this.bar.setAutoOff(); return; }
    this.busy = true; this.bar.setBusy(true); this.bar.setSpinning(true); this.phase = 'spin';
    this.reels.resetLook(); this.bar.setWin(0);
    if (!this.inFS && !this.forced) { this.balance -= this.bet; this.refresh(); }
    const f = this.forced; this.forced = null;
    let grid: Grid = f ? craftGrid(f) : makeGrid();
    if (this.fsLeft > 0 && !f) { /* trong free spins vẫn có thể ra thêm scatter */ }
    await this.reels.spin(grid);
    this.bar.setSpinning(false); this.phase = 'pay';
    const fixed = !!(f && f in FORCE_MULT); // kịch bản Big/Mega/Epic: 1 đợt cố định, không cascade
    let res = evaluate(grid, this.bet); let chain = 0, idx = this.inFS ? this.fsIdx : 0, anyWin = false, anyH5 = false, wilds = res.wilds;
    this.clearChip(); this.bigwin.winBase = 0;
    for (let guard = 0; guard < 12; guard++) {
      let total = fixed ? FORCE_MULT[f as string] * this.bet : res.total; if (total <= 0) break;
      anyWin = true; if (res.hasH5) anyH5 = true; wilds = Math.max(wilds, res.wilds);
      const mult = MULT_LADDER[Math.min(idx, MULT_LADDER.length - 1)]; if (mult > 1) total = Math.round(total * mult);
      if (mult >= 2) await this.setChip(mult);
      const cells = new Set<string>(); res.wins.forEach(w => w.cells.forEach(([c, r]) => cells.add(`${c},${r}`)));
      let groups: { cells: [number, number][]; pay: number }[] | undefined;
      if (res.total > 0 && res.wins.length) { // chia điểm theo từng nhóm thắng (đã nhân hệ số)
        let acc = 0; groups = res.wins.map((w, i) => { const pay = i === res.wins.length - 1 ? total - acc : Math.round(w.pay * total / res.total); acc += pay; return { cells: w.cells, pay }; });
      }
      this.bigwin.winBase = chain;
      await this.bigwin.present(total, this.bet, cells, tierOf(total, this.bet), undefined, groups);
      chain += total; idx++; if (this.inFS) { this.fsTotal += total; this.fsIdx = Math.min(idx, MULT_LADDER.length - 1); }
      if (fixed) break;
      const pay = this.bigwin.payout;
      await this.reels.cascade(cells, c => this.refill(c), (x, y) => pay.particles.burst([pay.sparkTex], x, y, 5, { speed: 600, spread: Math.PI * 2, g: 900, size: 14, life: 0.45, blend: 'add', tint: 0xffb070 }));
      res = evaluate(this.reels.grid, this.bet); wilds = Math.max(wilds, res.wilds);
    }
    this.bigwin.winBase = 0; this.bigwin.collect(chain); this.history.push({ t: Date.now(), bet: this.inFS ? 0 : this.bet, win: chain }); if (this.history.length > 40) this.history.shift();
    // meter (cộng một lần cho cả chuỗi)
    { let add = anyWin ? 1 : 0; if (anyH5) add += 1; if (wilds > 0) add += 1;
      if (add > 0) await this.meter.setLevel(this.meter.level + add); }
    // free spins
    if (res.scatters >= 3) await this.startFS(res.scatters, res.scatterCells);
    // final slash
    if (this.meter.level >= 10) {
      this.meter.charged(); await wait(1.1);
      const prize = 100 * this.bet;
      await this.bigwin.finalSlash(prize, this.bet, this.finalCb()); this.bigwin.collect(prize);
    }
    if (this.inFS) { this.fsLeft--; this.updateHud(); if (this.fsLeft <= 0) await this.endFS(); }
    this.busy = false; this.bar.setBusy(false); this.phase = 'idle';
    if (this.queued) { this.queued = false; setHurry(false); this.startSpin(); return; }
    if (this.inFS) { await wait(0.5); this.startSpin(); }
    else if (this.auto) { await wait(0.6); if (this.auto) this.startSpin(); }
  }

  async chipSlash() {
    const x = this.chip.x, y = this.chip.y, pay = this.bigwin.payout; sfx.slashHeavy(); sfx.multiplier();
    await pay.slash(x - 170, y + 100, x + 170, y - 100, 38, 0.45, 18, 0.09);
    pay.particles.burst([pay.sparkTex], x, y, 16, { speed: 800, spread: Math.PI * 2, g: 900, size: 16, life: 0.5, blend: 'add', tint: 0xffb070 });
    pay.particles.burst(this.bigwin.blood, x, y, 6, { speed: 560, spread: Math.PI * 2, g: 1000, size: 46, life: 0.7 });
    gsap.fromTo(this.chip, { x: x + 16 }, { x, duration: 0.45, ease: 'elastic.out(1,0.35)' }); await wait(0.12);
  }
  updateHud() { this.hud.text = this.inFS ? `FREE SPINS ${this.fsLeft}` : ''; }
  refill(c: number) { let s: number; do { s = randSym(c); } while (s === SYM.SCATTER); return s; }
  clearChip() { this.chipFade?.kill(); gsap.killTweensOf(this.chip); this.chipM = 0; this.chip.alpha = 0; }
  get baseMult() { return this.streak >= 2 ? MULT_LADDER[Math.min(this.streak - 1, MULT_LADDER.length - 1)] : 1; }
  chipFade?: gsap.core.Tween;
  async setChip(m: number) {
    m = m >= 2 ? m : 0;
    if (m === this.chipM) { if (m) { this.chipFade?.kill(); this.chip.alpha = 1; this.chipFade = gsap.to(this.chip, { alpha: 0, duration: 0.9, delay: 1.5 }); } return; }
    const was = this.chipM; this.chipM = m; this.chipFade?.kill(); gsap.killTweensOf(this.chip);
    if (was) { // hệ số cũ hiện lại ở giữa khung rồi bị chém
      const t0 = tex('mult_' + was); this.chip.texture = t0; this.chip.scale.set(CHIP_W / t0.width); this.chip.alpha = 1; await this.chipSlash();
    }
    if (!m) { gsap.to(this.chip, { alpha: 0, duration: 0.25 }); return; }
    const t = tex('mult_' + m); this.chip.texture = t; this.chip.scale.set(CHIP_W / t.width); this.chip.alpha = 1;
    gsap.fromTo(this.chip.scale, { x: this.chip.scale.x * 1.6, y: this.chip.scale.y * 1.6 }, { x: CHIP_W / t.width, y: CHIP_W / t.width, duration: 0.45, ease: 'back.out(2.5)' }); this.bigwin.flash(0.35, 0.25);
    this.chipFade = gsap.to(this.chip, { alpha: 0, duration: 0.9, delay: 1.5 }); // hiện rồi mờ dần, không che symbol
  }
  async banner(text: string, sub = '', hold = 1.6) {
    const c = new Container(); const g = new Graphics(); g.poly([-3000, 377, W + 3000, 253, W + 3000, 593, -3000, 717]).fill({ color: 0x000000, alpha: 0.82 }); c.addChild(g);
    const t = new Text({ text, style: { fontFamily: 'Bangers', fontSize: 190, fill: 0xf2f2f0, stroke: { color: 0xe8261b, width: 18, join: 'round' }, letterSpacing: 6 } });
    t.anchor.set(0.5); t.position.set(W / 2, 450); t.rotation = -4 * Math.PI / 180; c.addChild(t);
    const s = new Text({ text: sub, style: { fontFamily: 'Bangers', fontSize: 80, fill: 0xf5b82e, stroke: { color: 0x000000, width: 10, join: 'round' }, letterSpacing: 4 } });
    s.anchor.set(0.5); s.position.set(W / 2, 580); s.rotation = -4 * Math.PI / 180; c.addChild(s);
    c.alpha = 0; this.root.addChild(c); sfx.fanfare(); this.bigwin.flash(0.6, 0.4);
    gsap.fromTo(t.scale, { x: 2.2, y: 2.2 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(2)' });
    await tw(c, { alpha: 1, duration: 0.2 }); await wait(hold); await tw(c, { alpha: 0, duration: 0.3 }); c.destroy({ children: true });
  }
  async startFS(n: number, cells: [number, number][]) {
    this.reels.highlight(new Set(cells.map(([c, r]) => `${c},${r}`)), true); sfx.win(); await wait(1.0); this.reels.resetLook();
    { const pay = this.bigwin.payout;
      await pay.chain([...cells].sort((a, b) => a[0] - b[0]).map(([c, r]) => this.reels.cellCenter(c, r)));
      await this.reels.cascade(new Set(cells.map(([c, r]) => `${c},${r}`)), c => this.refill(c), (x, y) => pay.particles.burst([pay.sparkTex], x, y, 8, { speed: 700, spread: Math.PI * 2, g: 900, size: 16, life: 0.5, blend: 'add', tint: 0xffb070 })); }
    const spins = SCATTER_SPINS[Math.min(5, n)]; const retrig = this.inFS;
    this.fsLeft += spins; if (!retrig) { this.inFS = true; this.fsTotal = 0; this.fsIdx = Math.max(1, Math.min(3, n - 2)); gsap.to(this.bgBonus, { alpha: 1, duration: 0.8 }); }
    this.updateHud(); sfx.bannerFS(); if (!retrig) music.play('freespins'); await this.banner(retrig ? 'RETRIGGER' : 'FREE SPINS', `+${spins} SPINS · START x${this.fsMult}`);
  }
  async endFS() {
    this.inFS = false; const tot = this.fsTotal; this.fsIdx = 0; this.clearChip();
    gsap.to(this.bgBonus, { alpha: 0, duration: 0.8 }); this.hud.text = '';
    music.play('game'); sfx.fanfare(); await this.banner('FREE SPINS WIN', fmt(tot), 2.0);
  }

  buildMenu() {
    const m = new Container(); m.visible = false; this.root.addChild(m); this.menu = m;
    const back = new Graphics(); back.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.7 }); back.eventMode = 'static'; back.on('pointerdown', () => { m.visible = false; }); m.addChild(back);
    const panel = new Graphics(); panel.poly([560, 150, 1380, 130, 1400, 850, 540, 870]).fill(0x14141a).stroke({ width: 10, color: 0xf2f2f0 }); panel.eventMode = 'static'; m.addChild(panel);
    const title = new Text({ text: 'DEMO MENU', style: { fontFamily: 'Bangers', fontSize: 74, fill: 0xe8261b, stroke: { color: 0x000000, width: 8, join: 'round' }, letterSpacing: 4 } });
    title.anchor.set(0.5); title.position.set(W / 2, 215); m.addChild(title);
    const items: [string, () => void][] = [
      ['FORCE BIG WIN  (22x)  [1]', () => this.force('big')], ['FORCE MEGA WIN  (64x)  [2]', () => this.force('mega')], ['FORCE EPIC WIN  (130x)  [3]', () => this.force('epic')],
      ['TRIGGER FREE SPINS  [4]', () => this.force('fs')], ['WILD DEMO', () => this.force('wild')], ['FILL REVENGE METER TO 9/10  [F]', () => this.fillMeter()], ['RESET BALANCE', () => { this.balance = START_BALANCE; this.refresh(); this.menu.visible = false; }],
    ];
    items.forEach(([label, fn], i) => {
      const y = 280 + i * 74; const b = new Graphics(); b.poly([600, y, 1320, y - 8, 1325, y + 62, 605, y + 70]).fill(0x24242c).stroke({ width: 4, color: 0xe8261b });
      b.eventMode = 'static'; b.cursor = 'pointer'; b.on('pointerdown', fn); b.on('pointerover', () => { b.tint = 0xffd0cc; }); b.on('pointerout', () => { b.tint = 0xffffff; }); m.addChild(b);
      const t = new Text({ text: label, style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 34, fill: 0xf2f2f0, letterSpacing: 2 } }); t.anchor.set(0, 0.5); t.position.set(640, y + 31); t.eventMode = 'none'; m.addChild(t);
    });
    const foot = new Text({ text: 'Space = spin · all results are simulated for portfolio demo.\nWin tiers (fake): BIG 15x · MEGA 50x · EPIC 100x · Final Slash = 100x', style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 24, fill: 0xb9b9b9, align: 'center', letterSpacing: 1 } });
    foot.anchor.set(0.5); foot.position.set(W / 2, 822); foot.eventMode = 'none'; m.addChild(foot);
  }
}
