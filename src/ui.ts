import gsap from 'gsap';
import { Container, Sprite, Text, Graphics, Rectangle, Texture } from 'pixi.js';
import { W, BETS } from './config';
import { tex } from './assets';
import { sfx, setMuted, isMuted, initAudio } from './audio';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
// Nhãn nhỏ dùng font graffiti (marker), số dùng font condensed dễ đọc
const lab = (t: string, size = 24) => { const x = new Text({ text: t, style: { fontFamily: 'Permanent Marker', fontSize: size, fill: 0xc9c9c4, letterSpacing: 2, stroke: { color: 0x000000, width: 4, join: 'round' } } }); x.anchor.set(0.5); x.eventMode = 'none'; return x; };
const val = (size: number, color = 0xf2f2f0) => { const x = new Text({ text: '0', style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: size, fill: color, stroke: { color: color === 0xffd23f ? 0x8a2a00 : 0x000000, width: 5, join: 'round' }, dropShadow: color === 0xffd23f ? { color: 0xff5a1f, alpha: 0.9, blur: 8, distance: 0 } : undefined } }); x.anchor.set(0.5); x.eventMode = 'none'; return x; };

// Toạ độ bố cục tính theo pixel của ảnh thanh nền (1352 x 276); toàn bộ được scale bằng S
const BAR_W = 1352, BAR_H = 276, S = 0.835, BAR_Y = 843, CY = 140;
const PLATE_CORE = { w: 626, h: 123 }; // vùng lõi của ảnh nút chữ nhật (ảnh 670x167 có viền glow)

let glowTex: Texture | null = null;
function glow(): Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, 'rgba(255,90,30,0.85)'); gr.addColorStop(0.55, 'rgba(232,38,27,0.35)'); gr.addColorStop(1, 'rgba(232,38,27,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return (glowTex = Texture.from(c));
}

export class ControlBar extends Container {
  onSpin = () => {}; onBet = (_d: number) => {}; onAuto = (_on: boolean) => {}; onMenu = () => {}; onStop = () => {}; onTurbo = (_on: boolean) => {}; onBetOpen = () => {};
  balanceT = val(54); betT = val(54); winT = val(62, 0xffd23f);
  private btns: Record<string, Sprite> = {};
  private spinning = false; busy = false; autoOn = false; turboOn = false;
  private spin!: Sprite; private halo!: Sprite; private spinK = 0.54;
  private inner = new Container();
  readonly bw = BAR_W * S;

  constructor() {
    super();
    this.addChild(this.inner); this.inner.scale.set(S);
    this.x = (W - this.bw) / 2; this.y = BAR_Y;
    const bar = new Sprite(tex('bar')); this.inner.addChild(bar);

    // ---------- ô hiển thị ----------
    const well = (x0: number, x1: number, hi = false, h = 120) => {
      const g = new Graphics(); const y0 = CY - h / 2;
      g.roundRect(x0, y0, x1 - x0, h, 12).fill(0x07070b).stroke({ width: 7, color: 0x000000 });
      g.roundRect(x0 + 3, y0 + 3, x1 - x0 - 6, h - 6, 10).stroke({ width: hi ? 5 : 3, color: 0xe8261b, alpha: hi ? 1 : 0.85 });
      g.roundRect(x0 + 9, y0 + 9, x1 - x0 - 18, 18, 8).fill({ color: 0xffffff, alpha: 0.04 });
      this.inner.addChild(g); return g;
    };
    const put = (x: number, label: string, v: Text, dy = 18, ly = -34) => { const l = lab(label); l.position.set(x, CY + ly); v.position.set(x, CY + dy); this.inner.addChild(l, v); };
    well(192, 362); put(277, 'BALANCE', this.balanceT);
    const betWell = well(456, 606); put(531, 'BET', this.betT);
    well(700, 922, true); put(811, 'WIN', this.winT, 22);
    // bấm vào ô BET để chọn mức cược
    betWell.hitArea = new Rectangle(456, CY - 60, 150, 120); betWell.eventMode = 'static'; betWell.cursor = 'pointer'; betWell.on('pointerdown', () => { if (this.busy) return; initAudio(); sfx.click(); this.onBetOpen(); });
    betWell.on('pointerover', () => { if (!this.busy) betWell.tint = 0xffc8c0; }); betWell.on('pointerout', () => { betWell.tint = 0xffffff; });

    // ---------- nút ----------
    const press = (s: Sprite, k: number, cb: () => void) => {
      s.eventMode = 'static'; s.cursor = 'pointer';
      const tw = s.texture.width, th = s.texture.height; s.hitArea = new Rectangle(-tw / 2 * 1.04, -th / 2 * 1.12, tw * 1.04, th * 1.12);
      const kx = s.scale.x, ky = s.scale.y;
      s.on('pointerdown', () => { if ((s as any).disabled) return; initAudio(); sfx.click(); gsap.to(s.scale, { x: kx * 0.94, y: ky * 0.94, duration: 0.07 }); cb(); });
      const up = () => gsap.to(s.scale, { x: kx, y: ky, duration: 0.14, ease: 'back.out(3)' });
      s.on('pointerup', up); s.on('pointerupoutside', up);
      s.on('pointerover', () => { if (!(s as any).disabled) s.tint = 0xffe6e0; }); s.on('pointerout', () => { s.tint = (s as any).disabled ? 0x777777 : 0xffffff; });
    };
    // nút chữ nhật (MENU / SOUND / AUTO / TURBO): giữ nguyên tỉ lệ ngang, kéo cao nhẹ để dễ bấm
    const plate = (key: string, cx: number, cy: number, coreW: number, coreH: number, cb: () => void) => {
      const s = new Sprite(tex('btn_' + key)); s.anchor.set(0.5); s.position.set(cx, cy);
      s.scale.set(coreW / PLATE_CORE.w, coreH / PLATE_CORE.h); this.inner.addChild(s); this.btns[key] = s; press(s, 1, cb);
    };
    const LX = 108, RX = 1010, PW = 156, PH = 62, DY = 38;
    plate('menu', LX, CY - DY, PW, PH, () => this.onMenu());
    plate('sound', LX, CY + DY, PW, PH, () => { const m = !isMuted(); setMuted(m); this.setTex('sound', m); });
    plate('auto', RX, CY - DY, PW, PH, () => { this.autoOn = !this.autoOn; this.setTex('auto', this.autoOn); this.onAuto(this.autoOn); });
    plate('turbo', RX, CY + DY, PW, PH, () => { this.turboOn = !this.turboOn; this.setTex('turbo', this.turboOn); this.onTurbo(this.turboOn); });
    const sq = (key: string, texKey: string, cx: number, d: number, cb: () => void) => {
      const s = new Sprite(tex(texKey)); s.anchor.set(0.5); s.position.set(cx, CY); s.scale.set(d / 124); this.inner.addChild(s); this.btns[key] = s; press(s, 1, cb);
    };
    sq('minus', 'btn_bet_minus', 412, 88, () => this.onBet(-1));
    sq('plus', 'btn_bet_plus', 650, 88, () => this.onBet(1));

    // ---------- nút SPIN lớn ----------
    const sc = new Container(); sc.position.set(1200, 138); this.inner.addChild(sc);
    this.halo = new Sprite(glow()); this.halo.anchor.set(0.5); this.halo.blendMode = 'add'; this.halo.eventMode = 'none'; this.halo.width = this.halo.height = 460; sc.addChild(this.halo);
    this.spin = new Sprite(tex('btn_spin')); this.spin.anchor.set(0.5); this.spin.scale.set(this.spinK); sc.addChild(this.spin);
    this.spin.eventMode = 'static'; this.spin.cursor = 'pointer'; this.spin.hitArea = new Rectangle(-215, -215, 430, 430);
    this.spin.on('pointerdown', () => { initAudio(); sfx.click(); gsap.to(this.spin.scale, { x: this.spinK * 0.93, y: this.spinK * 0.93, duration: 0.07 }); if (this.spinning) this.onStop(); else this.onSpin(); });
    const up = () => gsap.to(this.spin.scale, { x: this.spinK, y: this.spinK, duration: 0.16, ease: 'back.out(3)' });
    this.spin.on('pointerup', up); this.spin.on('pointerupoutside', up);
    this.idle();
    this.setBet(0);
  }
  private idleTw?: gsap.core.Tween;
  private idle() {
    this.idleTw?.kill(); this.halo.visible = true; this.halo.alpha = 0.55;
    this.idleTw = gsap.to(this.halo, { alpha: 1, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }
  private setTex(key: string, on: boolean) {
    const s = this.btns[key]; s.texture = tex(on ? `btn_${key}_on` : `btn_${key}`);
  }
  setBalance(n: number) { this.balanceT.text = fmt(n); }
  setBet(i: number) { this.betT.text = fmt(BETS[i]); }
  setWin(n: number) { this.winT.text = fmt(n); }
  bounceBalance() { gsap.fromTo(this.balanceT.scale, { x: 1.22, y: 1.22 }, { x: 1, y: 1, duration: 0.2, ease: 'power2.out', overwrite: true }); }
  bounceWin() { gsap.fromTo(this.winT.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(3)' }); }
  setBusy(b: boolean) {
    this.busy = b;
    for (const k of ['plus', 'minus', 'menu']) { const s = this.btns[k]; (s as any).disabled = b; s.tint = b ? 0x777777 : 0xffffff; s.alpha = b ? 0.6 : 1; }
  }
  setSpinning(on: boolean) {
    this.spinning = on; this.spin.texture = tex(on ? 'btn_spin_down' : 'btn_spin');
    if (on) { this.idleTw?.kill(); gsap.to(this.halo, { alpha: 0, duration: 0.2 }); } else this.idle();
  }
  setAutoOff() { this.autoOn = false; this.setTex('auto', false); }
}
