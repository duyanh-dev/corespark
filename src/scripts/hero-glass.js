/* HERO-GLASS.JS - Cụ kính vật lý cho Hero (4 hình, mỗi hình một màu kính)
   API giữ nguyên như hero3d: { current, onChange, setShape, pulse } */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';

export const SHAPES = ['Ý tưởng', 'Thiết kế', 'Code', 'Ra mắt'];
const TINTS = ['#8cc4ff', '#cfa8ff', '#8fe9d8', '#ffb0c4'];   // màu kính theo từng hình
const ORBS = ['#0a84ff', '#bf5af2', '#ff9f0a'];               // 3 viên sáng bay quanh

/* Lấy màu nền thật của trang (đi ngược lên các thẻ cha) để rìa canvas không lộ khung */
function detectBg(el) {
  for (let e = el; e; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    const m = c.startsWith('rgb') ? c.match(/[\d.]+/g) : null;
    if (m && m.length >= 3 && (m.length < 4 || +m[3] > 0.99)) return new THREE.Color(`rgb(${m[0]},${m[1]},${m[2]})`);
  }
  return new THREE.Color('#fbfbfd');
}

/* Nền pastel mờ: kính sẽ khúc xạ nó nên nhìn như "liquid glass". Rìa = đúng màu nền trang */
function makeBackdrop(bg) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#' + bg.getHexString();
  g.fillRect(0, 0, S, S);
  [[.34, .38, '10,132,255'], [.68, .34, '191,90,242'], [.55, .72, '255,110,150']].forEach(([x, y, rgb]) => {
    const gr = g.createRadialGradient(x * S, y * S, 0, x * S, y * S, S * .3);
    gr.addColorStop(0, `rgba(${rgb},.6)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function initHeroGlass(container, options = {}) {
  const { clickCycles = true, bg } = options;
  const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Renderer: mobile giảm độ phân giải khúc xạ + bỏ antialias để mượt --- */
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.NoToneMapping;   // giữ màu nền xuyên qua kính đúng bằng màu nền ngoài kính
  if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = isMobile ? 0.5 : 0.85;
  container.appendChild(renderer.domElement);
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });

  const scene = new THREE.Scene();
  scene.background = makeBackdrop(bg ? new THREE.Color(bg) : detectBg(container));
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 8;

  /* --- 4 hình, tạo sẵn một lần (đổi hình không bị giật) --- */
  const seg = isMobile ? 0.55 : 1;
  const GEOS = [
    new THREE.SphereGeometry(1.55, Math.round(96 * seg), Math.round(64 * seg)),
    new RoundedBoxGeometry(2.6, 2.6, 2.6, isMobile ? 5 : 8, 0.6),
    new THREE.TorusKnotGeometry(1.05, 0.44, Math.round(240 * seg), isMobile ? 24 : 36),
    new THREE.TorusGeometry(1.25, 0.58, isMobile ? 32 : 48, Math.round(128 * seg)),
  ];

  /* --- Vật liệu kính: khúc xạ + ánh cầu vồng (iridescence) + tán sắc (desktop) --- */
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03,
    transmission: 1, thickness: 1.6, ior: 1.5,
    attenuationColor: new THREE.Color(TINTS[0]), attenuationDistance: 2.2,
    clearcoat: 1, clearcoatRoughness: 0.02,
    iridescence: 0.8, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 480],
    envMapIntensity: 1.2,
  });
  if (!isMobile && 'dispersion' in mat) mat.dispersion = 0.7;   // cần three >= r164, bản cũ bỏ qua

  const holder = new THREE.Group();
  scene.add(holder);
  const glass = new THREE.Mesh(GEOS[0], mat);
  glass.scale.setScalar(0.001);
  holder.add(glass);

  /* --- 3 viên sáng bay quanh, đi xuyên qua kính nên bị khúc xạ rất đẹp --- */
  const orbs = ORBS.map((col) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), new THREE.MeshBasicMaterial({ color: col }));
    scene.add(m);
    return m;
  });
  const state = { burst: 0 };

  /* --- Bấm: viên sáng bung ra, khối bóp rồi nảy lại --- */
  function pulse() {
    gsap.timeline()
      .to(state, { burst: 1, duration: 0.35, ease: 'power3.out' })
      .to(state, { burst: 0, duration: 1.5, ease: 'elastic.out(1, 0.5)' });
    gsap.fromTo(holder.scale, { x: 0.9, y: 0.9, z: 0.9 }, { x: 1, y: 1, z: 1, duration: 1.3, ease: 'elastic.out(1, 0.4)', overwrite: true });
  }

  /* --- Đổi hình: thu nhỏ, đổi geometry + màu kính, nảy ra --- */
  const api = { current: 0, onChange: null, setShape, pulse };
  let tl;
  function setShape(i) {
    i = (i + SHAPES.length) % SHAPES.length;
    if (i === api.current) return;
    api.current = i;
    const from = mat.attenuationColor.clone(), to = new THREE.Color(TINTS[i]), o = { t: 0 };
    tl?.kill();
    tl = gsap.timeline()
      .to(glass.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.32, ease: 'back.in(1.6)' })
      .add(() => { glass.geometry = GEOS[i]; })
      .to(glass.scale, { x: 1, y: 1, z: 1, duration: 1.1, ease: 'elastic.out(1, 0.55)' })
      .to(o, { t: 1, duration: 0.9, ease: 'power2.out', onUpdate: () => mat.attenuationColor.copy(from).lerp(to, o.t) }, 0);
    vy += 0.12;   // thêm cú xoay khi đổi hình
    api.onChange?.(i);
  }
  gsap.to(glass.scale, { x: 1, y: 1, z: 1, duration: 1.6, ease: 'elastic.out(1, 0.5)', delay: 0.3 });   // xuất hiện

  /* --- Tương tác: kéo xoay có quán tính, bấm đổi hình, nghiêng theo chuột --- */
  const pointer = new THREE.Vector2(), pSmooth = new THREE.Vector2();
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
    vy = dx * 0.008; vx = dy * 0.008;
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX; lastY = e.clientY;
  });
  container.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') pointer.set(0, 0); });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    container.style.cursor = 'grab';
    if (e.type === 'pointerup' && moved < 5) { pulse(); if (clickCycles) setShape(api.current + 1); }
  };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);   // trình duyệt giành cử chỉ cuộn dọc trang

  /* --- Kích thước --- */
  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = Math.max(8, 8.5 / camera.aspect);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  /* --- Vòng lặp --- */
  const clock = new THREE.Clock();
  let running = true;
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    const t = clock.getElapsedTime();

    if (!dragging) {
      holder.rotation.y += vy + (reduce ? 0 : 0.003);
      holder.rotation.x += vx;
      vy *= 0.95; vx *= 0.95;
      holder.rotation.x *= 0.985;
    }
    holder.rotation.x = THREE.MathUtils.clamp(holder.rotation.x, -1.2, 1.2);

    pSmooth.lerp(pointer, 0.06);
    holder.position.x = pSmooth.x * 0.25;
    holder.position.y = (reduce ? 0 : Math.sin(t * 0.9) * 0.08) + pSmooth.y * 0.15;   // lơ lửng nhẹ
    if ('environmentRotation' in scene) scene.environmentRotation.set(0, t * 0.15 + pSmooth.x * 0.8, 0);   // vệt sáng trượt trên mặt kính

    orbs.forEach((m, i) => {
      const a = t * (0.5 + i * 0.17) + i * 2.1, R = (2.1 + i * 0.15) * (1 + state.burst * 1.2);
      m.position.set(Math.cos(a) * R, Math.sin(a * 1.3) * 0.9, Math.sin(a) * R * 0.8);
    });

    renderer.render(scene, camera);
  }
  tick();

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; tick(); }
    if (!entry.isIntersecting) running = false;
  }).observe(container);

  return api;
}