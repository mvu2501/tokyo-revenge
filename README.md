# Tokyo Revenge – Prototype (PixiJS)

Prototype slot game cho portfolio. Kết quả là GIẢ LẬP, không có tiền thật.

## Chạy trên máy Mac (làm 1 lần)
1. Cài Node.js bản LTS: https://nodejs.org (tải bản macOS, cài như app bình thường).
2. Mở app **Terminal**, gõ (thay đường dẫn nếu bạn để thư mục ở chỗ khác):
   cd ~/Desktop/"Tokyo Revenge"/08_prototype/tokyo-revenge
3. Gõ: `npm install`   (đợi 1–2 phút)
4. Gõ: `npm run dev`   rồi mở link http://localhost:5173 trong Chrome.

## Cách chơi
- Bấm **TAP TO START**, rồi nút SPIN (hoặc phím Space).
- Nút ≡ (Menu): ép Big / Mega / Epic Win, kích Free Spins, nạp Revenge Meter lên 9/10, reset số dư.
- Phím tắt: 1 Big, 2 Mega, 3 Epic, 4 Free Spins, F nạp meter.
- Meter đủ 10/10 → Final Slash (thưởng cố định 100x).

## Đưa lên web để gửi nhà tuyển dụng
`npm run build` → thư mục `dist/` đưa lên Vercel hoặc GitHub Pages.

## Cấu trúc
- src/config.ts: kích thước, bảng trả thưởng, mức cược
- src/logic.ts: random, tính thắng (ways)
- src/reels.ts, ui.ts, meter.ts, bigwin.ts, game.ts: màn chơi
- public/assets: toàn bộ hình/video
Wild và Scatter hiện là hình tạm vẽ bằng code, chờ art thật.
