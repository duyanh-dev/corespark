/* =========================================================
   HERO3D.JS - Hero 3D: hệ hạt tự biến hình qua 4 hình
   01 Quả cầu (Ý tưởng) -> 02 Cửa sổ web (Thiết kế)
   -> 03 Chữ </> (Code) -> 04 Nút thắt (Ra mắt)
   Mọi chuyển động nằm trong vertex shader (chạy trên GPU)
   Cách dùng: const api = initHero3D(el); api.setShape(2);
   ========================================================= */
import * as THREE from 'three';
import gsap from 'gsap';

/* ---------- CẤU HÌNH ---------- */
// Tên 4 hình (dùng cho nhãn ở Hero.astro)
export const SHAPES = ['Ý tưởng', 'Thiết kế', 'Code', 'Ra mắt'];
// Màu phẳng (giá trị 0..1): xanh Apple (chính) + tím (điểm nhấn).
// Màu thứ 3 (trung tính: đen trên nền sáng, trắng trên nền tối) truyền qua options.neutral
const COLOR_A = new THREE.Vector3(0.039, 0.518, 1.0);    // xanh #0a84ff
const COLOR_C = new THREE.Vector3(0.749, 0.353, 0.949);  // tím #bf5af2

/* ---------- HÀM 1: số ngẫu nhiên trong khoảng [a, b] ---------- */
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

/* ---------- HÀM 2: lấy mẫu hạt từ hình vẽ canvas ----------
   Vẽ hình bằng canvas 2D, rồi chọn ngẫu nhiên các pixel có màu
   để làm vị trí hạt. Nhờ vậy vẽ gì cũng ra hình 3D được. */
function sampleCanvas(draw, count, scale, depth) {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = g.strokeStyle = '#fff';
  draw(g, S);

  // Gom các pixel đã được vẽ (alpha > 128)
  const data = g.getImageData(0, 0, S, S).data;
  const lit = [];
  for (let i = 0; i < S * S; i++) if (data[i * 4 + 3] > 128) lit.push(i);

  // Chọn ngẫu nhiên `count` pixel, đổi sang toạ độ 3D (z ngẫu nhiên theo độ dày)
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const px = lit[(Math.random() * lit.length) | 0];
    out[i * 3]     = (((px % S) + Math.random()) / S - 0.5) * scale;
    out[i * 3 + 1] = -((Math.floor(px / S) + Math.random()) / S - 0.5) * scale;
    out[i * 3 + 2] = rnd(-0.5, 0.5) * depth;
  }
  return out;
}

/* ---------- HÀM 3: hình 01 - quả cầu (Ý tưởng) ----------
   Rải đều điểm trên mặt cầu bằng công thức Fibonacci */
function shapeSphere(count) {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const R = 1.9 + rnd(-0.06, 0.06); // hơi lệch để bề mặt có độ dày
    out.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
  }
  return out;
}

/* ---------- HÀM 4: hình 02 - cửa sổ trình duyệt (Thiết kế) ---------- */
function shapeWindow(count) {
  return sampleCanvas((g) => {
    g.lineWidth = 8;
    g.strokeRect(40, 90, 432, 332);                       // khung ngoài
    g.beginPath(); g.moveTo(40, 140); g.lineTo(472, 140); g.stroke(); // vạch dưới thanh tiêu đề
    [70, 96, 122].forEach((x) => { g.beginPath(); g.arc(x, 115, 7, 0, 7); g.fill(); }); // 3 nút tròn
    g.lineWidth = 5; g.strokeRect(170, 100, 280, 30);     // thanh địa chỉ
    g.fillRect(70, 175, 170, 22);                         // tiêu đề giả
    g.fillRect(70, 215, 230, 10); g.fillRect(70, 238, 200, 10); // dòng chữ giả
    g.lineWidth = 6;
    [70, 194, 318].forEach((x) => g.strokeRect(x, 290, 110, 100)); // 3 thẻ
  }, count, 4.2, 0.35);
}

/* ---------- HÀM 5: hình 03 - chữ </> (Code) ---------- */
function shapeCode(count) {
  return sampleCanvas((g, S) => {
    g.font = 'bold 230px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('</>', S / 2, S / 2 + 10);
  }, count, 4.4, 0.6);
}

/* ---------- HÀM 6: hình 04 - nút thắt xoắn (Ra mắt) ---------- */
function shapeKnot(count) {
  const out = new Float32Array(count * 3);
  const k = 0.62;
  for (let i = 0; i < count; i++) {
    const t = rnd(0, Math.PI * 2);
    const r = 2 + Math.cos(3 * t);
    out.set([
      r * Math.cos(2 * t) * k + rnd(-0.12, 0.12),
      r * Math.sin(2 * t) * k + rnd(-0.12, 0.12),
      Math.sin(3 * t) * k * 1.3 + rnd(-0.12, 0.12),
    ], i * 3);
  }
  return out;
}

/* ---------- SHADER ---------- */
// Vertex shader: trộn 4 hình theo trọng số uW, thêm "thở", tản khi biến hình,
// đẩy hạt khỏi chuột, và nổ khi click
const VERT = /* glsl */`
  uniform float uTime;
  uniform vec4  uW;        // trọng số 4 hình (tổng = 1)
  uniform vec3  uMouse;    // vị trí chuột trong không gian của khối hạt
  uniform float uMouseOn;  // 0..1: chuột có đang ở trên khối không
  uniform float uPower;    // 0..1: độ nổ khi click
  uniform float uSize;
  uniform float uPR;       // pixel ratio
  attribute vec3 aS1;      // hình 2
  attribute vec3 aS2;      // hình 3
  attribute vec3 aS3;      // hình 4  (hình 1 là attribute "position")
  attribute float aRand;
  varying float vRand;

  void main() {
    // 1) Trộn 4 hình
    vec3 p = position * uW.x + aS1 * uW.y + aS2 * uW.z + aS3 * uW.w;

    // 2) Hiệu ứng "thở" nhẹ
    p += normalize(p + vec3(0.0001)) * sin(uTime * 1.5 + aRand * 6.28) * 0.03;

    // 3) Đang giữa 2 hình (max trọng số thấp) thì hạt tản ra
    float mid = (1.0 - max(max(uW.x, uW.y), max(uW.z, uW.w))) * 2.0;
    p += vec3(sin(aRand * 40.0 + uTime * 2.0),
              cos(aRand * 55.0 + uTime * 1.7),
              sin(aRand * 31.0 + uTime * 2.3)) * mid * 2.4;

    // 4) Chuột đẩy hạt ra xa
    vec3 d = p - uMouse;
    float push = smoothstep(1.4, 0.0, length(d)) * uMouseOn;
    p += normalize(d + vec3(0.0001)) * push * (0.7 + uPower * 1.5);

    // 5) Click: cả khối nổ phồng ra rồi co lại
    p += normalize(p + vec3(0.0001)) * uPower * aRand * 0.9;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * uPR * (0.55 + aRand * 0.9) * (8.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    vRand = aRand;
  }`;

// Fragment shader: hạt tròn, tô 2 màu PHẲNG (cam là chính, trắng ngà là điểm nhấn)
// Fragment shader: hạt tròn, 3 màu PHẲNG (mint nhiều nhất, kem và lavender là điểm nhấn)
const FRAG = /* glsl */`
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform vec3 uColC;
  varying float vRand;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;                          // cắt thành hình tròn
    vec3 col = uColA;                                       // mặc định: mint
    if (vRand > 0.82) col = uColB;                          // ~18%: kem
    else if (vRand < 0.16) col = uColC;                     // ~16%: lavender
    gl_FragColor = vec4(col, 1.0);
  }`;

/* ---------- HÀM CHÍNH ---------- */
// options.clickCycles: click vào khối thì đổi hình (hero) hay không (Spark)
// options.neutral: màu trung tính [r,g,b] 0..1, mặc định #1d1d1f (hợp nền sáng)
export function initHero3D(container, options = {}) {
  const { clickCycles = true, neutral = [0.114, 0.114, 0.122] } = options;
      // Màn nhỏ HOẶC thiết bị cảm ứng (kể cả iPad) đều dùng cấu hình nhẹ
  const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const COUNT = isMobile ? 9000 : 22000;           // mobile ít hạt hơn cho mượt

  // --- Renderer + camera + cảnh (nền trong suốt) ---
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  const pr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  container.appendChild(renderer.domElement);
    // Canvas nằm tuyệt đối trong khung: không ảnh hưởng kích thước khung, tránh canvas "phình ra" dần
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 8;

  // --- Dữ liệu 4 hình + số ngẫu nhiên cho từng hạt ---
  const shapes = [shapeSphere(COUNT), shapeWindow(COUNT), shapeCode(COUNT), shapeKnot(COUNT)];
  const rand = new Float32Array(COUNT).map(() => Math.random());

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(shapes[0], 3));
  geo.setAttribute('aS1', new THREE.BufferAttribute(shapes[1], 3));
  geo.setAttribute('aS2', new THREE.BufferAttribute(shapes[2], 3));
  geo.setAttribute('aS3', new THREE.BufferAttribute(shapes[3], 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

  const uniforms = {
    uTime: { value: 0 }, uW: { value: new THREE.Vector4(1, 0, 0, 0) },
    uMouse: { value: new THREE.Vector3(99, 99, 99) }, uMouseOn: { value: 0 },
    uPower: { value: 0 }, uSize: { value: isMobile ? 2.8 : 2.4 }, uPR: { value: pr },
            uColA: { value: COLOR_A }, uColB: { value: new THREE.Vector3(...neutral) }, uColC: { value: COLOR_C },
  };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG }));
  points.frustumCulled = false; // hạt bay ra ngoài vẫn được vẽ
  scene.add(points);

  /* ----- API: đổi hình (gsap chạy trọng số 0..1, có thể ngắt giữa chừng) ----- */
  const api = { current: 0, onChange: null, setShape };
  const wt = { a: 1, b: 0, c: 0, d: 0 };
  function setShape(i) {
    i = (i + SHAPES.length) % SHAPES.length;
    api.current = i;
    gsap.to(wt, {
      a: +(i === 0), b: +(i === 1), c: +(i === 2), d: +(i === 3),
      duration: 1.8, ease: 'power3.inOut', overwrite: true,
      onUpdate: () => uniforms.uW.value.set(wt.a, wt.b, wt.c, wt.d),
    });
    api.onChange?.(i); // báo cho UI (nhãn, nút) cập nhật
  }

    /* ----- API: chế độ "scrub" - hình đi theo tiến độ cuộn trang, có làm mượt ----- */
  // t chạy liên tục 0..3 (0 = hình 1 ... 3 = hình 4). Hình tự đuổi theo t nên không bao giờ trễ
  let scrubOn = false, scrubTarget = 0, scrubPos = 0;
  api.setScrub = (t) => { scrubOn = true; scrubTarget = t; gsap.killTweensOf(wt); };

  /* ----- Tương tác: chuột đẩy hạt, kéo xoay, click đổi hình ----- */
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // mặt phẳng z=0 để đổi toạ độ chuột
  const hit = new THREE.Vector3();
  let mouseOnTarget = 0, dragging = false, moved = 0, lastX = 0, dragRot = 0, spin = 0;

  function setPointer(e) {
    const r = container.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }
  container.addEventListener('pointerenter', () => (mouseOnTarget = 1));
  container.addEventListener('pointerleave', () => (mouseOnTarget = 0));
  container.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lastX = e.clientX; });
  container.addEventListener('pointermove', (e) => {
    setPointer(e);
    if (dragging) { dragRot += (e.clientX - lastX) * 0.006; moved += Math.abs(e.clientX - lastX); lastX = e.clientX; }
  });
  window.addEventListener('pointerup', () => {
    // Di chuyển ít = click: nổ + sang hình kế tiếp
    if (dragging && moved < 5) { uniforms.uPower.value = 1; if (clickCycles) setShape(api.current + 1); }
        dragging = false;
  });

  /* ----- Kích thước: tự co theo khung ----- */
    /* ----- Kích thước: tự co theo khung ----- */
  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;                                   // khung đang ẩn / chưa có kích thước
    renderer.setSize(w, h, false);                          // false = không ghi đè CSS của canvas
    camera.aspect = w / h;
    camera.position.z = Math.max(8, 6.4 / camera.aspect);   // khung càng hẹp camera càng lùi, hình không bị cắt
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  /* ----- Vòng lặp vẽ ----- */
  const clock = new THREE.Clock();
    let running = true;
  let lastT = 0;   // mốc thời gian của khung hình trước
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
        const now = clock.getElapsedTime();
    const dt = Math.min(now - lastT, 0.1);   // thời gian giữa 2 khung hình (giới hạn 0.1s)
    lastT = now;
    uniforms.uTime.value = now;

    // Chế độ scrub (section Spark): tính trọng số 4 hình từ vị trí liên tục scrubPos
    if (scrubOn) {
      scrubPos += (scrubTarget - scrubPos) * (1 - Math.exp(-dt * 10)); // đuổi theo mục tiêu
      const s = Math.min(2, Math.floor(scrubPos));                      // hình bên trái của cặp đang chuyển
      const f = THREE.MathUtils.smoothstep(scrubPos - s, 0.25, 0.75);   // giữ nguyên hình ở 2 đầu, chuyển ở giữa
      const w = [0, 0, 0, 0];
      w[s] = 1 - f; w[s + 1] = f;
      uniforms.uW.value.set(w[0], w[1], w[2], w[3]);
    }
    uniforms.uPower.value *= 0.94;                                   // độ nổ nguội dần
    uniforms.uMouseOn.value += (mouseOnTarget - uniforms.uMouseOn.value) * 0.1;

    // Xoay: tự quay chậm + kéo + nghiêng theo chuột (có làm mượt)
    spin += 0.0025;
    points.rotation.y += ((spin + dragRot + pointer.x * 0.4) - points.rotation.y) * 0.06;
    points.rotation.x += (pointer.y * 0.25 - points.rotation.x) * 0.06;
    points.updateMatrixWorld();

    // Đổi vị trí chuột sang toạ độ cục bộ của khối hạt (vì khối đang xoay)
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) {
      uniforms.uMouse.value.lerp(points.worldToLocal(hit.clone()), 0.25);
    }
    renderer.render(scene, camera);
  }
  tick();

  /* ----- Tạm dừng khi hero ra khỏi màn hình (tiết kiệm pin) ----- */
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; tick(); }
    if (!entry.isIntersecting) running = false;
  }).observe(container);

  return api;
}