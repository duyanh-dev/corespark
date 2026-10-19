(() => {
  if (!window.gsap || !window.THREE) return;
  gsap.registerPlugin(ScrollTrigger);
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => gsap.utils.toArray(s);
  const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;

  /* ---------- PRELOADER: app screens SNAP onto a stack, the shutter floods yellow, curtains open ---------- */
  history.scrollRestoration = "manual"; scrollTo(0, 0);
  document.documentElement.style.overflow = "hidden";
  const shots = ["camera01", "home01", "tag01", "calendar01", "setting01", "home02"];
  const pre = document.createElement("div");
  pre.className = "pre";
  pre.innerHTML = '<div class="pre-half t"></div><div class="pre-half b"></div><div class="pre-ui">' +
    '<div class="pre-word"><span>F</span><span>i</span><span>n</span><span class="y">S</span><span class="y">n</span><span class="y">a</span><span class="y">p</span></div>' +
    '<div class="pre-shake"><div class="pre-stack">' + shots.map((n) => `<div class="pre-card"><img src="./images/${n}.jpg" alt=""></div>`).join("") + "</div></div>" +
    '<div class="pre-disc"></div></div><div class="pre-flash"></div>';
  document.body.prepend(pre);
  document.body.classList.add("pre-ready");
  const disc = $(".pre-disc"), shake = $(".pre-shake"), pcards = $$(".pre-card"), N = pcards.length, pmid = (N - 1) / 2;
  gsap.set(pcards, { opacity: 0 });
  gsap.from(".pre-word span", { yPercent: 110, stagger: 0.06, duration: 0.9, ease: "power4.out", delay: 0.2 });
  let tiltMove;
  if (fine) {
    const rx = gsap.quickTo(shake, "rotationX", { duration: 0.6 }), ry = gsap.quickTo(shake, "rotationY", { duration: 0.6 });
    gsap.set(shake, { transformPerspective: 900 });
    tiltMove = (e) => { ry((e.clientX / innerWidth - 0.5) * 24); rx(-(e.clientY / innerHeight - 0.5) * 24); };
    addEventListener("pointermove", tiltMove);
  }
  const imgs = [...document.images]; let got = 0, loaded = document.readyState === "complete";
  imgs.forEach((im) => (im.complete ? got++ : ["load", "error"].forEach((ev) => im.addEventListener(ev, () => got++, { once: true }))));
  addEventListener("load", () => (loaded = true));
  const t0 = performance.now(), easeIO = gsap.parseEase("power2.inOut"), rnd = (a) => (Math.random() - 0.5) * 2 * a;
  let snapped = 0, busy = false, over = false;

  // every loaded chunk = one more screen slams onto the stack (no counter, no bar)
  const fan = () => pcards.slice(0, snapped).forEach((el, k) => {
    const o = k - (snapped - 1) / 2;
    gsap.to(el, { rotation: o * 8, x: o * Math.min(innerWidth * 0.05, 46), y: Math.abs(o) * 8, duration: 0.6, ease: "back.out(2)", overwrite: "auto" });
  });
  const snap = () => {
    busy = true;
    gsap.fromTo(pcards[snapped], { z: -1800, x: rnd(500), y: rnd(350), rotation: rnd(50), rotationX: rnd(40), rotationY: rnd(40), opacity: 0 },
      { z: 0, x: 0, y: 0, rotation: 0, rotationX: 0, rotationY: 0, opacity: 1, duration: 0.42, ease: "power4.in",
        onComplete: () => {
          snapped++; busy = false; fan();
          gsap.fromTo(".pre-flash", { opacity: 0.25 }, { opacity: 0, duration: 0.35, ease: "power2.out" });
          gsap.fromTo(disc, { scale: 0.8 }, { scale: 1, duration: 0.6, ease: "elastic.out(1,0.4)" });
          gsap.fromTo(shake, { y: 12, scale: 1.03 }, { y: 0, scale: 1, duration: 0.6, ease: "elastic.out(1,0.35)" });
        } });
  };
  const heroReady = () => { heroIntro.play(); dispatchEvent(new Event("fs:ready")); };
  const finish = () => {
    if (over) return; over = true; gsap.ticker.remove(step);
    const r = disc.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(innerWidth - cx, cy), Math.hypot(cx, innerHeight - cy), Math.hypot(innerWidth - cx, innerHeight - cy));
    const flood = (far / (disc.offsetWidth / 2)) * 1.05;
    gsap.killTweensOf([...pcards, disc, shake]);
    gsap.timeline({ onComplete: () => { if (tiltMove) removeEventListener("pointermove", tiltMove); pre.remove(); document.documentElement.style.overflow = ""; ScrollTrigger.refresh(); } })
      .to(".pre-word span", { yPercent: -110, stagger: 0.03, duration: 0.4, ease: "power3.in" })
      .to(pcards, { z: 900, x: (i) => (i - pmid) * 170, rotation: (i) => (i - pmid) * 14, opacity: 0, stagger: 0.03, duration: 0.5, ease: "power3.in" }, "<")
      .to(disc, { scale: 0.8, duration: 0.18, ease: "power2.in" }, "<0.15")
      .set(".pre-flash", { opacity: 0.9 })
      .to(".pre-flash", { opacity: 0, duration: 0.4, ease: "power2.out" })
      .to(disc, { scale: flood, duration: 0.75, ease: "expo.in" }, "<")
      .set(".pre-half", { backgroundColor: "#ffd700" })
      .set(disc, { display: "none" })
      .to(".pre-half.t", { yPercent: -100, duration: 0.95, ease: "expo.inOut" })
      .to(".pre-half.b", { yPercent: 100, duration: 0.95, ease: "expo.inOut" }, "<")
      .add(heroReady, "-=0.6");
  };
  const step = () => {
    const t = Math.min((performance.now() - t0) / 2200, 1);
    const prog = Math.min(easeIO(t), loaded ? 1 : Math.min(0.92, got / Math.max(imgs.length, 1)));
    if (!busy && snapped < Math.min(N, Math.floor(prog * N + 0.001))) snap();
    if (snapped >= N && !busy && loaded && t >= 1) finish();
  };
  gsap.ticker.add(step);
  setTimeout(finish, 9000);

  /* ---------- HERO INTRO ---------- */
  const heroIntro = gsap
    .timeline({ defaults: { ease: "power4.out" }, paused: true })
    .from(".hero-badge", { y: 30, opacity: 0, duration: 0.8 })
    .from(".hero h1", { yPercent: 40, rotationX: -60, opacity: 0, transformOrigin: "0% 100%", duration: 1.2 }, "-=0.5")
    .from(".hero p", { y: 40, opacity: 0, duration: 1 }, "-=0.8")
    .from(".hero-buttons > *", { y: 50, opacity: 0, scale: 0.8, stagger: 0.12, duration: 0.9, ease: "back.out(1.7)" }, "-=0.7");

  /* ---------- SCROLL REVEALS ---------- */
  const els = $$(".reveal").filter((e) => !e.closest(".hero"));
  gsap.set(els, { y: 70, opacity: 0 });
  ScrollTrigger.batch(els, {
    start: "top 90%",
    once: true,
    onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, stagger: 0.12, duration: 1, ease: "power3.out", overwrite: true }),
  });
  gsap.fromTo(".philosophy", { clipPath: "inset(10% 8% round 80px)" },
    { clipPath: "inset(0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: ".philosophy", start: "top 100%", end: "top 30%", scrub: true } });
  gsap.from(".philosophy h2", { scale: 0.7, ease: "none", scrollTrigger: { trigger: ".philosophy", start: "top 80%", end: "center center", scrub: true } });
  gsap.from(".step-number, .sc-number", { scale: 0, rotation: -180, stagger: 0.15, duration: 0.9, ease: "back.out(2)", scrollTrigger: { trigger: ".shortcut-steps", start: "top 80%" } });

  /* ---------- STICKY FEATURES ---------- */
  const plateC = ["rgb(255,215,0)", "rgb(245,245,247)", "rgb(255,107,107)", "rgb(90,200,250)", "rgb(198,255,61)"];
  const plateR = [-6, 5, -4, 7, -8];
  const cluster = $(".phone-cluster");
  if (cluster) gsap.set(cluster, { "--plate-c": plateC[0], "--plate-r": "-6deg" });
  $$(".screen-slider").forEach((s) => {
    new MutationObserver(() => {
      if (!s.classList.contains("active")) return;
      const i = +s.dataset.index;
      gsap.to(cluster, { "--plate-c": plateC[i], "--plate-r": plateR[i] + "deg", duration: 0.9, ease: "back.out(1.6)" });
      gsap.fromTo(s.querySelector(".phone-frame"), { rotationY: -70, scale: 0.88, transformPerspective: 1000 },
        { rotationY: 0, scale: 1, duration: 1.1, ease: "elastic.out(1,0.6)" });
    }).observe(s, { attributes: true, attributeFilter: ["class"] });
  });
  $$(".feature-block").forEach((b) => {
    new MutationObserver(() => {
      if (b.classList.contains("active"))
        gsap.fromTo(b.querySelectorAll("h3,p,li"), { x: -50, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.08, duration: 0.8, ease: "power3.out", overwrite: true });
    }).observe(b, { attributes: true, attributeFilter: ["class"] });
  });

  /* ---------- CURSOR / MAGNETIC / TILT ---------- */
  const cur = $(".cursor");
  const cursorGrow = (on) => gsap.to(cur, { scale: on ? 2.2 : 1, duration: 0.3, overwrite: "auto" });
  if (fine && cur) {
    gsap.set(cur, { xPercent: -50, yPercent: -50, opacity: 0 });
    const cx = gsap.quickTo(cur, "x", { duration: 0.35, ease: "power3" });
    const cy = gsap.quickTo(cur, "y", { duration: 0.35, ease: "power3" });
    addEventListener("mousemove", (e) => { gsap.set(cur, { opacity: 1 }); cx(e.clientX); cy(e.clientY); });
    $$("a,button,.phone-frame,.qr-card,.sc-step").forEach((el) => {
      el.addEventListener("mouseenter", () => cursorGrow(true));
      el.addEventListener("mouseleave", () => cursorGrow(false));
    });
    $$(".cta-btn,.nav-btn,.store-badge,.footer-link,.submit-btn,.ft-pill,.ft-top").forEach((b) => {
      const xTo = gsap.quickTo(b, "x", { duration: 0.6, ease: "elastic.out(1,0.5)" });
      const yTo = gsap.quickTo(b, "y", { duration: 0.6, ease: "elastic.out(1,0.5)" });
      b.addEventListener("mousemove", (e) => {
        const r = b.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.35);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      b.addEventListener("mouseleave", () => { xTo(0); yTo(0); });
    });
    $$(".phone-frame,.qr-card,.sc-step").forEach((el) => {
      const max = el.classList.contains("sc-step") ? 8 : 12;
      const rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3" });
      const ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3" });
      gsap.set(el, { transformPerspective: 900 });
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * max * 2);
        rx(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
      });
      el.addEventListener("mouseleave", () => { rx(0); ry(0); });
    });
  }

  /* ---------- FOOTER ---------- */
  const letters = $$(".ft-word span");
  if (letters.length) {
    gsap.from(letters, { yPercent: 110, stagger: 0.07, duration: 1.2, ease: "power4.out", scrollTrigger: { trigger: ".ft-word", start: "top 95%" } });
    letters.forEach((l) => l.addEventListener("mouseenter", () => gsap.fromTo(l, { yPercent: 0 }, { yPercent: -14, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.out" })));
  }
  const word = $(".ft-word");
  if (word) {
    const fit = () => { word.style.fontSize = "100px"; const sum = [...word.children].reduce((s, c) => s + c.getBoundingClientRect().width, 0); if (sum) word.style.fontSize = (100 * innerWidth / sum) * 0.985 + "px"; };
    fit(); addEventListener("resize", fit); if (document.fonts) document.fonts.ready.then(fit);
  }
  const toTop = $(".ft-top");
  if (toTop) toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

  /* ---------- UNFOLD SECTION (scroll-scrubbed, pinned) ---------- */
  const un = document.createElement("section");
  un.className = "unfold";
  un.innerHTML = '<div class="unfold-dark"></div><div class="unfold-deck">' +
    ["camera01", "home01", "tag01", "calendar01", "setting01", "camera02", "home02"].map((n) => `<div class="unfold-card"><img src="./images/${n}.jpg" alt="" draggable="false"></div>`).join("") + "</div>";
  $(".philosophy").after(un);
  const cards = $$(".unfold-card"), mid = (cards.length - 1) / 2;
  gsap.set(cards, { rotation: (i) => (i - mid) * 2, scale: 0.7, zIndex: (i) => 20 - Math.abs(i - mid), transformOrigin: "50% 100%" });
  gsap.timeline({ scrollTrigger: { trigger: un, start: "top top", end: "+=320%", scrub: 1, pin: true, invalidateOnRefresh: true } })
    .to(".unfold-dark", { clipPath: "circle(75% at 50% 50%)", duration: 1, ease: "power2.inOut" })
    .to(cards, { rotation: (i) => (i - mid) * 9, x: (i) => (i - mid) * innerWidth * 0.05, y: (i) => Math.pow(Math.abs(i - mid), 2) * 14, scale: 0.9, duration: 1, ease: "power2.out" })
    .to(cards, { rotation: 0, x: (i) => (i - mid) * Math.min(innerWidth * 0.13, 190), y: 0, scale: 1, duration: 1.2, ease: "power3.inOut" })
    .to(cards, { y: (i) => (i % 2 ? -42 : 42), scale: 1.04, duration: 0.8, ease: "power2.out" });

  /* ---------- SECTION TRANSITIONS ---------- */
  const rad = innerWidth > 900 ? 56 : 36;
  gsap.fromTo(".hero > *:not(.hero-stage)", { opacity: 1, y: 0 }, { opacity: 0, y: -60, immediateRender: false, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "75% top", scrub: true } });
  gsap.fromTo(".shortcut-guide", { clipPath: `inset(7% 4% 0% 4% round ${rad}px ${rad}px 0 0)` }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: ".shortcut-guide", start: "top 100%", end: "top 25%", scrub: true } });
  gsap.from(".guide-container", { scale: 0.86, yPercent: 8, ease: "none", scrollTrigger: { trigger: ".expo-guide", start: "top 100%", end: "top 30%", scrub: true } });
  gsap.fromTo(".ft", { clipPath: `inset(10% 5% 0% 5% round ${rad}px ${rad}px 0 0)` }, { clipPath: `inset(0% 0% 0% 0% round ${rad}px ${rad}px 0 0)`, ease: "none", scrollTrigger: { trigger: ".ft", start: "top 100%", end: "top 40%", scrub: true } });

  /* ---------- THREE.JS HERO STAGE ---------- */
  const stage = document.createElement("div");
  stage.className = "hero-stage";
  $(".hero").appendChild(stage);
  if (fine) {
    stage.addEventListener("mouseenter", () => cursorGrow(true));
    stage.addEventListener("mouseleave", () => cursorGrow(false));
  }
  const canvas = $("#stage");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch (e) { stage.remove(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  cam.position.z = 11;

  // studio reflections (soft light panels) so metal and glass read as real
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x1a1a1c);
  const panel = (w, h, d, x, y, z, c) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]) }));
    m.position.set(x, y, z); envScene.add(m);
  };
  panel(14, 0.6, 14, 0, 9, 0, [4, 4, 4]); panel(0.6, 12, 7, -9, 0, 2, [2.5, 2.5, 2.5]);
  panel(0.6, 12, 7, 9, 0, -2, [2.5, 2, 0.9]); panel(14, 12, 0.6, 0, 0, -9, [1.5, 1.5, 1.6]); panel(8, 0.6, 8, 0, -8, 3, [1, 1, 1]);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.03).texture;
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));
  const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(3, 5, 6); scene.add(key);

  const rr = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  const ext = (shape, depth, b = 0) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 4, curveSegments: 32 });
  const uvGeo = (w, h, r) => {
    const g = new THREE.ShapeGeometry(rr(w, h, r), 32), p = g.attributes.position, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) u.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
    return g;
  };
  const mat = (c, ro = 0.45, me = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: ro, metalness: me });
  const mTi = new THREE.MeshStandardMaterial({ color: 0xb8b3aa, metalness: 1, roughness: 0.28 });
  const mBlack = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
  const mBack = new THREE.MeshPhysicalMaterial({ color: 0xffd700, roughness: 0.4, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const rig = new THREE.Group(); scene.add(rig);

  // iPhone 18 Pro Max: unibody aluminium rail, colour-matched glass back, full-width camera plateau, slim bezels
  const W = 1.6, H = 3.37;
  const cols = [0xe4661f, 0x5c1f2e, 0xa7bcc8, 0x1e1e20]; // orange, burgundy, glacier, black
  const mAl = new THREE.MeshStandardMaterial({ color: cols[0], metalness: 0.85, roughness: 0.38 });
  const mGlass = new THREE.MeshPhysicalMaterial({ color: cols[0], roughness: 0.5, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.35 });
  const mPlate = new THREE.MeshPhysicalMaterial({ color: cols[0], roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 });
  const mDark = new THREE.MeshStandardMaterial({ color: 0x2a2a2d, metalness: 0.9, roughness: 0.3 });
  const setColor = (hex) => { const c = new THREE.Color(hex); [mAl, mGlass, mPlate].forEach((m) => gsap.to(m.color, { r: c.r, g: c.g, b: c.b, duration: 0.8, ease: "power2.inOut" })); };
  const phone = new THREE.Group(); rig.add(phone);
  const ringShape = rr(W, H, 0.3); ringShape.holes.push(rr(W - 0.07, H - 0.07, 0.265));
  const ring = new THREE.Mesh(ext(ringShape, 0.15, 0.015), mAl); ring.position.z = -0.075; phone.add(ring);
  const slab = new THREE.Mesh(ext(rr(W - 0.06, H - 0.06, 0.27), 0.15), mGlass); slab.position.z = -0.075; phone.add(slab);
  const glass = new THREE.Mesh(ext(rr(W - 0.06, H - 0.06, 0.27), 0.004), mBlack); glass.position.z = 0.075; phone.add(glass);
  const tex = ["camera01", "home01", "tag01", "calendar01"].map((n) => {
    const t = new THREE.TextureLoader().load(`./images/${n}.jpg`);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  });
  const screen = new THREE.Mesh(uvGeo(W - 0.13, H - 0.13, 0.2), new THREE.MeshBasicMaterial({ map: tex[0], toneMapped: false }));
  screen.position.z = 0.0805; phone.add(screen);
  const sheen = new THREE.Mesh(uvGeo(W - 0.13, H - 0.13, 0.2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.05, depthWrite: false }));
  sheen.position.z = 0.0815; phone.add(sheen);
  const btn = (x, y, hh) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, hh, 0.06), mAl); b.position.set(x, y, 0); phone.add(b); };
  btn(W / 2 + 0.012, 0.55, 0.45); btn(W / 2 + 0.01, -0.45, 0.22);
  btn(-W / 2 - 0.012, 1.05, 0.14); btn(-W / 2 - 0.012, 0.62, 0.26); btn(-W / 2 - 0.012, 0.25, 0.26);
  const py = H / 2 - 0.47;
  const plate = new THREE.Mesh(ext(rr(W - 0.06, 0.82, 0.2), 0.05, 0.008), mPlate); plate.position.set(0, py, -0.133); phone.add(plate);
  const cyl = (r, d, m, x, y, z) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d, 48), m); c.rotation.x = Math.PI / 2; c.position.set(x, y, z); phone.add(c); };
  [[0.45, 0.17], [0.45, -0.2], [0.12, -0.015]].forEach(([lx, ly]) => {
    cyl(0.165, 0.03, mDark, lx, py + ly, -0.156); cyl(0.125, 0.036, mBlack, lx, py + ly, -0.159); cyl(0.07, 0.04, mat(0x1b2a4a, 0.2, 0.3), lx, py + ly, -0.161);
  });
  cyl(0.06, 0.012, mat(0xfff3d0, 0.3, 0), -0.6, py + 0.2, -0.147); cyl(0.024, 0.012, mDark, -0.6, py, -0.147); cyl(0.07, 0.012, mBlack, -0.6, py - 0.2, -0.147);

  let w = innerWidth, h = innerHeight, unit = 0.01;
  const resize = () => {
    w = innerWidth; h = innerHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    unit = (2 * cam.position.z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / h;
  };
  resize();
  addEventListener("resize", () => { resize(); ScrollTrigger.refresh(); });
  addEventListener("load", () => ScrollTrigger.refresh());

  let p = 0;
  ScrollTrigger.create({ trigger: stage, start: "center 40%", end: "bottom 10%", scrub: true, onUpdate: (s) => { p = s.progress; canvas.style.opacity = 1 - p; } });

  // drag to spin (mouse + touch), tap to flip and change screen
  const S = { spinT: 0 };
  let spin = 0, tiltT = 0, tilt = 0, drag = false, lx = 0, ly = 0, moved = 0, idx = 0, mx = 0, my = 0, smx = 0, smy = 0;
  S.spinT = -Math.PI * 2; spin = S.spinT;
  addEventListener("fs:ready", () => gsap.to(S, { spinT: 0, duration: 2.2, ease: "power3.out" }));
  stage.addEventListener("pointerdown", (e) => { drag = true; lx = e.clientX; ly = e.clientY; moved = 0; gsap.killTweensOf(S); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    S.spinT += dx * 0.013;
    if (e.pointerType === "mouse") tiltT = gsap.utils.clamp(-0.6, 0.6, tiltT + dy * 0.008);
  });
  const release = (tap) => {
    if (!drag) return;
    drag = false; tiltT = 0;
    if (tap && moved < 8) {
      S.spinT += Math.PI * 2;
      gsap.delayedCall(0.4, () => { idx = (idx + 1) % tex.length; setColor(cols[idx]); screen.material.map = tex[idx]; screen.material.needsUpdate = true; });
      gsap.fromTo(phone.scale, { x: 1, y: 1, z: 1 }, { x: 1.1, y: 1.1, z: 1.1, duration: 0.3, yoyo: true, repeat: 1, ease: "power2.out" });
    } else gsap.to(S, { spinT: Math.round(S.spinT / Math.PI) * Math.PI, duration: 0.9, ease: "elastic.out(1,0.6)" });
  };
  stage.addEventListener("pointerup", () => release(true));
  stage.addEventListener("pointercancel", () => release(false));
  if (fine) addEventListener("mousemove", (e) => { mx = (e.clientX / w - 0.5) * 2; my = (e.clientY / h - 0.5) * 2; });

  const clock = new THREE.Clock();
  (function tick() {
    requestAnimationFrame(tick);
    const r = stage.getBoundingClientRect();
    if (p >= 0.999 || r.bottom < 0 || r.top > h) return;
    const t = clock.getElapsedTime();
    if (!fine) { mx = Math.sin(t * 0.5) * 0.5; my = Math.cos(t * 0.4) * 0.2; }
    smx += (mx - smx) * 0.06; smy += (my - smy) * 0.06;
    spin += (S.spinT - spin) * (drag ? 0.3 : 0.08); tilt += (tiltT - tilt) * 0.15;
    phone.rotation.set(smy * 0.2 + tilt + Math.sin(t * 0.6) * 0.04, smx * 0.45 + spin + p * Math.PI * 2, Math.sin(t * 0.4) * 0.03 - p * 0.3);
    phone.position.y = Math.sin(t) * 0.1;
    const Hpx = Math.min(r.height * (w > 900 ? 0.8 : 0.88), r.width * 1.9);
    rig.position.set((r.left + r.width / 2 - w / 2) * unit, (h / 2 - (r.top + r.height / 2)) * unit, 0);
    rig.scale.setScalar((Hpx * unit / H) * (1 - p * 0.35));
    renderer.render(scene, cam);
  })();
})();