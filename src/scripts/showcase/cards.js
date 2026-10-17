/* =========================================================
   CARDS.JS - Hiệu ứng cho thẻ demo (chỉ trên thiết bị có chuột)
   1) Nghiêng 3D theo vị trí chuột
   2) Rê chuột 0,45 giây: thẻ phát BẢN XEM TRƯỚC SỐNG của demo (iframe thu nhỏ)
   ========================================================= */

const LIVE_PREVIEW = false;     // đặt false nếu muốn tắt xem trước sống cho tất cả thẻ
const LIVE_DELAY = 450;        // ms: rê chuột bao lâu thì bắt đầu nạp
const LIVE_W = 1280, LIVE_H = 800;   // kích thước "màn hình ảo" của bản xem trước
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups';

/* CARDS.JS - Nghiêng 3D theo chuột (chỉ trên thiết bị có chuột) */
export function initCards(grid) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  grid.querySelectorAll('.sc-card').forEach((card) => {
    const tilt = card.querySelector('.sc-tilt');
    let raf = 0, ex = 0, ey = 0;

    const apply = () => {
      raf = 0;
      const r = card.getBoundingClientRect();
      const x = (ex - r.left) / r.width - 0.5;
      const y = (ey - r.top) / r.height - 0.5;
      tilt.style.setProperty('--ry', `${x * 8}deg`);
      tilt.style.setProperty('--rx', `${-y * 8}deg`);
    };

    card.addEventListener('pointermove', (e) => {
      ex = e.clientX; ey = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);   // tối đa 1 lần mỗi khung hình
    });
    card.addEventListener('pointerenter', () => tilt.style.setProperty('--ty', '-6px'));
    card.addEventListener('pointerleave', () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      ['--rx', '--ry', '--ty'].forEach((p) => tilt.style.removeProperty(p));
    });
  });
}