/* =========================================================
   LIQUID-TRANSITION.JS - Chuyển tiếp KÍNH LỎNG giữa các section (bản 3)

   Không màu, không gradient: chỉ là một khối kính lỏng trong suốt trào qua màn hình.
     - Bờ kính là mặt cắt bán nguyệt (meniscus): sáng ở mép đón đèn, tối ở mép khuất,
       có vệt sáng phản chiếu, đường sáng bên trong và tán sắc nhẹ ở viền
     - Trên Chromium/Edge (máy tính): phần trang phía sau bị KHÚC XẠ thật qua lớp kính
       (SVG displacement, gợn như nước chảy) + làm mờ nhẹ. Safari/Firefox/điện thoại:
       chỉ làm mờ, viền kính vẫn đầy đủ
     - Giọt dẫn đầu trước bờ sóng, giống bọt nước
     - Giữa lúc phủ kín hiện số thứ tự + tên + dòng phụ của section sắp tới

   CHỮ TỪNG SECTION CÓ THỂ TỰ SỬA - ba cách, ưu tiên từ trên xuống:
     1. File src/data/transition-text.json  (khoá = id của section, hoặc số thứ tự "1","2"...)
          { "showcase": { "title": "Dự án", "sub": "Demo thật để bạn xem" } }
          { "contact": "Liên hệ" }              // viết tắt: chỉ có tên
          { "studio": ["Studio", "Dòng phụ"] }  // dạng mảng [tên, phụ]
     2. Thuộc tính trên thẻ section:  data-lt-title="..."  data-lt-sub="..."
     3. Tự lấy: aria-label > h1/h2/h3 đầu tiên > id
   Sửa lúc đang chạy:  lt.setTexts({ hero: 'Trang chủ' })

   Không đụng logic cũ: lớp riêng position:fixed + pointer-events:none, không sửa DOM
   của section, không cuộn thay bạn, không phụ thuộc smooth-scroll. Nhàn rỗi = không vẽ.
   Tự tắt khi prefers-reduced-motion hoặc máy không có WebGL.
   ========================================================= */
import * as THREE from 'three';
import gsap from 'gsap';

const W = 1.9;                       // bề dày dải kính (đơn vị: chiều cao màn hình), đủ lớn để phủ kín
const F0 = -0.2, F1 = 1.2 + W;       // vị trí bờ trước: từ ngoài đáy tới ngoài đỉnh + hết dải
const BW = 0.075;                    // bề rộng vát cong của mép kính

/* ----- Hai bờ gợn: CHUNG công thức ở JS (cắt lớp backdrop) và GLSL (vẽ viền) ----- */
const wobF = (x, t, seed) =>
  0.050 * Math.sin(x * 5.0 + t * 3.0 + seed * 6.0) +
  0.025 * Math.sin(x * 11.0 - t * 4.0 + 1.3) +
  0.035 * Math.sin(x * 2.3 + seed * 9.0);
const wobT = (x, t, seed) =>
  0.045 * Math.sin(x * 4.0 - t * 2.4 + seed * 3.0) +
  0.030 * Math.sin(x * 9.0 + t * 3.1);

const VERT = /* glsl */`
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec2  uRes;
  uniform float uT;
  uniform float uP;
  uniform float uDir;
  uniform float uSeed;
  uniform float uBg;      // 0 = trang nền tối, 1 = trang nền sáng

  const float W  = ${W.toFixed(3)};
  const float F0 = ${F0.toFixed(3)};
  const float F1 = ${F1.toFixed(3)};
  const float BW = ${BW.toFixed(3)};

  float hash12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  float wobF(float x) {
    return 0.050 * sin(x * 5.0 + uT * 3.0 + uSeed * 6.0)
         + 0.025 * sin(x * 11.0 - uT * 4.0 + 1.3)
         + 0.035 * sin(x * 2.3 + uSeed * 9.0);
  }
  float wobT(float x) {
    return 0.045 * sin(x * 4.0 - uT * 2.4 + uSeed * 3.0)
         + 0.030 * sin(x * 9.0 + uT * 3.1);
  }
  float dWobF(float x) {
    return 0.250 * cos(x * 5.0 + uT * 3.0 + uSeed * 6.0)
         + 0.275 * cos(x * 11.0 - uT * 4.0 + 1.3)
         + 0.0805 * cos(x * 2.3 + uSeed * 9.0);
  }
  float dWobT(float x) {
    return 0.180 * cos(x * 4.0 - uT * 2.4 + uSeed * 3.0)
         + 0.270 * cos(x * 9.0 + uT * 3.1);
  }

  /* Khoảng cách có dấu tới mép khối kính (đơn vị: chiều cao màn hình, dương = bên trong) */
  float shapeD(vec2 uv) {
    float asp = uRes.x / uRes.y;
    float s = uDir > 0.0 ? uv.y : 1.0 - uv.y;
    float f = mix(F0, F1, uP);

    float a = f + wobF(uv.x) - s;                 // > 0: đã qua bờ trước
    float b = s - (f - W + wobT(uv.x));           // > 0: chưa qua bờ sau
    float da = dWobF(uv.x) / asp;
    float db = dWobT(uv.x) / asp;
    float D = min(a * inversesqrt(1.0 + da * da), b * inversesqrt(1.0 + db * db));

    // Giọt dẫn đầu phía trước bờ sóng
    float fade = smoothstep(0.0, 0.06, uP);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 c = vec2(fract(0.15 + 0.29 * fi + uSeed * 0.7) * asp,
                    f + 0.07 + 0.06 * fi + 0.01 * sin(uT * 4.0 + fi));
      float r = 0.032 + 0.011 * fi;
      D = max(D, (r - length(vec2(uv.x * asp, s) - c)) * fade);
    }
    return D;
  }

  float sp(vec3 n, vec3 L, float pw) {
    return pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), pw);
  }

  void main() {
    float asp = uRes.x / uRes.y;
    vec2 uv = gl_FragCoord.xy / uRes;
    float D = shapeD(uv);

    // Độ phủ viền chống răng cưa (theo pixel), khớp đúng đường cắt của lớp backdrop
    float cov = clamp(D * uRes.y + 0.5, 0.0, 1.0);
    if (cov < 0.003) { gl_FragColor = vec4(0.0); return; }

    // Hướng vào trong của mép (đạo hàm D) + mặt cắt bán nguyệt -> pháp tuyến
    float e = 1.0 / uRes.y;
    vec2 ex = vec2(e / asp, 0.0), ey = vec2(0.0, e);
    vec2 g = vec2(shapeD(uv + ex) - shapeD(uv - ex), shapeD(uv + ey) - shapeD(uv - ey));
    vec2 gdir = g / max(length(g), 1e-5);

    float k = clamp(D / BW, 0.0, 1.0);
    float q = 1.0 - k;
    float hh = sqrt(max(1.0 - q * q, 0.0));
    float dz = min(q / max(hh, 0.17), 5.5);               // độ dốc của mặt cắt
    vec3 n = normalize(vec3(-gdir * dz, 1.0));
    float rim = 1.0 - n.z;                                // 0 phẳng .. 1 dựng đứng
    float facing = dot(-gdir, normalize(vec2(-0.6, 0.8)));  // mép quay về phía đèn chính (trên trái)

    // Đèn chính (tán sắc nhẹ: mỗi kênh lệch hướng một chút) + đèn bù phía đối diện
    vec3 key = vec3(sp(n, normalize(vec3(-0.61, 0.70, 0.55)), 55.0),
                    sp(n, normalize(vec3(-0.55, 0.70, 0.55)), 55.0),
                    sp(n, normalize(vec3(-0.49, 0.70, 0.55)), 55.0));
    float fill = sp(n, normalize(vec3(0.60, -0.60, 0.50)), 40.0) * 0.70;
    float fres = pow(rim, 1.6);
    float inner = exp(-pow((k - 0.5) / 0.07, 2.0)) * 0.30 * (0.3 + 0.7 * max(facing, 0.0));
    float bevel = fres * 0.58 * (0.35 + 0.65 * max(facing, 0.0));

    vec3 light = clamp((key + fill + inner + bevel) * vec3(0.96, 0.98, 1.0), 0.0, 1.0) * 0.92;
    float lightA = max(max(light.r, light.g), light.b);

    // Mép khuất sáng: kính dày nên tối lại (phản xạ toàn phần)
    float darkA = smoothstep(0.08, 0.65, rim) * 0.26 * mix(1.0, 2.2, uBg);
    darkA += exp(-pow(k / 0.06, 2.0)) * 0.38 * uBg;       // nền sáng: đường viền mảnh để thấy rõ hình kính
    darkA = clamp(darkA, 0.0, 0.8) * (1.0 - lightA);
    vec3 rgb = light + vec3(0.01, 0.02, 0.04) * darkA;
    rgb += (hash12(gl_FragCoord.xy) - 0.5) / 255.0 * step(0.001, lightA + darkA);

    gl_FragColor = vec4(rgb * cov, (lightA + darkA) * cov);      // premultiplied alpha
  }
`;

const NOOP = { play() {}, destroy() {}, refresh() {}, setTexts() {} };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* Chuẩn hoá một mục chữ về { title, sub } từ chuỗi | mảng | object */
function norm(v) {
  if (v == null) return {};
  if (typeof v === 'string') return { title: v };
  if (Array.isArray(v)) return { title: v[0], sub: v[1] };
  if (typeof v === 'object') return { title: v.title, sub: v.sub };
  return {};
}

export function initLiquidTransition(options = {}) {
  const {
    selector = 'main > section, body > section, section[id], footer',
    texts: textsOpt = {},          // { idHoặcSố: 'Tên' | ['Tên','Phụ'] | { title, sub } }
    duration = 2.0,
    armDelay = 1500,               // chờ preloader xong rồi mới bật (ms)
    cooldown = 900,                // nghỉ tối thiểu giữa hai lần chạy (ms)
    look = 0.2,                    // kích hoạt sớm: nhìn trước theo hướng cuộn (tỉ lệ chiều cao màn hình)
    labels = true,                 // hiện chữ giữa lúc phủ kín
    showNumber = true,             // hiện "03 / 07"
    blur = null,                   // độ mờ nền (px); null = tự chọn
    refract = 'auto',              // 'auto' | true | false: khúc xạ trang thật (SVG displacement)
    enabled = () => true,          // hook để tạm tắt (ví dụ khi đang mở viewer)
  } = options;

  if (typeof window === 'undefined') return NOOP;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return NOOP;

  const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.25);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return NOOP;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(DPR);

  let texts = textsOpt || {};

  /* ----- Lớp 1: kính trong (backdrop mờ + khúc xạ), cắt theo bờ sóng. KHÔNG có màu nền ----- */
  const fixed = { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', visibility: 'hidden' };
  const glass = document.createElement('div');
  Object.assign(glass.style, fixed, { zIndex: '899' });
  glass.setAttribute('aria-hidden', 'true');

  const isChromium = /Chrome\//.test(navigator.userAgent) && !/OPR\/|Firefox\//.test(navigator.userAgent);
  const wantRefract = refract === true || (refract === 'auto' && isChromium && !isMobile);
  const blurPx = blur ?? (isMobile ? 5 : 7);
  const plain = `blur(${blurPx}px) saturate(1.25) brightness(1.06)`;

  let turb = null, disp = null, svg = null;
  if (wantRefract) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    Object.assign(svg.style, { position: 'fixed', pointerEvents: 'none' });
    svg.innerHTML =
      '<filter id="lt-liquid" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="7" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>';
    turb = svg.querySelector('feTurbulence');
    disp = svg.querySelector('feDisplacementMap');
  }
  const setBackdrop = (v) => { glass.style.backdropFilter = v; glass.style.webkitBackdropFilter = v; };
  setBackdrop(wantRefract ? `url(#lt-liquid) ${plain}` : plain);
  if (!glass.style.backdropFilter && !glass.style.webkitBackdropFilter) {   // trình duyệt từ chối url(): lùi về mờ thường
    setBackdrop(plain);
    turb = disp = null;
  }

  /* ----- Lớp 2: viền kính WebGL ----- */
  const cv = renderer.domElement;
  Object.assign(cv.style, fixed, { zIndex: '900', display: 'block' });
  cv.setAttribute('aria-hidden', 'true');

  /* ----- Lớp 3: chữ ----- */
  const label = document.createElement('div');
  Object.assign(label.style, fixed, {
    zIndex: '901', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '14px', opacity: '0', textAlign: 'center', padding: '0 8vw', boxSizing: 'border-box',
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: '#fff',
  });
  label.setAttribute('aria-hidden', 'true');
  const numEl = document.createElement('div');
  Object.assign(numEl.style, {
    fontSize: 'clamp(12px, 1.5vw, 15px)', letterSpacing: '0.35em', fontWeight: '600', opacity: '0.8',
    textShadow: '0 1px 14px rgba(0,0,0,0.35)',
  });
  const titleEl = document.createElement('div');
  Object.assign(titleEl.style, {
    fontSize: 'clamp(30px, 6.5vw, 88px)', fontWeight: '700', letterSpacing: '-0.03em', lineHeight: '1.05',
    maxWidth: '86vw', textShadow: '0 4px 40px rgba(0,0,0,0.35)',
  });
  const subEl = document.createElement('div');
  Object.assign(subEl.style, {
    fontSize: 'clamp(14px, 1.7vw, 20px)', fontWeight: '500', opacity: '0.85', maxWidth: '60ch',
    textShadow: '0 2px 20px rgba(0,0,0,0.35)',
  });
  label.append(numEl, titleEl, subEl);

  document.body.append(...(svg ? [svg] : []), glass, cv, label);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uT: { value: 0 }, uP: { value: 0 }, uDir: { value: 1 }, uSeed: { value: 0.3 }, uBg: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    const v = new THREE.Vector2();
    renderer.getDrawingBufferSize(v);
    uniforms.uRes.value.copy(v);
  }
  resize();
  window.addEventListener('resize', resize);

  /* ----- Phát hiện section ----- */
  let sections = [];
  function refresh() {
    let els = Array.from(document.querySelectorAll(selector));
    els = els.filter((el) => !els.some((o) => o !== el && o.contains(el)));      // chỉ lấy tầng ngoài cùng
    els = els.filter((el) => el.offsetHeight > 80);
    els.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    sections = els;
  }
  function idxAt(line) {
    for (let i = 0; i < sections.length; i++) {
      const r = sections[i].getBoundingClientRect();
      if (r.top <= line && r.bottom > line) return i;
    }
    return -1;
  }

  /* ----- Chữ của một section: JSON/option > data-attr > tự lấy ----- */
  function textOf(el, i) {
    const t = norm(texts[el.id] ?? texts[String(i + 1)]);
    let title = t.title || el.dataset.ltTitle || el.getAttribute('aria-label') || '';
    if (!title) {
      const h = el.querySelector('h1, h2, h3');
      const s = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
      title = s.length > 42 ? s.slice(0, 40).trim() + '…' : s;
    }
    if (!title) title = (el.id || '').replace(/[-_]+/g, ' ').trim() || 'CoreSpark';
    const sub = t.sub ?? el.dataset.ltSub ?? '';
    return { title: String(title).trim(), sub: String(sub).trim() };
  }

  /* ----- Đo độ sáng trang phía sau: nền sáng -> chữ tối, nền tối -> chữ sáng ----- */
  const cx = document.createElement('canvas');
  cx.width = cx.height = 1;
  const c2 = cx.getContext('2d', { willReadFrequently: true });
  function parseCss(css) {                                  // mọi màu CSS (rgb, oklch, color-mix...) -> {r,g,b,a}
    c2.clearRect(0, 0, 1, 1);
    c2.fillStyle = css;
    c2.fillRect(0, 0, 1, 1);
    const d = c2.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  }
  function pageLum() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const pts = [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.3], [0.5, 0.7]];
    let sum = 0;
    for (const [fx, fy] of pts) {
      let col = null;
      for (const el of document.elementsFromPoint(fx * vw, fy * vh)) {
        if (el === glass || el === cv || el === label || el === svg || label.contains(el)) continue;
        const c = parseCss(getComputedStyle(el).backgroundColor);
        if (c.a >= 0.5) { col = c; break; }
      }
      if (!col) col = { r: 255, g: 255, b: 255, a: 1 };      // không tìm thấy nền: coi như trắng mặc định
      sum += (0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b) / 255;
    }
    return sum / pts.length;
  }
  function applyTone(light) {
    const sh = light ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)';
    label.style.color = light ? '#0b1020' : '#ffffff';
    numEl.style.textShadow = `0 0 12px ${sh}`;
    titleEl.style.textShadow = `0 0 2px ${sh}, 0 4px 36px ${sh}`;
    subEl.style.textShadow = `0 0 10px ${sh}`;
  }

  /* ----- Chạy hiệu ứng ----- */
  const state = { p: 0 };
  let playing = false, lastPlay = 0, destroyed = false;
  let dir = 1, t0 = 0, seed = 0.3, labelSet = false, prev = -1;

  // Khoảng p mà màn hình được phủ kín hoàn toàn (tính cả biên độ gợn ~0.11)
  const pIn = (1.11 - F0) / (F1 - F0);
  const pOut = (W - 0.075 - F0) / (F1 - F0);

  function setLabel() {
    if (!labels || !sections.length) return;
    let i = idxAt(window.innerHeight * 0.5);
    if (i < 0) i = clamp(prev, 0, sections.length - 1);
    const t = textOf(sections[i], i);
    numEl.textContent = showNumber ? String(i + 1).padStart(2, '0') + '  /  ' + String(sections.length).padStart(2, '0') : '';
    numEl.style.display = showNumber ? '' : 'none';
    titleEl.textContent = t.title;
    subEl.textContent = t.sub;
    subEl.style.display = t.sub ? '' : 'none';
    applyTone(pageLum() > 0.5);
  }

  function render() {
    const p = state.p;
    const t = (performance.now() - t0) / 1000;
    uniforms.uT.value = t;
    uniforms.uP.value = p;

    // Cắt lớp kính theo đúng hai bờ gợn (cùng công thức với shader)
    const f = F0 + (F1 - F0) * p;
    const N = 44, up = dir > 0;
    const toY = (s) => ((up ? 1 - s : s) * 100).toFixed(2);
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const x = -0.02 + (1.04 * i) / N;
      pts.push((x * 100).toFixed(2) + '% ' + toY(clamp(f + wobF(x, t, seed), -0.15, 1.15)) + '%');
    }
    for (let i = N; i >= 0; i--) {
      const x = -0.02 + (1.04 * i) / N;
      pts.push((x * 100).toFixed(2) + '% ' + toY(clamp(f - W + wobT(x, t, seed), -0.15, 1.15)) + '%');
    }
    glass.style.clipPath = 'polygon(' + pts.join(',') + ')';

    // Khúc xạ: mạnh nhất giữa lúc kính phủ qua, gợn chảy theo thời gian
    if (disp) {
      disp.setAttribute('scale', (70 * Math.sin(Math.PI * p)).toFixed(1));
      turb.setAttribute('baseFrequency', '0.006 ' + (0.011 + 0.002 * Math.sin(t * 1.5)).toFixed(5));
    }

    if (labels) {
      if (!labelSet && p >= pIn - 0.12) { labelSet = true; setLabel(); }
      const o = sstep(pIn - 0.1, pIn, p) * (1 - sstep(pOut, pOut + 0.1, p));
      label.style.opacity = o.toFixed(3);
      label.style.transform = 'translateY(' + ((0.5 - p) * 160 * (up ? 1 : -1)).toFixed(1) + 'px)';
    }
    renderer.render(scene, camera);
  }

  function play(d = 1) {
    if (playing || destroyed) return;
    playing = true;
    lastPlay = performance.now();
    dir = d >= 0 ? 1 : -1;
    seed = Math.random();
    uniforms.uDir.value = dir;
    uniforms.uSeed.value = seed;
    uniforms.uBg.value = sstep(0.35, 0.65, pageLum());
    t0 = performance.now();
    labelSet = false;
    state.p = 0;
    glass.style.visibility = cv.style.visibility = label.style.visibility = 'visible';
    gsap.to(state, {
      p: 1, duration, ease: 'none',
      onUpdate: render,
      onComplete() {
        glass.style.visibility = cv.style.visibility = label.style.visibility = 'hidden';
        label.style.opacity = '0';
        renderer.clear();
        playing = false;
      },
    });
  }

  /* ----- Lắng nghe cuộn: nhìn trước theo hướng cuộn để kính phủ kín đúng lúc section đổi ----- */
  let armed = false, raf = 0, lastY = window.scrollY, dirS = 1;
  function check() {
    raf = 0;
    if (!armed || destroyed) return;
    const y = window.scrollY, dy = y - lastY;
    if (Math.abs(dy) < 0.5) return;
    lastY = y;
    const d = dy > 0 ? 1 : -1;
    const line = window.innerHeight * (0.5 + d * look);
    if (d !== dirS) { dirS = d; prev = idxAt(line); return; }   // đổi chiều cuộn: đặt lại mốc, không kích hoạt
    const idx = idxAt(line);
    if (idx < 0) return;
    if (prev >= 0 && idx !== prev && enabled() && performance.now() - lastPlay > cooldown) play(d);
    prev = idx;
  }
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };

  function arm() {
    refresh();
    lastY = window.scrollY;
    prev = idxAt(window.innerHeight * (0.5 + dirS * look));
    armed = true;
  }
  const armTimer = window.setTimeout(() => {
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
  }, armDelay);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', refresh);

  return {
    play,
    refresh,
    setTexts(next) { texts = { ...texts, ...(next || {}) }; },
    destroy() {
      destroyed = true;
      clearTimeout(armTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', refresh);
      gsap.killTweensOf(state);
      renderer.dispose();
      svg?.remove(); glass.remove(); cv.remove(); label.remove();
    },
  };
}