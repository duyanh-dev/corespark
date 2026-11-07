/* =========================================================
   LIQUID-TRANSITION.JS - Chuyển tiếp KÍNH LỎNG giữa các section (bản 4: nhiều kiểu)

   Không màu, không gradient: chỉ là khối kính lỏng trong suốt trào qua màn hình.
   BỐN KIỂU, chạy xen kẽ ngẫu nhiên (không lặp lại kiểu vừa rồi):
     wave      Sóng dọc: bờ gợn quét từ dưới lên (hoặc từ trên xuống khi cuộn lên)
     sweep     Quét ngang: dải kính trượt từ trái sang phải (phải sang trái khi cuộn lên)
     diagonal  Quét chéo: dải kính nghiêng, góc và chiều ngẫu nhiên mỗi lần
     ripple    Gợn tròn: vòng kính toả ra từ một điểm (cuộn xuống), hoặc co vào (cuộn lên)

   Mọi kiểu đều:
     - Mép kính bán nguyệt: vệt sáng phản chiếu, đường sáng bên trong, tán sắc nhẹ
     - Trên Chromium/Edge (máy tính): khúc xạ + làm mờ phần trang phía sau (SVG displacement);
       trình duyệt khác / điện thoại: chỉ làm mờ, viền kính vẫn đủ
     - Phủ kín màn hình trong giây lát, giữa lúc đó hiện số + tên + dòng phụ của section sắp tới
     - Chữ tự đổi tối/sáng theo nền trang; viền kính tự chỉnh theo nền sáng/tối

   THÔNG MINH KHI CUỘN NHANH / SECTION NGẮN (mặc định bật, smart: true)
     - Đo tốc độ cuộn (px/s) lúc băng qua ranh giới, ước tính "thời gian ở lại" section sắp tới
       = chiều cao section / tốc độ. Nguyên tắc: bản chuyển tiếp phải nằm gọn giữa hai lần đổi
       section ở nhịp cuộn hiện tại. Đủ chỗ -> bản đầy đủ (kèm chữ); chỉ đủ chỗ cho bản ngắn ->
       bản nhanh (<1 giây, không chữ); không đủ (lướt vèo) -> bỏ qua. Cuộn đều thì mọi ranh giới
       cùng một kiểu, không có chuyện cái có cái không
     - Section thấp hơn minSection (mặc định 0.6 màn hình) không có chuyển tiếp riêng: gộp vào
       section lớn kề bên. Ép từng section:  data-lt="on" (luôn tính)  /  data-lt="off" (bỏ qua)
     - Đang chạy mà người dùng vụt tốc độ lớn trước khi kính phủ kín -> rút lui êm (mờ dần)
       thay vì chạy lỡ dở; nghỉ gap ms sau mỗi lần để không nhấp nháy khi lướt qua một loạt section

   CHỌN KIỂU (tuỳ chọn style):
     style: 'random'                     // mặc định: xen kẽ ngẫu nhiên cả 4 kiểu
     style: 'ripple'                     // luôn dùng một kiểu
     style: ['wave', 'ripple', 'sweep']  // chỉ xoay vòng trong danh sách này
     lt.play(1, 'ripple')                // chạy thử tay: (chiều, kiểu)

   CHỮ TỪNG SECTION TỰ SỬA - ưu tiên từ trên xuống:
     1. src/data/transition-text.json  (khoá = id section, hoặc số thứ tự "1","2"...)
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

/* ----- Hằng số hình học (đơn vị: chiều cao màn hình) ----- */
const W = 1.9;                       // bề dày dải kính (kiểu dải), đủ lớn để phủ kín
const F0 = -0.2, F1 = 1.2 + W;       // vị trí bờ trước của dải: từ ngoài đáy tới ngoài đỉnh + hết dải
const BW = 0.075;                    // bề rộng vát cong của mép kính
const RW0 = 1.7;                     // bề dày tối thiểu của vòng (kiểu gợn tròn)
const RO0 = -0.12;                   // bán kính ngoài lúc bắt đầu

const ALL_STYLES = ['wave', 'sweep', 'diagonal', 'ripple'];

/* ----- Công thức hình dạng: CHUNG ở JS (cắt lớp backdrop) và GLSL (vẽ viền) ----- */
const wobF = (v, t, seed) =>
  0.050 * Math.sin(v * 5.0 + t * 3.0 + seed * 6.0) +
  0.025 * Math.sin(v * 11.0 - t * 4.0 + 1.3) +
  0.035 * Math.sin(v * 2.3 + seed * 9.0);
const wobT = (v, t, seed) =>
  0.045 * Math.sin(v * 4.0 - t * 2.4 + seed * 3.0) +
  0.030 * Math.sin(v * 9.0 + t * 3.1);
const offF = wobF;
const offT = wobT;
const woR = (th, t, seed) =>
  0.040 * Math.sin(3 * th + t * 2.0 + seed * 6.0) +
  0.025 * Math.sin(5 * th - t * 3.0 + 1.3) +
  0.020 * Math.sin(8 * th + t * 2.5 + seed * 2.0);
const wiR = (th, t, seed) =>
  0.035 * Math.sin(4 * th - t * 2.2 + seed * 3.0) +
  0.020 * Math.sin(7 * th + t * 3.0);

const VERT = /* glsl */`
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec2  uRes;
  uniform float uT;
  uniform float uP;       // tiến độ hiệu dụng 0..1
  uniform float uDir;     // +1 / -1
  uniform float uSeed;
  uniform float uBg;      // 0 = trang nền tối, 1 = trang nền sáng
  uniform float uMode;    // 0 = dải, 1 = vòng
  uniform float uTheta;   // góc trục chuyển động của dải
  uniform float uRev;     // vòng co vào thay vì toả ra
  uniform vec2  uC0;      // tâm vòng (đơn vị chiều cao màn hình)
  uniform float uRW;      // bề dày vòng
  uniform float uRO1;     // bán kính ngoài lúc kết thúc

  const float W   = ${W.toFixed(3)};
  const float F0  = ${F0.toFixed(3)};
  const float F1  = ${F1.toFixed(3)};
  const float BW  = ${BW.toFixed(3)};
  const float RO0 = ${RO0.toFixed(3)};

  float hash12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  float wobF(float v) {
    return 0.050 * sin(v * 5.0 + uT * 3.0 + uSeed * 6.0)
         + 0.025 * sin(v * 11.0 - uT * 4.0 + 1.3)
         + 0.035 * sin(v * 2.3 + uSeed * 9.0);
  }
  float wobT(float v) {
    return 0.045 * sin(v * 4.0 - uT * 2.4 + uSeed * 3.0)
         + 0.030 * sin(v * 9.0 + uT * 3.1);
  }
  float offF(float v) { return wobF(v); }
  float offT(float v) { return wobT(v); }

  /* ----- Kiểu dải: trục chuyển động xoay theo uTheta ----- */
  float bandD(vec2 uv) {
    float asp = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * asp, uv.y) - vec2(0.5 * asp, 0.5);
    vec2 ax = vec2(cos(uTheta), sin(uTheta));
    vec2 cr = vec2(-ax.y, ax.x);
    float La = abs(ax.x) * asp + abs(ax.y);                 // độ dài màn hình dọc theo trục
    float Lc = abs(cr.x) * asp + abs(cr.y);                 // và theo phương vuông góc
    float sRaw = dot(p, ax) / La + 0.5;
    float v = dot(p, cr) / Lc + 0.5;
    float s = uDir > 0.0 ? sRaw : 1.0 - sRaw;
    float f = mix(F0, F1, uP);

    float a = (f + offF(v) - s) * La;                       // > 0: đã qua bờ trước
    float b = (s - (f - W + offT(v))) * La;                 // > 0: chưa qua bờ sau
    float h = 0.003;
    float sa = (offF(v + h) - offF(v - h)) / (2.0 * h) * La / Lc;
    float sb = (offT(v + h) - offT(v - h)) / (2.0 * h) * La / Lc;
    float D = min(a * inversesqrt(1.0 + sa * sa), b * inversesqrt(1.0 + sb * sb));

    // Giọt dẫn đầu phía trước bờ sóng
    float fade = smoothstep(0.0, 0.06, uP);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 c = vec2(f * La + 0.07 + 0.06 * fi + 0.01 * sin(uT * 4.0 + fi),
                    fract(0.15 + 0.29 * fi + uSeed * 0.7) * Lc);
      float r = 0.032 + 0.011 * fi;
      D = max(D, (r - length(vec2(s * La, v * Lc) - c)) * fade);
    }
    return D;
  }

  /* ----- Kiểu vòng: vành khuyên gợn, toả ra hoặc co vào ----- */
  float ringD(vec2 uv) {
    float asp = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * asp, uv.y) - uC0;
    float r = length(p);
    float th = atan(p.y, p.x);
    float Ro = mix(RO0, uRO1, uP);
    float Ri = Ro - uRW;

    float wo  = 0.040 * sin(3.0 * th + uT * 2.0 + uSeed * 6.0)
              + 0.025 * sin(5.0 * th - uT * 3.0 + 1.3)
              + 0.020 * sin(8.0 * th + uT * 2.5 + uSeed * 2.0);
    float wi  = 0.035 * sin(4.0 * th - uT * 2.2 + uSeed * 3.0)
              + 0.020 * sin(7.0 * th + uT * 3.0);
    float dwo = 0.120 * cos(3.0 * th + uT * 2.0 + uSeed * 6.0)
              + 0.125 * cos(5.0 * th - uT * 3.0 + 1.3)
              + 0.160 * cos(8.0 * th + uT * 2.5 + uSeed * 2.0);
    float dwi = 0.140 * cos(4.0 * th - uT * 2.2 + uSeed * 3.0)
              + 0.140 * cos(7.0 * th + uT * 3.0);
    float rr = max(r, 0.06);
    float D = min(((Ro + wo) - r) * inversesqrt(1.0 + dwo * dwo / (rr * rr)),
                  (r - (Ri + wi)) * inversesqrt(1.0 + dwi * dwi / (rr * rr)));

    // Giọt dẫn đầu: phía ngoài khi toả ra, phía trong khi co vào
    float fade = smoothstep(0.0, 0.06, uP);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float ph = 6.2832 * fract(0.10 + 0.29 * fi + uSeed * 0.7);
      float lead = uRev > 0.5 ? (Ri - 0.07 - 0.06 * fi) : (Ro + 0.07 + 0.06 * fi);
      float rb = lead > 0.05 ? 0.032 + 0.011 * fi : 0.0;
      D = max(D, (rb - length(p - lead * vec2(cos(ph), sin(ph)))) * fade);
    }
    return D;
  }

  /* Khoảng cách có dấu tới mép khối kính (đơn vị chiều cao màn hình, dương = bên trong) */
  float shapeD(vec2 uv) { return uMode > 0.5 ? ringD(uv) : bandD(uv); }

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

    // Mép khuất sáng: kính dày nên tối lại; nền sáng thì tối đậm hơn + đường viền mảnh
    float darkA = smoothstep(0.08, 0.65, rim) * 0.26 * mix(1.0, 2.2, uBg);
    darkA += exp(-pow(k / 0.06, 2.0)) * 0.38 * uBg;
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
    style: styleOpt = 'random',    // 'random' | tên một kiểu | mảng tên kiểu
    duration = 2.0,
    armDelay = 1500,               // chờ preloader xong rồi mới bật (ms)
    cooldown = 900,                // nghỉ tối thiểu giữa hai lần bắt đầu (ms)
    smart = true,                  // xử lý thông minh khi cuộn nhanh / section ngắn
    minSection = 0.6,              // section thấp hơn mức này (x chiều cao màn hình) bị gộp, không có chuyển tiếp riêng
    fullDwell = null,              // thời gian ở lại (s) tối thiểu để chạy bản đầy đủ; null = tự tính: duration x 1.1 + gap
    quickDwell = null,             // dưới mức này: bỏ qua; giữa hai mức: bản nhanh; null = tự tính: quickDuration + gap
    quickDuration = 0.85,          // thời lượng bản nhanh (s), không hiện chữ
    abortSpeed = 3500,             // px/s: vụt nhanh hơn mức này trước khi kính phủ kín -> rút lui êm
    gap = 300,                     // nghỉ (ms) sau khi một lần chạy kết thúc, tránh nhấp nháy khi lướt qua nhiều section
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

  /* ----- Lớp 1: kính trong (backdrop mờ + khúc xạ), cắt theo hình khối. KHÔNG có màu nền ----- */
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
  });
  const titleEl = document.createElement('div');
  Object.assign(titleEl.style, {
    fontSize: 'clamp(30px, 6.5vw, 88px)', fontWeight: '700', letterSpacing: '-0.03em', lineHeight: '1.05',
    maxWidth: '86vw',
  });
  const subEl = document.createElement('div');
  Object.assign(subEl.style, {
    fontSize: 'clamp(14px, 1.7vw, 20px)', fontWeight: '500', opacity: '0.85', maxWidth: '60ch',
  });
  label.append(numEl, titleEl, subEl);

  document.body.append(...(svg ? [svg] : []), glass, cv, label);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uT: { value: 0 }, uP: { value: 0 }, uDir: { value: 1 }, uSeed: { value: 0.3 }, uBg: { value: 0 },
    uMode: { value: 0 }, uTheta: { value: Math.PI / 2 }, uRev: { value: 0 },
    uC0: { value: new THREE.Vector2(0.8, 0.5) }, uRW: { value: RW0 }, uRO1: { value: 3.0 },
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
    const vh = window.innerHeight;
    els = els.filter((el) => {
      const h = el.offsetHeight, m = el.dataset.lt;             // data-lt="off": bỏ qua, "on": luôn tính
      if (m === 'off') return false;
      if (m === 'on') return h > 0;
      return h > 80 && (!smart || h >= minSection * vh);
    });
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

  /* ----- Chọn kiểu: xáo túi, không lặp kiểu vừa rồi ----- */
  let bag = [], lastStyle = '';
  function pickStyle() {
    if (typeof styleOpt === 'string' && ALL_STYLES.includes(styleOpt)) return styleOpt;
    const pool = Array.isArray(styleOpt) ? styleOpt.filter((s) => ALL_STYLES.includes(s)) : ALL_STYLES;
    if (!pool.length) return 'wave';
    if (!bag.length) {
      bag = pool.slice().sort(() => Math.random() - 0.5);
      if (bag.length > 1 && bag[0] === lastStyle) bag.push(bag.shift());
    }
    lastStyle = bag.shift();
    return lastStyle;
  }

  /* ----- Cấu hình một lần chạy theo kiểu ----- */
  let cur = null;
  function configure(name, d, vw, vh) {
    const asp = vw / vh;
    const c = { name, mode: 0, theta: Math.PI / 2, rev: false, quick: false, dur: duration, vw, vh, asp };
    if (name === 'sweep') c.theta = 0;
    else if (name === 'diagonal') { c.theta = (Math.random() < 0.5 ? 1 : -1) * (0.55 + Math.random() * 0.45); }
    else if (name === 'ripple') {
      c.mode = 1;
      c.rev = d < 0;
      c.dur = duration * 1.1;
      c.c0 = [asp * (0.5 + (Math.random() - 0.5) * 0.2), 0.5 + (Math.random() - 0.5) * 0.2];
      const Rm = Math.hypot(Math.max(c.c0[0], asp - c.c0[0]), Math.max(c.c0[1], 1 - c.c0[1]));
      c.RW = Math.max(RW0, Rm + 0.7);
      c.RO1 = Rm + 0.12 + c.RW;
      const span = c.RO1 - RO0;
      const pi = (Rm + 0.085 - RO0) / span, po = (c.RW - 0.06 - RO0) / span;     // khoảng p kính phủ kín
      c.pIn = c.rev ? 1 - po : pi;
      c.pOut = c.rev ? 1 - pi : po;
      return c;
    }
    c.pIn = (1.11 - F0) / (F1 - F0);
    c.pOut = (W - 0.075 - F0) / (F1 - F0);
    return c;
  }

  /* ----- Đường cắt lớp kính theo đúng hình khối (cùng công thức với shader) ----- */
  function bandPolygon(pe, t) {
    const { asp, theta } = cur;
    const ax = [Math.cos(theta), Math.sin(theta)], cr = [-ax[1], ax[0]];
    const La = Math.abs(ax[0]) * asp + Math.abs(ax[1]);
    const Lc = Math.abs(cr[0]) * asp + Math.abs(cr[1]);
    const f = F0 + (F1 - F0) * pe;
    const up = dir > 0;
    const pt = (sb, v) => {
      const sRaw = up ? sb : 1 - sb;
      const along = (sRaw - 0.5) * La, across = (v - 0.5) * Lc;
      const px = ax[0] * along + cr[0] * across + 0.5 * asp;
      const py = ax[1] * along + cr[1] * across + 0.5;
      return ((px / asp) * 100).toFixed(2) + '% ' + ((1 - py) * 100).toFixed(2) + '%';
    };
    const N = 56, pts = [];
    for (let i = 0; i <= N; i++) {
      const v = -0.03 + (1.06 * i) / N;
      pts.push(pt(clamp(f + offF(v, t, seed), -0.15, 1.15), v));
    }
    for (let i = N; i >= 0; i--) {
      const v = -0.03 + (1.06 * i) / N;
      pts.push(pt(clamp(f - W + offT(v, t, seed), -0.15, 1.15), v));
    }
    return 'polygon(' + pts.join(',') + ')';
  }
  function ringPath(pe, t) {
    const { vw, vh, asp, c0, RW, RO1 } = cur;
    const Ro = RO0 + (RO1 - RO0) * pe, Ri = Ro - RW;
    const M = 96;
    let outer = '', inner = '';
    for (let i = 0; i < M; i++) {
      const th = (2 * Math.PI * i) / M;
      const ro = Math.max(0.001, Ro + woR(th, t, seed));
      const ri = Math.max(0.0, Ri + wiR(th, t, seed));
      const c = Math.cos(th), s = Math.sin(th);
      const f2 = (r) => ((c0[0] + r * c) / asp * vw).toFixed(1) + ' ' + ((1 - (c0[1] + r * s)) * vh).toFixed(1);
      outer += (i ? 'L' : 'M') + f2(ro);
      inner += (i ? 'L' : 'M') + f2(ri);
    }
    return `path(evenodd, '${outer}Z${inner}Z')`;
  }

  /* ----- Chạy hiệu ứng ----- */
  const state = { p: 0 };
  let playing = false, aborting = false, lastPlay = 0, lastEnd = 0, destroyed = false;
  let dir = 1, t0 = 0, seed = 0.3, labelSet = false, prev = -1;

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
    if (smart && !cur.quick && !aborting && p < cur.pIn - 0.14 && curVel() > abortSpeed) { abort(); return; }
    const pe = cur.rev ? 1 - p : p;
    uniforms.uT.value = t;
    uniforms.uP.value = pe;

    glass.style.clipPath = cur.mode === 1 ? ringPath(pe, t) : bandPolygon(pe, t);

    // Khúc xạ: mạnh nhất giữa lúc kính phủ qua, gợn chảy theo thời gian
    if (disp) {
      disp.setAttribute('scale', (70 * Math.sin(Math.PI * p)).toFixed(1));
      turb.setAttribute('baseFrequency', '0.006 ' + (0.011 + 0.002 * Math.sin(t * 1.5)).toFixed(5));
    }

    if (labels && !cur.quick) {
      if (!labelSet && p >= cur.pIn - 0.12) { labelSet = true; setLabel(); }
      const o = sstep(cur.pIn - 0.1, cur.pIn, p) * (1 - sstep(cur.pOut, cur.pOut + 0.1, p));
      label.style.opacity = o.toFixed(3);
      if (cur.mode === 1) {                                   // vòng: chữ nở nhẹ ra
        label.style.transform = 'scale(' + (0.9 + 0.1 * sstep(cur.pIn - 0.1, cur.pOut, p)).toFixed(3) + ')';
      } else {                                                // dải: chữ trôi cùng chiều chảy
        const sg = dir > 0 ? 1 : -1, sh = (0.5 - p) * 160;
        label.style.transform = 'translate(' + (-sg * Math.cos(cur.theta) * sh).toFixed(1) + 'px,' + (sg * Math.sin(cur.theta) * sh).toFixed(1) + 'px)';
      }
    }
    renderer.render(scene, camera);
  }

  /* Kết thúc (hoặc rút lui xong): trả mọi lớp về trạng thái nghỉ */
  function finish() {
    glass.style.visibility = cv.style.visibility = label.style.visibility = 'hidden';
    glass.style.opacity = cv.style.opacity = '';
    label.style.opacity = '0';
    renderer.clear();
    playing = false;
    lastEnd = performance.now();
  }
  /* Người dùng vụt quá nhanh khi kính chưa phủ kín: mờ dần rồi biến mất, không chạy lỡ dở */
  function abort() {
    if (!playing || aborting) return;
    aborting = true;
    gsap.killTweensOf(state);
    gsap.to([glass, cv], { opacity: 0, duration: 0.18, ease: 'power1.out', onComplete() { aborting = false; finish(); } });
  }

  function play(d = 1, styleName, quick = false) {
    if (playing || destroyed) return;
    playing = true;
    lastPlay = performance.now();
    dir = d >= 0 ? 1 : -1;
    seed = Math.random();
    const vw = window.innerWidth, vh = window.innerHeight;
    cur = configure(ALL_STYLES.includes(styleName) ? styleName : pickStyle(), dir, vw, vh);
    cur.quick = quick;
    if (quick) cur.dur = quickDuration;

    uniforms.uDir.value = dir;
    uniforms.uSeed.value = seed;
    uniforms.uBg.value = sstep(0.35, 0.65, pageLum());
    uniforms.uMode.value = cur.mode;
    uniforms.uTheta.value = cur.theta;
    uniforms.uRev.value = cur.rev ? 1 : 0;
    if (cur.mode === 1) {
      uniforms.uC0.value.set(cur.c0[0], cur.c0[1]);
      uniforms.uRW.value = cur.RW;
      uniforms.uRO1.value = cur.RO1;
    }
    t0 = performance.now();
    labelSet = false;
    state.p = 0;
    glass.style.visibility = cv.style.visibility = label.style.visibility = 'visible';
    gsap.to(state, {
      p: 1, duration: cur.dur, ease: 'none',
      onUpdate: render,
      onComplete: finish,
    });
  }

  /* ----- Lắng nghe cuộn: nhìn trước theo hướng cuộn để kính phủ kín đúng lúc section đổi ----- */
  let armed = false, raf = 0, lastY = window.scrollY, dirS = 1;
  let vel = 0, velFast = 0, lastT = 0;                        // tốc độ cuộn (px/s): vel = mượt (để quyết định), velFast = nhạy (để rút lui)
  const curVel = () => (performance.now() - lastT > 140 ? 0 : velFast);   // dừng cuộn quá 140ms: coi như 0

  /* Quyết định theo "thời gian ở lại": section đích cao h, đang cuộn v px/s -> ở lại h/v giây */
  function decide(idx) {
    if (!smart) return 'full';
    const dwell = sections[idx].offsetHeight / Math.max(vel, 250);
    if (dwell >= (fullDwell ?? duration * 1.1 + gap / 1000)) return 'full';        // vừa khít giữa hai lần đổi section
    if (dwell >= (quickDwell ?? quickDuration + gap / 1000)) return 'quick';
    return null;                                              // lướt vèo qua: không chuyển tiếp
  }

  function check() {
    raf = 0;
    if (!armed || destroyed) return;
    const now = performance.now();
    const y = window.scrollY, dy = y - lastY;
    if (Math.abs(dy) < 0.5) return;
    const dt = Math.min(Math.max(now - lastT, 8), 64);        // giới hạn dt để cú vụt đầu tiên không bị đánh giá thấp
    const vi = (Math.abs(dy) / dt) * 1000;
    const fresh = now - lastT > 140;
    vel = fresh ? vi : vel + (vi - vel) * (1 - Math.exp(-dt / 120));          // làm mượt ~120ms: không bị lừa bởi từng cú lăn chuột
    velFast = fresh ? vi : velFast + (vi - velFast) * (1 - Math.exp(-dt / 35));
    lastT = now; lastY = y;
    const d = dy > 0 ? 1 : -1;
    const line = window.innerHeight * (0.5 + d * look);
    if (d !== dirS) { dirS = d; const k = idxAt(line); if (k >= 0) prev = k; return; }   // đổi chiều: đặt lại mốc, không kích hoạt
    const idx = idxAt(line);
    if (idx < 0) return;                                      // đang ở section ngắn bị gộp: giữ mốc cũ
    if (prev >= 0 && idx !== prev && !playing && enabled() && now - lastPlay > cooldown && now - lastEnd > gap) {
      const mode = decide(idx);
      if (mode) play(d, undefined, mode === 'quick');
    }
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
  let roT = 0;                                                // nội dung đổi chiều cao: cập nhật danh sách section
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { clearTimeout(roT); roT = window.setTimeout(refresh, 150); }) : null;
  ro?.observe(document.body);

  return {
    play,
    refresh,
    setTexts(next) { texts = { ...texts, ...(next || {}) }; },
    destroy() {
      destroyed = true;
      clearTimeout(armTimer); clearTimeout(roT); ro?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', refresh);
      gsap.killTweensOf(state);
      renderer.dispose();
      svg?.remove(); glass.remove(); cv.remove(); label.remove();
    },
  };
}