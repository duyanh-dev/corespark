/* =========================================================
   VIEWER.JS - Khung xem demo toàn màn hình
   - Thẻ phóng to thành khung xem (clip-path), đóng thì thu về đúng thẻ
   - iframe chỉ nạp khi mở xong animation, gỡ hẳn khi đóng
   - Đổi thiết bị: trang hiển thị đúng kích thước thật rồi thu nhỏ vừa khung
   - Link riêng #demo=slug, nút Back đóng khung, phím tắt
   - Tối ưu: dừng Lenis khi mở, debounce khi bấm ←/→, gom layout vào rAF,
     đặt kích thước iframe TRƯỚC khi gán src
   Trả về: { open(slug, cardEl), openFromHash() }
   ========================================================= */
import gsap from 'gsap';
import { lockScroll, unlockScroll } from './scroll-lock.js';
import { initDebug } from './debug.js';
/* ---------- CẤU HÌNH THIẾT BỊ ----------
   w = chiều rộng "màn hình ảo" (px), maxH = chiều cao tối đa,
   b = độ dày viền máy, r = độ bo góc */
const DEVICES = {
  desktop: { w: 1280, maxH: Infinity, b: 0,  r: 14 },
  mobile:  { w: 390,  maxH: 844,      b: 12, r: 44 },
};
const ORDER = ['desktop', 'mobile'];
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals';

export function initViewer({ demos, getList }) {
  const dbg = initDebug();
  const byslug = new Map(demos.map((d) => [d.slug, d]));
  const $ = (id) => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----- Lấy phần tử. Đưa khung xem ra thẳng <body> để position: fixed luôn phủ cả màn hình ----- */
  const viewer = $('sc-viewer');
  document.body.appendChild(viewer);
  const bar = $('v-bar'), foot = $('v-foot'), stage = $('v-stage'), frame = $('v-frame'), screen = $('v-screen');
  const loader = $('v-loader'), hint = $('v-hint'), toast = $('v-toast');
  const closeBtn = $('v-close'), titleEl = $('v-title'), metaEl = $('v-meta'), visit = $('v-visit');
  const prevBtn = $('v-prev'), nextBtn = $('v-next'), reloadBtn = $('v-reload'), copyBtn = $('v-copy'), wantBtn = $('v-want');
  const devBtns = [...$('v-devices').querySelectorAll('button')];

  /* ----- Trạng thái ----- */
  let cur = null, isOpen = false, device = 'desktop', deviceChosen = false;
  let iframe = null, origin = null, returnFocus = null, hintTimer, toastTimer, pendingCb = null;
  dbg.setCtx(() => ({
  slug: cur?.slug, device, iw: iframe?.style.width, ih: iframe?.style.height, tf: iframe?.style.transform,
}));
  let loadTimer = 0, rafL = 0;

  /* ---------- HÀM 1: tiện ích nhỏ ---------- */
  const parseHash = () => (location.hash.match(/^#demo=([\w-]+)/) || [])[1] || null;
  const absUrl = (u) => new URL(u, location.href).href;
  const defaultDevice = () => (innerWidth < 1000 ? 'mobile' : 'desktop');

const scRoot = document.getElementById('showcase');
function freezeParent() {
  if (!scRoot) return;
  const h = scRoot.getBoundingClientRect().height;   // đo TRƯỚC khi ẩn
  document.documentElement.classList.add('sc-viewing');
  scRoot.style.height = h + 'px';
}
function unfreezeParent() {
  document.documentElement.classList.remove('sc-viewing');
  if (scRoot) scRoot.style.height = '';
}

  /* Điện thoại xem "Máy tính": giới hạn chiều cao ảo 800px (tỉ lệ 16:10) để iframe không phình to gây tràn RAM iOS */
const deviceCfg = () =>
  device === 'desktop' && innerWidth < 1000 ? { ...DEVICES.desktop, maxH: 800 } : DEVICES[device];

  /* ---------- HÀM 2: điền thông tin demo lên thanh trên ---------- */
  function fillUI(d) {
    titleEl.textContent = d.title;
    metaEl.textContent = [d.type, d.topic, d.styles.join(', '), d.tech.join(', ')].join(' · ');
    visit.href = absUrl(d.siteUrl || d.url);
    visit.setAttribute('aria-label', `Mở ${d.title} ở tab mới`);
    loader.style.setProperty('--thumb', d.thumb ? `url("${absUrl(d.thumb)}")` : 'none');
    const many = getList().length > 1;
    prevBtn.disabled = nextBtn.disabled = !many;
    hint.classList.remove('is-warn');
  }

  /* ---------- HÀM 3: gỡ iframe (giải phóng bộ nhớ, dừng WebGL) ---------- */
  function killIframe() {
    dbg.detach();
    clearTimeout(hintTimer);
    clearTimeout(loadTimer);
    try { sessionStorage.removeItem('sc:loading'); } catch {}
    if (!iframe) return;
    iframe.src = 'about:blank';
    iframe.remove();
    iframe = null;
  }

  /* ---------- HÀM 4: nạp demo vào iframe mới ---------- */
  function loadIframe() {
    killIframe();
    loader.classList.remove('is-done');
    iframe = document.createElement('iframe');
    iframe.title = cur.title;
    iframe.setAttribute('sandbox', SANDBOX);
    iframe.allow = 'fullscreen; autoplay';
    iframe.addEventListener('load', () => {
  try { sessionStorage.removeItem('sc:loading'); } catch {}
  clearTimeout(hintTimer);
  loader.classList.add('is-done');
  iframe.classList.add('is-loaded');
  dbg.attach(iframe);
});

    screen.appendChild(iframe);
    layoutFrame();             
    try { sessionStorage.setItem('sc:loading', cur.slug); } catch {}  
    dbg.log('load-start', { slug: cur.slug, device, dpr: devicePixelRatio });
iframe.src = absUrl(cur.url);           // có kích thước đúng rồi mới nạp (demo WebGL khỏi phải resize lại)
    iframe.src = absUrl(cur.url);
    hintTimer = setTimeout(() => hint.classList.add('is-warn'), 7000);
  }

  /* ---------- HÀM 5: tính kích thước khung + tỉ lệ thu nhỏ theo thiết bị đang chọn ---------- */
  function layoutFrame() {
    const d = deviceCfg();   // trước đây: DEVICES[device]
    stage.style.paddingTop = bar.offsetHeight + 22 + 'px';
    stage.style.paddingBottom = (foot.offsetHeight ? foot.offsetHeight + 22 : 12) + 'px';
    const cs = getComputedStyle(stage);
    const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (availW <= 0 || availH <= 0) return;

    const b = d.b;
    let scale = Math.min(1, (availW - 2 * b) / d.w);
    if (isFinite(d.maxH)) scale = Math.min(scale, (availH - 2 * b) / d.maxH);
    let innerH = (availH - 2 * b) / scale;
    if (isFinite(d.maxH)) innerH = Math.min(innerH, d.maxH);

    frame.style.width = d.w * scale + 2 * b + 'px';
    frame.style.height = innerH * scale + 2 * b + 'px';
    frame.style.borderRadius = d.r + 'px';
    screen.style.setProperty('--b', b + 'px');
    screen.style.borderRadius = Math.max(0, d.r - b) + 'px';
    if (iframe) {
      iframe.style.width = d.w + 'px';
      iframe.style.height = innerH + 'px';
      iframe.style.transform = `scale(${scale})`;
    }
  }

  /* ---------- HÀM 6: đổi thiết bị ---------- */
  function setDevice(dev, chosen) {
    device = dev;
    if (chosen) deviceChosen = true;
    devBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.d === dev));
    frame.dataset.device = dev;
    layoutFrame();
    dbg.log('setDevice', { dev });
  }

  /* ---------- HÀM 7: hiệu ứng mở (thẻ phóng to ra toàn màn hình) ---------- */
  function animateIn(onDone) {
    gsap.killTweensOf(viewer);
    const r = origin?.getBoundingClientRect();
    const ok = r && r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    const from = ok
      ? `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 26px)`
      : 'inset(50% 50% 50% 50% round 26px)';
    gsap.fromTo(viewer, { clipPath: from, opacity: 1 },
      { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: reduce ? 0 : 0.5, ease: 'power3.inOut',
        onComplete: () => {
  viewer.style.clipPath = 'none';
  if (isOpen) freezeParent();
  layoutFrame(); onDone?.();
}
    });
    gsap.from([bar, foot], { opacity: 0, y: (i) => (i ? 12 : -12), duration: 0.4, delay: reduce ? 0 : 0.25, clearProps: 'all' });
  }

  /* ---------- HÀM 8: MỞ khung xem demo (hoặc chuyển sang demo khác nếu đang mở) ---------- */
  function open(slug, originEl = null, { push = true } = {}) {
    const d = byslug.get(slug);
    if (!d) return;
    const wasOpen = isOpen;
    cur = d;
    origin = originEl || document.querySelector(`.sc-card[data-slug="${slug}"]`);
    fillUI(d);

    if (!wasOpen) {
      isOpen = true;
      if (!deviceChosen) setDevice(defaultDevice(), false);
      returnFocus = document.activeElement;
      viewer.hidden = false;
      lockScroll();
      window.__lenis?.stop();                    // trang chính ngừng render ngầm khi xem demo
      if (push) history.pushState({ scDemo: slug }, '', '#demo=' + slug);
      animateIn(() => { if (isOpen && !iframe) loadIframe(); });   // đợi mở xong mới nạp demo
      closeBtn.focus({ preventScroll: true });
    } else {
      history.replaceState(history.state?.scDemo ? { scDemo: slug } : null, '', '#demo=' + slug);
      killIframe();                              // gỡ demo cũ ngay
      loader.classList.remove('is-done');
      loadTimer = setTimeout(loadIframe, 200);   // debounce: bấm ←/→ liên tục chỉ nạp demo cuối
    }
  }

  /* ---------- HÀM 9: ĐÓNG (thu khung về đúng thẻ) ---------- */
  function closeNow(cb) {
    if (!isOpen) return;
    isOpen = false;
    // document.documentElement.classList.remove('sc-viewing');
    unfreezeParent();
    gsap.killTweensOf(viewer);
    if (parseHash()) history.replaceState(null, '', location.pathname + location.search);

    const finish = () => {
      killIframe();
      viewer.hidden = true;
      viewer.style.clipPath = ''; viewer.style.opacity = '';
      unlockScroll();
      window.__lenis?.start();
      returnFocus?.focus?.({ preventScroll: true });
      cb?.();
    };

    const r = origin && origin.isConnected ? origin.getBoundingClientRect() : null;
    const ok = r && r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    if (ok) {
      gsap.set(viewer, { clipPath: 'inset(0px 0px 0px 0px round 0px)' });
      gsap.to(viewer, {
        clipPath: `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 26px)`,
        duration: reduce ? 0 : 0.5, ease: 'power3.inOut', onComplete: finish,
      });
    } else {
      gsap.to(viewer, { opacity: 0, duration: reduce ? 0 : 0.3, onComplete: finish });
    }
  }

  /* Đóng qua lịch sử: nếu đã thêm 1 mục lịch sử khi mở thì "lùi lại" 1 bước (popstate sẽ đóng thật) */
  function requestClose(cb) {
    if (history.state?.scDemo) { pendingCb = cb; history.back(); }
    else closeNow(cb);
  }

  /* ---------- HÀM 10: demo trước / sau trong danh sách đang lọc ---------- */
  function step(dir) {
    const list = getList().map((d) => d.slug);
    if (list.length < 2) return;
    const i = Math.max(0, list.indexOf(cur.slug));
    open(list[(i + dir + list.length) % list.length], null, { push: false });
  }

  /* ---------- HÀM 11: thông báo nhỏ (toast) và sao chép link ---------- */
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1800);
  }
  async function copyLink() {
    const url = location.origin + location.pathname + '#demo=' + cur.slug;
    try { await navigator.clipboard.writeText(url); showToast('Đã sao chép link demo'); }
    catch { window.prompt('Sao chép link này:', url); }
  }

  /* ---------- HÀM 12: giữ phím Tab xoay vòng trong khung xem ---------- */
  function trapFocus(e) {
    const f = [...viewer.querySelectorAll('a[href], button:not([disabled])')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ----- Gắn sự kiện ----- */
  closeBtn.addEventListener('click', () => requestClose());
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  reloadBtn.addEventListener('click', () => { if (iframe) { loader.classList.remove('is-done'); iframe.classList.remove('is-loaded'); iframe.src = iframe.src; } });
  copyBtn.addEventListener('click', copyLink);
  devBtns.forEach((b) => b.addEventListener('click', () => setDevice(b.dataset.d, true)));

  // "Tôi muốn web như này": đóng khung, lưu tên demo, báo cho phần Liên hệ rồi cuộn xuống
  wantBtn.addEventListener('click', () => {
    const detail = { slug: cur.slug, title: cur.title };
    try { sessionStorage.setItem('corespark:inquiry', JSON.stringify(detail)); } catch {}
    window.dispatchEvent(new CustomEvent('corespark:inquiry', { detail }));
    requestClose(() => {
      const target = document.querySelector('#contact');
      if (!target) return;
      window.__lenis ? window.__lenis.scrollTo(target, { duration: 1.4 }) : target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); requestClose(); }
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (['1', '2'].includes(e.key)) setDevice(ORDER[Number(e.key) - 1], true);
    else if (e.key === 'Tab') trapFocus(e);
  });

  // Nút Back / Forward của trình duyệt
  window.addEventListener('popstate', () => {
    const slug = parseHash();
    if (slug) { if (!isOpen || cur?.slug !== slug) open(slug, null, { push: false }); }
    else if (isOpen) { const cb = pendingCb; pendingCb = null; closeNow(cb); }
  });

  // Đổi cỡ cửa sổ / xoay điện thoại: quan sát viewer (không phải stage, tránh vòng lặp) và gom vào 1 khung hình
  new ResizeObserver(() => {
    if (!isOpen || rafL) return;
    rafL = requestAnimationFrame(() => { rafL = 0; layoutFrame(); });
  }).observe(viewer);

  return {
    open: (slug, el) => open(slug, el),
    openFromHash: () => {
  const s = parseHash();
  if (!s) return;
  let crashed = null;
  try { crashed = sessionStorage.getItem('sc:loading'); sessionStorage.removeItem('sc:loading'); } catch {}
  if (crashed === s) {                       // lần trước demo này làm trang crash: không tự mở lại
    history.replaceState(null, '', location.pathname + location.search);
    return;
  }
  open(s, null, { push: false });
},
  };
}