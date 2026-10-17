---
/* =========================================================
   PRELOADER.ASTRO - Giọt kính lỏng (liquid glass), không gradient
   Thấu kính nở ra để lộ trang (SVG mask), sự kiện "corespark:reveal"
   báo cho Hero bắt đầu animation đúng lúc trang lộ ra
   ========================================================= */
const brand = [...'CoreSpark'];
---

<!-- Khóa cuộn trang NGAY khi trình duyệt đọc tới đây (trước khi module chạy) + chốt an toàn 12s -->
<script is:inline>
  document.documentElement.classList.add('is-loading');
  setTimeout(function () { document.documentElement.classList.remove('is-loading'); }, 12000);
</script>
<noscript><style>#preloader{display:none!important}html.is-loading{overflow:auto!important}</style></noscript>

<div class="pl" id="preloader" role="status" aria-live="polite" aria-label="Đang tải">
  <!-- Màn che đặc, có "lỗ tròn" (mask) sẽ nở ra lúc kết thúc -->
  <svg class="pl-veil" aria-hidden="true">
    <defs>
      <mask id="pl-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
        <rect width="100%" height="100%" fill="#fff" />
        <circle id="pl-hole" cx="50%" cy="50%" r="0" fill="#000" />
      </mask>
    </defs>
    <rect class="pl-veil-rect" width="100%" height="100%" mask="url(#pl-mask)" />
  </svg>

  <!-- Gốc toạ độ = tâm màn hình -->
  <div class="pl-stage">
    <!-- 3 viên màu phẳng quay quanh, nằm SAU kính nên bị khúc xạ -->
    <span class="pl-blob"><i style="background:#0a84ff"></i></span>
    <span class="pl-blob"><i style="background:#bf5af2"></i></span>
    <span class="pl-blob"><i style="background:#ff6b8a"></i></span>

    <div class="pl-orb"></div>

    <svg class="pl-ring" viewBox="0 0 200 200" aria-hidden="true">
      <circle class="pl-ring-track" cx="100" cy="100" r="96" />
      <circle class="pl-ring-bar" cx="100" cy="100" r="96" />
    </svg>

    <div class="pl-core"><div class="pl-num"><span id="pl-num">0</span><small>%</small></div></div>

    <div class="pl-text">
      <div class="pl-brand" aria-hidden="true">
        {brand.map((c) => <span class="pl-chw"><span class="pl-ch">{c}</span></span>)}
      </div>
      <p class="pl-status" id="pl-status">Ý tưởng</p>
    </div>
  </div>
</div>

<style is:global>
  html.is-loading { overflow: hidden; }

  .pl {
    position: fixed; inset: 0; z-index: 9999; overflow: hidden; touch-action: none;
    color: var(--text, #1d1d1f);
    --o: 11rem;          /* đường kính giọt kính */
    --b: 5rem;           /* đường kính viên màu */
    animation: pl-failsafe 0s linear 12s forwards;   /* nếu JS lỗi, tự ẩn sau 12s */
  }
  @keyframes pl-failsafe { to { opacity: 0; visibility: hidden; pointer-events: none; } }

  .pl-veil { position: absolute; inset: 0; width: 100%; height: 100%; }
  .pl-veil-rect { fill: var(--bg, #fbfbfd); }
  .pl-stage { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }

  /* Viên màu */
  .pl-blob { position: absolute; left: calc(var(--b) / -2); top: calc(var(--b) / -2); width: var(--b); height: var(--b); will-change: transform; }
  .pl-blob i { display: block; width: 100%; height: 100%; border-radius: 50%; opacity: 0; }

  /* Giọt kính: nền trong + nhòe + tăng bão hòa, độ sâu bằng bóng đổ trong (không gradient) */
  .pl-orb {
    --spec: 1;
    position: absolute; left: calc(var(--o) / -2); top: calc(var(--o) / -2); width: var(--o); height: var(--o);
    border-radius: 50%; opacity: 0; will-change: transform, border-radius;
    background: rgba(255, 255, 255, .26);
    -webkit-backdrop-filter: blur(18px) saturate(190%); backdrop-filter: blur(18px) saturate(190%);
    border: 1px solid rgba(255, 255, 255, .85);
    box-shadow:
      0 24px 60px rgba(20, 30, 60, .16),
      inset 0 2px 0 rgba(255, 255, 255, .95),
      inset 0 -12px 26px rgba(255, 255, 255, .32),
      inset 10px 0 22px rgba(255, 255, 255, .22),
      inset -10px 0 22px rgba(255, 255, 255, .14);
  }
  /* Hai vệt sáng phẳng (điểm sáng phản chiếu) */
  .pl-orb::before, .pl-orb::after { content: ''; position: absolute; background: #fff; border-radius: 50%; opacity: var(--spec); }
  .pl-orb::before { left: 15%; top: 10%; width: 36%; height: 17%; transform: rotate(-30deg); filter: blur(1.5px); opacity: calc(var(--spec) * .8); }
  .pl-orb::after { right: 17%; bottom: 14%; width: 9%; height: 9%; filter: blur(1px); opacity: calc(var(--spec) * .45); }

  /* Vòng tiến độ */
  .pl-ring { position: absolute; width: calc(var(--o) * 1.27); height: calc(var(--o) * 1.27); left: calc(var(--o) * -.635); top: calc(var(--o) * -.635); transform: rotate(-90deg); opacity: 0; overflow: visible; }
  .pl-ring circle { fill: none; stroke-linecap: round; }
  .pl-ring-track { stroke: rgba(60, 60, 67, .12); stroke-width: 2.5; }
  .pl-ring-bar { stroke: var(--accent, #0a84ff); stroke-width: 3.5; filter: drop-shadow(0 0 6px rgba(10, 132, 255, .5)); }

  /* Số đếm trong kính */
  .pl-core { position: absolute; left: calc(var(--o) / -2); top: calc(var(--o) / -2); width: var(--o); height: var(--o); display: grid; place-items: center; opacity: 0; }
  .pl-num { font-size: calc(var(--o) * .3); font-weight: 600; letter-spacing: -.03em; font-variant-numeric: tabular-nums; line-height: 1; }
  .pl-num small { font-size: .38em; margin-left: .12em; color: var(--text-dim, #6e6e73); font-weight: 500; }

  /* Tên thương hiệu + trạng thái */
  .pl-text { position: absolute; left: 0; top: calc(var(--o) / 2 + 3.2rem); transform: translateX(-50%); width: max-content; text-align: center; opacity: 0; }
  .pl-brand { font-size: clamp(1.7rem, 4vw, 2.4rem); font-weight: 600; letter-spacing: -.025em; line-height: 1.2; }
  .pl-chw { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: .14em; }
  .pl-ch { display: inline-block; }
  .pl-status { margin-top: .35rem; font-size: .8rem; letter-spacing: .14em; text-transform: uppercase; color: var(--text-dim, #6e6e73); }

  @media (max-width: 640px) { .pl { --o: 9rem; --b: 4rem; } }
</style>

<script>
  import gsap from 'gsap';

  const root = document.getElementById('preloader');
  if (root) {
    const html = document.documentElement;
    const q = (s) => root.querySelector(s);
    const orb = q('.pl-orb'), ringEl = q('.pl-ring'), bar = q('.pl-ring-bar'), core = q('.pl-core');
    const textEl = q('.pl-text'), num = q('#pl-num'), status = q('#pl-status'), hole = q('#pl-hole');
    const letters = [...root.querySelectorAll('.pl-ch')];
    const blobs = [...root.querySelectorAll('.pl-blob')];
    const inners = blobs.map((b) => b.firstElementChild);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const STEPS = ['Ý tưởng', 'Thiết kế', 'Code', 'Ra mắt'];
    const C = 2 * Math.PI * 96;                       // chu vi vòng tiến độ
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    /* Chặn cuộn trong lúc tải (kể cả Lenis) */
    ['wheel', 'touchmove'].forEach((t) =>
      root.addEventListener(t, (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false }));
    let lenisStopped = false;

    let revealed = false;
    const reveal = () => { if (revealed) return; revealed = true; window.dispatchEvent(new CustomEvent('corespark:reveal')); };
    const orbit = () => {};                            // gán lại bên dưới
    const done = () => {
      gsap.ticker.remove(orbitTick);
      html.classList.remove('is-loading');
      window.__lenis?.start?.();
      root.remove();
    };

    /* ----- Tiến độ: số, vòng, dòng trạng thái ----- */
    const prog = { v: 0 };
    let step = -1;
    bar.style.strokeDasharray = C;
    bar.style.strokeDashoffset = C;
    const render = () => {
      num.textContent = Math.round(prog.v);
      bar.style.strokeDashoffset = C * (1 - prog.v / 100);
      const s = Math.min(3, Math.floor(prog.v / 25));
      if (s !== step) {
        step = s;
        status.textContent = STEPS[s];
        gsap.fromTo(status, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
      }
    };

    /* ----- 3 viên màu quay quanh giọt kính, hút vào tâm khi st.conv -> 1 ----- */
    const st = { conv: 0 };
    const setX = blobs.map((b) => gsap.quickSetter(b, 'x', 'px'));
    const setY = blobs.map((b) => gsap.quickSetter(b, 'y', 'px'));
    function orbitTick(time) {
      if (!lenisStopped && window.__lenis) { window.__lenis.stop(); lenisStopped = true; }
      const R = (orb.offsetWidth / 2) * 1.3 * (1 - st.conv);
      blobs.forEach((_, i) => {
        const a = time * (0.9 + i * 0.25) + i * 2.09;
        const r = R * (1 + 0.1 * Math.sin(time * 1.3 + i));
        setX[i](Math.cos(a) * r);
        setY[i](Math.sin(a) * r * 0.8);
      });
    }

    /* ----- Chờ trang tải xong (tối đa 8s) ----- */
    const ready = Promise.all([
      new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))),
      document.fonts?.ready ?? 0,
    ]);
    const waitReady = () => Promise.race([ready, sleep(8000)]);

    async function run() {
      /* Bản giảm chuyển động: chỉ mờ dần */
      if (reduce) {
        await waitReady();
        reveal();
        gsap.to(root, { opacity: 0, duration: 0.35, onComplete: () => { html.classList.remove('is-loading'); window.__lenis?.start?.(); root.remove(); } });
        return;
      }

      /* ----- Giọt kính biến dạng như chất lỏng ----- */
      const rr = () => gsap.utils.random(43, 57, 1);
      const shape = () => `${rr()}% ${rr()}% ${rr()}% ${rr()}% / ${rr()}% ${rr()}% ${rr()}% ${rr()}%`;
      let morph;
      gsap.set(orb, { borderRadius: shape(), scale: 0.2 });
      const wobble = () => { morph = gsap.to(orb, { borderRadius: shape(), duration: 1.4, ease: 'sine.inOut', onComplete: wobble }); };
      wobble();

      gsap.set(letters, { yPercent: 110 });
      gsap.set(inners, { scale: 0.3 });
      gsap.set(textEl, { opacity: 1 });
      gsap.ticker.add(orbitTick);
      render();

      /* ----- Vào cảnh ----- */
      gsap.timeline()
        .to(orb, { opacity: 1, scale: 1, duration: 1.5, ease: 'elastic.out(1, 0.6)' }, 0)
        .to(inners, { opacity: 1, scale: 1, duration: 0.9, stagger: 0.12, ease: 'back.out(2)' }, 0.1)
        .to([ringEl, core], { opacity: 1, duration: 0.6 }, 0.35)
        .to(letters, { yPercent: 0, duration: 0.9, stagger: 0.045, ease: 'power4.out' }, 0.4);

      /* ----- Chạy tiến độ: tối thiểu ~2.2s, chờ trang tải xong mới lên 100 ----- */
      const minDone = new Promise((r) => gsap.to(prog, { v: 88, duration: 2.2, ease: 'power2.out', onUpdate: render, onComplete: r }));
      await Promise.all([minDone, waitReady()]);
      await new Promise((r) => gsap.to(prog, { v: 100, duration: 0.45, ease: 'power2.inOut', onUpdate: render, onComplete: r }));

      /* ----- Kết thúc: hút màu vào tâm, rồi thấu kính nở ra để lộ trang ----- */
      const R0 = orb.offsetWidth / 2;
      const Rmax = Math.hypot(innerWidth, innerHeight) / 2 * 1.08;
      const e = { r: R0 };
      const full = '50% 50% 50% 50% / 50% 50% 50% 50%';
      const tl = gsap.timeline({ onComplete: done });

      tl.to([core, ringEl, textEl], { opacity: 0, duration: 0.45, ease: 'power2.in' }, 0)
        .to(letters, { yPercent: -110, duration: 0.5, stagger: 0.03, ease: 'power3.in' }, 0)
        .to(st, { conv: 1, duration: 0.8, ease: 'power3.inOut' }, 0)
        .to(inners, { scale: 1.8, duration: 0.8, ease: 'power3.inOut' }, 0)
        .to(orb, { scale: 1.08, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.65)
        .add(() => morph.kill(), 0.8)
        .to(orb, { borderRadius: full, duration: 0.4, ease: 'power2.out' }, 0.8)
        .to(orb, { '--spec': 0, duration: 0.5 }, 1.0)
        .addLabel('expand', 1.05)
        .set(hole, { attr: { r: R0 } }, 'expand')
        .to(e, {
          r: Rmax, duration: 1.25, ease: 'power4.inOut',
          onUpdate: () => { hole.setAttribute('r', e.r); gsap.set(orb, { scale: e.r / R0 }); },
        }, 'expand')
        .to(inners, { opacity: 0, duration: 0.4 }, 'expand+=0.1')
        .call(reveal, null, 'expand+=0.55')
        .to(orb, { opacity: 0, duration: 0.55, ease: 'power1.in' }, 'expand+=0.85');
    }
    run();
  }
</script>