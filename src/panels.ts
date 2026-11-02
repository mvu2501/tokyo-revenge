import gsap from 'gsap';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { W, H, BETS, PAY, SYM_KEYS, TIERS } from './config';
import { tex } from './assets';
import { sfx } from './audio';

export interface HistoryRow { t: number; bet: number; win: number }
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const FONT_T = { fontFamily: 'Bangers', fill: 0xf2f2f0, stroke: { color: 0xe8261b, width: 10, join: 'round' as const }, letterSpacing: 4 };
const body = (size = 30, fill = 0xe6e6e2) => ({ fontFamily: 'Barlow Condensed', fontWeight: '700' as const, fontSize: size, fill, letterSpacing: 1 });

/** Các bảng của người chơi: Menu, Luật chơi, Trả thưởng, Lịch sử cược, Chọn mức cược. Vẽ cùng phong cách khung game (thép xám + viền đỏ + sọc cảnh báo). */
export class Panels extends Container {
  onQuit = () => {}; onDemo = () => {}; onPickBet = (_i: number) => {};
  getHistory: () => HistoryRow[] = () => []; getBetIdx = () => 0;
  private content = new Container();

  constructor() {
    super(); this.visible = false;
    document.fonts.load('700 24px "Barlow Condensed"', 'ưỡạẾỆƠ').catch(() => {}); document.fonts.load('40px Bangers', 'ưỡạẾỆƠ').catch(() => {});
    this.addChild(this.content);
  }
  close() { this.visible = false; this.content.removeChildren().forEach(c => c.destroy({ children: true })); }

  private shell(title: string, w: number, h: number, back?: () => void) {
    this.content.removeChildren().forEach(c => c.destroy({ children: true })); this.visible = true;
    const dim = new Graphics(); dim.rect(-2000, -1200, W + 4000, H + 2400).fill({ color: 0x000000, alpha: 0.74 }); dim.eventMode = 'static'; dim.on('pointerdown', () => this.close()); this.content.addChild(dim);
    const p = new Container(); p.position.set(W / 2, H / 2 - 20); this.content.addChild(p);
    const g = new Graphics(); const x = -w / 2, y = -h / 2;
    g.roundRect(x - 8, y - 8, w + 16, h + 16, 22).fill(0x000000);
    g.roundRect(x, y, w, h, 16).fill(0x2c2d33).stroke({ width: 6, color: 0xe8261b });
    g.roundRect(x + 16, y + 16, w - 32, h - 32, 10).fill(0x15151b).stroke({ width: 3, color: 0x050507 });
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // sọc cảnh báo ở 4 góc
      const cx = sx * (w / 2 - 4), cy = sy * (h / 2 - 4);
      g.poly([cx, cy, cx - sx * 70, cy, cx, cy - sy * 70]).fill(0xe8261b);
      g.poly([cx - sx * 20, cy, cx - sx * 38, cy, cx, cy - sy * 38, cx, cy - sy * 20]).fill(0x0a0a0d);
    }
    g.eventMode = 'static'; p.addChild(g);
    const t = new Text({ text: title, style: { ...FONT_T, fontSize: 74 } }); t.anchor.set(0.5); t.position.set(0, y + 78); t.rotation = -0.03; p.addChild(t);
    const x1 = this.button('✕', 70, 62, 0, 0, () => this.close(), true); x1.position.set(w / 2 - 70, y + 62); p.addChild(x1);
    if (back) { const b = this.button('<', 70, 62, 0, 0, back, true); b.position.set(x + 70, y + 62); p.addChild(b); }
    p.scale.set(0.9); p.alpha = 0; gsap.to(p, { alpha: 1, duration: 0.14 }); gsap.to(p.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(2)' });
    return { p, x, y };
  }
  private button(label: string, w: number, h: number, cx: number, cy: number, cb: () => void, small = false, red = false) {
    const c = new Container(); c.position.set(cx, cy); c.eventMode = 'static'; c.cursor = 'pointer';
    const g = new Graphics(); g.roundRect(-w / 2, -h / 2, w, h, 12).fill(red ? 0x6d120f : 0x26272d).stroke({ width: 5, color: 0x000000 });
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 10).stroke({ width: 3, color: 0xe8261b });
    c.addChild(g);
    if (label === '✕' || label === '<') { // biểu tượng vẽ bằng nét, căn giữa tuyệt đối trong nút
      const ic = new Graphics(); const pts: number[][] = label === '✕' ? [[-13, -13, 13, 13], [13, -13, -13, 13]] : [[6, -15, -8, 0], [-8, 0, 6, 15]];
      for (const [col, wd] of [[0x000000, 14], [0xf2f2f0, 7]] as const) for (const [x0, y0, x1, y1] of pts) ic.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: wd, color: col, cap: 'round', join: 'round' });
      ic.eventMode = 'none'; c.addChild(ic);
    } else {
      const t = new Text({ text: label, style: { fontFamily: 'Bangers', fontSize: small ? 40 : 46, fill: 0xf2f2f0, stroke: { color: 0x000000, width: 7, join: 'round' }, letterSpacing: 3 } }); t.anchor.set(0.5); t.eventMode = 'none'; c.addChild(t);
    }
    c.on('pointerover', () => { c.tint = 0xffd8d2; }); c.on('pointerout', () => { c.tint = 0xffffff; });
    c.on('pointerdown', e => { e.stopPropagation(); sfx.click(); cb(); });
    return c;
  }

  // ---------- MENU ----------
  menu() {
    const { p, y } = this.shell('MENU', 620, 590);
    const items: [string, () => void, boolean][] = [
      ['RULES', () => this.rules(), false], ['PAYTABLE', () => this.pay(), false], ['BET HISTORY', () => this.history(), false],
      ['QUIT GAME', () => { this.close(); this.onQuit(); }, true],
    ];
    items.forEach(([l, cb, red], i) => p.addChild(this.button(l, 460, 86, 0, y + 190 + i * 100, cb, false, red)));
  }

  // ---------- LUẬT CHƠI ----------
  rules() {
    const { p, x, y } = this.shell('RULES', 1180, 820, () => this.menu());
    const rows: [string, string][] = [
      ['5x4 GRID · 1,024 WAYS', 'Match symbols from the left reel to the right, at least 3 reels in a row. Wins are paid per way.'],
      ['WILD', 'Appears on reels 2, 3 and 4. Substitutes for every symbol except SCATTER.'],
      ['SLASH CASCADE', 'Winning symbols are slashed away and new symbols fall in. Every consecutive win within the same spin raises the multiplier: 2x, 3x, 5x, 8x, 10x.'],
      ['SCATTER · FREE SPINS', '3 Scatters award 5 free spins, 4 or more award 8. During Free Spins the multiplier keeps climbing and never resets.'],
      ['REVENGE METER', 'Each winning spin, Wild or H5 symbol charges the meter. At 10/10 it triggers the FINAL SLASH, worth 100x your bet.'],
      ['BIG / MEGA / EPIC', `Wins of ${TIERS.big}x, ${TIERS.mega}x and ${TIERS.epic}x your bet trigger the matching celebration.`],
    ];
    let yy = y + 150;
    for (const [h, d] of rows) {
      const th = new Text({ text: h, style: { fontFamily: 'Bangers', fontSize: 38, fill: 0xf5b82e, stroke: { color: 0x000000, width: 6, join: 'round' }, letterSpacing: 3 } }); th.position.set(x + 60, yy); p.addChild(th);
      const td = new Text({ text: d, style: { ...body(26), wordWrap: true, wordWrapWidth: 1040 } }); td.position.set(x + 60, yy + 44); p.addChild(td);
      yy += 42 + td.height + 18;
    }
  }

  // ---------- TRẢ THƯỞNG ----------
  pay() {
    const { p, x, y } = this.shell('PAYTABLE', 1180, 790, () => this.menu());
    const bet = BETS[this.getBetIdx()];
    const sub = new Text({ text: `Current bet ${fmt(bet)} · payout per WAY by number of reels in a row`, style: body(24, 0xb9b9b9) }); sub.anchor.set(0.5); sub.position.set(0, y + 138); p.addChild(sub);
    const head = (cx: number) => ['3', '4', '5'].forEach((n, i) => { const t = new Text({ text: `${n} reels`, style: body(22, 0xe8261b) }); t.anchor.set(0.5); t.position.set(cx + 110 + i * 120, y + 176); p.addChild(t); });
    head(x + 50); head(x + 50 + 540);
    // thứ tự từ cao xuống thấp
    const order = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    order.forEach((s, i) => {
      const col = i < 5 ? 0 : 1, row = i % 5; const cx = x + 50 + col * 540, cy = y + 250 + row * 100;
      const row_ = new Graphics(); row_.roundRect(cx - 6, cy - 44, 520, 88, 10).fill({ color: 0x000000, alpha: 0.35 }); p.addChild(row_);
      const sp = new Sprite(tex('sym_' + SYM_KEYS[s])); sp.anchor.set(0.5); sp.scale.set(78 / sp.texture.width * (sp.texture.width > 300 ? 1 : 1)); sp.position.set(cx + 42, cy); p.addChild(sp);
      PAY[s].forEach((m, j) => { const t = new Text({ text: fmt(m * bet), style: { ...body(34, 0xf2f2f0) } }); t.anchor.set(0.5); t.position.set(cx + 110 + j * 120, cy); p.addChild(t); });
    });
  }

  // ---------- LỊCH SỬ CƯỢC ----------
  history() {
    const { p, x, y } = this.shell('BET HISTORY', 1000, 780, () => this.menu());
    const cols = [x + 120, x + 400, x + 660, x + 880]; ['TIME', 'BET', 'WIN', 'MULTI'].forEach((h, i) => { const t = new Text({ text: h, style: body(26, 0xe8261b) }); t.anchor.set(0.5); t.position.set(cols[i], y + 150); p.addChild(t); });
    const rows = this.getHistory().slice(-10).reverse();
    if (!rows.length) { const t = new Text({ text: 'No spins yet', style: body(36, 0x8a8a90) }); t.anchor.set(0.5); t.position.set(0, y + 380); p.addChild(t); return; }
    rows.forEach((r, i) => {
      const cy = y + 205 + i * 50; if (i % 2 === 0) { const bg = new Graphics(); bg.rect(x + 40, cy - 22, 920, 44).fill({ color: 0xffffff, alpha: 0.05 }); p.addChild(bg); }
      const d = new Date(r.t); const tm = [d.getHours(), d.getMinutes(), d.getSeconds()].map(v => String(v).padStart(2, '0')).join(':');
      const vals = [tm, r.bet ? fmt(r.bet) : 'FREE', fmt(r.win), r.bet ? (r.win / r.bet).toFixed(1) + 'x' : '-'];
      vals.forEach((v, j) => { const t = new Text({ text: v, style: body(30, j === 2 && r.win > 0 ? 0xf5b82e : 0xe6e6e2) }); t.anchor.set(0.5); t.position.set(cols[j], cy); p.addChild(t); });
    });
  }

  // ---------- CHỌN MỨC CƯỢC ----------
  betPicker() {
    const { p, y } = this.shell('BET LEVEL', 860, 480);
    const cur = this.getBetIdx();
    BETS.forEach((b, i) => {
      const cx = ((i % 3) - 1) * 250, cy = y + 215 + Math.floor(i / 3) * 120;
      const c = this.button(fmt(b), 220, 100, cx, cy, () => { this.onPickBet(i); this.close(); });
      if (i === cur) { const ring = new Graphics(); ring.roundRect(-118, -56, 236, 112, 16).stroke({ width: 6, color: 0xf5b82e }); c.addChild(ring); }
      p.addChild(c);
    });
  }
}
