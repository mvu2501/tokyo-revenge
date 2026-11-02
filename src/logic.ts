import { COLS, ROWS, PAY, WEIGHTS, SYM } from './config';

export type Grid = number[][]; // grid[col][row]
export interface WinLine { sym: number; reels: number; ways: number; pay: number; cells: [number, number][] }
export interface Eval { total: number; wins: WinLine[]; scatters: number; scatterCells: [number, number][]; wilds: number; hasH5: boolean }

const totalW = WEIGHTS.reduce((a, b) => a + b, 0);
export function randSym(col: number): number {
  for (let tries = 0; tries < 20; tries++) {
    let r = Math.random() * totalW; let s = 0;
    for (let i = 0; i < WEIGHTS.length; i++) { r -= WEIGHTS[i]; if (r <= 0) { s = i; break; } }
    if (s === SYM.WILD && (col === 0 || col === COLS - 1)) continue; // wild chỉ ở reel 2-4
    return s;
  }
  return 0;
}
export function makeGrid(): Grid {
  return Array.from({ length: COLS }, (_, c) => Array.from({ length: ROWS }, () => randSym(c)));
}
export function noScatter(grid: Grid) {
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r] === SYM.SCATTER) { let s: number; do { s = randSym(c); } while (s === SYM.SCATTER); grid[c][r] = s; }
}

export function evaluate(grid: Grid, bet: number): Eval {
  const wins: WinLine[] = []; let total = 0; let wilds = 0; let hasH5 = false;
  const scatterCells: [number, number][] = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (grid[c][r] === SYM.SCATTER) scatterCells.push([c, r]);
    if (grid[c][r] === SYM.WILD) wilds++;
  }
  for (let s = 0; s < 10; s++) {
    const counts: number[] = []; const cells: [number, number][] = [];
    for (let c = 0; c < COLS; c++) {
      let n = 0;
      for (let r = 0; r < ROWS; r++) if (grid[c][r] === s || grid[c][r] === SYM.WILD) { n++; cells.push([c, r]); }
      if (n === 0) break; counts.push(n);
    }
    if (counts.length >= 3) {
      const ways = counts.reduce((a, b) => a * b, 1);
      const pay = PAY[s][counts.length - 3] * ways * bet;
      const used = cells.filter(([c]) => c < counts.length);
      wins.push({ sym: s, reels: counts.length, ways, pay, cells: used });
      total += pay; if (s === 9) hasH5 = true;
    }
  }
  return { total: Math.round(total), wins, scatters: scatterCells.length, scatterCells, wilds, hasH5 };
}

// Kết quả kịch bản cho nút demo
export type Force = 'big' | 'mega' | 'epic' | 'fs' | 'wild';
export const FORCE_MULT: Record<string, number> = { big: 22, mega: 64, epic: 130 };
export function craftGrid(kind: Force): Grid {
  const g = makeGrid(); noScatter(g);
  if (kind === 'fs') {
    const cols = [0, 2, 4]; for (const c of cols) g[c][Math.floor(Math.random() * ROWS)] = SYM.SCATTER; return g;
  }
  if (kind === 'wild') { const sy = 6; g[0][1] = sy; g[1][1] = SYM.WILD; g[2][1] = sy; g[3][1] = SYM.WILD; g[4][1] = sy; g[1][2] = SYM.WILD; return g; }
  const sym = kind === 'epic' ? 9 : kind === 'mega' ? 8 : 7; const len = kind === 'epic' ? 5 : kind === 'mega' ? 4 : 3;
  for (let c = 0; c < len; c++) { g[c][1] = sym; g[c][2] = c === 1 && kind !== 'big' ? SYM.WILD : sym; }
  return g;
}
