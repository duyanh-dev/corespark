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

    /* ----- Phần tử mới cho hiệu ứng đổi thiết bị ----- */
  const seg = $('v-devices');                       // nút gạt Máy tính | Điện thoại (chứa viên kính trượt)
  const veil = document.createElement('span');      // lớp kính phủ lên khung khi biến hình
  veil.className = 'sc-veil';
  frame.appendChild(veil);
  let morphTl = null;                               // timeline biến hình đang chạy (để huỷ khi bấm liên tục)
  let flying = false;                               // đang có vé bay (chặn bấm đúp)

  /* ----- Trạng thái ----- */
  let cur = null, isOpen = false, device = 'desktop', deviceChosen = false;
  let iframe = null, origin = null, returnFocus = null, hintTimer, toastTimer, pendingCb = null;
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

/* Điện thoại + tab Máy tính = chế độ nhẹ: không nạp iframe, chỉ hiện ảnh chụp */
const phoneDesktop = () => device === 'desktop' && innerWidth < 1000;

function openFull() {
  const u = new URL(absUrl(cur.url));
  if (u.origin === location.origin) {
    try { sessionStorage.setItem('sc:device', 'desktop'); } catch {}
    location.href = viewer.dataset.preview
      + '?u=' + encodeURIComponent(u.pathname + u.search)
      + '&t=' + encodeURIComponent(cur.title);
  } else {
    window.open(absUrl(cur.siteUrl || cur.url), '_blank', 'noopener');
  }
}

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
  const lite = phoneDesktop();
  loader.classList.toggle('is-lite', lite);
  loader.classList.remove('is-done');
  if (lite) { layoutFrame(); return; }      // chế độ nhẹ: dừng ở đây, không tạo iframe
  iframe = document.createElement('iframe');

    iframe.title = cur.title;
    iframe.setAttribute('sandbox', SANDBOX);
    iframe.allow = 'fullscreen; autoplay';
    iframe.addEventListener('load', () => {
      try { sessionStorage.removeItem('sc:loading'); } catch {}
      clearTimeout(hintTimer);
      loader.classList.add('is-done');
      iframe.classList.add('is-loaded');
    });
    screen.appendChild(iframe);
    layoutFrame();             
    try { sessionStorage.setItem('sc:loading', cur.slug); } catch {}             // có kích thước đúng rồi mới nạp (demo WebGL khỏi phải resize lại)
    iframe.src = absUrl(cur.url);
    hintTimer = setTimeout(() => hint.classList.add('is-warn'), 7000);
  }

  /* ---------- HÀM 5: tính kích thước khung + tỉ lệ thu nhỏ theo thiết bị đang chọn ---------- */
  function layoutFrame() {
    syncSeg(); 
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

    /* ---------- HÀM A: chụp kích thước hiện tại của khung (rộng, cao, bo góc, viền máy) ---------- */
  const snapFrame = () => ({
    w: frame.offsetWidth,
    h: frame.offsetHeight,
    r: parseFloat(frame.style.borderRadius) || 14,
    b: parseFloat(screen.style.getPropertyValue('--b')) || 0,
  });

  /* ---------- HÀM B: đặt viên kính trượt dưới nút đang chọn (chỉ cập nhật 2 biến CSS --x, --w) ---------- */
  function syncSeg() {
    const on = seg.querySelector('.is-active');
    if (!on || !on.offsetWidth) return;            // khung xem đang ẩn thì chưa đo được
    seg.style.setProperty('--x', on.offsetLeft + 'px');
    seg.style.setProperty('--w', on.offsetWidth + 'px');
    if (!seg.dataset.ready) {                      // lần đầu: đặt đúng chỗ không cần trượt
      requestAnimationFrame(() => requestAnimationFrame(() => { seg.dataset.ready = '1'; }));
    }
  }

  /* ---------- HÀM C: biến hình khung từ kích thước cũ sang mới (kính lỏng) ----------
     Gọi SAU khi layoutFrame() đã đặt kích thước đích. Iframe đã gỡ nên chỉ animate vỏ khung (rẻ) */
  function morphFrame(from) {
    const to = snapFrame();                         // kích thước đích (vừa được layoutFrame đặt)
    loader.classList.add('is-morph');               // ẩn spinner + lớp tối, chỉ còn ảnh thumbnail sạch
    loader.classList.remove('is-done');
    loader.classList.toggle('is-lite', phoneDesktop());
    frame.classList.add('is-morph');                // viền kính sáng lên

    morphTl = gsap.timeline({
      onComplete: () => {
        morphTl = null;
        frame.classList.remove('is-morph');
        gsap.set([frame, loader], { clearProps: 'transform' });
        gsap.set(veil, { opacity: 0 });
      },
    });

    morphTl
      /* lớp kính hiện ra và nhòe dần */
      .fromTo(veil, { opacity: 0, '--vb': '0px' }, { opacity: 1, '--vb': '16px', duration: 0.28, ease: 'power2.out' }, 0)
      /* khung chảy sang kích thước + bo góc mới */
      .fromTo(frame, { width: from.w, height: from.h, borderRadius: from.r },
                     { width: to.w, height: to.h, borderRadius: to.r, duration: 0.8, ease: 'expo.inOut' }, 0)
      /* viền máy và bo góc màn hình biến hình cùng lúc */
      .fromTo(screen, { '--b': from.b + 'px', borderRadius: Math.max(0, from.r - from.b) },
                      { '--b': to.b + 'px', borderRadius: Math.max(0, to.r - to.b), duration: 0.8, ease: 'expo.inOut' }, 0)
      /* ảnh thumbnail lùi nhẹ như bị kính khúc xạ */
      .fromTo(loader, { scale: 1.08 }, { scale: 1, duration: 0.9, ease: 'power3.out' }, 0)
      /* co dãn như giọt chất lỏng: ép nhẹ rồi bật về */
      .to(frame, { scaleX: 0.96, scaleY: 1.04, duration: 0.3, ease: 'sine.out' }, 0)
      .to(frame, { scaleX: 1, scaleY: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)' }, 0.3)
      /* kính trong lại */
      .to(veil, { opacity: 0, '--vb': '0px', duration: 0.45, ease: 'power2.inOut' }, 0.55)
      /* khung gần xong thì mới nạp iframe */
      .call(() => {
        if (!isOpen || !cur) return;
        loader.classList.remove('is-morph');
        loadIframe();
      }, null, 0.8);
  }

  /* ---------- HÀM 6: đổi thiết bị ---------- */
  /* ---------- HÀM 6: đổi thiết bị (có biến hình khi người dùng tự bấm) ---------- */
  function setDevice(dev, chosen) {
    const changed = dev !== device;
    const morph = chosen && changed && isOpen && cur && !reduce;

    /* bấm liên tục: huỷ hiệu ứng đang chạy, chụp từ kích thước hiện tại */
    if (morphTl) { morphTl.kill(); morphTl = null; gsap.set(frame, { clearProps: 'transform' }); }
    const from = morph ? snapFrame() : null;

    device = dev;
    if (chosen) deviceChosen = true;
    devBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.d === dev));
    frame.dataset.device = dev;

    if (morph) { killIframe(); layoutFrame(); morphFrame(from); return; }

    layoutFrame();
    if (chosen && changed && isOpen && cur) loadIframe();   // giảm chuyển động: đổi tức thì như cũ
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

    /* ---------- HÀM D: dựng "vé" kính từ demo đang xem ---------- */
  function buildTicket(d) {
    const t = document.createElement('div');
    t.className = 'sc-ticket';
    t.setAttribute('aria-hidden', 'true');
    if (d.thumb) {
      const img = document.createElement('img');
      img.src = absUrl(d.thumb); img.alt = '';
      t.appendChild(img);
    }
    const body = document.createElement('div');
    body.className = 'sc-ticket-body';
    const tag = document.createElement('span');
    tag.className = 'sc-ticket-tag'; tag.textContent = 'Vé demo';
    const name = document.createElement('strong');
    name.textContent = d.title;
    body.append(tag, name);
    t.appendChild(body);
    return t;
  }

  /* ---------- HÀM E: vé nảy lên từ nút "Tôi muốn web như này" rồi lơ lửng chờ ---------- */
  function launchTicket(d, fromEl) {
    if (reduce) return null;
    const t = buildTicket(d);
    document.body.appendChild(t);
    const r = fromEl.getBoundingClientRect();
    gsap.set(t, { xPercent: -50, yPercent: -50, x: r.left + r.width / 2, y: r.top + r.height / 2, scale: 0.5, opacity: 0 });
    gsap.to(t, { y: r.top - 90, scale: 1, opacity: 1, rotation: -5, duration: 0.55, ease: 'back.out(1.6)' });
    gsap.to(t, { y: '-=8', duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.55 });   // lơ lửng nhẹ
    return t;
  }

  /* ---------- HÀM F: gắn chip "Demo bạn chọn" làm phần tử đầu tiên của form (đang ẩn, để đo vị trí đáp) ---------- */
  function mountDock(d, contactEl) {
    const host = contactEl.querySelector('form') || contactEl;
    host.querySelector('.sc-dock')?.remove();

    const dock = document.createElement('div');
    dock.className = 'sc-dock';
    if (d.thumb) {
      const img = document.createElement('img');
      img.src = absUrl(d.thumb); img.alt = '';
      dock.appendChild(img);
    }
    const txt = document.createElement('div');
    txt.className = 'sc-dock-txt';
    const lab = document.createElement('span'); lab.textContent = 'Demo bạn chọn';
    const nm = document.createElement('strong'); nm.textContent = d.title;
    txt.append(lab, nm);
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'sc-dock-x'; x.setAttribute('aria-label', 'Bỏ chọn demo'); x.textContent = '✕';
    x.addEventListener('click', () => {
      dock.remove();
      try { sessionStorage.removeItem('corespark:inquiry'); } catch {}
      window.dispatchEvent(new CustomEvent('corespark:inquiry-clear'));
    });
    dock.append(txt, x);
    host.insertBefore(dock, host.firstChild);
    return dock;
  }

  /* ---------- HÀM G: chip hiện ra, vé tan đi, vòng sóng kính lan ra ---------- */
  function landTicket(ticket, dock) {
    dock.classList.add('is-in');
    gsap.fromTo(dock, { scale: 0.94 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' });
    const ring = document.createElement('i');
    ring.className = 'sc-ring';
    dock.appendChild(ring);
    gsap.fromTo(ring, { scale: 1, opacity: 0.45 }, { scale: 1.35, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => ring.remove() });
    gsap.to(ticket, { opacity: 0, scale: 0.8, duration: 0.25, ease: 'power2.in', onComplete: () => { ticket.remove(); flying = false; } });
  }

  /* ---------- HÀM H: vé bay theo đường cong tới chip. Đích được đo LẠI mỗi khung hình
     nên vẫn đúng khi trang đang cuộn (Lenis) ---------- */
  function flyTicket(ticket, d, contactEl) {
    const dock = mountDock(d, contactEl);
    if (!ticket) { dock.classList.add('is-in'); flying = false; return; }   // giảm chuyển động: hiện chip luôn

    gsap.killTweensOf(ticket);                                   // dừng nảy/lơ lửng
    const a = ticket.getBoundingClientRect();
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2;  // điểm xuất phát
    const rot0 = Number(gsap.getProperty(ticket, 'rotation')) || 0;
    const p = { v: 0 };

    gsap.to(p, {
      v: 1, duration: 1.6, ease: 'power3.inOut',
      onUpdate: () => {
        const r = dock.getBoundingClientRect();
        const tx = r.left + r.width / 2, ty = r.top + r.height / 2;   // đích hiện tại
        const arc = Math.sin(Math.PI * p.v);                          // 0 → 1 → 0: độ cong của đường bay
        gsap.set(ticket, {
          x: sx + (tx - sx) * p.v + arc * 70,
          y: sy + (ty - sy) * p.v,
          rotation: rot0 * (1 - p.v) + arc * 8,
          scale: 1 - 0.15 * p.v,
        });
      },
      onComplete: () => landTicket(ticket, dock),
    });
  }

  /* ----- Gắn sự kiện ----- */
  loader.addEventListener('click', () => { if (loader.classList.contains('is-lite')) openFull(); });
  closeBtn.addEventListener('click', () => requestClose());
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  reloadBtn.addEventListener('click', () => { if (iframe) { loader.classList.remove('is-done'); iframe.classList.remove('is-loaded'); iframe.src = iframe.src; } });
  copyBtn.addEventListener('click', copyLink);
  devBtns.forEach((b) => b.addEventListener('click', () => setDevice(b.dataset.d, true)));

  // "Tôi muốn web như này": đóng khung, lưu tên demo, báo cho phần Liên hệ rồi cuộn xuống
    // "Tôi muốn web như này": vé nảy ra từ nút, viewer thu về thẻ, rồi vé bay xuống Liên hệ và dính vào form
  wantBtn.addEventListener('click', () => {
    if (flying) return;
    flying = true;
    const d = cur;
    const detail = { slug: d.slug, title: d.title };
    try { sessionStorage.setItem('corespark:inquiry', JSON.stringify(detail)); } catch {}
    window.dispatchEvent(new CustomEvent('corespark:inquiry', { detail }));

    const ticket = launchTicket(d, wantBtn);
    const bail = setTimeout(() => { ticket?.remove(); flying = false; }, 5000);   // an toàn: không để vé kẹt lại

    requestClose(() => {
      clearTimeout(bail);
      const target = document.querySelector('#contact');
      if (!target) { ticket?.remove(); flying = false; return; }
      flyTicket(ticket, d, target);                    // đặt chip + bắt đầu bay TRƯỚC khi cuộn
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
  let crashed = null, dev = null;
  try {
    crashed = sessionStorage.getItem('sc:loading'); sessionStorage.removeItem('sc:loading');
    dev = sessionStorage.getItem('sc:device');      sessionStorage.removeItem('sc:device');
  } catch {}
  if (crashed === s) {
    history.replaceState(null, '', location.pathname + location.search);
    return;
  }
  if (dev === 'desktop') setDevice('desktop', true);   // khôi phục tab Máy tính (chế độ nhẹ)
  open(s, null, { push: false });
},
  };
}