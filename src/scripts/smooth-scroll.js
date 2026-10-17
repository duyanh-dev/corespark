/* =========================================================
   SMOOTH-SCROLL.JS
   Chức năng: cuộn mượt (Lenis) và nối với GSAP ScrollTrigger
   Các section ghim / cuộn ngang đều dựa vào file này
   ========================================================= */
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Thanh địa chỉ trên điện thoại co/giãn khi cuộn: KHÔNG tính lại điểm ghim (tránh giật, nhảy trang)
ScrollTrigger.config({ ignoreMobileResize: true });

export function initSmoothScroll() {
  // lerp càng nhỏ càng "trôi". anchors: bấm link #id thì cuộn mượt tới đúng chỗ
  const lenis = new Lenis({ lerp: 0.1, anchors: true });

  // Mỗi lần Lenis cuộn, báo cho ScrollTrigger cập nhật
  lenis.on('scroll', ScrollTrigger.update);

  // Để GSAP điều khiển nhịp cập nhật của Lenis
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Chia sẻ ra window để component khác dùng (menu mobile, chấm chương...)
  window.__lenis = lenis;

  // Tải xong font/ảnh, hoặc xoay màn hình: tính lại vị trí các điểm ghim
  window.addEventListener('load', () => ScrollTrigger.refresh());
  window.addEventListener('orientationchange', () => setTimeout(() => ScrollTrigger.refresh(), 300));

  return lenis;
}