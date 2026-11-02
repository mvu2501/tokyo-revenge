// Toàn bộ số liệu bố cục (thiết kế 1920x1080) và luật game nằm ở đây để dễ chỉnh.
export const W = 1920;
export const H = 1080;
export const COLS = 5;
export const ROWS = 4;

// Khung reel: ảnh đã cắt 1054x797, lỗ trong (vùng đặt symbol) x 88..954, y 127..656
export const FRAME = { imgW: 1097, imgH: 787, sx: 1.0801, sy: 1.0427, holeX: 74, holeY: 78, holeW: 949, holeH: 633, top: 58.1 };
export const CELL_W = 205; // lưới 5x4 = 1025 x 660 (đã to thêm 10%)
export const CELL_H = 165;
export const SYMBOL_SIZE = 189;

// Thanh điều khiển: ảnh gốc 1305x250, các điểm tâm (toạ độ trong ảnh gốc)
export const BAR = { scale: 0.93, y: 842, angle: -2.6 * Math.PI / 180 };
export const BAR_PTS = {
  menu: { x: 91, y: 173, d: 54 }, sound: { x: 172, y: 173, d: 54 },
  balance: { x: 295, y: 167, w: 130 }, bet: { x: 450, y: 163, w: 140 }, win: { x: 697, y: 155, w: 290 },
  plus: { x: 909, y: 118 }, minus: { x: 909, y: 176 },
  spin: { x: 1057, y: 108, d: 178 }, auto: { x: 1213, y: 149, d: 56 },
};

// Meter dạng thanh kiếm: ảnh 1351x385. Biên các ô tính theo đường xiên (tọa độ trong ảnh đã cắt)
// Gốc cắt (8,162): x_ảnh = x_gốc - 8, y_ảnh = y_gốc - 162
export const METER = { x: 480, y: -2, scale: 0.3, slant: 0.325, xb1: 183, pitch: 99.4, yRef: 231.5, cellTop: 153, cellBot: 310, xFirst: 100, xLast: 1088, w: 1190, h: 413 };

export const BETS = [10, 20, 50, 100, 200, 500];
export const START_BALANCE = 10000;

// Ngưỡng Big Win (nhân với cược). Đây là số GIẢ LẬP cho prototype.
export const TIERS = { big: 15, mega: 50, epic: 100 };

// Symbol: 0-4 low pay, 5-9 high pay, 10 wild, 11 scatter
export const SYM = { WILD: 10, SCATTER: 11 };
export const SYM_KEYS = ['L1', 'L2', 'L3', 'L4', 'L5', 'H1', 'H2', 'H3', 'H4', 'H5'];
// Trả thưởng theo số reel liên tiếp (3,4,5), đơn vị: nhân cược cho mỗi "way"
export const PAY: number[][] = [
  [0.1, 0.25, 0.6], [0.1, 0.25, 0.6], [0.15, 0.4, 1], [0.15, 0.4, 1], [0.2, 0.5, 1.2],
  [0.3, 0.8, 2], [0.4, 1, 2.5], [0.5, 1.5, 4], [0.8, 3, 8], [1, 4, 12],
];
// Trọng số xuất hiện mỗi reel
export const WEIGHTS = [14, 14, 12, 12, 11, 7, 6, 5, 3, 2, 3, 2.2];
export const SCATTER_SPINS: Record<number, number> = { 3: 5, 4: 8, 5: 8 };

// Thang multiplier trong Free Spins (khớp với 5 ảnh chip 2x/3x/5x/8x/10x)
export const MULT_LADDER = [1, 2, 3, 5, 8, 10];
