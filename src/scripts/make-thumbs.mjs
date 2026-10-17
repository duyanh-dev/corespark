/* =========================================================
   MAKE-THUMBS.MJS - Tự chụp ảnh thumbnail cho từng demo trong src/data/demos.json
   Cách dùng:
     npm run thumbs                  -> chỉ chụp demo CHƯA có ảnh
     npm run thumbs -- --force       -> chụp lại TẤT CẢ
     npm run thumbs -- ten-slug      -> chụp riêng 1 (hoặc vài) demo theo slug
   Ảnh lưu đúng đường dẫn ở trường "thumb" (đuôi .jpg) trong thư mục public/
   ========================================================= */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/* ---------- CẤU HÌNH ---------- */
const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const W = 1280, H = 800;      // 16:10, khớp tỉ lệ ảnh trên thẻ
const WAIT = 1800;            // ms chờ hiệu ứng mở đầu của trang trước khi chụp

const demos = JSON.parse(await fs.readFile(path.join(ROOT, 'src/data/demos.json'), 'utf8'));
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain',
};

/* ---------- HÀM 1: server tĩnh nhỏ phục vụ thư mục public ----------
   Để demo nằm trong public/demos/... được mở bằng http:// (giống khi chạy thật) */
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      try {
        let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        if (p.endsWith('/')) p += 'index.html';
        const file = path.join(PUBLIC, path.normalize(p));
        if (!file.startsWith(PUBLIC)) throw new Error('ngoài public');   // chặn đường dẫn thoát khỏi public
        const data = await fs.readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404); res.end('Not found');
      }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));       // cổng 0 = tự chọn cổng trống
  });
}

/* ---------- HÀM CHÍNH: chụp từng demo ---------- */
const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
let ok = 0, fail = 0;

for (const d of demos) {
  if (only.length && !only.includes(d.slug)) continue;
  if (!d.thumb) { console.log(`-  ${d.slug}: bỏ qua (chưa có trường "thumb" trong JSON)`); continue; }

  const out = path.join(PUBLIC, d.thumb);
  if (existsSync(out) && !force && !only.length) { console.log(`✓  ${d.slug}: đã có ảnh`); continue; }

  // Link ngoài (https://...) mở thẳng, đường dẫn nội bộ (/demos/...) mở qua server tĩnh ở trên
  const url = /^https?:/i.test(d.url) ? d.url : base + d.url;
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(d.thumbWait ?? WAIT);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
    console.log(`📸 ${d.slug} -> ${d.thumb}`);
    ok++;
  } catch (e) {
    console.log(`✗  ${d.slug}: ${e.message.split('\n')[0]}`);
    fail++;
  }
  await page.close();
}

await browser.close();
srv.close();
console.log(`\nXong: ${ok} ảnh mới, ${fail} lỗi.`);