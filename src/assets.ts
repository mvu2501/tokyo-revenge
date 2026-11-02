import { Assets, Texture, Graphics, Text, Container, Application } from 'pixi.js';
import { SYM_KEYS } from './config';

const A = 'assets/';
export const MANIFEST: Record<string, string> = {
  ...Object.fromEntries(SYM_KEYS.map(k => ['sym_' + k, `${A}sym/${k}.png`])),
  sym_WILD: `${A}sym/WILD.png`, sym_SCATTER: `${A}sym/SCATTER.png`,
  ...Object.fromEntries([2, 3, 5, 8, 10].map(n => ['mult_' + n, `${A}ui/mult_${n}.png`])),
  logo: `${A}ui/logo.png`, frame: `${A}ui/reel_frame.png`, bar: `${A}ui/control_bar.png`,
  btn_spin: `${A}ui/btn_spin.png`, btn_spin_down: `${A}ui/btn_spin_down.png`,
  ...Object.fromEntries(['menu', 'auto', 'sound', 'turbo'].flatMap(k => [['btn_' + k, `${A}ui/btn_${k}.png`], ['btn_' + k + '_on', `${A}ui/btn_${k}_on.png`]])),
  btn_bet_minus: `${A}ui/btn_bet_minus.png`, btn_bet_plus: `${A}ui/btn_bet_plus.png`,
  meter_empty: `${A}ui/meter_empty.png`, meter_full: `${A}ui/meter_full.png`,
  hero: `${A}ui/hero.png`, bg_base: `${A}bg/base.jpg`, intro_bg: `${A}bg/intro.jpg`, bg_bonus: `${A}bg/bonus.jpg`,
  fx_smoke: `${A}fx/smoke_br.png`,
  fx_slash: `${A}fx/slash.jpg`, fx_cutin: `${A}fx/finalslash.jpg`,
};

export async function loadAll(onProgress: (p: number) => void) {
  for (const [k, src] of Object.entries(MANIFEST)) Assets.add({ alias: k, src });
  await Assets.load(Object.keys(MANIFEST), onProgress);
  await document.fonts.load('64px Bangers'); await document.fonts.load('30px "Permanent Marker"');
  await document.fonts.load('700 24px "Barlow Condensed"');
}
export const tex = (k: string): Texture => Assets.get(k) as Texture;

// Wild và Scatter chưa có artwork: vẽ tạm bằng code (THAY BẰNG ẢNH THẬT KHI RENDER XONG)
export function makePlaceholder(app: Application, kind: 'WILD' | 'SCATTER'): Texture {
  const c = new Container();
  const g = new Graphics();
  if (kind === 'WILD') {
    g.poly([192, 8, 378, 192, 192, 376, 6, 192]).fill(0x0b0b10).stroke({ width: 18, color: 0xff2e93 });
    g.poly([192, 40, 346, 192, 192, 344, 38, 192]).stroke({ width: 8, color: 0x19e3ff });
    g.poly([212, 70, 150, 200, 196, 200, 168, 318, 250, 168, 202, 168]).fill({ color: 0xb8ff00, alpha: 0.9 });
    c.addChild(g);
    const t = new Text({ text: 'WILD', style: { fontFamily: 'Bangers', fontSize: 120, fill: 0xffffff, stroke: { color: 0xff2e93, width: 16, join: 'round' }, letterSpacing: 2 } });
    t.anchor.set(0.5); t.position.set(192, 196); t.rotation = -0.08; c.addChild(t);
  } else {
    g.circle(192, 192, 176).fill(0x0b0b10).stroke({ width: 18, color: 0xf5b82e });
    g.circle(192, 192, 146).stroke({ width: 8, color: 0xff5a1f });
    c.addChild(g);
    const t = new Text({ text: 'FREE', style: { fontFamily: 'Bangers', fontSize: 104, fill: 0xf5b82e, stroke: { color: 0x000000, width: 12, join: 'round' } } });
    t.anchor.set(0.5); t.position.set(192, 148); c.addChild(t);
    const t2 = new Text({ text: 'SPINS', style: { fontFamily: 'Bangers', fontSize: 92, fill: 0xffffff, stroke: { color: 0xff5a1f, width: 12, join: 'round' } } });
    t2.anchor.set(0.5); t2.position.set(192, 246); c.addChild(t2);
  }
  const rt = app.renderer.generateTexture({ target: c, resolution: 1, frame: undefined as any });
  c.destroy({ children: true });
  return rt;
}

export function radialVignette(color = '#e8261b'): Texture {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288;
  const x = cv.getContext('2d')!; const g = x.createRadialGradient(256, 144, 90, 256, 144, 330);
  g.addColorStop(0, 'rgba(232,38,27,0)'); g.addColorStop(0.55, 'rgba(232,38,27,0.15)'); g.addColorStop(1, color);
  x.fillStyle = g; x.fillRect(0, 0, 512, 288); return Texture.from(cv);
}

// Mực/máu văng vẽ bằng canvas (placeholder cho sprite W2a khi bạn render xong)
export function makeBloodTextures(n = 6): Texture[] {
  const out: Texture[] = [];
  for (let k = 0; k < n; k++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d')!;
    x.translate(64, 64); x.fillStyle = k % 3 === 0 ? '#9e1510' : '#e8261b';
    x.beginPath(); const spikes = 9 + (k % 5) * 2;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2; const r = i % 2 ? 16 + Math.random() * 14 : 32 + Math.random() * 28;
      const px = Math.cos(a) * r, py = Math.sin(a) * r; if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.closePath(); x.fill();
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, 2 + Math.random() * 5, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.arc(-8, -10, 6, 0, 7); x.fill();
    out.push(Texture.from(cv));
  }
  return out;
}
