import '@fontsource/bangers';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/permanent-marker';
import gsap from 'gsap';
import { Application, Sprite, Text, Graphics, Container, ColorMatrixFilter, Texture, VideoSource } from 'pixi.js';
import { W, H } from './config';
import { loadAll, tex } from './assets';
import { Game } from './game';
import { initAudio, sfx, music } from './audio';
import { wait, tw } from './fx';

gsap.ticker.lagSmoothing(0); (window as any).gsap = gsap;
const wrap = document.getElementById('wrap') as HTMLDivElement;
const video = document.getElementById('bgvideo') as HTMLVideoElement;
const side = document.getElementById('side') as HTMLDivElement;
type SceneName = 'loading' | 'intro' | 'game' | 'bigwin' | 'jackpot' | 'scatter' | 'wild';

async function boot() {
  await Promise.all(['700 40px Bangers', '700 20px "Barlow Condensed"'].map(f => document.fonts.load(f))).catch(() => {});
  const app = new Application();
  await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
  wrap.appendChild(app.canvas); (window as any).__app = app;
  app.stage.eventMode = 'static'; app.stage.hitArea = { contains: () => true } as any;
  const scaler = new Container(); app.stage.addChild(scaler);
  let game: Game | undefined; let vwD = W, vhD = H; let introLayout: (() => void) | undefined;
  const fit = () => {
    const vw = innerWidth, vh = innerHeight, s = Math.min(vw / W, vh / H);
    scaler.scale.set(s); scaler.position.set((vw - W * s) / 2, (vh - H * s) / 2);
    vwD = vw / s; vhD = vh / s; game?.layoutBg(vw / s, vh / s); introLayout?.();
  };
  addEventListener('resize', fit); fit();
  video.src = 'assets/video/loading.mp4'; video.poster = 'assets/bg/loading_poster.jpg'; video.play().catch(() => {});

  // ---------- LOADING ----------
  const load = new Container(); scaler.addChild(load);
  const barBg = new Graphics(), barFill = new Graphics(); load.addChild(barBg, barFill);
  const drawBar = (p: number) => {
    barBg.clear(); barFill.clear(); const x0 = 560, y0 = 960, w = 800, h = 26, sl = 22;
    barBg.poly([x0, y0 + h, x0 + sl, y0, x0 + w + sl, y0, x0 + w, y0 + h]).fill({ color: 0x000000, alpha: 0.8 }).stroke({ width: 4, color: 0xf2f2f0 });
    const n = 20, gap = 4, sw = (w - gap * (n - 1)) / n;
    for (let i = 0; i < Math.floor(p * n); i++) { const sx = x0 + i * (sw + gap); barFill.poly([sx + 3, y0 + h - 4, sx + 3 + sl * 0.8, y0 + 4, sx + sw + 3 + sl * 0.8, y0 + 4, sx + sw - 2, y0 + h - 4]).fill(0xe8261b); }
  };
  drawBar(0);
  const status = new Text({ text: 'LOADING...', style: { fontFamily: 'Bangers', fontSize: 42, fill: 0xf2f2f0, stroke: { color: 0x000000, width: 8, join: 'round' }, letterSpacing: 4 } });
  status.anchor.set(0.5); status.position.set(W / 2, 925); load.addChild(status);

  let prog = 0; const t0 = performance.now();
  await loadAll(p => { prog = p; });
  const logo = new Sprite(tex('logo')); logo.anchor.set(1, 1); logo.height = 337.5; logo.scale.x = logo.scale.y; logo.position.set(W - 40, H - 30); load.addChild(logo);
  const logoK = logo.scale.x;

  // ---------- INTRO ----------
  // Bố cục: cảnh phố Shinjuku đủ màu (hero đỏ bên trái, boss lime bên phải). 3 ô thông tin là "cửa sổ" nhìn vào cùng cảnh đó nhưng đã chuyển xám.
  const intro = new Container(); intro.visible = false; scaler.addChild(intro);
  const shade = new Graphics(); shade.rect(-2000, -1200, W + 4000, H + 2400).fill(0x050507); intro.addChild(shade);
  const ibg = new Sprite(tex("intro_bg")); intro.addChild(ibg);
  const introSprites: Sprite[] = [ibg];
  // video nền intro: cùng một texture cho cảnh màu và cho các cửa sổ xám; ảnh tĩnh là hình dự phòng cho tới khi video sẵn sàng
  const iv = document.createElement('video'); iv.muted = true; iv.loop = true; iv.playsInline = true; iv.preload = 'auto'; iv.src = 'assets/video/intro.mp4';
  iv.addEventListener('canplay', () => { const src = new VideoSource({ resource: iv, autoPlay: false, loop: true, muted: true }); const vt = new Texture({ source: src }); for (const s of introSprites) s.texture = vt; introLayout?.(); }, { once: true });
  // nền intro phủ kín toàn chiều ngang (cover): các cửa sổ xám dùng cùng toạ độ nên vẫn liền mạch
  introLayout = () => { const k = Math.max(vwD / W, vhD / H); for (const sp of introSprites) { sp.anchor.set(0.5); sp.width = W * k; sp.height = H * k; sp.position.set(W / 2, H / 2); } };
  const ilogo = new Sprite(tex('logo')); ilogo.anchor.set(0.5, 0); ilogo.height = 340; ilogo.scale.x = ilogo.scale.y; ilogo.position.set(W / 2, 10); intro.addChild(ilogo);
  const cards: [string, string, number][] = [
    ['1,024 WAYS TO SLASH', 'Match symbols from the left across 5 reels. Wilds join the fight on reels 2, 3 and 4.', 0xe8261b],
    ['REVENGE METER', 'Every winning spin charges the blade. At 10 / 10 the FINAL SLASH is unleashed.', 0xf2f2f0],
    ['FREE SPINS', 'Land 3 scatters in one spin for 5 free spins (8 with 4+). The multiplier keeps rising.', 0xb8ff00],
  ];
  cards.forEach(([t, d, col], i) => {
    const w = 330, h = 410, sk = 24, gap = 34, x = (W - (3 * w + 2 * gap)) / 2 + i * (w + gap) - sk / 2, y = 390; const c = new Container(); intro.addChild(c);
    const poly = [x + sk, y, x + w + sk, y, x + w, y + h, x, y + h];
    // nền xám: cùng bức tranh nền, tắt màu, tối đi, giữ nguyên toạ độ nên liền mạch với cảnh bên ngoài
    const gs = new Sprite(ibg.texture); introSprites.push(gs); const cm = new ColorMatrixFilter(); cm.greyscale(0.42, false); gs.filters = [cm]; c.addChild(gs); introLayout!();
    const mk = new Graphics(); mk.poly(poly).fill(0xffffff); c.addChild(mk); gs.mask = mk;
    const dark = new Graphics(); dark.poly(poly).fill({ color: 0x000000, alpha: 0.78 }); c.addChild(dark);
    const g = new Graphics(); g.poly(poly).stroke({ width: 4, color: col }); c.addChild(g);
    const bar = new Graphics(); bar.poly([x + sk, y, x + w + sk, y, x + w + sk - 5, y + 12, x + sk - 5, y + 12]).fill(col); c.addChild(bar);
    const tt = new Text({ text: t, style: { fontFamily: 'Bangers', fontSize: 46, fill: 0xf2f2f0, stroke: { color: 0x000000, width: 8, join: 'round' }, align: 'center', wordWrap: true, wordWrapWidth: w - 50, letterSpacing: 2 } });
    tt.anchor.set(0.5, 0); tt.position.set(x + w / 2 + sk / 2, y + 50); c.addChild(tt);
    const dd = new Text({ text: d, style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 30, fill: 0xf2f2f0, stroke: { color: 0x000000, width: 4, join: 'round' }, align: 'center', wordWrap: true, wordWrapWidth: w - 70, letterSpacing: 1.2, lineHeight: 38 } });
    dd.anchor.set(0.5, 0); dd.position.set(x + w / 2 + sk / 2, y + 190); c.addChild(dd);
    c.alpha = 0; (c as any).i = i;
  });
  const go = new Text({ text: 'CLICK TO START', style: { fontFamily: 'Bangers', fontSize: 78, fill: 0xf2f2f0, stroke: { color: 0xe8261b, width: 12, join: 'round' }, letterSpacing: 5 } });
  go.anchor.set(0.5); go.position.set(W / 2, 950); intro.addChild(go);
  // ---------- SPECIAL: SCATTER / WILD ----------

  // ---------- SCENES ----------
  const sceneBtns: Record<string, HTMLButtonElement> = {};
  let scene: SceneName = 'loading'; let busyNav = false; let loadingRun = 0;
  const mark = (n: string) => { for (const [k, b] of Object.entries(sceneBtns)) b.classList.toggle('on', k === n); };
  function runLoading(auto: boolean) {
    const id = ++loadingRun; drawBar(0); status.text = 'LOADING...'; status.alpha = 1; logo.alpha = 0;
    gsap.to(logo, { alpha: 1, duration: 0.8 }); gsap.fromTo(logo.scale, { x: logoK * 1.12, y: logoK * 1.12 }, { x: logoK, y: logoK, duration: 0.9, ease: 'power3.out' });
    const o = { p: 0 }; const dur = Math.max(0.5, 2.4 - (performance.now() - t0) / 1000 * (auto ? 1 : 0));
    gsap.to(o, { p: 1, duration: dur, ease: 'power1.inOut', onUpdate: () => { if (id === loadingRun) drawBar(o.p); }, onComplete: () => { if (id === loadingRun && auto) gsap.delayedCall(5, () => { if (id === loadingRun && scene === 'loading') show('intro'); }); } });
  }
  function setBg(videoOn: boolean) { video.style.display = videoOn ? 'block' : 'none'; if (videoOn) video.play().catch(() => {}); else video.pause(); }
  async function show(n: SceneName | 'scatter_demo' | 'wild_demo') {
    if (busyNav) return; busyNav = true; initAudio();
    loadingRun++; gsap.killTweensOf(go);
    if (n === 'bigwin' || n === 'jackpot' || n === 'scatter_demo' || n === 'wild_demo') {
      if (game && game.busy) { busyNav = false; return; }
      scene = 'game'; mark(n === 'scatter_demo' ? 'scatter' : n === 'wild_demo' ? 'wild' : n); await show2('game'); busyNav = false; await wait(0.3);
      if (n === 'bigwin') game!.force('mega'); else if (n === 'jackpot') game!.demoJackpot(); else game!.force(n === 'scatter_demo' ? 'fs' : 'wild'); return;
    }
    scene = n; mark(n); await show2(n); busyNav = false;
  }
  async function show2(n: SceneName | 'game') {
    load.visible = n === 'loading'; intro.visible = n === 'intro';
    if (game) game.root.visible = n === 'game';
    setBg(n === 'loading');
    music.play(n === 'game' ? 'game' : 'intro'); music.rain(n === 'game');
    if (n === 'loading') runLoading(false);
    if (n === 'intro') { iv.play().catch(() => {}); } else iv.pause();
    if (n === 'intro') {
      intro.children.forEach(c => { if ((c as any).i !== undefined) { c.alpha = 0; gsap.to(c, { alpha: 1, duration: 0.5, delay: 0.25 + (c as any).i * 0.18 }); } });
      ilogo.alpha = 0; gsap.to(ilogo, { alpha: 1, duration: 0.7 }); go.alpha = 1; gsap.to(go, { alpha: 0.35, duration: 0.7, yoyo: true, repeat: -1, delay: 1 });
    }
    if (n === 'game' && game) { game.root.alpha = 1; game.enter(); }
  }
  // bấm vào intro → giật + đổi màu nhẹ (RGB lệch, màu xoay) → mờ → vào game
  app.stage.on('pointerdown', async () => {
    if (scene !== 'intro' || busyNav) return; busyNav = true; initAudio(); gsap.killTweensOf(go); go.alpha = 1;
    const cm = new ColorMatrixFilter(); intro.filters = [cm]; sfx.glitch();
    const steps = [[-16, 4, 40], [18, -6, -70], [-8, 9, 120], [14, -3, -30], [-20, 6, 90], [6, -8, -110], [0, 0, 0]];
    for (const [dx, dy, hue] of steps) { intro.x = dx; intro.y = dy; cm.reset(); cm.hue(hue, false); cm.saturate(0.35, true); await wait(0.045); }
    intro.x = 0; intro.y = 0; intro.filters = [];
    await tw(intro, { alpha: 0, duration: 0.25 }); scene = 'game'; mark('game'); await show2('game'); intro.alpha = 1; busyNav = false;
  });

  // ---------- MENU BÊN TRÁI ----------
  const items: [SceneName, string][] = [['loading', '1 · Loading'], ['intro', '2 · Intro'], ['game', '3 · Gameplay'], ['bigwin', '4 · Big Win'], ['jackpot', '5 · Jackpot'], ['scatter', '6 · Scatter'], ['wild', '7 · Wild']];
  const lab = document.createElement('small'); lab.textContent = 'SCENES'; side.appendChild(lab);
  for (const [k, t] of items) { const b = document.createElement('button'); b.textContent = t; b.onclick = e => { e.stopPropagation(); show(k === 'scatter' ? 'scatter_demo' : k === 'wild' ? 'wild_demo' : k); }; side.appendChild(b); sceneBtns[k] = b; }
  side.addEventListener('pointerdown', e => e.stopPropagation());

  // ---------- CHẠY ----------
  game = new Game(app, scaler); game.root.visible = false; (window as any).__game = game; fit();
  game.onHome = () => show('intro'); game.onQuit = () => show('loading');
  scaler.setChildIndex(game.root, 0); scaler.setChildIndex(load, 1); scaler.setChildIndex(intro, 2);
  mark('loading'); runLoading(true); (window as any).__ready = true;
  (window as any).__show = show;
}
boot();
