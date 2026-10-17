/* =========================================================
   STUDIO3D.JS - Khối kính vật lý chứa các công nghệ bên trong
   Kỹ thuật: MeshPhysicalMaterial (transmission = khúc xạ thật),
   ánh sáng môi trường RoomEnvironment (phản chiếu như kính thật)
   Tương tác: kéo xoay có quán tính, bấm = công nghệ bung ra rồi bật về,
   đổi hình / màu kính / độ khúc xạ qua API trả về
   Cách dùng: const api = initStudio(el); api.setShape('knot')
   ========================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';

/* ---------- CẤU HÌNH ---------- */
// Màu nền khung 3D: PHẢI trùng với background của .studio__stage trong Studio.astro
const STAGE_BG = '#0b0b0d';

// Các công nghệ nằm trong khối kính [tên, màu chip]. NỘI DUNG LÀ MẪU, sửa theo ý bạn
const TAGS = [
  ['HTML', '#ff9f0a'], ['CSS', '#0a84ff'], ['JavaScript', '#ffd60a'], ['GSAP', '#30d158'],
  ['Three.js', '#f5f5f7'], ['WebGL', '#bf5af2'], ['Astro', '#ff375f'], ['Responsive', '#64d2ff'],
  ['Shader', '#5e5ce6'], ['ScrollTrigger', '#ff6482'],
];

/* ---------- HÀM 1: tạo 1 chip chữ (mặt phẳng có texture vẽ bằng canvas) ---------- */
// Dùng alphaTest thay vì transparent để chip nằm trong lớp "opaque" và được kính khúc xạ
function makeLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.beginPath(); g.roundRect(4, 4, 504, 152, 76); g.fill();           // viên thuốc
  g.fillStyle = '#111114';
  g.font = '700 64px -apple-system, "Inter", "Segoe UI", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 84);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.28),
    new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false })
  );
  return mesh;
}

/* ---------- HÀM CHÍNH ---------- */
export function initStudio(container) {
    const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  // --- Renderer (nền đặc để kính có thứ để khúc xạ) ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = isMobile ? 0.5 : 1; // nhẹ hơn trên mobile
  container.appendChild(renderer.domElement);
    // Canvas nằm tuyệt đối trong khung: không ảnh hưởng kích thước khung, tránh canvas "phình ra" dần
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STAGE_BG);
  // Ánh sáng môi trường: nguồn phản chiếu cho kính (không cần đèn riêng)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 8;

  /* ----- HÀM 2: 3 hình kính (tạo khi cần, để tiết kiệm bộ nhớ) ----- */
  const GEOS = {
    sphere: () => new THREE.SphereGeometry(1.5, isMobile ? 48 : 96, isMobile ? 32 : 64),
    box:    () => new RoundedBoxGeometry(2.5, 2.5, 2.5, 8, 0.55),
    knot:   () => new THREE.TorusKnotGeometry(1.05, 0.46, isMobile ? 120 : 240, 36),
  };

  // --- Vật liệu kính ---
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.04,
    transmission: 1,               // 1 = trong suốt hoàn toàn, có khúc xạ
    thickness: 1.4,                // độ dày để khúc xạ "bẻ" mạnh hơn
    ior: 1.45,                     // chiết suất (kính thật ~1.5)
    attenuationColor: new THREE.Color(0xffffff), attenuationDistance: 0.9,  // kính nhuộm màu
    clearcoat: 1, clearcoatRoughness: 0.03,
  });

  // holder: nhóm xoay theo thao tác kéo. glass: khối kính. labels: các chip bên trong
  const holder = new THREE.Group();
  scene.add(holder);
  const glass = new THREE.Mesh(GEOS.sphere(), mat);
  holder.add(glass);

  // --- Chip công nghệ: rải đều bên trong khối (công thức Fibonacci) ---
  const labels = new THREE.Group();
  holder.add(labels);
  const golden = Math.PI * (3 - Math.sqrt(5));
  TAGS.forEach(([text, color], i) => {
    const m = makeLabel(text, color);
    const y = 1 - (i / (TAGS.length - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    m.userData.base = new THREE.Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r).multiplyScalar(0.8);
    labels.add(m);
  });

  /* ----- HÀM 3: bấm vào = chip bung ra rồi bật về, khối bóp nhẹ rồi nảy lại ----- */
  const state = { burst: 0 };
  function pulse() {
    gsap.timeline()
      .to(state, { burst: 1, duration: 0.35, ease: 'power3.out' })
      .to(state, { burst: 0, duration: 1.5, ease: 'elastic.out(1, 0.5)' });
    gsap.fromTo(holder.scale, { x: 0.88, y: 0.88, z: 0.88 }, { x: 1, y: 1, z: 1, duration: 1.3, ease: 'elastic.out(1, 0.4)', overwrite: true });
  }

  /* ----- API 1: đổi hình (thu nhỏ về 0, đổi geometry, rồi nảy ra lại) ----- */
  let currentShape = 'sphere';
  function setShape(name) {
    if (name === currentShape || !GEOS[name]) return;
    currentShape = name;
    gsap.to(glass.scale, {
      x: 0, y: 0, z: 0, duration: 0.35, ease: 'power2.in', overwrite: true,
      onComplete: () => {
        glass.geometry.dispose();
        glass.geometry = GEOS[name]();
        gsap.to(glass.scale, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'elastic.out(1, 0.55)' });
      },
    });
  }

  /* ----- API 2: đổi màu kính (chuyển màu mượt) ----- */
  function setTint(hex) {
    const target = new THREE.Color(hex);
    const from = mat.attenuationColor.clone();
    const o = { t: 0 };
    gsap.to(o, {
      t: 1, duration: 0.7, ease: 'power2.out', overwrite: true,
      onUpdate: () => {
        mat.attenuationColor.copy(from).lerp(target, o.t);
        mat.color.set(0xffffff).lerp(mat.attenuationColor, 0.3);   // nhuộm nhẹ cả mặt kính
      },
    });
  }

  /* ----- API 3: chỉnh độ khúc xạ ----- */
  function setIor(v) { mat.ior = THREE.MathUtils.clamp(v, 1, 2.33); }

  /* ----- Tương tác: kéo xoay có quán tính + nghiêng nhẹ theo chuột + bấm để bung ----- */
  const pointer = new THREE.Vector2();
  let dragging = false, moved = 0, lastX = 0, lastY = 0, vx = 0, vy = 0;

  container.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    container.setPointerCapture(e.pointerId);
    container.style.cursor = 'grabbing';
  });
  container.addEventListener('pointermove', (e) => {
    const r = container.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    holder.rotation.y += dx * 0.008; holder.rotation.x += dy * 0.008;
    vy = dx * 0.008; vx = dy * 0.008;                       // nhớ vận tốc để quay tiếp khi thả
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX; lastY = e.clientY;
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    container.style.cursor = 'grab';
    if (e.type === 'pointerup' && moved < 5) pulse();       // di chuyển ít = bấm
  };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);

  /* ----- Kích thước: tự co theo khung ----- */
    /* ----- Kích thước: tự co theo khung ----- */
  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = Math.max(8, 8.5 / camera.aspect);   // khung hẹp thì lùi camera
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  /* ----- Vòng lặp vẽ ----- */
  const tmpQ = new THREE.Quaternion();
  let running = true;
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);

    // Quán tính: thả tay vẫn quay tiếp rồi chậm dần + tự xoay nhẹ
    if (!dragging) {
      holder.rotation.y += vy + 0.0025; holder.rotation.x += vx;
      vy *= 0.95; vx *= 0.95;
      holder.rotation.x *= 0.99;                            // từ từ trở về thẳng
    }
    holder.rotation.x = THREE.MathUtils.clamp(holder.rotation.x, -1.2, 1.2);

    // Nghiêng nhẹ theo chuột (parallax)
    holder.position.x += (pointer.x * 0.2 - holder.position.x) * 0.05;
    holder.position.y += (pointer.y * 0.12 - holder.position.y) * 0.05;

    // Chip: quay quanh tâm, bung ra theo state.burst, và luôn quay mặt về camera để đọc được
    labels.rotation.y += 0.004;
    labels.getWorldQuaternion(tmpQ);                        // góc xoay thật của nhóm chip trong thế giới
    labels.children.forEach((m) => {
      m.position.copy(m.userData.base).multiplyScalar(1 + state.burst * 2.2);
      m.quaternion.copy(tmpQ).invert().multiply(camera.quaternion);
    });

    renderer.render(scene, camera);
  }
  tick();

  /* ----- Tạm dừng khi ra khỏi màn hình (khúc xạ khá nặng nên rất cần) ----- */
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; tick(); }
    if (!entry.isIntersecting) running = false;
  }).observe(container);

  return { setShape, setTint, setIor, pulse };
}