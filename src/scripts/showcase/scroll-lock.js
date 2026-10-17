/* =========================================================
   SCROLL-LOCK.JS - Khoá / mở cuộn trang
   Dùng bộ đếm để nhiều lớp phủ (ngăn kéo bộ lọc, khung xem demo)
   mở chồng nhau mà không giẫm chân nhau
   ========================================================= */
let count = 0;

/* HÀM 1: khoá cuộn (lớp phủ đầu tiên mới thực sự khoá) */
export function lockScroll() {
  if (count++ === 0) {
    window.__lenis?.stop();                          // dừng cuộn mượt Lenis
    document.documentElement.style.overflow = 'hidden';
  }
}

/* HÀM 2: mở cuộn (khi lớp phủ cuối cùng đóng) */
export function unlockScroll() {
  count = Math.max(0, count - 1);
  if (count === 0) {
    window.__lenis?.start();
    document.documentElement.style.overflow = '';
  }
}